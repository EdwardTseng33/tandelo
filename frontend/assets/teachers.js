/* Tandelo 老師招募頁：接班卡的成班儀式、收入試算器、一週時間軸、報名表（只存在本機，不寄出）。 */
(function () {
  'use strict';

  var T = window.Tandelo || { reduceMotion: function () { return false; }, confetti: function () {} };
  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };

  /* ---------- 接班卡：成班的儀式（約 2.4 秒） ----------
     隊友小圓依序亮起（1.2）→ 兩個圓合上（0.6）→ 圓點散開、「成班了」浮現（0.6）。
     減少動態時直接顯示結果。再按一次可以還原重看。 */
  var take = document.querySelector('[data-take]');
  if (take) {
    var card = take.closest('[data-takecard]');
    var mates = Array.prototype.slice.call(card.querySelectorAll('.tc-mates .mate'));
    var takeStatus = card.querySelector('[data-take-status]');
    var takeTimers = [];
    var later = function (fn, ms) { takeTimers.push(setTimeout(fn, ms)); };
    var resetTake = function () {
      takeTimers.forEach(clearTimeout);
      takeTimers = [];
      card.classList.remove('is-forming', 'is-closing', 'is-formed');
      mates.forEach(function (m) { m.classList.remove('is-lit'); });
    };
    var finishTake = function () {
      take.setAttribute('aria-pressed', 'true');
      take.disabled = false;
      if (takeStatus) takeStatus.textContent = '成班了，週三見。';
    };
    take.addEventListener('click', function () {
      var on = take.getAttribute('aria-pressed') !== 'true';
      resetTake();
      if (!on) {
        take.setAttribute('aria-pressed', 'false');
        if (takeStatus) takeStatus.textContent = '已還原，可以再按一次。';
        return;
      }
      if (T.reduceMotion()) {
        mates.forEach(function (m) { m.classList.add('is-lit'); });
        finishTake();
        return;
      }
      take.disabled = true;
      card.classList.add('is-forming');
      mates.forEach(function (m, i) { later(function () { m.classList.add('is-lit'); }, 120 + i * 220); });
      later(function () { card.classList.add('is-closing'); }, 1250);
      later(function () {
        card.classList.add('is-formed');
        T.confetti(card.querySelector('[data-confetti]'), 16, 90);
        finishTake();
      }, 1850);
      later(function () { card.classList.remove('is-forming', 'is-closing', 'is-formed'); take.focus(); }, 3300);
    });
  }

  /* ---------- 收入試算器 ----------
     每位學生每堂學費＝8 團 NT$2,990 ÷ 8；每堂收入＝學費合計 × 分潤，和保底 600 取高；一個月以 4.3 週計。
     每月估算用里程表滾動；其他數字跳動補間；長條只動 transform。 */
  var calc = document.querySelector('[data-calc]');
  if (calc) {
    var PER_STUDENT = 2990 / 8;
    var FLOOR = 600;
    var WEEKS = 4.3;
    var teams = calc.querySelector('#teams');
    var size = calc.querySelector('#size');
    var teamsOut = calc.querySelector('#teams-out');
    var sizeOut = calc.querySelector('#size-out');
    var out = function (k) { return calc.querySelector('[data-out="' + k + '"]'); };
    var bars = Array.prototype.slice.call(calc.querySelectorAll('.bar'));
    var monthEl = out('month');
    var roll = T.roll || function (el, v) { el.textContent = fmt(v); };
    var count = T.count || function (el, v, pre) { el.textContent = (pre || '') + fmt(v); };

    var rate = function () {
      var r = calc.querySelector('input[name="level"]:checked');
      return r ? parseFloat(r.value) : 0.52;
    };
    var perSession = function (n, r) { return Math.max(Math.round(n * PER_STUDENT * r), FLOOR); };
    var monthly = function (n, r, t) { return Math.round(perSession(n, r) * t * WEEKS / 10) * 10; };

    var fill = function (input) {
      var min = +input.min, max = +input.max, v = +input.value;
      input.style.setProperty('--fill', ((v - min) / (max - min) * 100).toFixed(1) + '%');
    };

    var render = function () {
      var r = rate();
      var t = parseInt(teams.value, 10);
      var n = parseInt(size.value, 10);
      var tuition = n * PER_STUDENT;
      var share = Math.round(tuition * r);
      var per = perSession(n, r);
      var minutes = t * 50;
      var hours = minutes / 60;

      teamsOut.textContent = t + ' 團';
      sizeOut.textContent = n + ' 人';
      fill(teams);
      fill(size);

      count(out('tuition'), Math.round(tuition), 'NT$');
      count(out('share'), share, 'NT$');
      count(out('per'), per, 'NT$');
      out('floor').hidden = share >= FLOOR;
      out('hours').textContent = '每週 ' + t + ' 堂・約 ' + (hours % 1 === 0 ? hours : hours.toFixed(1)) + ' 小時';
      roll(monthEl, monthly(n, r, t));

      var values = bars.map(function (b) { return monthly(+b.getAttribute('data-n'), r, t); });
      var max = Math.max.apply(null, values);
      bars.forEach(function (b, i) {
        b.classList.toggle('is-on', +b.getAttribute('data-n') === n);
        count(b.querySelector('.bar-v'), values[i]);
        b.querySelector('.bar-fill').style.setProperty('--h', (values[i] / max * 100).toFixed(1) + '%');
      });
    };

    calc.addEventListener('input', render);
    calc.addEventListener('change', render);
    render();
  }

  /* ---------- 老師的一週：可左右滑動的時間軸 ----------
     手指滑、滑鼠拖、方向鍵、左右按鈕都可以；下方進度線跟著走。 */
  var week = document.querySelector('[data-week]');
  if (week) {
    var rail = week.querySelector('.week');
    var prog = week.querySelector('[data-week-prog]');
    var prev = week.querySelector('[data-week-prev]');
    var next = week.querySelector('[data-week-next]');
    var wkTick = false;
    var syncWeek = function () {
      wkTick = false;
      var maxScroll = rail.scrollWidth - rail.clientWidth;
      var p = maxScroll > 0 ? rail.scrollLeft / maxScroll : 1;
      var shown = rail.scrollWidth > 0 ? rail.clientWidth / rail.scrollWidth : 1;
      if (prog) prog.style.setProperty('--p', Math.min(1, shown + (1 - shown) * p).toFixed(3));
      if (prev) prev.disabled = rail.scrollLeft <= 2;
      if (next) next.disabled = rail.scrollLeft >= maxScroll - 2;
    };
    var onWeekScroll = function () { if (!wkTick) { wkTick = true; requestAnimationFrame(syncWeek); } };
    var stepBy = function (dir) {
      var first = rail.querySelector('.wk');
      var w = first ? first.getBoundingClientRect().width + 16 : 300;
      rail.scrollBy({ left: dir * w, behavior: T.reduceMotion() ? 'auto' : 'smooth' });
    };
    rail.addEventListener('scroll', onWeekScroll, { passive: true });
    window.addEventListener('resize', onWeekScroll);
    if (prev) prev.addEventListener('click', function () { stepBy(-1); });
    if (next) next.addEventListener('click', function () { stepBy(1); });

    /* 滑鼠拖曳捲動（觸控用原生捲動就好） */
    var wd = null;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button) return;
      wd = { x: e.clientX, left: rail.scrollLeft, moved: false };
    });
    window.addEventListener('pointermove', function (e) {
      if (!wd) return;
      var dx = e.clientX - wd.x;
      if (Math.abs(dx) > 5 && !wd.moved) { wd.moved = true; rail.classList.add('is-drag'); }
      if (wd.moved) rail.scrollLeft = wd.left - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!wd) return;
      var moved = wd.moved;
      wd = null;
      if (moved) setTimeout(function () { rail.classList.remove('is-drag'); }, 0);
    });
    syncWeek();
  }

  /* ---------- 報名表：前端驗證，送出後只存在 localStorage ---------- */
  var form = document.querySelector('[data-apply]');
  if (!form) return;

  var KEY = 'tandelo.teacherApplication';
  var summary = form.querySelector('[data-error-summary]');
  var done = document.querySelector('[data-done]');
  var doneList = document.querySelector('[data-done-list]');
  var doneDuo = document.querySelector('[data-done-duo]');
  var savedNote = document.querySelector('[data-saved-note]');
  var attempted = false;
  /* 注意：form.name 是表單自己的 name 屬性，所以用 elements 取欄位 */
  var fName = form.elements.namedItem('name');

  var store = {
    get: function () { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (e) { return false; } },
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) { /* 忽略 */ } }
  };

  var checked = function (name) {
    return Array.prototype.slice.call(form.querySelectorAll('input[name="' + name + '"]:checked')).map(function (i) { return i.value; });
  };

  var isEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); };
  var isPhone = function (v) {
    var d = v.replace(/[\s\-()]/g, '').replace(/^\+886/, '0');
    return /^09\d{8}$/.test(d) || /^0\d{8,9}$/.test(d);
  };

  var rules = {
    name: function () {
      var v = fName.value.trim();
      return v ? '' : '請填寫姓名。';
    },
    contact: function () {
      var v = form.contact.value.trim();
      if (!v) return '請填寫 Email 或手機號碼。';
      return isEmail(v) || isPhone(v) ? '' : '格式看起來不太對：請填 Email，或 09 開頭的手機號碼。';
    },
    subjects: function () { return checked('subjects').length ? '' : '請至少選一個科目與年級。'; },
    slots: function () { return checked('slots').length ? '' : '請至少選一個可上課時段。'; },
    experience: function () { return form.experience.value ? '' : '請選擇教學經驗。'; },
    consent: function () { return form.consent.checked ? '' : '請勾選已閱讀個資用途說明，才能送出。'; }
  };
  var targets = {
    name: '#f-name', contact: '#f-contact', subjects: '#f-subjects',
    slots: '#f-slots', experience: '#f-exp', consent: '#f-consent'
  };
  var labels = {
    name: '姓名', contact: '聯絡方式', subjects: '可教科目與年級',
    slots: '可上課時段', experience: '教學經驗', consent: '個資用途說明'
  };

  var showError = function (key, msg) {
    var errEl = form.querySelector('[data-err-for="' + key + '"]');
    if (errEl) errEl.textContent = msg;
    var target = form.querySelector(targets[key]);
    if (!target) return;
    if (target.tagName === 'FIELDSET') {
      target.querySelector('.choice-row').classList.toggle('is-invalid', !!msg);
      target.setAttribute('aria-invalid', msg ? 'true' : 'false');
    } else {
      if (msg) target.setAttribute('aria-invalid', 'true');
      else target.removeAttribute('aria-invalid');
    }
  };

  var validate = function (key) {
    var msg = rules[key]();
    showError(key, msg);
    return msg;
  };

  var focusTarget = function (key) {
    var t = form.querySelector(targets[key]);
    if (!t) return;
    if (t.tagName === 'FIELDSET') t = t.querySelector('input');
    t.focus();
  };

  /* 送出過一次之後，改動欄位就即時重新檢查 */
  Object.keys(rules).forEach(function (key) {
    var t = form.querySelector(targets[key]);
    if (!t) return;
    var evt = (t.tagName === 'INPUT' && t.type === 'text') ? 'input' : 'change';
    t.addEventListener(evt, function () { if (attempted) validate(key); });
    if (t.tagName === 'INPUT' && t.type === 'text') {
      t.addEventListener('blur', function () { if (attempted || t.value.trim()) validate(key); });
    }
  });

  var renderDone = function (data, savedOk, remoteId) {
    doneList.innerHTML = '';
    var rows = [
      ['姓名', data.name],
      ['聯絡方式', data.contact],
      ['科目年級', data.subjects.join('、')],
      ['可上課時段', data.slots.join('、')],
      ['教學經驗', data.experience]
    ];
    if (data.note) rows.push(['補充', data.note]);
    rows.forEach(function (r) {
      var div = document.createElement('div');
      var dt = document.createElement('dt');
      var dd = document.createElement('dd');
      dt.textContent = r[0];
      dd.textContent = r[1];
      div.appendChild(dt);
      div.appendChild(dd);
      doneList.appendChild(div);
    });
    var title = done.querySelector('.done-title');
    var lead = done.querySelector('[data-done-lead]');
    if (remoteId) {
      title.textContent = '已送出（POC 後端）。';
      if (lead) lead.textContent = '這是概念驗證：資料已送到示範後端（編號 ' + remoteId + '），也留了一份在你的裝置。正式招募開始時，請以正式公告為準。';
    } else {
      title.textContent = savedOk ? '已收到，只存在你的裝置。' : '已完成示範，但這台裝置不允許儲存。';
      if (lead) lead.textContent = '這是概念驗證，資料只留在你的裝置，不會寄出。正式招募開始時，請以正式公告為準。';
    }
  };

  var showSavedNote = function (text, withButton) {
    if (!savedNote) return;
    savedNote.querySelector('p').textContent = text;
    savedNote.querySelector('[data-clear]').hidden = !withButton;
    savedNote.hidden = false;
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    attempted = true;
    var errors = [];
    Object.keys(rules).forEach(function (key) {
      var msg = validate(key);
      if (msg) errors.push(key);
    });

    if (errors.length) {
      summary.innerHTML = '';
      var p = document.createElement('p');
      p.textContent = '還有 ' + errors.length + ' 個地方要補上：';
      summary.appendChild(p);
      var ul = document.createElement('ul');
      ul.style.margin = '6px 0 0';
      ul.style.paddingLeft = '20px';
      errors.forEach(function (key) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = targets[key];
        a.textContent = labels[key];
        a.style.color = 'inherit';
        a.addEventListener('click', function (ev) { ev.preventDefault(); focusTarget(key); });
        li.appendChild(a);
        ul.appendChild(li);
      });
      summary.appendChild(ul);
      summary.hidden = false;
      summary.focus();
      return;
    }

    summary.hidden = true;
    var data = {
      name: fName.value.trim(),
      contact: form.contact.value.trim(),
      subjects: checked('subjects'),
      slots: checked('slots'),
      experience: form.experience.value,
      note: form.note.value.trim(),
      savedAt: new Date().toISOString(),
      poc: true
    };
    var ok = store.set(data);
    var finish = function (remoteId) {
      renderDone(data, ok, remoteId);
      form.hidden = true;
      if (savedNote) savedNote.hidden = true;
      done.hidden = false;
      done.focus();
      if (doneDuo && !T.reduceMotion()) {
        doneDuo.classList.remove('is-celebrate');
        void doneDuo.offsetWidth;
        doneDuo.classList.add('is-celebrate');
      }
    };
    /* 有設定後端就同步一份過去（POC 後端）；沒有或失敗就維持只存本機 */
    if (window.TANDELO_API_BASE) {
      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      import('./app/js/api.js')
        .then(function (api) {
          return api.submitTeacherApplication({
            name: data.name, contact: data.contact, subjects: data.subjects, slots: data.slots,
            experience: data.experience, note: data.note, consent: true
          });
        })
        .then(function (res) { finish(res && res.id ? res.id : null); }, function () { finish(null); })
        .then(function () { if (submitBtn) submitBtn.disabled = false; });
    } else {
      finish(null);
    }
  });

  document.querySelectorAll('[data-clear]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      store.clear();
      form.reset();
      attempted = false;
      Object.keys(rules).forEach(function (k) { showError(k, ''); });
      summary.hidden = true;
      done.hidden = true;
      form.hidden = false;
      showSavedNote('已清除這台裝置上的報名資料。', false);
      savedNote.setAttribute('role', 'status');
      form.querySelector('#f-name').focus();
    });
  });

  var again = document.querySelector('[data-again]');
  if (again) {
    again.addEventListener('click', function () {
      form.reset();
      attempted = false;
      done.hidden = true;
      form.hidden = false;
      if (store.get()) showSavedNote('這台裝置上有一份你之前留下的報名資料。再次送出會覆蓋它。', true);
      form.querySelector('#f-name').focus();
    });
  }

  if (store.get()) showSavedNote('這台裝置上有一份你之前留下的報名資料。', true);
})();
