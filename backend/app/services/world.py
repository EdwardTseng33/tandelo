"""冒險世界（0.2）的純規則：影子狀態機、戰績、副本解題率、路線、缺席、鏡像賽、出題戰六分制、
配對與幽靈隊、對戰開關、公會解鎖、徽章公開賽、燈塔與守塔、鄰近榜、關燈。

全部是純函式，不碰資料庫，可以不開伺服器直接測；關鍵數字由 tests/test_world.py 鎖住。
原則（和概念稿一致）：戰績只從驗證過的學會來、不比速度、不排名次、不扣分、22:30 關燈。
"""

from datetime import time
from typing import Any, Dict, Iterable, List, Optional, Sequence

from . import rules

# ——— 影子狀態機：迷霧 → 還在附近 → 打中了 → 收服 → 睡著了 → 收服（叫醒）———
SHADOW_STATES = ("fog", "near", "hit", "captured", "asleep")
SHADOW_EVENTS = ("diagnosed_stuck", "explained_ok", "retest_passed", "wrong_again", "woken")
TRANSITIONS: Dict[tuple, str] = {
    ("fog", "diagnosed_stuck"): "near",  # 偵察報告：被這隻怪打倒過
    ("near", "explained_ok"): "hit",  # 說得出來（綠）
    ("hit", "retest_passed"): "captured",  # 隔 7–12 天不給提示再測通過（金）
    ("captured", "wrong_again"): "asleep",  # 之後又錯：睡著，不扣分
    ("asleep", "woken"): "captured",  # 叫醒
}
# 哪些事件會產生戰績（其餘事件只換狀態）
SHADOW_RECORD_KIND = {"explained_ok": "explain", "retest_passed": "capture", "woken": "wake"}


def transition(state: str, event: str) -> str:
    """回傳新狀態；非法轉移丟 ValueError（例如迷霧直接收服、收服後再收服）。"""
    if state not in SHADOW_STATES:
        raise ValueError(f"沒有這個狀態：{state}")
    if event not in SHADOW_EVENTS:
        raise ValueError(f"沒有這個事件：{event}")
    try:
        return TRANSITIONS[(state, event)]
    except KeyError:
        raise ValueError(f"影子在「{state}」時不能發生「{event}」。") from None


def shadow_record_kind(event: str) -> Optional[str]:
    return SHADOW_RECORD_KIND.get(event)


# ——— 戰績：只從驗證過的學會來；每天最多三張任務卡 ———
RECORD_POINTS = {"capture": 10, "wake": 5, "explain": 3, "dungeon_1": 5, "dungeon_2": 8, "dungeon_3": 12}
# 明確列出「不算戰績」的來源，方便測試鎖住：登入、練習量、連續天數、付費、儲值、對戰勝負
NON_RECORD_SOURCES = ("login", "practice", "streak", "payment", "topup", "duel_win", "duel_loss", "mirror_win")
DAILY_CARD_CAP = 3


def record_points(events: Iterable[str]) -> int:
    """把事件種類加總成戰績；不在 RECORD_POINTS 裡的一律 0 分。"""
    return sum(RECORD_POINTS.get(e, 0) for e in events)


def daily_cap_ok(count_today: int, cap: int = DAILY_CARD_CAP) -> bool:
    """今天已經用了 count_today 張任務卡，還能不能再用一張。"""
    return int(count_today) < cap


# ——— 副本：巡邏 3 題＋接力 1 棒；伏擊層不計；解題率決定星數與路線 ———
PATROL_QUOTA, RELAY_QUOTA = 3, 1
QUOTA_PER_MEMBER = PATROL_QUOTA + RELAY_QUOTA
COUNTED_LAYERS = ("patrol", "relay")
STAR_THRESHOLDS = {1: 0.60, 2: 0.75, 3: 0.90}
RETREAT_RETRY_HOURS = 24


def dungeon_result(members: Sequence[Any], answers: Sequence[Dict[str, Any]], absences: Iterable[Any] = (), skipped_relays: int = 0) -> Dict[str, Any]:
    """小隊解題率 ＝ 巡邏與接力答對的題數 ÷ 題數。

    members：隊員 id；answers：{member, layer: patrol/relay/ambush, correct, helped}；absences：有申報缺席的隊員；
    skipped_relays：24 小時沒接被跳過的棒數（移出分母）。
    分母＝(未申報缺席人數 × 4) − 被跳過的接力棒數；分子＝巡邏與接力答對題數（求助過照算 1 分；每人最多算到配額）；伏擊層不計。
    """
    members = list(members)
    absent = {m for m in absences if m in members}
    present = [m for m in members if m not in absent]
    denominator = len(present) * QUOTA_PER_MEMBER - max(0, int(skipped_relays or 0))

    correct = {m: {"patrol": 0, "relay": 0} for m in present}
    touched = set()
    ambush = 0
    for a in answers:
        layer = a.get("layer", "patrol")
        if layer == "ambush":
            ambush += 1  # 只進個人收服紀錄，不進全隊分數
            continue
        m = a.get("member")
        if layer not in COUNTED_LAYERS or m not in correct:
            continue
        touched.add(m)
        if a.get("correct"):
            correct[m][layer] += 1  # 求助過（helped）照樣算 1 分
    numerator = sum(min(c["patrol"], PATROL_QUOTA) + min(c["relay"], RELAY_QUOTA) for c in correct.values())
    all_present_participated = bool(present) and all(m in touched for m in present)

    rate = numerator / denominator if denominator > 0 else 0.0
    if rate < STAR_THRESHOLDS[1]:
        stars, outcome, promote = 0, "retreat", False
    elif rate < STAR_THRESHOLDS[2]:
        stars, outcome, promote = 1, "clear", False
    elif rate < STAR_THRESHOLDS[3]:
        stars, outcome, promote = 2, "clear", True
    else:
        stars, outcome, promote = (3 if all_present_participated else 2), "clear", True
    return {
        "rate": round(rate, 4),
        "percent": round(rate * 100),
        "stars": stars,
        "outcome": outcome,
        "promote": promote,
        "denominator": denominator,
        "numerator": numerator,
        "present": len(present),
        "absent": len(absent),
        "skipped_relays": max(0, int(skipped_relays or 0)),
        "ambush_answers": ambush,
        "all_present_participated": all_present_participated,
        "retry_after_hours": RETREAT_RETRY_HOURS if outcome == "retreat" else None,
        "retry_layers": list(COUNTED_LAYERS) if outcome == "retreat" else [],  # 伏擊層不重打
        "record_kind": f"dungeon_{stars}" if stars else None,
        "points": RECORD_POINTS.get(f"dungeon_{stars}", 0),
    }


# ——— 路線：平原 → 丘陵 → 山徑 → 雲頂；只升不降、雲頂封頂 ———
ROUTES = ("plain", "hills", "ridge", "cloud")
FIRST_ROUTE = ROUTES[0]


def next_route(route: str, promote: bool) -> str:
    if route not in ROUTES:
        raise ValueError(f"沒有這條路線：{route}")
    i = ROUTES.index(route)
    if promote and i < len(ROUTES) - 1:
        return ROUTES[i + 1]
    return route


# ——— 缺席：每人每季最多 2 次，副本開門 48 小時內申報 ———
ABSENCE_MAX_PER_SEASON = 2
ABSENCE_WINDOW_HOURS = 48


def declare_absence(count_this_season: int, hours_since_open: float = 0.0) -> Dict[str, Any]:
    if int(count_this_season) >= ABSENCE_MAX_PER_SEASON:
        return {"ok": False, "reason": f"這一季的缺席申報已用完（每人最多 {ABSENCE_MAX_PER_SEASON} 次）。"}
    if hours_since_open > ABSENCE_WINDOW_HOURS:
        return {"ok": False, "reason": f"要在副本開門 {ABSENCE_WINDOW_HOURS} 小時內申報。"}
    return {"ok": True, "reason": None}


# ——— 鏡像賽：只比解題率，平手記平手，永不看速度 ———
def mirror_match(rate_a: float, rate_b: float) -> Dict[str, Any]:
    if rate_a > rate_b:
        winner = "a"
    elif rate_b > rate_a:
        winner = "b"
    else:
        winner = None
    return {"winner": winner, "tie": winner is None, "rate_a": rate_a, "rate_b": rate_b, "compares": "rate"}


# ——— 出題戰六分制：答題三分＋出題三分；好題印記不計分 ———
DUEL_QUESTIONS = 3


def _three(name: str, v: Sequence[bool]) -> List[bool]:
    v = [bool(x) for x in v]
    if len(v) != DUEL_QUESTIONS:
        raise ValueError(f"{name} 要剛好 {DUEL_QUESTIONS} 題。")
    return v


def duel_score(
    answers_a_correct: Sequence[bool],
    answers_b_correct: Sequence[bool],
    setting_valid_a: Sequence[bool],
    setting_valid_b: Sequence[bool],
    forfeit_a: bool = False,
    forfeit_b: bool = False,
) -> Dict[str, Any]:
    """answers_x_correct：x 隊答對方三題的對錯；setting_valid_x：x 隊出的三題是否「確實在考那隻怪」。
    出題分＝對方答錯且判定確實在考那隻怪才得 1。逾期未答算棄權：棄權隊 0 分，對方也不拿出題分。
    """
    aa = _three("answers_a_correct", answers_a_correct)
    ab = _three("answers_b_correct", answers_b_correct)
    sa = _three("setting_valid_a", setting_valid_a)
    sb = _three("setting_valid_b", setting_valid_b)
    answer_a = 0 if forfeit_a else sum(aa)
    answer_b = 0 if forfeit_b else sum(ab)
    setting_a = 0 if forfeit_b else sum(1 for i in range(DUEL_QUESTIONS) if not ab[i] and sa[i])
    setting_b = 0 if forfeit_a else sum(1 for i in range(DUEL_QUESTIONS) if not aa[i] and sb[i])
    total_a, total_b = answer_a + setting_a, answer_b + setting_b
    winner = "a" if total_a > total_b else "b" if total_b > total_a else None
    return {
        "a": {"answer": answer_a, "setting": setting_a, "total": total_a},
        "b": {"answer": answer_b, "setting": setting_b, "total": total_b},
        "max": DUEL_QUESTIONS * 2,
        "winner": winner,
        "tie": winner is None,
        "good_question_marks_count": False,  # 好題印記只掛隊伍牆，不計分
    }


# ——— 配對：同科、同路線、同年級、同教科書版本、不同嚮導、本季沒打過 ———
def can_match(squad_a: Dict[str, Any], squad_b: Dict[str, Any]) -> Dict[str, Any]:
    """squad：{id, subject, route, grade, textbook, guide_id, played: [對手 id…]}。"""
    if squad_a.get("id") is not None and squad_a.get("id") == squad_b.get("id"):
        return {"ok": False, "reason": "不能和自己對戰。"}
    for key, label in (("subject", "科目"), ("route", "路線"), ("grade", "年級"), ("textbook", "教科書版本")):
        if squad_a.get(key) != squad_b.get(key):
            return {"ok": False, "reason": f"{label}不同。"}
    if squad_a.get("guide_id") is not None and squad_a.get("guide_id") == squad_b.get("guide_id"):
        return {"ok": False, "reason": "同一位嚮導帶的隊伍不互打。"}
    if squad_b.get("id") in set(squad_a.get("played") or ()) or squad_a.get("id") in set(squad_b.get("played") or ()):
        return {"ok": False, "reason": "這一季已經打過了。"}
    return {"ok": True, "reason": None}


def pick_duel_monsters(a_history: Iterable[str], b_history: Iterable[str]) -> Dict[str, Any]:
    """只出雙方都遠征過的怪：取交集（照 a 的順序），不足 3 隻就改打幽靈隊。"""
    seen = set()
    a_list = [m for m in a_history if not (m in seen or seen.add(m))]
    common = [m for m in a_list if m in set(b_history)]
    if len(common) < DUEL_QUESTIONS:
        return {"ghost": True, "monsters": [], "common": common}
    return {"ghost": False, "monsters": common[:DUEL_QUESTIONS], "common": common}


# ——— 對戰開關：匿名投票，全員同意才打真人，否則幽靈隊 ———
def pvp_enabled(votes: Iterable[bool]) -> bool:
    votes = [bool(v) for v in votes]
    return bool(votes) and all(votes)


# ——— 公會解鎖：累積到門檻就解鎖，不花掉；實體徽章永遠不可用戰績換 ———
SQUAD_UNLOCKS = {"flag_pattern": 100, "map_palette": 150, "shadow_frame": 200, "season_photo_frame": 300}
GUILD_UNLOCKS = {"boss_strategy_meeting": 60}  # 公會人均
PHYSICAL_BADGE_BY_RECORD = False


def guild_unlocks(squad_total: int, guild_per_capita: float) -> Dict[str, Any]:
    return {
        "squad": {k: squad_total >= v for k, v in SQUAD_UNLOCKS.items()},
        "guild": {k: guild_per_capita >= v for k, v in GUILD_UNLOCKS.items()},
        "physical_badge": PHYSICAL_BADGE_BY_RECORD,  # 只能在公開賽拿到
        "thresholds": {"squad": dict(SQUAD_UNLOCKS), "guild": dict(GUILD_UNLOCKS)},
    }


# ——— 徽章公開賽：達標制（≥80% 且全員出手），不排名；全服達標升金邊 ———
BADGE_RATE = 0.80


def badge_race(rate: float, all_present_participated: bool) -> Dict[str, Any]:
    earned = rate >= BADGE_RATE and bool(all_present_participated)
    return {"earned": earned, "per_member": 1 if earned else 0, "ranked": False}


def gold_edge(server_total: int, server_goal: int) -> bool:
    return server_goal > 0 and server_total >= server_goal


# ——— 燈塔：點燈是全區合作；守塔是同路線爭奪、月結算、並列共同守、不衰減 ———
def lighthouse(region_records_sum: int, threshold: int) -> Dict[str, Any]:
    return {"lit": threshold > 0 and region_records_sum >= threshold, "progress": region_records_sum, "threshold": threshold}


def tower_settle(squads_by_route_records: Dict[str, Dict[Any, int]]) -> Dict[str, Any]:
    """{route: {team_id: 當月戰績}} → 四層各取最高（並列共同守塔）。戰績 0 不守塔。
    回 keepers（route → [team_id…]）與要追加進歷代名冊的列。"""
    keepers: Dict[str, List[Any]] = {r: [] for r in ROUTES}
    hall: List[Dict[str, Any]] = []
    for route in ROUTES:
        rows = squads_by_route_records.get(route) or {}
        if not rows:
            continue
        top = max(rows.values())
        if top <= 0:
            continue
        ids = sorted((t for t, v in rows.items() if v == top), key=str)
        keepers[route] = ids
        hall.extend({"route": route, "team_id": t, "records": top} for t in ids)
    return {"keepers": keepers, "hall_of_fame": hall, "decays": False}


# ——— 榜：只回我前後各三隊，不含名次與總數 ———
BOARD_SPAN = 3


def neighbor_board(sorted_squads: Sequence[Dict[str, Any]], my_id: Any, span: int = BOARD_SPAN) -> List[Dict[str, Any]]:
    """sorted_squads 已依戰績由高到低排好；找不到我就丟 ValueError。"""
    idx = next((i for i, s in enumerate(sorted_squads) if s.get("team_id") == my_id), None)
    if idx is None:
        raise ValueError("這一隊不在這個榜上。")
    out = []
    for s in sorted_squads[max(0, idx - span) : idx + span + 1]:
        row = {k: v for k, v in s.items() if k not in ("rank", "total")}
        row["me"] = s.get("team_id") == my_id
        out.append(row)
    return out


# ——— 關燈：沿用 rules.is_lights_out；22:30–06:00 不開門、不推播 ———
def lights_out_blocks(now: time, start: str = "22:30", end: str = "06:00") -> bool:
    return rules.is_lights_out(now, start, end)
