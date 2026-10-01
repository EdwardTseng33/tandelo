"""資料庫連線：預設 SQLite，DATABASE_URL 換成 postgresql+psycopg://… 即可改用 Postgres。"""

from pathlib import Path
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


def make_engine(database_url: str):
    """依連線字串建立 engine；SQLite 記憶體庫用 StaticPool 讓測試共用同一條連線。"""
    if database_url.startswith("sqlite"):
        if ":memory:" in database_url:
            return create_engine(database_url, connect_args={"check_same_thread": False}, poolclass=StaticPool)
        # 檔案型 SQLite：確保資料夾存在
        path = database_url.replace("sqlite:///", "", 1)
        if path and not path.startswith(":"):
            Path(path).expanduser().parent.mkdir(parents=True, exist_ok=True)
        return create_engine(database_url, connect_args={"check_same_thread": False})
    return create_engine(database_url, pool_pre_ping=True)


def make_session_factory(engine) -> sessionmaker:
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)


def session_scope(factory: sessionmaker) -> Iterator[Session]:
    db = factory()
    try:
        yield db
    finally:
        db.close()
