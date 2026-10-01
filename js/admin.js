/* ================================================================
   ADMIN.JS — Hidden document/field manager (client-side staging tool)

   Design note: this static site (NAU CEIAS capstone server) has no
   server-side code, so a file only becomes real and visible to
   everyone once it physically exists in documents/ on the server
   (uploaded via SFTP). This script does two things:

   1. Lets you (logged in) stage, name, and preview documents locally
      in this browser, then download them pre-named to match exactly
      what the live site expects — so dropping them into documents/
      over SFTP is a one-step drag-and-drop.
   2. On every page load, for every document card, checks (via a
      lightweight HEAD request) whether the real file already exists
      at its expected documents/ path. If it does, the card upgrades
      itself to a live "Uploaded" link automatically — for every
      visitor, with no further code changes needed. That check only
      works once the site is actually served over http(s); opened
      straight from disk (file://) it will just stay "Not Uploaded".

   Login: admin@HCC / HCC2027
   ================================================================ */
(function () {
  'use strict';

  var ADMIN_USER = 'admin@HCC';
  var ADMIN_PASS = 'HCC2027';
  var STORAGE_KEY = 'hcc27_documents_v2';
  var SESSION_KEY = 'hcc27_admin_session';

  /* ── PDF page-1 thumbnails ───────────────────────────────────
     Uses pdf.js (loaded via <script> on documents.html / project.html
     only — pages without it just skip thumbnails, no errors, since
     every call below is guarded by pdfJsAvailable()). Thumbnails are
     cached in-memory per pageload, keyed by server path, so a doc that
     appears on both the Documents page and its Project accordion only
     gets rendered once. */
  var THUMB_CACHE = {};
  function pdfJsAvailable() { return typeof window.pdfjsLib !== 'undefined'; }
  if (pdfJsAvailable()) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  function isPdfPath(path) { return /\.pdf($|[?#])/i.test(path); }
  function generatePdfThumbnail(path) {
    if (THUMB_CACHE[path]) return THUMB_CACHE[path];
    if (!pdfJsAvailable() || !isPdfPath(path)) return Promise.resolve(null);
    var promise = window.pdfjsLib.getDocument(path).promise
      .then(function (pdf) { return pdf.getPage(1); })
      .then(function (page) {
        var targetWidth = 640; // rendered at 2x the card's display width for sharpness
        var baseViewport = page.getViewport({ scale: 1 });
        var viewport = page.getViewport({ scale: targetWidth / baseViewport.width });
        var canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise
          .then(function () { return canvas.toDataURL('image/jpeg', 0.85); });
      })
      .catch(function () { return null; }); // corrupt/unreadable PDF — fall back to icon, no crash
    THUMB_CACHE[path] = promise;
    return promise;
  }
  function attachThumbnail(field, path) {
    if (!isPdfPath(path)) return; // non-PDF docs (e.g. a staged .mp4) just keep the icon
    generatePdfThumbnail(path).then(function (dataUrl) {
      if (!dataUrl) return;
      document.querySelectorAll('.doc-preview[data-preview-id="' + cssEscape(field.id) + '"]').forEach(function (el) {
        el.innerHTML = '<img src="' + dataUrl + '" alt="' + escapeHTML(field.name) + ' — page 1 preview" loading="lazy" />';
      });
    });
  }

  var CATEGORY_ORDER = ['admin', 'siting', 'design', 'community', 'progress', 'poster', 'pitch', 'report', 'optional'];
  var CATEGORY_LABELS = {
    admin: 'Administrative & Registration',
    siting: 'Siting Challenge',
    design: 'Design Challenge',
    community: 'Community Connections',
    progress: 'Progress Reports',
    poster: 'Design & Siting Poster',
    pitch: 'Quick Pitch',
    report: 'Final Technical Report',
    optional: 'Optional Build & Test Challenge'
  };

  var DEFAULT_FIELDS = [
    { id: 'loi', category: 'admin', name: 'Letter of Intent', meta: 'PDF', icon: 'doc', fileSlug: 'letter-of-intent.pdf' },
    { id: 'roster', category: 'admin', name: 'Team Roster', meta: 'PDF', icon: 'doc', fileSlug: 'team-roster.pdf' },
    { id: 'site-memo', category: 'siting', name: 'Site Selection Memo', meta: 'PDF', icon: 'doc', fileSlug: 'site-selection-memo.pdf' },
    { id: 'site-feasibility', category: 'siting', name: 'Siting Feasibility Assessment Report', meta: 'PDF', icon: 'doc', fileSlug: 'siting-feasibility-assessment-report.pdf' },
    { id: 'design-narrative', category: 'design', name: 'Design Concept Narrative', meta: 'PDF', icon: 'doc', fileSlug: 'design-concept-narrative.pdf' },
    { id: 'design-final', category: 'design', name: 'Final Design Package', meta: 'PDF', icon: 'doc', fileSlug: 'final-design-package.pdf' },
    { id: 'community-summary', category: 'community', name: 'Community Connections Summary', meta: 'PDF', icon: 'doc', fileSlug: 'community-connections-summary.pdf' },
    { id: 'industry-log', category: 'community', name: 'Industry Correspondence Log', meta: 'PDF', icon: 'doc', fileSlug: 'industry-correspondence-log.pdf' },
    { id: 'progress-1', category: 'progress', name: 'Progress Report 1', meta: 'PDF', icon: 'doc', fileSlug: 'progress-report-1.pdf' },
    { id: 'progress-2', category: 'progress', name: 'Progress Report 2', meta: 'PDF', icon: 'doc', fileSlug: 'progress-report-2.pdf' },
    { id: 'poster', category: 'poster', name: 'Design & Siting Poster', meta: 'PDF', icon: 'poster', fileSlug: 'design-siting-poster.pdf' },
    { id: 'pitch', category: 'pitch', name: 'Quick Pitch Script & Slides', meta: 'PDF / MP4', icon: 'pitch', fileSlug: 'quick-pitch-script-slides.pdf' },
    { id: 'final-report', category: 'report', name: 'Final Technical Report', meta: 'PDF', icon: 'doc', fileSlug: 'final-technical-report.pdf' },
    { id: 'build-report', category: 'optional', name: 'Build & Test Report', meta: 'PDF', icon: 'doc', fileSlug: 'build-test-report.pdf' }
  ];

  /* ── helpers ─────────────────────────────────────────────── */
  function escapeHTML(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slugify(str) {
    return String(str || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'document';
  }
  function sanitizeFileSlug(v) {
    v = String(v || '').trim().replace(/[\\/]+/g, '-');
    return v || 'document.pdf';
  }
  function basename(path) { return String(path || '').split('/').pop(); }
  function cssEscape(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }
  function iconSVG(type) {
    if (type === 'poster') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="3" width="16" height="20" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>';
    if (type === 'pitch') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="14" height="10" rx="1"/><path d="M17 8l4-2v10l-4-2"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>';
  }
  function serverPathOf(field) { return 'documents/' + field.fileSlug; }

  /* ── storage ─────────────────────────────────────────────── */
  function getFields() {
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    var fields;
    if (!raw) {
      fields = DEFAULT_FIELDS.map(function (f) {
        return Object.assign({ fileName: null, fileData: null }, f);
      });
      saveFields(fields);
      return fields;
    }
    try { fields = JSON.parse(raw); } catch (e) { fields = []; }
    var changed = false;
    fields.forEach(function (f) {
      if (!f.fileSlug) { f.fileSlug = slugify(f.name) + '.pdf'; changed = true; }
    });
    if (changed) saveFields(fields);
    return fields;
  }
  function saveFields(fields) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fields)); }
    catch (e) {
      alert('Could not save: ' + (e && e.message ? e.message : 'storage error') +
        '\nThis usually means a staged file is too large for browser storage.');
    }
  }

  /* ── public-page rendering ──────────────────────────────── */
  function renderPendingCard(field) {
    return '<div class="doc-card" data-field-id="' + escapeHTML(field.id) + '">' +
      '<div class="doc-preview doc-preview-empty"><div class="doc-preview-placeholder">' + iconSVG(field.icon) + '</div></div>' +
      '<div class="doc-card-body">' +
      '<div class="doc-icon">' + iconSVG(field.icon) + '</div>' +
      '<div class="doc-info"><p class="doc-name">' + escapeHTML(field.name) + '</p>' +
      '<p class="doc-meta">' + escapeHTML(field.meta) + ' &middot; Not yet on server</p></div>' +
      '<span class="doc-status pending">Not Uploaded</span>' +
      '</div></div>';
  }
  function renderLiveCard(field) {
    var path = serverPathOf(field);
    return '<a class="doc-card" data-field-id="' + escapeHTML(field.id) + '" href="' + escapeHTML(path) + '" target="_blank" rel="noopener">' +
      '<div class="doc-preview" data-preview-id="' + escapeHTML(field.id) + '"><div class="doc-preview-placeholder">' + iconSVG(field.icon) + '</div></div>' +
      '<div class="doc-card-body">' +
      '<div class="doc-icon">' + iconSVG(field.icon) + '</div>' +
      '<div class="doc-info"><p class="doc-name">' + escapeHTML(field.name) + '</p>' +
      '<p class="doc-meta">' + escapeHTML(field.meta) + '</p></div>' +
      '<span class="doc-status uploaded">Uploaded</span>' +
      '</div></a>';
  }
  function renderAll() {
    var containers = document.querySelectorAll('[data-doc-category]');
    if (!containers.length) return;
    var fields = getFields();
    containers.forEach(function (el) {
      var cats = el.getAttribute('data-doc-category').split(/\s+/);
      var matches = fields.filter(function (f) { return cats.indexOf(f.category) !== -1; });
      el.innerHTML = matches.length ? matches.map(renderPendingCard).join('') :
        '<p class="doc-empty">No documents added to this category yet.</p>';
    });
    fields.forEach(checkLiveOnPage);
  }
  function checkLiveOnPage(field) {
    var path = serverPathOf(field);
    fetch(path, { method: 'HEAD', cache: 'no-store' }).then(function (res) {
      if (res && res.ok) {
        document.querySelectorAll('.doc-card[data-field-id="' + cssEscape(field.id) + '"]').forEach(function (el) {
          el.outerHTML = renderLiveCard(field);
        });
        attachThumbnail(field, path);
      }
    }).catch(function () { /* offline, file://, or not deployed yet — stays pending */ });
  }

  /* ── hidden trigger ──────────────────────────────────────── */
  function injectTrigger() {
    var footer = document.querySelector('footer');
    if (!footer) return;
    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'admin-trigger';
    trigger.setAttribute('aria-hidden', 'true');
    trigger.tabIndex = 0;
    trigger.addEventListener('click', openLogin);
    footer.appendChild(trigger);
  }

  /* ── login modal ─────────────────────────────────────────── */
  var loginOverlay;
  function buildLogin() {
    loginOverlay = document.createElement('div');
    loginOverlay.className = 'admin-overlay';
    loginOverlay.innerHTML =
      '<div class="admin-modal">' +
      '<h3>Document Manager Login</h3>' +
      '<label>Username<input type="text" class="admin-login-user" autocomplete="off" /></label>' +
      '<label>Password<input type="password" class="admin-login-pass" autocomplete="off" /></label>' +
      '<p class="admin-error" hidden>Incorrect username or password.</p>' +
      '<div class="admin-modal-actions">' +
      '<button type="button" class="admin-btn-secondary admin-login-cancel">Cancel</button>' +
      '<button type="button" class="admin-btn-primary admin-login-submit">Log In</button>' +
      '</div></div>';
    document.body.appendChild(loginOverlay);

    loginOverlay.addEventListener('click', function (e) { if (e.target === loginOverlay) closeLogin(); });
    loginOverlay.querySelector('.admin-login-cancel').addEventListener('click', closeLogin);
    loginOverlay.querySelector('.admin-login-submit').addEventListener('click', attemptLogin);
    loginOverlay.querySelector('.admin-login-pass').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') attemptLogin();
    });
  }
  function openLogin() {
    if (!loginOverlay) buildLogin();
    loginOverlay.querySelector('.admin-login-user').value = '';
    loginOverlay.querySelector('.admin-login-pass').value = '';
    loginOverlay.querySelector('.admin-error').hidden = true;
    loginOverlay.classList.add('open');
    setTimeout(function () { loginOverlay.querySelector('.admin-login-user').focus(); }, 30);
  }
  function closeLogin() { if (loginOverlay) loginOverlay.classList.remove('open'); }
  function attemptLogin() {
    var user = loginOverlay.querySelector('.admin-login-user').value.trim();
    var pass = loginOverlay.querySelector('.admin-login-pass').value;
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
      closeLogin();
      openPanel();
    } else {
      loginOverlay.querySelector('.admin-error').hidden = false;
    }
  }

  /* ── admin panel ─────────────────────────────────────────── */
  var panelOverlay, panelBody;
  function buildPanel() {
    panelOverlay = document.createElement('div');
    panelOverlay.className = 'admin-overlay';
    panelOverlay.innerHTML =
      '<div class="admin-panel">' +
      '<div class="admin-panel-head">' +
      '<h3>Document Manager</h3>' +
      '<div>' +
      '<button type="button" class="admin-btn-secondary admin-panel-download">Download Staged Files</button>' +
      '<button type="button" class="admin-btn-secondary admin-panel-logout">Log Out</button>' +
      '<button type="button" class="admin-btn-secondary admin-panel-close">Close</button>' +
      '</div></div>' +
      '<p class="admin-panel-note">Add, rename, or remove document fields below. "Stage" a file to preview it and get it pre-named correctly, then use "Download Staged Files" and drop the result into <code>documents/</code> over SFTP &mdash; the card goes live for everyone automatically once the real file is on the server.</p>' +
      '<div class="admin-panel-body"></div>' +
      '</div>';
    document.body.appendChild(panelOverlay);
    panelBody = panelOverlay.querySelector('.admin-panel-body');

    panelOverlay.addEventListener('click', function (e) { if (e.target === panelOverlay) closePanel(); });
    panelOverlay.querySelector('.admin-panel-close').addEventListener('click', closePanel);
    panelOverlay.querySelector('.admin-panel-logout').addEventListener('click', function () {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
      closePanel();
    });
    panelOverlay.querySelector('.admin-panel-download').addEventListener('click', downloadAllStaged);

    panelBody.addEventListener('click', handlePanelClick);
    panelBody.addEventListener('change', handlePanelChange);
  }
  function renderPanel() {
    var fields = getFields();
    panelBody.innerHTML = CATEGORY_ORDER.map(function (cat) {
      var rows = fields.filter(function (f) { return f.category === cat; }).map(function (f) {
        return '<div class="admin-field-row" data-field-id="' + escapeHTML(f.id) + '">' +
          '<input type="text" class="admin-field-name" value="' + escapeHTML(f.name) + '" />' +
          '<div class="admin-slug-wrap"><span class="admin-slug-prefix">documents/</span>' +
          '<input type="text" class="admin-field-slug" value="' + escapeHTML(f.fileSlug) + '" /></div>' +
          '<span class="admin-live-status checking" data-live-id="' + escapeHTML(f.id) + '">Checking&hellip;</span>' +
          '<label class="admin-upload-btn">' +
          (f.fileData ? '&#128196; ' + escapeHTML(f.fileName || 'staged') : 'Stage file') +
          '<input type="file" class="admin-file-input" hidden /></label>' +
          (f.fileData ? '<button type="button" class="admin-clear-file" title="Remove staged file">Clear</button>' : '') +
          (f.fileData ? '<button type="button" class="admin-download-field" title="Download this file, pre-named">&#8595;</button>' : '') +
          '<button type="button" class="admin-remove-field" title="Delete this field">&#10005;</button>' +
          '</div>';
      }).join('');
      return '<div class="admin-category">' +
        '<h4>' + CATEGORY_LABELS[cat] + '</h4>' +
        (rows || '<p class="admin-empty">No fields yet.</p>') +
        '<div class="admin-add-row">' +
        '<input type="text" class="admin-new-name" placeholder="New document name&hellip;" />' +
        '<button type="button" class="admin-add-field" data-cat="' + cat + '">+ Add field</button>' +
        '</div></div>';
    }).join('');
    fields.forEach(checkLiveInPanel);
  }
  function checkLiveInPanel(field) {
    var path = serverPathOf(field);
    fetch(path, { method: 'HEAD', cache: 'no-store' }).then(function (res) {
      var el = panelBody.querySelector('.admin-live-status[data-live-id="' + cssEscape(field.id) + '"]');
      if (!el) return;
      if (res && res.ok) { el.textContent = '\u2705 Live on server'; el.className = 'admin-live-status live'; }
      else { el.textContent = '\u2b1c Not on server yet'; el.className = 'admin-live-status not-live'; }
    }).catch(function () {
      var el = panelBody.querySelector('.admin-live-status[data-live-id="' + cssEscape(field.id) + '"]');
      if (el) { el.textContent = '\u2b1c Not on server yet'; el.className = 'admin-live-status not-live'; }
    });
  }
  function openPanel() {
    if (!panelOverlay) buildPanel();
    renderPanel();
    panelOverlay.classList.add('open');
  }
  function closePanel() { if (panelOverlay) panelOverlay.classList.remove('open'); }

  function fieldRowId(el) {
    var row = el.closest('.admin-field-row');
    return row ? row.getAttribute('data-field-id') : null;
  }
  function triggerFieldDownload(field) {
    if (!field.fileData) return;
    var a = document.createElement('a');
    a.href = field.fileData;
    a.download = basename(field.fileSlug);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  function downloadAllStaged() {
    var fields = getFields().filter(function (f) { return f.fileData; });
    if (!fields.length) { alert('Nothing staged yet — click "Stage file" on a field first, then download it here.'); return; }
    fields.forEach(function (f, i) { setTimeout(function () { triggerFieldDownload(f); }, i * 400); });
  }

  function handlePanelClick(e) {
    var addBtn = e.target.closest('.admin-add-field');
    if (addBtn) {
      var wrap = addBtn.closest('.admin-add-row');
      var input = wrap.querySelector('.admin-new-name');
      var name = input.value.trim();
      if (!name) { input.focus(); return; }
      var cat = addBtn.getAttribute('data-cat');
      var fields = getFields();
      fields.push({
        id: cat + '-' + Date.now(),
        category: cat, name: name, meta: 'PDF', icon: 'doc',
        fileSlug: slugify(name) + '.pdf',
        fileName: null, fileData: null
      });
      saveFields(fields);
      renderAll();
      renderPanel();
      return;
    }
    var removeBtn = e.target.closest('.admin-remove-field');
    if (removeBtn) {
      var id = fieldRowId(removeBtn);
      if (!confirm('Remove this document field? This cannot be undone.')) return;
      saveFields(getFields().filter(function (f) { return f.id !== id; }));
      renderAll();
      renderPanel();
      return;
    }
    var clearBtn = e.target.closest('.admin-clear-file');
    if (clearBtn) {
      var id2 = fieldRowId(clearBtn);
      var fields3 = getFields();
      fields3.forEach(function (f) { if (f.id === id2) { f.fileData = null; f.fileName = null; } });
      saveFields(fields3);
      renderPanel();
      return;
    }
    var downloadBtn = e.target.closest('.admin-download-field');
    if (downloadBtn) {
      var id3 = fieldRowId(downloadBtn);
      var field = getFields().filter(function (f) { return f.id === id3; })[0];
      if (field) triggerFieldDownload(field);
      return;
    }
  }

  function handlePanelChange(e) {
    if (e.target.classList.contains('admin-field-name')) {
      var id = fieldRowId(e.target);
      var fields = getFields();
      fields.forEach(function (f) { if (f.id === id) f.name = e.target.value.trim() || f.name; });
      saveFields(fields);
      renderAll();
      return;
    }
    if (e.target.classList.contains('admin-field-slug')) {
      var id4 = fieldRowId(e.target);
      var fields4 = getFields();
      fields4.forEach(function (f) { if (f.id === id4) f.fileSlug = sanitizeFileSlug(e.target.value); });
      saveFields(fields4);
      e.target.value = fields4.filter(function (f) { return f.id === id4; })[0].fileSlug;
      renderAll();
      var el = panelBody.querySelector('.admin-live-status[data-live-id="' + cssEscape(id4) + '"]');
      if (el) { el.textContent = 'Checking\u2026'; el.className = 'admin-live-status checking'; }
      fields4.filter(function (f) { return f.id === id4; }).forEach(checkLiveInPanel);
      return;
    }
    if (e.target.classList.contains('admin-file-input')) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var id2 = fieldRowId(e.target);
      var reader = new FileReader();
      reader.onload = function () {
        var fields = getFields();
        fields.forEach(function (f) {
          if (f.id === id2) {
            f.fileData = reader.result;
            f.fileName = file.name;
            // if the slug still looks auto-generated, line its extension up with what was staged
            var ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.pdf'])[0].toLowerCase();
            if (!/\.[a-z0-9]+$/i.test(f.fileSlug)) f.fileSlug = sanitizeFileSlug(f.fileSlug) + ext;
          }
        });
        saveFields(fields);
        renderPanel();
      };
      reader.onerror = function () { alert('Could not read that file.'); };
      reader.readAsDataURL(file);
      return;
    }
  }

  /* ── boot ────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    renderAll();
    injectTrigger();
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') { buildPanel(); openPanel(); }
    } catch (e) {}
  });
})();
