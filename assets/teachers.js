/* Tandelo 老師招募頁：接班卡示意、收入試算器、報名表（只存在本機，不寄出）。 */
(function () {
  'use strict';

  var T = window.Tandelo || { reduceMotion: function () { return false; }, confetti: function () {} };
  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };

  /* ---------- 接班卡示意 ---------- */
  var take = document.querySelector('[data-take]');
  if (take) {
    var card = take.closest('[data-takecard]');
    take.addEventListener('click', function () {
      var on = take.getAttribute('aria-pressed') !== 'true';
      take.setAttribute('aria-pressed', on ? 'true' : 'false');
      var duo = take.querySelector('.duo');
      if (on) {
        if (duo) { duo.classList.remove('is-celebrate'); void duo.offsetWidth; duo.classList.add('is-celebrate'); }
        T.confetti(card.querySelector('[data-confetti]'));
      }
    });
  }

  /* ---------- 收入試算器 ----------
     每位學生每堂學費＝8 團 NT$2,990 ÷ 8；每堂收入＝學費合計 × 分潤，和保底 600 取高；一個月以 4.3 週計。 */
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
    var shown = parseInt(monthEl.textContent.replace(/,/g, ''), 10) || 0;
    var raf = 0;

    var rate = function () {
      var r = calc.querySelector('input[name="level"]:checked');
      return r ? parseFloat(r.value) : 0.52;
    };
    var perSession = function (n, r) { return Math.max(Math.round(n * PER_STUDENT * r), FLOOR); };
    var monthly = function (n, r, t) { return Math.round(perSession(n, r) * t * WEEKS / 10) * 10; };

    var countTo = function (target) {
      cancelAnimationFrame(raf);
      if (T.reduceMotion()) { shown = target; monthEl.textContent = fmt(target); return; }
      var from = shown, start = null, dur = 450;
      var step = function (ts) {
        if (start === null) start = ts;
        var k = Math.min(1, (ts - start) / dur);
        var e = 1 - Math.pow(1 - k, 3);
        shown = from + (target - from) * e;
        monthEl.textContent = fmt(shown);
        if (k < 1) raf = requestAnimationFrame(step);
        else { shown = target; monthEl.textContent = fmt(target); }
      };
      raf = requestAnimationFrame(step);
    };

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

      out('tuition').textContent = 'NT$' + fmt(tuition);
      out('share').textContent = 'NT$' + fmt(share);
      out('per').textContent = 'NT$' + fmt(per);
      out('floor').hidden = share >= FLOOR;
      out('hours').textContent = '每週 ' + t + ' 堂・約 ' + (hours % 1 === 0 ? hours : hours.toFixed(1)) + ' 小時';
      countTo(monthly(n, r, t));

      var values = bars.map(function (b) { return monthly(+b.getAttribute('data-n'), r, t); });
      var max = Math.max.apply(null, values);
      bars.forEach(function (b, i) {
        b.classList.toggle('is-on', +b.getAttribute('data-n') === n);
        b.querySelector('.bar-v').textContent = fmt(values[i]);
        b.querySelector('.bar-fill').style.setProperty('--h', (values[i] / max * 100).toFixed(1) + '%');
      });
    };

    calc.addEventListener('input', render);
    calc.addEventListener('change', render);
    render();
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

  var renderDone = function (data, savedOk) {
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
    title.textContent = savedOk ? '已收到，只存在你的裝置。' : '已完成示範，但這台裝置不允許儲存。';
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
    renderDone(data, ok);
    form.hidden = true;
    if (savedNote) savedNote.hidden = true;
    done.hidden = false;
    done.focus();
    if (doneDuo && !T.reduceMotion()) {
      doneDuo.classList.remove('is-celebrate');
      void doneDuo.offsetWidth;
      doneDuo.classList.add('is-celebrate');
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
