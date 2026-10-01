// fx.js — 動態與趣味互動的共用工具
// 原則：只動 transform 與 opacity；尊重「減少動態」（關閉時內容完整、狀態直接到位）；任何動態都不擋操作。

import { mountBoards } from './whiteboard.js';
import { mountStarmap } from './starmap.js';
import { mountRecorders } from './recorder.js';

const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
export function reduced() { return !!(mq && mq.matches); }

/** 觸覺回饋：支援才用，不支援就安靜略過 */
export function buzz(pattern = 8) {
  try {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    // 瀏覽器只在使用者真的碰過畫面之後才允許震動；還沒碰過就不叫（也不會在主控台留下訊息）
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate(pattern);
  } catch { /* 不支援就算了 */ }
}

// ——— 逐字出現：字先排好版面，再一個一個淡入（不會推擠版面）；點一下就跳過 ———
const PAUSE = /[，。？！、：；…]/;
const STEP = 26;
export function typeIn(el, onDone) {
  if (!el || reduced() || el.dataset.typing === '1') { if (onDone) onDone(); return; }
  const original = el.innerHTML;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let i = 0;
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    for (const ch of n.textContent) {
      const s = document.createElement('span');
      s.className = 'tw';
      s.textContent = ch;
      s.style.setProperty('--i', i);
      i += PAUSE.test(ch) ? 6 : 1;
      frag.appendChild(s);
    }
    n.parentNode.replaceChild(frag, n);
  }
  el.dataset.typing = '1';
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    el.removeEventListener('click', finish);
    if (el.isConnected) { el.innerHTML = original; delete el.dataset.typing; }
    if (onDone) onDone();
  };
  const timer = setTimeout(finish, i * STEP + 260);
  el.addEventListener('click', finish);
}

// 同一個位置、同一句話只打一次；換頁才重來
const typed = new Map();
function mountTyping(root, nav) {
  if (nav) typed.clear();
  root.querySelectorAll('[data-type]').forEach((el) => {
    const slot = el.dataset.type;
    const text = el.textContent;
    const duo = el.closest('.coach') ? el.closest('.coach').querySelector('.duo') : null;
    const after = duo ? duo.dataset.mode : null;
    // 這句已經說過：不重打，小陪回到待命
    if (typed.get(slot) === text) { if (duo && after === 'talk') duo.dataset.mode = 'idle'; return; }
    typed.set(slot, text);
    if (duo && after !== 'joy' && !reduced()) duo.dataset.mode = 'talk';
    typeIn(el, () => { if (duo && duo.isConnected && after !== 'joy') duo.dataset.mode = after === 'talk' ? 'idle' : after; });
  });
}

/** 計時環：一圈小圓點，亮到第 on 顆；最後 warn 顆轉成金色 */
export function setTicks(svg, on, warn = 0) {
  if (!svg) return;
  const dots = svg.querySelectorAll('circle');
  dots.forEach((c, i) => {
    c.classList.toggle('on', i < on);
    c.classList.toggle('warn', warn > 0 && i < on && i >= dots.length - warn);
  });
}

/** 每次畫面重畫後呼叫：把白板、星圖、錄音鈕、逐字出現接上去 */
export function enhance(root, { nav = false } = {}) {
  mountBoards(root);
  mountStarmap(root);
  mountRecorders(root);
  mountTyping(root, nav);
}

// ——— 成班的儀式：成員小圓依序亮起並靠攏 → 老師的圓進來重疊 → 圓點散開＋隊名浮現（共 2.4 秒） ———
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function ceremony(host, { members = [], title = '成班了', sub = '', burst } = {}) {
  if (!host) return;
  host.querySelectorAll('.cer').forEach((x) => x.remove());
  const n = members.length;
  const box = document.createElement('div');
  box.className = 'cer';
  box.setAttribute('role', 'status');
  const spots = members.map((mm, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const fx = Math.cos(a) * 118; const fy = Math.sin(a) * 96;
    const tx = Math.cos(a) * 30 - 16; const ty = Math.sin(a) * 26;
    return `<span class="cer-m" style="--i:${i};--av:${mm.bg};--fx:${fx.toFixed(0)}px;--fy:${fy.toFixed(0)}px;--tx:${tx.toFixed(0)}px;--ty:${ty.toFixed(0)}px"><b>${esc(mm.label)}</b></span>`;
  }).join('');
  box.innerHTML = `<div class="cer-in">
      <div class="cer-stage" aria-hidden="true">${spots}<span class="cer-t"><b>師</b></span></div>
      <h2 class="cer-h">${esc(title)}</h2>
      ${sub ? `<p class="cer-s">${esc(sub)}</p>` : ''}
      <button class="btn ghost s cer-x" type="button">好</button>
    </div>`;
  const close = () => {
    clearTimeout(t1); clearTimeout(t2);
    box.classList.add('out');
    setTimeout(() => box.remove(), reduced() ? 0 : 320);
  };
  box.addEventListener('click', close);
  host.appendChild(box);
  const still = reduced();
  if (still) box.classList.add('still');
  const t1 = setTimeout(() => { if (burst && box.isConnected) { burst(); buzz([12, 50, 18]); } }, still ? 0 : 1800);
  const t2 = setTimeout(close, still ? 2600 : 4200);
  const btn = box.querySelector('.cer-x');
  if (btn) btn.focus({ preventScroll: true });
}

// ——— 關燈：一片夜色由上而下蓋下來，蓋滿後才換成深色，再淡掉 ———
export function lightsOutCurtain(host, onCovered) {
  if (!host || reduced()) { onCovered(); return; }
  host.querySelectorAll('.curtain').forEach((x) => x.remove());
  const c = document.createElement('div');
  c.className = 'curtain';
  c.setAttribute('aria-hidden', 'true');
  host.appendChild(c);
  setTimeout(() => {
    onCovered();
    c.classList.add('lift');
    setTimeout(() => c.remove(), 700);
  }, 1700);
}
