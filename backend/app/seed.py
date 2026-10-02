"""種子資料：虛構隊友、老師；冒險世界的兩支虛構小隊、夥伴與戰績。題庫在 app/data/content.json，不進資料庫。
用法：python -m app.seed（或 make seed）。重複執行不會重複灌。"""

from datetime import date, timedelta
from typing import List

from sqlalchemy.orm import Session as DBSession

from . import models
from .models import json_set
from .services import content as C
from .services import rules
from .services import world as W

# 虛構隊友：暱稱、卡點、有空的格子
SEED_STUDENTS = [
    {"nickname": "小安", "stuck": ["sq-cross", "sign-dist"], "slots": ["d2-1900", "d2-2000", "d0-1900", "d5-1400"]},
    {"nickname": "小晴", "stuck": ["sq-cross", "factor-cross"], "slots": ["d2-1900", "d4-2000", "d6-1400"]},
    {"nickname": "阿哲", "stuck": ["sign-dist"], "slots": ["d2-1900", "d0-1900", "d1-1900"]},
    {"nickname": "小恩", "stuck": ["sqrt-split", "sq-cross"], "slots": ["d2-2000", "d5-1400", "d5-1900", "d3-1900"]},
    {"nickname": "小宇", "stuck": ["factor-cross", "quad-zero"], "slots": ["d2-1900", "d4-2000", "d6-1400"]},
    {"nickname": "小柔", "stuck": ["pyth-hyp", "sqrt-abs"], "slots": ["d0-1900", "d5-1400", "d6-1400"]},
    {"nickname": "小翔", "stuck": ["factor-diff", "factor-cross"], "slots": ["d2-1900", "d3-1900", "d5-1900"]},
    {"nickname": "小庭", "stuck": ["sq-cross"], "slots": ["d2-2000", "d4-2000", "d1-1900"]},
]

SEED_TEACHERS = [
    {"nickname": "林老師", "tier": "gold", "intro": "國中數學老師。擅長帶「知道規則、說不出為什麼」的那種卡住。"},
    {"nickname": "陳老師", "tier": "diamond", "intro": "帶小隊課很有耐心，習慣讓孩子先講。"},
    {"nickname": "王老師", "tier": "novice", "intro": "剛加入，數學系畢業，一週兩團。"},
]


# 冒險世界：兩支已成班的虛構小隊（隊員也是新的虛構人物，不佔用上面可湊隊的示範隊友）。
# shadows：(怪 id, 事件序列)；事件照夥伴狀態機走，會產生對應戰績。
SEED_SQUADS = [
    {
        "name": "四葉小隊",
        "teacher": "林老師",
        "slot": "d2-1900",
        "focus": ["sq-cross", "sign-dist"],
        "members": [
            {
                "nickname": "小禾",
                "stuck": ["sq-cross", "sign-dist"],
                "shadows": [("sq-cross", ["diagnosed_stuck", "explained_ok", "retest_passed"]), ("sign-dist", ["diagnosed_stuck"])],
            },
            {
                "nickname": "小芮",
                "stuck": ["sq-cross", "sqrt-split"],
                "shadows": [("sq-cross", ["diagnosed_stuck", "explained_ok"]), ("sqrt-split", ["diagnosed_stuck"])],
            },
            {"nickname": "阿凱", "stuck": ["sq-cross"], "shadows": [("sq-cross", ["diagnosed_stuck", "explained_ok", "retest_passed", "wrong_again"])]},
            {"nickname": "小芸", "stuck": ["sq-cross", "sign-dist"], "shadows": [("sq-cross", ["diagnosed_stuck"]), ("sign-dist", ["diagnosed_stuck"])]},
        ],
        "dungeon": {"week": 1, "region_id": "mult", "rate": 0.7, "stars": 1},
    },
    {
        "name": "星期三小隊",
        "teacher": "陳老師",
        "slot": "d2-2000",
        "focus": ["sq-cross", "sign-dist"],
        "members": [
            {"nickname": "小築", "stuck": ["sq-cross", "sign-dist"], "shadows": [("sq-cross", ["diagnosed_stuck", "explained_ok"])]},
            {"nickname": "阿廷", "stuck": ["sign-dist"], "shadows": [("sign-dist", ["diagnosed_stuck"])]},
            {"nickname": "小蕎", "stuck": ["sq-cross", "sign-dist"], "shadows": [("sq-cross", ["diagnosed_stuck"])]},
            {"nickname": "小頡", "stuck": ["sqrt-split"], "shadows": [("sqrt-split", ["diagnosed_stuck"])]},
        ],
        "dungeon": {"week": 1, "region_id": "mult", "rate": 0.65, "stars": 1},
    },
]

SEED_GUILDS = [
    {"teacher": "林老師", "name": "林老師的公會", "league": "north"},
    {"teacher": "陳老師", "name": "陳老師的公會", "league": "north"},
]


def _seed_world(db: DBSession, created: dict) -> None:
    """冒險世界的種子：公會、兩支小隊（含 8 堂課）、夥伴與戰績、一個已結算的副本。"""
    teachers = {t.nickname: t for t in db.query(models.Teacher).filter_by(is_seed=True).all()}
    if db.query(models.Guild).count() == 0:
        for row in SEED_GUILDS:
            t = teachers.get(row["teacher"])
            if t:
                db.add(models.Guild(teacher_id=t.id, name=row["name"], league=row["league"]))
                created["guilds"] += 1
    exam = date.today() + timedelta(days=56)
    for squad in SEED_SQUADS:
        if db.query(models.Team).filter_by(name=squad["name"]).count():
            continue
        teacher = teachers.get(squad["teacher"])
        day, hh, mm = C.parse_slot(squad["slot"])
        first = rules.first_lesson_date(rules.local_now(), day, hh, mm)
        team = models.Team(
            name=squad["name"],
            subject="數學",
            grade="國二",
            slot_id=squad["slot"],
            first_date=first,
            teacher_id=teacher.id if teacher else None,
            status="confirmed",
            mode="squad",
            focus_json=json_set(squad["focus"]),
        )
        db.add(team)
        db.flush()
        for row, d in zip(C.syllabus(squad["focus"], "國二"), rules.lesson_dates(first, 8)):
            db.add(models.Session(team_id=team.id, week=row["week"], date=d, topic=row["topic"], skill_id=row["skill"], segments_json=json_set(C.segments())))
        for m in squad["members"]:
            s = models.Student(nickname=m["nickname"], grade="國二", exam_date=exam, is_seed=True)
            db.add(s)
            db.flush()
            db.add(models.Diagnostic(student_id=s.id, stuck_json=json_set(m["stuck"]), total=8, correct=8 - len(m["stuck"])))
            db.add(models.TeamMember(team_id=team.id, student_id=s.id, plan_id="8"))
            for monster_id, events in m["shadows"]:
                state = "fog"
                sh = models.Shadow(student_id=s.id, monster_id=monster_id, state=state)
                for ev in events:
                    state = W.transition(state, ev)
                    kind = W.shadow_record_kind(ev)
                    if kind:
                        db.add(models.RecordEvent(student_id=s.id, kind=kind, points=W.RECORD_POINTS[kind], region_id=C.monsters()[monster_id]["region"]))
                    if ev == "retest_passed":
                        sh.captured_at = models.utcnow()
                sh.state = state
                db.add(sh)
            created["students"] += 1
        dg = squad["dungeon"]
        db.add(
            models.Dungeon(
                team_id=team.id,
                week=dg["week"],
                route=W.FIRST_ROUTE,
                subject="數學",
                region_id=dg["region_id"],
                status="settled",
                rate=dg["rate"],
                stars=dg["stars"],
                settled_at=models.utcnow(),
            )
        )
        kind = f"dungeon_{dg['stars']}"
        db.add(models.RecordEvent(team_id=team.id, kind=kind, points=W.RECORD_POINTS[kind], region_id=dg["region_id"]))
        created["teams"] += 1


def seed(db: DBSession) -> dict:
    created = {"students": 0, "teachers": 0, "teams": 0, "guilds": 0}
    if db.query(models.Student).filter_by(is_seed=True).count() == 0:
        exam = date.today() + timedelta(days=56)
        for row in SEED_STUDENTS:
            s = models.Student(nickname=row["nickname"], grade="國二", exam_date=exam, is_seed=True)
            db.add(s)
            db.flush()
            db.add(models.Diagnostic(student_id=s.id, stuck_json=json_set(row["stuck"]), total=8, correct=8 - len(row["stuck"])))
            for slot in row["slots"]:
                db.add(models.Availability(student_id=s.id, slot_id=slot))
            created["students"] += 1
    if db.query(models.Teacher).filter_by(is_seed=True).count() == 0:
        for row in SEED_TEACHERS:
            db.add(models.Teacher(is_seed=True, **row))
            created["teachers"] += 1
    db.flush()
    _seed_world(db, created)
    db.commit()
    return created


def main(argv: List[str] = None) -> None:  # type: ignore[assignment]
    from .main import create_app

    app = create_app()
    db = app.state.session_factory()
    try:
        r = seed(db)
        print(f"種子資料完成：新增學生 {r['students']} 位、老師 {r['teachers']} 位、小隊 {r['teams']} 支、公會 {r['guilds']} 個（已存在的不重複灌）。")
    finally:
        db.close()


if __name__ == "__main__":
    main()
