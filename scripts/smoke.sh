#!/usr/bin/env bash
# 冒煙測試：對 docker compose 起來的服務打 /health，再跑一條完整流程
# （建學生 → 診斷 → 時段 → 湊隊 → 老師接班 → 課後紀錄 → 練習 → 週報）。
# 用法：./scripts/smoke.sh [FRONTEND_URL] [BACKEND_URL]
set -euo pipefail

FRONT="${1:-http://localhost:8080}"
BACK="${2:-http://localhost:8000}"
API="$FRONT/api/v1"   # 走 nginx 反向代理，順便驗證代理設定

need() { command -v "$1" >/dev/null 2>&1 || { echo "需要 $1"; exit 1; }; }
need curl; need python3

jget() { python3 -c "import sys,json; d=json.load(sys.stdin); print(eval('d'+sys.argv[1]))" "$1"; }
step() { printf '\n▶ %s\n' "$1"; }
fail() { printf '✗ %s\n' "$1"; exit 1; }
ok() { printf '✓ %s\n' "$1"; }
# 抓網址內容看有沒有某段字（不用 grep -q 接管線，避免 pipefail 誤判）
has() { local body; body=$(curl -fsS "$1") || return 1; [[ "$body" == *"$2"* ]]; }

step "等服務就緒（最多 60 秒）"
for i in $(seq 1 30); do
  if curl -fsS "$BACK/health" >/dev/null 2>&1 && curl -fsS "$FRONT/healthz" >/dev/null 2>&1; then break; fi
  sleep 2
  [ "$i" -eq 30 ] && fail "服務沒起來：$BACK/health 或 $FRONT/healthz"
done
ok "後端 /health 與前端 /healthz 都回應"

step "前端首頁與 config.js 注入"
has "$FRONT/" "Tandelo" || fail "首頁沒有 Tandelo 字樣"
has "$FRONT/config.js" "'/api'" || fail "config.js 沒有注入 /api"
has "$FRONT/app/" "config.js" || fail "App 頁沒載入 config.js"
ok "首頁、App 頁、config.js 正常"

step "透過 nginx 打 /api/v1/health"
has "$API/health" '"ok":true' || fail "/api/v1/health 沒回 ok"
ok "反向代理正常"

step "建學生"
SID=$(curl -fsS -X POST "$API/students" -H 'Content-Type: application/json' \
  -d '{"nickname":"冒煙生","grade":"國二","exam_date":"2026-11-27"}' | jget "['id']")
ok "學生 id=$SID"

step "診斷（q1、q2 答錯）"
STUCK=$(curl -fsS -X POST "$API/students/$SID/diagnostics" -H 'Content-Type: application/json' \
  -d '{"answers":{"q1":0,"q2":1,"q3":1,"q4":0,"q5":0,"q6":0,"q7":1,"q8":0}}' | jget "['stuck']")
[ "$STUCK" = "['sq-cross', 'sign-dist']" ] || fail "卡點判錯：$STUCK"
ok "卡點：$STUCK"

step "時段"
curl -fsS -X PUT "$API/students/$SID/availability" -H 'Content-Type: application/json' -d '{"slots":["d2-1900","d0-1900"]}' >/dev/null
ok "時段已存"

step "湊隊"
TEAM_JSON=$(curl -fsS -X POST "$API/teams/match" -H 'Content-Type: application/json' -d "{\"student_id\":$SID,\"plan_id\":\"8\"}")
TID=$(echo "$TEAM_JSON" | jget "['id']")
SIZE=$(echo "$TEAM_JSON" | jget "['size']")
ok "小隊 id=$TID，$SIZE 人（$(echo "$TEAM_JSON" | jget "['rule']")）"

step "老師接班"
STATUS=$(curl -fsS -X POST "$API/teams/$TID/accept" -H 'Content-Type: application/json' -d '{"teacher_id":1}' | jget "['status']")
[ "$STATUS" = "confirmed" ] || fail "沒成班：$STATUS"
ok "成班（confirmed）"

step "課後紀錄"
SESS=$(curl -fsS "$API/teams/$TID/sessions" | jget "[0]['id']")
curl -fsS -X POST "$API/sessions/$SESS/notes" -H 'Content-Type: application/json' -d '{"teacher_id":1,"text":"冒煙測試：今天大家都講得出中間項。"}' >/dev/null
ok "第一堂紀錄已存"

step "練習與再測"
TODAY=$(date +%F)
curl -fsS -X POST "$API/students/$SID/practices" -H 'Content-Type: application/json' -d "{\"skill_id\":\"sq-cross\",\"kind\":\"explain\",\"explain_passed\":true,\"hints\":1,\"date\":\"$TODAY\"}" >/dev/null
DUE=$(curl -fsS -X POST "$API/students/$SID/retests" -H 'Content-Type: application/json' -d "{\"skill_id\":\"sq-cross\",\"hints\":1,\"from_date\":\"$TODAY\"}" | jget "['due_date']")
ok "再測日：$DUE"

step "家長週報"
REPORT=$(curl -fsS "$API/students/$SID/parent-report?today=$TODAY")
[[ "$REPORT" == *"今晚可以問他"* ]] || fail "週報沒有「今晚可以問他」"
echo "$REPORT" | jget "['lines']"
ok "週報生成"

step "小陪關燈與收入試算"
QUIET=$(curl -fsS -X POST "$API/coach/reply" -H 'Content-Type: application/json' -d '{"skill_id":"sq-cross","action":"start","time":"23:00"}')
[[ "$QUIET" == *"關燈中"* ]] || fail "23:00 沒關燈"
has "$API/teachers/1/earnings?tier=gold&teams=2&size=4" '"monthly":6680' || fail "分潤算錯"
ok "關燈與分潤正確"

printf '\n全部通過。\n'
