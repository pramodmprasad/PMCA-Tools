# PMCA Tools – Maintenance Guide

This document explains key data structures and logic for future maintenance.

**See also:**
- [USER_GUIDE.md](USER_GUIDE.md) – End-user guide and FAQ
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) – Technical guide for developers
- [ROBUSTNESS.md](ROBUSTNESS.md) – Recommendations for robustness and steadiness

---

## 1. FY vs TDS Quarter Mapping

### Financial Year (FY)

- **Format**: `YYYY-YY` (e.g. `2024-25`)
- **Period**: April of year Y to March of year Y+1
- **Example**: FY 2024-25 = Apr 2024 – Mar 2025

### Month → FY

- Apr (4) to Mar (12): FY = `year`-`year+1`
- Jan (1) to Mar (3): FY = `year-1`-`year`
- **Function**: `getDisplayFinancialYear(monthKey)`

### Storage Quarter Keys (TDS)

- **Format**: `YYYY-YY-Qn` (e.g. `2024-25-Q4`)
- **FY quarters**:
  - Q1 = Apr–Jun
  - Q2 = Jul–Sep
  - Q3 = Oct–Dec
  - Q4 = Jan–Mar

### Month → Quarter Key

- **Function**: `getQuarterKeyFromMonth(monthKey)`
- **Examples**:
  - Jan 2025 → `2024-25-Q4`
  - Apr 2025 → `2025-26-Q1`
  - Jul 2025 → `2025-26-Q2`
  - Oct 2025 → `2025-26-Q3`

### TDS Display Quarter (Justification Report etc.)

Storage quarters are mapped for display:

- Storage Q1 → Display Q4
- Storage Q2 → Display Q1
- Storage Q3 → Display Q2
- Storage Q4 → Display Q3

Storage Q1 (Apr–Jun) shows as the previous FY’s Q4, e.g. `2025-26-Q1` → `2024-25 Q4`.

- **Function**: `getQuarterLabelForExport(qKey)`

### TDS Tab Quarters

The TDS tab uses **Form 24Q / 26Q / 27Q / 27EQ**, not the FY quarter. The tab is available only for Jan, Apr, Jul, Oct (quarter-start months).

---

## 2. custom_months vs gst_compliance Keys

### custom_months

- **Type**: `Array<string>` (e.g. `["2024-04", "2024-07", "2025-01"]`)
- **Purpose**: Months explicitly added by the user, used for the month dropdown
- **When added**:
  - Admin “Add month” via Add month controls
  - Auto-add on 1st of each month (previous month)
  - Add client for previous months (GST)
- **Effect**:
  - Month dropdown only shows months in `custom_months` that fall in the selected FY
  - FY dropdown only shows FYs that have at least one month in `custom_months`
- **Storage**: `database.custom_months`

### gst_compliance Keys

- **Type**: `Object` keyed by month (e.g. `{"2024-04": {...}, "2024-07": {...}}`)
- **Purpose**: Holds GST compliance data (status, tax values, remarks, etc.)
- **When created**:
  - User enters or updates data for a month
  - Add client for previous months (creates empty entries for those months)
- **Structure**: `gst_compliance[monthKey][clientId]` = row data

### Difference

| Aspect        | custom_months       | gst_compliance keys     |
|---------------|---------------------|--------------------------|
| Used for      | Month dropdown list | Compliance data storage  |
| Source        | User/auto “Add month” | Data entry / add client |
| Can have data | No                  | Yes                      |
| Controls view | Which months appear | What data is shown       |

- A month can be in `custom_months` but have no `gst_compliance` data.
- A month in `gst_compliance` may not be in `custom_months` if added via “Add client for previous months” and then removed by cleanup.
- `getAllAvailableMonthKeys()` returns only `custom_months` (or default month when empty); it does not use `gst_compliance` keys.

---

## 3. Finalisation Rules

### What Finalisation Does

- **GST**: Month-level lock (`gst_finalised`)
- **TDS**: Quarter-level lock (`tds_finalised`)
- **Effect**:
  - Prevents editing compliance data
  - Cells appear disabled/greyed
  - Export uses actual data (not greyed)
  - All rows are shown (ignores “Show completed returns” filter)
  - Blocks: add/edit client, hide client, add for previous months for that period

### Storage

- **GST**: `database.gst_finalised` = array of month keys, e.g. `["2024-04", "2024-07"]`
- **TDS**: `database.tds_finalised` = array of quarter keys, e.g. `["2024-25-Q1", "2024-25-Q2"]`

### Checks

- **GST**: `isGstMonthFinalised(monthKey)` → true if month is in `gst_finalised`
- **TDS**: `isTdsQuarterFinalised(quarterKey)` → true if quarter is in `tds_finalised`
- **Edit rights**: `canEditGstMonth(monthKey)`, `canEditTdsQuarter(quarterKey)` → inverse of the above

### Who Can Finalise/Unfinalise

- Only **admin** users can finalise or unfinalise.
- Toggle buttons: “Finalise this month” / “Finalise this quarter” (and “Unfinalise” when finalised).

### Display & Export When Finalised

- **Display**: All rows are visible; cells show real values but are read-only.
- **Export**: Uses actual stored data (Correct, Pending, etc.), not greyed/NA, even when the period is finalised.

---

## 4. Session & Tab Storage

- **Session:** Stored in `sessionStorage` (key `pmca-session`). Cleared when the browser is closed; user must log in again.
- **Active tab:** Stored in `sessionStorage` (key `pmca-active-tab`). On page refresh, the last open tab (GST, TDS, DSC, Net Worth, Partnership Deed, Users) is restored after login, so the app does not always open on the GST tab.
