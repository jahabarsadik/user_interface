// Page behaviour for form.html
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('regForm');
  var startDate = document.getElementById('startDate');
  var orientation = document.getElementById('orientation');
  var about = document.getElementById('about');
  var aboutCount = document.getElementById('aboutCount');
  var resultModal = bootstrap.Modal.getOrCreateInstance('#resultModal');

  // Start date can't be in the past
  function pad(n) { return String(n).padStart(2, '0'); }
  var now = new Date();
  var today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  startDate.min = today;

  // Orientation must be on or after the start date
  function checkOrientation() {
    orientation.min = startDate.value ? startDate.value + 'T00:00' : '';
    var tooEarly = orientation.value && startDate.value && orientation.value.slice(0, 10) < startDate.value;
    orientation.setCustomValidity(tooEarly ? 'Orientation must be on or after the start date.' : '');
  }
  startDate.addEventListener('change', checkOrientation);
  orientation.addEventListener('change', checkOrientation);

  // Character counter for the bio
  function updateCount() {
    var len = about.value.length;
    aboutCount.textContent = len + ' / ' + about.maxLength;
    aboutCount.classList.toggle('text-danger', len > 0 && len < about.minLength);
  }
  about.addEventListener('input', updateCount);

  // Submit: validate, then show what was entered
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    checkOrientation();
    form.classList.add('was-validated');
    if (!form.checkValidity()) {
      var firstInvalid = form.querySelector(':invalid');
      // Hidden enhanced selects can't take focus; focus their visible box instead
      if (firstInvalid && firstInvalid.multiSelect) firstInvalid = firstInvalid.multiSelect.button;
      if (firstInvalid && firstInvalid.searchSelect) firstInvalid = firstInvalid.searchSelect.input;
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ block: 'center' });
        firstInvalid.focus({ preventScroll: true });
      }
      return;
    }
    var data = new FormData(form);
    var request = saveRequest(data);
    showResult(data, request);
  });

  // Send the form for approval (appears on approvals.html)
  function saveRequest(data) {
    if (!window.Requests) return null;
    var request = Requests.add({
      requester: {
        name: (data.get('firstName') + ' ' + data.get('lastName')).trim(),
        email: data.get('email'),
        phone: data.get('phone') || ''
      },
      department: data.get('department'),
      skills: data.getAll('skills'),
      workMode: data.get('workMode'),
      days: data.getAll('days'),
      notifications: data.getAll('notifications'),
      startDate: data.get('startDate'),
      interviewTime: data.get('interviewTime'),
      orientation: data.get('orientation') || '',
      trainingStart: data.get('trainingStart'),
      trainingEnd: data.get('trainingEnd'),
      about: data.get('about')
    });
    if (window.AppLayout) AppLayout.refreshBadges();
    return request;
  }

  form.addEventListener('reset', function () {
    form.classList.remove('was-validated');
    orientation.setCustomValidity('');
    setTimeout(updateCount, 0);
  });

  function showResult(data, request) {
    document.getElementById('resultNote').innerHTML = request
      ? 'Your request <strong>' + request.id + '</strong> has been sent for approval. ' +
        '<a href="approvals.html#' + request.id + '">View it in My Approvals</a>'
      : '';
    var rows = [
      ['Name', data.get('firstName') + ' ' + data.get('lastName')],
      ['Email', data.get('email')],
      ['Phone', data.get('phone') || '—'],
      ['Department', data.get('department')],
      ['Skills', data.getAll('skills').join(', ')],
      ['Notifications', data.getAll('notifications').join(', ') || 'None'],
      ['Work mode', data.get('workMode')],
      ['Available days', data.getAll('days').join(', ') || 'None'],
      ['Start date', formatDate(data.get('startDate'))],
      ['Interview time', data.get('interviewTime')],
      ['Orientation', data.get('orientation') ? formatDate(data.get('orientation')) : '—'],
      ['Training period', formatDate(data.get('trainingStart')) + ' → ' + formatDate(data.get('trainingEnd')) +
        ' (' + formatDuration(new Date(data.get('trainingEnd')) - new Date(data.get('trainingStart'))) + ')'],
      ['Bio', data.get('about')]
    ];
    var body = document.getElementById('resultBody');
    body.innerHTML = '';
    rows.forEach(function (r) {
      var tr = body.insertRow();
      var th = document.createElement('th');
      th.scope = 'row';
      th.className = 'text-nowrap';
      th.textContent = r[0];
      tr.appendChild(th);
      var td = tr.insertCell();
      td.style.whiteSpace = 'pre-wrap';
      td.textContent = r[1];
    });
    resultModal.show();
  }

  // Training period: show how long the chosen range is under the field
  var training = document.getElementById('trainingPeriod');
  var trainingHelp = document.getElementById('trainingPeriodHelp');
  var trainingHelpText = trainingHelp.textContent;
  training.addEventListener('change', function () {
    var range = training.dateRangePicker.getRange();
    trainingHelp.textContent = range ? 'Duration: ' + formatDuration(range.end - range.start) : trainingHelpText;
  });

  // 187200000 ms -> "2 days 4 hours"
  function formatDuration(ms) {
    var mins = Math.round(ms / 60000);
    var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
    var parts = [];
    if (d) parts.push(d + (d === 1 ? ' day' : ' days'));
    if (h) parts.push(h + (h === 1 ? ' hour' : ' hours'));
    if (m) parts.push(m + ' min');
    return parts.join(' ') || '0 min';
  }

  // "2026-10-04" -> "4 Oct 2026", "2026-10-04T10:30" -> "4 Oct 2026, 10:30"
  function formatDate(value) {
    var hasTime = value.indexOf('T') !== -1;
    var d = new Date(hasTime ? value : value + 'T00:00');
    var opts = { day: 'numeric', month: 'short', year: 'numeric' };
    if (hasTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; opts.hour12 = false; }
    return d.toLocaleString('en-GB', opts);
  }

  updateCount();
});
