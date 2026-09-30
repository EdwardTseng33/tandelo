// 學生：今天、小隊、卡點地圖、我

import { esc, icon, mt, coach, avatar, money, statusLabel, backBar } from '../ui.js';
import { SKILLS, SKILL_ORDER, CHAPTERS, syllabus, slotLabel, parseSlot, TEACHER, SEGMENTS } from '../content.js';
import {
  fmtLong, fmtMD, fmtMDW, daysBetween, lessonDates, minutesUntil, countdownLabel, activeDays, PLANS, isRetestReady, refundIfQuit,
} from '../state.js';
import { homeLine, todayPlan } from '../coach.js';
import { scheduleList } from './onboard.js';

export function lessonInfo(state) {
  const st = state.student;
  const sq = state.squad;
  if (!sq || !st.joined) return null;
  const planLessons = PLANS[st.plan.id].lessons;
  const done = st.lessons.length;
  const idx = Math.min(done, planLessons - 1);
  const dates = lessonDates(sq.firstDate, planLessons);
  const sy = syllabus(st.diag.stuck, st.grade);
  const slot = parseSlot(sq.slot);
  const finished = done >= planLessons;
  const mins = minutesUntil(state.clock.date, state.clock.time, dates[idx], slot.time);
  return { week: idx + 1, date: dates[idx], time: slot.time, topic: sy[idx].topic, skill: sy[idx].skill, phase: sy[idx].phase, mins, finished, planLessons, done };
}

function nextLessonCard(ctx) {
  const { state } = ctx;
  const sq = state.squad;
  const st = state.student;
  const L = lessonInfo(state);
  if (!L) {
    return `<div class="card pine">
      <span class="pill">還沒有小隊</span>
      <h2 class="hero s on-dark">${st.diag.done ? '你的卡點找到了，<br>來找隊友吧。' : '先找到你卡在哪。'}</h2>
      <button class="btn light block" data-go="${st.diag.done ? (sq ? 's/match' : 's/when') : 's/start'}">${st.diag.done ? '選有空的時段' : '兩分鐘開始'}${icon('arrow')}</button>
    </div>`;
  }
  if (L.finished) {
    return `<div class="card pine"><span class="pill">這一期走完了</span><h2 class="hero s on-dark">${L.planLessons} 堂都上完了。</h2>
      <button class="btn light block" data-go="s/exam">上傳段考考卷，做前後對照</button></div>`;
  }
  const formed = sq.status === 'formed';
  return `<div class="card pine">
    <div class="sqtop"><span class="pill">第 ${L.week} / ${L.planLessons} 週 · ${formed ? esc(countdownLabel(L.mins)) : '等老師接班'}</span></div>
    <h2 class="hero s on-dark">${mt(L.topic)}</h2>
    <div class="avs">${sq.members.map((mm) => avatar(mm, 's')).join('')}</div>
    <div class="meta">
      <span>${icon('cal')}${fmtMDW(L.date)} ${esc(L.time)}</span>
      <span>${icon('users')}${sq.members.length} 人小隊 · ${TEACHER.name}</span>
    </div>
    ${formed
    ? `<button class="btn light block" data-go="s/class">${L.mins > 0 ? '進教室（示範：現在就能進）' : '進教室'}${icon('arrow')}</button>`
    : '<button class="btn light block" data-go="s/joined">看成班進度</button>'}
  </div>`;
}

function mapDots(st) {
  return `<div class="mapdots">${SKILL_ORDER.map((k) => `<span class="node-dot" data-s="${(st.skills[k] || {}).status || 'unknown'}" title="${esc(SKILLS[k].title)}"></span>`).join('')}</div>`;
}

export const screens = {
  's/home': {
    tab: 's/home',
    guard: (ctx) => (ctx.state.student.diag.done ? null : 's/start'),
    meta: { title: '今天', tips: ['今天的練習有上限（每天 3 件），做完就收起來。', '到設定把時間調到 22:31，看關燈後的樣子；往後快轉幾天，小陪會說「回來了就好」。'] },
    render(ctx) {
      const { state, night } = ctx;
      const st = state.student;
      const plan = todayPlan(state);
      const week = activeDays(st.log, ctx.today);
      const nOn = week.filter((d) => d.on).length;
      const greet = night ? `${esc(st.name)}，<br>該休息了。` : `${esc(st.name)}，今天<br>照你的步調。`;
      return `<div class="pad pbt">
        <div class="abar"><div class="wm">Tandelo<span class="dots"><i></i><i></i></span></div>${avatar({ name: st.name, color: 0, isMe: true }, 's')}</div>
        <p class="date">${fmtLong(ctx.today)}</p>
        <h1 class="hero" tabindex="-1">${greet}</h1>
        ${coach(homeLine(state), { night })}
        ${night ? `<div class="card lights">
            ${icon('moon', 'big')}<div><b>22:30 關燈了</b><p class="body">練習入口先收起來，剩下的我明天排。這一條爸媽也不能關。</p></div>
          </div>` : ''}
        ${nextLessonCard(ctx)}
        ${night ? '' : `<section>
          <div class="sec-h"><h2 class="h3">今天的練習</h2><span class="num fine">${plan.count} / ${plan.cap}</span></div>
          ${plan.done.map((d) => `<div class="row done"><span class="ic ok">${icon('check')}</span><span><b>${mt(d.title)}</b><small>${d.ok === false ? '記下來了，之後再試' : '完成'}</small></span></div>`).join('')}
          ${plan.todo.map((t) => `<button class="row" data-go="${t.go}"><span class="ic ${t.kind === 'retest' ? 'gold' : ''}">${icon(t.kind === 'retest' ? 'star' : t.kind === 'explain' ? 'mic' : 'cam')}</span><span><b>${mt(t.title)}</b><small>${mt(t.sub)}</small></span>${icon('chev', 'chev')}</button>`).join('')}
          ${plan.full ? '<p class="fine left">今天的量到了。剩下的我明天排，多做不一定比較好。</p>' : ''}
          ${!plan.full && !plan.todo.length ? '<p class="fine left">今天沒有要趕的。想練可以到「練習」拍一題問我。</p>' : ''}
          ${plan.examWeek ? '<p class="fine left">段考前一週：不加量，睡飽比多寫一回有用。</p>' : ''}
        </section>`}
        <button class="card linkcard" data-go="s/map">
          <div class="sec-h"><b>卡點地圖</b>${icon('chev', 'chev')}</div>
          ${mapDots(st)}
          <small class="fine left">珊瑚＝卡住 · 綠＝說得出來 · 金＝隔幾天還會</small>
        </button>
        <div class="card">
          <div class="sec-h"><b>這週練了 <span class="num">${nOn}</span> 天</b></div>
          <div class="week7">${week.map((d) => `<span class="${d.on ? 'on' : ''} ${d.date === ctx.today ? 'today' : ''}"><i></i><small>${'一二三四五六日'[(new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7]}</small></span>`).join('')}</div>
          <small class="fine left">這裡沒有會斷掉的連續天數。哪天沒來，回來了就好。</small>
        </div>
      </div>`;
    },
  },

  's/squad': {
    tab: 's/squad',
    meta: { title: '我的小隊', tips: ['8 週課表：補洞 → 段考訂正 → 跟上學校 → 衝刺，第 4 週是結業點。', '「下週想問什麼」會匿名出現在老師的課前一頁。'] },
    render(ctx) {
      const { state } = ctx;
      const st = state.student;
      const sq = state.squad;
      const L = lessonInfo(state);
      if (!L) {
        return `<div class="pad pbt"><div class="abar"><span class="abar-t">我的小隊</span></div>
          <h1 class="hero s" tabindex="-1">還沒有小隊。</h1>${nextLessonCard(ctx)}</div>`;
      }
      const prep = state.teacher.prep;
      const confirmed = prep && prep.confirmed && prep.titles ? prep.titles : null;
      const records = [...st.lessons].reverse();
      return `<div class="pad pbt">
        <div class="abar"><span class="abar-t">我的小隊</span><span class="pill h">第 ${L.week} 週</span></div>
        <h1 class="sr" tabindex="-1">我的小隊</h1>
        ${nextLessonCard(ctx)}
        ${confirmed ? `<div class="card"><b>第 ${prep && prep.week} 週${TEACHER.name}確認的 3 題</b><ol class="list num3">${confirmed.map((t) => `<li>${mt(t)}</li>`).join('')}</ol><small class="fine left">用你們這週真的錯的題和問的問題排的。</small></div>` : ''}
        <h2 class="h3">這一期 · 對準 ${fmtMD(st.examDate)} 段考</h2>
        ${scheduleList(st, sq, { compact: true, doneWeeks: st.lessons.length, lessons: L.planLessons })}
        <h2 class="h3">課堂紀錄</h2>
        ${records.length ? records.map((r) => {
    const sess = state.teacher.sessions.find((x) => x.week === r.week);
    return `<div class="card rec">
            <div class="sec-h"><b>第 ${r.week} 堂 · ${fmtMD(r.date)}</b><span class="chip">${esc(SKILLS[r.skill].short)}</span></div>
            <p class="body"><span class="lbl">我搞懂的</span>${mt(r.got || '（沒有寫）')}</p>
            <div class="chips"><span class="chip ${r.tryOk === r.tryTotal ? 'g' : ''}">自己試試 ${r.tryOk}/${r.tryTotal}</span><span class="chip ${r.explainPass ? 'g' : 'c'}">${r.explainPass ? '講給隊友聽：講出來了' : '講給隊友聽：還差一點'}</span></div>
            <p class="body tnote"><span class="lbl">${TEACHER.name}</span>${esc(sess && sess.note ? sess.note : '你們今天互相講的那段，比我講的更有用。下週繼續。')}</p>
          </div>`;
  }).join('') : '<p class="fine left">上完第一堂，這裡會出現課堂紀錄。</p>'}
        <form class="card qbox" data-act="ask">
          <label for="qIn"><b>下週想問什麼？</b></label>
          <div class="qrow"><input class="input" id="qIn" maxlength="40" placeholder="例如：分數前面有負號怎麼辦" autocomplete="off"><button class="btn s" type="submit">丟進去</button></div>
          <small class="fine left">${st.questions.length ? `已經丟了 ${st.questions.length} 題。` : ''}林老師上課前會看到，不會顯示你的名字。</small>
        </form>
        <p class="fine left">8 週內缺超過 3 堂，小陪會建議轉到下一期或改一對一，不收違約金。</p>
      </div>`;
    },
    on: {
      ask(ctx) {
        const el = document.getElementById('qIn');
        const v = (el && el.value.trim()) || '';
        if (!v) { ctx.toast('先寫下想問的問題'); return; }
        ctx.update((s) => { s.student.questions.push({ text: v, by: '隊友', week: s.student.lessons.length + 1 }); });
        ctx.toast('丟進去了。老師的課前一頁會看到（匿名）。');
      },
    },
  },

  's/map': {
    tab: 's/map',
    guard: (ctx) => (ctx.state.student.diag.done ? null : 's/start'),
    meta: { title: '卡點地圖', tips: ['顏色：珊瑚＝卡住、綠＝說得出來（等再測）、金＝過 7–12 天不給提示還會。', '點任何一個點，看下一步要做什麼。'] },
    mount(ctx) {
      if (!ctx.state.student.flip) return null;
      const t = setTimeout(() => ctx.update((s) => { s.student.flip = null; }, { silent: true }), 1200);
      return () => clearTimeout(t);
    },
    render(ctx) {
      const st = ctx.state.student;
      const gold = SKILL_ORDER.filter((k) => st.skills[k] && st.skills[k].status === 'gold').length;
      return `<div class="pad pbt">
        <div class="abar"><span class="abar-t">卡點地圖</span></div>
        <h1 class="hero s" tabindex="-1">${gold ? `${gold} 個點，<br>你真的會了。` : '一步一步，<br>把卡點翻過去。'}</h1>
        <div class="legend"><span><i data-s="stuck"></i>卡住</span><span><i data-s="learning"></i>練習中</span><span><i data-s="green"></i>說得出來</span><span><i data-s="gold"></i>已掌握</span></div>
        ${CHAPTERS.map((c) => `<section class="chap"><h2 class="chap-h">${esc(c.name)}</h2>
          ${SKILL_ORDER.filter((k) => SKILLS[k].chapter === c.id).map((k) => {
    const s = st.skills[k] || { status: 'unknown' };
    const sub = s.status === 'green' ? `${fmtMD(s.retestDue)} 再測` : statusLabel(s.status);
    return `<button class="node ${st.flip === k ? 'flip' : ''}" data-s="${s.status}" data-act="nodeInfo" data-k="${k}">
              <span class="node-dot" data-s="${s.status}">${s.status === 'gold' ? icon('star') : s.status === 'green' || s.status === 'ok' ? icon('check') : ''}</span>
              <span><b>${esc(SKILLS[k].title)}</b><small>${esc(sub)}</small></span>${icon('chev', 'chev')}</button>`;
  }).join('')}</section>`).join('')}
        <p class="jquote">金色不是獎盃，是紀錄：之後又錯，它會回到練習清單。</p>
      </div>`;
    },
    on: {
      nodeInfo(ctx, el) {
        const k = el.dataset.k;
        const sk = SKILLS[k];
        const s = ctx.state.student.skills[k] || { status: 'unknown' };
        let act = '';
        if (s.status === 'stuck') act = `<button class="btn block" data-go="s/ask/${k}" data-act="closeSheet">拍一題問小陪</button>`;
        else if (s.status === 'learning') act = `<button class="btn block" data-go="s/explain/${k}">說給我聽</button>`;
        else if (s.status === 'green') act = `<button class="btn block" data-go="s/retest/${k}">${isRetestReady(s, ctx.today) ? '現在再測' : `${fmtMD(s.retestDue)} 再測`}</button>`;
        else if (s.status === 'ok' || s.status === 'unknown') act = `<button class="btn ghost block" data-go="s/ask/${k}">想練也可以：拍一題問小陪</button>`;
        ctx.sheet(`<div class="sheet-c">
          <span class="pill ${s.status === 'gold' ? 'h' : s.status === 'stuck' ? 'c' : 'g'}">${statusLabel(s.status)}</span>
          <h2 class="h2">${esc(sk.title)}</h2>
          <p class="body"><span class="lbl">為什麼會錯</span>${mt(sk.why)}</p>
          ${s.hints ? `<p class="fine left">到目前用了 ${s.hints} 次提示或示範，我都記下來了。</p>` : ''}
          ${s.status === 'gold' ? `<p class="body">${fmtMD(s.masteredAt)} 翻過去的。之後如果又錯，會自動回到練習清單。</p>` : ''}
          ${act}
        </div>`, sk.title);
      },
    },
  },

  's/me': {
    tab: 's/me',
    meta: { title: '我', tips: ['段考對照、方案、設定都在這裡。'] },
    render(ctx) {
      const st = ctx.state.student;
      const plan = st.plan ? PLANS[st.plan.id] : null;
      const days = daysBetween(ctx.today, st.examDate);
      return `<div class="pad pbt">
        <div class="abar"><span class="abar-t">我</span></div>
        <div class="me-h">${avatar({ name: st.name, color: 0, isMe: true }, 'l')}<div><h1 class="hero s" tabindex="-1">${esc(st.name)}</h1><p class="sub">${esc(st.grade)} · ${esc(st.goal)}</p></div></div>
        <div class="stat3">
          <div><b class="num">${days >= 0 ? days : '—'}</b><small>天後段考 · ${fmtMD(st.examDate)}</small></div>
          <div><b class="num">${Object.values(st.skills).filter((s) => s.status === 'gold').length}</b><small>已掌握的點</small></div>
          <div><b class="num">${st.lessons.length}</b><small>上過的小隊課</small></div>
        </div>
        <button class="row" data-go="s/exam"><span class="ic">${icon('upload')}</span><span><b>段考對照</b><small>上傳考卷，看前後兩次錯在哪</small></span>${icon('chev', 'chev')}</button>
        <button class="row" data-act="planInfo"><span class="ic">${icon('coin')}</span><span><b>我的方案</b><small>${plan ? `${plan.name}${st.plan.plus ? '＋Plus' : ''} · ${money(st.plan.total)}（示範）` : '還沒加入'}</small></span>${icon('chev', 'chev')}</button>
        <button class="row" data-go="s/start"><span class="ic">${icon('pencil')}</span><span><b>年級、段考日期、目標</b><small>改完可以重做診斷</small></span>${icon('chev', 'chev')}</button>
        <div class="row static"><span class="ic">${icon('moon')}</span><span><b>22:30 關燈</b><small>之後小陪不出聲、練習入口收起來。這條爸媽也不能關。</small></span></div>
        <button class="row" data-go="settings"><span class="ic">${icon('gear')}</span><span><b>設定</b><small>切換身分、示範時間、深色模式</small></span>${icon('chev', 'chev')}</button>
        <button class="row" data-go="about"><span class="ic">${icon('help')}</span><span><b>關於這個 POC</b></span>${icon('chev', 'chev')}</button>
      </div>`;
    },
    on: {
      planInfo(ctx) {
        const st = ctx.state.student;
        if (!st.plan) { ctx.go(ctx.state.squad ? 's/join' : 's/when'); return; }
        const plan = PLANS[st.plan.id];
        const refund = refundIfQuit(st.plan.id, st.lessons.length);
        ctx.sheet(`<div class="sheet-c">
          <h2 class="h2">${plan.name}${st.plan.plus ? '＋Plus' : ''}</h2>
          <p class="body">${esc(plan.desc)}。合計 ${money(st.plan.total)}（示範付款，未收任何錢）。</p>
          <ul class="list sm"><li>已上 ${st.lessons.length} / ${plan.lessons} 堂。</li><li>如果現在退出：上過的照算，沒上的退 <b class="num">${money(refund)}</b>（示範試算）。</li><li>停下來也可以。你的路線和已經學會的點會一直留著。</li></ul>
          <button class="btn ghost block" data-act="closeSheet">知道了</button>
        </div>`, '我的方案');
      },
    },
  },
};
