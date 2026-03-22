# PMCA Tools – Testing Checklist

Run this short checklist after any significant change to ensure the tool remains stable and consistent.

## 1. Login, session, and tabs

- **Login/logout**
  - Log in as admin and as a normal user.
  - Log out and confirm you return to the login screen.
- **Session restore**
  - Log in, navigate to GST tab, refresh the page.
  - Confirm the session is restored and the last tab is visible.
- **Multi-tab behaviour**
  - Open PMCA Tools in two tabs.
  - Make a small change in tab A (e.g. edit a GST row) and wait for auto‑save.
  - Confirm tab B shows the multi‑tab banner and that clicking “Reload latest data” updates the view without errors.

## 2. GST workflow

- **Clients**
  - Add a new GST client and edit an existing one.
  - Hide/unhide a client and confirm hidden clients section works.
- **Compliance**
  - Enter/update GST compliance for a month.
  - Use filters/search and confirm rows update correctly.
- **Finalisation**
  - Finalise a month, confirm cells are locked/greyed.
  - Unfinalise and confirm editing is possible again.

## 3. TDS workflow

- **Quarter mapping**
  - For a FY that includes Jan/Apr/Jul/Oct, verify the TDS tab is available for those months.
- **Compliance**
  - Enter/update TDS compliance for at least one quarter.
  - Check that quarter labels (storage vs display) look correct in the UI and exports.
- **Finalisation**
  - Finalise a quarter and confirm it is locked; unfinalise and recheck.

## 4. DSC workflow

- **CRUD**
  - Add a DSC record, edit it, and delete it.
  - Verify filters and sorting behave as expected.

## 5. Database save/load and backups

- **Save Database**
  - Click “Save Database” and confirm:
    - In Chrome/Edge: file is saved or downloaded without errors.
    - In Firefox: download fallback works.
- **Load database from file**
  - From the login screen, load a known good `database.json`.
  - Confirm GST/TDS/DSC data appears as expected.
- **LocalStorage vs file**
  - After editing data, refresh the page and confirm changes persist (localStorage).

## 6. Partnership Deed tool

- **New deed**
  - Generate a new deed, preview it, and export/save the `.pdt` file.
- **Load deed**
  - Reload the saved `.pdt` and confirm all partner and deed details are restored.
  - Try loading an invalid file and confirm a clear “invalid/outdated” message appears.

## 7. Net Worth tool

- **Certificate generation**
  - Fill basic applicant/assessed details and assets.
  - Preview the certificate and export to Word.
- **File save/load**
  - Save a `.nwc` (or equivalent) file and reload it.
  - Confirm staff name “Last updated by” is shown correctly.

## 8. Visual and console checks

- **Visual scan**
  - Check the main dashboard loads without obvious layout breakage.
- **Console**
  - Open browser dev tools and ensure there are no uncaught errors in the console during the above flows.

