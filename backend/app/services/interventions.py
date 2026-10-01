"""人工介入紀錄（0.3）：POC 人力介入階梯實驗的純規則——升級順序與分鐘摘要。

全部是純函式，不碰資料庫；數字與順序由 tests/test_interventions.py 鎖住。
- escalate(trigger, history)：同一個 trigger 先讓系統試一次，再升到巡邏，再升到嚮導（頂層不再升）。cs 不在階梯上。
- summary(rows, week)：每生每週人力分鐘（by ≠ system 才算人力）、各 kind 分鐘、各 trigger 次數。
- 紀錄的 note 最多 200 字、不放個資（姓名、聯絡方式都不要寫進去）。
"""

import datetime as _dt
from typing import Any, Dict, Iterable, Optional

BY = ("system", "patrol", "guide", "cs")
LADDER = ("system", "patrol", "guide")  # 升級階梯：系統 → 巡邏 → 嚮導
KINDS = ("nudge", "explain", "comfort", "demo", "review", "parent_note")
TRIGGERS = ("help_timeout", "three_wrong", "three_days_off", "expedition", "weekly", "parent_message", "manual")
LAYERS = ("L0", "L1", "L2", "L3")  # 小隊的人力介入分層（實驗用）
DEFAULT_LAYER = "L2"
NOTE_MAX = 200


def _get(row: Any, key: str) -> Any:
    return row.get(key) if isinstance(row, dict) else getattr(row, key, None)


def week_key(when: _dt.datetime) -> str:
    """ISO 週：2026-W40。"""
    y, w, _ = when.isocalendar()
    return f"{y}-W{w:02d}"


def escalate(trigger: str, history: Iterable[Any]) -> str:
    """回下一個該介入的層級。history：同一位學生（或小隊）這一回合裡、過去的介入紀錄（dict 或物件，要有 trigger 與 by）。
    每個 trigger 先系統試一次 → 巡邏 → 嚮導；嚮導是頂層，之後維持嚮導。其他 trigger 的紀錄不影響這個 trigger 的階梯。"""
    if trigger not in TRIGGERS:
        raise ValueError(f"沒有這個觸發條件：{trigger}")
    reached = -1
    for h in history:
        if _get(h, "trigger") == trigger and _get(h, "by") in LADDER:
            reached = max(reached, LADDER.index(_get(h, "by")))
    return LADDER[min(reached + 1, len(LADDER) - 1)]


def is_human(by: str) -> bool:
    return by in BY and by != "system"


def summary(rows: Iterable[Any], week: Optional[str] = None) -> Dict[str, Any]:
    """rows：{student_id, team_id, by, kind, trigger, minutes, created_at}；week：YYYY-Www，不給就全部週。
    人力分鐘＝by ≠ system 的分鐘；系統介入另外計 system_minutes。沒有 student_id 的小隊層級紀錄進 team_minutes。"""
    per_student: Dict[int, float] = {}
    per_student_week: Dict[int, Dict[str, float]] = {}
    per_kind: Dict[str, float] = {k: 0.0 for k in KINDS}
    per_trigger: Dict[str, int] = {t: 0 for t in TRIGGERS}
    per_by: Dict[str, float] = {b: 0.0 for b in BY}
    human = system = team_minutes = 0.0
    count = 0
    students = set()
    for r in rows:
        wk = week_key(_get(r, "created_at"))
        if week is not None and wk != week:
            continue
        count += 1
        by, minutes = _get(r, "by"), float(_get(r, "minutes") or 0)
        per_trigger[_get(r, "trigger")] = per_trigger.get(_get(r, "trigger"), 0) + 1
        per_by[by] = per_by.get(by, 0.0) + minutes
        if not is_human(by):
            system += minutes
            continue
        human += minutes
        per_kind[_get(r, "kind")] = per_kind.get(_get(r, "kind"), 0.0) + minutes
        sid = _get(r, "student_id")
        if sid is None:
            team_minutes += minutes
            continue
        students.add(sid)
        per_student[sid] = per_student.get(sid, 0.0) + minutes
        per_student_week.setdefault(sid, {})[wk] = per_student_week.get(sid, {}).get(wk, 0.0) + minutes
    return {
        "week": week,
        "count": count,
        "students": len(students),
        "human_minutes": round(human, 1),
        "system_minutes": round(system, 1),
        "team_minutes": round(team_minutes, 1),
        "per_student": {k: round(v, 1) for k, v in per_student.items()},
        "per_student_week": {k: {w: round(v, 1) for w, v in d.items()} for k, d in per_student_week.items()},
        "per_kind": {k: round(v, 1) for k, v in per_kind.items()},
        "per_trigger": per_trigger,
        "per_by": {k: round(v, 1) for k, v in per_by.items()},
    }
