#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GIFS_FILE = path.join(ROOT, 'data', 'gifs.json');

if (!fs.existsSync(GIFS_FILE)) {
  console.error('data/gifs.json not found');
  process.exit(1);
}

const gifs = JSON.parse(fs.readFileSync(GIFS_FILE, 'utf8'));
const RARITY_EMOJI = {
  consumer: '🟢',
  industrial: '🔵',
  'mil-spec': '🔷',
  restricted: '🟣',
  classified: '🟠',
  covert: '🔴'
};
const MAX_VISIBLE_PER_RARITY = 6;
const embeds = [];
for (const [id, c] of Object.entries(gifs.cases || {})) {
  const e = { title: c.display || id, fields: [] };
  for (const [rarity, rarData] of Object.entries(c.items || {})) {
    const rawNames = (rarData.items || []).map(it => `• ${it.name}`);
    const visible = rawNames.slice(0, MAX_VISIBLE_PER_RARITY);
    const remainder = Math.max(0, rawNames.length - visible.length);
    let namesText = visible.join('\n') || '—';
    if (remainder > 0) namesText += `\n… and ${remainder} more`;
    const chance = rarData.chance != null ? ` (${rarData.chance}%)` : '';
    const emoji = RARITY_EMOJI[rarity] || '';
    const pretty = rarity.replace(/[-_]/g, ' ').replace(/\b\w/g, s => s.toUpperCase());
    e.fields.push({ name: `${emoji} ${pretty}${chance}`, value: namesText });
  }
  embeds.push(e);
}

console.log('Built embeds:', embeds.length);
console.log('Any embed has an image property?', embeds.some(e => Object.prototype.hasOwnProperty.call(e, 'image')));
if (embeds.length) console.log('Sample embed:', JSON.stringify(embeds[0], null, 2));
