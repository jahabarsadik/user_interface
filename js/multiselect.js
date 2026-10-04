// Turns <select multiple data-multiselect> into a Bootstrap 5 dropdown with checkboxes,
// a search box, "Select all / Clear" links and removable chips for the chosen items.
// The original <select> stays in the page (hidden) and is kept in sync, so the form
// still submits it normally and required/invalid validation still applies to it.
//
// Optional attributes on the <select>:
//   data-placeholder="Choose..."   text shown when nothing is selected
(function (window, document) {
  'use strict';

  var uid = 0;

  function MultiSelect(select) {
    this.select = select;
    this.id = select.id || 'ms' + (++uid);
    this.placeholder = select.dataset.placeholder || 'Choose...';
    this.build();
    this.sync();
  }

  MultiSelect.prototype.build = function () {
    var self = this;
    var select = this.select;
    var buttonId = this.id + '-button';

    // Dropdown wrapper, inserted right after the hidden <select>
    var wrap = document.createElement('div');
    wrap.className = 'dropdown multiselect';
    wrap.innerHTML =
      '<button type="button" class="form-select dropdown-toggle" id="' + buttonId + '"' +
      ' data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false"></button>' +
      '<div class="dropdown-menu w-100 p-2 shadow-sm">' +
      '  <input type="search" class="form-control form-control-sm mb-2 ms-search" placeholder="Search..." aria-label="Search options">' +
      '  <div class="d-flex justify-content-between small mb-1 px-1">' +
      '    <a href="#" class="ms-all">Select all</a><a href="#" class="ms-none">Clear</a>' +
      '  </div>' +
      '  <div class="ms-options px-1"></div>' +
      '  <div class="ms-empty text-body-secondary small px-1 d-none">No matches</div>' +
      '</div>';
    select.classList.add('d-none');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    select.after(wrap);

    // Chips for the chosen items, placed after the field's feedback message if any
    var chips = document.createElement('div');
    chips.className = 'ms-chips d-flex flex-wrap gap-1 mt-2';
    var anchor = wrap.nextElementSibling && wrap.nextElementSibling.classList.contains('invalid-feedback')
      ? wrap.nextElementSibling : wrap;
    anchor.after(chips);

    // Point the field's <label for="..."> at the new button
    if (select.id) {
      var label = document.querySelector('label[for="' + select.id + '"]');
      if (label) label.htmlFor = buttonId;
    }

    this.wrap = wrap;
    this.button = wrap.querySelector('.dropdown-toggle');
    this.optionsBox = wrap.querySelector('.ms-options');
    this.search = wrap.querySelector('.ms-search');
    this.empty = wrap.querySelector('.ms-empty');
    this.chips = chips;

    // One checkbox per <option>, with a header per <optgroup>
    var n = 0;
    Array.prototype.forEach.call(select.children, function (child) {
      if (child.tagName === 'OPTGROUP') {
        var header = document.createElement('h6');
        header.className = 'dropdown-header ms-group';
        header.textContent = child.label;
        self.optionsBox.appendChild(header);
        Array.prototype.forEach.call(child.children, function (opt) { self.addCheckbox(opt, n++); });
      } else if (child.tagName === 'OPTION') {
        self.addCheckbox(child, n++);
      }
    });

    // Events
    this.optionsBox.addEventListener('change', function (e) {
      var cb = e.target;
      if (!cb.matches('input[type=checkbox]')) return;
      select.options[cb.dataset.index].selected = cb.checked;
      self.changed();
    });
    wrap.querySelector('.ms-all').addEventListener('click', function (e) {
      e.preventDefault();
      // Only the options currently visible in the search results
      self.optionsBox.querySelectorAll('.form-check:not(.d-none) input').forEach(function (cb) {
        select.options[cb.dataset.index].selected = true;
      });
      self.changed();
    });
    wrap.querySelector('.ms-none').addEventListener('click', function (e) {
      e.preventDefault();
      Array.prototype.forEach.call(select.options, function (o) { o.selected = false; });
      self.changed();
    });
    this.search.addEventListener('input', function () { self.filter(self.search.value); });
    wrap.addEventListener('shown.bs.dropdown', function () { self.search.focus(); });
    wrap.addEventListener('hidden.bs.dropdown', function () { self.search.value = ''; self.filter(''); });
    chips.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-index]');
      if (!btn) return;
      select.options[btn.dataset.index].selected = false;
      self.changed();
    });
    // Re-sync after the form is reset (the reset happens after this event fires)
    if (select.form) {
      select.form.addEventListener('reset', function () { setTimeout(function () { self.sync(); }, 0); });
    }
  };

  MultiSelect.prototype.addCheckbox = function (opt, index) {
    // Index into select.options (flat list, optgroups included)
    var flatIndex = Array.prototype.indexOf.call(this.select.options, opt);
    var id = this.id + '-opt' + index;
    var div = document.createElement('div');
    div.className = 'form-check';
    div.innerHTML = '<input class="form-check-input" type="checkbox"><label class="form-check-label w-100"></label>';
    var cb = div.firstChild;
    cb.id = id;
    cb.value = opt.value;
    cb.dataset.index = flatIndex;
    cb.disabled = opt.disabled;
    div.lastChild.htmlFor = id;
    div.lastChild.textContent = opt.textContent;
    this.optionsBox.appendChild(div);
  };

  MultiSelect.prototype.filter = function (text) {
    var q = text.trim().toLowerCase();
    var any = false;
    var currentHeader = null, headerHasMatch = false;
    var self = this;
    function closeGroup() { if (currentHeader) currentHeader.classList.toggle('d-none', !headerHasMatch); }
    Array.prototype.forEach.call(this.optionsBox.children, function (el) {
      if (el.classList.contains('ms-group')) {
        closeGroup();
        currentHeader = el;
        headerHasMatch = false;
        return;
      }
      var match = !q || el.textContent.toLowerCase().indexOf(q) !== -1;
      el.classList.toggle('d-none', !match);
      if (match) { any = true; headerHasMatch = true; }
    });
    closeGroup();
    self.empty.classList.toggle('d-none', any);
  };

  MultiSelect.prototype.changed = function () {
    this.sync();
    this.select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Update checkboxes, button text and chips from the <select>
  MultiSelect.prototype.sync = function () {
    var select = this.select;
    var chosen = [];
    this.optionsBox.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
      var opt = select.options[cb.dataset.index];
      cb.checked = opt.selected;
      if (opt.selected) chosen.push({ index: cb.dataset.index, text: opt.textContent });
    });

    if (!chosen.length) {
      this.button.textContent = this.placeholder;
      this.button.classList.add('text-body-secondary');
    } else {
      this.button.textContent = chosen.length <= 2
        ? chosen.map(function (c) { return c.text; }).join(', ')
        : chosen.length + ' selected';
      this.button.classList.remove('text-body-secondary');
    }

    this.chips.innerHTML = '';
    var self = this;
    chosen.forEach(function (c) {
      var chip = document.createElement('span');
      chip.className = 'badge rounded-pill text-bg-primary d-inline-flex align-items-center';
      chip.textContent = c.text;
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'btn-close btn-close-white';
      x.dataset.index = c.index;
      x.setAttribute('aria-label', 'Remove ' + c.text);
      chip.appendChild(x);
      self.chips.appendChild(chip);
    });
  };

  // Enhance every matching select once the page has loaded
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('select[multiple][data-multiselect]').forEach(function (s) {
      s.multiSelect = new MultiSelect(s);
    });
  });

  window.MultiSelect = MultiSelect;
})(window, document);
