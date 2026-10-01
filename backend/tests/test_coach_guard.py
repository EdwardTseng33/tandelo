"""小陪接模型與守門（0.3）：有金鑰走模型、沒金鑰退回規則、洩漏守門、第四層固定句、關燈不呼叫模型、metrics。

全部用假的 SDK client（monkeypatch），不對外打 API；金鑰是假字串。
"""

import json
import logging
from types import SimpleNamespace

import pytest
from app.services import coach as coach_svc
from app.services import guard
from fastapi.testclient import TestClient

from tests.conftest import make_test_app

FAKE_KEY = "test-key-not-a-real-secret"


class FakeMessages:
    """模仿 client.messages.create：依序吐出預先寫好的回覆，並記下每次呼叫的參數。"""

    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []

    def create(self, **kw):
        self.calls.append(kw)
        if not self.replies:
            raise AssertionError("不該再呼叫模型")
        r = self.replies.pop(0)
        if isinstance(r, Exception):
            raise r
        if isinstance(r, dict) and r.get("_refusal"):
            return SimpleNamespace(stop_reason="refusal", content=[])
        text = r if isinstance(r, str) else json.dumps(r, ensure_ascii=False)
        return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=text)])


class FakeClient:
    def __init__(self, replies):
        self.messages = FakeMessages(replies)


def llm_app(monkeypatch, replies, **overrides):
    fake = FakeClient(replies)
    monkeypatch.setattr(coach_svc, "_make_client", lambda key: fake)
    app = make_test_app(coach_provider="anthropic", anthropic_api_key=FAKE_KEY, **overrides)
    return app, fake


def say(level, text, handoff=False):
    return {"level": level, "text": text, "handoff": handoff}


# ——— 守門（純函式）———
@pytest.mark.parametrize(
    "text",
    ["答案是 2x+7", "= 2x + 7", "2x+7", "所以等於 7 + 2x", "就是2x+7喔", "答案就是 2x + 7。", "結果是 2x+7，對嗎"],
)
def test_guard_catches_answer_forms(text):
    assert guard.leaks_answer(text, ["2x+7"]) is True


@pytest.mark.parametrize("text", ["負號要發給每一個人", "看第二行，括號前面那個符號。", "先看 2x 這一項", "你寫到哪一步？", ""])
def test_guard_lets_hints_through(text):
    assert guard.leaks_answer(text, ["2x+7"]) is False


def test_guard_number_fraction_and_boundaries():
    assert guard.leaks_answer("所以是 0.5", ["1/2"]) is True
    assert guard.leaks_answer("得到 13", ["13"]) is True
    assert guard.leaks_answer("是 130", ["13"]) is False  # 13 不等於 130
    assert guard.leaks_answer("這一項是 6x", ["6"]) is False  # 6 不等於 6x
    assert guard.leaks_answer("x^2 + 25 + 10x 嗎", ["x² + 10x + 25"]) is False  # 順序不同、沒有「等於」不算
    assert guard.leaks_answer("答案是 x^2 + 25 + 10x", ["x² + 10x + 25"]) is True  # 有「答案是」就比對項的集合
    assert guard.leaks_answer("隨便說", []) is False


def test_guard_too_long_unsafe_and_phrase():
    assert guard.too_long("這句很短。") is False
    assert guard.too_long("一" * 40) is False
    assert guard.too_long("一" * 41) is True
    assert guard.too_long("好。" * 6) is True
    assert guard.has_unsafe("你真笨") is True
    assert guard.has_unsafe("你寫到哪一步？") is False
    assert guard.check("答案是什麼呢？", ["13"]) == "answer_phrase"
    assert guard.check("   ", ["13"]) == "empty"
    assert guard.check("先看平方這兩個字。", ["13"]) is None


# ——— 提供者選擇 ———
def test_llm_used_when_key_present(monkeypatch):
    app, fake = llm_app(monkeypatch, [say(1, "看第二行，括號前面那個符號。")])
    assert app.state.coach_provider.name == "anthropic"
    with TestClient(app) as c:
        body = {"skill_id": "sq-cross", "action": "hint", "step": 0, "hint_level": 0, "level": 1, "monster_id": "sq-cross", "time": "20:00"}
        r = c.post("/api/v1/coach/reply", json={**body, "step_text": "(x+5)² = x² + 25"}).json()
    assert r["provider"] == "anthropic" and r["lights_out"] is False
    assert r["messages"][0]["text"] == "看第二行，括號前面那個符號。"
    assert r["level"] == 1 and r["handoff"] is False and r["guarded"] is None and r["hint_level"] == 1
    call = fake.messages.calls[0]
    assert call["model"] == "claude-sonnet-5-5"
    sys_prompt = call["system"]
    for needle in ("漏項獸", "騙術", "口頭禪", "弱點", "被識破時", "(x+5)² = x² + 25", "第 1 層「指」", "答案是", "40 字"):
        assert needle in sys_prompt
    assert call["messages"][0]["role"] == "user"
    assert call["output_config"]["format"]["type"] == "json_schema"


def test_custom_model_from_settings(monkeypatch):
    app, fake = llm_app(monkeypatch, [say(0, "你寫到哪一步？")], coach_model="claude-haiku-4-5")
    with TestClient(app) as c:
        c.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "hint", "level": 0, "time": "20:00"})
    assert fake.messages.calls[0]["model"] == "claude-haiku-4-5"


def test_no_key_falls_back_to_rules(monkeypatch, caplog):
    monkeypatch.setattr(coach_svc, "_make_client", lambda key: (_ for _ in ()).throw(AssertionError("沒金鑰不該建 client")))
    with caplog.at_level(logging.WARNING, logger="tandelo.coach"):
        app = make_test_app(coach_provider="anthropic", anthropic_api_key="")
    assert app.state.coach_provider.name == "rules"
    assert any("ANTHROPIC_API_KEY" in m for m in caplog.messages)
    with TestClient(app) as c:
        r = c.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "start", "time": "20:00"}).json()
    assert r["provider"] == "rules"


def test_sdk_missing_falls_back_to_rules(monkeypatch, caplog):
    def no_sdk(key):
        raise RuntimeError("沒有安裝 anthropic SDK")

    monkeypatch.setattr(coach_svc, "_make_client", no_sdk)
    with caplog.at_level(logging.WARNING, logger="tandelo.coach"):
        app = make_test_app(coach_provider="anthropic", anthropic_api_key=FAKE_KEY)
    assert app.state.coach_provider.name == "rules"
    assert any("SDK" in m for m in caplog.messages)


def test_unknown_provider_rejected():
    with pytest.raises(ValueError):
        coach_svc.get_provider("gpt")


# ——— 守門把關：沒過就退回規則引擎同層級、計一筆 leak ———
def test_leak_falls_back_to_rules_and_counts(monkeypatch):
    app, fake = llm_app(
        monkeypatch,
        [
            say(1, "答案是 x² + 10x + 25"),  # 最後一步，直接洩漏最終答案
            say(1, "5x 和 5x 是同類項，再看一次。"),  # 乾淨
            say(1, "所以 = 2x + 7"),  # 用呼叫端給的 answer_forms 擋
            say(1, "負號要發給每一個人"),  # 要放過
        ],
    )
    with TestClient(app) as c:
        base = {"skill_id": "sq-cross", "action": "hint", "step": 2, "hint_level": 0, "level": 1, "time": "20:00"}
        r1 = c.post("/api/v1/coach/reply", json=base).json()
        assert r1["provider"] == "anthropic" and r1["guarded"] == "leak"
        assert r1["messages"][0]["text"] == coach_svc.RulesCoach().line_for_level("sq-cross", 2, 1) == "哪兩塊都有 x？"
        assert r1["level"] == 1
        m1 = c.get("/api/v1/coach/metrics").json()
        assert m1 == {"provider": "anthropic", "total": 1, "llm_calls": 1, "leak": 1, "leak_rate": 1.0, "by_reason": {"leak": 1}}

        r2 = c.post("/api/v1/coach/reply", json=base).json()
        assert r2["guarded"] is None and "同類項" in r2["messages"][0]["text"]
        m2 = c.get("/api/v1/coach/metrics").json()
        assert m2["total"] == 2 and m2["leak"] == 1 and m2["leak_rate"] == 0.5

        r3 = c.post("/api/v1/coach/reply", json={**base, "step": 0, "answer_forms": ["2x+7"]}).json()
        assert r3["guarded"] == "leak"
        r4 = c.post("/api/v1/coach/reply", json={**base, "step": 0, "answer_forms": ["2x+7"]}).json()
        assert r4["guarded"] is None and r4["messages"][0]["text"] == "負號要發給每一個人"
        m4 = c.get("/api/v1/coach/metrics").json()
        assert m4["total"] == 4 and m4["leak"] == 2 and m4["leak_rate"] == 0.5 and m4["llm_calls"] == 4


def test_step_answer_is_guarded_below_level_three(monkeypatch):
    # 第 0 步的答案是 (x+5)(x+5)：第三層以前不能說；第三層「示範一步」可以
    app, _ = llm_app(monkeypatch, [say(1, "就是 (x+5)(x+5) 啦"), say(3, "我做這一步：(x+5)² 寫成 (x+5)(x+5)。下一步換你。", True)])
    with TestClient(app) as c:
        r1 = c.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "hint", "step": 0, "level": 1, "time": "20:00"}).json()
        assert r1["guarded"] == "leak"
        r3 = c.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "hint", "step": 0, "level": 3, "time": "20:00"}).json()
        assert r3["guarded"] is None and r3["handoff"] is True and r3["level"] == 3


@pytest.mark.parametrize(
    "reply,reason",
    [
        (say(1, "這一步你要先把左邊括號裡的每一項都分別乘到右邊括號裡的每一項，然後再把同類項全部合併起來看看會變成什麼。"), "too_long"),
        (say(1, "你怎麼這麼笨"), "unsafe"),
        (say(1, "答案是什麼你自己想"), "answer_phrase"),
        ("not json at all", "bad_json"),
        ({"_refusal": True}, "refusal"),
        (TimeoutError("boom"), "error"),
    ],
)
def test_other_guard_reasons_fall_back(monkeypatch, reply, reason):
    app, _ = llm_app(monkeypatch, [reply])
    with TestClient(app) as c:
        r = c.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "hint", "step": 0, "level": 1, "time": "20:00"}).json()
    assert r["guarded"] == reason and r["provider"] == "anthropic"
    assert r["messages"][0]["text"] == "先看「平方」這兩個字：誰自己乘自己？"
    assert app.state.coach_metrics.snapshot()["by_reason"] == {reason: 1}


# ——— 第四層之後：固定句，不呼叫模型 ———
def test_level_four_fixed_sentence_without_model(monkeypatch):
    app, fake = llm_app(monkeypatch, [])
    with TestClient(app) as c:
        for level in (4, 5):
            r = c.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "hint", "step": 0, "level": level, "time": "20:00"}).json()
            assert r["messages"][0]["text"] == "這一步交給你，寫到哪裡再叫我"
            assert r["handoff"] is True and r["provider"] == "anthropic" and r["guarded"] is None
    assert fake.messages.calls == []
    # 規則引擎同樣在第四層之後只回固定句
    assert coach_svc.RulesCoach().line_for_level("sq-cross", 0, 4) == coach_svc.HANDOFF_TEXT


# ——— 關燈：不呼叫模型 ———
def test_lights_out_does_not_call_model(monkeypatch):
    app, fake = llm_app(monkeypatch, [])
    with TestClient(app) as c:
        for t in ("22:30", "23:10", "02:00", "05:59"):
            r = c.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "hint", "level": 1, "time": t}).json()
            assert r["lights_out"] is True and "關燈中" in r["messages"][0]["text"] and r["provider"] == "anthropic"
        assert c.get("/api/v1/coach/metrics").json()["total"] == 0
    assert fake.messages.calls == []


# ——— 對錯判斷與換步驟仍交給規則引擎 ———
def test_answer_judging_stays_with_rules(monkeypatch):
    app, fake = llm_app(monkeypatch, [say(0, "你是怎麼把 x 和 5 分開的？")])
    with TestClient(app) as c:
        ok = c.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "answer", "message": "(x + 5)(x + 5)", "step": 0, "time": "20:00"}).json()
        assert ok["ok"] is True and ok["step"] == 1 and fake.messages.calls == []
        body = {"skill_id": "sq-cross", "action": "answer", "message": "x²·5²", "step": 0, "level": 0, "time": "20:00"}
        wrong = c.post("/api/v1/coach/reply", json=body).json()
        assert wrong["ok"] is False and wrong["step"] == 0 and len(fake.messages.calls) == 1
        assert "分開" in wrong["messages"][0]["text"]
        assert c.post("/api/v1/coach/reply", json={"skill_id": "nope", "action": "start", "time": "20:00"}).status_code == 422


def test_rules_provider_metrics(client):
    client.post("/api/v1/coach/reply", json={"skill_id": "sq-cross", "action": "start", "time": "20:00"})
    m = client.get("/api/v1/coach/metrics").json()
    assert m["provider"] == "rules" and m["total"] == 1 and m["leak"] == 0 and m["leak_rate"] == 0.0
