"""營地來信（0.5）：把「學會的事件」變成一則給家長的 LINE 訊息。

前半是純文案（不開伺服器可測），後半是送件與 LINE 介面。
原則：只說孩子學會了什麼、還在追什麼、今晚可以問他哪一句；不放分數、不放排名、不放別人家的孩子。
沒有 LINE 設定時走 stub：信照樣存進 camp_letters，Demo 的營地畫面直接讀這張表。
"""

import base64
import hashlib
import hmac
import json
import urllib.request
from typing import Any, Callable, Dict, List, Optional, Sequence
from urllib.parse import parse_qs

from sqlalchemy.orm import Session as DBSession

from .. import models
from ..models import json_get, json_set, utcnow
from . import content as C

KINDS = ("capture", "wake", "explain", "dungeon", "week")
# 夥伴事件 → 來信種類（diagnosed_stuck 與 wrong_again 不寄信：不把「卡住」推給家長）
EVENT_KIND = {"retest_passed": "capture", "woken": "wake", "explained_ok": "explain"}
ACTIONS = [{"id": "witnessed", "label": "我見證了"}, {"id": "later", "label": "晚點問他"}]
REPLY_TEXT = {"我見證了": "witnessed", "已見證": "witnessed", "晚點問他": "later"}
STARS = {0: "零", 1: "一", 2: "兩", 3: "三"}
LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push"
WEEKDAYS = "一二三四五六日"


# ——— 文案（純函式）———
def compose(
    nickname: str,
    kind: str,
    monster: Optional[Dict[str, Any]] = None,
    chasing: Sequence[str] = (),
    guide: Optional[str] = None,
    guide_day: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """回 {title, lines, ask, actions}。kind：capture／wake／explain／dungeon／week。"""
    if kind not in KINDS:
        raise ValueError(f"沒有這種來信：{kind}")
    extra = extra or {}
    m = monster or {}
    name, title = m.get("name", ""), m.get("title", "")
    lines: List[str] = []
    if kind == "capture":
        lines.append(f"{nickname}今晚收服了一隻怪：{name}（{title}）。不給提示也會。")
    elif kind == "wake":
        lines.append(f"{nickname}今晚叫醒了睡著的夥伴：{name}（{title}）。上週錯過一次，今天自己站回來了。")
    elif kind == "explain":
        lines.append(f"{nickname}今晚把「{title}」講給隊友聽，講對了。")
    elif kind == "dungeon":
        rate = float(extra.get("rate", 0) or 0)
        stars = int(extra.get("stars", 0) or 0)
        head = f"{nickname}的小隊這週副本{'過關了' if stars else '沒過關'}：解題率 {round(rate * 100)}%"
        head += f"，{STARS.get(stars, str(stars))}星。" if stars else "。"
        nxt = extra.get("next_route_name")
        if nxt:
            head += f"下一個副本走{nxt}。"
        lines.append(head)
    elif kind == "week":
        captured = list(extra.get("captured", []))
        if captured:
            lines.append(f"{nickname}這週學會的：收服 {len(captured)} 隻（{'、'.join(captured)}）。")
        else:
            lines.append(f"{nickname}這週還在追，沒有新收服；每一次講給隊友聽都算。")
    if chasing and kind != "dungeon":
        tail = f"，{guide}週{guide_day}處理。" if guide and guide_day else "。"
        lines.append(f"還在追：{'、'.join(chasing)}{tail}")

    ask = _ask_for(m) if kind in ("capture", "wake", "explain") else None
    if kind == "week" and extra.get("ask_monster"):
        ask = _ask_for(extra["ask_monster"])
    body = {
        "title": f"{nickname}這週學會的" if kind == "week" else "營地來信",
        "lines": lines,
        "ask": ask,
        "actions": ACTIONS if kind != "dungeon" else [],
    }
    return body


def _ask_for(m: Dict[str, Any]) -> Optional[str]:
    """今晚可以問他的那一句：題庫有就用題庫的，沒有就請他把弱點那句講一次。"""
    if not m:
        return None
    tonight = C.skills().get(m.get("skill_id", ""), {}).get("tonight")
    if tonight:
        return tonight
    if m.get("weakness"):
        return f"今晚可以請他講一次：「{m['weakness']}」"
    return None


def to_text(body: Dict[str, Any]) -> str:
    parts = [body.get("title", "營地來信")] + list(body.get("lines", []))
    if body.get("ask"):
        parts.append(body["ask"])
    return "\n".join(parts)


# ——— LINE 介面（純函式）———
def verify_signature(channel_secret: str, raw_body: bytes, signature: str) -> bool:
    """LINE webhook 簽章：HMAC-SHA256(channel secret, body) 的 base64。"""
    if not channel_secret or not signature:
        return False
    digest = hmac.new(channel_secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    return hmac.compare_digest(base64.b64encode(digest).decode("ascii"), signature)


def parse_webhook(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """把 LINE 事件變成 [{user_id, action, letter_id}]；看不懂的事件略過。"""
    out: List[Dict[str, Any]] = []
    for ev in payload.get("events", []) or []:
        uid = (ev.get("source") or {}).get("userId")
        if not uid:
            continue
        if ev.get("type") == "postback":
            q = parse_qs((ev.get("postback") or {}).get("data", ""))
            action = (q.get("reply") or [""])[0]
            letter = (q.get("letter") or [""])[0]
            if action in ("witnessed", "later"):
                out.append({"user_id": uid, "action": action, "letter_id": int(letter) if letter.isdigit() else None})
        elif ev.get("type") == "message":
            text = ((ev.get("message") or {}).get("text") or "").strip()
            if text in REPLY_TEXT:
                out.append({"user_id": uid, "action": REPLY_TEXT[text], "letter_id": None})
    return out


def line_payload(to: str, letter: models.CampLetter) -> Dict[str, Any]:
    body = json_get(letter.body_json, {})
    msg: Dict[str, Any] = {"type": "text", "text": letter.text}
    actions = body.get("actions") or []
    if actions:
        msg["quickReply"] = {
            "items": [
                {
                    "type": "action",
                    "action": {"type": "postback", "label": a["label"], "displayText": a["label"], "data": f"reply={a['id']}&letter={letter.id}"},
                }
                for a in actions
            ]
        }
    return {"to": to, "messages": [msg]}


def push_line(token: str, to: str, letter: models.CampLetter) -> None:
    """真的送到 LINE（Messaging API push）。金鑰只從設定來；逾時 5 秒；非 2xx 丟例外。"""
    data = json.dumps(line_payload(to, letter), ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(LINE_PUSH_URL, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=5) as resp:  # noqa: S310 固定 https 網址
        if resp.status // 100 != 2:
            raise RuntimeError(f"LINE 回 {resp.status}")


PUSH: Callable[[str, str, models.CampLetter], None] = push_line  # 測試時換掉，不碰網路


# ——— 送件（接資料庫）———
def context(db: DBSession, student: models.Student) -> Dict[str, Any]:
    """還在追哪些怪、嚮導是誰、下一堂在週幾。"""
    monsters = C.monsters()
    shadows = [sh for sh in db.query(models.Shadow).filter_by(student_id=student.id).all() if sh.monster_id in monsters]
    chasing = [monsters[sh.monster_id]["name"] for sh in shadows if sh.state in ("near", "hit")]
    captured = [monsters[sh.monster_id] for sh in shadows if sh.state == "captured"]
    guide = guide_day = None
    today = utcnow().date()
    for mem in student.memberships:
        team = mem.team
        if team.status != "confirmed":
            continue
        if team.teacher:
            guide = team.teacher.nickname
        upcoming = [s for s in team.sessions if s.date >= today and s.status == "scheduled"]
        if upcoming:
            guide_day = WEEKDAYS[upcoming[0].date.weekday()]
        break
    return {"chasing": chasing, "captured": captured, "guide": guide, "guide_day": guide_day}


def enqueue(
    db: DBSession, student: models.Student, kind: str, monster_id: Optional[str] = None, extra: Optional[Dict[str, Any]] = None, settings: Any = None
) -> models.CampLetter:
    """寫一封信並送出（有 LINE 設定與家長連結才真的推，否則 stub）。"""
    monster = C.monsters().get(monster_id or "")
    ctx = context(db, student)
    extra = dict(extra or {})
    if kind == "week":
        extra.setdefault("captured", [m["name"] for m in ctx["captured"]])
        if ctx["captured"]:
            extra.setdefault("ask_monster", ctx["captured"][0])
    body = compose(student.nickname, kind, monster, ctx["chasing"], ctx["guide"], ctx["guide_day"], extra)
    letter = models.CampLetter(
        student_id=student.id, kind=kind, monster_id=monster["id"] if monster else None, body_json=json_set(body), text=to_text(body), status="queued"
    )
    db.add(letter)
    db.flush()
    deliver(db, letter, settings)
    return letter


def deliver(db: DBSession, letter: models.CampLetter, settings: Any = None) -> models.CampLetter:
    token = getattr(settings, "line_channel_access_token", "") if settings else ""
    link = db.query(models.ParentLink).filter_by(student_id=letter.student_id).first()
    if token and link:
        try:
            PUSH(token, link.line_user_id, letter)
            letter.status, letter.channel, letter.sent_at, letter.error = "sent", "line", utcnow(), ""
        except Exception as e:  # noqa: BLE001 送不出去只記原因，不讓學會事件失敗
            letter.status, letter.channel, letter.error = "failed", "line", str(e)[:200]
    else:
        letter.status, letter.channel, letter.sent_at = "sent", "stub", utcnow()
    db.commit()
    db.refresh(letter)
    return letter


def apply_reply(db: DBSession, letter: models.CampLetter, action: str) -> models.CampLetter:
    if action not in ("witnessed", "later"):
        raise ValueError("只能回「我見證了」或「晚點問他」。")
    letter.status = action
    letter.replied_at = utcnow()
    db.commit()
    db.refresh(letter)
    return letter
