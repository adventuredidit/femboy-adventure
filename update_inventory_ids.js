const fs = require('fs');
const path = require('path');

// Load inventory
const INVENTORY_FILE = path.join(__dirname, 'data', 'inventory.json');
const inventory = JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8'));

// Generate ID function
function generateItemId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Add IDs to all items that don't have them
let updatedCount = 0;
for (const guildId in inventory) {
    for (const userId in inventory[guildId]) {
        const userInv = inventory[guildId][userId];
        userInv.forEach(item => {
            if (!item.id) {
                item.id = generateItemId();
                updatedCount++;
            }
        });
    }
}

// Save updated inventory
fs.writeFileSync(INVENTORY_FILE, JSON.stringify(inventory, null, 2));
console.log(`Updated ${updatedCount} items with new IDs`);
