// Page behaviour for index.html (plain JavaScript, no jQuery)
document.addEventListener('DOMContentLoaded', function () {
  // Users data table: the records are the <tr> rows written in index.html
  var usersTable = new SimpleDataTable(document.getElementById('usersTable'), {
    searchInput: document.getElementById('dtSearch'),
    pageSizeSelect: document.getElementById('dtPageSize'),
    info: document.getElementById('dtInfo'),
    pager: document.getElementById('dtPager'),
    clearButton: document.getElementById('dtClear')
  });

  // Delete row
  document.getElementById('userTable').addEventListener('click', function (e) {
    var btn = e.target.closest('.js-delete');
    if (!btn) return;
    var tr = btn.closest('tr');
    usersTable.remove(function (u) { return u._row === tr; });
  });

  // Add user from modal: copy the row <template> from index.html and fill it in
  var addUserForm = document.getElementById('addUserForm');
  var addUserModal = bootstrap.Modal.getOrCreateInstance('#addUserModal');
  var rowTemplate = document.getElementById('userRowTemplate');
  function pad(n) { return String(n).padStart(2, '0'); }
  addUserForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var today = new Date();
    var values = {
      id: usersTable.rows.reduce(function (max, u) { return Math.max(max, Number(u.id) || 0); }, 0) + 1,
      name: document.getElementById('uName').value.trim(),
      email: document.getElementById('uEmail').value.trim(),
      role: document.getElementById('uRole').value,
      joined: today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate())
    };
    var tr = rowTemplate.content.firstElementChild.cloneNode(true);
    Object.keys(values).forEach(function (key) {
      var cell = tr.querySelector('[data-field="' + key + '"]');
      if (cell) cell.textContent = values[key];
    });
    tr.querySelector('.js-delete').setAttribute('aria-label', 'Delete ' + values.name);
    usersTable.add(usersTable.recordFor(tr));
    addUserForm.reset();
    addUserModal.hide();
  });

  // Profile form with Bootstrap validation styles
  var profileForm = document.getElementById('profileForm');
  var saveToast = bootstrap.Toast.getOrCreateInstance('#saveToast');
  profileForm.addEventListener('submit', function (e) {
    e.preventDefault();
    profileForm.classList.add('was-validated');
    if (profileForm.checkValidity()) saveToast.show();
  });
  profileForm.addEventListener('reset', function () {
    profileForm.classList.remove('was-validated');
  });
  // ---- Search boxes (js/search.js) --------------------------------------------
  // On this page they suggest users from the table, and Search filters the table.
  function searchTable(text, instant) {
    document.getElementById('pageSearchInput').value = text;
    var dtSearch = document.getElementById('dtSearch');
    dtSearch.value = text;
    dtSearch.dispatchEvent(new Event('input'));
    document.getElementById('users').scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
  }
  window.AppSearch = {
    getUsers: function () { return usersTable.rows; },
    onSearch: searchTable
  };

  // Arriving from a search on another page: index.html?q=...
  var query = new URLSearchParams(window.location.search).get('q');
  if (query) {
    searchTable(query, true);
    // Scroll again once images etc. have loaded, as loading can move the page back up
    window.addEventListener('load', function () { document.getElementById('users').scrollIntoView(); });
  }
});
