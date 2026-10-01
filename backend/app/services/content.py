"""題庫與卡點地圖：從 app/data/content.json 載入（由前端 content.js 匯出，全部虛構）。"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "content.json"

DAYS = ["一", "二", "三", "四", "五", "六", "日"]


@lru_cache
def content() -> Dict[str, Any]:
    with DATA_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def skills() -> Dict[str, Any]:
    return content()["skills"]


def skill(skill_id: str) -> Dict[str, Any]:
    try:
        return skills()[skill_id]
    except KeyError:
        raise KeyError(f"沒有這個卡點：{skill_id}") from None


def skill_order() -> List[str]:
    return content()["skill_order"]


def diag_questions() -> List[Dict[str, Any]]:
    return content()["diag_questions"]


def segments() -> List[Dict[str, Any]]:
    return content()["segments"]


def school_topics(grade: str) -> List[str]:
    topics = content()["school_topics"]
    return topics.get(grade) or topics["國二"]


def slot_label(slot_id: str) -> str:
    """d2-1900 → 週三 19:00–19:50"""
    if not slot_id or len(slot_id) != 7 or slot_id[0] != "d":
        return ""
    day = int(slot_id[1])
    hh, mm = int(slot_id[3:5]), int(slot_id[5:7])
    return f"週{DAYS[day]} {hh:02d}:{mm:02d}–{hh:02d}:{mm + 50:02d}"


def parse_slot(slot_id: str):
    """回傳 (weekday 0=週一, 小時, 分)。"""
    return int(slot_id[1]), int(slot_id[3:5]), int(slot_id[5:7])


def syllabus(stuck: List[str], grade: str = "國二") -> List[Dict[str, Any]]:
    """8 週課表：補洞 2 週、段考訂正、跟上學校 3 週、衝刺 2 週。與前端 syllabus() 一致。"""
    all_skills = skills()
    first = stuck[0] if stuck and stuck[0] in all_skills else "sq-cross"
    second = stuck[1] if len(stuck) > 1 and stuck[1] in all_skills else None
    s1, s2 = all_skills[first], (all_skills[second] if second else None)
    school = school_topics(grade)
    alt = second or first
    return [
        {"week": 1, "phase": "fix", "topic": s1["title"], "skill": first},
        {"week": 2, "phase": "fix", "topic": s2["title"] if s2 else f"{s1['title']}（變化題）", "skill": alt},
        {"week": 3, "phase": "exam", "topic": "段考訂正：用自己的錯題再走一次", "skill": first},
        {"week": 4, "phase": "school", "topic": school[0], "skill": alt, "checkpoint": True},
        {"week": 5, "phase": "school", "topic": school[1], "skill": first},
        {"week": 6, "phase": "school", "topic": school[2], "skill": alt},
        {"week": 7, "phase": "sprint", "topic": "衝刺：段考範圍混合題", "skill": first},
        {"week": 8, "phase": "sprint", "topic": "衝刺：模擬段考＋訂正", "skill": alt},
    ]
