"""冒險世界（0.2）：夥伴狀態機、戰績、副本解題率、路線、缺席、對戰、配對、公會解鎖、徽章、燈塔、守塔、榜、關燈。
前半是純規則（不開伺服器），後半是 API 流程。數字全部鎖住，改規則要同步改這裡與概念稿。"""

from datetime import date, time

import pytest
from app.services import world as W

from tests.conftest import TEST_ADMIN_TOKEN, create_student, diagnose, set_slots

FIVE = [1, 2, 3, 4, 5]


def patrol(member, correct=True, n=1, helped=False):
    return [{"member": member, "layer": "patrol", "correct": correct, "helped": helped} for _ in range(n)]


def relay(member, correct=True):
    return [{"member": member, "layer": "relay", "correct": correct}]


def example_answers():
    """概念稿的例子：五人隊，巡邏 15 題對 12（其中 3 題求助過）、接力 5 棒對 4。"""
    ans = []
    for m in FIVE:
        ans += patrol(m, True, 2)
    ans += patrol(1, True, 1, helped=True) + patrol(2, True, 1, helped=True) + patrol(3, False) + patrol(4, False) + patrol(5, False)
    ans[0]["helped"] = True  # 第三題求助過的也算分
    for m in [1, 2, 3, 4]:
        ans += relay(m, True)
    ans += relay(5, False)
    return ans


# ——— 夥伴狀態機 ———
def test_shadow_happy_path():
    s = "fog"
    for ev, expect in [("diagnosed_stuck", "near"), ("explained_ok", "hit"), ("retest_passed", "captured"), ("wrong_again", "asleep"), ("woken", "captured")]:
        s = W.transition(s, ev)
        assert s == expect
    # 叫醒之後又錯、再叫醒：一樣走得通，不扣分
    assert W.transition(W.transition(s, "wrong_again"), "woken") == "captured"


def test_shadow_illegal_transitions_raise():
    for state, ev in [
        ("fog", "retest_passed"),
        ("fog", "explained_ok"),
        ("near", "retest_passed"),
        ("near", "woken"),
        ("hit", "woken"),
        ("captured", "retest_passed"),
        ("asleep", "retest_passed"),
    ]:
        with pytest.raises(ValueError):
            W.transition(state, ev)
    with pytest.raises(ValueError):
        W.transition("gold", "woken")
    with pytest.raises(ValueError):
        W.transition("fog", "login")
    assert W.shadow_record_kind("retest_passed") == "capture" and W.shadow_record_kind("woken") == "wake"
    assert W.shadow_record_kind("explained_ok") == "explain" and W.shadow_record_kind("diagnosed_stuck") is None


# ——— 戰績 ———
def test_record_points_table():
    assert W.RECORD_POINTS == {"capture": 10, "wake": 5, "explain": 3, "dungeon_1": 5, "dungeon_2": 8, "dungeon_3": 12}
    assert W.record_points(["capture", "wake", "explain", "dungeon_2"]) == 26
    assert W.record_points([]) == 0


def test_record_points_never_from_login_practice_streak_payment_or_pvp():
    assert W.record_points(["login", "practice", "streak", "payment", "topup", "duel_win", "duel_loss", "mirror_win"]) == 0
    assert W.record_points(["login", "capture", "streak"]) == 10


def test_daily_cap_three_cards():
    assert W.DAILY_CARD_CAP == 3
    assert W.daily_cap_ok(0) and W.daily_cap_ok(2)
    assert not W.daily_cap_ok(3) and not W.daily_cap_ok(7)


# ——— 副本解題率 ———
def test_dungeon_example_sixteen_of_twenty_is_two_stars_and_promotes():
    r = W.dungeon_result(FIVE, example_answers(), [], 0)
    assert (r["numerator"], r["denominator"]) == (16, 20)
    assert r["rate"] == 0.8 and r["percent"] == 80
    assert r["stars"] == 2 and r["outcome"] == "clear" and r["promote"] is True
    assert r["record_kind"] == "dungeon_2" and r["points"] == 8


def test_dungeon_helped_answers_still_count_one_point():
    helped = [{"member": m, "layer": "patrol", "correct": True, "helped": True} for m in FIVE for _ in range(3)]
    helped += [{"member": m, "layer": "relay", "correct": True, "helped": True} for m in FIVE]
    r = W.dungeon_result(FIVE, helped, [], 0)
    assert r["numerator"] == 20 and r["rate"] == 1.0 and r["stars"] == 3


def test_dungeon_ambush_layer_not_counted():
    ans = example_answers() + [{"member": m, "layer": "ambush", "correct": True} for m in FIVE]
    r = W.dungeon_result(FIVE, ans, [], 0)
    assert (r["numerator"], r["denominator"]) == (16, 20) and r["ambush_answers"] == 5
    # 伏擊答錯也不會拉低
    r2 = W.dungeon_result(FIVE, example_answers() + [{"member": 1, "layer": "ambush", "correct": False}], [], 0)
    assert r2["rate"] == 0.8


def test_dungeon_declared_absence_removes_quota_but_silent_member_counts_zero():
    # 五人隊，一人申報缺席：分母 16；缺席者的答案不算
    ans = [a for a in example_answers() if a["member"] != 5]
    r = W.dungeon_result(FIVE, ans, [5], 0)
    assert r["denominator"] == 16 and r["numerator"] == 14 and r["present"] == 4 and r["absent"] == 1
    # 沒申報又沒作答：分母照算 20，解題率被拉低
    r2 = W.dungeon_result(FIVE, ans, [], 0)
    assert r2["denominator"] == 20 and r2["numerator"] == 14 and r2["rate"] == 0.7


def test_dungeon_skipped_relay_reduces_denominator():
    ans = [a for a in example_answers() if not (a["layer"] == "relay" and a["member"] == 5)]
    r = W.dungeon_result(FIVE, ans, [], skipped_relays=1)
    assert r["denominator"] == 19 and r["numerator"] == 16 and r["skipped_relays"] == 1
    assert r["rate"] == round(16 / 19, 4)


def test_dungeon_retreat_under_sixty_retries_patrol_and_relay_only():
    ans = []
    for m in FIVE:
        ans += patrol(m, True, 2) + patrol(m, False)
    ans += [x for m in FIVE for x in relay(m, False)]  # 10/20 = 50%
    r = W.dungeon_result(FIVE, ans, [], 0)
    assert r["rate"] == 0.5 and r["stars"] == 0 and r["outcome"] == "retreat" and r["promote"] is False
    assert r["retry_after_hours"] == 24 and r["retry_layers"] == ["patrol", "relay"] and r["points"] == 0
    assert W.RETREAT_RETRY_HOURS == 24


def test_dungeon_one_star_between_sixty_and_seventy_five():
    ans = []
    for m in FIVE:
        ans += patrol(m, True, 2) + patrol(m, False)
    ans += [x for m in [1, 2] for x in relay(m, True)] + [x for m in [3, 4, 5] for x in relay(m, False)]  # 12/20 = 60%
    r = W.dungeon_result(FIVE, ans, [], 0)
    assert r["rate"] == 0.6 and r["stars"] == 1 and r["promote"] is False and r["record_kind"] == "dungeon_1"
    assert W.STAR_THRESHOLDS == {1: 0.60, 2: 0.75, 3: 0.90}


def test_dungeon_three_stars_need_everyone_present_to_show_up():
    full4 = [x for m in [1, 2, 3, 4] for x in patrol(m, True, 3) + relay(m, True)]
    # 四人全對、第五人沒出手也沒申報：16/20 = 80%，兩星
    r = W.dungeon_result(FIVE, full4, [], 0)
    assert r["rate"] == 0.8 and r["stars"] == 2 and r["all_present_participated"] is False
    # 第五人也出手（巡邏對 2、接力錯）：18/20 = 90%，全員出手 → 三星
    r2 = W.dungeon_result(FIVE, full4 + patrol(5, True, 2) + patrol(5, False) + relay(5, False), [], 0)
    assert r2["rate"] == 0.9 and r2["all_present_participated"] is True and r2["stars"] == 3 and r2["record_kind"] == "dungeon_3"
    # 第五人申報缺席：16/16 = 100%，未缺席者全員出手 → 三星
    r3 = W.dungeon_result(FIVE, full4, [5], 0)
    assert r3["rate"] == 1.0 and r3["stars"] == 3 and r3["promote"] is True
    # 十人隊九人全對、一人完全沒出手：36/40 = 90%，但有未缺席者沒出手 → 降為兩星（仍然升路線）
    ten = list(range(1, 11))
    r4 = W.dungeon_result(ten, [x for m in ten[:9] for x in patrol(m, True, 3) + relay(m, True)], [], 0)
    assert r4["rate"] == 0.9 and r4["all_present_participated"] is False and r4["stars"] == 2 and r4["promote"] is True


def test_dungeon_quota_caps_each_member():
    # 一個人答 6 題巡邏全對，只算 3；接力答 2 次只算 1
    ans = patrol(1, True, 6) + relay(1, True) + relay(1, True)
    r = W.dungeon_result([1], ans, [], 0)
    assert r["numerator"] == 4 and r["denominator"] == 4 and r["rate"] == 1.0
    assert W.PATROL_QUOTA == 3 and W.RELAY_QUOTA == 1


def test_dungeon_empty_team_rate_zero():
    r = W.dungeon_result([], [], [], 0)
    assert r["denominator"] == 0 and r["rate"] == 0.0 and r["outcome"] == "retreat"


# ——— 路線 ———
def test_next_route_only_goes_up_and_caps_at_cloud():
    assert W.ROUTES == ("plain", "hills", "ridge", "cloud")
    assert W.next_route("plain", True) == "hills"
    assert W.next_route("hills", True) == "ridge"
    assert W.next_route("ridge", True) == "cloud"
    assert W.next_route("cloud", True) == "cloud"
    assert W.next_route("hills", False) == "hills"
    assert W.next_route("plain", False) == "plain"
    with pytest.raises(ValueError):
        W.next_route("silver", True)


# ——— 缺席 ———
def test_declare_absence_two_per_season_within_48_hours():
    assert W.declare_absence(0)["ok"] is True
    assert W.declare_absence(1, 47.9)["ok"] is True
    assert W.declare_absence(2)["ok"] is False
    assert W.declare_absence(0, 48.5)["ok"] is False
    assert W.ABSENCE_MAX_PER_SEASON == 2 and W.ABSENCE_WINDOW_HOURS == 48


# ——— 鏡像賽與出題戰 ———
def test_mirror_match_compares_rate_only_and_ties():
    assert W.mirror_match(0.8, 0.7)["winner"] == "a"
    assert W.mirror_match(0.6, 0.9)["winner"] == "b"
    tie = W.mirror_match(0.75, 0.75)
    assert tie["winner"] is None and tie["tie"] is True and tie["compares"] == "rate"
    assert "speed" not in tie and "time" not in tie


def test_duel_six_point_system():
    # a 答對 2 題；b 答對 1 題。b 答錯 q1、q2，a 出的 q1 確實在考那隻怪、q2 不是 → a 出題分 1。a 答錯 q3，b 的 q3 判定有效 → b 出題分 1。
    r = W.duel_score([True, True, False], [False, False, True], [True, False, True], [True, True, True])
    assert r["a"] == {"answer": 2, "setting": 1, "total": 3}
    assert r["b"] == {"answer": 1, "setting": 1, "total": 2}
    assert r["winner"] == "a" and r["tie"] is False and r["max"] == 6
    assert r["good_question_marks_count"] is False
    full = W.duel_score([True] * 3, [False] * 3, [True] * 3, [True] * 3)
    assert full["a"]["total"] == 6 and full["b"]["total"] == 0


def test_duel_setting_point_needs_wrong_answer_and_valid_judgement():
    # 對方全答錯，但題目都被判「只是難、不是在考那隻怪」→ 出題分 0
    r = W.duel_score([True] * 3, [False] * 3, [False] * 3, [False] * 3)
    assert r["a"]["setting"] == 0 and r["a"]["total"] == 3
    # 對方答對 → 就算判定有效也沒出題分
    r2 = W.duel_score([True] * 3, [True] * 3, [True] * 3, [True] * 3)
    assert r2["a"]["setting"] == 0 and r2["b"]["setting"] == 0 and r2["tie"] is True


def test_duel_forfeit_gives_opponent_no_setting_points():
    r = W.duel_score([True, True, True], [False, False, False], [True, True, True], [True, True, True], forfeit_b=True)
    assert r["b"]["total"] == 0 and r["a"]["setting"] == 0 and r["a"]["total"] == 3


def test_duel_requires_exactly_three_questions():
    with pytest.raises(ValueError):
        W.duel_score([True, True], [False, False, False], [True, True, True], [True, True, True])


# ——— 配對、幽靈隊、投票 ———
def test_can_match_rules():
    a = {"id": 1, "subject": "數學", "route": "plain", "grade": "國二", "textbook": "A", "guide_id": 1, "played": []}
    b = {"id": 2, "subject": "數學", "route": "plain", "grade": "國二", "textbook": "A", "guide_id": 2, "played": []}
    assert W.can_match(a, b)["ok"] is True
    assert W.can_match(a, {**b, "subject": "英文"})["reason"] == "科目不同。"
    assert W.can_match(a, {**b, "route": "hills"})["reason"] == "路線不同。"
    assert W.can_match(a, {**b, "grade": "國三"})["reason"] == "年級不同。"
    assert W.can_match(a, {**b, "textbook": "B"})["reason"] == "教科書版本不同。"
    assert W.can_match(a, {**b, "guide_id": 1})["reason"] == "同一位嚮導帶的隊伍不互打。"
    assert W.can_match({**a, "played": [2]}, b)["reason"] == "這一季已經打過了。"
    assert W.can_match(a, {**b, "played": [1]})["ok"] is False
    assert W.can_match(a, a)["ok"] is False


def test_pick_duel_monsters_intersection_or_ghost():
    r = W.pick_duel_monsters(["sq-cross", "sign-dist", "sqrt-split", "pyth-hyp"], ["pyth-hyp", "sq-cross", "sign-dist", "quad-zero"])
    assert r["ghost"] is False and r["monsters"] == ["sq-cross", "sign-dist", "pyth-hyp"]
    g = W.pick_duel_monsters(["sq-cross", "sign-dist"], ["sq-cross", "sign-dist"])
    assert g["ghost"] is True and g["monsters"] == [] and g["common"] == ["sq-cross", "sign-dist"]
    assert W.pick_duel_monsters([], ["sq-cross"])["ghost"] is True


def test_pvp_needs_unanimous_anonymous_vote():
    assert W.pvp_enabled([True, True, True, True]) is True
    assert W.pvp_enabled([True, True, False, True]) is False
    assert W.pvp_enabled([]) is False


# ——— 公會解鎖、徽章、燈塔、守塔、榜 ———
def test_guild_unlock_thresholds_and_no_physical_badge():
    assert W.SQUAD_UNLOCKS == {"flag_pattern": 100, "map_palette": 150, "shadow_frame": 200, "season_photo_frame": 300}
    assert W.GUILD_UNLOCKS == {"boss_strategy_meeting": 60}
    u = W.guild_unlocks(99, 59)
    assert not any(u["squad"].values()) and u["guild"]["boss_strategy_meeting"] is False
    u = W.guild_unlocks(150, 60)
    assert u["squad"] == {"flag_pattern": True, "map_palette": True, "shadow_frame": False, "season_photo_frame": False}
    assert u["guild"]["boss_strategy_meeting"] is True
    u = W.guild_unlocks(300, 0)
    assert all(u["squad"].values())
    for total in (0, 300, 100000):
        assert W.guild_unlocks(total, 100000)["physical_badge"] is False  # 實體徽章永遠不能用戰績換


def test_badge_race_is_threshold_not_ranking():
    assert W.BADGE_RATE == 0.8
    ok = W.badge_race(0.8, True)
    assert ok == {"earned": True, "per_member": 1, "ranked": False}
    assert W.badge_race(0.95, False)["earned"] is False  # 有人沒出手就不算
    assert W.badge_race(0.79, True)["earned"] is False


def test_gold_edge_when_server_goal_met():
    assert W.gold_edge(3000, 3000) is True
    assert W.gold_edge(2999, 3000) is False
    assert W.gold_edge(10, 0) is False


def test_lighthouse_lights_when_region_sum_meets_threshold():
    assert W.lighthouse(3240, 3000) == {"lit": True, "progress": 3240, "threshold": 3000}
    assert W.lighthouse(2999, 3000)["lit"] is False
    assert W.lighthouse(5, 0)["lit"] is False


def test_tower_settle_per_route_with_ties_and_no_decay():
    r = W.tower_settle({"plain": {"four": 412, "wed": 412, "night": 371}, "hills": {"sky": 90}, "ridge": {}, "cloud": {"zero": 0}})
    assert r["keepers"]["plain"] == ["four", "wed"]  # 並列共同守塔
    assert r["keepers"]["hills"] == ["sky"] and r["keepers"]["ridge"] == [] and r["keepers"]["cloud"] == []  # 0 分不守塔
    assert {(h["route"], h["team_id"]) for h in r["hall_of_fame"]} == {("plain", "four"), ("plain", "wed"), ("hills", "sky")}
    assert r["decays"] is False


def test_neighbor_board_only_three_each_side_without_rank_or_total():
    squads = [{"team_id": i, "name": f"隊{i}", "records": 100 - i, "rank": i + 1, "total": 10} for i in range(10)]
    me = W.neighbor_board(squads, 5)
    assert [s["team_id"] for s in me] == [2, 3, 4, 5, 6, 7, 8]
    assert all("rank" not in s and "total" not in s for s in me)
    assert [s["me"] for s in me] == [False, False, False, True, False, False, False]
    top = W.neighbor_board(squads, 0)
    assert [s["team_id"] for s in top] == [0, 1, 2, 3]
    with pytest.raises(ValueError):
        W.neighbor_board(squads, 99)


def test_lights_out_blocks_dungeon_and_push():
    assert W.lights_out_blocks(time(22, 30)) is True
    assert W.lights_out_blocks(time(5, 59)) is True
    assert W.lights_out_blocks(time(6, 0)) is False
    assert W.lights_out_blocks(time(20, 0)) is False


# ——— API 流程 ———
def _make_third_team(client):
    """用一般流程湊一隊：小睿在沒有示範隊友的時段開隊、三位隊友加入、王老師接班。"""
    s = create_student(client, "小睿")
    diagnose(client, s["id"])
    set_slots(client, s["id"], ["d6-2000"])
    team = client.post("/api/v1/teams/match", json={"student_id": s["id"]}).json()
    for i in range(3):
        m = create_student(client, f"隊友{i}")
        assert client.post(f"/api/v1/teams/{team['id']}/join", json={"student_id": m["id"]}).status_code == 200
    r = client.post(f"/api/v1/teams/{team['id']}/accept", json={"teacher_id": 3})
    assert r.status_code == 200, r.text
    return r.json()


def _team_by_name(client, name):
    teams = client.get("/api/v1/teams", params={"status": "confirmed"}).json()
    return next(t for t in teams if t["name"] == name)


def test_api_world_map(client):
    r = client.get("/api/v1/world/map")
    assert r.status_code == 200
    w = r.json()
    assert [c["name"] for c in w["continents"]] == ["數理大陸", "西風港", "字林", "時光古道"]
    math_regions = [x for x in w["regions"] if x["continent"] == "math"]
    assert [x["name"] for x in math_regions] == ["乘法平原", "多項式林", "根號谷", "畢氏山", "分解洞窟", "二次高原"]
    assert len(w["lighthouses"]) == len(w["regions"])
    live = [m for m in w["monsters"] if m["status"] == "live"]
    assert [m["id"] for m in live] == ["sq-cross", "sign-dist", "sqrt-split", "sqrt-abs", "pyth-hyp", "factor-diff", "factor-cross", "quad-zero"]
    ghost = next(m for m in w["monsters"] if m["id"] == "sign-dist")
    assert ghost["name"] == "負號幽靈" and ghost["taunt"] == "第一個歸我，後面的我不管。" and ghost["shape"] == "m-drop"
    assert all(m[k] for m in w["monsters"] for k in ("origin", "trick", "taunt", "weakness", "caught_line"))
    assert len([m for m in w["monsters"] if m["status"] == "proposal"]) == 9
    assert [x["id"] for x in w["routes"]] == ["plain", "hills", "ridge", "cloud"]
    assert [x["id"] for x in w["leagues"]] == ["north", "central", "south", "east"]


def test_api_dungeon_open_answer_settle(client):
    team = _team_by_name(client, "四葉小隊")
    tid = team["id"]
    members = [m["student_id"] for m in team["members"]]
    # 開門（白天）：路線從上一個一星副本留在平原線；區域從第 2 週課表的卡點（負號幽靈 → 多項式林）
    r = client.post(f"/api/v1/teams/{tid}/dungeons", json={"week": 2, "time": "20:00"})
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["route"] == "plain" and d["status"] == "open" and d["region_id"] == "poly"
    did = d["id"]
    # 同隊不能同時開第二個
    assert client.post(f"/api/v1/teams/{tid}/dungeons", json={"week": 3, "time": "20:00"}).status_code == 409
    # 四人隊：巡邏 12 題對 10（兩題求助過）、接力 4 棒對 3 → 13/16 = 81.25% 兩星
    for i, m in enumerate(members):
        for j in range(3):
            correct = not (i < 2 and j == 2)
            r = client.post(f"/api/v1/dungeons/{did}/answers", json={"student_id": m, "layer": "patrol", "correct": correct, "helped": j == 1})
            assert r.status_code == 200, r.text
        r = client.post(f"/api/v1/dungeons/{did}/answers", json={"student_id": m, "layer": "relay", "correct": i != 3})
        assert r.status_code == 200
    # 配額用完 → 409；不在隊上 → 404；伏擊層收下但不計分
    assert client.post(f"/api/v1/dungeons/{did}/answers", json={"student_id": members[0], "layer": "patrol", "correct": True}).status_code == 409
    assert client.post(f"/api/v1/dungeons/{did}/answers", json={"student_id": 1, "layer": "patrol", "correct": True}).status_code == 404
    assert client.post(f"/api/v1/dungeons/{did}/answers", json={"student_id": members[0], "layer": "ambush", "correct": True}).status_code == 200
    before = client.get(f"/api/v1/teams/{tid}/record").json()
    s = client.post(f"/api/v1/dungeons/{did}/settle", json={"skipped_relays": 0})
    assert s.status_code == 200, s.text
    body = s.json()
    assert body["status"] == "settled" and body["stars"] == 2 and body["next_route"] == "hills"
    assert body["result"]["numerator"] == 13 and body["result"]["denominator"] == 16 and body["result"]["ambush_answers"] == 1
    # 全隊一份 8 點；人均與路線更新
    after = client.get(f"/api/v1/teams/{tid}/record").json()
    assert after["total"] == before["total"] + 8 and after["route"] == "hills" and after["size"] == 4
    assert after["per_capita"] == round(after["total"] / 4, 1)
    assert after["unlocks"]["physical_badge"] is False
    # 結算過不能再作答、再結算；同週不能再開
    assert client.post(f"/api/v1/dungeons/{did}/answers", json={"student_id": members[0], "layer": "patrol", "correct": True}).status_code == 409
    assert client.post(f"/api/v1/dungeons/{did}/settle", json={}).status_code == 409
    assert client.post(f"/api/v1/teams/{tid}/dungeons", json={"week": 2, "time": "20:00"}).status_code == 409
    # 缺席：第 3 週開門後申報；每季最多 2 次
    d3 = client.post(f"/api/v1/teams/{tid}/dungeons", json={"week": 3, "time": "20:00"}).json()
    assert d3["route"] == "hills"
    assert client.post(f"/api/v1/dungeons/{d3['id']}/absences", json={"student_id": members[3]}).status_code == 200
    assert client.post(f"/api/v1/dungeons/{d3['id']}/absences", json={"student_id": members[3]}).status_code == 409
    assert client.post(f"/api/v1/dungeons/{d3['id']}/answers", json={"student_id": members[3], "layer": "patrol", "correct": True}).status_code == 409
    # 三人全對 → 12/12，全員（未缺席者）出手 → 三星
    for m in members[:3]:
        for _ in range(3):
            client.post(f"/api/v1/dungeons/{d3['id']}/answers", json={"student_id": m, "layer": "patrol", "correct": True})
        client.post(f"/api/v1/dungeons/{d3['id']}/answers", json={"student_id": m, "layer": "relay", "correct": True})
    s3 = client.post(f"/api/v1/dungeons/{d3['id']}/settle", json={}).json()
    assert s3["stars"] == 3 and s3["result"]["denominator"] == 12 and s3["result"]["points"] == 12 and s3["next_route"] == "ridge"


def test_api_dungeon_lights_out_423(client):
    team = _team_by_name(client, "星期三小隊")
    for t in ("22:30", "23:10", "02:00", "05:59"):
        r = client.post(f"/api/v1/teams/{team['id']}/dungeons", json={"week": 2, "time": t})
        assert r.status_code == 423, t
        assert "關燈" in r.json()["detail"]
    assert client.post(f"/api/v1/teams/{team['id']}/dungeons", json={"week": 2, "time": "06:00"}).status_code == 201


def test_api_shadow_events_record_and_daily_cap(client):
    team = _team_by_name(client, "四葉小隊")
    sid = next(m["student_id"] for m in team["members"] if m["nickname"] == "小芸")  # 兩隻怪都還在附近
    shadows = {s["monster_id"]: s for s in client.get(f"/api/v1/students/{sid}/shadows").json()}
    assert shadows["sq-cross"]["state"] == "near" and shadows["sign-dist"]["state"] == "near" and shadows["quad-zero"]["state"] == "fog"
    assert shadows["sq-cross"]["name"] == "漏項獸" and shadows["sq-cross"]["region"] == "mult"
    # 非法轉移 409、沒有這隻怪 404
    assert client.post(f"/api/v1/students/{sid}/shadows/sq-cross/events", json={"event": "retest_passed"}).status_code == 409
    assert client.post(f"/api/v1/students/{sid}/shadows/nope/events", json={"event": "diagnosed_stuck"}).status_code == 404
    assert client.post(f"/api/v1/students/{sid}/shadows/sq-cross/events", json={"event": "login"}).status_code == 422
    # 說得出來 +3、再測通過 +10（收服，captured_at 有值）、又錯 0、叫醒 +5
    e = client.post(f"/api/v1/students/{sid}/shadows/sq-cross/events", json={"event": "explained_ok"}).json()
    assert e["state"] == "hit" and e["points"] == 3 and e["record_kind"] == "explain" and e["today_count"] == 1
    e = client.post(f"/api/v1/students/{sid}/shadows/sq-cross/events", json={"event": "retest_passed"}).json()
    assert e["state"] == "captured" and e["points"] == 10 and e["captured_at"] is not None
    e = client.post(f"/api/v1/students/{sid}/shadows/sq-cross/events", json={"event": "wrong_again"}).json()
    assert e["state"] == "asleep" and e["points"] == 0 and e["record_kind"] is None and e["today_count"] == 2
    e = client.post(f"/api/v1/students/{sid}/shadows/sq-cross/events", json={"event": "woken"}).json()
    assert e["state"] == "captured" and e["points"] == 5 and e["woke_at"] is not None and e["today_count"] == 3
    rec = client.get(f"/api/v1/students/{sid}/record").json()
    assert rec["total"] == 18 and [x["kind"] for x in rec["events"]] == ["explain", "capture", "wake"]
    # 今天第四張會計分的任務卡 → 409；不計分的狀態轉移照樣可以
    assert client.post(f"/api/v1/students/{sid}/shadows/sign-dist/events", json={"event": "explained_ok"}).status_code == 409
    assert client.post(f"/api/v1/students/{sid}/shadows/quad-zero/events", json={"event": "diagnosed_stuck"}).status_code == 200
    assert client.get("/api/v1/students/9999/shadows").status_code == 404


def test_api_matches_board_and_tower(client):
    a = _team_by_name(client, "四葉小隊")
    b = _team_by_name(client, "星期三小隊")
    # 鏡像賽：兩隊第 1 週都有結算副本（0.7 vs 0.65）→ a 勝；同隊再配 409（本季打過）
    r = client.post("/api/v1/matches/mirror", json={"team_a_id": a["id"], "team_b_id": b["id"], "week": 1})
    assert r.status_code == 201, r.text
    assert r.json()["result"]["winner"] == "a" and r.json()["ghost"] is False
    again = client.post("/api/v1/matches/mirror", json={"team_a_id": a["id"], "team_b_id": b["id"], "week": 1})
    assert again.status_code == 409 and "打過" in again.json()["detail"]
    # 有一票不同意 → 幽靈隊（需要給歷史平均）
    g = client.post(
        "/api/v1/matches/mirror",
        json={"team_a_id": a["id"], "team_b_id": b["id"], "week": 2, "rate_a": 0.8, "rate_b": 0.8, "votes_a": [True, True, False, True]},
    )
    assert g.status_code == 201 and g.json()["ghost"] is True and g.json()["team_b_id"] is None and g.json()["result"]["tie"] is True
    # 出題戰：本季已和星期三小隊打過 → 409；改和王老師帶的新隊打（同科同年級同路線、不同嚮導）
    duel_body = {
        "answers_a_correct": [True, True, False],
        "answers_b_correct": [False, False, True],
        "setting_valid_a": [True, False, True],
        "setting_valid_b": [True, True, True],
    }
    assert client.post("/api/v1/matches/duel", json={"team_a_id": a["id"], "team_b_id": b["id"], "week": 3, **duel_body}).status_code == 409
    c = _make_third_team(client)
    # 新隊只遠征過漏項獸、負號幽靈（課表）：交集不足三隻 → 幽靈隊
    gd0 = client.post("/api/v1/matches/duel", json={"team_a_id": a["id"], "team_b_id": c["id"], "week": 3, **duel_body}).json()
    assert gd0["ghost"] is True and gd0["team_b_id"] is None and gd0["result"]["monsters"] == []
    # 新隊有人偵察到拆根蟲 → 三隻交集 → 真人對戰；六分制
    assert client.post(f"/api/v1/students/{c['members'][0]['student_id']}/shadows/sqrt-split/events", json={"event": "diagnosed_stuck"}).status_code == 200
    d = client.post("/api/v1/matches/duel", json={"team_a_id": a["id"], "team_b_id": c["id"], "week": 3, **duel_body})
    assert d.status_code == 201, d.text
    assert (
        d.json()["ghost"] is False and d.json()["result"]["a"]["total"] == 3 and d.json()["result"]["b"]["total"] == 2 and d.json()["result"]["winner"] == "a"
    )
    assert set(d.json()["result"]["monsters"]) == {"sq-cross", "sign-dist", "sqrt-split"}
    # 沒有對手 → 幽靈隊
    gd = client.post(
        "/api/v1/matches/duel",
        json={
            "team_a_id": a["id"],
            "week": 6,
            "answers_a_correct": [True] * 3,
            "answers_b_correct": [False] * 3,
            "setting_valid_a": [True] * 3,
            "setting_valid_b": [True] * 3,
        },
    )
    assert gd.status_code == 201 and gd.json()["ghost"] is True
    # 榜：北區數學平原線，只回前後各三隊、沒有名次與總數
    board = client.get("/api/v1/leagues/north/board", params={"team_id": a["id"]}).json()
    assert board["route"] == "plain" and [e["name"] for e in board["entries"]] == ["四葉小隊", "星期三小隊"]
    assert board["entries"][0]["me"] is True and "rank" not in board["entries"][0]
    assert client.get("/api/v1/leagues/west/board", params={"team_id": a["id"]}).status_code == 404
    assert client.get("/api/v1/leagues/north/board", params={"team_id": a["id"], "route": "cloud"}).status_code == 404
    # 燈塔：乘法平原的戰績加總（四葉 34＋星期三 8＝42）還沒點燈；守塔要 X-Admin-Token
    tower = client.get("/api/v1/leagues/north/regions/mult/tower").json()
    assert tower["lighthouse"]["progress"] == 42 and tower["lighthouse"]["lit"] is False and tower["lighthouse"]["threshold"] == 3000
    assert tower["month"] is None and tower["keepers"]["plain"] == []
    assert client.get("/api/v1/leagues/north/regions/nowhere/tower").status_code == 404
    month = date.today().strftime("%Y-%m")
    assert client.post("/api/v1/towers/settle", json={"month": month}).status_code == 401
    st = client.post("/api/v1/towers/settle", json={"month": month}, headers={"X-Admin-Token": TEST_ADMIN_TOKEN})
    assert st.status_code == 200, st.text
    rows = [x for x in st.json()["settled"] if x["region_id"] == "mult"]
    assert rows == [{"league": "north", "region_id": "mult", "route": "plain", "team_id": a["id"], "records": 34}]
    tower = client.get("/api/v1/leagues/north/regions/mult/tower").json()
    assert tower["month"] == month and tower["keepers"]["plain"][0]["name"] == "四葉小隊" and len(tower["hall_of_fame"]) == 1
    # 同月重跑不會重複追加名冊
    client.post("/api/v1/towers/settle", json={"month": month}, headers={"X-Admin-Token": TEST_ADMIN_TOKEN})
    assert len(client.get("/api/v1/leagues/north/regions/mult/tower").json()["hall_of_fame"]) == 1
