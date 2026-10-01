/* Tandelo 首頁互動：
   主視覺兩個圓（視差、按住發亮、隊友拖進來）、怎麼運作的捲動敘事、小隊課六段、
   比較分頁、卡點「翻過去」（可拖曳）、價格方案切換。 */
(function () {
  'use strict';

  var T = window.Tandelo || {
    reduceMotion: function () { return false; },
    finePointer: function () { return false; },
    confetti: function () {},
    roll: function (el, v) { el.textContent = Math.round(v).toLocaleString('en-US'); },
    count: function (el, v) { el.textContent = Math.round(v).toLocaleString('en-US'); }
  };
  var slice = function (list) { return Array.prototype.slice.call(list); };

  /* ---------- 主視覺：兩個圓 ----------
     指標靠近舞台中心，兩圓靠攏；離開就鬆開。按住（或按鈕／Enter）時重疊處發亮。
     周圍的隊友小圓可以拖，拖進兩圓之間就被吸進去，播一次圓點散開。 */
  var stage = document.querySelector('[data-hero]');
  if (stage) {
    (function () {
      var hero = stage.closest('.hero') || stage;
      var duo = stage.querySelector('.hero-duo');
      var a = duo.querySelector('.hd-a');
      var b = duo.querySelector('.hd-b');
      var lens = duo.querySelector('.hd-lens');
      var lensFill = lens.firstElementChild;
      var cards = slice(stage.querySelectorAll('.float-card'));
      var orbs = slice(stage.querySelectorAll('[data-orb]'));
      var confettiHost = stage.querySelector('[data-confetti]');
      var status = document.querySelector('[data-hero-status]');
      var nudge = document.querySelector('[data-hero-nudge]');
      var reduce = T.reduceMotion();

      var d = a.offsetWidth || 240;
      var cur = { g: reduce ? 0 : -.2, x: 0, y: 0 };
      var tgt = { g: 0, x: 0, y: 0 };
      var pressed = false, boost = 0, hovering = false, visible = true, raf = 0, t0 = 0;
      var joined = 0, busy = false;

      stage.classList.add('is-live');

      var render = function () {
        var g = cur.g * d;
        var ta = 'translate3d(' + (cur.x + g).toFixed(2) + 'px,' + cur.y.toFixed(2) + 'px,0)';
        a.style.transform = ta;
        lens.style.transform = ta;
        b.style.transform = 'translate3d(' + (cur.x - g).toFixed(2) + 'px,' + cur.y.toFixed(2) + 'px,0)';
        lensFill.style.transform = 'translate3d(' + (.6 * d - 2 * g).toFixed(2) + 'px,0,0)';
        for (var i = 0; i < cards.length; i++) {
          var k = -.5 - i * .35;
          cards[i].style.translate = (cur.x * k).toFixed(2) + 'px ' + (cur.y * k).toFixed(2) + 'px';
        }
      };

      var goalG = function (ts) {
        if (pressed || boost > ts) return .15;
        if (hovering) return tgt.g;
        return Math.sin(ts / 1700) * .035;           /* 沒人碰的時候，慢慢一靠一離 */
      };

      var loop = function (ts) {
        raf = 0;
        if (!t0) t0 = ts;
        var gg = goalG(ts);
        cur.g += (gg - cur.g) * .09;
        cur.x += (tgt.x - cur.x) * .09;
        cur.y += (tgt.y - cur.y) * .09;
        render();
        if (boost && boost <= ts) { boost = 0; if (!pressed) stage.classList.remove('is-pressed'); }
        if (visible) raf = window.requestAnimationFrame(loop);
      };
      var start = function () { if (!raf && !reduce) raf = window.requestAnimationFrame(loop); };

      var setStatic = function () {            /* 減少動態：不跟隨，只切換靠攏與否 */
        cur.g = pressed ? .15 : 0; cur.x = 0; cur.y = 0;
        render();
      };

      var onMove = function (e) {
        if (reduce) return;
        var r = stage.getBoundingClientRect();
        var nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        var ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        var dist = Math.min(1.4, Math.sqrt(nx * nx + ny * ny));
        hovering = true;
        tgt.g = .13 - dist * .16;                    /* 中心 +0.13（靠攏）→ 邊緣 −0.09（分開） */
        tgt.x = Math.max(-1, Math.min(1, nx)) * 12;
        tgt.y = Math.max(-1, Math.min(1, ny)) * 9;
      };
      var onLeave = function () { hovering = false; tgt.x = 0; tgt.y = 0; };
      hero.addEventListener('pointermove', onMove, { passive: true });
      hero.addEventListener('pointerleave', onLeave);
      hero.addEventListener('pointercancel', onLeave);

      var press = function (on) {
        pressed = on;
        stage.classList.toggle('is-pressed', on || !!boost);
        if (reduce) setStatic();
      };
      stage.addEventListener('pointerdown', function (e) {
        if (e.target.closest('[data-orb]')) return;
        press(true);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (evt) {
        stage.addEventListener(evt, function () { if (pressed) press(false); });
      });

      var say = function (text) { if (status) status.textContent = text; };

      /* 靠攏一下（給按鈕、Enter、吸進隊友時用） */
      var pulse = function (ms) {
        if (reduce) {
          stage.classList.add('is-pressed'); cur.g = .15; render();
          window.setTimeout(function () { if (!pressed) { stage.classList.remove('is-pressed'); setStatic(); } }, ms);
          return;
        }
        boost = window.performance.now() + ms;
        stage.classList.add('is-pressed');
        start();
      };

      var finale = function () {
        say('成班了。六位隊友、同一位老師，一起走 8 週。');
        duo.classList.remove('is-hop');
        void duo.offsetWidth;
        duo.classList.add('is-hop');
        T.confetti(confettiHost, 18, 110);
        pulse(1200);
        window.setTimeout(function () {
          joined = 0;
          duo.style.setProperty('--grow', '1');
          orbs.forEach(function (orb) {
            orb.classList.add('is-back');
            orb.style.transform = '';
            orb.classList.remove('is-in');
            window.setTimeout(function () { orb.classList.remove('is-back'); }, 700);
          });
          busy = false;
          say('再來一次：把隊友拖進兩個圓中間，或點一下。');
        }, 2800);
      };

      var absorb = function (orb, dx, dy) {
        if (orb.classList.contains('is-in')) return;
        var or = orb.getBoundingClientRect();
        var sr = stage.getBoundingClientRect();
        var cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2;
        var fx = dx + cx - (or.left + or.width / 2);
        var fy = dy + cy - (or.top + or.height / 2);
        orb.classList.remove('is-drag');
        orb.style.transform = 'translate3d(' + fx.toFixed(1) + 'px,' + fy.toFixed(1) + 'px,0) scale(.2)';
        orb.classList.add('is-in');
        joined += 1;
        var n = joined;
        duo.style.setProperty('--grow', (1 + n * .014).toFixed(3));
        pulse(700);
        window.setTimeout(function () {
          T.confetti(confettiHost, 10, 60);
          if (n >= orbs.length) { busy = true; finale(); }
          else say('第 ' + n + ' 位隊友進來了，還差 ' + (orbs.length - n) + ' 位。');
        }, reduce ? 0 : 420);
      };

      orbs.forEach(function (orb) {
        var st = null;
        orb.addEventListener('pointerdown', function (e) {
          if (busy || orb.classList.contains('is-in')) return;
          e.preventDefault();
          e.stopPropagation();
          try { orb.setPointerCapture(e.pointerId); } catch (err) { /* 舊瀏覽器沒有也能拖 */ }
          st = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false };
          orb.classList.add('is-drag');
        });
        orb.addEventListener('pointermove', function (e) {
          if (!st) return;
          st.dx = e.clientX - st.x;
          st.dy = e.clientY - st.y;
          if (Math.abs(st.dx) + Math.abs(st.dy) > 5) st.moved = true;
          orb.style.transform = 'translate3d(' + st.dx + 'px,' + st.dy + 'px,0) scale(1.12)';
        });
        var end = function (e) {
          if (!st) return;
          var s = st;
          st = null;
          orb.classList.remove('is-drag');
          if (e.type === 'pointercancel') { orb.style.transform = ''; return; }
          if (!s.moved) { absorb(orb, 0, 0); return; }          /* 點一下也算 */
          var or = orb.getBoundingClientRect();
          var dr = duo.getBoundingClientRect();
          var ox = or.left + or.width / 2 - (dr.left + dr.width / 2);
          var oy = or.top + or.height / 2 - (dr.top + dr.height / 2);
          if (Math.abs(ox) < d * .46 && Math.abs(oy) < d * .5) absorb(orb, s.dx, s.dy);
          else orb.style.transform = '';                          /* 沒進去就彈回原位 */
        };
        orb.addEventListener('pointerup', end);
        orb.addEventListener('pointercancel', end);
      });

      if (nudge) {
        nudge.addEventListener('click', function () {
          if (busy) return;
          var next = orbs.filter(function (o) { return !o.classList.contains('is-in'); })[0];
          if (next) absorb(next, 0, 0);
          else pulse(900);
        });
      }

      window.addEventListener('resize', function () { d = a.offsetWidth || d; if (reduce) setStatic(); else render(); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          visible = entries[0].isIntersecting;
          if (visible) start();
        }, { threshold: 0 }).observe(stage);
      }
      if (reduce) setStatic(); else { render(); start(); }
    })();
  }

  /* ---------- 怎麼運作：捲動敘事 ----------
     進度線跟著捲動長；經過的步驟點亮；桌機左側的 sticky 視覺區換上那一步的插圖。 */
  var steps = document.querySelector('[data-steps]');
  if (steps) {
    var stepEls = slice(steps.querySelectorAll('[data-step]'));
    var howStage = document.querySelector('[data-how-stage]');
    var howImgs = howStage ? slice(howStage.querySelectorAll('.how-ill')) : [];
    var howDots = howStage ? slice(howStage.querySelectorAll('.how-dots i')) : [];
    var howN = howStage ? howStage.querySelector('[data-how-n]') : null;
    var howTitle = howStage ? howStage.querySelector('[data-how-title]') : null;
    var current = -1;
    var ticking = false;
    var vh0 = window.innerHeight || 800;
    /* 載入時還在畫面外的步驟，進場時才播一次上浮 */
    stepEls.forEach(function (el) { if (el.getBoundingClientRect().top > vh0) el.setAttribute('data-late', ''); });

    var show = function (i) {
      if (i === current) return;
      current = i;
      stepEls.forEach(function (el, j) { el.classList.toggle('is-cur', j === i); });
      howImgs.forEach(function (img, j) {
        img.classList.toggle('is-on', j === i);
        img.classList.toggle('is-past', j < i);
      });
      howDots.forEach(function (dot, j) {
        dot.classList.toggle('is-on', j === i);
        dot.classList.toggle('is-done', j < i);
      });
      if (howN) howN.textContent = String(i + 1);
      if (howTitle) howTitle.textContent = stepEls[i].getAttribute('data-step-title') || '';
    };

    var update = function () {
      ticking = false;
      var rect = steps.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      var anchor = vh * 0.55;
      var p = (anchor - rect.top) / Math.max(rect.height, 1);
      p = Math.max(0, Math.min(1, p));
      steps.style.setProperty('--p', p.toFixed(4));
      var idx = 0;
      stepEls.forEach(function (el, j) {
        var r = el.getBoundingClientRect();
        var on = r.top < anchor;
        el.classList.toggle('is-on', on);
        if (on) idx = j;
        if (r.top < vh * 0.85 && !el.classList.contains('is-seen')) {
          el.classList.add('is-seen');
          if (el.hasAttribute('data-late') && !T.reduceMotion()) el.classList.add('is-enter');
        }
      });
      show(idx);
    };
    var onScroll = function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------- 分頁（點選或方向鍵切換） ---------- */
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
    var segs = slice(klass.querySelectorAll('.seg'));
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

  var cmp = document.querySelector('[data-tabs]');
  if (cmp) {
    var cmpTabs = slice(cmp.querySelectorAll('[role="tab"]'));
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

  /* ---------- 卡點「翻過去」：珊瑚 → 綠 → 金 ----------
     可以點一下、按 Enter／空白鍵，或用手指／滑鼠左右拖著翻。翻到金色時播一次圓點散開。 */
  var flip = document.querySelector('[data-flip]');
  if (flip) {
    (function () {
      var card = flip.querySelector('.flip-card');
      var label = flip.querySelector('[data-flip-label]');
      var when = flip.querySelector('[data-flip-when]');
      var live = flip.querySelector('[data-flip-status]');
      var track = slice(flip.querySelectorAll('.ft'));
      var confettiHost = flip.querySelector('[data-confetti]');
      var playBtn = flip.querySelector('[data-flip-play]');
      var states = [
        { key: 'stuck', label: '卡住', when: '第 0 天・在小隊課上卡住' },
        { key: 'said', label: '說得出來', when: '當天・用自己的話講了 30 秒' },
        { key: 'gold', label: '已掌握', when: '第 9 天・不給提示再測，還會' }
      ];
      var index = 0;
      var touched = false;
      var timers = [];
      var later = function (fn, ms) { timers.push(window.setTimeout(fn, ms)); };
      var clearTimers = function () { timers.forEach(window.clearTimeout); timers = []; };

      var apply = function (i, announce) {
        index = i;
        var s = states[i];
        card.setAttribute('data-state', s.key);
        label.textContent = s.label;
        when.textContent = s.when;
        track.forEach(function (t, j) { t.classList.toggle('is-on', j === i); });
        flip.classList.toggle('is-gold', i === 2);
        if (announce && live) live.textContent = '現在是：' + s.label + '。' + s.when;
      };

      var celebrate = function () { T.confetti(confettiHost, 16, 80); };

      /* 自動翻一次（0.7 秒，翻到 90 度時換色） */
      var flipTo = function (i, announce) {
        if (T.reduceMotion()) { apply(i, announce); return; }
        card.style.transform = '';
        card.classList.remove('is-flipping', 'is-settle');
        void card.offsetWidth;
        card.classList.add('is-flipping');
        later(function () { apply(i, announce); }, 350);
        later(function () { card.classList.remove('is-flipping'); if (i === 2) celebrate(); }, 720);
      };

      var nudgeReplay = function () {
        playBtn.classList.remove('is-nudge');
        void playBtn.offsetWidth;
        playBtn.classList.add('is-nudge');
        if (live) live.textContent = '已經是金色了。按「再翻一次」可以從頭看。';
      };

      var next = function () {
        clearTimers();
        if (index >= 2) { nudgeReplay(); return; }
        flipTo(index + 1, true);
      };

      var play = function () {
        clearTimers();
        card.classList.remove('is-flipping', 'is-settle');
        card.style.transform = '';
        apply(0, false);
        later(function () { flipTo(1, false); }, 900);
        later(function () { flipTo(2, true); }, 2300);
      };

      playBtn.addEventListener('click', function () { touched = true; play(); });

      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); touched = true; next(); }
      });

      /* 拖曳翻面：水平拖，角度跟著手；過了 90 度就換成下一個狀態 */
      var drag = null;
      card.addEventListener('pointerdown', function (e) {
        if (e.button) return;
        touched = true;
        clearTimers();
        card.classList.remove('is-flipping', 'is-settle');
        drag = { x: e.clientX, w: card.offsetWidth || 320, a: 0, dir: 1, moved: false, swapped: false, from: index };
        try { card.setPointerCapture(e.pointerId); } catch (err) { /* 沒有也能拖 */ }
      });
      card.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = e.clientX - drag.x;
        if (Math.abs(dx) > 6) drag.moved = true;
        if (!drag.moved || T.reduceMotion()) return;
        card.classList.add('is-drag');
        drag.dir = dx < 0 ? -1 : 1;
        var a = Math.min(180, Math.abs(dx) / (drag.w * .8) * 180);
        if (drag.from >= 2) a = Math.min(24, a * .25);          /* 已經是金色：只輕輕晃一下 */
        drag.a = a;
        var want = a > 90;
        if (want !== drag.swapped) {
          drag.swapped = want;
          apply(want ? drag.from + 1 : drag.from, false);
        }
        var shown = a > 90 ? a - 180 : a;
        card.style.transform = 'rotateY(' + (drag.dir * shown).toFixed(1) + 'deg)';
      });
      var endDrag = function (e) {
        if (!drag) return;
        var g = drag;
        drag = null;
        card.classList.remove('is-drag');
        if (!g.moved || T.reduceMotion()) {
          card.style.transform = '';
          if (e.type === 'pointerup') next();
          return;
        }
        if (g.from >= 2) {
          card.classList.add('is-settle');
          card.style.transform = 'rotateY(0deg)';
          nudgeReplay();
          return;
        }
        var commit = e.type === 'pointerup' && g.a > 55;
        if (commit && !g.swapped) {
          /* 還沒過 90 度就放手：先轉到側面、換色，再轉回正面 */
          card.classList.add('is-settle');
          card.style.transform = 'rotateY(' + (g.dir * 90) + 'deg)';
          later(function () {
            apply(g.from + 1, true);
            card.classList.remove('is-settle');
            card.style.transform = 'rotateY(' + (g.dir * -90) + 'deg)';
            void card.offsetWidth;
            card.classList.add('is-settle');
            card.style.transform = 'rotateY(0deg)';
            if (g.from + 1 === 2) later(celebrate, 320);
          }, 330);
          return;
        }
        if (!commit && g.swapped) apply(g.from, false);
        card.classList.add('is-settle');
        if (!commit && g.swapped) card.style.transform = 'rotateY(0deg)';
        else card.style.transform = 'rotateY(0deg)';
        if (commit) {
          apply(g.from + 1, true);
          if (g.from + 1 === 2) later(celebrate, 320);
        }
      };
      card.addEventListener('pointerup', endDrag);
      card.addEventListener('pointercancel', endDrag);

      /* 第一次捲到這裡，自己翻一次給你看（你已經動過手就不搶） */
      if ('IntersectionObserver' in window && !T.reduceMotion()) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            io.disconnect();
            if (!touched) play();
          });
        }, { threshold: 0.6 });
        io.observe(card);
      }
    })();
  }

  /* ---------- 價格：選方案，下方的數字滾過去 ---------- */
  var planSum = document.querySelector('[data-plan-sum]');
  if (planSum) {
    var plans = slice(document.querySelectorAll('[data-plan]'));
    var sumName = planSum.querySelector('[data-sum-name]');
    var sumNote = planSum.querySelector('[data-sum-note]');
    var sumTotal = planSum.querySelector('[data-sum-total]');
    var sumPer = planSum.querySelector('[data-sum-per]');
    var sumPerRow = planSum.querySelector('[data-sum-per-row]');
    var perHtml = sumPerRow.innerHTML;

    var pick = function (plan) {
      plans.forEach(function (p) {
        var on = p === plan;
        p.classList.toggle('is-picked', on);
        var btn = p.querySelector('[data-plan-pick]');
        if (btn) {
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
          btn.textContent = on ? '已選這個' : '選這個看看';
        }
      });
      sumName.textContent = plan.getAttribute('data-name');
      sumNote.textContent = plan.getAttribute('data-note');
      T.roll(sumTotal, parseInt(plan.getAttribute('data-price'), 10));
      var per = plan.getAttribute('data-per');
      if (per) {
        if (!sumPerRow.querySelector('[data-sum-per]')) {
          sumPerRow.innerHTML = perHtml;
          sumPer = sumPerRow.querySelector('[data-sum-per]');
        }
        T.count(sumPer, parseInt(per, 10));
      } else {
        sumPerRow.textContent = '含一對一 2 小時，由同一位老師帶';
      }
      planSum.classList.remove('is-swap');
      void planSum.offsetWidth;
      planSum.classList.add('is-swap');
    };

    plans.forEach(function (plan) {
      plan.addEventListener('click', function () {
        if (!plan.classList.contains('is-picked')) pick(plan);
      });
    });
  }
})();
