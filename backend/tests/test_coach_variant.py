"""小陪接變體題：後端用 (monster_id, route, seed) 重算該題；踩到 trap 時「指」點名錯法；「示範一步」用該題第一步；守門含該題答案。"""

import json
from types import SimpleNamespace

from app.services import coach as coach_svc
from app.services import variants as V
from fastapi.testclient import TestClient

FAKE_KEY = "test-key-not-a-real-secret"


def _turn(action="hint", level=1, picked=None, seed="t-1", route="plain", message=""):
    v = V.generate("sign-dist", seed, route)
    ctx = coach_svc.variant_context(v, picked)
    turn = coach_svc.CoachTurn(skill_id="sign-dist", action=action, level=level, hint_level=level, message=message, monster_id="sign-dist", variant=ctx)
    return V, v, turn


def test_variant_context_marks_trap_hit():
    v = V.generate("sign-dist", "t-1", "plain")
    ctx = coach_svc.variant_context(v, v["trap"])
    assert ctx["trap_hit"] is True and ctx["wrong"] is True and ctx["picked"] == v["options"][v["trap"]]
    ctx2 = coach_svc.variant_context(v, v["answer"])
    assert ctx2["trap_hit"] is False and ctx2["wrong"] is False
    assert coach_svc.variant_context(v, None)["picked"] == ""


def test_rules_level_one_names_the_trap_when_hit():
    _, v, turn = _turn(level=1, picked=v_trap("t-1"))
    r = coach_svc.RulesCoach().reply(turn)
    text = r["messages"][0]["text"]
    assert "負號只給第一項" in text
    assert v["options"][v["answer"]] not in text


def v_trap(seed):
    return V.generate("sign-dist", seed, "plain")["trap"]


def test_rules_level_one_without_trap_is_generic_pointer():
    _, v, turn = _turn(level=1, picked=None)
    text = coach_svc.RulesCoach().reply(turn)["messages"][0]["text"]
    assert "負號只給第一項" not in text and text


def test_rules_level_three_demos_first_step_but_never_the_answer():
    _, v, turn = _turn(level=3)
    r = coach_svc.RulesCoach().reply(turn)
    text = r["messages"][0]["text"]
    assert v["steps"][0] in text and r["handoff"] is True
    assert coach_svc.normalize(v["options"][v["answer"]]) not in coach_svc.normalize(text).replace(coach_svc.normalize(v["steps"][0]), "")


def test_rules_level_four_is_fixed_sentence():
    _, _, turn = _turn(level=4)
    assert coach_svc.RulesCoach().reply(turn)["messages"][0]["text"] == coach_svc.HANDOFF_TEXT


def test_rules_answer_judging_uses_variant_answer_and_trap():
    _, v, t_ok = _turn(action="answer", level=0, message=v_answer("t-1"))
    r = coach_svc.RulesCoach().reply(t_ok)
    assert r["ok"] is True and r["done"] is True
    _, v, t_trap = _turn(action="answer", level=0, message=v["options"][v["trap"]])
    r2 = coach_svc.RulesCoach().reply(t_trap)
    assert r2["ok"] is False and "負號只給第一項" in r2["messages"][0]["text"]


def v_answer(seed):
    v = V.generate("sign-dist", seed, "plain")
    return v["options"][v["answer"]]


def test_guard_forms_include_variant_answer():
    _, v, turn = _turn(level=1)
    assert v["options"][v["answer"]] in coach_svc.guard_forms(turn)


def test_system_prompt_has_stem_trap_label_and_hides_last_step():
    _, v, turn = _turn(level=1, picked=v_trap("t-1"))
    sp = coach_svc.build_system_prompt(turn)
    assert v["stem"] in sp and "負號只給第一項" in sp
    assert v["steps"][-1] not in sp


def test_api_reply_with_variant_regenerates_server_side(client: TestClient):
    v = V.generate("sign-dist", "api-1", "plain")
    variant = {"monster_id": "sign-dist", "route": "plain", "seed": "api-1", "picked": v["trap"]}
    body = {"skill_id": "sign-dist", "action": "hint", "level": 1, "hint_level": 1, "time": "20:00", "variant": variant}
    r = client.post("/api/v1/coach/reply", json=body)
    assert r.status_code == 200, r.text
    assert "負號只給第一項" in r.json()["messages"][0]["text"]
    bad = client.post("/api/v1/coach/reply", json={**body, "variant": {"monster_id": "no-such", "seed": "x"}})
    assert bad.status_code == 422


class _Msgs:
    def __init__(self, replies):
        self.replies, self.calls = list(replies), []

    def create(self, **kw):
        self.calls.append(kw)
        return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=self.replies.pop(0))])


def test_llm_leaking_variant_answer_falls_back_to_variant_line(monkeypatch):
    v = V.generate("sign-dist", "llm-1", "plain")
    answer = v["options"][v["answer"]]
    leak = json.dumps({"level": 1, "text": f"答案是 {answer}", "handoff": False}, ensure_ascii=False)
    client = SimpleNamespace(messages=_Msgs([leak]))
    metrics = coach_svc.CoachMetrics()
    prov = coach_svc.LLMProvider(client, "fake-model", metrics)
    turn = coach_svc.CoachTurn(skill_id="sign-dist", action="hint", level=1, hint_level=1, variant=coach_svc.variant_context(v, v["trap"]))
    r = prov.reply(turn)
    assert r["guarded"] and "負號只給第一項" in r["messages"][0]["text"]
    assert answer not in r["messages"][0]["text"]
    assert v["stem"] in client.messages.calls[0]["system"]


def test_api_reply_with_answer_token_uses_the_same_item_as_check(client: TestClient):
    lst = client.get("/api/v1/world/monsters/sign-dist/variants", params={"n": 2, "route": "plain", "seed": "tok-1"}).json()
    item = lst["items"][1]
    # 先用判題端點找出 trap 是哪一個
    trap = next(
        i
        for i in range(4)
        if client.post("/api/v1/world/monsters/sign-dist/variants/check", json={"answer_token": item["answer_token"], "choice": i}).json()["hit_trap"]
    )
    body = {
        "skill_id": "sign-dist",
        "action": "hint",
        "level": 1,
        "hint_level": 1,
        "time": "20:00",
        "variant": {"answer_token": item["answer_token"], "picked": trap},
    }
    r = client.post("/api/v1/coach/reply", json=body)
    assert r.status_code == 200, r.text
    assert "負號只給第一項" in r.json()["messages"][0]["text"]
    bad = client.post("/api/v1/coach/reply", json={**body, "variant": {"answer_token": "nope.sig"}})
    assert bad.status_code == 422
    empty = client.post("/api/v1/coach/reply", json={**body, "variant": {}})
    assert empty.status_code == 422
