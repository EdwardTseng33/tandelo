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
  api/               路由：health、students、teams、teachers、coach、world、interventions、camp
  services/          純邏輯：content（題庫）、diagnosis（判卡點）、rules（規則）、teams（湊隊成班）、report（週報）、coach（小陪）、guard（小陪守門）、world（冒險世界）、variants（題目變體）、interventions（人工介入）、camp（營地來信）
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
- **小陪預設不接 LLM**：`COACH_PROVIDER=rules` 是規則引擎；`COACH_PROVIDER=anthropic` 走 `LLMProvider`（見下面「小陪接模型與守門（0.3）」），金鑰只從環境變數讀，程式碼裡永遠不放金鑰。
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


## 小陪接模型與守門（0.3）

小陪可以接大模型了，但「不給答案」不是靠提示詞保證，是靠守門保證：模型說的每一句話都先過 `services/guard.py`，沒過就退回規則引擎同一層級的句子。

```
POST /coach/reply
  ├─ 關燈（rules.is_lights_out）→ 回「關燈中」，不呼叫模型
  ├─ level ≥ 4 → 固定句「這一步交給你，寫到哪裡再叫我」，不呼叫模型
  ├─ action=answer → 先交給規則引擎比對（答對就換步驟，不叫模型；答錯才讓模型說一句）
  └─ LLMProvider._call → guard.check(text, answer_forms)
        ├─ 過 → 回 {level, text, handoff}
        └─ 沒過（leak／answer_phrase／too_long／unsafe／bad_json／refusal／error）
              → RulesCoach.line_for_level(skill, step, level) ＋ metrics.leak += 1 ＋ 一行 log
```

- **提供者**：`services/coach.py` 的 `CoachProvider` 介面不變。`COACH_PROVIDER=rules` 是原本的規則引擎；`COACH_PROVIDER=anthropic` 是 `LLMProvider`，只在有 `ANTHROPIC_API_KEY` 且裝了 SDK（`pip install 'tandelo-backend[llm]'`，`requirements.txt` 不強制）時啟用，否則 `create_app()` 啟動時退回規則引擎並記一行 log。模型 id 從 `COACH_MODEL` 讀，預設 `claude-sonnet-5-5`；SDK 用 try-import，程式碼與測試裡沒有任何金鑰。
- **提示**：系統提示＝固定規則（繁體中文台灣用語、每句 ≤ 40 字、絕不給整題答案與最終數值、不出現「答案是」、只做目前層級的事、不評價孩子）＋怪的定義檔（`world.json`：名稱、騙術、口頭禪、弱點、被識破時）＋題目＋孩子目前寫到的步驟（`step_text`）＋目前層級（0 問、1 指、2 借、3 示範一步）。回覆用結構化輸出 `{level, text, handoff}`；`output_config.effort=low`、`max_tokens=300`，刻意短。
- **守門（純函式，`services/guard.py`）**：`leaks_answer(text, answer_forms)` 把答案展開成各種寫法（正規化去空白、全形轉半形、整數／小數／最簡分數、`x = 4` 的右邊）直接比對，前後接到數字或字母不算（6 ≠ 6x、13 ≠ 130）；另外抓「答案是／就是／等於／=」後面那一段，項的順序不同也算（`7 + 2x` ＝ `2x + 7`）。`too_long` 每句 ≤ 40 字、最多 5 句；`has_unsafe` 是兒少不宜與貶低語氣的黑名單；`says_answer_phrase` 擋「答案是」。`answer_forms` 由前端或變體引擎提供，空的就用題庫的 `coach.final`；第三層以前連這一步的 `accept` 也擋（不寫下一步），第三層「示範一步」才放行。守門寧可誤擋（退回規則引擎），不放過。
- **四層與交棒**：`level` 從 body 來（沒給就用 `hint_level`）。第 3 層回覆 `handoff=true`；`level ≥ 4` 不呼叫模型，只回固定句。對錯判斷與換步驟永遠在規則引擎（計算與答案比對不讓語言模型做）。
- **計數**：`CoachMetrics`（記憶體，重啟歸零，多副本要換集中式）：`total`（小陪實際回覆數，關燈不算）、`llm_calls`、`leak`（沒過守門退回的次數）、`by_reason`。`GET /coach/metrics` 回 `leak_rate = leak / total`，對應設計稿的「洩漏答案率 ≤ 2%」。
- **API**：`POST /coach/reply` body 多了 `monster_id`、`step_text`、`level`、`answer_forms`；回傳多了 `provider`（原本就有）、`level`、`handoff`、`guarded`（沒過守門的原因，這時句子來自規則引擎）。
- **變體題（0.4）**：body 可帶 `variant: {monster_id, route, seed, picked}`，後端用變體引擎重算該題（不信任前端送來的答案），`CoachTurn.variant` 帶題幹、答案、trap、錯法標籤、步驟與是否踩到 trap。規則引擎四層：0 問寫到哪、1 指（踩到 trap 就點名錯法）、2 借、3 示範該題第一步；模型提示詞多了題幹、孩子的選擇、錯法與隱藏最後一步的解法；守門把該題答案列入不可說。
- **測試**：`tests/test_coach_guard.py` 用假的 SDK client（monkeypatch `coach._make_client`）鎖住：有金鑰走模型、沒金鑰或沒 SDK 退回規則、各種洩漏寫法、放過「負號要發給每一個人」、第四層固定句、關燈不呼叫模型、metrics 數字。不對外打 API。

POC 邊界：前端 `app/` 仍走本地規則；`world/` 在設定了後端位址時會送 `level`、`step_text` 與 `variant.answer_token`（見下節）；`answer_forms` 由呼叫端給或用題庫的最終答案（變體引擎產的題，判題回應裡的答案選項文字就能當 `answer_forms`，前端還沒接）。

## 題目變體引擎與人工介入紀錄（0.3）

### 題目變體引擎

一隻怪要有「隊伍人數 × 6 ＋ 4」題已審變體（六人隊 40 題）才夠一季遠征不重題。`services/variants.py` 對數學八隻怪各寫一個參數化產生器（id 沿用 `content.json` 的卡點 id），用種子決定性產出；路由在 `api/world.py`（tags＝世界）。純函式、不碰資料庫，數字由 `tests/test_variants.py` 鎖住。

```
services/variants.py
  generate(monster_id, seed, difficulty)   → {stem, options[4], answer, trap, why, steps, difficulty, monster_id, variant_key, params}
  check(variant)                           規則版「AI 三檢查」，不過就丟 ValueError
  bank(monster_id, n, route, seed)         n 題互不重複（variant_key 去重），每題都過 check
  threshold(size) = size × 6 ＋ 4           ready(monster_id, size, route) 回是否達標
  sign_token / parse_token / judge         answer_token 與判題
```

- **決定性**：同一組（怪、種子、路線）永遠同一題；`bank` 的第 i 題只和（怪、路線、種子、i）有關、和 n 無關。題幹用純文字數學（²、√、−），不用 LaTeX。
- **trap 一定是那隻怪的錯法**（`TRAP_KINDS`）：漏項獸＝只剩兩端平方（`missing_middle`）、負號幽靈＝只有第一項變號（`first_term_only`）、拆根蟲＝拆成 √a ± √b（`split_root`）、雙面根＝±k（`plus_minus`）、斜邊迷霧＝已知斜邊卻拿去加／把長的股當斜邊（`wrong_hypotenuse`）、平方差雙子＝(a − b)²（`both_minus`）、十字符號怪＝數字對符號全換（`sign_swapped`）、零的隱者＝只剩 x = k（`dropped_zero`）。另外兩個干擾項是別的常見錯（半個中間項、忘了平方首項、漏開根號、另一組因數……）。
- **路線＝難度**：`DIFFICULTY_FACTOR` plain 1.0、hills 1.5、ridge 2.0、cloud 2.5 放大係數範圍（例如基底 10 → 10／15／20／25）；山徑線加結構（二次多項式、兩個變數、首項係數、分數根、化簡根式）；雲頂線混入跨章節：(ax + by)²、(x + b)² − (x² + cx + e)、√((−a)² + b²)、√((−a)² + (−b)²)、兩股求斜邊要化簡根式、(x + c)² − b²、先提公因式再十字交乘、(x + c)² = k(x + c)。
- **三檢查（規則版，之後可換成模型審）**：① 答案唯一且在選項裡；② trap 與答案不同、四個選項互不相同（去空白比對）；③ 用 `params` 實際重算——多項式乘開、因式乘回去要等於題幹、根代回方程式、根號裡先算完再開——要等於選項裡的答案，且最後一步要得出答案。`bank` 每題都跑，湊不到就丟 ValueError（API 回 409）。
- **API**：`GET /world/monsters/{id}/variants?n=&route=&seed=` 只回 `stem`、`options`、`difficulty`、`variant_key` 與 `answer_token`，不回答案、trap、為什麼與步驟；`POST /world/monsters/{id}/variants/check` 用 token 判對錯、回有沒有踩到 trap、`why` 與 `steps`；`GET /world/monsters/{id}/bank-status?size=` 回每條路線湊得到幾題、是否達標。非數學怪（提案中的九隻）回 404。
- **answer_token**：HMAC-SHA256 簽的（怪、路線、種子、索引），不含答案；判題時重新產生那一題再比對，所以解開 token 也拿不到答案。金鑰從 `VARIANT_SECRET` 讀，沒設就啟動時隨機產生（重啟後舊 token 失效）；程式碼裡沒有金鑰。

POC 邊界：只有數學八隻怪；「已審」目前＝規則三檢查通過，人工審核的欄位與流程還沒有；題幹是純文字、沒有圖（斜邊迷霧用頂點寫法代替轉過的三角形）；難度係數是生成參數，不是實測的答對率。

### 人工介入紀錄

POC 的人力介入階梯實驗要知道「誰、為什麼、花了幾分鐘」。表 `interventions`，規則在 `services/interventions.py`（純函式），路由在 `api/interventions.py`（tags＝人工介入）。

| 表 | 用途 | 重點欄位 |
|---|---|---|
| interventions | 一次介入 | student_id（可空）、team_id（可空）、by（system／patrol／guide／cs）、kind（nudge／explain／comfort／demo／review／parent_note）、trigger（help_timeout／three_wrong／three_days_off／expedition／weekly／parent_message／manual）、minutes、note（≤ 200 字、不放個資）、created_at |

`teams` 多了 `layer`（L0／L1／L2／L3，預設 L2）：這一隊在實驗裡的人力介入分層。

- **升級順序** `escalate(trigger, history)`：同一個 trigger 先讓系統試一次 → 巡邏（patrol）→ 嚮導（guide），嚮導是頂層；別的 trigger 的紀錄不影響；cs 不在階梯上。API 以「同一位學生（沒學生就同一隊）、同一個 trigger、同一個 ISO 週」為一回合，`POST /interventions` 回 `next_level`。
- **摘要** `summary(rows, week)`：人力分鐘＝by ≠ system 的分鐘（系統另計 `system_minutes`），回每生每週人力分鐘（`per_student`、`per_student_week`）、各 kind 分鐘、各 trigger 次數、各 by 分鐘；沒有學生的小隊層級紀錄進 `team_minutes`。
- **API**：`POST /interventions`（note 超過 200 字 422；`at` 可覆蓋建立時間，示範用）、`GET /teams/{id}/interventions/summary?week=`（這一隊＋隊員的紀錄）、`GET /interventions/summary?layer=&week=`（該分層所有小隊）、`PUT /teams/{id}/layer`。

POC 邊界：`minutes` 由介入的人自填；note 不放個資靠長度限制與自律，沒有自動偵測；分層手動設定，沒有隨機分派。

## Demo 接後端與嚮導視角（0.4）

- **前端引擎與後端引擎並存**：`frontend/world/variants.js` 是後端變體引擎規則的移植（三隻怪、四條路線），讓 Pages 上的 Demo 沒有伺服器也能每次換題；亂數不同於 Python，所以兩邊同一個種子不會同一題。這是刻意的：前端版只是替身，產品路徑永遠是後端出題。
- **接後端的切換點只有一個**：`frontend/world/api.js` 的 `base()`（localStorage 或 `?api=`）。有位址時，巡邏、伏擊、叫醒三條流程改走 `variants`（只拿題幹、選項、`answer_token`）→ 每個選項第一次點 `variants/check`（後端判，回答案索引、錯法標籤、為什麼）→ 小陪 `coach/reply` 帶 `answer_token`（後端用同一條路找回那一題）。前端從頭到尾不知道答案，直到後端判過。
- **嚮導視角**：`#/guide` 把「人力只在三個時刻介入」做成三張卡（求援逾時、三次同錯法、三天沒來），每張標示系統與巡查已做過什麼；處理一件就是一筆介入，分鐘數對上每生每週上限；有位址時 `POST /interventions`，欄位與 `docs/pilot/intervention-log.md` 一致。
- **沒回應的退路**：出題中顯示骨架；失敗可重試或一鍵清掉位址改回本地題；小陪或判題失敗只提示，不卡住畫面。
- **營地畫面接後端**：有位址時 `#/camp` 列的是後端 `camp_letters`（收服、叫醒、講解自動寄；分享卡「傳到營地」、週回顧、結算放上隊伍牆會手動寄），「我見證了／晚點問他」直接回後端。

## 營地來信（0.5）

家長只用 LINE，不裝 App；每一封信只說三件事：孩子學會了什麼、還在追什麼、今晚可以問他哪一句。不放分數、不放排名、不放別人家的孩子。

| 表 | 用途 | 重點欄位 |
|---|---|---|
| camp_letters | 一封給家長的信 | student_id、kind（capture／wake／explain／dungeon／week）、monster_id、body_json（title／lines／ask／actions）、text（LINE 純文字）、status（queued → sent → witnessed／later；failed）、channel（line／stub）、error、sent_at、replied_at |
| parent_links | 家長的 LINE 連結 | student_id、line_user_id（只存 LINE 的假名 userId，不存姓名電話；唯一） |

- **文案是純函式** `services/camp.py::compose(nickname, kind, monster, chasing, guide, guide_day, extra)`，不開伺服器可測；「今晚可以問他」優先用題庫 `skills[*].tonight`。
- **誰來寄**：`POST /students/{id}/shadows/{monster}/events` 的 `explained_ok`／`retest_passed`／`woken` 會自動寄（卡住的事件不寄）；副本結算與週回顧由前端手動 `POST /students/{id}/camp-letters`。
- **送件**：有 `LINE_CHANNEL_ACCESS_TOKEN` 且孩子綁了家長才真的推（Messaging API push，附兩個 quick reply：我見證了／晚點問他）；推不出去記 `failed` 與原因，不讓學會事件失敗；沒設定就 `channel: stub`，Demo 的營地畫面直接讀這張表。
- **回覆**：LINE 的 postback 或文字打到 `POST /line/webhook`，先驗 `X-Line-Signature`；只會改到該家長自己孩子的信。Demo 的家長視角則直接 `POST /camp-letters/{id}/reply`。
- **1.0 要補**：家長綁定改 LINE Login（POC 由營運用管理權杖綁）、21:00 批次發信（POC 即時寄）、同一事件一天只寄一封。

## 往 1.0 的方向

目標架構、七條架構原則與 0.2 到 1.0 的差距，寫在 `frontend/strategy.html` 第 05 章（技術架構邏輯）。摘要：

- 前端維持靜態（網站、`app/` 原型、`world/` Demo），1.0 加 PWA；`world/data.js` 與 `services/world.py` 是同一套數字。
- 後端維持單體 FastAPI，模組：身分（家長 LINE Login、孩子 PIN）、學習、世界、小陪（`CoachProvider` 接模型＋答案洩漏守門）、題目生產線、通知與金流。
- 學會的事件（收服、叫醒、講解）是不可變的事件日誌，戰績、榜、週報、稱號全部從它推導。
- 排程：06:00 發任務卡、22:30 伺服器端關燈、週二 22:00 結算與接力 24 小時跳棒、每月 1 日守塔與徽章賽結算。
- 匿名在 API 層做掉：隊友的作答、求援、未完成不回傳 id；榜只回前後各三隊；對戰報告只給兩隊與兩位嚮導。
- 部署：Cloud Run ＋ Postgres ＋ CDN；金鑰只在環境變數；收件資料 30 天刪除。
