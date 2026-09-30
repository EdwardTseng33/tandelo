// 共用畫面：選身分、設定、關於這個 POC

import { esc, icon, duo, backBar } from '../ui.js';
import { fmtLong, isLightsOut } from '../state.js';
import { homeFor } from '../router.js';

const ROLES = [
  { id: 'student', name: '我是學生', desc: '找卡點、湊小隊、上課、和小陪練習', ic: 'pencil' },
  { id: 'parent', name: '我是家長', desc: '在 LINE 收到週報、段考對照與付款說明', ic: 'chat' },
  { id: 'teacher', name: '我是老師', desc: '接班、課前一頁、帶小隊、看收入', ic: 'users' },
];

function roleButtons(current, act = 'pickRole') {
  return ROLES.map((r) => `<button class="role-card ${current === r.id ? 'on' : ''}" data-act="${act}" data-role="${r.id}">
    <span class="ic">${icon(r.ic)}</span><span><b>${r.name}</b><small>${r.desc}</small></span>${icon('chev', 'chev')}</button>`).join('');
}

export const screens = {
  welcome: {
    tabs: false,
    meta: { title: '選一個身分開始', tips: ['三個身分共用同一份示範資料：學生在 App 做的事，會出現在家長的 LINE 週報和老師的課前一頁。', '左邊可以隨時切換身分、調整示範時間。'] },
    render() {
      return `<div class="welcome">
        <div class="wm big">Tandelo<span class="dots"><i></i><i></i></span></div>
        <div class="hero-duo">${duo('idle', 'xl')}</div>
        <h1 class="hero" tabindex="-1">孩子卡在哪，<br>就從哪裡開始。</h1>
        <p class="sub">對準段考的 8 週小隊課。這是可以操作的概念驗證，選一個身分走走看。</p>
        <div class="roles">${roleButtons(null)}</div>
        <p class="fine">資料只留在你的裝置，不會送到任何伺服器。所有人名都是虛構的。</p>
        <button class="btn ghost s" data-act="askReset">${icon('refresh')}重設示範資料</button>
      </div>`;
    },
  },

  settings: {
    tabs: 'auto',
    tab: 'settings',
    meta: { title: '設定', tips: ['「示範時間」可以跳到 22:31 看關燈、或往後快轉幾天讓再測到期。', '重設會清掉這台裝置上的示範資料。'] },
    render(ctx) {
      const { state } = ctx;
      const back = state.role ? homeFor(state.role, state) : 'welcome';
      const night = isLightsOut(state.clock.time);
      return `<div class="pad">
        ${backBar('設定', back)}
        <h1 class="sr" tabindex="-1">設定</h1>
        <section class="set">
          <h2 class="h3">身分</h2>
          <div class="roles compact">${roleButtons(state.role)}</div>
        </section>
        <section class="set">
          <h2 class="h3">示範時間</h2>
          <p class="fine left">${fmtLong(state.clock.date)} ${esc(state.clock.time)}${night ? ' · 已關燈' : ''}</p>
          <div class="field2">
            <label class="field"><span>日期</span><input class="input" type="date" id="setDate" value="${state.clock.date}" data-change="setDate"></label>
            <label class="field"><span>時刻</span><input class="input" type="time" id="setTime" value="${state.clock.time}" data-change="setTime"></label>
          </div>
          <div class="quick">
            <button class="chipbtn" data-act="setClock" data-time="20:40">${icon('sun')}20:40</button>
            <button class="chipbtn" data-act="setClock" data-time="22:31">${icon('moon')}22:31 關燈</button>
            <button class="chipbtn" data-act="shiftDays" data-days="1">${icon('forward')}往後 1 天</button>
            <button class="chipbtn" data-act="shiftDays" data-days="7">${icon('forward')}往後 7 天</button>
          </div>
        </section>
        <section class="set">
          <h2 class="h3">外觀</h2>
          <div class="seg" role="group" aria-label="外觀">
            ${[['auto', '跟系統'], ['light', '淺色'], ['dark', '深色']].map(([v, n]) => `<button data-act="setTheme" data-theme="${v}" aria-pressed="${state.theme === v}">${n}</button>`).join('')}
          </div>
          <p class="fine left">22:30 之後，不論設定，學生畫面都會轉暗。</p>
        </section>
        <section class="set">
          <h2 class="h3">資料</h2>
          <button class="row" data-act="askReset"><span class="ic">${icon('refresh')}</span><span><b>重設示範資料</b><small>回到一開始的狀態</small></span>${icon('chev', 'chev')}</button>
          <button class="row" data-go="about"><span class="ic">${icon('help')}</span><span><b>關於這個 POC</b><small>哪些是真的、哪些是模擬</small></span>${icon('chev', 'chev')}</button>
          <a class="row" href="../"><span class="ic">${icon('home')}</span><span><b>回到 Tandelo 網站</b><small>產品介紹</small></span>${icon('chev', 'chev')}</a>
        </section>
        <p class="sign">Tandelo 概念驗證（POC）· Edward Tseng · 2026</p>
      </div>`;
    },
  },

  about: {
    tabs: false,
    meta: { title: '關於這個 POC', tips: ['這一頁說明哪些是模擬的。'] },
    render(ctx) {
      return `<div class="pad">
        ${backBar('關於這個 POC', 'settings')}
        <h1 class="hero s" tabindex="-1">這是概念驗證，<br>不是正式產品。</h1>
        <div class="card">
          <b>可以真的操作的</b>
          <ul class="list">
            <li>學生：兩分鐘開始、8 題診斷、選時段湊隊、選方案、小隊課六段、拍題問小陪、說給我聽、過幾天再測、段考對照、22:30 關燈。</li>
            <li>家長：LINE 週報、段考對照、付款與退出說明，內容由學生端的實際狀態產生。</li>
            <li>老師：接班、課前一頁（可換題）、教室點名與分組、課後紀錄、依等級分潤的收入與出帳明細。</li>
          </ul>
        </div>
        <div class="card mint">
          <b>模擬的部分</b>
          <ul class="list">
            <li>小陪是前端的規則引擎加上預寫的對話（示範模式），沒有連到任何 AI 服務。</li>
            <li>拍照、上傳考卷、語音都用範例代替；付款是示範，不會收任何錢。</li>
            <li>隊友、老師、學生都是虛構人物；價格與分潤是試算。</li>
          </ul>
        </div>
        <div class="card">
          <b>你的資料</b>
          <p class="body">只存在這台裝置的瀏覽器（localStorage），不送到任何伺服器。可以在設定裡隨時重設。</p>
        </div>
        <p class="sign">Tandelo 概念驗證（POC）· Edward Tseng · 2026</p>
      </div>`;
    },
  },
};

export const actions = {
  pickRole(ctx, el) {
    const role = el.dataset.role;
    ctx.update((s) => { s.role = role; });
    ctx.go(homeFor(role, ctx.state));
  },
};
