"""測試用的 app：記憶體 SQLite、已灌種子、管理權杖固定為測試值。"""

import pytest
from app.core.config import Settings
from app.main import create_app
from app.seed import seed
from fastapi.testclient import TestClient

TEST_ADMIN_TOKEN = "test-admin-token-not-secret"


def make_test_app(**overrides):
    base = dict(
        app_env="test",
        database_url="sqlite:///:memory:",
        admin_token=TEST_ADMIN_TOKEN,
        rate_limit_per_minute=0,
        cors_origins="http://testserver",
    )
    base.update(overrides)
    settings = Settings(_env_file=None, **base)
    app = create_app(settings)
    db = app.state.session_factory()
    try:
        seed(db)
    finally:
        db.close()
    return app


@pytest.fixture
def app():
    return make_test_app()


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c


# 診斷答題：q1 選錯（漏中間項）、q2 選錯（分配負號）、其餘答對
ANSWERS_TWO_STUCK = {"q1": 0, "q2": 1, "q3": 1, "q4": 0, "q5": 0, "q6": 0, "q7": 1, "q8": 0}
ANSWERS_ALL_OK = {"q1": 1, "q2": 0, "q3": 1, "q4": 0, "q5": 0, "q6": 0, "q7": 1, "q8": 0}


def create_student(client, nickname="小睿", **kw):
    r = client.post("/api/v1/students", json={"nickname": nickname, "grade": "國二", "exam_date": "2026-11-27", **kw})
    assert r.status_code == 201, r.text
    return r.json()


def diagnose(client, sid, answers=ANSWERS_TWO_STUCK):
    r = client.post(f"/api/v1/students/{sid}/diagnostics", json={"answers": answers})
    assert r.status_code == 201, r.text
    return r.json()


def set_slots(client, sid, slots):
    r = client.put(f"/api/v1/students/{sid}/availability", json={"slots": slots})
    assert r.status_code == 200, r.text
    return r.json()
