# Tandelo 後端（POC）

FastAPI + SQLAlchemy 2 + SQLite。詳細說明見上一層 `README.md` 與 `docs/ARCHITECTURE.md`。

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m app.seed
.venv/bin/uvicorn app.main:app --reload --port 8000
```

要讓小陪接模型（`COACH_PROVIDER=anthropic`）：`.venv/bin/pip install -e '.[llm]'`，並把 `ANTHROPIC_API_KEY` 放在環境變數或 `.env`（絕不進 git）。沒金鑰或沒裝 SDK 會自動退回規則引擎。
