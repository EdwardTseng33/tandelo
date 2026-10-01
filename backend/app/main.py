"""Tandelo POC 後端：FastAPI 進入點。

路徑前綴 /api/v1；OpenAPI 文件在 /docs。所有設定從環境變數讀（見 core/config.py）。
日誌只記路徑與狀態碼，不記請求內容，避免把姓名或聯絡方式寫進 log。
"""

import logging
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import coach, health, students, teachers, teams, world
from .core.config import Settings, get_settings
from .core.ratelimit import RateLimiter, RateLimitMiddleware
from .db import Base, make_engine, make_session_factory
from .services import coach as coach_svc

API_PREFIX = "/api/v1"
VERSION = "0.3.0"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)  # 不記每筆請求的細節


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=VERSION,
        description="對準段考的 8 週小隊課——概念驗證後端。所有示範資料都是虛構的。",
        docs_url="/docs",
        redoc_url=None,
        openapi_url="/openapi.json",
    )
    engine = make_engine(settings.database_url)
    Base.metadata.create_all(engine)
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = make_session_factory(engine)
    app.state.rate_limiter = RateLimiter(settings.rate_limit_per_minute)
    # 小陪：啟動時決定提供者；anthropic 但沒金鑰／沒 SDK 會在這裡退回規則引擎並記一行 log
    app.state.coach_metrics = coach_svc.CoachMetrics()
    app.state.coach_provider = coach_svc.get_provider(settings.coach_provider, settings.anthropic_api_key, settings.coach_model, app.state.coach_metrics)

    app.add_middleware(RateLimitMiddleware, limiter=app.state.rate_limiter)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Content-Type", "X-Admin-Token"],
    )

    for r in (health.router, students.router, teams.router, teachers.router, coach.router, world.router):
        app.include_router(r, prefix=API_PREFIX)

    @app.get("/health", include_in_schema=False)
    def root_health():
        return {"ok": True, "service": "tandelo-backend", "version": VERSION}

    if settings.seed_on_startup:
        from .seed import seed

        db = app.state.session_factory()
        try:
            seed(db)
        finally:
            db.close()
    return app


app = create_app()
