#!/usr/bin/env node
// GIF validator for data/gifs.json
const fs = require('fs');
const path = require('path');
const GIFS_FILE = path.join(__dirname, '..', 'data', 'gifs.json');

const args = process.argv.slice(2);
const doDeep = args.includes('--deep');

function looksLikeImageUrl(u) {
  if (!u || typeof u !== 'string') return false;
  if (/\.(gif|png|jpg|jpeg|webp)(\?|$)/i.test(u)) return true;
  if (/tenor\.com/i.test(u) || /steamcommunity-a\.akamaihd\.net/i.test(u)) return true;
  return false;
}

function checkTopLevel(arr, key) {
  (arr || []).forEach((u, i) => {
    if (!looksLikeImageUrl(u)) problems.push(`${key}[${i}] suspicious: ${u}`);
  });
}

let problems = [];

async function headCheck(url, timeoutMs = 5000) {
  // Use fetch if available (Node 18+). Try HEAD first, fall back to GET if HEAD not allowed.
  if (typeof fetch !== 'function') {
    // attempt to require node-fetch as fallback
    try { global.fetch = require('node-fetch'); } catch (e) { return { ok: false, reason: 'no-fetch' }; }
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    if (!res.ok) {
      // some servers reject HEAD; try GET to inspect content-type without downloading full body
      res = await fetch(url, { method: 'GET', signal: controller.signal });
    }
    clearTimeout(id);
    const ct = res.headers.get('content-type') || '';
    return { ok: res.ok, status: res.status, contentType: ct };
  } catch (e) {
    clearTimeout(id);
    return { ok: false, reason: e && e.name ? e.name : String(e) };
  }
}

async function main(){
  if (!fs.existsSync(GIFS_FILE)) { console.error('gifs.json not found at', GIFS_FILE); process.exit(1); }
  const raw = fs.readFileSync(GIFS_FILE, 'utf8');
  let gifs;
  try { gifs = JSON.parse(raw); } catch (e) { console.error('Invalid JSON in gifs.json', e); process.exit(1); }

  checkTopLevel(gifs.meme, 'meme');
  checkTopLevel(gifs.hug, 'hug');
  checkTopLevel(gifs.slap, 'slap');

  const deepChecks = [];

  if (gifs.cases && typeof gifs.cases === 'object') {
    for (const [cid, cdata] of Object.entries(gifs.cases)) {
      if (!cdata.items) continue;
      for (const [rar, rarData] of Object.entries(cdata.items)) {
        (rarData.items || []).forEach(it => {
          if (!it || !it.gif || !looksLikeImageUrl(it.gif)) problems.push(`case ${cid} rarity ${rar} item ${it && it.name} -> bad gif: ${it && it.gif}`);
          else if (doDeep) deepChecks.push({ url: it.gif, desc: `case ${cid} rarity ${rar} item ${it.name}` });
        });
      }
    }
  }

  if (doDeep) {
    console.log('Running deep checks on', deepChecks.length, 'URLs (this may take a while)...');
    for (const chk of deepChecks) {
      const r = await headCheck(chk.url);
      if (!r.ok) {
        problems.push(`${chk.desc} -> unreachable or non-OK: ${r.reason || r.status}`);
      } else if (r.contentType && !/^image\//i.test(r.contentType)) {
        problems.push(`${chk.desc} -> content-type not image: ${r.contentType}`);
      }
    }
  }

  if (problems.length) {
    console.error('GIF validation failed with the following issues:');
    problems.forEach(p => console.error(' -', p));
    process.exit(2);
  }
  console.log('GIF validation passed' + (doDeep ? ' (including deep checks).' : ' (format-level checks).'));
}

main().catch(e => { console.error('Validation error', e); process.exit(1); });
