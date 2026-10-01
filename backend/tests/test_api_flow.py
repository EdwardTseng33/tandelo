"""API 流程：建學生→診斷→時段→湊隊→接班→課堂紀錄→練習→再測→週報。"""

from datetime import date, timedelta

from tests.conftest import ANSWERS_ALL_OK, create_student, diagnose, set_slots


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200 and r.json()["ok"] is True
    assert client.get("/health").status_code == 200


def test_student_and_diagnostic(client):
    s = create_student(client)
    d = diagnose(client, s["id"])
    assert d["stuck"] == ["sq-cross", "sign-dist"]
    assert d["stuck_titles"][0] == "完全平方要有中間那一項"
    got = client.get(f"/api/v1/students/{s['id']}").json()
    assert got["stuck"] == ["sq-cross", "sign-dist"]
    assert client.get("/api/v1/students/9999").status_code == 404


def test_availability_validation(client):
    s = create_student(client)
    r = client.put(f"/api/v1/students/{s['id']}/availability", json={"slots": ["週三晚上"]})
    assert r.status_code == 422
    out = set_slots(client, s["id"], ["d2-2000", "d2-1900", "d2-1900"])
    assert out["slots"] == ["d2-1900", "d2-2000"]


def test_match_requires_diagnostic_and_slots(client):
    s = create_student(client)
    assert client.post("/api/v1/teams/match", json={"student_id": s["id"]}).status_code == 409
    diagnose(client, s["id"])
    assert client.post("/api/v1/teams/match", json={"student_id": s["id"]}).status_code == 409


def test_full_flow_match_accept_report(client):
    s = create_student(client)
    diagnose(client, s["id"])
    set_slots(client, s["id"], ["d2-1900", "d0-1900"])
    t = client.post("/api/v1/teams/match", json={"student_id": s["id"], "plan_id": "8"})
    assert t.status_code == 201, t.text
    team = t.json()
    assert team["status"] == "forming" and team["slot_id"] == "d2-1900"
    assert team["size"] == 4 and team["rule"] == "4 人成班"
    assert team["members"][0]["nickname"] == "小睿"
    assert team["focus"] == ["sq-cross", "sign-dist"]
    assert team["first_date"] is not None

    # 同一位學生不能再湊一次
    assert client.post("/api/v1/teams/match", json={"student_id": s["id"]}).status_code == 409

    # 老師接班 → 成班、8 堂課
    a = client.post(f"/api/v1/teams/{team['id']}/accept", json={"teacher_id": 1})
    assert a.status_code == 200, a.text
    assert a.json()["status"] == "confirmed" and a.json()["mode"] == "squad" and a.json()["teacher_name"] == "林老師"
    sessions = client.get(f"/api/v1/teams/{team['id']}/sessions").json()
    assert len(sessions) == 8 and sessions[0]["topic"] == "完全平方要有中間那一項" and sessions[2]["topic"].startswith("段考訂正")
    assert date.fromisoformat(sessions[1]["date"]) - date.fromisoformat(sessions[0]["date"]) == timedelta(days=7)

    # 再接一次會被擋
    assert client.post(f"/api/v1/teams/{team['id']}/accept", json={"teacher_id": 2}).status_code == 409

    # 老師課後 30 秒紀錄
    n = client.post(f"/api/v1/sessions/{sessions[0]['id']}/notes", json={"teacher_id": 1, "text": "今天小睿講得出中間項為什麼會多出來。"})
    assert n.status_code == 201

    # 練習與再測
    today = date.today()
    p = client.post(
        f"/api/v1/students/{s['id']}/practices", json={"skill_id": "sq-cross", "kind": "explain", "explain_passed": True, "hints": 1, "date": today.isoformat()}
    )
    assert p.status_code == 201 and p.json()["today_count"] == 1
    rt = client.post(f"/api/v1/students/{s['id']}/retests", json={"skill_id": "sq-cross", "hints": 1, "from_date": today.isoformat()})
    assert rt.status_code == 201
    assert date.fromisoformat(rt.json()["due_date"]) == today + timedelta(days=10)

    # 週報：有「今晚可以問他」、有下週、有老師紀錄
    rep = client.get(f"/api/v1/students/{s['id']}/parent-report", params={"today": today.isoformat()})
    assert rep.status_code == 200, rep.text
    body = rep.json()
    assert body["nickname"] == "小睿"
    assert body["explain_passes"] == 1 and body["practice_days"] == 1
    assert body["explained"][0]["title"] == "完全平方要有中間那一項"
    assert body["tonight"].startswith("今晚可以問他")
    assert body["teacher_note"].startswith("今天小睿")
    assert any("再測" in x for x in body["next_week"])
    assert len(body["lines"]) >= 2
    assert len(client.get(f"/api/v1/students/{s['id']}/parent-reports").json()) == 1


def test_accept_rules_three_and_two(client):
    # 讓種子隊友只在 d3-1900 有兩位（小恩、小翔）→ 湊起來 3 人 → 改 1 對 3
    s = create_student(client, "小三")
    diagnose(client, s["id"])
    set_slots(client, s["id"], ["d3-1900"])
    team = client.post("/api/v1/teams/match", json={"student_id": s["id"]}).json()
    assert team["size"] == 3 and team["rule"] == "改 1 對 3，學費照調"
    a = client.post(f"/api/v1/teams/{team['id']}/accept", json={"teacher_id": 1}).json()
    assert a["status"] == "confirmed" and a["mode"] == "one_to_three"

    # 沒有隊友的時段 → 只有 1 人 → 不開班
    s2 = create_student(client, "小二")
    diagnose(client, s2["id"], ANSWERS_ALL_OK)
    set_slots(client, s2["id"], ["d6-2000"])
    team2 = client.post("/api/v1/teams/match", json={"student_id": s2["id"]}).json()
    assert team2["size"] == 1 and team2["rule"] == "不開班，全額退"
    r = client.post(f"/api/v1/teams/{team2['id']}/accept", json={"teacher_id": 1})
    assert r.status_code == 409 and "不開班" in r.json()["detail"]


def test_join_up_to_six(client):
    s = create_student(client, "隊長")
    diagnose(client, s["id"])
    set_slots(client, s["id"], ["d6-2000"])
    team = client.post("/api/v1/teams/match", json={"student_id": s["id"]}).json()
    assert team["size"] == 1
    for i in range(5):
        m = create_student(client, f"隊友{i}")
        r = client.post(f"/api/v1/teams/{team['id']}/join", json={"student_id": m["id"]})
        assert r.status_code == 200, r.text
    assert client.get(f"/api/v1/teams/{team['id']}").json()["size"] == 6
    extra = create_student(client, "第七人")
    r = client.post(f"/api/v1/teams/{team['id']}/join", json={"student_id": extra["id"]})
    assert r.status_code == 409 and "已滿" in r.json()["detail"]
    # 重複加入
    assert client.post(f"/api/v1/teams/{team['id']}/join", json={"student_id": s["id"]}).status_code == 409


def test_practice_daily_cap(client):
    s = create_student(client, "練習生", daily_cap=2)
    d = date.today().isoformat()
    for _ in range(2):
        assert client.post(f"/api/v1/students/{s['id']}/practices", json={"skill_id": "sq-cross", "date": d}).status_code == 201
    r = client.post(f"/api/v1/students/{s['id']}/practices", json={"skill_id": "sq-cross", "date": d})
    assert r.status_code == 409 and "上限" in r.json()["detail"]
    assert client.post(f"/api/v1/students/{s['id']}/practices", json={"skill_id": "not-a-skill", "date": d}).status_code == 422


def test_retest_complete_only_after_due(client):
    s = create_student(client, "再測生")
    start = date(2026, 10, 1)
    rt = client.post(f"/api/v1/students/{s['id']}/retests", json={"skill_id": "sq-cross", "hints": 0, "from_date": start.isoformat()}).json()
    assert rt["due_date"] == "2026-10-13"
    early = client.post(f"/api/v1/retests/{rt['id']}/complete", json={"passed": True, "on": "2026-10-05"})
    assert early.status_code == 409
    ok = client.post(f"/api/v1/retests/{rt['id']}/complete", json={"passed": True, "on": "2026-10-13"})
    assert ok.status_code == 200 and ok.json()["status"] == "mastered"
    assert client.post(f"/api/v1/retests/{rt['id']}/complete", json={"passed": True, "on": "2026-10-14"}).status_code == 409
    rep = client.get(f"/api/v1/students/{s['id']}/parent-report", params={"today": "2026-10-15"}).json()
    assert rep["learned"] == ["完全平方要有中間那一項"]
    assert rep["lines"][0].startswith("再測生這週翻過去了")
