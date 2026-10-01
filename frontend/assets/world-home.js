/* Tandelo 首頁 2.0：主視覺的怪（眼睛跟著游標、點一下收服）、圖鑑翻卡、學會的四態、價格切換、營地來信的見證。
   純原生 JS，不送出任何資料。只動 transform／opacity；尊重 prefers-reduced-motion；沒有 JS 時內容完整可見。 */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EN = (document.documentElement.lang || '').indexOf('en') === 0;
  var buzz = function (p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* 沒有也沒關係 */ } };

  /* ---------- 主視覺：怪 ---------- */
  var stage = document.querySelector('[data-stage]');
  if (stage) {
    var hmon = stage.querySelector('.w-hmon');
    var pupils = stage.querySelectorAll('.pupil');
    var body = stage.querySelector('#hbody');
    var bubble = stage.querySelector('.w-bubble');
    var confetti = stage.querySelector('.w-confetti');
    var nextBtn = document.querySelector('[data-next-mon]');
    var MONS = EN ? [
      { name: 'Minus Ghost', sym: 'm-cloud', taunt: 'The first one is mine. The rest, not my problem.', weak: 'The minus sign goes to everyone in the bracket.' },
      { name: 'Term Thief', sym: 'm-round', taunt: 'Two squares. That is all there is.', weak: 'A perfect square has a middle term.' },
      { name: 'Root Splitter', sym: 'm-bug', taunt: 'Splitting is faster, trust me.', weak: 'Finish inside the root first.' },
      { name: 'Hypotenuse Fog', sym: 'm-tri', taunt: 'Top right is the hypotenuse, no need to look.', weak: 'The hypotenuse always faces the right angle.' },
      { name: 'Square-Difference Twins', sym: 'm-drop', taunt: 'We are twins, of course we match.', weak: 'One plus, one minus.' }
    ] : [
      { name: '負號幽靈', sym: 'm-cloud', taunt: '第一個歸我，後面的我不管。', weak: '負號要發給括號裡每一個人。' },
      { name: '漏項獸', sym: 'm-round', taunt: '兩個平方，就這樣，沒別的了。', weak: '完全平方要有中間那一項。' },
      { name: '拆根蟲', sym: 'm-bug', taunt: '分開算比較快，相信我。', weak: '根號裡面要先算完。' },
      { name: '斜邊迷霧', sym: 'm-tri', taunt: '右上那條就是斜邊，看都不用看。', weak: '斜邊永遠對著直角。' },
      { name: '平方差雙子', sym: 'm-drop', taunt: '我們是雙胞胎，當然一樣。', weak: '平方差：一個加、一個減。' }
    ];
    var cur = 0, phase = 0, timer = null;
    function setMon(i) {
      cur = i % MONS.length; var m = MONS[cur];
      var sym = document.getElementById(m.sym);
      if (sym && body) {
        body.innerHTML = sym.innerHTML;
        pupils = body.querySelectorAll('circle[fill="var(--m-pupil)"]');
        for (var k = 0; k < pupils.length; k++) pupils[k].classList.add('pupil');
      }
      bubble.innerHTML = EN ? '<b>' + m.name + '</b>: "' + m.taunt + '"' : '<b>' + m.name + '</b>：「' + m.taunt + '」';
      stage.classList.remove('p1', 'p2'); phase = 0;
      stage.setAttribute('aria-label', EN ? m.name + '. Tap to see through it.' : m.name + '，點一下識破牠');
    }
    function look(x, y) {
      if (reduce || phase) return;
      var r = hmon.getBoundingClientRect();
      var dx = (x - (r.left + r.width / 2)) / r.width, dy = (y - (r.top + r.height / 2)) / r.height;
      var mx = Math.max(-1, Math.min(1, dx)) * 2.6, my = Math.max(-1, Math.min(1, dy)) * 2.2;
      for (var i = 0; i < pupils.length; i++) pupils[i].style.transform = 'translate(' + mx + 'px,' + my + 'px)';
    }
    function burst() {
      if (!confetti || reduce) return;
      var colors = ['var(--honey)', 'var(--coral)', 'var(--pine)', '#fff'];
      for (var i = 0; i < 26; i++) {
        var s = document.createElement('i'); var a = Math.random() * Math.PI * 2; var d = 60 + Math.random() * 140;
        s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', (Math.sin(a) * d - 40) + 'px');
        s.style.background = colors[i % 4]; s.style.animationDelay = (Math.random() * 0.2) + 's'; confetti.appendChild(s);
      }
      setTimeout(function () { confetti.innerHTML = ''; }, 1600);
    }
    function capture() {
      if (phase) return; phase = 1; var m = MONS[cur];
      for (var i = 0; i < pupils.length; i++) pupils[i].style.transform = '';
      stage.classList.add('p1'); buzz([10, 30, 10]);
      bubble.innerHTML = EN ? '<b>' + m.name + '</b>: "…you saw through me."' : '<b>' + m.name + '</b>：「……' + (cur === 0 ? '連第三項都被你看到了' : '你識破我了') + '」';
      clearTimeout(timer);
      timer = setTimeout(function () {
        stage.classList.remove('p1'); stage.classList.add('p2'); phase = 2;
        bubble.innerHTML = EN ? '<b>Caught</b> · ' + m.weak + ' It stands behind you now.' : '<b>收服</b> · ' + m.weak + ' 站到你身後了。';
        burst(); buzz([20, 40, 20]);
        if (nextBtn) nextBtn.hidden = false;
      }, reduce ? 50 : 1600);
    }
    stage.addEventListener('pointermove', function (e) {
      look(e.clientX, e.clientY);
      if (reduce) return;
      var r = stage.getBoundingClientRect();
      stage.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      stage.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    stage.addEventListener('pointerleave', function () { stage.style.setProperty('--px', 0); stage.style.setProperty('--py', 0); });
    stage.addEventListener('pointerleave', function () { for (var i = 0; i < pupils.length; i++) pupils[i].style.transform = ''; });
    stage.addEventListener('click', function () { if (phase === 2) { setMon(cur + 1); if (nextBtn) nextBtn.hidden = true; } else capture(); });
    stage.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stage.click(); } });
    if (nextBtn) nextBtn.addEventListener('click', function (e) { e.stopPropagation(); setMon(cur + 1); nextBtn.hidden = true; });
    setMon(0);
  }

  /* ---------- 一題示範：卡住 → 提示 → 自己解 ---------- */
  var tryBox = document.querySelector('[data-try]');
  if (tryBox) {
    var ANSWER = 0, TRAP = 1, tries = 0;
    var msg = tryBox.querySelector('[data-try-msg]'), coach = tryBox.querySelector('[data-try-coach]'), coachText = tryBox.querySelector('[data-try-coach-text]'), note = tryBox.querySelector('[data-try-note]');
    var LADDER = EN ? [['Coach · ask', 'Which step did you get to? When you opened the bracket, how many terms got the minus sign?'], ['Coach · lend', 'Try this: 5 − (2 − 1) is 4, not 2. Both terms inside flip.'], ['Coach · show one step', '− (x − 5) opens to −x + 5. Now you combine.']] : [['小陪 · 問', '你寫到哪一步？拆括號的時候，負號發給了幾個人？'], ['小陪 · 借', '試試看：5 − (2 − 1) 是 4，不是 2。括號裡兩個都要變號。'], ['小陪 · 示範一步', '− (x − 5) 拆開是 −x + 5。接下來你合併看看。']];
    tryBox.querySelectorAll('[data-try-opt]').forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-try-opt'));
        tryBox.querySelectorAll('[data-try-opt]').forEach(function (x) { x.classList.remove('trap', 'ok'); });
        if (i === ANSWER) {
          b.classList.add('ok'); buzz(10);
          tryBox.querySelectorAll('[data-try-opt]').forEach(function (x) { x.disabled = true; });
          msg.classList.add('learned'); msg.innerHTML = EN ? '<span class="mon sm shadow"><svg aria-hidden="true"><use href="#m-cloud"/></svg></span><p><b>Solved it yourself.</b> The minus sign goes to everyone in the bracket. ' + (tries ? 'Hints count. In a few days a no-hint one comes back to check.' : 'In a few days a no-hint one comes back; solving that is what counts.') + '</p>' : '<span class="mon sm shadow"><svg aria-hidden="true"><use href="#m-cloud"/></svg></span><p><b>自己解出來了。</b>負號要發給括號裡每一個人。' + (tries ? '問過提示也算，隔幾天會再出一題不給提示的來檢查。' : '隔幾天會再出一題不給提示的來檢查，能自己解才算學會。') + '</p>';
          coach.hidden = true; note.textContent = EN ? 'This goes into the codex. The weekly report says "passed" or "still working on it".' : '這一步之後會記進圖鑑；家長週報會寫「已通過檢核」或「仍需補強」。';
          return;
        }
        b.classList.add('trap'); buzz([10, 30, 10]);
        msg.classList.remove('learned');
        msg.innerHTML = EN ? '<span class="mon sm"><svg aria-hidden="true"><use href="#m-cloud"/></svg></span><p><b>Minus Ghost</b>: ' + (i === TRAP ? '"See? Only the first term flipped. Told you the rest is not my problem."' : '"Close. Look at the bracket again."') + '</p>' : '<span class="mon sm"><svg aria-hidden="true"><use href="#m-cloud"/></svg></span><p><b>負號幽靈</b>：' + (i === TRAP ? '「你看，只有第一項變號。我就說後面的我不管。」' : '「差一點點，再看一次括號。」') + '</p>';
        var l = LADDER[Math.min(tries, LADDER.length - 1)]; tries += 1;
        coach.hidden = false; coachText.innerHTML = '<b>' + l[0] + '</b>' + l[1];
        note.textContent = EN ? 'No red marks, nothing deducted. The hint starts from your step and never writes the whole answer.' : '沒有紅字，沒有扣分。提示從你寫到的那一步開始，不代寫整題。';
      });
    });
  }

  /* ---------- 圖鑑翻卡（手機點一下） ---------- */
  document.querySelectorAll('.w-card3d').forEach(function (c) {
    var b = c.querySelector('button');
    if (!b) return;
    b.addEventListener('click', function () { var on = c.classList.toggle('is-flipped'); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  });

  /* ---------- 學會的四態：自動輪播，可手動 ---------- */
  var states = document.querySelectorAll('.w-state');
  if (states.length) {
    var si = 0, st = null;
    function show(i) { si = (i + states.length) % states.length; states.forEach(function (s, k) { s.classList.toggle('on', k === si); }); }
    function auto() { if (reduce) return; clearInterval(st); st = setInterval(function () { show(si + 1); }, 2600); }
    document.querySelectorAll('[data-state-prev]').forEach(function (b) { b.addEventListener('click', function () { show(si - 1); auto(); }); });
    document.querySelectorAll('[data-state-next]').forEach(function (b) { b.addEventListener('click', function () { show(si + 1); auto(); }); });
    states.forEach(function (s, k) { s.addEventListener('click', function () { show(k); auto(); }); });
    show(0); auto();
  }

  /* ---------- 價格：月繳／年卡 ---------- */
  var tog = document.querySelectorAll('[data-bill]');
  if (tog.length) {
    tog.forEach(function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-bill');
        tog.forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        document.querySelectorAll('[data-month][data-year]').forEach(function (el) {
          el.innerHTML = el.getAttribute(mode === 'year' ? 'data-year' : 'data-month');
        });
      });
    });
  }

  /* ---------- 營地來信：我見證了 ---------- */
  document.querySelectorAll('[data-witness]').forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.classList.toggle('on'); b.textContent = EN ? (on ? 'Seen' : 'I saw this') : (on ? '已見證' : '我見證了'); buzz(12);
      var echo = document.querySelector('[data-witness-echo]'); if (echo) echo.hidden = !on;
    });
  });
})();
