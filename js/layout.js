// Shared page layout: adds behaviour to the sidebar menu written in each page's HTML,
// and handles the menu toggle button.
//
// Desktop (768px and wider)
//   - The sidebar shows icons only by default; hover an icon to see its name.
//   - The ☰ button in the top bar expands it to show names too. The choice is remembered.
//   - Menus with sub-items (e.g. Forms) open inline when expanded, or as a pop-out
//     panel next to the icon when showing icons only.
//   - Sub-menus can be nested (Forms > Registration Form > Personal Details);
//     deeper levels always open inline, below their parent.
// Phone (narrower than 768px)
//   - The sidebar is hidden; the ☰ button slides it in over the page.
(function (window, document) {
  'use strict';

  var root = document.documentElement;
  var phone = window.matchMedia('(max-width: 767.98px)');
  var sidebar, toggle, backdrop, tooltips = [];

  function isIconOnly() { return !phone.matches && !root.classList.contains('sidebar-expanded'); }

  function labelOf(link) {
    var label = link.querySelector('.nav-label');
    return label ? label.textContent.trim() : '';
  }

  // Name tooltips for the icon-only sidebar (top-level links only: pop-outs have a title)
  function addTooltips() {
    sidebar.querySelectorAll('.sidebar-nav > .nav-item > .nav-link:not(.sub-toggle)').forEach(function (link) {
      tooltips.push(new bootstrap.Tooltip(link, { title: labelOf(link), placement: 'right', trigger: 'hover' }));
    });
  }

  // Counts shown next to menu items: <span data-badge="name"> in the menu HTML
  var COUNTERS = {
    'pending-approvals': function () { return window.Requests ? window.Requests.pendingCount() : 0; }
  };
  function refreshBadges() {
    if (!sidebar) return;
    sidebar.querySelectorAll('[data-badge]').forEach(function (el) {
      var counter = COUNTERS[el.dataset.badge];
      var n = 0;
      try { n = counter ? Number(counter()) || 0 : 0; } catch (e) { /* ignore a failing counter */ }
      el.textContent = n > 99 ? '99+' : String(n);
      el.classList.toggle('d-none', !n);
      el.setAttribute('aria-label', n + ' pending');
    });
  }
  window.AppLayout = { refreshBadges: refreshBadges };

  function collapseOf(sub) { return bootstrap.Collapse.getOrCreateInstance(sub, { toggle: false }); }
  function isTopLevel(sub) { return sub.classList.contains('submenu-level-1'); }

  // Highlight the link for the current page (and #section, if a link points at one),
  // plus every parent menu above it
  function markActive() {
    var page = location.pathname.split('/').pop() || 'index.html';
    var hash = location.hash;
    var links = Array.prototype.slice.call(sidebar.querySelectorAll('.nav-link:not(.sub-toggle)'));
    function parts(link) {
      var href = link.getAttribute('href');
      var i = href.indexOf('#');
      return { page: i === -1 ? href : href.slice(0, i), hash: i === -1 ? '' : href.slice(i) };
    }
    var match = links.filter(function (l) { var p = parts(l); return p.page === page && hash && p.hash === hash; })[0] ||
                links.filter(function (l) { var p = parts(l); return p.page === page && !p.hash; })[0];

    sidebar.querySelectorAll('.active').forEach(function (el) { el.classList.remove('active'); el.removeAttribute('aria-current'); });
    if (!match) return;
    match.classList.add('active');
    match.setAttribute('aria-current', 'page');

    var sub = match.closest('.submenu');
    while (sub) {
      sidebar.querySelector('[aria-controls="' + sub.id + '"]').classList.add('active');
      // Keep the path to the current page open. With icons only, the top-level pop-out
      // stays closed until clicked, but the levels inside it are ready when it opens.
      if (!isTopLevel(sub) || !isIconOnly()) collapseOf(sub).show();
      sub = sub.parentElement.closest('.submenu');
    }
  }

  // Close open sub-menus, except `keep`, the menus that contain it and the menus inside it
  function closeSubmenus(keep) {
    sidebar.querySelectorAll('.submenu.show').forEach(function (sub) {
      if (keep && (sub.contains(keep) || keep.contains(sub))) return;
      collapseOf(sub).hide();
    });
  }

  // Close the icon-only pop-out(s), leaving the open/closed state of the levels inside alone
  function closePopouts() {
    sidebar.querySelectorAll('.submenu-level-1.show').forEach(function (sub) { collapseOf(sub).hide(); });
  }

  // Sync the toggle button, tooltips and pop-outs with the current mode
  function refresh() {
    var iconOnly = isIconOnly();
    var open = phone.matches ? root.classList.contains('sidebar-open') : !iconOnly;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Hide menu names' : 'Show menu');
    tooltips.forEach(function (t) { if (iconOnly) t.enable(); else { t.hide(); t.disable(); } });
    if (iconOnly) closePopouts();
    else markActive();
  }

  function setExpanded(expanded) {
    root.classList.toggle('sidebar-expanded', expanded);
    try { localStorage.setItem('sidebar', expanded ? 'expanded' : 'collapsed'); } catch (e) { /* storage blocked */ }
    refresh();
  }

  function setPhoneOpen(open) {
    root.classList.toggle('sidebar-open', open);
    refresh();
  }

  document.addEventListener('DOMContentLoaded', function () {
    sidebar = document.getElementById('sidebar');
    toggle = document.getElementById('sidebarToggle');
    backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !toggle) return;

    // Show the signed-in user's name (set by login.html) in the top bar
    try {
      var user = sessionStorage.getItem('username');
      if (user) document.querySelectorAll('.js-account-name').forEach(function (el) { el.textContent = user; });
    } catch (e) { /* storage blocked */ }

    addTooltips();
    refreshBadges();
    markActive();
    refresh();
    // Turn on width animations only after the first paint, so the page doesn't animate on load
    requestAnimationFrame(function () { root.classList.add('sidebar-ready'); });

    toggle.addEventListener('click', function () {
      if (phone.matches) setPhoneOpen(!root.classList.contains('sidebar-open'));
      else setExpanded(!root.classList.contains('sidebar-expanded'));
    });
    if (backdrop) backdrop.addEventListener('click', function () { setPhoneOpen(false); });

    // Only one sub-menu open at a time on each level
    sidebar.addEventListener('show.bs.collapse', function (e) { closeSubmenus(e.target); });

    // Placeholder links (href="#") do nothing; real links close the phone menu / pop-out
    sidebar.addEventListener('click', function (e) {
      var link = e.target.closest('.nav-link');
      if (!link || link.classList.contains('sub-toggle')) return;
      if (link.getAttribute('href') === '#') e.preventDefault();
      if (phone.matches) setPhoneOpen(false);
      if (isIconOnly()) closePopouts();
    });

    // Close a pop-out when clicking elsewhere, and everything on Escape
    document.addEventListener('click', function (e) {
      if (isIconOnly() && !sidebar.contains(e.target)) closePopouts();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (isIconOnly()) closePopouts();
      if (phone.matches && root.classList.contains('sidebar-open')) { setPhoneOpen(false); toggle.focus(); }
    });

    // Counts changed in another tab (e.g. a request approved there)
    window.addEventListener('storage', refreshBadges);

    // Same-page links like form.html#date-time
    window.addEventListener('hashchange', markActive);

    // Switching between phone and desktop widths
    phone.addEventListener('change', function () {
      root.classList.remove('sidebar-open');
      refresh();
    });
  });
})(window, document);
