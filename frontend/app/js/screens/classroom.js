// 學生：小隊課教室（模擬 50 分鐘六段，可快轉）

import { esc, icon, m, mt, avatar, duo, backBar } from '../ui.js';
import { SKILLS, SEGMENTS, TEACHER, prepCandidates } from '../content.js';
import { evaluateExplanation } from '../coach.js';
import { lessonInfo } from './student.js';

const START = SEGMENTS.reduce((acc, s, i) => { acc.push(i ? acc[i - 1] + SEGMENTS[i - 1].min : 0); return acc; }, []);
const TOTAL = SEGMENTS.reduce((a, s) => a + s.min, 0);

let ui = null;
function fresh(week) {
  return { week, seg: 0, min: 0, warm: null, tries: [null, null], teachText: '', teachRes: null, got: '', finished: false, timer: null, typing: null, groups: null, rollcall: false };
}

// 教室是平板／桌機優先：寬度 768px 以上才開白板；手機只給「換裝置」說明與複製連結
const WIDE_MQ = '(min-width: 768px)';
export function isWide() { return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(WIDE_MQ).matches; }

/** 這週要解的 3 題：老師課前一頁確認過就照她挑的，否則照卡點人數自動排前三 */
function weekProblems(state, sq, L) {
  const cands = prepCandidates(sq.members, state.student.questions || []);
  const prep = state.teacher.prep;
  if (prep && prep.week === L.week && prep.confirmed) {
    const picked = prep.picks.map((id) => cands.find((c) => c.id === id)).filter(Boolean);
    if (picked.length) return picked.slice(0, 3);
  }
  return cands.slice(0, 3);
}

function mateStatus(mm, L, state) {
  if (mm.isMe) return L.skill && (state.student.skills[L.skill] || {}).status === 'learning' ? '練習中' : '這週的主角';
  return (mm.stuck || []).includes(L.skill) ? `卡在：${SKILLS[L.skill].short}` : '這步已經會了';
}

function sidePanel(ctx, L, sq) {
  const { state } = ctx;
  const rows = sq.members.map((mm) => {
    const g = ui.groups ? ui.groups[mm.id] : null;
    return `<li class="cls-mate ${mm.isMe ? 'me' : ''}">${avatar(mm, 'm')}
      <div class="cls-mate-b"><b>${mm.isMe ? '你' : esc(mm.name)}</b><small>${esc(mateStatus(mm, L, state))}</small></div>
      <div class="cls-mate-r">${ui.rollcall ? '<span class="pill g">出席</span>' : ''}${g ? `<span class="pill grp g${g}">${g} 組</span>` : ''}</div>
    </li>`;
  });
  return `<aside class="cls-side" aria-label="隊友">
    <div class="cls-mate t">${avatar({ name: '林', color: 3 }, 'm')}<div class="cls-mate-b"><b>${esc(TEACHER.name)}</b><small>帶這一隊</small></div></div>
    <ul class="cls-mates">${rows.join('')}</ul>
    <p class="fine left">${ui.groups ? 'A 組：老師再帶一次；B 組：先做挑戰題。' : '上到「再帶一次」前，老師會分兩組。'}</p>
  </aside>`;
}

function phoneNotice(L) {
  const url = typeof location !== 'undefined' ? location.href : '';
  return `<div class="pad pb">
    <div class="abar"><button class="iconbtn" data-act="leave" aria-label="離開教室">${icon('x')}</button><span class="abar-t">第 ${L.week} 堂 · ${esc(SKILLS[L.skill].short)}</span></div>
    <div class="center-col tight">${duo('idle', 'l')}</div>
    <h1 class="hero s center" tabindex="-1">請用 iPad 或電腦開教室。</h1>
    <p class="sub center">小隊課的白板和隊友列需要大一點的畫面。把這個連結貼到 iPad 或電腦的瀏覽器，就會進到同一堂課。</p>
    <div class="card tight"><b>教室連結</b><p class="body num cls-link" id="clsLink">${esc(url)}</p></div>
    <p class="fine center">手機用來做課與課之間的練習；家長只在 LINE。</p>
    <div class="dock"><button class="btn block" data-act="copyLink">複製連結</button><button class="btn ghost block" data-act="leave">先回小隊</button></div>
  </div>`;
}
function isMath(s) { return !/[一-鿿]/.test(s); }
function fx(s) { return isMath(s) ? m(s) : mt(s); }
function clockText(min) { return `${String(min).padStart(2, '0')}:00 / ${TOTAL}:00`; }

function segBody(ctx, L, sq) {
  const sk = SKILLS[L.skill];
  const mates = sq.members.filter((x) => !x.isMe);
  const buddy = mates[0];
  const seg = SEGMENTS[ui.seg].key;
  const tq = `<div class="tbub">${avatar({ name: '林', color: 3 }, 's')}<p>`;
  if (seg === 'warm') {
    const w = sk.warm;
    const picks = mates.map((mm, i) => (i === 2 ? (w.ok + 1) % w.opts.length : w.ok));
    return `${tq}暖身一題，憑直覺選，不用算。</p></div>
      <h2 class="qtitle">${fx(w.q)}</h2>
      <div class="opts">${w.opts.map((o, i) => `<button class="opt ${ui.warm === i ? 'sel' : ''}" data-act="warm" data-i="${i}" ${ui.warm !== null ? 'disabled' : ''}>${fx(o)}
        ${ui.warm !== null ? `<span class="who">${mates.filter((_, j) => picks[j] === i).map((mm) => avatar(mm, 'xs')).join('')}</span>` : ''}</button>`).join('')}</div>
      ${ui.warm !== null ? `<p class="fine left">${ui.warm === w.ok ? '你跟大部分人選的一樣。' : '有人跟你選的一樣。'}等一下老師會說為什麼。</p>` : ''}`;
  }
  if (seg === 'common') {
    const n = sq.members.filter((x) => (x.stuck || []).includes(L.skill)).length;
    return `${tq}這一題，你們 ${sq.members.length} 個人裡有 ${n} 個上週這樣寫。我們看它卡在哪一步。</p></div>
      <div class="board">
        <span class="board-tag">大家常錯的</span>
        <div class="bl wrong">${fx(sk.board.wrong)}</div>
        <div class="bl right">${fx(sk.board.right)}</div>
        <p>${mt(sk.board.note)}</p>
      </div>
      <p class="fine left">重點回放只錄白板和老師講解，不錄你們的畫面和聲音。</p>`;
  }
  if (seg === 'try') {
    return `${tq}自己試試兩題。錯了沒關係，我等一下再帶一次。</p></div>
      ${sk.practice.map((p, pi) => `<div class="card tight">
        <b>${pi + 1}. ${fx(p.q)}</b>
        <div class="opts row3">${p.opts.map((o, i) => {
    const picked = ui.tries[pi];
    const cls = picked === null ? '' : i === p.ok && picked === i ? 'right' : picked === i ? 'sel miss' : '';
    return `<button class="opt ${cls}" data-act="try" data-p="${pi}" data-i="${i}" ${picked !== null ? 'disabled' : ''}>${fx(o)}</button>`;
  }).join('')}</div>
        ${ui.tries[pi] !== null ? `<small class="fine left">${ui.tries[pi] === p.ok ? '對了。' : '記下來了，下一段老師會再帶一次。'}</small>` : ''}
      </div>`).join('')}`;
  }
  if (seg === 'again') {
    const missed = ui.tries.some((t, i) => t !== null && t !== sk.practice[i].ok) || ui.tries.includes(null);
    return missed
      ? `${tq}${esc(ctx.state.student.name)}、${esc(mates[1].name)}，你們跟我在 A 組，用另一個例子再走一次。</p></div>
        <ol class="demo-steps">${sk.coach.steps.map((s) => `<li>${mt(s.demo)}</li>`).join('')}</ol>
        <p class="fine left">B 組在做挑戰題。兩組 5 分鐘後回來。</p>`
      : `${tq}你兩題都對了，在 B 組。想一想：為什麼大家常在這一步錯？等一下講給隊友聽。</p></div>
        <div class="card mint"><b>B 組挑戰</b><p class="body">${mt(sk.board.note)} 用你自己的例子說說看。</p></div>`;
  }
  if (seg === 'teach') {
    const r = ui.teachRes;
    return `${tq}兩兩一組。${esc(ctx.state.student.name)}講給${esc(buddy.name)}聽，我在旁邊聽。</p></div>
      <div class="card tight"><b>${mt(sk.explain.prompt)}</b>
        <label class="sr" for="teachIn">講給隊友聽</label>
        <textarea class="input ta" id="teachIn" rows="3" maxlength="240" placeholder="打字，或按「示範語音」" data-input="teachType">${esc(ui.teachText)}</textarea>
        <div class="btnrow"><button class="btn ghost s" data-act="teachVoice" ${ui.typing ? 'disabled' : ''}>${icon('mic')}示範語音</button><button class="btn s" data-act="teachDone" ${ui.typing ? 'disabled' : ''}>講完了</button></div>
      </div>
      ${r ? `<div class="bub coach">${mt(r.feedback)}</div>
        <div class="tbub mate">${avatar(buddy, 's')}<p>${r.pass ? `喔～所以是「${esc(r.hits[0])}」。我懂了。` : '我有點懂，可是還不太確定為什麼。'}</p></div>` : ''}`;
  }
  // got
  const labels = sk.explain.concepts.map((c) => c.label);
  return `${tq}最後一句：今天你搞懂的是什麼？一句就好。</p></div>
    <div class="chips">${labels.map((l) => `<button class="chipbtn" data-act="gotPick" data-v="${esc(l)}" aria-pressed="${ui.got === l}">${mt(l)}</button>`).join('')}</div>
    <label class="field"><span>或自己寫</span><input class="input" id="gotIn" maxlength="40" value="${esc(ui.got)}" data-input="gotType" autocomplete="off"></label>`;
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
    meta: { title: '小隊課教室', tips: ['六段：暖身 5 → 大家常錯的 10 → 自己試試 10 → 再帶一次 5 → 講給隊友聽 15 → 我搞懂的 5。', '時間會自己走（1 秒＝1 分鐘），也可以按「下一段」快轉。', '下課後會產生課堂紀錄，也會出現在家長的 LINE。'] },
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
        const b = document.getElementById('clsBar'); if (b) b.style.width = `${(ui.min / TOTAL) * 100}%`;
      }, 1000);
      return () => { clearInterval(ui.timer); if (ui.typing) { clearInterval(ui.typing); ui.typing = null; } if (mq && mq.removeEventListener) mq.removeEventListener('change', onChange); };
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
        return `<div class="pad pb">
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
      if (!isWide()) return phoneNotice(L);
      const seg = SEGMENTS[ui.seg];
      const problems = weekProblems(state, sq, L);
      return `<div class="pad pb classroom wide">
        <div class="abar"><button class="iconbtn" data-act="leave" aria-label="離開教室">${icon('x')}</button><span class="abar-t">第 ${L.week} 堂 · ${esc(SKILLS[L.skill].short)}</span><span class="abar-r num" id="clsClock">${clockText(ui.min)}</span></div>
        <div class="cls-bar" aria-hidden="true"><i id="clsBar" style="width:${(ui.min / TOTAL) * 100}%"></i></div>
        <ol class="segs" aria-label="這堂課的六段">${SEGMENTS.map((s, i) => `<li class="${i < ui.seg ? 'past' : i === ui.seg ? 'on' : ''}" ${i === ui.seg ? 'aria-current="step"' : ''}><b>${s.name}</b><small class="num">${s.min} 分</small></li>`).join('')}</ol>
        <div class="cls-grid">
          <section class="cls-board" aria-label="白板">
            <div class="cls-three"><b>這週要解的 3 題</b><ol>${problems.map((p) => `<li class="${p.skill === L.skill ? 'on' : ''}">${fx(p.text)}<small>${esc(p.source)}</small></li>`).join('')}</ol></div>
            <div class="cls-now"><span class="pill">目前段落</span><h1 class="h2" tabindex="-1">${seg.name}<small class="num"> · ${seg.min} 分鐘</small></h1></div>
            <div class="segbody">${segBody(ctx, L, sq)}</div>
          </section>
          ${sidePanel(ctx, L, sq)}
        </div>
        <div class="cls-ctrl" role="group" aria-label="老師控制列（示範）">
          <span class="lbl">老師控制列 · 示範</span>
          <button class="btn s ghost" data-act="rollcall" aria-pressed="${ui.rollcall}">${icon('users')}點名</button>
          <button class="btn s ghost" data-act="splitGroups" aria-pressed="${!!ui.groups}">${icon('route')}分兩組</button>
          <button class="btn s" data-act="nextSeg">${ui.seg === SEGMENTS.length - 1 ? '下課' : `下一段：${SEGMENTS[ui.seg + 1].name}`}${icon('forward')}</button>
        </div>
      </div>`;
    },
    on: {
      leave(ctx) { ctx.go('s/squad'); },
      copyLink(ctx) {
        const url = location.href;
        const done = () => ctx.toast('已複製教室連結。貼到 iPad 或電腦的瀏覽器就能開。');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => ctx.toast('無法自動複製，請長按上面的連結複製。'));
        else ctx.toast('無法自動複製，請長按上面的連結複製。');
      },
      rollcall(ctx) { ui.rollcall = !ui.rollcall; ctx.rerender(); if (ui.rollcall) ctx.toast('點名完成：全員出席。'); },
      splitGroups(ctx) {
        const L = lessonInfo(ctx.state);
        if (ui.groups) { ui.groups = null; ctx.rerender(); return; }
        ui.groups = {};
        ctx.state.squad.members.forEach((mm) => { ui.groups[mm.id] = (mm.stuck || []).includes(L.skill) ? 'A' : 'B'; });
        ctx.rerender();
        ctx.toast('依這週的卡點分成 A／B 兩組。');
      },
      warm(ctx, el) { ui.warm = Number(el.dataset.i); ctx.rerender(); },
      try(ctx, el) { ui.tries[Number(el.dataset.p)] = Number(el.dataset.i); ctx.rerender(); },
      teachType(ctx, el) { ui.teachText = el.value; },
      teachVoice(ctx) {
        const L = lessonInfo(ctx.state);
        const full = SKILLS[L.skill].explain.sample;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { ui.teachText = full; ctx.rerender(); return; }
        let i = 0; ui.teachText = ''; ctx.rerender();
        ui.typing = setInterval(() => {
          i += 3; ui.teachText = full.slice(0, i);
          const ta = document.getElementById('teachIn'); if (ta) ta.value = ui.teachText;
          if (i >= full.length) { clearInterval(ui.typing); ui.typing = null; ctx.rerender(); }
        }, 45);
      },
      teachDone(ctx) {
        const ta = document.getElementById('teachIn'); if (ta) ui.teachText = ta.value;
        const L = lessonInfo(ctx.state);
        ui.teachRes = evaluateExplanation(L.skill, ui.teachText);
        ctx.rerender();
      },
      gotPick(ctx, el) { ui.got = el.dataset.v; ctx.rerender(); },
      gotType(ctx, el) { ui.got = el.value; },
      nextSeg(ctx) {
        if (ui.seg < SEGMENTS.length - 1) {
          ui.seg += 1; ui.min = Math.max(ui.min, START[ui.seg]);
          ctx.rerender({ focusTitle: true, top: true });
          return;
        }
        const gi = document.getElementById('gotIn'); if (gi && gi.value.trim()) ui.got = gi.value.trim();
        const L = lessonInfo(ctx.state);
        const sk = SKILLS[L.skill];
        const tryOk = sk.practice.filter((p, i) => ui.tries[i] === p.ok).length;
        ui.finished = true; ui.min = TOTAL;
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
