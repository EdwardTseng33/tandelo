"""營地來信（0.5）：文案、事件自動寄信、手動寄信、家長回覆、家長連結、LINE 推送（不碰網路）與 webhook 簽章。"""

import base64
import hashlib
import hmac
import json

import pytest
from app.services import camp
from app.services import content as C
from fastapi.testclient import TestClient

from tests.conftest import TEST_ADMIN_TOKEN, create_student, make_test_app

SQ = C.monsters()["sq-cross"]
LINE_UID = "Udeadbeef0000000000000000000000ab"


# ——— 文案（純函式）———
def test_compose_capture_has_name_title_and_tonight_question():
    body = camp.compose("小睿", "capture", SQ, chasing=["負號幽靈"], guide="林老師", guide_day="四")
    assert body["title"] == "營地來信"
    assert body["lines"][0] == "小睿今晚收服了一隻怪：漏項獸（完全平方要有中間那一項）。不給提示也會。"
    assert body["lines"][1] == "還在追：負號幽靈，林老師週四處理。"
    assert body["ask"].startswith("今晚可以問他")
    assert [a["id"] for a in body["actions"]] == ["witnessed", "later"]
    text = camp.to_text(body)
    assert text.splitlines()[0] == "營地來信" and "漏項獸" in text and "今晚可以問他" in text


def test_compose_wake_explain_dungeon_week():
    assert "叫醒了睡著的夥伴：漏項獸" in camp.compose("小睿", "wake", SQ)["lines"][0]
    assert camp.compose("小睿", "explain", SQ)["lines"][0] == "小睿今晚把「完全平方要有中間那一項」講給隊友聽，講對了。"
    d = camp.compose("小睿", "dungeon", extra={"rate": 0.8, "stars": 2, "next_route_name": "丘陵線"})
    assert d["lines"] == ["小睿的小隊這週副本過關了：解題率 80%，兩星。下一個副本走丘陵線。"]
    assert d["actions"] == [] and d["ask"] is None
    w = camp.compose("小睿", "week", extra={"captured": ["漏項獸", "雙面根"], "ask_monster": SQ})
    assert w["title"] == "小睿這週學會的" and w["lines"][0] == "小睿這週學會的：收服 2 隻（漏項獸、雙面根）。" and w["ask"]
    assert "還在追" in camp.compose("小睿", "week", extra={})["lines"][0]
    with pytest.raises(ValueError):
        camp.compose("小睿", "score")


def test_compose_never_mentions_scores_or_ranks():
    for kind in ("capture", "wake", "explain"):
        text = camp.to_text(camp.compose("小睿", kind, SQ, chasing=["負號幽靈"]))
        assert "分" not in text.replace("分鐘", "") and "名" not in text and "排名" not in text


def test_line_signature_and_webhook_parse():
    body = b'{"events":[]}'
    sig = base64.b64encode(hmac.new(b"secret", body, hashlib.sha256).digest()).decode()
    assert camp.verify_signature("secret", body, sig)
    assert not camp.verify_signature("secret", body, "nope") and not camp.verify_signature("", body, sig)
    parsed = camp.parse_webhook(
        {
            "events": [
                {"type": "postback", "source": {"userId": "U1"}, "postback": {"data": "reply=witnessed&letter=7"}},
                {"type": "message", "source": {"userId": "U2"}, "message": {"type": "text", "text": "晚點問他"}},
                {"type": "message", "source": {"userId": "U3"}, "message": {"type": "text", "text": "哈囉"}},
                {"type": "follow", "source": {"userId": "U4"}},
            ]
        }
    )
    assert parsed == [{"user_id": "U1", "action": "witnessed", "letter_id": 7}, {"user_id": "U2", "action": "later", "letter_id": None}]


# ——— API 流程 ———
def _student_with_hit(client):
    sid = create_student(client)["id"]
    for ev in ("diagnosed_stuck", "explained_ok"):
        assert client.post(f"/api/v1/students/{sid}/shadows/sq-cross/events", json={"event": ev}).status_code == 200
    return sid


def test_learning_events_send_letters_but_stuck_does_not(client):
    sid = create_student(client)["id"]
    assert client.get(f"/api/v1/students/{sid}/camp-letters").json() == []
    client.post(f"/api/v1/students/{sid}/shadows/sq-cross/events", json={"event": "diagnosed_stuck"})
    assert client.get(f"/api/v1/students/{sid}/camp-letters").json() == []  # 卡住不寄
    client.post(f"/api/v1/students/{sid}/shadows/sq-cross/events", json={"event": "explained_ok"})
    client.post(f"/api/v1/students/{sid}/shadows/sq-cross/events", json={"event": "retest_passed"})
    letters = client.get(f"/api/v1/students/{sid}/camp-letters").json()
    assert [x["kind"] for x in letters] == ["capture", "explain"]  # 新的在前
    cap = letters[0]
    assert cap["status"] == "sent" and cap["channel"] == "stub" and cap["monster_id"] == "sq-cross"
    assert "小睿今晚收服了一隻怪：漏項獸" in cap["text"] and cap["ask"].startswith("今晚可以問他")
    assert cap["sent_at"] and cap["replied_at"] is None


def test_manual_letters_and_week_summary(client):
    sid = _student_with_hit(client)
    r = client.post(f"/api/v1/students/{sid}/camp-letters", json={"kind": "capture", "monster_id": "sq-cross"})
    assert r.status_code == 201 and r.json()["kind"] == "capture"
    assert client.post(f"/api/v1/students/{sid}/camp-letters", json={"kind": "capture", "monster_id": "nope"}).status_code == 404
    assert client.post(f"/api/v1/students/{sid}/camp-letters", json={"kind": "capture"}).status_code == 404
    assert client.post(f"/api/v1/students/{sid}/camp-letters", json={"kind": "score"}).status_code == 422
    d = client.post(f"/api/v1/students/{sid}/camp-letters", json={"kind": "dungeon", "extra": {"rate": 0.8, "stars": 2, "next_route_name": "丘陵線"}}).json()
    assert d["lines"][0].endswith("兩星。下一個副本走丘陵線。") and d["actions"] == []
    w = client.post(f"/api/v1/students/{sid}/camp-letters", json={"kind": "week"}).json()
    assert "還在追" in w["lines"][0]  # 只打中、還沒收服
    client.post(f"/api/v1/students/{sid}/shadows/sq-cross/events", json={"event": "retest_passed"})
    w = client.post(f"/api/v1/students/{sid}/camp-letters", json={"kind": "week"}).json()
    assert w["lines"][0] == "小睿這週學會的：收服 1 隻（漏項獸）。" and w["ask"]
    assert client.get("/api/v1/students/9999/camp-letters").status_code == 404


def test_reply_marks_letter(client):
    sid = _student_with_hit(client)
    lid = client.get(f"/api/v1/students/{sid}/camp-letters").json()[0]["id"]
    r = client.post(f"/api/v1/camp-letters/{lid}/reply", json={"action": "witnessed"})
    assert r.status_code == 200 and r.json()["status"] == "witnessed" and r.json()["replied_at"]
    assert client.post(f"/api/v1/camp-letters/{lid}/reply", json={"action": "later"}).json()["status"] == "later"
    assert client.post(f"/api/v1/camp-letters/{lid}/reply", json={"action": "ignore"}).status_code == 422
    assert client.post("/api/v1/camp-letters/9999/reply", json={"action": "witnessed"}).status_code == 404


def test_parent_link_needs_admin_and_hides_line_id(client):
    sid = create_student(client)["id"]
    assert client.get(f"/api/v1/students/{sid}/parent-link").json() == {"student_id": sid, "linked": False, "created_at": None}
    assert client.post(f"/api/v1/students/{sid}/parent-link", json={"line_user_id": LINE_UID}).status_code == 401
    r = client.post(f"/api/v1/students/{sid}/parent-link", json={"line_user_id": LINE_UID}, headers={"X-Admin-Token": TEST_ADMIN_TOKEN})
    assert r.status_code == 200 and r.json()["linked"] and LINE_UID not in r.text
    assert client.get(f"/api/v1/students/{sid}/parent-link").json()["linked"]
    # 同一個 LINE 帳號不能綁第二位孩子
    other = create_student(client, nickname="小禾")["id"]
    assert client.post(f"/api/v1/students/{other}/parent-link", json={"line_user_id": LINE_UID}, headers={"X-Admin-Token": TEST_ADMIN_TOKEN}).status_code == 409
    assert client.post(f"/api/v1/students/{sid}/parent-link", json={"line_user_id": "bad id!"}, headers={"X-Admin-Token": TEST_ADMIN_TOKEN}).status_code == 422


def test_line_push_is_called_with_quick_replies(monkeypatch):
    sent = []
    monkeypatch.setattr(camp, "PUSH", lambda token, to, letter: sent.append((token, to, camp.line_payload(to, letter))))
    app = make_test_app(line_channel_access_token="test-line-token-not-secret")
    with TestClient(app) as client:
        sid = _student_with_hit(client)  # 還沒綁家長：stub
        assert client.get(f"/api/v1/students/{sid}/camp-letters").json()[0]["channel"] == "stub"
        client.post(f"/api/v1/students/{sid}/parent-link", json={"line_user_id": LINE_UID}, headers={"X-Admin-Token": TEST_ADMIN_TOKEN})
        r = client.post(f"/api/v1/students/{sid}/camp-letters", json={"kind": "capture", "monster_id": "sq-cross"}).json()
        assert r["channel"] == "line" and r["status"] == "sent" and r["error"] == ""
        token, to, payload = sent[-1]
        assert token == "test-line-token-not-secret" and to == LINE_UID
        msg = payload["messages"][0]
        assert msg["text"] == r["text"] and [i["action"]["label"] for i in msg["quickReply"]["items"]] == ["我見證了", "晚點問他"]
        assert msg["quickReply"]["items"][0]["action"]["data"] == f"reply=witnessed&letter={r['id']}"
        # 推送失敗：記 failed 與原因，事件本身照常成功
        monkeypatch.setattr(camp, "PUSH", lambda *_: (_ for _ in ()).throw(RuntimeError("LINE 回 429")))
        ev = client.post(f"/api/v1/students/{sid}/shadows/sq-cross/events", json={"event": "retest_passed"})
        assert ev.status_code == 200
        last = client.get(f"/api/v1/students/{sid}/camp-letters").json()[0]
        assert last["status"] == "failed" and last["error"] == "LINE 回 429" and last["channel"] == "line"
        assert "test-line-token" not in json.dumps(last, ensure_ascii=False)


def _signed(secret: str, payload: dict):
    raw = json.dumps(payload).encode()
    sig = base64.b64encode(hmac.new(secret.encode(), raw, hashlib.sha256).digest()).decode()
    return raw, {"X-Line-Signature": sig, "Content-Type": "application/json"}


def test_webhook_requires_secret_and_signature(client):
    assert client.post("/api/v1/line/webhook", content=b"{}").status_code == 503


def test_webhook_marks_witnessed_for_linked_parent():
    app = make_test_app(line_channel_secret="test-line-secret-not-secret")
    with TestClient(app) as client:
        sid = _student_with_hit(client)
        lid = client.get(f"/api/v1/students/{sid}/camp-letters").json()[0]["id"]
        raw, headers = _signed("wrong", {"events": []})
        assert client.post("/api/v1/line/webhook", content=raw, headers=headers).status_code == 403
        # 沒綁的家長：ignored
        raw, headers = _signed(
            "test-line-secret-not-secret",
            {"events": [{"type": "postback", "source": {"userId": LINE_UID}, "postback": {"data": f"reply=witnessed&letter={lid}"}}]},
        )
        assert client.post("/api/v1/line/webhook", content=raw, headers=headers).json()["ignored"] == 1
        client.post(f"/api/v1/students/{sid}/parent-link", json={"line_user_id": LINE_UID}, headers={"X-Admin-Token": TEST_ADMIN_TOKEN})
        r = client.post("/api/v1/line/webhook", content=raw, headers=headers)
        assert r.status_code == 200 and r.json()["handled"] == 1
        assert client.get(f"/api/v1/students/{sid}/camp-letters").json()[0]["status"] == "witnessed"
        # 文字「晚點問他」：套到最新一封
        raw, headers = _signed(
            "test-line-secret-not-secret", {"events": [{"type": "message", "source": {"userId": LINE_UID}, "message": {"type": "text", "text": "晚點問他"}}]}
        )
        assert client.post("/api/v1/line/webhook", content=raw, headers=headers).json()["handled"] == 1
        assert client.get(f"/api/v1/students/{sid}/camp-letters").json()[0]["status"] == "later"
        # 別人家的信：指到不屬於自己孩子的 letter id 就退回最新一封，不會改到別人的
        other = create_student(client, nickname="小禾")["id"]
        client.post(f"/api/v1/students/{other}/shadows/sq-cross/events", json={"event": "diagnosed_stuck"})
        client.post(f"/api/v1/students/{other}/shadows/sq-cross/events", json={"event": "explained_ok"})
        olid = client.get(f"/api/v1/students/{other}/camp-letters").json()[0]["id"]
        raw, headers = _signed(
            "test-line-secret-not-secret",
            {"events": [{"type": "postback", "source": {"userId": LINE_UID}, "postback": {"data": f"reply=witnessed&letter={olid}"}}]},
        )
        client.post("/api/v1/line/webhook", content=raw, headers=headers)
        assert client.get(f"/api/v1/students/{other}/camp-letters").json()[0]["status"] == "sent"
        assert client.get(f"/api/v1/students/{sid}/camp-letters").json()[0]["status"] == "witnessed"
