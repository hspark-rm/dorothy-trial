// 짧은 설문(2026-11-06). 게임 중 메뉴·엔딩 화면의 설문 창이 JSON으로 보낸다.
// IP는 받지 않고 저장하지도 않는다. 같은 브라우저 번호로는 하루 5건까지만 받는다(장난 방지).
const GAMES = new Set(['dorothy-trial', 'nayuta-trial']);
const DIFFS = new Set(['easy', 'ok', 'hard']);
const LEVELS = new Set(['easy', 'normal', 'hard']);
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

export async function onRequestPost({ request, env }) {
  let b;
  try { b = JSON.parse(await request.text()); } catch (e) { return new Response(null, { status: 400 }); }
  if (!b || !GAMES.has(b.g)) return new Response(null, { status: 400 });
  const vid = /^[0-9a-f-]{36}$/.test(b.v || '') ? b.v : null;
  const fun = int(b.fun, 1, 5), diff = DIFFS.has(b.diff) ? b.diff : null;
  const stuck = str(b.stuck, 500), wish = str(b.wish, 500);
  if (!fun && !diff && !stuck && !wish) return new Response(null, { status: 400 });
  const now = new Date(Date.now() + 9 * 3600e3); // 한국 시간
  const day = now.toISOString().slice(0, 10);
  if (vid) {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM surveys WHERE game = ? AND vid = ? AND day = ?').bind(b.g, vid, day).first();
    if (r && r.n >= 5) return new Response(null, { status: 429 });
  }
  await env.DB.prepare('INSERT INTO surveys (game, vid, me, day, at, fun, diff, stuck, wish, place, level, wrongs, hints, overs, min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(b.g, vid, b.me ? 1 : 0, day, now.toISOString().slice(0, 16).replace('T', ' '), fun, diff, stuck, wish,
      str(b.where, 20), LEVELS.has(b.level) ? b.level : null,
      int(b.wrongs, 0, 9999), int(b.hints, 0, 9999), int(b.overs, 0, 9999), int(b.min, 0, 99999))
    .run();
  return new Response(null, { status: 204 });
}
