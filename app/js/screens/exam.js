// 學生：段考對照 —— 上傳考卷（示範圖）→ 前後兩次錯題類別對照

import { esc, icon, m, backBar, coach } from '../ui.js';
import { CHAPTERS, SKILLS, examBefore, examAfter, sumCounts } from '../content.js';
import { fmtMD } from '../state.js';

const ui = { scanning: null };

function paper(kind) {
  const lines = kind === 'before'
    ? ['(x + 3)² = x² + 9', '√(9 + 16) = 7', 'x² - 9 = (x - 3)²', 'x² = 3x → x = 3']
    : ['(x + 3)² = x² + 6x + 9', '√(9 + 16) = 5', 'x² - 9 = (x + 3)(x - 3)', 'x = 0 或 x = 3'];
  return `<span class="exam-paper ${kind}" aria-hidden="true"><b>${kind === 'before' ? '第一次段考' : '第二次段考'}</b>${lines.map((l) => `<span>${m(l)}</span>`).join('')}<i class="beam"></i></span>`;
}

export const screens = {
  's/exam': {
    tab: 's/me',
    guard: (ctx) => (ctx.state.student.diag.done ? null : 's/start'),
    meta: { title: '段考對照', tips: ['示範：考卷用範例圖代替，辨識結果依你在 App 裡的卡點狀態模擬。', '兩次都上傳後，家長的 LINE 會收到段考對照卡。'] },
    mount(ctx) {
      if (!ui.scanning) return null;
      const kind = ui.scanning;
      const t = setTimeout(() => {
        ui.scanning = null;
        ctx.update((s) => {
          const st = s.student;
          const before = st.exams.before ? st.exams.before.counts : examBefore(st.diag.stuck);
          if (kind === 'before') st.exams.before = { date: s.clock.date, counts: before };
          else {
            const status = Object.fromEntries(Object.entries(st.skills).map(([k, v]) => [k, v.status]));
            st.exams.after = { date: s.clock.date, counts: examAfter(before, status) };
          }
        });
      }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 1500);
      return () => clearTimeout(t);
    },
    render(ctx) {
      const st = ctx.state.student;
      const ex = st.exams;
      const slot = (kind, label) => {
        const done = ex[kind];
        const scanning = ui.scanning === kind;
        const locked = kind === 'after' && !ex.before;
        return `<div class="card upl ${scanning ? 'scanning' : ''}">
          ${paper(kind)}
          <div><b>${label}</b><small>${done ? `${fmtMD(done.date)} 上傳 · 錯 ${sumCounts(done.counts)} 題` : scanning ? '我在看考卷⋯' : locked ? '先上傳上一次的' : '還沒上傳'}</small>
          ${scanning ? '' : `<button class="btn s ${done ? 'ghost' : ''}" data-act="upload" data-k="${kind}" ${locked ? 'disabled' : ''}>${icon('upload')}${done ? '重新上傳' : '上傳（用示範考卷）'}</button>`}</div>
        </div>`;
      };
      let compare = '';
      if (ex.before && ex.after) {
        const b = ex.before.counts; const a = ex.after.counts;
        const max = Math.max(1, ...Object.values(b), ...Object.values(a));
        const ch = [...CHAPTERS].sort((x, y) => ((b[y.id] - a[y.id]) - (b[x.id] - a[x.id])))[0];
        compare = `<h2 class="h3">錯題類別對照</h2>
          <div class="card">
            <div class="cmp-h"><span><i class="k b"></i>上一次</span><span><i class="k a"></i>這一次</span></div>
            ${CHAPTERS.map((c) => `<div class="cmp"><span class="cmp-n">${esc(c.name)}</span>
              <span class="cmp-bars"><i class="b" style="width:${(b[c.id] / max) * 100}%"></i><i class="a" style="width:${(a[c.id] / max) * 100}%"></i></span>
              <span class="cmp-v num">${b[c.id]} → ${a[c.id]}</span></div>`).join('')}
            <div class="sumrow"><span>全部錯題</span><b class="num">${sumCounts(b)} → ${sumCounts(a)}</b></div>
          </div>
          ${coach(`跟「${ch.name}」有關的錯，從 ${b[ch.id]} 題變 ${a[ch.id]} 題。${sumCounts(a) < sumCounts(b) ? '這 8 週補的洞，考卷上看得到。' : '還有要補的地方，我們下一期接著走。'}`, { night: ctx.night })}`;
      }
      return `<div class="pad pbt">
        ${backBar('段考對照', 's/me')}
        <h1 class="hero s" tabindex="-1">考完了？<br>拍考卷給我看。</h1>
        <p class="sub">我只看錯在哪一類，不看分數排名。</p>
        ${slot('before', '上一次段考')}
        ${slot('after', '這一次段考')}
        ${compare}
        <p class="fine left">示範：考卷是範例圖；「這一次」的結果依你現在的卡點狀態模擬——翻成金色的點不會再錯。</p>
      </div>`;
    },
    on: {
      upload(ctx, el) { ui.scanning = el.dataset.k; ctx.remount(); },
    },
  },
};
