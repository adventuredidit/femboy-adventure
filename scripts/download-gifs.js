#!/usr/bin/env node
// downloads reachable GIFs from data/gifs.json into data/gifs-cache
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const pipe = promisify(pipeline);

const GIFS_FILE = path.join(__dirname, '..', 'data', 'gifs.json');
const DEFAULT_OUT = path.join(__dirname, '..', 'data', 'gifs-cache');

const argv = require('minimist')(process.argv.slice(2));
const outDir = argv.outdir ? path.resolve(argv.outdir) : DEFAULT_OUT;
const limit = argv.limit ? parseInt(argv.limit, 10) : 0; // 0 = no limit
const timeoutMs = argv.timeout ? parseInt(argv.timeout, 10) : 8000;

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function ensureFetch() {
  if (typeof fetch === 'function') return fetch;
  try {
    global.fetch = require('node-fetch');
    return global.fetch;
  } catch (e) {
    throw new Error('fetch is not available; install node-fetch or run on Node 18+');
  }
}

async function headCheck(fetchFn, url) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetchFn(url, { method: 'HEAD', signal: controller.signal });
    if (!res.ok) res = await fetchFn(url, { method: 'GET', signal: controller.signal });
    clearTimeout(id);
    return { ok: res.ok, status: res.status, contentType: res.headers.get('content-type') };
  } catch (e) {
    clearTimeout(id);
    return { ok: false, reason: e && e.name ? e.name : String(e) };
  }
}

async function download(fetchFn, url, destPath) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs * 2);
  try {
    const res = await fetchFn(url, { method: 'GET', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
    const dest = fs.createWriteStream(destPath);
    await pipe(res.body, dest);
    clearTimeout(id);
    return { ok: true };
  } catch (e) {
    clearTimeout(id);
    return { ok: false, reason: e && e.message ? e.message : String(e) };
  }
}

async function main() {
  if (!fs.existsSync(GIFS_FILE)) { console.error('gifs.json not found at', GIFS_FILE); process.exit(1); }
  const raw = fs.readFileSync(GIFS_FILE, 'utf8');
  let gifs;
  try { gifs = JSON.parse(raw); } catch (e) { console.error('Invalid JSON in gifs.json', e); process.exit(1); }

  const fetchFn = await ensureFetch();
  const items = [];

  // collect urls
  ['meme','hug','slap'].forEach(k => {
    (gifs[k] || []).forEach((u, i) => items.push({ source: k, caseId: null, rarity: null, name: `${k}-${i}`, url: u }));
  });

  if (gifs.cases && typeof gifs.cases === 'object') {
    for (const [cid, cdata] of Object.entries(gifs.cases)) {
      if (!cdata.items) continue;
      for (const [rar, rarData] of Object.entries(cdata.items)) {
        (rarData.items || []).forEach(it => {
          items.push({ source: 'case', caseId: cid, rarity: rar, name: it.name, url: it.gif });
        });
      }
    }
  }

  console.log(`Found ${items.length} total items to check.`);
  const manifest = [];
  let count = 0;
  for (const it of items) {
    if (limit && count >= limit) break;
    if (!it.url) {
      manifest.push({ ...it, status: 'no-url' });
      continue;
    }
    process.stdout.write(`Checking ${it.name} ... `);
    const head = await headCheck(fetchFn, it.url);
    if (!head.ok) {
      console.log(`FAILED (${head.reason || head.status})`);
      manifest.push({ ...it, status: 'unreachable', reason: head.reason || head.status });
      continue;
    }
    const ct = (head.contentType || '').split(';')[0] || '';
    const extFromCt = ct && ct.startsWith('image/') ? '.' + ct.split('/')[1].replace('+xml','') : '';
    const urlPath = new URL(it.url).pathname;
    const extFromUrl = path.extname(urlPath).split('?')[0] || '';
    const ext = extFromUrl || extFromCt || '.bin';
    const filename = `${slugify(it.name || 'img')}-${Date.now()}${ext}`;
    const savedPath = path.join(outDir, filename);
    console.log(`OK -> saving as ${filename}`);
    const dl = await download(fetchFn, it.url, savedPath);
    if (!dl.ok) {
      console.log(`download failed: ${dl.reason}`);
      manifest.push({ ...it, status: 'download-failed', reason: dl.reason });
      continue;
    }
    manifest.push({ ...it, status: 'saved', path: path.relative(process.cwd(), savedPath), contentType: ct });
    count++;
  }

  await fs.promises.mkdir(outDir, { recursive: true });
  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Done. Manifest written to ${manifestPath}. Saved ${count} files to ${outDir}.`);
}

main().catch(e => { console.error('Error', e); process.exit(1); });
