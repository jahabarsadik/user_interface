// Turns <select data-searchable> (single choice) into a "type to select" box:
// type part of an option to filter the list, then click it or use ↑/↓ and Enter.
// The original <select> stays in the page (hidden) and is kept in sync, so the form
// still submits it normally and "required" validation still applies.
//
// Optional attributes on the <select>:
//   data-placeholder="Type to search..."   text shown when nothing is chosen
//                                          (defaults to the disabled first option's text)
(function (window, document) {
  'use strict';

  var uid = 0;

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function SearchSelect(select) {
    this.select = select;
    this.id = select.id || 'ss' + (++uid);
    this.active = -1;   // index (into this.shown) of the highlighted option
    this.shown = [];    // options currently listed
    this.build();
    this.sync();
  }

  SearchSelect.prototype.build = function () {
    var self = this;
    var select = this.select;
    var placeholderOpt = select.options[0] && select.options[0].value === '' ? select.options[0] : null;

    // The real choices (skip an empty "Choose..." placeholder option)
    this.choices = Array.prototype.filter.call(select.options, function (o) { return o !== placeholderOpt && !o.disabled; });

    var wrap = document.createElement('div');
    wrap.className = 'searchselect position-relative';
    var listId = this.id + '-list';
    wrap.innerHTML =
      '<input type="text" class="form-select" role="combobox" autocomplete="off" spellcheck="false"' +
      ' aria-autocomplete="list" aria-expanded="false" aria-controls="' + listId + '">' +
      '<ul class="dropdown-menu w-100 searchselect-list" id="' + listId + '" role="listbox"></ul>';
    select.classList.add('d-none');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;
    select.after(wrap);

    this.input = wrap.firstChild;
    this.list = wrap.lastChild;
    this.input.id = this.id + '-input';
    this.input.placeholder = select.dataset.placeholder ||
      (placeholderOpt ? placeholderOpt.textContent.replace(/\.\.\.$|…$/, '') + ' (type to search)' : 'Type to search...');

    // Point the field's <label for="..."> at the new input
    var label = select.id && document.querySelector('label[for="' + select.id + '"]');
    if (label) label.htmlFor = this.input.id;

    var input = this.input;
    input.addEventListener('focus', function () { input.select(); self.open(''); });
    input.addEventListener('click', function () { if (!self.isOpen()) self.open(''); });
    input.addEventListener('input', function () { self.open(input.value); });
    input.addEventListener('blur', function () { self.commitTyped(); self.close(); });
    input.addEventListener('keydown', function (e) { self.onKey(e); });

    // mousedown (not click) so the input keeps focus and blur doesn't close the list first
    this.list.addEventListener('mousedown', function (e) {
      var item = e.target.closest('[data-index]');
      e.preventDefault();
      if (item) self.choose(Number(item.dataset.index));
    });

    if (select.form) {
      select.form.addEventListener('reset', function () { setTimeout(function () { self.sync(); }, 0); });
    }
  };

  SearchSelect.prototype.isOpen = function () { return this.list.classList.contains('show'); };

  // Show the options that contain `text` (all of them when text is empty)
  SearchSelect.prototype.open = function (text) {
    var q = text.trim().toLowerCase();
    var current = this.select.selectedOptions[0];
    this.shown = this.choices.filter(function (o) { return !q || o.textContent.toLowerCase().indexOf(q) !== -1; });

    var self = this;
    if (!this.shown.length) {
      this.list.innerHTML = '<li><span class="dropdown-item-text text-body-secondary small">No matches</span></li>';
    } else {
      this.list.innerHTML = this.shown.map(function (o, i) {
        var t = o.textContent, k = t.toLowerCase().indexOf(q);
        var label = q && k !== -1
          ? escapeHtml(t.slice(0, k)) + '<mark class="p-0">' + escapeHtml(t.slice(k, k + q.length)) + '</mark>' + escapeHtml(t.slice(k + q.length))
          : escapeHtml(t);
        return '<li><button type="button" tabindex="-1" class="dropdown-item d-flex justify-content-between" role="option"' +
          ' id="' + self.id + '-opt' + i + '" data-index="' + i + '" aria-selected="' + (o === current) + '">' +
          '<span>' + label + '</span>' + (o === current ? '<i class="bi bi-check2"></i>' : '') + '</button></li>';
      }).join('');
    }
    // Highlight the chosen option when just opening, otherwise the first match
    var at = q ? 0 : this.shown.indexOf(current);
    this.setActive(this.shown.length ? Math.max(at, 0) : -1);
    this.list.classList.add('show');
    this.input.setAttribute('aria-expanded', 'true');
  };

  SearchSelect.prototype.close = function () {
    this.list.classList.remove('show');
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.active = -1;
  };

  SearchSelect.prototype.setActive = function (i) {
    var items = this.list.querySelectorAll('[data-index]');
    items.forEach(function (el) { el.classList.remove('active'); });
    this.active = i;
    if (i < 0 || !items[i]) { this.input.removeAttribute('aria-activedescendant'); return; }
    items[i].classList.add('active');
    items[i].scrollIntoView({ block: 'nearest' });
    this.input.setAttribute('aria-activedescendant', items[i].id);
  };

  SearchSelect.prototype.onKey = function (e) {
    var open = this.isOpen();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { this.open(''); return; }
      var n = this.shown.length;
      if (!n) return;
      var next = e.key === 'ArrowDown' ? this.active + 1 : this.active - 1;
      this.setActive((next + n) % n);
    } else if (e.key === 'Enter') {
      if (open) {
        e.preventDefault(); // don't submit the form while choosing
        if (this.active >= 0) this.choose(this.active);
      }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); this.sync(); this.close(); }
    } else if (e.key === 'Tab') {
      // Tab accepts the highlighted match if something was typed
      if (open && this.active >= 0 && this.input.value !== this.selectedText()) this.choose(this.active, true);
    }
  };

  SearchSelect.prototype.choose = function (i, keepClosed) {
    var opt = this.shown[i];
    if (!opt) return;
    var changed = !opt.selected;
    opt.selected = true;
    this.sync();
    this.close();
    if (changed) this.select.dispatchEvent(new Event('change', { bubbles: true }));
    if (!keepClosed) this.input.focus();
  };

  // On leaving the box: accept an exact (case-insensitive) match, otherwise undo the typing
  SearchSelect.prototype.commitTyped = function () {
    var typed = this.input.value.trim().toLowerCase();
    if (typed && typed !== this.selectedText().toLowerCase()) {
      var exact = this.choices.filter(function (o) { return o.textContent.toLowerCase() === typed; })[0];
      if (exact) {
        exact.selected = true;
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else if (!typed && this.select.value) {
      // Clearing the box clears the choice
      this.select.selectedIndex = this.choices[0] === this.select.options[0] ? -1 : 0;
      this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    this.sync();
  };

  SearchSelect.prototype.selectedText = function () {
    var o = this.select.selectedOptions[0];
    return o && o.value !== '' ? o.textContent : '';
  };

  // Update the box from the <select>, and mirror its validity so Bootstrap shows red/green on the box
  SearchSelect.prototype.sync = function () {
    this.input.value = this.selectedText();
    this.input.setCustomValidity(this.select.checkValidity() ? '' : (this.select.validationMessage || 'Please choose an option.'));
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('select[data-searchable]:not([multiple])').forEach(function (s) {
      s.searchSelect = new SearchSelect(s);
    });
  });

  window.SearchSelect = SearchSelect;
})(window, document);
