// coach.js — 小陪（示範模式）：前端規則引擎＋預寫對話
// 原則：說話用「我」、句子短、先觀察再建議、永遠不直接給答案（最多用別的題目示範一步）、22:30 後不出聲。

import { SKILLS } from './content.js';
import { isLightsOut, daysBetween, isRetestReady, isExamWeek, daysSinceLast, daysSincePrior, fmtMD, DAILY_CAP } from './state.js';

export const TIERS = ['示範一步', '提示', '自己做'];

/** 把輸入整理成可比對的形式：去空白、統一負號與括號、全形轉半形 */
export function normalize(s) {
  return String(s || '')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[−–—﹣]/g, '-')
    .replace(/[×＊*]/g, '·')
    .replace(/\^2/g, '²')
    .replace(/[，,、]/g, '和')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/** 檢查一步的作答 */
export function checkStep(step, input) {
  const n = normalize(input);
  if (!n) return { ok: false, empty: true };
  if (step.accept.some((a) => normalize(a) === n)) return { ok: true };
  const w = (step.wrong || []).find((x) => normalize(x.match) === n);
  return { ok: false, say: w ? w.say : null };
}

/**
 * 開一段「拍題問小陪」。tier：0＝完全沒頭緒（先示範一步）、1＝有點想法（給提示）、2＝自己做
 */
export function newSession(skillId, tier = 1) {
  const sk = SKILLS[skillId];
  return {
    skill: skillId, startTier: tier, step: 0, hints: 0, demos: tier === 0 ? 1 : 0, wrongs: 0,
    hintLevel: 0, done: false,
    msgs: [
      { who: 'coach', text: `我看到這一題了：${sk.coach.prompt}。我不會直接給答案，我們一步一步來。` },
      ...introForTier(sk, 0, tier),
    ],
  };
}

/** 這一步用哪一種幫忙：從選的起點開始，每走一步放手一點（示範一步→提示→自己做） */
export function tierForStep(session, stepIndex = session.step) {
  return Math.min(2, session.startTier + stepIndex);
}

function introForTier(sk, stepIndex, tier) {
  const step = sk.coach.steps[stepIndex];
  const out = [];
  if (tier === 0) out.push({ who: 'coach', kind: 'demo', text: `先看我用別的題目示範這一步：${step.demo}` });
  out.push({ who: 'coach', text: step.ask, ask: true });
  return out;
}

/** 回答目前這一步 */
export function answer(session, input) {
  if (session.done) return session;
  const sk = SKILLS[session.skill];
  const step = sk.coach.steps[session.step];
  const s = { ...session, msgs: [...session.msgs, { who: 'me', text: input }] };
  const r = checkStep(step, input);
  if (r.ok) {
    s.step = session.step + 1;
    s.hintLevel = 0;
    s.wrongs = 0;
    if (s.step >= sk.coach.steps.length) {
      s.done = true;
      s.msgs.push({ who: 'coach', kind: 'done', text: `你自己解完了：${sk.coach.final}。我沒有給你答案，只問了你問題。` });
    } else {
      s.msgs.push({ who: 'coach', text: ['對。', '嗯，這步對了。', '沒錯。'][s.step % 3] });
      const tier = tierForStep(s);
      s.msgs.push(...introForTier(sk, s.step, tier).map((m) => ({ ...m, step: s.step })));
      if (tier === 0) s.demos += 1;
    }
  } else {
    s.wrongs = session.wrongs + 1;
    const say = r.say || '我先不說對錯。你是怎麼想的？再看一次題目這一步在問什麼。';
    s.msgs.push({ who: 'coach', text: say });
    if (s.wrongs >= 2 && tierForStep(s) === 2) s.msgs.push({ who: 'coach', text: '卡住兩次了。要的話可以按「給我提示」，我只推一下。' });
  }
  return s;
}

/** 要一次提示：輕推 → 問一句 → 用別的題目示範一步。每次都記下來。 */
export function hint(session) {
  if (session.done) return session;
  const sk = SKILLS[session.skill];
  const step = sk.coach.steps[session.step];
  const level = session.hintLevel;
  let text;
  if (level < step.hints.length) text = step.hints[level];
  else text = `我用別的題目示範這一步：${step.demo}。換你做原本那題。`;
  return {
    ...session,
    hints: session.hints + 1,
    hintLevel: Math.min(level + 1, step.hints.length),
    msgs: [...session.msgs, { who: 'coach', kind: 'hint', text }],
  };
}

export function helpCount(session) { return session.hints + session.demos; }

// ——— 說給我聽：規則比對關鍵概念 ———
export function evaluateExplanation(skillId, text) {
  const ex = SKILLS[skillId].explain;
  const n = normalize(text);
  const hits = [];
  const missing = [];
  for (const c of ex.concepts) (c.re.test(n) ? hits : missing).push(c.label);
  const tooShort = n.length < 12;
  const pass = !tooShort && hits.length >= ex.need;
  let feedback;
  if (tooShort) feedback = '我聽到的有點短。試著多講一句「為什麼」，30 秒內就好。';
  else if (pass && missing.length === 0) feedback = `我聽到了「${hits.join('」「')}」。講得很完整。`;
  else if (pass) feedback = `我聽到了「${hits.join('」「')}」。夠清楚了。如果再補一句「${missing[0]}」會更完整。`;
  else if (hits.length) feedback = `我聽到了「${hits[0]}」。還差一點：你能再說說「${missing[0]}」嗎？`;
  else feedback = `我還沒聽到重點。提示你一個方向：想想「${ex.concepts[0].label}」。`;
  return { pass, hits, missing, feedback, score: hits.length, need: ex.need };
}

// ——— 首頁小陪的一句話 ———
export function isQuiet(time) { return isLightsOut(time); }

export function homeLine(state) {
  const { clock, student: st, squad } = state;
  if (isQuiet(clock.time)) return null; // 22:30 後不出聲
  const today = clock.date;
  if (isComeback(st.log, today)) return '回來了就好。今天我只排一件小事。';
  if (!st.diag.done) return '先讓我知道你卡在哪一步。不是考試，沒有分數。';
  const ready = Object.entries(st.skills).find(([, v]) => isRetestReady(v, today));
  if (ready) return `「${SKILLS[ready[0]].title}」過了 ${daysBetween(ready[1].explainedAt, today)} 天。今天再測一次，這次不給提示。`;
  if (isExamWeek(today, st.examDate)) return `離段考 ${daysBetween(today, st.examDate)} 天。不加量，照平常的步調就好。`;
  if (!squad || !st.joined) return '你的卡點找到了。點幾格有空的時間，我幫你找隊友。';
  const focus = focusSkill(st);
  if (focus) return `今天從「${SKILLS[focus].title}」開始，15 分鐘就好。`;
  const next = Object.entries(st.skills).find(([, v]) => v.status === 'green');
  if (next) return `「${SKILLS[next[0]].title}」${fmtMD(next[1].retestDue)} 再測。今天輕鬆練就好。`;
  return '今天沒有要趕的。想練再來找我。';
}

/** 現在最該練的卡點：先卡住的、再練習中的 */
export function focusSkill(st) {
  const order = [...(st.diag.stuck || []), ...Object.keys(st.skills)];
  const seen = new Set();
  for (const k of order) {
    if (seen.has(k)) continue; seen.add(k);
    const s = st.skills[k];
    if (s && (s.status === 'stuck' || s.status === 'learning')) return k;
  }
  return null;
}


// ——— 今天的練習（有上限，不超量） ———
const KIND_LABEL = { ask: '拍一題問小陪', explain: '說給我聽', retest: '再測', transfer: '換一題' };
export function todayPlan(state) {
  const st = state.student;
  const today = state.clock.date;
  const doneLog = (st.log || []).filter((l) => l.date === today && l.counts !== false);
  const done = doneLog.map((l) => ({ kind: l.kind, skill: l.skill, title: `${KIND_LABEL[l.kind] || '練習'}：${SKILLS[l.skill] ? SKILLS[l.skill].short : ''}`, ok: l.ok, done: true }));
  const items = [];
  for (const [k, v] of Object.entries(st.skills)) {
    if (isRetestReady(v, today)) items.push({ kind: 'retest', skill: k, title: `再測：${SKILLS[k].title}`, sub: '不給提示 · 約 3 分鐘', go: `s/retest/${k}` });
  }
  const f = focusSkill(st);
  if (f) {
    const s = st.skills[f];
    const ask = { kind: 'ask', skill: f, title: `拍一題問小陪：${SKILLS[f].short}`, sub: '我一步一步問，不給答案 · 約 8 分鐘', go: `s/ask/${f}` };
    const explain = { kind: 'explain', skill: f, title: '說給我聽', sub: `用自己的話講「${SKILLS[f].title}」· 30 秒`, go: `s/explain/${f}` };
    if (s.status === 'stuck') items.push(ask, explain); else items.push(explain, { ...ask, title: `再練一題：${SKILLS[f].short}` });
  }
  const examWeek = isExamWeek(today, st.examDate);
  const cap = isComeback(st.log, today) ? 1 : DAILY_CAP; // 隔了兩天以上回來：今天只排一件
  const remaining = Math.max(0, cap - done.length);
  return { done, todo: items.slice(0, remaining), cap, count: done.length, full: remaining === 0, examWeek };
}

/** 隔了兩天以上才回來，而且今天還沒做任何事 */
export function isComeback(log, today) {
  const gap = daysSincePrior(log, today);
  const doneToday = daysSinceLast(log, today) === 0;
  return gap !== null && gap >= 2 && !doneToday;
}
