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

  var serverAvailable = false;

  var state = {
    entityType: 'corporate',
    entityName: '',
    clientFileKey: '',
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

  function getIndianFYKeyFromPeriodEnd(isoDate) {
    if (!isoDate) return '';
    var parts = String(isoDate).split('-');
    if (parts.length < 3) return '';
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (isNaN(y) || isNaN(m)) return '';
    var fyStart = m <= 3 ? y - 1 : y;
    var fyEndShort = (fyStart + 1) % 100;
    return fyStart + '-' + String(fyEndShort).padStart(2, '0');
  }

  function getPreviousFYKey(fy) {
    var m = String(fy).match(/^(\d{4})-(\d{2})$/);
    if (!m) return '';
    var start = parseInt(m[1], 10) - 1;
    var end = (start + 1) % 100;
    return start + '-' + String(end).padStart(2, '0');
  }

  function sanitizeClientKeyForFile(key) {
    if (key == null || String(key).trim() === '') return '';
    return String(key)
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 80);
  }

  function suggestClientKeyFromEntityName(name) {
    if (!name || !String(name).trim()) return '';
    var w = String(name).trim().split(/\s+/)[0];
    var s = w.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
    return s || '';
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
    state.clientFileKey = o.clientFileKey != null ? String(o.clientFileKey) : '';
  }

  function normalizeRow(r) {
    return {
      id: r.id || uid(),
      name: r.name != null ? r.name : '',
      amount: r.amount != null ? String(r.amount) : '',
      amountPrev: r.amountPrev != null ? String(r.amountPrev) : ''
    };
  }

  function normalizeRows(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeRow);
  }

  function corporateDefaults() {
    function row(name) {
      return { id: uid(), name: name, amount: '', amountPrev: '' };
    }
    return {
      assets: [
        row('Property, plant and equipment'),
        row('Capital work-in-progress'),
        row('Intangible assets'),
        row('Financial assets'),
        row('Other non-current assets'),
        row('Inventories'),
        row('Trade receivables'),
        row('Cash and cash equivalents'),
        row('Other current assets')
      ],
      liabilities: [
        row('Equity share capital'),
        row('Other equity'),
        row('Long-term borrowings'),
        row('Deferred tax liabilities (net)'),
        row('Long-term provisions'),
        row('Short-term borrowings'),
        row('Trade payables'),
        row('Other current liabilities'),
        row('Short-term provisions')
      ],
      plLines: [
        row('Revenue from operations'),
        row('Other income'),
        row('Cost of materials consumed'),
        row('Employee benefits expense'),
        row('Finance costs'),
        row('Depreciation and amortisation'),
        row('Other expenses'),
        row('Tax expense')
      ]
    };
  }

  function nonCorporateDefaults() {
    function row(name) {
      return { id: uid(), name: name, amount: '', amountPrev: '' };
    }
    return {
      assets: [
        row('Fixed assets (net block)'),
        row('Investments'),
        row('Loans and advances'),
        row('Inventories'),
        row('Trade receivables'),
        row('Cash and bank balances'),
        row('Other current assets')
      ],
      liabilities: [
        row('Capital / partners\' capital'),
        row('Reserves and surplus'),
        row('Long-term borrowings'),
        row('Current liabilities'),
        row('Provisions')
      ],
      plLines: [
        row('Revenue / receipts'),
        row('Other income'),
        row('Cost of goods / services'),
        row('Employee expenses'),
        row('Finance charges'),
        row('Depreciation'),
        row('Other expenses'),
        row('Tax')
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

  function updateYearLabelsUi() {
    var fy = getIndianFYKeyFromPeriodEnd(state.periodTo);
    var prevFy = getPreviousFYKey(fy);
    var disp = byId('financial-year-display');
    if (disp) disp.value = fy ? fy + ' (save folder: Data/FinancialStatements/' + fy + '/)' : '';
    var prevLabel = prevFy ? 'Previous year — ' + prevFy + ' (₹)' : 'Previous year (₹)';
    var curLabel = fy ? 'Current year — ' + fy + ' (₹)' : 'Current year (₹)';
    ['th-assets-prev', 'th-liab-prev', 'th-pl-prev'].forEach(function (id) {
      var el = byId(id);
      if (el) el.textContent = prevLabel;
    });
    ['th-assets-cur', 'th-liab-cur', 'th-pl-cur'].forEach(function (id) {
      var el = byId(id);
      if (el) el.textContent = curLabel;
    });
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

  function updateToolbarDataButtons() {
    var dis = isLocked() || !serverAvailable;
    ['btn-save-data', 'btn-load-data'].forEach(function (id) {
      var b = byId(id);
      if (b) b.disabled = dis;
    });
  }

  function applyLockedState() {
    var locked = isLocked();
    var main = byId('fs-main');
    if (!main) return;
    var controls = main.querySelectorAll('input, textarea, select, button');
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
    updateToolbarDataButtons();
    updateFinaliseUi();
  }

  function syncFormFields() {
    byId('entity-name').value = state.entityName;
    if (byId('client-file-key')) {
      byId('client-file-key').value = state.clientFileKey;
      if (state.clientFileKey) byId('client-file-key').dataset.touched = '1';
    }
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
    updateYearLabelsUi();
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
    state.clientFileKey = byId('client-file-key')
      ? byId('client-file-key').value.trim()
      : '';
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
        '<td class="num"><input type="text" class="line-amt-prev" inputmode="decimal" data-key="' +
        key +
        '" data-id="' +
        r.id +
        '" value="' +
        escapeAttr(r.amountPrev != null ? r.amountPrev : '') +
        '" placeholder="0" /></td>' +
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

  function sumLinesPrev(rows) {
    var t = 0;
    for (var i = 0; i < rows.length; i++) {
      t += parseAmount(rows[i].amountPrev);
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

    byId('total-assets-prev').textContent = formatINR(sumLinesPrev(state.assets));
    byId('total-assets').textContent = formatINR(sumLines(state.assets));
    byId('total-liab-prev').textContent = formatINR(sumLinesPrev(state.liabilities));
    byId('total-liab').textContent = formatINR(sumLines(state.liabilities));
    byId('total-pl-net-prev').textContent = formatINR(computePlNetPrev());
    byId('total-pl-net').textContent = formatINR(computePlNet());
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

  function computePlNetPrev() {
    var lines = state.plLines;
    if (lines.length === 0) return 0;
    var t = 0;
    for (var i = 0; i < lines.length; i++) {
      t += parseAmount(lines[i].amountPrev);
    }
    return t;
  }

  function bindTableInputs() {
    var inputs = document.querySelectorAll('.line-name, .line-amt, .line-amt-prev');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].onchange = onLineChange;
      inputs[i].onblur = onLineChange;
    }
  }

  function updateTotalsOnly() {
    byId('total-assets-prev').textContent = formatINR(sumLinesPrev(state.assets));
    byId('total-assets').textContent = formatINR(sumLines(state.assets));
    byId('total-liab-prev').textContent = formatINR(sumLinesPrev(state.liabilities));
    byId('total-liab').textContent = formatINR(sumLines(state.liabilities));
    byId('total-pl-net-prev').textContent = formatINR(computePlNetPrev());
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
        else if (el.classList.contains('line-amt-prev')) rows[i].amountPrev = el.value;
        else rows[i].amount = el.value;
        break;
      }
    }
    setRows(key, rows);
    updateTotalsOnly();
    autoSave();
  }

  function mergePrevFromImported(importedObj) {
    if (!importedObj || typeof importedObj !== 'object') return;
    var ia = normalizeRows(importedObj.assets || []);
    var il = normalizeRows(importedObj.liabilities || []);
    var ip = normalizeRows(importedObj.plLines || []);

    function mergeRows(current, imported) {
      var byName = {};
      for (var i = 0; i < imported.length; i++) {
        var r = imported[i];
        var k = (r.name || '').trim().toLowerCase();
        if (k) byName[k] = r.amount != null ? String(r.amount) : '';
      }
      return current.map(function (r) {
        var k = (r.name || '').trim().toLowerCase();
        var prevVal =
          k && byName[k] !== undefined ? byName[k] : r.amountPrev || '';
        return {
          id: r.id,
          name: r.name,
          amount: r.amount,
          amountPrev: prevVal
        };
      });
    }

    state.assets = mergeRows(state.assets, ia);
    state.liabilities = mergeRows(state.liabilities, il);
    state.plLines = mergeRows(state.plLines, ip);
  }

  function addRow(key) {
    if (isLocked()) return;
    collectForm();
    var rows = getRows(key).slice();
    rows.push({ id: uid(), name: '', amount: '', amountPrev: '' });
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
        version: 3,
        savedAt: new Date().toISOString(),
        entityType: state.entityType,
        entityName: state.entityName,
        clientFileKey: state.clientFileKey,
        cin: state.cin,
        pan: state.pan,
        periodFrom: state.periodFrom,
        periodTo: state.periodTo,
        financialYearKey: getIndianFYKeyFromPeriodEnd(state.periodTo),
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
    state.clientFileKey = o.clientFileKey != null ? String(o.clientFileKey) : '';
    state.cin = o.cin || '';
    state.pan = o.pan || '';
    state.periodFrom = o.periodFrom || '';
    state.periodTo = o.periodTo || '';
    state.ieMode = !!o.ieMode;
    state.assets = normalizeRows(o.assets);
    state.liabilities = normalizeRows(o.liabilities);
    state.plLines = normalizeRows(o.plLines);
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
    var fy = getIndianFYKeyFromPeriodEnd(state.periodTo);
    var key = sanitizeClientKeyForFile(state.clientFileKey) || 'Client';
    var base =
      (key + '_' + (fy || 'FY')).replace(/[^a-zA-Z0-9-_]+/g, '-') || 'financial-statements';
    a.href = URL.createObjectURL(blob);
    a.download = base + FILE_EXT;
    a.click();
    URL.revokeObjectURL(a.href);
    autoSave();
    renderAuditLog();
  }

  function saveToDataFolder() {
    if (isLocked()) return;
    if (!serverAvailable) {
      alert('Run PMCA Tools via the Node server (npm start) to save under Data/FinancialStatements/.');
      return;
    }
    collectForm();
    var fy = getIndianFYKeyFromPeriodEnd(state.periodTo);
    var key = sanitizeClientKeyForFile(byId('client-file-key').value);
    if (!fy) {
      alert('Set the reporting period end date so the financial year (e.g. 2025-26) can be determined.');
      return;
    }
    if (!key) {
      alert('Enter a file name key for this client (e.g. A, B, C). The file will be saved as ' + key + '_' + fy + '.fsjson');
      return;
    }
    var payload = JSON.parse(toJSON());
    fetch('/api/financial-statements/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fy: fy, clientKey: key, data: payload })
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || r.status); });
        return r.json();
      })
      .then(function (data) {
        if (ctx.userId) appendAudit('save_to_data');
        renderAuditLog();
        autoSave();
        alert('Saved to server:\n' + (data.relativePath || ''));
      })
      .catch(function (err) {
        alert('Could not save: ' + (err && err.message ? err.message : String(err)));
      });
  }

  function openLoadDataModal() {
    if (!serverAvailable || isLocked()) return;
    refreshYearSelects(function () {
      byId('fs-load-modal').style.display = 'flex';
      byId('fs-load-modal').setAttribute('aria-hidden', 'false');
    });
  }

  function closeLoadDataModal() {
    var m = byId('fs-load-modal');
    if (m) {
      m.style.display = 'none';
      m.setAttribute('aria-hidden', 'true');
    }
  }

  function refreshYearSelects(done) {
    fetch('/api/financial-statements/years')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var years = (data && data.years) || [];
        var sel = byId('load-data-fy');
        var selImp = byId('import-prev-fy');
        [sel, selImp].forEach(function (s) {
          if (!s) return;
          s.innerHTML = '';
          years.forEach(function (y) {
            var o = document.createElement('option');
            o.value = y;
            o.textContent = y;
            s.appendChild(o);
          });
        });
        if (sel && sel.options.length) sel.selectedIndex = 0;
        if (selImp && selImp.options.length) selImp.selectedIndex = 0;
        return years.length ? fetchFileListForFy(byId('load-data-fy').value, 'load-data-file') : Promise.resolve();
      })
      .then(function () {
        if (byId('import-prev-fy') && byId('import-prev-fy').value) {
          return fetchFileListForFy(byId('import-prev-fy').value, 'import-prev-file-select');
        }
      })
      .then(function () {
        if (typeof done === 'function') done();
      })
      .catch(function () {
        if (typeof done === 'function') done();
      });
  }

  function fetchFileListForFy(fy, selectId) {
    var sel = byId(selectId);
    if (!fy || !sel) return Promise.resolve();
    return fetch('/api/financial-statements/years/' + encodeURIComponent(fy) + '/files')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        var files = (data && data.files) || [];
        sel.innerHTML = '';
        files.forEach(function (f) {
          var o = document.createElement('option');
          o.value = f;
          o.textContent = f;
          sel.appendChild(o);
        });
        updateLoadPathHint();
      });
  }

  function updateLoadPathHint() {
    var fy = byId('load-data-fy') && byId('load-data-fy').value;
    var f = byId('load-data-file') && byId('load-data-file').value;
    var hint = byId('load-data-path-hint');
    if (hint && fy && f) {
      hint.textContent = 'Data/FinancialStatements/' + fy + '/' + f;
    } else if (hint) hint.textContent = '';
  }

  function confirmLoadFromData() {
    var fy = byId('load-data-fy').value;
    var file = byId('load-data-file').value;
    if (!fy || !file) {
      alert('Select financial year and file.');
      return;
    }
    fetch(
      '/api/financial-statements/read?fy=' +
        encodeURIComponent(fy) +
        '&file=' +
        encodeURIComponent(file)
    )
      .then(function (r) {
        if (!r.ok) throw new Error('Not found or server error');
        return r.text();
      })
      .then(function (text) {
        fromJSON(text);
        syncFormFields();
        try {
          localStorage.setItem(STORAGE_KEY, toJSON());
        } catch (e) { /* ignore */ }
        if (ctx.userId) appendAudit('load_from_data');
        renderAuditLog();
        closeLoadDataModal();
      })
      .catch(function () {
        alert('Could not load file from server.');
      });
  }

  function importPrevFromServer() {
    if (isLocked() || !serverAvailable) return;
    var fy = byId('import-prev-fy').value;
    var file = byId('import-prev-file-select').value;
    if (!fy || !file) {
      alert('Select prior financial year and file.');
      return;
    }
    fetch(
      '/api/financial-statements/read?fy=' +
        encodeURIComponent(fy) +
        '&file=' +
        encodeURIComponent(file)
    )
      .then(function (r) {
        if (!r.ok) throw new Error('fail');
        return r.text();
      })
      .then(function (text) {
        var o = JSON.parse(text);
        mergePrevFromImported(o);
        collectForm();
        if (ctx.userId) appendAudit('import_previous_year_server');
        syncFormFields();
        autoSave();
        renderAuditLog();
        alert('Previous year amounts imported from server file. Check line names match.');
      })
      .catch(function () {
        alert('Could not import file.');
      });
  }

  function onImportPrevFile(e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f || isLocked()) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var o = JSON.parse(reader.result);
        mergePrevFromImported(o);
        collectForm();
        if (ctx.userId) appendAudit('import_previous_year_file');
        syncFormFields();
        autoSave();
        renderAuditLog();
        alert('Previous year amounts imported. Line items matched by name.');
      } catch (err) {
        alert('Invalid file.');
      }
    };
    reader.readAsText(f);
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

  function checkServer() {
    fetch('/api/financial-statements/years')
      .then(function (r) {
        serverAvailable = r.ok;
        var hint = byId('fs-server-hint');
        var wrap = byId('fs-import-server-wrap');
        if (hint) hint.style.display = serverAvailable ? 'block' : 'none';
        if (wrap) wrap.style.display = serverAvailable ? 'block' : 'none';
        updateToolbarDataButtons();
        if (serverAvailable) {
          refreshYearSelects();
        }
      })
      .catch(function () {
        serverAvailable = false;
        var hint = byId('fs-server-hint');
        if (hint) hint.style.display = 'none';
        var wrap = byId('fs-import-server-wrap');
        if (wrap) wrap.style.display = 'none';
        updateToolbarDataButtons();
      });
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

    checkServer();

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

    ['entity-name', 'cin', 'pan', 'period-from', 'period-to', 'notes-text', 'client-file-key'].forEach(function (id) {
      var el = byId(id);
      if (el) el.addEventListener('input', function () {
        if (id === 'entity-name') {
          var ck = byId('client-file-key');
          if (ck && !ck.dataset.touched) {
            var sug = suggestClientKeyFromEntityName(byId('entity-name').value);
            if (sug) ck.value = sug;
          }
        }
        if (id === 'client-file-key') {
          byId('client-file-key').dataset.touched = '1';
        }
        persistDraft();
      });
    });

    byId('period-to').addEventListener('change', function () {
      updateYearLabelsUi();
      persistDraft();
    });

    byId('btn-save-file').onclick = saveFile;
    byId('btn-load-file').onclick = loadFile;
    byId('file-input').onchange = onFileSelected;
    byId('btn-print').onclick = printView;
    byId('btn-reset-template').onclick = resetWithConfirm;
    byId('btn-finalise').onclick = doFinalise;
    byId('btn-unfinalise').onclick = doUnfinalise;
    byId('btn-save-data').onclick = saveToDataFolder;
    byId('btn-load-data').onclick = openLoadDataModal;
    byId('load-data-cancel').onclick = closeLoadDataModal;
    byId('load-data-confirm').onclick = confirmLoadFromData;
    byId('btn-import-prev-file').onclick = function () {
      byId('import-prev-file-input').click();
    };
    byId('import-prev-file-input').onchange = onImportPrevFile;
    byId('btn-import-prev-server').onclick = importPrevFromServer;

    byId('load-data-fy').onchange = function () {
      fetchFileListForFy(byId('load-data-fy').value, 'load-data-file').then(updateLoadPathHint);
    };
    byId('load-data-file').onchange = updateLoadPathHint;
    byId('import-prev-fy').onchange = function () {
      fetchFileListForFy(byId('import-prev-fy').value, 'import-prev-file-select');
    };

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
