#!/usr/bin/env node
// Generates placeholder PNGs for any local data/gifs-cache/*.png referenced in data/gifs.json
// and writes/merges manifest entries into data/gifs-cache/manifest.json so the bot will treat them as saved.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GIFS_FILE = path.join(ROOT, 'data', 'gifs.json');
const CACHE_DIR = path.join(ROOT, 'data', 'gifs-cache');
const MANIFEST = path.join(CACHE_DIR, 'manifest.json');

// 1x1 PNGs in different colors (base64) to use as placeholders
const PNG_BASE64 = {
  red: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
  green: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  blue: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAQAAjCB0C4AAAAASUVORK5CYII=',
  gray: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAjCB0C0AAAAASUVORK5CYII='
};

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function writePng(filePath, color) {
  const b64 = PNG_BASE64[color] || PNG_BASE64.gray;
  fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
}
function safeWriteJson(filePath, obj) { fs.writeFileSync(filePath, JSON.stringify(obj, null, 2)); }

try {
  ensureDir(CACHE_DIR);
  if (!fs.existsSync(GIFS_FILE)) {
    console.error('gifs.json not found at', GIFS_FILE);
    process.exit(1);
  }

  const gifs = JSON.parse(fs.readFileSync(GIFS_FILE, 'utf8'));

  // collect all local gif/png paths referenced in gifs.json (case images + item gifs)
  const localPaths = new Map(); // relPath -> { name?, caseId?, rarity? }

  if (gifs.cases) {
    for (const [caseId, caseData] of Object.entries(gifs.cases)) {
      if (caseData.image && typeof caseData.image === 'string' && caseData.image.startsWith('data/gifs-cache/')) {
        localPaths.set(caseData.image, { name: caseData.display || caseId, caseId, rarity: 'case' });
      }
      for (const [rarity, rarData] of Object.entries(caseData.items || {})) {
        for (const it of rarData.items || []) {
          if (it && it.gif && typeof it.gif === 'string' && it.gif.startsWith('data/gifs-cache/')) {
            localPaths.set(it.gif, { name: it.name, caseId, rarity });
          }
        }
      }
    }
  }

  if (!localPaths.size) {
    console.log('No local gifs referenced in data/gifs.json. Nothing to generate.');
    process.exit(0);
  }

  const timestamp = Date.now();
  if (fs.existsSync(MANIFEST)) fs.copyFileSync(MANIFEST, MANIFEST + '.bak.' + timestamp);
  if (fs.existsSync(MANIFEST + '.bak.' + timestamp)) console.log('Backed up previous manifest to', MANIFEST + '.bak.' + timestamp);

  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8') || '[]') : [];
  const existingByPath = new Map(manifest.map(e => [e.path || e.url, e]));

  const colors = Object.keys(PNG_BASE64);
  let colorIdx = 0;
  const newEntries = [];

  for (const [relPath, meta] of localPaths.entries()) {
    const abs = path.join(ROOT, relPath);
    ensureDir(path.dirname(abs));
    const color = colors[colorIdx % colors.length]; colorIdx++;
    writePng(abs, color);
    console.log('Wrote placeholder PNG:', abs);

    const entry = {
      source: 'local-generated',
      caseId: meta.caseId,
      rarity: meta.rarity,
      name: meta.name,
      url: relPath,
      status: 'saved',
      path: relPath,
      contentType: 'image/png'
    };
    newEntries.push(entry);
  }

  // merge: keep non-saved existing entries and entries not being overwritten, then add new saved entries
  const filtered = manifest.filter(e => !(e && e.status === 'saved' && e.path && localPaths.has(e.path)));
  const merged = filtered.concat(newEntries);
  safeWriteJson(MANIFEST, merged);
  console.log('Wrote manifest with', merged.length, 'entries (added', newEntries.length, 'saved entries)');

} catch (e) {
  console.error('Error generating assets:', e && e.stack ? e.stack : e);
  process.exit(1);
}
