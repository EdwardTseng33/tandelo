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

## 冒險世界（0.2）

把遊戲語言蓋在既有機制上：一科一片大陸、一章一區、一個卡點一隻怪、一區一座燈塔。資料在 `backend/app/data/world.json`（怪與地區名稱為提案，全部虛構；數學八隻怪的 id 沿用 `content.json` 的卡點 id），規則全在 `services/world.py`（純函式），路由在 `api/world.py`（tags＝世界）。

```
backend/app/
  data/world.json      四片大陸、十五區、每區一座燈塔、17 隻怪的傳說卡（出身／騙術／口頭禪／弱點／被識破時）、路線、聯賽區
  services/world.py    夥伴狀態機、戰績、副本解題率、路線、缺席、鏡像賽、出題戰六分制、配對與幽靈隊、投票、公會解鎖、徽章、燈塔、守塔、鄰近榜、關燈
  api/world.py         /world/map、夥伴事件、戰績、副本（開門／作答／缺席／結算）、對戰、燈塔與守塔、榜
```

新增的表（JSON 欄位一樣用 Text 存字串）：

| 表 | 用途 | 重點欄位 |
|---|---|---|
| shadows | 一位學生對一隻怪的狀態 | monster_id、state（fog／near／hit／captured／asleep）、captured_at、woke_at |
| record_events | 戰績事件 | student_id（個人）或 team_id（副本過關全隊一份）、kind、points、region_id（點燈與守塔用） |
| dungeons | 副本，一隊一週一個 | week、route、subject、region_id、status（open／settled／retreat）、rate、stars、answers_json、absences_json |
| matches | 小隊對戰 | kind（mirror／duel）、team_b_id 空＝幽靈隊、week、result_json |
| guilds | 公會＝一位嚮導名下所有小隊 | teacher_id、league（只到 north／central／south／east） |
| tower_keepers | 守塔名冊 | league、region_id、route、team_id、month、records（並列各一列，永久保留） |

`teams` 多了 `name`（隊名，榜與守塔名冊用）。種子多了兩支已成班的虛構小隊（四葉小隊、星期三小隊，隊員是新的虛構人物，不佔用可湊隊的示範隊友）、兩個北區公會、幾筆夥伴與戰績、各一個已結算的一星副本。

規則（數字由 `tests/test_world.py` 鎖住）：

- **夥伴狀態機**：`fog →(diagnosed_stuck) near →(explained_ok) hit →(retest_passed) captured →(wrong_again) asleep →(woken) captured`；其餘轉移丟 ValueError（API 回 409）。睡著不扣分、不消失。
- **戰績**：收服 10、叫醒 5、講解 3、副本一到三星 5／8／12（全隊一份）。不從登入、練習量、連續天數、付費、儲值、對戰勝負來（傳進去一律 0 分）。一人一天最多 3 張會計分的任務卡（沿用學生的 `daily_cap`），超過回 409。
- **副本解題率**：每人配額巡邏 3 題＋接力 1 棒。分母＝(未申報缺席人數 × 4) − 被跳過的接力棒數；分子＝巡邏與接力答對題數（求助過照算 1 分，每人最多算到配額）；伏擊層不計。<60% 撤退（24 小時後換題重打巡邏與接力，伏擊不重打）、≥60% 一星、≥75% 兩星且下一個副本往上一條路線、≥90% 三星但要未申報缺席者全員出手，否則降為兩星。鎖住的例子：五人隊巡邏 15 對 12、接力 5 對 4 → 16／20＝80%、兩星、升路線。
- **路線**：plain → hills → ridge → cloud，只升不降、雲頂封頂；撤退與對戰輸贏都不影響。隊伍目前的路線由最近一個副本推出來。
- **缺席**：每人每季最多 2 次，副本開門 48 小時內申報；申報者移出題數，沒申報又沒作答算 0 分。
- **鏡像賽**：只比解題率，平手記平手，永不看速度。**出題戰六分制**：答題三題各 1 分；出題分＝對方答錯且判定確實在考那隻怪才得 1；棄權隊 0 分、對方也不拿出題分；好題印記不計分。
- **配對**：同科、同路線、同年級、同教科書版本、不同嚮導、本季沒打過（鏡像賽與出題戰共用一份對戰紀錄）。出題怪取兩隊都遠征過的怪的交集（課表卡點＋隊員偵察到的夥伴），不足 3 隻改打幽靈隊。真人對戰要匿名投票全員同意，否則打幽靈隊，不說是誰投的。
- **公會解鎖**（累積到門檻就解鎖，不花掉）：隊旗圖樣 100、地圖配色 150、夥伴外框 200、季末合照框 300（小隊累積）；魔王攻略會 人均 60（公會）。實體徽章永遠不能用戰績換，只在公開賽拿到。
- **徽章公開賽**：達標制，解題率 ≥80% 且未缺席者全員出手 → 每位隊員各一枚，不排名；全服收服加總達標 → 金邊。
- **燈塔**：點燈是同聯賽區所有小隊在該區的戰績加總達門檻（world.json 的 `threshold`）；守塔是同路線爭奪，每月結算（`POST /towers/settle`，需 `X-Admin-Token`），四層各取當月最高、並列共同守，名冊永久保留、不衰減；同月重跑會覆蓋而不是追加。
- **榜**：`GET /leagues/{league}/board` 只回我前後各三隊，不含名次與總數；聯賽區只到北中南東四個字。小隊戰績只回加總與人均，不列每位隊員。
- **關燈**：沿用 `rules.is_lights_out`，22:30–06:00 副本不開門（423）、不推播。

POC 邊界：教科書版本還沒有欄位（配對時兩邊都視為同版本）；幽靈隊的歷史平均由呼叫端給；守塔結算以 `created_at` 的月份為準、資料量小直接在 Python 裡算。



## 往 1.0 的方向

目標架構、七條架構原則與 0.2 到 1.0 的差距，寫在 `frontend/strategy.html` 第 05 章（技術架構邏輯）。摘要：

- 前端維持靜態（網站、`app/` 原型、`world/` Demo），1.0 加 PWA；`world/data.js` 與 `services/world.py` 是同一套數字。
- 後端維持單體 FastAPI，模組：身分（家長 LINE Login、孩子 PIN）、學習、世界、小陪（`CoachProvider` 接模型＋答案洩漏守門）、題目生產線、通知與金流。
- 學會的事件（收服、叫醒、講解）是不可變的事件日誌，戰績、榜、週報、稱號全部從它推導。
- 排程：06:00 發任務卡、22:30 伺服器端關燈、週二 22:00 結算與接力 24 小時跳棒、每月 1 日守塔與徽章賽結算。
- 匿名在 API 層做掉：隊友的作答、求援、未完成不回傳 id；榜只回前後各三隊；對戰報告只給兩隊與兩位嚮導。
- 部署：Cloud Run ＋ Postgres ＋ CDN；金鑰只在環境變數；收件資料 30 天刪除。
