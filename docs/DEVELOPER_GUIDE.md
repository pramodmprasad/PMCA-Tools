# PMCA Tools – Developer Guide

Technical documentation for developers maintaining or extending the app.

---

## Architecture Overview

- **Type:** Single-page application (SPA) – HTML + inline JavaScript
- **Main file:** `PMCA Tools.html` (~4,500 lines)
- **Data storage:** `Data/database.json` (shared file) + `localStorage` (per-browser cache for DB). Session and active tab use `sessionStorage` (cleared on browser close).
- **Net Worth:** Separate sub-app in `networth/` (index.html, app.js, data.js, styles.css)
- **Partnership Deed:** Separate sub-app in `partnership/` (index.html, app.js, styles.css); communicates with parent via `postMessage` for staff name and reset.

### Data Flow

1. On load: `initFromStorageOrFetch()` reads from `localStorage` or embedded empty DB.
2. Background fetch: Fetches `Data/database.json` (from `CONFIG.dataPath`) and merges into in-memory `database`.
3. Writes: `saveDatabaseToStorage()` writes to `localStorage`.
4. Admin: "Save Database" downloads the JSON; user replaces `Data/database.json` to share.

---

## Project Structure

```
PMCA Tools/
├── PMCA Tools.html          # Main app (all tabs, logic, styles)
├── Data/
│   ├── database.json        # Shared database (GST, TDS, DSC, users, etc.)
│   └── DSC/
│       └── dsc_data.json    # (legacy/reference)
├── networth/
│   ├── index.html
│   ├── app.js
│   ├── data.js              # Countries, states, relationships
│   └── styles.css
├── partnership/
│   ├── index.html
│   ├── app.js               # Deed form, preview, Word export, .pdt save/load
│   └── styles.css
├── docs/
│   ├── USER_GUIDE.md        # End-user guide & FAQ
│   ├── DEVELOPER_GUIDE.md   # This file
│   ├── MAINTENANCE.md       # FY/TDS mapping, finalisation rules
│   ├── MAINTENANCE.txt      # Plain-text version
│   └── ROBUSTNESS.md        # Robustness & steadiness recommendations
└── Backup_YYYY-MM-DD/       # Tool backups (no database)
```

---

## CONFIG Object

Central configuration in `PMCA Tools.html` (around line 850):

```javascript
const CONFIG = {
  dataPath: 'Data/database.json',      // Path for fetch; change if served from subfolder
  years: { min: 2015, max: 2100, fyStartMonth: 4 },
  status: { correct, defaulted, na, rejected, in_progress, done, pending },
  regex: {
    monthKey: /^\d{4}-\d{2}$/,                    // YYYY-MM
    quarterKey: /^\d{4}-\d{2}-Q[1-4]$/,           // Validation
    quarterKeyParse: /^(\d{4})-\d{2}-Q([1-4])$/,  // Parse (year, quarter)
    quarterKeyParse2: /^(\d{4}-\d{2})-Q([1-4])$/  // Parse (fyPart, quarter)
  },
  excludedFy: '2020-21',                          // Excluded from FY dropdown
  gst: { columns, naColumns },
  tds: { quarters: ['24Q','26Q','27Q','27EQ'], fields, fieldLabels }
};
```

**Use CONFIG** instead of hardcoding values. Status comparisons use `STATUS = CONFIG.status`.

---

## Database Schema

```javascript
database = {
  users: [ { id, username, password, name, role: 'admin'|'user', active } ],
  gst_clients: [ { id, name, qrmp, staff, staffId, hidden, fromMonth } ],
  tds_clients: [ { id, name, hidden, fromQuarter, traces_username?, traces_password? } ],
  gst_compliance: { 'YYYY-MM': { [clientId]: { gstr1_filed, gstr2b_downloaded, ... } } },
  tds_compliance: { 'YYYY-YY-Qn': { [clientId]: { '24Q': {...}, '26Q': {...}, staff, remarks } } },
  dsc_data: [ { name, company_name, expiry_date, dsc_status, ... } ],
  gst_finalised: ['YYYY-MM', ...],
  tds_finalised: ['YYYY-YY-Qn', ...],
  custom_months: ['YYYY-MM', ...]
};
```

---

## Key Functions (JSDoc Covered)

| Function | Purpose |
|----------|---------|
| `getDisplayFinancialYear(monthKey)` | Month key → FY string (e.g. `2024-25`) |
| `getQuarterKeyFromMonth(monthKey)` | Month key → TDS quarter key (e.g. `2025-26-Q1`) |
| `getQuarterLabelForExport(qKey)` | Quarter key → display label (storage Q1 → display Q4) |
| `getMonthKeyFromQuarter(quarterKey)` | Quarter key → first month key |
| `getMonthKeyFromFY(fyKey)` | FY → first month (April) |
| `getMonthsInFY(fyKey)` | FY → all month keys (Apr–Mar) |
| `getAllAvailableMonthKeys()` | From `custom_months` or default month |
| `autoAddPreviousMonthIfNeeded()` | Adds previous month to `custom_months` if missing |

---

## Status Values & Cycle

Use `CONFIG.status` (aliased as `STATUS`):

| Status | Meaning |
|--------|---------|
| `correct` | Done / ticked |
| `defaulted` | Not done / unchecked |
| `NA` | Not applicable |
| `in_progress` | In progress |
| `rejected` | Rejected (e.g. Excel received) |
| `done`, `pending` | Display aliases for `correct`, `in_progress` |

Status cycle helpers: `nextStatus`, `gstNextStatus`, `tdsNextStatus`, `getStatusClass`, etc.

---

## Date & Quarter Conventions

- **Month key:** `YYYY-MM` (e.g. `2025-04`)
- **FY key:** `YYYY-YY` (e.g. `2024-25`), Apr–Mar
- **Quarter key (storage):** `YYYY-YY-Qn`, Q1=Apr–Jun, Q2=Jul–Sep, Q3=Oct–Dec, Q4=Jan–Mar
- **Display quarter:** Storage Q1 → Display Q4 (previous FY); see `getQuarterLabelForExport`
- **TDS Form quarters:** 24Q, 26Q, 27Q, 27EQ (not FY quarters)

See `docs/MAINTENANCE.md` for full FY/TDS mapping details.

---

## custom_months Logic

- Drives month dropdown: only months in `custom_months` that belong to the selected FY are shown.
- Load filter: `loadDatabase()` filters `custom_months`; some FY ranges (e.g. 2020-21) are excluded.
- Months with GST or TDS data are re-added if removed by the filter.
- Added by: admin “Add month”, `autoAddPreviousMonthIfNeeded()`, add client for previous months.

---

## Finalisation

- GST: `gst_finalised` (array of month keys)
- TDS: `tds_finalised` (array of quarter keys)
- Checks: `isGstMonthFinalised(monthKey)`, `isTdsQuarterFinalised(quarterKey)`
- Effect: Read-only cells, all rows shown, export uses real data, blocks add/edit for that period.

---

## Developer FAQ

### How do I add a new GST column?

1. Add to `CONFIG.gst.columns`: `{ key: 'new_key', label: 'New Label' }`.
2. If NA-able: add `'new_key'` to `CONFIG.gst.naColumns`.
3. Add any status-cycle logic if needed (e.g. `gstGstr1NextStatus`-style helpers).

### How do I add a new TDS field?

1. Add to `CONFIG.tds.fields`.
2. Add label to `CONFIG.tds.fieldLabels`.
3. Data shape: `tds_compliance[quarterKey][clientId][formQ]` (e.g. `'24Q'`).

### Where is the sort logic?

- GST: `gstSortCol`, `gstSortAsc`, `gstSortBy()`, default alphabetical by client name.
- TDS: `tdsSortCol`, `tdsSortAsc`, `tdsSortBy()`.
- DSC: `dscSortColumn`, `dscSortAsc`, default `expiry_status`.

### How does the database sync work?

- On load: `fetch(CONFIG.dataPath)` loads `Data/database.json` and merges via `loadDatabase(data)`.
- Periodic: Every 60 seconds, re-fetches and merges (mainly users).
- Save: `localStorage` on changes; “Save Database” downloads JSON for manual replacement of `Data/database.json`.

### What if I change the year range?

Update `CONFIG.years.min` and `CONFIG.years.max`. Used for validation, `generateMonthsForPreviousSelector`, and `generateQuartersFor*`.

### How do I exclude another FY from the dropdown?

Add it to a filter in `loadDatabase` (similar to `excludedFy`), or extend `CONFIG` with an array of excluded FYs.

### Net Worth integration

- Embedded in iframe: `networth/index.html`.
- Separate app; communicates with parent via `window.parent.getStaffName()` if available.
- Uses browser File System Access API for Load/Save; path hint in `NETWORTH_DATA_PATH` in `networth/app.js`.

### Session and tab persistence

- **Login:** Session is stored in `sessionStorage` under key `pmca-session`. It is cleared when the browser/tab is closed, so users must log in again on reopen.
- **Active tab:** The last selected tab is stored in `sessionStorage` under key `pmca-active-tab`. On refresh, `restoreActiveTab()` runs after `initDashboard()` and programmatically activates that tab (respecting TDS month and Users admin rules).

### Partnership Deed integration

- Embedded in iframe: `partnership/index.html`.
- Receives staff name via `postMessage({ type: 'partnership-staff', staffName })`; sends `partnership-ready` when loaded. Reset via `postMessage({ type: 'partnership-reset' })`.
- Deed type (new/reconstituted) is kept in memory for saved files; the UI no longer shows a type selector. Word export uses first-page top/bottom spacing and witness spacing as defined in `partnership/app.js`.

---

## Testing & Backup

- **Backup:** Copy the `PMCA Tools` folder (excluding `Data/` if you want tool-only backup).
- **Test:** Open `PMCA Tools.html` in a browser; use dev tools for errors.
- **No build step:** Plain HTML/JS; edit and refresh.
- **Robustness:** See [ROBUSTNESS.md](ROBUSTNESS.md) for recommended measures to improve data safety, error handling, storage behaviour, and stability.

---

## Common Gotchas

1. **TDS tab disabled:** Only enabled for Jan, Apr, Jul, Oct (`isTdsTabAllowed()`).
2. **custom_months vs gst_compliance:** `custom_months` controls the dropdown; `gst_compliance` holds data. A month can exist in one but not the other.
3. **Storage Q vs display Q:** Justification report and exports use display quarters; internal storage uses storage quarters.
4. **File access:** Browsers cannot open file dialogs to arbitrary paths; use File System Access API with user-chosen folders.
