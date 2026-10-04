// Page behaviour for approvals.html.
//
// All requests are written in approvals.html: a <tr data-id="REQ-..."> in the table and an
// <article data-request="REQ-..."> with the full details in the review panel. This script
// shows and filters them, and when you approve or reject it updates that HTML (status badge,
// buttons, history). Decisions and forms sent from form.html are remembered in this browser
// by js/requests.js and put back on the page each time it opens.
document.addEventListener('DOMContentLoaded', function () {
  var STATUS_BADGE = { Pending: 'warning', Approved: 'success', Rejected: 'danger' };
  var HISTORY_ICON = { Submitted: 'send-check text-primary', Approved: 'check-circle text-success', Rejected: 'x-circle text-danger' };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var tbody = document.getElementById('requestRows');
  var reviewBody = document.getElementById('reviewBody');
  var rowTemplate = document.getElementById('requestRowTemplate');
  var detailTemplate = document.getElementById('requestDetailTemplate');
  var historyTemplate = document.getElementById('historyItemTemplate');

  var statusFilter = 'Pending';  // tile currently chosen ('' = all)
  var selected = {};             // ticked request numbers
  var reviewing = null;          // request open in the review panel

  // ---- Formatting (only needed for things added on the page) -----------------------
  // "2026-10-04" -> "4 Oct 2026";  "2026-10-04T09:30" -> "4 Oct 2026, 09:30"
  function fmt(value) {
    if (!value) return '—';
    var date = value.slice(0, 10).split('-');
    var text = Number(date[2]) + ' ' + MONTHS[Number(date[1]) - 1] + ' ' + date[0];
    return value.length > 10 ? text + ', ' + value.slice(11, 16) : text;
  }
  // Short date range: "26–28 Oct 2026", "26 Oct – 2 Nov 2026" or "28 Dec 2026 – 2 Jan 2027"
  function range(start, end) {
    var a = start.slice(0, 10).split('-'), b = end.slice(0, 10).split('-');
    var day = function (p) { return Number(p[2]); }, mon = function (p) { return MONTHS[Number(p[1]) - 1]; };
    if (a[0] !== b[0]) return fmt(start.slice(0, 10)) + ' – ' + fmt(end.slice(0, 10));
    if (a[1] !== b[1]) return day(a) + ' ' + mon(a) + ' – ' + day(b) + ' ' + mon(b) + ' ' + b[0];
    if (a[2] !== b[2]) return day(a) + '–' + day(b) + ' ' + mon(b) + ' ' + b[0];
    return fmt(start.slice(0, 10));
  }
  function duration(start, end) {
    var mins = Math.round((new Date(end) - new Date(start)) / 60000);
    var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
    var parts = [];
    if (d) parts.push(d + (d === 1 ? ' day' : ' days'));
    if (h) parts.push(h + (h === 1 ? ' hour' : ' hours'));
    if (m) parts.push(m + ' min');
    return parts.join(' ') || '0 min';
  }
  function number(id) { return Number(String(id).replace('REQ-', '')) || 0; }

  // ---- Find the HTML for a request -----------------------------------------------------
  // (rows are moved in and out of the table by paging, so keep a reference to each)
  var rowsById = {};
  var detailsById = {};
  Array.prototype.forEach.call(tbody.rows, function (tr) { rowsById[tr.dataset.id] = tr; });
  reviewBody.querySelectorAll('.request-detail').forEach(function (el) { detailsById[el.dataset.request] = el; });

  function statusOf(id) {
    var badge = rowsById[id] && rowsById[id].querySelector('.badge');
    return badge ? badge.textContent.trim() : '';
  }

  // One line for a request's History, from the <template> in approvals.html
  function historyItem(action, by, at, comment) {
    var li = historyTemplate.content.firstElementChild.cloneNode(true);
    li.querySelector('.bi').className = 'bi bi-' + HISTORY_ICON[action] + ' mt-1';
    li.querySelector('.history-action').textContent = action;
    li.querySelector('.history-by').textContent = by;
    var time = li.querySelector('.history-at');
    time.dateTime = at;
    time.textContent = fmt(at);
    var note = li.querySelector('.history-comment');
    if (comment) note.textContent = comment; else note.remove();
    return li;
  }

  // ---- Forms sent from form.html: add their row and details from the templates ------
  function addSubmission(r) {
    if (rowsById[r.id]) {
      // Number already used in the HTML: give the submission the next free number
      var last = Math.max.apply(null, Object.keys(rowsById).map(number));
      var newId = 'REQ-' + (last + 1);
      Requests.renumber(r.id, newId);
      r.id = newId;
    }
    var name = r.requester.name;

    var tr = rowTemplate.content.firstElementChild.cloneNode(true);
    tr.dataset.id = r.id;
    var fields = {
      id: r.id, name: name, email: r.requester.email, department: r.department, workMode: r.workMode,
      period: r.trainingStart ? range(r.trainingStart, r.trainingEnd) : '—',
      submittedDate: fmt(r.submittedAt.slice(0, 10))
    };
    Object.keys(fields).forEach(function (key) { tr.querySelector('[data-field="' + key + '"]').textContent = fields[key]; });
    tr.querySelector('[data-field="period"]').dataset.value = r.trainingStart || '';
    var submittedCell = tr.querySelector('[data-field="submittedDate"]');
    submittedCell.dataset.value = r.submittedAt;
    submittedCell.title = fmt(r.submittedAt);
    tr.querySelector('.row-check').setAttribute('aria-label', 'Select ' + r.id);
    tr.querySelector('.js-review[title]').setAttribute('aria-label', 'Review ' + r.id);
    tr.querySelector('.js-approve').setAttribute('aria-label', 'Approve ' + r.id);
    tr.querySelector('.js-reject').setAttribute('aria-label', 'Reject ' + r.id);
    tbody.appendChild(tr);
    rowsById[r.id] = tr;

    var article = detailTemplate.content.firstElementChild.cloneNode(true);
    article.dataset.request = r.id;
    var details = {
      submittedText: fmt(r.submittedAt), name: name, email: r.requester.email, phone: r.requester.phone,
      department: r.department, workMode: r.workMode, startDate: fmt(r.startDate),
      interviewTime: r.interviewTime || '—', orientation: fmt(r.orientation),
      training: r.trainingStart ? fmt(r.trainingStart) + ' → ' + fmt(r.trainingEnd) : '—',
      duration: r.trainingStart ? duration(r.trainingStart, r.trainingEnd) : '',
      about: r.about
    };
    Object.keys(details).forEach(function (key) {
      var el = article.querySelector('[data-field="' + key + '"]');
      if (!el) return;
      if (!details[key] && key === 'phone') { el.remove(); return; }
      el.textContent = details[key];
    });
    article.querySelector('[data-field="submittedText"]').dateTime = r.submittedAt;
    article.querySelector('[data-field="email"]').href = 'mailto:' + r.requester.email;
    article.querySelectorAll('[data-list]').forEach(function (dd) {
      var items = r[dd.dataset.list] || [];
      if (!items.length) { dd.innerHTML = '<span class="text-body-secondary">None</span>'; return; }
      items.forEach(function (item) {
        var chip = document.createElement('span');
        chip.className = 'badge text-bg-light border me-1 mb-1';
        chip.textContent = item;
        dd.appendChild(chip);
      });
    });
    article.querySelector('.request-history').appendChild(historyItem('Submitted', name, r.submittedAt, ''));
    reviewBody.appendChild(article);
    detailsById[r.id] = article;
  }

  // ---- Approve / reject: update the request's HTML ------------------------------------
  var table = null;
  function applyDecision(id, d) {
    var tr = rowsById[id];
    if (!tr || statusOf(id) !== 'Pending') return false;
    var badge = tr.querySelector('.badge');
    badge.className = 'badge text-bg-' + STATUS_BADGE[d.status];
    badge.textContent = d.status;
    tr.querySelectorAll('[data-pending-only]').forEach(function (el) { el.remove(); });
    tr.classList.remove('table-active');
    var history = detailsById[id] && detailsById[id].querySelector('.request-history');
    if (history) history.insertBefore(historyItem(d.status, d.by, d.at, d.comment), history.firstChild);
    var record = table && table.rows.filter(function (r) { return r._row === tr; })[0];
    if (record) record.status = d.status;
    return true;
  }

  // Put back what was saved in this browser, before the table reads the rows
  Requests.submissions().forEach(addSubmission);
  var saved = Requests.decisions();
  Object.keys(saved).forEach(function (id) { applyDecision(id, saved[id]); });

  // ---- Table (reads the rows written in the HTML) ---------------------------------------
  table = new SimpleDataTable(document.getElementById('requestsTable'), {
    searchInput: document.getElementById('rqSearch'),
    pageSizeSelect: document.getElementById('rqPageSize'),
    info: document.getElementById('rqInfo'),
    pager: document.getElementById('rqPager'),
    clearButton: document.getElementById('rqClear'),
    emptyText: 'No requests here',
    extraFilter: function (row) { return !statusFilter || row.status === statusFilter; }
  });

  // Counts on the tiles, and the number shown in the menu on every page
  function updateCounts() {
    var counts = { Pending: 0, Approved: 0, Rejected: 0 };
    table.rows.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
    document.getElementById('countPending').textContent = counts.Pending;
    document.getElementById('countApproved').textContent = counts.Approved;
    document.getElementById('countRejected').textContent = counts.Rejected;
    document.getElementById('countAll').textContent = table.rows.length;
    Requests.setSummary(counts.Pending, Math.max.apply(null, Object.keys(rowsById).map(number).concat(0)));
    if (window.AppLayout) window.AppLayout.refreshBadges();
  }

  // Keep the header checkbox and the bulk bar in step with the ticks
  function updateSelectionUi() {
    var ids = Object.keys(selected);
    var bar = document.getElementById('bulkBar');
    bar.classList.toggle('d-none', !ids.length);
    bar.classList.toggle('d-flex', !!ids.length);
    document.getElementById('bulkCount').textContent = ids.length + ' selected';

    var boxes = tbody.querySelectorAll('.row-check');
    var ticked = tbody.querySelectorAll('.row-check:checked').length;
    var all = document.getElementById('selectAll');
    all.disabled = !boxes.length;
    all.checked = !!boxes.length && ticked === boxes.length;
    all.indeterminate = ticked > 0 && ticked < boxes.length;
  }
  // The table redraws its rows on every search/sort/page; refresh the header box after it
  new MutationObserver(updateSelectionUi).observe(tbody, { childList: true });

  // ---- Status tiles ----------------------------------------------------------------------
  var titles = { Pending: 'Pending requests', Approved: 'Approved requests', Rejected: 'Rejected requests', '': 'All requests' };
  function showStatus(status) {
    statusFilter = status;
    document.querySelectorAll('.status-tile').forEach(function (t) { t.setAttribute('aria-pressed', String(t.dataset.status === status)); });
    document.getElementById('tableTitle').textContent = titles[status];
    table.setExtraFilter(function (row) { return !statusFilter || row.status === statusFilter; });
  }
  document.querySelectorAll('.status-tile').forEach(function (tile) {
    tile.addEventListener('click', function () { showStatus(tile.dataset.status); });
  });

  // ---- Row actions -------------------------------------------------------------------------
  tbody.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    var id = tr.dataset.id;
    if (e.target.closest('.js-review')) { e.preventDefault(); openReview(id); }
    else if (e.target.closest('.js-approve')) decide([id], 'Approved', '');
    else if (e.target.closest('.js-reject')) openReview(id, true); // a reason is needed, so ask in the panel
  });

  tbody.addEventListener('change', function (e) {
    if (!e.target.classList.contains('row-check')) return;
    var tr = e.target.closest('tr');
    if (e.target.checked) selected[tr.dataset.id] = true;
    else delete selected[tr.dataset.id];
    tr.classList.toggle('table-active', e.target.checked);
    updateSelectionUi();
  });

  document.getElementById('selectAll').addEventListener('change', function (e) {
    var on = e.target.checked; // read once: ticking each row updates this box as we go
    tbody.querySelectorAll('.row-check').forEach(function (box) {
      box.checked = on;
      box.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  // ---- Decide ------------------------------------------------------------------------------
  var toast = bootstrap.Toast.getOrCreateInstance('#actionToast');
  function notify(text, kind) {
    var el = document.getElementById('actionToast');
    el.className = 'toast border-0 text-bg-' + kind;
    document.getElementById('actionToastText').textContent = text;
    toast.show();
  }

  function decide(ids, status, comment) {
    var done = ids.filter(function (id) {
      if (statusOf(id) !== 'Pending') return false;
      return applyDecision(id, Requests.decide(id, status, comment));
    });
    ids.forEach(function (id) { delete selected[id]; });
    table.render();
    updateCounts();
    updateSelectionUi();
    if (!done.length) return;
    notify((done.length === 1 ? done[0] + ' ' : done.length + ' requests ') + status.toLowerCase() + '.',
      status === 'Approved' ? 'success' : 'danger');
    if (reviewing && done.indexOf(reviewing) !== -1) showReview(reviewing);
  }

  // ---- Review panel: shows the request's <article> from the HTML ---------------------------
  var panelEl = document.getElementById('reviewPanel');
  var panel = bootstrap.Offcanvas.getOrCreateInstance(panelEl);
  var comment = document.getElementById('reviewComment');
  var focusComment = false;

  function showReview(id) {
    reviewing = id;
    Object.keys(detailsById).forEach(function (key) { detailsById[key].hidden = key !== id; });
    reviewBody.scrollTop = 0;

    var title = document.getElementById('reviewTitle');
    title.textContent = id + ' ';
    title.appendChild(rowsById[id].querySelector('.badge').cloneNode(true));

    // Footer: decision buttons for pending requests, otherwise the latest decision
    var pending = statusOf(id) === 'Pending';
    document.getElementById('decisionForm').classList.toggle('d-none', !pending);
    var done = document.getElementById('decisionDone');
    done.classList.toggle('d-none', pending);
    if (!pending) {
      var latest = detailsById[id].querySelector('.request-history li');
      var note = latest.querySelector('.history-comment');
      var status = statusOf(id);
      var box = document.createElement('div');
      box.className = 'alert alert-' + STATUS_BADGE[status] + ' mb-0 small';
      var strong = document.createElement('strong');
      strong.textContent = status;
      box.appendChild(strong);
      box.appendChild(document.createTextNode(' by ' + latest.querySelector('.history-by').textContent +
        ' on ' + latest.querySelector('.history-at').textContent));
      if (note) {
        box.appendChild(document.createElement('br'));
        box.appendChild(document.createTextNode('“' + note.textContent + '”'));
      }
      done.innerHTML = '';
      done.appendChild(box);
    }
  }

  function openReview(id, wantReject) {
    if (!detailsById[id]) return;
    comment.value = '';
    comment.classList.remove('is-invalid');
    focusComment = !!wantReject;
    showReview(id);
    panel.show();
  }
  panelEl.addEventListener('shown.bs.offcanvas', function () {
    if (focusComment && !document.getElementById('decisionForm').classList.contains('d-none')) {
      comment.placeholder = 'Reason for rejecting';
      comment.focus();
    }
  });
  panelEl.addEventListener('hidden.bs.offcanvas', function () {
    reviewing = null;
    comment.placeholder = 'Add a note for the requester';
  });
  comment.addEventListener('input', function () { comment.classList.remove('is-invalid'); });

  document.getElementById('approveButton').addEventListener('click', function () {
    decide([reviewing], 'Approved', comment.value.trim());
  });
  document.getElementById('rejectButton').addEventListener('click', function () {
    if (!comment.value.trim()) {
      comment.classList.add('is-invalid');
      comment.focus();
      return;
    }
    decide([reviewing], 'Rejected', comment.value.trim());
  });

  // ---- Approve / reject several ------------------------------------------------------------
  var bulkModal = bootstrap.Modal.getOrCreateInstance('#bulkModal');
  var bulkForm = document.getElementById('bulkForm');
  var bulkComment = document.getElementById('bulkComment');
  var bulkStatus = 'Approved';

  function openBulk(status) {
    var ids = Object.keys(selected).sort();
    if (!ids.length) return;
    bulkStatus = status;
    var approve = status === 'Approved';
    document.getElementById('bulkTitle').textContent = (approve ? 'Approve ' : 'Reject ') + ids.length + (ids.length === 1 ? ' request' : ' requests');
    document.getElementById('bulkText').textContent = approve ? 'These requests will be approved:' : 'These requests will be rejected:';
    var list = document.getElementById('bulkList');
    list.innerHTML = '';
    ids.forEach(function (id) {
      var li = document.createElement('li');
      li.textContent = id + ' — ' + rowsById[id].cells[2].querySelector('.fw-semibold').textContent;
      list.appendChild(li);
    });
    document.getElementById('bulkCommentLabel').textContent = approve ? 'Comment (optional)' : 'Reason for rejecting (required)';
    bulkComment.required = !approve;
    bulkComment.value = '';
    bulkForm.classList.remove('was-validated');
    var confirm = document.getElementById('bulkConfirm');
    confirm.className = 'btn ' + (approve ? 'btn-success' : 'btn-danger');
    confirm.textContent = approve ? 'Approve' : 'Reject';
    bulkModal.show();
  }
  document.getElementById('bulkApprove').addEventListener('click', function () { openBulk('Approved'); });
  document.getElementById('bulkReject').addEventListener('click', function () { openBulk('Rejected'); });
  document.getElementById('bulkModal').addEventListener('shown.bs.modal', function () { bulkComment.focus(); });

  bulkForm.addEventListener('submit', function (e) {
    e.preventDefault();
    bulkComment.value = bulkComment.value.trim();
    bulkForm.classList.add('was-validated');
    if (!bulkForm.checkValidity()) { bulkComment.focus(); return; }
    bulkModal.hide();
    decide(Object.keys(selected), bulkStatus, bulkComment.value);
  });

  // ---- Start ---------------------------------------------------------------------------------
  updateCounts();
  showStatus('Pending');

  // Opened with approvals.html#REQ-1003: show that request
  var fromHash = decodeURIComponent(location.hash.slice(1));
  if (detailsById[fromHash]) {
    if (statusOf(fromHash) !== statusFilter) showStatus(statusOf(fromHash));
    openReview(fromHash);
  }
});
