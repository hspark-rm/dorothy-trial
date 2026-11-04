#!/bin/bash
# Cloudflare Pages에 올린다(2026-11-05). 공개 주소에 GitHub 계정 이름이 드러나지 않게 하려고 GitHub Pages 대신 쓴다.
# 올리는 것은 게임에 필요한 파일뿐: index.html, og.png, LICENSE, src/, data/, assets/(raw 제외)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WRANGLER="$HOME/.local/share/wrangler/node_modules/.bin/wrangler"
PROJECT="${CF_PROJECT:-dorothy-trial}"
DIST="$(mktemp -d)/dist"
mkdir -p "$DIST"
rsync -a --exclude 'raw/' --exclude '.DS_Store' "$ROOT/assets" "$ROOT/data" "$ROOT/src" "$DIST/"
cp "$ROOT/index.html" "$ROOT/og.png" "$ROOT/LICENSE" "$DIST/"
"$WRANGLER" pages deploy "$DIST" --project-name "$PROJECT" --branch main --commit-dirty=true
