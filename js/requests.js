// What the approval pages need to remember between visits.
//
// The requests themselves are written in approvals.html (table rows + detail panels).
// This browser's localStorage (key "approvals") only keeps what happens on the pages:
//   - submissions: forms sent from form.html (they can't be in the HTML in advance)
//   - decisions:   approve / reject made on approvals.html, by request number
//   - pending:     how many requests are waiting, for the menu count on other pages
//   - lastId:      the highest request number seen, so new requests get the next one
//
// NOTE: there is no server yet, so other people and other browsers won't see these.
// To share them, replace read() / write() with calls to your server.
(function (window) {
  'use strict';

  var KEY = 'approvals';
  var memory = null; // fallback when localStorage is blocked

  function pad(n) { return String(n).padStart(2, '0'); }
  function nowStamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function number(id) { return Number(String(id).replace('REQ-', '')) || 0; }

  function read() {
    var state = null;
    try { state = JSON.parse(window.localStorage.getItem(KEY)); } catch (e) { /* blocked or damaged */ }
    state = state || memory || {};
    state.submissions = state.submissions || [];
    state.decisions = state.decisions || {};
    return state;
  }

  function write(state) {
    memory = state;
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* blocked: keep in memory */ }
  }

  function currentUser() {
    try { return window.sessionStorage.getItem('username') || 'You'; } catch (e) { return 'You'; }
  }

  // Data saved by an earlier version of these pages
  try { window.localStorage.removeItem('requests'); } catch (e) { /* ignore */ }

  window.Requests = {
    submissions: function () { return read().submissions; },
    decisions: function () { return read().decisions; },

    // Number of requests waiting, as last counted on approvals.html (+ any sent since)
    pendingCount: function () { return read().pending || 0; },

    // Called by approvals.html after counting the requests on the page
    setSummary: function (pending, lastId) {
      var state = read();
      state.pending = pending;
      state.lastId = Math.max(state.lastId || 0, lastId || 0);
      write(state);
    },

    // Save a form sent from form.html; returns it with its new request number
    add: function (fields) {
      var state = read();
      var last = state.submissions.reduce(function (max, r) { return Math.max(max, number(r.id)); }, state.lastId || 1000);
      var request = Object.assign({}, fields, { id: 'REQ-' + (last + 1), submittedAt: nowStamp() });
      state.submissions.push(request);
      state.lastId = last + 1;
      state.pending = (state.pending || 0) + 1;
      write(state);
      return request;
    },

    // Give a submission a new number (when its number is already used in the HTML)
    renumber: function (oldId, newId) {
      var state = read();
      state.submissions.forEach(function (r) { if (r.id === oldId) r.id = newId; });
      if (state.decisions[oldId]) { state.decisions[newId] = state.decisions[oldId]; delete state.decisions[oldId]; }
      state.lastId = Math.max(state.lastId || 0, number(newId));
      write(state);
    },

    // status: 'Approved' or 'Rejected'; returns the saved decision
    decide: function (id, status, comment) {
      var state = read();
      var decision = { status: status, by: currentUser(), at: nowStamp(), comment: comment || '' };
      state.decisions[id] = decision;
      write(state);
      return decision;
    },

    // Forget everything saved; the page goes back to what is written in approvals.html
    reset: function () {
      memory = null;
      try { window.localStorage.removeItem(KEY); } catch (e) { /* storage blocked */ }
    }
  };
})(window);
