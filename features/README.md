# New features (without editing `PMCA Tools.html`)

Use this folder for **standalone features** served by the same Node server (`npm start` → open `http://localhost:3000/<path>/index.html`).

## Pattern

Match the existing mini-apps:

- **`networth/`** — `index.html`, `app.js`, `styles.css`, optional `data.js`
- **`partnership/`** — same idea
- **`financial-statements/`** — Balance Sheet and P&L for corporate vs non-corporate; save/load `.fsjson`

## Workflow

1. Work on the **`development`** branch (not `main`). Keeps `main` stable until you merge.
2. Add a feature folder: `features/<short-name>/` with its own HTML/JS/CSS.
3. **Do not change** `PMCA Tools.html` until you are ready to integrate (e.g. add a nav link). Until then, open the new page directly by URL or bookmark.
4. When a feature is done: merge `development` → `main` on GitHub (Pull Request) or locally, then push.

## Server

`server.js` already serves the repo root as static files, so new paths under `features/` work without server changes unless you need new API routes.
