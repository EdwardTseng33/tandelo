"""湊隊與成班。示範隊友是種子資料（is_seed=True 的學生），依卡點重疊與時段湊隊。"""

from datetime import date, datetime
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from .. import models
from ..models import json_get, json_set
from . import content as C
from . import rules


class TeamError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def student_slots(student: models.Student) -> List[str]:
    return sorted(a.slot_id for a in student.availability)


def _candidates(db: DBSession, student: models.Student, slot_id: str) -> List[models.Student]:
    """同年級、有空在這一格、還沒在進行中小隊的種子學生；卡點重疊的排前面。"""
    stmt = (
        select(models.Student)
        .join(models.Availability, models.Availability.student_id == models.Student.id)
        .where(models.Availability.slot_id == slot_id, models.Student.id != student.id, models.Student.grade == student.grade)
    )
    busy = {m.student_id for m in db.scalars(select(models.TeamMember).join(models.Team).where(models.Team.status.in_(["forming", "confirmed"])))}
    mine = set(student.stuck)
    out = [s for s in db.scalars(stmt).unique() if s.id not in busy]
    out.sort(key=lambda s: (-len(mine & set(s.stuck)), s.id))
    return out


def match(db: DBSession, student: models.Student, plan_id: str, now: Optional[datetime] = None) -> models.Team:
    """依卡點＋時段湊隊：先找還在成形、同年級、同時段、沒滿的小隊；沒有就開一隊並拉種子隊友進來。"""
    now = now or rules.local_now()
    if not student.stuck:
        raise TeamError(409, "還沒做初步診斷，先讓小陪知道卡在哪一步。")
    slots = student_slots(student)
    if not slots:
        raise TeamError(409, "還沒選有空的時段。")
    if any(m.team.status in ("forming", "confirmed") for m in student.memberships):
        raise TeamError(409, "同科同時只能在一個小隊。")

    # 1) 既有成形中的小隊
    for team in db.scalars(select(models.Team).where(models.Team.status == "forming", models.Team.grade == student.grade)):
        if team.slot_id in slots and team.size < team.max_size:
            _add_member(db, team, student, plan_id)
            db.commit()
            db.refresh(team)
            return team

    # 2) 開新隊：挑「可湊到的隊友最多」的那一格
    best_slot, best = None, []
    for slot in slots:
        c = _candidates(db, student, slot)
        if len(c) > len(best) or (len(c) == len(best) and best_slot is None):
            best_slot, best = slot, c
    assert best_slot is not None
    day, hh, mm = C.parse_slot(best_slot)
    team = models.Team(
        subject="數學",
        grade=student.grade,
        slot_id=best_slot,
        first_date=rules.first_lesson_date(now, day, hh, mm),
        focus_json=json_set(student.stuck[:2]),
    )
    db.add(team)
    db.flush()
    _add_member(db, team, student, plan_id)
    for mate in best[: rules.MIN_SIZE - 1]:  # 示範：拉到剛好 4 人以下，讓「接班」那一步有意義
        _add_member(db, team, mate, "8")
    db.commit()
    db.refresh(team)
    return team


def _add_member(db: DBSession, team: models.Team, student: models.Student, plan_id: str) -> None:
    if team.status == "cancelled":
        raise TeamError(409, "這一隊已取消。")
    if team.size >= team.max_size:
        raise TeamError(409, f"這一隊已滿（上限 {team.max_size} 人）。")
    if any(m.student_id == student.id for m in team.members):
        raise TeamError(409, "已經在這一隊裡了。")
    db.add(models.TeamMember(team_id=team.id, student_id=student.id, plan_id=plan_id))
    db.flush()


def join(db: DBSession, team: models.Team, student: models.Student, plan_id: str) -> models.Team:
    if team.status == "confirmed" and team.size >= team.max_size:
        raise TeamError(409, f"這一隊已滿（上限 {team.max_size} 人）。")
    _add_member(db, team, student, plan_id)
    db.commit()
    db.refresh(team)
    return team


def accept(db: DBSession, team: models.Team, teacher: models.Teacher) -> models.Team:
    """老師按「接這一隊」：滿 4 人成班、3 人改 1 對 3、2 人以下不開。"""
    if team.status == "cancelled":
        raise TeamError(409, "這一隊已取消。")
    if team.status == "confirmed":
        raise TeamError(409, "這一隊已經成班了。")
    verdict = rules.squad_rule(team.size, team.min_size, team.max_size)
    if not verdict["ok"]:
        raise TeamError(409, f"目前 {team.size} 人：{verdict['label']}。")
    team.teacher_id = teacher.id
    team.status = "confirmed"
    team.mode = verdict["mode"]
    if not team.sessions:
        _create_sessions(db, team)
    db.commit()
    db.refresh(team)
    return team


def _create_sessions(db: DBSession, team: models.Team) -> None:
    focus = json_get(team.focus_json)
    plan = C.syllabus(focus, team.grade)
    first = team.first_date or date.today()
    for row, d in zip(plan, rules.lesson_dates(first, 8)):
        db.add(
            models.Session(
                team_id=team.id,
                week=row["week"],
                date=d,
                topic=row["topic"],
                skill_id=row["skill"],
                segments_json=json_set(C.segments()),
            )
        )
    db.flush()


def team_out(team: models.Team) -> Dict:
    verdict = rules.squad_rule(team.size, team.min_size, team.max_size)
    return {
        "id": team.id,
        "name": team.name or "",
        "subject": team.subject,
        "grade": team.grade,
        "slot_id": team.slot_id,
        "slot_label": C.slot_label(team.slot_id),
        "first_date": team.first_date,
        "teacher_id": team.teacher_id,
        "teacher_name": team.teacher.nickname if team.teacher else None,
        "status": team.status,
        "mode": team.mode,
        "size": team.size,
        "min_size": team.min_size,
        "max_size": team.max_size,
        "rule": verdict["label"],
        "focus": json_get(team.focus_json),
        "layer": team.layer or "L2",
        "members": [{"student_id": m.student_id, "nickname": m.student.nickname, "plan_id": m.plan_id, "stuck": m.student.stuck} for m in team.members],
        "sessions": len(team.sessions),
    }
