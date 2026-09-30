"""老師收入、招募表單驗證、管理權杖、小陪規則與關燈、rate limit。"""

from fastapi.testclient import TestClient

from tests.conftest import TEST_ADMIN_TOKEN, make_test_app

VALID_APP = {
    "name": "示範老師",
    "contact": "demo@example.com",
    "subjects": ["國二數學"],
    "slots": ["weeknight"],
    "experience": "1to3",
    "note": "",
    "consent": True,
}


def test_earnings_endpoint(client):
    r = client.get("/api/v1/teachers/1/earnings", params={"tier": "gold", "teams": 2, "size": 4})
    assert r.status_code == 200
    j = r.json()
    assert j["per_session"] == 777 and j["monthly"] == 6680 and j["weekly_hours"] == 1.7
    # 不給 tier 就用老師自己的等級（3 號是新手）
    j2 = client.get("/api/v1/teachers/3/earnings", params={"teams": 1, "size": 2}).json()
    assert j2["tier"] == "novice" and j2["floored"] is True and j2["per_session"] == 600
    assert client.get("/api/v1/teachers/1/earnings", params={"size": 9}).status_code == 422
    assert client.get("/api/v1/teachers/99/earnings").status_code == 404


def test_teacher_application_validation(client):
    ok = client.post("/api/v1/teacher-applications", json=VALID_APP)
    assert ok.status_code == 201 and ok.json()["status"] == "received"
    phone = client.post("/api/v1/teacher-applications", json={**VALID_APP, "contact": "0912-345-678"})
    assert phone.status_code == 201
    bad_contact = client.post("/api/v1/teacher-applications", json={**VALID_APP, "contact": "找我"})
    assert bad_contact.status_code == 422
    no_consent = client.post("/api/v1/teacher-applications", json={**VALID_APP, "consent": False})
    assert no_consent.status_code == 422
    no_subject = client.post("/api/v1/teacher-applications", json={**VALID_APP, "subjects": []})
    assert no_subject.status_code == 422
    bad_exp = client.post("/api/v1/teacher-applications", json={**VALID_APP, "experience": "很多"})
    assert bad_exp.status_code == 422
    blank_name = client.post("/api/v1/teacher-applications", json={**VALID_APP, "name": "   "})
    assert blank_name.status_code == 422


def test_admin_token_required_to_list_applications(client):
    client.post("/api/v1/teacher-applications", json=VALID_APP)
    assert client.get("/api/v1/teacher-applications").status_code == 401
    assert client.get("/api/v1/teacher-applications", headers={"X-Admin-Token": "wrong"}).status_code == 401
    r = client.get("/api/v1/teacher-applications", headers={"X-Admin-Token": TEST_ADMIN_TOKEN})
    assert r.status_code == 200 and r.json()[0]["name"] == "示範老師"


def test_admin_endpoint_disabled_without_token():
    app = make_test_app(admin_token="")
    with TestClient(app) as c:
        assert c.get("/api/v1/teacher-applications", headers={"X-Admin-Token": "x"}).status_code == 503


def test_coach_rules_flow(client):
    start = client.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "start", "time": "20:00"}).json()
    assert start["provider"] == "rules" and start["lights_out"] is False and start["step"] == 0
    assert "不會直接給答案" in start["messages"][0]["text"]
    # 答對第一步：(x+5)(x+5)
    a1 = client.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "answer", "message": "(x + 5)(x + 5)", "step": 0, "time": "20:00"}).json()
    assert a1["ok"] is True and a1["step"] == 1
    # 答錯：先不說對錯
    wrong = client.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "answer", "message": "亂猜", "step": 1, "time": "20:00"}).json()
    assert wrong["ok"] is False and wrong["step"] == 1
    # 提示：層級往上
    h = client.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "hint", "step": 1, "hint_level": 0, "time": "20:00"}).json()
    assert h["hint_level"] == 1 and h["messages"][0]["kind"] == "hint"
    assert client.post("/api/v1/coach/reply", json={"skill_id": "nope", "action": "start", "time": "20:00"}).status_code == 422


def test_coach_lights_out(client):
    for t in ("22:30", "23:10", "02:00", "05:59"):
        r = client.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "start", "time": t}).json()
        assert r["lights_out"] is True and "關燈中" in r["messages"][0]["text"]
    r = client.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "start", "time": "06:00"}).json()
    assert r["lights_out"] is False


def test_coach_explain(client):
    r = client.post("/api/v1/coach/explain", json={"skill_id": "sq-cross", "text": "平方是整個括號自己乘自己，每一項都要乘到，中間會多出 2ab"}).json()
    assert r["pass"] is True and r["score"] == 3
    short = client.post("/api/v1/coach/explain", json={"skill_id": "sq-cross", "text": "不知道"}).json()
    assert short["pass"] is False and "有點短" in short["feedback"]


def test_rate_limit():
    app = make_test_app(rate_limit_per_minute=3)
    with TestClient(app) as c:
        for _ in range(3):
            assert c.get("/api/v1/content/skills").status_code == 200
        r = c.get("/api/v1/content/skills")
        assert r.status_code == 429 and r.headers.get("Retry-After") == "60"
        # /health 不受限
        assert c.get("/api/v1/health").status_code == 200


def test_cors_whitelist(client):
    r = client.options("/api/v1/students", headers={"Origin": "http://testserver", "Access-Control-Request-Method": "POST"})
    assert r.headers.get("access-control-allow-origin") == "http://testserver"
    r2 = client.options("/api/v1/students", headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in r2.headers
