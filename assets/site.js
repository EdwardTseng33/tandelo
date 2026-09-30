/* Tandelo 網站共用腳本：導覽選單、深淺色、捲動進場動畫。
   純原生 JS，不送出任何資料、不使用追蹤碼。 */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  /* ---------- 深淺色 ---------- */
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return systemDark.matches;
  }

  function syncThemeLabels() {
    var dark = isDark();
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      var label = btn.querySelector('[data-theme-label]');
      var text;
      if (label && btn.classList.contains('night-preview')) {
        text = dark ? '回到白天的樣子' : '預覽 22:30 之後';
      } else {
        text = dark ? '切換淺色模式' : '切換深色模式';
      }
      if (label) label.textContent = text;
      else btn.setAttribute('aria-label', text);
    });
    var meta = document.querySelectorAll('meta[name="theme-color"]');
    meta.forEach(function (m) { m.setAttribute('content', dark ? '#0C1412' : '#F6F4EE'); m.removeAttribute('media'); });
  }

  function setTheme(next) {
    root.setAttribute('data-theme', next);
    root.removeAttribute('data-night');
    try { localStorage.setItem('tandelo.theme', next); } catch (e) { /* 無法儲存時仍可切換 */ }
    syncThemeLabels();
  }

  document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () { setTheme(isDark() ? 'light' : 'dark'); });
  });
  if (systemDark.addEventListener) systemDark.addEventListener('change', syncThemeLabels);
  syncThemeLabels();

  /* ---------- 手機選單 ---------- */
  var menuBtn = document.querySelector('.nav-menu');
  var links = document.getElementById('nav-links');
  if (menuBtn && links) {
    var closeMenu = function (focusBtn) {
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.setAttribute('aria-label', '開啟選單');
      links.classList.remove('is-open');
      if (focusBtn) menuBtn.focus();
    };
    menuBtn.addEventListener('click', function () {
      var open = menuBtn.getAttribute('aria-expanded') === 'true';
      if (open) { closeMenu(false); return; }
      menuBtn.setAttribute('aria-expanded', 'true');
      menuBtn.setAttribute('aria-label', '關閉選單');
      links.classList.add('is-open');
      var first = links.querySelector('a, button');
      if (first) first.focus();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('is-open')) closeMenu(true);
    });
    document.addEventListener('click', function (e) {
      if (!links.classList.contains('is-open')) return;
      if (!links.contains(e.target) && !menuBtn.contains(e.target)) closeMenu(false);
    });
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu(false);
    });
  }

  /* ---------- 導覽列捲動後加底線 ---------- */
  var nav = document.querySelector('.site-nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 捲動進場 ----------
     內容預設完整可見；只有「載入時還在畫面外」的元素，進入畫面那一刻播一次上浮。
     不先把元素藏起來等觀察者。 */
  if (!reduceMotion.matches && 'IntersectionObserver' in window) {
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    var vh = window.innerHeight || 800;
    var pending = items.filter(function (el) { return el.getBoundingClientRect().top > vh; });
    if (pending.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0 });
      pending.forEach(function (el) { io.observe(el); });
    }
  }

  /* 給各頁共用的小工具 */
  window.Tandelo = {
    reduceMotion: function () { return reduceMotion.matches; },
    confetti: function (host) {
      if (!host || reduceMotion.matches) return;
      var colors = ['var(--coral)', 'var(--pine)', 'var(--honey)', 'var(--mint)', 'var(--coral-soft)'];
      host.innerHTML = '';
      for (var i = 0; i < 14; i++) {
        var dot = document.createElement('i');
        var angle = (Math.PI * 2 * i) / 14 + Math.random() * .4;
        var dist = 70 + Math.random() * 70;
        dot.style.setProperty('--dx', Math.round(Math.cos(angle) * dist) + 'px');
        dot.style.setProperty('--dy', Math.round(Math.sin(angle) * dist) + 'px');
        dot.style.background = colors[i % colors.length];
        dot.style.animationDelay = (Math.random() * .12).toFixed(2) + 's';
        host.appendChild(dot);
      }
      setTimeout(function () { host.innerHTML = ''; }, 1400);
    }
  };
})();
