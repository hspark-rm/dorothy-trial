#!/bin/bash
# 설문 응답 보기(2026-11-06). 사용법: tools/survey.sh [게임 이름, 기본 dorothy-trial] [건수, 기본 50]
# 본인 기기(?me)에서 보낸 응답은 빼고 보여 준다. 최근 것부터
set -euo pipefail
GAME="${1:-dorothy-trial}"; N="${2:-50}"
WRANGLER="$HOME/.local/share/wrangler/node_modules/.bin/wrangler"
cd "$(dirname "$0")/.."
"$WRANGLER" d1 execute trial-stats --remote --json --command \
  "SELECT at, fun, diff, place, level, wrongs, hints, overs, min, stuck, wish FROM surveys WHERE game='$GAME' AND me=0 ORDER BY id DESC LIMIT $N" 2>/dev/null | python3 -c '
import json, sys
rows = json.load(sys.stdin)[0]["results"]
DIFF = {"easy": "쉬웠다", "ok": "적당", "hard": "어려웠다", None: "-"}
print("응답", len(rows), "건")
for r in rows:
    head = "[{at}] 재미 {fun} · 체감 {d} · 위치 {place} · 난이도 {level} · 실수 {wrongs} 힌트 {hints} 패소 {overs} · {min}분"
    print()
    print(head.format(d=DIFF.get(r["diff"], r["diff"]), **{k: ("-" if v is None else v) for k, v in r.items()}))
    if r["stuck"]: print("  막힌 곳:", r["stuck"])
    if r["wish"]: print("  바라는 점:", r["wish"])'
