// Start + end date & time in a single field, built on the Bootstrap 5 dropdown.
//
// Usage: <input type="text" class="form-control" data-daterange ...> inside an .input-group
// (or on its own). Clicking the field opens a two-month calendar: click the start day,
// then the end day, set the times and press Apply.
//
// Optional attributes on the <input>:
//   data-min="today" | "YYYY-MM-DD"        earliest selectable day
//   data-max="YYYY-MM-DD"                  latest selectable day
//   data-start-time="09:00"                default start time
//   data-end-time="17:00"                  default end time
//   data-start-name / data-end-name        names of the hidden inputs that hold the values
//                                          (submitted as "YYYY-MM-DDTHH:MM", like datetime-local)
//
// The visible field shows e.g. "14 Oct 2026, 09:00 → 16 Oct 2026, 17:00".
// It fires a "change" event when a range is applied or cleared.
(function (window, document) {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  function pad(n) { return String(n).padStart(2, '0'); }
  // Dates are handled as local "YYYY-MM-DD" keys, which also compare correctly as strings
  function toKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function fromKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function formatKey(k) { var d = fromKey(k); return d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getFullYear(); }

  function DateRangePicker(input) {
    var ds = input.dataset;
    this.input = input;
    this.min = ds.min === 'today' ? toKey(new Date()) : (ds.min || null);
    this.max = ds.max || null;
    this.defaultStartTime = ds.startTime || '09:00';
    this.defaultEndTime = ds.endTime || '17:00';
    this.start = null;      // applied values
    this.end = null;
    this.startTime = this.defaultStartTime;
    this.endTime = this.defaultEndTime;
    this.draftStart = null; // values being picked in the open calendar
    this.draftEnd = null;
    this.hover = null;
    var base = this.min ? fromKey(this.min) : new Date();
    this.view = new Date(base.getFullYear(), base.getMonth(), 1);
    this.build();
  }

  DateRangePicker.prototype.build = function () {
    var self = this;
    var input = this.input;
    var ds = input.dataset;

    // Hidden inputs carry the real values; the visible field only shows text
    this.startField = document.createElement('input');
    this.startField.type = 'hidden';
    this.startField.name = ds.startName || (input.id + 'Start');
    this.endField = document.createElement('input');
    this.endField.type = 'hidden';
    this.endField.name = ds.endName || (input.id + 'End');

    // Typing is blocked (the calendar is the only way in), but the field is not
    // readonly, so the browser still checks "required" on it
    input.classList.add('dropdown-toggle', 'drp-input');
    input.setAttribute('data-bs-toggle', 'dropdown');
    input.setAttribute('data-bs-auto-close', 'outside');
    input.setAttribute('aria-haspopup', 'dialog');
    input.setAttribute('inputmode', 'none');
    input.addEventListener('beforeinput', function (e) { e.preventDefault(); });
    input.addEventListener('paste', function (e) { e.preventDefault(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); self.dropdown.show(); }
      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); self.clear(); }
    });

    var menu = document.createElement('div');
    menu.className = 'dropdown-menu drp-menu p-3 shadow';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'Choose start and end date and time');
    menu.innerHTML =
      '<div class="d-flex align-items-center justify-content-between mb-2">' +
      '  <button type="button" class="btn btn-sm btn-outline-secondary drp-prev" aria-label="Previous month"><i class="bi bi-chevron-left"></i></button>' +
      '  <div class="small text-body-secondary drp-hint"></div>' +
      '  <button type="button" class="btn btn-sm btn-outline-secondary drp-next" aria-label="Next month"><i class="bi bi-chevron-right"></i></button>' +
      '</div>' +
      '<div class="drp-calendars"></div>' +
      '<div class="row g-2 mt-1">' +
      '  <div class="col-6"><label class="form-label small mb-1">Start time</label>' +
      '    <input type="time" class="form-control form-control-sm drp-start-time" step="900"></div>' +
      '  <div class="col-6"><label class="form-label small mb-1">End time</label>' +
      '    <input type="time" class="form-control form-control-sm drp-end-time" step="900"></div>' +
      '</div>' +
      '<div class="text-danger small mt-2 d-none drp-error"></div>' +
      '<hr class="my-3">' +
      '<div class="d-flex flex-wrap gap-2 align-items-center">' +
      '  <div class="small fw-semibold me-auto drp-summary"></div>' +
      '  <button type="button" class="btn btn-sm btn-outline-secondary drp-clear">Clear</button>' +
      '  <button type="button" class="btn btn-sm btn-primary drp-apply">Apply</button>' +
      '</div>';
    input.after(menu);
    // Hidden inputs go outside the .input-group so they don't upset its rounded corners
    (input.closest('.input-group') || menu).after(this.startField, this.endField);

    this.menu = menu;
    this.calendars = menu.querySelector('.drp-calendars');
    this.hint = menu.querySelector('.drp-hint');
    this.startTimeInput = menu.querySelector('.drp-start-time');
    this.endTimeInput = menu.querySelector('.drp-end-time');
    this.error = menu.querySelector('.drp-error');
    this.summary = menu.querySelector('.drp-summary');
    this.applyButton = menu.querySelector('.drp-apply');

    // Give the time inputs ids so their labels are linked
    var labels = menu.querySelectorAll('label');
    this.startTimeInput.id = input.id + '-start-time';
    this.endTimeInput.id = input.id + '-end-time';
    labels[0].htmlFor = this.startTimeInput.id;
    labels[1].htmlFor = this.endTimeInput.id;

    this.dropdown = bootstrap.Dropdown.getOrCreateInstance(input, {
      autoClose: 'outside',
      popperConfig: function (cfg) {
        cfg.placement = 'bottom-start';
        return cfg;
      }
    });

    // Opening: start from the applied values
    input.addEventListener('show.bs.dropdown', function () {
      self.draftStart = self.start;
      self.draftEnd = self.end;
      self.hover = null;
      self.startTimeInput.value = self.startTime;
      self.endTimeInput.value = self.endTime;
      if (self.start) { var s = fromKey(self.start); self.view = new Date(s.getFullYear(), s.getMonth(), 1); }
      self.render();
    });

    menu.querySelector('.drp-prev').addEventListener('click', function () { self.shiftMonth(-1); });
    menu.querySelector('.drp-next').addEventListener('click', function () { self.shiftMonth(1); });
    menu.querySelector('.drp-clear').addEventListener('click', function () { self.clear(); self.dropdown.hide(); });
    this.applyButton.addEventListener('click', function () { self.apply(); });
    this.startTimeInput.addEventListener('input', function () { self.renderFooter(); });
    this.endTimeInput.addEventListener('input', function () { self.renderFooter(); });

    this.calendars.addEventListener('click', function (e) {
      var day = e.target.closest('[data-day]');
      if (day && !day.disabled) self.pick(day.dataset.day);
    });
    this.calendars.addEventListener('mouseover', function (e) {
      var day = e.target.closest('[data-day]');
      if (!day || self.draftEnd || !self.draftStart) return;
      if (self.hover !== day.dataset.day) { self.hover = day.dataset.day; self.paintRange(); }
    });

    if (input.form) {
      input.form.addEventListener('reset', function () {
        setTimeout(function () { self.clear(); }, 0);
      });
    }
  };

  DateRangePicker.prototype.shiftMonth = function (n) {
    this.view = new Date(this.view.getFullYear(), this.view.getMonth() + n, 1);
    this.render();
  };

  DateRangePicker.prototype.pick = function (key) {
    // First click (or a click after a full range) starts a new range;
    // the second click sets the end, swapping if it is before the start
    if (!this.draftStart || this.draftEnd) {
      this.draftStart = key;
      this.draftEnd = null;
    } else if (key < this.draftStart) {
      this.draftEnd = this.draftStart;
      this.draftStart = key;
    } else {
      this.draftEnd = key;
    }
    this.hover = null;
    this.render();
  };

  DateRangePicker.prototype.render = function () {
    var html = '';
    for (var m = 0; m < 2; m++) {
      var first = new Date(this.view.getFullYear(), this.view.getMonth() + m, 1);
      html += this.renderMonth(first);
    }
    this.calendars.innerHTML = html;

    // Disable "previous" when the earlier month is entirely before the minimum date
    var prevEnd = new Date(this.view.getFullYear(), this.view.getMonth(), 0);
    this.menu.querySelector('.drp-prev').disabled = !!this.min && toKey(prevEnd) < this.min;
    var nextStart = new Date(this.view.getFullYear(), this.view.getMonth() + 2, 1);
    this.menu.querySelector('.drp-next').disabled = !!this.max && toKey(nextStart) > this.max;

    this.paintRange();
    this.renderFooter();
  };

  DateRangePicker.prototype.renderMonth = function (first) {
    var today = toKey(new Date());
    var year = first.getFullYear(), month = first.getMonth();
    var days = new Date(year, month + 1, 0).getDate();
    var lead = (first.getDay() + 6) % 7; // Monday-first week
    var html = '<div class="drp-month"><div class="drp-title">' + MONTHS[month] + ' ' + year + '</div><div class="drp-grid">';
    WEEKDAYS.forEach(function (w) { html += '<div class="drp-weekday">' + w + '</div>'; });
    for (var i = 0; i < lead; i++) html += '<div></div>';
    for (var d = 1; d <= days; d++) {
      var key = year + '-' + pad(month + 1) + '-' + pad(d);
      var disabled = (this.min && key < this.min) || (this.max && key > this.max);
      html += '<button type="button" class="drp-day' + (key === today ? ' today' : '') + '" data-day="' + key + '"' +
        (disabled ? ' disabled' : '') + ' aria-label="' + formatKey(key) + '">' + d + '</button>';
    }
    return html + '</div></div>';
  };

  // Highlight the chosen range (or the range up to the hovered day while choosing the end)
  DateRangePicker.prototype.paintRange = function () {
    var start = this.draftStart;
    var end = this.draftEnd || (start && this.hover && this.hover >= start ? this.hover : null);
    this.calendars.querySelectorAll('[data-day]').forEach(function (b) {
      var k = b.dataset.day;
      b.classList.toggle('range-start', k === start);
      b.classList.toggle('range-end', !!end && k === end);
      b.classList.toggle('in-range', !!end && k > start && k < end);
      b.setAttribute('aria-pressed', String(k === start || k === end));
    });
  };

  DateRangePicker.prototype.renderFooter = function () {
    var s = this.draftStart, e = this.draftEnd;
    this.hint.textContent = !s ? 'Select a start day' : !e ? 'Now select an end day' : 'Set the times, then Apply';

    var st = this.startTimeInput.value, et = this.endTimeInput.value;
    var problem = '';
    if (s && e) {
      if (!st || !et) problem = 'Please set both a start time and an end time.';
      else if (s === e && et <= st) problem = 'On a single day, the end time must be after the start time.';
    }
    this.error.textContent = problem;
    this.error.classList.toggle('d-none', !problem);
    this.applyButton.disabled = !(s && e) || !!problem;

    this.summary.textContent = s
      ? this.format(s, st) + ' → ' + (e ? this.format(e, et) : '…')
      : 'No dates selected';
  };

  DateRangePicker.prototype.format = function (key, time) {
    return formatKey(key) + (time ? ', ' + time : '');
  };

  DateRangePicker.prototype.apply = function () {
    this.start = this.draftStart;
    this.end = this.draftEnd;
    this.startTime = this.startTimeInput.value;
    this.endTime = this.endTimeInput.value;
    this.update();
    this.dropdown.hide();
    this.input.focus();
  };

  DateRangePicker.prototype.clear = function (silent) {
    this.start = this.end = this.draftStart = this.draftEnd = null;
    this.startTime = this.defaultStartTime;
    this.endTime = this.defaultEndTime;
    this.update(silent);
  };

  // Write the applied range to the visible field and the hidden inputs
  DateRangePicker.prototype.update = function (silent) {
    var has = this.start && this.end;
    this.input.value = has ? this.format(this.start, this.startTime) + ' → ' + this.format(this.end, this.endTime) : '';
    this.startField.value = has ? this.start + 'T' + this.startTime : '';
    this.endField.value = has ? this.end + 'T' + this.endTime : '';
    if (!silent) this.input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Values as Date objects (or null), for use by page scripts
  DateRangePicker.prototype.getRange = function () {
    if (!this.startField.value) return null;
    return { start: new Date(this.startField.value), end: new Date(this.endField.value) };
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('input[data-daterange]').forEach(function (input) {
      input.dateRangePicker = new DateRangePicker(input);
    });
  });

  window.DateRangePicker = DateRangePicker;
})(window, document);
