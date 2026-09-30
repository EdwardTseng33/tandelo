"""健康檢查與題庫（唯讀）。"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session as DBSession

from ..services import content as C
from .deps import get_db

router = APIRouter(tags=["系統"])


@router.get("/health")
def health(request: Request, db: DBSession = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"ok": True, "service": "tandelo-backend", "version": request.app.version, "env": request.app.state.settings.app_env}


@router.get("/content/skills")
def list_skills():
    """卡點地圖（不含題目答案的細節，給前端顯示標題用）。"""
    return [{"id": k, "chapter": v["chapter"], "title": v["title"], "short": v["short"], "why": v["why"]} for k, v in C.skills().items()]


@router.get("/content/diagnostic-questions")
def diagnostic_questions():
    """診斷題（不回傳哪一個是正解）。"""
    return [{"id": q["id"], "q": q["q"], "opts": [o["t"] for o in q["opts"]]} for q in C.diag_questions()]
