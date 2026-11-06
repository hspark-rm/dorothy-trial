#!/bin/bash
# 익명 방문 집계 보기(2026-11-05, 이탈 지점 2026-11-06). 사용법: tools/stats.sh [게임 이름, 기본 dorothy-trial]
# 브라우저 수로 센다. 본인 기기(?me)는 빠져 있다. 2026-11-06 전에는 「새로 시작」이 start에 들어가지 않았다(심 선택만 셈)
# 단계: visit 페이지 열림 → title 타이틀 그려짐(rotate = 세로 화면 안내가 뜸) → namebox 이름 칸 → start 시작
#       from_new 새로 시작 / from_trialN 심 선택 → reach_trialN 그 심에 닿음 → finish_<시작한 곳> 엔딩
set -euo pipefail
GAME="${1:-dorothy-trial}"
WRANGLER="$HOME/.local/share/wrangler/node_modules/.bin/wrangler"
cd "$(dirname "$0")/.."
# 명령을 하나씩 보낸다(여러 문장을 한 번에 보내면 권한 오류가 날 때가 있었음, 2026-11-06)
q() { "$WRANGLER" d1 execute trial-stats --remote --json --command "$1" 2>/dev/null | python3 -c '
import json, sys
rows = json.load(sys.stdin)[0]["results"]
if rows:
    keys = list(rows[0])
    print("  ".join(keys))
    for r in rows: print("  ".join(str(r[k]) for k in keys))
'; echo; }
echo "== 단계별 브라우저 수 =="
q "SELECT kind AS 종류, COUNT(*) AS 브라우저수 FROM hits WHERE game='$GAME' GROUP BY kind ORDER BY CASE kind WHEN 'visit' THEN 0 WHEN 'title' THEN 1 WHEN 'rotate' THEN 2 WHEN 'namebox' THEN 3 WHEN 'start' THEN 4 ELSE 5 END, kind"
echo "== 날짜별 =="
q "SELECT day AS 날짜, SUM(kind='visit') AS 방문, SUM(kind='title') AS 타이틀, SUM(kind='start') AS 시작, SUM(kind='finish') AS 엔딩 FROM hits WHERE game='$GAME' GROUP BY day ORDER BY day"
