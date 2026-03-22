# PMCA Tools – Robustness & Steadiness Recommendations

This document suggests measures to improve the reliability, data safety, and stability of the application. Items are grouped by area and ordered by impact.

---

## Implemented (current codebase)

- **reportError(message, err):** Central helper that logs to `console.error`; used in critical paths instead of empty catch blocks.
- **saveDatabaseToStorage:** Catches `QuotaExceededError` (and code 22), shows an alert, and triggers an automatic download of a dated backup file so data is not lost when localStorage is full. A simple **saveInProgress** flag prevents overlapping writes.
- **saveDatabaseToFile:** **fileSaveInProgress** lock prevents overlapping async writes when auto-saving to File System API. Errors are reported and handle is cleared on failure.
- **pushToServer:** Errors are logged via `reportError`; automatic retry up to 2 times after 3 seconds on network failure.
- **Periodic 15s server sync:** AbortController timeout (5s) prevents hanging; failures are logged via `reportError`.
- **DOM null checks:** Search inputs, login/dashboard elements in `tryRestoreSession` are guarded to avoid throws when elements are missing.
- **server.js:** GET and POST handlers wrapped in try/catch; errors logged and 500 returned on failure.
- **database._schemaVersion:** Set on save, preserved in `sanitizeDatabaseFromStorage` and server merge; enables future migrations.
- **loadDatabase:** Returns early if `data` is null or not an object. Assignments from `data` use type checks (e.g. `Array.isArray(data.gst_clients)`, `typeof data.gst_compliance === 'object'`) so bad data does not overwrite with wrong types.
- **sanitizeDatabaseFromStorage(obj):** Ensures parsed localStorage or fetch data has the expected shape (arrays/objects); returns a safe object or null. Used on load from localStorage and on background fetch, and when loading database from file.
- **Load database from file:** Before applying the loaded file, a deep copy of the current `database` is kept; if the file is invalid (bad JSON or invalid structure), the previous database is restored and the user is notified.
- **Fetch error handling:** Background fetch (initial and 60-second sync) use `reportError` in `.catch` so failures are logged.
- **beforeunload:** postMessage and Firefox download errors are passed to `reportError`.
- **DOM:** Null check before attaching the "Load database from file" input listener so a missing element does not throw.

---

## 1. Data integrity & validation

### 1.1 Guard against invalid or null data in `loadDatabase`

**Risk:** If `fetch` or a file load returns malformed JSON or `null`, passing it to `loadDatabase(data)` can overwrite the in-memory database with incomplete or undefined values.

**Recommendations:**

- At the start of `loadDatabase(data, ...)`, return early if `!data || typeof data !== 'object'` (and optionally show a non-intrusive message or log).
- When merging from file, validate that `data.gst_clients`, `data.tds_clients`, `data.gst_compliance`, etc. are arrays/objects before assigning; use fallbacks (e.g. `database.gst_clients = Array.isArray(data.gst_clients) ? data.gst_clients : database.gst_clients`) so a bad file does not wipe existing structure.

### 1.2 Validate structure after `JSON.parse` from localStorage

**Risk:** Corrupted or legacy data in localStorage can produce an object that is missing required keys and break the app on next load.

**Recommendations:**

- After `JSON.parse(s)` in `initFromStorageOrFetch()`, run a small `sanitizeDatabase(obj)` that ensures at least: `users` (array), `gst_clients`, `tds_clients`, `gst_compliance`, `tds_compliance`, `dsc_data`, `gst_finalised`, `tds_finalised`, `custom_months` exist and are the right type; otherwise merge with `EMBEDDED_DB` or discard and use embedded.
- Optionally store a `version` or `schemaVersion` in the database and handle migration or reset for old versions.

---

## 2. Storage & persistence

### 2.1 Handle localStorage quota (QuotaExceededError)

**Risk:** When the database grows (many clients, many months), `localStorage.setItem` can throw; the current `try/catch` in `saveDatabaseToStorage()` swallows the error and the user may lose recent changes without notice.

**Recommendations:**

- In the `catch` block, detect `e.name === 'QuotaExceededError'` (or `e.code === 22`) and show a clear message, e.g. “Storage full. Please use Save Database to download the file and free space, or remove old data.”
- Optionally trigger an automatic download of `database.json` when quota is exceeded so data is not lost.
- Consider periodically pruning very old `gst_compliance` / `tds_compliance` keys (e.g. older than N years) or offering an admin “Archive old months” to keep size under control.

### 2.2 Avoid double-write races between auto-save and file save

**Risk:** The 2-second auto-save and a user-triggered “Save Database” (or File System API save) can run close together and cause overlapping writes or temporary inconsistent state.

**Recommendations:**

- Introduce a simple “save lock”: a boolean or promise that prevents a new save from starting until the current one finishes. Queue at most one pending save.
- For File System API writes, await the write fully before clearing the lock; for localStorage, keep the write synchronous and quick so the lock is brief.

### 2.3 Backup before destructive or bulk operations

**Risk:** Operations that replace large parts of the database (e.g. “Load database from file”, or a bad merge from fetch) can overwrite good data with bad.

**Recommendations:**

- Before replacing the in-memory database with data from a file (or from fetch), keep a shallow copy of the current `database` (or at least critical keys) and, if the new load fails validation or causes an error, restore from that copy and show an error.
- Optionally, before “Load database from file”, auto-download the current database as `database_backup_YYYY-MM-DD-HHmm.json` so the user can restore manually if needed.

---

## 3. Error handling & user feedback

### 3.1 Centralise and improve error reporting

**Risk:** Many `catch (e) {}` blocks hide errors; the user gets no feedback and debugging is hard.

**Recommendations:**

- Add a small helper, e.g. `reportError(message, err)`, that: (1) logs to `console.error`, (2) optionally shows a non-blocking message (e.g. a toast or a small banner) so the user knows something went wrong.
- Replace empty `catch (e) {}` in critical paths (load/save, fetch, file read) with `catch (e) { reportError('Description of what failed', e); }` and, where appropriate, show a user-facing message.

### 3.2 Safer JSON.parse everywhere

**Risk:** Any `JSON.parse` on untrusted or external input (file, fetch response) can throw; uncaught exceptions can break the app.

**Recommendations:**

- Ensure every `JSON.parse` used for database or config is inside try/catch. Already done in most places; verify `initFromStorageOrFetch`, file load in Load database, and the `storage` event session parse.
- For the periodic fetch of `Data/database.json`, in the `.then(r => r.json())` (or subsequent parse), catch parse errors and avoid calling `loadDatabase` with invalid data; optionally retry once after a short delay.

---

## 4. DOM & lifecycle

### 4.1 Null-check before DOM access and listeners

**Risk:** Code that calls `document.getElementById('...').addEventListener(...)` or `.value = ...` will throw if the element is missing (e.g. wrong tab, future HTML change), and can take down the whole script.

**Recommendations:**

- Use a small helper, e.g. `byId(id)` that returns `document.getElementById(id)` and use it consistently; before calling `.addEventListener`, `.value`, or other properties, check `if (el) { ... }`.
- Audit all `getElementById` and `querySelector` usages that are used without a check (e.g. in `initDashboard`, `populateSelects`, and event bindings) and add guards or early returns.

### 4.2 Defensive init order

**Risk:** If `initFromStorageOrFetch()` or `tryRestoreSession()` runs before the DOM is ready, elements may be null and cause errors.

**Recommendations:**

- Ensure the main app script runs after the DOM is ready (e.g. place the script at the end of `<body>`, or wrap init in `DOMContentLoaded`). Currently the script is at the end of body, which is usually fine; if any part of the page is dynamically injected, ensure that part exists before referencing it.

---

## 5. Concurrency & multiple tabs

### 5.1 Document and optionally refine multi-tab behaviour

**Risk:** Two tabs can both write to localStorage and to the same file (if using File System API), leading to last-write-wins or confusion.

**Recommendations:**

- Document in USER_GUIDE.md that having multiple tabs open can lead to one tab overwriting the other’s changes when saving; recommend working in one tab at a time for critical edits.
- Optionally, use the `storage` event (already used for session) to detect when another tab has written to localStorage and show a banner: “Data was updated in another tab. Refresh to see latest?” and avoid overwriting without user confirmation.

### 5.2 Fetch and merge logic

**Risk:** The 60-second fetch merges only users in some cases; if the file has newer compliance data but the same user count, the merge can be skipped and the tab can stay on stale data.

**Recommendations:**

- Document the current rule (e.g. “reload from file only when file has more users or new user IDs”) in MAINTENANCE.md so maintainers understand the trade-off.
- If desired, add an optional “Refresh data from file” button that forces a fetch and full merge (with a confirmation if there are local unsaved changes), so users can explicitly sync when they know the file was updated elsewhere.

---

## 6. Partnership & Net Worth tools

### 6.1 Partnership deed file load

**Risk:** Loaded `.pdt` files might have an old or unexpected shape; `applyFormData` might assume certain fields and leave the form or internal state inconsistent.

**Recommendations:**

- In `applyFormData` (and when loading from file), validate that the loaded object has at least a minimal structure (e.g. `type === 'partnership-deed'` and required keys); if not, show “Invalid or outdated deed file” and do not apply.
- Keep the existing try/catch in the FileReader `onload`; consider also validating the parsed object before calling `applyFormData`.

### 6.2 Iframe postMessage

**Risk:** If the parent or iframe is slow to load, postMessage can be sent before the other side is listening.

**Recommendations:**

- The existing pattern (e.g. “partnership-ready” from iframe, then parent sends staff name; retries with setTimeout) is good. Keep it and document it in the developer guide. Optionally add a timeout: if the parent does not receive “partnership-ready” within a few seconds, log a warning (and avoid assuming the iframe is broken for the whole app).

---

## 7. Operational practices

### 7.1 Regular backups

**Recommendations:**

- Encourage users (or admins) to use “Save Database” regularly and to keep dated copies (e.g. `database_2026-02-25.json`) in a safe folder.
- Document in USER_GUIDE.md that the app does not auto-backup the file and that replacing `Data/database.json` overwrites the previous file; recommend a backup before replacing.

### 7.2 Version / schema in database

**Recommendations:**

- Add a `databaseVersion` or `schemaVersion` field (e.g. `1`) to the database object when saving. On load, if the version is missing or lower than expected, run a one-time migration (or merge with defaults) and then set the new version. This makes future schema changes safer and more predictable.

---

## 8. Testing and maintenance

### 8.1 Manual test checklist

**Recommendations:**

- Maintain a short checklist (e.g. in MAINTENANCE.md or a separate TESTING.md): login/logout, add client (GST/TDS), change compliance, finalise month, export Excel/PDF, Save Database, Load database from file, refresh (tab restore), Partnership Deed save/load/export, Net Worth load/save. Run through it after large changes.

### 8.2 Console errors in production

**Recommendations:**

- Avoid throwing uncaught errors for “expected” cases (e.g. missing optional element). Use defensive checks and log warnings instead of letting the script throw, so one missing element does not break the whole page.

---

## Summary priority list

| Priority | Area | Action |
|----------|------|--------|
| High | Data integrity | Guard `loadDatabase` against null/invalid `data`; validate structure after localStorage parse. |
| High | Storage | Handle QuotaExceededError in `saveDatabaseToStorage` and notify user; consider auto-download on quota full. |
| High | Errors | Add `reportError()` and replace critical empty catch blocks with logging and user feedback. |
| Medium | DOM | Null-check before all `getElementById` / addEventListener and before using `.value` or similar. |
| Medium | Backup | Backup in memory or auto-download before “Load database from file”; document backup discipline. |
| Medium | Concurrency | Document multi-tab behaviour; optional “Refresh from file” button. |
| Low | Schema | Add `databaseVersion` and simple migration path for future changes. |
| Low | Testing | Add a short manual test checklist and run it after major changes. |

Implementing the high-priority items first will improve robustness and steadiness the most; the rest can be adopted gradually as the codebase is maintained.
