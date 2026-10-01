// 家長：仿 LINE 聊天介面（LINE 綠只在這裡）

import { esc, icon, mt, duo, money } from '../ui.js';
import { parentFeed } from '../report.js';
import { PLANS, refundIfQuit, fmtMD, fmtMDW, squadRule } from '../state.js';
import { slotLabel, TEACHER } from '../content.js';

const REACTIONS = ['看到了', '好厲害', '晚上講給我聽'];
// 家長按了回應之後，官方帳號回一句（短、不催、不比較）
const REPLIES = { '看到了': '收到。', '好厲害': '我會把這句話帶給他。', '晚上講給我聽': '好。今晚用上面那一句開場就可以，不用懂數學。' };
const ui = { open: {}, fresh: null, t: null };
const typingDots = '<span class="ltyping" aria-hidden="true"><i></i><i></i><i></i></span>';

function reactRow(ctx, id) {
  const r = ctx.state.parent.reactions[id];
  return `<div class="rx" role="group" aria-label="回應">${REACTIONS.map((t) => `<button data-act="react" data-id="${id}" data-v="${t}" aria-pressed="${r === t}">${t}</button>`).join('')}</div>`;
}

function bubble(ctx, msg) {
  const st = ctx.state.student;
  const name = esc(st.name);
  switch (msg.kind) {
    case 'text':
      return `<div class="lb">${msg.title ? `<h5>${esc(msg.title)}</h5>` : ''}<div>${mt(msg.text)}</div></div>`;
    case 'diag':
      return `<div class="lb"><h5>${esc(msg.title)}</h5>${msg.lines.map((l) => `<div>${mt(l)}</div>`).join('')}${msg.quote ? `<div class="q">${esc(msg.quote)}</div>` : ''}</div>`;
    case 'plan':
      return `<div class="lb wide" id="msg-plan"><h5>${esc(msg.title)}</h5>
        <div class="kvl"><span>方案</span><b>${msg.plan.name}${msg.plus ? '＋Plus' : ''}</b></div>
        ${msg.slot ? `<div class="kvl"><span>時段</span><b>每${esc(slotLabel(msg.slot))}</b></div><div class="kvl"><span>第一堂</span><b>${fmtMDW(msg.first)}（試上）</b></div>` : ''}
        <div class="kvl"><span>金額</span><b class="num">${money(msg.total)}</b></div>
        <span class="cap">示範付款，沒有收任何錢。</span>
        <button class="lbtn" data-act="payInfo">付款與退出怎麼算</button></div>`;
    case 'lesson':
      return `<div class="lb"><h5>${esc(msg.title)}</h5>
        ${msg.got ? `<div>${name}說他搞懂的是：「${mt(msg.got)}」</div>` : ''}
        ${msg.teacher ? `<div class="tq"><b>${TEACHER.name}：</b>${esc(msg.teacher)}</div>` : ''}
        <div class="q">${mt(msg.tonight)}</div><span class="cap">不用懂數學。他會很想講給你聽。</span>${reactRow(ctx, msg.id)}</div>`;
    case 'gold':
      return `<div class="lb gold"><h5>${esc(msg.title)}</h5><div>${esc(msg.text)}</div><div class="q">${mt(msg.tonight)}</div>${reactRow(ctx, msg.id)}</div>`;
    case 'weekly':
      return `<div class="lb wide weekly" id="msg-weekly"><h5>${name}這一週</h5>
        <div class="w3"><div><b class="num">${msg.days}</b><small>天有練習</small></div><div><b class="num">${msg.explains}</b><small>次說給小陪聽</small></div><div><b class="num">${msg.lessons}</b><small>堂小隊課</small></div></div>
        ${msg.tonight ? `<div class="q">${mt(msg.tonight)}</div>` : ''}
        <button class="lmore" data-act="toggleWeekly" data-id="${msg.id}" aria-expanded="${!!ui.open[msg.id]}" aria-controls="wk-${msg.id}">${ui.open[msg.id] ? '收起來' : '展開：他學會什麼、下週做什麼'}${icon(ui.open[msg.id] ? 'up' : 'down')}</button>
        <div class="wmore ${ui.open[msg.id] ? 'open' : ''}" id="wk-${msg.id}" ${ui.open[msg.id] ? '' : 'hidden'}>
        <div class="wsec"><span class="lbl">他學會什麼</span>${msg.learned.length ? msg.learned.map((t) => `<div>翻過去了：${esc(t)}</div>`).join('') : ''}${msg.explained.map((e) => `<div>講得出「${esc(e.title)}」，${fmtMD(e.due)} 再測一次</div>`).join('')}${!msg.learned.length && !msg.explained.length ? '<div>這週還在練，還沒有新學會的點。這很正常。</div>' : ''}</div>
        <div class="wsec"><span class="lbl">下週做什麼</span><div>${msg.next ? `第 ${msg.next.week} 堂 ${fmtMDW(msg.next.date)}：${mt(msg.next.topic)}` : '還沒加入小隊，每天和小陪練一點。'}</div></div>
        <span class="cap">提示用了 ${msg.hints} 次，我們都記下來了。分數與逐題對錯不在這裡。</span>
        </div>${reactRow(ctx, msg.id)}</div>`;
    case 'exam':
      return `<div class="lb wide" id="msg-exam"><h5>段考對照：錯題從 ${msg.before} 題變 ${msg.after} 題</h5>
        ${msg.rows.map((r) => `<div class="kvl"><span>${esc(r.name)}</span><b class="num">${r.before} → ${r.after}</b></div>`).join('')}
        <span class="cap">小陪對照了兩張考卷的錯題類別（示範資料）。</span>${reactRow(ctx, msg.id)}</div>`;
    default: return '';
  }
}

export const screens = {
  'p/line': {
    tabs: false,
    meta: { title: '家長的 LINE', tips: ['這裡的每一張卡片都由學生端的實際狀態產生：診斷、付款、課堂紀錄、翻過去的點、週報、段考對照。', '先切到學生身分走幾步，再回來看會多出什麼。', 'LINE 綠只出現在這個畫面。'] },
    mount() {
      const chat = document.getElementById('lineChat');
      const view = document.getElementById('view');
      if (chat && view) view.scrollTop = view.scrollHeight;
      return null;
    },
    render(ctx) {
      const feed = parentFeed(ctx.state);
      const st = ctx.state.student;
      const av = `<span class="lav">${duo('idle', 'xs')}</span>`;
      // 我的回應＋官方帳號的一句回覆；剛按下去的那一次會先看到「輸入中」三個點
      const echo = (id) => {
        const r = ctx.state.parent.reactions[id];
        if (!r) return '';
        const fresh = ui.fresh === id;
        return `<div class="lrow me ${fresh ? 'pop' : ''}"><div class="lb me">${esc(r)}</div></div>
          <div class="lrow lseq ${fresh ? 'fresh' : ''}">${av}<div class="lseq-b">${fresh ? typingDots : ''}<div class="lb">${esc(REPLIES[r] || '收到。')}</div></div></div>`;
      };
      const n = feed.length;
      return `<div class="line">
        <div class="lh"><span class="lg">${duo('idle', 's')}</span><div><b>Tandelo · ${esc(st.name)}的學習</b><small>官方帳號（示範）</small></div><button class="iconbtn" data-go="settings" aria-label="設定">${icon('gear')}</button></div>
        <h1 class="sr" tabindex="-1">家長的 LINE：${esc(st.name)}的學習</h1>
        <div class="chat" id="lineChat">
          ${feed.map((msg, i) => {
    // 進場：最後幾則依序出現；最新的一則先出現「輸入中」再換成訊息
    const k = Math.max(0, i - (n - 5));
    const last = i === n - 1 && n > 1;
    return `<span class="day lin" style="--i:${k}">${esc(msg.when)}</span><div class="lrow lin ${last ? 'lseq arrive' : ''}" style="--i:${k}">${av}${last ? `<div class="lseq-b">${typingDots}${bubble(ctx, msg)}</div>` : bubble(ctx, msg)}</div>${echo(msg.id)}`;
  }).join('')}
          ${st.diag.done ? '' : `<div class="lrow"><span class="lav">${duo('idle', 'xs')}</span><div class="lb"><div>${esc(st.name)}還沒開始。切到學生身分走兩分鐘，這裡就會出現他的診斷與週報。</div><button class="lbtn" data-act="toStudent">切到學生身分</button></div></div>`}
        </div>
        <div class="lfoot"><div class="richmenu">
          <button data-act="jump" data-to="msg-weekly">${icon('cal')}這週週報</button>
          <button data-act="jump" data-to="msg-exam">${icon('upload')}段考對照</button>
          <button data-act="payInfo">${icon('coin')}付款與退出</button>
        </div>
        <div class="linput"><span>示範：用訊息下面的按鈕回應</span><span class="lsend">${icon('arrow')}</span></div></div>
      </div>`;
    },
    on: {
      react(ctx, el) {
        const id = el.dataset.id;
        ui.fresh = id;
        ctx.update((s) => { s.parent.reactions[id] = el.dataset.v; });
        clearTimeout(ui.t);
        ui.t = setTimeout(() => { ui.fresh = null; }, 1600);
      },
      toggleWeekly(ctx, el) { ui.open[el.dataset.id] = !ui.open[el.dataset.id]; ctx.rerender({ focusSel: `[data-act="toggleWeekly"]` }); },
      toStudent(ctx) { ctx.update((s) => { s.role = 'student'; }, { silent: true }); ctx.go('s/start'); },
      jump(ctx, el) {
        const t = document.getElementById(el.dataset.to);
        if (t) { t.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); t.classList.add('pulse'); setTimeout(() => t.classList.remove('pulse'), 1200); return; }
        ctx.toast(el.dataset.to === 'msg-exam' ? '孩子在 App 上傳兩次段考考卷後，這裡會出現對照卡。' : '孩子做完診斷後，這裡會出現週報。');
      },
      payInfo(ctx) {
        const st = ctx.state.student;
        const p = st.plan ? PLANS[st.plan.id] : null;
        const n = ctx.state.squad ? ctx.state.squad.members.length : 5;
        ctx.sheet(`<div class="sheet-c line-sheet">
          <h2 class="h2">付款與退出</h2>
          ${p ? `<div class="kvl"><span>目前方案</span><b>${p.name}${st.plan.plus ? '＋Plus' : ''} · ${money(st.plan.total)}</b></div>
            <div class="kvl"><span>已上</span><b>${st.lessons.length} / ${p.lessons} 堂</b></div>
            <div class="kvl"><span>如果現在退出</span><b class="num">退 ${money(refundIfQuit(st.plan.id, st.lessons.length))}</b></div>
            <p class="fine left">以上是示範試算，不會真的扣款或退款。</p>` : '<p class="body">還沒加入任何方案。</p>'}
          <ul class="list sm">
            <li>4 團 NT$1,790／8 團 NT$2,990／8 團＋一對一 2 小時 NT$5,990；Plus 月訂 NT$299。</li>
            <li>第一堂試上，不滿意不收費。</li>
            <li>成班才扣次數，沒成班全額退回。這一隊目前 ${n} 人：${squadRule(n).label}。</li>
            <li>滿 4 人成班、3 人改 1 對 3（學費照調）、2 人以下不開，全額退。</li>
            <li>中途退出：上過的照算，沒上的退。停一期也可以，學會的點會一直留著。</li>
          </ul>
          <button class="btn block line-btn" data-act="closeSheet">知道了</button>
        </div>`, '付款與退出');
      },
    },
  },
};
