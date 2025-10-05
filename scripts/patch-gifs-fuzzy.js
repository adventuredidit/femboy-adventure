#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const GIFS_FILE = path.join(__dirname, '..', 'data', 'gifs.json');
const MANIFEST_FILE = path.join(__dirname, '..', 'data', 'gifs-cache', 'manifest.json');
if (!fs.existsSync(GIFS_FILE)) { console.error('gifs.json not found'); process.exit(1); }
if (!fs.existsSync(MANIFEST_FILE)) { console.error('manifest.json not found'); process.exit(1); }
const gifs = JSON.parse(fs.readFileSync(GIFS_FILE, 'utf8') || '{}');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8') || '[]');
function normalize(s){
  return (s||'').toLowerCase().replace(/[\s\-\_|:\'"\u2019]/g,'').replace(/\W+/g,'');
}
const manifestByNorm = new Map();
for (const e of manifest) {
  if (!e || !e.name || e.status !== 'saved') continue;
  const n = normalize(e.name);
  if (!manifestByNorm.has(n)) manifestByNorm.set(n, e);
}
let changed = 0;
const misses = [];
for (const [caseId, c] of Object.entries(gifs.cases || {})){
  for (const [rarity, r] of Object.entries(c.items || {})){
    for (const item of (r.items || [])){
      if (!item || !item.name) continue;
      const n = normalize(item.name);
      if (manifestByNorm.has(n)){
        const e = manifestByNorm.get(n);
        if (item.gif !== e.url){
          console.log(`Fuzzy patch ${caseId} -> ${item.name} to ${e.url}`);
          item.gif = e.url;
          changed++;
        }
      } else {
        misses.push({caseId, name: item.name, norm: n});
      }
    }
  }
}
// try relaxed substring matches for misses
for (const m of misses){
  for (const [k,e] of manifestByNorm.entries()){
    if (k.includes(m.norm) || m.norm.includes(k)){
      // find the item and patch
      for (const [caseId, c] of Object.entries(gifs.cases || {})){
        for (const [rarity, r] of Object.entries(c.items || {})){
          for (const item of (r.items || [])){
            if (item && item.name === m.name){
              console.log(`Relaxed patch ${m.caseId} -> ${m.name} to ${e.url}`);
              item.gif = e.url; changed++;
            }
          }
        }
      }
      break;
    }
  }
}
if (changed === 0) {
  console.log('No fuzzy matches found.');
  process.exit(0);
}
fs.copyFileSync(GIFS_FILE, GIFS_FILE + '.fuzzy.bak');
fs.writeFileSync(GIFS_FILE, JSON.stringify(gifs, null, 2));
console.log(`Fuzzy patched ${changed} items. Backup to ${GIFS_FILE}.fuzzy.bak`);
