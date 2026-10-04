// Search boxes with suggestions, used by the top bar (every page) and the dashboard.
//
// Markup: <form data-site-search> containing an <input type="search"> and an empty
// <div class="site-search-results list-group">. Typing lists matching pages (from the
// sidebar menu) and, on pages that provide them, matching users.
//
// A page can plug in its own data and action through window.AppSearch:
//   getUsers()      -> array of { name, email, role, status }   (dashboard only)
//   onSearch(text)  -> what Search / Enter does on this page
// Without onSearch, searching opens the dashboard with the users table filtered
// (index.html?q=...).
(function (window, document) {
  'use strict';

  var MAX_USERS = 5;

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Wrap the matching part of the text in <mark>
  function highlight(text, q) {
    var i = text.toLowerCase().indexOf(q);
    if (i === -1) return escapeHtml(text);
    return escapeHtml(text.slice(0, i)) + '<mark class="p-0">' + escapeHtml(text.slice(i, i + q.length)) + '</mark>' + escapeHtml(text.slice(i + q.length));
  }

  // Pages come from the sidebar menu in the page's HTML, e.g. "Preferences" in Forms › Registration Form
  function allPages() {
    function label(link) {
      var el = link.querySelector('.nav-label');
      return el ? el.textContent.trim() : '';
    }
    var links = document.querySelectorAll('#sidebar a.nav-link:not(.sub-toggle)');
    return Array.prototype.filter.call(links, function (a) { return a.getAttribute('href') !== '#'; })
      .map(function (a) {
        var trail = [];
        for (var sub = a.closest('.submenu'); sub; sub = sub.parentElement.closest('.submenu')) {
          var parent = document.querySelector('[aria-controls="' + sub.id + '"]');
          if (parent) trail.unshift(label(parent));
        }
        var icon = a.querySelector('.bi');
        var iconName = icon ? (icon.className.match(/bi-([\w-]+)/) || [])[1] : 'file-earmark';
        return { label: label(a), href: a.getAttribute('href'), icon: iconName, trail: trail.join(' › ') };
      });
  }

  function hooks() { return window.AppSearch || {}; }

  function runSearch(text) {
    if (hooks().onSearch) hooks().onSearch(text);
    else window.location.href = 'index.html?q=' + encodeURIComponent(text) + '#users';
  }

  function SiteSearch(form) {
    this.form = form;
    this.input = form.querySelector('input[type="search"]');
    this.results = form.querySelector('.site-search-results');
    this.pages = allPages();
    this.bind();
  }

  SiteSearch.prototype.show = function (show) {
    this.results.classList.toggle('d-none', !show);
    this.input.setAttribute('aria-expanded', String(show));
  };

  SiteSearch.prototype.render = function () {
    var raw = this.input.value.trim();
    var q = raw.toLowerCase();
    if (!q) { this.show(false); return; }

    var html = '';
    var getUsers = hooks().getUsers;
    if (getUsers) {
      var users = getUsers().filter(function (u) {
        return [u.name, u.email, u.role, u.status].some(function (v) { return String(v).toLowerCase().indexOf(q) !== -1; });
      });
      if (users.length) {
        html += '<div class="list-group-item small fw-semibold text-body-secondary bg-body-tertiary">Users (' + users.length + ')</div>';
        users.slice(0, MAX_USERS).forEach(function (u) {
          html += '<button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2" role="option" data-search="' + escapeHtml(u.email) + '">' +
            '<i class="bi bi-person-circle text-body-secondary"></i>' +
            '<span class="me-auto text-truncate"><span class="fw-semibold">' + highlight(u.name, q) + '</span><br><small class="text-body-secondary">' + highlight(u.email, q) + '</small></span>' +
            '<span class="badge text-bg-light">' + highlight(u.role, q) + '</span></button>';
        });
        if (users.length > MAX_USERS) {
          html += '<button type="button" class="list-group-item list-group-item-action small text-primary" role="option" data-search="' + escapeHtml(raw) + '">' +
            '<i class="bi bi-table"></i> Show all ' + users.length + ' matching users in the table</button>';
        }
      }
    } else {
      // Pages without user data: offer to search the users table on the dashboard
      html += '<button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-2" role="option" data-search="' + escapeHtml(raw) + '">' +
        '<i class="bi bi-people text-body-secondary"></i><span>Search users for “<strong>' + escapeHtml(raw) + '</strong>”</span></button>';
    }

    var pages = this.pages.filter(function (p) { return (p.label + ' ' + p.trail).toLowerCase().indexOf(q) !== -1; });
    if (pages.length) {
      html += '<div class="list-group-item small fw-semibold text-body-secondary bg-body-tertiary">Pages (' + pages.length + ')</div>';
      pages.forEach(function (p) {
        html += '<a class="list-group-item list-group-item-action d-flex align-items-center gap-2" role="option" href="' + p.href + '">' +
          '<i class="bi bi-' + p.icon + ' text-body-secondary"></i>' +
          '<span>' + highlight(p.label, q) + (p.trail ? '<br><small class="text-body-secondary">' + escapeHtml(p.trail) + '</small>' : '') + '</span></a>';
      });
    }

    if (!html) html = '<div class="list-group-item text-body-secondary small">No users or pages match “' + escapeHtml(raw) + '”</div>';
    this.results.innerHTML = html;
    this.show(true);
  };

  SiteSearch.prototype.options = function () {
    return Array.prototype.slice.call(this.results.querySelectorAll('[role="option"]'));
  };

  SiteSearch.prototype.bind = function () {
    var self = this;
    var timer;
    this.input.setAttribute('role', 'combobox');
    this.input.setAttribute('aria-autocomplete', 'list');
    this.input.setAttribute('aria-expanded', 'false');
    if (!this.results.id) this.results.id = (this.form.id || 'search') + 'Results';
    this.input.setAttribute('aria-controls', this.results.id);
    this.results.setAttribute('role', 'listbox');

    this.input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { self.render(); }, 120);
    });
    this.input.addEventListener('focus', function () { if (self.input.value.trim()) self.render(); });

    this.form.addEventListener('submit', function (e) {
      e.preventDefault();
      self.show(false);
      runSearch(self.input.value.trim());
    });

    this.results.addEventListener('click', function (e) {
      var item = e.target.closest('[data-search]');
      if (!item) return;
      self.show(false);
      runSearch(item.dataset.search);
    });

    // Keyboard: ↓ from the box moves into the list, ↑/↓ move within it, Esc closes
    this.form.addEventListener('keydown', function (e) {
      var list = self.options();
      var i = list.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        if (self.results.classList.contains('d-none')) { if (self.input.value.trim()) { e.preventDefault(); self.render(); } return; }
        if (!list.length) return;
        e.preventDefault();
        list[Math.min(i + 1, list.length - 1)].focus();
      } else if (e.key === 'ArrowUp' && i !== -1) {
        e.preventDefault();
        (i === 0 ? self.input : list[i - 1]).focus();
      } else if (e.key === 'Escape') {
        self.show(false);
        self.input.focus();
      }
    });

    document.addEventListener('click', function (e) {
      if (!self.form.contains(e.target)) self.show(false);
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form[data-site-search]').forEach(function (form) {
      form.siteSearch = new SiteSearch(form);
    });
  });

  window.SiteSearch = SiteSearch;
})(window, document);
