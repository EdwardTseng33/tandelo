/* Tandelo 網站共用腳本：導覽選單、深淺色、插圖深淺版、捲動進場、導覽列收合、
   卡片傾斜、游標小圓、頁面切換，以及給各頁用的小工具（圓點散開、數字滾動）。
   純原生 JS，不送出任何資料、不使用追蹤碼。
   動態原則：只動 transform／opacity；尊重 prefers-reduced-motion；靜止時內容完整可見。 */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* ---------- 深淺色 ---------- */
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return systemDark.matches;
  }

  /* 插圖跟著深淺色換檔：<img data-ill="名稱"> → 名稱.svg／名稱-dark.svg */
  function syncIllustrations(dark) {
    document.querySelectorAll('img[data-ill]').forEach(function (img) {
      var want = 'assets/illustrations/' + img.getAttribute('data-ill') + (dark ? '-dark' : '') + '.svg';
      if (img.getAttribute('src') !== want) img.setAttribute('src', want);
    });
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
    syncIllustrations(dark);
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

  /* ---------- 導覽列：捲動後加底線；往下捲收合、往上捲回來 ---------- */
  var nav = document.querySelector('.site-nav');
  if (nav) {
    var lastY = window.scrollY;
    var navTick = false;
    var updateNav = function () {
      navTick = false;
      var y = window.scrollY;
      nav.classList.toggle('is-scrolled', y > 8);
      var menuOpen = links && links.classList.contains('is-open');
      var focusInside = nav.contains(document.activeElement);
      if (y > 220 && y > lastY + 6 && !menuOpen && !focusInside) nav.classList.add('is-tucked');
      else if (y < lastY - 6 || y <= 220) nav.classList.remove('is-tucked');
      lastY = y;
    };
    window.addEventListener('scroll', function () {
      if (!navTick) { navTick = true; window.requestAnimationFrame(updateNav); }
    }, { passive: true });
    nav.addEventListener('focusin', function () { nav.classList.remove('is-tucked'); });
    updateNav();
  }

  /* ---------- 捲動進場 ----------
     內容預設完整可見；只有「載入時還在畫面外」的元素，進入畫面那一刻播一次上浮。
     不先把元素藏起來等觀察者。播完就拿掉 class，讓卡片的傾斜 transform 接手。 */
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
      pending.forEach(function (el) {
        io.observe(el);
        el.addEventListener('animationend', function (e) {
          if (e.target === el && e.animationName === 'rise') el.classList.remove('is-in');
        });
      });
    }
  }

  /* ---------- 卡片懸停：傾斜 2.5 度以內，圓點跟著游標（僅滑鼠） ---------- */
  if (finePointer.matches && !reduceMotion.matches) {
    Array.prototype.slice.call(document.querySelectorAll('.tilt')).forEach(function (el) {
      var spot = document.createElement('span');
      spot.className = 'tilt-spot';
      spot.setAttribute('aria-hidden', 'true');
      spot.appendChild(document.createElement('i'));
      el.insertBefore(spot, el.firstChild);
      var rect = null;
      var place = function (e) {
        var x = (e.clientX - rect.left) / rect.width;
        var y = (e.clientY - rect.top) / rect.height;
        el.style.setProperty('--ry', ((x - .5) * 5).toFixed(2) + 'deg');
        el.style.setProperty('--rx', ((.5 - y) * 5).toFixed(2) + 'deg');
        el.style.setProperty('--mx', (x * rect.width).toFixed(0) + 'px');
        el.style.setProperty('--my', (y * rect.height).toFixed(0) + 'px');
      };
      el.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse') return;
        rect = el.getBoundingClientRect();
        place(e);
        el.classList.add('is-tilting');
      });
      el.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        if (!rect) { rect = el.getBoundingClientRect(); el.classList.add('is-tilting'); }
        place(e);
      });
      el.addEventListener('pointerleave', function () {
        rect = null;
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---------- 游標附近的兩圓小跟隨（僅桌機；頁尾可關，記在本機） ---------- */
  (function () {
    var toggle = document.querySelector('[data-cursor-toggle]');
    if (!finePointer.matches || reduceMotion.matches) return;
    var enabled = true;
    try { enabled = localStorage.getItem('tandelo.cursor') !== 'off'; } catch (e) { /* 預設開 */ }
    var duo = document.createElement('span');
    duo.className = 'cursor-duo';
    duo.setAttribute('aria-hidden', 'true');
    duo.appendChild(document.createElement('i'));
    duo.appendChild(document.createElement('i'));
    document.body.appendChild(duo);

    var tx = 0, ty = 0, x = 0, y = 0, running = false, seen = false;
    var frame = function () {
      x += (tx - x) * .18;
      y += (ty - y) * .18;
      duo.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      if (Math.abs(tx - x) > .3 || Math.abs(ty - y) > .3) window.requestAnimationFrame(frame);
      else running = false;
    };
    var syncToggle = function () {
      if (!toggle) return;
      toggle.hidden = false;
      toggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      toggle.textContent = enabled ? '游標小圓：開' : '游標小圓：關';
    };
    document.addEventListener('pointermove', function (e) {
      if (!enabled || e.pointerType !== 'mouse') return;
      tx = e.clientX + 14;
      ty = e.clientY + 16;
      if (!seen) { seen = true; x = tx; y = ty; }
      duo.classList.add('is-on');
      var near = e.target && e.target.closest ? e.target.closest('a, button, summary, [role="button"], [role="tab"], input, select, textarea, label, [data-orb]') : null;
      duo.classList.toggle('is-near', !!near);
      if (!running) { running = true; window.requestAnimationFrame(frame); }
    }, { passive: true });
    document.addEventListener('pointerleave', function () { duo.classList.remove('is-on'); });
    root.addEventListener('mouseleave', function () { duo.classList.remove('is-on'); });
    if (toggle) {
      toggle.addEventListener('click', function () {
        enabled = !enabled;
        try { localStorage.setItem('tandelo.cursor', enabled ? 'on' : 'off'); } catch (e) { /* 忽略 */ }
        if (!enabled) duo.classList.remove('is-on');
        syncToggle();
      });
    }
    syncToggle();
  })();

  /* ---------- 頁面切換：站內連結先淡出再走 ---------- */
  document.addEventListener('click', function (e) {
    if (reduceMotion.matches || e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target || a.hasAttribute('download')) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    var url;
    try { url = new URL(a.href, window.location.href); } catch (err) { return; }
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;
    e.preventDefault();
    root.classList.add('is-leaving');
    window.setTimeout(function () { window.location.href = a.href; }, 180);
  });
  window.addEventListener('pageshow', function () { root.classList.remove('is-leaving'); });

  /* ---------- 給各頁共用的小工具 ---------- */
  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };

  window.Tandelo = {
    reduceMotion: function () { return reduceMotion.matches; },
    finePointer: function () { return finePointer.matches; },
    fmt: fmt,

    /* 慶祝：只用品牌色小圓點，向外散開後淡出 */
    confetti: function (host, count, spread) {
      if (!host || reduceMotion.matches) return;
      var n = count || 14;
      var base = spread || 70;
      var colors = ['var(--coral)', 'var(--pine)', 'var(--honey)', 'var(--mint)', 'var(--coral-soft)'];
      host.innerHTML = '';
      for (var i = 0; i < n; i++) {
        var dot = document.createElement('i');
        var angle = (Math.PI * 2 * i) / n + Math.random() * .4;
        var dist = base + Math.random() * base;
        dot.style.setProperty('--dx', Math.round(Math.cos(angle) * dist) + 'px');
        dot.style.setProperty('--dy', Math.round(Math.sin(angle) * dist) + 'px');
        dot.style.background = colors[i % colors.length];
        dot.style.animationDelay = (Math.random() * .12).toFixed(2) + 's';
        host.appendChild(dot);
      }
      window.setTimeout(function () { host.innerHTML = ''; }, 1400);
    },

    /* 數字跳動：從目前顯示的值補間到目標值 */
    count: function (el, to, prefix) {
      var pre = prefix || '';
      var from = parseFloat(el.getAttribute('data-shown'));
      if (isNaN(from)) from = parseInt(String(el.textContent).replace(/[^\d.-]/g, ''), 10) || 0;
      window.cancelAnimationFrame(el._raf || 0);
      if (reduceMotion.matches || from === to) {
        el.setAttribute('data-shown', to);
        el.textContent = pre + fmt(to);
        return;
      }
      var start = null;
      var step = function (ts) {
        if (start === null) start = ts;
        var k = Math.min(1, (ts - start) / 450);
        var v = from + (to - from) * (1 - Math.pow(1 - k, 3));
        el.setAttribute('data-shown', v);
        el.textContent = pre + fmt(v);
        if (k < 1) el._raf = window.requestAnimationFrame(step);
        else { el.setAttribute('data-shown', to); el.textContent = pre + fmt(to); }
      };
      el._raf = window.requestAnimationFrame(step);
    },

    /* 數字滾動（里程表）：每一位數是一欄 0–9，換值時整欄上下滾。
       螢幕閱讀器讀的是隱藏的完整文字。 */
    roll: function (el, value) {
      var text = fmt(value);
      if (reduceMotion.matches) { el.textContent = text; return; }
      var sr = el.querySelector('.sr-only');
      var box = el.querySelector('.roll');
      if (!box || box.getAttribute('data-len') !== String(text.length)) {
        var prev = sr ? sr.textContent : String(el.textContent).trim();
        el.textContent = '';
        sr = document.createElement('span');
        sr.className = 'sr-only';
        el.appendChild(sr);
        box = document.createElement('span');
        box.className = 'roll';
        box.setAttribute('aria-hidden', 'true');
        box.setAttribute('data-len', text.length);
        for (var i = 0; i < text.length; i++) {
          var ch = text.charAt(i);
          if (ch < '0' || ch > '9') { box.appendChild(document.createTextNode(ch)); continue; }
          var d = document.createElement('span');
          d.className = 'roll-d';
          var ghost = document.createElement('s');
          ghost.textContent = '0';
          var col = document.createElement('span');
          col.className = 'roll-col';
          col.style.setProperty('--k', text.length - i);
          for (var j = 0; j < 10; j++) {
            var cell = document.createElement('span');
            cell.textContent = j;
            col.appendChild(cell);
          }
          var old = prev.length === text.length ? prev.charAt(i) : '0';
          col.style.setProperty('--v', old >= '0' && old <= '9' ? old : '0');
          d.appendChild(ghost);
          d.appendChild(col);
          box.appendChild(d);
        }
        el.appendChild(box);
        void box.offsetWidth;
      }
      sr.textContent = text;
      var cols = box.querySelectorAll('.roll-col');
      var k = 0;
      for (var m = 0; m < text.length; m++) {
        var c = text.charAt(m);
        if (c >= '0' && c <= '9') { cols[k].style.setProperty('--v', c); k++; }
      }
    }
  };
})();
