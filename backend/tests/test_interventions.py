"""人工介入紀錄（0.3）：升級順序、分鐘加總、分層摘要、note 超長 422。前半是純規則（不開伺服器），後半是 API 流程。"""

import datetime as dt

import pytest
from app.services import interventions as I

W40 = dt.datetime(2026, 9, 29, 20, 0)  # 2026-W40（週二）
W41 = dt.datetime(2026, 10, 6, 20, 0)  # 2026-W41


def row(trigger, by, minutes=0.0, student_id=1, team_id=None, kind="nudge", at=W40):
    return {"student_id": student_id, "team_id": team_id, "by": by, "kind": kind, "trigger": trigger, "minutes": minutes, "created_at": at}


# ——— 升級順序 ———
def test_tables():
    assert I.BY == ("system", "patrol", "guide", "cs")
    assert I.LADDER == ("system", "patrol", "guide")
    assert I.KINDS == ("nudge", "explain", "comfort", "demo", "review", "parent_note")
    assert I.TRIGGERS == ("help_timeout", "three_wrong", "three_days_off", "expedition", "weekly", "parent_message", "manual")
    assert I.LAYERS == ("L0", "L1", "L2", "L3") and I.DEFAULT_LAYER == "L2" and I.NOTE_MAX == 200


def test_escalate_system_then_patrol_then_guide():
    assert I.escalate("help_timeout", []) == "system"  # 每個 trigger 先讓系統試一次
    assert I.escalate("help_timeout", [row("help_timeout", "system")]) == "patrol"
    assert I.escalate("help_timeout", [row("help_timeout", "system"), row("help_timeout", "patrol")]) == "guide"
    assert I.escalate("help_timeout", [row("help_timeout", "guide")]) == "guide"  # 嚮導是頂層
    assert I.escalate("help_timeout", [row("help_timeout", "patrol"), row("help_timeout", "system")]) == "guide"  # 看到過的最高層
    # 別的 trigger 不影響；cs 不在階梯上
    assert I.escalate("three_wrong", [row("help_timeout", "guide")]) == "system"
    assert I.escalate("parent_message", [row("parent_message", "cs")]) == "system"
    with pytest.raises(ValueError):
        I.escalate("login", [])


# ——— 分鐘加總 ———
def test_week_key_is_iso_week():
    assert I.week_key(W40) == "2026-W40" and I.week_key(W41) == "2026-W41"
    assert I.week_key(dt.datetime(2026, 1, 1)) == "2026-W01"


def test_summary_minutes_per_student_week_kind_trigger():
    rows = [
        row("help_timeout", "system", 0.5),
        row("help_timeout", "patrol", 3),
        row("three_wrong", "guide", 12.5, kind="explain"),
        row("weekly", "guide", 8, student_id=2, kind="review"),
        row("expedition", "guide", 20, student_id=None, team_id=1, kind="demo"),
        row("help_timeout", "patrol", 4, at=W41),
    ]
    s = I.summary(rows, "2026-W40")
    assert s["week"] == "2026-W40" and s["count"] == 5 and s["students"] == 2
    assert s["human_minutes"] == 43.5 and s["system_minutes"] == 0.5 and s["team_minutes"] == 20.0  # 人力分鐘不含系統
    assert s["per_student"] == {1: 15.5, 2: 8.0}
    assert s["per_student_week"] == {1: {"2026-W40": 15.5}, 2: {"2026-W40": 8.0}}
    assert s["per_kind"] == {"nudge": 3.0, "explain": 12.5, "comfort": 0.0, "demo": 20.0, "review": 8.0, "parent_note": 0.0}
    assert s["per_trigger"] == {"help_timeout": 2, "three_wrong": 1, "three_days_off": 0, "expedition": 1, "weekly": 1, "parent_message": 0, "manual": 0}
    assert s["per_by"] == {"system": 0.5, "patrol": 3.0, "guide": 40.5, "cs": 0.0}
    every = I.summary(rows)
    assert every["week"] is None and every["count"] == 6 and every["human_minutes"] == 47.5
    assert every["per_student_week"][1] == {"2026-W40": 15.5, "2026-W41": 4.0}
    empty = I.summary([], "2026-W40")
    assert empty["count"] == 0 and empty["human_minutes"] == 0.0 and empty["per_student"] == {}


# ——— API 流程 ———
def _team(client, name):
    teams = client.get("/api/v1/teams", params={"status": "confirmed"}).json()
    return next(t for t in teams if t["name"] == name)


def test_api_interventions_record_summary_and_layer(client):
    a, b = _team(client, "四葉小隊"), _team(client, "星期三小隊")
    assert a["layer"] == "L2" and b["layer"] == "L2"  # 預設 L2
    sid = a["members"][0]["student_id"]
    at = "2026-09-29T20:00:00"
    base = {"student_id": sid, "team_id": a["id"], "trigger": "help_timeout", "at": at}
    r = client.post("/api/v1/interventions", json={**base, "by": "system", "kind": "nudge", "minutes": 0.5, "note": "推了一句提示"})
    assert r.status_code == 201, r.text
    assert r.json()["next_level"] == "patrol" and r.json()["week"] == "2026-W40" and r.json()["note"] == "推了一句提示"
    r = client.post("/api/v1/interventions", json={**base, "by": "patrol", "kind": "explain", "minutes": 6})
    assert r.json()["next_level"] == "guide"
    r = client.post("/api/v1/interventions", json={**base, "by": "guide", "kind": "demo", "minutes": 15})
    assert r.json()["next_level"] == "guide"
    # 下一週同一個 trigger 重新從系統開始
    r = client.post("/api/v1/interventions", json={**base, "by": "system", "kind": "nudge", "minutes": 0.5, "at": "2026-10-06T20:00:00"})
    assert r.json()["next_level"] == "patrol" and r.json()["week"] == "2026-W41"
    # 小隊層級（沒有學生）的遠征介入；星期三小隊的紀錄不會混進四葉的摘要
    r = client.post("/api/v1/interventions", json={"team_id": a["id"], "by": "guide", "kind": "review", "trigger": "expedition", "minutes": 10, "at": at})
    assert r.status_code == 201 and r.json()["student_id"] is None and r.json()["next_level"] == "guide"  # 嚮導出手過就留在頂層
    sid_b = b["members"][0]["student_id"]
    r = client.post("/api/v1/interventions", json={"student_id": sid_b, "by": "patrol", "kind": "comfort", "trigger": "three_days_off", "minutes": 4, "at": at})
    assert r.status_code == 201
    # 小隊週摘要
    s = client.get(f"/api/v1/teams/{a['id']}/interventions/summary", params={"week": "2026-W40"}).json()
    assert s["scope"] == "team" and s["team_id"] == a["id"] and s["layer"] == "L2" and s["teams"] == [a["id"]] and s["week"] == "2026-W40"
    assert s["count"] == 4 and s["human_minutes"] == 31.0 and s["system_minutes"] == 0.5 and s["team_minutes"] == 10.0
    assert s["per_student"] == {str(sid): 21.0} and s["per_student_week"] == {str(sid): {"2026-W40": 21.0}}
    assert s["per_kind"]["explain"] == 6.0 and s["per_kind"]["demo"] == 15.0 and s["per_kind"]["review"] == 10.0 and s["per_kind"]["nudge"] == 0.0
    assert s["per_trigger"]["help_timeout"] == 3 and s["per_trigger"]["expedition"] == 1 and s["per_trigger"]["three_days_off"] == 0
    assert client.get(f"/api/v1/teams/{a['id']}/interventions/summary").json()["count"] == 5  # 不給週＝全部
    # 分層摘要：兩隊都在 L2；把星期三小隊改到 L1 後各自分開
    l2 = client.get("/api/v1/interventions/summary", params={"layer": "L2", "week": "2026-W40"}).json()
    assert l2["scope"] == "layer" and l2["layer"] == "L2" and set(l2["teams"]) >= {a["id"], b["id"]}
    assert l2["count"] == 5 and l2["human_minutes"] == 35.0 and l2["per_student"] == {str(sid): 21.0, str(sid_b): 4.0}
    put = client.put(f"/api/v1/teams/{b['id']}/layer", json={"layer": "L1"})
    assert put.status_code == 200 and put.json()["layer"] == "L1"
    assert client.get(f"/api/v1/teams/{b['id']}").json()["layer"] == "L1"
    l1 = client.get("/api/v1/interventions/summary", params={"layer": "L1", "week": "2026-W40"}).json()
    assert l1["teams"] == [b["id"]] and l1["count"] == 1 and l1["human_minutes"] == 4.0 and l1["per_kind"]["comfort"] == 4.0
    l2 = client.get("/api/v1/interventions/summary", params={"layer": "L2", "week": "2026-W40"}).json()
    assert b["id"] not in l2["teams"] and l2["count"] == 4 and l2["human_minutes"] == 31.0
    l0 = client.get("/api/v1/interventions/summary", params={"layer": "L0"}).json()
    assert l0["teams"] == [] and l0["count"] == 0
    # 參數錯
    assert client.get("/api/v1/interventions/summary", params={"layer": "L4"}).status_code == 422
    assert client.get("/api/v1/interventions/summary").status_code == 422
    assert client.get(f"/api/v1/teams/{a['id']}/interventions/summary", params={"week": "2026-40"}).status_code == 422
    assert client.get("/api/v1/teams/9999/interventions/summary").status_code == 404
    assert client.put(f"/api/v1/teams/{b['id']}/layer", json={"layer": "L9"}).status_code == 422
    assert client.put("/api/v1/teams/9999/layer", json={"layer": "L1"}).status_code == 404


def test_api_intervention_validation_note_too_long_422(client):
    base = {"by": "patrol", "kind": "nudge", "trigger": "manual", "minutes": 1}
    assert client.post("/api/v1/interventions", json={**base, "note": "好" * 201}).status_code == 422
    ok = client.post("/api/v1/interventions", json={**base, "note": "好" * 200})
    assert ok.status_code == 201 and len(ok.json()["note"]) == 200
    assert client.post("/api/v1/interventions", json={**base, "by": "boss"}).status_code == 422
    assert client.post("/api/v1/interventions", json={**base, "kind": "hug"}).status_code == 422
    assert client.post("/api/v1/interventions", json={**base, "trigger": "login"}).status_code == 422
    assert client.post("/api/v1/interventions", json={**base, "minutes": -1}).status_code == 422
    assert client.post("/api/v1/interventions", json={**base, "minutes": 601}).status_code == 422
    assert client.post("/api/v1/interventions", json={**base, "student_id": 9999}).status_code == 404
    assert client.post("/api/v1/interventions", json={**base, "team_id": 9999}).status_code == 404
