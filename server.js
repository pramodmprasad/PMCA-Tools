/**
 * PMCA Tools – optional backend for concurrent multi-user saves.
 * Serves the app and merges incoming database with the file so both users' edits are kept.
 *
 * Run: node server.js
 * Then open: http://localhost:3000/PMCA%20Tools.html
 */

const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'Data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

function readDb() {
  try {
    const s = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

function writeDb(db) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('writeDb error', e);
    return false;
  }
}

function ts(row) {
  return (row && typeof row._updatedAt === 'number') ? row._updatedAt : 0;
}

function mergeCompliance(current, incoming) {
  const out = {};
  const allPeriods = new Set([...Object.keys(current || {}), ...Object.keys(incoming || {})]);
  for (const period of allPeriods) {
    const c = (current || {})[period] || {};
    const i = (incoming || {})[period] || {};
    out[period] = {};
    const allIds = new Set([...Object.keys(c), ...Object.keys(i)]);
    for (const id of allIds) {
      const cr = c[id];
      const ir = i[id];
      if (!cr) { out[period][id] = ir; continue; }
      if (!ir) { out[period][id] = cr; continue; }
      out[period][id] = ts(ir) >= ts(cr) ? ir : cr;
    }
  }
  return out;
}

function mergeTdsCompliance(current, incoming) {
  const out = {};
  const allQuarters = new Set([...Object.keys(current || {}), ...Object.keys(incoming || {})]);
  for (const quarter of allQuarters) {
    const c = (current || {})[quarter] || {};
    const i = (incoming || {})[quarter] || {};
    out[quarter] = {};
    const allIds = new Set([...Object.keys(c), ...Object.keys(i)]);
    for (const id of allIds) {
      const cr = c[id];
      const ir = i[id];
      if (!cr) { out[quarter][id] = ir; continue; }
      if (!ir) { out[quarter][id] = cr; continue; }
      out[quarter][id] = ts(ir) >= ts(cr) ? ir : cr;
    }
  }
  return out;
}

function mergeArraysUnion(a, b) {
  const set = new Set([...(a || []), ...(b || [])]);
  return Array.from(set);
}

function mergeUsers(current, incoming) {
  const byId = new Map();
  (current || []).forEach(u => { byId.set(u.id || u.username, u); });
  (incoming || []).forEach(u => { byId.set(u.id || u.username, u); });
  return Array.from(byId.values());
}

function mergeClients(current, incoming) {
  const byId = new Map();
  (current || []).forEach(c => { byId.set(c.id || c.name, c); });
  (incoming || []).forEach(c => { byId.set(c.id || c.name, c); });
  return Array.from(byId.values());
}

function mergeDscData(current, incoming) {
  const cur = current || [];
  const inc = incoming || [];
  if (inc.length === 0) return cur;
  if (cur.length === 0) return inc;
  const byId = new Map();
  const getKey = d => d.id || ('legacy-' + (d.name || '').trim().toLowerCase());
  cur.forEach(d => { const k = getKey(d); if (k) byId.set(k, d); });
  inc.forEach(d => {
    const k = getKey(d);
    if (k) {
      const existing = byId.get(k);
      if (existing) {
        if ((d._updatedAt || 0) >= (existing._updatedAt || 0)) {
          byId.set(k, d);
        }
      } else {
        byId.set(k, d);
      }
    }
  });
  return Array.from(byId.values());
}

app.get('/Data/database.json', (req, res) => {
  try {
    const db = readDb();
    if (!db) {
      res.status(404).json({ error: 'No database file yet' });
      return;
    }
    res.json(db);
  } catch (e) {
    console.error('GET /Data/database.json error', e);
    res.status(500).json({ error: 'Failed to read database' });
  }
});

app.post('/api/save', (req, res) => {
  try {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'Invalid body' });
      return;
    }
    const current = readDb();
    const merged = {
    users: mergeUsers(current && current.users, incoming.users),
    gst_clients: mergeClients(current && current.gst_clients, incoming.gst_clients),
    tds_clients: mergeClients(current && current.tds_clients, incoming.tds_clients),
    gst_compliance: mergeCompliance(current && current.gst_compliance, incoming.gst_compliance),
    tds_compliance: mergeTdsCompliance(current && current.tds_compliance, incoming.tds_compliance),
    dsc_data: mergeDscData(current && current.dsc_data, incoming.dsc_data),
    gst_finalised: incoming.gst_finalised || (current && current.gst_finalised) || [],
    tds_finalised: incoming.tds_finalised || (current && current.tds_finalised) || [],
    tds_payment_finalised: incoming.tds_payment_finalised || (current && current.tds_payment_finalised) || [],
    custom_months: mergeArraysUnion(current && current.custom_months, incoming.custom_months).sort(),
    _schemaVersion: (current && current._schemaVersion) || (incoming._schemaVersion) || 1,
    _lastSavedAt: Math.max(
      (current && current._lastSavedAt) || 0,
      (incoming._lastSavedAt) || 0,
      Date.now()
    )
  };
  if (!writeDb(merged)) {
    res.status(500).json({ error: 'Failed to write file' });
    return;
  }
  res.json(merged);
  } catch (e) {
    console.error('POST /api/save error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log('PMCA Tools server: http://localhost:' + PORT + '/PMCA%20Tools.html');
});
