// 대본(data/case1.js)을 읽어 ① 게임 흐름도 ② 분량·플레이 시간 ③ 난이도 모의실험을 마크다운으로 낸다.
// 사용법: node tools/analyze.mjs [출력 경로]   (출력 경로를 비우면 화면에 찍는다)
// 흐름도에는 정답이 들어 있으므로 공개 저장소가 아니라 개인 노트에 저장한다.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data/case1.js'), 'utf8'), ctx);
const C = ctx.window.CASE;
const script = C.script;
const evName = (id) => (C.evidence[id] ? C.evidence[id].name : id);
const who = (id) => (id ? (C.chars[id] ? C.chars[id].name : id) : '해설');
const isLine = (op) => op.who !== undefined && !op.op;
const len = (s) => [...s].length;
// 조사 명령 안의 대사 목록(들어갈 때·살펴보기·이야기·마칠 때). again(두 번째 대사)은 세지 않는다
const invLists = (op) => {
  const ls = [];
  for (const pl of Object.values(op.places)) { ls.push(pl.enter || []); (pl.spots || []).forEach((x) => ls.push(x.lines || [])); (pl.talk || []).forEach((x) => ls.push(x.lines || [])); }
  ls.push((op.done && op.done.lines) || []);
  return ls;
};
const invGives = (op) => invLists(op).flat().filter((x) => x.op === 'give').map((x) => x.id);

// ───────── 구간 나누기: chapter / testimony / demand / end 를 기준으로 ─────────
const labels = new Map(script.map((op, i) => [op, i]).filter(([op]) => op.op === 'label').map(([op, i]) => [op.id, i]));
const segments = [];
let cur = null;
const open = (kind, title) => { cur = { kind, title, lines: 0, chars: 0, gives: [], items: [] }; segments.push(cur); };
open('시작', '시작');
for (const op of script) {
  if (op.op === 'chapter') open('장', `${op.text} — ${op.sub || ''}`);
  else if (op.op === 'label') open('모순 해결', op.id);
  if (isLine(op)) { cur.lines++; cur.chars += len(op.line); }
  if (op.op === 'give') cur.gives.push(op.id);
  if (op.op === 'testimony' || op.op === 'demand' || op.op === 'end' || op.op === 'save' || op.op === 'bg') cur.items.push(op);
}

// ───────── ① 흐름도 ─────────
const out = [];
const P = (s = '') => out.push(s);
P(`# 1심 흐름도 · 분량 · 난이도`);
P();
P(`자동 생성: \`node tools/analyze.mjs\` (${new Date().toISOString().slice(0, 10)}). 대본을 고치면 다시 돌린다. **정답이 들어 있으므로 공개 저장소에 올리지 않는다.**`);
P();
P('## 1. 흐름 한눈에');
P();
P('```mermaid');
P('flowchart TD');
let n = 0, prev = null;
const node = (label, shape = 'box') => {
  const id = `N${n++}`;
  const safe = label.replace(/"/g, "'");
  P(shape === 'diamond' ? `  ${id}{"${safe}"}` : shape === 'round' ? `  ${id}(["${safe}"])` : `  ${id}["${safe}"]`);
  if (prev) P(`  ${prev} --> ${id}`);
  prev = id;
  return id;
};
for (const op of script) {
  if (op.op === 'chapter') node(`${op.text}: ${op.sub || ''}`, 'round');
  if (op.op === 'give' && !script.slice(0, script.indexOf(op)).some((o) => o.op === 'testimony')) { /* 프롤로그 증거는 아래 표로 */ }
  if (op.op === 'testimony') {
    const oks = op.statements.map((s, i) => (s.present ? Object.keys(s.present).map((e) => `${i + 1}번에 「${evName(e)}」`) : [])).flat();
    node(`증언: ${op.title} (${who(op.witness)}, ${op.statements.length}문장)`);
    node(oks.join(' 또는 '), 'diamond');
  }
  if (op.op === 'demand') { node(`증거 요구 (${who(op.who)})`); node(`「${evName(op.answer)}」 제시`, 'diamond'); }
  if (op.op === 'investigate') { node(`조사: ${Object.values(op.places).map((pl) => pl.name).join(' · ')}`); node(`필요 증거 ${op.done.needs.map((e) => `「${evName(e)}」`).join(' ')}`, 'diamond'); }
  if (op.op === 'end') node(`${op.title}`, 'round');
}
P('```');
P();

P('## 2. 단계별 내용');
P();
let step = 0;
for (const op of script) {
  if (op.op === 'chapter') { P(`### ${op.text} — ${op.sub || ''}`); P(); }
  if (op.op === 'give' && !script.slice(0, script.indexOf(op)).some((o) => o.op === 'testimony')) P(`- 주머니 증거품: 「${evName(op.id)}」`);
  if (op.op === 'save') P(`- 💾 저장 지점`);
  if (op.op === 'testimony') {
    step++;
    P(); P(`#### 신문 ${step}: ${op.title} — 증인 ${who(op.witness)}`); P();
    P('| # | 증언 | 캐묻기로 얻는 것 | 정답 증거 |');
    P('|---|---|---|---|');
    op.statements.forEach((s, k) => {
      const gets = (s.press || []).filter((x) => x.op === 'give').map((x) => `「${evName(x.id)}」`).join(', ') || '';
      const ans = s.present ? Object.keys(s.present).map((e) => `**「${evName(e)}」**`).join(', ') : '';
      P(`| ${k + 1} | ${s.line.replace(/\|/g, '/')} | ${gets} | ${ans} |`);
    });
    P();
    if (op.hints) { P('오답 힌트:'); op.hints.forEach((h, i) => P(`${i + 1}. ${h}`)); P(); }
  }
  if (op.op === 'demand') {
    P(); P(`#### 증거 요구 — ${who(op.who)}: "${op.line}"`); P(); P(`정답: **「${evName(op.answer)}」**`); P();
    if (op.hints) { P('오답 힌트:'); op.hints.forEach((h, i) => P(`${i + 1}. ${h}`)); P(); }
  }
  if (op.op === 'investigate') {
    P(); P(`#### 조사 (${op.id}) — 마치려면 ${op.done.needs.map((e) => `「${evName(e)}」`).join(', ')}`); P();
    P('| 장소 | 이야기 상대 | 살펴볼 곳 | 이야기 주제 | 찾는 증거 |');
    P('|---|---|---|---|---|');
    for (const pl of Object.values(op.places)) {
      const found = [...(pl.spots || []).map((x) => [x.name, x.lines]), ...(pl.talk || []).map((x) => [x.topic, x.lines])]
        .flatMap(([nm, ls]) => (ls || []).filter((o) => o.op === 'give').map((o) => `「${evName(o.id)}」(${nm})`)).join(', ');
      P(`| ${pl.name} | ${pl.who ? who(pl.who) : '—'} | ${(pl.spots || []).length}곳 | ${(pl.talk || []).length}개 | ${found} |`);
    }
    P();
  }
  if (op.op === 'end') { P(`### 끝: ${op.title}`); P(); P(op.text || ''); P(); }
}

// ───────── ② 분량 · 플레이 시간 ─────────
let lines = 0, chars = 0, pressLines = 0, pressChars = 0, wrongLines = 0, invLines = 0, invChars = 0;
for (const op of script) {
  if (isLine(op)) { lines++; chars += len(op.line); }
  if (op.op === 'investigate') invLists(op).flat().filter(isLine).forEach((x) => { invLines++; invChars += len(x.line); });
  if (op.op === 'testimony') {
    op.statements.forEach((s) => { lines++; chars += len(s.line); (s.press || []).filter(isLine).forEach((x) => { pressLines++; pressChars += len(x.line); }); });
    wrongLines += (op.wrong || []).length;
  }
}
const CPS = 45, READ_CPS = 12, CLICK = 0.6; // 글자 찍기 초당 45자(1배), 읽기 초당 12자, 줄마다 누르는 시간
const est = (c, l, sp) => Math.max(c / (CPS * sp), c / READ_CPS) + l * CLICK;
const mmss = (sec) => `${Math.floor(sec / 60)}분 ${String(Math.round(sec % 60)).padStart(2, '0')}초`;
P('## 3. 분량과 플레이 시간');
P();
P(`| 항목 | 값 |`);
P(`|---|---|`);
P(`| 대사(본편 + 증언 첫 낭독) | ${lines}줄, ${chars.toLocaleString()}자 |`);
P(`| 조사 대사 전부(살펴보기·이야기 모두) | ${invLines}줄, ${invChars.toLocaleString()}자 |`);
P(`| 캐묻기 대사 전부 | ${pressLines}줄, ${pressChars.toLocaleString()}자 |`);
{
  const pocket = script.filter((o) => o.op === 'give').map((o) => o.id);
  const inv = script.filter((o) => o.op === 'investigate').flatMap(invGives);
  P(`| 증거품 | ${Object.keys(C.evidence).length}개 (주머니 ${pocket.length} · 조사 ${new Set(inv).size} · 나머지는 캐묻기) |`);
}
P();
P('추정 플레이 시간(읽기 초당 12자, 줄마다 0.6초 가정 · 실수 없음 · 조사는 모든 곳을 다 보는 경우):');
P();
P('| 배속 | 글자 찍기만 | 캐묻기 안 함 | 캐묻기 전부 |');
P('|---|---|---|---|');
for (const sp of [1, 2, 4]) {
  const typeOnly = (chars + pressChars) / (CPS * sp);
  P(`| ${sp}배 | ${mmss(typeOnly + invChars / (CPS * sp))} | ${mmss(est(chars + invChars, lines + invLines, sp))} | ${mmss(est(chars + invChars + pressChars, lines + invLines + pressLines, sp))} |`);
}
P();
P('배속은 글자 찍기만 빨라지므로, 읽는 속도가 느린 사람에게는 2배와 4배 차이가 작다.');
P();

// ───────── ③ 난이도 모의실험 ─────────
// 구간: 신문(testimony) / 증거 요구(demand). 저장 지점은 각 구간 앞에 있다(패소하면 그 구간을 하트 5개로 다시).
const stages = [];
const startEv = new Set(C.startEvidence || []);
let pre = [];
for (const op of script) {
  if (op.op === 'give') pre.push(op.id);
  if (op.op === 'investigate') pre.push(...invGives(op));
  if (op.op === 'testimony') {
    const correct = new Set(op.statements.flatMap((s, i) => Object.keys(s.present || {}).map((e) => `${i}|${e}`)));
    const k = op.statements.findIndex((s) => s.present);
    stages.push({
      kind: 'testimony', title: op.title, n: op.statements.length, ans: k, correct,
      ansSt: new Set([...correct].map((c) => +c.split('|')[0])),
      ansEv: [...new Set([...correct].map((c) => c.split('|')[1]))],
      gives: op.statements.map((s) => (s.press || []).filter((x) => x.op === 'give').map((x) => x.id)),
      hints: (op.hints || []).length,
      texts: op.statements.map((s) => s.line),
      pre,
    });
    pre = [];
  }
  if (op.op === 'demand') { stages.push({ kind: 'demand', title: '증거 요구', ansEv: [op.answer], hints: (op.hints || []).length, texts: [op.line], pre }); pre = []; }
}
let seed = 20261104;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

// 낱말 겹침 점수: 증언과 증거(이름+설명)에 같은 한글 두 글자 조각이 몇 개 겹치는지
const grams = (t) => { const g = new Set(); const h = t.replace(/[^가-힣A-Za-z0-9]/g, ''); for (let i = 0; i < h.length - 1; i++) g.add(h.slice(i, i + 2)); return g; };
const evGrams = Object.fromEntries(Object.entries(C.evidence).map(([k, v]) => [k, grams(v.name + (v.from || '') + v.desc)]));
const score = (text, id) => { const a = grams(text); let n = 0; for (const x of a) if (evGrams[id].has(x)) n++; return n; };
const softPick = (cands, beta = 0.6) => { const w = cands.map((c) => Math.exp(beta * c.sc)); let r = rnd() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return cands[i]; } return cands[cands.length - 1]; };

// 플레이어 유형
// reader: 증언을 읽는 사람의 근사. 낱말이 많이 겹치는 (문장, 증거) 쌍을 먼저 고르고, 같은 실수는 안 하며 힌트를 쓴다
// random: 아무 문장에 아무 증거나 낸다(같은 실수 반복 가능), 30% 확률로 아무 문장이나 캐묻는다
// memory: 같은 (문장, 증거) 실수는 다시 하지 않고, 아직 안 캐물은 문장을 30% 확률로 캐묻는다
// hint: memory + 두 번째 힌트(증언 번호를 알려 줌)를 들으면 그 문장에만 증거를 낸다. 필요한 증거가 없으면 캐묻기부터 한다
// thorough: 모든 문장을 먼저 캐묻고, hint처럼 푼다
function play(type) {
  const ev = new Set(startEv);
  let wrongTotal = 0, overs = 0;
  for (const st of stages) {
    st.pre.forEach((x) => ev.add(x));
    const tried = new Set(), pressed = new Set();
    let wrongHere = 0, hearts = 5;
    if (type === 'thorough' && st.kind === 'testimony') st.gives.forEach((g, i) => { pressed.add(i); g.forEach((x) => ev.add(x)); });
    for (let guard = 0; guard < 10000; guard++) {
      const evs = [...ev];
      let s, e;
      if (st.kind === 'testimony') {
        const knowsSt = (type === 'hint' || type === 'thorough' || type === 'reader') && wrongHere >= 2 && st.hints >= 2;
        const unpressed = [...Array(st.n).keys()].filter((i) => !pressed.has(i));
        const needPress = knowsSt && !st.ansEv.some((x) => ev.has(x));
        const wantPress = type === 'random' ? rnd() < 0.3 : (unpressed.length && (needPress || rnd() < 0.3));
        if (wantPress) {
          const i = type === 'random' ? Math.floor(rnd() * st.n) : (needPress ? unpressed.find((j) => st.gives[j].length) ?? pick(unpressed) : pick(unpressed));
          pressed.add(i); st.gives[i].forEach((x) => ev.add(x));
          continue;
        }
        const cand = [];
        for (let i = 0; i < st.n; i++) for (const x of evs) if (!(knowsSt && !st.ansSt.has(i)) && (type === 'random' || !tried.has(`${i}|${x}`))) cand.push([i, x]);
        if (!cand.length) { // 낼 게 없으면 남은 문장을 캐묻는다
          const i = unpressed.length ? pick(unpressed) : Math.floor(rnd() * st.n);
          pressed.add(i); st.gives[i].forEach((x) => ev.add(x)); continue;
        }
        if (type === 'reader') { const c = softPick(cand.map(([i, x]) => ({ i, x, sc: score(st.texts[i], x) }))); s = c.i; e = c.x; } else [s, e] = pick(cand);
        if (st.correct.has(`${s}|${e}`)) break;
      } else {
        const knows = (type === 'hint' || type === 'thorough' || type === 'reader') && wrongHere >= 2;
        const cand = evs.filter((x) => type === 'random' || !tried.has(`d|${x}`));
        const pool = cand.length ? cand : evs;
        e = knows ? st.ansEv[0] : type === 'reader' ? softPick(pool.map((x) => ({ x, sc: score(st.texts[0], x) }))).x : pick(pool);
        s = 'd';
        if (st.ansEv.includes(e)) break;
      }
      tried.add(`${s}|${e}`); wrongHere++; wrongTotal++; hearts--;
      if (hearts === 0) { overs++; hearts = 5; } // 패소 → 저장 지점부터 하트 5개로, 힌트 단계는 유지
    }
  }
  return { wrongTotal, overs };
}
const TYPES = [['random', '아무거나 찍기'], ['memory', '같은 실수는 안 함'], ['hint', '힌트를 듣고 푸는 사람'], ['thorough', '전부 캐묻고 힌트를 듣는 사람'], ['reader', '증언을 읽고 고르는 사람(낱말 연결 근사)']];
const RUNS = 20000;
P('## 4. 난이도 모의실험');
P();
P(`가상 플레이어 5유형 × ${RUNS.toLocaleString()}판. 추리는 하지 않고 무작위로 고르는 사람을 기준으로 잰 **최악에 가까운 경우**다. 실제 사람은 증언을 읽고 추리하므로 이보다 쉽게 느낀다.`);
P();
P('| 유형 | 한 번도 패소 없이 끝낼 확률 | 평균 실수 | 평균 패소 횟수 | 실수 많은 10% |');
P('|---|---|---|---|---|');
for (const [t, label] of TYPES) {
  const rs = Array.from({ length: RUNS }, () => play(t));
  const clean = rs.filter((r) => r.overs === 0).length / RUNS;
  const mw = rs.reduce((a, r) => a + r.wrongTotal, 0) / RUNS;
  const mo = rs.reduce((a, r) => a + r.overs, 0) / RUNS;
  const p90 = rs.map((r) => r.wrongTotal).sort((a, b) => a - b)[Math.floor(RUNS * 0.9)];
  P(`| ${label} | ${(clean * 100).toFixed(1)}% | ${mw.toFixed(1)}회 | ${mo.toFixed(2)}회 | ${p90}회 이상 |`);
}
P();
P('구간별 선택지 수(문장 × 그때 가진 증거):');
P();
{
  const ev = new Set(startEv);
  for (const st of stages) {
    st.pre.forEach((x) => ev.add(x));
    if (st.kind === 'testimony') {
      const before = ev.size, had = st.ansEv.some((x) => ev.has(x)); st.gives.flat().forEach((x) => ev.add(x));
      P(`- ${st.title}: ${st.n}문장 × 증거 ${before}~${ev.size}개 = 정답 ${st.correct.size}쌍 / ${st.n * before}~${st.n * ev.size}쌍${had ? '' : ' (정답 증거를 캐묻기로 먼저 얻어야 함)'}`);
      const all = []; for (let i = 0; i < st.n; i++) for (const x of ev) all.push({ i, x, sc: score(st.texts[i], x) });
      all.sort((a, b) => b.sc - a.sc);
      const rank = all.findIndex((c) => st.correct.has(`${c.i}|${c.x}`)) + 1;
      P(`  - 낱말 연결로 본 첫 정답 순위: ${rank}위 / ${all.length}쌍 (1위에 가까울수록 증언과 증거가 글로 잘 이어짐)`);
    } else {
      P(`- ${st.title}: 증거 ${ev.size}개 중 1개`);
      const all = [...ev].map((x) => ({ x, sc: score(st.texts[0], x) })).sort((a, b) => b.sc - a.sc);
      P(`  - 낱말 연결로 본 정답 순위: ${all.findIndex((c) => st.ansEv.includes(c.x)) + 1}위 / ${all.length}개`);
    }
  }
}
P();

const text = out.join('\n') + '\n';
const dest = process.argv[2];
if (dest) { fs.writeFileSync(dest, text); console.log('저장:', dest); } else process.stdout.write(text);
