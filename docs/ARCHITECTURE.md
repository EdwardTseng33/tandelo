# Tandelo POC 架構

## 一句話

前端是純靜態網頁（可以離線示範），後端是一個小的 FastAPI 服務；前端「有後端就同步一份、沒有就只存本機」，兩邊各自能獨立跑。

## 前後端邊界

```
瀏覽器
 ├─ frontend/index.html、teachers.html、plan.html   品牌網站（不需要後端）
 └─ frontend/app/                                   App 原型（hash 路由，狀態存 localStorage）
       └─ app/js/api.js  ── 只有在 window.TANDELO_API_BASE 有值時才會發請求
                              │
                              ▼  /api/v1/…（同源，nginx 反向代理）或跨域（CORS 白名單）
                        backend/app/main.py  FastAPI
                              │
                              ▼
                        SQLite（預設 /data/tandelo.db）或 Postgres（改 DATABASE_URL）
```

- **前端是主，後端是鏡射。** App 的每一次存檔（`state.js` 的 `save()`）都先寫 localStorage，成功後才呼叫鉤子把狀態同步到後端；後端失敗完全不影響畫面。這是刻意的：POC 的 Pages 版沒有後端，也要能完整操作。
- **後端不回寫前端狀態。** 目前只做「建學生、送診斷、存時段、收招募表單」四件事的同步；湊隊、接班、週報等 API 是給後端測試、Swagger 文件與未來前端接線用。
- **判斷規則兩邊各有一份。** 判卡點、成班規則、再測日期、分潤保底、關燈時間，前端 `content.js`／`state.js`／`teachers.js` 與後端 `services/diagnosis.py`／`services/rules.py` 是同一套數字；題庫則由前端 `content.js` 匯出成 `backend/app/data/content.json`。改任一邊要同步另一邊（測試 `test_rules.py` 有鎖住關鍵數字）。

## 後端分層

```
backend/app/
  main.py            create_app()：設定、資料庫、CORS、rate limit、路由
  core/config.py     Settings（全部從環境變數）
  core/ratelimit.py  記憶體 rate limit middleware
  db.py              engine／session；SQLite 或 Postgres
  models.py          SQLAlchemy 2 模型
  schemas.py         Pydantic 輸入輸出
  api/               路由：health、students、teams、teachers、coach
  services/          純邏輯：content（題庫）、diagnosis（判卡點）、rules（規則）、teams（湊隊成班）、report（週報）、coach（小陪）
  seed.py            種子資料（虛構隊友、老師）
  data/content.json  題庫與卡點地圖
```

路由層只做「取資料、呼叫 service、轉成回應」；規則都在 `services/`，可以不開伺服器直接測。

## 資料模型

| 表 | 用途 | 重點欄位 |
|---|---|---|
| students | 學生（只存暱稱） | grade、exam_date、goal、daily_cap、is_seed |
| diagnostics | 初步診斷 | answers_json、stuck_json（卡點）、scores_json、all_clear |
| availability | 時段格 | slot_id（`d2-1900`＝週三 19:00） |
| teachers | 老師 | tier（novice／gold／diamond） |
| teams | 小隊 | slot_id、first_date、teacher_id、status（forming／confirmed／cancelled）、mode（squad／one_to_three）、min_size 4、max_size 6、focus_json |
| team_members | 小隊成員 | plan_id（4／8／8+1） |
| sessions | 小隊課 | week 1–8、date、topic、skill_id、segments_json（六段）、status |
| session_notes | 老師課後 30 秒紀錄 | text |
| practices | 練習紀錄 | kind（ask／explain／transfer／retest）、hints、explain_passed |
| retests | 再測 | due_date（7–12 天後）、status（scheduled／mastered／failed） |
| parent_reports | 家長週報 | body_json（由狀態生成後存一份） |
| teacher_applications | 招募表單 | name、contact（只有管理端點看得到）、subjects、slots、experience、status |

JSON 欄位用 Text 存字串，SQLite 與 Postgres 都不用特別處理；POC 資料量小，不做關聯表。

## 規則（後端與前端一致）

- **判卡點**：答錯選到帶標籤的選項 2 分、沒標籤 1 分、「不確定」1 分；≥2 分取前兩個，沒有就取 ≥1 分的第一個；全對從十字交乘開始。
- **成班**：≥4 成班、3 人改 1 對 3、≤2 不開；上限 6。老師按「接這一隊」才成班，成班時建 8 堂課（每週同一天）。
- **48 小時截止**：第一堂＝從現在起第一個「符合時段星期且距現在 ≥ 48 小時」的日子。
- **再測**：`min(12, max(7, 12 − 2×提示數))` 天後；到期前不能完成；通過＝已掌握。
- **每日上限**：每位學生每天 `daily_cap`（預設 3）件練習。
- **分潤**：學費 2990÷8 每人每堂 × 等級（45／52／60%），與保底 600 取高；月收入以 4.3 週計、取整到 10 元。
- **關燈**：22:30–06:00 小陪只回「關燈中」。

## 為什麼這樣選

- **SQLite 起步**：POC 單機、資料量小、零維運；`DATABASE_URL` 換成 `postgresql+psycopg://…` 就能上 Postgres（compose 有 `postgres` profile；後端映像要另外裝 `psycopg[binary]`，`pyproject.toml` 的 `postgres` extra 有列）。正式上雲（Cloud Run 這類無狀態平台）一定要換 Postgres，因為容器磁碟不持久。
- **FastAPI + SQLAlchemy 2**：型別清楚、OpenAPI 文件免費、同步模式就夠 POC 用。
- **小陪不接 LLM**：`COACH_PROVIDER=rules` 是規則引擎；`services/coach.py` 留了 `CoachProvider` 介面，要接模型時新增一個實作並從環境變數讀金鑰，程式碼裡永遠不放金鑰。
- **nginx 注入 `/config.js`**：同一份靜態檔在 Pages 是離線模式、在 Docker 是同源 `/api`，不用建置工具也不用改檔案。
- **rate limit 放記憶體**：單一副本夠用；多副本要換 Redis，middleware 的介面不變。

## 安全邊界（POC）

- CORS 白名單從環境變數讀；預設只放 localhost:8080。
- 招募表單的聯絡方式只在資料庫，列表需要 `X-Admin-Token`；沒設 `ADMIN_TOKEN` 就整個關掉（503）。
- 日誌只記路徑與狀態碼（uvicorn access log 關掉），不記請求內容。
- 沒有登入、沒有帳號：所有 id 都是可猜的整數。這是 POC 邊界，正式版要加身分驗證與資料授權。
