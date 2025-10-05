#!/usr/bin/env node
// Searches DuckDuckGo Images for skin names and downloads a preferred image (png > webp > jpg > gif)
// Usage: node scripts/find-and-download-skins.js [--concurrency N] [--limit M]
const fs = require('fs');
const path = require('path');
const os = require('os');
const argv = require('minimist')(process.argv.slice(2));
const concurrency = parseInt(argv.concurrency || argv.c || 4, 10);
const limit = argv.limit ? parseInt(argv.limit, 10) : Infinity;
const CACHE_DIR = path.join(__dirname, '..', 'data', 'gifs-cache');
const MANIFEST = path.join(CACHE_DIR, 'manifest.json');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
const GIFS_FILE = path.join(__dirname, '..', 'data', 'gifs.json');
let gifs = {};
try { gifs = JSON.parse(fs.readFileSync(GIFS_FILE, 'utf8') || '{}'); } catch (e) { console.error('Failed to load gifs.json', e); process.exit(1); }
function uniq(arr) { return Array.from(new Set(arr)); }
// Collect item names from cases
const items = [];
for (const [caseId, c] of Object.entries(gifs.cases || {})) {
    for (const [rarity, r] of Object.entries(c.items || {})) {
        for (const it of (r.items || [])) {
            if (it && it.name) items.push({ caseId, rarity, name: it.name });
        }
    }
}
const unique = uniq(items.map(i => i.name)).slice(0, limit);
console.log(`Found ${unique.length} unique skin names to search (limit=${limit}).`);

async function fetchJson(url, headers = {}) {
    if (typeof fetch !== 'function') try { global.fetch = require('node-fetch'); } catch (e) { throw e; }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    return res.json();
}

// DuckDuckGo images API endpoint (unofficial): https://duckduckgo.com/i.js?q=QUERY
async function ddgImageSearch(query) {
    const url = 'https://duckduckgo.com/i.js?q=' + encodeURIComponent(query);
    try {
        const data = await fetchJson(url, { 'accept': 'application/json' });
        return data && data.results ? data.results : [];
    } catch (e) {
        // sometimes ddg blocks; return [] on error
        return [];
    }
}

function extOfUrl(u) {
    try { const p = new URL(u).pathname; const m = p.match(/\.([a-zA-Z0-9]{2,6})(?:$|\?)/); return m ? m[1].toLowerCase() : null; } catch (e) { return null; }
}

async function downloadToFile(url, destPath) {
    if (typeof fetch !== 'function') try { global.fetch = require('node-fetch'); } catch (e) { throw e; }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to download: ' + res.status);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
}

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8') || '[]') : [];
const manifestIndex = new Map(manifest.map(e => [e.url, e]));

async function processName(name, idx) {
    const results = await ddgImageSearch(name + ' csgo skin');
    // prefer png then webp then jpg then gif
    const prefer = ['png','webp','jpg','jpeg','gif'];
    let chosen = null;
    for (const r of results) {
        const imageUrl = r.image || r.thumbnail || r.url;
        if (!imageUrl) continue;
        const ext = extOfUrl(imageUrl);
        if (!ext) continue;
        if (prefer.includes(ext)) { chosen = { url: imageUrl, ext }; break; }
    }
    if (!chosen && results.length) {
        const r = results[0];
        const imageUrl = r.image || r.thumbnail || r.url;
        if (imageUrl) chosen = { url: imageUrl, ext: extOfUrl(imageUrl) || 'bin' };
    }
    if (!chosen) {
        console.log(`[${idx}] ${name} -> no image found`);
        return { name, status: 'not_found' };
    }
    // save file
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filename = `${slug}-${Date.now()}.${chosen.ext || 'png'}`;
    const dest = path.join(CACHE_DIR, filename);
    try {
        await downloadToFile(chosen.url, dest);
        const entry = { source: 'search', caseId: null, rarity: null, name, url: chosen.url, status: 'saved', path: `data/gifs-cache/${filename}`, contentType: `image/${chosen.ext || 'png'}` };
        manifestIndex.set(chosen.url, entry);
        // also map by name (helpful for later patching)
        manifestIndex.set(name, entry);
        console.log(`[${idx}] ${name} -> saved ${filename}`);
        return entry;
    } catch (e) {
        console.log(`[${idx}] ${name} -> download failed: ${e.message}`);
        return { name, status: 'download_failed', reason: e.message };
    }
}

async function run() {
    const results = [];
    let i = 0;
    const queue = unique;
    // simple concurrency
    const workers = new Array(concurrency).fill(null).map(async () => {
        while (i < queue.length) {
            const idx = i++;
            const name = queue[idx];
            try {
                const r = await processName(name, idx+1);
                results.push(r);
            } catch (e) {
                results.push({ name, status: 'error', reason: e.message });
            }
        }
    });
    await Promise.all(workers);
    // write manifest (merge with existing manifest entries by url)
    const final = Array.from(manifestIndex.values());
    fs.writeFileSync(MANIFEST, JSON.stringify(final, null, 2));
    console.log(`Done. Manifest written to ${MANIFEST}. Total entries: ${final.length}`);
}

run().catch(e => { console.error('Fatal error', e); process.exit(2); });
