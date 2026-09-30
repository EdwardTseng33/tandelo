"""種子資料：虛構隊友、老師。題庫在 app/data/content.json，不進資料庫。
用法：python -m app.seed（或 make seed）。重複執行不會重複灌。"""

from datetime import date, timedelta
from typing import List

from sqlalchemy.orm import Session as DBSession

from . import models
from .models import json_set

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


def seed(db: DBSession) -> dict:
    created = {"students": 0, "teachers": 0}
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
    db.commit()
    return created


def main(argv: List[str] = None) -> None:  # type: ignore[assignment]
    from .main import create_app

    app = create_app()
    db = app.state.session_factory()
    try:
        r = seed(db)
        print(f"種子資料完成：新增學生 {r['students']} 位、老師 {r['teachers']} 位（已存在的不重複灌）。")
    finally:
        db.close()


if __name__ == "__main__":
    main()
