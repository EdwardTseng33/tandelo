// Demo 端對端：用真的瀏覽器把一週循環玩一遍（本地引擎模式，不連後端）。
// 用法：node e2e.mjs [baseURL]；預設 http://localhost:8765（由 CI 或本機先用 python -m http.server 8765 --directory frontend 起靜態伺服器）。
// 每一步都斷言；任何 console 錯誤或頁面例外都算失敗。
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8765';
const U = `${BASE}/world/index.html`;
const launch = { headless: true };
if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM;

const b = await chromium.launch(launch);
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
const p = await ctx.newPage(); p.setDefaultTimeout(10000);
const errs = [];
p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error' && !/ERR_CERT|favicon|net::ERR/.test(m.text())) errs.push(`console: ${m.text()}`); });

const results = [];
const step = async (name, fn) => { try { const r = await fn(); results.push([name, true, r ?? '']); } catch (e) { results.push([name, false, String(e.message).split('\n')[0].slice(0, 160)]); } };
const vis = (sel) => p.locator(`${sel}:visible`).first();
const click = async (sel) => { await vis(sel).click(); };
const hash = () => p.evaluate(() => location.hash);
const hold = async (sel, ms) => { const box = await vis(sel).boundingBox(); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.waitForTimeout(ms); await p.mouse.up(); await p.waitForTimeout(150); };
const setClock = async (id) => { await p.evaluate((id) => { const k = 'tandelo.world.v1'; const st = JSON.parse(localStorage.getItem(k) || '{}'); st.clock = id; localStorage.setItem(k, JSON.stringify(st)); }, id); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(300); };
const solved = () => p.evaluate(() => !!document.querySelector('.opt.ok'));
const solve = async (optSel) => {
  // 逐一試選項直到出現 .opt.ok；會先碰到怪的錯法（trap）也沒關係。前一步若已經點中（選項全鎖），直接算過。
  if (await solved()) return -1;
  for (let k = 0; k < 4; k++) { const btn = p.locator(`[${optSel}="${k}"]:visible`).first(); if (await btn.isDisabled().catch(() => true)) continue; await btn.click(); await p.waitForTimeout(200); if (await p.evaluate(() => !!document.querySelector('.opt.ok'))) return k; }
  throw new Error('找不到正解');
};
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

await p.goto(`${U}#/`, { waitUntil: 'networkidle' }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(400);

await step('首頁與嚮導的信', async () => { await click('[data-act="letter"]'); await p.waitForTimeout(600); assert((await hash()) === '#/letter', '沒進到信'); await click('[data-back]'); await p.waitForTimeout(300); });
await step('巡邏三題（變體、小陪、錄音）', async () => {
  await click('[data-go="play"]'); await p.waitForTimeout(300); assert((await hash()) === '#/play', '沒進巡邏');
  const stems = [];
  for (let i = 0; i < 3; i++) {
    stems.push((await vis('.stem .mx').textContent()).trim());
    if (i === 0) { await click('[data-opt="0"]'); await p.waitForTimeout(150); if (!(await p.evaluate(() => !!document.querySelector('.opt.ok')))) { await click('.chip[data-coach]'); await p.waitForTimeout(150); assert((await p.locator('.coach .lvl').textContent()).includes('指'), '小陪沒升到「指」'); } }
    await solve('data-opt');
    if (await p.locator('.rec .mic:visible').count()) { await hold('.rec .mic', 3300); }
    await click('[data-act="next"]'); await p.waitForTimeout(300);
  }
  assert(new Set(stems).size === 3, '三題題幹重複');
  assert(await p.locator('text=巡邏完成').count(), '沒有完成畫面');
  await p.locator('.reward').first().click({ timeout: 3000 }).catch(() => {});
  return stems.join(' | ');
});
await step('再巡一次會換題', async () => { const before = await p.evaluate(() => JSON.parse(localStorage.getItem('tandelo.world.v1')).seed); await click('[data-act="patrol-again"]'); await p.waitForTimeout(300); const after = await p.evaluate(() => JSON.parse(localStorage.getItem('tandelo.world.v1')).seed); assert(before !== after, '種子沒換'); assert(await p.locator('[data-opt]:visible').count() === 4, '沒回到第一題'); });
await step('副本與 Boss 接力', async () => { await p.goto(`${U}#/dungeon`); await p.waitForTimeout(300); await click('[data-go="relay"]'); await p.waitForTimeout(300); let ok = false; for (let k = 0; k < 4 && !ok; k++) { await click(`[data-ropt="${k}"]`); await p.waitForTimeout(150); ok = !(await p.locator('[data-act="relay-submit"]').first().isDisabled()); } assert(ok, '接力找不到正解'); await click('[data-act="relay-submit"]'); await p.waitForTimeout(400); await p.locator('.reward').first().click({ timeout: 3000 }).catch(() => {}); assert(await p.locator('text=交棒了').count(), '沒交棒'); });
await step('講解給隊友、結算、隊伍牆、公會', async () => { await p.goto(`${U}#/dungeon`); await p.waitForTimeout(300); if (await p.locator('[data-act="help"]:visible').count()) await click('[data-act="help"]'); await click('[data-act="settle"]'); await p.waitForTimeout(400); assert((await hash()) === '#/settle', '沒進結算'); await click('[data-act="wall-post"]'); await p.waitForTimeout(400); assert((await hash()) === '#/guild', '沒進公會'); await click('[data-act="race"]'); await p.waitForTimeout(200); assert((await vis('[data-act="race"]').textContent()).includes('已報名'), '沒報名'); });
await step('伏擊與收服', async () => { await setClock('mon'); await p.goto(`${U}#/ambush`); await p.waitForTimeout(300); const a = await p.evaluate(() => [...document.querySelectorAll('[data-aopt]')].length); assert(a === 4, '伏擊沒有四個選項'); for (let k = 0; k < 4; k++) { await click(`[data-aopt="${k}"]`); await hold('.rec .mic', 3300); await click('[data-act="ambush-submit"]'); await p.waitForTimeout(1200); if ((await hash()).startsWith('#/capture')) return `第 ${k} 個選項收服`; await p.goto(`${U}#/ambush`); await p.evaluate(() => { const key = 'tandelo.world.v1'; const st = JSON.parse(localStorage.getItem(key)); st.ambush = { done: false, passed: false }; localStorage.setItem(key, JSON.stringify(st)); }); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(300); } throw new Error('四個選項都沒收服'); });
await step('收服畫面 → 圖鑑 → 傳說卡 → Esc 關閉', async () => { await p.waitForTimeout(2200); await click('[data-go="shadows"]'); await p.waitForTimeout(300); assert((await hash()) === '#/shadows', '沒到圖鑑'); await click('[data-lore="sq-expand"]'); await p.waitForTimeout(300); assert(await p.locator('.sheet').count() === 1, '傳說卡沒開'); await p.keyboard.press('Escape'); await p.waitForTimeout(500); assert(await p.locator('.sheet').count() === 0, 'Esc 沒關傳說卡'); });
await step('叫醒夥伴', async () => { await p.goto(`${U}#/wake`); await p.waitForTimeout(300); await solve('data-wopt'); assert(!(await p.locator('[data-act="wake-done"]').first().isDisabled()), '叫醒鈕沒開'); await click('[data-act="wake-done"]'); await p.waitForTimeout(400); assert((await hash()).startsWith('#/capture'), '叫醒沒進收服'); });
await step('我學會的 → 傳到營地', async () => { await p.goto(`${U}#/week`); await p.waitForTimeout(400); assert(await p.locator('.week-hero .shelf .mon').count() >= 2, '獎盃架沒有夥伴'); await click('[data-act="week-send"]'); await p.waitForTimeout(400); assert((await hash()) === '#/camp', '沒到營地'); assert((await p.locator('.bub').allTextContents()).join('').includes('這週學會的'), '家長沒收到週回顧'); });
await step('地圖四大陸、燈塔', async () => { await p.goto(`${U}#/map`); await p.waitForTimeout(400); assert(await p.locator('.map .hot[data-region]').count() === 6, '六座塔不齊'); await click('.leagues.conts button[data-go="map/en"]'); await p.waitForTimeout(400); assert(await p.locator('.map .hot[data-spot]').count() === 3, '西風港沒有三個迷霧點'); await click('.map .hot[data-spot]'); await p.waitForTimeout(200); assert((await p.locator('#toast').textContent()).includes('達標'), '迷霧點沒提示'); await p.goto(`${U}#/tower/mult`); await p.waitForTimeout(400); assert(await p.locator('.tower-hero .beamg').count() === 1, '燈塔沒有光束'); });
await step('嚮導視角：三個介入時刻', async () => { await p.goto(`${U}#/guide`); await p.waitForTimeout(300); await click('[data-gpick="g2"]'); await p.waitForTimeout(150); await click('[data-gline="g2"]'); await p.waitForTimeout(300); assert(await p.locator('.gcard.done').count() === 1, '介入沒記下'); assert(await p.locator('.card .kv').count() === 1, '紀錄沒一筆'); });
await step('我：冒險者卡、職業章、正在追的怪', async () => { await p.goto(`${U}#/`); await p.waitForTimeout(300); await click('#tabs [data-go="me"]'); await p.waitForTimeout(400); assert((await hash()) === '#/me', '沒進「我」'); assert(await p.locator('.acard .hero-av svg').count() === 1, '冒險者卡沒有角色'); assert((await p.locator('.rank-name').textContent()).length > 0, '沒有階級'); assert(await p.locator('.role-badges .rb').count() === 4, '職業章不是四枚'); assert(await p.locator('#tabs [data-go="me"].on').count() === 1, '分頁沒亮'); });
await step('第一次進入：通行證、暱稱、捏角色、PIN、出發', async () => { await p.goto(`${U}#/profile`); await p.waitForTimeout(300); await click('[data-act="join-start"]'); await p.waitForTimeout(300); assert(await p.locator('svg.qr path').count() === 1, '通行證沒有 QR'); await click('[data-act="join-next"]'); await p.waitForTimeout(200); assert(await p.locator('[data-act="join-next"]').first().isDisabled(), '沒暱稱也能下一步'); await p.locator('[data-nick-in]').fill('阿翔'); await click('[data-act="join-next"]'); await p.waitForTimeout(200); await click('[data-look="hair:3"]'); await click('[data-look="acc:1"]'); await click('[data-act="join-next"]'); await p.waitForTimeout(200); for (const k of ['1', '3', '5', '7']) await click(`[data-pin="${k}"]`); await click('[data-act="join-next"]'); await p.waitForTimeout(200); await click('[data-act="join-next"]'); await p.waitForTimeout(500); assert((await hash()) === '#/home', '出發後沒回首頁'); const prof = await p.evaluate(() => JSON.parse(localStorage.getItem('tandelo.world.v1')).profile); assert(prof.nick === '阿翔' && prof.look.hair === 3 && prof.pin === '1357', '檔案沒存好'); });
await step('巡邏的「為什麼」可以打字', async () => { await p.evaluate(() => { const k = 'tandelo.world.v1'; const st = JSON.parse(localStorage.getItem(k)); st.patrol = { i: 1, done: 1, helped: 0, why: false, finished: false }; localStorage.setItem(k, JSON.stringify(st)); }); await p.goto(`${U}#/play`); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(300); await solve('data-opt'); await click('[data-act="why-type"]'); await p.waitForTimeout(200); assert(await p.locator('[data-act="next"]').first().isDisabled(), '沒寫就能下一題'); await p.locator('[data-why-in]').fill('減號要分給括號裡每一項'); await p.waitForTimeout(100); assert(!(await p.locator('[data-act="next"]').first().isDisabled()), '打字後下一題沒開'); });
await step('設定：音效、主題、重設', async () => { await p.goto(`${U}#/settings`); await p.waitForTimeout(300); await click('[data-act="sound"]'); await click('[data-act="theme"]'); const th = await p.evaluate(() => document.documentElement.getAttribute('data-theme')); assert(th === 'dark' || th === 'light', '主題沒切'); p.once('dialog', (d) => d.accept()); await click('[data-act="reset"]'); await p.waitForTimeout(500); const cards = await p.evaluate(() => JSON.parse(localStorage.getItem('tandelo.world.v1') || '{}').cards); assert(!cards, '重設後任務卡沒歸零'); });

await b.close();
let failed = 0;
for (const [n, ok, r] of results) { console.log(`${ok ? '✓' : '✗'} ${n}${r ? `：${r}` : ''}`); if (!ok) failed += 1; }
if (errs.length) { console.log('瀏覽器錯誤：'); errs.forEach((e) => console.log('  ' + e)); }
if (failed || errs.length) { console.log(`e2e 失敗：${failed} 步、${errs.length} 個瀏覽器錯誤`); process.exit(1); }
console.log(`e2e 通過：${results.length} 步`);
