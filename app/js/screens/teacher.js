// 老師：接班卡 → 課前一頁 → 教室 → 課後 30 秒紀錄 → 收入

import { esc, icon, mt, avatar, duo, money, num, backBar } from '../ui.js';
import { SKILLS, SKILL_ORDER, TEACHER, buildSquad, slotLabel, parseSlot, syllabus, prepCandidates, skillCounts, SEGMENTS } from '../content.js';
import {
  TIERS, FLOOR, lessonPay, squadTuition, perLessonTuition, firstLessonDate, lessonDates, fmtMD, fmtMDW, addDays, weekday, daysBetween, squadRule, PLANS,
} from '../state.js';

// ——— 共用：這一隊（學生端還沒湊隊時，給一個預覽隊） ———
export function teacherSquad(state) {
  if (state.squad) return { sq: state.squad, preview: false };
  const st = state.student;
  const stuck = st.diag.stuck.length ? st.diag.stuck : ['sign-dist', 'sq-cross'];
  const slot = 'd2-1900';
  const p = parseSlot(slot);
  const sq = buildSquad({ name: st.name, stuck, slot, firstDate: firstLessonDate(state.clock.date, state.clock.time, p.day, p.time) });
  sq.members[0].plan = '8';
  return { sq, preview: true };
}
/** 每位學生目前的卡點（自己的那位用學生端的即時狀態） */
function liveMembers(state, sq) {
  return sq.members.map((mm) => {
    if (!mm.isMe) return mm;
    const live = Object.entries(state.student.skills).filter(([, v]) => v.status === 'stuck' || v.status === 'learning').map(([k]) => k);
    return { ...mm, name: state.student.name, stuck: state.student.diag.done ? live : mm.stuck };
  });
}
function currentWeek(state) { return state.teacher.sessions.length + 1; }
function stuckOf(state, sq) { return (state.student.diag.stuck.length ? state.student.diag.stuck : sq.members[0].stuck); }
function weekTopic(state, sq, week) {
  const sy = syllabus(stuckOf(state, sq), state.student.grade);
  return sy[Math.min(7, week - 1)];
}
function notFormed() {
  return `<div class="pad center-col lo">${duo('idle', 'l')}<h1 class="hero s center" tabindex="-1">還沒有成班的隊。</h1>
    <p class="sub center">先到「接班」看小陪湊好的隊，按「接這一隊」才成班。</p><button class="btn" data-go="t/offer">看接班卡</button></div>`;
}
function tierName(state) { return (TIERS[state.teacher.tier] || TIERS.gold).name; }

// ——— 接班卡 ———
const offer = {
  tab: 't/offer',
  meta: { title: '接班卡', tips: ['卡點分布、時段、人數與收入都寫在卡上；老師按「接這一隊」才成班，學生端會同步看到。', '收入＝學費 × 等級分潤（新手 45%／黃金 52%／鑽石 60%），每堂保底 600。'] },
  render(ctx) {
    const { state } = ctx;
    const { sq, preview } = teacherSquad(state);
    const members = liveMembers(state, sq);
    const n = members.length;
    const pay = lessonPay(squadTuition(members), state.teacher.tier);
    if (sq.status === 'formed') {
      const w = currentWeek(state);
      const dates = lessonDates(sq.firstDate, 8);
      return `<div class="pad pbt">
        <div class="abar"><span class="abar-t">接班</span><span class="pill g">已成班</span></div>
        <h1 class="hero m" tabindex="-1">${state.student.grade}上數學<br>${esc(SKILLS[stuckOf(state, sq)[0]].short)}隊</h1>
        <p class="sub">${n} 人 · 每${esc(slotLabel(sq.slot))} · 8 週</p>
        <div class="avs">${members.map((mm) => `<div class="avcap">${avatar(mm, 'm')}<small>${esc(mm.name)}</small></div>`).join('')}</div>
        <div class="card"><div class="sec-h"><b>下一堂 · 第 ${Math.min(8, w)} 週</b><span class="num">${fmtMDW(dates[Math.min(7, w - 1)])}</span></div><p class="body">${mt(weekTopic(state, sq, w).topic)}</p>
          <div class="btnrow"><button class="btn s" data-go="t/prep">看課前一頁</button><button class="btn s ghost" data-go="t/room">進教室</button></div></div>
        <div class="card mint"><b>接下來你不用做的事</b><p class="body">不用建群組、不用排時間、不用收錢、不用出講義。上課前一晚，你會收到課前一頁。</p></div>
        <div class="kv">${icon('coin')}<div><b>每堂 ${money(pay.pay)}</b><small>${tierName(state)}分潤 ${Math.round(pay.rate * 100)}% · 8 週約 ${money(pay.pay * 8)}</small></div></div>
      </div>`;
    }
    if (state.teacher.declined) {
      return `<div class="pad center-col lo">${duo('idle', 'l')}<h1 class="hero s center" tabindex="-1">好，這次不接。</h1>
        <p class="sub center">小陪會改問下一位老師，不扣分、不影響你的等級。</p>
        <button class="btn ghost" data-act="undoDecline">我改變主意了</button></div>`;
    }
    const counts = skillCounts(members);
    const max = Math.max(...counts.map((c) => c.count), 1);
    const table = [3, 4, 5, 6].map((k) => {
      const p = lessonPay(k * perLessonTuition('8'), state.teacher.tier);
      return `<tr class="${k === n ? 'on' : ''}"><td class="num">${k} 人</td><td class="num">${money(p.pay)}${p.floored ? '<span class="chip">保底</span>' : ''}</td><td>${esc(squadRule(k).label)}</td></tr>`;
    }).join('');
    return `<div class="pad pb">
      <div class="abar"><span class="abar-t">接班</span><span class="pill c">保留 6 小時（示範）</span></div>
      <p class="eyebrow">有一隊很適合你</p>
      <h1 class="hero m" tabindex="-1">${state.student.grade}上數學 · 補基礎</h1>
      <p class="sub">${n} 人 · 每${esc(slotLabel(sq.slot))} · 8 週 · 對準 ${fmtMD(state.student.examDate)} 段考<br>第一堂 ${fmtMDW(sq.firstDate)}（試上）</p>
      <div class="card offer">
        <div class="sec-h"><div><small class="fine left">這一隊每堂</small><div class="money num">${num(pay.pay)} <small>元</small></div></div><span class="pill g">${tierName(state)} ${Math.round(pay.rate * 100)}%</span></div>
        <p class="body">學費每堂合計 ${money(pay.tuition)} × ${Math.round(pay.rate * 100)}% ＝ ${money(pay.share)}${pay.floored ? `，低於保底，以 ${money(FLOOR)} 計` : ''}。8 週約 ${money(pay.pay * 8)}。</p>
      </div>
      <div class="card"><b>卡點分布</b>
        ${counts.map((c) => `<div class="dist"><span>${esc(SKILLS[c.skill].title)}</span><span class="dbar"><i style="width:${(c.count / max) * 100}%"></i></span><b class="num">${c.count}</b></div>`).join('')}
        <small class="fine left">${counts[0] ? `起點是「${esc(SKILLS[counts[0].skill].short)}」：${counts[0].count} 人卡在同一步。` : ''}</small>
      </div>
      <div class="card"><b>這幾個人</b>
        <div class="avs">${members.map((mm) => `<div class="avcap">${avatar(mm, 'm')}<small>${esc(mm.name)}</small></div>`).join('')}</div>
        <small class="fine left">只顯示暱稱。其中一位已經會了，可以當「講的人」。</small>
      </div>
      <div class="card"><b>人數與收入（8 團學費試算）</b>
        <table class="tbl"><thead><tr><th>人數</th><th>每堂</th><th>規則</th></tr></thead><tbody>${table}</tbody></table>
        <small class="fine left">人數少，收入就少；每堂保底 ${money(FLOOR)}。另有學會獎金、續走獎金、代課加給，期末結算。</small>
      </div>
      <div class="dock">
        <button class="btn block" data-act="accept">接這一隊</button>
        <button class="btn ghost block" data-act="decline">這次不接</button>
      </div>
      ${preview ? '<p class="fine">示範：學生端還沒湊隊，這是用示範資料預先湊好的一隊。</p>' : ''}
    </div>`;
  },
  on: {
    accept(ctx) {
      const { sq, preview } = teacherSquad(ctx.state);
      ctx.update((s) => {
        if (preview) s.squad = sq;
        s.squad.status = 'formed'; s.squad.acceptedAt = s.clock.date;
        s.teacher.declined = false;
      });
      ctx.burst();
      ctx.toast(ctx.state.student.joined ? '成班了。學生的首頁已經出現這一隊。' : '成班了（示範）。');
    },
    decline(ctx) { ctx.update((s) => { s.teacher.declined = true; }); },
    undoDecline(ctx) { ctx.update((s) => { s.teacher.declined = false; }); },
  },
};

// ——— 課前一頁 ———
function prepFor(state, sq) {
  const week = currentWeek(state);
  const cands = prepCandidates(liveMembers(state, sq), state.student.questions.filter((q) => q.week >= week - 1));
  let prep = state.teacher.prep;
  if (!prep || prep.week !== week) prep = { week, picks: cands.slice(0, 3).map((c) => c.id), confirmed: false };
  prep.picks = prep.picks.filter((id) => cands.some((c) => c.id === id));
  for (const c of cands) { if (prep.picks.length >= 3) break; if (!prep.picks.includes(c.id)) prep.picks.push(c.id); }
  return { week, cands, prep };
}
const prep = {
  tab: 't/prep',
  meta: { title: '課前一頁', tips: ['「這週要解的 3 題」由這一隊的卡點和學生匿名丟的問題彙整。', '可以按「換一題」，確認後學生的小隊頁會出現這 3 題。'] },
  render(ctx) {
    const { state } = ctx;
    const { sq } = teacherSquad(state);
    if (sq.status !== 'formed') return notFormed();
    const { week, cands, prep: p } = prepFor(state, sq);
    const members = liveMembers(state, sq);
    const topic = weekTopic(state, sq, week);
    const top = SKILLS[topic.skill];
    return `<div class="pad pb">
      <div class="abar"><span class="abar-t">課前一頁</span><span class="pill">${p.confirmed ? '已確認' : '讀完約 2 分鐘'}</span></div>
      <p class="eyebrow">第 ${Math.min(8, week)} 週 · ${fmtMDW(lessonDates(sq.firstDate, 8)[Math.min(7, week - 1)])}</p>
      <h1 class="hero s" tabindex="-1">${mt(topic.topic)}</h1>
      <div class="card mint"><b>建議的開場</b><p class="body">先別講規則。用暖身題「${mt(top.warm.q)}」讓他們自己發現不一樣，再進「大家常錯的」。小陪的建議你都可以不採用。</p></div>
      <h2 class="h3">這週要解的 3 題</h2>
      ${p.picks.map((id, i) => {
    const c = cands.find((x) => x.id === id);
    return `<div class="card prob"><span class="pn num">${i + 1}</span><div><b>${mt(c.text)}</b><small class="chip ${c.skill ? 'c' : ''}">${esc(c.source)}</small></div>
          ${p.confirmed ? '' : `<button class="btn ghost s" data-act="swap" data-i="${i}" ${cands.length <= 3 ? 'disabled' : ''}>換一題</button>`}</div>`;
  }).join('')}
      <h2 class="h3">這 ${members.length} 個人</h2>
      ${members.map((mm) => `<div class="row static">${avatar(mm, 's')}<span><b>${esc(mm.name)}</b><small>${mm.stuck.length ? `卡在：${mm.stuck.map((k) => esc(SKILLS[k].short)).join('、')}` : '已經會了，請他當講的人'}</small></span><span class="chip ${mm.stuck.includes(topic.skill) ? 'c' : 'g'}">${mm.stuck.includes(topic.skill) ? 'A 組' : 'B 組'}</span></div>`).join('')}
      <div class="dock">${p.confirmed
    ? `<button class="btn block" data-go="t/room">進教室${ICON_ARROW()}</button><button class="btn ghost block" data-act="unconfirm">再改一下</button>`
    : '<button class="btn block" data-act="confirm">確認用這 3 題</button>'}</div>
    </div>`;
  },
  on: {
    swap(ctx, el) {
      const { sq } = teacherSquad(ctx.state);
      const { week, cands, prep: p } = prepFor(ctx.state, sq);
      const i = Number(el.dataset.i);
      const curIdx = cands.findIndex((c) => c.id === p.picks[i]);
      for (let k = 1; k <= cands.length; k++) {
        const c = cands[(curIdx + k) % cands.length];
        if (!p.picks.includes(c.id)) { p.picks[i] = c.id; break; }
      }
      ctx.update((s) => { s.teacher.prep = { week, picks: [...p.picks], confirmed: false }; });
    },
    confirm(ctx) {
      const { sq } = teacherSquad(ctx.state);
      const { week, cands, prep: p } = prepFor(ctx.state, sq);
      ctx.update((s) => { s.teacher.prep = { week, picks: [...p.picks], confirmed: true, titles: p.picks.map((id) => cands.find((c) => c.id === id).text) }; });
      ctx.toast('已確認。學生的小隊頁會看到這 3 題。');
    },
    unconfirm(ctx) { ctx.update((s) => { if (s.teacher.prep) s.teacher.prep.confirmed = false; }); },
  },
};
function ICON_ARROW() { return icon('arrow'); }

// ——— 教室 ———
const ATT = { present: '出席', late: '遲到', absent: '請假' };
const ATT_NEXT = { present: 'late', late: 'absent', absent: 'present' };
function roomFor(state, sq) {
  const week = currentWeek(state);
  let r = state.teacher.room;
  if (!r || r.week !== week) {
    const att = {}; sq.members.forEach((mm, i) => { att[mm.id] = i === 3 ? 'late' : 'present'; });
    r = { week, seg: 0, attendance: att, groups: null };
  }
  return r;
}
const room = {
  tab: 't/room',
  meta: { title: '教室', tips: ['點名：點狀態可以在出席／遲到／請假之間切換。', '「分兩小組」會依這一週的卡點自動分 A／B 組，點組別可以手動調。', '下課後寫 30 秒紀錄，會出現在學生的課堂紀錄與家長週報。'] },
  render(ctx) {
    const { state } = ctx;
    const { sq } = teacherSquad(state);
    if (sq.status !== 'formed') return notFormed();
    const r = roomFor(state, sq);
    const members = liveMembers(state, sq);
    const topic = weekTopic(state, sq, r.week);
    const here = members.filter((mm) => r.attendance[mm.id] !== 'absent').length;
    const meDone = state.student.lessons.find((l) => l.week === r.week);
    return `<div class="pad pb">
      <div class="abar"><span class="abar-t">第 ${Math.min(8, r.week)} 週 · 教室</span><span class="pill g num">${here} / ${members.length} 在線</span></div>
      <h1 class="hero s" tabindex="-1">${mt(topic.topic)}</h1>
      <ol class="segs" aria-label="這堂課的六段">${SEGMENTS.map((s, i) => `<li class="${i < r.seg ? 'past' : i === r.seg ? 'on' : ''}" ${i === r.seg ? 'aria-current="step"' : ''}><b>${s.name}</b><small class="num">${s.min} 分</small></li>`).join('')}</ol>
      <div class="btnrow"><button class="btn s ghost" data-act="segPrev" ${r.seg === 0 ? 'disabled' : ''}>上一段</button><button class="btn s" data-act="segNext" ${r.seg === SEGMENTS.length - 1 ? 'disabled' : ''}>下一段：${esc((SEGMENTS[r.seg + 1] || SEGMENTS[r.seg]).name)}</button></div>
      <div class="sec-h"><h2 class="h3">每個孩子的狀態</h2><button class="btn s ghost" data-act="split">${icon('users')}分兩小組</button></div>
      <div class="kids">${members.map((mm) => {
    const att = r.attendance[mm.id];
    const g = r.groups ? r.groups[mm.id] : null;
    const status = mm.isMe && meDone ? (meDone.explainPass ? '這堂講出來了' : '這堂還差一點') : mm.stuck.includes(topic.skill) ? `卡在：${SKILLS[topic.skill].short}` : mm.stuck.length ? '這週的點已經會了' : '已經會了，可以當講的人';
    return `<div class="kid ${att}">
          ${avatar(mm, 'm')}
          <div class="kid-b"><b>${esc(mm.name)}</b><small>${esc(status)}</small></div>
          <button class="att" data-act="att" data-id="${mm.id}" aria-label="${esc(mm.name)}：${ATT[att]}，點一下切換">${ATT[att]}</button>
          ${g ? `<button class="grp g${g}" data-act="grp" data-id="${mm.id}" aria-label="${esc(mm.name)} 在 ${g} 組，點一下換組">${g} 組</button>` : ''}
        </div>`;
  }).join('')}</div>
      ${r.groups ? `<p class="fine left">A 組：還卡在「${esc(SKILLS[topic.skill].short)}」，你帶著再走一次；B 組：先做挑戰題，最後一起講給隊友聽。</p>` : '<p class="fine left">上到「再帶一次」之前，按「分兩小組」。</p>'}
      <div class="dock"><button class="btn block" data-act="endClass">下課，寫 30 秒紀錄</button></div>
    </div>`;
  },
  on: {
    segPrev(ctx) { saveRoom(ctx, (r) => { r.seg = Math.max(0, r.seg - 1); }); },
    segNext(ctx) { saveRoom(ctx, (r) => { r.seg = Math.min(SEGMENTS.length - 1, r.seg + 1); }); },
    att(ctx, el) { saveRoom(ctx, (r) => { r.attendance[el.dataset.id] = ATT_NEXT[r.attendance[el.dataset.id]]; }); },
    split(ctx) {
      const { sq } = teacherSquad(ctx.state);
      const members = liveMembers(ctx.state, sq);
      const topic = weekTopic(ctx.state, sq, currentWeek(ctx.state));
      saveRoom(ctx, (r) => { r.groups = {}; members.forEach((mm) => { r.groups[mm.id] = mm.stuck.includes(topic.skill) ? 'A' : 'B'; }); });
      ctx.toast('依這週的卡點分好了。點組別可以手動調。');
    },
    grp(ctx, el) { saveRoom(ctx, (r) => { r.groups[el.dataset.id] = r.groups[el.dataset.id] === 'A' ? 'B' : 'A'; }); },
    endClass(ctx) { ctx.go('t/note'); },
  },
};
function saveRoom(ctx, fn) {
  const { sq } = teacherSquad(ctx.state);
  const r = JSON.parse(JSON.stringify(roomFor(ctx.state, sq)));
  fn(r);
  ctx.update((s) => { s.teacher.room = r; });
}

// ——— 課後 30 秒紀錄 ———
const noteUi = { left: 30, timer: null, saved: null };
const NOTE_CHIPS = ['你們互相講的那段，比我講的更有用。', '下週從變化題開始。', '還沒開口的同學，下次我先點他。', '分數前面有負號的題，下週再多練一題。'];
const note = {
  tabs: false,
  meta: { title: '課後 30 秒紀錄', tips: ['按「開始 30 秒」會倒數；打字或點建議句都可以。', '存起來之後，學生的課堂紀錄和家長 LINE 的課後卡都會帶到這段話。'] },
  enter() { noteUi.left = 30; noteUi.saved = null; },
  mount() { return () => { clearInterval(noteUi.timer); noteUi.timer = null; }; },
  render(ctx) {
    const { state } = ctx;
    const { sq } = teacherSquad(state);
    if (sq.status !== 'formed') return notFormed();
    if (noteUi.saved) {
      const s = noteUi.saved;
      return `<div class="pad pb"><div class="center-col tight">${duo('joy', 'l')}</div>
        <h1 class="hero s center" tabindex="-1">第 ${s.week} 週的紀錄存好了。</h1>
        <div class="card"><p class="body">「${esc(s.note)}」</p><small class="fine left">出席 ${Object.values(s.attendance).filter((a) => a !== 'absent').length} / ${Object.keys(s.attendance).length} 人</small></div>
        <div class="card mint"><b>接下來你不用做的事</b><p class="body">小陪會把這段話放進學生的課堂紀錄和家長週報，並把今天的錯題排進下週的課前一頁。</p></div>
        <div class="dock"><button class="btn block" data-go="t/income">看這堂的收入</button><button class="btn ghost block" data-go="t/prep">看下週的課前一頁</button></div></div>`;
    }
    const week = currentWeek(state);
    return `<div class="pad pb">
      ${backBar('下課了 · 說 30 秒', 't/room')}
      <h1 class="hero s" tabindex="-1">這堂課，你想留下什麼？</h1>
      <div class="rec">
        <div class="ring30" id="noteRing" style="--p:${1 - noteUi.left / 30}"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28"/><circle class="fg" cx="32" cy="32" r="28"/></svg><span class="num" id="noteLeft">${noteUi.left}</span><small>秒</small></div>
        <label class="sr" for="tNote">課後紀錄</label>
        <textarea class="input ta" id="tNote" rows="4" maxlength="200" placeholder="例：你們互相講的那段很好。下週從分數係數開始。"></textarea>
      </div>
      <div class="chips">${NOTE_CHIPS.map((c) => `<button class="chipbtn" data-act="addChip" data-v="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="btnrow"><button class="btn ghost s" data-act="startTimer" ${noteUi.timer ? 'disabled' : ''}>${icon('clock')}開始 30 秒</button></div>
      <p class="fine left">正式版是語音；這個示範用打字。第 ${Math.min(8, week)} 週。</p>
      <div class="dock"><button class="btn block" data-act="saveNote">存起來</button></div>
    </div>`;
  },
  on: {
    addChip(ctx, el) { const t = document.getElementById('tNote'); if (t) { t.value = (t.value ? `${t.value} ` : '') + el.dataset.v; t.focus(); } },
    startTimer() {
      if (noteUi.timer) return;
      noteUi.left = 30;
      document.querySelector('[data-act="startTimer"]')?.setAttribute('disabled', '');
      document.getElementById('tNote')?.focus();
      noteUi.timer = setInterval(() => {
        noteUi.left = Math.max(0, noteUi.left - 1);
        const l = document.getElementById('noteLeft'); if (l) l.textContent = noteUi.left;
        const r = document.getElementById('noteRing'); if (r) r.style.setProperty('--p', 1 - noteUi.left / 30);
        if (!noteUi.left) { clearInterval(noteUi.timer); noteUi.timer = null; }
      }, 1000);
    },
    saveNote(ctx) {
      const t = document.getElementById('tNote');
      const text = (t && t.value.trim()) || NOTE_CHIPS[0];
      const { sq } = teacherSquad(ctx.state);
      const r = roomFor(ctx.state, sq);
      const week = currentWeek(ctx.state);
      const date = lessonDates(sq.firstDate, 8)[Math.min(7, week - 1)];
      const rec = { week, date, attendance: r.attendance, groups: r.groups, note: text, picks: ctx.state.teacher.prep && ctx.state.teacher.prep.week === week ? ctx.state.teacher.prep.picks : [] };
      clearInterval(noteUi.timer); noteUi.timer = null;
      ctx.update((s) => { s.teacher.sessions.push(rec); s.teacher.room = null; }, { silent: true });
      noteUi.saved = rec;
      ctx.toast('存好了。學生的課堂紀錄與家長週報會帶到這段話。');
      ctx.rerender({ focusTitle: true, top: true });
    },
  },
};

// ——— 收入 ———
const OTHER_SQUADS = [
  { id: 'o1', name: '國三 · 會考複習隊', size: 5, weekday: 5, time: '10:00', plan: '8' },
  { id: 'o2', name: '國二 · 因式分解隊', size: 4, weekday: 4, time: '20:00', plan: '8' },
];
function monthLessons(state) {
  const today = state.clock.date;
  const ym = today.slice(0, 7);
  const first = `${ym}-01`;
  const days = Array.from({ length: 31 }, (_, i) => addDays(first, i)).filter((d) => d.slice(0, 7) === ym);
  const tier = state.teacher.tier;
  const rows = [];
  const { sq } = teacherSquad(state);
  if (sq.status === 'formed') {
    const members = liveMembers(state, sq);
    const pay = lessonPay(squadTuition(members), tier);
    lessonDates(sq.firstDate, 8).forEach((d, i) => {
      if (d.slice(0, 7) !== ym) return;
      const taught = state.teacher.sessions.some((s) => s.week === i + 1);
      rows.push({ date: d, name: `${SKILLS[stuckOf(state, sq)[0]].short}隊 · 第 ${i + 1} 週`, n: members.length, ...pay, done: taught || daysBetween(d, today) > 0 });
    });
  }
  for (const o of OTHER_SQUADS) {
    const pay = lessonPay(o.size * perLessonTuition(o.plan), tier);
    days.filter((d) => weekday(d) === o.weekday).forEach((d) => rows.push({ date: d, name: o.name, n: o.size, ...pay, done: daysBetween(d, today) > 0 }));
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
const income = {
  tab: 't/income',
  meta: { title: '收入與出帳', tips: ['切換等級看分潤變化：新手 45%、黃金 52%、鑽石 60%，每堂保底 600。', '另外兩隊是虛構的示範資料；這一隊依實際成班人數與方案計算。'] },
  render(ctx) {
    const { state } = ctx;
    const rows = monthLessons(state);
    const done = rows.filter((r) => r.done);
    const sum = (a) => a.reduce((x, r) => x + r.pay, 0);
    const [y, mo] = state.clock.date.split('-').map(Number);
    const nextPay = mo === 12 ? `${y + 1}/1/1` : `${mo + 1}/1`;
    return `<div class="pad pbt">
      <div class="abar"><span class="abar-t">收入</span><span class="pill">${mo} 月</span></div>
      <p class="eyebrow">本月估算</p>
      <h1 class="money big num" tabindex="-1">${money(sum(rows))}</h1>
      <div class="stat3">
        <div><b class="num">${money(sum(done))}</b><small>已上完 ${done.length} 堂</small></div>
        <div><b class="num">${money(sum(rows) - sum(done))}</b><small>預計還有 ${rows.length - done.length} 堂</small></div>
        <div><b class="num">${rows.length}</b><small>本月堂數</small></div>
      </div>
      <div class="field"><span>等級（試算）</span>
        <div class="seg" role="group" aria-label="老師等級">${Object.values(TIERS).map((t) => `<button data-act="tier" data-v="${t.id}" aria-pressed="${state.teacher.tier === t.id}">${t.name} ${Math.round(t.rate * 100)}%</button>`).join('')}</div>
      </div>
      <div class="card"><b>怎麼算</b><p class="body">每堂＝這一隊每位學生的每堂學費加總 × 分潤；低於 ${money(FLOOR)} 以保底計。人數少就少，接班卡上都會先寫清楚。</p></div>
      <h2 class="h3">出帳明細</h2>
      <div class="ledger">${rows.length ? rows.map((r) => `<div class="lg-row ${r.done ? '' : 'plan'}">
        <span class="num lg-d">${fmtMD(r.date)}</span>
        <span class="lg-n"><b>${esc(r.name)}</b><small>${r.n} 人 · 學費 ${money(r.tuition)} × ${Math.round(r.rate * 100)}%${r.floored ? ' · 保底' : ''}</small></span>
        <span class="lg-v"><b class="num">${money(r.pay)}</b><small>${r.done ? '已上' : '預計'}</small></span>
      </div>`).join('') : '<p class="fine left">這個月還沒有排課。</p>'}</div>
      <div class="card mint"><b>下次自動出帳：${nextPay}</b><p class="body">上個月已上完的全部收入，每月 1 日自動出帳，不用做任何事。學會獎金、續走獎金、代課加給於期末結算。</p><small class="fine left">示範資料，不會真的匯款；稅費依實際規定。</small></div>
    </div>`;
  },
  on: {
    tier(ctx, el) { ctx.update((s) => { s.teacher.tier = el.dataset.v; }); },
  },
};

export const screens = { 't/offer': offer, 't/prep': prep, 't/room': room, 't/note': note, 't/income': income };
