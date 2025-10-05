#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const argv = require('minimist')((typeof process !== 'undefined' && process.argv) ? process.argv.slice(2) : []);
const concurrency = parseInt(argv.concurrency || 4, 10);
const limit = argv.limit ? parseInt(argv.limit, 10) : Infinity;
const CACHE_DIR = path.join(__dirname, '..', 'data', 'gifs-cache');
const MANIFEST = path.join(CACHE_DIR, 'manifest.json');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
const GIFS_FILE = path.join(__dirname, '..', 'data', 'gifs.json');
let gifs = {};
try { gifs = JSON.parse(fs.readFileSync(GIFS_FILE, 'utf8') || '{}'); } catch (e) { console.error('Failed to load gifs.json', e); process.exit(1); }
const items = [];
for (const [caseId, c] of Object.entries(gifs.cases || {})) {
    for (const [rarity, r] of Object.entries(c.items || {})) {
        for (const it of (r.items || [])) {
            if (it && it.name) items.push({ caseId, rarity, name: it.name });
        }
    }
}
const uniqueNames = Array.from(new Set(items.map(i => i.name))).slice(0, limit);
console.log(`Will try ${uniqueNames.length} unique skin names (limit=${limit}).`);

async function ensureFetch() {
    if (typeof fetch === 'function') return;
    try { global.fetch = require('node-fetch'); } catch (e) { console.error('Please `npm install node-fetch`'); process.exit(1); }
}

async function ensureCheerio() {
    try { return require('cheerio'); } catch (e) { console.error('Please `npm install cheerio`'); process.exit(1); }
}

function extOfUrl(u) {
    try { const p = new URL(u).pathname; const m = p.match(/\.([a-zA-Z0-9]{2,6})(?:$|\?)/); return m ? m[1].toLowerCase() : null; } catch (e) { return null; }
}

async function downloadToFile(url, destPath) {
    await ensureFetch();
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error('Failed to download: ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buf);
}

async function searchCsgostash(name, $) {
    // search page
    const q = `https://csgostash.com/?s=${encodeURIComponent(name)}`;
    try {
        const res = await fetch(q, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return null;
        const html = await res.text();
        const cheerio = $ || await ensureCheerio();
        const doc = cheerio.load(html);
        const a = doc('a[href*="/skin/"]').first();
        const href = a.attr('href');
        if (!href) return null;
        const pageUrl = href.startsWith('http') ? href : `https://csgostash.com${href}`;
        const pageRes = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!pageRes.ok) return null;
        const pageHtml = await pageRes.text();
        const pageDoc = cheerio.load(pageHtml);
        const og = pageDoc('meta[property="og:image"]').attr('content');
        if (og) return og;
        const img = pageDoc('img').first().attr('src');
        return img || null;
    } catch (e) {
        return null;
    }
}

async function searchSteamMarket(name, $) {
    // Use Steam market search page
    const q = `https://steamcommunity.com/market/search?q=${encodeURIComponent(name)}`;
    try {
        const res = await fetch(q, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return null;
        const html = await res.text();
        const cheerio = $ || await ensureCheerio();
        const doc = cheerio.load(html);
        // market listings often contain <img class="market_listing_item_img" src="...">
        const img = doc('img.market_listing_item_img').first().attr('src') || doc('img').first().attr('src');
        if (img) return img.startsWith('http') ? img : `https:${img}`;
        return null;
    } catch (e) {
        return null;
    }
}

async function searchGameBanana(name, $) {
    const q = `https://gamebanana.com/search?search=${encodeURIComponent(name)}`;
    try {
        const res = await fetch(q, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return null;
        const html = await res.text();
        const cheerio = $ || await ensureCheerio();
        const doc = cheerio.load(html);
        const a = doc('a').filter((i, el) => /skin|csgo/i.test(doc(el).attr('href') || '')).first();
        const href = a.attr('href');
        if (!href) return null;
        const pageUrl = href.startsWith('http') ? href : `https://gamebanana.com${href}`;
        const pageRes = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!pageRes.ok) return null;
        const pageHtml = await pageRes.text();
        const pageDoc = cheerio.load(pageHtml);
        const og = pageDoc('meta[property="og:image"]').attr('content');
        if (og) return og;
        const img = pageDoc('img').first().attr('src');
        return img || null;
    } catch (e) {
        return null;
    }
}

async function searchBing(name, $) {
    const q = `https://www.bing.com/images/search?q=${encodeURIComponent(name + ' csgo skin')}`;
    try {
        const res = await fetch(q, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return null;
        const html = await res.text();
        const cheerio = $ || await ensureCheerio();
        const doc = cheerio.load(html);
        // Bing often has mimg or img with data-src
        const img = doc('a.iusc').first().attr('m') || doc('img').first().attr('src') || doc('img').first().attr('data-src');
        if (!img) return null;
        // 'm' attribute contains JSON with image url
        try {
            const parsed = JSON.parse(img);
            if (parsed && parsed.murl) return parsed.murl;
        } catch (e) {}
        return img;
    } catch (e) { return null; }
}

async function findImageForName(name) {
    await ensureFetch();
    const cheerio = await ensureCheerio();
    // Try csgostash
    let url = await searchCsgostash(name, cheerio);
    if (url) return url;
    url = await searchSteamMarket(name, cheerio);
    if (url) return url;
    url = await searchGameBanana(name, cheerio);
    if (url) return url;
    url = await searchBing(name, cheerio);
    if (url) return url;
    return null;
}

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8') || '[]') : [];
const manifestIndex = new Map(manifest.map(e => [e.url, e]));

async function process(name, idx) {
    console.log(`[${idx}] Searching: ${name}`);
    try {
        const found = await findImageForName(name);
        if (!found) { console.log(`[${idx}] ${name} -> not found`); return { name, status: 'not_found' }; }
        const ext = extOfUrl(found) || 'png';
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const filename = `${slug}-${Date.now()}.${ext}`;
        const dest = path.join(CACHE_DIR, filename);
        await downloadToFile(found, dest);
        const entry = { source: 'scrape', caseId: null, rarity: null, name, url: found, status: 'saved', path: `data/gifs-cache/${filename}`, contentType: `image/${ext}` };
        manifestIndex.set(found, entry);
        manifestIndex.set(name, entry);
        console.log(`[${idx}] ${name} -> saved ${filename}`);
        return entry;
    } catch (e) {
        console.log(`[${idx}] ${name} -> error: ${e.message}`);
        return { name, status: 'error', reason: e.message };
    }
}

async function run() {
    const results = [];
    let i = 0;
    const queue = uniqueNames;
    const workers = new Array(concurrency).fill(null).map(async () => {
        while (i < queue.length) {
            const idx = i++;
            const name = queue[idx];
            const r = await process(name, idx+1);
            results.push(r);
        }
    });
    await Promise.all(workers);
    const final = Array.from(manifestIndex.values());
    fs.writeFileSync(MANIFEST, JSON.stringify(final, null, 2));
    console.log(`Done. Manifest written to ${MANIFEST}. Total entries: ${final.length}`);
}

run().catch(e => { console.error('Fatal', e); process.exit(2); });
