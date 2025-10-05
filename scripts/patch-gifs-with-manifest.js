#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const GIFS_FILE = path.join(__dirname, '..', 'data', 'gifs.json');
const MANIFEST_FILE = path.join(__dirname, '..', 'data', 'gifs-cache', 'manifest.json');
if (!fs.existsSync(GIFS_FILE)) { console.error('gifs.json not found'); process.exit(1); }
if (!fs.existsSync(MANIFEST_FILE)) { console.error('manifest.json not found'); process.exit(1); }
const gifs = JSON.parse(fs.readFileSync(GIFS_FILE, 'utf8') || '{}');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8') || '[]');
const byName = new Map();
for (const e of manifest) {
    if (e && e.name && e.url && e.status === 'saved') {
        // prefer the first saved entry per name
        if (!byName.has(e.name)) byName.set(e.name, e);
    }
}
let changed = 0;
for (const [caseId, c] of Object.entries(gifs.cases || {})) {
    for (const [rarity, r] of Object.entries(c.items || {})) {
        for (const item of (r.items || [])) {
            if (!item || !item.name) continue;
            const entry = byName.get(item.name);
            if (entry && item.gif !== entry.url) {
                console.log(`Patching ${caseId} -> ${item.name} to ${entry.url}`);
                item.gif = entry.url;
                changed++;
            }
        }
    }
}
if (changed === 0) {
    console.log('No matching items found to patch.');
    process.exit(0);
}
// backup
fs.copyFileSync(GIFS_FILE, GIFS_FILE + '.bak');
fs.writeFileSync(GIFS_FILE, JSON.stringify(gifs, null, 2));
console.log(`Patched ${changed} items. Backup written to ${GIFS_FILE}.bak`);
