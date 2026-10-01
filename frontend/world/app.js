// app.js — Tandelo 冒險世界 Demo：hash 路由、狀態（localStorage）、畫面、動態。
// 只用瀏覽器內建能力；沒有後端也能完整操作。所有資料虛構。
import * as D from './data.js';

const KEY = 'tandelo.world.v1';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const buzz = (p = 12) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* 無振動也沒關係 */ } };

// ---------- 狀態 ----------
function defaults() {
  return {
    clock: 'sat',
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
  };
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s ? { ...defaults(), ...s } : defaults(); } catch (e) { return defaults(); } }
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 隱私模式 */ } }
function reset() { S = defaults(); save(); go('home'); toast('已重設示範資料'); }

const clock = () => D.CLOCKS.find((c) => c.id === S.clock) || D.CLOCKS[0];
const night = () => { const [h, m] = clock().time.split(':').map(Number); const t = h * 60 + m; return t >= 1350 || t < 360; };
const mon = (id) => D.MONSTERS.find((m) => m.id === id);
const region = (id) => D.REGIONS.find((r) => r.id === id);
const capturedCount = () => Object.values(S.shadows).filter((s) => s.state === 'captured').length;
const myPoints = () => S.records.reduce((a, r) => a + r.pts, 0);

// ---------- 畫面元件 ----------
const SVG = {
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
const av = (n, cls = '') => `<span class="av a${n} ${cls}" aria-hidden="true"></span>`;
const kid = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="24" r="14" fill="currentColor"/><path d="M8 62c2-16 12-24 24-24s22 8 24 24z" fill="currentColor"/></svg>';
const towerSvg = '<svg viewBox="0 0 24 32" aria-hidden="true"><use href="#tower"/></svg>';
const hd = (title, sub, back = true) => `<div class="hd ${back ? 'with-back' : ''}">${back ? `<button class="back" data-back aria-label="返回">${SVG.back}</button>` : ''}<div class="grow"><h2>${title}</h2>${sub ? `<span class="sub">${sub}</span>` : ''}</div></div>`;
const wave = (n = 18) => `<span class="wave" aria-hidden="true">${'<i></i>'.repeat(n)}</span>`;

// ---------- 畫面 ----------
const SCREENS = {};

SCREENS.home = () => {
  const c = clock();
  const sh = S.shadows;
  const todays = [
    { id: 'patrol', mon: mon('sign-dist'), title: '巡邏 · 負號幽靈', sub: S.patrol.finished ? '3 / 3 完成' : `第 1 層 · 你 ${S.patrol.done} / 3`, why: '林老師昨晚說：牠在括號前面，先別急著算。', done: S.patrol.finished, go: 'play' },
    { id: 'relay', mon: mon('factor-cross'), title: 'Boss 接力 · 第 4 棒', sub: S.relay.done ? '你的那一棒交出去了' : '開跑中 · 前三棒已完成', why: '一題多步驟，你只負責接到的那一步。', done: S.relay.done, go: 'relay' },
    S.clock === 'mon' || S.clock === 'tue' || S.clock === 'night'
      ? { id: 'ambush', mon: mon('sqrt-split'), title: '伏擊 · 拆根蟲回來了', sub: S.ambush.done ? (S.ambush.passed ? '收服了' : '牠還在附近，不扣分') : '沒有提示 · 只認第一次', why: '第 7 到 12 天，自己一個人面對牠。', done: S.ambush.done, go: 'ambush' }
      : { id: 'wake', mon: mon('diff-sq'), title: '叫醒影子 · 平方差雙子', sub: S.wake.done ? '叫醒了' : '上週又錯了一次 · 不扣分', why: '睡著的影子不會消失，等你叫醒。', done: S.wake.done, go: 'wake' },
  ];
  const lit = 9 + S.cards;
  return `
  <div class="home-top">
    <div class="flag"><svg viewBox="0 0 64 40" aria-hidden="true"><use href="#logo"/></svg><span class="role" title="這週的位置：書記">書</span></div>
    <div class="grow"><h2>${esc(D.SQUAD.name)}</h2><span class="sub">嚮導 ${esc(D.SQUAD.guide)} · 第 ${D.SQUAD.week} 週 · ${esc(D.SQUAD.examLabel)}</span></div>
    <div class="avs">${av(1, 'me')}${av(2)}${av(3)}${av(4)}${av(5)}</div>
  </div>
  <button class="letter ${S.letterPlayed ? '' : ''}" data-act="letter" aria-label="播放嚮導的信">
    <span class="play">${SVG.play}</span>
    <span class="grow"><b>嚮導的信 · 第 ${D.LETTER.week} 封「${D.LETTER.chapter}」</b><small>對面的小隊也在追同一隻怪。</small>${wave(22)}</span>
    <span class="len num">${D.LETTER.length}</span>
  </button>
  ${S.witnessed ? `<div class="witness"><span class="heart">${SVG.heart}</span><span>媽媽見證了這一次。<small class="meta" style="display:block">昨晚的營地來信 · 漏項獸</small></span></div>` : ''}
  <div class="today"><div><div class="count num">${S.cards}<small>/ 3 張任務卡</small></div><div class="meta">${esc(c.label)} · ${esc(c.note)}</div></div><div class="dots" aria-hidden="true">${[0, 1, 2].map((i) => `<i class="${i < S.cards ? 'on' : ''}"></i>`).join('')}</div></div>
  ${todays.map((t) => `<button class="task ${t.done ? 'done' : ''}" data-go="${t.go}"><span class="mon ${t.done ? 'shadow' : (t.id === 'wake' ? 'asleep' : '')}" aria-hidden="true"><svg><use href="#${t.mon.shape}"/></svg></span><span class="grow"><b>${esc(t.title)}</b><small>${esc(t.sub)}</small><span class="why">${esc(t.why)}</span></span><span class="go">${t.done ? SVG.check : SVG.chev}</span></button>`).join('')}
  <p class="note">每天最多三張。22:30 之後不發、不亮、不推播。哪天沒開，隔天卡上寫「回來了就好」。</p>
  <div class="sect"><h3>整備條</h3><span class="meta">全隊這週</span></div>
  <div class="card"><div class="ready"><div class="bar"><i style="transform:scaleX(${lit / 15})"></i></div><span class="n">亮了 ${lit} / 15 張</span></div><p class="note">整備官看得到亮了幾張，看不到誰卡在哪、答對幾題。</p>
    <div class="btns"><button class="btn soft ${S.cheered ? '' : ''}" data-act="cheer" ${S.cheered ? 'disabled' : ''}>${S.cheered ? '已經對全隊說過「大家加油」' : '對全隊按一次「大家加油」'}</button></div></div>
  <div class="sect"><h3>本週副本</h3><button data-go="dungeon">看副本</button></div>
  <button class="task" data-go="dungeon">${monSvg(mon('sign-dist'), S.settled ? 'shadow' : '')}<span class="grow"><b>${esc(D.DUNGEON.name)} · ${esc(D.ROUTES[S.route].name)}</b><small>${S.settled ? '已結算 · 80% 兩星過關' : '本週副本進行中 · 週二 22:00 結算'}</small></span><span class="go">${SVG.chev}</span></button>
  <div class="sect"><h3>出題戰 · 第 3 週</h3><button data-go="duel">去作答</button></div>
  <button class="task" data-go="duel">${monSvg(mon('diff-sq'))}<span class="grow"><b>${esc(D.DUEL.opponent)}出了三題</b><small>我們一起答 · ${esc(D.DUEL.reveal)}</small></span><span class="go">${SVG.chev}</span></button>
  <p class="note" style="text-align:center;margin-top:18px">示範畫面 · 資料為虛構 · 隊友只以顏色出現，不出現名字。</p>`;
};

SCREENS.letter = () => `
  ${hd(`嚮導的信 · 第 ${D.LETTER.week} 封`, `「${D.LETTER.chapter}」· 林老師的聲音 · ${D.LETTER.length}`)}
  <div class="stack">
    ${D.LETTER.panels.map((p, i) => `<div class="card ${i === 2 ? 'night' : ''}" style="animation:pop .4s var(--ease) ${i * .12}s both"><div class="row">${monSvg(mon(p.mon), stateCls[p.state] || '')}<div class="grow"><b>${esc(p.title)}</b><p style="font-size:14px;margin-top:2px">${esc(p.text)}</p></div></div></div>`).join('')}
  </div>
  <p class="note">三格、每格不到 40 字、可以跳過、可以用聽的。一季八封，由嚮導的聲音講，遠征前播、任務卡裡可重聽。</p>
  <div class="btns"><button class="btn" data-back>回到今天</button></div>`;

SCREENS.shadows = () => {
  const caps = D.MONSTERS.filter((m) => S.shadows[m.id].state === 'captured');
  const asleep = D.MONSTERS.filter((m) => S.shadows[m.id].state === 'asleep');
  return `
  ${hd('影子牆', `收服的怪站在你身後 · ${esc(D.SQUAD.me.nick)}`, false)}
  <div class="wall"><div class="stars"></div><div class="count">收服 <b>${caps.length}</b> 隻 · 睡著 ${asleep.length}</div>
    <div class="shadows">${caps.map((m) => monSvg(m, 'shadow blink')).join('')}${asleep.map((m) => monSvg(m, 'asleep')).join('')}</div>
    <div class="you"><span class="kid">${kid}</span><small>${esc(D.SQUAD.me.nick)} · ${esc(D.SQUAD.name)}</small></div>
  </div>
  <div class="sect"><h3>數理大陸 · 八隻怪</h3><span class="meta">點一隻看傳說卡</span></div>
  <div class="mgrid">${D.MONSTERS.map((m) => { const s = S.shadows[m.id]; return `<button class="mcard ${s.state === 'fog' ? 'fogc' : ''}" data-lore="${m.id}">${monSvg(m, stateCls[s.state])}<span><b>${s.state === 'fog' ? '？？？' : esc(m.name)}</b><small>${esc(region(m.region).name)} · ${esc(D.STATE_LABEL[s.state])}${s.days ? ` · 第 ${s.days} 天` : ''}</small></span></button>`; }).join('')}</div>
  <div class="legend"><span><i style="background:var(--fog);border:1.5px dashed var(--fog-text)"></i>迷霧</span><span><i style="background:var(--coral)"></i>還在附近</span><span><i style="background:var(--pine)"></i>打中了</span><span><i style="background:var(--shadow-ink);box-shadow:0 0 0 2px var(--honey) inset"></i>收服</span><span><i style="background:var(--fog)"></i>睡著了</span></div>
  <div class="sect"><h3>稱號</h3><span class="meta">只數收服、叫醒、講解</span></div>
  <div class="titles">${D.TITLES.map((t) => `<div class="title ${t.earned ? '' : 'off'}"><span class="badge">${t.team ? SVG.flag : SVG.title}</span><span><b>${esc(t.name)}</b><small>${esc(t.rule)}${t.team ? ' · 隊伍級' : ''}</small></span><span class="pr">${t.earned ? '已獲得' : `${t.progress[0]} / ${t.progress[1]}`}</span></div>`).join('')}</div>
  <div class="sect"><h3>冒險日誌</h3><button data-go="record">看戰績</button></div>
  <div class="card"><div class="row">${av(1, 'me')}<div class="grow"><b>「負號要發給括號裡每一個人。」</b><small>說給我聽 · 0:28 · 10/09</small></div><button class="btn sm soft">重聽</button></div></div>
  <p class="note">狀態會掉，但事件不會消失。睡著的影子留在牆上、變灰、標上叫醒的日期。沒有東西會消失。</p>`;
};

SCREENS.record = () => `
  ${hd('我的戰績', '只有自己和家長看得到')}
  <div class="card"><div class="settle"><div class="big num">${myPoints()}</div><div class="lbl">本季累積 · 只從驗證過的學會來</div></div></div>
  <div class="card">${S.records.slice().reverse().map((r) => `<div class="kv"><span>${esc(r.label)}<span class="meta" style="margin-left:6px">${esc(r.when)}</span></span><b>+${r.pts}</b></div>`).join('')}</div>
  <div class="card flat"><h3>怎麼算</h3>
    <div class="kv"><span>收服一隻怪</span><b>10</b></div><div class="kv"><span>叫醒一隻睡著的影子</span><b>5</b></div><div class="kv"><span>講解被嚮導抽查合格</span><b>3</b></div><div class="kv"><span>副本過關（一到三星，全隊一份）</span><b>5–12</b></div>
    <p class="note">不從登入、練習量、連續天數、付費或對戰勝負來。每天三張任務卡就是上限，熬夜刷不上去。</p></div>`;

SCREENS.dungeon = () => {
  const m = mon('sign-dist');
  const r = D.ROUTES[S.route];
  const patrolSt = S.patrol.finished ? 'done' : '';
  const ambushOpen = ['mon', 'tue', 'night'].includes(S.clock);
  return `
  ${hd('本週副本', `${esc(D.SQUAD.subject)} · ${esc(r.name)} · 第 ${D.SQUAD.week} 週`, false)}
  <div class="dg-hero"><div class="fogbg"></div><span class="eyebrow">多項式林</span><h2>${esc(D.DUNGEON.name)}</h2><p>${S.settled ? '已結算 · 80% 兩星過關' : '本週副本進行中 · 結算之前不顯示人數與分數'}</p>${monSvg(m, S.settled ? 'shadow' : 'bob')}</div>
  <button class="layer ${patrolSt}" data-go="play"><span class="n">1</span><span><b>巡邏 · 每人 3 題</b><small>本週遠征那隻怪，換個樣子出現。小陪和求援隨時可用。</small></span><span class="st">${S.patrol.finished ? '3 / 3' : `${S.patrol.done} / 3`}</span></button>
  <button class="layer ${ambushOpen ? (S.ambush.done ? 'done' : '') : 'lock'}" data-go="${ambushOpen ? 'ambush' : 'dungeon'}" ${ambushOpen ? '' : 'data-locked="1"'}><span class="n">2</span><span><b>伏擊 · 到期的影子</b><small>${ambushOpen ? '拆根蟲回來了。沒有提示、不能求援。' : '1 隻影子到期 · 週一開放'}</small></span><span class="st">${S.ambush.done ? (S.ambush.passed ? '收服' : '沒中') : (ambushOpen ? '開放' : '週一')}</span></button>
  <button class="layer ${S.relay.done ? 'done' : ''}" data-go="relay"><span class="n">3</span><span><b>Boss 接力 · 每人 1 棒</b><small>${S.relay.done ? '你的第 4 棒交出去了，等第 5 棒。' : '開跑中 · 你是第 4 棒'}</small></span><span class="st">${S.relay.done ? '已接' : '第 4 棒'}</span></button>
  ${!S.helpAnswered ? `<div class="help">${monSvg(m)}<div><b>有一位隊友卡在負號幽靈</b><small>你已經過了這層，可以錄 30 秒講給那位隊友聽。</small><button class="btn sm coral" data-act="help">錄 30 秒講給他聽</button></div></div>` : `<div class="card mint"><div class="row"><span class="av a1 me"></span><div class="grow"><b>你的 30 秒講解送出去了</b><small>隊友收到的是匿名的。你的日誌多一筆「講解」。</small></div></div></div>`}
  <p class="rule-line">結算之前，不顯示人數與分數。求援是匿名的。</p>
  <div class="sect"><h3>結算</h3><span class="meta">${esc(D.DUNGEON.settle)}</span></div>
  ${S.settled ? `<button class="btn ghost" data-go="settle">再看一次結算</button>` : `<button class="btn ${S.clock === 'tue' ? '' : 'ghost'}" data-act="settle">${S.clock === 'tue' ? '結算 · 全隊看到解題率' : '快轉到週二 22:00 結算'}</button>`}
  <div class="sect"><h3>一季八週</h3><span class="meta">從遠征到遠征</span></div>
  <div class="calendar">${[['W1', '開季 · 副本從平原線出發'], ['W2', '副本補洞期'], ['W3', '出題戰 · 這週不開副本（示範合併）'], ['W4', '鏡像賽 · 結業點，可停可續'], ['W5', '副本跟上學校進度'], ['W6', '出題戰 · 魔王前的模擬戰'], ['W7', '鏡像賽 · 總複習副本'], ['W8', '魔王戰 · 段考週，不開副本、不加量']].map(([w, t], i) => `<div class="${i === 2 ? 'now' : ''}"><b>${w}</b><span>${esc(t)}</span></div>`).join('')}</div>
  <p class="note">小隊解題率 ＝ 巡邏與接力答對的題數 ÷ 題數。伏擊層不計、申報缺席者的配額不計。未滿 60% 撤退不扣分，60% 一星，75% 兩星往上一條路線，90% 三星要全員出手。</p>`;
};

// 巡邏作答：四層引導 問 → 指 → 借 → 示範一步
let play = { lvl: 0, picked: null, tried: false, rec: 0, recT: null };
SCREENS.play = () => {
  const q = D.PATROL[S.patrol.i];
  if (!q || S.patrol.finished) return `${hd('巡邏完成', '第 1 層 · 負號幽靈')}<div class="card"><div class="settle"><div class="big num">3<small>/ 3</small></div><div class="lbl">巡邏層完成 · 問過小陪照樣算分</div></div></div><div class="btns"><button class="btn" data-go="dungeon">回到副本</button><button class="btn ghost" data-go="home">回到今天</button></div>`;
  const m = mon('sign-dist');
  const lvls = ['問', '指', '借', '示範一步'];
  const txt = [q.hint.ask, q.hint.point, q.hint.lend, q.hint.show];
  return `
  ${hd(`巡邏 · 第 ${S.patrol.i + 1} 題`, '負號幽靈 · 多項式林')}
  <div class="q-top"><div class="steps" aria-label="進度">${D.PATROL.map((_, i) => `<i class="${i < S.patrol.i ? 'on' : (i === S.patrol.i ? 'cur' : '')}"></i>`).join('')}</div><span class="pill brand">今天 ${S.cards} / 3</span></div>
  <div class="qcard"><div class="row" style="margin-bottom:6px">${monSvg(m, play.tried ? 'shake' : 'bob')}<div class="grow"><span class="meta">這隻怪的口頭禪</span><b style="font-size:13.5px">「${esc(m.taunt)}」</b></div></div>
    <p class="stem"><span class="mx">${esc(q.stem.replace('化簡：', ''))}</span><br><span class="meta" style="font-size:13px;font-weight:500">化簡</span></p>
    <div class="opts" id="opts">${q.options.map((o, i) => `<button class="opt ${play.picked === i ? (i === q.answer ? 'ok' : 'trap') : ''}" data-opt="${i}" ${play.picked === q.answer ? 'disabled' : ''}><i>${'ABCD'[i]}</i><span class="mx">${esc(o)}</span></button>`).join('')}</div>
    ${play.picked !== null && play.picked !== q.answer ? `<div class="taunt">${monSvg(m, 'sm')}<p><b>${esc(m.name)}</b>：你看，${play.picked === q.trap ? '只有第一項變號。我就說後面的我不管。' : '差一點點，再看一次括號。'}</p></div>` : ''}
    ${play.picked === q.answer ? `<div class="taunt learned">${monSvg(m, 'sm shadow')}<p><b>打中了</b>：${esc(m.weakness)}${play.lvl ? '（問過小陪，一樣算 1 分）' : ''}</p></div>` : ''}
  </div>
  ${play.picked !== q.answer ? `
  <div class="coach"><span class="face">${SVG.coach}</span><div><span class="lvl">小陪 · ${lvls[play.lvl]}</span><p>${esc(txt[play.lvl])}</p>
    <div class="chips">${play.lvl === 0 ? ['我把括號拆開了', '我還沒開始', '我卡在合併'].map((c) => `<button class="chip" data-coach="${esc(c)}">${esc(c)}</button>`).join('') : `<button class="chip" data-coach="more">${play.lvl < 3 ? '再多一點' : '我再試一次'}</button><button class="chip ghost" data-act="sos">求援 · 隊友或嚮導</button>`}</div></div></div>` : `
  ${q.why ? `<div class="rec ${play.rec ? 'on' : ''}"><button class="mic ${play.rec ? 'on' : ''}" data-act="rec" aria-label="按住錄 30 秒">${SVG.mic}</button><span class="t num">0:${String(play.rec).padStart(2, '0')}</span>${wave(14)}<p>這一題要附一句「為什麼」。用說的就可以，嚮導每週抽查 3 段。</p></div>` : ''}
  <div class="btns"><button class="btn" data-act="next" ${q.why && play.rec < 3 ? 'disabled' : ''}>${S.patrol.i < 2 ? '下一題' : '完成巡邏'}</button></div>`}
  <p class="note">問過小陪或求援之後答對，一樣算 1 分。「有求援」只有嚮導看得到。</p>`;
};

SCREENS.relay = () => {
  const r = D.RELAY;
  return `
  ${hd('Boss 接力', `你是第 4 棒 · 截止 ${esc(D.DUNGEON.relayDeadline)}`)}
  <div class="card night"><span class="eyebrow">Boss</span><p class="stem" style="font-size:17px;margin:4px 0 0"><span class="mx">${esc(r.stem)}</span></p></div>
  <div class="relay">${r.steps.map((s, i) => {
    const me = s.by === 'me';
    const cls = me ? 'me' : (s.done ? '' : 'next');
    return `<div class="rstep ${cls} ${play.flagged === i ? 'flag' : ''}">${me ? av(1, 'me') : av(s.by)}<div class="box"><small>第 ${i + 1} 棒${me ? ' · 你' : (s.done ? ' · 已完成' : ' · 等你交棒')}</small>${me && !S.relay.done ? `<div class="opts" style="margin-top:8px">${s.options.map((o, j) => `<button class="opt ${play.rpick === j ? (j === s.answer ? 'ok' : 'trap') : ''}" data-ropt="${j}" ${play.rpick === s.answer ? 'disabled' : ''}><i>${'ABCD'[j]}</i><span class="mx">${esc(o)}</span></button>`).join('')}</div>${play.rpick !== null && play.rpick !== undefined && play.rpick !== s.answer ? `<div class="taunt">${monSvg(mon('sign-dist'), 'sm')}<p><b>負號幽靈</b>：−(x² − 1) 只有 x² 變號嘛。</p></div>` : ''}` : `<span class="mx">${esc(me && S.relay.done ? 'x² + 12x + 19' : s.text)}</span>`}${!me && s.done && S.relay.flagsLeft > 0 && !S.relay.done ? `<div style="margin-top:6px"><button class="chip ghost" data-flag="${i}" style="font-size:12px">這步怪怪的（剩 ${S.relay.flagsLeft} 次）</button></div>` : ''}</div></div>`;
  }).join('')}</div>
  ${!S.relay.done ? `<div class="btns"><button class="btn" data-act="relay-submit" ${play.rpick === r.steps[3].answer ? '' : 'disabled'}>交出第 4 棒</button></div>` : `<div class="card mint"><b>交棒了。</b><p class="meta">第 5 棒 24 小時沒接，系統會跳到下一棒，由小陪示範，那一棒移出題數。</p></div>`}
  <p class="note">每一棒只看「接到的那一步有沒有做對」。發現上一步不對可以按「這步怪怪的」，每人每場最多兩次。被退回的那一棒改對，照樣算對。</p>`;
};

SCREENS.ambush = () => {
  const a = D.AMBUSH; const m = mon(a.monster);
  if (S.ambush.done) return `${hd('伏擊 · 結果', '只記進你的收服紀錄')}<div class="card ${S.ambush.passed ? 'honey' : 'coral'}"><div class="row">${monSvg(m, S.ambush.passed ? 'shadow' : '')}<div class="grow"><b>${S.ambush.passed ? '拆根蟲，收服。' : '拆根蟲還在附近。'}</b><small>${S.ambush.passed ? '第 9 天不給提示也會。' : '不扣分，回到練習清單，下週再來。'}</small></div></div></div><div class="btns"><button class="btn" data-go="dungeon">回到副本</button></div>`;
  return `
  ${hd('伏擊', '到期的影子回來了 · 沒有提示')}
  <div class="card coral"><div class="row">${monSvg(m, 'shake')}<div class="grow"><b>${esc(m.name)}回來了</b><small>第 9 天。這次沒有嚮導在旁邊，小陪也不出聲。只認第一次作答。</small></div></div></div>
  <div class="qcard"><p class="stem"><span class="mx">${esc(a.stem)}</span></p>
    <div class="opts">${a.options.map((o, i) => `<button class="opt ${play.apick === i ? 'pick' : ''}" data-aopt="${i}"><i>${'ABCD'[i]}</i><span class="mx">${esc(o)}</span></button>`).join('')}</div></div>
  <div class="rec ${play.rec ? 'on' : ''}"><button class="mic ${play.rec ? 'on' : ''}" data-act="rec" aria-label="按住錄一句為什麼">${SVG.mic}</button><span class="t num">0:${String(play.rec).padStart(2, '0')}</span>${wave(14)}<p>錄一句「為什麼」，再交出去。</p></div>
  <div class="btns"><button class="btn coral" data-act="ambush-submit" ${play.apick === null || play.apick === undefined || play.rec < 3 ? 'disabled' : ''}>交出去 · 只認這一次</button></div>
  <p class="note">伏擊層的結果只進個人紀錄，不算進全隊分數。團隊壓力流不進證據。</p>`;
};

SCREENS.wake = () => {
  const m = mon('diff-sq');
  if (S.wake.done) return `${hd('叫醒影子', '平方差雙子')}<div class="card honey"><div class="row">${monSvg(m, 'shadow')}<div class="grow"><b>平方差雙子醒了。</b><small>再站回你身後。戰績 +5。</small></div></div></div><div class="btns"><button class="btn" data-go="home">回到今天</button></div>`;
  return `
  ${hd('叫醒影子', '平方差雙子 · 分解洞窟')}
  <div class="card"><div class="row">${monSvg(m, 'asleep')}<div class="grow"><b>上週又錯了一次，睡著了。</b><small>不扣分、不消失，只是換一種狀態。今天可以叫醒。</small></div></div></div>
  <div class="qcard"><p class="stem"><span class="mx">x² − 49 = ?</span></p>
    <div class="opts">${['(x + 7)(x − 7)', '(x − 7)(x − 7)', '(x + 7)(x + 7)', '(x − 49)(x + 1)'].map((o, i) => `<button class="opt ${play.wpick === i ? (i === 0 ? 'ok' : 'trap') : ''}" data-wopt="${i}" ${play.wpick === 0 ? 'disabled' : ''}><i>${'ABCD'[i]}</i><span class="mx">${esc(o)}</span></button>`).join('')}</div>
    ${play.wpick === 1 ? `<div class="taunt">${monSvg(m, 'sm')}<p><b>平方差雙子</b>：我們是雙胞胎，當然一樣。</p></div>` : ''}
    ${play.wpick === 0 ? `<div class="taunt learned">${monSvg(m, 'sm shadow')}<p><b>醒了</b>：${esc(m.weakness)}</p></div>` : ''}</div>
  <div class="btns"><button class="btn honey" data-act="wake-done" ${play.wpick === 0 ? '' : 'disabled'}>叫醒 · 站回身後</button></div>`;
};

SCREENS.settle = () => `
  ${hd('副本結算', `${esc(D.DUNGEON.name)} · ${esc(D.DUNGEON.settle)}`)}
  <div class="card"><div class="settle"><div class="big num">80<small>%</small></div><div class="lbl">小隊解題率</div>
    <div class="stars" aria-label="兩星過關">${[1, 2].map(() => `<svg class="on" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.1 1.2 6.1L12 17l-5.4 3 1.2-6.1L3.3 9.8l6.1-.7z"/></svg>`).join('')}<svg class="off" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.1 1.2 6.1L12 17l-5.4 3 1.2-6.1L3.3 9.8l6.1-.7z"/></svg></div>
    <div class="lbl"><b>兩星過關</b> · 下一個副本往上一條</div></div>
    <div class="divider"></div>
    <div class="kv"><span>巡邏</span><b>12 / 15</b></div><div class="kv"><span>Boss 接力（抓到負號幽靈 1 次）</span><b>4 / 5</b></div><div class="kv"><span>伏擊層叫醒的影子（不計分）</span><b>2 隻</b></div>
    <p class="note">合計 16 ÷ 20 ＝ 80%。問過小陪或求援之後答對的 3 題一樣算分。每一層都寫「得分 / 題數」，家長自己算也對得上。</p></div>
  <div class="private">${monSvg(mon('sq-expand'), 'shadow')}<div><b>你收服了漏項獸</b><small>這一行只有你看得到。</small></div></div>
  <div class="card mint"><div class="kv" style="border:0"><span>下一個副本</span><b>${esc(D.ROUTES[D.ROUTES.plain.next].name)}</b></div><p class="note">路線只決定題目範圍與對戰配對，不出現在隊伍牆、分享卡、對手資訊上。</p></div>
  <div class="card flat"><p style="font-size:13.5px">負號幽靈絆倒全隊最多次，已送到林老師的課前一頁。</p></div>
  <div class="btns"><button class="btn" data-act="wall-post">放上隊伍牆</button><button class="btn ghost" data-go="home">回到今天</button></div>`;

SCREENS.duel = () => {
  const d = D.DUEL;
  return `
  ${hd('出題戰 · 第 3 週', '兩隊互相出題，只出雙方都遠征過的怪', false)}
  <div class="vs"><div class="team">${av(1, 'lg')}<b>${esc(D.SQUAD.name)}</b><small>我們</small></div><span class="x">vs</span><div class="team">${av(4, 'lg')}<b>${esc(d.opponent)}</b><small>同路線 · 不同嚮導</small></div></div>
  <div class="sect"><h3>對方出的三題</h3><span class="meta">${esc(d.reveal)}</span></div>
  ${d.questions.map((q) => { const m = mon(q.monster); const v = S.duel.votes[q.n]; return `<div class="card"><div class="row" style="margin-bottom:8px">${monSvg(m, 'sm')}<div class="grow"><b>第 ${q.n} 題 · ${esc(region(m.region).name)}</b><small>對方拿${esc(m.name)}出題</small></div>${v !== undefined || q.voted ? '<span class="pill brand">已投</span>' : ''}</div>
    <p class="stem" style="font-size:18px;margin:4px 0 10px"><span class="mx">${esc(q.stem)}</span></p>
    <div class="stack">${q.candidates.map((c, i) => `<button class="cand ${v === i ? 'pick' : ''}" data-vote="${q.n}:${i}" ${q.voted ? 'disabled' : ''}><span class="mx">${esc(c.t)}</span><span class="v">${c.v + (v === i ? 1 : 0)} 票</span></button>`).join('')}</div>
    <div class="fixed">${['同意', '我算出不同', '我不確定這一步'].map((t) => `<button class="chip ghost" data-say="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`; }).join('')}
  <p class="note">隊內只有候選答案和三句固定句，沒有文字框，也不列誰還沒看。全員看過或時間到，就自動交出票數最多的答案。</p>
  <div class="sect"><h3>我們出的三題</h3><span class="meta">${esc(d.ours.status)}</span></div>
  <div class="card"><p class="meta" style="margin-bottom:8px">只能拿雙方都遠征過的怪出題。</p><div class="monpick">${d.ours.picked.map((id) => { const m = mon(id); return `<button class="on">${monSvg(m, 'shadow')}<span>${esc(m.name)}</span></button>`; }).join('')}</div></div>
  <div class="sect"><h3>六分制</h3></div>
  <div class="score6"><div><b class="num">3</b>答題分 · 隊伍的答案答對一題得一分</div><div><b class="num">3</b>出題分 · 對方答錯且確實在考那隻怪</div></div>
  <p class="note">平手記平手。贏的隊伍在對戰報告上多一行「勝」，沒有積分榜、沒有連勝紀錄。好題印記不計分，所以不會被兩隊互按。</p>
  <div class="sect"><h3>本季對戰</h3></div>
  <div class="card">${d.history.map((h) => `<div class="kv"><span>第 ${h.week} 週 · ${esc(h.label)}</span><b>${esc(h.result)}</b></div>`).join('')}<div class="kv"><span>第 3 週 · ${esc(d.opponent)}</span><b>出題戰進行中</b></div></div>`;
};

SCREENS.map = () => {
  const R = D.REGIONS;
  const cls = (r) => r.light === 'fog' ? '' : (r.keeper === 'us' ? 't-us' : (r.keeper === 'other' ? 't-other' : (r.light === 'lit' ? 't-lit' : 't-none')));
  return `
  ${hd('世界地圖', `${esc(D.SQUAD.league)} · 數理大陸`, false)}
  <div class="leagues">${['北區', '中區', '南區', '東區'].map((l) => `<button class="${l === D.SQUAD.league ? 'on' : ''}" ${l === D.SQUAD.league ? '' : 'disabled'}>${l}</button>`).join('')}</div>
  <div class="map"><svg viewBox="0 0 440 420" role="img" aria-label="數理大陸地圖：六個區域各一座燈塔">
    <path class="wave" d="M30 30q12-7 24 0t24 0M380 60q12-7 24 0t24 0M60 390q12-7 24 0t24 0M360 380q12-7 24 0t24 0"/>
    <path class="land" d="M70 120c30-60 120-90 190-70s110 60 150 120c30 45 20 110-20 150s-90 50-150 60-120-10-150-60S40 180 70 120z"/>
    <text class="cn" x="92" y="92">數理大陸</text><text class="cs" x="92" y="108">數學 · 六區</text>
    ${R.map((r) => r.light === 'fog'
      ? `<g class="hot" tabindex="0" role="button" aria-label="${esc(r.name)}，迷霧" data-region="${r.id}"><ellipse class="fogm" cx="${r.x}" cy="${r.y}" rx="52" ry="30"/><text class="fogq" x="${r.x}" y="${r.y + 5}">?</text><text class="rl fogt" x="${r.x}" y="${r.y + 52}">${esc(r.name)}</text></g>`
      : `<g class="hot" tabindex="0" role="button" aria-label="${esc(r.name)}燈塔" data-region="${r.id}"><circle class="ring" cx="${r.x}" cy="${r.y}" r="34"/><circle class="glow ${r.light === 'lit' ? 'on' : ''}" cx="${r.x}" cy="${r.y - 4}" r="26"/><use href="#tower" class="tw ${cls(r)}" x="${r.x - 11}" y="${r.y - 20}" width="22" height="30"/>${r.keeper === 'us' ? `<path class="flag" d="M${r.x + 10} ${r.y - 22}v-12l10 4-10 4"/>` : ''}<text class="rl" x="${r.x}" y="${r.y + 34}">${esc(r.name)}</text></g>`).join('')}
  </svg></div>
  <div class="maplegend"><span><i class="u"></i>我們守塔</span><span><i class="o"></i>其他小隊守塔</span><span><i class="l"></i>燈已點亮</span><span><i class="n"></i>燈未點亮</span><span><i class="f"></i>迷霧</span></div>
  <div class="regions">${R.map((r) => `<button class="region" data-region="${r.id}"><span class="tw ${r.light === 'fog' ? 'none' : (r.keeper === 'us' ? 'us' : (r.keeper === 'other' ? 'other' : (r.light === 'lit' ? 'lit' : 'none')))}">${towerSvg}</span><span><b>${esc(r.name)}</b><small>${r.light === 'fog' ? '迷霧 · 還沒偵察到這一區' : (r.light === 'lit' ? `已點亮 · ${r.keeper === 'us' ? '四葉小隊守著平原線這一層' : (r.keeper === 'other' ? '星期三小隊守著平原線這一層' : '尚無守塔隊')}` : `點燈進度 ${Math.round(r.progress[0] / r.progress[1] * 100)}%`)}</small></span><span class="pct">${r.light === 'fog' ? '' : `${r.progress[0].toLocaleString()} / ${r.progress[1].toLocaleString()}`}</span></button>`).join('')}</div>
  <p class="note" style="margin-top:14px">地圖是幻想的，聯賽的分區才用真實的地理：北、中、南、東，只到這四個字，不到縣市，更不到學校。</p>
  <div class="sect"><h3>其他大陸</h3><span class="meta">下一季開放</span></div>
  <div class="card flat"><div class="stack">${[['西風港', '英文 · 時光獸、失蹤的 s、介係詞迷路怪'], ['字林', '國文 · 音近字妖、之乎迷霧、修辭變臉怪'], ['時光古道', '社會 · 年代錯置怪、因果顛倒獸、經緯迷航']].map(([n, t]) => `<div class="row"><span class="mon sm fog"><svg><use href="#m-round"/></svg></span><div class="grow"><b style="font-size:14px">${n}</b><small>${t}</small></div></div>`).join('')}</div></div>`;
};

SCREENS.tower = (id) => {
  const r = region(id) || region('sqrt');
  const T = D.TOWER; const lit = r.light === 'lit';
  const mine = T.board.findIndex((b) => b.mine);
  const rows = T.board.map((b, i) => ({ ...b, i })).filter((b) => Math.abs(b.i - mine) <= 3);
  return `
  ${hd(`${esc(r.name)} · 燈塔`, `${esc(D.SQUAD.league)} · ${esc(D.SQUAD.subject)}`)}
  <div class="tower-hero">${lit ? '<div class="beam"></div>' : ''}<span class="tw" style="--tw-body:${r.keeper === 'us' ? 'var(--coral)' : (r.keeper === 'other' ? 'var(--sky)' : (lit ? 'var(--honey)' : 'var(--night-2)'))}">${towerSvg}</span><h2>${lit ? (r.keeper === 'us' ? '燈亮著，四葉小隊守著平原線這一層。' : (r.keeper === 'other' ? '燈亮著，星期三小隊守著平原線這一層。' : '燈亮著，還沒有守塔隊。')) : (r.light === 'fog' ? '迷霧還沒散。' : '燈還沒亮。')}</h2><p>${r.light === 'fog' ? '下週遠征偵察這一區。' : '點燈是全區合作，守塔是同路線爭奪。'}</p></div>
  <div class="card"><div class="kv" style="border:0;padding:0 0 6px"><span>點燈進度 · 全${esc(D.SQUAD.league)}</span><b>${r.progress[0].toLocaleString()} / ${r.progress[1].toLocaleString()}</b></div><div class="bar"><i class="${lit ? 'honey' : ''}" style="transform:scaleX(${Math.min(1, r.progress[0] / r.progress[1])})"></i></div><p class="note">${lit ? '已點亮。這一區的圖鑑對所有人開放。' : '同一區所有小隊的戰績加總，達到門檻就把燈點亮，迷霧對所有人散開。'}</p></div>
  ${lit && r.keeper ? `<div class="quote"><p>${esc(T.words)}</p><small>塔上的話 · ${esc(r.keeper === 'us' ? T.wordsBy : '星期三小隊')}</small></div>` : ''}
  ${lit ? `<div class="sect"><h3>本月爭奪 · 平原線層</h3><span class="meta">到 ${esc(T.until)}</span></div>
  <div class="rank">${rows.map((b) => `<div class="${b.mine ? 'mine' : ''} ${Math.abs(b.i - mine) === 3 ? 'dim' : ''}"><span class="p ${b.dir || ''}">${b.dir === 'up' ? '↑' : (b.dir === 'down' ? '↓' : '·')}</span>${av(b.av)}<span>${esc(b.name)}</span><b class="num">${b.pts}</b></div>`).join('')}</div>
  <p class="note">只顯示你前後各三隊，不顯示名次，也不顯示總隊數。每月 1 日結算，不衰減、不用防守。</p>
  <div class="sect"><h3>歷代守塔隊</h3></div>
  <div class="card">${T.hall.map((h) => `<div class="kv"><span>${esc(h.month)} · ${esc(h.layer)}</span><b style="font-family:var(--font-sans)">${esc(h.name)}</b></div>`).join('')}<p class="note">上個月的隊名刻進名冊，永遠留著。被換掉的隊仍然刻在塔上。</p></div>` : ''}
  <div class="sect"><h3>這一區的怪</h3></div>
  <div class="mgrid">${D.MONSTERS.filter((m) => m.region === r.id).map((m) => { const s = S.shadows[m.id]; return `<button class="mcard ${s.state === 'fog' ? 'fogc' : ''}" data-lore="${m.id}">${monSvg(m, stateCls[s.state])}<span><b>${s.state === 'fog' && r.light !== 'lit' ? '？？？' : esc(m.name)}</b><small>${esc(D.STATE_LABEL[s.state])}</small></span></button>`; }).join('')}</div>`;
};

SCREENS.guild = () => {
  const G = D.GUILD;
  const posts = [...S.wallPosts.map((p) => ({ who: D.SQUAD.name, av: 1, text: p, when: '剛剛' })), ...G.wall];
  return `
  <div class="guild-hero"><span class="em">${SVG.guild}</span><div><h2>${esc(G.name)}</h2><small>公會長 ${esc(G.master)} · ${G.squads} 支小隊 · ${G.members} 人 · 跨季存在</small></div></div>
  <div class="race"><span class="medal">${badgeSvg(true)}</span><h3>${esc(G.race.month)}徽章公開賽 · ${esc(G.race.theme)}</h3><span class="when">${esc(G.race.when)}</span>
    <p><b>怎麼贏</b>：${esc(G.race.rule)}達到就贏，不是只有前幾名。</p><p><b>獎品</b>：${esc(G.race.prize)}</p>
    <div class="kv" style="border:0;margin-top:10px;padding-bottom:4px"><span>全服目標 · 所有參賽隊伍的收服加總</span><b>${G.race.server[0].toLocaleString()} / ${G.race.server[1].toLocaleString()}</b></div><div class="bar"><i class="honey" style="transform:scaleX(${G.race.server[0] / G.race.server[1]})"></i></div><p class="note">達到當月目標，全體達標者的徽章升級成金邊版。贏的是大家。</p>
    <div class="btns"><button class="btn ${S.raceSigned ? 'ghost' : 'honey'}" data-act="race">${S.raceSigned ? '已報名 · 家長已勾選由本人作答' : '替小隊報名（家長在 LINE 端確認）'}</button></div></div>
  <div class="sect"><h3>徽章冊</h3><span class="meta">一學年十枚</span></div>
  <div class="album">${G.album.map((a) => `<div class="${a.got ? 'got' : ''} ${a.now ? 'now' : ''}" title="${esc(a.theme || '')}">${badgeSvg(!!a.got)}<span>${esc(a.month)}</span></div>`).join('')}</div>
  <div class="sect"><h3>公會牆</h3><span class="meta">只放值得慶祝的事</span></div>
  <div class="card">${posts.map((p) => `<div class="wallpost">${p.av === 0 ? '<span class="av a0">林</span>' : av(p.av)}<div><b>${esc(p.who)}</b> <small>${esc(p.when)}</small><p>${esc(p.text)}</p>${p.voice ? `<span class="voice">${SVG.play.replace('<svg', '<svg style="width:14px;height:14px;fill:currentColor"')} 0:21</span>` : ''}</div></div>`).join('')}
    <p class="note">不放分數、不放勝負、不放誰還沒完成。</p></div>
  <div class="sect"><h3>戰績解鎖</h3><span class="meta">累積到門檻就解鎖，不用花掉</span></div>
  <div class="card"><div class="kv" style="border:0;padding-top:0"><span>小隊累積</span><b>${G.squadTotal}</b></div>
    ${G.unlocks.filter((u) => u.who === 'squad').map((u) => `<div class="unlock ${G.squadTotal >= u.at ? '' : 'pend'}"><span>${esc(u.name)}</span><span class="at">${G.squadTotal >= u.at ? '<span class="ok">已解鎖</span>' : `${G.squadTotal} / ${u.at}`}</span></div>`).join('')}
    <div class="divider"></div>
    <div class="kv" style="border:0"><span>公會人均</span><b>${G.perCapita} / ${G.perCapitaGoal}</b></div><div class="bar"><i style="transform:scaleX(${G.perCapita / G.perCapitaGoal})"></i></div>
    <div class="unlock pend" style="border:0"><span>魔王攻略會 · 段考前林老師加開 30 分鐘直播答疑</span><span class="at">還差 ${G.perCapitaGoal - G.perCapita}</span></div>
    <p class="note">實體徽章不能用戰績換，只能在公開賽拿到。最好的獎品是有人願意為你們多花時間。</p></div>
  <div class="sect"><h3>隊伍牆</h3><span class="meta">季末合照框 236 / 300</span></div>
  <div class="card flat"><div class="row"><div class="avs">${av(1)}${av(2)}${av(3)}${av(4)}${av(5)}</div><div class="grow"><b>${esc(D.SQUAD.name)}</b><small>隊旗徽記 1 · 好題印記 0 · 本季對戰 1</small></div></div></div>`;
};

SCREENS.capture = (id) => {
  const m = mon(id) || mon('sqrt-split');
  return `<div class="capture p1" id="cap"><div class="sky"></div><div class="stars"></div><div class="confetti" id="confetti"></div>
    <div class="top"><span class="eyebrow">收服 · 第 ${D.SQUAD.week} 週</span><h2 id="cap-title">${esc(m.name)}……</h2></div>
    <div class="arena"><span class="kid">${kid}</span>${monSvg(m, 'xl')}</div>
    <div><p class="line" id="cap-line">「${esc(m.taunt)}」</p><p class="ev" id="cap-ev" style="opacity:0"><b>${esc(m.weakness)}</b><br>第 0 天 在遠征中被打倒 · 第 9 天 不給提示也會</p>
    <div class="btns"><button class="btn honey" data-share="${m.id}">傳到營地（家人 LINE）</button><div class="btns two" style="margin-top:0"><button class="btn ghost" data-act="wall-post">放上隊伍牆</button><button class="btn ghost" data-go="shadows">先收著</button></div></div></div></div>`;
};

SCREENS.share = (id) => {
  const m = mon(id) || mon('sqrt-split');
  return `
  ${hd('分享卡', '直式 4:5 · 沒有臉、真名、分數、隊友狀態')}
  <div class="share"><span class="corner"></span><div class="top"><span>收服 · 第 ${D.SQUAD.week} 週</span><svg class="logo" viewBox="0 0 64 40" aria-hidden="true"><use href="#logo"/></svg></div>
    <div class="mid">${monSvg(m, 'shadow')}<h3>${esc(m.name)}，收服。</h3><span class="team">${esc(D.SQUAD.name)} · ${esc(D.SQUAD.me.nick)}</span></div>
    <p class="ev"><b>${esc(m.weakness)}</b><br>第 0 天 在遠征中被打倒 · 第 9 天 不給提示也會<br>嚮導 ${esc(D.SQUAD.guide)} · ${esc(D.SQUAD.examLabel)}</p></div>
  <div class="btns"><button class="btn" data-go="camp">傳到營地 · 看家長收到什麼</button><button class="btn ghost" data-go="shadows">回到影子牆</button></div>
  <p class="note">只分享收服，卡住的永遠不出現在卡上。孩子自己按，沒有自動。</p>`;
};

SCREENS.camp = () => `
  ${hd('營地來信', '家長端 · LINE · 不裝 App')}
  <div class="line-top"><span class="ic">T</span>Tandelo 營地</div>
  <div class="line-body">
    <div class="bub"><b>營地來信 · ${esc(D.CAMP.time)}</b><br>${esc(D.CAMP.text)}<span class="q">${esc(D.CAMP.ask)}</span>
      <div class="acts"><button class="${S.witnessed ? 'on' : ''}" data-act="witness">${S.witnessed ? '已見證' : '我見證了'}</button><button>晚點問他</button></div><span class="t">已讀 21:05</span></div>
    <div class="bub me">好，晚上問他。<span class="t">21:06</span></div>
    ${S.wallPosts.length ? `<div class="bub"><b>營地來信 · 剛剛</b><br>小睿的小隊這週副本過關了：解題率 80%，兩星。下一個副本走丘陵線。<span class="t">剛剛</span></div>` : ''}
  </div>
  <p class="note">家長端內容三件事不變：他學會了什麼、下週做什麼、今晚可以問他一句。只多一個「我見證了」。隔天孩子的首頁會出現「媽媽見證了這一次」。</p>
  <div class="btns"><button class="btn ghost" data-go="home">回到孩子的畫面</button></div>`;

let chat = [];
SCREENS.coach = () => `
  ${hd('小陪', '隨行系統 · 第一句永遠是「你寫到哪一步？」')}
  <div class="chat">${chat.length ? chat.map((c) => `<div class="msg ${c.by}">${c.lvl ? `<span class="lvl">${esc(c.lvl)}</span>` : ''}${esc(c.text)}</div>`).join('') : `<div class="msg c"><span class="lvl">小陪 · 問</span>你寫到哪一步？</div>`}</div>
  <div class="chat-in"><div class="chips">${['我把括號拆開了', '我卡在合併', '我不知道從哪開始', '我算出 2x − 3'].map((t) => `<button class="chip" data-say-coach="${esc(t)}">${esc(t)}</button>`).join('')}</div>
  <p class="note">沒有文字框。小陪只問、指、借、示範一步，不給整題答案。22:30 之後只回「關燈中」。</p></div>`;

SCREENS.settings = () => `
  ${hd('示範設定', '時間、深淺色、個人榜、對戰投票')}
  <div class="card"><h3>示範時間</h3><div class="chips">${D.CLOCKS.map((c) => `<button class="chip ${S.clock === c.id ? 'on' : ''}" data-clock="${c.id}">${esc(c.label)}</button>`).join('')}</div><p class="note">${esc(clock().note)}</p></div>
  <div class="card">
    <div class="setrow"><span>深色模式<small>22:30 後自動轉暗</small></span><button class="switch ${document.documentElement.getAttribute('data-theme') === 'dark' ? 'on' : ''}" data-act="theme" role="switch" aria-label="深色模式"></button></div>
    <div class="setrow"><span>上個人拓荒榜<small>預設關。開了只有稱號和隊名，別人看不到百分位。</small></span><button class="switch ${S.personalBoard ? 'on' : ''}" data-act="pboard" role="switch" aria-label="個人拓荒榜"></button></div>
    <div class="setrow"><span>本季真人對戰<small>匿名投票，全隊同意才打；否則打幽靈隊，沒有人知道是誰投的。</small></span><button class="switch ${S.pvp ? 'on' : ''}" data-act="pvp" role="switch" aria-label="真人對戰"></button></div>
  </div>
  <div class="card flat"><h3>隱私與安全</h3><p class="meta">隊友畫面不出現名字。分享卡、公會牆、燈塔上只有隊名與頭像色塊。地圖是幻想的，聯賽區只到北中南東。</p></div>
  <div class="btns"><button class="btn warn" data-act="reset">重設示範資料</button></div>`;

// ---------- 路由與渲染 ----------
const TABS = [['home', '今天', '<path d="M4 11.5 12 5l8 6.5V20h-5v-5H9v5H4z"/>'], ['shadows', '影子', '<circle cx="12" cy="9" r="5"/><path d="M5 21c1-4 3.5-6 7-6s6 2 7 6"/><path d="M8.5 9h.01M15.5 9h.01" stroke-width="2.6"/>'], ['dungeon', '副本', '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>'], ['map', '地圖', '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'], ['guild', '公會', '<path d="M12 3l8 3v6c0 4.5-3.5 7.5-8 9-4.5-1.5-8-4.5-8-9V6z"/><path d="M12 8v8M8.5 12h7"/>']];
const NOTABS = new Set(['capture', 'share', 'camp', 'coach', 'settings', 'letter', 'play', 'relay', 'ambush', 'wake', 'settle', 'record', 'tower']);
const DARK = new Set([]);
const view = $('#view'); const tabsEl = $('#tabs'); const sbEl = $('#sb'); const toastEl = $('#toast');
const trail = [];
let curKey = '';

function parse() { const p = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean); return { key: p[0] || 'home', param: p[1] || '' }; }
function go(path) { const h = `#/${path}`; if (location.hash === h) route(); else location.hash = h; }
function back() { if (trail.length > 1) { trail.pop(); const prev = trail.pop(); go(prev); } else go('home'); }

function route() {
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
  tabsEl.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.go === key));
  sbEl.innerHTML = `<span class="num">${esc(clock().time)}</span><span class="cap">今天 <b>${S.cards}</b> / 3</span>`;
  lightsOut(el, key);
  if (key === 'capture') runCapture(el, param);
  document.querySelectorAll('.panel .scenes button').forEach((b) => b.classList.toggle('on', b.dataset.go === key));
}
function rerender() { const { key, param } = parse(); const el = view.querySelector('.screen:not([class*="leave"])'); if (!el) return route(); const y = el.scrollTop; el.innerHTML = (SCREENS[key] || SCREENS.home)(param); el.scrollTop = y; sbEl.innerHTML = `<span class="num">${esc(clock().time)}</span><span class="cap">今天 <b>${S.cards}</b> / 3</span>`; lightsOut(el, key); }

function lightsOut(el, key) {
  const old = view.querySelector('.curtain'); if (old) old.remove();
  if (night() && !['settings', 'camp', 'map', 'guild', 'shadows', 'tower'].includes(key)) {
    const c = document.createElement('div'); c.className = 'curtain';
    c.innerHTML = `<div><div class="moon"></div><h2>關燈中</h2><p>22:30 到 06:00，任務卡不發、不亮、不推播。<br>今天亮了 ${S.cards} 張，明天見。</p><div class="btns" style="margin-top:20px"><button class="btn ghost" data-go="settings" style="background:var(--night-2);color:var(--on-night)">改示範時間</button></div></div>`;
    view.appendChild(c);
  }
}

let toastT;
function toast(t) { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2200); }
function addCard() { if (S.cards < 3) { S.cards += 1; buzz(16); } }
function addRecord(kind, label, pts) { S.records.push({ kind, label, pts, when: '今天' }); }

function runCapture(el, id) {
  const m = mon(id) || mon('sqrt-split');
  const cap = el.querySelector('#cap'); const line = el.querySelector('#cap-line'); const title = el.querySelector('#cap-title'); const ev = el.querySelector('#cap-ev');
  const t = reduced() ? 0 : 1;
  setTimeout(() => { line.textContent = `「${m.caught}」`; }, 900 * t);
  setTimeout(() => { cap.classList.remove('p1'); cap.classList.add('p2'); title.textContent = `${m.name}，收服。`; line.innerHTML = `<b>站到你身後了。</b>　${esc(m.weakness)}`; ev.style.opacity = 1; burst(el.querySelector('#confetti')); buzz([20, 40, 20]); }, 1700 * t);
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

// ---------- 事件 ----------
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go],[data-back],[data-act],[data-opt],[data-coach],[data-lore],[data-region],[data-vote],[data-say],[data-say-coach],[data-ropt],[data-aopt],[data-wopt],[data-flag],[data-share],[data-clock]');
  if (!t) return;
  if (t.dataset.back !== undefined) return back();
  if (t.dataset.go) { if (t.dataset.locked) return toast('伏擊層週一開放。可以在設定把示範時間快轉。'); return go(t.dataset.go); }
  if (t.dataset.share) return go(`share/${t.dataset.share}`);
  if (t.dataset.region) return go(`tower/${t.dataset.region}`);
  if (t.dataset.lore) return lore(t.dataset.lore);
  if (t.dataset.clock) { S.clock = t.dataset.clock; save(); rerender(); applyTheme(); return; }
  if (t.dataset.opt !== undefined) {
    const q = D.PATROL[S.patrol.i]; const i = Number(t.dataset.opt); play.picked = i; play.tried = i !== q.answer;
    if (i === q.answer) { buzz(10); } else { buzz([10, 30, 10]); }
    return rerender();
  }
  if (t.dataset.coach !== undefined) { if (play.lvl < 3) play.lvl += 1; else { play.picked = null; play.lvl = 0; } return rerender(); }
  if (t.dataset.ropt !== undefined) { play.rpick = Number(t.dataset.ropt); buzz(10); return rerender(); }
  if (t.dataset.aopt !== undefined) { play.apick = Number(t.dataset.aopt); return rerender(); }
  if (t.dataset.wopt !== undefined) { play.wpick = Number(t.dataset.wopt); return rerender(); }
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
  const a = t.dataset.act;
  if (a === 'letter') { S.letterPlayed = true; save(); const l = t; l.classList.add('playing'); setTimeout(() => go('letter'), 450); return; }
  if (a === 'cheer') { S.cheered = true; save(); toast('「大家加油」送給全隊了，不點名任何人'); return rerender(); }
  if (a === 'help') { S.helpAnswered = true; save(); addRecord('explain', '講解給隊友（匿名）', 0); toast('30 秒講解送出去了'); return rerender(); }
  if (a === 'sos') { toast('隊友收到匿名求援：「有一位隊友卡在負號幽靈」。30 分鐘沒人回就播嚮導的 30 秒。'); return; }
  if (a === 'next') {
    const q = D.PATROL[S.patrol.i];
    if (play.picked !== q.answer) return;
    S.patrol.done += 1; if (play.lvl) S.patrol.helped += 1;
    if (S.patrol.i < D.PATROL.length - 1) { S.patrol.i += 1; play = { lvl: 0, picked: null, tried: false, rec: 0 }; save(); return rerender(); }
    S.patrol.finished = true; addCard(); save(); toast('巡邏 3 / 3 完成 · 今天第 ' + S.cards + ' 張'); return rerender();
  }
  if (a === 'relay-submit') { S.relay.done = true; addCard(); save(); buzz(20); toast('第 4 棒交出去了'); return rerender(); }
  if (a === 'ambush-submit') {
    const ok = play.apick === D.AMBUSH.answer; S.ambush.done = true; S.ambush.passed = ok; addCard();
    if (ok) { S.shadows['sqrt-split'] = { state: 'captured', day0: '10/03', dayN: '10/12', days: 9 }; addRecord('capture', '收服 拆根蟲', 10); save(); return go('capture/sqrt-split'); }
    S.shadows['sqrt-split'] = { state: 'near', note: '沒中，不扣分，回到清單' }; save(); return rerender();
  }
  if (a === 'wake-done') { S.wake.done = true; S.shadows['diff-sq'] = { state: 'captured', day0: '09/20', dayN: '10/11', days: 21 }; addRecord('wake', '叫醒 平方差雙子', 5); addCard(); save(); return go('capture/diff-sq'); }
  if (a === 'settle') { S.clock = 'tue'; S.settled = true; S.route = 'hills'; addRecord('dungeon2', '副本兩星（全隊一份）', 8); save(); applyTheme(); return go('settle'); }
  if (a === 'wall-post') { if (!S.wallPosts.length) S.wallPosts.push('這週副本過關了，兩星。下一個副本走丘陵線。'); save(); toast('放上隊伍牆了'); return go('guild'); }
  if (a === 'race') { S.raceSigned = !S.raceSigned; save(); toast(S.raceSigned ? '已送到家長的 LINE 確認' : '已取消報名'); return rerender(); }
  if (a === 'witness') { S.witnessed = !S.witnessed; save(); return rerender(); }
  if (a === 'theme') { const r = document.documentElement; const dark = r.getAttribute('data-theme') === 'dark'; r.setAttribute('data-theme', dark ? 'light' : 'dark'); S.theme = dark ? 'light' : 'dark'; save(); return rerender(); }
  if (a === 'pboard') { S.personalBoard = !S.personalBoard; save(); toast(S.personalBoard ? '13 歲以下需家長在 LINE 端同意' : '已關閉'); return rerender(); }
  if (a === 'pvp') { S.pvp = !S.pvp; save(); toast(S.pvp ? '你投了同意。只要有一票不同意，本季打幽靈隊。' : '你投了不同意。沒有人知道是誰投的。'); return rerender(); }
  if (a === 'reset') { if (confirm('重設所有示範資料？')) reset(); return; }
});
document.addEventListener('pointerdown', (e) => { const m = e.target.closest('[data-act="rec"]'); if (m) { e.preventDefault(); recStart(); } });
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => document.addEventListener(ev, (e) => { if (recTimer && !e.target.closest('[data-act="rec"]')) recStop(); else if (recTimer && ev !== 'pointerleave') recStop(); }));
document.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.map .hot')) { e.preventDefault(); e.target.click(); } });

function lore(id) {
  const m = mon(id); const s = S.shadows[id];
  if (s.state === 'fog' && region(m.region).light !== 'lit') return toast('迷霧還沒散。遠征偵察到這一區，或等全區點燈。');
  const bg = document.createElement('div'); bg.className = 'sheet-bg'; const sh = document.createElement('div'); sh.className = 'sheet';
  sh.innerHTML = `<div class="grip"></div><div class="lore">${monSvg(m, stateCls[s.state] + ' bob')}<div><h3>${esc(m.name)}</h3><span class="where">${esc(region(m.region).name)} · ${esc(D.STATE_LABEL[s.state])}${s.days ? ` · 第 ${s.days} 天` : ''}</span></div></div>
    ${[['出身', m.origin], ['騙術', m.trick], ['口頭禪', `「${m.taunt}」`], ['弱點', m.weakness], ['被識破時', `「${m.caught}」`]].map(([k, v]) => `<div class="lore-row"><span class="k">${k}</span><span>${esc(v)}</span></div>`).join('')}
    <p class="note">五個欄位都是教學：出身是誤解的成因，騙術是誤解本身，口頭禪是錯的推理說出口，弱點是正確概念，被識破時是回饋。由學科老師寫，AI 只幫忙潤稿。</p>
    ${s.state === 'captured' ? `<div class="btns"><button class="btn honey" data-share="${m.id}">做一張分享卡</button></div>` : (s.state === 'asleep' ? `<div class="btns"><button class="btn" data-go="wake">今天叫醒牠</button></div>` : '')}`;
  const shell = $('.shell'); shell.appendChild(bg); shell.appendChild(sh);
  requestAnimationFrame(() => { bg.classList.add('on'); sh.classList.add('on'); });
  const close = () => { bg.classList.remove('on'); sh.classList.remove('on'); setTimeout(() => { bg.remove(); sh.remove(); }, 420); };
  bg.addEventListener('click', close); sh.addEventListener('click', (e) => { if (e.target.closest('[data-share],[data-go]')) close(); });
}

// ---------- 主題與啟動 ----------
function applyTheme() {
  const r = document.documentElement;
  if (S.theme) r.setAttribute('data-theme', S.theme);
  else if (night()) r.setAttribute('data-theme', 'dark');
  else r.removeAttribute('data-theme');
}
tabsEl.innerHTML = TABS.map(([k, n, p]) => `<button data-go="${k}" aria-label="${n}"><svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>${n}</button>`).join('');
$('#panel-scenes')?.querySelectorAll('button[data-go]').forEach(() => {});
window.addEventListener('hashchange', route);
applyTheme();
route();
