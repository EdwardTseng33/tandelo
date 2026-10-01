"""純規則：判卡點、再測日期、成班、分潤與保底、關燈、48 小時截止。"""

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from app.services import diagnosis, rules

from tests.conftest import ANSWERS_ALL_OK, ANSWERS_TWO_STUCK


def test_diagnose_two_stuck():
    r = diagnosis.diagnose(ANSWERS_TWO_STUCK)
    assert r["stuck"] == ["sq-cross", "sign-dist"]
    assert r["correct"] == 6 and r["total"] == 8
    assert r["all_clear"] is False
    assert r["status"]["sq-cross"] == "stuck"


def test_diagnose_all_clear_starts_from_factor_cross():
    r = diagnosis.diagnose(ANSWERS_ALL_OK)
    assert r["all_clear"] is True
    assert r["stuck"] == ["factor-cross"]
    assert r["correct"] == 8


def test_diagnose_unsure_counts_one_point_and_ranks_by_order():
    # 只有「不確定」各 1 分：沒有到 2 分，取分數最高裡順序最前的一個
    r = diagnosis.diagnose({"q3": -1, "q8": -1})
    assert r["stuck"] == ["sqrt-split"]
    # 同一卡點被兩題標到 → 2 分排前面
    r2 = diagnosis.diagnose({"q4": 1, "q3": -1})
    assert r2["stuck"][0] == "sqrt-abs"


def test_retest_days_between_7_and_12():
    assert rules.retest_days(0) == 12
    assert rules.retest_days(1) == 10
    assert rules.retest_days(2) == 8
    assert rules.retest_days(3) == 7
    assert rules.retest_days(99) == 7
    for h in range(0, 10):
        assert 7 <= rules.retest_days(h) <= 12
    assert rules.retest_due(date(2026, 10, 1), 1) == date(2026, 10, 11)


def test_squad_rule():
    assert rules.squad_rule(2) == {"ok": False, "mode": None, "label": "不開班，全額退"}
    assert rules.squad_rule(3)["mode"] == "one_to_three"
    assert rules.squad_rule(4) == {"ok": True, "mode": "squad", "label": "4 人成班"}
    assert rules.squad_rule(6)["ok"] is True
    assert rules.squad_rule(7)["ok"] is False


def test_earnings_matches_frontend_calculator():
    # 與 frontend/assets/teachers.js 同一套：每人每堂 2990/8、分潤、保底 600、一個月 4.3 週、取整到 10
    e = rules.earnings("gold", teams=2, size=4)
    assert e["tuition"] == 1495 and e["share"] == 777 and e["per_session"] == 777 and e["floored"] is False
    assert e["monthly"] == 6680
    e2 = rules.earnings("novice", teams=1, size=2)  # 747.5 × 0.45 = 336 → 保底 600
    assert e2["share"] == 336 and e2["per_session"] == 600 and e2["floored"] is True
    assert e2["monthly"] == 2580
    e3 = rules.earnings("diamond", teams=3, size=6)
    assert e3["rate"] == 0.60 and e3["per_session"] == 1346
    assert rules.normalize_tier("new") == "novice" and rules.normalize_tier("不存在") == "gold"


def test_lights_out():
    assert rules.is_lights_out(time(22, 30)) is True
    assert rules.is_lights_out(time(23, 59)) is True
    assert rules.is_lights_out(time(3, 0)) is True
    assert rules.is_lights_out(time(5, 59)) is True
    assert rules.is_lights_out(time(6, 0)) is False
    assert rules.is_lights_out(time(22, 29)) is False
    assert rules.is_lights_out(time(14, 0)) is False


def test_first_lesson_date_48h_cutoff():
    tz = ZoneInfo("Asia/Taipei")
    # 2026-10-04 是週日 20:40；週二（day=1）19:00 距離只有 46 小時 → 跳到下下週二
    now = datetime(2026, 10, 4, 20, 40, tzinfo=tz)
    assert rules.first_lesson_date(now, 1, 19, 0) == date(2026, 10, 13)
    # 週三（day=2）19:00 ≥ 48 小時 → 本週三
    assert rules.first_lesson_date(now, 2, 19, 0) == date(2026, 10, 7)
    dates = rules.lesson_dates(date(2026, 10, 7))
    assert len(dates) == 8 and dates[-1] == date(2026, 11, 25)
