// 學生：每日練習與小陪 —— 拍題問小陪、說給我聽、過幾天再測

import { esc, icon, m, mt, coach, duo, backBar } from '../ui.js';
import { SKILLS, SKILL_ORDER } from '../content.js';
import { TIERS, newSession, answer, hint, helpCount, tierForStep, evaluateExplanation, focusSkill, todayPlan } from '../coach.js';
import { fmtMD, fmtMDW, daysBetween, retestDays, retestDue, isRetestReady, dailyDone, DAILY_CAP } from '../state.js';
import { recorderHtml } from '../recorder.js';
import { glyph } from '../starmap.js';
import { reduced } from '../fx.js';

const ui = {
  ask: { phase: 'pick', skill: null, session: null, logged: false },
  ex: { skill: null, phase: 'talk', text: '', result: null, transferPick: null, attempts: 0, typing: null },
  re: { skill: null, pick: null },
};

function isMath(s) { return !/[一-鿿]/.test(s); }
function fx(s) { return isMath(s) ? m(s) : mt(s); }

function lightsOut() {
  return `<div class="pad center-col lo">
    ${duo('sleep', 'xl')}
    <h1 class="hero s center" tabindex="-1">22:30 關燈了。</h1>
    <p class="sub center">練習入口先收起來。剩下的我明天排。<br>睡飽，比多寫一回有用。</p>
    <p class="fine">示範：到「設定」把時間調回 20:40 就能繼續。</p>
    <button class="btn ghost" data-go="settings">${icon('gear')}到設定</button>
  </div>`;
}

function capReached(ctx) {
  return `<div class="pad center-col lo">
    ${duo('idle', 'xl')}
    <h1 class="hero s center" tabindex="-1">今天的量到了。</h1>
    <p class="sub center">今天已經做了 ${DAILY_CAP} 件。剩下的我明天排，多做不一定比較好。</p>
    <p class="fine">示範：到「設定」往後 1 天，就會有新的練習。</p>
    <div class="btnrow"><button class="btn ghost" data-go="s/home">回今天</button><button class="btn ghost" data-go="settings">到設定</button></div>
  </div>`;
}

function log(ctx, entry) {
  ctx.update((s) => { s.student.log.push({ date: s.clock.date, ...entry }); }, { silent: true });
}

// ————————————————————————— 練習首頁
const hub = {
  tab: 's/practice',
  guard: (ctx) => (ctx.state.student.diag.done ? null : 's/start'),
  meta: { title: '練習', tips: ['拍題問小陪：三段式「示範一步 → 提示 → 自己做」，用了幾次幫忙都會記下來。', '說給我聽：用文字或示範語音講 30 秒，規則比對關鍵概念給回饋。'] },
  render(ctx) {
    if (ctx.night) return lightsOut();
    const st = ctx.state.student;
    const plan = todayPlan(ctx.state);
    const greens = SKILL_ORDER.filter((k) => st.skills[k] && st.skills[k].status === 'green');
    const f = focusSkill(st);
    return `<div class="pad pbt">
      <div class="abar"><span class="abar-t">練習</span><span class="num fine">今天 ${plan.count} / ${plan.cap}</span></div>
      <h1 class="hero s" tabindex="-1">今天練一點就好。</h1>
      ${coach(f ? `今天從「${SKILLS[f].title}」開始。不會的地方，我一步一步問你。` : '現在沒有卡住的點。想練的話，拍一題給我看。', { night: ctx.night })}
      <button class="bigact" data-go="s/ask${f ? `/${f}` : ''}"><span class="ic">${icon('cam')}</span><span><b>拍一題問小陪</b><small>我不給答案，一步一步問你</small></span>${icon('chev', 'chev')}</button>
      <button class="bigact mic" data-go="s/explain${f ? `/${f}` : ''}"><span class="ic">${icon('mic')}</span><span><b>說給我聽</b><small>用自己的話講 30 秒</small></span>${icon('chev', 'chev')}</button>
      <h2 class="h3">過幾天再測</h2>
      ${greens.length ? greens.map((k) => {
    const s = st.skills[k]; const ready = isRetestReady(s, ctx.today);
    return `<button class="row" data-go="s/retest/${k}"><span class="ic ${ready ? 'gold' : ''}">${icon('star')}</span><span><b>${esc(SKILLS[k].title)}</b><small>${ready ? '今天可以再測 · 不給提示' : `${fmtMDW(s.retestDue)} 再測（還有 ${daysBetween(ctx.today, s.retestDue)} 天）`}</small></span>${icon('chev', 'chev')}</button>`;
  }).join('') : '<p class="fine left">說給我聽、換一題也做對之後，我會排 7–12 天後再測。</p>'}
    </div>`;
  },
};

// ————————————————————————— 拍一題問小陪
const ask = {
  tab: 's/practice',
  guard: (ctx) => (ctx.state.student.diag.done ? null : 's/start'),
  meta: { title: '拍題問小陪', tips: ['示範：用範例題代替拍照。', '「完全沒頭緒」會先用別的題目示範一步；之後每一步放手一點，最後自己做。', '小陪永遠不直接給答案。'] },
  enter(ctx) {
    const k = ctx.params[0];
    if (ui.ask.skill !== k || ui.ask.phase === 'done') ui.ask = { phase: k ? 'photo' : 'pick', skill: k || null, session: null, logged: false };
  },
  mount(ctx) {
    if (ui.ask.phase !== 'scan') return null;
    const t = setTimeout(() => { ui.ask.phase = 'mode'; ctx.rerender({ focusTitle: true }); }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 1400);
    return () => clearTimeout(t);
  },
  render(ctx) {
    if (ctx.night) return lightsOut();
    const st = ctx.state.student;
    const a = ui.ask;
    if (!a.session && dailyDone(st.log, ctx.today) >= DAILY_CAP) return capReached(ctx);
    if (a.phase === 'pick') {
      const pool = [...new Set([...(st.diag.stuck || []), ...SKILL_ORDER])].slice(0, 4);
      return `<div class="pad pb">${backBar('拍一題問小陪', 's/practice')}
        <h1 class="hero s" tabindex="-1">哪一題不會？</h1>
        <p class="sub">示範：選一張範例題代替拍照。</p>
        <div class="shots">${pool.map((k) => `<button class="shot" data-act="pickShot" data-k="${k}"><span class="paper">${fx(SKILLS[k].coach.photo)}</span><small>${esc(SKILLS[k].short)}</small></button>`).join('')}</div>
      </div>`;
    }
    const sk = SKILLS[a.skill];
    if (a.phase === 'photo' || a.phase === 'scan') {
      const scanning = a.phase === 'scan';
      return `<div class="pad pb">${backBar('拍一題問小陪', 's/practice')}
        <h1 class="hero s" tabindex="-1">${scanning ? '我在看這一題⋯' : '拍給我看。'}</h1>
        <div class="camera ${scanning ? 'scanning' : ''}"><span class="paper big">${fx(sk.coach.photo)}</span><i class="beam" aria-hidden="true"></i></div>
        <p class="fine">考卷、講義、課本都可以。這個示範用範例題代替拍照，不會開啟相機。</p>
        ${scanning ? '' : `<div class="dock"><button class="btn block" data-act="shoot">${icon('cam')}用這張範例題</button><button class="btn ghost block" data-act="rePick">換一題</button></div>`}
      </div>`;
    }
    if (a.phase === 'mode') {
      return `<div class="pad pb">${backBar('拍一題問小陪', 's/practice')}
        <div class="shotmini"><span class="paper">${fx(sk.coach.photo)}</span><div><b>我看到這一題了</b><small>跟「${esc(sk.title)}」有關。</small></div></div>
        <h1 class="hero s" tabindex="-1">你現在的狀況？</h1>
        <div class="modes">
          <button class="mode" data-act="startMode" data-t="0"><b>完全沒頭緒</b><small>我先用別的題目示範一步，再換你</small></button>
          <button class="mode" data-act="startMode" data-t="1"><b>有一點想法</b><small>卡住時我給提示，一次一級</small></button>
          <button class="mode" data-act="startMode" data-t="2"><b>我想自己做</b><small>我只問問題，不主動幫忙</small></button>
        </div>
        <p class="fine">不管選哪個，我都不會直接給答案。每一步都會放手一點。</p>
      </div>`;
    }
    // chat
    const s = a.session;
    const steps = sk.coach.steps;
    const cur = s.done ? null : steps[s.step];
    const tier = s.done ? 2 : tierForStep(s);
    return `<div class="pad chatpad">
      ${backBar('拍一題問小陪', 's/practice', `<span class="abar-r num" aria-live="polite">幫忙 ${helpCount(s)} 次</span>`)}
      <div class="tiers" aria-label="現在這一步的幫忙方式">${TIERS.map((t, i) => `<span class="${i === tier ? 'on' : ''} ${i < tier ? 'past' : ''}">${t}</span>`).join('<i></i>')}</div>
      <div class="shotmini sm"><span class="paper">${fx(sk.coach.photo)}</span><div><b>${mt(sk.coach.prompt)}</b><small>第 ${Math.min(s.step + 1, steps.length)} / ${steps.length} 步</small></div></div>
      <h1 class="sr" tabindex="-1">和小陪一起解題</h1>
      <div class="bubbles" aria-live="polite">
        ${s.msgs.map((msg, mi) => (msg.who === 'me'
    ? `<div class="bub me ${mi >= s.msgs.length - 2 ? 'pop' : ''}">${fx(msg.text)}</div>`
    : `<div class="bub coach ${msg.kind || ''}">${msg.kind === 'hint' ? '<span class="bub-tag">提示</span>' : msg.kind === 'demo' ? '<span class="bub-tag">示範一步</span>' : ''}<span ${mi === s.msgs.length - 1 ? `data-type="ask-${mi}"` : ''}>${mt(msg.text)}</span></div>`)).join('')}
        <span class="chat-duo" aria-hidden="true">${duo(s.done ? 'joy' : 'idle', 's')}</span>
      </div>
      ${s.done ? `<div class="card honey">
          <b>你自己解完了</b>
          <p class="body">這一題用了 ${s.hints} 次提示、${s.demos} 次示範，我都記下來了。接下來，用你自己的話講一次為什麼。</p>
          <button class="btn block" data-go="s/explain/${a.skill}">說給我聽${icon('arrow')}</button>
        </div>` : `<div class="composer">
          <div class="chips">${cur.chips.map((c, i) => `<button class="chipbtn math-chip" data-act="say" data-v="${esc(c)}" id="chip-${i}">${fx(c)}</button>`).join('')}</div>
          <form class="qrow" data-act="sayForm"><label class="sr" for="askIn">你的答案</label><input class="input" id="askIn" placeholder="或自己打：例如 x² + 2x" autocomplete="off"><button class="btn s" type="submit" aria-label="送出">${icon('arrow')}</button></form>
          ${tier === 0 ? '<p class="fine left">這一步我先示範了別的題目。換你做原本那題。</p>' : `<button class="btn ghost s" data-act="hint">${icon('help')}給我提示${s.hintLevel >= cur.hints.length ? '（示範一步）' : s.hintLevel ? '（再多一點）' : '（輕推）'}</button>`}
        </div>`}
    </div>`;
  },
  on: {
    pickShot(ctx, el) { ui.ask = { phase: 'photo', skill: el.dataset.k, session: null, logged: false }; ctx.rerender({ focusTitle: true }); },
    rePick(ctx) { ui.ask.phase = 'pick'; ctx.go('s/ask'); },
    shoot(ctx) { ui.ask.phase = 'scan'; ctx.remount(); },
    startMode(ctx, el) { ui.ask.session = newSession(ui.ask.skill, Number(el.dataset.t)); ui.ask.phase = 'chat'; ctx.rerender({ focusSel: '#askIn' }); },
    say(ctx, el) { submit(ctx, el.dataset.v); },
    sayForm(ctx) { const i = document.getElementById('askIn'); if (i && i.value.trim()) submit(ctx, i.value.trim()); },
    hint(ctx) { ui.ask.session = hint(ui.ask.session); ctx.rerender({ keepScrollBottom: true }); },
  },
};

function submit(ctx, text) {
  const a = ui.ask;
  a.session = answer(a.session, text);
  if (a.session.done && !a.logged) {
    a.logged = true;
    const n = helpCount(a.session);
    log(ctx, { kind: 'ask', skill: a.skill, hints: n, ok: true });
    ctx.update((s) => {
      const k = s.student.skills[a.skill] || (s.student.skills[a.skill] = { status: 'unknown', hints: 0 });
      k.hints = (k.hints || 0) + n;
      if (k.status === 'stuck' || k.status === 'unknown' || k.status === 'ok') k.status = 'learning';
    }, { silent: true });
  }
  ctx.rerender({ keepScrollBottom: true, focusSel: a.session.done ? null : '#askIn' });
}

// ————————————————————————— 說給我聽
const explain = {
  tab: 's/practice',
  guard: (ctx) => (ctx.state.student.diag.done ? null : 's/start'),
  meta: { title: '說給我聽', tips: ['可以自己打字，或按「示範語音」讓它自動講一段。', '規則會比對關鍵概念（例如「每一項都要乘到」「中間多出 2ab」），講到 2 個以上才算講得出來。', '接著「換一題也做得出來」，通過後排 7–12 天後再測。'] },
  enter(ctx) {
    const k = ctx.params[0] || focusSkill(ctx.state.student) || SKILL_ORDER.find((x) => ctx.state.student.skills[x] && ctx.state.student.skills[x].status === 'green') || ctx.state.student.diag.stuck[0];
    if (ui.ex.skill !== k || ui.ex.phase === 'done') ui.ex = { skill: k, phase: 'talk', text: '', result: null, transferPick: null, attempts: 0, typing: null };
  },
  mount() {
    return () => { if (ui.ex.typing) { clearInterval(ui.ex.typing); ui.ex.typing = null; } };
  },
  render(ctx) {
    if (ctx.night) return lightsOut();
    const st = ctx.state.student;
    const e = ui.ex;
    if (e.phase === 'talk' && !e.result && dailyDone(st.log, ctx.today) >= DAILY_CAP) return capReached(ctx);
    const sk = SKILLS[e.skill];
    const res = e.result;
    const checks = `<div class="checks">
      <div class="ck ${res && res.pass ? 'on' : ''}"><i>${icon('check')}</i><div>講得出為什麼<small>不是背規則</small></div></div>
      <div class="ck ${e.phase === 'done' && e.transferOk ? 'on' : ''}"><i>${icon('check')}</i><div>換一題也做得出來<small>不給提示</small></div></div>
      <div class="ck ${e.phase === 'done' && e.transferOk ? 'on' : ''}"><i>${icon('cal')}</i><div>過幾天還會<small>${e.phase === 'done' && e.transferOk ? `${fmtMDW(e.due)}再問你一次（隔 ${e.days} 天）` : '通過後排 7–12 天後再測'}</small></div></div>
    </div>`;
    if (e.phase === 'transfer') {
      const t = sk.transfer;
      return `<div class="pad pb">${backBar('換一題也做得出來', 's/practice')}
        ${coach('講得很清楚。換一題新的，這次我不給提示。', { night: ctx.night })}
        <h1 class="qtitle" tabindex="-1">${fx(t.q)}</h1>
        <div class="opts">${t.opts.map((o, i) => `<button class="opt" data-act="transfer" data-i="${i}">${fx(o)}</button>`).join('')}</div>
        ${checks}
      </div>`;
    }
    if (e.phase === 'done') {
      return `<div class="pad pb">${backBar('說給我聽', 's/practice')}
        <div class="center-col tight">${duo(e.transferOk ? 'joy' : 'idle', 'l')}</div>
        <h1 class="hero s center" tabindex="-1">${e.transferOk ? '講得出來，<br>也做得出來。' : '差一點。'}</h1>
        ${checks}
        ${coach(e.transferOk ? `${fmtMD(e.due)} 我再問你一次，那次不給提示。過幾天還會，才是真的會。` : '這一題我記下來了。明天再試一次，不急。', { night: ctx.night })}
        <div class="dock">
          ${e.transferOk ? `<button class="btn block" data-go="s/retest/${e.skill}">看再測（示範可快轉時間）</button>` : ''}
          <button class="btn ghost block" data-go="s/home">回今天</button>
        </div>
      </div>`;
    }
    return `<div class="pad pb">${backBar('說給我聽', 's/practice')}
      ${coach(sk.explain.prompt, { night: ctx.night, mode: 'talk' })}
      <h1 class="sr" tabindex="-1">說給我聽：${esc(sk.title)}</h1>
      ${recorderHtml({ id: 'exRec', target: 'exText', sample: sk.explain.sample, secs: 30, micIcon: icon('mic'), hint: '按住說話，放開就停' })}
      <label class="sr" for="exText">用你自己的話講</label>
      <textarea class="input ta" id="exText" rows="3" maxlength="240" placeholder="用你自己的話講，30 秒就好。打字也可以。" data-input="exType">${esc(e.text)}</textarea>
      <div class="btnrow">
        <button class="btn s" data-act="evaluate">送出，講完了</button>
      </div>
      <p class="fine left">示範：不會開麥克風，也不留你的原話；按住時用示範句代替，只留下面三個勾。</p>
      ${res ? `<div class="card ${res.pass ? 'mint' : ''}" id="exRes">
          <b>${res.pass ? '我聽懂了' : '再補一句'}</b>
          <ul class="concepts ${e.fresh ? 'seq' : ''}">${SKILLS[e.skill].explain.concepts.map((c, ci) => `<li class="${res.hits.includes(c.label) ? 'hit' : ''}" style="--i:${ci}">${res.hits.includes(c.label) ? `<span class="cdot on">${icon('check')}</span>` : '<span class="cdot"></span>'}${esc(c.label)}</li>`).join('')}</ul>
          <p class="body">${mt(res.feedback)}</p>
          ${res.pass ? '<button class="btn block" data-act="toTransfer">換一題試試</button>' : ''}
        </div>` : ''}
      ${checks}
    </div>`;
  },
  on: {
    exType(ctx, el) { ui.ex.text = el.value; },
    evaluate(ctx) {
      const ta = document.getElementById('exText');
      if (ta) ui.ex.text = ta.value;
      ui.ex.result = evaluateExplanation(ui.ex.skill, ui.ex.text);
      ui.ex.attempts += 1;
      // 送出後，關鍵概念一個一個亮起（只在剛送出的這一次）
      ui.ex.fresh = true;
      ctx.rerender({ focusSel: '#exRes b' });
      ui.ex.fresh = false;
      ctx.buzz(ui.ex.result.pass ? [10, 40, 16] : 10);
    },
    toTransfer(ctx) { ui.ex.phase = 'transfer'; ctx.rerender({ focusTitle: true }); },
    transfer(ctx, el) {
      const e = ui.ex; const sk = SKILLS[e.skill];
      const ok = Number(el.dataset.i) === sk.transfer.ok;
      e.transferOk = ok; e.phase = 'done';
      const hints = (ctx.state.student.skills[e.skill] || {}).hints || 0;
      e.days = retestDays(hints); e.due = retestDue(ctx.today, hints);
      log(ctx, { kind: 'explain', skill: e.skill, hints: 0, ok });
      ctx.update((s) => {
        const k = s.student.skills[e.skill] || (s.student.skills[e.skill] = { status: 'learning', hints: 0 });
        if (ok && k.status !== 'gold') { k.status = 'green'; k.explainedAt = s.clock.date; k.retestDue = e.due; k.explainText = null; } else if (k.status !== 'gold') k.status = 'learning';
      }, { silent: true });
      if (ok) ctx.burst();
      ctx.rerender({ focusTitle: true });
    },
  },
};

// ————————————————————————— 過幾天再測
const retest = {
  tab: 's/practice',
  guard: (ctx) => (ctx.state.student.diag.done ? null : 's/start'),
  meta: { title: '過幾天再測', tips: ['學會的定義：過 7–12 天、不給提示再測通過。', '示範模式有「快轉時間」，按了就把示範日期跳到再測日。', '通過會「翻過去」變金色；沒通過就回到練習清單，不扣分。'] },
  enter(ctx) { const k = ctx.params[0]; if (ui.re.skill !== k) ui.re = { skill: k, pick: null }; else ui.re.pick = null; },
  render(ctx) {
    if (ctx.night) return lightsOut();
    const st = ctx.state.student;
    const k = ui.re.skill || SKILL_ORDER.find((x) => st.skills[x] && st.skills[x].status === 'green');
    if (!k || !SKILLS[k]) return `<div class="pad">${backBar('過幾天再測', 's/practice')}<h1 class="hero s" tabindex="-1">還沒有要再測的點。</h1><p class="sub">說給我聽、換一題也做對之後，我會排 7–12 天後再測。</p></div>`;
    const sk = SKILLS[k];
    const s = st.skills[k] || { status: 'unknown' };
    const r = ui.re;
    if (r.pick !== null) {
      const ok = r.pick === sk.retest.ok;
      return `<div class="pad pb">${backBar('過幾天再測', 's/practice')}
        <div class="flipstage">${ok
    ? `<span class="bignode flip" data-s="gold"><span class="flipper"><span class="face front">${glyph('green')}</span><span class="face back">${glyph('gold')}</span></span></span>`
    : `<span class="bignode" data-s="stuck">${icon('refresh')}</span>`}</div>
        <h1 class="hero s center" tabindex="-1">${ok ? `翻過去了：<br>${esc(sk.title)}` : '沒關係。'}</h1>
        ${coach(ok ? `隔了 ${s.gap || 7} 天、不給提示，你還會。這一點變成金色；之後如果又錯，它會回到練習清單。` : '我知道要再陪你走一次了。它回到練習清單，下次我們換個方式。', { night: ctx.night, mode: ok ? 'joy' : 'talk' })}
        <div class="dock"><button class="btn block" data-go="s/map">看卡點地圖</button><button class="btn ghost block" data-go="s/home">回今天</button></div>
      </div>`;
    }
    if (s.status === 'gold') return `<div class="pad">${backBar('過幾天再測', 's/practice')}<h1 class="hero s" tabindex="-1">「${esc(sk.title)}」已經掌握了。</h1><p class="sub">${fmtMD(s.masteredAt)} 翻過去的。</p></div>`;
    if (s.status !== 'green') {
      return `<div class="pad">${backBar('過幾天再測', 's/practice')}<h1 class="hero s" tabindex="-1">還沒到再測。</h1>
        <p class="sub">「${esc(sk.title)}」要先說給我聽、換一題也做對，我才會排再測。</p>
        <button class="btn block" data-go="s/explain/${k}">先說給我聽</button></div>`;
    }
    if (!isRetestReady(s, ctx.today)) {
      const left = daysBetween(ctx.today, s.retestDue);
      return `<div class="pad pb">${backBar('過幾天再測', 's/practice')}
        <span class="pill g">說得出來 · 等再測</span>
        <h1 class="hero s" tabindex="-1">${fmtMDW(s.retestDue)}<br>再問你一次。</h1>
        <p class="sub">還有 <b class="num">${left}</b> 天。隔幾天、不給提示還會，才算真的學會。</p>
        <div class="card mint"><b>為什麼要等？</b><p class="body">剛學會的時候一定會。過了一週多還記得，才代表它留下來了。</p></div>
        <div class="dock">
          <button class="btn block" data-act="fastForward" data-date="${s.retestDue}">${icon('forward')}快轉時間到 ${fmtMD(s.retestDue)}（示範）</button>
          <p class="fine">只改這台裝置上的示範日期，隨時可以在設定調回來。</p>
        </div>
      </div>`;
    }
    const gap = daysBetween(s.explainedAt, ctx.today);
    return `<div class="pad pb">
      <div class="abar"><span class="abar-t">第 ${gap} 天 · 還記得嗎</span><span class="pill h">這次沒有提示</span></div>
      ${coach(`距離你上次講出來，已經 ${gap} 天了。這次不給提示，錯了也沒關係。`, { night: ctx.night })}
      <h1 class="qtitle" tabindex="-1">${fx(sk.retest.q)}</h1>
      <div class="opts">${sk.retest.opts.map((o, i) => `<button class="opt" data-act="retestPick" data-i="${i}">${fx(o)}</button>`).join('')}</div>
    </div>`;
  },
  on: {
    fastForward(ctx, el) {
      const d = el.dataset.date;
      ctx.update((s) => { s.clock.date = d; s.clock.time = '20:00'; });
      ctx.toast(`示範時間快轉到 ${fmtMD(d)} 20:00`);
    },
    retestPick(ctx, el) {
      const k = ui.re.skill || SKILL_ORDER.find((x) => ctx.state.student.skills[x] && ctx.state.student.skills[x].status === 'green');
      ui.re.skill = k;
      const sk = SKILLS[k];
      const i = Number(el.dataset.i);
      ui.re.pick = i;
      const ok = i === sk.retest.ok;
      log(ctx, { kind: 'retest', skill: k, hints: 0, ok });
      ctx.update((s) => {
        const x = s.student.skills[k];
        x.gap = daysBetween(x.explainedAt, s.clock.date);
        if (ok) { x.status = 'gold'; x.masteredAt = s.clock.date; s.student.flip = k; } else { x.status = 'stuck'; x.retestDue = null; x.fails = (x.fails || 0) + 1; x.hints = 0; }
      }, { silent: true });
      ctx.rerender({ focusTitle: true });
      if (ok) setTimeout(() => { ctx.burst(document.querySelector('.bignode')); ctx.buzz([12, 50, 18]); }, reduced() ? 0 : 880);
    },
  },
};

export const screens = { 's/practice': hub, 's/ask': ask, 's/explain': explain, 's/retest': retest };
