const fs = require('fs');
const path = require('path');

// Script to delete all cache files that are marked as "saved" in the manifest
// Usage: node scripts/clean-delete-saved.js

const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', 'gifs-cache');
const MANIFEST = path.join(CACHE_DIR, 'manifest.json');

function safeWriteJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

function timestamp() { return Date.now(); }

try {
  if (!fs.existsSync(MANIFEST)) {
    console.error('Manifest not found:', MANIFEST);
    process.exit(1);
  }

  const raw = fs.readFileSync(MANIFEST, 'utf8') || '[]';
  const manifest = JSON.parse(raw);

  const toRemove = manifest.filter(e => e && e.status === 'saved' && e.path);
  if (!toRemove.length) {
    console.log('No saved entries found in manifest. Nothing to do.');
    process.exit(0);
  }

  const bakPath = MANIFEST + '.bak.' + timestamp();
  fs.copyFileSync(MANIFEST, bakPath);
  console.log('Backed up manifest to', bakPath);

  const listFile = path.join(CACHE_DIR, 'saved-to-delete.' + timestamp() + '.json');
  safeWriteJson(listFile, toRemove);
  console.log('Wrote list of saved entries to', listFile);

  // Delete unique files only once
  const uniquePaths = Array.from(new Set(toRemove.map(e => e.path)));
  let deleted = 0;
  for (let p of uniquePaths) {
    // Resolve to absolute path if relative
    const full = path.isAbsolute(p) ? p : path.join(ROOT, p);
    // Safety: ensure target is inside the cache dir
    const normalized = path.normalize(full);
    const cacheNorm = path.normalize(CACHE_DIR) + path.sep;
    if (!normalized.startsWith(cacheNorm)) {
      console.log('Skipping (outside cache):', normalized);
      continue;
    }
    if (fs.existsSync(normalized)) {
      try {
        fs.unlinkSync(normalized);
        console.log('Deleted', normalized);
        deleted++;
      } catch (e) {
        console.error('Failed to delete', normalized, e.message);
      }
    } else {
      console.log('File not found, skipping:', normalized);
    }
  }

  // Write updated manifest (filter out saved entries)
  const filtered = manifest.filter(e => !(e && e.status === 'saved' && e.path));
  safeWriteJson(MANIFEST, filtered);
  console.log(`Wrote updated manifest.json, removed ${toRemove.length} saved entries`);
  console.log(`Deleted files count: ${deleted}`);
} catch (e) {
  console.error('Error during cleanup:', e && e.stack ? e.stack : e);
  process.exit(1);
}
