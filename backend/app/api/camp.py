"""營地來信（0.5）：家長端的 LINE 訊息。列信、手動寄信、家長回覆、家長連結、LINE webhook。

路由只做「取資料、呼叫 services/camp.py、轉成回應」。回應不帶 LINE userId。
"""

import json
from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session as DBSession

from .. import models, schemas
from ..core.config import Settings
from ..models import json_get, utcnow
from ..services import camp
from ..services import content as C
from .deps import get_db, get_settings_dep, require_admin

router = APIRouter(tags=["營地來信"])


def _student(db: DBSession, student_id: int) -> models.Student:
    s = db.get(models.Student, student_id)
    if not s:
        raise HTTPException(status_code=404, detail="找不到這位學生。")
    return s


def _letter(db: DBSession, letter_id: int) -> models.CampLetter:
    letter = db.get(models.CampLetter, letter_id)
    if not letter:
        raise HTTPException(status_code=404, detail="找不到這封信。")
    return letter


def _out(letter: models.CampLetter) -> schemas.CampLetterOut:
    body = json_get(letter.body_json, {})
    return schemas.CampLetterOut(
        id=letter.id,
        student_id=letter.student_id,
        kind=letter.kind,
        monster_id=letter.monster_id,
        title=body.get("title", "營地來信"),
        lines=body.get("lines", []),
        ask=body.get("ask"),
        answer=body.get("answer"),
        sender=body.get("sender", "Tandelo 營地"),
        actions=body.get("actions", []),
        text=letter.text,
        status=letter.status,
        channel=letter.channel,
        error=letter.error,
        created_at=letter.created_at,
        sent_at=letter.sent_at,
        replied_at=letter.replied_at,
    )


@router.get("/students/{student_id}/camp-letters", response_model=List[schemas.CampLetterOut])
def list_letters(student_id: int, db: DBSession = Depends(get_db)):
    s = _student(db, student_id)
    rows = db.query(models.CampLetter).filter_by(student_id=s.id).order_by(models.CampLetter.id.desc()).limit(20).all()
    return [_out(r) for r in rows]


@router.post("/students/{student_id}/camp-letters", response_model=schemas.CampLetterOut, status_code=201)
def send_letter(student_id: int, body: schemas.CampLetterIn, db: DBSession = Depends(get_db), settings: Settings = Depends(get_settings_dep)):
    s = _student(db, student_id)
    if body.kind in ("capture", "wake", "explain"):
        if not body.monster_id or body.monster_id not in C.monsters():
            raise HTTPException(status_code=404, detail="這種來信要指定一隻存在的怪。")
    return _out(camp.enqueue(db, s, body.kind, body.monster_id, body.extra, settings))


@router.post("/camp-letters/{letter_id}/reply", response_model=schemas.CampLetterOut)
def reply_letter(letter_id: int, body: schemas.CampReplyIn, db: DBSession = Depends(get_db)):
    return _out(camp.apply_reply(db, _letter(db, letter_id), body.action))


@router.get("/students/{student_id}/parent-link", response_model=schemas.ParentLinkOut)
def get_parent_link(student_id: int, db: DBSession = Depends(get_db)):
    s = _student(db, student_id)
    link = db.query(models.ParentLink).filter_by(student_id=s.id).first()
    return schemas.ParentLinkOut(student_id=s.id, linked=bool(link), created_at=link.created_at if link else None)


@router.post("/students/{student_id}/parent-link", response_model=schemas.ParentLinkOut, dependencies=[Depends(require_admin)])
def set_parent_link(student_id: int, body: schemas.ParentLinkIn, db: DBSession = Depends(get_db)):
    """把一位家長的 LINE userId 綁到孩子（POC 由營運用管理權杖綁；1.0 改 LINE Login）。同一個 userId 只能綁一位。"""
    s = _student(db, student_id)
    other = db.query(models.ParentLink).filter(models.ParentLink.line_user_id == body.line_user_id, models.ParentLink.student_id != s.id).first()
    if other:
        raise HTTPException(status_code=409, detail="這個 LINE 帳號已經綁到另一位孩子。")
    link = db.query(models.ParentLink).filter_by(student_id=s.id).first()
    if link:
        link.line_user_id = body.line_user_id
    else:
        link = models.ParentLink(student_id=s.id, line_user_id=body.line_user_id)
        db.add(link)
    db.commit()
    db.refresh(link)
    return schemas.ParentLinkOut(student_id=s.id, linked=True, created_at=link.created_at)


@router.post("/line/webhook", response_model=schemas.LineWebhookOut)
async def line_webhook(
    request: Request, x_line_signature: str = Header(default=""), db: DBSession = Depends(get_db), settings: Settings = Depends(get_settings_dep)
):
    """LINE 的回覆：postback（reply=witnessed&letter=ID）或文字「我見證了／晚點問他」。簽章不對回 403；認不出的事件算 ignored，仍回 200。"""
    if not settings.line_channel_secret:
        raise HTTPException(status_code=503, detail="LINE 未設定（沒有 LINE_CHANNEL_SECRET）。")
    raw = await request.body()
    if not camp.verify_signature(settings.line_channel_secret, raw, x_line_signature):
        raise HTTPException(status_code=403, detail="簽章不符。")
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except ValueError:
        raise HTTPException(status_code=400, detail="不是 JSON。") from None
    handled = ignored = 0
    for item in camp.parse_webhook(payload):
        link = db.query(models.ParentLink).filter_by(line_user_id=item["user_id"]).first()
        if not link:
            ignored += 1
            continue
        letter = None
        if item["letter_id"]:
            letter = db.get(models.CampLetter, item["letter_id"])
            if letter and letter.student_id != link.student_id:
                letter = None
        if not letter:
            letter = (
                db.query(models.CampLetter)
                .filter_by(student_id=link.student_id)
                .filter(models.CampLetter.status.in_(["sent", "witnessed", "later"]))
                .order_by(models.CampLetter.id.desc())
                .first()
            )
        if not letter:
            ignored += 1
            continue
        camp.apply_reply(db, letter, item["action"])
        handled += 1
    return schemas.LineWebhookOut(handled=handled, ignored=ignored, at=utcnow())
