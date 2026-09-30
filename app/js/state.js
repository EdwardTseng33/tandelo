// state.js — 狀態結構、localStorage 存取、日期與金額的純函式
// 資料只存在這台裝置的 localStorage；不送到任何伺服器。

export const STORAGE_KEY = 'tandelo-poc-v1';
export const VERSION = 1;

export const DEMO_START = { date: '2026-10-04', time: '20:40' };

export function defaultState() {
  return {
    v: VERSION,
    role: null, // 'student' | 'parent' | 'teacher'
    theme: 'auto', // 'auto' | 'light' | 'dark'
    clock: { ...DEMO_START },
    student: {
      name: '小睿',
      grade: '國二',
      examDate: '2026-11-27',
      goal: '段考數學進步',
      minutes: 20,
      started: false, // 兩分鐘開始填完
      diag: { answers: {}, done: false, stuck: [], allClear: false },
      skills: {}, // { [skillId]: { status, hints, explainedAt, retestDue, masteredAt, fails } }
      slots: [],
      joined: false,
      plan: null, // { id, plus, total, paidAt }
      lessons: [], // 課堂紀錄
      log: [], // 每日練習紀錄 { date, kind, skill, hints, ok }
      questions: [], // 下週想問
      exams: {}, // { before: {date, counts}, after: {date, counts} }
      flip: null, // 剛翻過去的卡點（播動畫用）
    },
    squad: null,
    teacher: {
      tier: 'gold',
      declined: false,
      prep: null, // { week, picks: [candidateId], confirmed }
      room: null, // { week, seg, attendance, groups }
      sessions: [], // { week, date, attendance, groups, note, picks }
    },
    parent: { reactions: {} },
  };
}

export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    if (!s || s.v !== VERSION) return defaultState();
    // 補上新版本新增的欄位
    const d = defaultState();
    return { ...d, ...s, student: { ...d.student, ...s.student }, teacher: { ...d.teacher, ...s.teacher }, parent: { ...d.parent, ...s.parent } };
  } catch {
    return defaultState();
  }
}

export function save(state, storage = globalThis.localStorage) {
  try { storage && storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; }
}

// ——— 日期（一律用 UTC 計算，避免時區造成差一天） ———
const DAY = 864e5;
function utc(iso) { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); }
export function addDays(iso, n) { return new Date(utc(iso) + n * DAY).toISOString().slice(0, 10); }
export function daysBetween(a, b) { return Math.round((utc(b) - utc(a)) / DAY); }
/** 0 = 週一 … 6 = 週日 */
export function weekday(iso) { return (new Date(utc(iso)).getUTCDay() + 6) % 7; }
export const WD = ['一', '二', '三', '四', '五', '六', '日'];
export function fmtMD(iso) { const [, m, d] = iso.split('-').map(Number); return `${m}/${d}`; }
export function fmtMDW(iso) { return `${fmtMD(iso)}（${WD[weekday(iso)]}）`; }
export function fmtLong(iso) { const [, m, d] = iso.split('-').map(Number); return `${m} 月 ${d} 日 · 星期${WD[weekday(iso)]}`; }
export function minutesOf(t) { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; }

/** 22:30 之後到隔天 06:00 前：關燈 */
export function isLightsOut(time) {
  const m = minutesOf(time);
  return m >= 22 * 60 + 30 || m < 6 * 60;
}

/** 開課前 48 小時截止：找出第一堂的日期 */
export function firstLessonDate(nowDate, nowTime, slotDay, slotTime) {
  for (let i = 0; i < 14; i++) {
    const d = addDays(nowDate, i);
    if (weekday(d) !== slotDay) continue;
    const mins = i * 1440 + minutesOf(slotTime) - minutesOf(nowTime);
    if (mins >= 48 * 60) return d;
  }
  return addDays(nowDate, 14);
}
export function lessonDates(firstDate, n = 8) { return Array.from({ length: n }, (_, i) => addDays(firstDate, i * 7)); }

/** 距離某堂課還有多久（分鐘，可為負） */
export function minutesUntil(nowDate, nowTime, date, time) {
  return daysBetween(nowDate, date) * 1440 + minutesOf(time) - minutesOf(nowTime);
}
export function countdownLabel(mins) {
  if (mins <= -50) return '上課時間已過';
  if (mins <= 0) return '正在上課';
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `還有 ${d} 天 ${h} 小時`;
  if (h > 0) return `還有 ${h} 小時 ${m} 分`;
  return `還有 ${m} 分鐘`;
}

// ——— 學會：過 7–12 天再測 ———
/** 用的提示越多，越早再測；範圍 7–12 天 */
export function retestDays(hints) {
  const h = Math.max(0, Number(hints) || 0);
  return Math.min(12, Math.max(7, 12 - 2 * h));
}
export function retestDue(fromDate, hints) { return addDays(fromDate, retestDays(hints)); }
export function isRetestReady(skill, today) {
  return !!(skill && skill.status === 'green' && skill.retestDue && daysBetween(skill.retestDue, today) >= 0);
}

// ——— 每日上限與護欄 ———
export const DAILY_CAP = 3;
export function dailyDone(log, today) { return (log || []).filter((l) => l.date === today && l.counts !== false).length; }
export function isExamWeek(today, examDate) { const d = daysBetween(today, examDate); return d >= 0 && d <= 7; }
/** 最近 7 天有練習的日子（只數，不算連續，不羞辱中斷） */
export function activeDays(log, today) {
  const set = new Set((log || []).map((l) => l.date).filter((d) => { const x = daysBetween(d, today); return x >= 0 && x < 7; }));
  return Array.from({ length: 7 }, (_, i) => { const d = addDays(today, i - 6); return { date: d, on: set.has(d) }; });
}
/** 今天以前最後一次練習距今幾天（沒有紀錄回傳 null） */
export function daysSincePrior(log, today) {
  const past = (log || []).map((l) => l.date).filter((d) => daysBetween(d, today) > 0).sort();
  if (!past.length) return null;
  return daysBetween(past[past.length - 1], today);
}
export function daysSinceLast(log, today) {
  const past = (log || []).map((l) => l.date).filter((d) => daysBetween(d, today) >= 0).sort();
  if (!past.length) return null;
  return daysBetween(past[past.length - 1], today);
}

// ——— 方案與價格 ———
export const PLANS = {
  '4': { id: '4', name: '4 團', lessons: 4, price: 1790, desc: '4 堂小隊課，走到第 4 週結業點' },
  '8': { id: '8', name: '8 團', lessons: 8, price: 2990, desc: '一整期 8 堂小隊課，對準段考', main: true },
  '8+1': { id: '8+1', name: '8 團＋一對一', lessons: 8, price: 5990, groupPrice: 2990, desc: '8 堂小隊課＋老師一對一 2 小時' },
};
export const PLUS_PRICE = 299;
export function planTotal(planId, plus) { const p = PLANS[planId]; return p ? p.price + (plus ? PLUS_PRICE : 0) : 0; }
/** 每堂小隊課的學費（一對一那部分不算進小隊課） */
export function perLessonTuition(planId) {
  const p = PLANS[planId] || PLANS['8'];
  return (p.groupPrice || p.price) / p.lessons;
}
/** 中途退出：上過的照算，沒上的退 */
export function refundIfQuit(planId, attended) {
  const p = PLANS[planId];
  if (!p) return 0;
  const used = Math.min(p.lessons, Math.max(0, attended));
  const groupPrice = p.groupPrice || p.price;
  const refundGroup = Math.round(groupPrice - (groupPrice / p.lessons) * used);
  const extra = p.groupPrice ? p.price - p.groupPrice : 0; // 一對一沒用就全退（示範）
  return refundGroup + extra;
}
/** 成班規則：滿 4 人成班、3 人改 1 對 3、2 人以下不開全額退 */
export function squadRule(n) {
  if (n >= 4) return { ok: true, label: `${n} 人成班` };
  if (n === 3) return { ok: true, label: '改 1 對 3，學費照調' };
  return { ok: false, label: '不開班，全額退' };
}

// ——— 老師收入 ———
export const TIERS = {
  new: { id: 'new', name: '新手', rate: 0.45 },
  gold: { id: 'gold', name: '黃金', rate: 0.52 },
  diamond: { id: 'diamond', name: '鑽石', rate: 0.60 },
};
export const FLOOR = 600;
/** 每堂：學費 × 等級分潤，與保底 600 取高 */
export function lessonPay(tuition, tierId) {
  const rate = (TIERS[tierId] || TIERS.gold).rate;
  const share = Math.round(tuition * rate);
  const pay = Math.max(FLOOR, share);
  return { tuition: Math.round(tuition), rate, share, pay, floored: share < FLOOR };
}
export function squadTuition(members) {
  return members.reduce((sum, m) => sum + perLessonTuition(m.plan || '8'), 0);
}
