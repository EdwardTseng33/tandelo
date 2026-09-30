/* Tandelo 首頁互動：怎麼運作的進度線、小隊課六段、卡點「翻過去」、比較分頁。 */
(function () {
  'use strict';

  var T = window.Tandelo || { reduceMotion: function () { return false; }, confetti: function () {} };

  /* ---------- 怎麼運作：左側進度線跟著捲動長、經過的步驟點亮 ---------- */
  var steps = document.querySelector('[data-steps]');
  if (steps) {
    var stepEls = Array.prototype.slice.call(steps.querySelectorAll('[data-step]'));
    var ticking = false;
    var update = function () {
      ticking = false;
      var rect = steps.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      var anchor = vh * 0.55;
      var p = (anchor - rect.top) / Math.max(rect.height, 1);
      p = Math.max(0, Math.min(1, p));
      steps.style.setProperty('--p', p.toFixed(4));
      stepEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        var on = r.top < anchor;
        el.classList.toggle('is-on', on);
        if (r.top < vh * 0.85) el.classList.add('is-seen');
      });
    };
    var onScroll = function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------- 小隊課六段（分頁：點選或方向鍵切換） ---------- */
  function makeTabs(tabs, onSelect) {
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(i, false); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = tabs.length - 1;
        if (next !== null) { e.preventDefault(); select(next, true); }
      });
    });
    function select(i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      if (focus) tabs[i].focus();
      onSelect(tabs[i], i);
    }
  }

  var klass = document.querySelector('[data-class]');
  if (klass) {
    var segs = Array.prototype.slice.call(klass.querySelectorAll('.seg'));
    var panel = klass.querySelector('.class-panel');
    var nameEl = klass.querySelector('[data-seg-name]');
    var minEl = klass.querySelector('[data-seg-min]');
    var descEl = klass.querySelector('[data-seg-desc]');
    makeTabs(segs, function (seg) {
      nameEl.textContent = seg.getAttribute('data-name');
      minEl.textContent = seg.getAttribute('data-min');
      descEl.textContent = seg.getAttribute('data-desc');
      panel.classList.remove('is-swap');
      void panel.offsetWidth;
      panel.classList.add('is-swap');
    });
  }

  /* ---------- 比較分頁 ---------- */
  var cmp = document.querySelector('[data-tabs]');
  if (cmp) {
    var cmpTabs = Array.prototype.slice.call(cmp.querySelectorAll('[role="tab"]'));
    makeTabs(cmpTabs, function (tab) {
      cmpTabs.forEach(function (t) {
        var p = document.getElementById(t.getAttribute('aria-controls'));
        if (!p) return;
        var on = t === tab;
        p.hidden = !on;
        if (on) { p.classList.remove('is-swap'); void p.offsetWidth; p.classList.add('is-swap'); }
      });
    });
  }

  /* ---------- 卡點「翻過去」：珊瑚 → 綠 → 金，每次 0.7 秒 ---------- */
  var flip = document.querySelector('[data-flip]');
  if (flip) {
    var card = flip.querySelector('.flip-card');
    var label = flip.querySelector('[data-flip-label]');
    var when = flip.querySelector('[data-flip-when]');
    var track = Array.prototype.slice.call(flip.querySelectorAll('.ft'));
    var confettiHost = flip.querySelector('[data-confetti]');
    var playBtn = flip.querySelector('[data-flip-play]');
    var states = [
      { key: 'stuck', label: '卡住', when: '第 0 天・在小隊課上卡住' },
      { key: 'said', label: '說得出來', when: '當天・用自己的話講了 30 秒' },
      { key: 'gold', label: '已掌握', when: '第 9 天・不給提示再測，還會' }
    ];
    var timers = [];
    var clearTimers = function () { timers.forEach(clearTimeout); timers = []; };

    var apply = function (i) {
      var s = states[i];
      card.setAttribute('data-state', s.key);
      label.textContent = s.label;
      when.textContent = s.when;
      track.forEach(function (t, j) { t.classList.toggle('is-on', j === i); });
    };

    var flipTo = function (i) {
      if (T.reduceMotion()) { apply(i); return; }
      card.classList.remove('is-flipping');
      void card.offsetWidth;
      card.classList.add('is-flipping');
      timers.push(setTimeout(function () { apply(i); }, 350));
      timers.push(setTimeout(function () { card.classList.remove('is-flipping'); }, 720));
    };

    var play = function () {
      clearTimers();
      apply(0);
      timers.push(setTimeout(function () { flipTo(1); }, 900));
      timers.push(setTimeout(function () { flipTo(2); }, 2300));
      timers.push(setTimeout(function () { T.confetti(confettiHost); }, 2700));
    };

    playBtn.addEventListener('click', play);

    if ('IntersectionObserver' in window && !T.reduceMotion()) {
      var played = false;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !played) {
            played = true;
            play();
            io.disconnect();
          }
        });
      }, { threshold: 0.6 });
      io.observe(card);
    }
  }
})();
