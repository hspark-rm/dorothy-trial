// 대본 검수(2026-11-06). 사용자가 되풀이해 지적한 내용을 일반화한 규칙으로 대본 전체를 훑어 후보를 뽑는다.
// 후보는 '고칠 곳'이 아니라 '사람이 볼 곳'이다. 기준은 허브 폴더의 검수포인트 문서와 말투표.
// 사용법: node tools/audit.mjs [규칙 번호…]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require('../data/case1.js');
const { script, evidence, chars } = CASE;
const only = process.argv.slice(2);

// ───── 대사 펼치기: 위치(pc), 말한 사람, 장면(배경·심), 증언 안인지, 쉬움 전용인지 ─────
const L = [];
const trialAt = [];
let bg = 'court', trial = 'trial1';
function walk(o, pc, ctx) {
  if (Array.isArray(o)) { o.forEach((x) => walk(x, pc, ctx)); return; }
  if (!o || typeof o !== 'object') return;
  if (typeof o.line === 'string') L.push({ pc, who: o.who === undefined ? ctx.witness : o.who, line: o.line, face: o.face, easy: !!o.easy, bg: ctx.bg, trial: ctx.trial, part: ctx.part });
  for (const [k, v] of Object.entries(o)) {
    if (typeof v !== 'object' || v === null) continue;
    const part = k === 'press' ? 'press' : k === 'after' ? 'after' : k === 'statements' ? 'statement' : ctx.part;
    walk(v, pc, { ...ctx, witness: o.witness || ctx.witness, part, bg: o.op === 'investigate' ? 'inv' : ctx.bg });
  }
}
script.forEach((op, pc) => {
  if (op.op === 'label' && /^(trial\d|epilogue)$/.test(op.id)) trial = op.id;
  if (op.op === 'bg') bg = op.id;
  trialAt[pc] = trial;
  walk(op, pc, { bg: op.op === 'testimony' || op.op === 'demand' || op.op === 'choice' ? 'court' : bg, trial, part: 'script' });
});
Object.entries(evidence).forEach(([id, e]) => L.push({ pc: -1, who: 'evidence:' + id, line: `${e.name} / ${e.desc}`, bg: '-', trial: '-' }));
// 듣는 사람 짐작: 같은 흐름에서 바로 앞의 다른 화자
L.forEach((x, i) => { for (let j = i - 1; j >= 0 && j > i - 4; j--) if (L[j].who !== x.who && L[j].who) { x.prev = L[j].who; break; } });

const pcOf = (pred) => script.findIndex(pred);
const T5 = pcOf((o) => o.op === 'label' && o.id === 'trial5');
const UNMASK = pcOf((o) => o.op === 'alias' && o.who === 'judge' && o.portrait === 'andersen');
const CLIMAX4 = [pcOf((o) => o.who === 'doban' && /안 쐈다고 무죄가 되나/.test(o.line || '')), pcOf((o) => o.who === 'burningham' && /내가 쐈다/.test(o.line || ''))];
const think = (x) => x.who === 'me' && x.line.startsWith('(');
const last = (s) => s.replace(/["'」』)\]…~!?.,\s]+$/g, '').replace(/^.*[.!?…]\s*/, '');
const POLITE = /(요|죠|니다|니까|시오|세요|예요|에요|십니까|습니까|셔요|어용|해영|에영|이에영|군용|니당|닷|졍|여)$/;
const PLAIN = /(다|야|어|아|지|냐|라|자|해|군|걸|래|니|나|게|네|세|마|가|구나|거든|잖아|봐|줘|돼|래|든|라고|구만|일세|던가|겠지|마라|하지|않나)$/;
const out = (n, title, rows) => {
  if (only.length && !only.includes(String(n))) return;
  console.log(`\n■ 규칙 ${n}. ${title} — ${rows.length}건`);
  rows.forEach((x) => console.log(`  [${x.pc}${x.trial ? ' ' + x.trial : ''}${x.prev ? ' ←' + x.prev : ''}] ${x.who}: ${x.line.slice(0, 110)}`));
};

// 1. 금지 호칭(사용자 지적을 표로)
const BAN = [
  ['dorothy', /당신/, (x) => x.pc > UNMASK && /andersen|judge/.test(x.prev || ''), '도로시→엔더슨은 「지휘관」'],
  [null, /도로시 ?양/, () => true, '오스왈드는 「리더 대행」'],
  ['rapunzel', /스노우 화이트 자매님|자매님.*스노우/, () => true, '라푼젤→스노우 화이트는 이름'],
  ['andersen', /이 (아이|친구)들/, () => true, '엔더슨→갓데스는 「이 녀석들」'],
  ['redhood', /그 애/, () => true, '레드 후드→도로시는 「아가씨」'],
  ['medium', /그 애/, () => true, '레드 후드→도로시는 「아가씨」'],
  [null, /회의.*5분|5분.*회의/, (x) => x.who !== 'andersen', '「회의 5분」은 엔더슨 본인만'],
];
out(1, '금지 호칭', L.filter((x) => BAN.some(([w, re, f]) => (!w || x.who === w) && re.test(x.line) && f(x))));

// 2. 고유 호칭이 있는 인물이 이름 자리({name})를 쓰거나, 정해진 호칭과 다른 말로 변호인을 부름
const OWN = { rapi: '지휘관', anis: '지휘관님', neon: '스승님', redhood: '미남', dorothy: '귀하', arcana: '그쪽', prosecutor: '왓슨', rapunzel: '형제님', hongryeon: '도령', burningham: '자네', andersen: '자네' };
const OTHER = /지휘관님|스승님|형제님|도령|왓슨|그쪽|귀하|미남/g;
out(2, '고유 호칭 어긋남', L.filter((x) => {
  if (!OWN[x.who]) return false;
  if (x.line.includes('{name}')) return true;
  const used = (x.line.match(OTHER) || []).filter((t) => t !== OWN[x.who]);
  // 아르카나 '그쪽'·도로시 '귀하'처럼 겹치는 말은 그 인물 것만 허용
  return used.length > 0 && !(x.who === 'anis' && used.every((t) => t === '지휘관님'));
}));

// 3. 낮잡거나 나이를 오해하게 하는 말(니케·성인에게 '아이'·'꼬마'·'애')
// 허용: 실제 자녀(시민의 '우리 아이'), 릴리바이스 말버릇 '아이들아'(사용자 확인 2026-11-06)
const KID_OK = /우리 아이|아이들아/;
out(3, '아이·꼬마·애 표현', L.filter((x) => /아이(?!리|템|디|콘)|꼬마|계집애|애송이|(^|\s)애(가|는|를|들|야)?(\s|$|[.,!?…])/.test(x.line.replace(KID_OK, ''))));

// 4. 인물 말투 어미(말투표): 존댓말 인물이 반말로, 반말 인물이 존댓말로 끝내는 줄
const POLITE_WHO = ['dorothy', 'neon', 'poli', 'miranda', 'arcana', 'prosecutor', 'rapunzel', 'iri', 'cecil', 'citizen'];
const PLAIN_WHO = ['anis', 'johan', 'doban', 'burningham', 'snowwhite', 'ingrid', 'hongryeon'];
out(4, '말투 어미 어긋남', L.filter((x) => {
  if (x.pc < 0 || think(x)) return false;
  const e = last(x.line);
  if (e.length < 2) return false;
  if (x.who === 'judge') return x.pc < UNMASK && PLAIN.test(e) && !POLITE.test(e); // 에닉·가면 재판장은 합니다체
  if (POLITE_WHO.includes(x.who)) return PLAIN.test(e) && !POLITE.test(e);
  if (PLAIN_WHO.includes(x.who)) return POLITE.test(e) && !/(니다|니까)$/.test(e) || (x.who !== 'anis' && /니다$/.test(e) && x.who !== 'doban');
  if (x.who === 'poli') return /요$/.test(e);
  return false;
}));

// 5. 변호인 높임: 법정(재판·증언)에서는 존댓말, 법정 밖은 반말. 4심 클라이맥스의 도반에게는 반말
out(5, '변호인 높임 어긋남', L.filter((x) => {
  if (x.who !== 'me' || think(x) || x.pc < 0 || /^"/.test(x.line)) return false;
  const e = last(x.line);
  if (e.length < 2) return false;
  const climax = x.pc >= CLIMAX4[0] && x.pc < CLIMAX4[1];
  if (x.bg === 'court' && !climax) return PLAIN.test(e) && !POLITE.test(e);
  if (x.bg !== 'court') return /(니다|니까|시오|세요)$/.test(e);
  return false;
}));

// 6. 번역투 후보
const TR = /그녀|에 의해|을 가지고 있|를 가지고 있|하는 중이|되어지|그것은|에게 있어|를 통해서|이루어졌|만들어 냈|닫혔다|닫혔어|의 그것|하는 것이 가능|필요로 하/;
out(6, '번역투 후보', L.filter((x) => TR.test(x.line) && !(x.who === 'prosecutor')));

// 7. 정보 공개 순서: 5심 전 '갓데스'(폴리 동상 대사는 허용), 가면 벗기 전 '엔더슨', 5심 전 '오스왈드'·'리더 대행'
out(7, '정보가 너무 일찍 나옴', L.filter((x) => x.pc >= 0 && (
  (x.pc < T5 && /갓데스/.test(x.line) && !/동상이에영/.test(x.line)) ||
  (x.pc < UNMASK && /엔더슨/.test(x.line)) ||
  (x.pc < T5 && /오스왈드|리더 대행/.test(x.line)))));

// 8. 힌트: 증거 이름을 짚는 변호인 혼잣말은 쉬움 전용이어야 함(캐묻기·증언 뒤)
const EVN = Object.values(evidence).map((e) => e.name).filter((n) => n.length >= 3);
out(8, '쉬움 전용이 아닌 증거 지목 혼잣말', L.filter((x) => think(x) && !x.easy && (x.part === 'press' || x.part === 'after') && EVN.some((n) => x.line.includes(n))));

// 9. 화면 글자 넘침(갈무리11 근사: 한글 12px, 그 밖 6.5px)
const tw = (s, px = 12) => [...s].reduce((a, c) => a + (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(c) ? px : px * 0.55), 0);
const ui = [];
script.forEach((op, pc) => {
  if (op.op === 'investigate') Object.entries(op.places).forEach(([k, p]) => { if (tw(p.desc || '', 10) > 230) ui.push({ pc, who: `조사 ${k} 설명`, line: p.desc }); });
  if (op.op === 'choice') op.options.forEach((o) => { if (tw(o.label) > 230) ui.push({ pc, who: '선택지', line: o.label }); });
  if (op.op === 'chapter' && tw(op.text, 24) > 300) ui.push({ pc, who: '장 제목', line: op.text });
  if (op.op === 'testimony' && tw(op.title) > 290) ui.push({ pc, who: '증언 제목', line: op.title });
});
(CASE.dex || []).forEach((d) => { if (tw(d.role) > 156 * 4) ui.push({ pc: -1, who: '도감 ' + d.name, line: d.role }); });
out(9, '화면 글자 넘침 후보', ui);

// 10. 관계별 말투(말투표 '다른 호칭' 열): 라피·스노우 화이트·버닝엄은 도로시에게 반말, 네온은 아니스에게도 해요체
const REL = [['rapi', 'dorothy', 'plain'], ['snowwhite', 'dorothy', 'plain'], ['burningham', 'dorothy', 'plain'], ['neon', 'anis', 'polite'], ['rapunzel', 'dorothy', 'polite']];
out(10, '관계별 말투 어긋남', L.filter((x) => {
  const r = REL.find(([w, to]) => x.who === w && x.prev === to);
  if (!r || think(x)) return false;
  const e = last(x.line);
  if (e.length < 2 || /아니다$/.test(e)) return false;
  return r[2] === 'plain' ? POLITE.test(e) : PLAIN.test(e) && !POLITE.test(e);
}));

// 11. 원작에서 이미 아는 사이인데 처음 만난 것처럼 말함(라푼젤 '처음 뵙겠어요' 사례)
out(11, '첫 만남 표현', L.filter((x) => /처음 뵙|초면|처음 보는 얼굴|누구시죠|누구신지/.test(x.line)));

// 12. 100년 전 회상에 지금의 습관을 덧씌움(스노우 화이트 먹성·홍련 술 사례)
out(12, '과거 회상 속 지금 습관', L.filter((x) => /100년 전|그때|그 시절|예전/.test(x.line) && /술|과자|먹|마시|취/.test(x.line)));
