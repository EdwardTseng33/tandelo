"""共用相依：資料庫連線、設定、管理權杖。"""

import secrets
from typing import Iterator

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session as DBSession

from ..core.config import Settings


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_db(request: Request) -> Iterator[DBSession]:
    db = request.app.state.session_factory()
    try:
        yield db
    finally:
        db.close()


def require_admin(x_admin_token: str = Header(default=""), settings: Settings = Depends(get_settings_dep)) -> None:
    """X-Admin-Token 必須等於環境變數 ADMIN_TOKEN；沒設定就整個關掉。"""
    if not settings.admin_token:
        raise HTTPException(status_code=503, detail="管理端點未啟用（沒有設定 ADMIN_TOKEN）。")
    if not x_admin_token or not secrets.compare_digest(x_admin_token, settings.admin_token):
        raise HTTPException(status_code=401, detail="需要有效的 X-Admin-Token。")
