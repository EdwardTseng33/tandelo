// report.js — 由學生端的實際狀態，產生家長 LINE 的訊息與週報（純函式）

import { SKILLS, TEACHER, syllabus, sumCounts, CHAPTERS } from './content.js';
import { addDays, weekday, daysBetween, fmtMD, fmtMDW, PLANS, lessonDates, planTotal } from './state.js';
import { focusSkill } from './coach.js';

export function weekRange(today) {
  const start = addDays(today, -weekday(today));
  return { start, end: addDays(start, 6) };
}

/** 最近碰過的卡點（給「今晚可以問他這一句」） */
export function recentSkill(st) {
  const log = [...(st.log || [])].reverse().find((l) => l.skill);
  if (log) return log.skill;
  const lesson = [...(st.lessons || [])].reverse()[0];
  if (lesson) return lesson.skill;
  return focusSkill(st) || st.diag.stuck[0] || null;
}

export function weeklySummary(state) {
  const st = state.student;
  const today = state.clock.date;
  const { start, end } = weekRange(today);
  const inWeek = (d) => d && daysBetween(start, d) >= 0 && daysBetween(d, end) >= 0;
  const log = (st.log || []).filter((l) => inWeek(l.date));
  const days = new Set(log.map((l) => l.date)).size;
  const explains = log.filter((l) => l.kind === 'explain' && l.ok).length;
  const hints = log.reduce((a, l) => a + (l.hints || 0), 0);
  const learned = Object.entries(st.skills).filter(([, v]) => v.status === 'gold' && inWeek(v.masteredAt)).map(([k]) => SKILLS[k].title);
  const explained = Object.entries(st.skills).filter(([, v]) => v.status === 'green').map(([k, v]) => ({ title: SKILLS[k].title, due: v.retestDue }));
  const lessonsThisWeek = (st.lessons || []).filter((l) => inWeek(l.doneOn || l.date));
  let next = null;
  if (state.squad && state.squad.firstDate) {
    const sy = syllabus(st.diag.stuck.length ? st.diag.stuck : ['sq-cross'], st.grade);
    const dates = lessonDates(state.squad.firstDate, 8);
    const idx = Math.min(7, (st.lessons || []).length);
    next = { date: dates[idx], topic: sy[idx].topic, week: idx + 1 };
  }
  const sk = recentSkill(st);
  return { start, end, days, explains, hints, learned, explained, lessons: lessonsThisWeek.length, next, tonight: sk ? SKILLS[sk].tonight : null };
}

/**
 * 家長 LINE 的訊息串（由舊到新）。每則：{ id, when, kind, ... }
 */
export function parentFeed(state) {
  const st = state.student;
  const sq = state.squad;
  const name = st.name;
  const out = [];
  out.push({ id: 'hello', when: '示範開始', kind: 'text', text: `這裡是 Tandelo（示範）。${name}的學習會傳到這裡，你不用裝 App。` });

  if (st.diag.done) {
    const s = st.diag.stuck.map((k) => SKILLS[k]);
    out.push({
      id: 'diag', when: '初步診斷', kind: 'diag',
      title: st.diag.allClear ? `${name}做完初步診斷：沒有明顯卡點` : `${name}做完初步診斷`,
      lines: st.diag.allClear
        ? ['8 題都答對了。小陪會從學校正在教的因式分解開始，把它練穩。']
        : s.map((k) => `卡在「${k.title}」：${k.why}`),
      quote: st.diag.allClear ? null : `他不是數學不好，他卡在${s.length === 1 ? '一步' : '兩步'}。`,
    });
  }

  if (st.plan) {
    const p = PLANS[st.plan.id];
    out.push({
      id: 'plan', when: '加入', kind: 'plan',
      title: `${name}加入了小隊：${p.name}`,
      plan: p, plus: st.plan.plus, total: planTotal(st.plan.id, st.plan.plus),
      slot: sq ? sq.slot : null, first: sq ? sq.firstDate : null,
    });
  }

  if (sq && sq.status === 'formed') {
    out.push({ id: 'formed', when: '成班', kind: 'text', title: '成班了', text: `${TEACHER.name}接下這一隊。第一堂 ${fmtMDW(sq.firstDate)}，是試上：不滿意不收費，你可以在旁邊一起看。` });
  }

  for (const l of st.lessons || []) {
    const sess = state.teacher.sessions.find((x) => x.week === l.week);
    out.push({
      id: `lesson-${l.week}`, when: `第 ${l.week} 堂 · ${fmtMD(l.date)}`, kind: 'lesson',
      title: l.explainPass ? `今天他講得出「${SKILLS[l.skill].title}」了` : `今天小隊課練了「${SKILLS[l.skill].title}」`,
      got: l.got,
      teacher: sess && sess.note ? sess.note : null,
      tonight: SKILLS[l.skill].tonight,
    });
  }

  for (const [k, v] of Object.entries(st.skills)) {
    if (v.status === 'gold') {
      out.push({ id: `gold-${k}`, when: fmtMD(v.masteredAt), kind: 'gold', title: `翻過去了：${SKILLS[k].title}`, text: `隔了 ${v.gap || 7} 天、不給任何提示，他還會。這一點變成金色；之後如果又錯，會自動回到練習清單。`, tonight: SKILLS[k].tonight });
    }
  }

  if (st.diag.done) {
    const w = weeklySummary(state);
    out.push({ id: `weekly-${w.start}`, when: `週報 · ${fmtMD(w.start)}–${fmtMD(w.end)}`, kind: 'weekly', ...w });
  }

  if (st.exams.after && st.exams.before) {
    const b = st.exams.before.counts; const a = st.exams.after.counts;
    const rows = CHAPTERS.map((c) => ({ name: c.name, before: b[c.id], after: a[c.id] })).filter((r) => r.before || r.after);
    out.push({ id: 'exam', when: '段考對照', kind: 'exam', rows, before: sumCounts(b), after: sumCounts(a) });
  }
  return out;
}
