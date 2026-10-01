// ui.js — 共用的畫面小零件（回傳 HTML 字串）

import { AVATAR_COLORS } from './content.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function mathChars(s) {
  let out = '';
  for (const ch of String(s ?? '')) {
    if (/[a-zA-Z]/.test(ch)) out += `<i>${ch}</i>`;
    else if (ch === '-') out += '−';
    else out += esc(ch);
  }
  return out;
}
/** 整段數學式：STIX Two Text，變數斜體 */
export function m(expr) { return `<span class="math">${mathChars(expr)}</span>`; }
/** 中文夾數學：只把英文字母變斜體數學字 */
export function mt(text) {
  let out = '';
  for (const ch of String(text ?? '')) {
    if (/[a-zA-Z]/.test(ch)) out += `<i class="v">${ch}</i>`;
    else if (ch === '-') out += '−';
    else out += esc(ch);
  }
  return out;
}

export function icon(name, cls = '') { return `<svg class="i ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`; }

/** 小陪：兩個圓。mode：idle 待命呼吸／listen 在聽浮起／talk 說話一縮一放／joy 學會一起跳／sleep 關燈 */
export function duo(mode = 'idle', size = '') { return `<span class="duo ${size}" data-mode="${mode}" aria-hidden="true"><i></i><i></i></span>`; }

export function coach(text, { mode = 'talk', label = '小陪', night = false, id = '', slot = 'coach' } = {}) {
  if (night || text == null) {
    return `<div class="coach quiet" ${id ? `id="${id}"` : ''}>${duo('sleep')}<div><div class="coach-n">${esc(label)}</div><div class="coach-m">22:30 之後我不出聲。明天見。</div></div></div>`;
  }
  return `<div class="coach" ${id ? `id="${id}"` : ''}>${duo(mode)}<div><div class="coach-n">${esc(label)}<span class="demo-tag">示範模式</span></div><div class="coach-m" data-type="${slot}">${mt(text)}</div></div></div>`;
}

export function avatar(member, size = '') {
  const bg = AVATAR_COLORS[member.color % AVATAR_COLORS.length];
  return `<span class="av ${size} ${member.isMe ? 'me' : ''}" style="--av:${bg}" aria-hidden="true">${esc(member.name.slice(-1))}</span>`;
}

export function money(n) { return `NT$${Math.round(n).toLocaleString('en-US')}`; }
export function num(n) { return Math.round(n).toLocaleString('en-US'); }

export function backBar(title, back = '', right = '') {
  return `<div class="abar">${back ? `<button class="iconbtn" data-go="${back}" aria-label="返回">${icon('back')}</button>` : '<span class="iconbtn-sp"></span>'}<span class="abar-t">${esc(title)}</span>${right || '<span class="iconbtn-sp"></span>'}</div>`;
}

export function steps(i, n) {
  return `<div class="stepdots" aria-label="第 ${i} 步，共 ${n} 步">${Array.from({ length: n }, (_, k) => `<i class="${k < i ? 'on' : ''}"></i>`).join('')}</div>`;
}

export function statusLabel(status) {
  return ({ stuck: '卡在這', learning: '練習中', green: '說得出來 · 等再測', gold: '已掌握', ok: '目前沒問題', unknown: '還沒碰到' })[status] || '還沒碰到';
}
