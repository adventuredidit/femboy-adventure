const fs = require('fs');
const path = require('path');
const { generateReadableId } = require('../utils/id-generator');

// Load all data files
const dataDir = path.join(__dirname, 'data');
const inventory = JSON.parse(fs.readFileSync(path.join(dataDir, 'inventory.json'), 'utf8'));
const market = JSON.parse(fs.readFileSync(path.join(dataDir, 'market.json'), 'utf8'));

// Keep track of used IDs to avoid duplicates
const usedIds = new Set();

function getUniqueReadableId() {
    let id;
    do {
        id = generateReadableId();
    } while (usedIds.has(id));
    usedIds.add(id);
    return id;
}

// Update inventory IDs
console.log('Updating inventory IDs...');
for (const guildId in inventory) {
    for (const userId in inventory[guildId]) {
        inventory[guildId][userId] = inventory[guildId][userId].map(item => ({
            ...item,
            id: getUniqueReadableId()
        }));
    }
}

// Update market listing IDs and their item IDs
console.log('Updating market listing IDs...');
if (market.listings) {
    // Global market structure
    market.listings = market.listings.map(listing => ({
        ...listing,
        id: getUniqueReadableId(),
        itemId: getUniqueReadableId(),
        item: {
            ...listing.item,
            id: listing.itemId // Keep the same ID as itemId for consistency
        }
    }));
} else {
    // Per-guild market structure (legacy)
    for (const guildId in market) {
        if (market[guildId].listings) {
            market[guildId].listings = market[guildId].listings.map(listing => ({
                ...listing,
                id: getUniqueReadableId(),
                itemId: getUniqueReadableId(),
                item: {
                    ...listing.item,
                    id: listing.itemId // Keep the same ID as itemId for consistency
                }
            }));
        }
    }
}

// Save updated files
console.log('Saving updated files...');
fs.writeFileSync(path.join(dataDir, 'inventory.json'), JSON.stringify(inventory, null, 2));
fs.writeFileSync(path.join(dataDir, 'market.json'), JSON.stringify(market, null, 2));

console.log('Done! All IDs have been updated to the new readable format.');