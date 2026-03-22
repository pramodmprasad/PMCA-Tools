# PMCA Tools – User Guide & FAQ

A single-page web app for compliance tracking: GST (month-wise), TDS (quarter-wise), DSC, Net Worth certificates, Partnership Deed preparation, and user management.

---

## Quick Start

1. Open `PMCA Tools.html` in a browser (Chrome, Edge, or Firefox recommended).
2. Log in with your username and password.
3. Choose a month from the dropdown (header) for GST and TDS views.
4. Use the tabs to switch between GST, TDS, DSC, Net Worth, Partnership Deed, and (admin only) Users.

---

## Tabs Overview

| Tab | Purpose |
|-----|---------|
| **GST (Month-wise)** | Track monthly GST compliance: GSTR 1, GSTR 2B, purchase reconciliation, RCM, tax calculated/paid, GSTR 3B |
| **TDS (Quarter-wise)** | Track quarterly TDS: Excel received, return filed, processing status, justification report, return corrected, Form 16. Available only when the selected month is Jan, Apr, Jul, or Oct. |
| **DSC** | Digital Signature Certificate tracking: expiry dates, In/Out status, renewal alerts |
| **Net Worth** | Net worth certificate tool for visa processing (embedded or open in new tab) |
| **Partnership Deed** | Prepare Partnership Deed: fill form, preview, save as .pdt file, export to Word (.doc) |
| **Users** (Admin only) | Create users, reset passwords, manage accounts |

---

## User FAQ

### How do I add a new month for GST?

1. Use the **Add month** controls (admin only) in the header.
2. Select the year and month, then click **Add**.
3. The new month appears in the month dropdown.

**Note:** The previous month is added automatically when you open the tool (e.g. Feb 2026 appears when you open in March 2026).

---

### Why don’t I see the TDS tab?

The TDS tab is enabled only for **quarter-start months**: January, April, July, October. Pick one of these months in the header dropdown to see and use TDS.

---

### What does “Finalise” do?

- **GST Finalise** locks the selected month so no one can edit compliance data.
- **TDS Finalise** locks the selected quarter.
- Only admins can finalise or unfinalise.
- Exports still use the real data (not greyed).
- To edit again, an admin must click **Unfinalise**.

---

### What do the status colours mean?

**GST:**
- ✓ (green) – Correct
- ✕ (grey) – NA (not applicable)
- Blank – Pending / Defaulted

**TDS:**
- ✓ (green) – Correct
- Yellow – In progress
- ✕ (red) – Defaulted
- ✕ (grey) – NA

---

### Where is my data saved?

- **Primary:** The app stores data in the browser’s **local storage** (GST, TDS, DSC, users, etc.).
- **Session:** Login state and the active tab are stored in **session storage** only. They are cleared when you close the browser, so you must log in again and the tab will default to GST on a new session until you switch tabs.
- **Shared file:** The app also loads from `Data/database.json`. Replace that file with the downloaded one after **Save Database** so all users see the same data.
- **Partnership Deed:** Deed drafts are saved as `.pdt` files you download or load via the Partnership Deed tab; they are not stored in the main database.
- In Firefox, closing the tab may trigger an automatic download of `database.json`.

---

### Getting the latest database on a new PC (automatic vs manual)

Data is stored **per browser** (local storage). A **new PC** has no data until the app loads the shared database.

**Recommended: open the app via a shared URL (automatic)**  
- Put the **PMCA Tools** folder (including `Data/database.json`) on a **web server** or shared location that is opened via **http://** or **https://** (e.g. `http://your-server/PMCA%20Tools/PMCA%20Tools.html` or an intranet site).  
- Ensure the PC that made changes clicks **Save Database** and saves to that server’s `Data` folder (or copies `database.json` there).  
- On a **new PC**, open the **same URL** in the browser. The app will **automatically** load the latest `Data/database.json` (within a few seconds) and no manual “Load database from file” is needed.

**If you open by double‑clicking the HTML file (file://)**  
- Browsers block reading local files from the same folder, so the app **cannot** auto-load `Data/database.json`.  
- Use **Load database from file** (login screen) and choose `Data/database.json` from your shared folder to see the latest data.

**Step for the PC that made the changes**  
After updating data, click **Save Database** and save (or copy) the file to the shared `Data` folder as `Data/database.json` so others (or the same app when opened via the shared URL) see the updates.

---

### Two users editing at once (concurrent saves)

To allow **two or more users to edit at the same time** and keep everyone’s changes (no “last write wins”):

1. Run the **optional server** so the app is served over **http** (see **SERVER_README.md** in the PMCA Tools folder).
2. **All users** open the app via the **same server URL** (e.g. `http://your-server:3000/PMCA%20Tools.html`).
3. The server merges each user’s save with the central file by **row timestamp** (`_updatedAt`). The app also **polls** the server every 15 seconds and merges others’ changes into your view.

You must use the server and open via **http**; double‑clicking the HTML file does not use the server and does not merge concurrent edits.

---

### How do I add a client “from” a certain month/quarter?

When adding a client (GST or TDS), use **Add for previous months/quarters**, select the start month/quarter, then add. The client is created and appears from that period onward.

---

### How do I export data?

- **GST:** Export Excel, Export PDF.
- **TDS:** Export Excel, Export PDF, **Justification Report** (for Processing Status X).
- **DSC:** Export Excel.
- **Database:** Save Database – downloads `database.json`.

---

### What is the Justification Report?

It lists quarters and clients for TDS, including justification status. Use it when processing status is X (rejected/defaulted) and you need a report.

---

### How do I use the Net Worth tool?

1. Open the **Net Worth** tab.
2. Use the embedded form or click **Open in new tab**.
3. For Load/Save: use **Choose folder** to select the folder (e.g. `Data\Networth`), then Load or Save.
4. Recommended folder: `Data\Networth` (relative to the app).

---

### How does path selection work?

- **Main tool (GST, TDS, DSC, Users):** Data is loaded from `Data/database.json` relative to where the tool is opened. When you click **Save Database**, you download the file; replace `Data/database.json` in the same folder so everyone uses the same data. The path is fixed in the tool; only an admin/developer can change it.
- **Net Worth:** Load and Save use the folder you choose. Click **Choose folder** and select the folder where your `.nwc` files live (e.g. `Data\Networth`). The next time you Load or Save, the file dialog will open in that folder. The tool shows the recommended path; the browser does not remember a path on its own, so if you use other downloads the default may change—use **Choose folder** again to point back to the Net Worth folder.

---

### Can I use this as a bookmark?

Yes. Add a bookmark to the page after opening `PMCA Tools.html`. If you move or rename the folder, update the bookmark path.

---

### What happens if Jan 2026 (or another month) disappears?

Months with data are kept automatically. If a month vanishes, refresh the page; the app restores months that have GST or TDS data.

---

### Who can add clients, finalise, or manage users?

Regular users can add clients and edit compliance data. Only **admin** users can finalise/unfinalise months or quarters and manage users (add user, reset password, activate/deactivate accounts, and view inactive users).

---

### Does it auto-logout?

- **Inactivity:** After **10 minutes of inactivity**, the tool automatically logs you out.
- **Browser close:** When you **close the browser** (or tab), you are logged out. You must sign in again when you reopen the tool.

---

### Does the page remember which tab I was on when I refresh?

Yes. The tool remembers the **last tab** you had open (GST, TDS, DSC, Net Worth, Partnership Deed, or Users) for the current browser session. When you **refresh the page**, after you are logged in again the same tab is shown (subject to TDS month and Users admin rules).

---

### How do I use the Partnership Deed tool?

1. Open the **Partnership Deed** tab.
2. Fill in partnership details, partners, stamp info, and optional additional points.
3. Use **Preview Deed** to see the deed, or **Export Word** to download a Word (.doc) file.
4. Use **Save File** to save your work as a `.pdt` file; use **Load File** to open a saved deed later.
5. To add partner names as a footer on each page (except the last) in Word, open the exported file in Word, then: **Insert → Footer → Edit Footer**, and use “Different first page” / “Different last page” as needed.

**Why does Word create a folder (e.g. "Partnership Deed- Aegis Finserv_files") when I save?**  
That folder is created by Microsoft Word when you save the document as **Web Page (.htm)** or in certain other formats. It contains theme/color support files. To avoid it: in Word use **File → Save As** and choose **Word Document (*.docx)**. You can safely delete the `_files` folder if you don't need the web-page version.