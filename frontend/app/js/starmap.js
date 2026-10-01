// starmap.js — 卡點地圖的星圖：可拖曳、可縮放（按鈕／雙指／Ctrl＋滾輪），節點是真的按鈕（鍵盤可操作）
// 位移與縮放只改一層的 transform。

import { SKILLS, SKILL_ORDER, CHAPTERS } from './content.js';

export const WORLD = { w: 760, h: 560 };
// 八個卡點的位置：照學習順序連成一條星座線
const POS = {
  'sq-cross': [120, 130], 'sign-dist': [292, 84], 'sqrt-split': [468, 150], 'sqrt-abs': [636, 96],
  'pyth-hyp': [652, 286], 'factor-diff': [474, 352], 'factor-cross': [286, 300], 'quad-zero': [150, 436],
};
const GOAL = [352, 486];
// 背景小星（固定位置，品牌色，很淡）
const DUST = [[40, 60, 0], [210, 30, 1], [380, 40, 2], [560, 50, 0], [720, 170, 1], [730, 400, 2], [580, 470, 0], [420, 250, 1], [200, 220, 2], [60, 300, 0], [90, 520, 1], [260, 500, 2], [520, 520, 0], [690, 520, 1], [350, 180, 0], [560, 230, 2], [30, 180, 1], [180, 360, 0]];
const DUST_C = ['#0E5F52', '#F26B54', '#F4C24D'];

const view = { x: 0, y: 0, s: 1, set: false };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** 節點的形狀：狀態不只靠顏色（卡住＝有缺口的空心圈、說得出來＝實心、已掌握＝實心加外圈） */
function glyph(s) {
  if (s === 'stuck') return '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="17" fill="var(--coral-l)"/><circle cx="24" cy="24" r="17" fill="none" stroke="var(--coral)" stroke-width="6" stroke-linecap="round" stroke-dasharray="84 23" transform="rotate(-60 24 24)"/></svg>';
  if (s === 'learning') return '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="17" fill="var(--coral-l)" stroke="var(--coral)" stroke-width="3"/><circle cx="24" cy="24" r="6" fill="var(--coral)"/></svg>';
  if (s === 'green') return '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="var(--pine)"/><path d="M16 24.5l5.5 5.5L32.5 18.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  if (s === 'gold') return '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="none" stroke="var(--honey)" stroke-width="2.5"/><circle cx="24" cy="24" r="17" fill="var(--honey)"/><path d="M24 14.5l2.9 6.2 6.7.8-5 4.6 1.4 6.7-6-3.4-6 3.4 1.4-6.7-5-4.6 6.7-.8z" fill="#0D2B26"/></svg>';
  if (s === 'ok') return '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="17" fill="var(--card)" stroke="var(--pine)" stroke-width="3"/><path d="M17 24.5l4.8 4.8L31.5 19.5" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="16" fill="var(--card)" stroke="var(--line)" stroke-width="2.5" stroke-dasharray="4 5"/></svg>';
}
export { glyph };

/**
 * 星圖 HTML。skills＝學生的卡點狀態；sel＝目前展開的節點；flip＝要播「翻過去」的節點；labelOf＝狀態文字
 */
export function starmapHtml({ skills, sel, flip, focus, labelOf, examLabel = '段考' }) {
  const pts = SKILL_ORDER.map((k) => POS[k]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const done = SKILL_ORDER.map((k) => (skills[k] || {}).status).map((s) => s === 'gold' || s === 'green' || s === 'ok');
  const segs = pts.slice(1).map((p, i) => `<path class="sm-seg ${done[i] && done[i + 1] ? 'ok' : ''}" d="M${pts[i][0]} ${pts[i][1]} L${p[0]} ${p[1]}"/>`).join('');
  const last = pts[pts.length - 1];
  const chapters = CHAPTERS.map((c) => {
    const ks = SKILL_ORDER.filter((k) => SKILLS[k].chapter === c.id);
    if (!ks.length) return '';
    const cx = ks.reduce((a, k) => a + POS[k][0], 0) / ks.length;
    const cy = Math.min(...ks.map((k) => POS[k][1]));
    return `<text class="sm-chap" x="${cx}" y="${cy - 46}" text-anchor="middle">${esc(c.name)}</text>`;
  }).join('');
  const nodes = SKILL_ORDER.map((k) => {
    const s = (skills[k] || {}).status || 'unknown';
    const [x, y] = POS[k];
    const flipping = flip === k;
    const face = flipping
      ? `<span class="flipper"><span class="face front">${glyph('green')}</span><span class="face back">${glyph('gold')}</span></span>`
      : glyph(s);
    return `<button type="button" class="star ${sel === k ? 'sel' : ''} ${flipping ? 'flip' : ''}" id="star-${k}" data-act="nodeInfo" data-k="${k}" data-s="${s}" style="left:${x}px;top:${y}px" aria-pressed="${sel === k}" aria-label="${esc(SKILLS[k].title)}：${esc(labelOf(s))}">
      <span class="star-dot">${face}</span><span class="star-l">${esc(SKILLS[k].short)}</span></button>`;
  }).join('');
  return `<div class="smap" data-starmap data-focus="${esc(focus || '')}" role="group" aria-label="卡點星圖：可以拖曳、縮放，點一顆星看下一步">
    <div class="smap-layer" style="width:${WORLD.w}px;height:${WORLD.h}px">
      <svg class="smap-svg" viewBox="0 0 ${WORLD.w} ${WORLD.h}" width="${WORLD.w}" height="${WORLD.h}" aria-hidden="true" focusable="false">
        ${DUST.map(([x, y, c], i) => `<circle class="sm-dust" cx="${x}" cy="${y}" r="${2 + (i % 3)}" fill="${DUST_C[c]}"/>`).join('')}
        <path class="sm-trail" d="${line} L${GOAL[0]} ${GOAL[1]}"/>
        ${segs}
        <path class="sm-seg goal" d="M${last[0]} ${last[1]} L${GOAL[0]} ${GOAL[1]}"/>
        ${chapters}
        <g transform="translate(${GOAL[0]} ${GOAL[1]})"><circle class="sm-goal" r="13"/><path class="sm-flag" d="M-3 7V-7M-3 -6.5h8l-1.8 3 1.8 3h-8"/><text class="sm-chap" x="22" y="5">${esc(examLabel)}</text></g>
      </svg>
      ${nodes}
    </div>
    <div class="smap-ctl" role="group" aria-label="縮放">
      <button type="button" data-smap="in" aria-label="放大">＋</button>
      <button type="button" data-smap="out" aria-label="縮小">−</button>
      <button type="button" data-smap="fit" aria-label="看整張地圖">全</button>
    </div>
    <p class="smap-tip" aria-hidden="true">拖曳移動 · 雙指或按鈕縮放</p>
  </div>`;
}

let live = null;
function attach(el) {
  const layer = el.querySelector('.smap-layer');
  const size = () => el.getBoundingClientRect();
  const clamp = () => {
    const r = size();
    view.s = Math.min(1.8, Math.max(Math.min(0.45, r.width / WORLD.w), view.s));
    const mw = WORLD.w * view.s; const mh = WORLD.h * view.s; const pad = 60;
    view.x = mw + pad * 2 <= r.width ? (r.width - mw) / 2 : Math.min(pad, Math.max(r.width - mw - pad, view.x));
    view.y = mh + pad * 2 <= r.height ? (r.height - mh) / 2 : Math.min(pad, Math.max(r.height - mh - pad, view.y));
  };
  const apply = (smooth) => {
    clamp();
    layer.classList.toggle('glide', !!smooth);
    layer.style.transform = `translate(${view.x.toFixed(1)}px, ${view.y.toFixed(1)}px) scale(${view.s.toFixed(3)})`;
  };
  const centerOn = (k, smooth) => {
    const p = POS[k]; if (!p) return;
    const r = size();
    view.x = r.width / 2 - p[0] * view.s; view.y = r.height / 2 - p[1] * view.s;
    apply(smooth);
  };
  const fit = (smooth) => {
    const r = size();
    view.s = Math.min(r.width / WORLD.w, r.height / WORLD.h, 1);
    view.x = (r.width - WORLD.w * view.s) / 2; view.y = (r.height - WORLD.h * view.s) / 2;
    apply(smooth);
  };
  const zoom = (f, cx, cy, smooth) => {
    const r = size();
    const px = cx ?? r.width / 2; const py = cy ?? r.height / 2;
    const before = view.s;
    view.s = Math.min(1.8, Math.max(0.3, view.s * f));
    clamp();
    const k = view.s / before;
    view.x = px - (px - view.x) * k; view.y = py - (py - view.y) * k;
    apply(smooth);
  };

  if (!view.set) {
    const r = size();
    view.s = r.width >= 700 ? 1 : Math.max(0.62, Math.min(0.85, r.width / 460));
    view.set = true;
    if (el.dataset.focus && POS[el.dataset.focus]) centerOn(el.dataset.focus); else fit();
  } else apply();

  // 拖曳（單指／滑鼠）與雙指縮放
  const ptrs = new Map();
  let drag = null; let moved = false; let pinch = null;
  const down = (e) => {
    if (e.target.closest('.smap-ctl')) return;
    if (e.button && e.button !== 0) return;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; moved = false; layer.classList.remove('glide'); }
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: view.s };
      moved = true;
    }
  };
  const move = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const r = size();
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const target = pinch.s * (d / pinch.d);
      zoom(target / view.s, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x; const dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    if (!moved) { moved = true; el.classList.add('dragging'); try { el.setPointerCapture(e.pointerId); } catch { /* 忽略 */ } }
    view.x = drag.vx + dx; view.y = drag.vy + dy;
    apply();
  };
  const up = (e) => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (!ptrs.size) { drag = null; el.classList.remove('dragging'); setTimeout(() => { moved = false; }, 0); }
  };
  // 拖曳過就不要當成點擊（不然放手會誤開節點）
  const click = (e) => {
    const c = e.target.closest('[data-smap]');
    if (c) {
      e.stopPropagation();
      if (c.dataset.smap === 'in') zoom(1.25, null, null, true);
      if (c.dataset.smap === 'out') zoom(0.8, null, null, true);
      if (c.dataset.smap === 'fit') fit(true);
      return;
    }
    if (moved) { e.stopPropagation(); e.preventDefault(); }
  };
  const wheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return; // 一般滾輪留給頁面捲動；觸控板雙指縮放會帶 ctrlKey
    e.preventDefault();
    const r = size();
    zoom(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
  };
  // 用鍵盤走到畫面外的星星時，把它帶回來
  const focusin = (e) => {
    const b = e.target.closest('.star'); if (!b) return;
    const r = size(); const br = b.getBoundingClientRect();
    if (br.left < r.left + 8 || br.right > r.right - 8 || br.top < r.top + 8 || br.bottom > r.bottom - 8) centerOn(b.dataset.k, true);
  };
  const key = (e) => {
    if (!e.target.closest('.star')) return;
    const step = 48;
    if (e.key === 'ArrowLeft') view.x += step; else if (e.key === 'ArrowRight') view.x -= step; else if (e.key === 'ArrowUp') view.y += step; else if (e.key === 'ArrowDown') view.y -= step;
    else if (e.key === '+' || e.key === '=') { zoom(1.25, null, null, true); return; } else if (e.key === '-') { zoom(0.8, null, null, true); return; } else return;
    e.preventDefault(); apply(true);
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('click', click, true);
  el.addEventListener('wheel', wheel, { passive: false });
  el.addEventListener('focusin', focusin);
  el.addEventListener('keydown', key);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => apply()) : null;
  if (ro) ro.observe(el);
  return { destroy() { if (ro) ro.disconnect(); } };
}

export function mountStarmap(root) {
  if (live) { live.destroy(); live = null; }
  const el = root.querySelector('[data-starmap]');
  if (el) live = attach(el);
}
export function resetStarmapView() { view.set = false; }
