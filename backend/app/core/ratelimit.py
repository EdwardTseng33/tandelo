"""簡單的記憶體 rate limit：每個來源 IP 每 60 秒 N 次；超過回 429。單機 POC 用，多副本時要換 Redis。"""

import threading
import time
from collections import deque
from typing import Deque, Dict

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

WINDOW_SECONDS = 60
EXEMPT_PATHS = ("/api/v1/health", "/health", "/docs", "/openapi.json", "/redoc")


class RateLimiter:
    def __init__(self, per_minute: int):
        self.per_minute = per_minute
        self._hits: Dict[str, Deque[float]] = {}
        self._lock = threading.Lock()

    def allow(self, key: str, now: float = None) -> bool:  # type: ignore[assignment]
        if self.per_minute <= 0:
            return True
        now = time.monotonic() if now is None else now
        with self._lock:
            q = self._hits.setdefault(key, deque())
            while q and now - q[0] > WINDOW_SECONDS:
                q.popleft()
            if len(q) >= self.per_minute:
                return False
            q.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limiter: RateLimiter):
        super().__init__(app)
        self.limiter = limiter

    async def dispatch(self, request: Request, call_next):
        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)
        client = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            client = forwarded.split(",")[0].strip()
        if not self.limiter.allow(client):
            return JSONResponse({"detail": "請求太頻繁，休息一分鐘再試。"}, status_code=429, headers={"Retry-After": "60"})
        return await call_next(request)
