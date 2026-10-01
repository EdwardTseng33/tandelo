# Tandelo 後端（POC）

FastAPI + SQLAlchemy 2 + SQLite。詳細說明見上一層 `README.md` 與 `docs/ARCHITECTURE.md`。

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m app.seed
.venv/bin/uvicorn app.main:app --reload --port 8000
```
