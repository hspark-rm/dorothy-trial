// 익명 방문 집계(2026-11-05). 게임이 sendBeacon으로 { g: 게임, v: 브라우저 번호, k: 종류 }를 보낸다.
// IP·이름 같은 개인정보는 받지 않고 저장하지도 않는다. 같은 브라우저·같은 종류는 한 번만 센다.
const GAMES = new Set(['dorothy-trial', 'nayuta-trial']);
// visit·start·finish(2026-11-05) + 이탈 지점(2026-11-06): title·rotate·namebox, from_/reach_/finish_ 뒤에 심 이름
// share 결과 공유 · dex 인물 도감(2026-11-06)
const KINDS = /^(visit|title|rotate|namebox|start|finish|share|dex|(from|reach|finish)_[a-z0-9]{1,12})$/;

export async function onRequestPost({ request, env }) {
  let b;
  try { b = JSON.parse(await request.text()); } catch (e) { return new Response(null, { status: 400 }); }
  if (!b || !GAMES.has(b.g) || !KINDS.test(b.k || '') || !/^[0-9a-f-]{36}$/.test(b.v || '')) return new Response(null, { status: 400 });
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 한국 날짜
  await env.DB.prepare('INSERT OR IGNORE INTO hits (game, vid, kind, day) VALUES (?, ?, ?, ?)').bind(b.g, b.v, b.k, day).run();
  return new Response(null, { status: 204 });
}
