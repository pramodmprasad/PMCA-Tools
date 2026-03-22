(function () {
  'use strict';

  const CATEGORIES = {
    immovable: 'Immovable property',
    movable: 'Movable property',
    savings: 'Personal & family savings'
  };

  const ASSET_SUBTYPES = {
    immovable: [
      'Land',
      'Land and building',
      'Flat',
      'Commercial building'
    ],
    movable: [
      'Share and securities',
      'Mutual funds',
      'Gold Ornaments and items',
      'Silver ornaments and items',
      'Motor vehicle',
      'Life insurance'
    ],
    savings: [
      'Saving bank account',
      'Current bank account',
      'Fixed deposit',
      'Recurring deposit',
      'PPF',
      'NPS',
      'EPF'
    ]
  };

  function assetSubtypeOptions(category) {
    const subtypes = ASSET_SUBTYPES[category] || [];
    let opts = '<option value="">Select type</option>';
    subtypes.forEach(function (st) {
      opts += '<option value="' + escapeHtml(st) + '">' + escapeHtml(st) + '</option>';
    });
    return opts;
  }

  function ownerNameOptions() {
    const numAssessed = Math.max(0, parseInt(byId('num-assessed')?.value, 10) || 0);
    let opts = '';
    // Add assessed persons
    for (let i = 0; i < numAssessed; i++) {
      const name = byId(`assessed-name-${i}`)?.value?.trim() || `Person ${i + 1}`;
      opts += '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
    }
    // Add applicants if their checkbox is checked
    const numApplicants = Math.max(1, parseInt(byId('num-applicants')?.value, 10) || 1);
    for (let i = 0; i < numApplicants; i++) {
      const checkbox = byId(`applicant-is-assessed-${i}`);
      if (checkbox && checkbox.checked) {
        const name = byId(`applicant-name-${i}`)?.value?.trim() || `Applicant ${i + 1}`;
        opts += '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
      }
    }
    return opts;
  }

  // PAN: 5 alphabets (4th must be P), 4 digits, 1 alphabet
  const PAN_REGEX = /^[A-Za-z]{3}P[A-Za-z][0-9]{4}[A-Za-z]$/;

  const NETWORTH_DEFAULT_DIR_DB = 'networth-default-dir-db';
  const NETWORTH_DEFAULT_DIR_KEY = 'defaultDir';
  let networthDefaultDirHandle = null;
  /** Who last saved the loaded file (from .nwc). Set when file is loaded; do not overwrite with current user. */
  let networthLoadedStaff = '';
  /** Current user name from parent (when embedded). Used when no file is loaded. */
  let networthCurrentUserFromParent = '';

  // Listen for staff name from parent (postMessage – works even if iframe loads after parent)
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'networth-staff') {
      var name = (e.data.staffName != null && e.data.staffName !== '') ? String(e.data.staffName).trim() : '';
      networthCurrentUserFromParent = name;
      updateStaffDisplay();
    }
    if (e.data && e.data.type === 'networth-reset') {
      closePreview();
      resetForm();
    }
  });

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      closePreview();
      resetForm();
    }
  });

  function getNetworthStaffName() {
    try {
      if (window.parent && window.parent !== window) {
        if (typeof window.parent.getStaffName === 'function') return window.parent.getStaffName() || '';
        const u = window.parent.currentUser;
        if (u) return (u.name || u.username || '') || '';
      }
    } catch (e) { /* cross-origin or unavailable */ }
    return (networthCurrentUserFromParent && networthCurrentUserFromParent.trim()) || '';
  }

  function updateStaffDisplay(staffFromFile) {
    const el = byId('networth-staff-display');
    if (!el) return;
    // Audit trail: show only who last saved/updated (from loaded file or after save). Never show current user just for viewing.
    let name = '';
    if (staffFromFile && String(staffFromFile).trim()) {
      name = String(staffFromFile).trim();
    } else if (networthLoadedStaff && networthLoadedStaff.trim()) {
      name = networthLoadedStaff.trim();
    }
    el.textContent = name ? 'Last updated by: ' + name : 'Last updated by: —';
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function data() {
    return window.NETWORTH_DATA || { countries: [], indianStates: [], relationships: [] };
  }

  function escapeHtml(text) {
    if (text == null || text === '') return '—';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatNumber(x) {
    if (x == null || x === '') return '—';
    const n = Number(String(x).replace(/[^0-9.-]/g, ''));
    if (isNaN(n)) return String(x);
    return n.toLocaleString('en-IN');
  }

  function formatAmount(x) {
    if (x == null || x === '') return '—';
    const n = Number(String(x).replace(/[^0-9.-]/g, ''));
    if (isNaN(n) || n === 0) return '—';
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDateDDMMYYYY(isoDate) {
    if (!isoDate) return '';
    const parts = String(isoDate).split('-');
    if (parts.length !== 3) return String(isoDate);
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    return `${d}-${m}-${y}`;
  }

  // Format name to proper case (title case)
  function formatNameToProperCase(name) {
    if (!name) return '';
    return name.trim()
      .split(/\s+/)
      .map(function(word) {
        if (!word) return '';
        // Handle special cases like "de", "van", "von", etc. (keep lowercase if not first word)
        const lowerWords = ['de', 'van', 'von', 'del', 'da', 'di', 'le', 'la', 'el', 'of', 'the'];
        const lowerWord = word.toLowerCase();
        if (lowerWords.indexOf(lowerWord) >= 0) {
          return lowerWord;
        }
        // Capitalize first letter, lowercase the rest
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  // Format text to uppercase
  function formatToUppercase(text) {
    if (!text) return '';
    return text.trim().toUpperCase();
  }

  function sanitizeFilename(name) {
    const base = String(name || '').trim() || 'networth-certificate';
    return base
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  }

  function getAssetTotalsByCategory() {
    // Calculate totals from Annexure 1 data
    const immovableData = getAnnexureImmovableData();
    const movableData = getAnnexureMovableData();
    const savingsData = getAnnexureSavingsData();
    
    const totals = {
      immovable: { inr: 0, fc: 0 },
      movable: { inr: 0, fc: 0 },
      savings: { inr: 0, fc: 0 }
    };
    
    immovableData.forEach(function (item) {
      const inr = parseFloat(String(item.inr || '').replace(/[^0-9.-]/g, '')) || 0;
      const fc = parseFloat(String(item.fc || '').replace(/[^0-9.-]/g, '')) || 0;
      totals.immovable.inr += inr;
      totals.immovable.fc += fc;
    });
    
    movableData.forEach(function (item) {
      const inr = parseFloat(String(item.inr || '').replace(/[^0-9.-]/g, '')) || 0;
      const fc = parseFloat(String(item.fc || '').replace(/[^0-9.-]/g, '')) || 0;
      totals.movable.inr += inr;
      totals.movable.fc += fc;
    });
    
    savingsData.forEach(function (item) {
      const inr = parseFloat(String(item.inr || '').replace(/[^0-9.-]/g, '')) || 0;
      const fc = parseFloat(String(item.fc || '').replace(/[^0-9.-]/g, '')) || 0;
      totals.savings.inr += inr;
      totals.savings.fc += fc;
    });
    
    return totals;
  }

  function validatePan(pan) {
    if (!pan || !pan.trim()) return { valid: false, msg: 'PAN is required.' };
    const normalized = String(pan).trim().toUpperCase();
    
    // Allow "NA" (not available) as a special valid value
    if (normalized === 'NA') {
      return { valid: true, value: 'NA', isNA: true };
    }

    if (!PAN_REGEX.test(normalized)) {
      return { valid: false, msg: 'PAN must be 5 letters (4th letter P), 4 digits, then 1 letter (e.g. ABCPD1234E).' };
    }
    return { valid: true, value: normalized, isNA: false };
  }

  function countryOptions(includeBlank, defaultVal) {
    const list = data().countries || [];
    let opts = includeBlank ? '<option value="">Select country</option>' : '';
    list.forEach(function (c) {
      const sel = (defaultVal && c.name === defaultVal) ? ' selected' : '';
      opts += '<option value="' + escapeHtml(c.name) + '" data-currency="' + escapeHtml(c.currency || '') + '"' + sel + '>' + escapeHtml(c.name) + '</option>';
    });
    return opts;
  }

  function stateOptions(includeBlank, defaultVal) {
    const list = data().indianStates || [];
    let opts = includeBlank ? '<option value="">Select state</option>' : '';
    list.forEach(function (s) {
      const sel = (defaultVal && s === defaultVal) ? ' selected' : '';
      opts += '<option value="' + escapeHtml(s) + '"' + sel + '>' + escapeHtml(s) + '</option>';
    });
    return opts;
  }

  function inferGenderFromRelationship(relationship, applicantGender) {
    const r = (relationship || '').toLowerCase();
    if (r === 'father' || r === 'son' || r === 'grandfather') return 'male';
    if (r === 'mother' || r === 'daughter' || r === 'grandmother') return 'female';
    if (r === 'self') {
      const g = (applicantGender || '').toLowerCase();
      return g === 'male' ? 'male' : g === 'female' ? 'female' : null;
    }
    return null;
  }

  function determineSonOrDaughterFromRelationship(relationship, applicantGender) {
    const r = (relationship || '').toLowerCase();
    const applicantG = (applicantGender || '').toLowerCase();
    
    // Direct relationships - if assessed person is father/son/grandfather, they are male, so "son"
    if (r === 'father' || r === 'son' || r === 'grandfather') return 'son';
    // If assessed person is mother/daughter/grandmother, they are female, so "daughter"
    if (r === 'mother' || r === 'daughter' || r === 'grandmother') return 'daughter';
    
    // Self relationship - use applicant gender
    if (r === 'self') {
      return applicantG === 'male' ? 'son' : applicantG === 'female' ? 'daughter' : 'son/daughter';
    }
    
    // Spouse - opposite of applicant gender
    if (r === 'spouse') {
      return applicantG === 'male' ? 'daughter' : applicantG === 'female' ? 'son' : 'son/daughter';
    }
    
    return 'son/daughter'; // Default fallback
  }

  function relationPhraseForApplicant(relationship, assessedName, gender) {
    const r = (relationship || '').toLowerCase();
    const name = assessedName ? escapeHtml(assessedName) : '';
    const isMale = (gender || '').toLowerCase() === 'male';
    const isFemale = (gender || '').toLowerCase() === 'female';
    if (r === 'father') return (isMale ? 'son' : isFemale ? 'daughter' : 'son/daughter') + ' of ' + name;
    if (r === 'mother') return (isMale ? 'son' : isFemale ? 'daughter' : 'son/daughter') + ' of ' + name;
    if (r === 'son') return 'father of ' + name;
    if (r === 'daughter') return 'mother of ' + name;
    if (r === 'spouse') return 'spouse of ' + name;
    if (r === 'grandfather') return (isMale ? 'grandson' : isFemale ? 'granddaughter' : 'grandson/granddaughter') + ' of ' + name;
    if (r === 'grandmother') return (isMale ? 'grandson' : isFemale ? 'granddaughter' : 'grandson/granddaughter') + ' of ' + name;
    if (r === 'self') return 'self';
    if (relationship && name) return relationship + ' of ' + name;
    return '';
  }

  function relationshipOptions(includeBlank) {
    const list = data().relationships || [];
    let opts = includeBlank ? '<option value="">Select relationship</option>' : '';
    list.forEach(function (r) {
      opts += '<option value="' + escapeHtml(r) + '">' + escapeHtml(r) + '</option>';
    });
    return opts;
  }

  function formatAddressLine(addr) {
    if (!addr) return '—';
    const locationParts = [addr.district, addr.state].filter(Boolean);
    let locationStr = locationParts.join(', ');
    if (addr.country) {
      locationStr += (locationStr ? ', ' : '') + addr.country;
      if (addr.pincode) {
        locationStr += '- ' + addr.pincode;
      }
    } else if (addr.pincode) {
      locationStr += (locationStr ? ', ' : '') + addr.pincode;
    }
    const parts = [
      addr.doorNo,
      addr.road,
      addr.area,
      locationStr
    ].filter(Boolean);
    return parts.join(', ') || '—';
  }

  // ——— A: Visa applicants ———
  function getApplicantFields(index) {
    // Country is now a single field shared by all applicants
    const country = byId('country-visiting')?.value ?? '';
    const relationshipToAssessedApplicants = {};
    const numApplicants = byId('applicants-container')?.querySelectorAll('.applicant-block').length || 1;
    for (let j = 0; j < numApplicants; j++) {
      if (j === index) continue;
      if (byId('applicant-is-assessed-' + j)?.checked) {
        const val = byId('applicant-relationship-to-app-' + index + '-' + j)?.value ?? '';
        relationshipToAssessedApplicants[j] = val;
      }
    }
    return {
      name: byId(`applicant-name-${index}`)?.value?.trim() ?? '',
      pan: byId(`applicant-pan-${index}`)?.value?.trim() ?? '',
      passport: byId(`applicant-passport-${index}`)?.value?.trim() ?? '',
      gender: byId(`applicant-gender-${index}`)?.value ?? '',
      country: country,
      purpose: byId(`applicant-purpose-${index}`)?.value?.trim() ?? '',
      parentName: byId(`applicant-parent-${index}`)?.value?.trim() ?? '',
      isAssessed: byId(`applicant-is-assessed-${index}`)?.checked || false,
      relationshipToAssessedApplicants: relationshipToAssessedApplicants,
      address: {
        doorNo: byId(`applicant-door-${index}`)?.value?.trim() ?? '',
        road: byId(`applicant-road-${index}`)?.value?.trim() ?? '',
        area: byId(`applicant-area-${index}`)?.value?.trim() ?? '',
        district: byId(`applicant-district-${index}`)?.value?.trim() ?? '',
        state: byId(`applicant-state-${index}`)?.value ?? '',
        country: byId(`applicant-addr-country-${index}`)?.value ?? '',
        pincode: byId(`applicant-pincode-${index}`)?.value?.trim() ?? ''
      }
    };
  }

  function getApplicantBlockHtml(i) {
    const num = i + 1;
    const copyAddressCheckbox = i > 0 ? `
            <div class="field field-full checkbox-field">
              <label><input type="checkbox" id="applicant-copy-address-${i}" /> Copy address from <span id="applicant-copy-address-label-${i}">${getApplicantDisplayName(i - 1)}</span></label>
            </div>` : '';
    return `
        <div class="applicant-block" data-applicant="${i}">
          <h3>Applicant ${num} <button type="button" class="btn-delete-applicant" aria-label="Delete applicant">Delete</button></h3>
          <div class="grid-2">
            <div class="field">
              <label>Name of person applying for visa <span class="required">*</span></label>
              <input type="text" id="applicant-name-${i}" placeholder="Full name" />
            </div>
            <div class="field">
              <label>PAN <span class="required">*</span></label>
              <input type="text" id="applicant-pan-${i}" placeholder="e.g. ABCPD1234E" maxlength="10" class="pan-input" />
              <span class="field-error" id="applicant-pan-err-${i}"></span>
            </div>
            <div class="field">
              <label>Passport number <span class="required">*</span></label>
              <input type="text" id="applicant-passport-${i}" placeholder="Passport number" />
              <span class="field-error" id="applicant-passport-err-${i}"></span>
            </div>
            <div class="field">
              <label>Gender <span class="required">*</span></label>
              <select id="applicant-gender-${i}">
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div class="field">
              <label>Purpose of visit</label>
              <input type="text" id="applicant-purpose-${i}" placeholder="e.g. Tourism, Business" />
            </div>
            <div class="field">
              <label>Name of parent <span class="required">*</span></label>
              <input type="text" id="applicant-parent-${i}" placeholder="Father's or mother's name" />
            </div>
            <div class="field field-full checkbox-field">
              <label><input type="checkbox" id="applicant-is-assessed-${i}" /> The person whose net worth is assessed is the visa applicant himself/herself</label>
            </div>
            <div class="field field-full applicant-relationships" id="applicant-relationships-${i}"></div>
            ${copyAddressCheckbox}
            <div class="field field-full"><strong>Address</strong></div>
            <div class="field">
              <label>Door No. / House name <span class="required">*</span></label>
              <input type="text" id="applicant-door-${i}" placeholder="Door No. or house name" />
            </div>
            <div class="field">
              <label>Road / Street</label>
              <input type="text" id="applicant-road-${i}" placeholder="Road" />
            </div>
            <div class="field">
              <label>Area / Locality</label>
              <input type="text" id="applicant-area-${i}" placeholder="Area" />
            </div>
            <div class="field">
              <label>District <span class="required">*</span></label>
              <input type="text" id="applicant-district-${i}" placeholder="District" />
            </div>
            <div class="field">
              <label>State (India) <span class="required">*</span></label>
              <select id="applicant-state-${i}">
                ${stateOptions(true, 'Kerala')}
              </select>
            </div>
            <div class="field">
              <label>Country <span class="required">*</span></label>
              <select id="applicant-addr-country-${i}">
                ${countryOptions(true, 'India')}
              </select>
            </div>
            <div class="field">
              <label>Pin code <span class="required">*</span></label>
              <input type="text" id="applicant-pincode-${i}" placeholder="e.g. 682001" maxlength="10" />
            </div>
          </div>
        </div>
      `;
  }

  function renderApplicants(count) {
    const container = byId('applicants-container');
    if (!container) return;
    const n = Math.max(1, parseInt(count, 10) || 1);
    const currentCount = container.querySelectorAll('.applicant-block').length;
    if (n < currentCount) {
      byId('num-applicants').value = String(currentCount);
      return;
    }
    if (currentCount === 0) {
      let html = '';
      for (let i = 0; i < n; i++) html += getApplicantBlockHtml(i);
      container.innerHTML = html;
    } else {
      for (let i = currentCount; i < n; i++) {
        const div = document.createElement('div');
        div.innerHTML = getApplicantBlockHtml(i).trim();
        container.appendChild(div.firstElementChild);
      }
    }
    bindStateCountrySync('applicant');
    bindPanValidation();
    syncAssetCurrencyFromApplicant();
    const numApplicants = container.querySelectorAll('.applicant-block').length;
    container.querySelectorAll('.btn-delete-applicant').forEach(function (btn) {
      btn.disabled = numApplicants <= 1;
    });
    // Update owner dropdowns to include new applicants, but preserve existing selections
    updateAssetOwnerDropdowns(false);
    updateAnnexureOwnerDropdowns(false);
    refreshApplicantRelationshipFields();
    updateApplicantCopyAddressLabels();
    updateAssessedCopyFromApplicantLabels();
    for (let i = 0; i < numApplicants; i++) {
      (function (idx) {
        const nameInput = byId('applicant-name-' + idx);
        if (nameInput) {
          nameInput.addEventListener('blur', function () {
            const formatted = formatNameToProperCase(this.value);
            if (formatted !== this.value) this.value = formatted;
            const cb = byId('applicant-is-assessed-' + (parseInt((this.id || '').replace(/.*-(\d+)$/, '$1'), 10) || 0));
            if (cb && cb.checked) { updateAssetOwnerDropdowns(); updateAnnexureOwnerDropdowns(); }
            refreshApplicantRelationshipFields();
            updateAssessedRelationshipLabels();
            updateApplicantCopyAddressLabels();
            updateAssessedCopyFromApplicantLabels();
          });
          nameInput.addEventListener('input', function () {
            const idNum = parseInt((this.id || '').replace(/.*-(\d+)$/, '$1'), 10) || 0;
            const cb = byId('applicant-is-assessed-' + idNum);
            if (cb && cb.checked) { updateAssetOwnerDropdowns(); updateAnnexureOwnerDropdowns(); }
            refreshApplicantRelationshipFields();
            updateAssessedRelationshipLabels();
            updateApplicantCopyAddressLabels();
            updateAssessedCopyFromApplicantLabels();
          });
        }
        const passportInput = byId('applicant-passport-' + idx);
        if (passportInput) {
          passportInput.addEventListener('input', function () {
            const cursorPos = this.selectionStart;
            const oldValue = this.value;
            const newValue = formatToUppercase(this.value);
            if (newValue !== oldValue) {
              this.value = newValue;
              this.setSelectionRange(cursorPos + newValue.length - oldValue.length, cursorPos + newValue.length - oldValue.length);
            }
            const idNum = parseInt((this.id || '').replace(/.*-(\d+)$/, '$1'), 10) || 0;
            const errEl = byId('applicant-passport-err-' + idNum);
            if (errEl) errEl.textContent = '';
            this.classList.remove('input-error');
          });
          passportInput.addEventListener('blur', function () {
            const formatted = formatToUppercase(this.value);
            if (formatted !== this.value) this.value = formatted;
            const idNum = parseInt((this.id || '').replace(/.*-(\d+)$/, '$1'), 10) || 0;
            const passportValue = this.value.trim();
            const errEl = byId('applicant-passport-err-' + idNum);
            let errorMsg = '';
            let hasError = false;
            if (passportValue) {
              const duplicates = checkDuplicatePassport(passportValue, idNum);
              if (duplicates) { errorMsg = 'Duplicate passport number. Also used by applicant(s): ' + duplicates.join(', '); hasError = true; }
            }
            if (errEl) errEl.textContent = errorMsg;
            this.classList.toggle('input-error', hasError);
          });
        }
        ['applicant-parent-' + idx, 'applicant-road-' + idx, 'applicant-area-' + idx, 'applicant-district-' + idx].forEach(function (id) {
          const el = byId(id);
          if (el) el.addEventListener('blur', function () {
            const formatted = formatNameToProperCase(this.value);
            if (formatted !== this.value) this.value = formatted;
          });
        });
        const checkbox = byId('applicant-is-assessed-' + idx);
        if (checkbox) checkbox.addEventListener('change', function () {
          updateAssetOwnerDropdowns(true);
          updateAnnexureOwnerDropdowns(true);
          refreshApplicantRelationshipFields();
        });
        const copyAddressCb = byId('applicant-copy-address-' + idx);
        if (copyAddressCb && idx >= 1) {
          copyAddressCb.addEventListener('change', function () {
            if (!this.checked) return;
            const prev = idx - 1;
            const fields = ['door', 'road', 'area', 'district', 'pincode'];
            fields.forEach(function (f) {
              const el = byId('applicant-' + f + '-' + idx);
              const src = byId('applicant-' + f + '-' + prev);
              if (el && src) el.value = src.value || '';
            });
            const stateEl = byId('applicant-state-' + idx);
            const stateSrc = byId('applicant-state-' + prev);
            if (stateEl && stateSrc) stateEl.value = stateSrc.value || '';
            const countryEl = byId('applicant-addr-country-' + idx);
            const countrySrc = byId('applicant-addr-country-' + prev);
            if (countryEl && countrySrc) countryEl.value = countrySrc.value || '';
          });
        }
      })(i);
    }
  }

  function renumberApplicantBlocks() {
    const container = byId('applicants-container');
    if (!container) return;
    const blocks = Array.from(container.querySelectorAll('.applicant-block'));
    blocks.forEach(function (block, i) {
      const oldIndex = block.dataset.applicant;
      block.dataset.applicant = String(i);
      block.querySelectorAll('[id^="applicant-"]').forEach(function (el) {
        if (el.id) el.id = el.id.replace(/-(\d+)$/, '-' + i);
      });
      block.querySelectorAll('label[for^="applicant-"]').forEach(function (label) {
        if (label.htmlFor) label.htmlFor = label.htmlFor.replace(/-(\d+)$/, '-' + i);
      });
      const h3 = block.querySelector('h3');
      if (h3) h3.innerHTML = 'Applicant ' + (i + 1) + ' <button type="button" class="btn-delete-applicant" aria-label="Delete applicant">Delete</button>';
    });
    const numApplicantsEl = byId('num-applicants');
    if (numApplicantsEl) numApplicantsEl.value = String(blocks.length);
    container.querySelectorAll('.btn-delete-applicant').forEach(function (btn) {
      btn.disabled = blocks.length <= 1;
    });
    updateAssetOwnerDropdowns(true);
    updateAnnexureOwnerDropdowns(true);
  }

  function bindCountryCurrencyListeners(prefix) {
    const numApplicants = Math.max(1, parseInt(byId('num-applicants')?.value, 10) || 1);
    const numAssessed = Math.max(0, parseInt(byId('num-assessed')?.value, 10) || 0);
    const n = prefix === 'applicant' ? numApplicants : numAssessed;
    for (let i = 0; i < n; i++) {
      const sel = byId(prefix + '-country-' + i);
      const curr = byId(prefix + '-currency-' + i);
      if (sel && curr) {
        sel.addEventListener('change', function () {
          const opt = this.options[this.selectedIndex];
          const cur = opt && opt.getAttribute('data-currency');
          if (cur) curr.value = cur;
        });
      }
    }
  }

  // ——— B: Persons whose net worth is assessed ———
  function getApplicantDisplayName(j) {
    const name = (byId('applicant-name-' + j)?.value || '').trim();
    return name || ('Applicant ' + (j + 1));
  }

  function getAssessedDisplayName(i) {
    const name = (byId('assessed-name-' + i)?.value || '').trim();
    return name || ('Person ' + (i + 1));
  }

  /** Label: "Relation of [otherName] to [toName]" – otherName is the person we're asking about, toName is the person whose form we're filling. */
  function relationshipLabelText(otherName, toName) {
    const other = (otherName || '').trim() || '—';
    const to = (toName || '').trim() || '—';
    return 'Relation of ' + other + ' to ' + to;
  }

  function relationshipLabelHtml(otherName, toName) {
    const other = (otherName || '').trim() || '—';
    const to = (toName || '').trim() || '—';
    return 'Relation of ' + escapeHtml(other) + ' to ' + escapeHtml(to);
  }

  function updateAssessedRelationshipLabels() {
    const container = byId('assessed-container');
    if (!container) return;
    const numAssessed = container.querySelectorAll('.assessed-block').length;
    const numApplicants = byId('applicants-container')?.querySelectorAll('.applicant-block').length || 1;
    for (let i = 0; i < numAssessed; i++) {
      const assessedName = getAssessedDisplayName(i);
      for (let j = 0; j < numApplicants; j++) {
        const el = byId('assessed-relationship-label-' + i + '-' + j);
        if (el) el.textContent = relationshipLabelText(getApplicantDisplayName(j), assessedName);
      }
    }
  }

  function updateApplicantCopyAddressLabels() {
    const numApplicants = byId('applicants-container')?.querySelectorAll('.applicant-block').length || 1;
    for (let i = 1; i < numApplicants; i++) {
      const el = byId('applicant-copy-address-label-' + i);
      if (el) el.textContent = getApplicantDisplayName(i - 1);
    }
  }

  function updateAssessedCopyAddressLabels() {
    const numAssessed = byId('assessed-container')?.querySelectorAll('.assessed-block').length || 0;
    for (let i = 1; i < numAssessed; i++) {
      const el = byId('assessed-copy-address-label-' + i);
      const prevName = (byId('assessed-name-' + (i - 1))?.value || '').trim();
      if (el) el.textContent = prevName || ('Person ' + i);
    }
  }

  function updateAssessedCopyFromApplicantLabels() {
    const numAssessed = byId('assessed-container')?.querySelectorAll('.assessed-block').length || 0;
    const numApplicants = byId('applicants-container')?.querySelectorAll('.applicant-block').length || 1;
    for (let i = 0; i < numAssessed; i++) {
      for (let j = 0; j < numApplicants; j++) {
        const el = byId('assessed-copy-address-from-app-label-' + i + '-' + j);
        if (el) el.textContent = getApplicantDisplayName(j);
      }
    }
  }

  function refreshApplicantRelationshipFields() {
    const applicantsContainer = byId('applicants-container');
    const assessedContainer = byId('assessed-container');
    if (!applicantsContainer || !assessedContainer) return;
    const applicantBlocks = applicantsContainer.querySelectorAll('.applicant-block');
    const assessedBlocks = assessedContainer.querySelectorAll('.assessed-block');
    const numApplicants = applicantBlocks.length;
    const numAssessed = assessedBlocks.length;

    const assessedApplicantIndices = [];
    for (let j = 0; j < numApplicants; j++) {
      if (byId('applicant-is-assessed-' + j)?.checked) assessedApplicantIndices.push(j);
    }

    for (let ai = 0; ai < numApplicants; ai++) {
      const relContainer = byId(`applicant-relationships-${ai}`);
      if (!relContainer) continue;
      let html = '';
      const applicantName = getApplicantDisplayName(ai);
      for (let si = 0; si < numAssessed; si++) {
        const otherName = getAssessedDisplayName(si);
        html += `
            <div class="field">
              <label>${relationshipLabelHtml(otherName, applicantName)} <span class="required">*</span></label>
              <select id="applicant-relationship-${ai}-${si}">
                ${relationshipOptions(true)}
              </select>
            </div>`;
      }
      for (let k = 0; k < assessedApplicantIndices.length; k++) {
        const aj = assessedApplicantIndices[k];
        if (aj === ai) continue;
        const otherName = getApplicantDisplayName(aj);
        html += `
            <div class="field">
              <label>${relationshipLabelHtml(otherName, applicantName)} <span class="required">*</span></label>
              <select id="applicant-relationship-to-app-${ai}-${aj}">
                ${relationshipOptions(true)}
              </select>
            </div>`;
      }
      relContainer.innerHTML = html;
    }

    // Sync values and keep hidden assessed selects in sync (Section B only)
    for (let ai = 0; ai < numApplicants; ai++) {
      for (let si = 0; si < numAssessed; si++) {
        const select = byId(`applicant-relationship-${ai}-${si}`);
        const hidden = byId(`assessed-relationship-${si}-${ai}`);
        if (!select || !hidden) continue;
        select.value = hidden.value || '';
        select.addEventListener('change', function () {
          hidden.value = this.value;
        });
      }
    }
  }

  function getAssessedBlockHtml(i, numApplicants) {
    const n = Math.max(1, numApplicants || 1);
    const assessedPersonName = getAssessedDisplayName(i);
    const relationshipFields = [];
    for (let j = 0; j < n; j++) {
      const displayName = getApplicantDisplayName(j);
      relationshipFields.push(`
            <div class="field assessed-rel-field" style="display:none;">
              <label><span id="assessed-relationship-label-${i}-${j}">${escapeHtml(relationshipLabelText(displayName, assessedPersonName))}</span> <span class="required">*</span></label>
              <select id="assessed-relationship-${i}-${j}">
                ${relationshipOptions(true)}
              </select>
            </div>`);
    }
    const num = i + 1;
    const prevName = i > 0 ? (function () {
      const nm = (byId('assessed-name-' + (i - 1))?.value || '').trim();
      return nm || ('Person ' + i);
    })() : '';
    const copyAddressCheckbox = i > 0 ? `
            <div class="field field-full checkbox-field">
              <label><input type="checkbox" id="assessed-copy-address-${i}" /> Copy address from <span id="assessed-copy-address-label-${i}">${prevName}</span></label>
            </div>` : '';
    const copyFromApplicantCheckboxes = (function () {
      let html = '';
      for (let j = 0; j < n; j++) {
        const appName = getApplicantDisplayName(j);
        html += `
            <div class="field field-full checkbox-field">
              <label><input type="checkbox" id="assessed-copy-address-from-app-${i}-${j}" /> Copy address from <span id="assessed-copy-address-from-app-label-${i}-${j}">${appName}</span></label>
            </div>`;
      }
      return html;
    })();
    return `
        <div class="assessed-block" data-assessed="${i}">
          <h3>Person ${num} <button type="button" class="btn-delete-assessed" aria-label="Delete person">Delete</button></h3>
          <div class="grid-2">
            <div class="field">
              <label>Name <span class="required">*</span></label>
              <input type="text" id="assessed-name-${i}" placeholder="Full name" />
            </div>
            <div class="field">
              <label>PAN <span class="required">*</span></label>
              <input type="text" id="assessed-pan-${i}" placeholder="e.g. ABCPD1234E" maxlength="10" class="pan-input" />
              <span class="field-error" id="assessed-pan-err-${i}"></span>
            </div>
            ${relationshipFields.join('')}
            <div class="field">
              <label>Name of parent (of person whose net worth is assessed) <span class="required">*</span></label>
              <input type="text" id="assessed-parent-${i}" placeholder="Parent's name" />
            </div>
            ${copyAddressCheckbox}
            ${copyFromApplicantCheckboxes}
            <div class="field field-full"><strong>Address</strong></div>
            <div class="field">
              <label>Door No. / House name</label>
              <input type="text" id="assessed-door-${i}" placeholder="Door No. or house name" />
            </div>
            <div class="field">
              <label>Road / Street</label>
              <input type="text" id="assessed-road-${i}" placeholder="Road" />
            </div>
            <div class="field">
              <label>Area / Locality</label>
              <input type="text" id="assessed-area-${i}" placeholder="Area" />
            </div>
            <div class="field">
              <label>District <span class="required">*</span></label>
              <input type="text" id="assessed-district-${i}" placeholder="District" />
            </div>
            <div class="field">
              <label>State (India) <span class="required">*</span></label>
              <select id="assessed-state-${i}">
                ${stateOptions(true, 'Kerala')}
              </select>
            </div>
            <div class="field">
              <label>Country <span class="required">*</span></label>
              <select id="assessed-addr-country-${i}">
                ${countryOptions(true, 'India')}
              </select>
            </div>
            <div class="field">
              <label>Pin code <span class="required">*</span></label>
              <input type="text" id="assessed-pincode-${i}" placeholder="e.g. 682001" maxlength="10" />
            </div>
          </div>
        </div>
      `;
  }

  function getAssessedFields(index, numApplicants) {
    const n = Math.max(1, numApplicants != null ? numApplicants : (byId('applicants-container')?.querySelectorAll('.applicant-block').length || 1));
    const relationshipWithApplicant = [];
    for (let j = 0; j < n; j++) {
      relationshipWithApplicant.push(byId(`assessed-relationship-${index}-${j}`)?.value ?? '');
    }
    return {
      name: byId(`assessed-name-${index}`)?.value?.trim() ?? '',
      pan: byId(`assessed-pan-${index}`)?.value?.trim() ?? '',
      relationship: relationshipWithApplicant[0] ?? '',
      relationshipWithApplicant: relationshipWithApplicant,
      parentName: byId(`assessed-parent-${index}`)?.value?.trim() ?? '',
      address: {
        doorNo: byId(`assessed-door-${index}`)?.value?.trim() ?? '',
        road: byId(`assessed-road-${index}`)?.value?.trim() ?? '',
        area: byId(`assessed-area-${index}`)?.value?.trim() ?? '',
        district: byId(`assessed-district-${index}`)?.value?.trim() ?? '',
        state: byId(`assessed-state-${index}`)?.value ?? '',
        country: byId(`assessed-addr-country-${index}`)?.value ?? '',
        pincode: byId(`assessed-pincode-${index}`)?.value?.trim() ?? ''
      }
    };
  }

  function renderAssessed(count) {
    const container = byId('assessed-container');
    if (!container) return;
    const numApplicants = byId('applicants-container')?.querySelectorAll('.applicant-block').length || 1;
    const n = Math.max(0, parseInt(count, 10) || 0);
    const currentCount = container.querySelectorAll('.assessed-block').length;
    if (n < currentCount) {
      byId('num-assessed').value = String(currentCount);
      return;
    }
    if (currentCount === 0) {
      let html = '';
      for (let i = 0; i < n; i++) html += getAssessedBlockHtml(i, numApplicants);
      container.innerHTML = html;
    } else {
      for (let i = currentCount; i < n; i++) {
        const div = document.createElement('div');
        div.innerHTML = getAssessedBlockHtml(i, numApplicants).trim();
        container.appendChild(div.firstElementChild);
      }
    }
    bindStateCountrySync('assessed');
    bindPanValidation();
    const numAssessed = container.querySelectorAll('.assessed-block').length;
    for (let i = 0; i < numAssessed; i++) {
      // Format assessed name field to proper case
      const nameInput = byId(`assessed-name-${i}`);
      if (nameInput) {
        nameInput.addEventListener('blur', function () {
          const formatted = formatNameToProperCase(this.value);
          if (formatted !== this.value) {
            this.value = formatted;
          }
          updateAssetOwnerDropdowns();
          updateAnnexureOwnerDropdowns();
          updateAssessedCopyAddressLabels();
          updateAssessedCopyFromApplicantLabels();
          refreshApplicantRelationshipFields();
          updateAssessedRelationshipLabels();
        });
        nameInput.addEventListener('input', function () {
          updateAssetOwnerDropdowns();
          updateAnnexureOwnerDropdowns();
          updateAssessedCopyAddressLabels();
          updateAssessedCopyFromApplicantLabels();
          refreshApplicantRelationshipFields();
          updateAssessedRelationshipLabels();
        });
      }
      // Format assessed parent name field to proper case
      const parentInput = byId(`assessed-parent-${i}`);
      if (parentInput) {
        parentInput.addEventListener('blur', function () {
          const formatted = formatNameToProperCase(this.value);
          if (formatted !== this.value) {
            this.value = formatted;
          }
        });
      }
      // Format assessed address fields to proper case
      const roadInput = byId(`assessed-road-${i}`);
      if (roadInput) {
        roadInput.addEventListener('blur', function () {
          const formatted = formatNameToProperCase(this.value);
          if (formatted !== this.value) {
            this.value = formatted;
          }
        });
      }
      const areaInput = byId(`assessed-area-${i}`);
      if (areaInput) {
        areaInput.addEventListener('blur', function () {
          const formatted = formatNameToProperCase(this.value);
          if (formatted !== this.value) {
            this.value = formatted;
          }
        });
      }
      const districtInput = byId(`assessed-district-${i}`);
      if (districtInput) {
        districtInput.addEventListener('blur', function () {
          const formatted = formatNameToProperCase(this.value);
          if (formatted !== this.value) {
            this.value = formatted;
          }
        });
      }
      const copyAddressCb = byId(`assessed-copy-address-${i}`);
      if (copyAddressCb && i >= 1) {
        copyAddressCb.addEventListener('change', function () {
          if (!this.checked) return;
          const prev = i - 1;
          const fields = ['door', 'road', 'area', 'district', 'pincode'];
          fields.forEach(function (f) {
            const el = byId('assessed-' + f + '-' + i);
            const src = byId('assessed-' + f + '-' + prev);
            if (el && src) el.value = src.value || '';
          });
          const stateEl = byId('assessed-state-' + i);
          const stateSrc = byId('assessed-state-' + prev);
          if (stateEl && stateSrc) stateEl.value = stateSrc.value || '';
          const countryEl = byId('assessed-addr-country-' + i);
          const countrySrc = byId('assessed-addr-country-' + prev);
          if (countryEl && countrySrc) countryEl.value = countrySrc.value || '';
        });
      }
      const numApplicantsForCopy = byId('applicants-container')?.querySelectorAll('.applicant-block').length || 1;
      for (let j = 0; j < numApplicantsForCopy; j++) {
        (function (assessedIdx, appIdx) {
          const cb = byId('assessed-copy-address-from-app-' + assessedIdx + '-' + appIdx);
          if (cb) {
            cb.addEventListener('change', function () {
              if (!this.checked) return;
              const fields = ['door', 'road', 'area', 'district', 'pincode'];
              fields.forEach(function (f) {
                const el = byId('assessed-' + f + '-' + assessedIdx);
                const src = byId('applicant-' + f + '-' + appIdx);
                if (el && src) el.value = src.value || '';
              });
              const stateEl = byId('assessed-state-' + assessedIdx);
              const stateSrc = byId('applicant-state-' + appIdx);
              if (stateEl && stateSrc) stateEl.value = stateSrc.value || '';
              const countryEl = byId('assessed-addr-country-' + assessedIdx);
              const countrySrc = byId('applicant-addr-country-' + appIdx);
              if (countryEl && countrySrc) countryEl.value = countrySrc.value || '';
            });
          }
        })(i, j);
      }
    }
    updateAssetOwnerDropdowns();
    refreshApplicantRelationshipFields();
    updateAssessedCopyAddressLabels();
    updateAssessedCopyFromApplicantLabels();
  }

  function refreshAssessedRelationshipFields() {
    const container = byId('assessed-container');
    if (!container) return;
    const numAssessed = container.querySelectorAll('.assessed-block').length;
    if (numAssessed === 0) return;
    const numApplicants = byId('applicants-container')?.querySelectorAll('.applicant-block').length || 1;
    const saved = [];
    for (let i = 0; i < numAssessed; i++) saved.push(getAssessedFields(i, numApplicants));
    container.innerHTML = '';
    if (byId('num-assessed')) byId('num-assessed').value = String(numAssessed);
    for (let i = 0; i < numAssessed; i++) {
      const div = document.createElement('div');
      div.innerHTML = getAssessedBlockHtml(i, numApplicants).trim();
      container.appendChild(div.firstElementChild);
    }
    for (let i = 0; i < numAssessed; i++) {
      const p = saved[i];
      if (!p) continue;
      if (byId(`assessed-name-${i}`)) byId(`assessed-name-${i}`).value = p.name || '';
      if (byId(`assessed-pan-${i}`)) byId(`assessed-pan-${i}`).value = p.pan || '';
      if (byId(`assessed-parent-${i}`)) byId(`assessed-parent-${i}`).value = p.parentName || '';
      const rels = p.relationshipWithApplicant || (p.relationship != null ? [p.relationship] : []);
      for (let j = 0; j < rels.length; j++) {
        const el = byId(`assessed-relationship-${i}-${j}`);
        if (el) el.value = rels[j] || '';
      }
      if (p.address) {
        if (byId(`assessed-door-${i}`)) byId(`assessed-door-${i}`).value = p.address.doorNo || '';
        if (byId(`assessed-road-${i}`)) byId(`assessed-road-${i}`).value = p.address.road || '';
        if (byId(`assessed-area-${i}`)) byId(`assessed-area-${i}`).value = p.address.area || '';
        if (byId(`assessed-district-${i}`)) byId(`assessed-district-${i}`).value = p.address.district || '';
        if (byId(`assessed-state-${i}`)) byId(`assessed-state-${i}`).value = p.address.state || '';
        if (byId(`assessed-addr-country-${i}`)) byId(`assessed-addr-country-${i}`).value = p.address.country || '';
        if (byId(`assessed-pincode-${i}`)) byId(`assessed-pincode-${i}`).value = p.address.pincode || '';
      }
    }
    bindStateCountrySync('assessed');
    bindPanValidation();
    for (let i = 0; i < numAssessed; i++) {
      const nameInput = byId(`assessed-name-${i}`);
      if (nameInput) {
        nameInput.addEventListener('blur', function () {
          const formatted = formatNameToProperCase(this.value);
          if (formatted !== this.value) { this.value = formatted; }
          updateAssetOwnerDropdowns();
          updateAnnexureOwnerDropdowns();
          updateAssessedCopyAddressLabels();
          updateAssessedCopyFromApplicantLabels();
          refreshApplicantRelationshipFields();
          updateAssessedRelationshipLabels();
        });
        nameInput.addEventListener('input', function () {
          updateAssetOwnerDropdowns();
          updateAnnexureOwnerDropdowns();
          updateAssessedCopyAddressLabels();
          updateAssessedCopyFromApplicantLabels();
          refreshApplicantRelationshipFields();
          updateAssessedRelationshipLabels();
        });
      }
      const parentInput = byId(`assessed-parent-${i}`);
      if (parentInput) {
        parentInput.addEventListener('blur', function () {
          const formatted = formatNameToProperCase(this.value);
          if (formatted !== this.value) this.value = formatted;
        });
      }
      ['road', 'area', 'district'].forEach(function (field) {
        const input = byId('assessed-' + field + '-' + i);
        if (input) {
          input.addEventListener('blur', function () {
            const formatted = formatNameToProperCase(this.value);
            if (formatted !== this.value) this.value = formatted;
          });
        }
      });
      const copyAddressCb = byId('assessed-copy-address-' + i);
      if (copyAddressCb && i >= 1) {
        copyAddressCb.addEventListener('change', function () {
          if (!this.checked) return;
          const prev = i - 1;
          const fields = ['door', 'road', 'area', 'district', 'pincode'];
          fields.forEach(function (f) {
            const el = byId('assessed-' + f + '-' + i);
            const src = byId('assessed-' + f + '-' + prev);
            if (el && src) el.value = src.value || '';
          });
          const stateEl = byId('assessed-state-' + i);
          const stateSrc = byId('assessed-state-' + prev);
          if (stateEl && stateSrc) stateEl.value = stateSrc.value || '';
          const countryEl = byId('assessed-addr-country-' + i);
          const countrySrc = byId('assessed-addr-country-' + prev);
          if (countryEl && countrySrc) countryEl.value = countrySrc.value || '';
        });
      }
      for (let j = 0; j < numApplicants; j++) {
        (function (assessedIdx, appIdx) {
          const cb = byId('assessed-copy-address-from-app-' + assessedIdx + '-' + appIdx);
          if (cb) {
            cb.addEventListener('change', function () {
              if (!this.checked) return;
              const fields = ['door', 'road', 'area', 'district', 'pincode'];
              fields.forEach(function (f) {
                const el = byId('assessed-' + f + '-' + assessedIdx);
                const src = byId('applicant-' + f + '-' + appIdx);
                if (el && src) el.value = src.value || '';
              });
              const stateEl = byId('assessed-state-' + assessedIdx);
              const stateSrc = byId('applicant-state-' + appIdx);
              if (stateEl && stateSrc) stateEl.value = stateSrc.value || '';
              const countryEl = byId('assessed-addr-country-' + assessedIdx);
              const countrySrc = byId('applicant-addr-country-' + appIdx);
              if (countryEl && countrySrc) countryEl.value = countrySrc.value || '';
            });
          }
        })(i, j);
      }
    }
    updateAssetOwnerDropdowns();
    updateAssessedCopyAddressLabels();
    updateAssessedCopyFromApplicantLabels();
  }

  function renumberAssessedBlocks() {
    const container = byId('assessed-container');
    if (!container) return;
    const blocks = Array.from(container.querySelectorAll('.assessed-block'));
    blocks.forEach(function (block, i) {
      block.dataset.assessed = String(i);
      block.querySelectorAll('[id^="assessed-"]').forEach(function (el) {
        if (!el.id) return;
        if (/^assessed-relationship-\d+-\d+$/.test(el.id)) {
          el.id = el.id.replace(/^assessed-relationship-\d+-/, 'assessed-relationship-' + i + '-');
        } else if (/^assessed-relationship-label-\d+-\d+$/.test(el.id)) {
          el.id = el.id.replace(/^assessed-relationship-label-\d+-/, 'assessed-relationship-label-' + i + '-');
        } else if (/^assessed-copy-address-from-app-\d+-\d+$/.test(el.id)) {
          el.id = el.id.replace(/^assessed-copy-address-from-app-\d+-/, 'assessed-copy-address-from-app-' + i + '-');
        } else if (/^assessed-copy-address-from-app-label-\d+-\d+$/.test(el.id)) {
          el.id = el.id.replace(/^assessed-copy-address-from-app-label-\d+-/, 'assessed-copy-address-from-app-label-' + i + '-');
        } else {
          el.id = el.id.replace(/-(\d+)$/, '-' + i);
        }
      });
      block.querySelectorAll('label[for^="assessed-"]').forEach(function (label) {
        if (!label.htmlFor) return;
        if (/^assessed-relationship-\d+-\d+$/.test(label.htmlFor)) {
          label.htmlFor = label.htmlFor.replace(/^assessed-relationship-\d+-/, 'assessed-relationship-' + i + '-');
        } else if (/^assessed-relationship-label-\d+-\d+$/.test(label.htmlFor)) {
          label.htmlFor = label.htmlFor.replace(/^assessed-relationship-label-\d+-/, 'assessed-relationship-label-' + i + '-');
        } else if (/^assessed-copy-address-from-app-\d+-\d+$/.test(label.htmlFor)) {
          label.htmlFor = label.htmlFor.replace(/^assessed-copy-address-from-app-\d+-/, 'assessed-copy-address-from-app-' + i + '-');
        } else if (/^assessed-copy-address-from-app-label-\d+-\d+$/.test(label.htmlFor)) {
          label.htmlFor = label.htmlFor.replace(/^assessed-copy-address-from-app-label-\d+-/, 'assessed-copy-address-from-app-label-' + i + '-');
        } else {
          label.htmlFor = label.htmlFor.replace(/-(\d+)$/, '-' + i);
        }
      });
      const h3 = block.querySelector('h3');
      if (h3) h3.innerHTML = 'Person ' + (i + 1) + ' <button type="button" class="btn-delete-assessed" aria-label="Delete person">Delete</button>';
    });
    const numAssessedEl = byId('num-assessed');
    if (numAssessedEl) numAssessedEl.value = String(blocks.length);
    updateAssetOwnerDropdowns(true);
    updateAnnexureOwnerDropdowns(true);
    refreshApplicantRelationshipFields();
  }

  function updateAssetOwnerDropdowns(resetSelection) {
    const tbody = byId('assets-tbody');
    if (!tbody) return;
    const ownerOptions = ownerNameOptions();
    tbody.querySelectorAll('.asset-owner').forEach(function (select) {
      if (select.tagName === 'SELECT') {
        if (!resetSelection) {
          // Preserve currently selected values
          const selected = [];
          Array.from(select.selectedOptions).forEach(function (opt) {
            selected.push(opt.value);
          });
          // Update options
          select.innerHTML = ownerOptions;
          // Restore selections (by value match)
          Array.from(select.options).forEach(function (opt) {
            opt.selected = selected.indexOf(opt.value) >= 0;
          });
        } else {
          // Reset selections
          select.innerHTML = ownerOptions;
        }
      }
    });
    updateAnnexureOwnerDropdowns(resetSelection);
  }

  function updateAnnexureOwnerDropdowns(resetSelection) {
    const ownerOptions = ownerNameOptions();
    document.querySelectorAll('.annex-owner').forEach(function (select) {
      if (select.tagName === 'SELECT') {
        if (!resetSelection) {
          // Preserve currently selected values
          const selected = [];
          Array.from(select.selectedOptions).forEach(function (opt) {
            selected.push(opt.value);
          });
          select.innerHTML = ownerOptions;
          Array.from(select.options).forEach(function (opt) {
            opt.selected = selected.indexOf(opt.value) >= 0;
          });
        } else {
          // Reset selections
          select.innerHTML = ownerOptions;
        }
      }
    });
  }


  function bindStateCountrySync(prefix) {
    const num = prefix === 'applicant' ? (parseInt(byId('num-applicants')?.value, 10) || 1) : Math.max(0, parseInt(byId('num-assessed')?.value, 10) || 0);
    for (let i = 0; i < num; i++) {
      const stateEl = byId(prefix + '-state-' + i);
      const countryEl = byId(prefix + '-addr-country-' + i);
      if (stateEl && countryEl) {
        stateEl.addEventListener('change', function () {
          const states = data().indianStates || [];
          if (states.indexOf(this.value) >= 0) countryEl.value = 'India';
        });
      }
    }
  }

  // ——— Validation ———
  function validateForm() {
    const errors = [];
    const numApplicants = Math.max(1, parseInt(byId('num-applicants')?.value, 10) || 1);
    const numAssessed = Math.max(0, parseInt(byId('num-assessed')?.value, 10) || 0);

    // Collect PAN and passport numbers for duplicate checking
    const panNumbers = [];
    const passportNumbers = [];

    for (let i = 0; i < numApplicants; i++) {
      const a = getApplicantFields(i);
      if (!a.name) errors.push('Applicant ' + (i + 1) + ': Name is required.');
      const panRes = validatePan(a.pan);
      if (!panRes.valid) errors.push('Applicant ' + (i + 1) + ': ' + panRes.msg);
      if (!a.passport) errors.push('Applicant ' + (i + 1) + ': Passport number is required.');
      if (!a.gender) errors.push('Applicant ' + (i + 1) + ': Gender is required.');
      if (!a.parentName) errors.push('Applicant ' + (i + 1) + ': Name of parent is required.');
      const addr = a.address;
      if (!addr.doorNo) errors.push('Applicant ' + (i + 1) + ': Door No./House name is required.');
      if (!addr.district) errors.push('Applicant ' + (i + 1) + ': Address district is required.');
      if (!addr.state) errors.push('Applicant ' + (i + 1) + ': Address state is required.');
      if (!addr.country) errors.push('Applicant ' + (i + 1) + ': Address country is required.');
      if (!addr.pincode) errors.push('Applicant ' + (i + 1) + ': Pin code is required.');
      
      // Collect PAN and passport for duplicate checking (only if valid and not "NA")
      if (a.pan && panRes.valid && panRes.value !== 'NA') {
        const panUpper = a.pan.trim().toUpperCase();
        panNumbers.push({ index: i, pan: panUpper });
      }
      if (a.passport && a.passport.trim()) {
        const passportUpper = a.passport.trim().toUpperCase();
        passportNumbers.push({ index: i, passport: passportUpper });
      }
    }

    // Check for duplicate PAN numbers
    const panMap = new Map();
    panNumbers.forEach(function (item) {
      if (!panMap.has(item.pan)) {
        panMap.set(item.pan, []);
      }
      panMap.get(item.pan).push(item.index);
    });
    panMap.forEach(function (indices, pan) {
      if (indices.length > 1) {
        const applicantNums = indices.map(function (idx) { return idx + 1; }).join(', ');
        errors.push('Duplicate PAN number "' + pan + '" found in applicants: ' + applicantNums + '. Each applicant must have a unique PAN.');
      }
    });

    // Check for duplicate passport numbers
    const passportMap = new Map();
    passportNumbers.forEach(function (item) {
      if (!passportMap.has(item.passport)) {
        passportMap.set(item.passport, []);
      }
      passportMap.get(item.passport).push(item.index);
    });
    passportMap.forEach(function (indices, passport) {
      if (indices.length > 1) {
        const applicantNums = indices.map(function (idx) { return idx + 1; }).join(', ');
        errors.push('Duplicate passport number "' + passport + '" found in applicants: ' + applicantNums + '. Each applicant must have a unique passport number.');
      }
    });

    // When an applicant is "the person whose net worth is assessed", every other applicant must select relationship to them
    for (let j = 0; j < numApplicants; j++) {
      if (!byId('applicant-is-assessed-' + j)?.checked) continue;
      const assessedName = getApplicantDisplayName(j);
      for (let i = 0; i < numApplicants; i++) {
        if (i === j) continue;
        const el = byId('applicant-relationship-to-app-' + i + '-' + j);
        const val = el?.value?.trim();
        if (!val) errors.push('Applicant ' + (i + 1) + ': ' + relationshipLabelText(assessedName, getApplicantDisplayName(i)) + ' (person whose net worth is assessed) is required.');
      }
    }

    for (let i = 0; i < numAssessed; i++) {
      const p = getAssessedFields(i, numApplicants);
      if (!p.name) errors.push('Person assessed ' + (i + 1) + ': Name is required.');
      const panRes = validatePan(p.pan);
      if (!panRes.valid) errors.push('Person assessed ' + (i + 1) + ': ' + panRes.msg);

      // Validate relationship of each applicant to this assessed person.
      // Prefer the visible applicant-side select values; fall back to the saved
      // relationshipWithApplicant array from Section B if needed.
      const rels = p.relationshipWithApplicant || [];
      for (let j = 0; j < numApplicants; j++) {
        const uiEl = byId('applicant-relationship-' + j + '-' + i);
        const uiVal = uiEl?.value?.trim() || '';
        const savedVal = (rels[j] || '').trim();
        const effectiveVal = uiVal || savedVal;
        if (!effectiveVal) {
          errors.push('Person assessed ' + (i + 1) + ': Relationship with Applicant ' + (j + 1) + ' is required.');
        }
      }

      if (!p.parentName) errors.push('Person assessed ' + (i + 1) + ': Name of parent is required.');
      const addr = p.address;
      if (!addr.district) errors.push('Person assessed ' + (i + 1) + ': Address district is required.');
      if (!addr.state) errors.push('Person assessed ' + (i + 1) + ': Address state is required.');
      if (!addr.country) errors.push('Person assessed ' + (i + 1) + ': Address country is required.');
      if (!addr.pincode) errors.push('Person assessed ' + (i + 1) + ': Pin code is required.');
    }

    // Validate Place and Date
    const place = (byId('place')?.value || '').trim();
    if (!place) errors.push('Place is required.');
    const signingDate = byId('signing-date')?.value || '';
      if (!signingDate) errors.push('Date is required.');

      // Validate Country visiting
      const countryVisiting = byId('country-visiting')?.value || '';
      if (!countryVisiting) errors.push('Country visiting is required.');

      // Validate Conversion rate
      const conversionRate = (byId('conversion-rate')?.value || '').trim();
      if (!conversionRate) errors.push('Conversion rate is required.');

    // Validate Annexure 1 fields
    const numImmovable = Math.max(0, parseInt(byId('annex-num-immovable')?.value, 10) || 0);
    const numMovable = Math.max(0, parseInt(byId('annex-num-movable')?.value, 10) || 0);
    const numSavings = Math.max(0, parseInt(byId('annex-num-savings')?.value, 10) || 0);

    // Validate Immovable Property
    for (let i = 0; i < numImmovable; i++) {
      const type = byId(`annex-immovable-type-${i}`)?.value || '';
      const ownerEl = byId(`annex-immovable-owner-${i}`);
      const owners = [];
      if (ownerEl) {
        Array.from(ownerEl.selectedOptions).forEach(function (opt) {
          if (opt.value) owners.push(opt.value);
        });
      }
      const buildingNumber = (byId(`annex-immovable-building-${i}`)?.value || '').trim();
      const surveyNumber = (byId(`annex-immovable-survey-${i}`)?.value || '').trim();
      const area = (byId(`annex-immovable-area-${i}`)?.value || '').trim();
      const unit = byId(`annex-immovable-unit-${i}`)?.value || '';
      const village = (byId(`annex-immovable-village-${i}`)?.value || '').trim();
      const taluk = (byId(`annex-immovable-taluk-${i}`)?.value || '').trim();
      const district = (byId(`annex-immovable-district-${i}`)?.value || '').trim();
      const state = (byId(`annex-immovable-state-${i}`)?.value || '').trim();
      const inr = (byId(`annex-immovable-inr-${i}`)?.value || '').trim();

      if (!type) errors.push('Immovable Property ' + (i + 1) + ': Type is required.');
      if (owners.length === 0) errors.push('Immovable Property ' + (i + 1) + ': Owner Name is required.');
      // Building Number is optional (no validation)
      if (!surveyNumber) errors.push('Immovable Property ' + (i + 1) + ': Survey Number is required.');
      if (!area) errors.push('Immovable Property ' + (i + 1) + ': Area is required.');
      if (!unit) errors.push('Immovable Property ' + (i + 1) + ': Unit is required.');
      if (!village) errors.push('Immovable Property ' + (i + 1) + ': Village is required.');
      if (!taluk) errors.push('Immovable Property ' + (i + 1) + ': Taluk is required.');
      if (!district) errors.push('Immovable Property ' + (i + 1) + ': District is required.');
      if (!state) errors.push('Immovable Property ' + (i + 1) + ': State is required.');
      if (!inr) errors.push('Immovable Property ' + (i + 1) + ': Value (INR) is required.');
    }

    // Validate Movable Property
    for (let i = 0; i < numMovable; i++) {
      const type = byId(`annex-movable-type-${i}`)?.value || '';
      const ownerEl = byId(`annex-movable-owner-${i}`);
      const owners = [];
      if (ownerEl) {
        Array.from(ownerEl.selectedOptions).forEach(function (opt) {
          if (opt.value) owners.push(opt.value);
        });
      }
      const weight = (byId(`annex-movable-weight-${i}`)?.value || '').trim();
      const dpAccount = (byId(`annex-movable-dp-${i}`)?.value || '').trim();
      const valuationDate = byId(`annex-movable-date-${i}`)?.value || '';
      const company = (byId(`annex-movable-company-${i}`)?.value || '').trim();
      const model = (byId(`annex-movable-model-${i}`)?.value || '').trim();
      const vehicleNumber = (byId(`annex-movable-vehicle-${i}`)?.value || '').trim();
      const inr = (byId(`annex-movable-inr-${i}`)?.value || '').trim();

      if (!type) errors.push('Movable Property ' + (i + 1) + ': Type is required.');
      if ((type === 'shares' || type === 'debenture' || type === 'mutual-fund' || type === 'motor-vehicle') && owners.length === 0) {
        errors.push('Movable Property ' + (i + 1) + ': Owner Name is required.');
      }
      if ((type === 'gold' || type === 'silver') && !weight) {
        errors.push('Movable Property ' + (i + 1) + ': Weight is required.');
      }
      if ((type === 'shares' || type === 'debenture') && !dpAccount) {
        errors.push('Movable Property ' + (i + 1) + ': DP Account Number is required.');
      }
      if ((type === 'shares' || type === 'debenture' || type === 'mutual-fund') && !valuationDate) {
        errors.push('Movable Property ' + (i + 1) + ': Valuation Date is required.');
      }
      if (type === 'mutual-fund' && !company) {
        errors.push('Movable Property ' + (i + 1) + ': Company/Broker Name is required.');
      }
      if (type === 'motor-vehicle' && !model) {
        errors.push('Movable Property ' + (i + 1) + ': Model Name is required.');
      }
      if (type === 'motor-vehicle' && !vehicleNumber) {
        errors.push('Movable Property ' + (i + 1) + ': Vehicle Number is required.');
      }
      if (!inr) errors.push('Movable Property ' + (i + 1) + ': Value (INR) is required.');
    }

    // Validate Savings
    for (let i = 0; i < numSavings; i++) {
      const type = byId(`annex-savings-type-${i}`)?.value || '';
      const ownerEl = byId(`annex-savings-owner-${i}`);
      const owners = [];
      if (ownerEl) {
        Array.from(ownerEl.selectedOptions).forEach(function (opt) {
          if (opt.value) owners.push(opt.value);
        });
      }
      const bankType = byId(`annex-savings-bank-type-${i}`)?.value || '';
      const accountNumber = (byId(`annex-savings-account-${i}`)?.value || '').trim();
      const bankName = (byId(`annex-savings-bank-${i}`)?.value || '').trim();
      const valuationDate = byId(`annex-savings-date-${i}`)?.value || '';
      const policyNumber = (byId(`annex-savings-policy-${i}`)?.value || '').trim();
      const insurerName = (byId(`annex-savings-insurer-${i}`)?.value || '').trim();
      const inr = (byId(`annex-savings-inr-${i}`)?.value || '').trim();

      if (!type) errors.push('Savings ' + (i + 1) + ': Type is required.');
      if (owners.length === 0) errors.push('Savings ' + (i + 1) + ': Owner Name is required.');
      if (type === 'bank-account' && !bankType) {
        errors.push('Savings ' + (i + 1) + ': Bank Account Type is required.');
      }
      if ((type === 'bank-account' || type === 'ppf' || type === 'epf' || type === 'nps') && !accountNumber) {
        errors.push('Savings ' + (i + 1) + ': Account Number is required.');
      }
      if (type === 'bank-account' && !bankName) {
        errors.push('Savings ' + (i + 1) + ': Bank Name is required.');
      }
      if (!valuationDate) errors.push('Savings ' + (i + 1) + ': Valuation Date is required.');
      if (type === 'life-insurance' && !policyNumber) {
        errors.push('Savings ' + (i + 1) + ': Policy Number is required.');
      }
      if (type === 'life-insurance' && !insurerName) {
        errors.push('Savings ' + (i + 1) + ': Insurer Name is required.');
      }
      if (!inr) errors.push('Savings ' + (i + 1) + ': Value (INR) is required.');
    }

    return errors;
  }

  /** Infer field ID from validation error message so we can scroll to it when the error is clicked. */
  function getFieldIdForValidationError(msg) {
    if (!msg || typeof msg !== 'string') return null;
    const m = msg;
    let match;
    // Applicant N: ...
    match = m.match(/^Applicant (\d+): Name is required\.$/);
    if (match) return 'applicant-name-' + (parseInt(match[1], 10) - 1);
    match = m.match(/^Applicant (\d+): .*$/);
    if (match) {
      const i = parseInt(match[1], 10) - 1;
      if (/PAN|pan/.test(m)) return 'applicant-pan-' + i;
      if (/Passport/.test(m)) return 'applicant-passport-' + i;
      if (/Gender/.test(m)) return 'applicant-gender-' + i;
      if (/Name of parent|parent/.test(m)) return 'applicant-parent-' + i;
      if (/Door No|House name/.test(m)) return 'applicant-door-' + i;
      if (/Address district|district/.test(m)) return 'applicant-district-' + i;
      if (/Address state|state/.test(m)) return 'applicant-state-' + i;
      if (/Address country|country/.test(m)) return 'applicant-addr-country-' + i;
      if (/Pin code|pincode/.test(m)) return 'applicant-pincode-' + i;
      if (/relationship|Relation of/.test(m)) return 'applicant-relationships-' + i;
    }
    // Person assessed N: ...
    match = m.match(/^Person assessed (\d+): Name is required\.$/);
    if (match) return 'assessed-name-' + (parseInt(match[1], 10) - 1);
    match = m.match(/^Person assessed (\d+): Relationship with Applicant (\d+) is required\.$/);
    if (match) return 'applicant-relationship-' + (parseInt(match[2], 10) - 1) + '-' + (parseInt(match[1], 10) - 1);
    match = m.match(/^Person assessed (\d+): .*$/);
    if (match) {
      const i = parseInt(match[1], 10) - 1;
      if (/PAN|pan/.test(m)) return 'assessed-pan-' + i;
      if (/Name of parent|parent/.test(m)) return 'assessed-parent-' + i;
      if (/district/.test(m)) return 'assessed-district-' + i;
      if (/state/.test(m)) return 'assessed-state-' + i;
      if (/country/.test(m)) return 'assessed-addr-country-' + i;
      if (/Pin code|pincode/.test(m)) return 'assessed-pincode-' + i;
    }
    // Place, Date, Country visiting, Conversion rate
    if (/^Place is required\.$/.test(m)) return 'place';
    if (/^Date is required\.$/.test(m)) return 'signing-date';
    if (/^Country visiting is required\.$/.test(m)) return 'country-visiting';
    if (/^Conversion rate is required\.$/.test(m)) return 'conversion-rate';
    // Annexure Immovable
    match = m.match(/^Immovable Property (\d+): (.+) is required\.$/);
    if (match) {
      const i = parseInt(match[1], 10) - 1;
      const part = match[2];
      if (/^Type/.test(part)) return 'annex-immovable-type-' + i;
      if (/Owner/.test(part)) return 'annex-immovable-owner-' + i;
      if (/Survey/.test(part)) return 'annex-immovable-survey-' + i;
      if (/^Area/.test(part)) return 'annex-immovable-area-' + i;
      if (/^Unit/.test(part)) return 'annex-immovable-unit-' + i;
      if (/Village/.test(part)) return 'annex-immovable-village-' + i;
      if (/Taluk/.test(part)) return 'annex-immovable-taluk-' + i;
      if (/District/.test(part)) return 'annex-immovable-district-' + i;
      if (/State/.test(part)) return 'annex-immovable-state-' + i;
      if (/Value \(INR\)/.test(part)) return 'annex-immovable-inr-' + i;
      return 'annex-immovable-type-' + i;
    }
    // Annexure Movable
    match = m.match(/^Movable Property (\d+): (.+) is required\.$/);
    if (match) {
      const i = parseInt(match[1], 10) - 1;
      const part = match[2];
      if (/^Type/.test(part)) return 'annex-movable-type-' + i;
      if (/Owner/.test(part)) return 'annex-movable-owner-' + i;
      if (/Weight/.test(part)) return 'annex-movable-weight-' + i;
      if (/DP Account/.test(part)) return 'annex-movable-dp-' + i;
      if (/Valuation Date/.test(part)) return 'annex-movable-date-' + i;
      if (/Company|Broker/.test(part)) return 'annex-movable-company-' + i;
      if (/Model/.test(part)) return 'annex-movable-model-' + i;
      if (/Vehicle Number/.test(part)) return 'annex-movable-vehicle-' + i;
      if (/Value \(INR\)/.test(part)) return 'annex-movable-inr-' + i;
      return 'annex-movable-type-' + i;
    }
    // Annexure Savings
    match = m.match(/^Savings (\d+): (.+) is required\.$/);
    if (match) {
      const i = parseInt(match[1], 10) - 1;
      const part = match[2];
      if (/^Type/.test(part)) return 'annex-savings-type-' + i;
      if (/Owner/.test(part)) return 'annex-savings-owner-' + i;
      if (/Bank Account Type/.test(part)) return 'annex-savings-bank-type-' + i;
      if (/Account Number/.test(part)) return 'annex-savings-account-' + i;
      if (/Bank Name/.test(part)) return 'annex-savings-bank-' + i;
      if (/Valuation Date/.test(part)) return 'annex-savings-date-' + i;
      if (/Policy Number/.test(part)) return 'annex-savings-policy-' + i;
      if (/Insurer/.test(part)) return 'annex-savings-insurer-' + i;
      if (/Value \(INR\)/.test(part)) return 'annex-savings-inr-' + i;
      return 'annex-savings-type-' + i;
    }
    return null;
  }

  function showValidationErrors(errors) {
    const box = byId('validation-errors');
    if (!box) return;
    const listItems = errors.map(function (e) {
      const msg = typeof e === 'string' ? e : (e && e.msg) ? e.msg : String(e);
      const fieldId = (typeof e === 'object' && e && e.fieldId) ? e.fieldId : getFieldIdForValidationError(msg);
      const safeMsg = escapeHtml(msg);
      if (fieldId) {
        return '<li class="validation-error-link" data-field-id="' + escapeHtml(fieldId) + '" tabindex="0" role="button">' + safeMsg + '</li>';
      }
      return '<li>' + safeMsg + '</li>';
    });
    box.innerHTML = '<ul>' + listItems.join('') + '</ul>';
    box.classList.add('visible');
    // Click or key (Enter/Space) on error item: scroll to field and focus it
    box.querySelectorAll('.validation-error-link').forEach(function (li) {
      const fieldId = li.getAttribute('data-field-id');
      if (!fieldId) return;
      function goToField() {
        const el = byId(fieldId);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = el.querySelector && el.querySelector('input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(focusable.tagName)) {
          focusable.focus();
        } else if (el.focus && typeof el.focus === 'function') {
          el.focus();
        } else if (el.querySelector) {
          const firstInput = el.querySelector('input, select, textarea');
          if (firstInput) firstInput.focus();
        }
      }
      li.addEventListener('click', goToField);
      li.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          goToField();
        }
      });
    });
  }

  function clearValidationErrors() {
    const box = byId('validation-errors');
    if (box) {
      box.innerHTML = '';
      box.classList.remove('visible');
    }
    document.querySelectorAll('.field-error').forEach(function (el) { el.textContent = ''; });
    document.querySelectorAll('.field input, .field select').forEach(function (el) { el.classList.remove('input-error'); });
  }

  // ——— E: Assets ———
  function getAssetRows() {
    const rows = [];
    const tbody = byId('assets-tbody');
    if (!tbody) return rows;
    tbody.querySelectorAll('tr').forEach(function (tr) {
      const cat = tr.dataset.category || '';
      const descEl = tr.querySelector('.asset-desc');
      const desc = descEl ? (descEl.tagName === 'SELECT' ? descEl.value : descEl.value) : '';
      const ownerEl = tr.querySelector('.asset-owner');
      let owners = [];
      if (ownerEl && ownerEl.tagName === 'SELECT') {
        Array.from(ownerEl.selectedOptions).forEach(function (opt) {
          if (opt.value) owners.push(opt.value);
        });
      }
      const inr = tr.querySelector('.asset-inr')?.value ?? '';
      const fc = tr.querySelector('.asset-fc')?.value ?? '';
      if (cat || desc || inr || fc) {
        rows.push({
          category: CATEGORIES[cat] || cat,
          description: desc,
          owners: owners,
          inr: inr,
          foreignCurrency: fc
        });
      }
    });
    return rows;
  }

  function getAssetCurrency() {
    return (byId('asset-currency')?.value || '').trim();
  }

  /** Returns conversion rate rounded to 2 decimal places for use in foreign currency calculation. */
  function getConversionRateNum() {
    const v = (byId('conversion-rate')?.value || '').trim();
    if (!v) return null;
    const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
    if (isNaN(n) || n <= 0) return null;
    return Math.round(n * 100) / 100;
  }

  /** Rate stored as: 1 foreign currency = X INR. So value_fc = value_inr / X. */
  function recalcAnnexureForeignValue(fcInputId, inrValue) {
    const fcInput = byId(fcInputId);
    if (!fcInput) return;
    const rate = getConversionRateNum();
    if (!rate || rate <= 0) {
      fcInput.value = '';
      return;
    }
    const inr = parseFloat(String(inrValue || '').replace(/[^0-9.-]/g, ''));
    if (isNaN(inr)) {
      fcInput.value = '';
      return;
    }
    fcInput.value = (inr / rate).toFixed(2);
  }

  function recalcAllAnnexureForeignValues() {
    document.querySelectorAll('.annex-inr').forEach(function (inrInput) {
      const id = inrInput.id;
      if (id.includes('immovable')) {
        const idx = id.replace('annex-immovable-inr-', '');
        recalcAnnexureForeignValue(`annex-immovable-fc-${idx}`, inrInput.value);
      } else if (id.includes('movable')) {
        const idx = id.replace('annex-movable-inr-', '');
        recalcAnnexureForeignValue(`annex-movable-fc-${idx}`, inrInput.value);
      } else if (id.includes('savings')) {
        const idx = id.replace('annex-savings-inr-', '');
        recalcAnnexureForeignValue(`annex-savings-fc-${idx}`, inrInput.value);
      }
    });
  }

  function recalcAllAssetForeignValues() {
    const rate = getConversionRateNum();
    const tbody = byId('assets-tbody');
    if (!tbody || rate == null) return;
    tbody.querySelectorAll('tr').forEach(function (tr) {
      const inrInput = tr.querySelector('.asset-inr');
      const fcInput = tr.querySelector('.asset-fc');
      if (!inrInput || !fcInput) return;
      const inrVal = parseFloat(String(inrInput.value || '').replace(/[^0-9.-]/g, ''));
      if (isNaN(inrVal) || inrVal < 0) {
        fcInput.value = '';
        return;
      }
      fcInput.value = (inrVal / rate).toFixed(2);
    });
  }

  function syncAssetCurrencyFromApplicant() {
    const countrySel = byId('country-visiting');
    let currency = '';
    if (countrySel && countrySel.selectedIndex >= 0) {
      const opt = countrySel.options[countrySel.selectedIndex];
      currency = opt ? (opt.getAttribute('data-currency') || '') : '';
    }
    const el = byId('asset-currency');
    if (el) el.value = currency;
  }

  function fetchRateAsOnDate() {
    const dateEl = byId('signing-date');
    const dateStr = (dateEl?.value || '').trim();
    const toCurrency = getAssetCurrency();
    const statusEl = byId('rate-status');
    function setStatus(msg, isError) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.className = 'rate-status ' + (isError ? 'error' : 'success');
    }
    if (!dateStr) {
      setStatus('Please set date of signing first.', true);
      return;
    }
    if (!toCurrency) {
      setStatus('Select country for first applicant to set currency.', true);
      return;
    }
    if (toCurrency === 'INR') {
      setStatus('Foreign currency is INR; no conversion needed.', true);
      return;
    }
    setStatus('Fetching…', false);
    const dateForApi = dateStr;
    const url = 'https://api.frankfurter.app/' + dateForApi + '?from=INR&to=' + encodeURIComponent(toCurrency);
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Rate not available for this date.');
        return res.json();
      })
      .then(function (data) {
        const rateToFc = data.rates && data.rates[toCurrency];
        if (rateToFc == null || rateToFc <= 0) {
          setStatus('Rate not found for this date.', true);
          return;
        }
        const inrPerOneFc = 1 / rateToFc;
        const rateInput = byId('conversion-rate');
        if (rateInput) rateInput.value = inrPerOneFc.toFixed(4);
        recalcAllAssetForeignValues();
        recalcAllAnnexureForeignValues();
        setStatus('1 ' + toCurrency + ' = ' + inrPerOneFc.toFixed(4) + ' INR (as on ' + (data.date || dateStr) + ')', false);
      })
      .catch(function (err) {
        setStatus('Could not fetch rate. Enter rate manually. (' + (err.message || 'Network error') + ')', true);
      });
  }

  function addAssetRow(category, index) {
    const tbody = byId('assets-tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.dataset.category = category;
    tr.dataset.index = index;
    const rowId = category + '-' + index;
    tr.innerHTML = `
      <td class="col-cat">${escapeHtml(CATEGORIES[category])}</td>
      <td class="col-desc"><select class="asset-desc" id="asset-desc-${rowId}">${assetSubtypeOptions(category)}</select></td>
      <td class="col-owner"><select class="asset-owner" id="asset-owner-${rowId}" multiple size="2" style="min-height:60px;">${ownerNameOptions()}</select><small class="hint">Hold Ctrl/Cmd to select multiple</small></td>
      <td class="col-inr"><input type="text" class="asset-inr" id="asset-inr-${rowId}" placeholder="INR" inputmode="decimal" /></td>
      <td class="col-fc"><input type="text" class="asset-fc" id="asset-fc-${rowId}" placeholder="Auto" inputmode="decimal" readonly class="readonly" /></td>
      <td class="col-del"><button type="button" class="btn-del" data-id="${rowId}" aria-label="Remove row">&times;</button></td>
    `;
    tbody.appendChild(tr);
    const inrInput = tr.querySelector('.asset-inr');
    if (inrInput) {
      inrInput.addEventListener('input', recalcAllAssetForeignValues);
      inrInput.addEventListener('blur', recalcAllAssetForeignValues);
    }
    const delBtn = tr.querySelector('.btn-del');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        tr.remove();
        updateAssetCounts();
      });
    }
  }

  function renderAssetsByCategory() {
    const numImmovable = Math.max(0, parseInt(byId('num-immovable')?.value, 10) || 0);
    const numMovable = Math.max(0, parseInt(byId('num-movable')?.value, 10) || 0);
    const numSavings = Math.max(0, parseInt(byId('num-savings')?.value, 10) || 0);
    const tbody = byId('assets-tbody');
    if (!tbody) return;
    
    // Save existing data before modifying rows
    const existingData = {};
    tbody.querySelectorAll('tr').forEach(function (tr) {
      const cat = tr.dataset.category;
      const idx = parseInt(tr.dataset.index, 10);
      if (cat && !isNaN(idx)) {
        const key = cat + '-' + idx;
        const descEl = tr.querySelector('.asset-desc');
        const ownerSelect = tr.querySelector('.asset-owner');
        const inrInput = tr.querySelector('.asset-inr');
        const fcInput = tr.querySelector('.asset-fc');
        const owners = [];
        if (ownerSelect && ownerSelect.tagName === 'SELECT') {
          Array.from(ownerSelect.selectedOptions).forEach(function (opt) {
            if (opt.value) owners.push(opt.value);
          });
        }
        existingData[key] = {
          description: descEl ? (descEl.tagName === 'SELECT' ? descEl.value : descEl.value) : '',
          owners: owners,
          inr: inrInput ? inrInput.value : '',
          foreignCurrency: fcInput ? fcInput.value : ''
        };
      }
    });
    
    // Count existing rows per category
    const existingCounts = { immovable: 0, movable: 0, savings: 0 };
    tbody.querySelectorAll('tr').forEach(function (tr) {
      const cat = tr.dataset.category;
      if (cat && existingCounts.hasOwnProperty(cat)) {
        existingCounts[cat]++;
      }
    });
    
    if (existingCounts.immovable > numImmovable) byId('num-immovable').value = String(existingCounts.immovable);
    if (existingCounts.movable > numMovable) byId('num-movable').value = String(existingCounts.movable);
    if (existingCounts.savings > numSavings) byId('num-savings').value = String(existingCounts.savings);

    // Add new rows (if count increased) or update existing ones
    // Immovable
    for (let i = 0; i < numImmovable; i++) {
      const key = 'immovable-' + i;
      const existingRow = tbody.querySelector(`tr[data-category="immovable"][data-index="${i}"]`);
      if (!existingRow) {
        addAssetRow('immovable', i);
        // Restore data if available
        setTimeout(function () {
          const newRow = tbody.querySelector(`tr[data-category="immovable"][data-index="${i}"]`);
          if (newRow && existingData[key]) {
            restoreAssetRowData(newRow, existingData[key]);
          }
        }, 10);
      } else if (existingData[key]) {
        restoreAssetRowData(existingRow, existingData[key]);
      }
    }
    // Movable
    for (let i = 0; i < numMovable; i++) {
      const key = 'movable-' + i;
      const existingRow = tbody.querySelector(`tr[data-category="movable"][data-index="${i}"]`);
      if (!existingRow) {
        addAssetRow('movable', i);
        setTimeout(function () {
          const newRow = tbody.querySelector(`tr[data-category="movable"][data-index="${i}"]`);
          if (newRow && existingData[key]) {
            restoreAssetRowData(newRow, existingData[key]);
          }
        }, 10);
      } else if (existingData[key]) {
        restoreAssetRowData(existingRow, existingData[key]);
      }
    }
    // Savings
    for (let i = 0; i < numSavings; i++) {
      const key = 'savings-' + i;
      const existingRow = tbody.querySelector(`tr[data-category="savings"][data-index="${i}"]`);
      if (!existingRow) {
        addAssetRow('savings', i);
        setTimeout(function () {
          const newRow = tbody.querySelector(`tr[data-category="savings"][data-index="${i}"]`);
          if (newRow && existingData[key]) {
            restoreAssetRowData(newRow, existingData[key]);
          }
        }, 10);
      } else if (existingData[key]) {
        restoreAssetRowData(existingRow, existingData[key]);
      }
    }
    
    // Update owner dropdowns in all rows
    updateAssetOwnerDropdowns();
  }

  function restoreAssetRowData(row, data) {
    const descEl = row.querySelector('.asset-desc');
    const ownerSelect = row.querySelector('.asset-owner');
    const inrInput = row.querySelector('.asset-inr');
    const fcInput = row.querySelector('.asset-fc');
    if (descEl && data.description) {
      if (descEl.tagName === 'SELECT') {
        descEl.value = data.description;
      } else {
        descEl.value = data.description;
      }
    }
    if (ownerSelect && ownerSelect.tagName === 'SELECT' && data.owners && data.owners.length) {
      Array.from(ownerSelect.options).forEach(function (opt) {
        opt.selected = data.owners.indexOf(opt.value) >= 0;
      });
    }
    if (inrInput && data.inr) inrInput.value = data.inr;
    if (fcInput && data.foreignCurrency) fcInput.value = data.foreignCurrency;
  }

  function updateAssetCounts() {
    const tbody = byId('assets-tbody');
    if (!tbody) return;
    const counts = { immovable: 0, movable: 0, savings: 0 };
    tbody.querySelectorAll('tr').forEach(function (tr) {
      const cat = tr.dataset.category;
      if (cat && counts.hasOwnProperty(cat)) counts[cat]++;
    });
    if (byId('num-immovable')) byId('num-immovable').value = String(counts.immovable);
    if (byId('num-movable')) byId('num-movable').value = String(counts.movable);
    if (byId('num-savings')) byId('num-savings').value = String(counts.savings);
  }

  function initAssets() {
    renderAssetsByCategory();
  }

  function bindConversionRateListeners() {
    const rateEl = byId('conversion-rate');
    if (rateEl) {
      rateEl.addEventListener('input', function () {
        recalcAllAssetForeignValues();
        recalcAllAnnexureForeignValues();
      });
      rateEl.addEventListener('change', function () {
        recalcAllAssetForeignValues();
        recalcAllAnnexureForeignValues();
      });
    }
    const fetchBtn = byId('fetch-rate-btn');
    if (fetchBtn) fetchBtn.addEventListener('click', fetchRateAsOnDate);
  }

  // ——— Certificate preview ———
  function buildCertificateHtml() {
    const numApplicants = Math.max(1, parseInt(byId('num-applicants')?.value, 10) || 1);
    const numAssessed = Math.max(0, parseInt(byId('num-assessed')?.value, 10) || 0);

    const applicants = [];
    for (let i = 0; i < numApplicants; i++) applicants.push(getApplicantFields(i));

    const assessed = [];
    for (let i = 0; i < numAssessed; i++) assessed.push(getAssessedFields(i, numApplicants));

    const place = (byId('place')?.value || 'Kochi').trim();
    const signingDate = byId('signing-date')?.value ?? '';
    const dateFormatted = formatDateDDMMYYYY(signingDate);

    const udin = (byId('udin')?.value || '').trim();
    const foreignCurrencyLabel = (byId('asset-currency')?.value || 'FC').trim() || 'FC';
    const conversionRate = (byId('conversion-rate')?.value || '').trim();
    // Check which applicants have their checkbox checked
    const assessedApplicantIndices = [];
    applicants.forEach(function (a, i) {
      if (a.isAssessed) {
        assessedApplicantIndices.push(i);
      }
    });
    const assessedIsApplicant = assessedApplicantIndices.length > 0; // For backward compatibility
    const totals = getAssetTotalsByCategory();

    const totalInr = (totals.immovable?.inr || 0) + (totals.movable?.inr || 0) + (totals.savings?.inr || 0);
    const totalFc = (totals.immovable?.fc || 0) + (totals.movable?.fc || 0) + (totals.savings?.fc || 0);

    function assessedDetails() {
      const parts = [];
      const seenNames = new Map(); // Track names and their full details (PAN, parent, address)
      
      // Collect all persons to include (applicants if checkbox checked + assessed persons)
      const allPersons = [];
      
      // Include applicants whose checkbox is checked
      assessedApplicantIndices.forEach(function (idx) {
        const a = applicants[idx];
        if (a) {
          const nameKey = (a.name || '').trim().toLowerCase();
          if (!seenNames.has(nameKey)) {
            seenNames.set(nameKey, {
              name: a.name,
              pan: a.pan,
              parentName: a.parentName,
              address: a.address,
              gender: a.gender,
              isApplicant: true,
              applicantIndex: idx
            });
          }
          allPersons.push({ name: a.name, nameKey: nameKey, isApplicant: true, applicantIndex: idx });
        }
      });
      
      // Include other assessed persons
      if (assessed.length > 0) {
        assessed.forEach(function (p) {
          const nameKey = (p.name || '').trim().toLowerCase();
          
          // Skip if this assessed person matches any checked applicant exactly
          let skip = false;
          assessedApplicantIndices.forEach(function (idx) {
            const a = applicants[idx];
            if (a && p.name === a.name && p.pan === a.pan) {
              skip = true;
            }
          });
          if (skip) return;
          
          // Store full details if not seen before
          if (!seenNames.has(nameKey)) {
            seenNames.set(nameKey, {
              name: p.name,
              pan: p.pan,
              parentName: p.parentName,
              address: p.address,
              relationship: p.relationship,
              relationshipWithApplicant: p.relationshipWithApplicant || [],
              isApplicant: false
            });
          }
          allPersons.push({ name: p.name, nameKey: nameKey, isApplicant: false });
        });
      }
      
      // Build the output: show full details only once per person
      // If applicant is also assessed, don't show PAN/parent/address here (show in applicantDetailsFull instead)
      const shownFullDetails = new Set();
      allPersons.forEach(function (person, index) {
        const details = seenNames.get(person.nameKey);
        if (!details) return;
        
        const isFirstOccurrence = !shownFullDetails.has(person.nameKey);
        shownFullDetails.add(person.nameKey);
        
        let part = escapeHtml(details.name);
        
        // If this person is an applicant (when checkbox is checked), don't show PAN/parent/address here
        if (details.isApplicant) {
          // Just show the name with "the applicant for visa himself/herself", details will be in applicantDetailsFull
          const gender = (details.gender || '').toLowerCase();
          const pronoun = gender === 'female' ? 'herself' : 'himself';
          part += ', the applicant for visa ' + pronoun;
          parts.push(part);
          return;
        }
        
        // Add parent info, PAN and address first (certificate order: Name, son/daughter of Parent (PAN), residing at Address)
        if (isFirstOccurrence && details.parentName) {
          let relationWord = '';
          if (details.relationship) {
            const firstApplicant = applicants[0];
            const applicantGender = firstApplicant ? firstApplicant.gender : '';
            relationWord = determineSonOrDaughterFromRelationship(details.relationship, applicantGender);
          }
          if (relationWord) {
            part += ', ' + escapeHtml(relationWord.toLowerCase()) + ' of ' + escapeHtml(details.parentName);
          } else {
            part += ' of ' + escapeHtml(details.parentName);
          }
        }
        if (isFirstOccurrence) {
          part += ' (PAN: ' + escapeHtml(details.pan) + '), residing at ' + escapeHtml(formatAddressLine(details.address));
        }
        
        // Then relationship of this person with each visa applicant (group same relationship, join names with " and ")
        const relsWithApp = details.relationshipWithApplicant || [];
        const byRelationship = {};
        applicants.forEach(function (app, j) {
          const rel = (relsWithApp[j] || '').trim();
          const appName = (app.name || '').trim();
          if (!rel || !appName) return;
          if (!byRelationship[rel]) byRelationship[rel] = [];
          byRelationship[rel].push(escapeHtml(appName));
        });
        const relationshipPhrases = [];
        Object.keys(byRelationship).forEach(function (rel) {
          const names = byRelationship[rel];
          const relLower = rel.toLowerCase();
          if (names.length === 1) {
            relationshipPhrases.push(relLower + ' of ' + names[0]);
          } else {
            relationshipPhrases.push(relLower + ' of ' + names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
          }
        });
        if (relationshipPhrases.length > 0) {
          part += ', who is the ' + (relationshipPhrases.length === 1 ? relationshipPhrases[0] : relationshipPhrases.slice(0, -1).join(', ') + ', and ' + relationshipPhrases[relationshipPhrases.length - 1]);
        }
        
        parts.push(part);
      });
      
      // Comma after every person's details, "and" before the last
      if (parts.length === 0) return '';
      if (parts.length === 1) return parts[0];
      if (parts.length === 2) return parts[0] + ', and ' + parts[1];
      const lastPart = parts.pop();
      return parts.join(', ') + ', and ' + lastPart;
    }

    function applicantDetailsFull() {
      // Show ALL applicants; include parent name (relationship already stated in assessed "who is the..." so we don't repeat relationship wording there)
      if (applicants.length === 0) return '';
      const parts = applicants.map(function (a) {
        const g = (a.gender || '').toLowerCase();
        const childWord = g === 'male' ? 'son' : g === 'female' ? 'daughter' : 'son/daughter';
        const childOfParent = (a.parentName ? ` ${childWord} of ` + escapeHtml(a.parentName) + ',' : '');
        const addrPart = ' residing at ' + escapeHtml(formatAddressLine(a.address));
        const passportPart = a.passport ? ', holder of Indian passport (Passport No: ' + escapeHtml(a.passport) + ')' : ', holder of Indian passport';
        return escapeHtml(a.name) + ' (PAN: ' + escapeHtml(a.pan) + ')' + childOfParent + addrPart + passportPart;
      });
      if (parts.length === 1) return parts[0];
      if (parts.length === 2) return parts[0] + ', and ' + parts[1];
      const lastPart = parts.pop();
      return parts.join(', ') + ', and ' + lastPart;
    }

    // Get country from the single country field
    const countryVisiting = (byId('country-visiting')?.value || '').trim();
    const countryVisitingEscaped = countryVisiting ? escapeHtml(countryVisiting) : '';

    let html = '<div class="certificate-body" style="font-family:\'Times New Roman\',Times,serif; font-size:12pt; text-align:justify; margin-top:4cm;">';
    html += '<h3 class="doc-title" style="font-family:\'Times New Roman\',Times,serif; font-size:13pt; font-weight:bold; text-align:center;">NETWORTH CERTIFICATE</h3>';
    html += '<p style="margin:0; line-height:1.0;">&nbsp;</p>';

    html += '<p class="doc-para" style="font-family:\'Times New Roman\',Times,serif; font-size:12pt; text-align:justify; line-height:1.0; margin:0;">I, Pramod M Prasad, Chartered Accountant, member of the Institute of Chartered Accountants of India (Membership No. 243814), do hereby certify that I have reviewed the financial condition of ';
    html += assessedDetails();
    html += ' with a view of establishing the financial ability of ';
    html += applicantDetailsFull();
    html += ' to apply for a visa to ';
    html += countryVisitingEscaped;
    html += '.</p>';
    html += '<p style="margin:0; line-height:1.0;">&nbsp;</p>';
    html += '<table class="cert-asset-table" style="width:100%; border-collapse:collapse; margin:0; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">';
    html += '<thead><tr style="background-color:#f0f0f0;"><th style="border:1px solid #000; padding:4px 8px; text-align:left; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">Sl No.</th><th style="border:1px solid #000; padding:4px 8px; text-align:left; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">SOURCE OF FUND</th><th style="border:1px solid #000; padding:4px 8px; text-align:center; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">AMOUNT IN INR</th><th style="border:1px solid #000; padding:4px 8px; text-align:center; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">AMOUNT IN ' + escapeHtml(foreignCurrencyLabel) + '</th></tr></thead><tbody>';
    
    let rowNum = 1;
    let immovableTotalInr = totals.immovable?.inr || 0;
    let immovableTotalFc = totals.immovable?.fc || 0;
    let movableTotalInr = totals.movable?.inr || 0;
    let movableTotalFc = totals.movable?.fc || 0;
    let savingsTotalInr = totals.savings?.inr || 0;
    let savingsTotalFc = totals.savings?.fc || 0;
    
    if (immovableTotalInr !== 0 || immovableTotalFc !== 0) {
      html += '<tr><td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + rowNum + ')</td><td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">IMMOVABLE PROPERTY</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(immovableTotalInr) + '</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(immovableTotalFc) + '</td></tr>';
      rowNum++;
    }
    if (movableTotalInr !== 0 || movableTotalFc !== 0) {
      html += '<tr><td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + rowNum + ')</td><td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">MOVABLE PROPERTY</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(movableTotalInr) + '</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(movableTotalFc) + '</td></tr>';
      rowNum++;
    }
    if (savingsTotalInr !== 0 || savingsTotalFc !== 0) {
      html += '<tr><td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + rowNum + ')</td><td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">PERSONAL AND FAMILY SAVINGS</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(savingsTotalInr) + '</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(savingsTotalFc) + '</td></tr>';
      rowNum++;
    }
    const totalInrStr = totalInr === 0 ? '—' : totalInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalFcStr = totalFc === 0 ? '—' : totalFc.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    html += '<tr class="cert-total-row" style="font-weight:bold;"><td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;"></td><td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">Total</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + totalInrStr + '</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + totalFcStr + '</td></tr>';
    html += '</tbody></table>';
    html += '<p style="margin:0; line-height:1.0;">&nbsp;</p>';

    // Format conversion rate to 2 decimals
    let formattedConversionRate = '—';
    if (conversionRate) {
      const rateNum = parseFloat(conversionRate);
      if (!isNaN(rateNum)) {
        formattedConversionRate = rateNum.toFixed(2);
      } else {
        formattedConversionRate = conversionRate;
      }
    }
    html += '<p class="doc-para" style="font-family:\'Times New Roman\',Times,serif; font-size:12pt; text-align:justify; line-height:1.0; margin:0;">1. The exchange rate adopted is 1 ' + escapeHtml(foreignCurrencyLabel) + ' = ' + escapeHtml(formattedConversionRate) + ' INR.</p>';
    html += '<p class="doc-para" style="font-family:\'Times New Roman\',Times,serif; font-size:12pt; text-align:justify; line-height:1.0; margin:0;">2. Annexure 1 is integral part of the certificate.</p>';
    html += '<p style="margin:0; line-height:1.0;">&nbsp;</p>';
    html += '<p class="doc-para" style="font-family:\'Times New Roman\',Times,serif; font-size:12pt; text-align:justify; line-height:1.0; margin:0;"><strong>Notes: The following documents have been produced before me for verification:</strong></p>';

    // Conditional notes based on asset types from Annexure 1
    const notes = [];
    const propertyOwners = [];
    
    try {
      const immovableData = getAnnexureImmovableData();
      const movableData = getAnnexureMovableData();
      const savingsData = getAnnexureSavingsData();

      // Check immovable property
      if (immovableData && Array.isArray(immovableData)) {
        immovableData.forEach(function (item) {
          const inr = parseFloat(String(item.inr || '').replace(/[^0-9.-]/g, ''));
          if (isNaN(inr) || inr === 0) return;
          
          // Point 6: Immovable property (land, land-building, flat, commercial)
          if (item.type === 'land' || item.type === 'land-building' || item.type === 'flat' || item.type === 'commercial') {
            if (notes.indexOf(6) === -1) notes.push(6);
            // Get owner names
            if (item.owners && Array.isArray(item.owners)) {
              item.owners.forEach(function (owner) {
                const ownerName = String(owner || '').trim();
                if (ownerName && propertyOwners.indexOf(ownerName) === -1 && ownerName.length < 200) {
                  propertyOwners.push(ownerName);
                }
              });
            }
          }
        });
      }

      // Check movable property
      if (movableData && Array.isArray(movableData)) {
        movableData.forEach(function (item) {
          const inr = parseFloat(String(item.inr || '').replace(/[^0-9.-]/g, ''));
          if (isNaN(inr) || inr === 0) return;
          
          // Point 1: Shares
          if (item.type === 'shares') {
            if (notes.indexOf(1) === -1) notes.push(1);
          }
          // Point 2: Mutual funds
          if (item.type === 'mutual-fund') {
            if (notes.indexOf(2) === -1) notes.push(2);
          }
          // Point 4: Gold ornaments
          if (item.type === 'gold') {
            if (notes.indexOf(4) === -1) notes.push(4);
          }
          // Point 5: Silver ornaments
          if (item.type === 'silver') {
            if (notes.indexOf(5) === -1) notes.push(5);
          }
          // Point 6: Motor vehicle
          if (item.type === 'motor-vehicle') {
            if (notes.indexOf(7) === -1) notes.push(7);
          }
          // Point 9: Debentures
          if (item.type === 'debenture') {
            if (notes.indexOf(9) === -1) notes.push(9);
          }
        });
      }

      // Check savings
      if (savingsData && Array.isArray(savingsData)) {
        savingsData.forEach(function (item) {
          const inr = parseFloat(String(item.inr || '').replace(/[^0-9.-]/g, ''));
          if (isNaN(inr) || inr === 0) return;
          
          // Point 3: Bank accounts (Current, Savings, or Recurring deposit)
          if (item.type === 'bank-account' && (item.bankType === 'Current' || item.bankType === 'Savings' || item.bankType === 'Recurring')) {
            if (notes.indexOf(3) === -1) notes.push(3);
          }
          // Point 8: Fixed deposit
          if (item.type === 'bank-account' && item.bankType === 'Fixed') {
            if (notes.indexOf(8) === -1) notes.push(8);
          }
          // Point 10: Life insurance
          if (item.type === 'life-insurance') {
            if (notes.indexOf(10) === -1) notes.push(10);
          }
          // Point 11: PPF
          if (item.type === 'ppf') {
            if (notes.indexOf(11) === -1) notes.push(11);
          }
          // Point 12: NPS
          if (item.type === 'nps') {
            if (notes.indexOf(12) === -1) notes.push(12);
          }
        });
      }
    } catch (err) {
    }

    // Add conditional notes as serially lettered paragraphs (a., b., c. ...) — one paragraph per note
    const paraBaseStyle = 'font-family:\'Times New Roman\',Times,serif; font-size:12pt; text-align:justify; line-height:1.0; margin:0 0 0.25em 0;';
    let noteIndex = 0;

    if (notes.indexOf(1) >= 0) {
      const noteLetter = String.fromCharCode(97 + noteIndex);
      html += '<p class="doc-para" style="' + paraBaseStyle + '">' + noteLetter + '. Value of investments in shares are obtained from depository statements provided by the client.</p>';
      noteIndex++;
    }
    if (notes.indexOf(2) >= 0) {
      const noteLetter = String.fromCharCode(97 + noteIndex);
      html += '<p class="doc-para" style="' + paraBaseStyle + '">' + noteLetter + '. Value of investments in mutual funds are obtained from statements provided by the client.</p>';
      noteIndex++;
    }
    if (notes.indexOf(3) >= 0) {
      const noteLetter = String.fromCharCode(97 + noteIndex);
      html += '<p class="doc-para" style="' + paraBaseStyle + '">' + noteLetter + '. Bank balances are obtained from the bank confirmations provided by the client.</p>';
      noteIndex++;
    }
    if (notes.indexOf(4) >= 0) {
      const noteLetter = String.fromCharCode(97 + noteIndex);
      html += '<p class="doc-para" style="' + paraBaseStyle + '">' + noteLetter + '. Gold ornaments valuation is made based on current market value of the gold and quantity has been ascertained based on the information &amp; explanations given by the client.</p>';
      noteIndex++;
    }
    if (notes.indexOf(5) >= 0) {
      const noteLetter = String.fromCharCode(97 + noteIndex);
      html += '<p class="doc-para" style="' + paraBaseStyle + '">' + noteLetter + '. Silver ornaments valuation is made based on current market value of the silver and quantity has been ascertained based on the information &amp; explanations given by the client.</p>';
      noteIndex++;
    }
    if (notes.indexOf(6) >= 0) {
      const noteLetter = String.fromCharCode(97 + noteIndex);
      let ownerText = '';
      if (propertyOwners.length > 0) {
        const formattedOwners = propertyOwners.map(function (name) {
          return escapeHtml(name.trim());
        });
        if (formattedOwners.length === 1) {
          ownerText = ' in the name of ' + formattedOwners[0];
        } else if (formattedOwners.length === 2) {
          ownerText = ' in the name of ' + formattedOwners[0] + ' and ' + formattedOwners[1];
        } else {
          const lastOwner = formattedOwners.pop();
          ownerText = ' in the name of ' + formattedOwners.join(', ') + ', and ' + lastOwner;
        }
      }
      html += '<p class="doc-para" style="' + paraBaseStyle + '">' + noteLetter + '. The property documents' + ownerText + ' have been verified and valuation is made based on the current market value in the given area based on general enquiry.</p>';
      noteIndex++;
    }
    if (notes.indexOf(7) >= 0) {
      const noteLetter = String.fromCharCode(97 + noteIndex);
      html += '<p class="doc-para" style="' + paraBaseStyle + '">' + noteLetter + '. Value of motor vehicle is arrived on the IDV value mention in the insurance policy document.</p>';
      noteIndex++;
    }
    if (notes.indexOf(8) >= 0) {
      const noteLetter = String.fromCharCode(97 + noteIndex);
      html += '<p class="doc-para" style="' + paraBaseStyle + '">' + noteLetter + '. Fixed Deposits values are obtained from the bank confirmations provided by the client.</p>';
      noteIndex++;
    }
    if (notes.indexOf(9) >= 0) {
      const noteLetter = String.fromCharCode(97 + noteIndex);
      html += '<p class="doc-para" style="' + paraBaseStyle + '">' + noteLetter + '. Value of investments in debentures are obtained from depository statements provided by the client.</p>';
      noteIndex++;
    }
    if (notes.indexOf(10) >= 0) {
      const noteLetter = String.fromCharCode(97 + noteIndex);
      html += '<p class="doc-para" style="' + paraBaseStyle + '">' + noteLetter + '. Value of life insurance are from surrender value certificate provided by the client.</p>';
      noteIndex++;
    }
    if (notes.indexOf(11) >= 0) {
      const noteLetter = String.fromCharCode(97 + noteIndex);
      html += '<p class="doc-para" style="' + paraBaseStyle + '">' + noteLetter + '. PPF balances are obtained from the confirmations certificate provided by the client.</p>';
      noteIndex++;
    }
    if (notes.indexOf(12) >= 0) {
      const noteLetter = String.fromCharCode(97 + noteIndex);
      html += '<p class="doc-para" style="' + paraBaseStyle + '">' + noteLetter + '. NPS balances are obtained from the statement provided by the client.</p>';
      noteIndex++;
    }

    html += '<div class="cert-signing" style="text-align:right; margin-top:0; font-family:\'Times New Roman\',Times,serif; font-size:12pt;">';
    html += '<p style="margin:0; line-height:1.0;">&nbsp;</p>';
    html += '<p style="font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0; margin:0; text-align:right;"><strong>For Pramod M P &amp; Associates</strong><br/>Chartered Accountants</p>';
    html += '<p style="margin-top:0; line-height:1.0;">&nbsp;</p><p style="margin-top:0; line-height:1.0;">&nbsp;</p><p style="margin-top:0; line-height:1.0;">&nbsp;</p><p style="margin-top:0; line-height:1.0;">&nbsp;</p>';
    html += '<p style="margin-top:0; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0; margin:0;">Pramod M Prasad, M.Com, ACA<br/>Membership No. 243814<br/>FRN No. 021199S<br/>UDIN- ' + escapeHtml(udin ? udin : '[Add UDIN]') + '</p>';
    html += '<p style="margin-top:0; text-align:left; margin-bottom:0; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0; margin:0;"><strong>Place -</strong> ' + escapeHtml(place) + '</p>';
    html += '<p style="margin-top:0; text-align:left; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0; margin:0;"><strong>Date -</strong> ' + escapeHtml(dateFormatted) + '</p>';
    html += '</div>';
    html += '</div>'; // Close certificate-body div
    html += '<div style="page-break-before:always; height:0; margin:0; padding:0; display:block;"></div>';

    // Annexure 1 - Page 2 (wrapper keeps heading + table on same page in Word)
    html += '<div class="annexure-page" style="font-family:\'Times New Roman\',Times,serif; font-size:12pt; text-align:justify; line-height:1.0; display:block;">';
    html += '<div class="annexure-heading-table-wrap">';
    html += '<h3 class="doc-title" style="font-family:\'Times New Roman\',Times,serif; font-size:13pt; font-weight:bold; text-align:center; line-height:1.0; margin:0;">ANNEXURE 1</h3>';
    html += '<p style="margin:0; line-height:1.0;">&nbsp;</p>';
    const immovableData = getAnnexureImmovableData();
    const movableData = getAnnexureMovableData();
    const savingsData = getAnnexureSavingsData();
    
    // Calculate totals for each category and grand total
    let immovableCategoryInr = 0;
    let immovableCategoryFc = 0;
    let movableCategoryInr = 0;
    let movableCategoryFc = 0;
    let savingsCategoryInr = 0;
    let savingsCategoryFc = 0;
    let grandTotalInr = 0;
    let grandTotalFc = 0;
    
    html += '<table class="cert-asset-table" style="width:100%; border-collapse:collapse; margin:0; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">';
    html += '<thead><tr style="background-color:#f0f0f0;"><th style="border:1px solid #000; padding:4px 8px; text-align:left; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">SI No.</th><th style="border:1px solid #000; padding:4px 8px; text-align:left; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">PARTICULARS</th><th style="border:1px solid #000; padding:4px 8px; text-align:center; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">AMOUNT IN INR</th><th style="border:1px solid #000; padding:4px 8px; text-align:center; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">AMOUNT IN ' + escapeHtml(foreignCurrencyLabel) + '</th></tr></thead><tbody>';
    
    let serialNo = 1;
    
    // Immovable Property
    if (immovableData.length > 0) {
      html += '<tr><td colspan="4" style="border:1px solid #000; padding:4px 8px; font-weight:bold; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">A) IMMOVABLE PROPERTY</td></tr>';
      immovableData.forEach(function (item) {
        const wording = generateImmovableWording(item);
        const inr = parseFloat(String(item.inr || '').replace(/[^0-9.-]/g, '')) || 0;
        const fc = parseFloat(String(item.fc || '').replace(/[^0-9.-]/g, '')) || 0;
        immovableCategoryInr += inr;
        immovableCategoryFc += fc;
        grandTotalInr += inr;
        grandTotalFc += fc;
        html += '<tr>';
        html += '<td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + serialNo + '</td>';
        html += '<td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0; text-align:justify;">' + escapeHtml(wording) + '</td>';
        html += '<td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + (inr > 0 ? formatAmount(inr) : '') + '</td>';
        html += '<td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + (fc > 0 ? formatAmount(fc) : '') + '</td>';
        html += '</tr>';
        serialNo++;
      });
      // Category total for Immovable Property
      html += '<tr style="font-weight:bold;"><td colspan="2" style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">Total</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(immovableCategoryInr) + '</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(immovableCategoryFc) + '</td></tr>';
    }
    
    // Movable Property
    if (movableData.length > 0) {
      html += '<tr><td colspan="4" style="border:1px solid #000; padding:4px 8px; font-weight:bold; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">B) MOVABLE PROPERTY</td></tr>';
      movableData.forEach(function (item) {
        const wording = generateMovableWording(item);
        const inr = parseFloat(String(item.inr || '').replace(/[^0-9.-]/g, '')) || 0;
        const fc = parseFloat(String(item.fc || '').replace(/[^0-9.-]/g, '')) || 0;
        movableCategoryInr += inr;
        movableCategoryFc += fc;
        grandTotalInr += inr;
        grandTotalFc += fc;
        html += '<tr>';
        html += '<td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + serialNo + '</td>';
        html += '<td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0; text-align:justify;">' + escapeHtml(wording) + '</td>';
        html += '<td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + (inr > 0 ? formatAmount(inr) : '') + '</td>';
        html += '<td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + (fc > 0 ? formatAmount(fc) : '') + '</td>';
        html += '</tr>';
        serialNo++;
      });
      // Category total for Movable Property
      html += '<tr style="font-weight:bold;"><td colspan="2" style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">Total</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(movableCategoryInr) + '</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(movableCategoryFc) + '</td></tr>';
    }
    
    // Personal & Family Savings
    if (savingsData.length > 0) {
      html += '<tr><td colspan="4" style="border:1px solid #000; padding:4px 8px; font-weight:bold; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">C) PERSONAL AND FAMILY SAVINGS</td></tr>';
      savingsData.forEach(function (item) {
        const wording = generateSavingsWording(item);
        const inr = parseFloat(String(item.inr || '').replace(/[^0-9.-]/g, '')) || 0;
        const fc = parseFloat(String(item.fc || '').replace(/[^0-9.-]/g, '')) || 0;
        savingsCategoryInr += inr;
        savingsCategoryFc += fc;
        grandTotalInr += inr;
        grandTotalFc += fc;
        html += '<tr>';
        html += '<td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + serialNo + '</td>';
        html += '<td style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0; text-align:justify;">' + escapeHtml(wording) + '</td>';
        html += '<td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + (inr > 0 ? formatAmount(inr) : '') + '</td>';
        html += '<td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + (fc > 0 ? formatAmount(fc) : '') + '</td>';
        html += '</tr>';
        serialNo++;
      });
      // Category total for Personal & Family Savings
      html += '<tr style="font-weight:bold;"><td colspan="2" style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">Total</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(savingsCategoryInr) + '</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(savingsCategoryFc) + '</td></tr>';
    }
    
    // Grand Total
    html += '<tr class="cert-total-row" style="font-weight:bold;"><td colspan="2" style="border:1px solid #000; padding:4px 8px; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">GRAND TOTAL</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(grandTotalInr) + '</td><td style="border:1px solid #000; padding:4px 8px; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">' + formatAmount(grandTotalFc) + '</td></tr>';
    html += '</tbody></table>';
    html += '</div>';
    html += '<p style="margin:0; line-height:1.0;">&nbsp;</p>';
    html += '<div class="cert-signing" style="text-align:right; margin-top:0; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0;">';
    html += '<p style="margin:0; line-height:1.0;">&nbsp;</p>';
    html += '<p style="font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0; margin:0; text-align:right;"><strong>For Pramod M P &amp; Associates</strong><br/>Chartered Accountants</p>';
    html += '<p style="margin-top:0; line-height:1.0;">&nbsp;</p><p style="margin-top:0; line-height:1.0;">&nbsp;</p><p style="margin-top:0; line-height:1.0;">&nbsp;</p><p style="margin-top:0; line-height:1.0;">&nbsp;</p>';
    html += '<p style="margin-top:0; text-align:right; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0; margin:0;">Pramod M Prasad, M.Com, ACA<br/>Membership No. 243814<br/>FRN No. 021199S<br/>UDIN- ' + escapeHtml(udin ? udin : '[Add UDIN]') + '</p>';
    html += '<p style="margin-top:0; text-align:left; margin-bottom:0; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0; margin:0;"><strong>Place -</strong> ' + escapeHtml(place) + '</p>';
    html += '<p style="margin-top:0; text-align:left; font-family:\'Times New Roman\',Times,serif; font-size:12pt; line-height:1.0; margin:0;"><strong>Date -</strong> ' + escapeHtml(dateFormatted) + '</p>';
    html += '</div>';
    html += '</div>'; // Close annexure-page div
    return html;
  }

  function openPreview() {
    clearValidationErrors();
    const errors = validateForm();
    if (errors.length) {
      showValidationErrors(errors);
      return;
    }
    const modal = byId('preview-modal');
    const preview = byId('certificate-preview');
    if (!modal || !preview) return;
    preview.innerHTML = buildCertificateHtml();
    modal.setAttribute('aria-hidden', 'false');
  }

  function closePreview() {
    const modal = byId('preview-modal');
    if (modal) modal.setAttribute('aria-hidden', 'true');
  }

  function resetForm() {
    // Clear all containers first
    const applicantsContainer = byId('applicants-container');
    if (applicantsContainer) applicantsContainer.innerHTML = '';
    const assessedContainer = byId('assessed-container');
    if (assessedContainer) assessedContainer.innerHTML = '';
    
    // Reset form fields
    byId('num-applicants').value = '1';
    byId('num-assessed').value = '0';
    if (byId('country-visiting')) byId('country-visiting').value = '';
    byId('place').value = 'Kochi';
    byId('signing-date').value = '';
    byId('udin').value = '';
    byId('conversion-rate').value = '';
    if (byId('rate-status')) byId('rate-status').textContent = '';
    if (byId('asset-currency')) byId('asset-currency').value = '';
    if (byId('num-immovable')) byId('num-immovable').value = '0';
    if (byId('num-movable')) byId('num-movable').value = '0';
    if (byId('num-savings')) byId('num-savings').value = '0';
    if (byId('annex-num-immovable')) byId('annex-num-immovable').value = '0';
    if (byId('annex-num-movable')) byId('annex-num-movable').value = '0';
    if (byId('annex-num-savings')) byId('annex-num-savings').value = '0';
    
    // Re-render with cleared containers
    renderApplicants(1);
    renderAssessed(0);
    initAssets();
    initAnnexure();
    syncAssetCurrencyFromApplicant();
    closePreview();
    clearValidationErrors();
    setDefaultSigningDate();
    networthLoadedStaff = '';
    updateStaffDisplay();
  }

  function setDefaultSigningDate() {
    const el = byId('signing-date');
    if (el && !el.value) {
      el.value = new Date().toISOString().slice(0, 10);
    }
  }

  // ——— File Save/Load ———
  function getAllFormData() {
    const numApplicants = Math.max(1, parseInt(byId('num-applicants')?.value, 10) || 1);
    const numAssessed = Math.max(0, parseInt(byId('num-assessed')?.value, 10) || 0);
    const applicants = [];
    for (let i = 0; i < numApplicants; i++) applicants.push(getApplicantFields(i));
    const assessed = [];
    for (let i = 0; i < numAssessed; i++) assessed.push(getAssessedFields(i, numApplicants));
    const assetRows = getAssetRows();
    return {
      version: '1.0',
      staff: getNetworthStaffName(),
      countryVisiting: byId('country-visiting')?.value || '',
      applicants: applicants,
      assessed: assessed,
      assessedIsApplicant: applicants.some(function(a) { return a.isAssessed; }) || false,
      place: byId('place')?.value || '',
      signingDate: byId('signing-date')?.value || '',
      udin: byId('udin')?.value || '',
      assetCurrency: byId('asset-currency')?.value || '',
      conversionRate: byId('conversion-rate')?.value || '',
      numImmovable: parseInt(byId('num-immovable')?.value, 10) || 0,
      numMovable: parseInt(byId('num-movable')?.value, 10) || 0,
      numSavings: parseInt(byId('num-savings')?.value, 10) || 0,
      assets: assetRows,
      annexure: {
        immovable: getAnnexureImmovableData(),
        movable: getAnnexureMovableData(),
        savings: getAnnexureSavingsData()
      }
    };
  }

  function loadFormData(data) {
    if (!data || !data.version) return false;
    networthLoadedStaff = (data.staff || '').trim() || '';
    updateStaffDisplay(networthLoadedStaff);
    byId('num-applicants').value = String(data.applicants?.length || 1);
    byId('num-assessed').value = String(data.assessed?.length || 0);
    // Load per-applicant checkboxes (backward compatibility: if old format, apply to first applicant)
    if (data.assessedIsApplicant && data.applicants && data.applicants.length > 0) {
      // Old format: single checkbox, apply to first applicant
      setTimeout(function() {
        const checkbox = byId('applicant-is-assessed-0');
        if (checkbox) checkbox.checked = true;
      }, 100);
    }
    renderApplicants(data.applicants?.length || 1);
    renderAssessed(data.assessed?.length || 0);
    setTimeout(function () {
      // Asset table no longer used - data comes from annexure
      (data.applicants || []).forEach(function (a, i) {
        if (byId(`applicant-name-${i}`)) byId(`applicant-name-${i}`).value = formatNameToProperCase(a.name || '');
        if (byId(`applicant-pan-${i}`)) byId(`applicant-pan-${i}`).value = a.pan || '';
        if (byId(`applicant-passport-${i}`)) byId(`applicant-passport-${i}`).value = formatToUppercase(a.passport || '');
        if (byId(`applicant-gender-${i}`)) byId(`applicant-gender-${i}`).value = a.gender || '';
        // Country is now a single field, set it from first applicant (backward compatibility)
        if (i === 0 && a.country && byId('country-visiting')) {
          byId('country-visiting').value = a.country;
        }
        if (byId(`applicant-purpose-${i}`)) byId(`applicant-purpose-${i}`).value = a.purpose || '';
        if (byId(`applicant-parent-${i}`)) byId(`applicant-parent-${i}`).value = formatNameToProperCase(a.parentName || '');
        if (byId(`applicant-is-assessed-${i}`)) byId(`applicant-is-assessed-${i}`).checked = a.isAssessed || false;
        if (a.address) {
          if (byId(`applicant-door-${i}`)) byId(`applicant-door-${i}`).value = a.address.doorNo || '';
        if (byId(`applicant-road-${i}`)) byId(`applicant-road-${i}`).value = formatNameToProperCase(a.address.road || '');
        if (byId(`applicant-area-${i}`)) byId(`applicant-area-${i}`).value = formatNameToProperCase(a.address.area || '');
        if (byId(`applicant-district-${i}`)) byId(`applicant-district-${i}`).value = formatNameToProperCase(a.address.district || '');
          if (byId(`applicant-state-${i}`)) byId(`applicant-state-${i}`).value = a.address.state || '';
          if (byId(`applicant-addr-country-${i}`)) byId(`applicant-addr-country-${i}`).value = a.address.country || '';
          if (byId(`applicant-pincode-${i}`)) byId(`applicant-pincode-${i}`).value = a.address.pincode || '';
        }
      });
      (data.assessed || []).forEach(function (p, i) {
        if (byId(`assessed-name-${i}`)) byId(`assessed-name-${i}`).value = formatNameToProperCase(p.name || '');
        if (byId(`assessed-pan-${i}`)) byId(`assessed-pan-${i}`).value = p.pan || '';
        const rels = p.relationshipWithApplicant || [];
        const numApp = (data.applicants || []).length || 1;
        for (let j = 0; j < numApp; j++) {
          const el = byId(`assessed-relationship-${i}-${j}`);
          if (el) el.value = (rels[j] != null && rels[j] !== '') ? rels[j] : (j === 0 ? (p.relationship || '') : '');
        }
        if (byId(`assessed-parent-${i}`)) byId(`assessed-parent-${i}`).value = formatNameToProperCase(p.parentName || '');
        if (p.address) {
          if (byId(`assessed-door-${i}`)) byId(`assessed-door-${i}`).value = p.address.doorNo || '';
        if (byId(`assessed-road-${i}`)) byId(`assessed-road-${i}`).value = formatNameToProperCase(p.address.road || '');
        if (byId(`assessed-area-${i}`)) byId(`assessed-area-${i}`).value = formatNameToProperCase(p.address.area || '');
        if (byId(`assessed-district-${i}`)) byId(`assessed-district-${i}`).value = formatNameToProperCase(p.address.district || '');
          if (byId(`assessed-state-${i}`)) byId(`assessed-state-${i}`).value = p.address.state || '';
          if (byId(`assessed-addr-country-${i}`)) byId(`assessed-addr-country-${i}`).value = p.address.country || '';
          if (byId(`assessed-pincode-${i}`)) byId(`assessed-pincode-${i}`).value = p.address.pincode || '';
        }
      });
      // Ensure applicant-side relationship fields are created and synced after load
      refreshApplicantRelationshipFields();
      updateApplicantCopyAddressLabels();
    updateAssessedCopyFromApplicantLabels();
      updateAssessedCopyAddressLabels();
    updateAssessedCopyFromApplicantLabels();
      (data.applicants || []).forEach(function (a, i) {
        const relTo = a.relationshipToAssessedApplicants || {};
        Object.keys(relTo).forEach(function (j) {
          const el = byId('applicant-relationship-to-app-' + i + '-' + j);
          if (el) el.value = relTo[j] || '';
        });
      });
      if (byId('place')) byId('place').value = data.place || '';
      if (byId('signing-date')) byId('signing-date').value = data.signingDate || '';
      if (byId('udin')) byId('udin').value = formatToUppercase(data.udin || '');
      if (byId('asset-currency')) byId('asset-currency').value = data.assetCurrency || '';
      if (byId('conversion-rate')) byId('conversion-rate').value = data.conversionRate || '';
      // Load country visiting (backward compatibility: use from first applicant if not in data)
      if (byId('country-visiting')) {
        if (data.countryVisiting) {
          byId('country-visiting').value = data.countryVisiting;
        } else if (data.applicants && data.applicants.length > 0 && data.applicants[0].country) {
          // Backward compatibility: use country from first applicant
          byId('country-visiting').value = data.applicants[0].country;
        }
      }
      setTimeout(function () {
        updateAssetOwnerDropdowns();
        if (data.assets && data.assets.length) {
          const tbody = byId('assets-tbody');
          if (tbody) {
            tbody.querySelectorAll('tr').forEach(function (tr, idx) {
              const asset = data.assets[idx];
              if (asset) {
                const descEl = tr.querySelector('.asset-desc');
                const ownerSelect = tr.querySelector('.asset-owner');
                const inrInput = tr.querySelector('.asset-inr');
                const fcInput = tr.querySelector('.asset-fc');
                if (descEl) {
                  if (descEl.tagName === 'SELECT') {
                    descEl.value = asset.description || '';
                  } else {
                    descEl.value = asset.description || '';
                  }
                }
                if (ownerSelect && ownerSelect.tagName === 'SELECT') {
                  const owners = asset.owners || (asset.owner ? [asset.owner] : []);
                  Array.from(ownerSelect.options).forEach(function (opt) {
                    opt.selected = owners.indexOf(opt.value) >= 0;
                  });
                }
                if (inrInput) inrInput.value = asset.inr || '';
                if (fcInput) fcInput.value = asset.foreignCurrency || '';
              }
            });
          }
        }
        recalcAllAssetForeignValues();
      }, 150);
      
      // Load annexure data
      if (data.annexure) {
        setTimeout(function () {
          if (data.annexure.immovable && data.annexure.immovable.length > 0) {
            if (byId('annex-num-immovable')) {
              byId('annex-num-immovable').value = String(data.annexure.immovable.length);
              renderAnnexureImmovable(data.annexure.immovable.length);
              setTimeout(function () {
                data.annexure.immovable.forEach(function (item, i) {
                  if (byId(`annex-immovable-type-${i}`)) byId(`annex-immovable-type-${i}`).value = item.type || '';
                  if (byId(`annex-immovable-building-${i}`)) byId(`annex-immovable-building-${i}`).value = item.buildingNumber || '';
                  if (byId(`annex-immovable-building-sqft-${i}`)) byId(`annex-immovable-building-sqft-${i}`).value = item.buildingSqft || '';
                  if (byId(`annex-immovable-survey-${i}`)) byId(`annex-immovable-survey-${i}`).value = item.surveyNumber || '';
                  if (byId(`annex-immovable-area-${i}`)) byId(`annex-immovable-area-${i}`).value = item.area || '';
                  if (byId(`annex-immovable-unit-${i}`)) byId(`annex-immovable-unit-${i}`).value = item.unit || 'are';
                  if (byId(`annex-immovable-village-${i}`)) byId(`annex-immovable-village-${i}`).value = item.village || '';
                  if (byId(`annex-immovable-taluk-${i}`)) byId(`annex-immovable-taluk-${i}`).value = item.taluk || '';
                  if (byId(`annex-immovable-district-${i}`)) byId(`annex-immovable-district-${i}`).value = item.district || '';
                  if (byId(`annex-immovable-state-${i}`)) byId(`annex-immovable-state-${i}`).value = item.state || '';
                  if (byId(`annex-immovable-inr-${i}`)) byId(`annex-immovable-inr-${i}`).value = item.inr || '';
                  if (byId(`annex-immovable-fc-${i}`)) byId(`annex-immovable-fc-${i}`).value = item.fc || '';
                  if (byId(`annex-immovable-remark-${i}`)) byId(`annex-immovable-remark-${i}`).value = item.remark || '';
                  const ownerEl = byId(`annex-immovable-owner-${i}`);
                  if (ownerEl && item.owners) {
                    Array.from(ownerEl.options).forEach(function (opt) {
                      opt.selected = item.owners.indexOf(opt.value) >= 0;
                    });
                  }
                });
              }, 50);
            }
          }
          if (data.annexure.movable && data.annexure.movable.length > 0) {
            if (byId('annex-num-movable')) {
              byId('annex-num-movable').value = String(data.annexure.movable.length);
              renderAnnexureMovable(data.annexure.movable.length);
              setTimeout(function () {
                data.annexure.movable.forEach(function (item, i) {
                  if (byId(`annex-movable-type-${i}`)) byId(`annex-movable-type-${i}`).value = item.type || '';
                  if (byId(`annex-movable-weight-${i}`)) byId(`annex-movable-weight-${i}`).value = item.weight || '';
                  if (byId(`annex-movable-dp-${i}`)) byId(`annex-movable-dp-${i}`).value = item.dpAccount || '';
                  if (byId(`annex-movable-date-${i}`)) byId(`annex-movable-date-${i}`).value = item.valuationDate || '';
                  if (byId(`annex-movable-company-${i}`)) byId(`annex-movable-company-${i}`).value = item.company || '';
                  if (byId(`annex-movable-model-${i}`)) byId(`annex-movable-model-${i}`).value = item.model || '';
                  if (byId(`annex-movable-vehicle-${i}`)) byId(`annex-movable-vehicle-${i}`).value = item.vehicleNumber || '';
                  if (byId(`annex-movable-inr-${i}`)) byId(`annex-movable-inr-${i}`).value = item.inr || '';
                  if (byId(`annex-movable-fc-${i}`)) byId(`annex-movable-fc-${i}`).value = item.fc || '';
                  if (byId(`annex-movable-remark-${i}`)) byId(`annex-movable-remark-${i}`).value = item.remark || '';
                  const ownerEl = byId(`annex-movable-owner-${i}`);
                  if (ownerEl && item.owners) {
                    Array.from(ownerEl.options).forEach(function (opt) {
                      opt.selected = item.owners.indexOf(opt.value) >= 0;
                    });
                  }
                });
              }, 50);
            }
          }
          if (data.annexure.savings && data.annexure.savings.length > 0) {
            if (byId('annex-num-savings')) {
              byId('annex-num-savings').value = String(data.annexure.savings.length);
              renderAnnexureSavings(data.annexure.savings.length);
              setTimeout(function () {
                data.annexure.savings.forEach(function (item, i) {
                  if (byId(`annex-savings-type-${i}`)) byId(`annex-savings-type-${i}`).value = item.type || '';
                  if (byId(`annex-savings-bank-type-${i}`)) byId(`annex-savings-bank-type-${i}`).value = item.bankType || '';
                  if (byId(`annex-savings-account-${i}`)) byId(`annex-savings-account-${i}`).value = item.accountNumber || '';
                  if (byId(`annex-savings-bank-${i}`)) byId(`annex-savings-bank-${i}`).value = item.bankName || '';
                  if (byId(`annex-savings-date-${i}`)) byId(`annex-savings-date-${i}`).value = item.valuationDate || '';
                  if (byId(`annex-savings-policy-${i}`)) byId(`annex-savings-policy-${i}`).value = item.policyNumber || '';
                  if (byId(`annex-savings-insurer-${i}`)) byId(`annex-savings-insurer-${i}`).value = item.insurerName || '';
                  if (byId(`annex-savings-inr-${i}`)) byId(`annex-savings-inr-${i}`).value = item.inr || '';
                  if (byId(`annex-savings-fc-${i}`)) byId(`annex-savings-fc-${i}`).value = item.fc || '';
                  if (byId(`annex-savings-remark-${i}`)) byId(`annex-savings-remark-${i}`).value = item.remark || '';
                  const ownerEl = byId(`annex-savings-owner-${i}`);
                  if (ownerEl && item.owners) {
                    Array.from(ownerEl.options).forEach(function (opt) {
                      opt.selected = item.owners.indexOf(opt.value) >= 0;
                    });
                  }
                });
              }, 50);
            }
          }
          updateAnnexureOwnerDropdowns();
        }, 200);
      }
      
      syncAssetCurrencyFromApplicant();
    }, 100);
    return true;
  }

  function getStoredDefaultDir() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(); return; }
      try {
        const req = indexedDB.open(NETWORTH_DEFAULT_DIR_DB, 1);
        req.onerror = function () { resolve(); };
        req.onsuccess = function () {
          const db = req.result;
          if (!db.objectStoreNames.contains('store')) {
            db.close();
            resolve();
            return;
          }
          const tx = db.transaction('store', 'readonly');
          const getReq = tx.objectStore('store').get(NETWORTH_DEFAULT_DIR_KEY);
          getReq.onsuccess = function () {
            const h = getReq.result;
            if (h && typeof h === 'object' && h.kind === 'directory') {
              if (h.name === 'Data' && typeof h.getDirectoryHandle === 'function') {
                h.getDirectoryHandle('Networth').then(function (networthHandle) {
                  networthDefaultDirHandle = networthHandle;
                  setStoredDefaultDir(networthHandle);
                  resolve();
                }).catch(function () {
                  networthDefaultDirHandle = h;
                  resolve();
                });
                return;
              }
              networthDefaultDirHandle = h;
            }
            resolve();
          };
          getReq.onerror = function () { resolve(); };
        };
        req.onupgradeneeded = function (e) {
          if (!e.target.result.objectStoreNames.contains('store')) {
            e.target.result.createObjectStore('store');
          }
        };
      } catch (err) {
        resolve();
      }
    });
  }

  function setStoredDefaultDir(handle) {
    return new Promise(function (resolve) {
      if (!window.indexedDB || !handle) { resolve(); return; }
      try {
        const req = indexedDB.open(NETWORTH_DEFAULT_DIR_DB, 1);
        req.onerror = function () { resolve(); };
        req.onsuccess = function () {
          const db = req.result;
          if (!db.objectStoreNames.contains('store')) { db.close(); resolve(); return; }
          const tx = db.transaction('store', 'readwrite');
          tx.objectStore('store').put(handle, NETWORTH_DEFAULT_DIR_KEY);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        };
        req.onupgradeneeded = function (e) {
          if (!e.target.result.objectStoreNames.contains('store')) {
            e.target.result.createObjectStore('store');
          }
        };
      } catch (err) {
        resolve();
      }
    });
  }

  function updateDefaultFolderUI() {
    const el = byId('default-folder-path');
    if (!el) return;
    el.textContent = networthDefaultDirHandle ? networthDefaultDirHandle.name : 'Data/Networth (use Choose folder)';
  }

  function saveToFile() {
    const data = getAllFormData();
    const json = JSON.stringify(data, null, 2);
    const applicantName = (data?.applicants?.[0]?.name || '').trim() || 'certificate';
    const filename = 'Networth Certificate- ' + sanitizeFilename(applicantName) + '.nwc';

    if (window.showSaveFilePicker) {
      (async function () {
        try {
          let startIn = networthDefaultDirHandle;
          if (!startIn && window.showDirectoryPicker) {
            try {
              const dirHandle = await window.showDirectoryPicker();
              if (dirHandle) {
                const useHandle = dirHandle.name === 'Data' && typeof dirHandle.getDirectoryHandle === 'function'
                  ? await dirHandle.getDirectoryHandle('Networth').catch(function () { return dirHandle; })
                  : dirHandle;
                networthDefaultDirHandle = useHandle;
                setStoredDefaultDir(useHandle);
                updateDefaultFolderUI();
                startIn = useHandle;
              }
            } catch (e) { /* user cancelled */ }
          }
          const opts = {
            suggestedName: filename,
            types: [{ description: 'Net Worth Certificate File', accept: { 'application/json': ['.nwc'] } }]
          };
          if (startIn) opts.startIn = startIn;
          const handle = await window.showSaveFilePicker(opts);
          const writable = await handle.createWritable();
          await writable.write(json);
          await writable.close();
          networthLoadedStaff = getNetworthStaffName();
          updateStaffDisplay(networthLoadedStaff);
          alert('File saved successfully!');
        } catch (e) {
          const blob = new Blob([json], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = filename;
          a.click();
          URL.revokeObjectURL(a.href);
          networthLoadedStaff = getNetworthStaffName();
          updateStaffDisplay(networthLoadedStaff);
        }
      })();
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    networthLoadedStaff = getNetworthStaffName();
    updateStaffDisplay(networthLoadedStaff);
  }

  function loadFromFile() {
    if (window.showOpenFilePicker) {
      (async function () {
        try {
          let startIn = networthDefaultDirHandle;
          if (!startIn && window.showDirectoryPicker) {
            try {
              const dirHandle = await window.showDirectoryPicker();
              if (dirHandle) {
                const useHandle = dirHandle.name === 'Data' && typeof dirHandle.getDirectoryHandle === 'function'
                  ? await dirHandle.getDirectoryHandle('Networth').catch(function () { return dirHandle; })
                  : dirHandle;
                networthDefaultDirHandle = useHandle;
                setStoredDefaultDir(useHandle);
                updateDefaultFolderUI();
                startIn = useHandle;
              }
            } catch (e) { /* user cancelled */ }
          }
          const opts = {
            types: [{ description: 'Net Worth Certificate File', accept: { 'application/json': ['.nwc'] } }],
            multiple: false
          };
          if (startIn) opts.startIn = startIn;
          const handles = await window.showOpenFilePicker(opts);
          const file = await handles[0].getFile();
          const text = await file.text();
          const data = JSON.parse(text);
          resetForm();
          setTimeout(function () {
            if (loadFormData(data)) alert('File loaded successfully!');
            else alert('Invalid file format.');
          }, 50);
        } catch (e) {
          if (e.name !== 'AbortError') byId('file-input')?.click();
        }
      })();
      return;
    }
    byId('file-input')?.click();
  }

  // ——— Export Functions ———
  function exportToWord() {
    clearValidationErrors();
    const errors = validateForm();
    if (errors.length) {
      showValidationErrors(errors);
      return;
    }
    const html = buildCertificateHtml();
    // Clean HTML for Word export: remove HTML-specific properties that interfere with editing
    let wordHtml = html;
    
    wordHtml = wordHtml.replace(/page-break-after:\s*[^;]+;?/gi, '');
    wordHtml = wordHtml.replace(/page-break-before:\s*[^;]+;?/gi, '');
    wordHtml = wordHtml.replace(/page-break-inside:\s*[^;]+;?/gi, '');
    wordHtml = wordHtml.replace(/min-height:\s*[^;]+;?/gi, '').replace(/height:\s*[^;]+;?/gi, '');
    wordHtml = wordHtml.replace(/margin-top:\s*(1\.5cm|1rem);?/gi, 'margin-top:0;');
    wordHtml = wordHtml.replace(/margin-bottom:\s*(1\.5cm|1rem);?/gi, 'margin-bottom:0;');
    wordHtml = wordHtml.replace(/padding-(top|bottom):\s*[^;]+;?/gi, 'padding-$1:0;');
    wordHtml = wordHtml.replace(/<div([^>]*cert-signing[^>]*)>/gi, function(match, attrs) {
      return attrs.includes('style=') ? match.replace(/margin-(top|bottom)[^:]*:\s*[^;]+;?/gi, 'margin-$1:0;') : match.replace(/<div/, '<div style="margin-top:0; margin-bottom:0;');
    });
    wordHtml = wordHtml.replace(/<div[^>]*>\s*<\/div>/gi, '').replace(/<div[^>]*signature-gap[^>]*>[\s\S]*?<\/div>/gi, '');
    wordHtml = wordHtml.replace(/<p([^>]*style=")([^"]*)(")/gi, function(match, styleStart, styleContent, styleEnd) {
      return '<p' + styleStart + styleContent.replace(/margin[^:]*:\s*[^;]+;?/gi, '').replace(/padding[^:]*:\s*[^;]+;?/gi, '') + ' margin:0; padding:0;' + styleEnd;
    });
    wordHtml = wordHtml.replace(/\s+class="[^"]*"/gi, '');
    wordHtml = wordHtml.replace(/<(td|th)([^>]*style=")([^"]*)(")/gi, function(match, tag, styleStart, styleContent, styleEnd) {
      return '<' + tag + styleStart + styleContent.replace(/line-height:\s*[^;]+;?/gi, '') + ' line-height:1.0;' + styleEnd;
    });
    wordHtml = wordHtml.replace(/<p[^>]*>\s*<\/p>/gi, '').replace(/display:\s*(block|inline-block);?/gi, '');
    
    // Convert h3 and h4 headings to regular paragraphs (don't use heading formats in Word)
    wordHtml = wordHtml.replace(/<h3([^>]*)>/gi, '<p style="font-family:\'Times New Roman\',Times,serif; font-size:13pt; font-weight:bold; text-align:center; margin:0; line-height:1.0;">');
    wordHtml = wordHtml.replace(/<\/h3>/gi, '</p>');
    wordHtml = wordHtml.replace(/<h4([^>]*)>/gi, '<p style="font-family:\'Times New Roman\',Times,serif; font-size:13pt; font-weight:bold; margin:0; line-height:1.0;">');
    wordHtml = wordHtml.replace(/<\/h4>/gi, '</p>');
    
    wordHtml = wordHtml.replace(/<table([^>]*)>/gi, '<table$1 style="mso-style-name:\'No Spacing\'; mso-style-parent:\'\';">');
    wordHtml = wordHtml.replace(/<tr([^>]*)>/gi, '<tr$1 style="mso-style-name:\'No Spacing\'; mso-style-parent:\'\';">');
    wordHtml = wordHtml.replace(/<tr([^>]*)>([\s\S]*?)<\/tr>/gi, function(match, trAttrs, rowContent) {
      const isTotalRow = trAttrs.includes('font-weight:bold') || rowContent.includes('>Total<') || rowContent.includes('>GRAND TOTAL<') || trAttrs.includes('cert-total-row');
      let cellIndex = 0;
      rowContent = rowContent.replace(/<(td|th)([^>]*style=")([^"]*)(")([^>]*)>/gi, function(cellMatch, cellTag, styleStart, styleContent, styleEnd, restAttrs) {
        cellIndex++;
        if (!styleContent.includes('mso-style-name')) styleContent += ' mso-style-name:\'No Spacing\'; mso-style-parent:\'\';';
        const isParticularsColumn = cellIndex === 2 || cellMatch.includes('PARTICULARS') || (styleContent.includes('text-align:justify') && cellIndex === 2);
        styleContent = styleContent.replace(/white-space:\s*nowrap;?/gi, '');
        if (!styleContent.includes('white-space')) styleContent += isParticularsColumn ? ' white-space:normal;' : ' white-space:nowrap;';
        if (isTotalRow && !styleContent.includes('font-weight')) styleContent += ' font-weight:bold;';
        return '<' + cellTag + styleStart + styleContent + styleEnd + restAttrs + '>';
      });
      return '<tr' + trAttrs + '>' + rowContent + '</tr>';
    });
    wordHtml = wordHtml.replace(/position:\s*(fixed|absolute);?/gi, '').replace(/overflow:\s*(hidden|auto);?/gi, '');
    wordHtml = wordHtml.replace(/\s+(readonly|disabled|contenteditable)="[^"]*"/gi, '');
    wordHtml = wordHtml.replace(/pointer-events:\s*none;?/gi, '').replace(/user-select:\s*none;?/gi, '');
    wordHtml = wordHtml.replace(/margin:\s*20px\s+0;?/gi, 'margin-top:0; margin-bottom:0;').replace(/margin:\s*0\s+20px;?/gi, 'margin-top:0; margin-bottom:0;');
    wordHtml = wordHtml.replace(/<div([^>]*annexure-page[^>]*style=")([^"]*margin-top:\s*4cm[^"]*)(")/gi, function(match, divAttrs, styleStart, styleContent, styleEnd) {
      return '<div' + divAttrs + styleStart + styleContent.replace(/margin-top:\s*4cm;?/gi, 'margin-top:1.5cm;') + styleEnd;
    });
    wordHtml = wordHtml.replace(/<table([^>]*style=")([^"]*)(")/gi, function(match, styleStart, styleContent, styleEnd) {
      styleContent = styleContent.replace(/margin[^:]*:\s*[^;]+;?/gi, '').replace(/padding-top[^:]*:\s*[^;]+;?/gi, '');
      if (!styleContent.includes('margin-top')) styleContent += ' margin-top:0; margin-bottom:0;';
      return '<table' + styleStart + styleContent + styleEnd;
    });
    wordHtml = wordHtml.replace(/<p([^>]*style=")([^"]*)(")/gi, function(match, styleStart, styleContent, styleEnd) {
      styleContent = styleContent.replace(/margin-bottom[^:]*:\s*[^;]+;?/gi, '');
      if (!styleContent.includes('margin-bottom')) styleContent += ' margin-bottom:0;';
      return '<p' + styleStart + styleContent + styleEnd;
    });
    wordHtml = wordHtml.replace(/<p([^>]*style=")([^"]*)(")([^>]*)>([\s\S]*?)<\/p>/gi, function(match, styleStart, styleContent, styleEnd, rest, inner) {
      var text = inner.replace(/<[^>]+>/g, '');
      var isBody = /do hereby certify|Notes:|exchange rate|integral part|The following documents/i.test(text);
      var isSignatureRight = /For Pramod[\s\S]*Chartered Accountants|Membership No\./i.test(text);
      if (!isBody && isSignatureRight) {
        styleContent = styleContent.replace(/text-align:\s*[^;]+;?/gi, '') + ' text-align:right;';
      }
      if (/Place -|Date -/i.test(text)) {
        styleContent = styleContent.replace(/text-align:\s*[^;]+;?/gi, '') + ' text-align:left;';
      }
      return '<p' + styleStart + styleContent + styleEnd + rest + '>' + inner + '</p>';
    });

    const wordStyles = `
      <style>
        @page {
          size: A4;
          margin-top: 1.27cm;
          margin-bottom: 1.27cm;
          margin-left: 1.27cm;
          margin-right: 1.27cm;
          mso-page-orientation: portrait;
          mso-margin-top-alt: 1.27cm;
          mso-margin-bottom-alt: 1.27cm;
          mso-margin-left-alt: 1.27cm;
          mso-margin-right-alt: 1.27cm;
        }
        @page :first {
          margin-top: 4cm;
          margin-bottom: 1.27cm;
          margin-left: 1.27cm;
          margin-right: 1.27cm;
          mso-margin-top-alt: 4cm;
          mso-margin-bottom-alt: 1.27cm;
          mso-margin-left-alt: 1.27cm;
          mso-margin-right-alt: 1.27cm;
        }
        /* Set Word section properties for narrow margins */
        div.Section1 {
          page: Section1;
          margin: 0;
          padding: 0;
        }
        p.MsoNormal {
          mso-style-name: "Normal";
          mso-margin-top-alt: 0;
          mso-margin-bottom-alt: 0;
        }
        /* Ensure body respects page margins */
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 12pt;
          margin: 0;
          padding: 0;
        }
        div {
          margin: 0;
          padding: 0;
        }
        .certificate-body, .annexure-page {
          margin: 0 !important;
          min-height: auto !important;
          height: auto !important;
        }
        .cert-signing {
          margin: 0 !important;
          padding: 0 !important;
        }
        p {
          margin: 0;
          padding: 0;
          line-height: 1.0;
          mso-margin-top-alt: 0;
          mso-margin-bottom-alt: 0;
        }
        /* Ensure tables have proper formatting with No Spacing */
        table {
          border-collapse: collapse;
          width: 100%;
          mso-style-name: "No Spacing";
          mso-style-parent: "";
          margin-top: 0;
          margin-bottom: 0;
          padding-top: 0;
          padding-bottom: 0;
        }
        th, td {
          border: 1px solid #333;
          line-height: 1.0;
          mso-style-name: "No Spacing";
          mso-style-parent: "";
          white-space: nowrap;
        }
        /* Ensure all content is editable */
        * {
          -ms-word-wrap: normal;
          word-wrap: normal;
        }
      </style>
    `;
    // Wrap content in Word section with proper margin settings
    // Use Word XML to set narrow margins (1.27cm = 720 twips, 4cm = 2268 twips)
    const wordXml = '<xml><w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word"><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/><w:ValidateAgainstSchemas/><w:SaveIfXMLInvalid>false</w:SaveIfXMLInvalid><w:IgnoreMixedContent>false</w:IgnoreMixedContent><w:AlwaysShowPlaceholderText>false</w:AlwaysShowPlaceholderText></w:WordDocument></xml>';
    const sectionXml = '<xml><w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word"><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument><o:DocumentProperties xmlns:o="urn:schemas-microsoft-com:office:office"></o:DocumentProperties></xml>';
    const htmlContent = '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><title>Net Worth Certificate</title>' + wordStyles + wordXml + '</head><body><div class="Section1" style="mso-element:para-border-div; mso-border-alt:none; padding:0; margin:0;">' + wordHtml + '</div></body></html>';
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const data = getAllFormData();
    const a = document.createElement('a');
    a.href = url;
    const applicantName = (data?.applicants?.[0]?.name || '').trim() || 'certificate';
    a.download = 'Networth Certificate- ' + sanitizeFilename(applicantName) + '.doc';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Check for duplicate PAN numbers across applicants
  function checkDuplicatePan(panValue, currentIndex) {
    if (!panValue || !panValue.trim()) return null;
    const panUpper = panValue.trim().toUpperCase();
    // "NA" is allowed and ignored for duplicate checking
    if (panUpper === 'NA') return null;
    const numApplicants = Math.max(1, parseInt(byId('num-applicants')?.value, 10) || 1);
    const duplicates = [];
    for (let i = 0; i < numApplicants; i++) {
      if (i === currentIndex) continue; // Skip current field
      const otherPan = (byId(`applicant-pan-${i}`)?.value || '').trim().toUpperCase();
      if (otherPan && otherPan !== 'NA' && otherPan === panUpper) {
        duplicates.push(i + 1);
      }
    }
    return duplicates.length > 0 ? duplicates : null;
  }

  // Check for duplicate passport numbers across applicants
  function checkDuplicatePassport(passportValue, currentIndex) {
    if (!passportValue || !passportValue.trim()) return null;
    const passportUpper = passportValue.trim().toUpperCase();
    const numApplicants = Math.max(1, parseInt(byId('num-applicants')?.value, 10) || 1);
    const duplicates = [];
    for (let i = 0; i < numApplicants; i++) {
      if (i === currentIndex) continue; // Skip current field
      const otherPassport = (byId(`applicant-passport-${i}`)?.value || '').trim().toUpperCase();
      if (otherPassport && otherPassport === passportUpper) {
        duplicates.push(i + 1);
      }
    }
    return duplicates.length > 0 ? duplicates : null;
  }

  // PAN input: auto-uppercase and show validation on blur
  function bindPanValidation() {
    document.querySelectorAll('.pan-input').forEach(function (input) {
      input.addEventListener('input', function () {
        this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      });
      input.addEventListener('blur', function () {
        const id = this.id;
        const match = id.match(/(applicant|assessed)-(pan)-(\d+)/);
        if (!match) return;
        
        const prefix = match[1];
        const errId = prefix + '-pan-err-' + match[3];
        const errEl = byId(errId);
        const panValue = this.value.trim();
        let errorMsg = '';
        let hasError = false;

        // Validate PAN format
        const res = validatePan(panValue);
        if (!res.valid) {
          errorMsg = res.msg;
          hasError = true;
        } else if (prefix === 'applicant') {
          // Check for duplicates only for applicants
          const currentIndex = parseInt(match[3], 10);
          const duplicates = checkDuplicatePan(panValue, currentIndex);
          if (duplicates) {
            errorMsg = 'Duplicate PAN number. Also used by applicant(s): ' + duplicates.join(', ');
            hasError = true;
          }
        }

        if (errEl) errEl.textContent = errorMsg;
        this.classList.toggle('input-error', hasError);
      });
    });
  }

  // ——— Annexure 1 Functions ———
  const ANNEXURE_IMMOVABLE_TYPES = [
    { value: 'land-building', label: 'Land and building' },
    { value: 'flat', label: 'Flat' },
    { value: 'land', label: 'Land' },
    { value: 'commercial', label: 'Commercial building' }
  ];

  const ANNEXURE_MOVABLE_TYPES = [
    { value: 'gold', label: 'Gold ornaments' },
    { value: 'silver', label: 'Silver ornaments' },
    { value: 'shares', label: 'Shares' },
    { value: 'debenture', label: 'Debenture' },
    { value: 'mutual-fund', label: 'Mutual Fund' },
    { value: 'motor-vehicle', label: 'Motor Vehicle' }
  ];

  const ANNEXURE_SAVINGS_TYPES = [
    { value: 'bank-account', label: 'Bank Account' },
    { value: 'ppf', label: 'PPF' },
    { value: 'epf', label: 'EPF' },
    { value: 'nps', label: 'NPS' },
    { value: 'life-insurance', label: 'Life Insurance' }
  ];

  const BANK_ACCOUNT_TYPES = ['Savings', 'Fixed', 'Recurring', 'Current'];

  function renderAnnexureImmovable(count) {
    const container = byId('annex-immovable-container');
    if (!container) return;
    
    // Save existing data
    const existingData = {};
    container.querySelectorAll('.annexure-item').forEach(function (item) {
      const idx = parseInt(item.dataset.index, 10);
      if (!isNaN(idx)) {
        const typeEl = byId(`annex-immovable-type-${idx}`);
        const ownerEl = byId(`annex-immovable-owner-${idx}`);
        const owners = [];
        if (ownerEl) {
          Array.from(ownerEl.selectedOptions).forEach(function (opt) {
            if (opt.value) owners.push(opt.value);
          });
        }
        existingData[idx] = {
          type: typeEl ? typeEl.value : '',
          owners: owners,
          buildingNumber: byId(`annex-immovable-building-${idx}`)?.value || '',
          buildingSqft: byId(`annex-immovable-building-sqft-${idx}`)?.value || '',
          surveyNumber: byId(`annex-immovable-survey-${idx}`)?.value || '',
          area: byId(`annex-immovable-area-${idx}`)?.value || '',
          unit: byId(`annex-immovable-unit-${idx}`)?.value || 'are',
          village: byId(`annex-immovable-village-${idx}`)?.value || '',
          taluk: byId(`annex-immovable-taluk-${idx}`)?.value || '',
          district: byId(`annex-immovable-district-${idx}`)?.value || '',
          state: byId(`annex-immovable-state-${idx}`)?.value || '',
          inr: byId(`annex-immovable-inr-${idx}`)?.value || '',
          fc: byId(`annex-immovable-fc-${idx}`)?.value || '',
          remark: byId(`annex-immovable-remark-${idx}`)?.value || ''
        };
      }
    });
    
    const currentCount = container.querySelectorAll('.annexure-item').length;
    const n = Math.max(0, parseInt(count, 10) || 0);

    if (n === 0) {
      container.innerHTML = '';
      return;
    }
    if (currentCount > n) {
      byId('annex-num-immovable').value = String(currentCount);
      return;
    }

    for (let i = currentCount; i < n; i++) {
      const item = document.createElement('div');
      item.className = 'annexure-item';
      item.dataset.index = i;
      item.innerHTML = getAnnexureImmovableItemHtml(i);
      container.appendChild(item);
      bindAnnexureImmovableItem(item, i);
    }

    container.querySelectorAll('.annexure-item').forEach(function (item) {
      const idx = parseInt(item.dataset.index, 10);
      if (!isNaN(idx) && existingData[idx]) {
        restoreAnnexureImmovableData(item, idx, existingData[idx]);
      }
    });

    updateAnnexureOwnerDropdowns();
  }

  function getAnnexureImmovableDataForIndex(idx) {
    const ownerEl = byId('annex-immovable-owner-' + idx);
    const owners = ownerEl ? Array.from(ownerEl.selectedOptions).map(function (opt) { return opt.value; }).filter(Boolean) : [];
    return {
      type: byId('annex-immovable-type-' + idx)?.value || '',
      owners: owners,
      buildingNumber: byId('annex-immovable-building-' + idx)?.value || '',
      buildingSqft: byId('annex-immovable-building-sqft-' + idx)?.value || '',
      surveyNumber: byId('annex-immovable-survey-' + idx)?.value || '',
      area: byId('annex-immovable-area-' + idx)?.value || '',
      unit: byId('annex-immovable-unit-' + idx)?.value || 'are',
      village: byId('annex-immovable-village-' + idx)?.value || '',
      taluk: byId('annex-immovable-taluk-' + idx)?.value || '',
      district: byId('annex-immovable-district-' + idx)?.value || '',
      state: byId('annex-immovable-state-' + idx)?.value || '',
      inr: byId('annex-immovable-inr-' + idx)?.value || '',
      fc: byId('annex-immovable-fc-' + idx)?.value || '',
      remark: byId('annex-immovable-remark-' + idx)?.value || ''
    };
  }

  function renumberAnnexureImmovable() {
    const container = byId('annex-immovable-container');
    if (!container) return;
    const items = Array.from(container.querySelectorAll('.annexure-item'));
    const saved = items.map(function (item) { return getAnnexureImmovableDataForIndex(item.dataset.index); });
    items.forEach(function (item, i) {
      item.dataset.index = String(i);
      item.innerHTML = getAnnexureImmovableItemHtml(i);
      bindAnnexureImmovableItem(item, i);
      restoreAnnexureImmovableData(item, i, saved[i] || {});
    });
    if (byId('annex-num-immovable')) byId('annex-num-immovable').value = String(items.length);
    updateAnnexureOwnerDropdowns();
  }

  function getAnnexureImmovableItemHtml(i) {
    return `
      <div class="annexure-row">
        <div class="field">
          <label>Type <span class="required">*</span></label>
          <select class="annex-type" id="annex-immovable-type-${i}">
            <option value="">Select type</option>
            ${ANNEXURE_IMMOVABLE_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Owner Name <span class="required">*</span></label>
          <select class="annex-owner" id="annex-immovable-owner-${i}" multiple size="2">
            ${ownerNameOptions()}
          </select>
          <small class="hint">Hold Ctrl/Cmd</small>
        </div>
        <div class="field annex-field-building" style="display:none;">
          <label>Building Number</label>
          <input type="text" id="annex-immovable-building-${i}" placeholder="Building number" />
        </div>
        <div class="field annex-field-building-sqft" style="display:none;">
          <label>Sq. ft. of the building</label>
          <input type="text" id="annex-immovable-building-sqft-${i}" placeholder="e.g. 1200" inputmode="decimal" />
        </div>
        <div class="field">
          <label>Survey Number <span class="required">*</span></label>
          <input type="text" id="annex-immovable-survey-${i}" placeholder="Survey number" />
        </div>
        <div class="field">
          <label>
            Area <span class="required">*</span>
            <span id="annex-immovable-area-cent-${i}" class="annex-immovable-area-cent"></span>
          </label>
          <input type="text" id="annex-immovable-area-${i}" placeholder="e.g. 2.98" />
        </div>
        <div class="field annex-field-unit">
          <label>Unit <span class="required">*</span></label>
          <select id="annex-immovable-unit-${i}">
            <option value="are">Are</option>
            <option value="sqft">Square Feet</option>
          </select>
        </div>
        <div class="field">
          <label>Village <span class="required">*</span></label>
          <input type="text" id="annex-immovable-village-${i}" placeholder="Village name" />
        </div>
        <div class="field">
          <label>Taluk <span class="required">*</span></label>
          <input type="text" id="annex-immovable-taluk-${i}" placeholder="Taluk name" />
        </div>
        <div class="field">
          <label>District <span class="required">*</span></label>
          <input type="text" id="annex-immovable-district-${i}" placeholder="District name" />
        </div>
        <div class="field">
          <label>State <span class="required">*</span></label>
          <input type="text" id="annex-immovable-state-${i}" placeholder="State name" />
        </div>
        <div class="field">
          <label>Value (INR) <span class="required">*</span></label>
          <input type="text" class="annex-inr" id="annex-immovable-inr-${i}" placeholder="INR" inputmode="decimal" />
        </div>
        <div class="field">
          <label>Value (Foreign Currency)</label>
          <input type="text" class="annex-fc" id="annex-immovable-fc-${i}" placeholder="Auto" inputmode="decimal" readonly class="readonly" />
        </div>
        <div class="field">
          <label>Remarks (not printed in certificate)</label>
          <input type="text" id="annex-immovable-remark-${i}" placeholder="Optional remarks" />
        </div>
        <div class="field annexure-del">
          <label>&nbsp;</label>
          <button type="button" class="btn-delete-annex" data-annex-category="immovable" aria-label="Delete row">Delete</button>
        </div>
      </div>
    `;
  }

  function bindAnnexureImmovableItem(item, i) {
    const typeSelect = item.querySelector(`#annex-immovable-type-${i}`);
    if (typeSelect) {
      typeSelect.addEventListener('change', function () {
        const buildingField = item.querySelector('.annex-field-building');
        const buildingSqftField = item.querySelector('.annex-field-building-sqft');
        const unitField = item.querySelector('.annex-field-unit');
        const type = this.value;
        if (type === 'flat') {
          if (buildingField) buildingField.style.display = '';
          if (buildingSqftField) buildingSqftField.style.display = '';
          if (unitField) {
            const unitSelect = item.querySelector(`#annex-immovable-unit-${i}`);
            if (unitSelect) unitSelect.value = 'sqft';
          }
        } else if (type === 'land-building') {
          if (buildingField) buildingField.style.display = '';
          if (buildingSqftField) buildingSqftField.style.display = '';
          if (unitField) {
            const unitSelect = item.querySelector(`#annex-immovable-unit-${i}`);
            if (unitSelect) unitSelect.value = 'are';
          }
        } else {
          if (buildingField) buildingField.style.display = 'none';
          if (buildingSqftField) buildingSqftField.style.display = 'none';
          if (unitField) {
            const unitSelect = item.querySelector(`#annex-immovable-unit-${i}`);
            if (unitSelect) unitSelect.value = 'are';
          }
        }
      });
    }

    const areaInput = item.querySelector(`#annex-immovable-area-${i}`);
    const unitSelect = item.querySelector(`#annex-immovable-unit-${i}`);
    const centLabel = item.querySelector(`#annex-immovable-area-cent-${i}`);
    if (areaInput && unitSelect && centLabel) {
      const updateCentLabel = function () {
        const raw = (areaInput.value || '').trim();
        const value = parseFloat(raw);
        if (!raw || isNaN(value) || unitSelect.value !== 'are') {
          centLabel.textContent = '';
          return;
        }
        const cents = value * 2.47105;
        const display =
          Math.abs(cents % 1) < 0.005 ? cents.toFixed(0) : cents.toFixed(2);
        centLabel.textContent = ` (${display} cents)`;
      };
      areaInput.addEventListener('input', updateCentLabel);
      unitSelect.addEventListener('change', updateCentLabel);
      updateCentLabel();
    }

    const inrInput = item.querySelector(`#annex-immovable-inr-${i}`);
    if (inrInput) {
      inrInput.addEventListener('input', function () {
        recalcAnnexureForeignValue(`annex-immovable-fc-${i}`, this.value);
      });
      inrInput.addEventListener('blur', function () {
        recalcAnnexureForeignValue(`annex-immovable-fc-${i}`, this.value);
      });
    }
    
    // Format address fields to proper case
    const talukInput = item.querySelector(`#annex-immovable-taluk-${i}`);
    if (talukInput) {
      talukInput.addEventListener('blur', function () {
        const formatted = formatNameToProperCase(this.value);
        if (formatted !== this.value) {
          this.value = formatted;
        }
      });
    }
    const districtInput = item.querySelector(`#annex-immovable-district-${i}`);
    if (districtInput) {
      districtInput.addEventListener('blur', function () {
        const formatted = formatNameToProperCase(this.value);
        if (formatted !== this.value) {
          this.value = formatted;
        }
      });
    }
    const stateInput = item.querySelector(`#annex-immovable-state-${i}`);
    if (stateInput) {
      stateInput.addEventListener('blur', function () {
        const formatted = formatNameToProperCase(this.value);
        if (formatted !== this.value) {
          this.value = formatted;
        }
      });
    }
  }

  function restoreAnnexureImmovableData(item, idx, data) {
    if (byId(`annex-immovable-type-${idx}`)) byId(`annex-immovable-type-${idx}`).value = data.type || '';
    if (byId(`annex-immovable-building-${idx}`)) byId(`annex-immovable-building-${idx}`).value = data.buildingNumber || '';
    if (byId(`annex-immovable-building-sqft-${idx}`)) byId(`annex-immovable-building-sqft-${idx}`).value = data.buildingSqft || '';
    if (byId(`annex-immovable-survey-${idx}`)) byId(`annex-immovable-survey-${idx}`).value = data.surveyNumber || '';
    if (byId(`annex-immovable-area-${idx}`)) byId(`annex-immovable-area-${idx}`).value = data.area || '';
    if (byId(`annex-immovable-unit-${idx}`)) byId(`annex-immovable-unit-${idx}`).value = data.unit || 'are';
    if (byId(`annex-immovable-village-${idx}`)) byId(`annex-immovable-village-${idx}`).value = formatNameToProperCase(data.village || '');
    if (byId(`annex-immovable-taluk-${idx}`)) byId(`annex-immovable-taluk-${idx}`).value = formatNameToProperCase(data.taluk || '');
    if (byId(`annex-immovable-district-${idx}`)) byId(`annex-immovable-district-${idx}`).value = formatNameToProperCase(data.district || '');
    if (byId(`annex-immovable-state-${idx}`)) byId(`annex-immovable-state-${idx}`).value = formatNameToProperCase(data.state || '');
    if (byId(`annex-immovable-inr-${idx}`)) byId(`annex-immovable-inr-${idx}`).value = data.inr || '';
    if (byId(`annex-immovable-fc-${idx}`)) byId(`annex-immovable-fc-${idx}`).value = data.fc || '';
    if (byId(`annex-immovable-remark-${idx}`)) byId(`annex-immovable-remark-${idx}`).value = data.remark || '';
    const ownerEl = byId(`annex-immovable-owner-${idx}`);
    if (ownerEl && data.owners) {
      Array.from(ownerEl.options).forEach(function (opt) {
        opt.selected = data.owners.indexOf(opt.value) >= 0;
      });
    }
    // Trigger type change to show/hide fields
    if (byId(`annex-immovable-type-${idx}`)) {
      byId(`annex-immovable-type-${idx}`).dispatchEvent(new Event('change'));
    }
  }

  function renderAnnexureMovable(count) {
    const container = byId('annex-movable-container');
    if (!container) return;
    
    // Save existing data
    const existingData = {};
    container.querySelectorAll('.annexure-item').forEach(function (item) {
      const idx = parseInt(item.dataset.index, 10);
      if (!isNaN(idx)) {
        const typeEl = byId(`annex-movable-type-${idx}`);
        const ownerEl = byId(`annex-movable-owner-${idx}`);
        const owners = [];
        if (ownerEl) {
          Array.from(ownerEl.selectedOptions).forEach(function (opt) {
            if (opt.value) owners.push(opt.value);
          });
        }
        existingData[idx] = {
          type: typeEl ? typeEl.value : '',
          owners: owners,
          weight: byId(`annex-movable-weight-${idx}`)?.value || '',
          dpAccount: byId(`annex-movable-dp-${idx}`)?.value || '',
          valuationDate: byId(`annex-movable-date-${idx}`)?.value || '',
          company: byId(`annex-movable-company-${idx}`)?.value || '',
          model: byId(`annex-movable-model-${idx}`)?.value || '',
          vehicleNumber: byId(`annex-movable-vehicle-${idx}`)?.value || '',
          inr: byId(`annex-movable-inr-${idx}`)?.value || '',
          fc: byId(`annex-movable-fc-${idx}`)?.value || '',
          remark: byId(`annex-movable-remark-${idx}`)?.value || ''
        };
      }
    });
    
    const currentCount = container.querySelectorAll('.annexure-item').length;
    const n = Math.max(0, parseInt(count, 10) || 0);

    if (n === 0) {
      container.innerHTML = '';
      return;
    }
    if (currentCount > n) {
      byId('annex-num-movable').value = String(currentCount);
      return;
    }

    for (let i = currentCount; i < n; i++) {
      const item = document.createElement('div');
      item.className = 'annexure-item';
      item.dataset.index = i;
      item.innerHTML = getAnnexureMovableItemHtml(i);
      container.appendChild(item);
      bindAnnexureMovableItem(item, i);
    }

    container.querySelectorAll('.annexure-item').forEach(function (item) {
      const idx = parseInt(item.dataset.index, 10);
      if (!isNaN(idx) && existingData[idx]) {
        restoreAnnexureMovableData(item, idx, existingData[idx]);
      }
    });

    updateAnnexureOwnerDropdowns();
  }

  function getAnnexureMovableDataForIndex(idx) {
    const ownerEl = byId('annex-movable-owner-' + idx);
    const owners = ownerEl ? Array.from(ownerEl.selectedOptions).map(function (opt) { return opt.value; }).filter(Boolean) : [];
    return {
      type: byId('annex-movable-type-' + idx)?.value || '',
      owners: owners,
      weight: byId('annex-movable-weight-' + idx)?.value || '',
      dpAccount: byId('annex-movable-dp-' + idx)?.value || '',
      valuationDate: byId('annex-movable-date-' + idx)?.value || '',
      company: byId('annex-movable-company-' + idx)?.value || '',
      model: byId('annex-movable-model-' + idx)?.value || '',
      vehicleNumber: byId('annex-movable-vehicle-' + idx)?.value || '',
      inr: byId('annex-movable-inr-' + idx)?.value || '',
      fc: byId('annex-movable-fc-' + idx)?.value || '',
      remark: byId('annex-movable-remark-' + idx)?.value || ''
    };
  }

  function renumberAnnexureMovable() {
    const container = byId('annex-movable-container');
    if (!container) return;
    const items = Array.from(container.querySelectorAll('.annexure-item'));
    const saved = items.map(function (item) { return getAnnexureMovableDataForIndex(item.dataset.index); });
    items.forEach(function (item, i) {
      item.dataset.index = String(i);
      item.innerHTML = getAnnexureMovableItemHtml(i);
      bindAnnexureMovableItem(item, i);
      restoreAnnexureMovableData(item, i, saved[i] || {});
    });
    if (byId('annex-num-movable')) byId('annex-num-movable').value = String(items.length);
    updateAnnexureOwnerDropdowns();
  }

  function getAnnexureMovableItemHtml(i) {
    return `
      <div class="annexure-row">
        <div class="field">
          <label>Type <span class="required">*</span></label>
          <select class="annex-type" id="annex-movable-type-${i}">
            <option value="">Select type</option>
            ${ANNEXURE_MOVABLE_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="field annex-field-owner" style="display:none;">
          <label>Owner Name <span class="required">*</span></label>
          <select class="annex-owner" id="annex-movable-owner-${i}" multiple size="2">
            ${ownerNameOptions()}
          </select>
          <small class="hint">Hold Ctrl/Cmd</small>
        </div>
        <div class="field annex-field-weight" style="display:none;">
          <label>Weight (gm) <span class="required">*</span></label>
          <input type="text" id="annex-movable-weight-${i}" placeholder="Weight in grams" />
        </div>
        <div class="field annex-field-dp-account" style="display:none;">
          <label>DP Account Number <span class="required">*</span></label>
          <input type="text" id="annex-movable-dp-${i}" placeholder="DP account number" />
        </div>
        <div class="field annex-field-valuation-date" style="display:none;">
          <label>Valuation Date <span class="required">*</span></label>
          <input type="date" id="annex-movable-date-${i}" />
        </div>
        <div class="field annex-field-company" style="display:none;">
          <label>Company/Broker Name <span class="required">*</span></label>
          <input type="text" id="annex-movable-company-${i}" placeholder="Company or broker name" />
        </div>
        <div class="field annex-field-model" style="display:none;">
          <label>Model Name <span class="required">*</span></label>
          <input type="text" id="annex-movable-model-${i}" placeholder="Vehicle model" />
        </div>
        <div class="field annex-field-vehicle-no" style="display:none;">
          <label>Vehicle Number <span class="required">*</span></label>
          <input type="text" id="annex-movable-vehicle-${i}" placeholder="Vehicle registration number" />
        </div>
        <div class="field">
          <label>Value (INR) <span class="required">*</span></label>
          <input type="text" class="annex-inr" id="annex-movable-inr-${i}" placeholder="INR" inputmode="decimal" />
        </div>
        <div class="field">
          <label>Value (Foreign Currency)</label>
          <input type="text" class="annex-fc" id="annex-movable-fc-${i}" placeholder="Auto" inputmode="decimal" readonly class="readonly" />
        </div>
        <div class="field">
          <label>Remarks (not printed in certificate)</label>
          <input type="text" id="annex-movable-remark-${i}" placeholder="Optional remarks" />
        </div>
        <div class="field annexure-del">
          <label>&nbsp;</label>
          <button type="button" class="btn-delete-annex" data-annex-category="movable" aria-label="Delete row">Delete</button>
        </div>
      </div>
    `;
  }

  function bindAnnexureMovableItem(item, i) {
    const typeSelect = item.querySelector(`#annex-movable-type-${i}`);
    if (typeSelect) {
      typeSelect.addEventListener('change', function () {
        const type = this.value;
        // Hide all fields first
        item.querySelectorAll('.annex-field-owner, .annex-field-weight, .annex-field-dp-account, .annex-field-valuation-date, .annex-field-company, .annex-field-model, .annex-field-vehicle-no').forEach(function (f) {
          f.style.display = 'none';
        });
        // Show relevant fields based on type
        if (type === 'gold' || type === 'silver') {
          item.querySelector('.annex-field-weight').style.display = '';
        } else if (type === 'shares' || type === 'debenture') {
          item.querySelector('.annex-field-owner').style.display = '';
          item.querySelector('.annex-field-dp-account').style.display = '';
          item.querySelector('.annex-field-valuation-date').style.display = '';
        } else if (type === 'mutual-fund') {
          item.querySelector('.annex-field-owner').style.display = '';
          item.querySelector('.annex-field-company').style.display = '';
          item.querySelector('.annex-field-valuation-date').style.display = '';
        } else if (type === 'motor-vehicle') {
          item.querySelector('.annex-field-owner').style.display = '';
          item.querySelector('.annex-field-model').style.display = '';
          item.querySelector('.annex-field-vehicle-no').style.display = '';
        }
      });
    }
    
    const inrInput = item.querySelector(`#annex-movable-inr-${i}`);
    if (inrInput) {
      inrInput.addEventListener('input', function () {
        recalcAnnexureForeignValue(`annex-movable-fc-${i}`, this.value);
      });
      inrInput.addEventListener('blur', function () {
        recalcAnnexureForeignValue(`annex-movable-fc-${i}`, this.value);
      });
    }
  }

  function restoreAnnexureMovableData(item, idx, data) {
    if (byId(`annex-movable-type-${idx}`)) byId(`annex-movable-type-${idx}`).value = data.type || '';
    if (byId(`annex-movable-weight-${idx}`)) byId(`annex-movable-weight-${idx}`).value = data.weight || '';
    if (byId(`annex-movable-dp-${idx}`)) byId(`annex-movable-dp-${idx}`).value = data.dpAccount || '';
    if (byId(`annex-movable-date-${idx}`)) byId(`annex-movable-date-${idx}`).value = data.valuationDate || '';
    if (byId(`annex-movable-company-${idx}`)) byId(`annex-movable-company-${idx}`).value = data.company || '';
    if (byId(`annex-movable-model-${idx}`)) byId(`annex-movable-model-${idx}`).value = data.model || '';
    if (byId(`annex-movable-vehicle-${idx}`)) byId(`annex-movable-vehicle-${idx}`).value = data.vehicleNumber || '';
    if (byId(`annex-movable-inr-${idx}`)) byId(`annex-movable-inr-${idx}`).value = data.inr || '';
    if (byId(`annex-movable-fc-${idx}`)) byId(`annex-movable-fc-${idx}`).value = data.fc || '';
    if (byId(`annex-movable-remark-${idx}`)) byId(`annex-movable-remark-${idx}`).value = data.remark || '';
    const ownerEl = byId(`annex-movable-owner-${idx}`);
    if (ownerEl && data.owners) {
      Array.from(ownerEl.options).forEach(function (opt) {
        opt.selected = data.owners.indexOf(opt.value) >= 0;
      });
    }
    if (byId(`annex-movable-type-${idx}`)) {
      byId(`annex-movable-type-${idx}`).dispatchEvent(new Event('change'));
    }
  }

  function renderAnnexureSavings(count) {
    const container = byId('annex-savings-container');
    if (!container) return;
    
    // Save existing data
    const existingData = {};
    container.querySelectorAll('.annexure-item').forEach(function (item) {
      const idx = parseInt(item.dataset.index, 10);
      if (!isNaN(idx)) {
        const typeEl = byId(`annex-savings-type-${idx}`);
        const ownerEl = byId(`annex-savings-owner-${idx}`);
        const owners = [];
        if (ownerEl) {
          Array.from(ownerEl.selectedOptions).forEach(function (opt) {
            if (opt.value) owners.push(opt.value);
          });
        }
        existingData[idx] = {
          type: typeEl ? typeEl.value : '',
          owners: owners,
          bankType: byId(`annex-savings-bank-type-${idx}`)?.value || '',
          accountNumber: byId(`annex-savings-account-${idx}`)?.value || '',
          bankName: byId(`annex-savings-bank-${idx}`)?.value || '',
          valuationDate: byId(`annex-savings-date-${idx}`)?.value || '',
          policyNumber: byId(`annex-savings-policy-${idx}`)?.value || '',
          insurerName: byId(`annex-savings-insurer-${idx}`)?.value || '',
          inr: byId(`annex-savings-inr-${idx}`)?.value || '',
          fc: byId(`annex-savings-fc-${idx}`)?.value || '',
          remark: byId(`annex-savings-remark-${idx}`)?.value || ''
        };
      }
    });
    
    const currentCount = container.querySelectorAll('.annexure-item').length;
    const n = Math.max(0, parseInt(count, 10) || 0);

    if (n === 0) {
      container.innerHTML = '';
      return;
    }
    if (currentCount > n) {
      byId('annex-num-savings').value = String(currentCount);
      return;
    }

    for (let i = currentCount; i < n; i++) {
      const item = document.createElement('div');
      item.className = 'annexure-item';
      item.dataset.index = i;
      item.innerHTML = getAnnexureSavingsItemHtml(i);
      container.appendChild(item);
      bindAnnexureSavingsItem(item, i);
    }

    container.querySelectorAll('.annexure-item').forEach(function (item) {
      const idx = parseInt(item.dataset.index, 10);
      if (!isNaN(idx) && existingData[idx]) {
        restoreAnnexureSavingsData(item, idx, existingData[idx]);
      }
    });

    updateAnnexureOwnerDropdowns();
  }

  function getAnnexureSavingsDataForIndex(idx) {
    const ownerEl = byId('annex-savings-owner-' + idx);
    const owners = ownerEl ? Array.from(ownerEl.selectedOptions).map(function (opt) { return opt.value; }).filter(Boolean) : [];
    return {
      type: byId('annex-savings-type-' + idx)?.value || '',
      bankType: byId('annex-savings-bank-type-' + idx)?.value || '',
      owners: owners,
      accountNumber: byId('annex-savings-account-' + idx)?.value || '',
      bankName: byId('annex-savings-bank-' + idx)?.value || '',
      valuationDate: byId('annex-savings-date-' + idx)?.value || '',
      policyNumber: byId('annex-savings-policy-' + idx)?.value || '',
      insurerName: byId('annex-savings-insurer-' + idx)?.value || '',
      inr: byId('annex-savings-inr-' + idx)?.value || '',
      fc: byId('annex-savings-fc-' + idx)?.value || '',
      remark: byId('annex-savings-remark-' + idx)?.value || ''
    };
  }

  function renumberAnnexureSavings() {
    const container = byId('annex-savings-container');
    if (!container) return;
    const items = Array.from(container.querySelectorAll('.annexure-item'));
    const saved = items.map(function (item) { return getAnnexureSavingsDataForIndex(item.dataset.index); });
    items.forEach(function (item, i) {
      item.dataset.index = String(i);
      item.innerHTML = getAnnexureSavingsItemHtml(i);
      bindAnnexureSavingsItem(item, i);
      restoreAnnexureSavingsData(item, i, saved[i] || {});
    });
    if (byId('annex-num-savings')) byId('annex-num-savings').value = String(items.length);
    updateAnnexureOwnerDropdowns();
  }

  function getAnnexureSavingsItemHtml(i) {
    return `
      <div class="annexure-row">
        <div class="field">
          <label>Type <span class="required">*</span></label>
          <select class="annex-type" id="annex-savings-type-${i}">
            <option value="">Select type</option>
            ${ANNEXURE_SAVINGS_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="field annex-field-bank-type" style="display:none;">
          <label>Bank Account Type <span class="required">*</span></label>
          <select id="annex-savings-bank-type-${i}">
            <option value="">Select</option>
            ${BANK_ACCOUNT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="field annex-field-owner">
          <label>Owner Name <span class="required">*</span></label>
          <select class="annex-owner" id="annex-savings-owner-${i}" multiple size="2">
            ${ownerNameOptions()}
          </select>
          <small class="hint">Hold Ctrl/Cmd</small>
        </div>
        <div class="field annex-field-account" style="display:none;">
          <label>Account Number <span class="required">*</span></label>
          <input type="text" id="annex-savings-account-${i}" placeholder="Account number" />
        </div>
        <div class="field annex-field-bank-name" style="display:none;">
          <label>Bank Name <span class="required">*</span></label>
          <input type="text" id="annex-savings-bank-${i}" placeholder="Bank name" />
        </div>
        <div class="field annex-field-valuation-date">
          <label>Valuation Date <span class="required">*</span></label>
          <input type="date" id="annex-savings-date-${i}" />
        </div>
        <div class="field annex-field-policy" style="display:none;">
          <label>Policy Number <span class="required">*</span></label>
          <input type="text" id="annex-savings-policy-${i}" placeholder="Policy number" />
        </div>
        <div class="field annex-field-insurer" style="display:none;">
          <label>Insurer Name <span class="required">*</span></label>
          <input type="text" id="annex-savings-insurer-${i}" placeholder="Insurance company name" />
        </div>
        <div class="field">
          <label>Value (INR) <span class="required">*</span></label>
          <input type="text" class="annex-inr" id="annex-savings-inr-${i}" placeholder="INR" inputmode="decimal" />
        </div>
        <div class="field">
          <label>Value (Foreign Currency)</label>
          <input type="text" class="annex-fc" id="annex-savings-fc-${i}" placeholder="Auto" inputmode="decimal" readonly class="readonly" />
        </div>
        <div class="field">
          <label>Remarks (not printed in certificate)</label>
          <input type="text" id="annex-savings-remark-${i}" placeholder="Optional remarks" />
        </div>
        <div class="field annexure-del">
          <label>&nbsp;</label>
          <button type="button" class="btn-delete-annex" data-annex-category="savings" aria-label="Delete row">Delete</button>
        </div>
      </div>
    `;
  }

  function bindAnnexureSavingsItem(item, i) {
    const typeSelect = item.querySelector(`#annex-savings-type-${i}`);
    if (typeSelect) {
      typeSelect.addEventListener('change', function () {
        const type = this.value;
        // Hide all conditional fields first
        item.querySelectorAll('.annex-field-bank-type, .annex-field-account, .annex-field-bank-name, .annex-field-policy, .annex-field-insurer').forEach(function (f) {
          f.style.display = 'none';
        });
        // Show relevant fields
        if (type === 'bank-account') {
          item.querySelector('.annex-field-bank-type').style.display = '';
          item.querySelector('.annex-field-account').style.display = '';
          item.querySelector('.annex-field-bank-name').style.display = '';
        } else if (type === 'ppf' || type === 'epf' || type === 'nps') {
          item.querySelector('.annex-field-account').style.display = '';
        } else if (type === 'life-insurance') {
          item.querySelector('.annex-field-policy').style.display = '';
          item.querySelector('.annex-field-insurer').style.display = '';
        }
      });
    }
    
    const inrInput = item.querySelector(`#annex-savings-inr-${i}`);
    if (inrInput) {
      inrInput.addEventListener('input', function () {
        recalcAnnexureForeignValue(`annex-savings-fc-${i}`, this.value);
      });
      inrInput.addEventListener('blur', function () {
        recalcAnnexureForeignValue(`annex-savings-fc-${i}`, this.value);
      });
    }
  }

  function restoreAnnexureSavingsData(item, idx, data) {
    if (byId(`annex-savings-type-${idx}`)) byId(`annex-savings-type-${idx}`).value = data.type || '';
    if (byId(`annex-savings-bank-type-${idx}`)) byId(`annex-savings-bank-type-${idx}`).value = data.bankType || '';
    if (byId(`annex-savings-account-${idx}`)) byId(`annex-savings-account-${idx}`).value = data.accountNumber || '';
    if (byId(`annex-savings-bank-${idx}`)) byId(`annex-savings-bank-${idx}`).value = data.bankName || '';
    if (byId(`annex-savings-date-${idx}`)) byId(`annex-savings-date-${idx}`).value = data.valuationDate || '';
    if (byId(`annex-savings-policy-${idx}`)) byId(`annex-savings-policy-${idx}`).value = data.policyNumber || '';
    if (byId(`annex-savings-insurer-${idx}`)) byId(`annex-savings-insurer-${idx}`).value = data.insurerName || '';
    if (byId(`annex-savings-inr-${idx}`)) byId(`annex-savings-inr-${idx}`).value = data.inr || '';
    if (byId(`annex-savings-fc-${idx}`)) byId(`annex-savings-fc-${idx}`).value = data.fc || '';
    if (byId(`annex-savings-remark-${idx}`)) byId(`annex-savings-remark-${idx}`).value = data.remark || '';
    const ownerEl = byId(`annex-savings-owner-${idx}`);
    if (ownerEl && data.owners) {
      Array.from(ownerEl.options).forEach(function (opt) {
        opt.selected = data.owners.indexOf(opt.value) >= 0;
      });
    }
    if (byId(`annex-savings-type-${idx}`)) {
      byId(`annex-savings-type-${idx}`).dispatchEvent(new Event('change'));
    }
  }

  function initAnnexure() {
    renderAnnexureImmovable(0);
    renderAnnexureMovable(0);
    renderAnnexureSavings(0);
  }

  function getAnnexureImmovableData() {
    const num = Math.max(0, parseInt(byId('annex-num-immovable')?.value, 10) || 0);
    const data = [];
    for (let i = 0; i < num; i++) {
      const type = byId(`annex-immovable-type-${i}`)?.value || '';
      // Collect owner names - ensure they are saved
      const ownerEl = byId(`annex-immovable-owner-${i}`);
      const owners = [];
      if (ownerEl && ownerEl.tagName === 'SELECT') {
        // Get all selected options from the multiple select
        const selectedOptions = ownerEl.selectedOptions || [];
        Array.from(selectedOptions).forEach(function (opt) {
          if (opt.value && opt.value.trim()) {
            owners.push(opt.value.trim());
          }
        });
      }
      if (type) {
        data.push({
          type: type,
          owners: owners, // Always include owners array, even if empty
          buildingNumber: byId(`annex-immovable-building-${i}`)?.value?.trim() || '',
          buildingSqft: byId(`annex-immovable-building-sqft-${i}`)?.value?.trim() || '',
          surveyNumber: byId(`annex-immovable-survey-${i}`)?.value?.trim() || '',
          area: byId(`annex-immovable-area-${i}`)?.value?.trim() || '',
          unit: byId(`annex-immovable-unit-${i}`)?.value || 'are',
          village: byId(`annex-immovable-village-${i}`)?.value?.trim() || '',
          taluk: byId(`annex-immovable-taluk-${i}`)?.value?.trim() || '',
          district: byId(`annex-immovable-district-${i}`)?.value?.trim() || '',
          state: byId(`annex-immovable-state-${i}`)?.value?.trim() || '',
          inr: byId(`annex-immovable-inr-${i}`)?.value?.trim() || '',
          fc: byId(`annex-immovable-fc-${i}`)?.value?.trim() || '',
          remark: byId(`annex-immovable-remark-${i}`)?.value?.trim() || ''
        });
      }
    }
    return data;
  }

  function getAnnexureMovableData() {
    const num = Math.max(0, parseInt(byId('annex-num-movable')?.value, 10) || 0);
    const data = [];
    for (let i = 0; i < num; i++) {
      const type = byId(`annex-movable-type-${i}`)?.value || '';
      if (type) {
        // Collect owner names - ensure they are saved
        const ownerEl = byId(`annex-movable-owner-${i}`);
        const owners = [];
        if (ownerEl && ownerEl.tagName === 'SELECT') {
          // Get all selected options from the multiple select
          const selectedOptions = ownerEl.selectedOptions || [];
          Array.from(selectedOptions).forEach(function (opt) {
            if (opt.value && opt.value.trim()) {
              owners.push(opt.value.trim());
            }
          });
        }
        data.push({
          type: type,
          owners: owners, // Always include owners array, even if empty
          weight: byId(`annex-movable-weight-${i}`)?.value?.trim() || '',
          dpAccount: byId(`annex-movable-dp-${i}`)?.value?.trim() || '',
          valuationDate: byId(`annex-movable-date-${i}`)?.value || '',
          company: byId(`annex-movable-company-${i}`)?.value?.trim() || '',
          model: byId(`annex-movable-model-${i}`)?.value?.trim() || '',
          vehicleNumber: byId(`annex-movable-vehicle-${i}`)?.value?.trim() || '',
          inr: byId(`annex-movable-inr-${i}`)?.value?.trim() || '',
          fc: byId(`annex-movable-fc-${i}`)?.value?.trim() || '',
          remark: byId(`annex-movable-remark-${i}`)?.value?.trim() || ''
        });
      }
    }
    return data;
  }

  function getAnnexureSavingsData() {
    const num = Math.max(0, parseInt(byId('annex-num-savings')?.value, 10) || 0);
    const data = [];
    for (let i = 0; i < num; i++) {
      const type = byId(`annex-savings-type-${i}`)?.value || '';
      if (type) {
        // Collect owner names - ensure they are saved
        const ownerEl = byId(`annex-savings-owner-${i}`);
        const owners = [];
        if (ownerEl && ownerEl.tagName === 'SELECT') {
          // Get all selected options from the multiple select
          const selectedOptions = ownerEl.selectedOptions || [];
          Array.from(selectedOptions).forEach(function (opt) {
            if (opt.value && opt.value.trim()) {
              owners.push(opt.value.trim());
            }
          });
        }
        data.push({
          type: type,
          owners: owners, // Always include owners array, even if empty
          bankType: byId(`annex-savings-bank-type-${i}`)?.value || '',
          accountNumber: byId(`annex-savings-account-${i}`)?.value?.trim() || '',
          bankName: byId(`annex-savings-bank-${i}`)?.value?.trim() || '',
          valuationDate: byId(`annex-savings-date-${i}`)?.value || '',
          policyNumber: byId(`annex-savings-policy-${i}`)?.value?.trim() || '',
          insurerName: byId(`annex-savings-insurer-${i}`)?.value?.trim() || '',
          inr: byId(`annex-savings-inr-${i}`)?.value?.trim() || '',
          fc: byId(`annex-savings-fc-${i}`)?.value?.trim() || '',
          remark: byId(`annex-savings-remark-${i}`)?.value?.trim() || ''
        });
      }
    }
    return data;
  }

  function formatOwnersList(owners) {
    if (!owners || owners.length === 0) return '';
    if (owners.length === 1) return owners[0];
    if (owners.length === 2) return owners[0] + ' and ' + owners[1];
    const last = owners.pop();
    return owners.join(', ') + ', and ' + last;
  }

  function formatDateForAnnexure(dateStr) {
    if (!dateStr) return '';
    return formatDateDDMMYYYY(dateStr);
  }

  function generateImmovableWording(item) {
    const owners = formatOwnersList(item.owners);
    const unit = item.unit === 'sqft' ? 'sq ft.' : 'are';
    const area = item.area ? `(${item.area} ${unit})` : '';
    const location = [item.village, item.taluk, item.district, item.state].filter(Boolean).join(', ');
    
    switch (item.type) {
      case 'land-building': {
        const buildingNum = item.buildingNumber && item.buildingNumber.trim();
        const buildingSqft = item.buildingSqft && item.buildingSqft.trim();
        let buildingPart = '';
        if (buildingNum && buildingSqft) {
          buildingPart = `having building number ${buildingNum.trim()} and building area ${buildingSqft.trim()} sq. ft., `;
        } else if (buildingNum) {
          buildingPart = `having building number ${buildingNum.trim()} `;
        } else if (buildingSqft) {
          buildingPart = `having building area ${buildingSqft.trim()} sq. ft., `;
        }
        const spacing = buildingPart ? ' ' : '';
        return `Land and building in the name of ${owners} ${buildingPart}${spacing}at survey number ${item.surveyNumber || ''} ${area} in ${location}`;
      }
      case 'flat': {
        const flatBuildingNum = item.buildingNumber && item.buildingNumber.trim();
        const flatBuildingSqft = item.buildingSqft && item.buildingSqft.trim();
        let flatBuildingPart = '';
        if (flatBuildingNum && flatBuildingSqft) {
          flatBuildingPart = `with building number ${flatBuildingNum} and building area ${flatBuildingSqft} sq. ft., `;
        } else if (flatBuildingNum) {
          flatBuildingPart = `with building number ${flatBuildingNum} `;
        } else if (flatBuildingSqft) {
          flatBuildingPart = `with building area ${flatBuildingSqft} sq. ft., `;
        }
        return `Flat ${flatBuildingPart}in the name of ${owners} at survey number ${item.surveyNumber || ''} ${area} in ${location}`;
      }
      case 'land':
        return `Land in the name of ${owners} at survey number ${item.surveyNumber || ''} ${area} in ${location}`;
      case 'commercial':
        return `Commercial building in the name of ${owners} at survey number ${item.surveyNumber || ''} ${area} in ${location}`;
      default:
        return '';
    }
  }

  function generateMovableWording(item) {
    const owners = formatOwnersList(item.owners);
    const date = formatDateForAnnexure(item.valuationDate);
    
    switch (item.type) {
      case 'gold':
        return `Gold ornaments- ${item.weight || ''}gm.`;
      case 'silver':
        return `Silver ornaments- ${item.weight || ''}gm.`;
      case 'shares':
        return `Shares held in DP account no. ${item.dpAccount || ''} in the name of ${owners} on ${date}`;
      case 'debenture':
        return `Debenture held in DP account no. ${item.dpAccount || ''} in the name of ${owners} on ${date}`;
      case 'mutual-fund':
        return `Mutual Fund held in the name of ${owners} held with ${item.company || ''} on ${date}`;
      case 'motor-vehicle':
        return `Motor Vehicle- ${item.model || ''} having ${item.vehicleNumber || ''} in the name of ${owners}`;
      default:
        return '';
    }
  }

  function generateSavingsWording(item) {
    const owners = formatOwnersList(item.owners);
    const date = formatDateForAnnexure(item.valuationDate);
    
    switch (item.type) {
      case 'bank-account':
        return `${item.bankType ? item.bankType + ' ' : ''}bank account in the name of ${owners} in account number ${item.accountNumber || ''} held with ${item.bankName || ''} as on ${date}`;
      case 'ppf':
        return `PPF accounts balance in the name of ${owners} in ${item.accountNumber || ''} as on ${date}`;
      case 'epf':
        return `EPF accounts balance in the name of ${owners} in ${item.accountNumber || ''} as on ${date}`;
      case 'nps':
        return `NPS accounts balance in the name of ${owners} in ${item.accountNumber || ''} as on ${date}`;
      case 'life-insurance':
        return `Life insurance having policy number ${item.policyNumber || ''} with ${item.insurerName || ''} in the name of ${owners} on ${date}`;
      default:
        return '';
    }
  }


  // ——— Init ———
  function init() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Enable Home, End, PageUp, PageDown: scroll when focus is not in an input
    document.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k !== 'Home' && k !== 'End' && k !== 'PageUp' && k !== 'PageDown') return;
      var el = document.activeElement;
      var tag = el && el.tagName ? el.tagName.toUpperCase() : '';
      var isInput = el && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable);
      if (isInput) return;
      e.preventDefault();
      var h = window.innerHeight;
      var s = window.scrollY || document.documentElement.scrollTop;
      var d = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      if (k === 'Home') window.scrollTo(0, 0);
      else if (k === 'End') window.scrollTo(0, Math.max(0, d - h));
      else if (k === 'PageUp') window.scrollTo(0, Math.max(0, s - h));
      else if (k === 'PageDown') window.scrollTo(0, Math.min(d - h, s + h));
    }, true);

    const numApplicants = byId('num-applicants');
    const numAssessed = byId('num-assessed');

    const applicantsContainer = byId('applicants-container');
    if (applicantsContainer) {
      applicantsContainer.addEventListener('click', function (e) {
        const btn = e.target.closest('.btn-delete-applicant');
        if (!btn || btn.disabled) return;
        const block = btn.closest('.applicant-block');
        if (!block || applicantsContainer.querySelectorAll('.applicant-block').length <= 1) return;
        block.remove();
        renumberApplicantBlocks();
      });
    }
    if (numApplicants) {
      numApplicants.addEventListener('change', function () {
        renderApplicants(this.value);
        refreshApplicantRelationshipFields();
      });
      renderApplicants(numApplicants.value);
    }
    const assessedContainer = byId('assessed-container');
    if (assessedContainer) {
      assessedContainer.addEventListener('click', function (e) {
        const btn = e.target.closest('.btn-delete-assessed');
        if (!btn) return;
        const block = btn.closest('.assessed-block');
        if (!block) return;
        block.remove();
        renumberAssessedBlocks();
      });
    }
    if (numAssessed) {
      numAssessed.addEventListener('change', function () {
        renderAssessed(this.value);
        updateAssetOwnerDropdowns(true);
        refreshApplicantRelationshipFields();
      });
      renderAssessed(numAssessed.value);
      refreshApplicantRelationshipFields();
    }

    const numImmovable = byId('num-immovable');
    const numMovable = byId('num-movable');
    const numSavings = byId('num-savings');
    if (numImmovable) {
      numImmovable.addEventListener('change', function () { renderAssetsByCategory(); });
    }
    if (numMovable) {
      numMovable.addEventListener('change', function () { renderAssetsByCategory(); });
    }
    if (numSavings) {
      numSavings.addEventListener('change', function () { renderAssetsByCategory(); });
    }

    initAssets();

    // Annexure 1 event listeners
    const annexNumImmovable = byId('annex-num-immovable');
    const annexNumMovable = byId('annex-num-movable');
    const annexNumSavings = byId('annex-num-savings');
    if (annexNumImmovable) {
      annexNumImmovable.addEventListener('change', function () {
        renderAnnexureImmovable(this.value);
        updateAnnexureOwnerDropdowns();
      });
    }
    if (annexNumMovable) {
      annexNumMovable.addEventListener('change', function () {
        renderAnnexureMovable(this.value);
        updateAnnexureOwnerDropdowns();
      });
    }
    if (annexNumSavings) {
      annexNumSavings.addEventListener('change', function () {
        renderAnnexureSavings(this.value);
        updateAnnexureOwnerDropdowns();
      });
    }
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.btn-delete-annex');
      if (!btn) return;
      const item = btn.closest('.annexure-item');
      if (!item) return;
      const cat = btn.getAttribute('data-annex-category');
      item.remove();
      if (cat === 'immovable') renumberAnnexureImmovable();
      else if (cat === 'movable') renumberAnnexureMovable();
      else if (cat === 'savings') renumberAnnexureSavings();
    });
    initAnnexure();

    byId('preview-btn')?.addEventListener('click', openPreview);
    byId('close-preview')?.addEventListener('click', closePreview);
    byId('close-preview-2')?.addEventListener('click', closePreview);
    byId('export-word-from-preview')?.addEventListener('click', exportToWord);
    byId('save-file-btn')?.addEventListener('click', saveToFile);
    byId('load-file-btn')?.addEventListener('click', loadFromFile);

    var defaultFolderBar = byId('default-folder-bar');
    if (defaultFolderBar) {
      if (window.showDirectoryPicker) {
        getStoredDefaultDir().then(updateDefaultFolderUI);
        byId('choose-default-folder-btn')?.addEventListener('click', function () {
          window.showDirectoryPicker().then(function (handle) {
            networthDefaultDirHandle = handle;
            setStoredDefaultDir(handle).then(function () {
              updateDefaultFolderUI();
            });
          }).catch(function () {});
        });
      } else {
        defaultFolderBar.style.display = 'none';
      }
    }

    // Update owner dropdowns when applicant checkboxes change (handled in renderApplicants)
    byId('file-input')?.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function (ev) {
        try {
          const data = JSON.parse(ev.target.result);
          // Reset the form before loading new file
          resetForm();
          // Small delay to ensure reset completes before loading
          setTimeout(function() {
            if (loadFormData(data)) {
              alert('File loaded successfully!');
            } else {
              alert('Invalid file format.');
            }
          }, 50);
        } catch (err) {
          alert('Error loading file: ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
    byId('reset-btn')?.addEventListener('click', resetForm);

    byId('preview-modal')?.addEventListener('click', function (e) {
      if (e.target === this) closePreview();
    });

    setDefaultSigningDate();
    bindPanValidation();
    // Initialize country dropdown
    const countrySel = byId('country-visiting');
    if (countrySel) {
      if (!countrySel.innerHTML.trim()) {
        countrySel.innerHTML = countryOptions(true);
      }
      // Add event listener to sync currency when country changes
      countrySel.addEventListener('change', syncAssetCurrencyFromApplicant);
    }
    // Format UDIN field to uppercase
    const udinInput = byId('udin');
    if (udinInput) {
      udinInput.addEventListener('input', function () {
        const cursorPos = this.selectionStart;
        const oldValue = this.value;
        const newValue = formatToUppercase(this.value);
        if (newValue !== oldValue) {
          this.value = newValue;
          // Restore cursor position
          const diff = newValue.length - oldValue.length;
          this.setSelectionRange(cursorPos + diff, cursorPos + diff);
        }
      });
      udinInput.addEventListener('blur', function () {
        const formatted = formatToUppercase(this.value);
        if (formatted !== this.value) {
          this.value = formatted;
        }
      });
    }
    syncAssetCurrencyFromApplicant();
    bindConversionRateListeners();
    updateStaffDisplay();
    // Ask parent for current staff name (in case parent loaded first)
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'networth-ready' }, '*');
      }
    } catch (err) {}
  }

  // Expose a safe hook so parent page can refresh staff display (sends current user; does not overwrite "last saved by" from file)
  window.updateNetworthStaffDisplay = function (staffFromParent) {
    if (typeof staffFromParent === 'string') {
      networthCurrentUserFromParent = staffFromParent.trim();
    } else {
      networthCurrentUserFromParent = '';
    }
    updateStaffDisplay();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
