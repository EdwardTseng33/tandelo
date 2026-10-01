// whiteboard.js — 示範白板：真的可以寫（滑鼠／手指／觸控筆），可換筆色、橡皮擦、復原、清除
// 不同步、不存檔：筆跡只留在這次開啟的記憶體裡。畫面重畫時會把筆跡畫回去。

const INK = { ink: '#0D2B26', pine: '#0E5F52', coral: '#F26B54', honey: '#F4C24D' };
const NAMES = { ink: '墨綠', pine: '松綠', coral: '珊瑚', honey: '蜂蜜金' };
const pages = new Map(); // key -> { strokes: [], backup: null }
const tool = { color: 'ink', eraser: false };
let active = null;
let sawPen = false;

function page(key) {
  if (!pages.has(key)) pages.set(key, { strokes: [], backup: null });
  return pages.get(key);
}
export function clearBoards() { pages.clear(); }

/** 白板的 HTML。text＝印在白板上的題目（在筆跡下面，可以直接在上面圈畫） */
export function boardHtml(key, { tag = '共用白板', text = '', icon }) {
  return `<div class="wb" data-wb="${key}">
    <div class="wb-bar">
      <span class="wb-tag">${tag}</span>
      <div class="wb-tools" role="toolbar" aria-label="白板工具">
        ${Object.keys(INK).map((c) => `<button type="button" class="wb-c" data-wbc="${c}" aria-label="${NAMES[c]}筆" aria-pressed="false"><i style="background:${INK[c]}"></i></button>`).join('')}
        <span class="wb-sep" aria-hidden="true"></span>
        <button type="button" class="wb-t" data-wbt="eraser" aria-label="橡皮擦" aria-pressed="false">${icon('eraser')}</button>
        <button type="button" class="wb-t" data-wbt="undo" aria-label="復原上一筆">${icon('undo')}</button>
        <button type="button" class="wb-t" data-wbt="clear" aria-label="清除整頁">${icon('trash')}</button>
      </div>
    </div>
    <div class="wb-stage">
      <div class="wb-text">${text}</div>
      <canvas class="wb-canvas" role="img" aria-label="白板：可以用滑鼠、手指或觸控筆在上面寫"></canvas>
      <span class="wb-hint" aria-hidden="true">在這裡寫寫看</span>
    </div>
  </div>`;
}

function create(el) {
  const key = el.dataset.wb;
  const pg = page(key);
  const stage = el.querySelector('.wb-stage');
  const canvas = el.querySelector('.wb-canvas');
  const hint = el.querySelector('.wb-hint');
  const g = canvas.getContext('2d');
  let w = 0; let h = 0; let dpr = 1;
  let cur = null;

  const syncTools = () => {
    el.querySelectorAll('[data-wbc]').forEach((b) => b.setAttribute('aria-pressed', String(!tool.eraser && b.dataset.wbc === tool.color)));
    const er = el.querySelector('[data-wbt="eraser"]'); if (er) er.setAttribute('aria-pressed', String(tool.eraser));
    const un = el.querySelector('[data-wbt="undo"]'); if (un) un.disabled = !pg.strokes.length && !pg.backup;
    if (hint) hint.hidden = pg.strokes.length > 0;
    canvas.classList.toggle('erasing', tool.eraser);
  };

  const width = (s, p) => {
    const base = (s.erase ? 22 : 3.2) * Math.max(0.7, w / 720);
    return s.pen ? base * (0.45 + p * 1.1) : base;
  };
  const seg = (s, a, b, c) => {
    // 以中點為端點、原始點為控制點的二次曲線：筆跡會自動變圓順
    const m1x = (a[0] + b[0]) / 2 * w; const m1y = (a[1] + b[1]) / 2 * w;
    const m2x = (b[0] + c[0]) / 2 * w; const m2y = (b[1] + c[1]) / 2 * w;
    g.beginPath();
    g.moveTo(m1x, m1y);
    g.quadraticCurveTo(b[0] * w, b[1] * w, m2x, m2y);
    g.lineWidth = width(s, b[2]);
    g.stroke();
  };
  const style = (s) => {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
    g.strokeStyle = s.erase ? '#000' : INK[s.color] || INK.ink;
    g.fillStyle = g.strokeStyle;
  };
  const line = (s, x1, y1, x2, y2, p) => { g.beginPath(); g.moveTo(x1 * w, y1 * w); g.lineTo(x2 * w, y2 * w); g.lineWidth = width(s, p); g.stroke(); };
  // 頭尾兩小段（曲線只畫到中點，頭尾要補直線才不會短一截）
  const head = (s) => { const [a, b] = s.pts; line(s, a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2]); };
  const tail = (s) => { const n = s.pts.length; const a = s.pts[n - 2]; const b = s.pts[n - 1]; line(s, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, b[0], b[1], b[2]); };
  const dot = (s, p) => { g.beginPath(); g.arc(p[0] * w, p[1] * w, width(s, p[2]) / 2, 0, Math.PI * 2); g.fill(); };
  const drawStroke = (s) => {
    style(s);
    const pts = s.pts;
    if (pts.length < 2) { dot(s, pts[0]); return; }
    head(s);
    for (let i = 1; i < pts.length - 1; i++) seg(s, pts[i - 1], pts[i], pts[i + 1]);
    tail(s);
  };
  const redraw = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    pg.strokes.forEach(drawStroke);
  };
  const resize = () => {
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    redraw();
  };

  const pt = (e) => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / w, (e.clientY - r.top) / w, e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5];
  };
  const down = (e) => {
    if (e.button && e.button !== 0) return;
    if (e.pointerType === 'pen') sawPen = true;
    if (sawPen && e.pointerType === 'touch') return; // 用過筆之後，手掌與手指不落筆
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
    cur = { color: tool.color, erase: tool.eraser, pen: e.pointerType === 'pen', pts: [pt(e)], id: e.pointerId };
    pg.strokes.push(cur); pg.backup = null;
    style(cur); dot(cur, cur.pts[0]);
    syncTools();
  };
  const move = (e) => {
    if (!cur || e.pointerId !== cur.id) return;
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    style(cur);
    for (const ev of (list.length ? list : [e])) {
      const p = pt(ev);
      const last = cur.pts[cur.pts.length - 1];
      if (Math.hypot((p[0] - last[0]) * w, (p[1] - last[1]) * w) < 1.2) continue;
      cur.pts.push(p);
      const n = cur.pts.length;
      if (n === 2) head(cur);
      if (n >= 3) seg(cur, cur.pts[n - 3], cur.pts[n - 2], cur.pts[n - 1]);
    }
  };
  const up = (e) => {
    if (!cur || e.pointerId !== cur.id) return;
    style(cur);
    if (cur.pts.length >= 2) tail(cur);
    cur = null;
  };
  const click = (e) => {
    const c = e.target.closest('[data-wbc]');
    const t = e.target.closest('[data-wbt]');
    if (c) { tool.color = c.dataset.wbc; tool.eraser = false; } else if (t) {
      const k = t.dataset.wbt;
      if (k === 'eraser') tool.eraser = !tool.eraser;
      if (k === 'undo') { if (pg.strokes.length) pg.strokes.pop(); else if (pg.backup) { pg.strokes = pg.backup; pg.backup = null; } redraw(); }
      if (k === 'clear' && pg.strokes.length) { pg.backup = pg.strokes; pg.strokes = []; redraw(); }
    } else return;
    syncTools();
  };

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  el.querySelector('.wb-bar').addEventListener('click', click);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(stage);
  resize(); syncTools();
  return { destroy() { if (ro) ro.disconnect(); } };
}

export function mountBoards(root) {
  if (active) { active.destroy(); active = null; }
  const el = root.querySelector('[data-wb]');
  if (el) active = create(el);
}
