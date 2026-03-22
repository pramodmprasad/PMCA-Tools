# Concurrent multi-user saves (optional server)

When two or more users edit the database at the same time, the app can **merge** both sets of changes instead of "last write wins". To do that, run this small backend and open the app via **http** (not by double-clicking the HTML file).

## Quick start

1. **Install and run the server** (one time per machine or use a shared server):

   ```bash
   cd "PMCA Tools"
   npm install
   npm start
   ```

2. **Open the app in the browser**:
   - Go to: **http://localhost:3000/PMCA%20Tools.html**
   - (If you run the server on another PC, use that PC’s address, e.g. `http://192.168.1.10:3000/PMCA%20Tools.html`)

3. **All users must use the same URL** (same server). Each user’s edits are sent to the server; the server merges by **row timestamp** (`_updatedAt`) so different users’ changes to different rows are all kept.

## How it works

- The server serves the PMCA Tools folder and provides:
  - **GET /Data/database.json** – returns the current merged database file.
  - **POST /api/save** – accepts a database JSON, merges it with the file (by `_updatedAt` for GST/TDS compliance rows), saves to `Data/database.json`, and returns the merged JSON.
- The frontend, when opened via **http** (not `file://`):
  - Sends the local database to **POST /api/save** after each save (and on the 2-second auto-save).
  - Every **15 seconds** fetches **GET /Data/database.json** and merges it into the local copy (by `_updatedAt`), so you see the other user’s edits without losing your own.

## Port

Default port is **3000**. To use another port:

```bash
PORT=8080 node server.js
```

## Without the server

If you don’t run the server and open the app by double-clicking the HTML file, behaviour is unchanged: data is stored in the browser’s localStorage and "Save Database" downloads a file. Concurrent edits from different PCs are not merged; use a single editor at a time or coordinate manually.
