"""家長週報：由學生狀態生成「他學會什麼、下週做什麼、今晚可以問他這一句」。與前端 report.js 的 weeklySummary 對齊。"""

from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session as DBSession

from .. import models
from ..models import json_set
from . import content as C
from . import rules


def _in_week(d: Optional[date], start: date, end: date) -> bool:
    return d is not None and start <= d <= end


def recent_skill(student: models.Student) -> Optional[str]:
    for p in reversed(student.practices):
        if p.skill_id:
            return p.skill_id
    stuck = student.stuck
    return stuck[0] if stuck else None


def build(db: DBSession, student: models.Student, today: Optional[date] = None) -> Dict[str, Any]:
    today = today or rules.local_now().date()
    start, end = rules.week_range(today)
    skills = C.skills()
    title = lambda k: skills[k]["title"] if k in skills else k  # noqa: E731

    practices = [p for p in student.practices if _in_week(p.date, start, end)]
    practice_days = len({p.date for p in practices})
    explain_passes = sum(1 for p in practices if p.kind == "explain" and p.explain_passed)
    hints = sum(p.hints for p in practices)

    learned = [title(r.skill_id) for r in student.retests if r.status == "mastered" and _in_week(r.completed_on, start, end)]
    explained = [{"title": title(r.skill_id), "due": r.due_date.isoformat()} for r in student.retests if r.status == "scheduled"]

    next_session: Optional[Dict[str, str]] = None
    teacher_note: Optional[str] = None
    next_week: List[str] = []
    for m in student.memberships:
        team = m.team
        if team.status != "confirmed":
            continue
        upcoming = [s for s in team.sessions if s.date >= today and s.status == "scheduled"]
        if upcoming:
            s = upcoming[0]
            next_session = {"date": s.date.isoformat(), "week": str(s.week), "topic": s.topic}
            next_week.append(f"第 {s.week} 堂小隊課：{s.topic}")
        done = [s for s in team.sessions if s.notes]
        if done:
            teacher_note = done[-1].notes[-1].text
        break

    for e in explained[:2]:
        next_week.append(f"{e['due'][5:].replace('-', '/')} 再測「{e['title']}」，不給提示")
    rs = recent_skill(student)
    tonight = skills[rs]["tonight"] if rs in skills else None

    lines: List[str] = []
    if learned:
        lines.append(f"{student.nickname}這週翻過去了：{'、'.join(learned)}。")
    elif explain_passes:
        lines.append(f"{student.nickname}這週有 {explain_passes} 次能用自己的話講出來，過幾天再測一次才算學會。")
    else:
        lines.append(f"{student.nickname}這週練了 {practice_days} 天。")
    if next_week:
        lines.append("下週：" + "；".join(next_week) + "。")
    if tonight:
        lines.append(tonight)

    body = {
        "student_id": student.id,
        "nickname": student.nickname,
        "week_start": start,
        "week_end": end,
        "learned": learned,
        "explained": explained,
        "practice_days": practice_days,
        "explain_passes": explain_passes,
        "hints": hints,
        "next_session": next_session,
        "next_week": next_week,
        "tonight": tonight,
        "teacher_note": teacher_note,
        "lines": lines,
    }
    db.add(
        models.ParentReport(
            student_id=student.id,
            week_start=start,
            week_end=end,
            body_json=json_set({**body, "week_start": start.isoformat(), "week_end": end.isoformat()}),
        )
    )
    db.commit()
    return body
