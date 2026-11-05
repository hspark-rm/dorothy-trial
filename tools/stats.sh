#!/bin/bash
# 익명 방문 집계 보기(2026-11-05). 사용법: tools/stats.sh [게임 이름, 기본 dorothy-trial]
# 방문 = 페이지를 연 브라우저 수, 시작 = 새로 시작한 수, 엔딩 = 끝까지 본 수. 본인 기기(?me)는 빠져 있다.
set -euo pipefail
GAME="${1:-dorothy-trial}"
WRANGLER="$HOME/.local/share/wrangler/node_modules/.bin/wrangler"
cd "$(dirname "$0")/.."
"$WRANGLER" d1 execute trial-stats --remote --command \
  "SELECT kind AS 종류, COUNT(*) AS 브라우저수 FROM hits WHERE game='$GAME' GROUP BY kind;
   SELECT day AS 날짜, SUM(kind='visit') AS 방문, SUM(kind='start') AS 시작, SUM(kind='finish') AS 엔딩 FROM hits WHERE game='$GAME' GROUP BY day ORDER BY day;"
