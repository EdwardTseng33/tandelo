"""純規則：再測日期、成班規則、分潤與保底、關燈、48 小時截止。全部是純函式，方便測試。
數字與前端 state.js / teachers.js 一致；改一邊要記得改另一邊。"""

import math
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

# ——— 再測：用的提示越多，越早再測；範圍 7–12 天 ———
RETEST_MIN, RETEST_MAX = 7, 12


def retest_days(hints: int) -> int:
    h = max(0, int(hints or 0))
    return min(RETEST_MAX, max(RETEST_MIN, RETEST_MAX - 2 * h))


def retest_due(from_date: date, hints: int) -> date:
    return from_date + timedelta(days=retest_days(hints))


# ——— 成班：滿 4 人成班、3 人改 1 對 3、2 人以下不開全額退、上限 6 ———
MIN_SIZE, MAX_SIZE = 4, 6


def squad_rule(n: int, min_size: int = MIN_SIZE, max_size: int = MAX_SIZE) -> Dict[str, Any]:
    if n > max_size:
        return {"ok": False, "mode": None, "label": f"超過上限 {max_size} 人"}
    if n >= min_size:
        return {"ok": True, "mode": "squad", "label": f"{n} 人成班"}
    if n == min_size - 1:
        return {"ok": True, "mode": "one_to_three", "label": "改 1 對 3，學費照調"}
    return {"ok": False, "mode": None, "label": "不開班，全額退"}


# ——— 老師收入：學費 × 等級分潤（45／52／60%），每堂保底 600；一個月以 4.3 週計 ———
TIERS = {"novice": 0.45, "gold": 0.52, "diamond": 0.60}
TIER_ALIASES = {"new": "novice", "新手": "novice", "黃金": "gold", "鑽石": "diamond"}
FLOOR = 600
PER_STUDENT_TUITION = 2990 / 8  # 8 團主力方案，每人每堂
WEEKS_PER_MONTH = 4.3
SESSION_MINUTES = 50


def js_round(x: float) -> int:
    """JavaScript 的 Math.round（.5 進位），避免 Python 的四捨六入五成雙造成兩邊差 1 元。"""
    return int(math.floor(x + 0.5))


def normalize_tier(tier: Optional[str]) -> str:
    t = (tier or "gold").strip().lower()
    t = TIER_ALIASES.get(t, t)
    return t if t in TIERS else "gold"


def earnings(tier: str, teams: int, size: int) -> Dict[str, Any]:
    t = normalize_tier(tier)
    rate = TIERS[t]
    tuition = size * PER_STUDENT_TUITION
    share = js_round(tuition * rate)
    per_session = max(share, FLOOR)
    monthly = js_round(per_session * teams * WEEKS_PER_MONTH / 10) * 10
    hours = teams * SESSION_MINUTES / 60
    return {
        "tier": t,
        "rate": rate,
        "teams": teams,
        "size": size,
        "per_student_tuition": PER_STUDENT_TUITION,
        "tuition": js_round(tuition),
        "share": share,
        "per_session": per_session,
        "floored": share < FLOOR,
        "floor": FLOOR,
        "weekly_hours": round(hours, 1),
        "monthly": monthly,
    }


# ——— 關燈：22:30（含）到隔天 06:00（不含）小陪不出聲 ———
def parse_hhmm(s: str) -> time:
    hh, mm = s.split(":")
    return time(int(hh), int(mm))


def is_lights_out(now: time, start: str = "22:30", end: str = "06:00") -> bool:
    s, e = parse_hhmm(start), parse_hhmm(end)
    if s > e:  # 跨午夜
        return now >= s or now < e
    return s <= now < e


def local_now(tz: str = "Asia/Taipei") -> datetime:
    return datetime.now(ZoneInfo(tz))


# ——— 開課前 48 小時截止：找出第一堂的日期 ———
def first_lesson_date(now: datetime, slot_day: int, slot_hh: int, slot_mm: int, lead_hours: int = 48) -> date:
    """slot_day：0=週一。從今天往後找第一個符合星期且距現在 ≥ 48 小時的日子。"""
    for i in range(15):
        d = (now + timedelta(days=i)).date()
        if d.weekday() != slot_day:
            continue
        start = datetime.combine(d, time(slot_hh, slot_mm), tzinfo=now.tzinfo)
        if (start - now) >= timedelta(hours=lead_hours):
            return d
    return (now + timedelta(days=14)).date()


def lesson_dates(first: date, n: int = 8) -> List[date]:
    return [first + timedelta(days=7 * i) for i in range(n)]


# ——— 週：週一到週日 ———
def week_range(today: date):
    start = today - timedelta(days=today.weekday())
    return start, start + timedelta(days=6)
