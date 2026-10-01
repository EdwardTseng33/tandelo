// 學生：兩分鐘開始 → 診斷 → 結果 → 選時段 → AI 湊隊 → 加入與付款（示範）

import { esc, icon, m, mt, coach, duo, avatar, money, backBar, steps } from '../ui.js';
import {
  DIAG_QUESTIONS, UNSURE, diagnose, SKILLS, SKILL_ORDER, CHAPTERS, GOALS, DAYS, SLOT_TIMES, slotEnabled, slotId,
  slotLabel, pickBestSlot, parseSlot, buildSquad, syllabus, PHASES, TEACHER, slotDemand, AVATAR_COLORS,
} from '../content.js';
import { reduced } from '../fx.js';
import { daysBetween, fmtMDW, fmtMD, firstLessonDate, lessonDates, PLANS, PLUS_PRICE, planTotal, isLightsOut } from '../state.js';

const ui = { qi: 0, plan: '8', plus: false, matchPhase: 'search', busy: false, qAnim: '', prevP: 0 };

/** 成班儀式用的成員小圓 */
export function crewDots(sq) {
  return sq.members.map((mm) => ({ bg: AVATAR_COLORS[mm.color % AVATAR_COLORS.length], label: mm.isMe ? '你' : mm.name.slice(-1) }));
}

// ——— 診斷結果的路徑圖：一條八步的路，只有卡住的那一步有缺口 ———
const PATH_XY = [[60, 50], [142, 50], [224, 50], [306, 50], [306, 122], [224, 122], [142, 122], [60, 122]];
function pathArt(st) {
  const stuck = new Set(st.diag.stuck);
  const status = (k) => (stuck.has(k) ? 'stuck' : (st.skills[k] || {}).status === 'ok' ? 'ok' : 'unknown');
  const segs = SKILL_ORDER.slice(1).map((k, i) => {
    const [x1, y1] = PATH_XY[i]; const [x2, y2] = PATH_XY[i + 1];
    const d = i === 3 ? `M${x1} ${y1} C ${x1 + 46} ${y1}, ${x2 + 46} ${y2}, ${x2} ${y2}` : `M${x1} ${y1} L${x2} ${y2}`;
    const cls = stuck.has(k) ? 'gap' : status(k) === 'ok' && status(SKILL_ORDER[i]) !== 'unknown' ? 'ok' : '';
    return `<path class="pa-seg ${cls}" d="${d}"/>`;
  }).join('');
  const firstGap = SKILL_ORDER.findIndex((k) => stuck.has(k));
  let walker = '';
  if (firstGap >= 0) {
    // 兩個圓停在缺口前：你現在在這裡
    const [gx, gy] = PATH_XY[firstGap];
    const [px, py] = firstGap > 0 ? PATH_XY[firstGap - 1] : [gx - 44, gy];
    const wx = firstGap === 4 ? gx + 34 : (gx + px) / 2; const wy = (gy + py) / 2;
    walker = `<g class="pa-me" transform="translate(${wx.toFixed(0)} ${wy.toFixed(0)})"><circle cx="-4" cy="0" r="6" fill="#F26B54"/><circle cx="4" cy="0" r="6" fill="#0E5F52" opacity=".9"/></g>`;
  }
  const nodes = SKILL_ORDER.map((k, i) => {
    const [x, y] = PATH_XY[i]; const s = status(k);
    const up = i % 2 === 0; // 相鄰的標籤一上一下，才不會疊在一起
    const body = s === 'stuck'
      ? `<circle r="12" fill="var(--coral-l)"/><circle r="12" fill="none" stroke="var(--coral)" stroke-width="5" stroke-linecap="round" stroke-dasharray="58 18" transform="rotate(-60)"/>`
      : s === 'ok' ? '<circle r="11" fill="var(--pine)"/><path d="M-5 .5l3.4 3.4L5.2 -3.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
        : '<circle r="10" fill="var(--card)" stroke="var(--line)" stroke-width="2"/>';
    const label = s === 'stuck' ? `<text class="pa-l" y="${up ? -22 : 30}" text-anchor="${i === 3 || i === 4 ? 'end' : i === 0 || i === 7 ? 'start' : 'middle'}" x="${i === 3 || i === 4 ? 12 : i === 0 || i === 7 ? -12 : 0}">${esc(SKILLS[k].short)}</text>` : '';
    return `<g class="pa-n ${s}" style="--i:${i}" transform="translate(${x} ${y})"><g class="pa-pop">${body}</g>${label}</g>`;
  }).join('');
  const n = stuck.size;
  const alt = n ? `一條八步的路，只有 ${n} 處缺口：${[...stuck].map((k) => SKILLS[k].short).join('、')}。其他的路是通的。` : '一條八步的路，全部是通的。';
  return `<figure class="patha"><svg viewBox="0 0 362 164" role="img" aria-label="${esc(alt)}">
      <path class="pa-seg ${n ? '' : 'ok'}" d="M60 122 L26 122"/>
      ${segs}${nodes}${walker}
      <path class="pa-flag" d="M18 132v-22M18 110.5h11l-2.4 3.8 2.4 3.8H18"/><text class="pa-cap" x="20" y="150" text-anchor="middle">段考</text>
    </svg><figcaption class="fine left">${n ? `八步裡只有${n === 1 ? '一' : '兩'}處缺口。補上它，後面的路就通了。` : '八步都是通的。'}</figcaption></figure>`;
}

function scheduleList(st, sq, { compact = false, doneWeeks = 0, lessons = 8 } = {}) {
  const sy = syllabus(st.diag.stuck.length ? st.diag.stuck : ['sq-cross'], st.grade).slice(0, lessons);
  const dates = lessonDates(sq.firstDate, lessons);
  const rows = sy.map((w, i) => {
    const ph = PHASES[w.phase];
    const state = i < doneWeeks ? 'done' : i === doneWeeks ? 'now' : '';
    const row = `<li class="wk ${ph.cls} ${state}"><span class="wk-n num">${w.w}</span><span class="wk-d num">${fmtMD(dates[i])}</span><span class="wk-t">${mt(w.topic)}</span><span class="wk-p">${ph.name}</span></li>`;
    const cp = w.checkpoint ? `<li class="wk-cp"><span>第 4 週結業點：可以停，也可以續走</span></li>` : '';
    return row + cp;
  }).join('');
  return `<ol class="weeks ${compact ? 'compact' : ''}">${rows}<li class="wk-exam">${icon('flag')}<span>學校段考 ${fmtMDW(st.examDate)}</span></li></ol>`;
}
export { scheduleList };

function advance(ctx) {
  if (ui.qi < DIAG_QUESTIONS.length - 1) { ui.qi += 1; ui.qAnim = 'in'; ctx.rerender({ focusTitle: true }); return; }
  const r = diagnose(ctx.state.student.diag.answers);
  ctx.update((s) => {
    const d = s.student.diag;
    d.done = true; d.stuck = r.stuck; d.allClear = r.allClear; d.correct = r.correct;
    s.student.started = true;
    s.student.skills = {};
    for (const k of SKILL_ORDER) if (r.status[k]) s.student.skills[k] = { status: r.status[k], hints: 0 };
    s.squad = null; s.student.joined = false; s.student.plan = null; s.student.lessons = [];
    s.teacher.sessions = []; s.teacher.prep = null; s.teacher.room = null;
  }, { silent: true });
  ctx.go('s/result');
}

export const screens = {
  's/start': {
    tabs: false,
    meta: { title: '兩分鐘開始', tips: ['年級、段考日期、目標都可以改。段考日期是示範值。', '按「下一步」進入 8 題初步診斷。'] },
    render(ctx) {
      const st = ctx.state.student;
      const days = daysBetween(ctx.today, st.examDate);
      return `<div class="pad pb">
        ${backBar('1 / 2 · 你想要什麼', 'welcome')}
        <h1 class="sr" tabindex="-1">兩分鐘開始：你想要什麼</h1>
        ${coach('我是陪你跑的，不是催你的。先讓我知道你要去哪。', { night: ctx.night })}
        <label class="field"><span>你想被叫什麼？</span><input class="input" id="stName" maxlength="6" value="${esc(st.name)}" data-change="setName" autocomplete="off"></label>
        <div class="field"><span>年級</span>
          <div class="seg" role="group" aria-label="年級">${['國二', '國三'].map((g) => `<button data-act="setGrade" data-v="${g}" aria-pressed="${st.grade === g}">${g}</button>`).join('')}</div>
          ${st.grade === '國三' ? '<small class="fine left">國三的診斷先從會考常考的國二卡點開始。</small>' : ''}
        </div>
        <label class="field"><span>學校下一次段考</span><input class="input" type="date" id="stExam" value="${st.examDate}" data-change="setExam"></label>
        <p class="fine left">${days >= 0 ? `離段考還有 <b class="num">${days}</b> 天。` : '這個日期已經過了，改一下吧。'}小陪依學校行事曆帶入（示範日期），不對可以改。</p>
        <div class="field"><span>這學期，你最想要的是？</span>
          <div class="chips">${GOALS.map((g) => `<button class="chipbtn" data-act="setGoal" data-v="${g}" aria-pressed="${st.goal === g}">${g}</button>`).join('')}</div>
        </div>
        <div class="field"><span>一天願意給我多久？</span>
          <div class="seg" role="group" aria-label="每天練習時間">${[10, 15, 20].map((v) => `<button data-act="setMin" data-v="${v}" aria-pressed="${st.minutes === v}">${v} 分</button>`).join('')}</div>
          <small class="fine left">每天有上限，段考前也不加量。</small>
        </div>
        <div class="dock"><button class="btn block" data-act="toDiag">下一步：看看你卡在哪${icon('arrow')}</button></div>
      </div>`;
    },
    on: {
      setName(ctx, el) { const v = el.value.trim().slice(0, 6) || '小睿'; ctx.update((s) => { s.student.name = v; }); },
      setGrade(ctx, el) { ctx.update((s) => { s.student.grade = el.dataset.v; }); },
      setExam(ctx, el) { if (el.value) ctx.update((s) => { s.student.examDate = el.value; }); },
      setGoal(ctx, el) { ctx.update((s) => { s.student.goal = el.dataset.v; }); },
      setMin(ctx, el) { ctx.update((s) => { s.student.minutes = Number(el.dataset.v); }); },
      toDiag(ctx) {
        const name = document.getElementById('stName');
        if (name) ctx.update((s) => { s.student.name = name.value.trim().slice(0, 6) || '小睿'; }, { silent: true });
        ui.qi = 0;
        ctx.go('s/diag');
      },
    },
  },

  's/diag': {
    tabs: false,
    meta: { title: '初步診斷：8 題', tips: ['選「不確定」也可以，不會扣分。', '判卡點的規則：選到特定的錯誤選項，代表卡在某一步（例如把 (x+3)² 算成 x²+9＝漏掉中間項）。'] },
    render(ctx) {
      const st = ctx.state.student;
      const q = DIAG_QUESTIONS[ui.qi];
      const ans = st.diag.answers[q.id];
      return `<div class="pad pb">
        <div class="abar">${ui.qi === 0 ? `<button class="iconbtn" data-go="s/start" aria-label="返回">${icon('back')}</button>` : `<button class="iconbtn" data-act="prevQ" aria-label="上一題">${icon('back')}</button>`}<span class="abar-t">2 / 2 · 你卡在哪</span><span class="abar-r num">${ui.qi + 1} / ${DIAG_QUESTIONS.length}</span></div>
        <div class="duoprog" id="duoprog" role="progressbar" aria-label="診斷進度" aria-valuemin="0" aria-valuemax="${DIAG_QUESTIONS.length}" aria-valuenow="${ui.qi}" style="--p:${ui.prevP}"><span class="dp a"><i></i></span><span class="dp b"><i></i></span></div>
        <div class="qcard ${ui.qAnim}" id="qcard">
        <p class="eyebrow">${esc(CHAPTERS.find((c) => c.id === SKILLS[q.skill].chapter).name)}</p>
        <h1 class="qtitle" tabindex="-1">${/[一-鿿]/.test(q.q) ? mt(q.q) : m(q.q)}</h1>
        <div class="opts" role="group" aria-label="選項">
          ${q.opts.map((o, i) => `<button class="opt ${ans === i ? 'sel' : ''}" data-act="answer" data-i="${i}" id="opt-${i}">${/[一-鿿]/.test(o.t) ? mt(o.t) : m(o.t)}</button>`).join('')}
        </div>
        <button class="btn ghost s block" data-act="answer" data-i="${UNSURE}" id="opt-u">不確定</button>
        </div>
        <p class="fine">這只是初步。不是考試，沒有分數；之後每天的練習會讓我越來越準。</p>
      </div>`;
    },
    enter() { ui.busy = false; ui.qAnim = ''; ui.prevP = ui.qi / DIAG_QUESTIONS.length; },
    after() {
      // 兩個圓隨進度靠攏：先畫在上一題的位置，下一格再移到這一題
      const p = ui.qi / DIAG_QUESTIONS.length;
      const el = document.getElementById('duoprog');
      ui.prevP = p; ui.qAnim = '';
      if (el) requestAnimationFrame(() => el.style.setProperty('--p', p));
    },
    on: {
      answer(ctx, el) {
        if (ui.busy) return;
        const q = DIAG_QUESTIONS[ui.qi];
        const i = Number(el.dataset.i);
        ctx.update((s) => { s.student.diag.answers[q.id] = i; }, { silent: true });
        const card = document.getElementById('qcard');
        if (card && !reduced()) {
          // 作答後這張卡滑出去，下一題再滑進來
          ui.busy = true;
          el.classList.add('sel'); card.classList.add('out');
          setTimeout(() => { ui.busy = false; if (location.hash.includes('s/diag')) advance(ctx); }, 300);
          return;
        }
        advance(ctx);
      },
      prevQ(ctx) { if (ui.busy) return; ui.qi = Math.max(0, ui.qi - 1); ui.qAnim = 'in-back'; ctx.rerender({ focusTitle: true }); },
    },
  },

  's/result': {

    tabs: false,
    guard: (ctx) => (ctx.state.student.diag.done ? null : 's/start'),
    meta: { title: '診斷結果', tips: ['卡點是「卡在哪一步」，不是整章。', '這裡的結果會出現在家長 LINE 的第一張卡片。'] },
    render(ctx) {
      const st = ctx.state.student;
      const d = st.diag;
      const sk = d.stuck.map((k) => ({ k, ...SKILLS[k] }));
      const headline = d.allClear
        ? '8 題都對了。<br>我們把它練得更穩。'
        : sk.length === 1 ? `你只卡在一步：<br>${esc(sk[0].title)}。` : `你卡在兩步。<br>先從「${esc(sk[0].title)}」開始。`;
      return `<div class="pad pb">
        <span class="pill g">${d.correct ?? 0} / ${DIAG_QUESTIONS.length} 題 · 初步結果</span>
        <h1 class="hero m" tabindex="-1">${headline}</h1>
        ${pathArt(st)}
        ${sk.map((s, i) => `<div class="card stuckcard">
          <div class="stuck-h"><span class="node-dot" data-s="stuck" aria-hidden="true"></span><div><small class="eyebrow">卡點 ${i + 1} · ${esc(CHAPTERS.find((c) => c.id === s.chapter).name)}</small><b>${esc(s.title)}</b></div></div>
          <p class="body"><span class="lbl">為什麼會錯</span>${mt(s.why)}</p>
        </div>`).join('')}
        <div class="card">
          <b>其他看起來還好的</b>
          <div class="chips">${SKILL_ORDER.filter((k) => st.skills[k] && st.skills[k].status === 'ok').map((k) => `<span class="chip g">${icon('check')}${esc(SKILLS[k].title)}</span>`).join('') || '<span class="fine left">這次沒有，之後練習會再看。</span>'}</div>
        </div>
        ${coach(d.allClear ? '全對很好。我會從學校正在教的地方陪你練穩，不會多排。' : `有 ${slotDemand('d2-1900') - 3} 個${st.grade}同學跟你卡在同一步。一起補，比自己一個人快。`, { night: ctx.night })}
        <div class="dock"><button class="btn block" data-go="s/when">點幾格有空的時間${icon('arrow')}</button></div>
      </div>`;
    },
  },

  's/when': {
    tabs: false,
    guard: (ctx) => (ctx.state.student.diag.done ? null : 's/start'),
    meta: { title: '選有空的時段', tips: ['可以點很多格。AI 會挑一格能湊到最多同卡點隊友的時段。', '開課前 48 小時截止，第一堂會落在 48 小時之後。'] },
    render(ctx) {
      const st = ctx.state.student;
      const sel = new Set(st.slots);
      const head = `<span></span>${DAYS.map((d) => `<span class="sg-d">${d}</span>`).join('')}`;
      const rows = SLOT_TIMES.map((t) => `<span class="sg-t num">${t}</span>${DAYS.map((_, di) => {
        const id = slotId(di, t);
        if (!slotEnabled(di, t)) return '<span class="slot off" aria-hidden="true"></span>';
        return `<button class="slot" data-act="toggleSlot" data-v="${id}" id="slot-${id}" aria-pressed="${sel.has(id)}" aria-label="週${DAYS[di]} ${t}">${sel.has(id) ? icon('check') : ''}</button>`;
      }).join('')}`).join('');
      return `<div class="pad pb">
        ${backBar('你什麼時候可以？', 's/result')}
        <h1 class="hero s" tabindex="-1">點幾格你有空的時間。</h1>
        <div class="slotgrid" role="group" aria-label="每週有空的時段">${head}${rows}</div>
        <p class="fine left">每堂 50 分鐘。平日下午不開課。</p>
        ${coach(sel.size ? `選了 ${sel.size} 格。我會挑其中最容易湊到同卡點隊友的那一格。` : '平日晚上和週末都可以。點越多格，越快湊到隊。', { night: ctx.night, mode: sel.size ? 'listen' : 'talk' })}
        <div class="dock"><button class="btn block" data-act="match" ${sel.size ? '' : 'disabled'}>幫我找隊友</button></div>
      </div>`;
    },
    on: {
      toggleSlot(ctx, el) {
        const v = el.dataset.v;
        ctx.update((s) => { const a = new Set(s.student.slots); a.has(v) ? a.delete(v) : a.add(v); s.student.slots = [...a]; });
      },
      match(ctx) {
        const st = ctx.state.student;
        const slot = pickBestSlot(st.slots);
        if (!slot) return;
        const p = parseSlot(slot);
        const first = firstLessonDate(ctx.state.clock.date, ctx.state.clock.time, p.day, p.time);
        ctx.update((s) => {
          s.squad = buildSquad({ name: s.student.name, stuck: s.student.diag.stuck, slot, firstDate: first });
          s.student.joined = false; s.student.plan = null; s.student.lessons = [];
          s.teacher.sessions = []; s.teacher.prep = null; s.teacher.room = null; s.teacher.declined = false;
        }, { silent: true });
        ui.matchPhase = 'search';
        ctx.go('s/match');
      },
    },
  },

  's/match': {
    tabs: false,
    guard: (ctx) => (ctx.state.squad ? null : 's/when'),
    meta: { title: 'AI 湊隊', tips: ['隊友只顯示暱稱與頭像，名字和聲音要第一堂大家都同意才公開。', '第 4 週有一個結業點，可以停也可以續走。'] },
    mount(ctx) {
      if (ui.matchPhase === 'found') return null;
      const still = reduced();
      const n = ctx.state.squad.members.length - 1;
      const closeAt = n * 480 + 650; // 最後一顆進來的時候
      const t1 = still ? null : setTimeout(() => { ctx.burst(document.querySelector('.gather')); ctx.buzz([10, 40, 16]); }, closeAt + 420);
      const t = setTimeout(() => { ui.matchPhase = 'found'; ctx.rerender({ focusTitle: true }); }, still ? 200 : closeAt + 1150);
      return () => { clearTimeout(t); clearTimeout(t1); };
    },
    render(ctx) {
      const st = ctx.state.student;
      const sq = ctx.state.squad;
      if (ui.matchPhase !== 'found') {
        return `<div class="pad center-col">
          <div class="gather" style="--n:${sq.members.length - 1}" aria-hidden="true">
            <i class="g-big a"><b></b></i><i class="g-big b"><b></b></i>
            ${sq.members.slice(1).map((mm, i, arr) => {
    const a = [-150, -28, 152, 30, -90, 90][i % 6] * Math.PI / 180;
    const ty = (i - (arr.length - 1) / 2) * 21;
    return `<span class="g-m" style="--i:${i};--av:${AVATAR_COLORS[mm.color % AVATAR_COLORS.length]};--fx:${(Math.cos(a) * 150).toFixed(0)}px;--fy:${(Math.sin(a) * 120).toFixed(0)}px;--tx:${i % 2 ? 5 : -5}px;--ty:${ty.toFixed(0)}px"><i></i></span>`;
  }).join('')}
          </div>
          <h1 class="hero s" tabindex="-1">我在幫你找隊友</h1>
          <ul class="seek" aria-live="polite">
            <li>找跟你卡在同一步的人</li>
            <li>對齊學校進度和段考日期</li>
            <li>找大家都有空的時段</li>
          </ul>
        </div>`;
      }
      const main = SKILLS[st.diag.stuck[0]];
      return `<div class="pad pb">
        ${backBar('小隊邀請', 's/when')}
        <div class="mtl"><span class="ok">${icon('check')}湊好隊</span><span class="ok">${icon('check')}時段對上</span><span class="now">等你加入</span><button class="replay" data-act="replayMatch">${icon('refresh')}再看一次</button></div>
        <h1 class="hero m" tabindex="-1">找到跟你卡在<br>同一步的人。</h1>
        <p class="sub">${esc(st.grade)}上數學 · ${esc(sq.members.length)} 人小隊 · 對準 ${fmtMD(st.examDate)} 段考</p>
        <div class="avs big">${sq.members.map((mm) => `<div class="avcap">${avatar(mm, 'l')}<small>${mm.isMe ? '你' : esc(mm.name)}</small></div>`).join('')}</div>
        <div class="why4">
          <span>${icon('check')}都卡在「${esc(main.short)}」</span><span>${icon('check')}學校進度一樣</span>
          <span>${icon('check')}程度相近</span><span>${icon('check')}${esc(slotLabel(sq.slot).split(' ')[0])}${parseSlot(sq.slot).time >= '18:00' ? '晚上' : '下午'}都有空</span>
        </div>
        <div class="kv">${icon('cal')}<div><b>每${esc(slotLabel(sq.slot))}</b><small>第一堂 ${fmtMDW(sq.firstDate)} · 試上，不滿意不收費</small></div></div>
        <div class="kv teacher">${avatar({ name: '林', color: 3 }, 'm')}<div><b>${TEACHER.name}</b><small>${esc(TEACHER.intro)}</small></div></div>
        <div class="card mint"><p class="body quote">「${esc(TEACHER.voice)}」</p></div>
        <h2 class="h3">這 8 週，一起準備段考</h2>
        ${scheduleList(st, sq)}
        <p class="fine left">每週的題目，用你們這週真的錯的題和你們問的問題來排。加入前只看得到暱稱和頭像。</p>
        <div class="dock">
          <button class="btn block" data-go="s/join">我想加入這一隊</button>
          <p class="fine">滿 4 人成班、3 人改 1 對 3、2 人以下不開全額退。</p>
        </div>
      </div>`;
    },
    on: {
      replayMatch(ctx) { ui.matchPhase = 'search'; ctx.remount(); },
    },
  },

  's/join': {
    tabs: false,
    guard: (ctx) => (ctx.state.squad ? null : 's/when'),
    meta: { title: '選方案與付款（示範）', tips: ['付款是示範，不會收任何錢，也沒有連到任何金流。', '第一堂試上，不滿意不收費；成班才扣次數，沒成班全額退回。'] },
    render(ctx) {
      const total = planTotal(ui.plan, ui.plus);
      return `<div class="pad pb">
        ${backBar('加入這一隊', 's/match')}
        <h1 class="hero s" tabindex="-1">選一個方案。</h1>
        <div class="plans" role="radiogroup" aria-label="方案">
          ${Object.values(PLANS).map((p) => `<button class="plan ${ui.plan === p.id ? 'sel' : ''}" role="radio" aria-checked="${ui.plan === p.id}" data-act="pickPlan" data-v="${p.id}" id="plan-${p.id.replace('+', 'p')}">
            <span class="plan-l"><b>${p.name}${p.main ? '<span class="chip g">最多人選</span>' : ''}</b><small>${esc(p.desc)}</small></span>
            <span class="plan-p num">${money(p.price)}</span></button>`).join('')}
        </div>
        <label class="toggle"><input type="checkbox" data-change="togglePlus" ${ui.plus ? 'checked' : ''}><span class="tg" aria-hidden="true"></span>
          <span><b>加 Plus 月訂 <span class="num">${money(PLUS_PRICE)}</span>／月</b><small>不上課也能用小陪，每天仍有用量上限</small></span></label>
        <div class="card">
          <div class="sumrow"><span>合計</span><b class="num big">${money(total)}</b></div>
          <ul class="list sm">
            <li>第一堂試上，不滿意不收費。</li>
            <li>成班才扣次數；沒成班，全額退回。</li>
            <li>中途退出：上過的照算，沒上的退。</li>
          </ul>
        </div>
        <div class="dock"><button class="btn block" data-act="openPay">付款（示範，不會收錢）</button></div>
      </div>`;
    },
    on: {
      pickPlan(ctx, el) { ui.plan = el.dataset.v; ctx.rerender(); },
      togglePlus(ctx, el) { ui.plus = el.checked; ctx.rerender(); },
      openPay(ctx) {
        const total = planTotal(ui.plan, ui.plus);
        ctx.sheet(`<div class="sheet-c center">
          <div class="tick">${icon('lock')}</div>
          <h2 class="h2">這是示範付款</h2>
          <p class="big num">${money(total)}</p>
          <p class="body">不會收任何錢，也不會連到任何金流或信用卡。正式版會由家長在 LINE 付款。</p>
          <button class="btn block" data-act="pay">完成示範付款</button>
          <button class="btn ghost block" data-act="closeSheet">先不要</button>
        </div>`, '示範付款');
      },
      pay(ctx) {
        ctx.closeSheet();
        ctx.update((s) => {
          s.student.plan = { id: ui.plan, plus: ui.plus, total: planTotal(ui.plan, ui.plus), paidAt: s.clock.date };
          s.student.joined = true;
          const me = s.squad.members.find((x) => x.isMe); if (me) { me.plan = ui.plan; me.name = s.student.name; }
        }, { silent: true });
        ctx.toast('示範付款完成。這是概念驗證，資料只留在你的裝置。');
        ctx.go('s/joined');
      },
    },
  },

  's/joined': {
    tabs: false,
    guard: (ctx) => (ctx.state.student.joined ? null : 's/join'),
    meta: { title: '等老師接班', tips: ['老師按「接這一隊」才成班。可以切到老師身分親手接班，或用示範按鈕直接跳過。'] },
    render(ctx) {
      const sq = ctx.state.squad;
      const formed = sq.status === 'formed';
      const plan = PLANS[ctx.state.student.plan.id];
      return `<div class="pad pb">
        <div class="center-col tight">${duo(formed ? 'joy' : 'talk', 'l')}</div>
        <h1 class="hero m center" tabindex="-1">${formed ? '成班了。' : '意願送出了。'}</h1>
        ${formed ? `<div class="center-col"><button class="replay" data-act="replayCeremony">${icon('refresh')}再看一次成班</button></div>` : ''}
        <ol class="timeline">
          <li class="done"><span class="d">${icon('check')}</span><div><b>你按了「我想加入」</b><small>${esc(plan.name)} · 成班才扣次數，沒成班全額退</small></div></li>
          <li class="done"><span class="d">${icon('check')}</span><div><b>付款完成（示範）</b><small>沒有收任何錢</small></div></li>
          <li class="${formed ? 'done' : 'now'}"><span class="d">${formed ? icon('check') : '<b class="num">3</b>'}</span><div><b>${TEACHER.name}接班</b><small>${formed ? '老師按了「接這一隊」' : '老師按下「接這一隊」才成班'}</small></div></li>
          <li class="${formed ? 'now' : ''}"><span class="d"><b class="num">4</b></span><div><b>第一堂試上 · ${fmtMDW(sq.firstDate)}</b><small>${esc(slotLabel(sq.slot))} · 不滿意不收費</small></div></li>
        </ol>
        ${formed ? '' : `<div class="card mint"><b>示範：接班要老師按</b><p class="body">可以切到老師身分，親手按「接這一隊」；或直接跳過這一步。</p>
          <div class="btnrow"><button class="btn s" data-act="toTeacher">切到老師身分去接班</button><button class="btn s ghost" data-act="autoAccept">直接讓老師接班</button></div></div>`}
        <div class="dock">
          ${formed ? `<button class="btn block" data-go="s/class">進教室上第一堂（試上）</button><button class="btn ghost block" data-go="s/home">先回首頁</button>` : '<button class="btn ghost block" data-go="s/home">先回首頁</button>'}
        </div>
      </div>`;
    },
    on: {
      toTeacher(ctx) { ctx.update((s) => { s.role = 'teacher'; }, { silent: true }); ctx.go('t/offer'); },
      autoAccept(ctx) {
        ctx.update((s) => { s.squad.status = 'formed'; s.squad.acceptedAt = s.clock.date; });
        ctx.ceremony({ members: crewDots(ctx.state.squad), title: '成班了', sub: `${TEACHER.name}接下這一隊` });
      },
      replayCeremony(ctx) { ctx.ceremony({ members: crewDots(ctx.state.squad), title: '成班了', sub: `${TEACHER.name}接下這一隊` }); },
    },
  },
};
