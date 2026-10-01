// api.js — 後端連線（可有可無）：讀 window.TANDELO_API_BASE；留空就是離線示範模式。
// 原則：任何一次失敗都不影響畫面，localStorage 永遠是主要來源；後端只是「有就同步一份」。

const BASE = (typeof window !== 'undefined' && window.TANDELO_API_BASE) ? String(window.TANDELO_API_BASE).replace(/\/+$/, '') : '';
const TIMEOUT_MS = 3000;

let online = null; // null＝還沒探測；true／false＝探測結果
let probing = null;
const listeners = new Set();

/** 有沒有設定後端網址（不代表連得上） */
export function isConfigured() { return BASE !== ''; }
/** 上一次探測是否連得上後端 */
export function isOnline() { return online === true; }
export function apiBase() { return BASE; }
/** 狀態一改就通知（畫面用來切換「已同步／離線示範」） */
export function onStatusChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function setOnline(v) {
  if (online === v) return;
  online = v;
  for (const fn of listeners) { try { fn(v); } catch { /* 忽略 */ } }
}

/** fetch 包裝：自動加前綴、JSON、逾時；回 { ok, status, data } 不丟例外 */
export async function request(path, { method = 'GET', body, headers = {} } = {}) {
  if (!BASE || typeof fetch !== 'function') return { ok: false, status: 0, data: null, offline: true };
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const res = await fetch(`${BASE}/v1${path}`, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    setOnline(true);
    return { ok: res.ok, status: res.status, data };
  } catch {
    setOnline(false);
    return { ok: false, status: 0, data: null, offline: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 探測 /health；同時只跑一次 */
export function probe() {
  if (!BASE) { setOnline(false); return Promise.resolve(false); }
  if (!probing) {
    probing = request('/health').then((r) => { probing = null; return r.ok; });
  }
  return probing;
}

// ——— 把 App 的狀態鏡射到後端（盡力而為） ———
// state.sync 記錄後端給的 id 與上次同步到哪裡，避免重複送。
// 節流與退避：存檔很頻繁，同步最多每 1.5 秒一次；被 429 擋或連不上就先停一陣子，不打爆後端。
const MIN_GAP_MS = 1500;
const BACKOFF_429_MS = 60000;
const BACKOFF_FAIL_MS = 15000;
let syncing = false;
let pending = null;
let timer = null;
let lastRunAt = 0;
let pausedUntil = 0;

export function syncState(state) {
  if (!BASE || !state || !state.student) return;
  pending = state;
  if (syncing || timer) return;
  const now = Date.now();
  const wait = Math.max(pausedUntil - now, MIN_GAP_MS - (now - lastRunAt), 0);
  timer = setTimeout(() => { timer = null; kick(); }, wait);
}

function kick() {
  if (syncing || !pending) return;
  syncing = true;
  lastRunAt = Date.now();
  runSync().catch(() => { /* 同步失敗不影響本機 */ }).finally(() => {
    syncing = false;
    if (pending) syncState(pending);
  });
}

function noteFailure(r) {
  if (r.status === 429) pausedUntil = Date.now() + BACKOFF_429_MS;
  else if (r.offline) pausedUntil = Date.now() + BACKOFF_FAIL_MS;
}

async function runSync() {
  const state = pending; pending = null;
  const st = state.student;
  state.sync = state.sync || { studentId: null, diagAt: null, slotsKey: null };
  const sync = state.sync;

  if (!sync.studentId) {
    const r = await request('/students', { method: 'POST', body: { nickname: st.name || '同學', grade: st.grade || '國二', exam_date: st.examDate || null, goal: st.goal || '段考數學進步', daily_cap: 3 } });
    if (!r.ok) { noteFailure(r); return; }
    sync.studentId = r.data.id;
  }
  const id = sync.studentId;

  if (st.diag && st.diag.done && Object.keys(st.diag.answers || {}).length) {
    const key = JSON.stringify(st.diag.answers);
    if (sync.diagAt !== key) {
      const r = await request(`/students/${id}/diagnostics`, { method: 'POST', body: { answers: st.diag.answers } });
      if (r.ok) sync.diagAt = key; else noteFailure(r);
    }
  }

  if (Array.isArray(st.slots) && st.slots.length) {
    const key = [...st.slots].sort().join(',');
    if (sync.slotsKey !== key) {
      const r = await request(`/students/${id}/availability`, { method: 'PUT', body: { slots: st.slots } });
      if (r.ok) sync.slotsKey = key; else noteFailure(r);
    }
  }
}

/** 老師招募表單 → 後端（成功回 { id }；失敗回 null） */
export async function submitTeacherApplication(form) {
  const r = await request('/teacher-applications', { method: 'POST', body: form });
  return r.ok ? r.data : null;
}
