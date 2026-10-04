// Small dependency-free data table for Bootstrap 5:
// global search, per-column filters, column sorting and pagination.
//
// Markup it expects (see index.html):
//   <th data-key="name" class="sortable">          header row: column key, click to sort
//   <th data-key="id" data-type="number">           sort numerically instead of as text
//   <input data-filter="name">                      text filter: "contains", case-insensitive
//   <select data-filter="role" data-exact>          dropdown filter: exact match, options filled from the data
//
// Records can come from either place:
//   - the HTML: leave out options.data and write the rows in <tbody> as normal <tr>s.
//     Each cell under a data-key column becomes a field (its text, or its data-value
//     attribute if it has one), and the <tr> itself is shown as-is.
//   - JavaScript: pass options.data (an array of objects) and options.renderRow.
(function (window) {
  'use strict';

  function SimpleDataTable(table, options) {
    this.table = table;
    this.tbody = table.tBodies[0];
    this.renderRow = options.renderRow || function (record) { return record._row; }; // function(record) -> <tr>
    this.searchInput = options.searchInput;      // global search <input>
    this.pageSizeSelect = options.pageSizeSelect;
    this.info = options.info;
    this.pager = options.pager;
    this.clearButton = options.clearButton;
    this.emptyText = options.emptyText || 'No matching records found';
    this.extraFilter = options.extraFilter || null; // function(record) -> keep?, e.g. for status tabs

    this.headers = Array.prototype.slice.call(table.querySelectorAll('thead th[data-key]'));
    this.filterInputs = Array.prototype.slice.call(table.querySelectorAll('[data-filter]'));
    this.keys = this.headers.map(function (th) { return th.dataset.key; });
    this.rows = options.data || this.readRows();

    this.sortKey = null;
    this.sortDir = 1;
    this.page = 1;
    this.pageSize = this.pageSizeSelect ? Number(this.pageSizeSelect.value) : 10;

    this.bind();
    this.refreshFilterOptions();
    this.render();
  }

  // Turn the <tr>s already in the <tbody> into records: { key: cell text, ..., _row: <tr> }
  SimpleDataTable.prototype.readRows = function () {
    var columnKeys = Array.prototype.map.call(this.table.tHead.rows[0].cells, function (th) { return th.dataset.key || null; });
    return Array.prototype.map.call(this.tbody.rows, function (tr) {
      return SimpleDataTable.recordFromRow(tr, columnKeys);
    });
  };

  SimpleDataTable.recordFromRow = function (tr, columnKeys) {
    var record = { _row: tr };
    Array.prototype.forEach.call(tr.cells, function (td, i) {
      var key = columnKeys[i];
      if (key) record[key] = td.hasAttribute('data-value') ? td.getAttribute('data-value') : td.textContent.trim();
    });
    return record;
  };

  // Record for a new <tr> (e.g. one cloned from a <template>), read the same way as the HTML rows
  SimpleDataTable.prototype.recordFor = function (tr) {
    var columnKeys = Array.prototype.map.call(this.table.tHead.rows[0].cells, function (th) { return th.dataset.key || null; });
    return SimpleDataTable.recordFromRow(tr, columnKeys);
  };

  SimpleDataTable.prototype.bind = function () {
    var self = this;

    // Re-filter while typing (debounced) and on dropdown change
    var timer;
    function onFilter() {
      clearTimeout(timer);
      timer = setTimeout(function () { self.page = 1; self.render(); }, 150);
    }
    if (this.searchInput) this.searchInput.addEventListener('input', onFilter);
    this.filterInputs.forEach(function (el) {
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', onFilter);
    });

    // Sorting: click a header to sort ascending, again for descending
    this.headers.forEach(function (th) {
      if (!th.classList.contains('sortable')) return;
      th.setAttribute('tabindex', '0');
      th.setAttribute('aria-sort', 'none');
      function sort() {
        var key = th.dataset.key;
        self.sortDir = self.sortKey === key ? -self.sortDir : 1;
        self.sortKey = key;
        self.render();
      }
      th.addEventListener('click', sort);
      th.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); }
      });
    });

    if (this.pageSizeSelect) {
      this.pageSizeSelect.addEventListener('change', function () {
        self.pageSize = Number(self.pageSizeSelect.value);
        self.page = 1;
        self.render();
      });
    }

    if (this.pager) {
      this.pager.addEventListener('click', function (e) {
        var link = e.target.closest('[data-page]');
        if (!link) return;
        e.preventDefault();
        self.page = Number(link.dataset.page);
        self.render();
      });
    }

    if (this.clearButton) {
      this.clearButton.addEventListener('click', function () { self.clearFilters(); });
    }
  };

  // Fill each dropdown filter with the distinct values found in that column
  SimpleDataTable.prototype.refreshFilterOptions = function () {
    var self = this;
    this.filterInputs.forEach(function (el) {
      if (el.tagName !== 'SELECT') return;
      var key = el.dataset.filter;
      var current = el.value;
      var values = [];
      self.rows.forEach(function (r) {
        var v = String(r[key]);
        if (values.indexOf(v) === -1) values.push(v);
      });
      values.sort();
      el.innerHTML = '<option value="">All</option>';
      values.forEach(function (v) {
        var opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        el.appendChild(opt);
      });
      el.value = values.indexOf(current) !== -1 ? current : '';
    });
  };

  SimpleDataTable.prototype.getFiltered = function () {
    var self = this;
    var search = this.searchInput ? this.searchInput.value.trim().toLowerCase() : '';
    var filters = this.filterInputs
      .map(function (el) {
        return { key: el.dataset.filter, value: el.value.trim().toLowerCase(), exact: el.hasAttribute('data-exact') };
      })
      .filter(function (f) { return f.value !== ''; });

    var result = this.rows.filter(function (r) {
      if (self.extraFilter && !self.extraFilter(r)) return false;
      for (var i = 0; i < filters.length; i++) {
        var cell = String(r[filters[i].key]).toLowerCase();
        if (filters[i].exact ? cell !== filters[i].value : cell.indexOf(filters[i].value) === -1) return false;
      }
      if (!search) return true;
      return self.keys.some(function (k) { return String(r[k]).toLowerCase().indexOf(search) !== -1; });
    });

    if (this.sortKey) {
      var key = this.sortKey, dir = this.sortDir;
      var th = this.headers.filter(function (h) { return h.dataset.key === key; })[0];
      var numeric = th && th.dataset.type === 'number';
      result.sort(function (a, b) {
        var x = a[key], y = b[key];
        if (numeric) return (Number(x) - Number(y)) * dir;
        return String(x).localeCompare(String(y), undefined, { sensitivity: 'base' }) * dir;
      });
    }
    return result;
  };

  SimpleDataTable.prototype.render = function () {
    var self = this;
    var filtered = this.getFiltered();
    var total = filtered.length;
    var size = this.pageSize > 0 ? this.pageSize : total || 1;
    var pages = Math.max(1, Math.ceil(total / size));
    if (this.page > pages) this.page = pages;
    var start = (this.page - 1) * size;
    var pageRows = filtered.slice(start, start + size);

    // Body
    this.tbody.innerHTML = '';
    if (!pageRows.length) {
      var tr = this.tbody.insertRow();
      var td = tr.insertCell();
      td.colSpan = this.table.tHead.rows[0].cells.length;
      td.className = 'text-center text-body-secondary py-4';
      td.textContent = this.emptyText;
    } else {
      pageRows.forEach(function (r) { self.tbody.appendChild(self.renderRow(r)); });
    }

    // Sort indicators
    this.headers.forEach(function (th) {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.classList.contains('sortable')) th.setAttribute('aria-sort', 'none');
      if (th.dataset.key === self.sortKey) {
        th.classList.add(self.sortDir === 1 ? 'sort-asc' : 'sort-desc');
        th.setAttribute('aria-sort', self.sortDir === 1 ? 'ascending' : 'descending');
      }
    });

    // Info text
    if (this.info) {
      var text = total
        ? 'Showing ' + (start + 1) + ' to ' + (start + pageRows.length) + ' of ' + total + ' entries'
        : 'Showing 0 entries';
      if (total !== this.rows.length) text += ' (filtered from ' + this.rows.length + ' total)';
      this.info.textContent = text;
    }

    // Pagination
    if (this.pager) this.renderPager(pages);
  };

  SimpleDataTable.prototype.renderPager = function (pages) {
    var page = this.page;
    var html = [];
    function item(label, target, disabled, active, aria) {
      html.push(
        '<li class="page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '') + '">' +
        (disabled || active
          ? '<span class="page-link"' + (active ? ' aria-current="page"' : '') + '>' + label + '</span>'
          : '<a class="page-link" href="#" data-page="' + target + '"' + (aria ? ' aria-label="' + aria + '"' : '') + '>' + label + '</a>') +
        '</li>'
      );
    }
    item('&laquo;', page - 1, page === 1, false, 'Previous');
    // Show first, last, and up to 2 pages either side of the current one
    var last = 0;
    for (var p = 1; p <= pages; p++) {
      if (p === 1 || p === pages || Math.abs(p - page) <= 2) {
        if (last && p - last > 1) item('&hellip;', 0, true, false);
        item(String(p), p, false, p === page);
        last = p;
      }
    }
    item('&raquo;', page + 1, page === pages, false, 'Next');
    this.pager.innerHTML = html.join('');
  };

  SimpleDataTable.prototype.clearFilters = function () {
    if (this.searchInput) this.searchInput.value = '';
    this.filterInputs.forEach(function (el) { el.value = ''; });
    this.page = 1;
    this.render();
  };

  // Data changes: call these instead of touching the DOM directly
  SimpleDataTable.prototype.add = function (record) {
    this.rows.push(record);
    this.refreshFilterOptions();
    this.render();
  };

  // Replace all records (keeps the current search, filters, sorting and page where possible)
  SimpleDataTable.prototype.setData = function (rows) {
    this.rows = rows;
    this.refreshFilterOptions();
    this.render();
  };

  SimpleDataTable.prototype.setExtraFilter = function (fn) {
    this.extraFilter = fn;
    this.page = 1;
    this.render();
  };

  SimpleDataTable.prototype.remove = function (predicate) {
    this.rows = this.rows.filter(function (r) { return !predicate(r); });
    this.refreshFilterOptions();
    this.render();
  };

  window.SimpleDataTable = SimpleDataTable;
})(window);
