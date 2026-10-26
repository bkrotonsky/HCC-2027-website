/* ================================================================
   ADMIN.JS - Document cards, access gate, and hidden document manager

   What this does
   1. Renders every document card on documents.html. Each card links to
      its PDF at documents/<file>.pdf (placeholder PDFs ship with the site;
      replace a placeholder by uploading a real file with the same name).
   2. Covers every card with a "No Access" overlay until an admin logs in.
      Click the invisible bubble in the bottom-left corner of any page,
      then enter the admin login. The unlocked state lasts for the browser
      tab session.
   3. Once unlocked, a small "Admin" bar appears bottom-left with a manager
      for renaming documents and staging files pre-named for SFTP upload.

   NOTE: this is a client-side gate for a static site. It hides the cards,
   but it cannot truly protect the PDF files. For real protection, restrict
   the documents/ folder on the server.

   Login: admin@HCC / HCC2027
   ================================================================ */
(function () {
  'use strict';

  var ADMIN_USER = 'admin@HCC';
  var ADMIN_PASS = 'HCC2027';
  var STORAGE_KEY = 'hcc27_documents_v3';
  var SESSION_KEY = 'hcc27_admin_session';

  /* Documents (same list as the HCC26 capstone documentation page) */
  var DEFAULT_FIELDS = [
    { name: 'Presentation 1', desc: 'Our first capstone presentation, covering our approach to the HCC27 project.' },
    { name: 'Presentation 2', desc: 'Concept selection and concept generation for site selection.' },
    { name: 'Report 1', desc: 'Project background and the different aspects of site selection.' },
    { name: 'Presentation 3', desc: 'A deeper look at site selection and the final site choice.' },
    { name: '1st Prototype Demo', desc: 'A first prototype of the dam structure to understand how placement will work.' },
    { name: '2nd Prototype Demo', desc: 'A makeshift turbine prototype to understand its structure and implementation.' },
    { name: 'Project Management', desc: 'Regrouping and planning for the new semester ahead of the competition.' },
    { name: 'Report 2', desc: 'A detailed analysis of the chosen site.' },
    { name: 'Engineering Calculation Summary', desc: 'All engineering calculations and analyses compiled into one overview.' },
    { name: '33% Build', desc: 'Work to date, with parts purchased and assembled for each build.' },
    { name: '67% Build', desc: 'Build progress update at the 67% milestone.' },
    { name: '100% Build', desc: 'Final build update at the 100% milestone.' },
    { name: 'Final Testing Plan', desc: 'The plan for how our design will be tested.' },
    { name: 'Initial Testing Results', desc: 'Results from the first round of testing.' },
    { name: 'Final Testing Results', desc: 'Results from final testing.' },
    { name: 'Final Capstone Report', desc: 'The complete capstone report for the project.' },
    { name: 'Siting and Design Final Report', desc: 'The final report for the siting and design challenges.' },
    { name: 'Community Connections Final Report', desc: 'The final report for the community connections challenge.' }
  ].map(function (d, i) {
    return { id: 'doc-' + (i + 1), name: d.name, desc: d.desc, meta: 'PDF', fileSlug: slugify(d.name) + '.pdf' };
  });

  /* helpers */
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
  function serverPathOf(field) { return 'documents/' + field.fileSlug; }
  function isUnlocked() {
    try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; }
  }
  var DOC_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>';
  var LOCK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>';

  /* PDF page-1 thumbnails (only generated after unlock) */
  var THUMB_CACHE = {};
  function pdfJsAvailable() { return typeof window.pdfjsLib !== 'undefined'; }
  if (pdfJsAvailable()) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  function generatePdfThumbnail(path) {
    if (THUMB_CACHE[path]) return THUMB_CACHE[path];
    if (!pdfJsAvailable() || !/\.pdf($|[?#])/i.test(path)) return Promise.resolve(null);
    var promise = window.pdfjsLib.getDocument(path).promise
      .then(function (pdf) { return pdf.getPage(1); })
      .then(function (page) {
        var base = page.getViewport({ scale: 1 });
        var viewport = page.getViewport({ scale: 640 / base.width });
        var canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise
          .then(function () { return canvas.toDataURL('image/jpeg', 0.85); });
      })
      .catch(function () { return null; });
    THUMB_CACHE[path] = promise;
    return promise;
  }
  function attachThumbnail(field) {
    generatePdfThumbnail(serverPathOf(field)).then(function (dataUrl) {
      if (!dataUrl || !isUnlocked()) return;
      document.querySelectorAll('.doc-preview[data-preview-id="' + field.id + '"]').forEach(function (el) {
        el.innerHTML = '<img src="' + dataUrl + '" alt="' + escapeHTML(field.name) + ' page 1 preview" loading="lazy" />';
      });
    });
  }

  /* storage */
  function getFields() {
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (!raw) {
      return DEFAULT_FIELDS.map(function (f) { return Object.assign({ fileName: null, fileData: null }, f); });
    }
    var fields;
    try { fields = JSON.parse(raw); } catch (e) { fields = []; }
    fields.forEach(function (f) { if (!f.fileSlug) f.fileSlug = slugify(f.name) + '.pdf'; });
    return fields;
  }
  function saveFields(fields) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fields)); }
    catch (e) {
      alert('Could not save: ' + (e && e.message ? e.message : 'storage error') +
        '\nThis usually means a staged file is too large for browser storage.');
    }
  }

  /* public rendering */
  function renderCard(field) {
    return '<a class="doc-card" data-field-id="' + escapeHTML(field.id) + '" data-href="' + escapeHTML(serverPathOf(field)) + '" target="_blank" rel="noopener">' +
      '<div class="doc-preview" data-preview-id="' + escapeHTML(field.id) + '"><div class="doc-preview-placeholder">' + DOC_ICON + '</div></div>' +
      '<div class="doc-card-body">' +
      '<div class="doc-icon">' + DOC_ICON + '</div>' +
      '<div class="doc-info"><p class="doc-name">' + escapeHTML(field.name) + '</p>' +
      '<p class="doc-meta">' + escapeHTML(field.desc || '') + '</p></div>' +
      '</div>' +
      '<div class="doc-lock" aria-hidden="true">' + LOCK_ICON + '<b>No Access</b><small>Team members only</small></div>' +
      '</a>';
  }
  function renderAll() {
    var list = document.querySelector('[data-doc-list]');
    if (list) {
      var fields = getFields();
      list.innerHTML = fields.length ? fields.map(renderCard).join('') :
        '<p class="doc-empty">No documents added yet.</p>';
    }
    applyState();
  }

  /* lock / unlock */
  function applyState() {
    var open = isUnlocked();
    document.body.classList.toggle('docs-unlocked', open);
    document.querySelectorAll('.doc-card').forEach(function (a) {
      if (open) {
        a.setAttribute('href', a.getAttribute('data-href'));
        a.removeAttribute('tabindex');
        a.removeAttribute('aria-disabled');
      } else {
        a.removeAttribute('href');
        a.setAttribute('tabindex', '-1');
        a.setAttribute('aria-disabled', 'true');
      }
    });
    if (open) getFields().forEach(attachThumbnail);
  }
  function unlock() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}
    applyState();
  }
  function lock() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    closePanel();
    renderAll(); // re-render so any generated previews are discarded
  }

  /* hidden trigger (bottom-left bubble) */
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

  /* admin bar (visible only while unlocked) */
  function buildDock() {
    var dock = document.createElement('div');
    dock.className = 'admin-dock';
    dock.innerHTML =
      '<span class="admin-dock-label">Admin</span>' +
      '<button type="button" class="admin-btn-secondary admin-dock-manage">Manage documents</button>' +
      '<button type="button" class="admin-btn-secondary admin-dock-lock">Lock</button>';
    document.body.appendChild(dock);
    dock.querySelector('.admin-dock-manage').addEventListener('click', openPanel);
    dock.querySelector('.admin-dock-lock').addEventListener('click', lock);
  }

  /* login modal */
  var loginOverlay;
  function buildLogin() {
    loginOverlay = document.createElement('div');
    loginOverlay.className = 'admin-overlay';
    loginOverlay.innerHTML =
      '<div class="admin-modal">' +
      '<h3>Admin Login</h3>' +
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
      closeLogin();
      unlock();
    } else {
      loginOverlay.querySelector('.admin-error').hidden = false;
    }
  }

  /* document manager panel */
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
      '<button type="button" class="admin-btn-secondary admin-panel-close">Close</button>' +
      '</div></div>' +
      '<p class="admin-panel-note">Rename documents or change the file each card points to. "Stage" a file to get it pre-named correctly, then use "Download Staged Files" and upload the result to <code>documents/</code> over SFTP, replacing the placeholder PDF of the same name. Changes made here are saved in this browser only.</p>' +
      '<div class="admin-panel-body"></div>' +
      '</div>';
    document.body.appendChild(panelOverlay);
    panelBody = panelOverlay.querySelector('.admin-panel-body');

    panelOverlay.addEventListener('click', function (e) { if (e.target === panelOverlay) closePanel(); });
    panelOverlay.querySelector('.admin-panel-close').addEventListener('click', closePanel);
    panelOverlay.querySelector('.admin-panel-download').addEventListener('click', downloadAllStaged);
    panelBody.addEventListener('click', handlePanelClick);
    panelBody.addEventListener('change', handlePanelChange);
  }
  function renderPanel() {
    var rows = getFields().map(function (f) {
      return '<div class="admin-field-row" data-field-id="' + escapeHTML(f.id) + '">' +
        '<input type="text" class="admin-field-name" value="' + escapeHTML(f.name) + '" />' +
        '<div class="admin-slug-wrap"><span class="admin-slug-prefix">documents/</span>' +
        '<input type="text" class="admin-field-slug" value="' + escapeHTML(f.fileSlug) + '" /></div>' +
        '<label class="admin-upload-btn">' +
        (f.fileData ? '&#128196; ' + escapeHTML(f.fileName || 'staged') : 'Stage file') +
        '<input type="file" class="admin-file-input" hidden /></label>' +
        (f.fileData ? '<button type="button" class="admin-clear-file" title="Remove staged file">Clear</button>' : '') +
        (f.fileData ? '<button type="button" class="admin-download-field" title="Download this file, pre-named">&#8595;</button>' : '') +
        '<button type="button" class="admin-remove-field" title="Delete this field">&#10005;</button>' +
        '</div>';
    }).join('');
    panelBody.innerHTML =
      '<div class="admin-category">' + (rows || '<p class="admin-empty">No documents yet.</p>') +
      '<div class="admin-add-row">' +
      '<input type="text" class="admin-new-name" placeholder="New document name&hellip;" />' +
      '<button type="button" class="admin-add-field">+ Add document</button>' +
      '</div></div>';
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
    var staged = getFields().filter(function (f) { return f.fileData; });
    if (!staged.length) { alert('Nothing staged yet. Click "Stage file" on a document first, then download it here.'); return; }
    staged.forEach(function (f, i) { setTimeout(function () { triggerFieldDownload(f); }, i * 400); });
  }

  function handlePanelClick(e) {
    var addBtn = e.target.closest('.admin-add-field');
    if (addBtn) {
      var input = addBtn.closest('.admin-add-row').querySelector('.admin-new-name');
      var name = input.value.trim();
      if (!name) { input.focus(); return; }
      var fields = getFields();
      fields.push({
        id: 'doc-' + Date.now(),
        name: name, desc: '', meta: 'PDF',
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
      if (!confirm('Remove this document? This cannot be undone.')) return;
      saveFields(getFields().filter(function (f) { return f.id !== id; }));
      renderAll();
      renderPanel();
      return;
    }
    var clearBtn = e.target.closest('.admin-clear-file');
    if (clearBtn) {
      var id2 = fieldRowId(clearBtn);
      var fields2 = getFields();
      fields2.forEach(function (f) { if (f.id === id2) { f.fileData = null; f.fileName = null; } });
      saveFields(fields2);
      renderPanel();
      return;
    }
    var downloadBtn = e.target.closest('.admin-download-field');
    if (downloadBtn) {
      var id3 = fieldRowId(downloadBtn);
      var field = getFields().filter(function (f) { return f.id === id3; })[0];
      if (field) triggerFieldDownload(field);
    }
  }

  function handlePanelChange(e) {
    var t = e.target;
    var id = fieldRowId(t);
    if (!id) return;
    var fields = getFields();
    if (t.classList.contains('admin-field-name')) {
      fields.forEach(function (f) { if (f.id === id) f.name = t.value.trim() || f.name; });
      saveFields(fields);
      renderAll();
      return;
    }
    if (t.classList.contains('admin-field-slug')) {
      fields.forEach(function (f) { if (f.id === id) f.fileSlug = sanitizeFileSlug(t.value); });
      saveFields(fields);
      t.value = fields.filter(function (f) { return f.id === id; })[0].fileSlug;
      renderAll();
      return;
    }
    if (t.classList.contains('admin-file-input')) {
      var file = t.files && t.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var current = getFields();
        current.forEach(function (f) {
          if (f.id === id) {
            f.fileData = reader.result;
            f.fileName = file.name;
            var ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.pdf'])[0].toLowerCase();
            if (!/\.[a-z0-9]+$/i.test(f.fileSlug)) f.fileSlug = sanitizeFileSlug(f.fileSlug) + ext;
          }
        });
        saveFields(current);
        renderPanel();
      };
      reader.onerror = function () { alert('Could not read that file.'); };
      reader.readAsDataURL(file);
    }
  }

  /* boot */
  document.addEventListener('DOMContentLoaded', function () {
    injectTrigger();
    buildDock();
    renderAll();
  });
})();
