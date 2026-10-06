// app.js — Tandelo 冒險世界 Demo：hash 路由、狀態（localStorage）、畫面、動態。
// 只用瀏覽器內建能力；沒有後端也能完整操作。所有資料虛構。
import * as D from './data.js';
import * as V from './variants.js';
import * as SFX from './sfx.js';
import * as API from './api.js';
import * as AV from './avatar.js';

const KEY = 'tandelo.world.v1';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const buzz = (p = 12) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* 無振動也沒關係 */ } };

// ---------- 狀態 ----------
function defaults() {
  return {
    clock: 'sat',
    seed: Math.random().toString(36).slice(2, 8), // 題目種子：換了就換一組題
    cards: 0,              // 今天已完成的任務卡
    shadows: JSON.parse(JSON.stringify(D.INITIAL_SHADOWS)),
    patrol: { i: 0, done: 0, helped: 0, why: false, finished: false },
    relay: { done: false, flagsLeft: 2 },
    ambush: { done: false, passed: false },
    wake: { done: false },
    settled: false,
    route: 'plain',
    duel: { votes: {}, ours: [] },
    witnessed: true,
    letterPlayed: false,
    helpAnswered: false,
    pvp: true,
    personalBoard: false,
    raceSigned: false,
    wallPosts: [],
    cheered: false,
    records: D.RECORD_EVENTS.slice(),
    theme: null,
    sound: true,
    reactions: {},
    weekSent: false,
    interventions: [], // 嚮導的介入紀錄（示範）
    studentId: 9, // 接後端時用哪一位種子學生（示範）
    guideDone: {},
    stage: 'd1', // 示範進度：d1 第 1 天、w1 第 1 週末、w3 第 3 週
    profile: { nick: '小睿', look: { ...AV.PRESETS[1] }, cape: 1, pin: '2580', parent: '媽媽', share: true, joined: true }, // 帳號：家長 LINE 名下的孩子檔案（示範）
    join: null, // 第一次進入流程的暫存
  };
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.stage ? { ...defaults(), ...s } : fresh(); } catch (e) { return fresh(); } }
function fresh() { const d = defaults(); return { ...d, ...stagePreset(d.stage) }; }
let S = load();
SFX.setEnabled(S.sound !== false);
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 隱私模式 */ } }
function reset() { S = fresh(); save(); renderTabs(); go('home'); toast('已重設示範資料'); }

const clock = () => D.CLOCKS.find((c) => c.id === S.clock) || D.CLOCKS[0];
// 題目由變體引擎依種子與路線產生：同一個種子永遠同一組，換種子就「換個樣子出現」
let pqCache = { k: '', qs: [] };
const localPQ = () => { const k = `${S.seed}|${S.route}`; if (pqCache.k !== k) { const qs = V.bank('sign-dist', 3, S.route, `patrol-${S.seed}`); qs[1].askWhy = true; pqCache = { k, qs }; } return pqCache.qs; };
// 接後端時：題目由後端出（只給題幹、選項、answer_token），答案要等後端判了才知道
const remote = { k: '', qs: null, loading: false, err: '' };
function loadRemote() {
  const k = `${S.seed}|${S.route}|${API.base()}`; if (remote.k === k) return;
  Object.assign(remote, { k, qs: null, loading: true, err: '' });
  API.variants('sign-dist', 3, S.route, `patrol-${S.seed}`).then((list) => {
    remote.qs = list.items.map((it) => ({ id: it.variant_key, monster: 'sign-dist', route: S.route, stem: it.stem, options: it.options, token: it.answer_token, answer: null, trap: null, trapLabel: '', taunt: V.TAUNT['sign-dist'], why: '', steps: [], hint: { ask: '你寫到哪一步？', point: '', lend: '', show: '' }, remote: true }));
    remote.qs[1].askWhy = true; remote.loading = false; if (parse().key === 'play') rerender();
  }).catch((e) => { remote.loading = false; remote.err = String(e.message || e); if (parse().key === 'play') rerender(); });
}
const PQ = () => { if (API.base() && remote.qs) return remote.qs; return localPQ(); };
const remoteOne = {};
function remoteQ(monster, seed, route) {
  const k = `${monster}|${seed}|${route}|${API.base()}`;
  if (!remoteOne[k]) {
    const slot = { q: null, loading: true, err: '' }; remoteOne[k] = slot;
    API.variants(monster, 1, route, seed).then((list) => { const it = list.items[0]; slot.q = { id: it.variant_key, monster, route, stem: it.stem, options: it.options, token: it.answer_token, answer: null, trap: null, trapLabel: '', taunt: V.TAUNT[monster], why: '', steps: [], hint: { ask: '你寫到哪一步？', point: '', lend: '', show: '' }, remote: true }; slot.loading = false; rerender(); })
      .catch((e) => { slot.loading = false; slot.err = String(e.message || e); rerender(); });
  }
  return remoteOne[k];
}
const remoteLocal = (monster, seed, route) => { if (!API.base()) return null; const r = remoteQ(monster, seed, route); return r; };
const AQ = () => { const r = remoteLocal('sqrt-split', `ambush-${S.seed}`, S.route); return r ? r.q : V.generate('sqrt-split', `ambush-${S.seed}`, S.route); };
const WQ = () => { const r = remoteLocal('factor-diff', `wake-${S.seed}`, 'plain'); return r ? r.q : V.generate('factor-diff', `wake-${S.seed}`, 'plain'); };
// 接後端時：圖鑑狀態與戰績來自後端（後端的怪 id 和 Demo 的對照）
const MON_MAP = { 'sq-cross': 'sq-expand', 'sign-dist': 'sign-dist', 'sqrt-split': 'sqrt-split', 'sqrt-abs': 'sqrt-sign', 'pyth-hyp': 'pyth-hyp', 'factor-diff': 'diff-sq', 'factor-cross': 'factor-cross', 'quad-zero': 'zero-hide' };
const MON_BACK = Object.fromEntries(Object.entries(MON_MAP).map(([k, v]) => [v, k]));
const RECORD_LABEL = { capture: '收服', wake: '叫醒', explain: '講解抽查合格', dungeon_1: '副本一星（全隊一份）', dungeon_2: '副本兩星（全隊一份）', dungeon_3: '副本三星（全隊一份）' };
const sync = { at: 0, busy: false };
function syncFromBackend(force = false) {
  if (!API.base() || sync.busy || (!force && Date.now() - sync.at < 20000)) return;
  sync.busy = true;
  Promise.all([API.shadows(S.studentId), API.record(S.studentId)]).then(([sh, rec]) => {
    sh.forEach((it) => { const id = MON_MAP[it.monster_id]; if (!id || !S.shadows[id]) return; const prev = S.shadows[id]; const days = it.captured_at ? Math.max(0, Math.round((Date.now() - new Date(it.captured_at)) / 86400000)) : prev.days; S.shadows[id] = { ...prev, state: it.state, days: it.state === 'captured' ? days : prev.days }; });
    S.records = rec.events.map((e) => ({ kind: e.kind, label: RECORD_LABEL[e.kind] || e.kind, pts: e.points, when: String(e.created_at).slice(5, 10).replace('-', '/') }));
    sync.at = Date.now(); sync.busy = false; save(); rerender();
  }).catch((e) => { sync.busy = false; sync.at = Date.now(); toast(`後端沒回應：${e.message}`); });
}
function pushShadowEvent(demoId, event) {
  if (!API.base()) return;
  const back = MON_BACK[demoId]; if (!back) return;
  API.shadowEvent(S.studentId, back, event).then(() => { sync.at = 0; syncFromBackend(true); }).catch((e) => toast(`後端：這隻怪的狀態不符（${e.message.replace(/^http-\d+ ?/, '')}）`));
}
const SKELETON = (title, sub) => `${hd(title, sub)}<div class="qcard skeleton"><div class="row"><span class="sk sk-mon"></span><span class="sk sk-line"></span></div><span class="sk sk-stem"></span><span class="sk sk-opt"></span><span class="sk sk-opt"></span><span class="sk sk-opt"></span><span class="sk sk-opt"></span></div><p class="meta" style="text-align:center">後端出題中 · ${esc(API.host())}</p>`;
const REMOTE_ERR = (title, sub, err) => `${hd(title, sub)}<div class="card coral"><b>後端沒回應</b><small>${esc(err)}</small></div><div class="btns"><button class="btn" data-act="api-retry">再試一次</button><button class="btn ghost" data-act="api-off">先用本地題</button></div>`;
// 遠端題：第一次點某個選項先交給後端判，結果記在題上
function judgeRemote(q, i, then) {
  if (!q.remote || (q.judged && q.judged[i])) return then();
  if (play.busy) return; play.busy = true; rerender();
  API.check(q.monster, q.token, i).then((j) => { q.judged = q.judged || {}; q.judged[i] = j; q.answer = j.answer; q.trapLabel = j.trap_label; q.why = j.why; if (j.hit_trap) q.trap = i; play.busy = false; then(); })
    .catch((e) => { play.busy = false; toast(`後端沒回應：${e.message}`); rerender(); });
}
const night = () => { const [h, m] = clock().time.split(':').map(Number); const t = h * 60 + m; return t >= 1350 || t < 360; };
const mon = (id) => D.MONSTERS.find((m) => m.id === id);
const region = (id) => D.REGIONS.find((r) => r.id === id);
const capturedCount = () => Object.values(S.shadows).filter((s) => s.state === 'captured').length;
const myPoints = () => S.records.reduce((a, r) => a + r.pts, 0);

// ---------- 畫面元件 ----------
const SVG = {
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.5.5-2.5 1.2-3.3C9.6 9.5 10 11 11 11.5 11 8 12 6 12 3z"/><path d="M8.5 14.5c-.9 1.2-1.5 2.4-1.5 3.5a5 5 0 0 0 10 0c0-1-.4-2-1-3"/></svg>',
  clap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 11l5-5M10 14l5-5M13 17l5-5"/><path d="M6 12l-1.5 1.5a4 4 0 0 0 0 5.7l1.3 1.3a4 4 0 0 0 5.7 0L18 14"/><path d="M14 4l1.5-1.5M18 6l1.5-1.5M19 10h2"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.1 1.2 6.1L12 17l-5.4 3 1.2-6.1L3.3 9.8l6.1-.7z"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/></svg>',
  title: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 21l5-2.5 5 2.5-1.5-7.5"/></svg>',
  guild: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3.5 7.5-8 9-4.5-1.5-8-4.5-8-9V6z"/><path d="M12 8v8M8.5 12h7"/></svg>',
  coach: '<svg viewBox="0 0 64 40"><circle cx="21" cy="20" r="18" fill="#F26B54"/><circle cx="43" cy="20" r="18" fill="#0E5F52"/><path d="M32 5.752A18 18 0 0 1 32 34.248A18 18 0 0 1 32 5.752Z" fill="#0D281B"/></svg>',
};
const badgeSvg = (on = true) => `<svg class="badge-svg${on ? '' : ' off'}" viewBox="0 0 48 48" aria-hidden="true"><circle class="ring" cx="24" cy="24" r="20"/><circle class="in" cx="24" cy="24" r="13"/><path class="mk" d="M17 24l4 4 10-10"/></svg>`;
const monSvg = (m, cls = '', extra = '') => `<span class="mon ${cls}" ${extra}><svg aria-hidden="true"><use href="#${m.shape}"/></svg></span>`;
const stateCls = { fog: 'fog', near: '', hit: 'pine', captured: 'shadow', asleep: 'asleep', shadow: 'shadow' };
const lookOf = (n) => (n === 1 ? S.profile.look : AV.PRESETS[n]) || AV.PRESETS[1];
const capeOf = (n) => (n === 1 ? S.profile.cape : n);
const av = (n, cls = '') => (n === 0 ? `<span class="av a0 ${cls}" aria-hidden="true">林</span>` : `<span class="av a${n} ${cls}" aria-hidden="true">${AV.avatarSvg(lookOf(n), capeOf(n), { small: !/\blg\b/.test(cls) })}</span>`);
const heroAv = (mood = 'calm', look = S.profile.look, cape = S.profile.cape) => `<span class="hero-av">${AV.avatarSvg(look, cape, { mood })}</span>`;
const isDark = () => { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches; };
// 只把算式包成數學字體，中文不套斜體
const mxText = (s) => esc(s).replace(/[0-9A-Za-z][0-9A-Za-z()+−\-=²³√/.\s]*[0-9A-Za-z)²³]|[0-9A-Za-z]/g, (m) => `<span class="mx">${m}</span>`);
const kid = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="24" r="14" fill="currentColor"/><path d="M8 62c2-16 12-24 24-24s22 8 24 24z" fill="currentColor"/></svg>';
const towerSvg = '<svg viewBox="0 0 36 48" aria-hidden="true"><use href="#tower"/></svg>';
// 燈塔頁夜景的星點（固定，避免每次重繪閃動）
const SKY_STARS = [[18,22,1.4],[44,58,1],[70,16,1.8],[96,44,1.1],[126,24,1.3],[150,70,.9],[176,18,1.6],[210,52,1],[238,28,1.2],[262,66,1.5],[290,20,1],[318,48,1.7],[346,26,1.1],[372,60,1.3],[34,92,1],[110,88,1.2],[300,96,1],[358,100,1.4],[60,120,.9],[334,128,1.1]];
const hd = (title, sub, back = true) => `<div class="hd ${back ? 'with-back' : ''}">${back ? `<button class="back" data-back aria-label="返回">${SVG.back}</button>` : ''}<div class="grow"><h2>${title}</h2>${sub ? `<span class="sub">${sub}</span>` : ''}</div></div>`;
const wave = (n = 18) => `<span class="wave" aria-hidden="true">${'<i></i>'.repeat(n)}</span>`;

// 隊友動態：載入後每 6 秒多冒一條，像小隊真的在線上；點一下回應
const bootT = Date.now();
const feedCount = () => Math.min(D.TEAM_FEED.length, 2 + Math.floor((Date.now() - bootT) / 6000));
const feedHtml = () => D.TEAM_FEED.slice(0, feedCount()).reverse().map((f, i) => `<div class="item ${i === 0 ? 'new' : ''}">${av(f.av)}<span class="grow"><b>隊友</b> ${esc(f.text)}</span><button class="react ${S.reactions[f.id] ? 'on' : ''}" data-react="${f.id}" aria-label="回應">${SVG.clap || '👏'}<span class="num">${(f.kind === 'card' ? 3 : 1) + (S.reactions[f.id] || 0)}</span></button></div>`).join('');
let feedTimer = null;
function startFeed() { stopFeed(); let n = feedCount(); feedTimer = setInterval(() => { const el = view.querySelector('#feed'); if (!el) return stopFeed(); const m = feedCount(); if (m !== n) { n = m; el.innerHTML = feedHtml(); SFX.play('pop'); } }, 1000); }
function stopFeed() { if (feedTimer) { clearInterval(feedTimer); feedTimer = null; } }

// ---------- 畫面 ----------
const SCREENS = {};

// ---------- 首頁：依進度漸進解鎖（第 1 天只有一件事；之後的系統等用得到時才出現）----------
const STAGE_ORDER = ['d1', 'w1', 'w3'];
const STAGES = { d1: { name: '第 1 天', week: 1 }, w1: { name: '第 1 週末', week: 1 }, w3: { name: '第 3 週', week: 3 } };
const wk = () => (STAGES[S.stage] || STAGES.w3).week;
const atLeast = (st) => STAGE_ORDER.indexOf(S.stage) >= STAGE_ORDER.indexOf(st);
const demoJump = () => `<div class="demo-jump"><span class="tag">示範</span><span class="grow">${esc(STAGES[S.stage].name)}的樣子 · 系統會隨天數慢慢打開</span>${STAGE_ORDER.filter((s) => s !== S.stage).map((s) => `<button class="chip ghost" data-stage="${s}">看${esc(STAGES[s].name)}</button>`).join('')}</div>`;
const taskBtn = (t, compact = false) => `<button class="task ${t.done ? 'done' : ''} ${compact ? 'compact' : ''}" data-go="${t.go}"><span class="mon ${t.done ? 'shadow' : (t.id === 'wake' ? 'asleep' : '')}" aria-hidden="true"><svg><use href="#${t.mon.shape}"/></svg></span><span class="grow"><b>${esc(t.title)}</b><small>${esc(t.sub)}</small>${compact ? '' : `<span class="why">${esc(t.why)}</span>`}</span><span class="go">${t.done ? SVG.check : SVG.chev}</span></button>`;

SCREENS.home = () => {
  // 第 1 天：林老師一句話、今天 3 題、進度、隊友。其他都還沒出現。
  if (S.stage === 'd1') {
    const done = S.patrol.finished ? 3 : S.patrol.done;
    return `
  <div class="d1-hello"><span class="guide-badge" aria-hidden="true">林</span><div><b>林老師</b><p>${S.patrol.finished ? `做得好，${esc(S.profile.nick)}。今天就到這裡，明天見。` : `歡迎加入${esc(D.SQUAD.name)}，${esc(S.profile.nick)}。今天只要做 3 題。`}</p></div></div>
  <button class="hero-task ${S.patrol.finished ? 'done' : ''}" data-go="play">${monSvg(mon('sign-dist'), S.patrol.finished ? 'pine' : 'bob')}<span class="grow"><b>${S.patrol.finished ? '今天的 3 題做完了' : '今天 3 題'}</b><small>負號幽靈 · 括號前面是減號的題目</small></span><span class="go-btn">${S.patrol.finished ? '再看一次' : (done ? '繼續' : '開始')}</span></button>
  <div class="d1-progress"><div class="dots" aria-label="做了 ${done} / 3 題">${[0, 1, 2].map((i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('')}</div><span>${S.patrol.finished ? '夠了，晚安。林老師今晚會寄一封信給家長。' : `做完 3 題，今天就夠了`}</span></div>
  <button class="d1-team" data-go="me"><span class="avs">${av(1, 'me')}${av(2)}${av(3)}${av(4)}${av(5)}</span><span class="grow"><b>${esc(D.SQUAD.name)}</b><small>5 個人一起追同一隻怪 · 2 人今天出發了</small></span></button>
  ${demoJump()}`;
  }
  const c = clock();
  const todays = [
    { id: 'patrol', mon: mon('sign-dist'), title: '今天 3 題 · 負號幽靈', sub: S.patrol.finished ? '3 / 3 完成' : `做了 ${S.patrol.done} / 3`, why: '林老師昨晚說：牠在括號前面，先別急著算。', done: S.patrol.finished, go: 'play' },
    { id: 'relay', mon: mon('factor-cross'), title: '接力題 · 你是第 4 棒', sub: S.relay.done ? '你的那一步交出去了' : '一題拆成五步，你只做接到的那一步', why: '前三位隊友做完了，輪到你。', done: S.relay.done, go: 'relay' },
  ];
  if (atLeast('w3')) {
    todays.push(S.clock === 'mon' || S.clock === 'tue' || S.clock === 'night'
      ? { id: 'ambush', mon: mon('sqrt-split'), title: '怪回來了 · 拆根蟲', sub: S.ambush.done ? (S.ambush.passed ? '收服了' : '牠還在附近，不扣分') : '沒有提示 · 只認第一次', why: '隔了幾天，自己一個人面對牠。答對就收服。', done: S.ambush.done, go: 'ambush' }
      : { id: 'wake', mon: mon('diff-sq'), title: '怪回來了 · 平方差雙子', sub: S.wake.done ? '叫醒了' : '上週又錯了一次 · 不扣分', why: '學會過的東西會忘，再做一次就回來了。', done: S.wake.done, go: 'wake' });
  }
  const next = todays.find((t) => !t.done);
  return `
  <div class="home-top">
    <div class="flag"><svg viewBox="0 0 64 40" aria-hidden="true"><use href="#logo"/></svg>${atLeast('w3') ? `<button class="role" data-go="me" aria-label="這週的位置：${esc(D.ROLES[D.SQUAD.me.role].name)}">${esc(D.ROLES[D.SQUAD.me.role].short)}</button>` : ''}</div>
    <div class="grow"><h2>${esc(D.SQUAD.name)}</h2><span class="sub"><span class="nw">林老師</span> · <span class="nw">第 ${wk()} 週</span></span>${atLeast('w3') ? `<span class="pill exam">${esc(D.SQUAD.examLabel)}</span>` : ''}</div>
    <button class="avs" data-go="me" aria-label="我的冒險者卡">${av(1, 'me')}${av(2)}${av(3)}${av(4)}${av(5)}</button>
  </div>
  ${atLeast('w3') ? `<button class="letter compact" data-act="letter" aria-label="播放林老師的信"><span class="play">${SVG.play}</span><span class="grow"><b>林老師的信 · 第 ${D.LETTER.week} 封</b><small>對面的小隊也在追同一隻怪。</small></span><span class="len num">${D.LETTER.length}</span></button>` : ''}
  <div class="today"><div><div class="count num">${S.cards}<small>/ 3 張任務卡</small></div><div class="meta">${esc(c.label)} · ${esc(c.note)}</div></div><span class="pill honey streak">${SVG.flame || '🔥'} 小隊連續 ${(atLeast('w3') ? D.SQUAD.streak : 2) + (S.cards >= 3 ? 1 : 0)} 天</span></div>
  ${S.cards >= 3 ? `<div class="stop"><span class="moon" aria-hidden="true"></span><span><b>今天三張都亮了，夠了。</b><small>沒有第四張。明天早上六點再發，晚安。</small></span></div>` : ''}
  ${todays.map((t) => taskBtn(t, t !== next)).join('')}
  <button class="task thisweek" data-go="dungeon">${monSvg(mon('sign-dist'), S.settled ? 'shadow sm' : 'sm')}<span class="grow"><b>這週 · ${esc(D.DUNGEON.name)}</b><small>${S.settled ? '已結算 · 全隊答對八成' : `全隊一起過關 · ${esc(D.DUNGEON.settle)}結算`}</small></span><span class="go">${SVG.chev}</span></button>
  <div class="sect"><h3>隊友剛剛</h3><span class="meta live"><i></i>現在</span></div>
  <div class="feed short" id="feed">${feedHtml()}</div>
  ${demoJump()}`;
};

function stagePreset(st) {
  const fresh = { cards: 0, patrol: { i: 0, done: 0, helped: 0, why: false, finished: false }, relay: { done: false, flagsLeft: 2 }, ambush: { done: false, passed: false }, wake: { done: false }, settled: false, wallPosts: [], weekSent: false, cheered: false, helpAnswered: false, letterPlayed: false, duel: { votes: {}, ours: [] }, clock: 'sat' };
  if (st === 'd1') {
    const sh = Object.fromEntries(Object.keys(D.INITIAL_SHADOWS).map((k) => [k, { state: 'fog' }])); sh['sign-dist'] = { state: 'near', note: '今天第一次遇到' };
    return { ...fresh, shadows: sh, records: [], witnessed: false };
  }
  if (st === 'w1') {
    const sh = Object.fromEntries(Object.keys(D.INITIAL_SHADOWS).map((k) => [k, { state: 'fog' }])); sh['sign-dist'] = { state: 'hit', due: '下週一', note: '打中了，下週一再測' }; sh['sq-expand'] = { state: 'near', note: '這週遠征偵察到' };
    return { ...fresh, shadows: sh, records: [{ kind: 'explain', label: '講解抽查合格', pts: 3, when: '10/09' }], witnessed: true };
  }
  return { ...fresh, shadows: JSON.parse(JSON.stringify(D.INITIAL_SHADOWS)), records: D.RECORD_EVENTS.slice(), witnessed: true };
}
function setStage(st) { S = { ...S, ...stagePreset(st), stage: st }; play = { lvl: 0, picked: null, tried: false, rec: 0 }; save(); renderTabs(); go('home'); toast(`示範：${STAGES[st].name}`); }

// ---------- 「為什麼」：用說的或打字（不想在家人旁邊開口也能交）----------
const whyOk = () => play.rec >= 3 || (play.typed || 0) >= 6;
const whyBox = (tip) => `<div class="rec ${play.rec ? 'on' : ''} ${play.typing ? 'typing' : ''}">${play.typing
  ? `<textarea class="in why-in" data-why-in rows="2" maxlength="120" placeholder="用一句話說為什麼，例如：減號要分給括號裡每一項">${esc(play.whyText || '')}</textarea><button class="linkbtn" data-act="why-voice">改用說的</button>`
  : `<button class="mic ${play.rec ? 'on' : ''}" data-act="rec" aria-label="按住說一句為什麼">${SVG.mic}</button><span class="t num">0:${String(play.rec).padStart(2, '0')}</span>${wave(14)}<button class="linkbtn" data-act="why-type">不方便說話？改用打字</button>`}<p>${tip}</p></div>`;

// ---------- 我：冒險者卡（成長只從驗證過的學會來：階級看戰績，不看練習量）----------
const RANKS = [{ at: 0, name: '見習冒險者', frame: 'paper' }, { at: 30, name: '斥候', frame: 'cloth' }, { at: 80, name: '守塔人', frame: 'wood' }, { at: 150, name: '引路人', frame: 'foil' }];
const rankOf = (p) => RANKS.reduce((r, x, i) => (p >= x.at ? i : r), 0);
const ROLE_ORDER = ['scout', 'striker', 'scribe', 'quartermaster'];
SCREENS.me = () => {
  const P = S.profile; const pts = myPoints(); const ri = rankOf(pts); const rk = RANKS[ri]; const nx = RANKS[ri + 1];
  const caps = D.MONSTERS.filter((m) => S.shadows[m.id].state === 'captured');
  const chasing = D.MONSTERS.filter((m) => ['hit', 'near'].includes(S.shadows[m.id].state));
  const wakes = S.records.filter((r) => r.kind === 'wake').length; const explains = S.records.filter((r) => r.kind === 'explain').length;
  const role = D.ROLES[D.SQUAD.me.role]; const badges = D.SQUAD.me.roleBadges || {};
  const title = D.TITLES.find((t) => t.earned && !t.team);
  return `
  ${hd('我', `${esc(D.SQUAD.name)} · 第 ${wk()} 週`, false)}
  <div class="acard f-${rk.frame}">
    <div class="acard-top"><span class="rank-name">${esc(rk.name)}</span>${atLeast('w3') ? `<span class="role-chip">${esc(role.short)} · 這週${esc(role.name)}</span>` : ''}</div>
    <div class="acard-hero"><div class="partners">${caps.slice(0, 3).map((m, i) => monSvg(m, 'shadow', `style="--i:${i}"`)).join('')}</div>${heroAv()}</div>
    <div class="acard-name"><h3>${esc(P.nick)}</h3>${title && atLeast('w3') ? `<span class="stamp">${esc(title.name)}</span>` : ''}</div>
    <div class="stats3"><div><b class="num">${caps.length}</b><small>收服</small></div><div><b class="num">${wakes}</b><small>叫醒</small></div><div><b class="num">${explains}</b><small>講解</small></div></div>
    <div class="rank-next">${nx ? `<div class="bar"><i style="transform:scaleX(${((pts - rk.at) / (nx.at - rk.at)).toFixed(3)})"></i></div><small>再 <b class="num">${nx.at - pts}</b> 點戰績升為「${esc(nx.name)}」· 戰績只算驗證過的學會</small>` : '<small>最高階。接下來帶新隊友。</small>'}</div>
  </div>
  ${atLeast('w3') ? `<div class="sect"><h3>這週的位置</h3><span class="meta">每週輪換 · 不看程度</span></div>
  <div class="card role-card"><div class="row"><span class="role-big">${esc(role.short)}</span><div class="grow"><b>${esc(role.name)}</b><p class="meta">${esc(role.does)}</p></div></div>
    <div class="role-badges">${ROLE_ORDER.map((k) => `<span class="rb ${badges[k] ? 'on' : ''} ${k === D.SQUAD.me.role ? 'cur' : ''}"><i>${esc(D.ROLES[k].short)}</i><small>${esc(D.ROLES[k].name)}</small></span>`).join('')}</div>
    <p class="meta">嚮導確認你做完一次，就點亮一枚職業章。四枚都亮，得到稱號「全能隊員」。</p></div>` : ''}
  <div class="sect"><h3>正在追的怪</h3><span class="meta">打中之後隔幾天再測，不給提示就收服</span></div>
  <div class="card">${chasing.map((m) => { const s = S.shadows[m.id]; return `<button class="learned-row" data-lore="${m.id}">${monSvg(m, `${stateCls[s.state]} sm`)}<span class="grow"><b>${esc(m.name)}</b><small>${esc(m.skill)}</small></span><span class="pill ${s.state === 'hit' ? 'brand' : 'coral'}">${s.state === 'hit' ? `打中了 · ${esc(s.due || '幾天後')}再測` : '還在附近'}</span></button>`; }).join('') || '<p class="meta">這週還沒遇到怪。先去巡邏。</p>'}</div>
  <div class="menu">
    <button data-go="shadows"><span class="mi">${monSvg(caps[0] || D.MONSTERS[0], 'shadow sm')}</span><span class="grow"><b>怪物圖鑑</b><small>收服 ${caps.length} 隻 · 傳說卡與稱號</small></span>${SVG.chev}</button>
    <button data-go="week"><span class="mi">${SVG.title}</span><span class="grow"><b>我學會的</b><small>被我識破的錯法、我會說的一句</small></span>${SVG.chev}</button>
    <button data-go="record"><span class="mi num">${pts}</span><span class="grow"><b>我的戰績</b><small>只有自己和家長看得到</small></span>${SVG.chev}</button>
    <button data-go="profile"><span class="mi">${av(1)}</span><span class="grow"><b>帳號與設定</b><small>暱稱、角色、PIN、家長 LINE</small></span>${SVG.chev}</button>
  </div>`;
};

// ---------- 帳號與設定（孩子的檔案在家長 LINE 名下；不收 email、電話、真名）----------
SCREENS.profile = () => {
  const P = S.profile; const role = D.ROLES[D.SQUAD.me.role];
  return `
  ${hd('帳號與設定', '只有你和家長看得到')}
  <div class="card prof"><div class="row">${heroAv()}<div class="grow"><b class="nick">${esc(P.nick)}</b><small class="meta">${esc(D.SQUAD.name)} · 這週${esc(role.name)}</small></div><button class="btn sm ghost" data-act="join-edit">換造型</button></div></div>
  <div class="card"><h3>我</h3>
    <div class="setrow"><span>暱稱<small>隊友看到的是暱稱和角色，不是真名</small></span><b>${esc(P.nick)}</b></div>
    <div class="setrow"><span>PIN<small>只用來在這台手機上打開；忘了請家長在 LINE 重設</small></span><b class="num">••••</b></div></div>
  <div class="card"><h3>小隊</h3>
    <div class="setrow"><span>隊伍<small>跨校湊隊，8 週同一隊</small></span><b>${esc(D.SQUAD.name)}</b></div>
    <div class="setrow"><span>嚮導<small>國中數學老師，每週帶一次遠征</small></span><b>${esc(D.SQUAD.guide)}</b></div></div>
  <div class="card"><h3>家長</h3>
    <div class="setrow"><span>家長 LINE<small>帳號在家長名下；營地來信寄到這裡</small></span><b>已綁定 · ${esc(P.parent)}</b></div>
    <div class="setrow"><span>分享卡<small>家長同意後才能傳；這裡只能看，改要請家長</small></span><b>${P.share ? '已同意' : '未開'}</b></div>
    <div class="setrow"><span>上個人榜<small>預設關；13 歲以下要家長在 LINE 同意</small></span><button class="switch ${S.personalBoard ? 'on' : ''}" data-act="pboard" role="switch" aria-label="上個人榜"></button></div></div>
  <div class="card"><h3>這台手機</h3>
    <div class="setrow"><span>音效<small>打中、連擊、收服的聲音</small></span><button class="switch ${S.sound !== false ? 'on' : ''}" data-act="sound" role="switch" aria-label="音效"></button></div>
    <div class="setrow"><span>深色模式<small>22:30 後自動轉暗</small></span><button class="switch ${isDark() ? 'on' : ''}" data-act="theme" role="switch" aria-label="深色模式"></button></div>
    <div class="setrow"><span>登出這台手機<small>下次要用 PIN 或家長的通行證打開</small></span><button class="btn sm ghost" data-act="logout">登出</button></div></div>
  <div class="card flat"><h3>示範</h3>
    <div class="btns"><button class="btn soft" data-act="join-start">從第一次進入開始走一遍</button><button class="btn ghost" data-go="settings">示範面板 · 時間、後端、重設</button></div></div>`;
};

// ---------- 第一次進入：家長通行證 → 暱稱 → 捏角色 → PIN → 出發 ----------
const JOIN_STEPS = ['通行證', '暱稱', '角色', 'PIN', '出發'];
const NICKS = ['小睿', '阿翔', '晴天', '跑跑', 'Leo', '小樹'];
const swatch = (c) => `<i class="sw" style="background:${c}"></i>`;
const lookRow = (label, key, names, colors) => `<div class="lookrow"><span class="lbl">${label}</span><div class="chips">${names.map((n, i) => `<button class="chip ${S.join.look[key] === i ? 'on' : ''}" data-look="${key}:${i}" aria-pressed="${S.join.look[key] === i}">${colors ? swatch(colors[i]) : ''}${colors ? '' : esc(n)}${colors ? `<span class="sr">${esc(n)}</span>` : ''}</button>`).join('')}</div></div>`;
SCREENS.join = () => {
  if (!S.join) S.join = { step: 0, mode: 'new', nick: '', look: { ...AV.PRESETS[1], hair: 0 }, pin: '', cape: 1 };
  const J = S.join; const st = J.step;
  const prog = `<div class="jsteps" aria-label="第 ${st + 1} 步，共 ${JOIN_STEPS.length} 步">${JOIN_STEPS.map((n, i) => `<i class="${i < st ? 'done' : (i === st ? 'cur' : '')}"></i>`).join('')}</div>`;
  const head = hd(J.mode === 'edit' ? '換造型' : '加入小隊', J.mode === 'edit' ? '斗篷顏色由小隊分配' : `第一次進入 · ${st + 1} / ${JOIN_STEPS.length} · ${JOIN_STEPS[st]}`);
  let body = '';
  if (st === 0) {
    body = `<p class="lead">家長在 LINE 開好帳號後，會收到一張通行證。</p>
    <div class="line-body pass"><div class="bub"><b>Tandelo 營地 · 通行證</b><br>孩子的冒險通行證開好了。請讓孩子用手機相機掃這張，或在 App 輸入 6 碼。<svg class="qr" viewBox="${D.JOIN_QR.vb}" aria-hidden="true" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${D.JOIN_QR.d}" stroke="#13302B"/></svg><span class="code num">482 915</span><span class="t">10 分鐘內有效</span></div></div>
    <div class="codebox num" aria-label="通行證 6 碼">${'482915'.split('').map((d) => `<i>${d}</i>`).join('')}</div>
    <p class="meta">孩子不需要 email、電話或真名。帳號在家長名下，家長可以隨時在 LINE 暫停或刪除。</p>`;
  } else if (st === 1) {
    body = `<p class="lead">取一個暱稱。</p><input class="in big" data-nick-in maxlength="8" value="${esc(J.nick)}" placeholder="2 到 8 個字" autocomplete="off">
    <div class="chips">${NICKS.map((n) => `<button class="chip ${J.nick === n ? 'on' : ''}" data-nick="${esc(n)}">${esc(n)}</button>`).join('')}</div>
    <p class="meta">別用真名。隊友看到的只有暱稱和你的角色。</p>`;
  } else if (st === 2) {
    body = `<div class="look-preview">${heroAv('smile', J.look, J.cape)}<small>斗篷顏色由小隊分配 ${swatch(AV.CAPES[J.cape])}</small></div>
    ${lookRow('臉型', 'face', AV.FACE_NAMES)}${lookRow('膚色', 'skin', ['淺', '中淺', '中深', '深'], AV.SKINS)}${lookRow('髮型', 'hair', AV.HAIR_NAMES)}${lookRow('髮色', 'hairC', ['黑', '深棕', '棕', '墨黑'], AV.HAIRS)}${lookRow('隨身帶', 'acc', AV.ACC_NAMES)}`;
  } else if (st === 3) {
    body = `<p class="lead">設一組 4 位數 PIN。</p><div class="pin-dots" aria-label="已輸入 ${J.pin.length} 位">${[0, 1, 2, 3].map((i) => `<i class="${i < J.pin.length ? 'on' : ''}"></i>`).join('')}</div>
    <div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) => (k ? `<button class="key num" data-pin="${k}" aria-label="${k === '⌫' ? '刪除' : k}">${k}</button>` : '<span></span>')).join('')}</div>
    <p class="meta">只用來在這台手機上打開 App。忘了請家長在 LINE 重設。</p>`;
  } else {
    body = `<div class="card ready-card"><div class="row">${heroAv('smile', J.look, J.cape)}<div class="grow"><b class="nick">${esc(J.nick)}</b><small class="meta">${esc(D.SQUAD.name)} · 嚮導 ${esc(D.SQUAD.guide)}</small></div></div></div>
    <div class="card flat"><b>出發前的第一件事</b><p class="meta">8 題、兩分鐘的診斷，找出你的第一隻怪。答錯沒關係，那正是我們要找的。</p></div>
    <p class="meta">示範版會沿用四葉小隊第 3 週的進度，讓你直接看到冒險中的樣子。</p>`;
  }
  const can = st === 1 ? J.nick.trim().length >= 1 : (st === 3 ? J.pin.length === 4 : true);
  const label = J.mode === 'edit' ? '儲存造型' : (st === 0 ? '這是孩子的手機，開始' : (st === 4 ? '出發' : '下一步'));
  return `${head}${J.mode === 'edit' ? '' : prog}<div class="join">${body}</div><div class="btns"><button class="btn" data-act="join-next" ${can ? '' : 'disabled'}>${label}</button></div>`;
};

SCREENS.letter = () => `
  ${hd(`嚮導的信 · 第 ${D.LETTER.week} 封`, `「${D.LETTER.chapter}」· 林老師的聲音 · ${D.LETTER.length}`)}
  <div class="stack">
    ${D.LETTER.panels.map((p, i) => `<div class="card ${i === 2 ? 'night' : ''}" style="animation:pop .4s var(--ease) ${i * .12}s both"><div class="row">${monSvg(mon(p.mon), stateCls[p.state] || '')}<div class="grow"><b>${esc(p.title)}</b><p style="font-size:14px;margin-top:2px">${esc(p.text)}</p></div></div></div>`).join('')}
  </div>
  <div class="btns"><button class="btn" data-back>回到今天</button></div>`;

SCREENS.shadows = () => {
  const caps = D.MONSTERS.filter((m) => S.shadows[m.id].state === 'captured');
  const asleep = D.MONSTERS.filter((m) => S.shadows[m.id].state === 'asleep');
  return `
  ${hd('怪物圖鑑', `收服的夥伴站在你身後 · ${esc(S.profile.nick)}`)}
  <div class="wall"><div class="stars"></div><div class="count">收服 <b>${caps.length}</b> 隻 · 睡著 ${asleep.length}</div>
    <div class="shadows">${[...caps.map((m) => ({ m, cls: 'shadow blink' })), ...asleep.map((m) => ({ m, cls: 'asleep' }))].map((o, i, arr) => { const n = arr.length; const spread = Math.min(220, 70 * (n - 1)); const sx = n === 1 ? 0 : -spread / 2 + (spread / (n - 1)) * i; const sy = 8 + Math.abs(sx) * 0.18; return monSvg(o.m, o.cls, `style="--sx:${sx}px;--sy:${sy}px;--ss:${1 - Math.abs(sx) / 600};--sd:${i * 0.12}s"`); }).join('')}</div>
    <div class="you">${heroAv()}<small>${esc(D.SQUAD.me.nick)} · ${esc(D.SQUAD.name)}</small></div>
  </div>
  <div class="sect"><h3>數理大陸 · 八隻怪</h3><span class="meta">點一隻看傳說卡</span></div>
  <div class="mgrid">${D.MONSTERS.map((m) => { const s = S.shadows[m.id]; return `<button class="mcard ${s.state === 'fog' ? 'fogc' : ''}" data-lore="${m.id}">${monSvg(m, stateCls[s.state])}<span><b>${s.state === 'fog' ? '？？？' : esc(m.name)}</b><small>${esc(region(m.region).name)} · ${esc(D.STATE_LABEL[s.state])}${s.days ? ` · 第 ${s.days} 天` : ''}</small></span></button>`; }).join('')}</div>
  <div class="legend"><span><i style="background:var(--fog);border:1.5px dashed var(--fog-text)"></i>迷霧</span><span><i style="background:var(--coral)"></i>還在附近</span><span><i style="background:var(--pine)"></i>打中了</span><span><i style="background:var(--shadow-ink);box-shadow:0 0 0 2px var(--honey) inset"></i>收服</span><span><i style="background:var(--fog)"></i>睡著了</span></div>
  <div class="sect"><h3>稱號</h3><span class="meta">只數收服、叫醒、講解</span></div>
  <div class="titles">${D.TITLES.map((t) => `<div class="title ${t.earned ? '' : 'off'}"><span class="badge">${t.team ? SVG.flag : SVG.title}</span><span><b>${esc(t.name)}</b><small>${esc(t.rule)}${t.team ? ' · 隊伍級' : ''}</small></span><span class="pr">${t.earned ? '已獲得' : `${t.progress[0]} / ${t.progress[1]}`}</span></div>`).join('')}</div>
  <div class="sect"><h3>冒險日誌</h3><button data-go="record">看戰績</button></div>
  <div class="card"><div class="row">${av(1, 'me')}<div class="grow"><b>「負號要發給括號裡每一個人。」</b><small>說給我聽 · 0:28 · 10/09</small></div><button class="btn sm soft">重聽</button></div></div>`;
};

SCREENS.week = () => {
  const caps = D.MONSTERS.filter((m) => S.shadows[m.id].state === 'captured');
  const chasing = D.MONSTERS.filter((m) => ['near', 'hit'].includes(S.shadows[m.id].state));
  const asleep = D.MONSTERS.filter((m) => S.shadows[m.id].state === 'asleep');
  const wakes = S.records.filter((r) => r.kind === 'wake').length;
  const explains = S.records.filter((r) => r.kind === 'explain').length;
  return `
  ${hd('我學會的', `第 ${wk()} 週 · 這一季到現在`)}
  <div class="week-hero"><div class="stars"></div>
    <div class="shelf">${caps.map((m, i) => monSvg(m, 'shadow blink', `style="--i:${i}"`)).join('')}${asleep.map((m, i) => monSvg(m, 'asleep', `style="--i:${caps.length + i}"`)).join('')}</div>
    <div class="plank"></div>
    <div class="stats3"><div><b class="num">${caps.length}</b><small>收服</small></div><div><b class="num">${wakes}</b><small>叫醒</small></div><div><b class="num">${explains}</b><small>講解</small></div></div>
  </div>
  <div class="sect"><h3>被我識破的錯法</h3></div>
  <div class="card">${caps.map((m) => { const sh = S.shadows[m.id]; return `<div class="learned-row">${monSvg(m, 'shadow sm')}<span class="grow"><b>${esc(m.name)}</b><small>${esc(m.skill)}</small></span>${sh.days ? `<span class="pill honey">第 ${sh.days} 天 不給提示也會</span>` : ''}</div>`; }).join('') || '<p class="meta">還沒有。這週收服第一隻。</p>'}</div>
  <div class="sect"><h3>我會說的一句</h3><span class="meta">書記整理 · 說給家人聽</span></div>
  ${caps.slice(0, 3).map((m) => `<div class="quote say"><p>${esc(m.weakness)}</p><small>${esc(m.name)} · ${esc(region(m.region).name)}</small></div>`).join('')}
  ${chasing.length ? `<div class="sect"><h3>還在追</h3></div><div class="mgrid">${chasing.map((m) => `<button class="mcard" data-lore="${m.id}">${monSvg(m, stateCls[S.shadows[m.id].state])}<span><b>${esc(m.name)}</b><small>${esc(D.STATE_LABEL[S.shadows[m.id].state])}</small></span></button>`).join('')}</div>` : ''}
  <div class="btns"><button class="btn honey" data-act="week-send" ${S.weekSent ? 'disabled' : ''}>${S.weekSent ? '已傳到營地' : '傳到營地（家人 LINE）'}</button><button class="btn ghost" data-go="record">看戰績</button></div>`;
};

SCREENS.guide = () => {
  const G = D.GUIDE_QUEUE; const W = D.GUIDE_WEEK;
  const used = W.minutesSoFar + S.interventions.reduce((a, r) => a + (r.minutes || 0), 0);
  const perStudent = used / W.students;
  const pending = G.filter((g) => !S.guideDone[g.id]);
  return `
  ${hd('嚮導 · 四葉小隊', `今晚 ${pending.reduce((a, g) => a + g.minutes, 0)} 分鐘 · 只在三個時刻介入`)}
  <div class="gmeter ${perStudent > W.cap ? 'over' : ''}"><div><b class="num">${perStudent.toFixed(1)}</b><small>分鐘 / 每生每週</small></div><div class="bar"><i style="transform:scaleX(${Math.min(1, perStudent / W.cap)})"></i></div><span class="meta">上限 ${W.cap}</span></div>
  ${G.map((g) => { const done = S.guideDone[g.id]; const m = mon(g.mon); return `<div class="gcard ${done ? 'done' : ''}">${monSvg(m, done ? 'shadow sm' : 'sm')}<div class="grow"><b>${esc(g.who)} · ${esc(g.text)}</b><small>${esc(g.ladder)} → 你</small>${done ? `<small class="ok">已處理 · ${esc(done)}</small>` : (g.lines && play.gpick === g.id ? `<div class="chips">${g.lines.map((l) => `<button class="chip" data-gline="${g.id}" data-text="${esc(l)}">${esc(l)}</button>`).join('')}</div>` : '')}</div>${done ? '' : (g.kind === 'explain' ? `<button class="mic sm ${play.rec ? 'on' : ''}" data-act="rec" data-gid="${g.id}" aria-label="按住錄 30 秒">${SVG.mic}</button>` : `<button class="btn sm ${play.gpick === g.id ? 'ghost' : ''}" data-gpick="${g.id}">${esc(g.action)}</button>`)}</div>`; }).join('')}
  ${play.rec >= 3 && pending.some((g) => g.kind === 'explain') ? `<div class="btns"><button class="btn honey" data-gsend="${pending.find((g) => g.kind === 'explain').id}">送出 ${play.rec} 秒講解</button></div>` : ''}
  <div class="sect"><h3>本週介入紀錄</h3><span class="meta">${S.interventions.length} 筆</span></div>
  <div class="card">${S.interventions.slice().reverse().map((r) => `<div class="kv"><span>${esc(r.label)}<span class="meta" style="margin-left:6px">${esc(r.when)}</span></span><b>${r.minutes} 分</b></div>`).join('') || '<p class="meta">今晚還沒有。系統與巡查先處理，輪到你再出手。</p>'}</div>
  <div class="btns"><button class="btn ghost" data-go="home">回到孩子的畫面</button></div>`;
};

SCREENS.record = () => `
  ${hd('我的戰績', '只有自己和家長看得到')}
  <div class="card"><div class="settle"><div class="big num">${myPoints()}</div><div class="lbl">本季累積 · 只從驗證過的學會來</div></div></div>
  <div class="card">${S.records.slice().reverse().map((r) => `<div class="kv"><span>${esc(r.label)}<span class="meta" style="margin-left:6px">${esc(r.when)}</span></span><b>+${r.pts}</b></div>`).join('')}</div>
  <div class="card flat"><h3>怎麼算</h3>
    <div class="kv"><span>收服一隻怪</span><b>10</b></div><div class="kv"><span>叫醒一隻睡著的夥伴</span><b>5</b></div><div class="kv"><span>講解被嚮導抽查合格</span><b>3</b></div><div class="kv"><span>副本過關（一到三星，全隊一份）</span><b>5–12</b></div></div>`;

SCREENS.dungeon = () => {
  const m = mon('sign-dist');
  const r = D.ROUTES[S.route];
  const patrolSt = S.patrol.finished ? 'done' : '';
  const ambushOpen = ['mon', 'tue', 'night'].includes(S.clock);
  return `
  ${hd('這週', `${esc(D.SQUAD.subject)} · 第 ${wk()} 週 · 全隊一起過關`, false)}
  <div class="dg-hero"><div class="fogbg"></div><span class="eyebrow">多項式林</span><h2>${esc(D.DUNGEON.name)}</h2><p>${S.settled ? '已結算 · 80% 兩星過關' : '本週副本進行中 · 結算之前不顯示人數與分數'}</p>${monSvg(m, S.settled ? 'shadow' : 'bob')}</div>
  <button class="layer ${patrolSt}" data-go="play"><span class="n">1</span><span><b>巡邏 · 每人 3 題</b><small>本週遠征那隻怪，換個樣子出現。小陪和求援隨時可用。</small></span><span class="st">${S.patrol.finished ? '3 / 3' : `${S.patrol.done} / 3`}</span></button>
  <button class="layer ${ambushOpen ? (S.ambush.done ? 'done' : '') : 'lock'}" data-go="${ambushOpen ? 'ambush' : 'dungeon'}" ${ambushOpen ? '' : 'data-locked="1"'}><span class="n">2</span><span><b>伏擊 · 到期的夥伴</b><small>${ambushOpen ? '拆根蟲回來了。沒有提示、不能求援。' : '1 隻夥伴到期 · 週一開放'}</small></span><span class="st">${S.ambush.done ? (S.ambush.passed ? '收服' : '沒中') : (ambushOpen ? '開放' : '週一')}</span></button>
  <button class="layer ${S.relay.done ? 'done' : ''}" data-go="relay"><span class="n">3</span><span><b>Boss 接力 · 每人 1 棒</b><small>${S.relay.done ? '你的第 4 棒交出去了，等第 5 棒。' : '開跑中 · 你是第 4 棒'}</small></span><span class="st">${S.relay.done ? '已接' : '第 4 棒'}</span></button>
  ${!S.helpAnswered ? `<div class="help">${monSvg(m)}<div><b>有一位隊友卡在負號幽靈</b><small>你已經過了這層，可以錄 30 秒講給那位隊友聽。</small><button class="btn sm coral" data-act="help">錄 30 秒講給他聽</button></div></div>` : `<div class="card mint"><div class="row"><span class="av a1 me"></span><div class="grow"><b>你的 30 秒講解送出去了</b><small>隊友收到的是匿名的。你的日誌多一筆「講解」。</small></div></div></div>`}
  
  <div class="sect"><h3>結算</h3><span class="meta">${esc(D.DUNGEON.settle)}</span></div>
  ${S.settled ? `<button class="btn ghost" data-go="settle">再看一次結算</button>` : `<button class="btn ${S.clock === 'tue' ? '' : 'ghost'}" data-act="settle">${S.clock === 'tue' ? '結算 · 全隊看到解題率' : '快轉到週二 22:00 結算'}</button>`}
  ${atLeast('w3') ? `<div class="sect"><h3>小隊之外</h3><span class="meta">第 2 週起慢慢打開</span></div>
  <div class="menu">
    <button data-go="map"><span class="mi">${towerSvg}</span><span class="grow"><b>世界地圖</b><small>全區一起點亮燈塔</small></span>${SVG.chev}</button>
    <button data-go="duel"><span class="mi">${monSvg(mon('diff-sq'), 'sm')}</span><span class="grow"><b>出題戰</b><small>${esc(D.DUEL.opponent)}出了三題 · ${esc(D.DUEL.reveal)}</small></span>${SVG.chev}</button>
    <button data-go="guild"><span class="mi">${SVG.guild}</span><span class="grow"><b>公會徽章賽</b><small>${esc(D.GUILD.name)} · 每月一次</small></span>${SVG.chev}</button>
  </div>
  <div class="sect"><h3>整備</h3><span class="meta">全隊這週亮了 ${9 + S.cards} / 15 張</span></div>
  <div class="btns" style="margin-top:0"><button class="btn soft" data-act="cheer" ${S.cheered ? 'disabled' : ''}>${S.cheered ? '已經對全隊說過「大家加油」' : '對全隊按一次「大家加油」'}</button></div>` : ''}
  ${atLeast('w3') ? `<div class="sect"><h3>一季八週</h3><span class="meta">從遠征到遠征</span></div>
  <div class="calendar">${[['W1', '開季 · 副本從平原線出發'], ['W2', '副本補洞期'], ['W3', '出題戰 · 這週不開副本（示範合併）'], ['W4', '鏡像賽 · 結業點，可停可續'], ['W5', '副本跟上學校進度'], ['W6', '出題戰 · 魔王前的模擬戰'], ['W7', '鏡像賽 · 總複習副本'], ['W8', '魔王戰 · 段考週，不開副本、不加量']].map(([w, t], i) => `<div class="${i === 2 ? 'now' : ''}"><b>${w}</b><span>${esc(t)}</span></div>`).join('')}</div>` : ''}`;
};

// 巡邏作答：四層引導 問 → 指 → 借 → 示範一步
let play = { lvl: 0, picked: null, tried: false, rec: 0, recT: null };
SCREENS.play = () => {
  if (API.base()) { loadRemote(); if (remote.loading) return `${hd('今天 3 題', '負號幽靈')}<div class="qcard skeleton"><div class="row"><span class="sk sk-mon"></span><span class="sk sk-line"></span></div><span class="sk sk-stem"></span><span class="sk sk-opt"></span><span class="sk sk-opt"></span><span class="sk sk-opt"></span><span class="sk sk-opt"></span></div><p class="meta" style="text-align:center">後端出題中 · ${esc(API.host())}</p>`; if (remote.err && !remote.qs) return `${hd('今天 3 題', '負號幽靈')}<div class="card coral"><b>後端沒回應</b><small>${esc(remote.err)}</small></div><div class="btns"><button class="btn" data-act="api-retry">再試一次</button><button class="btn ghost" data-act="api-off">先用本地題</button></div>`; }
  const q = PQ()[S.patrol.i];
  if (!q || S.patrol.finished) return `${hd('巡邏完成', '第 1 層 · 負號幽靈')}<div class="card"><div class="settle"><div class="big num">3<small>/ 3</small></div><div class="lbl">巡邏層完成 · 問過小陪照樣算分</div></div></div><div class="btns"><button class="btn" data-go="dungeon">回到副本</button><button class="btn ghost" data-act="patrol-again">再巡一次 · 牠換個樣子</button></div>`;
  const m = mon('sign-dist');
  const hit = play.picked !== null && play.picked !== undefined && play.picked === q.answer;
  const lvls = ['問', '指', '借', '示範一步'];
  const txt = [q.hint.ask, play.picked === q.trap ? `你踩到的是「${q.trapLabel}」。${q.hint.point}` : q.hint.point, q.hint.lend, q.hint.show];
  if (play.coachText) for (let i = 0; i < 4; i++) if (play.coachText[i]) txt[i] = play.coachText[i];
  if (play.busy) txt[play.lvl] = '小陪想一下…';
  return `
  ${hd(`今天第 ${S.patrol.i + 1} 題`, '負號幽靈 · 括號前面是減號')}
  <div class="q-top"><div class="steps" aria-label="進度">${PQ().map((_, i) => `<i class="${i < S.patrol.i ? 'on' : (i === S.patrol.i ? 'cur' : '')}"></i>`).join('')}</div><span class="pill brand">第 ${S.patrol.i + 1} / 3 題</span></div>
  <div class="qcard"><div class="row" style="margin-bottom:6px">${monSvg(m, play.tried ? 'shake' : 'bob')}<div class="grow"><span class="meta">這隻怪的口頭禪</span><b style="font-size:13.5px">「${esc(m.taunt)}」</b></div></div>
    <p class="stem"><span class="mx">${esc(q.stem.replace(' = ?', ''))}</span><br><span class="meta" style="font-size:13px;font-weight:500">化簡</span></p>
    <div class="opts" id="opts">${q.options.map((o, i) => `<button class="opt ${play.picked === i ? (i === q.answer ? 'ok' : 'trap') : ''}" data-opt="${i}" ${hit ? 'disabled' : ''}><i>${'ABCD'[i]}</i><span class="mx">${esc(o)}</span></button>`).join('')}</div>
    ${play.picked !== null && !hit ? `<div class="taunt">${monSvg(m, 'sm')}<p><b>${esc(m.name)}</b>：${play.picked === q.trap ? `${esc(q.taunt)} <span class="pill coral">${esc(q.trapLabel)}</span>` : '差一點點，再看一次括號。'}</p></div>` : ''}
    ${hit ? `<div class="taunt learned">${monSvg(m, 'sm shadow')}<p><b>打中了</b>：${esc(q.why)}${play.lvl ? '（問過小陪，一樣算 1 分）' : ''}</p></div>` : ''}
  </div>
  ${!hit ? (play.coachOpen || play.tried || play.lvl ? '' : `<button class="coach-ask" data-act="coach-open"><span class="face">${SVG.coach}</span>卡住了？問小陪</button>`) + `
  <div class="coach ${play.coachOpen || play.tried || play.lvl ? '' : 'hidden'}"><span class="face">${SVG.coach}</span><div><span class="lvl">小陪 · ${lvls[play.lvl]}</span><p>${esc(txt[play.lvl])}</p>
    <div class="chips">${play.lvl === 0 ? ['我把括號拆開了', '我還沒開始', '我卡在合併'].map((c) => `<button class="chip" data-coach="${esc(c)}">${esc(c)}</button>`).join('') : `<button class="chip" data-coach="more">${play.lvl < 3 ? '再多一點' : '我再試一次'}</button><button class="chip ghost" data-act="sos">求援 · 隊友或嚮導</button>`}</div></div></div>` : `
  ${q.askWhy ? whyBox('這一題要附一句「為什麼」。用說的或打字都可以，只有嚮導會看，每週抽查 3 段。') : ''}
  <div class="btns"><button class="btn" data-act="next" ${q.askWhy && !whyOk() ? 'disabled' : ''}>${S.patrol.i < 2 ? '下一題' : '完成巡邏'}</button></div>`}`;
};

SCREENS.relay = () => {
  const r = D.RELAY;
  return `
  ${hd('Boss 接力', `你是第 4 棒 · 截止 ${esc(D.DUNGEON.relayDeadline)}`)}
  <div class="card night"><span class="eyebrow">Boss</span><p class="stem" style="font-size:17px;margin:4px 0 0">${mxText(r.stem)}</p></div>
  <div class="relay">${r.steps.map((s, i) => {
    const me = s.by === 'me';
    const cls = me ? 'me' : (s.done ? '' : 'next');
    return `<div class="rstep ${cls} ${play.flagged === i ? 'flag' : ''}">${me ? av(1, 'me') : `<span class="av anon" aria-hidden="true">${i + 1}</span>`}<div class="box"><small>第 ${i + 1} 棒${me ? ' · 你' : (s.done ? ' · 已完成' : ' · 等你交棒')}</small>${me && !S.relay.done ? `<div class="opts" style="margin-top:8px">${s.options.map((o, j) => `<button class="opt ${play.rpick === j ? (j === s.answer ? 'ok' : 'trap') : ''}" data-ropt="${j}" ${play.rpick === s.answer ? 'disabled' : ''}><i>${'ABCD'[j]}</i><span class="mx">${esc(o)}</span></button>`).join('')}</div>${play.rpick !== null && play.rpick !== undefined && play.rpick !== s.answer ? `<div class="taunt">${monSvg(mon('sign-dist'), 'sm')}<p><b>負號幽靈</b>：−(x² − 1) 只有 x² 變號嘛。</p></div>` : ''}` : `<span class="mx">${esc(me && S.relay.done ? 'x² + 12x + 19' : s.text)}</span>`}${!me && s.done && S.relay.flagsLeft > 0 && !S.relay.done ? `<div style="margin-top:6px"><button class="chip ghost" data-flag="${i}" style="font-size:12px">這步怪怪的（剩 ${S.relay.flagsLeft} 次）</button></div>` : ''}</div></div>`;
  }).join('')}</div>
  ${!S.relay.done ? `<div class="btns"><button class="btn" data-act="relay-submit" ${play.rpick === r.steps[3].answer ? '' : 'disabled'}>交出第 4 棒</button></div>` : `<div class="card mint"><b>交棒了。</b><p class="meta">第 5 棒 24 小時沒接，系統會跳到下一棒，由小陪示範，那一棒移出題數。</p></div>`}`;
};

SCREENS.ambush = () => {
  const ar = remoteLocal('sqrt-split', `ambush-${S.seed}`, S.route); if (ar && !ar.q) return ar.loading ? SKELETON('伏擊', '到期的夥伴回來了 · 沒有提示') : REMOTE_ERR('伏擊', '到期的夥伴回來了', ar.err);
  const a = AQ(); const m = mon(a.monster);
  if (S.ambush.done) return `${hd('伏擊 · 結果', '只記進你的收服紀錄')}<div class="card ${S.ambush.passed ? 'honey' : 'coral'}"><div class="row">${monSvg(m, S.ambush.passed ? 'shadow' : '')}<div class="grow"><b>${S.ambush.passed ? '拆根蟲，收服。' : '拆根蟲還在附近。'}</b><small>${S.ambush.passed ? '第 9 天不給提示也會。' : '不扣分，回到練習清單，下週再來。'}</small></div></div></div><div class="btns"><button class="btn" data-go="dungeon">回到副本</button></div>`;
  return `
  ${hd('伏擊', '到期的夥伴回來了 · 沒有提示')}
  <div class="card coral"><div class="row">${monSvg(m, 'shake')}<div class="grow"><b>${esc(m.name)}回來了</b><small>第 9 天。這次沒有嚮導在旁邊，小陪也不出聲。只認第一次作答。</small></div></div></div>
  <div class="qcard"><p class="stem"><span class="mx">${esc(a.stem)}</span></p>
    <div class="opts">${a.options.map((o, i) => `<button class="opt ${play.apick === i ? 'pick' : ''}" data-aopt="${i}"><i>${'ABCD'[i]}</i><span class="mx">${esc(o)}</span></button>`).join('')}</div></div>
  ${whyBox('說一句或打一句「為什麼」，再交出去。')}
  <div class="btns"><button class="btn coral" data-act="ambush-submit" ${play.apick === null || play.apick === undefined || !whyOk() ? 'disabled' : ''}>交出去 · 只認這一次</button></div>`;
};

SCREENS.wake = () => {
  const m = mon('diff-sq');
  const wr = remoteLocal('factor-diff', `wake-${S.seed}`, 'plain'); if (wr && !wr.q) return wr.loading ? SKELETON('叫醒夥伴', '平方差雙子 · 分解洞窟') : REMOTE_ERR('叫醒夥伴', '平方差雙子', wr.err);
  const wq = WQ(); const wHit = play.wpick !== null && play.wpick !== undefined && play.wpick === wq.answer;
  if (S.wake.done) return `${hd('叫醒夥伴', '平方差雙子')}<div class="card honey"><div class="row">${monSvg(m, 'shadow')}<div class="grow"><b>平方差雙子醒了。</b><small>再站回你身後。戰績 +5。</small></div></div></div><div class="btns"><button class="btn" data-go="home">回到今天</button></div>`;
  return `
  ${hd('叫醒夥伴', '平方差雙子 · 分解洞窟')}
  <div class="card"><div class="row">${monSvg(m, 'asleep')}<div class="grow"><b>上週又錯了一次，睡著了。</b><small>不扣分、不消失，只是換一種狀態。今天可以叫醒。</small></div></div></div>
  <div class="qcard"><p class="stem"><span class="mx">${esc(wq.stem)}</span></p>
    <div class="opts">${wq.options.map((o, i) => `<button class="opt ${play.wpick === i ? (i === wq.answer ? 'ok' : 'trap') : ''}" data-wopt="${i}" ${wHit ? 'disabled' : ''}><i>${'ABCD'[i]}</i><span class="mx">${esc(o)}</span></button>`).join('')}</div>
    ${play.wpick !== null && play.wpick !== undefined && !wHit ? `<div class="taunt">${monSvg(m, 'sm')}<p><b>平方差雙子</b>：${play.wpick === wq.trap ? esc(wq.taunt) : '差一點，乘回去看看。'}</p></div>` : ''}
    ${wHit ? `<div class="taunt learned">${monSvg(m, 'sm shadow')}<p><b>醒了</b>：${esc(wq.why)}</p></div>` : ''}</div>
  <div class="btns"><button class="btn honey" data-act="wake-done" ${wHit ? '' : 'disabled'}>叫醒 · 站回身後</button></div>`;
};

SCREENS.settle = () => `
  ${hd('副本結算', `${esc(D.DUNGEON.name)} · ${esc(D.DUNGEON.settle)}`)}
  <div class="card"><div class="settle"><div class="big num">80<small>%</small></div><div class="lbl">小隊解題率</div>
    <div class="stars" aria-label="兩星過關">${[1, 2].map(() => `<svg class="on" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.1 1.2 6.1L12 17l-5.4 3 1.2-6.1L3.3 9.8l6.1-.7z"/></svg>`).join('')}<svg class="off" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.1 1.2 6.1L12 17l-5.4 3 1.2-6.1L3.3 9.8l6.1-.7z"/></svg></div>
    <div class="lbl"><b>兩星過關</b> · 下一個副本往上一條</div></div>
    <div class="divider"></div>
    <div class="kv"><span>巡邏</span><b>12 / 15</b></div><div class="kv"><span>Boss 接力（抓到負號幽靈 1 次）</span><b>4 / 5</b></div><div class="kv"><span>伏擊層叫醒的夥伴（不計分）</span><b>2 隻</b></div></div>
  <div class="private">${monSvg(mon('sq-expand'), 'shadow')}<div><b>你收服了漏項獸</b><small>這一行只有你看得到。</small></div></div>
  <div class="card mint"><div class="kv" style="border:0"><span>下一個副本</span><b>${esc(D.ROUTES[D.ROUTES.plain.next].name)}</b></div></div>
  <div class="card flat"><p style="font-size:13.5px">負號幽靈絆倒全隊最多次，已送到林老師的課前一頁。</p></div>
  <div class="btns"><button class="btn" data-act="wall-post">放上隊伍牆</button><button class="btn ghost" data-go="home">回到今天</button></div>`;

SCREENS.duel = () => {
  const d = D.DUEL;
  return `
  ${hd(`出題戰 · 第 ${wk()} 週`, '兩隊互相出題，只出雙方都遠征過的怪')}
  <div class="vs"><div class="team">${av(1, 'lg')}<b>${esc(D.SQUAD.name)}</b><small>我們</small></div><span class="x">vs</span><div class="team">${av(4, 'lg')}<b>${esc(d.opponent)}</b><small>同路線 · 不同嚮導</small></div></div>
  <div class="sect"><h3>對方出的三題</h3><span class="meta">${esc(d.reveal)}</span></div>
  ${d.questions.map((q) => { const m = mon(q.monster); const v = S.duel.votes[q.n]; return `<div class="card"><div class="row" style="margin-bottom:8px">${monSvg(m, 'sm')}<div class="grow"><b>第 ${q.n} 題 · ${esc(region(m.region).name)}</b><small>對方拿${esc(m.name)}出題</small></div>${v !== undefined || q.voted ? '<span class="pill brand">已投</span>' : ''}</div>
    <p class="stem" style="font-size:18px;margin:4px 0 10px"><span class="mx">${esc(q.stem)}</span></p>
    <div class="stack">${q.candidates.map((c, i) => `<button class="cand ${v === i ? 'pick' : ''}" data-vote="${q.n}:${i}" ${q.voted ? 'disabled' : ''}><span class="mx">${esc(c.t)}</span>${v === undefined && !q.voted ? '' : `<span class="v">${c.v + (v === i ? 1 : 0)} 票</span>`}</button>`).join('')}</div>
    <div class="fixed">${['同意', '我算出不同', '我不確定這一步'].map((t) => `<button class="chip ghost" data-say="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`; }).join('')}
  <div class="sect"><h3>我們出的三題</h3><span class="meta">${esc(d.ours.status)}</span></div>
  <div class="card"><p class="meta" style="margin-bottom:8px">只能拿雙方都遠征過的怪出題。</p><div class="monpick">${d.ours.picked.map((id) => { const m = mon(id); return `<button class="on">${monSvg(m, 'shadow')}<span>${esc(m.name)}</span></button>`; }).join('')}</div></div>
  <div class="sect"><h3>六分制</h3></div>
  <div class="score6"><div><b class="num">3</b>答題分 · 隊伍的答案答對一題得一分</div><div><b class="num">3</b>出題分 · 對方答錯且確實在考那隻怪</div></div>
  <div class="sect"><h3>本季對戰</h3></div>
  <div class="card">${d.history.map((h) => `<div class="kv"><span>第 ${h.week} 週 · ${esc(h.label)}</span><b>${esc(h.result)}</b></div>`).join('')}<div class="kv"><span>第 3 週 · ${esc(d.opponent)}</span><b>出題戰進行中</b></div></div>`;
};

SCREENS.map = (cid) => {
  const C = D.CONTINENTS.find((c) => c.id === cid) || D.CONTINENTS[0];
  const R = D.REGIONS;
  const cls = (r) => r.light === 'fog' ? '' : (r.keeper === 'us' ? 't-us' : (r.keeper === 'other' ? 't-other' : (r.light === 'lit' ? 't-lit' : 't-none')));
  const chips = `<div class="leagues conts">${D.CONTINENTS.map((c) => `<button class="${c.id === C.id ? 'on' : ''} ${c.open ? '' : 'locked'}" data-go="map/${c.id}" aria-label="${esc(c.name)} · ${esc(c.subject)}${c.open ? '' : ' · 未開放'}">${esc(c.name)}</button>`).join('')}</div>`;
  const art = `<image class="art-map light" href="art/${C.map}.svg" x="0" y="0" width="440" height="420"/><image class="art-map dark" href="art/${C.map}-dark.svg" x="0" y="0" width="440" height="420"/>`;
  if (!C.open) {
    return `
  ${hd('世界地圖', `${esc(D.SQUAD.league)} · ${esc(C.name)}`)}
  ${chips}
  <div class="map locked"><svg viewBox="0 0 440 420" role="img" aria-label="${esc(C.name)}地圖：迷霧中"><g class="cam">
    ${art}
    <g class="terrain">${D.MAP_TERRAIN}</g>
    <ellipse class="fogdrift" cx="200" cy="200" rx="150" ry="120"/>
    <text class="cn" x="96" y="78">${esc(C.name)}</text><text class="cs" x="96" y="94">${esc(C.subject)} · 迷霧中</text>
    ${C.spots.map((p) => `<g class="hot" tabindex="0" role="button" aria-label="${esc(p.name)}，迷霧" data-spot="${p.id}"><ellipse class="fogm" cx="${p.x}" cy="${p.y}" rx="52" ry="30"/><text class="fogq" x="${p.x}" y="${p.y + 5}">?</text><text class="rl fogt" x="${p.x}" y="${p.y + 52}">${esc(p.name)}</text></g>`).join('')}
  </g></svg><div class="map-ctl"><button type="button" data-zoom="-1" aria-label="縮小">−</button><button type="button" data-zoom="1" aria-label="放大">＋</button></div><span class="map-hint">拖曳移動 · 捏合縮放</span></div>
  <div class="sect"><h3>${esc(C.name)}的怪</h3><span class="meta">題庫達標後開放</span></div>
  <div class="mgrid">${C.monsters.map((m) => `<div class="mcard fogc">${monSvg({ shape: ART.m2 ? m.shape : 'm-round' }, 'fog')}<span><b>${esc(m.name)}</b><small>${esc(m.skill)} · 迷霧</small></span></div>`).join('')}</div>`;
  }
  return `
  ${hd('世界地圖', `${esc(D.SQUAD.league)} · ${esc(C.name)}`)}
  ${chips}
  <div class="map"><svg viewBox="0 0 440 420" role="img" aria-label="數理大陸地圖：六個區域各一座燈塔"><g class="cam">
    ${art}
    <g class="terrain">${D.MAP_TERRAIN}</g>
    <defs><linearGradient id="mapBeam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFF3C4" stop-opacity=".95"/><stop offset="1" stop-color="#FFF3C4" stop-opacity="0"/></linearGradient></defs>${R.filter((r) => r.light === 'lit').map((r) => `<path class="beam" style="--bx:${r.x}px;--by:${r.y - 12}px" d="M${r.x} ${r.y - 12}L${r.x - 40} ${r.y - 128}L${r.x + 40} ${r.y - 128}z"/>`).join('')}
    ${R.filter((r) => r.light === 'fog').map((r) => `<ellipse class="fogdrift" cx="${r.x - 20}" cy="${r.y - 10}" rx="70" ry="34"/>`).join('')}
    <text class="cn" x="96" y="96">數理大陸</text><text class="cs" x="96" y="112">數學 · 六區</text>
    ${R.map((r) => r.light === 'fog'
      ? `<g class="hot" tabindex="0" role="button" aria-label="${esc(r.name)}，迷霧" data-region="${r.id}"><ellipse class="fogm" cx="${r.x}" cy="${r.y}" rx="52" ry="30"/><text class="fogq" x="${r.x}" y="${r.y + 5}">?</text><text class="rl fogt" x="${r.x}" y="${r.y + 52}">${esc(r.name)}</text></g>`
      : `<g class="hot" tabindex="0" role="button" aria-label="${esc(r.name)}燈塔" data-region="${r.id}"><circle class="ring" cx="${r.x}" cy="${r.y}" r="34"/><circle class="glow ${r.light === 'lit' ? 'on' : ''}" cx="${r.x}" cy="${r.y - 10}" r="24"/><use href="#tower" class="tw ${cls(r)}" x="${r.x - 12}" y="${r.y - 22}" width="24" height="32"/>${r.keeper ? `<path class="flag ${r.keeper === 'us' ? 'f-us' : 'f-other'}" d="M${r.x + 9} ${r.y - 12}v-9l8 3-8 3"/>` : ''}<text class="rl" x="${r.x}" y="${r.y + 34}">${esc(r.name)}</text></g>`).join('')}
  </g></svg><div class="map-ctl"><button type="button" data-zoom="-1" aria-label="縮小">−</button><button type="button" data-zoom="1" aria-label="放大">＋</button></div><span class="map-hint">拖曳移動 · 捏合縮放</span></div>
  <div class="maplegend"><span><i class="u"></i>我們守塔</span><span><i class="o"></i>其他小隊守塔</span><span><i class="l"></i>燈已點亮</span><span><i class="n"></i>燈未點亮</span><span><i class="f"></i>迷霧</span></div>
  <div class="regions">${R.map((r) => `<button class="region" data-region="${r.id}"><span class="tw ${r.light === 'fog' ? 'none' : (r.keeper === 'us' ? 'us' : (r.keeper === 'other' ? 'other' : (r.light === 'lit' ? 'lit' : 'none')))}">${towerSvg}</span><span><b>${esc(r.name)}</b><small>${r.light === 'fog' ? '迷霧 · 還沒偵察到這一區' : (r.light === 'lit' ? `已點亮 · ${r.keeper === 'us' ? '四葉小隊守著平原線' : (r.keeper === 'other' ? '星期三小隊守著平原線' : '尚無守塔隊')}` : `點燈進度 ${Math.round(r.progress[0] / r.progress[1] * 100)}%`)}</small></span><span class="pct">${r.light === 'fog' ? '' : `${r.progress[0].toLocaleString()} / ${r.progress[1].toLocaleString()}`}</span></button>`).join('')}</div>`;
};

SCREENS.tower = (id) => {
  const r = region(id) || region('sqrt');
  const T = D.TOWER; const lit = r.light === 'lit';
  const mine = T.board.findIndex((b) => b.mine);
  const rows = T.board.map((b, i) => ({ ...b, i })).filter((b) => Math.abs(b.i - mine) <= 3);
  return `
  ${hd(`${esc(r.name)} · 燈塔`, `${esc(D.SQUAD.league)} · ${esc(D.SQUAD.subject)}`)}
  <div class="tower-hero ${lit ? 'lit' : ''} ${r.light === 'fog' ? 'fog' : ''}">
    <svg class="scene" viewBox="0 0 390 230" aria-hidden="true">
      <g class="stars">${SKY_STARS.map(([x, y, rr], i) => `<circle cx="${x}" cy="${y}" r="${rr}" style="--d:${(i % 7) * 0.45}s"/>`).join('')}</g>
      <g class="moon"><circle cx="330" cy="44" r="15"/><circle class="bite" cx="337" cy="40" r="13"/></g>
      ${r.light === 'fog' ? '<ellipse class="fogbank" cx="195" cy="150" rx="230" ry="70"/>' : ''}
      <rect class="sea" x="0" y="166" width="390" height="64"/>
      <path class="moonlight" d="M318 176h26M312 186h34M322 196h20M316 208h28"/>
      <g class="waves"><path d="M20 182q7-4 14 0t14 0M70 200q7-4 14 0t14 0M250 190q7-4 14 0t14 0M120 214q7-4 14 0t14 0M280 212q7-4 14 0t14 0"/></g>
      <path class="cliff l" d="M-10 230V178c16-10 34-14 56-10 14 3 22 12 24 22L62 230z"/>
      <path class="cliff r" d="M400 230V184c-14-8-30-10-46-6-12 3-20 10-24 20l-4 32z"/>
      <path class="rock" d="M110 230c6-32 34-52 85-52s79 20 85 52z"/>
      <path class="rock top" d="M148 184c10-10 27-15 47-15s37 5 47 15c-12 5-27 7-47 7s-35-2-47-7z"/>
      ${lit ? '<g class="beamg" style="transform-origin:195px 90px"><path class="beam wide" d="M195 90L-40 10L-40 170z"/><path class="beam core" d="M195 90L-40 52L-40 128z"/></g><circle class="halo" cx="195" cy="90" r="32"/>' : `<circle class="arc bg" cx="195" cy="90" r="38"/><circle class="arc" cx="195" cy="90" r="38" style="stroke-dasharray:${(2 * Math.PI * 38).toFixed(1)};stroke-dashoffset:${(2 * Math.PI * 38 * (1 - Math.min(1, r.progress[0] / r.progress[1]))).toFixed(1)}"/>`}
      <use href="#tower" class="tw ${r.keeper === 'us' ? 't-us' : (r.keeper === 'other' ? 't-other' : (lit ? 't-lit' : 't-none'))}" x="153" y="60" width="84" height="112"/>
      ${r.keeper ? `<path class="kflag ${r.keeper === 'us' ? 'f-us' : 'f-other'}" d="M218 100v-24l22 9-22 9"/><path class="kpole" d="M218 101v-26"/>` : ''}
    </svg>
    <div class="cap"><h2>${lit ? (r.keeper === 'us' ? '燈亮著，四葉小隊守著平原線這一層。' : (r.keeper === 'other' ? '燈亮著，星期三小隊守著平原線這一層。' : '燈亮著，還沒有守塔隊。')) : (r.light === 'fog' ? '迷霧還沒散。' : `燈還沒亮 · ${Math.round(r.progress[0] / r.progress[1] * 100)}%`)}</h2><p>${r.light === 'fog' ? '下週遠征偵察這一區。' : '點燈是全區合作，守塔是同路線爭奪。'}</p></div>
  </div>
  <div class="card"><div class="kv" style="border:0;padding:0 0 6px"><span>點燈進度 · 全${esc(D.SQUAD.league)}</span><b>${r.progress[0].toLocaleString()} / ${r.progress[1].toLocaleString()}</b></div><div class="bar"><i class="${lit ? 'honey' : ''}" style="transform:scaleX(${Math.min(1, r.progress[0] / r.progress[1])})"></i></div></div>
  ${lit && r.keeper ? `<div class="quote"><p>${esc(T.words)}</p><small>塔上的話 · ${esc(r.keeper === 'us' ? T.wordsBy : '星期三小隊')}</small></div>` : ''}
  ${lit ? `<div class="sect"><h3>本月爭奪 · 平原線層</h3><span class="meta">到 ${esc(T.until)}</span></div>
  <div class="rank">${rows.map((b) => `<div class="${b.mine ? 'mine' : ''} ${Math.abs(b.i - mine) === 3 ? 'dim' : ''}"><span class="p ${b.dir || ''}">${b.dir === 'up' ? '↑' : (b.dir === 'down' ? '↓' : '·')}</span>${av(b.av)}<span>${esc(b.name)}</span><b class="num">${b.pts}</b></div>`).join('')}</div>
  <div class="sect"><h3>歷代守塔隊</h3></div>
  <div class="card">${T.hall.map((h) => `<div class="kv"><span>${esc(h.month)} · ${esc(h.layer)}</span><b style="font-family:var(--font-sans)">${esc(h.name)}</b></div>`).join('')}</div>` : ''}
  <div class="sect"><h3>這一區的怪</h3></div>
  <div class="mgrid">${D.MONSTERS.filter((m) => m.region === r.id).map((m) => { const s = S.shadows[m.id]; return `<button class="mcard ${s.state === 'fog' ? 'fogc' : ''}" data-lore="${m.id}">${monSvg(m, stateCls[s.state])}<span><b>${s.state === 'fog' && r.light !== 'lit' ? '？？？' : esc(m.name)}</b><small>${esc(D.STATE_LABEL[s.state])}</small></span></button>`; }).join('')}</div>`;
};

SCREENS.guild = () => {
  const G = D.GUILD;
  const posts = [...S.wallPosts.map((p) => ({ who: D.SQUAD.name, av: 1, text: p, when: '剛剛' })), ...G.wall];
  return `
  ${hd('公會', '每月一次徽章賽')}
  <div class="guild-hero"><span class="em">${SVG.guild}</span><div><h2>${esc(G.name)}</h2><small>公會長 ${esc(G.master)} · ${G.squads} 支小隊 · ${G.members} 人 · 跨季存在</small></div></div>
  <div class="race"><span class="medal">${badgeSvg(true)}</span><h3>${esc(G.race.month)}徽章公開賽 · ${esc(G.race.theme)}</h3><span class="when">${esc(G.race.when)}</span>
    <p><b>怎麼贏</b>：${esc(G.race.rule)}達到就贏，不是只有前幾名。</p><p><b>獎品</b>：${esc(G.race.prize)}</p>
    <div class="kv" style="border:0;margin-top:10px;padding-bottom:4px"><span>全服目標 · 參賽隊伍收服加總</span><b>${G.race.server[0].toLocaleString()} / ${G.race.server[1].toLocaleString()}</b></div><div class="bar"><i class="honey" style="transform:scaleX(${G.race.server[0] / G.race.server[1]})"></i></div>
    <div class="btns"><button class="btn ${S.raceSigned ? 'ghost' : 'honey'}" data-act="race">${S.raceSigned ? '已報名 · 家長已勾選由本人作答' : '替小隊報名（家長在 LINE 端確認）'}</button></div></div>
  <div class="sect"><h3>徽章冊</h3><span class="meta">一學年十枚</span></div>
  <div class="album">${G.album.map((a) => `<div class="${a.got ? 'got' : ''} ${a.now ? 'now' : ''}" title="${esc(a.theme || '')}">${badgeSvg(!!a.got)}<span>${esc(a.month)}</span></div>`).join('')}</div>
  <div class="sect"><h3>公會牆</h3><span class="meta">只放值得慶祝的事</span></div>
  <div class="card">${posts.map((p) => `<div class="wallpost">${p.av === 0 ? '<span class="av a0">林</span>' : av(p.av)}<div><b>${esc(p.who)}</b> <small>${esc(p.when)}</small><p>${esc(p.text)}</p>${p.voice ? `<span class="voice">${SVG.play.replace('<svg', '<svg style="width:14px;height:14px;fill:currentColor"')} 0:21</span>` : ''}</div></div>`).join('')}</div>
  <div class="sect"><h3>戰績解鎖</h3><span class="meta">累積到門檻就解鎖，不用花掉</span></div>
  <div class="card"><div class="kv" style="border:0;padding-top:0"><span>小隊累積</span><b>${G.squadTotal}</b></div>
    ${G.unlocks.filter((u) => u.who === 'squad').map((u) => `<div class="unlock ${G.squadTotal >= u.at ? '' : 'pend'}"><span>${esc(u.name)}</span><span class="at">${G.squadTotal >= u.at ? '<span class="ok">已解鎖</span>' : `${G.squadTotal} / ${u.at}`}</span></div>`).join('')}
    <div class="divider"></div>
    <div class="kv" style="border:0"><span>公會人均</span><b>${G.perCapita} / ${G.perCapitaGoal}</b></div><div class="bar"><i style="transform:scaleX(${G.perCapita / G.perCapitaGoal})"></i></div>
    <div class="unlock pend" style="border:0"><span>魔王攻略會 · 段考前林老師加開 30 分鐘直播答疑</span><span class="at">還差 ${G.perCapitaGoal - G.perCapita}</span></div></div>
  <div class="sect"><h3>隊伍牆</h3><span class="meta">季末合照框 236 / 300</span></div>
  <div class="card flat"><div class="row"><div class="avs">${av(1)}${av(2)}${av(3)}${av(4)}${av(5)}</div><div class="grow"><b>${esc(D.SQUAD.name)}</b><small>隊旗徽記 1 · 好題印記 0 · 本季對戰 1</small></div></div></div>`;
};

SCREENS.capture = (id) => {
  const m = mon(id) || mon('sqrt-split');
  return `<div class="capture p1" id="cap"><div class="sky"></div><div class="stars"></div><div class="rays" aria-hidden="true"></div><div class="ring" aria-hidden="true"></div><div class="confetti" id="confetti"></div>
    <div class="top"><span class="eyebrow">收服 · 第 ${wk()} 週</span><h2 id="cap-title">${esc(m.name)}……</h2></div>
    <div class="arena">${heroAv('smile')}${monSvg(m, 'xl')}</div>
    <div><p class="line" id="cap-line">「${esc(m.taunt)}」</p><p class="ev" id="cap-ev" style="opacity:0"><b>${esc(m.weakness)}</b><br>第 0 天 在遠征中被打倒 · 第 9 天 不給提示也會</p>
    <div class="btns"><button class="btn honey" data-share="${m.id}">傳到營地（家人 LINE）</button><div class="btns two" style="margin-top:0"><button class="btn ghost" data-act="wall-post">放上隊伍牆</button><button class="btn ghost" data-go="shadows">先收著</button></div></div></div></div>`;
};

SCREENS.share = (id) => {
  const m = mon(id) || mon('sqrt-split');
  return `
  ${hd('分享卡', '直式 4:5 · 沒有臉、真名、分數、隊友狀態')}
  <div class="share"><span class="corner"></span><div class="top"><span>收服 · 第 ${wk()} 週</span><svg class="logo" viewBox="0 0 64 40" aria-hidden="true"><use href="#logo"/></svg></div>
    <div class="mid">${monSvg(m, 'shadow')}<h3>${esc(m.name)}，收服。</h3><span class="team">${esc(D.SQUAD.name)} · ${esc(D.SQUAD.me.nick)}</span></div>
    <p class="ev"><b>${esc(m.weakness)}</b><br>第 0 天 在遠征中被打倒 · 第 9 天 不給提示也會<br>嚮導 ${esc(D.SQUAD.guide)} · ${esc(D.SQUAD.examLabel)}</p></div>
  <div class="btns"><button class="btn" data-act="to-camp" data-mon="${esc(id)}">傳到營地 · 看家長收到什麼</button><button class="btn ghost" data-go="shadows">回到圖鑑</button></div>`;
};

// 接後端時：營地來信由後端寄（收服、叫醒、講解會自動寄；傳到營地、週回顧、副本結算手動寄）
const campRemote = { letters: null, at: 0, busy: false, err: '' };
function loadLetters(force = false) {
  if (!API.base() || campRemote.busy || (!force && Date.now() - campRemote.at < 20000)) return;
  campRemote.busy = true; campRemote.err = '';
  API.campLetters(S.studentId).then((rows) => { campRemote.letters = rows; campRemote.at = Date.now(); campRemote.busy = false; if (curKey === 'camp') rerender(); })
    .catch((e) => { campRemote.busy = false; campRemote.at = Date.now(); campRemote.err = e.message; if (curKey === 'camp') rerender(); });
}
function sendLetter(body, after) {
  if (!API.base() || !body) return after && after();
  API.campSend(S.studentId, body).then(() => { campRemote.at = 0; after && after(); }).catch((e) => { toast(`營地沒收到：${e.message.replace(/^http-\d+ ?/, '')}`); after && after(); });
}
const letterTime = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${'日一二三四五六'[d.getDay()] === '日' ? '星期日' : `星期${'日一二三四五六'[d.getDay()]}`} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function letterHtml(l) {
  const acts = l.actions && l.actions.length ? `<div class="acts">${l.actions.map((a) => `<button class="${l.status === a.id ? 'on' : ''}" data-lreply="${l.id}:${a.id}">${l.status === a.id ? (a.id === 'witnessed' ? '已見證' : '晚點問他 ✓') : esc(a.label)}</button>`).join('')}</div>` : '';
  const state = l.status === 'failed' ? `<span class="t">LINE 沒送出 · ${esc(l.error || '')}</span>` : `<span class="t">${l.channel === 'line' ? '已推到 LINE' : '示範 · 沒接 LINE'} · ${letterTime(l.sent_at || l.created_at)}</span>`;
  return `<div class="bub"><b>${esc(l.title)} · ${letterTime(l.created_at)}</b><br>${l.lines.map(esc).join('<br>')}${l.ask ? `<span class="q">${esc(l.ask)}${l.answer ? `<small class="ans">${esc(l.answer)}</small>` : ''}</span>` : ''}<span class="from">${esc(l.sender || 'Tandelo 營地')} · <button class="linkbtn" data-act="camp-about">這是誰寄的？</button></span>${acts}${state}</div>`;
}
SCREENS.camp = () => {
  if (API.base()) {
    loadLetters();
    const L = campRemote.letters;
    return `
  ${hd('營地來信', `家長端 · LINE · 學生 ${S.studentId} · ${esc(API.host())}`)}
  <div class="line-top"><span class="ic">T</span>Tandelo 營地</div>
  <div class="line-body">
    ${L === null ? `<div class="bub"><span class="meta">${campRemote.err ? `後端沒回應：${esc(campRemote.err)}` : '讀取中…'}</span></div>` : ''}
    ${L && !L.length ? '<div class="bub">今晚還沒有來信。收服、叫醒、講給隊友聽之後，營地會寄一封。<span class="t">示範</span></div>' : ''}
    ${L ? L.slice().reverse().map(letterHtml).join('') : ''}
  </div>
  <div class="btns"><button class="btn ghost" data-act="letters-refresh">重新讀取</button><button class="btn ghost" data-go="home">回到孩子的畫面</button></div>`;
  }
  return `
  ${hd('營地來信', '家長端 · LINE · 不裝 App')}
  <div class="line-top"><span class="ic">T</span>Tandelo 營地</div>
  <div class="line-body">
    <div class="bub"><b>營地來信 · ${esc(D.CAMP.time)}</b><br>${esc(D.CAMP.text)}<br>${esc(D.CAMP.chase)}<span class="q">${esc(D.CAMP.ask)}<small class="ans">${esc(D.CAMP.answer)}</small></span><span class="from">${esc(D.CAMP.from)} · <button class="linkbtn" data-act="camp-about">這是誰寄的？</button></span>
      <div class="acts"><button class="${S.witnessed ? 'on' : ''}" data-act="witness">${S.witnessed ? '已見證' : '我見證了'}</button><button>晚點問他</button></div><span class="t">已讀 21:05</span></div>
    <div class="bub me">好，晚上問他。<span class="t">21:06</span></div>
    ${S.patrol.finished ? `<div class="bub"><b>營地來信 · 剛剛</b><br>${esc(S.profile.nick)}今晚練了「括號前面是減號，每一項都要變號」，三題都做對，其中一題自己說出了為什麼。<span class="q">今晚可以問他：「10 − (3 + 2) 和 10 − 3 + 2 為什麼答案不一樣？」<small class="ans">他可能會這樣說：「減號要分給括號裡每一個數，所以 + 2 要變成 − 2。」</small></span><span class="t">剛剛</span></div>` : ''}
    ${S.wallPosts.length ? `<div class="bub"><b>營地來信 · 剛剛</b><br>${esc(S.profile.nick)}的小隊這週一起練的題目，全隊答對了八成。下週會換稍微難一點的題目。<span class="t">剛剛</span></div>` : ''}
    ${S.weekSent ? `<div class="bub"><b>${esc(S.profile.nick)}這週學會的 · 剛剛</b><br>學會了 ${D.MONSTERS.filter((m) => S.shadows[m.id].state === 'captured').length} 件事，都是隔幾天、不給提示再做一次也對：${D.MONSTERS.filter((m) => S.shadows[m.id].state === 'captured').map((m) => esc(m.skill)).join('；')}。<span class="q">今晚可以請他講一次：<small class="ans">「${esc((D.MONSTERS.find((m) => S.shadows[m.id].state === 'captured') || D.MONSTERS[0]).weakness)}」</small></span><span class="t">剛剛</span></div>` : ''}
  </div>
  <div class="btns"><button class="btn ghost" data-go="home">回到孩子的畫面</button></div>`;
};

let chat = [];
SCREENS.coach = () => `
  ${hd('小陪', '隨行系統 · 第一句永遠是「你寫到哪一步？」')}
  <p style="margin:-6px 0 12px"><span class="ai-tag"><i></i>AI 生成的引導 · 題目與傳說卡有真人審</span></p>
  <div class="chat">${chat.length ? chat.map((c) => `<div class="msg ${c.by}">${c.lvl ? `<span class="lvl">${esc(c.lvl)}</span>` : ''}${esc(c.text)}${c.by === 'c' ? '<button class="report" data-act="report">這句怪怪的，回報</button>' : ''}</div>`).join('') : `<div class="msg c"><span class="lvl">小陪 · 問</span>你寫到哪一步？<button class="report" data-act="report">這句怪怪的，回報</button></div>`}</div>
  <div class="chat-in"><div class="chips">${['我把括號拆開了', '我卡在合併', '我不知道從哪開始', '我算出 2x − 3'].map((t) => `<button class="chip" data-say-coach="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`;

SCREENS.settings = () => `
  ${hd('示範設定', '時間、深淺色、個人榜、對戰投票')}
  <div class="ios-tip ${/iP(hone|ad|od)/.test(navigator.userAgent) && !window.navigator.standalone ? 'on' : ''}"><b>加到主畫面</b>：Safari 底下的「分享」→「加入主畫面」。之後會像 App 一樣全螢幕開啟。</div>
  <div class="card"><h3>後端</h3><div class="setrow"><span>${API.base() ? `已連線 <b>${esc(API.host())}</b>` : '本地引擎'}<small>有位址時：題目由後端出、後端判題、小陪由後端回話。</small></span>${API.base() ? '<button class="btn sm ghost" data-act="api-test">測試</button>' : ''}</div><input class="in" type="url" inputmode="url" placeholder="https://api.example.com" value="${esc(API.base())}" data-api aria-label="後端位址">${API.base() ? `<div class="setrow"><span>示範學生 id<small>圖鑑與戰績讀這一位；種子資料 9–11 各有不同狀態</small></span><input class="in num" type="number" min="1" value="${S.studentId}" data-student aria-label="示範學生 id" style="width:84px;margin:0"></div>` : ''}</div>
  <div class="card"><h3>這週的題</h3><div class="setrow"><span>種子 <b class="num">${esc(S.seed)}</b><small>巡邏、伏擊、叫醒的題目由變體引擎依種子產生；換種子，怪就換個樣子。</small></span><button class="btn sm ghost" data-act="reseed">換一組</button></div></div>
  <div class="card"><h3>示範進度</h3><div class="chips">${STAGE_ORDER.map((st) => `<button class="chip ${S.stage === st ? 'on' : ''}" data-stage="${st}">${esc(STAGES[st].name)}</button>`).join('')}</div><p class="meta" style="margin-top:8px">第 1 天只開「今天」和「我」；第 1 週末多「這週」；第 3 週才有地圖、出題戰、公會。</p></div>
  <div class="card"><h3>示範時間</h3><div class="chips">${D.CLOCKS.map((c) => `<button class="chip ${S.clock === c.id ? 'on' : ''}" data-clock="${c.id}">${esc(c.label)}</button>`).join('')}</div><p class="note">${esc(clock().note)}</p></div>
  <div class="card">
    <div class="setrow"><span>音效<small>打中、連擊、收服的聲音</small></span><button class="switch ${S.sound ? 'on' : ''}" data-act="sound" role="switch" aria-label="音效" aria-checked="${!!S.sound}"><i></i></button></div>
    <div class="setrow"><span>深色模式<small>22:30 後自動轉暗</small></span><button class="switch ${isDark() ? 'on' : ''}" data-act="theme" role="switch" aria-label="深色模式"></button></div>
    <div class="setrow"><span>上個人拓荒榜<small>預設關。開了只有稱號和隊名，別人看不到百分位。</small></span><button class="switch ${S.personalBoard ? 'on' : ''}" data-act="pboard" role="switch" aria-label="個人拓荒榜"></button></div>
    <div class="setrow"><span>本季真人對戰<small>匿名投票，全隊同意才打；否則打幽靈隊，沒有人知道是誰投的。</small></span><button class="switch ${S.pvp ? 'on' : ''}" data-act="pvp" role="switch" aria-label="真人對戰"></button></div>
  </div>
  <div class="card flat"><h3>隱私與安全</h3><p class="meta">隊友畫面不出現名字。分享卡、公會牆、燈塔上只有隊名與頭像色塊。地圖是幻想的，聯賽區只到北中南東。</p></div>
  <div class="btns"><button class="btn" data-go="guide">切到嚮導視角</button><button class="btn warn" data-act="reset">重設示範資料</button></div>`;

// ---------- 路由與渲染 ----------
const TABS = [['home', '今天', '<path d="M4 11.5 12 5l8 6.5V20h-5v-5H9v5H4z"/>'], ['dungeon', '這週', '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>'], ['me', '我', '<circle cx="12" cy="9" r="5"/><path d="M5 21c1-4 3.5-6 7-6s6 2 7 6"/><path d="M8.5 9h.01M15.5 9h.01" stroke-width="2.6"/>']];
const tabsFor = () => TABS.filter(([k]) => k !== 'dungeon' || atLeast('w1'));
const NOTABS = new Set(['capture', 'share', 'camp', 'coach', 'settings', 'profile', 'join', 'letter', 'play', 'relay', 'ambush', 'wake', 'settle', 'record', 'tower', 'week', 'guide']);
const DARK = new Set([]);
const view = $('#view'); const tabsEl = $('#tabs'); const sbEl = $('#sb'); const toastEl = $('#toast');
const trail = [];
let curKey = '';

function parse() { const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean); return { key: p[0] || 'home', param: p[1] || '' }; }
function go(path) { const h = `#/${path}`; if (location.hash === h) route(); else location.hash = h; }
function back() { if (trail.length > 1) { trail.pop(); const prev = trail.pop(); go(prev); } else go('home'); }

function route() {
  document.querySelectorAll('.sheet,.sheet-bg').forEach((el) => el.remove()); // 換畫面時收起傳說卡
  const { key, param } = parse();
  const fn = SCREENS[key] || SCREENS.home;
  const dir = trail.length && trail[trail.length - 1] === key ? 'back' : (trail.includes(key) && trail.indexOf(key) < trail.length - 1 ? 'back' : 'fwd');
  if (trail[trail.length - 1] !== key) trail.push(key);
  if (trail.length > 30) trail.shift();
  play = { ...play, picked: play.picked ?? null };
  if (key !== curKey) { play = { lvl: 0, picked: null, tried: false, rec: 0, rpick: null, apick: null, wpick: null, flagged: null }; }
  curKey = key;
  const old = view.querySelector('.screen');
  const el = document.createElement('div');
  el.className = `screen ${NOTABS.has(key) ? 'notabs' : ''} ${DARK.has(key) ? 'dark' : ''} enter-${dir}`;
  el.innerHTML = fn(param);
  if (old) { old.className = old.className.replace(/enter-\w+/, '') + ` leave-${dir}`; setTimeout(() => old.remove(), 320); }
  view.appendChild(el);
  tabsEl.classList.toggle('hidden', NOTABS.has(key));
  renderTabs();
  const tabKey = ({ shadows: 'me', map: 'dungeon', guild: 'dungeon', duel: 'dungeon' })[key] || key;
  tabsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.go === tabKey));
  sbEl.innerHTML = `<span class="num clockbtn">${esc(clock().time)}</span>`;
  sbEl.classList.toggle('on-dark', key === 'capture');
  lightsOut(el, key);
  if (key === 'capture') runCapture(el, param);
  if (key === 'capture' || key === 'shadows' || key === 'tower') motes(el.querySelector('.capture, .wall, .tower-hero'));
  if (key === 'map') setupMap(el);
  if (key === 'home') startFeed(); else stopFeed();
  if (['home', 'shadows', 'week', 'record', 'map', 'tower'].includes(key)) syncFromBackend();
  document.querySelectorAll('.panel .scenes button').forEach((b) => b.classList.toggle('on', b.dataset.go === key));
}
function rerender() { const { key, param } = parse(); const el = view.querySelector('.screen:not([class*="leave"])'); if (!el) return route(); const y = el.scrollTop; el.innerHTML = (SCREENS[key] || SCREENS.home)(param); el.scrollTop = y; sbEl.innerHTML = `<span class="num clockbtn">${esc(clock().time)}</span>`; lightsOut(el, key); }

function lightsOut(el, key) {
  const old = view.querySelector('.curtain'); if (old) old.remove();
  if (night() && !['settings', 'camp', 'map', 'guild', 'shadows', 'tower'].includes(key)) {
    const c = document.createElement('div'); c.className = 'curtain';
    c.innerHTML = `<div><div class="moon"></div><h2>關燈中</h2><p>22:30 到 06:00，任務卡不發、不亮、不推播。<br>今天亮了 ${S.cards} 張，明天見。</p><div class="btns" style="margin-top:20px"><button class="btn ghost" data-go="settings" style="background:var(--night-2);color:var(--on-night)">改示範時間</button></div></div>`;
    view.appendChild(c);
  }
}

// ---------- 遊戲手感：震動、閃光、浮字、連擊 ----------
let combo = 0;
function juice(kind, x, y, text) {
  const shell = $('.shell'); if (!shell || reduced()) { if (text) toast(text); return; }
  const r = shell.getBoundingClientRect(); const fx = x != null ? `${((x - r.left) / r.width * 100).toFixed(1)}%` : '50%'; const fy = y != null ? `${((y - r.top) / r.height * 100).toFixed(1)}%` : '45%';
  SFX.play(kind === 'bad' ? 'miss' : (kind === 'gold' ? 'reward' : 'hit'));
  if (kind === 'bad') { shell.classList.remove('shake-screen'); void shell.offsetWidth; shell.classList.add('shake-screen'); setTimeout(() => shell.classList.remove('shake-screen'), 450); }
  if (kind === 'good' || kind === 'gold') { const f = document.createElement('div'); f.className = 'flash'; f.style.setProperty('--fx', fx); f.style.setProperty('--fy', fy); shell.appendChild(f); setTimeout(() => f.remove(), 520); }
  if (text) { const d = document.createElement('div'); d.className = `float-txt ${kind}`; d.style.setProperty('--fx', fx); d.style.setProperty('--fy', fy); d.textContent = text; shell.appendChild(d); setTimeout(() => d.remove(), 1050); }
}
function showCombo() { const old = view.querySelector('.combo'); if (old) old.remove(); if (combo < 2) return; SFX.play('combo'); const c = document.createElement('div'); c.className = 'combo'; c.textContent = `${combo} 連擊`; view.appendChild(c); setTimeout(() => c.remove(), 1400); }
function motes(host, n = 14) { if (!host || reduced()) return; const m = document.createElement('div'); m.className = 'motes'; for (let i = 0; i < n; i++) { const s = document.createElement('i'); s.style.setProperty('--x', `${Math.random() * 100}%`); s.style.setProperty('--y', `${30 + Math.random() * 70}%`); s.style.setProperty('--d', `${5 + Math.random() * 6}s`); s.style.setProperty('--dl', `${-Math.random() * 8}s`); m.appendChild(s); } host.appendChild(m); }
let toastT;
function toast(t) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2200); }
const INTERVENTION_LABEL = { explain: '錄 30 秒講解', nudge: '推一句', comfort: '問候' };
function logIntervention(g, note) {
  S.guideDone[g.id] = `${clock().time}`;
  S.interventions.push({ id: g.id, kind: g.kind, trigger: g.trigger, minutes: g.minutes, label: `${INTERVENTION_LABEL[g.kind]} · ${g.who}`, note, when: '今晚' });
  save(); SFX.play('card'); buzz(12); play.gpick = null; play.rec = 0;
  if (API.base()) API.intervention({ by: 'guide', kind: g.kind, trigger: g.trigger, minutes: g.minutes, note: (note || '').slice(0, 200) }).then(() => toast('已記進後端')).catch((e) => toast(`後端沒記到：${e.message}`));
  else toast('記下了');
  rerender();
}
function afterPick(q, i, r) {
  play.picked = i; play.tried = i !== q.answer;
  if (i === q.answer) { buzz(10); combo += 1; juice('good', r.left + r.width / 2, r.top, play.lvl ? '打中' : '打中！'); rerender(); showCombo(); const m = view.querySelector('.qcard .mon'); if (m) m.classList.add('hit'); return; }
  buzz([10, 30, 10]); combo = 0; juice('bad', r.left + r.width / 2, r.top, '被騙到'); rerender(); const m = view.querySelector('.qcard .mon'); if (m) m.classList.add('tricked');
}
function addCard() { if (S.cards < 3) { S.cards += 1; buzz(16); SFX.play('card'); if (S.cards === 3) setTimeout(() => reward({ big: '3 / 3', title: '今天三張都亮了', sub: `連續第 ${D.SQUAD.streak + 1} 天` }), 1600); } }
// 獎勵時刻：全幕一下、光芒與彩紙，點一下或兩秒後收起
function reward({ big, title, sub }) {
  const shell = $('.shell'); if (!shell) return; const old = shell.querySelector('.reward'); if (old) old.remove();
  const r = document.createElement('div'); r.className = 'reward';
  r.innerHTML = `<div class="rays" aria-hidden="true"></div><div class="box"><div class="big num">${esc(big)}</div><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div><div class="confetti" aria-hidden="true"></div>`;
  shell.appendChild(r); burst(r.querySelector('.confetti')); SFX.play('reward'); buzz([20, 30, 20]);
  const close = () => { r.classList.add('out'); setTimeout(() => r.remove(), 350); };
  r.addEventListener('click', close); setTimeout(close, reduced() ? 1200 : 2400);
}
function addRecord(kind, label, pts) { S.records.push({ kind, label, pts, when: '今天' }); }

function runCapture(el, id) {
  const m = mon(id) || mon('sqrt-split');
  const cap = el.querySelector('#cap'); const line = el.querySelector('#cap-line'); const title = el.querySelector('#cap-title'); const ev = el.querySelector('#cap-ev');
  const t = reduced() ? 0 : 1;
  setTimeout(() => { line.textContent = `「${m.caught}」`; }, 900 * t);
  setTimeout(() => { cap.classList.remove('p1'); cap.classList.add('p2'); title.textContent = `${m.name}，收服。`; line.innerHTML = '<b>站到你身後了。</b>'; ev.style.opacity = 1; burst(el.querySelector('#confetti')); buzz([20, 40, 20]); SFX.play('capture'); }, 1700 * t);
}
function burst(host) {
  if (!host || reduced()) return;
  const colors = ['var(--honey)', 'var(--coral)', '#7ED3C0', '#fff'];
  for (let i = 0; i < 26; i++) { const s = document.createElement('i'); const a = Math.random() * Math.PI * 2; const d = 60 + Math.random() * 120; s.style.setProperty('--dx', `${Math.cos(a) * d}px`); s.style.setProperty('--dy', `${Math.sin(a) * d - 40}px`); s.style.background = colors[i % 4]; s.style.animationDelay = `${Math.random() * .2}s`; host.appendChild(s); }
  setTimeout(() => { host.innerHTML = ''; }, 1600);
}

// 錄音模擬：按住計秒
let recTimer = null;
function recStart() { if (recTimer) return; play.rec = 0; recTimer = setInterval(() => { play.rec += 1; const t = view.querySelector('.rec .t'); if (t) t.textContent = `0:${String(play.rec).padStart(2, '0')}`; view.querySelector('.rec')?.classList.add('on'); view.querySelector('.rec .mic')?.classList.add('on'); if (play.rec >= 30) recStop(); }, 1000); }
function recStop() { if (!recTimer) return; clearInterval(recTimer); recTimer = null; rerender(); if (play.rec >= 3) toast(`錄了 ${play.rec} 秒`); else toast('太短了，再說一次「為什麼」'); }

// ---------- 地圖鏡頭 ----------
function setupMap(el) {
  const map = el.querySelector('.map'); const cam = el.querySelector('.cam'); if (!map || !cam) return;
  const st = { x: 0, y: 0, k: 1, drag: null, moved: false, pts: new Map(), pinch: null };
  const apply = () => { cam.setAttribute('transform', `translate(${st.x} ${st.y}) scale(${st.k})`); };
  const clamp = () => { st.k = Math.max(.8, Math.min(2.6, st.k)); const lim = 220 * st.k; st.x = Math.max(-lim, Math.min(lim * .4, st.x)); st.y = Math.max(-lim, Math.min(lim * .4, st.y)); };
  const zoomAt = (f, cx, cy) => { const r = map.getBoundingClientRect(); const sx = (cx - r.left) / r.width * 440, sy = (cy - r.top) / r.height * 420; const nk = Math.max(.8, Math.min(2.6, st.k * f)); st.x = sx - (sx - st.x) * (nk / st.k); st.y = sy - (sy - st.y) * (nk / st.k); st.k = nk; clamp(); apply(); };
  map.addEventListener('pointerdown', (e) => { st.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (st.pts.size === 1) { st.drag = { x: e.clientX, y: e.clientY, ox: st.x, oy: st.y }; st.moved = false; } });
  map.addEventListener('pointermove', (e) => {
    if (!st.pts.has(e.pointerId)) return; st.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (st.pts.size === 2) { const [a, b] = [...st.pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (st.pinch) { zoomAt(d / st.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2); } st.pinch = d; st.moved = true; return; }
    if (!st.drag) return; const r = map.getBoundingClientRect(); const dx = (e.clientX - st.drag.x) / r.width * 440, dy = (e.clientY - st.drag.y) / r.height * 420;
    if (Math.abs(dx) + Math.abs(dy) > 4 && !st.moved) { st.moved = true; map.classList.add('dragging'); try { map.setPointerCapture(e.pointerId); } catch (err) { /* 不支援也沒關係 */ } }
    st.x = st.drag.ox + dx; st.y = st.drag.oy + dy; clamp(); apply();
  });
  const up = (e) => { st.pts.delete(e.pointerId); if (st.pts.size < 2) st.pinch = null; if (st.pts.size === 0) { st.drag = null; map.classList.remove('dragging'); st.swallow = st.moved; st.moved = false; setTimeout(() => { st.swallow = false; }, 60); } };
  map.addEventListener('pointerup', up); map.addEventListener('pointercancel', up);
  map.addEventListener('click', (e) => { if (st.swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
  map.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.12 : .9, e.clientX, e.clientY); }, { passive: false });
  el.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); const r = map.getBoundingClientRect(); zoomAt(b.dataset.zoom === '1' ? 1.25 : .8, r.left + r.width / 2, r.top + r.height / 2); }));
  // 點區域：鏡頭先飛過去再開燈塔頁
  el.querySelectorAll('.map .hot').forEach((g) => g.addEventListener('click', (e) => { e.stopPropagation(); if (g.dataset.spot) { buzz(6); toast('題庫達標後開放這一區'); return; } const id = g.dataset.region; const r = region(id); st.k = 1.6; st.x = 220 - r.x * st.k; st.y = 200 - r.y * st.k; clamp(); apply(); buzz(8); setTimeout(() => go(`tower/${id}`), reduced() ? 0 : 320); }));
}

// ---------- 事件 ----------
document.addEventListener('click', (e) => {
  const gp = e.target.closest('[data-gpick]'); if (gp) { play.gpick = play.gpick === gp.dataset.gpick ? null : gp.dataset.gpick; return rerender(); }
  const gl = e.target.closest('[data-gline]'); if (gl) { const g = D.GUIDE_QUEUE.find((x) => x.id === gl.dataset.gline); return logIntervention(g, gl.dataset.text); }
  const gs = e.target.closest('[data-gsend]'); if (gs) { const g = D.GUIDE_QUEUE.find((x) => x.id === gs.dataset.gsend); return logIntervention(g, `語音 ${play.rec} 秒`); }
  const rc = e.target.closest('[data-react]'); if (rc) { const id = rc.dataset.react; S.reactions[id] = (S.reactions[id] || 0) + 1; save(); rc.classList.add('on'); rc.querySelector('.num').textContent = Number(rc.querySelector('.num').textContent) + 1; SFX.play('pop'); buzz(8); const r = rc.getBoundingClientRect(); juice('good', r.left + r.width / 2, r.top, '+1'); return; }
  const t = e.target.closest('[data-go],[data-back],[data-act],[data-lreply],[data-look],[data-nick],[data-pin],[data-stage],[data-opt],[data-coach],[data-lore],[data-region],[data-vote],[data-say],[data-say-coach],[data-ropt],[data-aopt],[data-wopt],[data-flag],[data-share],[data-clock]');
  if (!t) return;
  if (t.dataset.back !== undefined) return back();
  if (t.dataset.go) { if (t.dataset.locked) return toast('伏擊層週一開放。可以在設定把示範時間快轉。'); return go(t.dataset.go); }
  if (t.dataset.share) return go(`share/${t.dataset.share}`);
  if (t.dataset.region) return go(`tower/${t.dataset.region}`);
  if (t.dataset.lore) return lore(t.dataset.lore);
  if (t.dataset.lreply) { const [id, action] = t.dataset.lreply.split(':'); return API.campReply(Number(id), action).then(() => { campRemote.at = 0; loadLetters(true); }).catch((e) => toast(`後端沒回應：${e.message}`)); }
  if (t.dataset.clock) { S.clock = t.dataset.clock; save(); rerender(); applyTheme(); return; }
  if (t.dataset.opt !== undefined) {
    const q = PQ()[S.patrol.i]; const i = Number(t.dataset.opt);
    const r = t.getBoundingClientRect();
    return judgeRemote(q, i, () => afterPick(q, i, r));
  }
  if (t.dataset.coach !== undefined) {
    const q = PQ()[S.patrol.i];
    if (q && q.remote && play.lvl < 3) {
      if (play.busy) return; const lvl = play.lvl + 1; play.busy = true; rerender();
      API.coach({ skill_id: 'sign-dist', action: 'hint', level: lvl, hint_level: lvl, step_text: t.dataset.coach === 'more' ? '' : t.dataset.coach, time: clock().time, variant: { answer_token: q.token, picked: play.picked } })
        .then((j) => { play.coachText = play.coachText || {}; play.coachText[lvl] = (j.messages && j.messages[0] && j.messages[0].text) || ''; play.lvl = lvl; play.busy = false; rerender(); })
        .catch((e) => { play.busy = false; play.lvl = lvl; toast(`小陪沒回應：${e.message}`); rerender(); });
      return;
    }
    if (play.lvl < 3) play.lvl += 1; else { play.picked = null; play.lvl = 0; } return rerender();
  }
  if (t.dataset.ropt !== undefined) { play.rpick = Number(t.dataset.ropt); const r = t.getBoundingClientRect(); const ok = play.rpick === D.RELAY.steps[3].answer; buzz(ok ? 10 : [10, 30, 10]); juice(ok ? 'good' : 'bad', r.left + r.width / 2, r.top, ok ? '接到了' : '被騙到'); return rerender(); }
  if (t.dataset.aopt !== undefined) { play.apick = Number(t.dataset.aopt); return rerender(); }
  if (t.dataset.wopt !== undefined) { const wq = WQ(); const i = Number(t.dataset.wopt); const r = t.getBoundingClientRect(); return judgeRemote(wq, i, () => { play.wpick = i; const ok = i === wq.answer; juice(ok ? 'gold' : 'bad', r.left + r.width / 2, r.top, ok ? '醒了！' : '還在睡'); buzz(ok ? [10, 20, 10] : [10, 30, 10]); rerender(); }); }
  if (t.dataset.flag !== undefined) { S.relay.flagsLeft -= 1; play.flagged = Number(t.dataset.flag); save(); toast('已標記「這步怪怪的」，上一棒會收到匿名通知'); return rerender(); }
  if (t.dataset.vote) { const [n, i] = t.dataset.vote.split(':').map(Number); S.duel.votes[n] = i; save(); buzz(10); return rerender(); }
  if (t.dataset.say) return toast(`已送出「${t.dataset.say}」`);
  if (t.dataset.sayCoach) {
    const s = t.dataset.sayCoach; chat.push({ by: 'u', text: s });
    const lv = chat.filter((c) => c.by === 'c').length;
    const replies = [['小陪 · 指', '拆開括號的時候，負號發給了幾個人？'], ['小陪 · 借', '試試看：5 − (2 − 1) 是 4，不是 2。括號裡兩個都要變號。'], ['小陪 · 示範一步', '− (x − 5) 拆開是 −x + 5。接下來你合併看看。'], ['小陪', '這一步交給你。寫到哪裡再叫我。']];
    const r = replies[Math.min(lv, 3)]; chat.push({ by: 'c', lvl: r[0], text: r[1] });
    return rerender();
  }
  if (t.dataset.look) { const [k, v] = t.dataset.look.split(':'); S.join.look[k] = Number(v); save(); SFX.play('tap'); return rerender(); }
  if (t.dataset.nick) { S.join.nick = t.dataset.nick; save(); return rerender(); }
  if (t.dataset.stage) return setStage(t.dataset.stage);
  if (t.dataset.pin) { const J = S.join; J.pin = t.dataset.pin === '⌫' ? J.pin.slice(0, -1) : (J.pin + t.dataset.pin).slice(0, 4); buzz(6); save(); return rerender(); }
  const a = t.dataset.act;
  if (a === 'camp-about') return infoSheet('這是誰寄的？', D.CAMP_ABOUT.map(([k, v]) => `<div class="lore-row"><span class="k">${esc(k)}</span><span>${esc(v)}</span></div>`).join(''));
  if (a === 'coach-open') { play.coachOpen = true; return rerender(); }
  if (a === 'why-type') { play.typing = true; rerender(); const ta = view.querySelector('[data-why-in]'); if (ta) ta.focus(); return; }
  if (a === 'why-voice') { play.typing = false; return rerender(); }
  if (a === 'join-start') { S.join = { step: 0, mode: 'new', nick: '', look: { ...AV.PRESETS[1], hair: 0 }, pin: '', cape: 1 }; save(); return go('join'); }
  if (a === 'join-edit') { S.join = { step: 2, mode: 'edit', nick: S.profile.nick, look: { ...S.profile.look }, pin: '', cape: S.profile.cape }; save(); return go('join'); }
  if (a === 'logout') { if (confirm('登出這台手機？下次要用 PIN 或家長的通行證打開。')) { S.join = { step: 0, mode: 'new', nick: '', look: { ...AV.PRESETS[1], hair: 0 }, pin: '', cape: 1 }; save(); go('join'); } return; }
  if (a === 'join-next') {
    const J = S.join; if (!J) return;
    if (J.mode === 'edit') { S.profile.look = { ...J.look }; S.join = null; save(); toast('造型換好了'); return go('profile'); }
    if (J.step < JOIN_STEPS.length - 1) { J.step += 1; save(); SFX.play('tap'); return rerender(); }
    S.profile = { ...S.profile, nick: J.nick.trim(), look: { ...J.look }, cape: J.cape, pin: J.pin, joined: true }; S.join = null; save(); SFX.play('reward'); toast(`歡迎加入，${S.profile.nick}`); return go('home');
  }
  if (a === 'letter') { S.letterPlayed = true; save(); const l = t; l.classList.add('playing'); setTimeout(() => go('letter'), 450); return; }
  if (a === 'cheer') { S.cheered = true; save(); toast('「大家加油」送給全隊了，不點名任何人'); return rerender(); }
  if (a === 'help') { S.helpAnswered = true; save(); addRecord('explain', '講解給隊友（匿名）', 0); toast('30 秒講解送出去了'); return rerender(); }
  if (a === 'clock-next') { const i = D.CLOCKS.findIndex((c) => c.id === S.clock); S.clock = D.CLOCKS[(i + 1) % D.CLOCKS.length].id; save(); applyTheme(); toast(clock().label + ' · ' + clock().note); return rerender(); }
  if (a === 'report') { toast('已回報給內容團隊，謝謝你'); return; }
  if (a === 'sos') { toast('隊友收到匿名求援：「有一位隊友卡在負號幽靈」。30 分鐘沒人回就播嚮導的 30 秒。'); return; }
  if (a === 'next') {
    const q = PQ()[S.patrol.i];
    if (play.picked !== q.answer) return;
    S.patrol.done += 1; if (play.lvl) S.patrol.helped += 1;
    if (S.patrol.i < PQ().length - 1) { S.patrol.i += 1; play = { lvl: 0, picked: null, tried: false, rec: 0 }; save(); return rerender(); }
    S.patrol.finished = true; addCard(); addRecord('patrol', '巡邏 3 / 3', 3); save(); pushShadowEvent('sign-dist', 'explained_ok'); rerender(); return reward({ big: '+3', title: '巡邏完成', sub: `今天第 ${S.cards} 張` });
  }
  if (a === 'patrol-again') { S.seed = Math.random().toString(36).slice(2, 8); S.patrol = { i: 0, done: 0, helped: 0, why: false, finished: false }; play = { lvl: 0, picked: null, tried: false, rec: 0 }; save(); toast('牠換了個樣子'); return rerender(); }
  if (a === 'reseed') { S.seed = Math.random().toString(36).slice(2, 8); S.patrol = { i: 0, done: 0, helped: 0, why: false, finished: false }; S.ambush = { done: false, passed: false }; S.wake = { done: false }; save(); toast('換了一組題'); return rerender(); }
  if (a === 'relay-submit') { S.relay.done = true; addCard(); addRecord('relay', 'Boss 接力 · 第 4 棒', 2); save(); buzz(20); rerender(); return reward({ big: '+2', title: '第 4 棒交出去了', sub: `今天第 ${S.cards} 張` }); }
  if (a === 'ambush-submit') {
    const aq = AQ();
    if (aq.remote && !(aq.judged && aq.judged[play.apick])) return judgeRemote(aq, play.apick, () => { const btn = view.querySelector('[data-act="ambush-submit"]'); if (btn) btn.click(); });
    const ok = play.apick === aq.answer; S.ambush.done = true; S.ambush.passed = ok; addCard();
    if (ok) { S.shadows['sqrt-split'] = { state: 'captured', day0: '10/03', dayN: '10/12', days: 9 }; addRecord('capture', '收服 拆根蟲', 10); save(); pushShadowEvent('sqrt-split', 'retest_passed'); juice('gold', null, null, '+10'); return setTimeout(() => go('capture/sqrt-split'), reduced() ? 0 : 500); }
    S.shadows['sqrt-split'] = { state: 'near', note: '沒中，不扣分，回到清單' }; save(); return rerender();
  }
  if (a === 'wake-done') { SFX.play('wake'); juice('gold', null, null, '+5'); S.wake.done = true; S.shadows['diff-sq'] = { state: 'captured', day0: '09/20', dayN: '10/11', days: 21 }; addRecord('wake', '叫醒 平方差雙子', 5); addCard(); save(); pushShadowEvent('diff-sq', 'woken'); return go('capture/diff-sq'); }
  if (a === 'settle') { S.clock = 'tue'; S.settled = true; S.route = 'hills'; addRecord('dungeon2', '副本兩星（全隊一份）', 8); save(); applyTheme(); return go('settle'); }
  if (a === 'wall-post') { if (!S.wallPosts.length) { S.wallPosts.push('這週副本過關了，兩星。下一個副本走丘陵線。'); sendLetter({ kind: 'dungeon', extra: { rate: 0.8, stars: 2, next_route_name: '丘陵線' } }); } save(); toast('放上隊伍牆了'); return go('guild'); }
  if (a === 'week-send') { S.weekSent = true; save(); SFX.play('card'); toast('傳到營地了'); return sendLetter({ kind: 'week' }, () => go('camp')); }
  if (a === 'to-camp') { const back = MON_BACK[t.dataset.mon]; return sendLetter(back ? { kind: 'capture', monster_id: back } : null, () => go('camp')); }
  if (a === 'letters-refresh') { campRemote.at = 0; loadLetters(true); return rerender(); }
  if (a === 'race') { S.raceSigned = !S.raceSigned; save(); toast(S.raceSigned ? '已送到家長的 LINE 確認' : '已取消報名'); return rerender(); }
  if (a === 'witness') { S.witnessed = !S.witnessed; save(); return rerender(); }
  if (a === 'api-test') { toast('測試中…'); API.ping().then(() => { toast(`連上了 · ${API.host()}`); sync.at = 0; syncFromBackend(true); }).catch((e) => toast(`連不上：${e.message}`)); return; }
  if (a === 'api-retry') { remote.k = ''; Object.keys(remoteOne).forEach((k) => delete remoteOne[k]); return rerender(); }
  if (a === 'api-off') { API.setBase(''); remote.k = ''; Object.keys(remoteOne).forEach((k) => delete remoteOne[k]); toast('改用本地題'); return rerender(); }
  if (a === 'sound') { S.sound = !S.sound; SFX.setEnabled(S.sound); save(); if (S.sound) SFX.play('hit'); return rerender(); }
  if (a === 'theme') { const r = document.documentElement; const dark = isDark(); r.setAttribute('data-theme', dark ? 'light' : 'dark'); S.theme = dark ? 'light' : 'dark'; save(); return rerender(); }
  if (a === 'pboard') { S.personalBoard = !S.personalBoard; save(); toast(S.personalBoard ? '13 歲以下需家長在 LINE 端同意' : '已關閉'); return rerender(); }
  if (a === 'pvp') { S.pvp = !S.pvp; save(); toast(S.pvp ? '你投了同意。只要有一票不同意，本季打幽靈隊。' : '你投了不同意。沒有人知道是誰投的。'); return rerender(); }
  if (a === 'reset') { if (confirm('重設所有示範資料？')) reset(); return; }
});
// 打字欄位：只更新按鈕狀態，不重繪（避免游標跳走）
document.addEventListener('input', (e) => {
  const w = e.target.closest('[data-why-in]');
  if (w) { play.whyText = w.value; play.typed = w.value.trim().length; view.querySelectorAll('[data-act="next"],[data-act="ambush-submit"]').forEach((b) => { if (b.dataset.act === 'next') b.disabled = !whyOk(); else b.disabled = play.apick === null || play.apick === undefined || !whyOk(); }); return; }
  const n = e.target.closest('[data-nick-in]');
  if (n && S.join) { S.join.nick = n.value; save(); const b = view.querySelector('[data-act="join-next"]'); if (b) b.disabled = !n.value.trim(); view.querySelectorAll('[data-nick]').forEach((c) => c.classList.toggle('on', c.dataset.nick === n.value)); }
});
document.addEventListener('change', (e) => { const st = e.target.closest('[data-student]'); if (st) { S.studentId = Math.max(1, Number(st.value) || 1); save(); sync.at = 0; syncFromBackend(true); return; } const inp = e.target.closest('[data-api]'); if (!inp) return; const u = API.setBase(inp.value); remote.k = ''; toast(u ? `後端：${API.host()}` : '改用本地引擎'); rerender(); });
document.addEventListener('pointerdown', (e) => { const m = e.target.closest('[data-act="rec"]'); if (m) { e.preventDefault(); recStart(); } });
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => document.addEventListener(ev, (e) => { if (recTimer && !e.target.closest('[data-act="rec"]')) recStop(); else if (recTimer && ev !== 'pointerleave') recStop(); }));
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.map .hot')) { e.preventDefault(); e.target.click(); } });

function infoSheet(title, html) {
  const bg = document.createElement('div'); bg.className = 'sheet-bg'; const sh = document.createElement('div'); sh.className = 'sheet';
  sh.innerHTML = `<div class="grip"></div><h3 style="margin:4px 0 10px">${esc(title)}</h3>${html}<div class="btns"><button class="btn ghost" data-sheet-close>知道了</button></div>`;
  const shell = $('.shell'); shell.appendChild(bg); shell.appendChild(sh);
  requestAnimationFrame(() => { bg.classList.add('on'); sh.classList.add('on'); });
  const close = () => { bg.classList.remove('on'); sh.classList.remove('on'); setTimeout(() => { bg.remove(); sh.remove(); }, 420); };
  bg.addEventListener('click', close); sh.querySelector('[data-sheet-close]').addEventListener('click', close);
}
function lore(id) {
  const m = mon(id); const s = S.shadows[id];
  if (s.state === 'fog' && region(m.region).light !== 'lit') return toast('迷霧還沒散。遠征偵察到這一區，或等全區點燈。');
  const bg = document.createElement('div'); bg.className = 'sheet-bg'; const sh = document.createElement('div'); sh.className = 'sheet';
  sh.innerHTML = `<div class="grip"></div><div class="lore">${monSvg(m, stateCls[s.state] + ' bob')}<div><h3>${esc(m.name)}</h3><span class="where">${esc(region(m.region).name)} · ${esc(D.STATE_LABEL[s.state])}${s.days ? ` · 第 ${s.days} 天` : ''}</span></div></div>
    ${[['出身', m.origin], ['騙術', m.trick], ['口頭禪', `「${m.taunt}」`], ['弱點', m.weakness], ['被識破時', `「${m.caught}」`]].map(([k, v]) => `<div class="lore-row"><span class="k">${k}</span><span>${esc(v)}</span></div>`).join('')}
    ${s.state === 'captured' ? `<div class="btns"><button class="btn honey" data-share="${m.id}">做一張分享卡</button></div>` : (s.state === 'asleep' ? `<div class="btns"><button class="btn" data-go="wake">今天叫醒牠</button></div>` : '')}`;
  const shell = $('.shell'); shell.appendChild(bg); shell.appendChild(sh);
  requestAnimationFrame(() => { bg.classList.add('on'); sh.classList.add('on'); });
  const close = () => { bg.classList.remove('on'); sh.classList.remove('on'); setTimeout(() => { bg.remove(); sh.remove(); }, 420); };
  bg.addEventListener('click', close); sh.addEventListener('click', (e) => { if (e.target.closest('[data-share],[data-go]')) close(); });
  document.addEventListener('keydown', function onEsc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } });
}

// ---------- 主題與啟動 ----------
function applyTheme() {
  const r = document.documentElement;
  if (S.theme) r.setAttribute('data-theme', S.theme);
  else if (night()) r.setAttribute('data-theme', 'dark');
  else r.removeAttribute('data-theme');
}
// 加到主畫面後也能開：註冊 service worker（網路優先；只在 https 或本機）
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) { window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {})); }
// 美術掛載：codex 產出的 art/manifest.json 存在時，開啟 [data-art]，由 art/art.css 接手背景與角色
{ const qp = new URLSearchParams(location.search).get('api'); if (qp !== null) API.setBase(qp); }
const ART = { m2: false };
fetch('art/manifest.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((m) => {
  if (!m) return;
  document.documentElement.setAttribute('data-art', m.version || '1');
  return fetch('art/monsters-defs-2.svg').then((r) => (r.ok ? r.text() : '')).then((t) => {
    if (!t) return; const box = document.createElement('div'); box.innerHTML = t; const defs = document.querySelector('svg defs'); if (!defs) return;
    box.querySelectorAll('symbol').forEach((sym) => { if (!document.getElementById(sym.id)) defs.appendChild(sym); });
    ART.m2 = true; if (parse().key === 'map') rerender();
  });
}).catch(() => {});
function renderTabs() { const t = tabsFor(); const sig = t.map(([k]) => k).join(); if (tabsEl.dataset.sig === sig) return; tabsEl.dataset.sig = sig; tabsEl.style.gridTemplateColumns = `repeat(${t.length},1fr)`; tabsEl.innerHTML = t.map(([k, n, p]) => `<button data-go="${k}" aria-label="${n}"><svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>${n}</button>`).join(''); }
renderTabs();
$('#panel-scenes')?.querySelectorAll('button[data-go]').forEach(() => {});
window.addEventListener('hashchange', route);
applyTheme();
route();
