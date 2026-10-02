// variants.js — 題目變體引擎（前端版）：對齊 backend/app/services/variants.py 的規則，
// 同一組 (monster, seed, route) 永遠產出同一題；trap 永遠是「那隻怪的錯法」。
// 先移植三隻 Demo 會用到的怪：負號幽靈 sign-dist、拆根蟲 sqrt-split、平方差雙子 factor-diff。
// 這裡的亂數與 Python 的 random 不同，所以題目和後端不會逐字相同；接上 API 後由後端出題，這裡只是沒有伺服器時的替身。

const MINUS = '−';
const VARS = ['x', 'a', 'y'];
const FACTOR = { plain: 1.0, hills: 1.5, ridge: 2.0, cloud: 2.5 };
const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20], [15, 20, 25], [7, 24, 25], [10, 24, 26], [20, 21, 29], [18, 24, 30], [16, 30, 34], [21, 28, 35], [12, 35, 37], [15, 36, 39], [24, 32, 40], [9, 40, 41], [27, 36, 45], [14, 48, 50], [30, 40, 50]];

export const TRAP_LABELS = { 'sign-dist': '負號只給第一項', 'sqrt-split': '根號拆開各自開', 'factor-diff': '平方差兩個都寫減' };

// ——— 種子亂數（mulberry32 + 字串雜湊）———
function hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return (h ^= h >>> 16) >>> 0; }
function rng(seedStr) {
  let a = hash(seedStr) || 1;
  const next = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    random: next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    choice: (arr) => arr[Math.floor(next() * arr.length)],
    nz: (top, lo = -top) => { const c = []; for (let v = lo; v <= top; v++) if (v !== 0) c.push(v); return c[Math.floor(next() * c.length)]; },
    shuffle: (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
  };
}

// ——— 純文字多項式：{ '2': 1, '1': -6, '0': 9 }（單變數）或 { '2,0': 1, '1,1': 2 }（兩變數）———
const SUP = ['', '', '²', '³'];
const num = (n) => (n < 0 ? `${MINUS}${Math.abs(n)}` : String(n));
const norm = (s) => String(s).replace(/\s+/g, '');
const key = (...e) => e.join(',');
const exps = (k) => k.split(',').map(Number);
function mono(e, vars) { return e.map((p, i) => (p > 0 ? `${vars[i]}${SUP[p]}` : '')).join(''); }
export function poly(p, vars = ['x']) {
  const terms = Object.entries(p).filter(([, c]) => c !== 0).map(([k, c]) => [exps(k), c]);
  terms.sort((a, b) => { const sa = a[0].reduce((x, y) => x + y, 0), sb = b[0].reduce((x, y) => x + y, 0); if (sa !== sb) return sb - sa; for (let i = 0; i < a[0].length; i++) if (a[0][i] !== b[0][i]) return b[0][i] - a[0][i]; return 0; });
  if (!terms.length) return '0';
  let out = '';
  terms.forEach(([e, c], i) => { const m = mono(e, vars); const body = !m ? String(Math.abs(c)) : (Math.abs(c) === 1 ? m : `${Math.abs(c)}${m}`); out += i === 0 ? `${c < 0 ? MINUS : ''}${body}` : ` ${c < 0 ? MINUS : '+'} ${body}`; });
  return out;
}
const cont = (p, vars) => { const s = poly(p, vars); return s.startsWith(MINUS) ? `${MINUS} ${s.slice(1)}` : `+ ${s}`; };
const u = (...coefs) => { const d = coefs.length - 1; const out = {}; coefs.forEach((c, i) => { if (c !== 0) out[key(d - i)] = c; }); return out; };
const coefs = (p) => { const deg = Math.max(0, ...Object.keys(p).map((k) => exps(k)[0])); const out = []; for (let d = deg; d >= 0; d--) out.push(p[key(d)] || 0); return out; };
function pmul(p, q) { const out = {}; for (const [k1, c1] of Object.entries(p)) for (const [k2, c2] of Object.entries(q)) { const k = key(...exps(k1).map((a, i) => a + exps(k2)[i])); out[k] = (out[k] || 0) + c1 * c2; } return clean(out); }
function padd(p, q, sign = 1) { const out = { ...p }; for (const [k, c] of Object.entries(q)) out[k] = (out[k] || 0) + sign * c; return clean(out); }
const psub = (p, q) => padd(p, q, -1);
const pscale = (p, s) => clean(Object.fromEntries(Object.entries(p).map(([k, c]) => [k, c * s])));
const clean = (p) => Object.fromEntries(Object.entries(p).filter(([, c]) => c !== 0));
const bin = (v, k, lead = 1) => `(${poly({ [key(1)]: lead, [key(0)]: k }, [v])})`;
function sqrtStr(n) { if (n === 0) return '0'; let k = 1; for (let f = Math.floor(Math.sqrt(n)); f > 0; f--) if (n % (f * f) === 0) { k = f; break; } const m = n / (k * k); if (m === 1) return String(k); return k === 1 ? `√${m}` : `${k}√${m}`; }
const top = (base, d) => Math.round(base * FACTOR[d]);
class Retry extends Error {}

function distractors(answer, trap, cands) {
  const seen = new Set([norm(answer), norm(trap)]); const out = [];
  for (const c of cands) { if (seen.has(norm(c))) continue; seen.add(norm(c)); out.push(c); if (out.length === 2) return out; }
  throw new Error('干擾項不夠');
}

// ——— 負號幽靈：A − (B)，trap ＝ 只有 B 的第一項變號 ———
function genSignDist(r, d) {
  const t = top(6, d); let head = ''; let aP; let bP;
  if (d === 'plain') { const p = r.int(1, t); let q = r.int(1, t); while (q === p) q = r.int(1, t); aP = u(p, r.nz(t)); bP = u(q, r.nz(t)); }
  else if (d === 'hills' || d === 'ridge') { const lo = d === 'ridge' ? -t : 1; const p2 = r.nz(t, lo); let q2 = r.nz(t, lo); while (q2 === p2) q2 = r.nz(t, lo); aP = u(p2, r.nz(t), r.nz(t)); bP = u(q2, r.nz(t), r.nz(t)); }
  else { const b = r.nz(t); let c = r.nz(t); const e = r.nz(t); while (c === 2 * b) c = r.nz(t); aP = pmul(u(1, b), u(1, b)); bP = u(1, c, e); head = `(${poly(u(1, b))})²`; }
  head = head || `(${poly(aP)})`;
  const answer = psub(aP, bP);
  const first = Object.keys(bP).sort((x, y) => exps(y)[0] - exps(x)[0])[0];
  const rest = Object.fromEntries(Object.entries(bP).filter(([k]) => k !== first));
  const trap = padd(psub(aP, { [first]: bP[first] }), rest);
  const negB = pscale(bP, -1);
  return {
    stem: `${head} − (${poly(bP)}) = ?`, answer: poly(answer), trap: poly(trap),
    cands: [poly(padd(aP, bP)), poly(psub(bP, aP)), poly({ ...answer, [key(0)]: -(answer[key(0)] || 0) })],
    why: `減號要分給括號裡的每一項：−(${poly(bP)}) = ${poly(negB)}，不是只有第一項變號。`,
    steps: [`先把減號發給括號裡每一項：−(${poly(bP)}) = ${poly(negB)}`, `去掉括號：${poly(aP)} ${cont(negB)}`, `合併同類項：= ${poly(answer)}`],
    params: { a: coefs(aP), b: coefs(bP) },
  };
}

// ——— 拆根蟲：√(a² ± b² …)，trap ＝ 拆開各自開根號 ———
function genSqrtSplit(r, d) {
  let roots; let signs;
  if (d === 'plain') { const [a, b, c] = r.choice(TRIPLES.slice(0, 11)); if (r.random() < 0.5) { roots = [a, b]; signs = [1, 1]; if (r.random() < 0.5) roots.reverse(); } else { roots = [c, r.choice([a, b])]; signs = [1, -1]; } }
  else if (d === 'hills') { const a = r.int(1, 12), b = r.int(1, 12); if (a !== b && r.random() < 0.5) { roots = [Math.max(a, b), Math.min(a, b)]; signs = [1, -1]; } else { roots = [a, b]; signs = [1, 1]; } }
  else if (d === 'ridge') { const a = r.int(1, 15), b = r.int(1, 15), c = r.int(1, 15); if (r.random() < 0.5 && a * a + b * b > c * c) { roots = [a, b, c]; signs = [1, 1, -1]; } else { roots = [a, b, c]; signs = [1, 1, 1]; } }
  else { const [a, b, c] = r.choice(TRIPLES); if (r.random() < 0.5) { roots = [a, b]; signs = [1, 1]; } else { roots = [c, r.choice([a, b])]; signs = [1, -1]; } }
  const n = roots.reduce((s, v, i) => s + signs[i] * v * v, 0);
  const trapV = roots.reduce((s, v, i) => s + signs[i] * v, 0);
  const answer = sqrtStr(Math.max(0, n)); const trap = num(trapV);
  if (n <= 0 || norm(answer) === norm(trap)) throw new Retry();
  const inside = roots.map((v, i) => (i ? `${signs[i] > 0 ? '+' : MINUS} ${v * v}` : String(v * v))).join(' ');
  const split = roots.map((v, i) => (i ? `${signs[i] > 0 ? '+' : MINUS} √${v * v}` : `√${v * v}`)).join(' ');
  const sq = Math.floor(Math.sqrt(n));
  return {
    stem: `√(${inside}) = ?`, answer, trap,
    cands: [String(n), String(Math.abs(roots[0] * roots[1])), num(roots[0] - roots[1]), String(trapV + 1), String(n + 1)],
    why: `根號是一個整體，裡面要先算完再開根號：√(${inside}) = √${n} = ${answer}。${split} = ${trap} 是把根號拆開了。`,
    steps: [`先算根號裡面：${inside} = ${n}`, sq * sq === n ? `√${n} = ${answer}` : `${n} 不是完全平方：√${n} 化簡成 ${answer}`, `所以 √(${inside}) = ${answer}`],
    params: { roots, signs },
  };
}

// ——— 平方差雙子：a²x² − b²，trap ＝ 兩個都寫減 (ax − b)² ———
function genFactorDiff(r, d) {
  const v = r.choice(VARS); const t = top(10, d); const b = r.int(1, t); let a; let form; let c = 0;
  if (d === 'plain') { a = 1; form = r.choice(['x2-b2', 'b2-x2']); }
  else if (d === 'hills') { a = r.int(2, 5); form = 'x2-b2'; }
  else if (d === 'ridge') { a = r.int(1, 6); form = 'two-var'; }
  else { a = 1; form = 'shift'; c = r.nz(t); while (Math.abs(c) === b) c = r.nz(t); }
  const ax = poly({ [key(1)]: a }, [v]);
  let stem; let answer; let trap; let cands; let name;
  if (form === 'x2-b2') { stem = poly({ [key(2)]: a * a, [key(0)]: -b * b }, [v]); answer = `${bin(v, b, a)}${bin(v, -b, a)}`; trap = `${bin(v, -b, a)}²`; cands = [`${bin(v, b, a)}²`, a > 1 ? `${bin(v, b, a * a)}${bin(v, -b)}` : `${bin(v, 2 * b)}${bin(v, -2 * b)}`, `${ax}${bin(v, -b, a)}`]; name = `${poly({ [key(2)]: a * a }, [v])} = (${ax})²，${b * b} = ${b}²`; }
  else if (form === 'b2-x2') { stem = `${b * b} − ${v}²`; answer = `(${b} + ${v})(${b} − ${v})`; trap = `(${b} − ${v})²`; cands = [`(${b} + ${v})²`, `${bin(v, b)}${bin(v, -b)}`, `(${2 * b} + ${v})(${2 * b} − ${v})`]; name = `${b * b} = ${b}²，所以是 ${b}² − ${v}²`; }
  else if (form === 'two-var') { const y = v !== 'y' ? 'y' : 'z'; stem = poly({ [key(2, 0)]: a * a, [key(0, 2)]: -b * b }, [v, y]); const f1 = poly({ [key(1, 0)]: a, [key(0, 1)]: b }, [v, y]); const f2 = poly({ [key(1, 0)]: a, [key(0, 1)]: -b }, [v, y]); answer = `(${f1})(${f2})`; trap = `(${f2})²`; cands = [`(${f1})²`, `(${f1})(${ax} − ${b})`, `${ax}(${f2})`]; name = `${poly({ [key(2, 0)]: a * a }, [v, y])} = (${ax})²`; }
  else { stem = `${bin(v, c)}² − ${b * b}`; answer = `${bin(v, c + b)}${bin(v, c - b)}`; trap = `${bin(v, c - b)}²`; cands = [`${bin(v, c + b)}²`, `${bin(v, c)}${bin(v, -b)}`, `${bin(v, c + b)}${bin(v, b - c)}`]; name = `把 ${bin(v, c)} 整個看成一塊：${bin(v, c)}² − ${b}²`; }
  return {
    stem: `${stem} = ?`, answer, trap, cands,
    why: `平方差是一個加、一個減：A² − B² = (A + B)(A − B)。${trap} 乘開會多出中間項，不是原式。`,
    steps: [name, '平方差是一個加、一個減：(A + B)(A − B)', `所以 ${stem} = ${answer}`],
    params: { form, a, b, c, v },
  };
}

const GENERATORS = { 'sign-dist': genSignDist, 'sqrt-split': genSqrtSplit, 'factor-diff': genFactorDiff };

// 小陪四層：問、指、借、示範一步。「指」與「借」依怪而定，「示範一步」用該題的第一步。
const COACH = {
  'sign-dist': { point: '拆開括號的時候，負號發給了幾個人？', lend: '像發糖果：括號前面的負號，括號裡每一個都要拿到。' },
  'sqrt-split': { point: '根號裡面算完了嗎？還是先各自開了？', lend: '√(9 + 16) 是 5，不是 3 + 4。根號是一個整體。' },
  'factor-diff': { point: '一個加、一個減。你寫的兩個都是減？', lend: '乘回去看看：(x − 3)(x − 3) 中間會多出 −6x，抵不掉。' },
};
export const TAUNT = {
  'sign-dist': '你看，只有第一項變號。我就說後面的我不管。',
  'sqrt-split': '分開算比較快，相信我。',
  'factor-diff': '我們是雙胞胎，當然一樣。',
};

/** 同一組 (monster, seed, route) 永遠同一題。回傳的形狀對齊 data.js 的 PATROL 題目。 */
export function generate(monster, seed, route = 'plain') {
  const gen = GENERATORS[monster]; if (!gen) throw new Error(`沒有這隻怪的產生器：${monster}`);
  const r = rng(`${monster}|${route}|${seed}`);
  let g;
  for (let i = 0; i < 50; i++) { try { g = gen(r, route); break; } catch (e) { if (!(e instanceof Retry)) throw e; } }
  if (!g) throw new Error(`${monster} 抽不到合適的參數`);
  const [d1, d2] = distractors(g.answer, g.trap, g.cands);
  const order = r.shuffle([0, 1, 2, 3]); const pool = [g.answer, g.trap, d1, d2];
  return {
    id: `${monster}:${route}:${seed}`, monster, route, stem: g.stem, options: order.map((i) => pool[i]),
    answer: order.indexOf(0), trap: order.indexOf(1), trapLabel: TRAP_LABELS[monster], taunt: TAUNT[monster],
    why: g.why, steps: g.steps,
    hint: { ask: '你寫到哪一步？', point: COACH[monster].point, lend: COACH[monster].lend, show: `${g.steps[0]}。接下來你合併看看。` },
    variantKey: `${monster}|${route}|${JSON.stringify(g.params)}`,
  };
}

/** n 題互不重複（variantKey 去重）。 */
export function bank(monster, n, route = 'plain', seed = 0) {
  const out = []; const seen = new Set(); let i = 0;
  while (out.length < n && i < n * 20) { const q = generate(monster, `${seed}-${i}`, route); i += 1; if (seen.has(q.variantKey)) continue; seen.add(q.variantKey); out.push(q); }
  return out;
}
