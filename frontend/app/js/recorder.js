// recorder.js — 「按住說話」的錄音鈕（示範）：聲波、30 秒計時環、放開就停
// 不會開麥克風、不會錄音：聲波是動畫，文字用示範句逐字填進輸入框（之後可以自己改）。

const BARS = 22;
const reduce = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function ringDots(n) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return `<circle cx="${(50 + Math.cos(a) * 44).toFixed(2)}" cy="${(50 + Math.sin(a) * 44).toFixed(2)}" r="2.7"/>`;
  }).join('');
}
/** 一圈小圓點的計時環（n 顆） */
export function ticks(n = 30, cls = '') {
  return `<svg class="ticks ${cls}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${ringDots(n)}</svg>`;
}

/**
 * 錄音鈕的 HTML。
 * target＝要填字的輸入框 id；sample＝示範句；secs＝上限秒數；label＝按鈕旁的說明
 */
export function recorderHtml({ id = 'rec', target, sample = '', secs = 30, micIcon, hint = '按住說話，放開就停' }) {
  const safe = String(sample).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<div class="rec2" data-rec="${id}" data-target="${target}" data-secs="${secs}" data-sample="${safe}">
    <div class="rec-ring">${ticks(30)}<button type="button" class="rec-btn" id="${id}Btn" aria-pressed="false" aria-describedby="${id}Cap" aria-label="按住說話，最多 ${secs} 秒">${micIcon}</button></div>
    <div class="rec-side">
      <div class="wave" aria-hidden="true">${Array.from({ length: BARS }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
      <p class="rec-cap" id="${id}Cap"><b class="num rec-left">${secs}</b> 秒 · ${hint}</p>
    </div>
  </div>`;
}

function attach(el) {
  const btn = el.querySelector('.rec-btn');
  const ring = el.querySelector('.ticks');
  const bars = [...el.querySelectorAll('.wave i')];
  const left = el.querySelector('.rec-left');
  const secs = Number(el.dataset.secs) || 30;
  const sample = el.dataset.sample || '';
  const target = () => document.getElementById(el.dataset.target);
  const duo = () => { const c = document.querySelector('.view .coach .duo'); return c || null; };
  let timer = null; let t0 = 0; let base = ''; let lastTick = -1; let prevMode = null;

  const paintRing = (on) => { ring.querySelectorAll('circle').forEach((c, i) => c.classList.toggle('on', i < on)); };
  const frame = () => {
    const el2 = (performance.now() - t0) / 1000;
    // 假的音量：幾個正弦疊起來，看起來像在講話
    bars.forEach((b, i) => {
      const v = 0.25 + 0.75 * Math.abs(Math.sin(el2 * 5.1 + i * 0.9) * Math.sin(el2 * 2.3 + i * 0.37));
      b.style.transform = `scaleY(${v.toFixed(2)})`;
    });
    const tick = Math.min(30, Math.floor((el2 / secs) * 30));
    if (tick !== lastTick) { lastTick = tick; paintRing(tick); }
    if (left) left.textContent = String(Math.max(0, Math.ceil(secs - el2)));
    const ta = target();
    if (ta && sample) {
      const n = Math.min(sample.length, Math.floor(el2 * 11));
      const next = base + sample.slice(0, n);
      if (ta.value !== next) { ta.value = next; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    if (el2 >= secs) stop();
  };
  const start = () => {
    if (timer) return;
    const ta = target();
    base = ta && ta.value && !sample.startsWith(ta.value) && !ta.value.startsWith(sample.slice(0, 6)) ? `${ta.value} ` : '';
    t0 = performance.now(); lastTick = -1;
    el.classList.add('on');
    btn.setAttribute('aria-pressed', 'true');
    const d = duo(); if (d) { prevMode = d.dataset.mode; d.dataset.mode = 'listen'; }
    try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(12); } catch { /* 忽略 */ }
    if (reduce()) {
      if (ta && sample) { ta.value = base + sample; ta.dispatchEvent(new Event('input', { bubbles: true })); }
      timer = setInterval(() => {}, 1e6);
      return;
    }
    timer = setInterval(frame, 70);
  };
  function stop() {
    if (!timer) return;
    clearInterval(timer); timer = null;
    el.classList.remove('on');
    el.classList.add('done');
    btn.setAttribute('aria-pressed', 'false');
    bars.forEach((b) => { b.style.transform = ''; });
    const d = duo(); if (d && d.isConnected) d.dataset.mode = prevMode && prevMode !== 'listen' ? 'idle' : 'idle';
    const cap = el.querySelector('.rec-cap');
    if (cap) cap.innerHTML = '聽到了。可以改字，或再按住補一句。';
    try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(8); } catch { /* 忽略 */ }
  }

  btn.addEventListener('pointerdown', (e) => { if (e.button) return; e.preventDefault(); btn.focus(); try { btn.setPointerCapture(e.pointerId); } catch { /* 忽略 */ } start(); });
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('lostpointercapture', stop);
  btn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(); } });
  btn.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stop(); } });
  btn.addEventListener('blur', stop);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  return { destroy() { if (timer) { clearInterval(timer); timer = null; } } };
}

let live = [];
export function mountRecorders(root) {
  live.forEach((r) => r.destroy());
  live = [...root.querySelectorAll('[data-rec]')].map(attach);
}
