// 學生：小隊課教室（模擬 50 分鐘六段，可快轉）
// 768px 以上是寬版：白板在左、老師與隊友在右、六段節拍與我的控制在底部。
// 手機預設請換裝置；按「我只有手機」可用直式單欄的最低可用模式。

import { esc, icon, m, mt, avatar, duo, backBar } from '../ui.js';
import { SKILLS, SEGMENTS, TEACHER, prepCandidates } from '../content.js';
import { evaluateExplanation } from '../coach.js';
import { daysBetween } from '../state.js';
import { lessonInfo } from './student.js';
import { boardHtml } from '../whiteboard.js';
import { recorderHtml, ticks } from '../recorder.js';
import { setTicks, reduced } from '../fx.js';

const START = SEGMENTS.reduce((acc, s, i) => { acc.push(i ? acc[i - 1] + SEGMENTS[i - 1].min : 0); return acc; }, []);
const TOTAL = SEGMENTS.reduce((a, s) => a + s.min, 0);
const T_AV = { name: '林', color: 3 };

let ui = null;
/** 帶著一次性的動態標記重畫：只有這一次重畫會播（之後的重畫直接到位，不重播） */
function draw(ctx, fxName, opts) { ui.fx = fxName; ctx.rerender(opts); ui.fx = null; }
function fresh(week) {
  return {
    week, seg: 0, min: 0, warm: null, tries: [null, null], teachText: '', teachRes: null, got: '', gotPosted: false, finished: false,
    timer: null, groups: null, phone: false, mic: true, cam: false, hand: false, hint: false,
    speaker: null, spkTick: 0, spkTimer: null, heard: null, dots: {}, fx: null, wallT: null, metoo: false,
  };
}

// 教室是平板／桌機優先：寬度 768px 以上才是完整教室
const WIDE_MQ = '(min-width: 768px)';
export function isWide() { return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(WIDE_MQ).matches; }

/** 這週要解的 3 題：老師課前一頁確認過就照她排的，否則照卡點人數自動排前三 */
function weekProblems(state, sq, L) {
  const cands = prepCandidates(sq.members, state.student.questions || []);
  const prep = state.teacher.prep;
  if (prep && prep.week === L.week && prep.confirmed) {
    const picked = prep.picks.map((id) => cands.find((c) => c.id === id)).filter(Boolean);
    if (picked.length) return picked.slice(0, 3);
  }
  return cands.slice(0, 3);
}

function isMath(s) { return !/[一-鿿]/.test(s); }
function fx(s) { return isMath(s) ? m(s) : mt(s); }
function clockText(min) { return `${String(min).padStart(2, '0')}:00 / ${TOTAL}:00`; }
function segKey() { return SEGMENTS[ui.seg].key; }
function missedTry(sk) { return ui.tries.some((t, i) => t !== null && t !== sk.practice[i].ok) || ui.tries.includes(null); }

// ——— 白板上印的字（筆跡寫在它上面） ———
function boardText(L) {
  const sk = SKILLS[L.skill];
  const k = segKey();
  if (k === 'warm') return `<p class="wb-q">${fx(sk.warm.q)}</p>`;
  if (k === 'common') return `<p class="wb-l wrong">${fx(sk.board.wrong)}</p><p class="wb-l right">${fx(sk.board.right)}</p><p class="wb-note">${mt(sk.board.note)}</p>`;
  if (k === 'try') return `<ol class="wb-ol">${sk.practice.map((p) => `<li>${fx(p.q)}</li>`).join('')}</ol>`;
  if (k === 'again') {
    return missedTry(sk)
      ? `<ol class="wb-ol steps">${sk.coach.steps.map((s) => `<li>${mt(s.demo)}</li>`).join('')}</ol>`
      : `<p class="wb-q s">${mt(sk.board.note)}</p><p class="wb-note">用你自己的例子說說看。</p>`;
  }
  if (k === 'teach') return `<p class="wb-q s">${mt(sk.explain.prompt)}</p>`;
  return '<p class="wb-q s">今天哪一格翻過去了？</p>';
}
function boardTag() {
  const k = segKey();
  if (k === 'try') return '我的那一頁 · 只有你和老師看得到';
  if (k === 'teach') return ui.speaker && ui.speaker !== 'me' ? '講者的那一頁' : '我的那一頁';
  return '共用白板';
}

// ——— 這一段要你做的事（白板下方） ———
function segAct(ctx, L, sq) {
  const sk = SKILLS[L.skill];
  const mates = sq.members.filter((x) => !x.isMe);
  const buddy = mates[0];
  const k = segKey();
  const tq = `<div class="tbub">${avatar(T_AV, 's')}<p>`;
  if (k === 'warm') {
    const w = sk.warm;
    const picks = mates.map((mm, i) => (i === 2 ? (w.ok + 1) % w.opts.length : w.ok));
    return `${tq}暖身一題，憑直覺選，不用算。也可以在白板上畫畫看。</p></div>
      <div class="opts two">${w.opts.map((o, i) => `<button class="opt ${ui.warm === i ? 'sel' : ''}" data-act="warm" data-i="${i}" ${ui.warm !== null ? 'disabled' : ''}>${fx(o)}
        ${ui.warm !== null ? `<span class="who">${mates.filter((_, j) => picks[j] === i).map((mm) => avatar(mm, 'xs')).join('')}</span>` : ''}</button>`).join('')}</div>
      ${ui.warm !== null ? `<p class="fine left">${ui.warm === w.ok ? '你跟大部分人選的一樣。' : '有人跟你選的一樣。'}等一下老師會說為什麼。</p>` : ''}`;
  }
  if (k === 'common') {
    const n = sq.members.filter((x) => (x.stuck || []).includes(L.skill)).length;
    return `${tq}這一題，你們 ${sq.members.length} 個人裡有 ${n} 個上週這樣寫。我們看它卡在哪一步。</p></div>
      <div class="btnrow"><button class="btn s ghost" data-act="metoo" aria-pressed="${!!ui.metoo}">${icon(ui.metoo ? 'check' : 'hand')}${ui.metoo ? '已經跟老師說了（匿名）' : '我也卡這裡'}</button></div>
      <p class="fine left">重點回放只錄白板和老師講解，不錄你們的畫面和聲音。</p>`;
  }
  if (k === 'try') {
    return `${tq}自己試試兩題，可以先在白板上算。錯了沒關係，我等一下再帶一次。</p></div>
      <div class="try2">${sk.practice.map((p, pi) => `<div class="card tight">
        <b>${pi + 1}. ${fx(p.q)}</b>
        <div class="opts row3">${p.opts.map((o, i) => {
    const picked = ui.tries[pi];
    const cls = picked === null ? '' : i === p.ok && picked === i ? 'right' : picked === i ? 'sel miss' : '';
    return `<button class="opt ${cls}" data-act="try" data-p="${pi}" data-i="${i}" ${picked !== null ? 'disabled' : ''}>${fx(o)}</button>`;
  }).join('')}</div>
        ${ui.tries[pi] !== null ? `<small class="fine left">${ui.tries[pi] === p.ok ? '對了。' : '記下來了，下一段老師會再帶一次。'}</small>` : ''}
      </div>`).join('')}</div>`;
  }
  if (k === 'again') {
    return missedTry(sk)
      ? `${tq}${esc(ctx.state.student.name)}，這一步我們換一個例子再走一次。白板上三行，跟著我寫。</p></div>
        <p class="fine left">另一邊的隊友在做挑戰題。5 分鐘後大家回來。</p>`
      : `${tq}你兩題都對了。想一想：為什麼大家常在這一步錯？等一下講給隊友聽。</p></div>
        <p class="fine left">另一邊的隊友跟老師再走一次。5 分鐘後大家回來。</p>`;
  }
  if (k === 'teach') {
    const r = ui.teachRes;
    if (!ui.speaker) {
      return `${tq}輪流講給隊友聽，每個人 90 秒。誰先？</p></div>
        <div class="btnrow"><button class="btn" data-act="myTurn">${icon('mic')}換我講</button></div>
        <p class="fine left">這一段不錄。講錯也沒關係，講到卡住可以交給隊友接。</p>`;
    }
    if (ui.speaker === 'me') {
      return `<div class="card tight">
          ${recorderHtml({ id: 'teachRec', target: 'teachIn', sample: sk.explain.sample, secs: 90, micIcon: icon('mic'), hint: '按住說，或直接打字' })}
          <label class="sr" for="teachIn">講給隊友聽</label>
          <textarea class="input ta" id="teachIn" rows="3" maxlength="240" placeholder="用你自己的話講。" data-input="teachType">${esc(ui.teachText)}</textarea>
          <div class="btnrow"><button class="btn s" data-act="teachDone">講完了</button><button class="btn ghost s" data-act="passOn">我卡在這，交給隊友</button></div>
        </div>
        ${r ? `<div class="bub coach">${mt(r.feedback)}</div>
          <div class="tbub mate">${avatar(buddy, 's')}<p>${r.pass ? `喔～所以是「${esc(r.hits[0])}」。我懂了。` : '我有點懂，可是還不太確定為什麼。'}</p></div>
          <div class="btnrow"><button class="btn s" data-act="nextSpeaker">換下一位：${esc(buddy.name)}${icon('arrow')}</button></div>` : ''}`;
    }
    const sp = sq.members.find((x) => x.id === ui.speaker) || buddy;
    return `<div class="tbub mate">${avatar(sp, 's')}<p>「${esc(sk.explain.sample.split('。')[0])}。」</p></div>
      <div class="btnrow listen2">
        <button class="btn s" data-act="heard" data-v="ok" aria-pressed="${ui.heard === 'ok'}">${icon('check')}我聽懂了</button>
        <button class="btn s ghost" data-act="heard" data-v="again" aria-pressed="${ui.heard === 'again'}">這一步再講一次</button>
      </div>
      ${ui.heard ? `<p class="fine left">${ui.heard === 'ok' ? `${esc(sp.name)}得到一個松綠小點。` : `${esc(sp.name)}只會看到白板上被標出的那一步，看不到是誰按的。`}</p>` : ''}`;
  }
  // got：每人一句，依序浮現
  const labels = sk.explain.concepts.map((c) => c.label);
  if (ui.gotPosted) {
    const lines = sq.members.map((mm, i) => ({ mm, text: mm.isMe ? (ui.got || '（沒有寫）') : labels[(i + 1) % labels.length] }));
    return `<ul class="wall" aria-label="大家今天搞懂的">${lines.map((l, i) => `<li class="wall-c ${l.mm.isMe ? 'me' : ''}" style="--i:${i}">${avatar(l.mm, 's')}<div><small>${l.mm.isMe ? '你' : esc(l.mm.name)}</small><b>${mt(l.text)}</b></div></li>`).join('')}</ul>
      <div class="btnrow"><button class="btn ghost s" data-act="gotEdit">${icon('pencil')}改一下我的</button></div>`;
  }
  return `${tq}最後一句：今天你搞懂的是什麼？一句就好。</p></div>
    <div class="chips">${labels.map((l) => `<button class="chipbtn" data-act="gotPick" data-v="${esc(l)}" aria-pressed="${ui.got === l}">${mt(l)}</button>`).join('')}</div>
    <div class="qrow"><label class="sr" for="gotIn">或自己寫一句</label><input class="input" id="gotIn" maxlength="40" value="${esc(ui.got)}" data-input="gotType" autocomplete="off" placeholder="或自己寫一句"><button class="btn s" data-act="gotPost">貼到牆上</button></div>`;
}

// ——— 講給隊友聽：講者聚光＋ 90 秒計時環（示範加速） ———
function speakerStage(sq, state) {
  if (segKey() !== 'teach' || !ui.speaker) return '';
  const sp = ui.speaker === 'me' ? sq.members.find((x) => x.isMe) : sq.members.find((x) => x.id === ui.speaker);
  const left = Math.max(0, 90 - ui.spkTick * 3);
  return `<div class="spk" aria-live="polite">
    <div class="spk-ring" id="spkRing">${ticks(30)}<span class="spk-av">${avatar(sp, 'l')}</span></div>
    <div class="spk-b"><b>${ui.speaker === 'me' ? '你正在講' : `${esc(sp.name)}正在講`}</b>
      <small id="spkLeft">${left > 0 ? `90 秒 · 剩 ${left} 秒` : '講完這一句就好'}</small></div>
    <span class="pill">一次一個人講</span>
  </div>`;
}

function coachLine(sk) {
  const k = segKey();
  let text = '我在旁邊。需要再叫我。'; let mode = 'idle'; let extra = '';
  if (k === 'try') {
    if (ui.hint) { text = `我只示範一步：${sk.coach.steps[0].demo}。換你做白板上那一題。`; mode = 'talk'; } else {
      text = '我在聽。卡住的話，可以要一點提示。'; mode = 'listen';
      extra = '<button class="btn ghost s" data-act="askHint">要一點提示</button>';
    }
  } else if (k === 'teach') { text = '這一段不錄。放心講。'; } else if (k === 'got' && ui.gotPosted) { text = '今天每個人都有一格往前。'; mode = 'joy'; }
  return `<div class="cls-coach coach">${duo(mode, 's')}<div><div class="coach-m" data-type="cls-coach">${mt(text)}</div>${extra}</div></div>`;
}

function tile(mm, state, i) {
  const k = segKey();
  const cls = [
    'tile', mm.isMe ? 'me' : '',
    k === 'warm' && ui.warm !== null ? 'ready' : '',
    mm.isMe && ui.hand ? 'hand' : '',
    ui.speaker && ((ui.speaker === 'me' && mm.isMe) || ui.speaker === mm.id) ? 'speaking' : '',
    k === 'teach' && ui.speaker && !((ui.speaker === 'me' && mm.isMe) || ui.speaker === mm.id) ? 'dim' : '',
  ].join(' ');
  const dots = ui.dots[mm.isMe ? 'me' : mm.id] || 0;
  return `<li class="${cls}" style="--i:${i}">
    <span class="tile-av">${avatar(mm, 'm')}<i class="tile-ok" aria-hidden="true">${icon('check')}</i></span>
    <b>${mm.isMe ? '你' : esc(mm.name)}</b>
    ${dots ? `<span class="tile-dots" aria-label="${dots} 個松綠小點">${'<i></i>'.repeat(Math.min(3, dots))}</span>` : ''}
    ${mm.isMe && ui.hand ? '<span class="sr">舉手中</span>' : ''}
  </li>`;
}

function sidePanel(ctx, L, sq, problems) {
  const { state } = ctx;
  const sk = SKILLS[L.skill];
  let grid;
  if (ui.groups) {
    const col = (g) => sq.members.filter((mm) => ui.groups[mm.id] === g).map((mm, i) => tile(mm, state, i)).join('');
    grid = `<div class="tiles split"><ul class="tcol a" aria-label="跟老師再走一次">${col('A')}<li class="tcap">跟老師再走一次</li></ul><ul class="tcol b" aria-label="先做挑戰題">${col('B')}<li class="tcap">先做挑戰題</li></ul></div>`;
  } else grid = `<ul class="tiles">${sq.members.map((mm, i) => tile(mm, state, i)).join('')}</ul>`;
  return `<aside class="cls-side" aria-label="老師與隊友">
    <div class="tvid"><span class="tvid-duo">${duo(segKey() === 'common' || segKey() === 'again' ? 'talk' : 'idle', 'l')}</span><span class="tvid-n">${esc(TEACHER.name)}<small>${ui.cam ? '' : '沒開鏡頭也可以'}</small></span></div>
    ${grid}
    ${coachLine(sk)}
    <details class="cls-three"><summary><b>這週要解的 3 題</b></summary><ol>${problems.map((p) => `<li class="${p.skill === L.skill ? 'on' : ''}">${fx(p.text)}<small>${esc(p.source)}</small></li>`).join('')}</ol></details>
  </aside>`;
}

function segsBar() {
  return `<ol class="segs beat" id="clsSegs" aria-label="這堂課的六段">${SEGMENTS.map((s, i) => `<li class="${i < ui.seg ? 'past' : i === ui.seg ? 'on' : ''}" ${i === ui.seg ? 'aria-current="step"' : ''}><b>${s.name}</b><small class="num">${s.min} 分</small></li>`).join('')}</ol>`;
}
function myControls(phone = false) {
  const last = ui.seg === SEGMENTS.length - 1;
  return `<div class="cls-my" role="group" aria-label="我的控制">
      <button class="cbtn mic" data-act="toggleMic" aria-pressed="${ui.mic}" aria-label="${ui.mic ? '麥克風開著，點一下關掉' : '麥克風關著，點一下打開'}">${icon(ui.mic ? 'mic' : 'micoff')}</button>
      <button class="cbtn" data-act="toggleCam" aria-pressed="${ui.cam}" aria-label="${ui.cam ? '鏡頭開著，點一下關掉' : '鏡頭關著，點一下打開（不開也可以）'}">${icon(ui.cam ? 'video' : 'camoff')}</button>
      <button class="cbtn" data-act="toggleHand" aria-pressed="${ui.hand}" aria-label="${ui.hand ? '放下手' : '舉手'}">${icon('hand')}</button>
    </div>
    <div class="cls-demo"><span class="lbl">示範快轉</span><button class="btn s" id="clsNext" data-act="nextSeg" ${phone && !last ? `aria-label="下一段：${SEGMENTS[ui.seg + 1].name}"` : ''}>${last ? '下課' : phone ? '下一段' : `下一段：${SEGMENTS[ui.seg + 1].name}`}${icon('forward')}</button></div>`;
}

function topBar(L, state, phone) {
  const days = daysBetween(state.clock.date, state.student.examDate);
  const paused = segKey() === 'teach';
  return `<header class="cls-top">
    <button class="iconbtn" data-act="leave" aria-label="離開教室">${icon('x')}</button>
    <span class="cls-title"><b>第 ${L.week} 堂 · ${esc(SKILLS[L.skill].short)}</b>${phone ? '' : `<small>${days >= 0 ? `離段考 ${days} 天` : ''}</small>`}</span>
    <button class="rec-tag ${paused ? 'paused' : ''}" data-act="recInfo"><i aria-hidden="true"></i>${paused ? '錄製已暫停' : '只錄白板'}</button>
    ${phone ? '' : '<span class="net" title="連線良好"><i aria-hidden="true"></i><span class="sr">連線良好</span></span>'}
    <span class="num cls-clock" id="clsClock">${clockText(ui.min)}</span>
  </header>`;
}

function phoneNotice(L) {
  const url = typeof location !== 'undefined' ? location.href : '';
  return `<div class="pad pb">
    <div class="abar"><button class="iconbtn" data-act="leave" aria-label="離開教室">${icon('x')}</button><span class="abar-t">第 ${L.week} 堂 · ${esc(SKILLS[L.skill].short)}</span></div>
    <div class="center-col tight">${deviceArt()}</div>
    <h1 class="hero s center" tabindex="-1">請用 iPad 或電腦開教室。</h1>
    <p class="sub center">小隊課的白板和隊友需要大一點的畫面。把這個連結貼到 iPad 或電腦的瀏覽器，就會進到同一堂課。</p>
    <div class="card tight"><b>教室連結</b><p class="body num cls-link" id="clsLink">${esc(url)}</p></div>
    <p class="fine center">用紙也可以：在紙上算，再拍上來。</p>
    <div class="dock"><button class="btn block" data-act="copyLink">${icon('copy')}複製連結</button><button class="btn ghost block" data-act="usePhone">${icon('phone')}我只有手機，用這支上課</button></div>
  </div>`;
}
// 插圖：一台平板上有兩個重疊的圓（幾何、平面、品牌色）
function deviceArt() {
  return `<svg class="art" viewBox="0 0 220 132" width="220" height="132" role="img" aria-label="一台橫放的平板">
    <rect x="18" y="10" width="184" height="112" rx="16" fill="var(--card)" stroke="var(--line)" stroke-width="2"/>
    <rect x="30" y="22" width="112" height="88" rx="10" fill="var(--mint)"/>
    <circle cx="74" cy="66" r="20" fill="#F26B54"/><circle cx="98" cy="66" r="20" fill="#0E5F52" opacity=".88"/>
    <circle cx="164" cy="38" r="9" fill="#F9D3C9"/><circle cx="186" cy="38" r="9" fill="#FBE7B2"/><circle cx="164" cy="62" r="9" fill="#C9DDF8"/><circle cx="186" cy="62" r="9" fill="#DDD2F6"/>
    <rect x="154" y="84" width="42" height="8" rx="4" fill="var(--chip)"/><rect x="154" y="98" width="28" height="8" rx="4" fill="var(--chip)"/>
  </svg>`;
}

function stopSpeaker() { if (ui && ui.spkTimer) { clearInterval(ui.spkTimer); ui.spkTimer = null; } }
function startSpeaker(who) {
  stopSpeaker();
  ui.speaker = who; ui.spkTick = 0; ui.heard = null;
  ui.spkTimer = setInterval(() => {
    if (ui.spkTick < 30) ui.spkTick += 1;
    const ring = document.querySelector('#spkRing .ticks');
    setTicks(ring, ui.spkTick, ui.spkTick > 25 ? 5 : 0);
    const l = document.getElementById('spkLeft');
    if (l) l.textContent = ui.spkTick < 30 ? `90 秒 · 剩 ${90 - ui.spkTick * 3} 秒` : '講完這一句就好';
    if (ui.spkTick >= 30) stopSpeaker();
  }, 320);
}

export const screens = {
  's/class': {
    tabs: false,
    guard(ctx) {
      const st = ctx.state.student;
      if (!st.joined) return ctx.state.squad ? 's/join' : 's/when';
      if (ctx.state.squad.status !== 'formed') return 's/joined';
      return null;
    },
    meta: { title: '小隊課教室', tips: ['六段：暖身 5 → 大家常錯的 10 → 自己試試 10 → 再帶一次 5 → 講給隊友聽 15 → 我搞懂的 5。', '時間會自己走（1 秒＝1 分鐘），也可以按「下一段」快轉。', '白板真的可以寫：滑鼠、手指、觸控筆都行。', '下課後會產生課堂紀錄，也會出現在家長的 LINE。'] },
    enter(ctx) {
      const L = lessonInfo(ctx.state);
      if (!ui || ui.week !== L.week || ui.finished) ui = fresh(L.week);
    },
    mount(ctx) {
      const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(WIDE_MQ) : null;
      const onChange = () => ctx.rerender({ top: true });
      if (mq && mq.addEventListener) mq.addEventListener('change', onChange);
      ui.timer = setInterval(() => {
        if (ui.finished) return;
        const end = START[ui.seg] + SEGMENTS[ui.seg].min;
        if (ui.min < end) ui.min += 1;
        const c = document.getElementById('clsClock'); if (c) c.textContent = clockText(ui.min);
        // 節拍：這一段快結束時呼吸加快；時間到了，「下一段」輕輕提醒
        const on = document.querySelector('#clsSegs li.on');
        if (on) { on.classList.toggle('hurry', end - ui.min <= 2 && end - ui.min > 0); on.classList.toggle('due', ui.min >= end); }
        const nx = document.getElementById('clsNext'); if (nx) nx.classList.toggle('due', ui.min >= end);
      }, 1000);
      return () => {
        clearInterval(ui.timer); stopSpeaker(); clearTimeout(ui.wallT);
        if (mq && mq.removeEventListener) mq.removeEventListener('change', onChange);
      };
    },
    after() {
      // 重畫之後把講者的計時環補回目前的進度
      if (ui && ui.speaker) setTicks(document.querySelector('#spkRing .ticks'), ui.spkTick, ui.spkTick > 25 ? 5 : 0);
    },
    render(ctx) {
      const { state } = ctx;
      const L = lessonInfo(state);
      const sq = state.squad;
      if (L.finished && !ui.finished) {
        return `<div class="pad">${backBar('小隊課', 's/squad')}<h1 class="hero s" tabindex="-1">這一期的 ${L.planLessons} 堂都上完了。</h1>
          <p class="sub">可以上傳段考考卷，看前後兩次錯在哪。</p><button class="btn block" data-go="s/exam">段考對照</button></div>`;
      }
      if (ui.finished) {
        const rec = state.student.lessons[state.student.lessons.length - 1];
        const sk = SKILLS[rec.skill];
        return `<div class="pad pb cls-done">
          <div class="center-col tight">${duo('joy', 'l')}</div>
          <h1 class="hero s center" tabindex="-1">下課了。<br>第 ${rec.week} 堂的紀錄。</h1>
          <div class="card">
            <div class="sec-h"><b>${esc(sk.title)}</b><span class="chip">${rec.week === 1 ? '試上' : `第 ${rec.week} 週`}</span></div>
            <div class="chips"><span class="chip ${rec.tryOk === rec.tryTotal ? 'g' : ''}">自己試試 ${rec.tryOk}/${rec.tryTotal}</span><span class="chip ${rec.explainPass ? 'g' : 'c'}">${rec.explainPass ? '講給隊友聽：講出來了' : '講給隊友聽：還差一點'}</span></div>
            <p class="body"><span class="lbl">我搞懂的</span>${mt(rec.got || '（沒有寫）')}</p>
          </div>
          <div class="card mint"><b>接下來</b><p class="body">這堂的重點會變成今晚的練習；家長的 LINE 會收到「今天他練了什麼、今晚可以問他這一句」。</p></div>
          ${rec.week === 1 ? '<p class="fine">第一堂是試上：不滿意不收費。</p>' : ''}
          <div class="dock"><button class="btn block" data-go="s/home">回今天</button><button class="btn ghost block" data-go="s/squad">看課堂紀錄</button></div>
        </div>`;
      }
      const wide = isWide();
      if (!wide && !ui.phone) return phoneNotice(L);
      const seg = SEGMENTS[ui.seg];
      const problems = weekProblems(state, sq, L);
      const flash = ui.fx === 'swap' ? `<div class="seg-flash" aria-hidden="true"><b class="num">${ui.seg + 1}</b>${seg.name}</div>` : '';
      const main = `<section class="cls-main" aria-label="白板">
          <h1 class="sr" tabindex="-1">${seg.name}，${seg.min} 分鐘</h1>
          ${speakerStage(sq, state)}
          <div class="wb-wrap">${boardHtml(`w${L.week}-${segKey()}`, { tag: boardTag(), text: boardText(L), icon })}${flash}</div>
          <div class="cls-act segbody">${segAct(ctx, L, sq)}</div>
        </section>`;
      if (!wide) {
        // 手機最低可用模式：直式單欄，白板在上、隊友收合
        return `<div class="classroom phone" data-seg="${seg.key}" data-fx="${ui.fx || ''}">
          ${topBar(L, state, true)}
          <ol class="segdots" id="clsSegs" aria-label="這堂課的六段：現在是${seg.name}">${SEGMENTS.map((s, i) => `<li class="${i < ui.seg ? 'past' : i === ui.seg ? 'on' : ''}"><span class="sr">${s.name}</span></li>`).join('')}</ol>
          <p class="seg-now"><b>${seg.name}</b><span class="num"> · ${seg.min} 分鐘</span></p>
          ${main}
          <details class="mates-fold"><summary><span class="mf-dots">${avatar(T_AV, 'xs')}${sq.members.map((mm) => avatar(mm, 'xs')).join('')}</span><span>${esc(TEACHER.name)}和 ${sq.members.length} 位隊友</span>${icon('down', 'chev')}</summary>${sidePanel(ctx, L, sq, problems)}</details>
          <footer class="cls-foot">${myControls(true)}</footer>
        </div>`;
      }
      return `<div class="classroom wide" data-seg="${seg.key}" data-fx="${ui.fx || ''}">
        ${topBar(L, state, false)}
        <div class="cls-grid">${main}${sidePanel(ctx, L, sq, problems)}</div>
        <footer class="cls-foot">${segsBar()}${myControls()}</footer>
      </div>`;
    },
    on: {
      leave(ctx) { ctx.go('s/squad'); },
      usePhone(ctx) { ui.phone = true; ctx.rerender({ focusTitle: true, top: true }); },
      copyLink(ctx) {
        const url = location.href;
        const done = () => ctx.toast('已複製教室連結。貼到 iPad 或電腦的瀏覽器就能開。');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => ctx.toast('無法自動複製，請長按上面的連結複製。'));
        else ctx.toast('無法自動複製，請長按上面的連結複製。');
      },
      recInfo(ctx) { ctx.toast(segKey() === 'teach' ? '「講給隊友聽」整段不錄。' : '只錄白板和老師的講解，不錄你們的畫面和聲音。'); },
      toggleMic(ctx) { ui.mic = !ui.mic; ctx.rerender(); },
      toggleCam(ctx) { ui.cam = !ui.cam; ctx.rerender(); if (ui.cam) ctx.toast('示範：不會真的開鏡頭。不開也可以上課。'); },
      toggleHand(ctx) { ui.hand = !ui.hand; ctx.rerender(); },
      metoo(ctx) { ui.metoo = !ui.metoo; ctx.rerender(); },
      askHint(ctx) { ui.hint = true; ctx.rerender(); },
      warm(ctx, el) { ui.warm = Number(el.dataset.i); draw(ctx, 'warm'); },
      try(ctx, el) { ui.tries[Number(el.dataset.p)] = Number(el.dataset.i); ctx.rerender(); },
      teachType(ctx, el) { ui.teachText = el.value; },
      myTurn(ctx) { startSpeaker('me'); ctx.buzz(12); draw(ctx, 'spk', { focusSel: '#teachRecBtn' }); },
      passOn(ctx) {
        const buddy = ctx.state.squad.members.find((x) => !x.isMe);
        ui.dots.me = (ui.dots.me || 0) + 1;
        startSpeaker(buddy.id); draw(ctx, 'spk');
        ctx.toast('交給隊友接下去。這也算一次開口。');
      },
      teachDone(ctx) {
        const ta = document.getElementById('teachIn'); if (ta) ui.teachText = ta.value;
        const L = lessonInfo(ctx.state);
        ui.teachRes = evaluateExplanation(L.skill, ui.teachText);
        if (ui.teachRes.pass) ui.dots.me = (ui.dots.me || 0) + 1;
        stopSpeaker();
        ctx.rerender();
      },
      nextSpeaker(ctx) {
        const buddy = ctx.state.squad.members.find((x) => !x.isMe);
        startSpeaker(buddy.id); draw(ctx, 'spk');
      },
      heard(ctx, el) {
        const first = !ui.heard;
        ui.heard = el.dataset.v;
        if (first && ui.heard === 'ok') ui.dots[ui.speaker] = (ui.dots[ui.speaker] || 0) + 1;
        ctx.rerender();
      },
      gotPick(ctx, el) { ui.got = el.dataset.v; ctx.rerender(); },
      gotType(ctx, el) { ui.got = el.value; },
      gotEdit(ctx) { ui.gotPosted = false; ctx.rerender({ focusSel: '#gotIn' }); },
      gotPost(ctx) {
        const gi = document.getElementById('gotIn'); if (gi && gi.value.trim()) ui.got = gi.value.trim();
        if (!ui.got) { ctx.toast('先選一句，或自己寫一句。'); return; }
        ui.gotPosted = true;
        draw(ctx, 'wall');
        // 全隊的卡片都浮現之後，圓點散開一次
        const n = ctx.state.squad.members.length;
        clearTimeout(ui.wallT);
        ui.wallT = setTimeout(() => { ctx.burst(document.querySelector('.wall')); ctx.buzz([10, 40, 16]); }, reduced() ? 0 : n * 420 + 300);
      },
      nextSeg(ctx) {
        if (ui.seg < SEGMENTS.length - 1) {
          ui.seg += 1; ui.min = Math.max(ui.min, START[ui.seg]);
          stopSpeaker(); ui.speaker = null; ui.heard = null; ui.hint = false;
          const L = lessonInfo(ctx.state);
          if (segKey() === 'again') {
            // 分兩小組：依「自己試試」和這週的卡點（畫面上只看到圓各自滑向兩側）
            const sk = SKILLS[L.skill];
            ui.groups = {};
            ctx.state.squad.members.forEach((mm) => { ui.groups[mm.id] = mm.isMe ? (missedTry(sk) ? 'A' : 'B') : (mm.stuck || []).includes(L.skill) ? 'A' : 'B'; });
          } else ui.groups = null;
          ctx.buzz(10);
          draw(ctx, 'swap', { focusTitle: true, top: true });
          return;
        }
        const gi = document.getElementById('gotIn'); if (gi && gi.value.trim()) ui.got = gi.value.trim();
        const L = lessonInfo(ctx.state);
        const sk = SKILLS[L.skill];
        const tryOk = sk.practice.filter((p, i) => ui.tries[i] === p.ok).length;
        ui.finished = true; ui.min = TOTAL;
        stopSpeaker();
        ctx.update((s) => {
          s.student.lessons.push({ week: L.week, date: L.date, doneOn: s.clock.date, skill: L.skill, tryOk, tryTotal: sk.practice.length, explainPass: !!(ui.teachRes && ui.teachRes.pass), got: ui.got });
          s.student.log.push({ date: s.clock.date, kind: 'class', skill: L.skill, counts: false, ok: true });
          const k = s.student.skills[L.skill] || (s.student.skills[L.skill] = { status: 'unknown', hints: 0 });
          if ((k.status === 'stuck' || k.status === 'unknown') && tryOk > 0) k.status = 'learning';
        }, { silent: true });
        ctx.burst();
        ctx.rerender({ focusTitle: true, top: true });
      },
    },
  },
};
