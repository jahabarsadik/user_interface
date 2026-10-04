// Page behaviour for login.html
//
// NOTE: this page has no server behind it, so any user name and password are accepted.
// To check real accounts, replace signIn() below with a call to your server
// (e.g. fetch('/api/login', { method: 'POST', ... })) and only redirect when it succeeds.
// The password is never stored by this page.
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('loginForm');
  var username = document.getElementById('username');
  var password = document.getElementById('password');
  var remember = document.getElementById('remember');
  var toggle = document.getElementById('togglePassword');
  var caps = document.getElementById('capsWarning');
  var error = document.getElementById('loginError');
  var button = document.getElementById('loginButton');

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; } // storage can be blocked
  }

  // Coming here from "Log out" ends the session
  var session = store('sessionStorage');
  if (session) session.removeItem('username');

  // Pre-fill a remembered user name
  var local = store('localStorage');
  var saved = local && local.getItem('rememberedUser');
  if (saved) {
    username.value = saved;
    remember.checked = true;
    password.focus();
  }

  // Show / hide password
  toggle.addEventListener('click', function () {
    var show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    toggle.querySelector('i').className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
    password.focus();
  });

  // Caps Lock warning while typing the password
  function checkCaps(e) {
    if (e.getModifierState) caps.classList.toggle('d-none', !e.getModifierState('CapsLock'));
  }
  password.addEventListener('keydown', checkCaps);
  password.addEventListener('keyup', checkCaps);
  password.addEventListener('blur', function () { caps.classList.add('d-none'); });

  document.getElementById('forgotLink').addEventListener('click', function (e) {
    e.preventDefault();
    showError('Please contact your administrator to reset your password.', 'info');
  });

  function showError(message, kind) {
    error.className = 'alert alert-' + (kind || 'danger') + ' small py-2';
    error.textContent = message;
  }

  function setBusy(busy) {
    button.disabled = busy;
    button.querySelector('.spinner-border').classList.toggle('d-none', !busy);
    button.querySelector('.bi').classList.toggle('d-none', busy);
    button.querySelector('.btn-text').textContent = busy ? 'Signing in…' : 'Sign in';
  }

  // Replace with a real server check (see the note at the top)
  function signIn(user, pass) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(true); }, 400); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    username.value = username.value.trim();
    error.classList.add('d-none');
    form.classList.add('was-validated');
    if (!form.checkValidity()) {
      form.querySelector(':invalid').focus();
      return;
    }

    setBusy(true);
    signIn(username.value, password.value).then(function (ok) {
      if (!ok) {
        setBusy(false);
        showError('User name or password is incorrect.');
        password.value = '';
        password.focus();
        return;
      }
      if (local) {
        if (remember.checked) local.setItem('rememberedUser', username.value);
        else local.removeItem('rememberedUser');
      }
      if (session) session.setItem('username', username.value);
      window.location.href = 'index.html';
    });
  });
});
