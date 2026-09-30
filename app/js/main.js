// main.js — 啟動、路由、事件分派、主題與關燈、桌機說明面板

import { load, save, defaultState, isLightsOut, fmtLong, addDays, fmtMD } from './state.js';
import { parseHash, homeFor, toHash } from './router.js';
import { esc, icon } from './ui.js';
import * as common from './screens/common.js';
import * as onboard from './screens/onboard.js';
import * as student from './screens/student.js';
import * as practice from './screens/practice.js';
import * as classroom from './screens/classroom.js';
import * as exam from './screens/exam.js';
import * as parent from './screens/parent.js';
import * as teacher from './screens/teacher.js';

const SCREENS = {
  ...common.screens, ...onboard.screens, ...student.screens, ...practice.screens,
  ...classroom.screens, ...exam.screens, ...parent.screens, ...teacher.screens,
};

const TABS = {
  student: [
    ['s/home', '今天', 'home'], ['s/squad', '小隊', 'users'], ['s/practice', '練習', 'mic', true], ['s/map', '卡點', 'route'], ['s/me', '我', 'user'],
  ],
  teacher: [
    ['t/offer', '接班', 'bell'], ['t/prep', '課前', 'book'], ['t/room', '教室', 'video'], ['t/income', '收入', 'coin'], ['settings', '設定', 'gear'],
  ],
};
const ROLE_NAME = { student: '學生', parent: '家長', teacher: '老師' };

let state = load();
const cur = { key: null, params: [], screen: null, cleanup: null };
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');

const $ = (s) => document.querySelector(s);
const app = $('#app');
const sb = $('#sb');
const view = $('#view');
const tabs = $('#tabs');
const overlay = $('#overlay');
const panel = $('#panel');
const toastEl = $('#toast');

function ctx() {
  return {
    state, params: cur.params, key: cur.key,
    today: state.clock.date,
    night: isLightsOut(state.clock.time),
    go, update, rerender, remount, toast, sheet, closeSheet, burst,
  };
}

function go(path) {
  const h = toHash(path);
  if (location.hash === h) route(); else location.hash = h;
}

/** 修改狀態：直接在原物件上改，存到 localStorage，再重畫（silent 則不重畫） */
function update(fn, opts = {}) {
  fn(state);
  save(state);
  if (!opts.silent) rerender(opts);
}

function applyTheme() {
  const night = isLightsOut(state.clock.time) && state.role === 'student';
  const theme = night ? 'dark' : state.theme === 'auto' ? (darkMQ.matches ? 'dark' : 'light') : state.theme;
  document.documentElement.dataset.theme = theme;
  app.dataset.night = night ? '1' : '0';
  app.dataset.role = state.role || 'none';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0C1412' : '#F6F4EE');
}

function statusBar() {
  const night = isLightsOut(state.clock.time);
  return `<button class="sb-time num" data-go="settings" aria-label="示範時間 ${esc(fmtLong(state.clock.date))} ${esc(state.clock.time)}，點一下到設定">${night ? icon('moon') : ''}${esc(state.clock.time)}<small>${esc(fmtMD(state.clock.date))}</small></button>
    <span class="sb-demo">示範模式</span>
    <button class="iconbtn sb-gear" data-go="settings" aria-label="設定">${icon('gear')}</button>`;
}

function tabBar() {
  const scr = cur.screen;
  const list = TABS[state.role];
  if (!list || scr.tabs === false) return '';
  const active = scr.tab || cur.key;
  return `<nav class="tabbar" aria-label="主選單">${list.map(([k, label, ic, center]) => `<button class="tab ${center ? 'center' : ''} ${active === k ? 'on' : ''}" data-go="${k}" ${active === k ? 'aria-current="page"' : ''}>${center ? `<b>${icon(ic)}</b>` : icon(ic)}<span>${label}</span></button>`).join('')}</nav>`;
}

function renderPanel() {
  if (!panel) return;
  const meta = (cur.screen && cur.screen.meta) || { title: '', tips: [] };
  const night = isLightsOut(state.clock.time);
  panel.innerHTML = `<div class="panel-in">
    <a class="wm" href="../" aria-label="回到 Tandelo 網站">Tandelo<span class="dots"><i></i><i></i></span></a>
    <p class="panel-tag">App 概念驗證（POC）· 示範模式</p>
    <section class="pn-now">
      <small>${state.role ? `${ROLE_NAME[state.role]} · ` : ''}現在這一頁</small>
      <h2>${esc(meta.title)}</h2>
      <ul>${(meta.tips || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    </section>
    <section>
      <h3>切換身分</h3>
      <div class="pn-roles">${['student', 'parent', 'teacher'].map((r) => `<button data-act="pickRole" data-role="${r}" aria-pressed="${state.role === r}">${ROLE_NAME[r]}</button>`).join('')}</div>
    </section>
    <section>
      <h3>示範時間</h3>
      <p class="pn-clock"><b class="num">${esc(state.clock.time)}</b> ${esc(fmtLong(state.clock.date))}${night ? '<span class="pill">已關燈</span>' : ''}</p>
      <div class="pn-quick">
        <button data-act="setClock" data-time="20:40">20:40</button>
        <button data-act="setClock" data-time="22:31">22:31 關燈</button>
        <button data-act="shiftDays" data-days="1">往後 1 天</button>
        <button data-act="shiftDays" data-days="7">往後 7 天</button>
      </div>
    </section>
    <section class="pn-foot">
      <button data-act="askReset">重設示範資料</button>
      <button data-go="about">關於這個 POC</button>
      <a href="../">回到網站</a>
    </section>
    <p class="sign">Tandelo 概念驗證（POC）· Edward Tseng · 2026<br>資料只存在這台裝置，不會送到任何伺服器。</p>
  </div>`;
}

function render({ nav = false, focusTitle = false, focusSel = null, keepScrollBottom = false, top = false } = {}) {
  const c = ctx();
  applyTheme();
  sb.innerHTML = statusBar();
  const active = document.activeElement;
  const fid = !nav && active && view.contains(active) && active.id ? active.id : null;
  const scroll = view.scrollTop;
  let html;
  try { html = cur.screen.render(c); } catch (err) {
    console.error(err);
    html = `<div class="pad"><h1 class="hero s" tabindex="-1">這一頁出了點狀況。</h1><p class="sub">示範資料可能不一致，可以重設後再試。</p><button class="btn" data-act="askReset">重設示範資料</button></div>`;
  }
  view.innerHTML = `<div class="screen ${nav ? 'enter' : ''}" data-screen="${esc(cur.key)}">${html}</div>`;
  const tb = tabBar();
  tabs.innerHTML = tb;
  tabs.hidden = !tb;
  app.classList.toggle('has-tabs', !!tb);
  if (nav || top) view.scrollTop = 0;
  else if (keepScrollBottom) view.scrollTop = view.scrollHeight;
  else view.scrollTop = scroll;
  let focusEl = null;
  if (focusSel) focusEl = view.querySelector(focusSel);
  else if (nav || focusTitle) focusEl = view.querySelector('h1[tabindex="-1"]');
  else if (fid) focusEl = document.getElementById(fid);
  if (focusEl) {
    if (focusEl.matches('b')) { focusEl.setAttribute('tabindex', '-1'); }
    try { focusEl.focus({ preventScroll: !(focusSel && !keepScrollBottom) }); } catch { /* 忽略 */ }
  }
  renderPanel();
}
function rerender(opts = {}) { render(opts); }
function remount() {
  if (cur.cleanup) { cur.cleanup(); cur.cleanup = null; }
  render();
  if (cur.screen.mount) cur.cleanup = cur.screen.mount(ctx()) || null;
}

function route() {
  const { key, params, role } = parseHash(location.hash);
  let k = key || homeFor(state.role, state);
  if (!SCREENS[k]) k = homeFor(state.role, state);
  if (role && state.role !== role) { state.role = role; save(state); }
  const scr = SCREENS[k];
  if (cur.cleanup) { cur.cleanup(); cur.cleanup = null; }
  closeSheet();
  cur.key = k; cur.params = params; cur.screen = scr;
  if (scr.guard) {
    const to = scr.guard(ctx());
    if (to && to !== k) { location.replace(toHash(to)); return; }
  }
  if (scr.enter) scr.enter(ctx());
  render({ nav: true });
  if (scr.mount) cur.cleanup = scr.mount(ctx()) || null;
}

// ——— 提示、面板、慶祝小圓點 ———
let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}

let lastFocus = null;
function sheet(html, label = '對話框') {
  lastFocus = document.activeElement;
  overlay.innerHTML = `<div class="scrim" data-act="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><span class="grab" aria-hidden="true"></span>${html}</div>`;
  overlay.hidden = false;
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    const f = overlay.querySelector('.sheet button, .sheet a, .sheet input');
    if (f) f.focus();
  });
}
function closeSheet() {
  if (overlay.hidden) return;
  overlay.classList.remove('open');
  overlay.hidden = true;
  overlay.innerHTML = '';
  if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}

function burst() {
  if (reduceMotion.matches) return;
  const colors = ['#0E5F52', '#F26B54', '#F4C24D', '#DCEFE8'];
  const box = document.createElement('div');
  box.className = 'burst';
  for (let i = 0; i < 18; i++) {
    const d = document.createElement('i');
    const a = (Math.PI * 2 * i) / 18;
    const r = 80 + (i % 3) * 36;
    d.style.setProperty('--x', `${Math.cos(a) * r}px`);
    d.style.setProperty('--y', `${Math.sin(a) * r}px`);
    d.style.background = colors[i % colors.length];
    box.appendChild(d);
  }
  app.appendChild(box);
  setTimeout(() => box.remove(), 1000);
}

// ——— 全域動作 ———
const GLOBAL = {
  ...common.actions,
  closeSheet() { closeSheet(); },
  askReset(c) {
    sheet(`<div class="sheet-c"><h2 class="h2">重設示範資料？</h2><p class="body">會清掉這台裝置上的示範資料（學生、家長、老師三邊一起），回到一開始。</p>
      <button class="btn block" data-act="doReset">重設</button><button class="btn ghost block" data-act="closeSheet">先不要</button></div>`, '重設示範資料');
  },
  doReset() {
    state = defaultState();
    save(state);
    closeSheet();
    toast('已重設。這是概念驗證，資料只留在你的裝置。');
    if (location.hash === '#/welcome') route(); else location.hash = '#/welcome';
  },
  setClock(c, el) { update((s) => { s.clock.time = el.dataset.time; }); toast(`示範時間：${el.dataset.time}`); },
  shiftDays(c, el) { const n = Number(el.dataset.days); update((s) => { s.clock.date = addDays(s.clock.date, n); }); toast(`示範日期往後 ${n} 天：${fmtMD(state.clock.date)}`); },
  setDate(c, el) { if (el.value) update((s) => { s.clock.date = el.value; }); },
  setTime(c, el) { if (el.value) update((s) => { s.clock.time = el.value; }); },
  setTheme(c, el) { update((s) => { s.theme = el.dataset.theme; }); },
};

function run(act, el, e) {
  const h = (cur.screen && cur.screen.on && cur.screen.on[act]) || GLOBAL[act];
  if (h) h(ctx(), el, e);
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go],[data-act]');
  if (!t || t.matches('form') || !(app.contains(t) || (panel && panel.contains(t)))) return;
  if (t.disabled) return;
  if (t.dataset.go) { e.preventDefault(); go(t.dataset.go); return; }
  run(t.dataset.act, t, e);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-act]');
  if (!f) return;
  e.preventDefault();
  run(f.dataset.act, f, e);
});
document.addEventListener('input', (e) => { const t = e.target.closest('[data-input]'); if (t) run(t.dataset.input, t, e); });
document.addEventListener('change', (e) => { const t = e.target.closest('[data-change]'); if (t) run(t.dataset.change, t, e); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) { e.preventDefault(); closeSheet(); return; }
  if (e.key === 'Tab' && !overlay.hidden) {
    const f = [...overlay.querySelectorAll('.sheet button:not([disabled]), .sheet a, .sheet input')];
    if (!f.length) return;
    const first = f[0]; const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
window.addEventListener('hashchange', route);
darkMQ.addEventListener?.('change', () => applyTheme());
window.addEventListener('storage', (e) => { if (e.key === 'tandelo-poc-v1') { state = load(); route(); } });

route();
