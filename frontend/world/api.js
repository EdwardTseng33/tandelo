// api.js — Demo 接後端：有設定 API 位址時，題目由後端出、判題由後端判、小陪由後端回話。
// 位址存在 localStorage（和示範資料分開，重設示範資料不會斷線）；也可用 ?api=https://… 帶進來。

const KEY = 'tandelo.world.api';
const PREFIX = '/api/v1';

export function base() {
  try { return (localStorage.getItem(KEY) || '').replace(/\/+$/, ''); } catch (e) { return ''; }
}
export function setBase(url) {
  const u = String(url || '').trim().replace(/\/+$/, '');
  try { if (u) localStorage.setItem(KEY, u); else localStorage.removeItem(KEY); } catch (e) { /* 私密模式可能不能寫 */ }
  return u;
}
export function host() { try { return new URL(base()).host; } catch (e) { return base(); } }

async function call(path, { method = 'GET', body, timeout = 8000 } = {}) {
  const b = base(); if (!b) throw new Error('no-api');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(b + PREFIX + path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
    if (!r.ok) { let d = ''; try { d = (await r.json()).detail || ''; } catch (e) { /* 非 JSON */ } throw new Error(`http-${r.status}${d ? ' ' + d : ''}`); }
    return await r.json();
  } finally { clearTimeout(t); }
}

export const ping = () => call('/health');
export const variants = (monster, n, route, seed) => call(`/world/monsters/${encodeURIComponent(monster)}/variants?n=${n}&route=${encodeURIComponent(route)}&seed=${encodeURIComponent(seed)}`);
export const check = (monster, answerToken, choice) => call(`/world/monsters/${encodeURIComponent(monster)}/variants/check`, { method: 'POST', body: { answer_token: answerToken, choice } });
export const coach = (body) => call('/coach/reply', { method: 'POST', body });
export const intervention = (body) => call('/interventions', { method: 'POST', body });
export const shadows = (studentId) => call(`/students/${studentId}/shadows`);
export const shadowEvent = (studentId, monster, event) => call(`/students/${studentId}/shadows/${encodeURIComponent(monster)}/events`, { method: 'POST', body: { event } });
export const record = (studentId) => call(`/students/${studentId}/record`);
