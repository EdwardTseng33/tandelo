# Tandelo（概念驗證）

對準段考的 8 週小隊課：孩子卡在哪，就從哪裡開始。

這是一個**概念驗證（POC）**：品牌網站、老師招募頁、可操作的 App 原型（學生、家長 LINE、老師三條流程），以及一個小的後端 API。所有示範資料都是虛構的；沒有後端時，資料只留在使用者自己的裝置。

- 網站（Pages）：<https://edwardtseng33.github.io/tandelo/>（離線示範模式，不連後端）
- 架構說明：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 架構

```
tandelo/
├─ frontend/            純靜態：index.html、teachers.html、plan.html、adventure.html、coach.html、segment.html、app/、assets/
├─ docs/research/       調研報告：教育遊戲化的年齡與性別偏好、核心用戶族群選擇
│   ├─ config.js        window.TANDELO_API_BASE（Pages 留空＝離線；Docker 由 nginx 注入 '/api'）
│   ├─ app/js/api.js    後端連線包裝：isOnline()、request()、syncState()
│   ├─ nginx.conf       靜態伺服＋gzip＋快取標頭＋ /api 反向代理
│   └─ Dockerfile       nginx:alpine，非 root，healthcheck
├─ backend/             Python 3.12 + FastAPI + SQLAlchemy 2 + SQLite（DATABASE_URL 可換 Postgres）
│   ├─ app/             main.py、api/、services/、models.py、schemas.py、core/、data/content.json
│   ├─ tests/           pytest（26 個）
│   └─ Dockerfile       多階段、非 root、healthcheck
├─ docker-compose.yml   frontend:8080、backend:8000、可選 postgres profile
├─ scripts/smoke.sh     對 compose 起來的服務跑一條完整流程
├─ .github/workflows/   ci.yml、deploy-pages.yml、docker-publish.yml、deploy-backend.yml.example
└─ Makefile             dev、test、lint、build、up、down、logs、seed、smoke
```

```
瀏覽器 ──► nginx:8080 ──(靜態)──► frontend/
              │
              └──(/api/)──► FastAPI:8000 ──► SQLite（./data）或 Postgres
```

前端永遠先存 localStorage；有設定後端才「多同步一份」，失敗不影響畫面。狀態列會顯示「已同步」或「離線示範」。

## 本機開發

```bash
make venv          # 建 backend/.venv 並安裝相依
make seed          # 灌種子資料（虛構隊友、老師）
make dev           # 後端 http://localhost:8000/docs ＋ 前端 http://localhost:8080
make test          # pytest
make lint          # ruff、node --check、禁字檢查
```

前端本機預設是離線示範模式。要讓本機前端連本機後端，把 `frontend/config.js` 暫時改成 `window.TANDELO_API_BASE = 'http://localhost:8000/api';`（後端 `CORS_ORIGINS` 預設已放行 `http://localhost:8080`），但**不要把這個改動提交**。

後端只需要 Python 3.11+（測試在 3.9 也能跑）；`pip install -r backend/requirements-dev.txt` 或 `uv sync --extra dev`。

## Docker

```bash
cp .env.example .env    # 可選；不建也能跑
make build && make up   # 前端 http://localhost:8080、後端 http://localhost:8000/docs
make smoke              # 冒煙測試：/health ＋ 建學生→診斷→湊隊→接班→週報
make logs / make down
```

- SQLite 存在 `./data/tandelo.db`（volume `./data:/data`），啟動時自動灌種子（`SEED_ON_STARTUP=true`）。
- Postgres：`docker compose --profile postgres up -d`，`.env` 設 `DATABASE_URL=postgresql+psycopg://tandelo:<密碼>@postgres:5432/tandelo`，後端映像要加裝 `psycopg[binary]`（`pip install -e ".[postgres]"` 或改 requirements）。

## CI／CD

| 工作流 | 何時 | 做什麼 |
|---|---|---|
| `ci.yml` | PR、push main | 後端 ruff＋pytest（Python 3.12）；前端 HTML 標籤檢查＋`node --check`＋禁字檢查；兩個 Docker build 並起來打 health（不 push） |
| `deploy-pages.yml` | push main（frontend/ 有變） | `upload-pages-artifact` 把 `frontend/` 部署到 GitHub Pages（`actions/deploy-pages`） |
| `docker-publish.yml` | push main、tag `v*` | build 並推 `ghcr.io/edwardtseng33/tandelo-frontend`、`tandelo-backend`（標籤 `sha-…`、`latest`、版本號；用 `GITHUB_TOKEN`） |
| `deploy-backend.yml.example` | 不啟用 | Cloud Run／Fly.io 部署範本，需要哪些 secrets 寫在檔頭 |

工作流裡沒有任何 secret 值。**Pages 來源要改成「GitHub Actions」**（Settings → Pages → Source），舊的「從 main 根目錄發佈」會找不到檔案。

## 環境變數（後端）

| 變數 | 預設 | 說明 |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./data/tandelo.db`（Docker：`sqlite:////data/tandelo.db`） | SQLAlchemy 連線字串 |
| `CORS_ORIGINS` | `http://localhost:8080,http://127.0.0.1:8080` | 逗號分隔白名單；Pages 版要接後端就加 `https://edwardtseng33.github.io` |
| `ADMIN_TOKEN` | 空（關閉） | 讀招募表單的 `X-Admin-Token` |
| `RATE_LIMIT_PER_MINUTE` | 120 | 每 IP 每分鐘上限（記憶體） |
| `COACH_PROVIDER` | `rules` | 小陪回覆提供者；目前只有規則引擎，不接 LLM、不放金鑰 |
| `TIMEZONE` / `LIGHTS_OUT_START` / `LIGHTS_OUT_END` | `Asia/Taipei` / `22:30` / `06:00` | 關燈判斷 |
| `SEED_ON_STARTUP` | `false`（Docker：`true`） | 啟動時資料庫空就灌種子 |

範本：`.env.example`（compose 用）、`backend/.env.example`（直接跑後端用）。`.env*` 不進 git。

## API 一覽（前綴 `/api/v1`，文件在 `/docs`）

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/health` | 健康檢查（根路徑 `/health` 也有） |
| GET | `/content/skills`、`/content/diagnostic-questions` | 卡點地圖、診斷題（不含答案） |
| POST / GET | `/students`、`/students/{id}` | 建學生、查學生（含卡點、時段） |
| POST | `/students/{id}/diagnostics` | 送答題 → 回卡點 |
| PUT | `/students/{id}/availability` | 時段格（`d2-1900`） |
| POST | `/teams/match` | 依卡點＋時段湊隊（種子隊友） |
| GET | `/teams`、`/teams/{id}`、`/teams/{id}/sessions` | 小隊與課表 |
| POST | `/teams/{id}/join`、`/teams/{id}/accept` | 加入（上限 6）、老師接班（≥4 成班、3 改 1 對 3、≤2 不開） |
| POST | `/sessions/{id}/notes` | 老師課後 30 秒紀錄 |
| POST / GET | `/students/{id}/practices` | 練習紀錄（每日上限） |
| POST / GET | `/students/{id}/retests`、POST `/retests/{id}/complete` | 排再測（7–12 天）、完成（通過→已掌握） |
| GET | `/students/{id}/parent-report`、`/students/{id}/parent-reports` | 生成週報、歷史週報 |
| POST / GET | `/teacher-applications` | 招募表單；列表需 `X-Admin-Token` |
| GET | `/teachers`、`/teachers/{id}/earnings?tier=&teams=&size=` | 老師清單、收入試算（45／52／60%、保底 600） |
| POST | `/coach/reply`、`/coach/explain` | 小陪規則回覆（22:30–06:00 回「關燈中」）、說給我聽評分 |

## 說明

- 教室與老師端是平板／桌機優先：寬度 768px 以上是寬版（白板、隊友列、老師控制列，不套手機框）；手機開教室只會看到「請用 iPad 或電腦開教室」與複製連結。手機用在課與課之間的練習；家長只在 LINE。
- AI 教練「小陪」在 POC 中以規則引擎與預寫對話模擬，畫面標示「示範模式」；不接任何 AI 服務。
- 全站 `noindex`，不供搜尋引擎收錄。
- 授權：保留所有權利（POC 展示用）。

Tandelo 概念驗證（POC）· Edward Tseng · 2026
