'use strict';
// 도로시 재판 — 도트 법정 공방 엔진(나유타 재판 엔진에서 갈라짐). 게임마다 다른 문구는 data/case1.js 의 CASE에 둔다
// 모든 그림은 320×180 기준 화면에 그리고, CSS로 정수배 확대한다(흐림 없음).
(() => {
  const W = 320, H = 180;
  const CASE = window.CASE;
  // 배치는 320×180 좌표로 하고, 실제로는 6배(1920×1080, FHD)로 그린다.
  // 사각형은 6픽셀 단위 도트가 되고, 글자와 초상화는 FHD 해상도로 선명하게 나온다.
  const RES = 6;
  const cv = document.getElementById('game');
  cv.width = W * RES; cv.height = H * RES;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const TOUCH = matchMedia('(pointer: coarse)').matches;
  const keyHint = (label, key) => (TOUCH ? label : `${label} ${key}`);

  const COL = {
    night: '#07060c', wall: '#2a2846', wall2: '#322f55', trim: '#4a4578',
    wood: '#5a3a22', wood2: '#4a2e1a', woodHi: '#9a6a3c', floor: '#24160f',
    gold: '#e8c060', text: '#f4f0e6', dim: '#8a86a8', think: '#8cc8ff',
    testimony: '#7ee08a', red: '#e0505a', box: '#10101c', ink: '#0d0b14',
  };
  // 저장은 대본 위치(pc)로 기억하므로, 대본의 '뼈대'가 바뀌면 옛 저장을 쓰지 않도록 뼈대 해시를 키에 붙인다.
  // 뼈대 = 명령의 순서·종류·id와 조사 장소별 단서 수. 대사 글자만 고치면 해시가 그대로라 저장이 유지된다(2026-11-06, 전에는 글자까지 해시)
  const scriptShape = CASE.script.map((op) => (!op.op ? 'L' : [op.op, op.id || '', op.op === 'investigate'
    ? Object.entries(op.places).map(([k, p]) => `${k}:${(p.spots || []).length}/${(p.talk || []).length}`).join(',') : ''].join('|'))).join(';');
  const scriptHash = (() => { let h = 5381; for (let i = 0; i < scriptShape.length; i++) h = ((h * 33) ^ scriptShape.charCodeAt(i)) >>> 0; return h.toString(36); })();
  const GAME = CASE.gameId || 'nayuta-trial'; // 저장·설정 이름 앞부분. 다른 게임과 저장이 섞이지 않게
  const SAVE_KEY = GAME + '.save.v2.' + scriptHash;
  // 익명 방문 집계(2026-11-05): 브라우저마다 무작위 번호 하나만 보내고, 종류별로 한 번만 센다.
  // 공개 주소(pages.dev)에서만 보낸다. 주소에 ?me를 붙여 한 번 열면 그 브라우저는 집계에서 빠진다(제작자 본인용)
  const STAT_KEY = GAME + '.stat';
  // 이탈 지점 집계(2026-11-06): title 타이틀이 그려짐 · rotate 세로 화면 안내가 뜸 · namebox 이름 칸이 뜸 · from_<심> 시작한 곳 ·
  // reach_<심> 그 심에 닿음 · finish_<심> 엔딩(어느 심부터 시작했는지). 한 페이지에서 같은 종류는 한 번만 보낸다
  const statSent = new Set();
  function stat(kind) {
    if (statSent.has(kind)) return;
    statSent.add(kind);
    try {
      if (new URLSearchParams(location.search).has('me')) localStorage.setItem(STAT_KEY, 'me');
      let v = localStorage.getItem(STAT_KEY);
      if (v === 'me' || !location.hostname.endsWith('.pages.dev') || !navigator.sendBeacon) return;
      if (!v) { v = crypto.randomUUID(); localStorage.setItem(STAT_KEY, v); }
      navigator.sendBeacon('/api/hit', JSON.stringify({ g: GAME, v, k: kind }));
    } catch (e) { /* 집계는 게임과 무관하므로 실패해도 넘어간다 */ }
  }
  stat('visit');
  // 올클리어(이긴 엔딩을 본 적 있음, 2026-11-06): 타이틀에 엔딩 의상 도로시가 나오고 인물 도감이 열린다
  const CLEAR_KEY = GAME + '.clear';
  let cleared = false;
  try { cleared = localStorage.getItem(CLEAR_KEY) === '1'; } catch (e) { /* 이번 판에서만 */ }
  const isAdmin = () => { try { return localStorage.getItem(STAT_KEY) === 'me'; } catch (e) { return false; } };
  // 난이도: 하트 수와 힌트 양이 달라진다. easy 줄(대본의 easy: true)은 쉬움에서만 나온다
  const DIFFS = {
    easy:   { label: '쉬움',   hearts: 7, hints: 2 },
    normal: { label: '보통',   hearts: 5, hints: 1 },
    hard:   { label: '어려움', hearts: 3, hints: 0 },
  };
  const DIFF_KEY = GAME + '.difficulty';
  let difficulty = 'normal';
  try { difficulty = DIFFS[localStorage.getItem(DIFF_KEY)] ? localStorage.getItem(DIFF_KEY) : 'normal'; } catch (e) { /* 기본 보통 */ }
  const maxPatience = () => DIFFS[difficulty].hearts;
  // 플레이어 이름: 대본·증거·경고 문구의 {name}을 이 이름으로 바꾼다(CASE.askName이면 새로 시작할 때 묻는다)
  const NAME_KEY = GAME + '.name', DEFAULT_NAME = CASE.defaultName || '지휘관';
  const TEMPLATE = JSON.parse(JSON.stringify({ script: CASE.script, evidence: CASE.evidence, pressure: CASE.pressure || null, me: (CASE.chars.me || {}).name }));
  let playerName = DEFAULT_NAME;
  try { playerName = localStorage.getItem(NAME_KEY) || DEFAULT_NAME; } catch (e) { /* 기본 이름 */ }
  function applyName(n) {
    playerName = n || DEFAULT_NAME;
    const r = (v) => typeof v === 'string' ? v.split('{name}').join(playerName)
      : Array.isArray(v) ? v.map(r) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, r(x)])) : v;
    CASE.script = r(TEMPLATE.script); CASE.evidence = r(TEMPLATE.evidence);
    if (TEMPLATE.pressure) CASE.pressure = r(TEMPLATE.pressure);
    if (CASE.askName && CASE.chars.me) CASE.chars.me.name = playerName;
  }
  if (CASE.askName) applyName(playerName);

  // ───────── 화면 맞춤: FHD 캔버스를 CSS로 화면 크기에 맞춘다 ─────────
  function fit() {
    const vw = window.visualViewport ? visualViewport.width : innerWidth;
    const vh = window.visualViewport ? visualViewport.height : innerHeight;
    const k = Math.min(vw / W, vh / H);
    cv.style.width = Math.floor(W * k) + 'px';
    cv.style.height = Math.floor(H * k) + 'px';
  }
  addEventListener('resize', fit);
  addEventListener('orientationchange', () => setTimeout(fit, 200));
  if (window.visualViewport) visualViewport.addEventListener('resize', fit);
  fit();
  const portraitHeld = () => innerHeight > innerWidth * 1.1;

  // 안드로이드 크롬: 전체 화면에 들어가면 가로로 고정할 수 있다. 아이폰 사파리는 지원하지 않음.
  const canFull = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  async function goFull() {
    const el = document.documentElement;
    try { await (el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen()); } catch (e) { return; }
    try { await screen.orientation.lock('landscape'); } catch (e) { /* 고정을 못 하면 사용자가 돌린다 */ }
  }

  // ───────── 글자: 도트 글꼴(갈무리)을 FHD 해상도 벡터로 그린다 ─────────
  const measure = document.createElement('canvas').getContext('2d');
  const fontOf = (b, px = 12) => `${px}px ${b ? 'Galmuri11Bold' : 'Galmuri11'}, "Apple SD Gothic Neo", sans-serif`;
  function tw(s, b) { measure.font = fontOf(b); return Math.ceil(measure.measureText(s).width); }
  // clip: 앞에서부터 보여 줄 폭(한 글자씩 찍는 효과용), 좌표는 320×180 기준
  function text(s, x, y, color = COL.text, o = {}) {
    if (!s) return 0;
    const sc = o.scale || 1, w = tw(s, o.bold) * sc;
    if (o.align === 'center') x = Math.round(x - w / 2);
    else if (o.align === 'right') x -= w;
    g.save();
    g.font = fontOf(o.bold, 12 * sc);
    g.textBaseline = 'top';
    if (o.clip != null) { g.beginPath(); g.rect(x - 2, y - 2, o.clip * sc + 3, 16 * sc + 4); g.clip(); }
    const put = (c, dx, dy) => { g.fillStyle = c; g.fillText(s, x + dx, y + sc + dy); };
    if (o.outline) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) put(o.outline, ox * sc, oy * sc);
    else if (o.shadow) put(o.shadow, sc * 0.75, sc * 0.75);
    put(color, 0, 0);
    g.restore();
    return w;
  }
  function wrap(s, maxW, b) {
    const out = [];
    for (const para of s.split('\n')) {
      let line = '';
      for (const ch of [...para]) {
        if (line && tw(line + ch, b) > maxW) {
          const sp = line.lastIndexOf(' ');
          if (sp > 0 && ch !== ' ') { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + ch; }
          else { out.push(line); line = ch === ' ' ? '' : ch; }
        } else line += ch;
      }
      out.push(line);
    }
    return out;
  }
  function josa(w, a, b) {
    const c = w.charCodeAt(w.length - 1);
    if (c < 0xac00 || c > 0xd7a3) return w + b;
    return w + ((c - 0xac00) % 28 ? a : b);
  }

  // ───────── 그림 도트 변환: 축소 + 색 수 줄이기(median cut) ─────────
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function quantize(p, n) {
    const px = [];
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] < 128) { p[i + 3] = 0; continue; }
      p[i + 3] = 255; px.push(i);
    }
    if (!px.length) return;
    const boxes = [px];
    while (boxes.length < n) {
      let bi = -1, best = 0, bch = 0;
      boxes.forEach((b, k) => {
        if (b.length < 2) return;
        for (let ch = 0; ch < 3; ch++) {
          let lo = 255, hi = 0;
          for (const i of b) { const v = p[i + ch]; if (v < lo) lo = v; if (v > hi) hi = v; }
          if (hi - lo > best) { best = hi - lo; bi = k; bch = ch; }
        }
      });
      if (bi < 0) break;
      const b = boxes[bi].sort((a, c) => p[a + bch] - p[c + bch]), m = b.length >> 1;
      boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
    }
    for (const b of boxes) {
      let r = 0, gg = 0, bb = 0;
      for (const i of b) { r += p[i]; gg += p[i + 1]; bb += p[i + 2]; }
      r = Math.round(r / b.length); gg = Math.round(gg / b.length); bb = Math.round(bb / b.length);
      for (const i of b) { p[i] = r; p[i + 1] = gg; p[i + 2] = bb; }
    }
  }
  // w, h는 320×180 기준 크기. 캔버스는 RES배로 만든다. colors를 주면 색 수를 줄인다
  function pixelate(im, src, w, h, colors) {
    const cw = Math.max(1, Math.round(w * RES)), ch = Math.max(1, Math.round(h * RES));
    const c = mk(cw, ch), x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(im, src.x, src.y, src.w, src.h, 0, 0, cw, ch);
    // 배경 지우기가 남긴 반투명 픽셀은 뒤 배경이 비쳐 그림이 깨져 보인다 → 투명/불투명 둘로만 나눈다
    const d = x.getImageData(0, 0, cw, ch);
    if (colors) quantize(d.data, colors);
    else for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] < 128 ? 0 : 255;
    x.putImageData(d, 0, 0);
    return c;
  }
  // 투명 여백을 잘라 낸 실제 그림 범위
  function alphaBox(im) {
    const s = Math.min(1, 512 / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.max(1, Math.round(im.naturalWidth * s)), h = Math.max(1, Math.round(im.naturalHeight * s));
    const x = mk(w, h).getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0, w, h);
    const p = x.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      if (p[(y * w + xx) * 4 + 3] > 16) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return { x: 0, y: 0, w: im.naturalWidth, h: im.naturalHeight };
    return { x: x0 / s, y: y0 / s, w: (x1 - x0 + 1) / s, h: (y1 - y0 + 1) / s };
  }
  const PORTRAIT_W = 120, PORTRAIT_H = 112;
  function portraitFrom(im, ch) {
    let r;
    if (ch && ch.crop) {
      const [fx, fy, fw, fh] = ch.crop;
      r = { x: fx * im.naturalWidth, y: fy * im.naturalHeight, w: fw * im.naturalWidth, h: fh * im.naturalHeight };
    } else {
      r = alphaBox(im);
      // 전신 그림이면 상반신만 쓴다
      if (r.h > r.w * 1.6) r.h = r.w * 1.3;
    }
    const s = Math.min(PORTRAIT_W / r.w, PORTRAIT_H / r.h);
    // 초상화는 이미 도트 그림이라 색 수를 줄이지 않는다
    return pixelate(im, r, r.w * s, r.h * s, 0);
  }
  function coverFrom(im, w, h) {
    const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const sw = w / s, sh = h / s;
    return pixelate(im, { x: (im.naturalWidth - sw) / 2, y: (im.naturalHeight - sh) / 2, w: sw, h: sh }, w, h, 0);
  }
  function containFrom(im, w, h) {
    const r = alphaBox(im), s = Math.min(w / r.w, h / r.h);
    return pixelate(im, r, r.w * s, r.h * s, 0);
  }
  // 상태: undefined = 아직 읽는 중, null = 파일 없음
  const imgs = new Map();
  function asset(key, src, make) {
    let e = imgs.get(key);
    if (!e) {
      e = { state: 'loading', canvas: null };
      imgs.set(key, e);
      const im = new Image();
      im.onload = () => {
        try { e.canvas = make(im); e.state = 'ok'; } catch (err) { console.warn('그림 변환 실패', src, err); e.state = 'missing'; }
      };
      im.onerror = () => { e.state = 'missing'; };
      im.src = src;
    }
    return e.state === 'ok' ? e.canvas : e.state === 'missing' ? null : undefined;
  }
  // 이격 선택: 인물 id → 그림 id. 고른 버전의 그림이 없으면 기본 그림으로 돌아간다
  const SKIN_KEY = GAME + '.skins';
  let skins = {};
  try { skins = JSON.parse(localStorage.getItem(SKIN_KEY) || '{}') || {}; } catch (e) { skins = {}; }
  const alias = (id) => (S.alias && S.alias[id]) || {};
  const nameOf = (id) => alias(id).name || (CASE.chars[id] || {}).name;
  const skinOf = (id) => {
    if (alias(id).portrait) return alias(id).portrait;
    const vs = (CASE.variants || {})[id];
    return vs && vs.some((v) => v.id === skins[id]) ? skins[id] : id;
  };
  function cycleSkin(id, d) {
    const vs = CASE.variants[id];
    const i = Math.max(0, vs.findIndex((v) => v.id === skinOf(id)));
    skins[id] = vs[(i + d + vs.length) % vs.length].id;
    try { localStorage.setItem(SKIN_KEY, JSON.stringify(skins)); } catch (e) { /* 이번 판에서만 기억 */ }
    SFX.select();
  }
  function portraitImg(img, id, face) {
    const ch = CASE.chars[id];
    const c = asset(`p:${img}_${face}`, `assets/portraits/${img}_${face}.png`, (im) => portraitFrom(im, ch));
    if (c === null && face !== 'normal') return portraitImg(img, id, 'normal');
    return c;
  }
  function portrait(id, face) {
    const img = skinOf(id);
    const c = portraitImg(img, id, face);
    return c === null && img !== id && !alias(id).portrait ? portraitImg(id, id, face) : c;
  }
  // 앞으로 나올 그림을 미리 받아 둔다(2026-11-06). 그림은 처음 그릴 때 받으므로, 느린 휴대폰에서 인물이 잠깐 비어 보일 수 있다
  const AHEAD = 40;
  function prefetch() {
    const f = S.stack[S.stack.length - 1];
    if (!f) return;
    const want = (who, face) => { const ch = CASE.chars[who]; if (ch && ch.portrait !== false) portrait(who, face || 'normal'); };
    // void·nightmare·night는 그림 파일 없이 코드로 그리는 배경이다
    const wantBg = (id) => { if (id && !['void', 'nightmare', 'night'].includes(id)) asset(`bg:${id}`, `assets/bg/${id}.png`, (i) => coverFrom(i, W, H)); };
    for (const op of f.list.slice(f.pc, f.pc + AHEAD)) {
      if (op.who && !op.op) want(op.who, op.face);
      else if (op.op === 'testimony') op.statements.forEach((s) => want(op.witness, s.face));
      else if (op.op === 'bg') wantBg(op.art || op.id);
      else if (op.op === 'investigate') Object.values(op.places).forEach((p) => { wantBg(p.bg); if (p.who) want(p.who); });
    }
  }

  // ───────── 소리: 웹 오디오로 만든 짧은 칩튠 효과음 ─────────
  let AC = null, muted = false;
  try { muted = localStorage.getItem(GAME + '.mute') === '1'; } catch (e) { /* 저장소를 못 쓰면 소리 켬 */ }
  function audio() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
    if (AC && AC.state === 'suspended') AC.resume();
  }
  function tone(freq, dur, type = 'square', vol = 0.04, slide = 0, delay = 0) {
    if (!AC || muted) return;
    const t = AC.currentTime + delay, o = AC.createOscillator(), gn = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(AC.destination); o.start(t); o.stop(t + dur);
  }
  const SFX = {
    blip: (v) => tone(v, 0.035, 'square', 0.025),
    ok: () => { tone(523, 0.08); tone(659, 0.08, 'square', 0.04, 0, 0.08); tone(784, 0.16, 'square', 0.04, 0, 0.16); },
    wrong: () => tone(140, 0.35, 'sawtooth', 0.05, -60),
    stamp: () => { tone(220, 0.12, 'square', 0.06, 440); tone(880, 0.25, 'square', 0.05, 0, 0.1); },
    select: () => tone(660, 0.03, 'square', 0.03),
    give: () => { tone(784, 0.07); tone(1046, 0.14, 'square', 0.04, 0, 0.07); },
    murmur: () => { for (let i = 0; i < 6; i++) tone(180 + Math.random() * 120, 0.12, 'triangle', 0.02, -30, i * 0.07); },
    possess: () => { tone(330, 0.5, 'sine', 0.05, 330); tone(495, 0.6, 'triangle', 0.04, -200, 0.15); },
    gavel: () => { tone(110, 0.16, 'square', 0.08, -50); tone(80, 0.22, 'triangle', 0.08, -30, 0.05); },
    fanfare: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i === 5 ? 0.5 : 0.14, 'square', 0.04, 0, i * 0.14)),
  };

  // ───────── 배경음악: 8분음표 단위 칩튠 순서기(직접 작곡, 원작 음악 아님) ─────────
  // 0은 쉼표, 숫자는 MIDI 음 번호. 장면에 맞는 곡을 고르면 그 곡을 반복한다
  const MUSIC = {
    title:   { bpm: 100, mel: [67,0,72,0,74,0,76,74, 72,0,67,0,69,0,71,0, 72,0,76,0,79,0,77,76, 74,0,72,0,71,0,0,0],
               bas: [48,0,55,0,48,0,55,0, 45,0,52,0,43,0,50,0, 48,0,55,0,41,0,48,0, 43,0,50,0,43,0,50,0] },
    mystery: { bpm: 72, mel: [69,0,72,0,76,0,74,0, 72,0,69,0,67,0,0,0, 69,0,72,0,77,0,76,0, 74,0,72,0,71,0,0,0],
               bas: [45,0,0,0,45,0,0,0, 43,0,0,0,40,0,0,0, 41,0,0,0,41,0,0,0, 40,0,0,0,40,0,0,0] },
    court:   { bpm: 104, mel: [62,0,65,67,69,0,67,65, 64,0,62,0,60,62,64,0, 62,0,65,67,69,0,72,70, 69,67,65,64,62,0,0,0],
               bas: [38,0,45,0,38,0,45,0, 36,0,43,0,36,0,43,0, 38,0,45,0,38,0,45,0, 34,0,41,0,33,0,40,0] },
    invest:  { bpm: 92, mel: [72,0,76,0,79,0,76,0, 74,0,77,0,81,0,77,0, 76,0,79,0,84,0,79,0, 77,76,74,72,71,0,0,0],
               bas: [48,0,55,0,52,0,55,0, 50,0,57,0,53,0,57,0, 48,0,55,0,52,0,55,0, 43,0,50,0,43,0,47,0] },
    cross:   { bpm: 132, mel: [74,0,74,72,74,0,77,0, 76,0,74,72,69,0,0,0, 74,0,74,72,74,0,79,0, 77,76,74,72,74,0,0,0],
               bas: [38,38,0,38,38,0,38,0, 36,36,0,36,36,0,36,0, 34,34,0,34,34,0,34,0, 33,33,0,33,40,0,40,0] },
    danger:  { bpm: 150, mel: [69,0,70,0,69,0,68,0, 69,0,0,69,72,0,71,0, 69,0,70,0,69,0,68,0, 65,0,64,0,63,0,64,0],
               bas: [45,45,45,45,45,45,45,45, 46,46,46,46,46,46,46,46, 45,45,45,45,45,45,45,45, 40,40,40,40,40,40,40,40] },
  };
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const music = { id: null, step: 0, next: 0 };
  function noteAt(freq, t, dur, type, vol) {
    const o = AC.createOscillator(), gn = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function wantedMusic() {
    if (muted) return null;
    if (S.scene === 'title' || S.scene === 'skins' || S.scene === 'select' || S.scene === 'dex') return 'title';
    if (S.scene !== 'play' || S.mode === 'chapter') return null;
    if (S.inv) return 'invest';
    if (S.bg === 'void' || S.bg === 'nightmare' || S.bg === 'night') return 'mystery';
    if (S.bg === 'lobby' || S.bg === 'epi_plaza' || S.bg === 'rooftop') return 'title'; // 에필로그는 잔잔한 곡
    const fight = S.mode === 'cross' || (S.overlay && S.overlay.purpose !== 'view') || S.demand;
    if (S.patience <= 2 && (fight || S.test)) return 'danger';
    if (fight) return 'cross';
    return 'court';
  }
  // 0.25초 앞까지 음을 미리 예약한다(프레임이 늦어도 박자가 흔들리지 않게)
  setInterval(() => {
    if (!AC || AC.state !== 'running') return;
    const want = wantedMusic();
    if (want !== music.id) { music.id = want; music.step = 0; music.next = AC.currentTime + 0.05; }
    if (!want) return;
    const tr = MUSIC[want], dt = 60 / tr.bpm / 2;
    while (music.next < AC.currentTime + 0.25) {
      const m = tr.mel[music.step % tr.mel.length], b = tr.bas[music.step % tr.bas.length];
      if (m) noteAt(midi(m), music.next, dt * 0.9, 'square', 0.018);
      if (b) noteAt(midi(b), music.next, dt * 1.6, 'triangle', 0.03);
      music.step++; music.next += dt;
    }
  }, 60);

  // ───────── 데이터 점검: 시나리오를 손으로 고칠 때 깨진 연결을 바로 알려 준다 ─────────
  const labels = new Map();
  CASE.script.forEach((op, i) => { if (op.op === 'label') labels.set(op.id, i); });
  const dataErrors = [];
  (function check() {
    const needLabel = (id, where) => { if (!labels.has(id)) dataErrors.push(`없는 label '${id}' (${where})`); };
    const needEv = (id, where) => { if (!CASE.evidence[id]) dataErrors.push(`없는 증거 '${id}' (${where})`); };
    const needChar = (id, where) => { if (id && !CASE.chars[id]) dataErrors.push(`없는 인물 '${id}' (${where})`); };
    (CASE.startEvidence || []).forEach((id) => needEv(id, 'startEvidence'));
    const walk = (list, where) => list.forEach((op, i) => {
      const at = `${where}#${i}`;
      if (op.who) needChar(op.who, at);
      if (op.op === 'goto') needLabel(op.id, at);
      if (op.op === 'choice') (op.options || []).forEach((o, k) => { if (o.wrong) walk(o.wrong, `${at}.opt${k}`); else needLabel(o.goto, at); });
      if (op.op === 'possess') { needChar(op.who || 'medium', at); if (op.as) needChar(op.as, at); }
      if (op.op === 'alias') needChar(op.who, at);
      if (op.op === 'label' && /^(trial|epilogue)/.test(op.id) && !(CASE.trials || []).some((t) => t.label === op.id)) dataErrors.push(`심 선택에 없는 label '${op.id}' (${at})`);
      if (op.op === 'give') needEv(op.id, at);
      if (op.op === 'demand') { needEv(op.answer, at); needLabel(op.ok, at); needChar(op.who, at); walk(op.wrong || [], at + '.wrong'); }
      if (op.op === 'investigate') {
        if (!op.places || !op.places[op.start]) dataErrors.push(`조사 시작 장소 '${op.start}'가 없음 (${at})`);
        for (const [pid, pl] of Object.entries(op.places || {})) {
          const pat = `${at}.${pid}`;
          needChar(pl.who, pat);
          (pl.needs || []).forEach((id) => needEv(id, pat));
          (pl.move || []).forEach((m) => { if (!op.places[m]) dataErrors.push(`없는 장소 '${m}' (${pat}.move)`); });
          walk(pl.enter || [], pat + '.enter');
          (pl.spots || []).forEach((s, k) => { (s.needs || []).forEach((id) => needEv(id, `${pat}.spot${k}`)); walk(s.lines || [], `${pat}.spot${k}`); walk(s.again || [], `${pat}.spot${k}.again`); });
          (pl.talk || []).forEach((s, k) => { (s.needs || []).forEach((id) => needEv(id, `${pat}.talk${k}`)); walk(s.lines || [], `${pat}.talk${k}`); walk(s.again || [], `${pat}.talk${k}.again`); });
        }
        ((op.done && op.done.needs) || []).forEach((id) => needEv(id, at + '.done'));
        walk((op.done && op.done.lines) || [], at + '.done');
      }
      if (op.op === 'testimony') {
        needChar(op.witness, at);
        walk(op.wrong || [], at + '.wrong');
        walk(op.after || [], at + '.after');
        walk(op.loop || [], at + '.loop');
        op.statements.forEach((st, k) => {
          walk(st.press || [], `${at}.s${k + 1}.press`);
          for (const [ev, lb] of Object.entries(st.present || {})) { needEv(ev, `${at}.s${k + 1}`); needLabel(lb, `${at}.s${k + 1}`); }
        });
      }
    });
    walk(CASE.script, 'script');
    if (dataErrors.length) console.error('시나리오 데이터 오류', dataErrors);
  })();

  // ───────── 상태 ─────────
  const S = {
    scene: 'title', // title | play | over | end
    stack: [], ev: [], patience: 5, saved: null,
    mode: 'idle', // line | cross | chapter | testTitle | stamp | idle
    line: null, portrait: null, test: null, overlay: null, demand: null,
    chapter: null, testTitle: null, end: null, hinted: false,
    bg: 'court', pocket: null, pockets: 0, // pocket = 주머니에서 막 나온 증거품 카드
    fx: { shake: 0, flash: 0, stamp: null, murmur: null }, t: 0,
    choice: null, log: [], logView: null, stats: null, toast: null,
    inv: null, // 조사 파트: { op, place, seen, talked, visited, menu, sel, acts }
    from: null, // 이번 판을 시작한 심(trial1… / 새로 시작이면 trial1). 엔딩 집계에 붙인다
    evBase: 0, // 지금 심이 시작될 때의 증거 수. 증거 목록은 이 뒤(지금 심의 증거)를 먼저 보여 준다
  };
  const TRIAL_LABELS = new Set((CASE.trials || []).map((t) => t.label));
  // 증거품을 받을 때 변호인이 하는 말(차례로 돌아가며 씀). 명령에 line이 있으면 그것을 쓴다
  const POCKET_LINES = [
    '(…증거품? 이게 왜 내 주머니에 있지?)',
    '(또 주머니에서 뭔가 나왔다. 이 세계의 주머니는 대체 어떻게 된 거야?)',
    '(넣은 기억이 없는데… 주머니가 알아서 증거를 모으나?)',
    '(주머니가 묵직하다. …설마 또?)',
  ];
  const FIND_LINES = ['(…이건 증거가 될 것 같다. 챙겨 두자.)', '(이것도 챙겨 두자. 법정에서 쓸 수 있을지도 모른다.)', '(좋아, 하나 더 찾았다.)'];
  try { S.saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { S.saved = null; }
  // 수동 저장 3칸: 자동 저장(이어하기)과 따로 둔다. 대본이 바뀌면 pc가 어긋나므로 같은 대본 해시만 읽는다
  const SLOTS = 3, slotKey = (i) => `${GAME}.slot${i + 1}.v2.${scriptHash}`;
  S.slots = Array.from({ length: SLOTS }, (_, i) => { try { return JSON.parse(localStorage.getItem(slotKey(i)) || 'null'); } catch (e) { return null; } });

  // ───────── 진행기: 명령을 차례로 실행하다가 입력을 기다리는 명령에서 멈춘다 ─────────
  function step() {
    for (;;) {
      const f = S.stack[S.stack.length - 1];
      if (!f) return;
      if (f.pc >= f.list.length) {
        if (S.stack.length === 1) return; // 본 시나리오가 끝까지 감
        S.stack.pop();
        if (f.onDone) { f.onDone(); return; }
        continue;
      }
      const op = f.list[f.pc++];
      if (exec(op)) return;
    }
  }
  function sub(list, onDone) { S.stack.push({ list: list.filter((l) => !l.easy || difficulty === 'easy'), pc: 0, onDone }); step(); }
  function jumpTo(id) {
    S.stack.length = 1;
    S.stack[0].pc = labels.get(id) + 1;
    S.test = null; S.demand = null; S.overlay = null; S.mode = 'idle';
  }
  // 참을 돌려주면 입력을 기다린다
  function exec(op) {
    if (op.who !== undefined && !op.op) { startLine(op); return true; }
    switch (op.op) {
      case 'label':
        if (TRIAL_LABELS.has(op.id)) { S.evBase = S.ev.length; stat('reach_' + op.id); }
        return false;
      case 'goto': jumpTo(op.id); return false;
      case 'hide': S.portrait = null; return false;
      // 별칭: { op: 'alias', who, portrait, name, voice } — 그림 id·이름을 바꿈. portrait 없이 쓰면 원래대로
      case 'alias': {
        S.alias = { ...(S.alias || {}) };
        if (op.portrait || op.name) S.alias[op.who] = { portrait: op.portrait, name: op.name, voice: op.voice }; else delete S.alias[op.who];
        return false;
      }
      // 빙의: { op: 'possess', who: 'medium', as: 'redhood' } — 옷은 그대로, 체형·얼굴만 그 인물(그림 = <who>_<as>_<표정>.png). as: null 이면 풀림
      case 'possess': {
        S.alias = { ...(S.alias || {}) };
        const who = op.who || 'medium', base = CASE.chars[who];
        if (op.as) {
          const tg = CASE.chars[op.as];
          S.alias[who] = { portrait: `${who}_${op.as}`, name: `${base.name}(${tg.name})`, voice: tg.voice };
          S.fx.flash = 0.8; S.fx.shake = 0.3; SFX.possess();
        } else { delete S.alias[who]; S.fx.flash = 0.4; SFX.select(); }
        S.portrait = { id: who, face: op.face || 'normal' };
        return false;
      }
      case 'fx':
        if (op.kind === 'shake') S.fx.shake = 0.35;
        if (op.kind === 'flash') S.fx.flash = 1;
        if (op.kind === 'murmur') { S.fx.murmur = { t: 1.6, text: op.text || '웅성웅성…' }; SFX.murmur(); }
        if (op.kind === 'gavel') { S.fx.shake = 0.25; S.fx.flash = 0.35; SFX.gavel(); }
        if (op.kind === 'stamp') { S.fx.stamp = { text: op.text, t: 1.1, color: op.color }; S.mode = 'stamp'; SFX.stamp(); return true; }
        return false;
      case 'give': {
        if (S.ev.includes(op.id)) return false; // 같은 캐묻기를 다시 해도 한 번만 받는다
        S.ev.push(op.id);
        SFX.give();
        // 증거품이 변호인 주머니에서 '저절로' 나오는 연출: 카드를 띄우고 변호인이 놀란다
        S.pocket = { id: op.id, t: 0 };
        const nm = CASE.evidence[op.id].name, pt = josa(nm, '을', '를').slice(nm.length);
        const got = { who: null, color: COL.gold, line: `「${nm}」${pt} 증거 목록에 넣었다.` };
        // CASE.pocket === false 인 게임은 주머니 개그 없이, 언제나 '건네받거나 찾은' 증거로 보여 준다
        const found = S.inv || CASE.pocket === false;
        const auto = found ? FIND_LINES[S.pockets++ % FIND_LINES.length] : POCKET_LINES[S.pockets++ % POCKET_LINES.length];
        const react = op.line === false ? [] : [{ who: 'me', face: op.face || (found ? 'confident' : 'shock'), line: op.line || auto }];
        sub([...react, got], () => { S.pocket = null; step(); });
        return true;
      }
      // art: 같은 장소를 다른 그림으로 보여 줄 때(에필로그의 꽃 핀 광장 등). id는 저장 뼈대에 들어가므로 바꾸지 않고 art만 더한다
      case 'bg': S.bg = op.art || op.id; if ((CASE.cg || []).includes(S.bg)) S.portrait = null; return false;
      // 저장 지점(모순을 하나 풀 때마다)에서 하트를 다시 채운다. 앞 증언의 실수가 뒤 증언까지 이어지지 않게
      case 'save': S.patience = maxPatience(); save(); return false;
      case 'chapter': S.portrait = null; S.chapter = op; S.mode = 'chapter'; return true;
      case 'testimony': startTestimony(op); return true;
      case 'investigate': startInvestigate(op); return true;
      case 'demand':
        S.demand = op;
        sub([{ who: op.who, face: op.face, line: op.line }], () => openOverlay('demand'));
        return true;
      case 'end': S.scene = 'end'; S.end = op; lockInput(); clearSave(); stat('finish'); stat('finish_' + (S.from || 'unknown'));
        if (op.result === 'win') {
          SFX.fanfare(); cleared = true; shareFile = null; // 결과 그림은 이번 기록으로 새로 만든다
          try { localStorage.setItem(CLEAR_KEY, '1'); } catch (e) { /* 이번 판에서만 */ }
        }
        return true;
      case 'choice': S.choice = { op, sel: 0 }; S.mode = 'choice'; return true;
      default: console.warn('모르는 명령', op); return false;
    }
  }

  // ───────── 대사 ─────────
  const LINE_W = 296, LINES = 3, CPS = 45;
  function startLine(op) {
    prefetch();
    const ch = op.who ? CASE.chars[op.who] : null;
    if (ch && ch.portrait !== false && !(CASE.cg || []).includes(S.bg)) S.portrait = { id: op.who, face: op.face || 'normal' };
    const think = op.who === 'me' && op.line.startsWith('(');
    const all = wrap(op.line, LINE_W);
    const pages = [];
    for (let i = 0; i < all.length; i += LINES) pages.push(all.slice(i, i + LINES));
    S.line = {
      who: op.who, name: ch ? nameOf(op.who) : null, voice: ch ? (alias(op.who).voice || ch.voice) : 500,
      color: op.color || (op.testimony ? COL.testimony : think ? COL.think : COL.text),
      pages, page: 0, shown: 0, lastBlip: 0, raw: op.line,
    };
    S.mode = 'line';
    // 대사 기록: 지나간 대사를 다시 읽을 수 있게 남긴다(최근 300줄)
    S.log.push({ name: ch ? nameOf(op.who) : null, text: op.line, color: S.line.color });
    if (S.log.length > 300) S.log.shift();
  }
  // 글꼴이 늦게 로드되면 글자 폭이 바뀌므로 지금 대사의 줄바꿈을 다시 계산한다
  function rewrapLine() {
    const l = S.line;
    if (!l) return;
    const all = wrap(l.raw, LINE_W), pages = [];
    for (let i = 0; i < all.length; i += LINES) pages.push(all.slice(i, i + LINES));
    l.pages = pages; l.page = Math.min(l.page, pages.length - 1); l.shown = Math.min(l.shown, pageLen(l));
  }
  const pageLen = (l) => l.pages[l.page].reduce((n, s) => n + [...s].length, 0);
  function advanceLine() {
    const l = S.line;
    if (l.shown < pageLen(l)) { l.shown = pageLen(l); return; }
    if (l.page < l.pages.length - 1) { l.page++; l.shown = 0; l.lastBlip = 0; return; }
    S.line = null; S.mode = 'idle';
    step();
  }

  // ───────── 증언과 신문 ─────────
  function startTestimony(op) {
    S.test = { op, idx: 0 };
    S.testTitle = { title: op.title, t: 1.6 };
    S.mode = 'testTitle';
  }
  function afterTestTitle() {
    const op = S.test.op;
    const lines = op.statements.map((st) => ({ who: op.witness, face: st.face, line: st.line, testimony: true }));
    lines.push(...(op.after || [])); // 증언을 다 들은 뒤: 변호인의 고민, 검사의 도발
    if (!S.hinted) {
      S.hinted = true;
      lines.push({ who: null, color: COL.gold, line: '신문을 시작한다. ◀ ▶로 증언을 넘기고, 수상한 말은 캐묻거나 어긋나는 증거를 내자.' });
    }
    sub(lines, enterCross);
  }
  function enterCross() {
    const t = S.test, st = t.op.statements[t.idx];
    S.portrait = { id: t.op.witness, face: st.face || 'normal' };
    S.mode = 'cross';
  }
  function crossMove(d) {
    if (S.mode !== 'cross') return;
    const t = S.test, n = t.op.statements.length;
    const wrapped = d > 0 && t.idx === n - 1;
    t.idx = (t.idx + d + n) % n;
    SFX.select();
    // 마지막 증언에서 처음으로 넘어가면, 증언마다 한 번 변호인이 고민한다
    const pr = CASE.pressure || {};
    if (wrapped && !t.looped && (t.op.loop || pr.loop)) {
      t.looped = true;
      S.mode = 'idle';
      sub(t.op.loop || pick(pr.loop, 'loop'), enterCross);
      return;
    }
    enterCross();
  }
  function crossPress() {
    if (S.mode !== 'cross') return; // 같은 순간 두 번 눌러도 한 번만
    const t = S.test, st = t.op.statements[t.idx];
    const press = st.press && st.press.length ? st.press : [{ who: t.op.witness, line: '더 할 말은 없어요.' }];
    S.mode = 'idle';
    sub(press, enterCross);
  }
  // 틀릴 때마다 변호인이 속으로 힌트를 말한다. 같은 증언에서 여러 번 틀리면 더 분명한 힌트로 넘어간다
  let wrongCount = new WeakMap();
  function hintFor(op) {
    const hs = op && op.hints && op.hints.slice(0, DIFFS[difficulty].hints);
    if (!hs || !hs.length) return [];
    S.stats.hints++;
    const n = wrongCount.get(op) || 0;
    wrongCount.set(op, n + 1);
    return [{ who: 'me', line: hs[Math.min(n, hs.length - 1)] }];
  }
  // 같은 경고가 되풀이되지 않게 차례로 돌려 쓴다
  const pickN = {};
  function pick(list, key) {
    const n = pickN[key] || 0;
    pickN[key] = n + 1;
    return list[n % list.length];
  }
  function warnFor(left) {
    const ws = (CASE.pressure || {})[left];
    return ws && ws.length ? pick(ws, 'w' + left) : [];
  }
  function wrong(lines, then, op) {
    S.patience = Math.max(0, S.patience - 1);
    S.fx.shake = 0.4; SFX.wrong();
    S.stats.wrongs++;
    S.fx.murmur = { t: 1.4, text: '수군수군…' }; // 방청석이 웃음 섞인 반응
    const ls = lines && lines.length ? lines : [{ who: 'judge', line: '그 증거로는 아무것도 증명되지 않습니다.' }];
    S.overlay = null; S.mode = 'idle';
    sub(S.patience > 0 ? [...ls, ...warnFor(S.patience), ...hintFor(op)] : ls, () => { if (S.patience <= 0) gameOver(); else then(); });
  }
  // 아깝게 틀렸을 때 변호인의 혼잣말(2026-11-06). 쉬움은 둘 다, 보통은 '증거는 맞고 문장이 다름'만, 어려움은 없음
  const NEAR_EV = ['(증거는 제대로 고른 것 같다. 겨눌 증언이 다르다.)', '(이 증거가 쓰일 곳은 이 문장이 아니다. 다른 증언을 다시 보자.)'];
  const NEAR_ST = ['(이 증언이 걸리는 건 맞다. …하지만 이 증거로는 찌를 수 없다.)', '(수상한 말은 이게 맞다. 맞는 증거를 다시 찾자.)'];
  function nearMiss(st, id) {
    if (difficulty === 'hard') return [];
    const other = S.test.op.statements.some((s) => s !== st && s.present && s.present[id]);
    if (other) return [{ who: 'me', line: pick(NEAR_EV, 'nearEv') }];
    if (st.present && difficulty === 'easy') return [{ who: 'me', line: pick(NEAR_ST, 'nearSt') }];
    return [];
  }
  function present(id) {
    const ov = S.overlay;
    if (!ov || id === undefined) return; // 이미 닫혔거나(두 번 누름) 낼 증거가 없음
    if (ov.purpose === 'cross') {
      const st = S.test.op.statements[S.test.idx];
      const to = st.present && st.present[id];
      if (to) { S.overlay = null; jumpTo(to); SFX.ok(); step(); } else wrong([...(S.test.op.wrong || []), ...nearMiss(st, id)], enterCross, S.test.op);
    } else if (ov.purpose === 'demand') {
      const d = S.demand;
      if (id === d.answer) { S.overlay = null; jumpTo(d.ok); SFX.ok(); step(); } else wrong(d.wrong, () => openOverlay('demand'), d);
    }
  }

  // ───────── 증거 목록 ─────────
  // 지금 보이는 증거: 기본은 지금 심에서 모은 것, old면 앞 심에서 모은 것(앞 심 증거로 푸는 문제는 없다, 2026-11-06 확인)
  const evList = (ov) => (ov && ov.old ? S.ev.slice(0, S.evBase) : S.ev.slice(S.evBase));
  function toggleOldEv() {
    const ov = S.overlay;
    if (!ov || !S.evBase) return;
    ov.old = !ov.old; ov.sel = 0; ov.page = 0; SFX.select();
  }
  function openOverlay(purpose) {
    if (S.overlay) return;
    S.overlay = { purpose, sel: 0, old: false }; // purpose: view | cross | demand
    if (S.mode !== 'line' && S.mode !== 'inv') S.mode = 'idle';
    SFX.select();
  }
  function closeOverlay() {
    const ov = S.overlay;
    if (!ov || ov.purpose === 'demand') return;
    S.overlay = null;
    if (ov.purpose === 'cross') enterCross();
  }

  // ───────── 조사 파트: 장소를 옮겨 다니며 살펴보고 사람과 이야기해 증거를 모은다 ─────────
  let pendingInv = null; // 이어하기: 조사 도중에 저장한 상태
  const evHas = (needs) => !needs || needs.every((id) => S.ev.includes(id));
  function startInvestigate(op) {
    const r = pendingInv && pendingInv.id === op.id ? pendingInv : null;
    pendingInv = null;
    S.inv = { op, place: r ? r.place : op.start, seen: r ? { ...r.seen } : {}, talked: r ? { ...r.talked } : {}, visited: r ? [...r.visited] : [], menu: 'main', sel: 0, acts: [] };
    enterPlace(S.inv.place);
  }
  const invPlace = () => S.inv.op.places[S.inv.place];
  function enterPlace(pid) {
    const inv = S.inv, pl = inv.op.places[pid];
    inv.place = pid; S.bg = pl.bg; S.portrait = null;
    const first = !inv.visited.includes(pid);
    if (first) inv.visited.push(pid);
    if (first && pl.enter && pl.enter.length) { S.mode = 'idle'; sub(pl.enter, () => invMenu('main')); } else invMenu('main');
  }
  function invMenu(menu) {
    const inv = S.inv, pl = invPlace();
    inv.menu = menu; inv.sel = 0;
    // 살펴보기 중에는 배경이 다 보이게 인물을 숨긴다
    S.portrait = menu === 'examine' || !pl.who ? null : { id: pl.who, face: pl.face || 'normal' };
    S.mode = 'inv';
    save();
  }
  // 보이는 지점·주제는 필요한 증거를 가졌을 때만 열린다. key는 저장에 쓰는 이름
  const invSpots = () => (invPlace().spots || []).map((s, i) => ({ s, key: `${S.inv.place}:${i}` })).filter((x) => evHas(x.s.needs));
  const invTopics = () => (invPlace().talk || []).map((s, i) => ({ s, key: `${S.inv.place}:t${i}` })).filter((x) => evHas(x.s.needs));
  const invMoves = () => (invPlace().move || Object.keys(S.inv.op.places).filter((k) => k !== S.inv.place)).filter((k) => evHas(S.inv.op.places[k].needs));
  const invReady = () => evHas(S.inv.op.done.needs);
  function invRun(x, book, back) {
    if (S.mode !== 'inv') return;
    const again = S.inv[book][x.key];
    S.inv[book][x.key] = true;
    S.mode = 'idle'; SFX.select();
    sub(again && x.s.again ? x.s.again : x.s.lines, () => invMenu(back));
  }
  const examine = (x) => invRun(x, 'seen', 'examine');
  const talk = (x) => invRun(x, 'talked', 'talk');
  function moveTo(pid) { if (S.mode !== 'inv') return; SFX.select(); S.mode = 'idle'; enterPlace(pid); }
  function finishInv() {
    if (S.mode !== 'inv' || !invReady()) return;
    const op = S.inv.op;
    S.mode = 'idle'; SFX.ok();
    sub(op.done.lines || [], () => { S.inv = null; S.portrait = null; step(); });
  }
  function invKey(k) {
    const inv = S.inv, acts = inv.acts, n = acts.length;
    const moveSel = (d) => { for (let i = 0; i < n; i++) { inv.sel = (inv.sel + d + n) % n; if (acts[inv.sel]) break; } SFX.select(); };
    if (n && (k === 'ArrowUp' || k === 'ArrowLeft')) moveSel(-1);
    else if (n && (k === 'ArrowDown' || k === 'ArrowRight')) moveSel(1);
    else if (k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') { const f = acts[inv.sel]; if (f) f(); }
    else if ((k === 'Escape' || k === 'x' || k === 'X') && inv.menu !== 'main') { invMenu('main'); SFX.select(); }
    else if (k === 'e' || k === 'E') openOverlay('view');
  }

  // ───────── 저장 1칸 ─────────
  function snapshot() {
    const inv = S.inv && { id: S.inv.op.id, place: S.inv.place, seen: { ...S.inv.seen }, talked: { ...S.inv.talked }, visited: [...S.inv.visited] };
    return { pc: S.stack[0].pc, ev: [...S.ev], patience: S.patience, hinted: S.hinted, bg: S.bg, pockets: S.pockets, stats: { ...S.stats }, inv, alias: { ...(S.alias || {}) }, name: playerName, diff: difficulty, from: S.from, evBase: S.evBase };
  }
  function save() {
    S.saved = snapshot();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S.saved)); } catch (e) { /* 저장소를 못 쓰면 이번 판에서만 기억 */ }
  }
  // 수동 저장: 지금 보고 있는 대사·증언·선택지를 불러온 뒤 다시 보여 주도록 pc를 한 칸 되돌린다(조사 중이면 begin이 처리)
  function canSlotSave() { return S.scene === 'play' && !S.overlay && !S.logView && ['line', 'cross', 'choice', 'inv', 'chapter', 'testTitle'].includes(S.mode); }
  function trialOf(pc) {
    let cur = null;
    (CASE.trials || []).forEach((t) => { const at = labels.get(t.label); if (at !== undefined && at <= pc) cur = t; });
    return cur ? cur.title : '';
  }
  function saveSlot(i) {
    const snap = snapshot();
    if (!snap.inv && S.mode !== 'idle') snap.pc = Math.max(0, snap.pc - 1);
    snap.when = Date.now(); snap.where = trialOf(snap.pc);
    S.slots[i] = snap;
    try { localStorage.setItem(slotKey(i), JSON.stringify(snap)); } catch (e) { /* 저장소를 못 쓰면 이번 판에서만 기억 */ }
    S.slotView = null; S.toast = { t: 1.6, text: `${i + 1}번 칸에 저장했습니다` }; SFX.ok();
  }
  function loadSlot(i) {
    const snap = S.slots[i];
    if (!snap) return;
    S.slotView = null; SFX.select();
    begin(snap);
  }
  function openSlots(mode) {
    if (mode === 'save' && !canSlotSave()) return;
    S.slotView = { mode, sel: 0, from: S.slotView && S.slotView.mode === 'menu' ? 'menu' : null }; SFX.select();
  }
  // 게임 중 메뉴: 저장하기 · 불러오기 · 타이틀로 · 닫기
  function openMenu() {
    if (S.scene !== 'play' || S.overlay || S.logView || S.slotView) return;
    S.slotView = { mode: 'menu', sel: 0 }; SFX.select();
  }
  const MENU = [
    ['저장하기', () => openSlots('save'), () => canSlotSave()],
    ['불러오기', () => openSlots('load'), () => true],
    ['타이틀로', () => { S.slotView = { mode: 'quit', sel: 0 }; SFX.select(); }, () => true],
    ['설문 보내기', openSurvey, () => true],
    ['닫기', () => { S.slotView = null; }, () => true],
  ];
  function slotBack() { S.slotView = S.slotView && S.slotView.from === 'menu' ? { mode: 'menu', sel: 0 } : null; }
  function quitToTitle() { S.slotView = null; S.logView = null; S.overlay = null; SFX.select(); toTitle(); }
  function slotLabel(i) {
    const s = S.slots[i];
    if (!s) return `${i + 1}번 칸 · 비어 있음`;
    const d = new Date(s.when || 0), z = (n) => String(n).padStart(2, '0');
    return `${i + 1}번 칸 · ${s.where || '처음'} · ${s.name || ''} · ${z(d.getMonth() + 1)}/${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
  }
  function clearSave() {
    S.saved = null;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ }
  }
  function begin(from) {
    if (CASE.askName) applyName(from && from.name ? from.name : playerName);
    if (from && DIFFS[from.diff]) difficulty = from.diff;
    S.scene = 'play';
    if (!from) wrongCount = new WeakMap(); // 새 게임이면 힌트 단계도 처음부터
    // 조사 도중에 저장했다면 조사 명령부터 다시 실행해, 본 곳·나눈 이야기를 되살린다
    pendingInv = from && from.inv ? from.inv : null;
    S.stack = [{ list: CASE.script, pc: from ? from.pc - (from.inv ? 1 : 0) : 0 }];
    S.inv = null;
    S.ev = from ? [...from.ev] : [...(CASE.startEvidence || [])];
    S.patience = maxPatience(); // 이어하기·다시하기 모두 하트를 채워서 시작
    S.stats = from && from.stats ? { ...from.stats } : { wrongs: 0, hints: 0, overs: 0, sec: 0 };
    S.choice = null; S.logView = null; S.slotView = null; S.fx.murmur = null;
    if (!from) S.log = [];
    S.hinted = from ? !!from.hinted : false;
    S.bg = (from && from.bg) || 'court';
    S.pockets = (from && from.pockets) || 0;
    S.alias = from && from.alias ? { ...from.alias } : {};
    // 옛 저장에는 시작한 심·증거 기준점이 없다: 엔딩은 unknown으로, 증거 목록은 전부 지금 심 것으로 본다
    S.from = from ? from.from || null : 'trial1';
    S.evBase = from && from.evBase <= S.ev.length ? from.evBase : 0;
    S.pocket = null;
    S.line = null; S.portrait = null; S.test = null; S.overlay = null; S.demand = null;
    S.mode = 'idle';
    step();
  }
  function gameOver() { S.scene = 'over'; S.overlay = null; S.mode = 'idle'; S.stats.overs++; lockInput(); }
  // 엔딩·패소·타이틀로 바뀐 직후 Enter 연타로 화면이 건너뛰어지지 않게 잠깐 입력을 막는다
  let lockUntil = 0;
  function lockInput() { lockUntil = performance.now() + 600; }
  let started = false; // 첫 화면을 그리기 전에는 입력을 받지 않는다

  // ───────── 입력 ─────────
  let B = [];
  const pointer = { x: -1, y: -1 };
  function button(x, y, w, h, label, fn, o = {}) {
    const hot = !o.off && (o.sel || (pointer.x >= x && pointer.x < x + w && pointer.y >= y && pointer.y < y + h));
    g.fillStyle = o.off ? '#2a2838' : hot ? COL.gold : (o.bg || COL.box);
    g.fillRect(x, y, w, h);
    g.fillStyle = o.off ? '#3a3850' : COL.gold;
    g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
    text(label, x + w / 2, y + Math.floor((h - 14 * (o.scale || 1)) / 2) + 1, o.off ? COL.dim : hot ? COL.ink : COL.text, { align: 'center', scale: o.scale });
    if (!o.off) B.push({ x, y, w, h, fn, onUp: o.onUp });
  }
  function toBase(e) {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  }
  cv.addEventListener('pointermove', (e) => { const p = toBase(e); pointer.x = p.x; pointer.y = p.y; });
  cv.addEventListener('pointerleave', () => { pointer.x = pointer.y = -1; });
  // 손가락을 떼면 강조 표시를 지운다(마우스와 달리 위치가 남지 않게)
  cv.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') pointer.x = pointer.y = -1; });
  document.addEventListener('pointerdown', (e) => {
    if (nameBox || surveyBox) return; // 이름·설문 창을 누를 때는 게임 입력으로 쓰지 않는다(입력칸에 글자를 쓸 수 있게)
    e.preventDefault();
    if (!started || (S.scene !== 'play' && performance.now() < lockUntil)) return;
    audio();
    if (portraitHeld()) { if (canFull && !isFull()) goFull(); return; }
    const p = toBase(e); pointer.x = p.x; pointer.y = p.y;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i];
      if (p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h) { if (b.onUp) upBtn = b; else b.fn(); return; }
    }
    confirm();
  });
  // 공유 창처럼 '사용자 동작' 안에서만 열리는 기능은 손가락을 뗄 때 실행한다(휴대폰은 누르는 순간을 동작으로 치지 않음)
  let upBtn = null;
  document.addEventListener('pointerup', (e) => {
    const b = upBtn; upBtn = null;
    if (!b || nameBox || surveyBox) return;
    const p = toBase(e);
    if (p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h) b.fn();
  });
  function confirm() {
    if (S.scene !== 'play' || S.overlay || S.logView || S.slotView || S.mode === 'choice') return;
    if (S.mode === 'line') advanceLine();
    else if (S.mode === 'chapter') { S.chapter = null; S.mode = 'idle'; step(); }
    else if (S.mode === 'testTitle') { S.testTitle = null; S.mode = 'idle'; afterTestTitle(); }
    else if (S.mode === 'stamp') { S.fx.stamp = null; S.mode = 'idle'; step(); }
    else if (S.mode === 'cross') crossMove(1); // 신문 중에 화면을 누르면 다음 증언으로
  }
  let nameBox = null;
  function startAt(label) {
    // 새로 시작도 시작으로 센다(2026-11-06 전에는 심 선택만 셌음)
    if (!label) { begin(null); stat('start'); stat('from_new'); return; }
    wrongCount = new WeakMap();
    begin({ pc: labels.get(label), ev: [], bg: 'court', stats: { wrongs: 0, hints: 0, overs: 0, sec: 0 }, hinted: true, from: label });
    stat('start'); stat('from_' + label);
  }
  function startNew(label) {
    if (!CASE.askName || !document.body) { startAt(label); return; }
    if (nameBox) return;
    stat('namebox');
    nameBox = document.createElement('div');
    nameBox.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(7,6,12,.78);z-index:10;font-family:Galmuri11,sans-serif';
    // 글자 크기는 화면 너비를 따라간다(휴대폰 가로 화면에서도, FHD 모니터에서도 읽기 좋게)
    nameBox.innerHTML = '<form style="font-size:clamp(15px,2.3vw,44px);background:#10101c;border:0.15em solid #e8c060;padding:1em 1.4em;display:flex;flex-direction:column;gap:0.6em;align-items:center;color:#f4f0e6">' +
      '<div style="color:#e8c060;font-size:1.2em">이름을 적어 주세요</div>' +
      '<div style="font-size:0.7em;color:#8a86a8">게임 속 인물들이 이 이름으로 부릅니다</div>' +
      '<input maxlength="8" style="font:inherit;font-size:1.2em;width:9em;text-align:center;padding:0.25em;background:#07060c;color:#f4f0e6;border:0.1em solid #8a86a8">' +
      '<div style="color:#e8c060;margin-top:0.4em">난이도</div><div class="diffs" style="display:flex;gap:0.4em">' +
      Object.entries(DIFFS).map(([k, d]) => `<button type="button" data-d="${k}" style="font:inherit;font-size:0.85em;padding:0.2em 0.8em;border:0.1em solid #8a86a8;background:#07060c;color:#f4f0e6">${d.label}</button>`).join('') +
      '</div><div class="diffnote" style="font-size:0.65em;color:#8a86a8;min-height:1.2em"></div>' +
      '<button style="font:inherit;padding:0.25em 1.6em;background:#e8c060;color:#0d0b14;border:0">시작</button></form>';
    document.body.appendChild(nameBox);
    const input = nameBox.querySelector('input');
    input.value = playerName;
    let pickDiff = difficulty;
    const NOTE = { easy: '하트 7개 · 틀리면 힌트 2단계 · 변호인의 혼잣말이 많음', normal: '하트 5개 · 틀리면 힌트 1단계', hard: '하트 3개 · 힌트 없음' };
    const paint = () => {
      nameBox.querySelectorAll('[data-d]').forEach((b) => { const on = b.dataset.d === pickDiff; b.style.background = on ? '#e8c060' : '#07060c'; b.style.color = on ? '#0d0b14' : '#f4f0e6'; });
      nameBox.querySelector('.diffnote').textContent = NOTE[pickDiff];
    };
    nameBox.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => { pickDiff = b.dataset.d; paint(); }));
    paint();
    nameBox.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const n = input.value.trim() || DEFAULT_NAME;
      difficulty = pickDiff;
      try { localStorage.setItem(NAME_KEY, n); localStorage.setItem(DIFF_KEY, difficulty); } catch (err) { /* 이번 판에서만 */ }
      nameBox.remove(); nameBox = null;
      applyName(n); startAt(label);
    });
    setTimeout(() => { input.focus(); input.select(); }, 30);
  }
  // ───────── 짧은 설문(2026-11-06): 게임 중 메뉴·엔딩 화면에서 연다. /api/survey로 보낸다 ─────────
  let surveyBox = null;
  function openSurvey() {
    if (surveyBox || !document.body) return;
    S.slotView = null;
    surveyBox = document.createElement('div');
    surveyBox.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(7,6,12,.82);z-index:10;font-family:Galmuri11,sans-serif';
    const pill = (name, v, label) => `<button type="button" data-${name}="${v}" style="font:inherit;font-size:0.8em;padding:0.15em 0.6em;border:0.1em solid #8a86a8;background:#07060c;color:#f4f0e6">${label}</button>`;
    const area = (name, ph) => `<textarea name="${name}" maxlength="500" rows="2" placeholder="${ph}" style="font:inherit;font-size:0.75em;width:100%;box-sizing:border-box;padding:0.3em;background:#07060c;color:#f4f0e6;border:0.1em solid #8a86a8;resize:none"></textarea>`;
    surveyBox.innerHTML = '<form style="font-size:clamp(13px,1.9vw,36px);width:min(34em,92vw);max-height:94vh;overflow:auto;box-sizing:border-box;background:#10101c;border:0.15em solid #e8c060;padding:0.8em 1.2em;display:flex;flex-direction:column;gap:0.45em;color:#f4f0e6">' +
      '<div style="color:#e8c060;font-size:1.1em;text-align:center">짧은 설문 (1분)</div>' +
      '<div>재미있었나요?</div><div style="display:flex;gap:0.3em;flex-wrap:wrap">' +
      ['1 별로', '2', '3 보통', '4', '5 최고'].map((l, i) => pill('fun', i + 1, l)).join('') + '</div>' +
      '<div>난이도는 어땠나요?</div><div style="display:flex;gap:0.3em;flex-wrap:wrap">' +
      [['easy', '쉬웠다'], ['ok', '적당했다'], ['hard', '어려웠다']].map(([v, l]) => pill('diff', v, l)).join('') + '</div>' +
      '<div>막혔거나 이상했던 곳</div>' + area('stuck', '예: 3심 미란다 증언에서 무슨 증거를 내야 할지 몰랐다') +
      '<div>바라는 점 · 하고 싶은 말</div>' + area('wish', '자유롭게 적어 주세요') +
      '<div style="font-size:0.62em;color:#8a86a8">이름·연락처 같은 개인정보는 적지 마세요. 지금 진행 위치, 난이도, 실수·힌트 횟수가 함께 보내집니다.</div>' +
      '<div style="display:flex;gap:0.6em;justify-content:center"><button style="font:inherit;padding:0.2em 1.4em;background:#e8c060;color:#0d0b14;border:0">보내기</button>' +
      '<button type="button" class="close" style="font:inherit;padding:0.2em 1.4em;background:#07060c;color:#f4f0e6;border:0.1em solid #8a86a8">닫기</button></div></form>';
    document.body.appendChild(surveyBox);
    const ans = { fun: null, diff: null };
    const paint = () => surveyBox.querySelectorAll('[data-fun],[data-diff]').forEach((b) => {
      const on = b.dataset.fun ? Number(b.dataset.fun) === ans.fun : b.dataset.diff === ans.diff;
      b.style.background = on ? '#e8c060' : '#07060c'; b.style.color = on ? '#0d0b14' : '#f4f0e6';
    });
    surveyBox.querySelectorAll('[data-fun]').forEach((b) => b.addEventListener('click', () => { ans.fun = Number(b.dataset.fun); paint(); }));
    surveyBox.querySelectorAll('[data-diff]').forEach((b) => b.addEventListener('click', () => { ans.diff = b.dataset.diff; paint(); }));
    const close = () => { if (surveyBox) { surveyBox.remove(); surveyBox = null; } };
    surveyBox.querySelector('.close').addEventListener('click', close);
    surveyBox.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target, stuck = f.stuck.value.trim(), wish = f.wish.value.trim();
      if (!ans.fun && !ans.diff && !stuck && !wish) { S.toast = { t: 1.6, text: '한 가지 이상 답해 주세요' }; return; }
      let v = null;
      try { v = localStorage.getItem(STAT_KEY); } catch (err) { /* 번호 없이 보냄 */ }
      const st = S.stats || { wrongs: 0, hints: 0, overs: 0, sec: 0 };
      const body = {
        g: GAME, v: v && v !== 'me' ? v : null, me: v === 'me', fun: ans.fun, diff: ans.diff, stuck, wish,
        where: S.scene === 'end' ? '엔딩' : S.scene === 'play' ? trialOf(S.stack[0] ? S.stack[0].pc : 0) : S.scene,
        level: difficulty, wrongs: st.wrongs, hints: st.hints, overs: st.overs, min: Math.round(st.sec / 60),
      };
      close();
      fetch('/api/survey', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then((r) => { S.toast = { t: 2, text: r.ok ? '보냈습니다. 고맙습니다!' : '보내지 못했습니다' }; })
        .catch(() => { S.toast = { t: 2, text: '보내지 못했습니다' }; });
    });
  }
  let titleSel = 0; // 타이틀에서 키보드로 고른 버튼: 0 새로 시작, 1 이어하기
  addEventListener('keydown', (e) => {
    // 길게 누르기 반복, 브라우저 단축키(Cmd/Ctrl+F 등), 세로 화면, 시작 전 입력은 무시한다
    if (nameBox || surveyBox || e.repeat || e.metaKey || e.ctrlKey || e.altKey || !started || portraitHeld()) return;
    if (S.scene !== 'play' && performance.now() < lockUntil) return;
    audio();
    const k = e.key;
    if (k === 'm' || k === 'M') { toggleMute(); return; }
    if (k === 'f' || k === 'F') { toggleSpeed(); return; }
    if (S.slotView && (S.slotView.mode === 'menu' || S.slotView.mode === 'quit')) {
      const v = S.slotView, items = v.mode === 'menu' ? MENU.filter((m) => m[2]()) : [['돌아가기', quitToTitle], ['취소', () => { S.slotView = { mode: 'menu', sel: 0 }; }]];
      if (k === 'ArrowUp' || k === 'ArrowLeft') { v.sel = (v.sel + items.length - 1) % items.length; SFX.select(); }
      else if (k === 'ArrowDown' || k === 'ArrowRight') { v.sel = (v.sel + 1) % items.length; SFX.select(); }
      else if (k === 'Enter' || k === ' ') items[v.sel][1]();
      else if (k === 'Escape' || k === 'x' || k === 'X') { if (v.mode === 'quit') S.slotView = { mode: 'menu', sel: 0 }; else S.slotView = null; }
      e.preventDefault(); return;
    }
    if (S.slotView) {
      const v = S.slotView, n = Number(k) - 1;
      if (n >= 0 && n < SLOTS) { if (v.mode === 'save') saveSlot(n); else loadSlot(n); }
      else if (k === 'ArrowUp') { v.sel = (v.sel + SLOTS - 1) % SLOTS; SFX.select(); }
      else if (k === 'ArrowDown') { v.sel = (v.sel + 1) % SLOTS; SFX.select(); }
      else if (k === 'Enter' || k === ' ') { if (v.mode === 'save') saveSlot(v.sel); else loadSlot(v.sel); }
      else if ((k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Tab') && S.scene === 'play' && canSlotSave()) { v.mode = v.mode === 'save' ? 'load' : 'save'; SFX.select(); }
      else if (k === 'Escape' || k === 'x' || k === 'X' || k === 's' || k === 'S') slotBack();
      e.preventDefault(); return;
    }
    if (S.scene === 'title') {
      if (k === 'l' || k === 'L') { openSlots('load'); e.preventDefault(); return; }
      const opts = [0, ...(S.saved ? [1] : []), ...(cleared ? [2] : [])];
      if ((k === 'ArrowUp' || k === 'ArrowDown') && opts.length > 1) { const j = opts.indexOf(titleSel); titleSel = opts[(j + (k === 'ArrowUp' ? opts.length - 1 : 1)) % opts.length]; SFX.select(); }
      else if (k === 'Enter' || k === ' ') { if (titleSel === 1 && S.saved) begin(S.saved); else if (titleSel === 2 && cleared) openDex(); else startNew(); }
      e.preventDefault();
      return;
    }
    if (S.scene === 'dex') {
      if (k === 'ArrowLeft') dexMove(-1); else if (k === 'ArrowRight') dexMove(1);
      else if (k === 'ArrowUp') dexFace(-1); else if (k === 'ArrowDown' || k === 'Enter' || k === ' ') dexFace(1);
      else if (k === 'Escape' || k === 'x' || k === 'X') toTitle();
      e.preventDefault(); return;
    }
    if (S.scene === 'select') {
      if (!isAdmin()) { S.scene = 'title'; e.preventDefault(); return; }
      const t = (CASE.trials || [])[Number(k) - 1];
      if (t) startNew(t.label); else if (k === 'Escape' || k === 'x' || k === 'X') S.scene = 'title';
      e.preventDefault(); return;
    }
    if (S.scene !== 'play') { if (k === 'Enter' || k === ' ') { S.scene === 'over' ? retry() : toTitle(); } return; }
    if (S.logView) {
      if (k === 'ArrowUp') logScroll(1); else if (k === 'ArrowDown') logScroll(-1);
      else if (k === 'Escape' || k === 'l' || k === 'L' || k === 'Enter') S.logView = null;
      e.preventDefault(); return;
    }
    if (k === 'l' || k === 'L') { openLog(); return; }
    if (k === 's' || k === 'S') { openSlots('save'); return; }
    // Esc = 메뉴(조사의 하위 메뉴·증거창처럼 Esc로 닫는 화면이 없을 때만)
    if (k === 'Escape' && !(S.mode === 'inv' && S.inv && S.inv.menu !== 'main')) { openMenu(); e.preventDefault(); return; }
    if (S.mode === 'choice') {
      const n = S.choice.op.options.length;
      if (k === 'ArrowUp') { S.choice.sel = (S.choice.sel - 1 + n) % n; SFX.select(); }
      else if (k === 'ArrowDown') { S.choice.sel = (S.choice.sel + 1) % n; SFX.select(); }
      else if (k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') choose(S.choice.sel);
      e.preventDefault(); return;
    }
    const ov = S.overlay;
    if (ov) {
      const list = evList(ov), n = list.length;
      if (k === 'Tab' || k === 'q' || k === 'Q') { toggleOldEv(); e.preventDefault(); return; }
      if (!n) { if (k === 'Escape' || k === 'e' || k === 'E' || k === 'x' || k === 'X') closeOverlay(); e.preventDefault(); return; }
      if (k === 'ArrowUp' || k === 'ArrowLeft') { ov.sel = (ov.sel - 1 + n) % n; ov.page = 0; SFX.select(); }
      else if (k === 'ArrowDown' || k === 'ArrowRight') { ov.sel = (ov.sel + 1) % n; ov.page = 0; SFX.select(); }
      else if ((k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') && ov.purpose !== 'view') present(list[ov.sel]);
      else if (k === 'Escape' || k === 'e' || k === 'E' || k === 'x' || k === 'X') closeOverlay();
      e.preventDefault();
      return;
    }
    if (S.mode === 'inv' && S.inv) { invKey(k); e.preventDefault(); return; }
    if (S.mode === 'cross') {
      if (k === 'ArrowLeft') crossMove(-1);
      else if (k === 'ArrowRight' || k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') crossMove(1);
      else if (k === 'x' || k === 'X') crossPress();
      else if (k === 'e' || k === 'E') openOverlay('cross');
      e.preventDefault();
      return;
    }
    if (k === 'Enter' || k === ' ' || k === 'z' || k === 'Z') { confirm(); e.preventDefault(); }
    else if ((k === 'e' || k === 'E') && S.mode === 'line') openOverlay('view');
  });
  function choose(i) {
    if (S.mode !== 'choice') return;
    const o = S.choice.op.options[i];
    S.log.push({ name: CASE.chars.me ? CASE.chars.me.name : null, text: `▶ ${o.label}`, color: COL.think });
    const op = S.choice.op;
    S.choice = null; S.mode = 'idle'; SFX.select();
    // 틀린 선택지(wrong)는 증거를 잘못 낸 것처럼 하트가 줄고, 같은 선택지로 돌아온다(영매 소환 퍼즐)
    if (o.wrong) { wrong(o.wrong, () => { S.choice = { op, sel: 0 }; S.mode = 'choice'; }, op); return; }
    jumpTo(o.goto); step();
  }
  // 대사 기록 창: 맨 아래(최근)부터 보고, ▲로 올려 본다
  const LOG_ROWS = 10, LOG_DS = 10 / 12;
  function logRows() {
    const rows = [];
    for (const e of S.log) {
      const prefix = e.name ? `${e.name}: ` : '';
      wrap(prefix + e.text, 284 / LOG_DS).forEach((r, i) => rows.push({ text: r, color: e.color, name: i === 0 && e.name ? e.name : null }));
      rows.push(null); // 줄 사이 빈칸
    }
    return rows;
  }
  function openLog() { if (S.scene !== 'play' || S.overlay || S.logView) return; S.logView = { off: 0 }; SFX.select(); }
  function logScroll(d) {
    const max = Math.max(0, logRows().length - LOG_ROWS);
    S.logView.off = Math.max(0, Math.min(max, S.logView.off + d * 3));
  }
  addEventListener('wheel', (e) => { if (S.logView) logScroll(e.deltaY < 0 ? 1 : -1); }, { passive: true });
  // 결과 공유 글: 카페 댓글에 붙여 넣기 좋게 한 덩어리로
  function resultText() {
    const st = S.stats || { wrongs: 0, hints: 0, overs: 0, sec: 0 };
    const m = Math.floor(st.sec / 60), sc = Math.round(st.sec % 60);
    return `[${TITLE}${TAGLINE}] ${S.end ? S.end.title : ''}!\n` +
      `난이도 ${DIFFS[difficulty].label} · 실수 ${st.wrongs}회 · 힌트 ${st.hints}번 · 패소 ${st.overs}번 · ${m}분 ${String(sc).padStart(2, '0')}초\n` +
      location.href.split('?')[0];
  }
  // ───────── 결과 공유(2026-11-06): 1200×630 결과 그림 + 글. 휴대폰은 공유 창, 안 되면 그림 저장 + 글 복사 ─────────
  let shareFile = null, shareBusy = false;
  function makeShareFile() {
    const art = titleArt();
    if (shareBusy || art === undefined || !document.fonts) return; // 도로시 그림을 읽는 중이면 다음 프레임에
    shareBusy = true;
    const c = mk(1200, 630), x = c.getContext('2d'), st = S.stats || { wrongs: 0, hints: 0, overs: 0, sec: 0 };
    x.imageSmoothingEnabled = false;
    x.fillStyle = COL.night; x.fillRect(0, 0, 1200, 630);
    for (let i = 0; i < 90; i++) { x.fillStyle = i % 4 ? '#3a3858' : '#6a68a0'; x.fillRect((i * 211) % 1200, (i * 97) % 630, 4, 4); }
    if (art) {
      const ah = 600, aw = (art.width * ah) / art.height;
      x.drawImage(art, 1200 - aw + 50, 630 - ah, aw, ah);
      const fade = x.createLinearGradient(430, 0, 720, 0);
      fade.addColorStop(0, 'rgba(7,6,12,1)'); fade.addColorStop(1, 'rgba(7,6,12,0)');
      x.fillStyle = fade; x.fillRect(430, 0, 290, 630); x.fillStyle = 'rgba(7,6,12,0.6)'; x.fillRect(0, 0, 430, 630);
    }
    const put = (t, px, y, color, bold, outline) => {
      x.font = fontOf(bold, px); x.textBaseline = 'top';
      if (outline) { x.lineWidth = px / 8; x.strokeStyle = COL.ink; x.lineJoin = 'round'; x.strokeText(t, 60, y); }
      x.fillStyle = color; x.fillText(t, 60, y);
    };
    put(TITLE, 120, 40, COL.gold, true, true);
    put(TAGLINE, 56, 172, COL.text, true, true);
    put(S.end ? S.end.title : '', 64, 264, S.end && S.end.result === 'win' ? COL.gold : COL.red, true, true);
    put(`난이도 ${DIFFS[difficulty].label} · 변호인 ${playerName}`, 34, 360, COL.text);
    put(`실수 ${st.wrongs}회 · 힌트 ${st.hints}번 · 패소 ${st.overs}번`, 34, 408, COL.text);
    put(`플레이 시간 ${Math.floor(st.sec / 60)}분 ${String(Math.round(st.sec % 60)).padStart(2, '0')}초`, 34, 456, COL.dim);
    put(location.host || 'dorothy-trial.pages.dev', 30, 548, COL.gold);
    put('비공식 팬게임 · 원작 승리의 여신: 니케 / SHIFT UP', 22, 590, COL.dim);
    c.toBlob((blob) => { shareBusy = false; if (blob) shareFile = new File([blob], `${GAME}-result.png`, { type: 'image/png' }); });
  }
  function shareResult() {
    stat('share');
    const t = resultText();
    if (shareFile && navigator.canShare && navigator.canShare({ files: [shareFile] })) {
      navigator.share({ files: [shareFile], text: t }).then(() => { S.toast = { t: 1.6, text: '공유했습니다' }; }, () => {});
      return;
    }
    // 공유 창이 없으면(대부분의 PC) 그림을 내려받고 글을 복사한다
    if (shareFile) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(shareFile); a.download = shareFile.name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
    copyResult(shareFile ? '결과 그림을 저장하고 글을 복사했습니다' : null);
  }
  function copyResult(msg) {
    const t = resultText();
    const done = () => { S.toast = { t: 2, text: typeof msg === 'string' ? msg : '결과를 복사했습니다' }; SFX.select(); };
    const fallback = () => {
      const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { S.toast = { t: 2, text: '복사하지 못했습니다' }; }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
  }
  // 배속: 1 → 2 → 4 → 1. 다음 방문에도 기억한다
  let speed = 1;
  try { speed = [1, 2, 4].includes(+localStorage.getItem(GAME + '.speed')) ? +localStorage.getItem(GAME + '.speed') : 1; } catch (e) { speed = 1; }
  function toggleSpeed() {
    speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
    try { localStorage.setItem(GAME + '.speed', String(speed)); } catch (e) { /* 이번 판에서만 기억 */ }
    SFX.select();
  }
  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem(GAME + '.mute', muted ? '1' : '0'); } catch (e) { /* 무시 */ }
  }
  // 다시하기는 저장 위치로 돌아가되 실수·패소 기록은 이어 간다
  function retry() { begin(S.saved ? { ...S.saved, patience: maxPatience(), stats: { ...S.stats } } : null); }
  function toTitle() { S.scene = 'title'; titleSel = S.saved ? 1 : 0; lockInput(); }

  // ───────── 갱신 ─────────
  function update(dt) {
    S.t += dt;
    if (S.scene === 'play' && S.stats) S.stats.sec += dt;
    const fx = S.fx;
    if (fx.murmur) { fx.murmur.t -= dt; if (fx.murmur.t <= 0) fx.murmur = null; }
    if (S.toast) { S.toast.t -= dt; if (S.toast.t <= 0) S.toast = null; }
    fx.shake = Math.max(0, fx.shake - dt);
    fx.flash = Math.max(0, fx.flash - dt * 2.5);
    if (S.pocket) S.pocket.t += dt;
    // 배속은 글자 찍기와 연출 대기 시간에만 적용한다
    const sdt = dt * speed;
    if (S.mode === 'stamp' && fx.stamp) { fx.stamp.t -= sdt; if (fx.stamp.t <= 0) confirm(); }
    if (S.mode === 'testTitle' && S.testTitle) { S.testTitle.t -= sdt; if (S.testTitle.t <= 0) confirm(); }
    const l = S.line;
    if (S.mode === 'line' && l && !S.overlay) {
      const len = pageLen(l);
      if (l.shown < len) {
        l.shown = Math.min(len, l.shown + sdt * CPS);
        const n = Math.floor(l.shown);
        if (n - l.lastBlip >= 2 * speed) { l.lastBlip = n; SFX.blip(l.voice); }
      }
    }
  }

  // ───────── 그리기 ─────────
  function rect(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  function frameBox(x, y, w, h) {
    rect(x, y, w, h, COL.gold); rect(x + 1, y + 1, w - 2, h - 2, COL.ink); rect(x + 2, y + 2, w - 4, h - 4, COL.box);
  }
  // 프롤로그용: 눈을 뜬 2D 세계. 도트 격자와 떠다니는 조각
  function drawVoid() {
    rect(0, 0, W, H, '#0b0a1a');
    for (let x = 0; x < W; x += 16) rect(x, 0, 1, H, '#15143a');
    for (let y = 0; y < H; y += 16) rect(0, y, W, 1, '#15143a');
    for (let i = 0; i < 24; i++) {
      const x = (i * 53) % W, y = Math.round((i * 37 + S.t * (6 + (i % 4) * 3)) % (H + 20)) - 10;
      rect(x, H - y, 4 + (i % 3) * 2, 4 + (i % 3) * 2, i % 5 ? '#2a2f6a' : '#c4e0f4');
    }
    text(CASE.voidText || '404 NOT FOUND', 160, 40, '#1f2050', { align: 'center', bold: true, scale: 2.5 });
  }
  const NIGHTMARE = CASE.nightmare || ['나유타 또 트롤함?', '정에 끌려서 일 그르침', '랩쳐 GOAT', '역적 아니냐', '해명방송 잘 봤습니다', 'ㅋㅋㅋㅋㅋ', '또 사고 칠 듯', '분신이 찔렀다고요?', '이게 맞냐', '나유타 손절'];
  function drawNightmare() {
    rect(0, 0, W, H, '#14060a');
    for (let i = 0; i < 18; i++) {
      const s = NIGHTMARE[i % NIGHTMARE.length], w = tw(s) * (10 / 12) + 10;
      const x = 8 + ((i * 97) % (W - w - 16)), y = Math.round(((i * 41 + S.t * (10 + (i % 4) * 4)) % (H + 30))) - 20;
      rect(x, H - y, w, 13, i % 3 ? '#2a0e14' : '#3a1018');
      text(s, x + 5, H - y, i % 3 ? '#9a6070' : COL.red, { scale: 10 / 12 });
    }
  }
  // 휴정 장면: 법정 옆 작은 방. 자판기, 벤치, 창, 쌓인 상자(세실 말로는 창고)
  // 그림(assets/bg/lobby.png)이 있으면 그것을 쓰고, 없으면 아래 도형으로 그린다
  function drawLobby() {
    const im = asset('bg:lobby', 'assets/bg/lobby.png', (i) => coverFrom(i, W, H));
    if (im) { g.drawImage(im, 0, 0, W, H); return; }
    rect(0, 0, W, H, '#d9c7a4');
    for (let x = 0; x < W; x += 24) rect(x, 0, 12, 112, '#d2bd96');
    rect(0, 104, W, 8, '#a8845a'); rect(0, 104, W, 2, '#c49d6c');
    rect(0, 112, W, 68, '#8a6a4a');
    for (let x = 0; x < W; x += 20) rect(x, 112, 1, 68, '#7a5c3e');
    // 창: 바깥은 방주의 인공 하늘
    rect(118, 18, 84, 48, '#6e5638'); rect(121, 21, 78, 42, '#9fd0e8'); rect(159, 21, 2, 42, '#6e5638'); rect(121, 41, 78, 2, '#6e5638');
    rect(126, 26, 18, 4, '#e8f4fa'); rect(170, 30, 22, 4, '#e8f4fa');
    // 자판기: 깜박이는 불빛
    rect(18, 30, 46, 82, '#3a6ea8'); rect(22, 34, 38, 40, '#bfe0f0');
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) rect(26 + j * 12, 38 + i * 12, 8, 8, ['#e0505a', '#7ee08a', '#e8c060'][(i + j) % 3]);
    rect(22, 80, 38, 6, '#1e3a5a'); rect(48, 90, 8, 4, Math.floor(S.t * 2) % 2 ? '#e8c060' : '#6a5a30');
    // 벤치와 쌓인 상자
    rect(220, 86, 84, 6, '#6e4626'); rect(224, 92, 4, 18, '#5a3a1e'); rect(296, 92, 4, 18, '#5a3a1e');
    rect(88, 76, 22, 30, '#b48a58'); rect(92, 62, 18, 16, '#c49d6c'); rect(88, 76, 22, 2, '#8a6a42');
  }
  // 에필로그 장면: 불 꺼진 골목의 밤
  function drawNight() {
    rect(0, 0, W, H, '#0a0c18');
    for (let i = 0; i < 30; i++) rect((i * 71) % W, (i * 29) % 70, 1, 1, i % 4 ? '#3a3f6a' : '#c4e0f4');
    // 초승달: 큰 원에서 오른쪽으로 비킨 원을 빼서 그린다
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) if (dx * dx + dy * dy <= 64 && (dx - 5) ** 2 + (dy + 2) ** 2 > 49) rect(38 + dx, 34 + dy, 1, 1, '#e0dcc4');
    for (const [x, w, h] of [[0, 56, 46], [56, 40, 34], [96, 72, 58], [168, 48, 40], [216, 104, 52]]) {
      rect(x, 112 - h, w, h, '#161a2c'); rect(x, 112 - h, w, 1, '#262b44');
      for (let wy = 112 - h + 8; wy < 106; wy += 12) for (let wx = x + 6; wx < x + w - 8; wx += 12) rect(wx, wy, 4, 6, (wx * 3 + wy * 5) % 7 === 0 ? '#c8a850' : '#22273c');
    }
    rect(0, 112, W, 68, '#101320'); rect(0, 112, W, 1, '#2a2f4a');
  }
  function drawCourt() {
    if (S.bg === 'void') { drawVoid(); return; }
    if (S.bg === 'nightmare') { drawNightmare(); return; }
    if (S.bg === 'lobby') { drawLobby(); return; }
    if (S.bg === 'night') { drawNight(); return; }
    if (S.bg !== 'court') {
      const im = asset(`bg:${S.bg}`, `assets/bg/${S.bg}.png`, (i) => coverFrom(i, W, H));
      if (im) { g.drawImage(im, 0, 0, W, H); return; }
      // 그림이 아직 없으면 자리표시(장소 id를 적어 둔다)
      rect(0, 0, W, H, '#2a2f44');
      for (let y = 0; y < H; y += 12) rect(0, y, W, 1, '#323850');
      if (im === null) text(S.bg, 160, 50, COL.dim, { align: 'center' });
      return;
    }
    const bg = asset('bg:court', 'assets/bg/court.png', (im) => coverFrom(im, W, H));
    if (bg) { g.drawImage(bg, 0, 0, W, H); return; }
    rect(0, 0, W, H, COL.wall);
    for (let x = 0; x < W; x += 32) rect(x + 8, 0, 16, 78, COL.wall2);
    rect(0, 14, W, 2, COL.trim);
    // 뒤편 높은 창 세 개
    for (const cx of [60, 160, 260]) { rect(cx - 12, 22, 24, 40, '#1a1930'); rect(cx - 10, 24, 20, 36, '#3d4a7a'); rect(cx - 1, 24, 2, 36, '#1a1930'); rect(cx - 10, 40, 20, 2, '#1a1930'); }
    rect(0, 78, W, 30, COL.wood); rect(0, 78, W, 2, COL.woodHi);
    for (let x = 6; x < W; x += 22) rect(x, 84, 14, 20, COL.wood2);
    rect(0, 108, W, 72, COL.floor);
    for (let x = 0; x < W; x += 16) rect(x, 108, 1, 72, '#1c110b');
  }
  // 증언대: 밝은 법정 배경에 맞춘 밝은 나무색
  function drawStand() {
    rect(96, 96, 128, 24, '#b98552'); rect(96, 96, 128, 3, '#e0b07a');
    rect(100, 102, 120, 1, '#8f5f36'); rect(108, 106, 104, 10, '#a3703f');
    rect(96, 119, 128, 1, '#6e4626');
  }
  function drawPlaceholder(id) {
    const ch = CASE.chars[id] || {};
    const c = ch.color || '#6a6a80', cx = 160, top = 14;
    g.fillStyle = c;
    for (let dy = -18; dy <= 18; dy++) { const hw = Math.floor(Math.sqrt(18 * 18 - dy * dy)); g.fillRect(cx - hw, top + 18 + dy, hw * 2, 1); }
    for (let y = 0; y < 50; y++) { const hw = 22 + Math.min(y, 20); g.fillRect(cx - hw, top + 40 + y, hw * 2, 1); }
    rect(cx - 7, top + 34, 14, 8, c);
    text(ch.name || id, cx, top + 56, COL.ink, { align: 'center', bold: true });
  }
  function drawPortrait() {
    const p = S.portrait;
    if (!p) return;
    const c = portrait(p.id, p.face);
    if (c === undefined) return;
    if (c === null) { drawPlaceholder(p.id); return; }
    const pw = c.width / RES, ph = c.height / RES;
    g.drawImage(c, 160 - pw / 2, 118 - ph, pw, ph);
  }
  function drawDanger() {
    if (S.patience > 2) return;
    const fast = S.patience === 1, a = (fast ? 0.6 : 0.35) * (0.7 + 0.3 * Math.sin(S.t * (fast ? 9 : 5)));
    for (let i = 0; i < 8; i++) {
      const c = `rgba(210,20,30,${(a * (1 - i / 8)).toFixed(3)})`;
      rect(i * 2, 0, 2, H, c); rect(W - 2 - i * 2, 0, 2, H, c);
      rect(0, i * 2, W, 2, c); rect(0, H - 2 - i * 2, W, 2, c);
    }
  }
  const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
  function drawHud() {
    for (let i = 0; i < maxPatience(); i++) {
      const on = i < S.patience, ox = 6 + i * 10, oy = 6;
      const blink = S.patience === 1 && Math.floor(S.t * 4) % 2;
      HEART.forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') rect(ox + x, oy + y, 1, 1, on ? (blink ? COL.gold : COL.red) : '#3a3040'); }));
    }
    if (S.patience === 1) { const x = 5 + maxPatience() * 10, w = tw('종결 경고', true) + 8; rect(x, 3, w, 14, COL.red); text('종결 경고', x + 4, 3, COL.text, { bold: true }); }
    const can = S.mode === 'line' || S.mode === 'cross' || S.mode === 'inv';
    button(113, 3, 40, 16, '메뉴', openMenu, { off: !!S.overlay || !!S.slotView });
    button(157, 3, 45, 16, keyHint('기록', 'L'), openLog, { off: !!S.overlay || !S.log.length });
    button(206, 3, 56, 16, keyHint(`${speed}배속`, 'F'), toggleSpeed, { off: !!S.overlay });
    button(266, 3, 50, 16, keyHint('증거', 'E'), () => openOverlay(S.mode === 'cross' ? 'cross' : 'view'), { off: !can || !!S.overlay });
    if (S.inv) {
      // 조사 중: 지금 장소 이름
      const nm = S.inv.op.places[S.inv.place].name, w = tw(nm, true) + 14;
      rect(4, 22, w, 15, COL.ink); rect(4, 22, 2, 15, COL.gold);
      text(nm, 11, 22, COL.gold, { bold: true });
    }
  }
  function drawNameTag(name) {
    if (!name) return;
    const w = tw(name, true) + 12;
    rect(8, 106, w, 13, COL.gold); rect(9, 107, w - 2, 11, '#c89a3a');
    text(name, 14, 106, COL.ink, { bold: true });
  }
  function drawLine() {
    const l = S.line;
    frameBox(4, 118, 312, 58);
    drawNameTag(l.name);
    let left = Math.floor(l.shown);
    l.pages[l.page].forEach((s, i) => {
      const chars = [...s];
      const take = Math.max(0, Math.min(chars.length, left));
      left -= chars.length;
      if (take > 0) text(s, 12, 124 + i * 14, l.color, { clip: tw(chars.slice(0, take).join('')), shadow: COL.ink });
    });
    if (l.shown >= pageLen(l) && Math.floor(S.t * 3) % 2 === 0) {
      g.fillStyle = COL.gold; g.fillRect(304, 168, 5, 1); g.fillRect(305, 169, 3, 1); g.fillRect(306, 170, 1, 1);
    }
  }
  function drawCross() {
    const t = S.test, st = t.op.statements[t.idx], n = t.op.statements.length;
    frameBox(4, 118, 312, 58);
    drawNameTag(nameOf(t.op.witness));
    text(`증언 ${t.idx + 1}/${n}`, 308, 106, COL.testimony, { align: 'right', outline: COL.ink });
    wrap(st.line, LINE_W).slice(0, LINES).forEach((s, i) => text(s, 12, 124 + i * 14, COL.testimony, { shadow: COL.ink }));
    // 손가락으로 누르기 쉽게 18픽셀 높이
    button(4, 84, 26, 18, '◀', () => crossMove(-1));
    button(34, 84, 58, 18, keyHint('캐묻기', 'X'), crossPress);
    button(212, 84, 74, 18, keyHint('증거 내기', 'E'), () => openOverlay('cross'));
    button(290, 84, 26, 18, '▶', () => crossMove(1));
  }
  function drawInv() {
    const inv = S.inv, pl = invPlace(), acts = [];
    const kb = pointer.x < 0; // 키보드로 고르는 중이면 고른 버튼을 강조
    const btn = (x, y, w, h, label, fn, o = {}) => { const i = acts.length; acts.push(o.off ? null : fn); button(x, y, w, h, label, fn, { ...o, sel: !o.off && kb && inv.sel === i }); };
    const DS = 10 / 12;
    frameBox(4, 118, 312, 58);
    if (inv.menu === 'main') {
      const need = inv.op.done.needs || [], have = need.filter((id) => S.ev.includes(id)).length;
      text(pl.desc || '무엇을 할까?', 12, 122, COL.dim, { scale: DS });
      if (need.length) text(`단서 ${have}/${need.length}`, 308, 122, have === need.length ? COL.testimony : COL.gold, { scale: DS, align: 'right' });
      btn(12, 134, 142, 18, '살펴보기', () => invMenu('examine'));
      btn(166, 134, 142, 18, '이야기하기', () => invMenu('talk'), { off: !pl.who || !invTopics().length });
      btn(12, 155, 142, 18, '이동하기', () => invMenu('move'), { off: !invMoves().length });
      btn(166, 155, 142, 18, '조사 마치기', finishInv, { off: !invReady() });
    } else if (inv.menu === 'examine') {
      const xs = invSpots();
      let hotName = null;
      xs.forEach((x, i) => {
        const s = x.s, seen = inv.seen[x.key];
        const over = pointer.x >= s.x && pointer.x < s.x + s.w && pointer.y >= s.y && pointer.y < s.y + s.h;
        const on = over || (kb && inv.sel === i);
        if (on) { hotName = s.name; g.strokeStyle = COL.gold; g.lineWidth = 1; g.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1); }
        // 지점 표시: 아직 안 본 곳은 '?', 본 곳은 흐린 'v'
        const mx = Math.round(s.x + s.w / 2 - 6), my = Math.round(s.y + s.h / 2 - 7);
        rect(mx, my, 12, 14, on ? COL.gold : seen ? '#3a3850' : COL.ink);
        rect(mx, my, 12, 1, COL.gold); rect(mx, my + 13, 12, 1, COL.gold);
        text(seen ? 'v' : '?', mx + 6, my, on ? COL.ink : seen ? COL.dim : COL.gold, { align: 'center', bold: true });
        acts.push(() => examine(x));
        B.push({ x: s.x, y: s.y, w: s.w, h: s.h, fn: () => examine(x) });
      });
      const left = xs.filter((x) => !inv.seen[x.key]).length;
      text(hotName || '살펴볼 곳을 누르자.', 12, 124, hotName ? COL.gold : COL.text, { bold: !!hotName });
      text(left ? `아직 안 본 곳 ${left}` : '다 살펴봤다.', 12, 142, COL.dim, { scale: DS });
      btn(228, 152, 80, 18, keyHint('돌아가기', 'X'), () => invMenu('main'));
    } else {
      const talkMode = inv.menu === 'talk';
      const items = talkMode ? invTopics().map((x) => ({ label: (inv.talked[x.key] ? '· ' : '') + x.s.topic, fn: () => talk(x) }))
        : invMoves().map((pid) => ({ label: inv.op.places[pid].name, fn: () => moveTo(pid) }));
      const h = 12 + items.length * 20;
      frameBox(64, Math.max(26, 112 - h), 192, h);
      items.forEach((it, i) => btn(70, Math.max(26, 112 - h) + 6 + i * 20, 180, 18, it.label, it.fn));
      text(talkMode ? '무엇을 물어볼까?' : '어디로 갈까?', 12, 124, COL.text);
      if (talkMode) text('· 표시는 이미 나눈 이야기', 12, 142, COL.dim, { scale: DS });
      btn(228, 152, 80, 18, keyHint('돌아가기', 'X'), () => invMenu('main'));
    }
    inv.acts = acts;
    if (inv.sel >= acts.length || !acts[inv.sel]) inv.sel = Math.max(0, acts.findIndex(Boolean));
  }
  function evIcon(id, x, y, k = 1) {
    const c = asset(`e:${id}`, `assets/evidence/${id}.png`, (im) => containFrom(im, 32, 32));
    if (c) { const iw = (c.width / RES) * k, ih = (c.height / RES) * k; g.drawImage(c, x + (32 * k - iw) / 2, y + (32 * k - ih) / 2, iw, ih); return; }
    const ev = CASE.evidence[id];
    rect(x + 4 * k, y + 2 * k, 24 * k, 28 * k, '#d8d0b8'); rect(x + 4 * k, y + 2 * k, 24 * k, 4 * k, ev.color || COL.gold);
    for (let i = 0; i < 4; i++) rect(x + 8 * k, y + (10 + i * 5) * k, (16 - (i % 2) * 5) * k, 2 * k, '#8a8070');
  }
  // 주머니에서 나온 증거품 카드: 아래에서 튀어 오른 뒤 살짝 떠 있다
  function drawPocket() {
    const p = S.pocket, ev = CASE.evidence[p.id];
    const rise = Math.max(0, 1 - p.t * 5), bob = Math.round(Math.sin(S.t * 4) * 1);
    // 변호인 얼굴을 가리지 않게 오른쪽에 띄운다
    const x = 210, y = 20 + Math.round(rise * 60) + bob, w = 104, h = 84;
    frameBox(x, y, w, h);
    text(S.inv || CASE.pocket === false ? '새 증거품' : '주머니 속 증거품', x + w / 2, y + 4, COL.dim, { align: 'center', scale: 10 / 12 });
    evIcon(p.id, x + w / 2 - 24, y + 17, 1.5);
    wrap(ev.name, w - 10, true).slice(0, 2).forEach((s, i) => text(s, x + w / 2, y + 64 + i * 10, COL.gold, { align: 'center', bold: true, scale: 10 / 12 }));
  }
  function drawOverlay() {
    const ov = S.overlay;
    rect(0, 0, W, H, 'rgba(7,6,12,0.72)');
    frameBox(12, 10, 296, 160);
    const list = evList(ov);
    const head = ov.old ? '앞 심에서 모은 증거' : ov.purpose === 'view' ? '증거 목록' : '어떤 증거를 낼까?';
    text(head, 20, 15, COL.gold, { bold: true });
    // 앞 심의 증거는 따로 둔다(5심이면 30개가 넘어 고르기 어려움). Tab·Q 또는 이 버튼으로 오간다
    if (S.evBase) button(196, 13, 106, 15, ov.old ? `지금 심 증거 ${S.ev.length - S.evBase}` : `앞 심 증거 ${S.evBase}`, toggleOldEv, { sel: ov.old });
    if (ov.sel >= list.length) ov.sel = 0;
    if (!list.length) text('아직 이 심에서 모은 증거가 없다.', 20, 40, COL.dim, { scale: 10 / 12 });
    // 증거가 많으면 6개씩 나눠 보여 주고 ▲▼로 넘긴다(고른 증거가 있는 쪽을 보여 줌)
    const PER = 6, pages = Math.max(1, Math.ceil(list.length / PER)), first = Math.floor(ov.sel / PER) * PER;
    list.slice(first, first + PER).forEach((id, k) => {
      const i = first + k, y = 32 + k * 18, on = i === ov.sel;
      const hot = pointer.x >= 18 && pointer.x < 118 && pointer.y >= y && pointer.y < y + 16;
      rect(18, y, 100, 16, on ? COL.gold : hot ? '#2c2a44' : '#1a1830');
      // 긴 이름은 칸 폭에서 자르고 끝에 …를 붙인다(전체 이름은 오른쪽 설명에 나옴)
      const nm = CASE.evidence[id].name, full = tw(nm) <= 92;
      text(nm, 22, y + 1, on ? COL.ink : COL.text, { clip: full ? null : 86 });
      if (!full) text('…', 108, y + 1, on ? COL.ink : COL.text);
      B.push({ x: 18, y, w: 100, h: 16, fn: () => { ov.sel = i; ov.page = 0; SFX.select(); } });
    });
    if (pages > 1) {
      const pg = first / PER, go = (d) => { ov.sel = ((pg + d + pages) % pages) * PER; ov.page = 0; SFX.select(); };
      button(18, 144, 48, 18, `▲ ${pg + 1}/${pages}`, () => go(-1));
      button(70, 144, 48, 18, '▼', () => go(1));
    }
    const id = list[ov.sel];
    if (id) {
      const ev = CASE.evidence[id];
      rect(124, 30, 178, 1, COL.trim);
      evIcon(id, 126, 36);
      const DS = 10 / 12, per = 7;
      text(ev.name, 164, 36, COL.gold, { bold: true, clip: 136 });
      // 출처는 이름 아래 한 줄로 따로 빼서, 설명 칸을 사실에만 쓴다
      if (ev.from) text(ev.from, 164, 52, COL.dim, { scale: DS, clip: 136 / DS });
      // 설명은 10px로 쓰고, 7줄이 넘으면 '설명 1/2' 버튼으로 넘겨 본다
      const desc = wrap(ev.desc, 170 / DS), pages = Math.ceil(desc.length / per);
      if (!(ov.page < pages)) ov.page = 0;
      desc.slice(ov.page * per, ov.page * per + per).forEach((s, i) => text(s, 128, 68 + i * 11, COL.text, { scale: DS }));
      if (pages > 1) button(128, 148, 60, 18, `설명 ${ov.page + 1}/${pages}`, () => { ov.page = (ov.page + 1) % pages; SFX.select(); });
    }
    if (ov.purpose !== 'view') button(192, 148, 54, 18, keyHint('제시', 'Z'), () => present(list[ov.sel]), { off: !list.length });
    if (ov.purpose !== 'demand') button(250, 148, 52, 18, '닫기', closeOverlay);
  }
  function drawStamp() {
    const st = S.fx.stamp;
    const k = Math.min(1, (1.1 - st.t) * 8);
    const h = Math.round(36 * k);
    rect(0, 72 - h / 2, W, h, st.color || COL.red);
    rect(0, 72 - h / 2 - 2, W, 2, COL.gold); rect(0, 72 + h / 2, W, 2, COL.gold);
    if (k >= 1) text(st.text, 160, 59, COL.text, { align: 'center', bold: true, scale: 2, outline: COL.ink });
  }
  function drawChapter() {
    rect(0, 0, W, H, COL.night);
    const c = S.chapter;
    text(c.text, 160, 70, COL.gold, { align: 'center', bold: true, scale: 2 });
    if (c.sub) text(c.sub, 160, 104, COL.dim, { align: 'center' });
  }
  function drawTestTitle() {
    rect(0, 58, W, 52, 'rgba(7,6,12,0.85)');
    rect(0, 58, W, 1, COL.testimony); rect(0, 109, W, 1, COL.testimony);
    text('증언', 160, 64, COL.testimony, { align: 'center', bold: true });
    text(S.testTitle.title, 160, 82, COL.text, { align: 'center', bold: true, scale: 1 });
  }
  const TITLE = CASE.title || '나유타 재판', TAGLINE = CASE.tagline || '이 길이 아닌가?';
  const CREDIT = '비공식 팬 제작 · 원작: 승리의 여신: 니케 / SHIFT UP';
  const MAKER = CASE.maker || '유기농쵸비'; // 제작자 표기(게임마다 CASE.maker)
  const NOTICE = `제작 ${MAKER} · 비영리 팬 프로젝트 · 문제 시 즉시 삭제합니다`;
  const FEEDBACK = '피드백: globalchmist@naver.com';
  // 올클리어 타이틀의 도로시(엔딩 의상). 초상보다 크게 따로 도트로 만든다
  const TITLE_ART = 'dorothy_alt_smile', ART_H = 150;
  const titleArt = () => asset('title:' + TITLE_ART, `assets/portraits/${TITLE_ART}.png`, (im) => {
    const r = alphaBox(im);
    return pixelate(im, r, (r.w * ART_H) / r.h, ART_H, 0);
  });
  function drawTitle() {
    rect(0, 0, W, H, COL.night);
    for (let i = 0; i < 40; i++) {
      const x = (i * 73) % W, y = (i * 41 + Math.floor(S.t * 6 * ((i % 3) + 1))) % 120;
      rect(x, y, 1, 1, i % 4 ? '#3a3858' : '#6a68a0');
    }
    // 올클리어면 도로시를 오른쪽에 두고, 글자·버튼은 왼쪽 열(가운데 92)로 옮긴다
    const art = cleared ? titleArt() : null;
    const cx = art ? 92 : 160;
    if (art) {
      const aw = art.width / RES, ah = art.height / RES;
      g.drawImage(art, W - aw + 14, H - ah, aw, ah);
      const fade = g.createLinearGradient(110, 0, 190, 0);
      fade.addColorStop(0, 'rgba(7,6,12,1)'); fade.addColorStop(1, 'rgba(7,6,12,0)');
      g.fillStyle = fade; g.fillRect(110, 0, 80, H);
      rect(0, 0, 110, H, 'rgba(7,6,12,0.55)');
    }
    const y0 = art ? -4 : 0; // 올클리어 화면은 버튼이 하나 더 있어 위로 조금 올린다
    text(TITLE, cx, 10 + y0, COL.gold, { align: 'center', bold: true, scale: 3, outline: COL.ink });
    text(TAGLINE, cx, 50 + y0, COL.text, { align: 'center', bold: true, scale: 1.5, outline: COL.ink });
    text(CASE.subtitle || '', cx, 72 + y0, COL.dim, { align: 'center' });
    if (!S.saved && titleSel === 1) titleSel = 0;
    if (!cleared && titleSel === 2) titleSel = 0;
    const bx = cx - 50, by = art ? 82 : 88;
    button(bx, by, 100, 18, '새로 시작', startNew, { sel: titleSel === 0 && pointer.x < 0 });
    button(bx, by + 21, 100, 18, '이어하기', () => begin(S.saved), { off: !S.saved, sel: titleSel === 1 && pointer.x < 0 });
    if (cleared) button(bx, by + 42, 100, 18, '인물 도감', openDex, { sel: titleSel === 2 && pointer.x < 0 });
    const sound = muted ? '소리 꺼짐' : '소리 켜짐';
    const hasSkins = Object.keys(CASE.variants || {}).length > 0;
    const row = [[sound, toggleMute]];
    if (hasSkins) row.push(['의상', () => { S.scene = 'skins'; }]);
    row.push(['불러오기', () => openSlots('load')]);
    // 심 선택은 제작자 기기(?me로 한 번 연 브라우저)에서만 보인다(사용자 지정 2026-11-06)
    if ((CASE.trials || []).length && isAdmin()) row.push(['심 선택', () => { S.scene = 'select'; SFX.select(); }]);
    if (canFull && !isFull()) row.push(['전체 화면', goFull]);
    if (art) {
      // 왼쪽 열에 맞게 작은 버튼(10px 글자)으로 줄인다
      const bw = 54, gap = 4, x0 = Math.max(4, Math.round(cx - (row.length * bw + (row.length - 1) * gap) / 2));
      row.forEach(([label, fn], i) => button(x0 + i * (bw + gap), 144, bw, 15, label, fn, { scale: 10 / 12 }));
      rect(0, 160, W, 20, 'rgba(7,6,12,0.8)');
      text(CREDIT, 160, 160, COL.dim, { align: 'center', scale: 10 / 12 });
      text(NOTICE, 160, 170, '#6a6890', { align: 'center', scale: 10 / 12 });
    } else {
      const bw = 64, gap = 10, x0 = Math.round(160 - (row.length * bw + (row.length - 1) * gap) / 2);
      row.forEach(([label, fn], i) => button(x0 + i * (bw + gap), 130, bw, 18, label, fn));
      text(CREDIT, 160, 152, COL.dim, { align: 'center' });
      text(NOTICE, 160, 166, '#6a6890', { align: 'center', scale: 10 / 12 });
    }
    text('v0.2', 316, 2, '#4a4870', { align: 'right' });
    if (dataErrors.length) text(`데이터 오류 ${dataErrors.length}건 (콘솔 확인)`, 4, 2, COL.red);
  }
  // ───────── 인물 도감(올클리어 특전, 2026-11-06): ◀▶ 인물, ▲▼ 표정 ─────────
  const FACE_KO = { normal: '기본', smile: '웃음', smirk: '비웃음', blush: '부끄러움', sad: '슬픔', cry: '울음', angry: '화남', shock: '놀람', determined: '결의', stern: '엄격', trance: '빙의 중', drunk: '취함' };
  function openDex() {
    if (!cleared || !(CASE.dex || []).length) return;
    S.dex = S.dex || { i: 0, f: 0 };
    S.scene = 'dex'; SFX.select(); stat('dex');
  }
  function dexMove(d) { const n = CASE.dex.length; S.dex.i = (S.dex.i + d + n) % n; S.dex.f = 0; SFX.select(); }
  function dexFace(d) { const n = CASE.dex[S.dex.i].faces.length; S.dex.f = (S.dex.f + d + n) % n; SFX.select(); }
  function drawDex() {
    rect(0, 0, W, H, COL.night);
    const e = CASE.dex[S.dex.i], face = e.faces[S.dex.f];
    text('인물 도감', 12, 6, COL.gold, { bold: true });
    text(`${S.dex.i + 1} / ${CASE.dex.length}`, 308, 6, COL.dim, { align: 'right' });
    // 왼쪽: 초상(법정 화면과 같은 크기), 오른쪽: 이름·소개·표정
    rect(10, 24, 132, 118, '#1a1830');
    const c = portraitImg(e.img, e.id, face);
    if (c) { const pw = c.width / RES, ph = c.height / RES; g.drawImage(c, 76 - pw / 2, 142 - ph, pw, ph); }
    text(e.name, 152, 28, COL.gold, { bold: true, scale: 1.25 });
    wrap(e.role, 156).slice(0, 4).forEach((l, i) => text(l, 152, 50 + i * 14, COL.text));
    text(`표정 ${S.dex.f + 1}/${e.faces.length} · ${FACE_KO[face] || face}`, 152, 108, COL.dim, { scale: 10 / 12 });
    button(152, 120, 74, 18, '▲ 표정', () => dexFace(-1), { off: e.faces.length < 2 });
    button(232, 120, 74, 18, '표정 ▼', () => dexFace(1), { off: e.faces.length < 2 });
    button(10, 150, 70, 20, '◀ 이전', () => dexMove(-1));
    button(86, 150, 70, 20, '다음 ▶', () => dexMove(1));
    button(236, 150, 70, 20, '돌아가기', toTitle);
  }
  // 패소 화면: 나유타가 나와 태연하게 위로한다(왼쪽 초상, 오른쪽 버튼, 아래 대사)
  const OVER = CASE.over || { who: 'nayuta', face: 'smile', line: '승리했으니 괜찮소. 소인은 소인의 목숨을 중히 여기지 않소.' };
  function drawOver() {
    rect(0, 0, W, H, COL.night);
    const c = portrait(OVER.who, OVER.face);
    if (c) { const pw = c.width / RES, ph = c.height / RES; g.drawImage(c, 84 - pw / 2, 122 - ph, pw, ph); }
    text('패소', 238, 14, COL.red, { align: 'center', bold: true, scale: 3, outline: COL.ink });
    text('재판장의 인내심이 바닥났다.', 238, 58, COL.dim, { align: 'center', scale: 10 / 12 });
    button(168, 76, 140, 18, '마지막 저장 지점부터', retry);
    button(168, 98, 140, 18, '타이틀로', toTitle);
    frameBox(4, 122, 312, 54);
    drawNameTag(nameOf(OVER.who));
    wrap(OVER.line, LINE_W).slice(0, LINES).forEach((s, i) => text(s, 12, 128 + i * 14, COL.text, { shadow: COL.ink }));
  }
  function drawEnd() {
    rect(0, 0, W, H, COL.night);
    const e = S.end, st = S.stats || { wrongs: 0, hints: 0, overs: 0, sec: 0 };
    text(e.title, 160, 14, e.result === 'win' ? COL.gold : COL.red, { align: 'center', bold: true, scale: 3, outline: COL.ink });
    wrap(e.text || '', 280).slice(0, 2).forEach((s, i) => text(s, 160, 56 + i * 14, COL.text, { align: 'center' }));
    // 결과 요약 — 카페에 공유하기 좋게
    frameBox(60, 88, 200, 50);
    text(`난이도 ${DIFFS[difficulty].label}`, 160, 92, COL.gold, { align: 'center', bold: true });
    text(`실수 ${st.wrongs}회 · 힌트 ${st.hints}번 · 패소 ${st.overs}번`, 160, 107, COL.text, { align: 'center' });
    text(`플레이 시간 ${Math.floor(st.sec / 60)}분 ${String(Math.round(st.sec % 60)).padStart(2, '0')}초`, 160, 121, COL.dim, { align: 'center' });
    if (!shareFile) makeShareFile();
    button(64, 142, 62, 18, '결과 공유', shareResult, { onUp: true });
    button(129, 142, 62, 18, '설문', openSurvey);
    button(194, 142, 62, 18, '타이틀로', toTitle);
    text(`${FEEDBACK} · 제작 ${MAKER}`, 160, 166, COL.dim, { align: 'center', scale: 10 / 12 });
  }
  function drawChoice() {
    const c = S.choice;
    frameBox(4, 118, 312, 58);
    text(c.op.prompt || '어떻게 할까?', 12, 122, COL.gold, { scale: 10 / 12 });
    const n = c.op.options.length, gap = n > 2 ? 14 : 20, bh = n > 2 ? 13 : 18;
    c.op.options.forEach((o, i) => button(16, 133 + i * gap, 288, bh, o.label, () => choose(i), { sel: c.sel === i && pointer.x < 0 }));
  }
  function drawSlots() {
    const v = S.slotView, saving = v.mode === 'save';
    rect(0, 0, W, H, 'rgba(7,6,12,0.85)');
    if (v.mode === 'menu') {
      frameBox(90, 20, 140, 144);
      text('메뉴', 160, 26, COL.gold, { bold: true, align: 'center' });
      const items = MENU.filter((m) => m[2]());
      MENU.forEach(([label, fn, ok], i) => {
        const j = items.findIndex((m) => m[0] === label);
        button(110, 44 + i * 23, 100, 18, label, fn, { off: !ok(), sel: j === v.sel && pointer.x < 0 });
      });
      return;
    }
    if (v.mode === 'quit') {
      frameBox(40, 50, 240, 80);
      text('타이틀 화면으로 돌아갈까요?', 160, 58, COL.gold, { bold: true, align: 'center' });
      text('3칸에 저장하지 않은 진행은 마지막 자동 저장(이어하기)부터 다시 합니다.', 160, 78, COL.dim, { align: 'center', scale: 10 / 12 });
      button(84, 102, 70, 18, '돌아가기', quitToTitle, { sel: v.sel === 0 && pointer.x < 0 });
      button(166, 102, 70, 18, '취소', () => { S.slotView = { mode: 'menu', sel: 0 }; }, { sel: v.sel === 1 && pointer.x < 0 });
      return;
    }
    frameBox(20, 20, 280, 140);
    text(saving ? '저장하기' : '불러오기', 30, 25, COL.gold, { bold: true });
    // 플레이 중에는 저장·불러오기를 오갈 수 있다
    if (S.scene === 'play' && canSlotSave()) {
      button(182, 24, 50, 16, '저장', () => { v.mode = 'save'; }, { sel: saving });
      button(236, 24, 56, 16, '불러오기', () => { v.mode = 'load'; }, { sel: !saving });
    }
    for (let i = 0; i < SLOTS; i++) {
      button(30, 46 + i * 26, 260, 22, slotLabel(i), () => (saving ? saveSlot(i) : loadSlot(i)), { off: !saving && !S.slots[i], sel: v.sel === i && pointer.x < 0 });
    }
    text(saving ? '같은 칸에 저장하면 덮어씁니다.' : '불러오면 지금 진행은 저장하지 않은 채 바뀝니다.', 30, 126, COL.dim, { scale: 10 / 12 });
    button(244, 138, 46, 16, v.from === 'menu' ? '뒤로' : '닫기', slotBack);
  }
  function drawLog() {
    rect(0, 0, W, H, 'rgba(7,6,12,0.85)');
    frameBox(12, 8, 296, 164);
    text('대사 기록', 20, 12, COL.gold, { bold: true });
    const rows = logRows(), lv = S.logView;
    const end = rows.length - lv.off, startRow = Math.max(0, end - LOG_ROWS);
    rows.slice(startRow, end).forEach((r, i) => { if (r) text(r.text, 20, 30 + i * 12, r.color || COL.text, { scale: LOG_DS }); });
    const max = Math.max(0, rows.length - LOG_ROWS);
    button(200, 152, 30, 16, '▲', () => logScroll(1), { off: lv.off >= max });
    button(234, 152, 30, 16, '▼', () => logScroll(-1), { off: lv.off <= 0 });
    button(268, 152, 34, 16, '닫기', () => { S.logView = null; });
  }
  function drawMurmur() {
    const m = S.fx.murmur, j = (k) => Math.round(Math.sin(S.t * 18 + k) * 1.5);
    const a = Math.min(1, m.t * 2);
    g.globalAlpha = a;
    text(m.text, 52 + j(1), 52 + j(2), COL.text, { align: 'center', outline: COL.ink, scale: 10 / 12 });
    text(m.text, 270 + j(3), 64 + j(4), COL.text, { align: 'center', outline: COL.ink, scale: 10 / 12 });
    g.globalAlpha = 1;
  }
  // 심 선택: 1·2·3심을 따로 시작한다(CASE.trials: { label, title, sub })
  function drawSelect() {
    rect(0, 0, W, H, COL.night);
    text('심 선택', 160, 10, COL.gold, { align: 'center', bold: true, scale: 1.5 });
    text('고른 심의 처음부터 시작합니다. 증거는 그 심에서 새로 모읍니다.', 160, 36, COL.dim, { align: 'center', scale: 10 / 12 });
    // 심이 많으면 버튼 간격을 줄인다(5심 + 에필로그 = 6칸까지 한 화면)
    const n = CASE.trials.length, gap = Math.min(24, Math.floor(106 / n)), bh = Math.min(20, gap - 2);
    CASE.trials.forEach((t, i) => button(40, 48 + i * gap, 240, bh, `${t.title} 「${t.sub}」`, () => startNew(t.label)));
    button(120, 158, 80, 18, '돌아가기', () => { S.scene = 'title'; SFX.select(); });
  }
  function drawSkins() {
    rect(0, 0, W, H, COL.night);
    text('의상 고르기', 160, 8, COL.gold, { align: 'center', bold: true });
    Object.keys(CASE.variants).forEach((id, i) => {
      const y = 30 + i * 22, vs = CASE.variants[id];
      const cur = vs.find((v) => v.id === skinOf(id)) || vs[0];
      text(CASE.chars[id].name, 24, y + 2, COL.text, { bold: true });
      button(92, y, 20, 18, '◀', () => cycleSkin(id, -1));
      text(cur.label, 152, y + 2, COL.gold, { align: 'center' });
      button(192, y, 20, 18, '▶', () => cycleSkin(id, 1));
    });
    // 첫 인물의 고른 그림 미리 보기
    const first = Object.keys(CASE.variants)[0];
    const pv = first && portrait(first, 'normal');
    if (pv) { rect(222, 26, 90, 104, '#1a1830'); g.drawImage(pv, 0, 0, pv.width, pv.height, 224, 28, 86, Math.round((86 * pv.height) / pv.width)); }
    button(110, 150, 100, 18, '돌아가기', toTitle);
  }
  function drawRotate() {
    rect(0, 0, W, H, COL.night);
    // 휴대폰 모양을 눕히는 그림
    rect(112, 40, 24, 40, COL.dim); rect(114, 43, 20, 32, COL.night);
    rect(172, 56, 40, 24, COL.gold); rect(175, 58, 32, 20, COL.night);
    text('→', 154, 54, COL.text, { align: 'center' });
    text('휴대폰을 가로로 돌려 주세요', 160, 100, COL.text, { align: 'center', bold: true });
    if (canFull) text('화면을 누르면 전체 화면으로 바뀝니다', 160, 120, COL.dim, { align: 'center' });
  }
  function draw() {
    B = [];
    g.setTransform(RES, 0, 0, RES, 0, 0);
    if (portraitHeld()) { drawRotate(); stat('rotate'); }
    else if (S.scene === 'title') { drawTitle(); stat('title'); if (S.slotView) { B = []; drawSlots(); } }
    else if (S.scene === 'skins') drawSkins();
    else if (S.scene === 'select') drawSelect();
    else if (S.scene === 'dex') drawDex();
    else if (S.scene === 'over') drawOver();
    else if (S.scene === 'end') drawEnd();
    else if (S.mode === 'chapter') drawChapter();
    else {
      const sh = S.fx.shake > 0 ? 2 : 0;
      g.setTransform(RES, 0, 0, RES, sh ? Math.round(Math.random() * 4 - 2) * RES : 0, sh ? Math.round(Math.random() * 4 - 2) * RES : 0);
      drawCourt(); drawPortrait(); if (S.bg === 'court') drawStand();
      g.setTransform(RES, 0, 0, RES, 0, 0);
      drawDanger();
      drawHud();
      if (S.fx.murmur && S.bg === 'court') drawMurmur();
      if (S.mode === 'line' && S.line) drawLine();
      else if (S.mode === 'cross') drawCross();
      else if (S.mode === 'choice' && S.choice) drawChoice();
      else if (S.mode === 'inv' && S.inv) drawInv();
      else frameBox(4, 118, 312, 58);
      if (S.pocket) drawPocket();
      // 위에 덮는 화면이 뜨면 아래 버튼은 눌리지 않게 비운다
      if (S.mode === 'testTitle' && S.testTitle) { B = []; drawTestTitle(); }
      if (S.overlay) { B = []; drawOverlay(); }
      if (S.mode === 'stamp' && S.fx.stamp) { B = []; drawStamp(); }
      if (S.logView) { B = []; drawLog(); }
      if (S.slotView) { B = []; drawSlots(); }
    }
    if (S.toast) { frameBox(90, 150, 140, 20); text(S.toast.text, 160, 153, COL.gold, { align: 'center' }); }
    if (S.fx.flash > 0) rect(0, 0, W, H, `rgba(255,255,255,${S.fx.flash.toFixed(2)})`);
  }

  // ───────── 시작: 글꼴을 기다린 뒤(최대 3초) 돌린다 ─────────
  let last = performance.now();
  function loop(t) {
    update(Math.min(0.05, (t - last) / 1000));
    last = t;
    draw();
    requestAnimationFrame(loop);
  }
  const fonts = Promise.all([document.fonts.load('12px Galmuri11'), document.fonts.load('12px Galmuri11Bold')]);
  Promise.race([fonts, new Promise((r) => setTimeout(r, 3000))]).catch(() => {}).then(() => { started = true; titleSel = S.saved ? 1 : 0; requestAnimationFrame(loop); });
  fonts.then(rewrapLine).catch(() => {});

  // 개발 확인용
  window.__trial = window.__nayuta = { S, step, present, begin, dataErrors, music, resultText, evList, openSurvey, shareFile: () => shareFile, inv: { spots: () => invSpots(), topics: () => invTopics(), moves: () => invMoves(), examine, talk, moveTo, finish: finishInv, ready: () => invReady() } };
})();
