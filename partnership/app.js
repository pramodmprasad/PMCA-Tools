(function () {
  'use strict';

  let partnershipLoadedStaff = '';
  let partnershipCurrentUserFromParent = '';
  let partnershipCurrentDeedType = 'new';

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(text) {
    if (text == null || text === '') return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDateDDMMYYYY(isoDate) {
    if (!isoDate) return '';
    var parts = String(isoDate).split('-');
    if (parts.length !== 3) return String(isoDate);
    return parts[2] + '-' + parts[1] + '-' + parts[0];
  }

  function formatDateLong(isoDate) {
    if (!isoDate) return '';
    var parts = String(isoDate).split('-');
    if (parts.length !== 3) return String(isoDate);
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var d = parseInt(parts[2], 10);
    var m = months[parseInt(parts[1], 10) - 1];
    var y = parts[0];
    return d + ' ' + m + ' ' + y;
  }

  function ordinalSuffix(day) {
    var d = parseInt(day, 10);
    if (d >= 11 && d <= 13) return 'th';
    switch (d % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  function formatDateLongWithOrdinal(isoDate) {
    if (!isoDate) return '';
    var parts = String(isoDate).split('-');
    if (parts.length !== 3) return String(isoDate);
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var d = parseInt(parts[2], 10);
    var m = months[parseInt(parts[1], 10) - 1];
    var y = parts[0];
    var suf = ordinalSuffix(d);
    return d + '<sup style="font-size:0.85em;">' + suf + '</sup> ' + m + ' ' + y;
  }

  function ensurePercent(val, emptyChar) {
    var v = (val || '').trim();
    if (!v) return emptyChar || '–';
    if (v.slice(-1) === '%') return v;
    return v + '%';
  }

  function formatStampAmount(num) {
    var n = parseInt(String(num).replace(/[^0-9]/g, ''), 10) || 0;
    return n.toLocaleString('en-IN');
  }

  // Listen for staff name from parent (like Net Worth tool)
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'partnership-staff') {
      var name = (e.data.staffName != null && e.data.staffName !== '') ? String(e.data.staffName).trim() : '';
      partnershipCurrentUserFromParent = name;
      updateStaffDisplayPartnership();
    }
    if (e.data && e.data.type === 'partnership-reset') {
      doResetForm(true);
    }
  });

  function getPartnershipStaffName() {
    try {
      if (window.parent && window.parent !== window) {
        if (typeof window.parent.getStaffName === 'function') return window.parent.getStaffName() || '';
        const u = window.parent.currentUser;
        if (u) return (u.name || u.username || '') || '';
      }
    } catch (e) { /* ignore */ }
    return (partnershipCurrentUserFromParent && partnershipCurrentUserFromParent.trim()) || '';
  }

  function updateStaffDisplayPartnership(staffFromFile) {
    const el = byId('partnership-staff-display');
    if (!el) return;
    // Audit trail: show only who last saved/updated (from loaded file or after save). Never show current user just for viewing.
    let name = '';
    if (staffFromFile && String(staffFromFile).trim()) {
      name = String(staffFromFile).trim();
    } else if (partnershipLoadedStaff && partnershipLoadedStaff.trim()) {
      name = partnershipLoadedStaff.trim();
    }
    el.textContent = name ? 'Last updated by: ' + name : 'Last updated by: —';
  }

  function getPartnerBlockHtml(i) {
    return (
      '<div class="partner-block" data-partner-index="' + i + '">' +
        '<div class="partner-block-header">' +
          '<h3>Partner ' + (i + 1) + '</h3>' +
          '<button type="button" class="btn btn-outline btn-remove-partner" data-partner-index="' + i + '" title="Remove this partner">Remove partner</button>' +
        '</div>' +
        '<div class="grid-2">' +
          '<div class="field">' +
            '<label for="partner-name-' + i + '">Name of Partner <span class="required">*</span></label>' +
            '<input type="text" id="partner-name-' + i + '" placeholder="Full name" />' +
          '</div>' +
          '<div class="field">' +
            '<label for="partner-father-' + i + '">Father&apos;s name</label>' +
            '<input type="text" id="partner-father-' + i + '" placeholder="Father&apos;s name" />' +
          '</div>' +
          '<div class="field">' +
            '<label for="partner-dob-' + i + '">Date of birth <span class="required">*</span></label>' +
            '<input type="date" id="partner-dob-' + i + '" required />' +
          '</div>' +
          '<div class="field">' +
            '<label for="partner-pan-' + i + '">PAN <span class="required">*</span></label>' +
            '<input type="text" id="partner-pan-' + i + '" placeholder="e.g. AAAAA9999A" maxlength="10" required />' +
          '</div>' +
          '<div class="field field-full partner-represented-wrap" id="partner-represented-wrap-' + i + '" style="display:none;">' +
            '<label for="partner-represented-' + i + '">Person represented by <span class="required">*</span></label>' +
            '<input type="text" id="partner-represented-' + i + '" placeholder="Name of person represented" />' +
          '</div>' +
          '<div class="field field-full">' +
            '<label for="partner-address-' + i + '">Address <span class="required">*</span></label>' +
            '<textarea id="partner-address-' + i + '" rows="2" placeholder="Address" required></textarea>' +
          '</div>' +
          '<div class="field checkbox-field">' +
            '<label><input type="checkbox" id="partner-managing-' + i + '" /> Managing partner</label>' +
          '</div>' +
          '<div class="field checkbox-field">' +
            '<label><input type="checkbox" id="partner-working-' + i + '" /> Working partner</label>' +
          '</div>' +
          '<div class="field">' +
            '<label for="partner-profit-share-' + i + '">Profit share (%) <span class="required">*</span></label>' +
            '<input type="text" id="partner-profit-share-' + i + '" placeholder="e.g. 50" inputmode="decimal" required />' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function toggleRepresentedByVisibility(i) {
    var wrap = byId('partner-represented-wrap-' + i);
    var input = byId('partner-represented-' + i);
    var panInput = byId('partner-pan-' + i);
    if (!wrap || !input || !panInput) return;
    var pan = (panInput.value || '').trim();
    var show = pan.length >= 4 && pan.charAt(3).toUpperCase() !== 'P';
    wrap.style.display = show ? '' : 'none';
    input.required = show;
    if (!show) input.value = '';
  }

  function bindPartnerPanToggle(i) {
    var panInput = byId('partner-pan-' + i);
    if (!panInput) return;
    panInput.addEventListener('input', function () { toggleRepresentedByVisibility(i); });
    panInput.addEventListener('change', function () { toggleRepresentedByVisibility(i); });
  }

  function renderPartners(preservedData) {
    var container = byId('partners-container');
    if (!container) return;
    var newN;
    var dataToApply = [];
    if (Array.isArray(preservedData) && preservedData.length >= 2) {
      newN = preservedData.length;
      if (byId('num-partners')) byId('num-partners').value = String(newN);
      dataToApply = preservedData;
    } else {
      var oldN = container.children.length;
      var existingData = getPartnersDataForCount(oldN);
      newN = Math.max(2, parseInt(byId('num-partners')?.value, 10) || 2);
      dataToApply = existingData.slice(0, newN);
    }
    container.innerHTML = '';
    for (var i = 0; i < newN; i++) {
      var div = document.createElement('div');
      div.innerHTML = getPartnerBlockHtml(i).trim();
      container.appendChild(div.firstElementChild);
      toggleRepresentedByVisibility(i);
      bindPartnerPanToggle(i);
    }
    for (var j = 0; j < dataToApply.length; j++) {
      applyPartnerData(j, dataToApply[j]);
    }
    container.querySelectorAll('.btn-remove-partner').forEach(function (btn) {
      var idx = parseInt(btn.getAttribute('data-partner-index'), 10);
      btn.style.display = newN > 2 ? '' : 'none';
      btn.onclick = function () {
        var currentCount = getPartnersData().length;
        if (currentCount <= 2) return;
        if (!confirm('Remove partner ' + (idx + 1) + '? Their details will be removed and remaining partners renumbered.')) return;
        var all = getPartnersData();
        all.splice(idx, 1);
        if (byId('num-partners')) byId('num-partners').value = String(all.length);
        renderPartners(all);
      };
    });
  }

  function getPartnersData() {
    var n = Math.max(2, parseInt(byId('num-partners')?.value, 10) || 2);
    var partners = [];
    for (var i = 0; i < n; i++) {
      partners.push({
        name: (byId('partner-name-' + i)?.value || '').trim(),
        fatherName: (byId('partner-father-' + i)?.value || '').trim(),
        dob: byId('partner-dob-' + i)?.value || '',
        address: (byId('partner-address-' + i)?.value || '').trim(),
        pan: (byId('partner-pan-' + i)?.value || '').trim(),
        representedBy: (byId('partner-represented-' + i)?.value || '').trim(),
        managingPartner: !!(byId('partner-managing-' + i)?.checked),
        workingPartner: !!(byId('partner-working-' + i)?.checked),
        profitShare: (byId('partner-profit-share-' + i)?.value || '').trim()
      });
    }
    return partners;
  }

  function getPartnersDataForCount(count) {
    var partners = [];
    for (var i = 0; i < count; i++) {
      var nameEl = byId('partner-name-' + i);
      if (!nameEl) break;
      partners.push({
        name: (byId('partner-name-' + i)?.value || '').trim(),
        fatherName: (byId('partner-father-' + i)?.value || '').trim(),
        dob: byId('partner-dob-' + i)?.value || '',
        address: (byId('partner-address-' + i)?.value || '').trim(),
        pan: (byId('partner-pan-' + i)?.value || '').trim(),
        representedBy: (byId('partner-represented-' + i)?.value || '').trim(),
        managingPartner: !!(byId('partner-managing-' + i)?.checked),
        workingPartner: !!(byId('partner-working-' + i)?.checked),
        profitShare: (byId('partner-profit-share-' + i)?.value || '').trim()
      });
    }
    return partners;
  }

  function applyPartnerData(i, p) {
    if (byId('partner-name-' + i)) byId('partner-name-' + i).value = p.name != null ? p.name : '';
    if (byId('partner-father-' + i)) byId('partner-father-' + i).value = p.fatherName != null ? p.fatherName : '';
    if (byId('partner-dob-' + i)) byId('partner-dob-' + i).value = p.dob != null ? p.dob : '';
    if (byId('partner-address-' + i)) byId('partner-address-' + i).value = p.address != null ? p.address : '';
    if (byId('partner-pan-' + i)) byId('partner-pan-' + i).value = p.pan != null ? p.pan : '';
    if (byId('partner-represented-' + i)) byId('partner-represented-' + i).value = p.representedBy != null ? p.representedBy : '';
    var managingEl = byId('partner-managing-' + i);
    if (managingEl) managingEl.checked = p.managingPartner === true;
    var workingEl = byId('partner-working-' + i);
    if (workingEl) workingEl.checked = p.workingPartner === true;
    if (byId('partner-profit-share-' + i)) byId('partner-profit-share-' + i).value = p.profitShare != null ? p.profitShare : '';
    toggleRepresentedByVisibility(i);
  }

  function getAdditionalPoints() {
    var points = [];
    for (var i = 1; i <= 5; i++) {
      var el = byId('additional-point-' + i);
      points.push((el && el.value != null) ? String(el.value).trim() : '');
    }
    return points;
  }

  function validateForm() {
    var errors = [];
    var name = (byId('partnership-name')?.value || '').trim();
    if (!name) errors.push('Partnership Name is required.');
    var address = (byId('partnership-address')?.value || '').trim();
    if (!address) errors.push('Address is required.');
    var commencement = byId('commencement-date')?.value || '';
    if (!commencement) errors.push('Partnership Commencement Date is required.');
    var agreement = byId('agreement-date')?.value || '';
    if (!agreement) errors.push('Deed preparation date is required.');
    var duration = (byId('duration')?.value || '').trim();
    if (!duration) errors.push('Duration of Partnership is required.');
    var objective = (byId('objective')?.value || '').trim();
    if (!objective) errors.push('Objective of partnership is required.');
    var interestCapital = (byId('interest-capital')?.value || '').trim();
    if (!interestCapital) errors.push('Interest rate on capital (%) is required.');
    var interestLoan = (byId('interest-loan')?.value || '').trim();
    if (!interestLoan) errors.push('Interest rate on loan from partner (%) is required.');
    var stampNo = (byId('stamp-no')?.value || '').trim();
    if (!stampNo) errors.push('SL No. is required.');
    var stampDate = byId('stamp-date')?.value || '';
    if (!stampDate) errors.push('Stamp Paper Date is required.');
    var stampAmt = (byId('stamp-amount')?.value || '').trim();
    if (!stampAmt) errors.push('Stamp Paper Amount (Rs.) is required.');
    var partners = getPartnersData();
    for (var i = 0; i < partners.length; i++) {
      var p = partners[i];
      if (!p.name) errors.push('Name of Partner ' + (i + 1) + ' is required.');
      if (!p.dob) errors.push('Date of birth of Partner ' + (i + 1) + ' is required.');
      if (!p.pan) errors.push('PAN of Partner ' + (i + 1) + ' is required.');
      if (!p.address) errors.push('Address of Partner ' + (i + 1) + ' is required.');
      var pan = p.pan || '';
      if (pan && pan.length >= 4 && pan.charAt(3).toUpperCase() !== 'P' && (!p.representedBy || !p.representedBy.trim())) {
        errors.push('Person represented by is required for Partner ' + (i + 1) + ' (PAN not individual).');
      }
      if (!p.profitShare || (p.profitShare || '').trim() === '') errors.push('Profit share (%) of Partner ' + (i + 1) + ' is required.');
    }
    var totalShare = 0;
    for (var j = 0; j < partners.length; j++) {
      var sh = parseFloat(String(partners[j].profitShare).replace(/[^0-9.]/g, '')) || 0;
      totalShare += sh;
    }
    if (partners.length && Math.abs(totalShare - 100) > 0.01) {
      errors.push('Profit shares should add up to 100%. Current total: ' + totalShare.toFixed(1) + '%.');
    }
    return errors;
  }

  function showValidationErrors(errors) {
    var el = byId('validation-errors');
    if (!el) return;
    if (!errors.length) {
      el.classList.remove('visible');
      el.innerHTML = '';
      return;
    }
    el.innerHTML = '<ul>' + errors.map(function (e) { return '<li>' + escapeHtml(e) + '</li>'; }).join('') + '</ul>';
    el.classList.add('visible');
  }

  function calculateAge(dobIso, refIso) {
    if (!dobIso) return '';
    var d = new Date(dobIso);
    if (isNaN(d.getTime())) return '';
    var ref = refIso ? new Date(refIso) : new Date();
    if (isNaN(ref.getTime())) ref = new Date();
    var age = ref.getFullYear() - d.getFullYear();
    var m = ref.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) age--;
    return age >= 0 ? String(age) : '';
  }

  function toRomanLower(num) {
    var romans = [
      [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
      [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
      [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']
    ];
    var result = '';
    var n = Math.max(1, num | 0);
    romans.forEach(function (pair) {
      while (n >= pair[0]) {
        result += pair[1];
        n -= pair[0];
      }
    });
    return result;
  }

  function sanitizeFilename(name) {
    const base = String(name || '').trim() || 'partnership-deed';
    return base
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  }

  function getPartnerSignatureBlockInFlow() {
    var partners = getPartnersData();
    var html = '<p style="margin-top:0.5em;"><strong>PARTNERS</strong></p>';
    partners.forEach(function (p, idx) {
      html += '<p style="margin:1.5em 0 0.5em;">(' + (idx + 1) + ') _________________________ &nbsp; <strong>' + escapeHtml(p.name) + '</strong></p>';
    });
    return html;
  }

  function getPartnerSignatureBlockFooter() {
    var partners = getPartnersData();
    var html = '<div class="deed-signature-block">';
    html += '<div class="deed-signature-block-space"></div>';
    html += '<table style="width:100%; border:none; border-collapse:collapse;"><tr>';
    partners.forEach(function (p) {
      html += '<td style="border:none; padding:0.5em 1em; text-align:center; vertical-align:top;">_________________________<br/><span style="font-size:0.9em;"><strong>' + escapeHtml(p.name) + '</strong></span></td>';
    });
    html += '</tr></table></div>';
    return html;
  }

  /** Same as footer block but with explicit black text for Word so footer names are dark. */
  function getPartnerSignatureBlockFooterForWord() {
    var partners = getPartnersData();
    var html = '<div class="deed-signature-block">';
    html += '<div class="deed-signature-block-space"></div>';
    html += '<table style="width:100%; border:none; border-collapse:collapse; color:#000;"><tr>';
    partners.forEach(function (p) {
      html += '<td style="border:none; padding:0.5em 1em; text-align:center; vertical-align:top; color:#000;">_________________________<br/><span style="font-size:0.9em; font-weight:bold; color:#000;">' + escapeHtml(p.name) + '</span></td>';
    });
    html += '</tr></table></div>';
    return html;
  }

  function getAllFormData() {
    const partners = getPartnersData();
    return {
      version: 1,
      type: 'partnership-deed',
      deedType: partnershipCurrentDeedType || 'new',
      partnershipName: (byId('partnership-name')?.value || '').trim(),
      partnershipAddress: (byId('partnership-address')?.value || '').trim(),
      commencementDate: byId('commencement-date')?.value || '',
      agreementDate: byId('agreement-date')?.value || '',
      duration: (byId('duration')?.value || '').trim(),
      objective: (byId('objective')?.value || '').trim(),
      interestCapital: (byId('interest-capital')?.value || '').trim(),
      interestLoan: (byId('interest-loan')?.value || '').trim(),
      stampNo: (byId('stamp-no')?.value || '').trim(),
      stampDate: byId('stamp-date')?.value || '',
      stampAmount: (byId('stamp-amount')?.value || '').trim(),
      additionalPoints: getAdditionalPoints(),
      numPartners: partners.length,
      partners: partners,
      staffName: getPartnershipStaffName(),
      savedAt: new Date().toISOString()
    };
  }

  function applyFormData(data) {
    if (!data || typeof data !== 'object') return;
    const form = data.form || data;
    if (!form) return;
    try {
      // Keep internal deed type for compatibility with older saved files
      partnershipCurrentDeedType = form.deedType || 'new';
      if (byId('partnership-name') && form.partnershipName != null) byId('partnership-name').value = form.partnershipName || '';
      if (byId('partnership-address') && form.partnershipAddress != null) byId('partnership-address').value = form.partnershipAddress || '';
      if (byId('commencement-date') && form.commencementDate != null) byId('commencement-date').value = form.commencementDate || '';
      if (byId('agreement-date') && form.agreementDate != null) byId('agreement-date').value = form.agreementDate || '';
      if (byId('duration') && form.duration != null) byId('duration').value = form.duration || '';
      if (byId('objective') && form.objective != null) byId('objective').value = form.objective || '';
      if (byId('interest-capital') && form.interestCapital != null) byId('interest-capital').value = form.interestCapital || '';
      if (byId('interest-loan') && form.interestLoan != null) byId('interest-loan').value = form.interestLoan || '';
      if (byId('stamp-no') && form.stampNo != null) byId('stamp-no').value = form.stampNo || '';
      if (byId('stamp-date') && form.stampDate != null) byId('stamp-date').value = form.stampDate || '';
      if (byId('stamp-amount') && form.stampAmount != null) byId('stamp-amount').value = form.stampAmount || '5000';
      var addPoints = Array.isArray(form.additionalPoints) ? form.additionalPoints : [];
      for (var ap = 0; ap < 5; ap++) {
        var apEl = byId('additional-point-' + (ap + 1));
        if (apEl && addPoints[ap] != null) apEl.value = addPoints[ap] || '';
      }

      const n = Array.isArray(form.partners) ? Math.max(2, form.partners.length) : 2;
      if (byId('num-partners')) byId('num-partners').value = String(n);
      renderPartners();
      const partners = Array.isArray(form.partners) ? form.partners : [];
      partners.forEach(function (p, i) {
        if (byId('partner-name-' + i) && p.name != null) byId('partner-name-' + i).value = p.name || '';
        if (byId('partner-father-' + i) && p.fatherName != null) byId('partner-father-' + i).value = p.fatherName || '';
        if (byId('partner-dob-' + i) && p.dob != null) byId('partner-dob-' + i).value = p.dob || '';
        if (byId('partner-address-' + i) && p.address != null) byId('partner-address-' + i).value = p.address || '';
        if (byId('partner-pan-' + i) && p.pan != null) byId('partner-pan-' + i).value = p.pan || '';
        if (byId('partner-represented-' + i) && p.representedBy != null) byId('partner-represented-' + i).value = p.representedBy || '';
        var managingEl = byId('partner-managing-' + i);
        if (managingEl) managingEl.checked = p.managingPartner === true;
        var workingEl = byId('partner-working-' + i);
        if (workingEl) workingEl.checked = p.workingPartner === true || (p.working || '').toString().toLowerCase() === 'yes';
        if (byId('partner-profit-share-' + i) && p.profitShare != null) byId('partner-profit-share-' + i).value = p.profitShare || '';
        toggleRepresentedByVisibility(i);
      });

      partnershipLoadedStaff = form.staffName || '';
      updateStaffDisplayPartnership(partnershipLoadedStaff);
    } catch (e) {
      // ignore load errors
    }
  }

  function saveToFile() {
    const data = getAllFormData();
    const json = JSON.stringify(data, null, 2);
    const partnershipName = (data.partnershipName || '').trim() || 'partnership-deed';
    const filename = 'Partnership Deed- ' + sanitizeFilename(partnershipName) + '.pdt';
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      partnershipLoadedStaff = getPartnershipStaffName();
      updateStaffDisplayPartnership(partnershipLoadedStaff);
    } catch (e) {
      alert('Unable to save file in this browser.');
    }
  }

  function handleFileInputChange(event) {
    const input = event.target;
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const text = String(reader.result || '');
        const data = JSON.parse(text);
        if (!data || typeof data !== 'object' || data.type !== 'partnership-deed' || !data.version) {
          alert('Invalid or outdated deed file. Please select a valid partnership deed file exported from PMCA Tools.');
          return;
        }
        applyFormData(data);
        alert('File loaded successfully.');
      } catch (e) {
        alert('Invalid file format. Please select a valid partnership deed file.');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  function buildDeedHtml(isReconstituted) {
    var firmName = (byId('partnership-name')?.value || '').trim();
    var firmAddress = (byId('partnership-address')?.value || '').trim();
    var commencementDate = byId('commencement-date')?.value || '';
    var agreementDate = byId('agreement-date')?.value || '';
    var duration = (byId('duration')?.value || '').trim() || 'at will';
    var stampNo = (byId('stamp-no')?.value || '').trim();
    var stampDate = byId('stamp-date')?.value || commencementDate || new Date().toISOString().slice(0, 10);
    var stampAmount = (byId('stamp-amount')?.value || '').trim() || '5000';
    var interestCapital = (byId('interest-capital')?.value || '').trim() || '12';
    var interestLoan = (byId('interest-loan')?.value || '').trim() || '10';
    var partners = getPartnersData();

    var title = isReconstituted ? 'RECONSTITUTED PARTNERSHIP DEED' : 'PARTNERSHIP DEED';
    var dateForDeed = agreementDate || commencementDate || stampDate;
    var dateLong = formatDateLongWithOrdinal(dateForDeed);
    var commencementLong = formatDateLongWithOrdinal(commencementDate);
    var stampDateLong = formatDateLongWithOrdinal(stampDate);
    var stampAmountFormatted = formatStampAmount(stampAmount);

    var html = '<div class="deed-body">';

    // Opening paragraph – centered
    html += '<p style="text-align:center; margin-top:1em;">THIS DEED OF ' + (isReconstituted ? 'RECONSTITUTION OF ' : '') + 'PARTNERSHIP is entered on this day the ' + dateLong + '.</p>';

    // Between – centered
    html += '<p style="text-align:center; margin-top:1em;">Between</p>';
    if (partners.length) {
      html += '<p style="text-align:justify;">';
      partners.forEach(function (p, idx) {
        if (idx > 0 && idx === partners.length - 1) {
          html += '</p><p style="text-align:center;">and</p><p style="text-align:justify;">';
        }
        var age = calculateAge(p.dob, agreementDate || commencementDate);
        var addr = (p.address || '').replace(/\n/g, ', ');
        var line = '(' + toRomanLower(idx + 1) + ') ' +
          '<strong>' + escapeHtml(p.name) + '</strong>' + ', ' +
          (age ? 'aged ' + escapeHtml(age) + ' years, ' : '') +
          'S/o ' + escapeHtml(p.fatherName || '____________') +
          ', residing at ' + escapeHtml(addr || '____________') + ';';
        html += line;
        if (idx < partners.length - 1) html += '<br>';
      });
      html += '</p>';
    }

    html += '<p style="text-align:justify; margin-top:1em;">Whereas the aforesaid parties have expressed their desire and willingness to enter into partnership. And whereas it is felt necessary and expedient to have the terms and conditions governing the partnership reduced to writing;</p>';

    html += '<p style="text-align:justify; margin-top:1em;">NOW THIS DEED WITNESSETH AND THE PARTIES MUTUALLY AGREE AND DECLARE AS FOLLOWS:-</p>';

    // Clauses 1–4 – name, commencement date, duration, address in bold
    var firmAddressEscaped = escapeHtml(firmAddress).replace(/\n/g, '<br/>');
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">1.</span> The name of the partnership shall be &quot;<strong>' + escapeHtml(firmName) + '</strong>&quot;.</p>';
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">2.</span> The partnership shall be deemed to have commenced from the <strong>' + commencementLong + '</strong>.</p>';
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">3.</span> The duration of the partnership shall be <strong>' + escapeHtml(duration) + '</strong>.</p>';
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">4.</span> The principal place of business shall be at <strong>' + firmAddressEscaped + '</strong>, or such other place or places, as the partners may mutually agree upon from time to time. The partners are at liberty to establish branch offices at any place with the consent of all the partners.</p>';

    // Clause 5: object – fixed text, main objective bold, last sentence normal
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">5.</span> The object of the partnership shall be <strong>to conduct the business of distribution, broking and advisory services of all kinds of capital market instruments, mutual fund, bonds, NCD&apos;s, all kinds of commercial and non commercial loans and insurances.</strong> The partnership shall be at liberty to do any other line or lines of business as may be deemed good in future.</p>';

    // Clause 6: capital
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">6.</span> The capital of the partnership shall be as disclosed in the books of account and shall be brought in as agreed between the partners.</p>';

    // Clause 7: interest on capital
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">7.</span> The partners shall be eligible for interest on their capital contribution at the rate of ' + ensurePercent(interestCapital) + ' p.a., provided that the total interest due to the partners in a year shall not exceed the profit for the year.</p>';

    // Clause 8: managing / working partners – from checkboxes
    var managingPartners = partners.filter(function (p) { return p.managingPartner; });
    var workingPartners = partners.filter(function (p) { return p.workingPartner; });
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">8.</span> The following partners shall be Managing Partner and Working Partners and shall actively engage in all the affairs of the firm.</p>';
    if (managingPartners.length || workingPartners.length) {
      if (managingPartners.length) {
        html += '<p class="deed-clause-sub deed-clause-sub-tab" style="text-align:left; margin-left:4em;"><strong>Managing Partner(s):</strong></p><p class="deed-clause-sub deed-clause-sub-tab" style="text-align:left; margin-left:4em;">';
        managingPartners.forEach(function (p, idx) {
          html += (idx + 1) + '. ' + escapeHtml(p.name);
          if (idx < managingPartners.length - 1) html += '<br>';
        });
        html += '</p>';
      }
      if (workingPartners.length) {
        html += '<p class="deed-clause-sub deed-clause-sub-tab" style="text-align:left; margin-left:4em;"><strong>Working Partner(s):</strong></p><p class="deed-clause-sub deed-clause-sub-tab" style="text-align:left; margin-left:4em;">';
        workingPartners.forEach(function (p, idx) {
          html += (idx + 1) + '. ' + escapeHtml(p.name);
          if (idx < workingPartners.length - 1) html += '<br>';
        });
        html += '</p>';
      }
    }

    // Clause 9: salary to working partners – template text
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">9.</span> The working partners shall be entitled to salary for managing the firm. The total amount of such salaries due to the working partners in a year shall be computed as per the table given below:-</p>';
    html += '<p class="deed-clause-sub deed-clause-sub-tab" style="text-align:justify; margin-left:4em;">(a) In the case of loss or book profit up to Rs 3,00,000/- for the year: Rs 1,50,000/- or 90% of book profit, whichever is higher.</p>';
    html += '<p class="deed-clause-sub deed-clause-sub-tab" style="text-align:justify; margin-left:4em;">(b) On amount of book profit exceeding Rs 3,00,000/-: 60% of book profit in excess of Rs 3,00,000/-.</p>';
    html += '<p class="deed-clause-sub deed-clause-sub-tab" style="text-align:justify; margin-left:4em;">For the purpose of this clause, the term book profit shall mean the book profit as defined in section 40(b) of the Income Tax Act, 1961 or any statutory modification or enhancement thereof, for the time being in force.</p>';

    // Clause 10
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">10.</span> Partners are at liberty to change the salary and rate of interest payable to the partner and to ascertain the partners to whom the salary shall be paid, as may be decided by the partner from time to time by means of resolution passed by all partners.</p>';

    // Clause 11: profit-sharing
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">11.</span> The profits or losses of the partnership shall be divided between the partners in the following ratio.</p>';
    if (partners.length) {
      html += '<p class="deed-clause-sub deed-clause-sub-tab" style="text-align:left; margin-left:4em;">';
      partners.forEach(function (p) {
        html += escapeHtml(p.name) + ' - ' + ensurePercent(p.profitShare, '____') + '<br>';
      });
      html += '</p>';
    }

    // Clause 12: interest on partner loans
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">12.</span> Any further amount, other than capital, brought in by the partners either as loan or deposit shall bear simple interest at the rate of ' + ensurePercent(interestLoan) + ' per annum.</p>';

    // Remaining clauses 13–25 (static text, with stamp details in 25)
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">13.</span> The bank accounts including loan/cash credit accounts of the firm shall be opened and operated by the managing partners. And for the purpose of operating the bank accounts of the firm, any other person may be designated and authorized by all the partners. Thus, the managing partners or any other person so designated and authorized individually shall have the power to operate upon the bank accounts and to sign cheques, hundies, promissory notes and other negotiable instruments on behalf of the firm.</p>';

    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">14.</span> The firm may borrow money or raise loan for the purpose of carrying on the business, from any bank, financial institutions or other parties, repayable in short term, medium term or long term and such borrowings shall be made jointly by all the partners and they are authorized to pledge, mortgage, hypothecate or otherwise execute any change or lien on all or any other properties of the firm, movable or immovable, present or future.</p>';

    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">15.</span> Proper books of accounts relating to the business of the firm shall be maintained by the firm. The account books, documents, vouchers and all other papers shall be kept at the places of business of the firm and shall be open for inspection by the partners at any time during business hours. The book of accounts shall be closed as on 31st day of March every year and a profit and loss account and balance sheet as on the said date be prepared, which and when signed by all the partners shall be final and binding upon all of them, except for apparent mistakes which shall be rectifiable at all times.</p>';

    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">16.</span> The partnership shall be one at will but shall not dissolve in the event of the death or retirement of a partner or on adjudication of a partner as insolvent. In the event of the death of a partner, his/her nominee shall be admitted to the partnership, and the firm reconstituted accordingly shall continue to carry on the business.</p>';

    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">17.</span> All the partners shall be just and faithful to each other and render true accounts and full information of all matters concerning the business to the other partners. Any partner shall not do or suffer to be done anything detrimental to the interest of the partnership.</p>';

    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">18.</span> No partner shall without the consent of the other partner in writing, assign his/her share of interest in the firm in favor of third parties or create any charge on his/her share. If a partner is not willing to continue in the partnership, the other partner shall have the right to purchase his/her share by paying the value thereof, as agreed by the partners.</p>';

    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">19.</span> Any partner may retire from the firm, by giving two months prior notice to the firm and all other partners. The firm on getting such notice shall cause the accounts to be closed as on the expiry of one month from the date of receipt of the notice. The amount due from the retiring partner shall be paid by the retiring partner within 7 days from the date of closure of accounts. However, if any amount is due to the retiring partner, the same shall be paid within 3 months from the date of closure.</p>';

    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">20.</span> New partners may be admitted to the partnership with the consent of all the existing partners.</p>';

    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">21.</span> It is hereby affirmed and declared by the partners that, all decisions, other than those relating to the day-to-day administration of the firm, shall be decided by the majority in the meetings of the partners for which proper minutes shall be maintained.</p>';

    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">22.</span> Any dispute or difference of opinion that may arise between the partners, in relation to any matter concerning the partnership, shall be referred to arbitration as per the provisions of the Arbitration and Conciliation Act, 1996.</p>';

    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">23.</span> Any of the terms of this deed may be altered, modified or cancelled and additional clauses may be added thereto, by executing supplementary deed by the common consent of the partners.</p>';

    var additionalPoints = getAdditionalPoints().filter(function (t) { return t.length > 0; });
    var num = 24;
    additionalPoints.forEach(function (text) {
      html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">' + num + '.</span> ' + escapeHtml(text).replace(/\n/g, '<br/>') + '</p>';
      num++;
    });
    var clause24Num = num++;
    var clause25Num = num;
    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">' + clause24Num + '.</span> In all matters that are not specifically provided for herein, the provisions of the Indian Partnership Act 1932, shall apply accordingly.</p>';

    html += '<p class="deed-clause" style="text-align:justify;"><span class="deed-clause-num">' + clause25Num + '.</span> The original of this deed of partnership entered into on stamp paper worth Rs. ' + stampAmountFormatted + '/- (SL no. ' + escapeHtml(stampNo || '__________') + ' dated ' + (stampDateLong || '__________') + ') shall be kept at the principal place of the business.</p>';

    html += '<p style="text-align:justify; margin-top:1.5em;">IN WITNESS WHEREOF THE PARTIES HERETO HAVE SIGNED THIS DEED IN THE PRESENCE OF THE FOLLOWING WITNESSES ON THE DATE AND MONTH ABOVE WRITTEN.</p>';

    html += '<p style="margin-top:0.5em;">&nbsp;</p>';

    // Witness lines
    html += '<p style="margin-top:0.5em;"><strong>WITNESSES</strong></p>';
    html += '<p style="margin:1cm 0 0;">1. ____________________________</p>';
    // 1 cm space before second witness line
    html += '<p style="margin:1cm 0 0;">2. ____________________________</p>';

    html += '</div>';
    return html;
  }

  function openPreview() {
    var errors = validateForm();
    showValidationErrors(errors);
    if (errors.length) return;
    var isReconstituted = partnershipCurrentDeedType === 'reconstituted';
    var preview = byId('deed-preview');
    var modal = byId('preview-modal');
    if (preview) preview.innerHTML = buildDeedHtml(isReconstituted);
    if (modal) modal.setAttribute('aria-hidden', 'false');
  }

  function closePreview() {
    var modal = byId('preview-modal');
    if (modal) modal.setAttribute('aria-hidden', 'true');
  }

  function deedHtmlClausesToTablesForWord(html) {
    return html.replace(/<p class="deed-clause"[^>]*><span class="deed-clause-num">(\d+\.)<\/span>\s*([\s\S]*?)<\/p>/gi, function (_, num, text) {
      return '<table class="deed-clause-tbl" style="width:100%; border:none; border-collapse:collapse;"><tr><td style="width:2em; vertical-align:top; border:none; font-weight:bold;">' + num + '</td><td style="border:none; text-align:justify;">' + text + '</td></tr></table>';
    });
  }

  /** Split deed HTML into part before last page (Section 1) and last page (Section 2: IN WITNESS... + PARTNERS + WITNESSES). */
  function splitDeedHtmlForSections(deedHtml) {
    var idx = deedHtml.indexOf('>IN WITNESS WHEREOF');
    if (idx === -1) return { section1: deedHtml, section2: '' };
    var pStart = deedHtml.lastIndexOf('<p', idx);
    if (pStart === -1) return { section1: deedHtml, section2: '' };
    return {
      section1: deedHtml.substring(0, pStart).replace(/\s+$/, ''),
      section2: deedHtml.substring(pStart)
    };
  }

  function exportToWord() {
    var errors = validateForm();
    showValidationErrors(errors);
    if (errors.length) return;
    var isReconstituted = partnershipCurrentDeedType === 'reconstituted';
    var deedHtml = buildDeedHtml(isReconstituted);
    var title = isReconstituted ? 'Reconstituted Partnership Deed' : 'Partnership Deed';
    deedHtml = deedHtml.replace(/class="deed-signature-block"/gi, 'class="deed-signature-block" style="position:static; border-top:1px solid #333; padding:0.5em 0;"');
    deedHtml = deedHtmlClausesToTablesForWord(deedHtml);
    var inFlowPartners = getPartnerSignatureBlockInFlow();
    deedHtml = deedHtml.replace(/<p style="margin-top:\s*0\.5em;"><strong>WITNESSES<\/strong><\/p>/i, inFlowPartners + '<p style="margin-top:1.5cm;"><strong>WITNESSES<\/strong><\/p>');
    deedHtml = deedHtml.replace(/<p style="margin-top:\s*2em;"><strong>WITNESSES<\/strong><\/p>/i, inFlowPartners + '<p style="margin-top:1.5cm;"><strong>WITNESSES<\/strong><\/p>');
    deedHtml = deedHtml.replace(/<p style="margin-top:\s*2em;">\s*&nbsp;\s*<\/p>/gi, '<p style="margin-top:0.5em;">&nbsp;</p>');
    deedHtml = deedHtml.replace(
      /<p>1\. ____________________________\s*&nbsp;*\s*2\. ____________________________\s*<\/p>/i,
      '<p style="margin:1cm 0 0;">1. ____________________________</p><p style="margin:1cm 0 0;">2. ____________________________</p>'
    );
    var stampPaperTopGap = '<table class="stamp-paper-top-gap" cellpadding="0" cellspacing="0" border="0" style="width:100%; border:none;"><tr><td height="396" style="height:14cm; border:none; padding:0; margin:0; font-size:1px; line-height:0;">&#160;</td></tr></table>';
    var firstPageBottomSpacer = '<div style="height:8cm; min-height:8cm; width:100%; page-break-inside:avoid;" class="first-page-bottom-spacer"><table cellpadding="0" cellspacing="0" border="0" style="width:100%; border:none; height:8cm;"><tr><td height="227" style="height:8cm; border:none; padding:0; margin:0; font-size:1px; line-height:0;">&#160;</td></tr></table></div>';
    deedHtml = deedHtml + firstPageBottomSpacer;
    var wordStyles = '<style>@page{size:21cm 29.7cm; margin:2cm;} @page:first{margin:2cm 2cm 8cm 2cm;} body{font-family:\'Times New Roman\',Times,serif;font-size:12pt;line-height:1.5;margin:0;padding:2cm;} .stamp-paper-top-gap{width:100%; border:none;} .stamp-paper-top-gap td{height:14cm; border:none; padding:0;} .first-page-bottom-spacer{width:100%; height:8cm; min-height:8cm; page-break-inside:avoid;} .first-page-bottom-spacer table{width:100%; border:none; height:8cm;} .first-page-bottom-spacer td{height:8cm; border:none; padding:0;} .deed-body{margin:0;} .deed-clause-tbl{width:100%; border:none;} .deed-clause-sub{margin-left:2em;} .deed-clause-sub-tab{margin-left:4em;} table{border-collapse:collapse;} th,td{border:1px solid #333;padding:6px;} th{background:#f1f5f9;} .deed-clause-tbl td{border:none;} sup{font-size:0.85em;} p{margin:0.5em 0;}</style>';
    var wordXml = '<xml><w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word"><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>';
    var htmlContent = '<!DOCTYPE html><html xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><title>' + escapeHtml(title) + '</title>' + wordStyles + wordXml + '</head><body><div class="WordSection1">' + stampPaperTopGap + deedHtml + '</div></body></html>';
    var blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    var url = URL.createObjectURL(blob);
    var firmName = (byId('partnership-name')?.value || '').trim() || 'partnership-deed';
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Partnership Deed- ' + sanitizeFilename(firmName) + '.doc';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportToWordFromPreview() {
    var preview = byId('deed-preview');
    if (!preview || !preview.innerHTML) return;
    var deedHtml = preview.innerHTML.replace(/class="deed-signature-block"/gi, 'class="deed-signature-block" style="position:static; border-top:1px solid #333; padding:0.5em 0;"');
    deedHtml = deedHtmlClausesToTablesForWord(deedHtml);
    var inFlowPartners = getPartnerSignatureBlockInFlow();
    deedHtml = deedHtml.replace(/<p style="margin-top:\s*0\.5em;"><strong>WITNESSES<\/strong><\/p>/i, inFlowPartners + '<p style="margin-top:1.5cm;"><strong>WITNESSES<\/strong><\/p>');
    deedHtml = deedHtml.replace(/<p style="margin-top:\s*2em;"><strong>WITNESSES<\/strong><\/p>/i, inFlowPartners + '<p style="margin-top:1.5cm;"><strong>WITNESSES<\/strong><\/p>');
    deedHtml = deedHtml.replace(/<p style="margin-top:\s*2em;">\s*&nbsp;\s*<\/p>/gi, '<p style="margin-top:0.5em;">&nbsp;</p>');
    deedHtml = deedHtml.replace(
      /<p>1\. ____________________________\s*&nbsp;*\s*2\. ____________________________\s*<\/p>/i,
      '<p style="margin:1cm 0 0;">1. ____________________________</p><p style="margin:1cm 0 0;">2. ____________________________</p>'
    );
    var stampPaperTopGap = '<table class="stamp-paper-top-gap" cellpadding="0" cellspacing="0" border="0" style="width:100%; border:none;"><tr><td height="396" style="height:14cm; border:none; padding:0; margin:0; font-size:1px; line-height:0;">&#160;</td></tr></table>';
    var firstPageBottomSpacer = '<div style="height:8cm; min-height:8cm; width:100%; page-break-inside:avoid;" class="first-page-bottom-spacer"><table cellpadding="0" cellspacing="0" border="0" style="width:100%; border:none; height:8cm;"><tr><td height="227" style="height:8cm; border:none; padding:0; margin:0; font-size:1px; line-height:0;">&#160;</td></tr></table></div>';
    deedHtml = deedHtml + firstPageBottomSpacer;
    var wordStyles = '<style>@page{size:21cm 29.7cm; margin:2cm;} @page:first{margin:2cm 2cm 8cm 2cm;} body{font-family:\'Times New Roman\',Times,serif;font-size:12pt;line-height:1.5;margin:0;padding:2cm;} .stamp-paper-top-gap{width:100%; border:none;} .stamp-paper-top-gap td{height:14cm; border:none; padding:0;} .first-page-bottom-spacer{width:100%; height:8cm; min-height:8cm; page-break-inside:avoid;} .first-page-bottom-spacer table{width:100%; border:none; height:8cm;} .first-page-bottom-spacer td{height:8cm; border:none; padding:0;} .deed-body{margin:0;} .deed-clause-tbl{width:100%; border:none;} .deed-clause-sub{margin-left:2em;} .deed-clause-sub-tab{margin-left:4em;} table{border-collapse:collapse;} th,td{border:1px solid #333;padding:6px;} th{background:#f1f5f9;} .deed-clause-tbl td{border:none;} sup{font-size:0.85em;} p{margin:0.5em 0;}</style>';
    var wordXml = '<xml><w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word"><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>';
    var htmlContent = '<!DOCTYPE html><html xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><title>Partnership Deed</title>' + wordStyles + wordXml + '</head><body><div class="WordSection1">' + stampPaperTopGap + deedHtml + '</div></body></html>';
    var blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    var url = URL.createObjectURL(blob);
    var firmName = (byId('partnership-name')?.value || '').trim() || 'partnership-deed';
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Partnership Deed- ' + sanitizeFilename(firmName) + '.doc';
    a.click();
    URL.revokeObjectURL(url);
  }

  function doResetForm(skipConfirm) {
    if (!skipConfirm && !confirm('Reset all fields?')) return;
    closePreview();
    partnershipCurrentDeedType = 'new';
    if (byId('deed-type')) byId('deed-type').value = 'new';
    byId('partnership-name').value = '';
    byId('partnership-address').value = '';
    if (byId('commencement-date')) byId('commencement-date').value = '';
    if (byId('agreement-date')) byId('agreement-date').value = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    byId('duration').value = '';
    byId('objective').value = '';
    byId('num-partners').value = '2';
    byId('stamp-no').value = '';
    byId('stamp-date').value = '';
    if (byId('stamp-amount')) byId('stamp-amount').value = '5000';
    if (byId('interest-capital')) byId('interest-capital').value = '12';
    if (byId('interest-loan')) byId('interest-loan').value = '10';
    for (var r = 1; r <= 5; r++) { var ael = byId('additional-point-' + r); if (ael) ael.value = ''; }
    var container = byId('partners-container');
    if (container) container.innerHTML = '';
    renderPartners();
    showValidationErrors([]);
  }

  function resetForm(e) {
    if (e && e.preventDefault) e.preventDefault();
    doResetForm(false);
  }

  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'partnership-reset') {
      closePreview();
      doResetForm(true);
    }
  });

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      closePreview();
      doResetForm(true);
    }
  });

  byId('num-partners')?.addEventListener('input', renderPartners);
  byId('num-partners')?.addEventListener('change', renderPartners);
  byId('preview-btn')?.addEventListener('click', openPreview);
  byId('close-preview')?.addEventListener('click', closePreview);
  byId('close-preview-2')?.addEventListener('click', closePreview);
  byId('export-word-btn')?.addEventListener('click', exportToWord);
  byId('export-word-from-preview')?.addEventListener('click', exportToWordFromPreview);
  var resetBtn = byId('reset-btn');
  if (resetBtn) {
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', resetForm);
  }
   byId('save-file-btn')?.addEventListener('click', saveToFile);
   byId('save-file-btn-bottom')?.addEventListener('click', saveToFile);
   byId('load-file-btn')?.addEventListener('click', function () {
    const input = byId('partnership-file-input');
    if (input) input.click();
  });
  byId('partnership-file-input')?.addEventListener('change', handleFileInputChange);

  byId('preview-modal')?.addEventListener('click', function (e) {
    if (e.target === this) closePreview();
  });

  var today = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (byId('agreement-date')) byId('agreement-date').value = today;
  if (byId('stamp-date') && !byId('stamp-date').value) byId('stamp-date').value = today;

  renderPartners();
  updateStaffDisplayPartnership();
  try {
    if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'partnership-ready' }, '*');
  } catch (e) {}
})();
