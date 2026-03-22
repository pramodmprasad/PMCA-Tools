(function () {
  'use strict';

  var FILE_EXT = '.fsjson';
  var STORAGE_KEY = 'pmca-fs-draft-v1';

  var ctx = {
    userId: '',
    username: '',
    staffName: '',
    role: ''
  };

  var state = {
    entityType: 'corporate',
    entityName: '',
    cin: '',
    pan: '',
    periodFrom: '',
    periodTo: '',
    ieMode: false,
    assets: [],
    liabilities: [],
    plLines: [],
    notes: '',
    finalised: false,
    finalisedAt: '',
    finalisedByUserId: '',
    finalisedByStaffName: '',
    auditLog: []
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function isLocked() {
    return !!state.finalised;
  }

  function isAdminCtx() {
    return ctx.role === 'admin';
  }

  function canUnfinalise() {
    if (!state.finalised) return false;
    if (isAdminCtx()) return true;
    if (ctx.userId && state.finalisedByUserId && ctx.userId === state.finalisedByUserId) return true;
    return false;
  }

  function canFinalise() {
    return !state.finalised && !!ctx.userId;
  }

  function parseAmount(s) {
    if (s == null || s === '') return 0;
    var t = String(s).replace(/,/g, '').trim();
    var n = parseFloat(t);
    return isNaN(n) ? 0 : n;
  }

  function formatINR(n) {
    if (n == null || isNaN(n)) return '';
    return Number(n).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function uid() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function appendAudit(action) {
    if (!state.auditLog) state.auditLog = [];
    var entry = {
      at: new Date().toISOString(),
      action: action,
      userId: ctx.userId || '',
      username: ctx.username || '',
      staffName: ctx.staffName || '',
      role: ctx.role || ''
    };
    state.auditLog.push(entry);
    if (state.auditLog.length > 200) state.auditLog = state.auditLog.slice(-200);
  }

  function migrateFromFile(o) {
    state.auditLog = Array.isArray(o.auditLog) ? o.auditLog : [];
    state.finalised = !!o.finalised;
    state.finalisedAt = o.finalisedAt || '';
    state.finalisedByUserId = o.finalisedByUserId || '';
    state.finalisedByStaffName = o.finalisedByStaffName || '';
  }

  function corporateDefaults() {
    return {
      assets: [
        { id: uid(), name: 'Property, plant and equipment', amount: '' },
        { id: uid(), name: 'Capital work-in-progress', amount: '' },
        { id: uid(), name: 'Intangible assets', amount: '' },
        { id: uid(), name: 'Financial assets', amount: '' },
        { id: uid(), name: 'Other non-current assets', amount: '' },
        { id: uid(), name: 'Inventories', amount: '' },
        { id: uid(), name: 'Trade receivables', amount: '' },
        { id: uid(), name: 'Cash and cash equivalents', amount: '' },
        { id: uid(), name: 'Other current assets', amount: '' }
      ],
      liabilities: [
        { id: uid(), name: 'Equity share capital', amount: '' },
        { id: uid(), name: 'Other equity', amount: '' },
        { id: uid(), name: 'Long-term borrowings', amount: '' },
        { id: uid(), name: 'Deferred tax liabilities (net)', amount: '' },
        { id: uid(), name: 'Long-term provisions', amount: '' },
        { id: uid(), name: 'Short-term borrowings', amount: '' },
        { id: uid(), name: 'Trade payables', amount: '' },
        { id: uid(), name: 'Other current liabilities', amount: '' },
        { id: uid(), name: 'Short-term provisions', amount: '' }
      ],
      plLines: [
        { id: uid(), name: 'Revenue from operations', amount: '' },
        { id: uid(), name: 'Other income', amount: '' },
        { id: uid(), name: 'Cost of materials consumed', amount: '' },
        { id: uid(), name: 'Employee benefits expense', amount: '' },
        { id: uid(), name: 'Finance costs', amount: '' },
        { id: uid(), name: 'Depreciation and amortisation', amount: '' },
        { id: uid(), name: 'Other expenses', amount: '' },
        { id: uid(), name: 'Tax expense', amount: '' }
      ]
    };
  }

  function nonCorporateDefaults() {
    return {
      assets: [
        { id: uid(), name: 'Fixed assets (net block)', amount: '' },
        { id: uid(), name: 'Investments', amount: '' },
        { id: uid(), name: 'Loans and advances', amount: '' },
        { id: uid(), name: 'Inventories', amount: '' },
        { id: uid(), name: 'Trade receivables', amount: '' },
        { id: uid(), name: 'Cash and bank balances', amount: '' },
        { id: uid(), name: 'Other current assets', amount: '' }
      ],
      liabilities: [
        { id: uid(), name: 'Capital / partners\' capital', amount: '' },
        { id: uid(), name: 'Reserves and surplus', amount: '' },
        { id: uid(), name: 'Long-term borrowings', amount: '' },
        { id: uid(), name: 'Current liabilities', amount: '' },
        { id: uid(), name: 'Provisions', amount: '' }
      ],
      plLines: [
        { id: uid(), name: 'Revenue / receipts', amount: '' },
        { id: uid(), name: 'Other income', amount: '' },
        { id: uid(), name: 'Cost of goods / services', amount: '' },
        { id: uid(), name: 'Employee expenses', amount: '' },
        { id: uid(), name: 'Finance charges', amount: '' },
        { id: uid(), name: 'Depreciation', amount: '' },
        { id: uid(), name: 'Other expenses', amount: '' },
        { id: uid(), name: 'Tax', amount: '' }
      ]
    };
  }

  function applyEntityDefaults() {
    var d =
      state.entityType === 'corporate' ? corporateDefaults() : nonCorporateDefaults();
    state.assets = d.assets;
    state.liabilities = d.liabilities;
    state.plLines = d.plLines;
  }

  function updateStaffDisplay() {
    var el = byId('fs-staff-display');
    var hint = byId('fs-login-hint');
    if (!el) return;
    if (ctx.userId) {
      var label = ctx.staffName || ctx.username || ctx.userId;
      el.textContent =
        'User: ' + label + (ctx.role === 'admin' ? ' (Admin)' : '');
      if (hint) hint.style.display = 'none';
    } else {
      el.textContent = 'User: —';
      if (hint) hint.style.display = 'block';
    }
  }

  function updateFinaliseUi() {
    var btnF = byId('btn-finalise');
    var btnU = byId('btn-unfinalise');
    var ban = byId('fs-finalised-banner');
    if (!btnF || !btnU || !ban) return;

    if (state.finalised) {
      ban.style.display = 'block';
      var who = state.finalisedByStaffName || state.finalisedByUserId || '—';
      var when = state.finalisedAt
        ? new Date(state.finalisedAt).toLocaleString('en-IN', { hour12: true })
        : '';
      ban.textContent =
        'Finalised — editing is locked. Finalised by ' + who + (when ? ' · ' + when : '') + '.';
      btnF.style.display = 'none';
      btnU.style.display = canUnfinalise() ? 'inline-flex' : 'none';
    } else {
      ban.style.display = 'none';
      btnF.style.display = 'inline-flex';
      btnU.style.display = 'none';
      btnF.disabled = !canFinalise();
      btnF.title = canFinalise()
        ? 'Lock this working paper — only an admin or you can unlock later'
        : 'Sign in from PMCA Tools to finalise';
    }
  }

  function renderAuditLog() {
    var body = byId('audit-log-body');
    if (!body) return;
    var log = state.auditLog || [];
    if (log.length === 0) {
      body.innerHTML = '<p class="hint">No entries yet.</p>';
      return;
    }
    var rows = log
      .slice()
      .reverse()
      .slice(0, 50)
      .map(function (e) {
        var t = e.at ? new Date(e.at).toLocaleString('en-IN', { hour12: true }) : '';
        var who = e.staffName || e.username || e.userId || '—';
        var act = e.action || '';
        return (
          '<tr><td>' +
          escapeHtml(t) +
          '</td><td>' +
          escapeHtml(act) +
          '</td><td>' +
          escapeHtml(who) +
          '</td><td>' +
          escapeHtml(e.role || '') +
          '</td></tr>'
        );
      })
      .join('');
    body.innerHTML =
      '<table class="fs-table"><thead><tr><th>When</th><th>Action</th><th>User</th><th>Role</th></tr></thead><tbody>' +
      rows +
      '</tbody></table>';
  }

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    var d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  function applyLockedState() {
    var locked = isLocked();
    var main = byId('fs-main');
    if (!main) return;
    var controls = main.querySelectorAll(
      'input, textarea, select, button'
    );
    for (var i = 0; i < controls.length; i++) {
      var c = controls[i];
      if (c.id === 'btn-print') continue;
      if (c.id === 'btn-save-file') continue;
      if (c.id === 'btn-load-file') continue;
      if (c.id === 'btn-unfinalise') continue;
      c.disabled = locked;
    }
    var tb = byId('btn-finalise');
    if (tb) tb.disabled = locked || !canFinalise();
    updateFinaliseUi();
  }

  function syncFormFields() {
    byId('entity-name').value = state.entityName;
    byId('cin').value = state.cin;
    byId('pan').value = state.pan;
    byId('period-from').value = state.periodFrom;
    byId('period-to').value = state.periodTo;
    byId('notes-text').value = state.notes;
    byId('ie-mode').checked = !!state.ieMode;

    var corp = state.entityType === 'corporate';
    byId('entity-corp').checked = corp;
    byId('entity-noncorp').checked = !corp;

    var cinEls = document.querySelectorAll('.corp-only-field');
    for (var i = 0; i < cinEls.length; i++) {
      if (corp) cinEls[i].classList.add('visible');
      else cinEls[i].classList.remove('visible');
    }

    var np = document.querySelectorAll('.nonprofit-only');
    for (var j = 0; j < np.length; j++) {
      if (!corp) np[j].classList.add('visible');
      else np[j].classList.remove('visible');
    }

    byId('pl-title-display').textContent = plTitle();
    renderTables();
    updateStaffDisplay();
    renderAuditLog();
    applyLockedState();
  }

  function plTitle() {
    if (state.entityType === 'corporate') return 'Statement of Profit and Loss';
    if (state.ieMode) return 'Income and Expenditure Account';
    return 'Profit and Loss Account';
  }

  function collectForm() {
    state.entityName = byId('entity-name').value.trim();
    state.cin = byId('cin').value.trim();
    state.pan = byId('pan').value.trim();
    state.periodFrom = byId('period-from').value;
    state.periodTo = byId('period-to').value;
    state.notes = byId('notes-text').value;
    state.ieMode = byId('ie-mode').checked;
  }

  function rowHtml(rows, key) {
    var tbody = '';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      tbody +=
        '<tr data-id="' +
        r.id +
        '">' +
        '<td><input type="text" class="line-name" data-key="' +
        key +
        '" data-id="' +
        r.id +
        '" value="' +
        escapeAttr(r.name) +
        '" /></td>' +
        '<td class="num"><input type="text" class="line-amt" inputmode="decimal" data-key="' +
        key +
        '" data-id="' +
        r.id +
        '" value="' +
        escapeAttr(r.amount) +
        '" placeholder="0" /></td>' +
        '</tr>';
    }
    return tbody;
  }

  function escapeAttr(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function sumLines(rows) {
    var t = 0;
    for (var i = 0; i < rows.length; i++) {
      t += parseAmount(rows[i].amount);
    }
    return t;
  }

  function getRows(key) {
    if (key === 'assets') return state.assets;
    if (key === 'liabilities') return state.liabilities;
    return state.plLines;
  }

  function setRows(key, rows) {
    if (key === 'assets') state.assets = rows;
    else if (key === 'liabilities') state.liabilities = rows;
    else state.plLines = rows;
  }

  function renderTables() {
    byId('tbody-assets').innerHTML = rowHtml(state.assets, 'assets');
    byId('tbody-liab').innerHTML = rowHtml(state.liabilities, 'liabilities');
    byId('tbody-pl').innerHTML = rowHtml(state.plLines, 'plLines');

    byId('total-assets').textContent = formatINR(sumLines(state.assets));
    byId('total-liab').textContent = formatINR(sumLines(state.liabilities));
    var plNet = computePlNet();
    byId('total-pl-net').textContent = formatINR(plNet);
    byId('pl-net-label').textContent =
      state.entityType === 'corporate'
        ? 'Profit / (loss) for the period'
        : state.ieMode
          ? 'Surplus / (deficit)'
          : 'Net profit / (loss)';

    bindTableInputs();
    applyLockedState();
  }

  function computePlNet() {
    var lines = state.plLines;
    if (lines.length === 0) return 0;
    var t = 0;
    for (var i = 0; i < lines.length; i++) {
      t += parseAmount(lines[i].amount);
    }
    return t;
  }

  function bindTableInputs() {
    var inputs = document.querySelectorAll('.line-name, .line-amt');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].onchange = onLineChange;
      inputs[i].onblur = onLineChange;
    }
  }

  function updateTotalsOnly() {
    byId('total-assets').textContent = formatINR(sumLines(state.assets));
    byId('total-liab').textContent = formatINR(sumLines(state.liabilities));
    byId('total-pl-net').textContent = formatINR(computePlNet());
  }

  function onLineChange(e) {
    if (isLocked()) return;
    var el = e.target;
    var key = el.getAttribute('data-key');
    var id = el.getAttribute('data-id');
    var rows = getRows(key).slice();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === id) {
        if (el.classList.contains('line-name')) rows[i].name = el.value;
        else rows[i].amount = el.value;
        break;
      }
    }
    setRows(key, rows);
    updateTotalsOnly();
    autoSave();
  }

  function addRow(key) {
    if (isLocked()) return;
    collectForm();
    var rows = getRows(key).slice();
    rows.push({ id: uid(), name: '', amount: '' });
    setRows(key, rows);
    renderTables();
  }

  function removeLastRow(key) {
    if (isLocked()) return;
    collectForm();
    var rows = getRows(key).slice();
    if (rows.length <= 1) return;
    rows.pop();
    setRows(key, rows);
    renderTables();
  }

  function toJSON() {
    collectForm();
    return JSON.stringify(
      {
        version: 2,
        savedAt: new Date().toISOString(),
        entityType: state.entityType,
        entityName: state.entityName,
        cin: state.cin,
        pan: state.pan,
        periodFrom: state.periodFrom,
        periodTo: state.periodTo,
        ieMode: state.ieMode,
        assets: state.assets,
        liabilities: state.liabilities,
        plLines: state.plLines,
        notes: state.notes,
        finalised: state.finalised,
        finalisedAt: state.finalisedAt,
        finalisedByUserId: state.finalisedByUserId,
        finalisedByStaffName: state.finalisedByStaffName,
        auditLog: state.auditLog || []
      },
      null,
      2
    );
  }

  function fromJSON(text) {
    var o = JSON.parse(text);
    state.entityType = o.entityType === 'noncorporate' ? 'noncorporate' : 'corporate';
    state.entityName = o.entityName || '';
    state.cin = o.cin || '';
    state.pan = o.pan || '';
    state.periodFrom = o.periodFrom || '';
    state.periodTo = o.periodTo || '';
    state.ieMode = !!o.ieMode;
    state.assets = Array.isArray(o.assets) ? o.assets : [];
    state.liabilities = Array.isArray(o.liabilities) ? o.liabilities : [];
    state.plLines = Array.isArray(o.plLines) ? o.plLines : [];
    state.notes = o.notes || '';
    migrateFromFile(o);
    if (!state.assets.length && !state.liabilities.length && !state.plLines.length) {
      applyEntityDefaults();
    }
  }

  function saveFile() {
    collectForm();
    if (ctx.userId) appendAudit('save');
    var blob = new Blob([toJSON()], { type: 'application/json;charset=utf-8' });
    var a = document.createElement('a');
    var base = (state.entityName || 'financial-statements').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60);
    a.href = URL.createObjectURL(blob);
    a.download = base + FILE_EXT;
    a.click();
    URL.revokeObjectURL(a.href);
    autoSave();
    renderAuditLog();
  }

  function doFinalise() {
    if (!canFinalise()) {
      alert('Sign in from PMCA Tools (main app) to finalise.');
      return;
    }
    if (!confirm('Finalise this financial statement? Editing will be locked until an admin or you unlock it.')) return;
    collectForm();
    state.finalised = true;
    state.finalisedAt = new Date().toISOString();
    state.finalisedByUserId = ctx.userId;
    state.finalisedByStaffName = ctx.staffName || ctx.username || ctx.userId;
    appendAudit('finalise');
    autoSave();
    syncFormFields();
  }

  function doUnfinalise() {
    if (!canUnfinalise()) {
      alert('Only an administrator or the user who finalised can unfinalise.');
      return;
    }
    if (!confirm('Unfinalise and allow editing again?')) return;
    collectForm();
    state.finalised = false;
    state.finalisedAt = '';
    state.finalisedByUserId = '';
    state.finalisedByStaffName = '';
    appendAudit('unfinalise');
    autoSave();
    syncFormFields();
  }

  function loadFile() {
    byId('file-input').click();
  }

  function onFileSelected(e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        fromJSON(reader.result);
        syncFormFields();
        try {
          localStorage.setItem(STORAGE_KEY, toJSON());
        } catch (err) { /* ignore */ }
      } catch (err) {
        alert('Could not read file. Use a valid ' + FILE_EXT + ' saved from this tool.');
      }
    };
    reader.readAsText(f);
  }

  function autoSave() {
    collectForm();
    try {
      localStorage.setItem(STORAGE_KEY, toJSON());
    } catch (e) { /* ignore */ }
  }

  function persistDraft() {
    if (isLocked()) return;
    autoSave();
  }

  function tryLoadDraft() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        fromJSON(raw);
        syncFormFields();
      }
    } catch (e) { /* ignore */ }
  }

  function printView() {
    collectForm();
    var ph = byId('print-entity-block');
    ph.innerHTML =
      '<h1>' +
      escapeHtml(state.entityName || 'Entity name') +
      '</h1>' +
      '<p><strong>' +
      (state.entityType === 'corporate' ? 'Corporate' : 'Non-corporate') +
      '</strong>' +
      (state.entityType === 'corporate' && state.cin ? ' · CIN ' + escapeHtml(state.cin) : '') +
      (state.pan ? ' · PAN ' + escapeHtml(state.pan) : '') +
      '</p>' +
      '<p>Period: ' +
      escapeHtml(state.periodFrom || '—') +
      ' to ' +
      escapeHtml(state.periodTo || '—') +
      '</p>';
    window.print();
  }

  function resetWithConfirm() {
    if (isLocked()) {
      alert('This statement is finalised. Unfinalise first to reset line items.');
      return;
    }
    if (!confirm('Reset to default line items for the selected entity type? Unsaved data in this form will be replaced.')) return;
    collectForm();
    applyEntityDefaults();
    state.notes = '';
    syncFormFields();
    persistDraft();
  }

  function applyUserPayload(data) {
    if (!data || typeof data !== 'object') return;
    ctx.userId = data.userId != null ? String(data.userId) : '';
    ctx.username = data.username != null ? String(data.username) : '';
    ctx.staffName =
      data.staffName != null && String(data.staffName).trim()
        ? String(data.staffName).trim()
        : '';
    ctx.role = data.role != null ? String(data.role) : '';
    updateStaffDisplay();
    updateFinaliseUi();
  }

  function pullUserFromParent() {
    try {
      if (window.parent && window.parent !== window) {
        var u = window.parent.currentUser;
        if (u && u.id) {
          applyUserPayload({
            userId: u.id,
            username: u.username || '',
            staffName: u.name || u.username || '',
            role: u.role || 'user'
          });
          return;
        }
      }
    } catch (e) { /* ignore */ }
  }

  window.addEventListener('message', function (e) {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'financial-statements-user') {
      applyUserPayload(e.data);
    }
    if (e.data.type === 'financial-statements-clear-user') {
      ctx.userId = '';
      ctx.username = '';
      ctx.staffName = '';
      ctx.role = '';
      updateStaffDisplay();
      updateFinaliseUi();
    }
  });

  function init() {
    applyEntityDefaults();
    var today = new Date();
    var m = today.getMonth();
    var y = today.getFullYear();
    if (m < 3) {
      state.periodFrom = y - 1 + '-04-01';
      state.periodTo = y + '-03-31';
    } else {
      state.periodFrom = y + '-04-01';
      state.periodTo = y + 1 + '-03-31';
    }

    tryLoadDraft();
    if (!localStorage.getItem(STORAGE_KEY)) {
      syncFormFields();
    }

    pullUserFromParent();
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'financial-statements-ready' }, '*');
      }
    } catch (err) { /* ignore */ }

    function switchEntityType(newType) {
      if (isLocked()) {
        alert('Unfinalise before changing entity type.');
        return;
      }
      if (state.entityType === newType) return;
      if (
        !confirm(
          'Changing entity type replaces all line items with the default template for that type. Continue?'
        )
      ) {
        if (newType === 'corporate') {
          byId('entity-corp').checked = true;
          byId('entity-noncorp').checked = false;
        } else {
          byId('entity-noncorp').checked = true;
          byId('entity-corp').checked = false;
        }
        return;
      }
      state.entityType = newType;
      if (newType === 'corporate') {
        state.ieMode = false;
      }
      applyEntityDefaults();
      syncFormFields();
      persistDraft();
    }

    byId('entity-corp').onchange = function () {
      if (byId('entity-corp').checked) switchEntityType('corporate');
    };
    byId('entity-noncorp').onchange = function () {
      if (byId('entity-noncorp').checked) switchEntityType('noncorporate');
    };
    byId('ie-mode').onchange = function () {
      if (isLocked()) return;
      state.ieMode = byId('ie-mode').checked;
      syncFormFields();
      persistDraft();
    };

    ['entity-name', 'cin', 'pan', 'period-from', 'period-to', 'notes-text'].forEach(function (id) {
      var el = byId(id);
      if (el) el.addEventListener('input', persistDraft);
    });

    byId('btn-save-file').onclick = saveFile;
    byId('btn-load-file').onclick = loadFile;
    byId('file-input').onchange = onFileSelected;
    byId('btn-print').onclick = printView;
    byId('btn-reset-template').onclick = resetWithConfirm;
    byId('btn-finalise').onclick = doFinalise;
    byId('btn-unfinalise').onclick = doUnfinalise;

    byId('add-asset').onclick = function () {
      addRow('assets');
    };
    byId('remove-asset').onclick = function () {
      removeLastRow('assets');
    };
    byId('add-liab').onclick = function () {
      addRow('liabilities');
    };
    byId('remove-liab').onclick = function () {
      removeLastRow('liabilities');
    };
    byId('add-pl').onclick = function () {
      addRow('plLines');
    };
    byId('remove-pl').onclick = function () {
      removeLastRow('plLines');
    };

    syncFormFields();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
