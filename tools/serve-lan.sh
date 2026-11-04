#!/bin/sh
# 같은 와이파이에 있는 휴대폰에서 게임을 열기 위한 서버.
# 맥이 켜져 있고 이 창이 열려 있는 동안만 동작한다. 집 밖(인터넷)에서는 열리지 않는다.
cd "$(dirname "$0")/.." || exit 1
PORT=8850
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
if [ -z "$IP" ]; then
  echo "와이파이 주소를 찾지 못했습니다. 맥이 와이파이에 연결되어 있는지 확인하세요."
  exit 1
fi
echo "휴대폰 브라우저에서 이 주소를 여세요:  http://$IP:$PORT"
echo "(끝내려면 Ctrl+C)"
exec python3 -m http.server "$PORT" --bind "$IP"
