// avatar.js — 孩子的插畫角色：兜帽斗篷小冒險者（不用真人臉、不用動物，避免和怪物搶「異類」語意）。
// 斗篷＝隊色（系統分配，不自選）；臉型 3 × 膚色 4 × 髮型 8 × 髮色 4 × 配件 7（含無）。
// 形狀語言和怪物分開：角色用有機曲線、點狀小眼；怪物是幾何輪廓、大眼。

export const CAPES = ['#0E5F52', '#2F8F7A', '#E86F5A', '#E0A12C', '#5C8FE6', '#9A7FDA', '#3FA37C']; // index 0＝嚮導（不用在孩子）、1–6＝隊色
export const SKINS = ['#F7DAC0', '#EEC39E', '#D9A57E', '#B98460'];
export const HAIRS = ['#2A2320', '#3B2B22', '#5A3E2B', '#1C1A1A'];
export const HAIR_NAMES = ['齊瀏海', '旁分', '捲髮', '刺刺頭', '小平頭', '鮑伯頭', '長瀏海', '包包頭'];
export const FACE_NAMES = ['圓臉', '鵝蛋臉', '方圓臉'];
export const ACC_NAMES = ['不帶', '燈籠', '羅盤', '圓規', '筆記本', '捲尺', '小旗'];

// 預設隊友造型（示範資料：av 編號 → 造型）
export const PRESETS = {
  1: { face: 0, skin: 1, hair: 1, hairC: 0, acc: 4 },
  2: { face: 1, skin: 0, hair: 5, hairC: 1, acc: 1 },
  3: { face: 2, skin: 2, hair: 3, hairC: 3, acc: 2 },
  4: { face: 1, skin: 1, hair: 7, hairC: 0, acc: 6 },
  5: { face: 0, skin: 3, hair: 2, hairC: 3, acc: 5 },
  6: { face: 2, skin: 0, hair: 4, hairC: 2, acc: 3 },
};

const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (c) => Math.max(0, Math.min(255, Math.round(c * k))); return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('')}`; };

const FACES = [
  '<circle cx="32" cy="32" r="11.5"/>',
  '<ellipse cx="32" cy="32.4" rx="10.6" ry="12.2"/>',
  '<path d="M21 30.5c0-7 4.8-11 11-11s11 4 11 11c0 7.6-4.8 13.3-11 13.3S21 38.1 21 30.5z"/>',
];
const HAIR = [
  '<path d="M20.4 31c-.4-8 4.6-12.6 11.6-12.6S44 23 43.6 31c-3.2-2.2-6.8-3.2-11.6-3.2S23.6 28.8 20.4 31z"/>',
  '<path d="M20.4 32c-.4-9 4.8-13.6 11.6-13.6S44 22.6 43.6 30c-5.4-.2-10.4-2.4-13.4-6.4-2 4.2-5.6 7-9.8 8.4z"/>',
  '<g><circle cx="23.4" cy="26.4" r="4"/><circle cx="28" cy="22.4" r="4.2"/><circle cx="33.6" cy="21.6" r="4.2"/><circle cx="38.8" cy="24" r="4"/><circle cx="41.6" cy="28.4" r="3.4"/><circle cx="21.6" cy="30.4" r="3"/></g>',
  '<path d="M20.6 31.4l1.6-8.4 3.2 3.6 2.8-7 3 6 3.8-6.4 2.4 6.6 3.6-4.2 1.8 9.8c-3.8-2.2-7.6-3.2-11.6-3.2s-7.6 1-10.6 3.2z"/>',
  '<path d="M21.4 28.6c1-7 5-10.4 10.6-10.4s9.6 3.4 10.6 10.4c-3.2-1.2-6.8-1.8-10.6-1.8s-7.4.6-10.6 1.8z"/>',
  '<path d="M19.6 37.6c-1.2-11.4 3.8-19.2 12.4-19.2s13.6 7.8 12.4 19.2c-1.8-2.8-2.8-6.6-2.8-10-3 1-6.4 1.2-9.6 1.2s-6.6-.2-9.6-1.2c0 3.4-1 7.2-2.8 10z"/>',
  '<path d="M20.4 33c-.2-9.4 4.8-14.6 11.6-14.6S44 23.4 43.6 31.4c-6.4-.8-12.4-3.8-15.2-8.8-1.2 5-4 8.6-8 10.4z"/>',
  '<g><circle cx="32" cy="15.6" r="4.4"/><path d="M20.4 31c-.4-8 4.6-12.6 11.6-12.6S44 23 43.6 31c-3.2-2.2-6.8-3.2-11.6-3.2S23.6 28.8 20.4 31z"/></g>',
];
// 配件：掛在胸前右下（64 格座標）
const ACC = [
  '',
  '<g><path d="M45 44.5v2.2" stroke="#3A2E22" stroke-width="1.4" stroke-linecap="round"/><rect x="41.6" y="46.4" width="7" height="9" rx="2.4" fill="#F4C24D" stroke="#3A2E22" stroke-width="1.3"/><circle cx="45.1" cy="50.9" r="1.8" fill="#FFF3C4"/></g>',
  '<g><circle cx="45.2" cy="51" r="5.2" fill="#F6F4EE" stroke="#3A2E22" stroke-width="1.3"/><path d="M45.2 47.2l1.4 3.8-1.4 3.8-1.4-3.8z" fill="#F26B54"/></g>',
  '<g fill="none" stroke="#3A2E22" stroke-width="1.5" stroke-linecap="round"><path d="M45 45.4l-3.6 10.4M45 45.4l3.6 10.4"/><circle cx="45" cy="45.4" r="1.4" fill="#F4C24D"/></g>',
  '<g><rect x="40.6" y="45.6" width="9" height="10.6" rx="1.4" fill="#F6F4EE" stroke="#3A2E22" stroke-width="1.3"/><path d="M42.6 48.8h5M42.6 51.4h5M42.6 54h3" stroke="#0E5F52" stroke-width="1.1" stroke-linecap="round"/></g>',
  '<g><circle cx="45.2" cy="51" r="4.8" fill="#F4C24D" stroke="#3A2E22" stroke-width="1.3"/><circle cx="45.2" cy="51" r="1.6" fill="#3A2E22"/><path d="M48.6 54.2l3.4 2.4" stroke="#3A2E22" stroke-width="1.4" stroke-linecap="round"/></g>',
  '<g><path d="M42.2 56.4V44.6" stroke="#3A2E22" stroke-width="1.5" stroke-linecap="round"/><path d="M42.6 45l7 2.6-7 2.6z" fill="#F26B54"/></g>',
];

/**
 * 產生角色 SVG。
 * cfg：{ face, skin, hair, hairC, acc }；cape：隊色 index（1–6）；mood：'calm' | 'smile'。
 * small：24px 以下只畫頭（裁到臉），配件省略。
 */
export function avatarSvg(cfg = PRESETS[1], cape = 1, { mood = 'calm', small = false, title = '' } = {}) {
  const c = { ...PRESETS[1], ...cfg };
  const capeC = CAPES[cape] || CAPES[1];
  const hood = shade(capeC, 0.78);
  const lining = shade(capeC, 1.18);
  const skin = SKINS[c.skin] || SKINS[0];
  const hair = HAIRS[c.hairC] || HAIRS[0];
  const vb = small ? '14 10 36 36' : '0 0 64 64';
  const mouth = mood === 'smile' ? '<path d="M28.4 37.2c1 1.6 2.2 2.4 3.6 2.4s2.6-.8 3.6-2.4" fill="none" stroke="#3A2E22" stroke-width="1.5" stroke-linecap="round"/>' : '<path d="M29.6 37.8c.8.6 1.6.9 2.4.9s1.6-.3 2.4-.9" fill="none" stroke="#3A2E22" stroke-width="1.4" stroke-linecap="round"/>';
  const eyes = mood === 'smile'
    ? '<path d="M26 32.6c.8-1 2.2-1 3 0M35 32.6c.8-1 2.2-1 3 0" fill="none" stroke="#2A2320" stroke-width="1.5" stroke-linecap="round"/>'
    : '<circle cx="27.6" cy="32.6" r="1.55" fill="#2A2320"/><circle cx="36.4" cy="32.6" r="1.55" fill="#2A2320"/>';
  return `<svg viewBox="${vb}" role="${title ? 'img' : 'presentation'}" ${title ? `aria-label="${title}"` : 'aria-hidden="true"'}>
    <path d="M7 66c1.4-13.6 10.6-21 25-21s23.6 7.4 25 21z" fill="${capeC}"/>
    <path d="M24.6 45.6l7.4 7.2 7.4-7.2" fill="none" stroke="${lining}" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="32" cy="52.4" r="1.9" fill="#F4C24D" stroke="${hood}" stroke-width="1"/>
    <path d="M13.6 36.6C12.8 21.4 21 11 32 11s19.2 10.4 18.4 25.6c-.2 4-1.6 7.4-4 10H17.6c-2.4-2.6-3.8-6-4-10z" fill="${hood}"/>
    <path d="M17.6 36.4c-.4-11.6 6-19.4 14.4-19.4s14.8 7.8 14.4 19.4" fill="${shade(hood, 0.82)}"/>
    <g fill="${skin}">${FACES[c.face] || FACES[0]}</g>
    <g fill="${hair}">${HAIR[c.hair] || HAIR[0]}</g>
    ${eyes}
    <circle cx="25.4" cy="36.4" r="1.8" fill="#F26B54" opacity=".22"/><circle cx="38.6" cy="36.4" r="1.8" fill="#F26B54" opacity=".22"/>
    ${mouth}
    ${small ? '' : ACC[c.acc] || ''}
  </svg>`;
}
