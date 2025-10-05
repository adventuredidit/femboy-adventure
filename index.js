const messageHistories = new Map();
// If using Node < 18, uncomment the next line:
// const fetch = require('node-fetch');
// ...existing code...
// Create a Discord Bot using OpenAI API that interacts on the Discord Server
// Load .env if dotenv is available. In some hosted environments (like Replit) secrets are provided
// via the environment and dotenv may not be installed. Avoid crashing if dotenv is missing.
try {
    require('dotenv').config();
} catch (e) {
    // dotenv not available — that's OK on some hosts. Warn for local dev if env isn't set.
    if (!process.env.DISCORD_TOKEN) {
        console.log('Note: dotenv not found and DISCORD_TOKEN is not set in environment. If running locally, run `npm install` or create a .env file.');
    }
}
// Debug: Check if DISCORD_TOKEN is loaded
if (!process.env.DISCORD_TOKEN) {
    console.log('DISCORD_TOKEN is missing! Check your .env file.');
} else {
    console.log('DISCORD_TOKEN loaded, starts with:', process.env.DISCORD_TOKEN.slice(0, 5) + '...');
}

// Prepare to connect to Discord API
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences  // Add this for better user fetching
]});
const yts = require('yt-search');
// Helper to build slash command definitions at runtime (so case choices reflect data/gifs.json)
function buildCommands() {
    const cmds = [];
    
    // Roulette command
    cmds.push(
        new SlashCommandBuilder()
            .setName('roulette')
            .setDescription('Play roulette with your coins')
            .addIntegerOption(option =>
                option.setName('amount')
                    .setDescription('Amount of coins to bet')
                    .setRequired(true)
                    .setMinValue(1)
            )
            .addStringOption(option =>
                option.setName('bet_type')
                    .setDescription('Type of bet to place')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Single Number (35x payout)', value: 'number' },
                        { name: 'Red/Black (2x payout)', value: 'color' },
                        { name: 'Even/Odd (2x payout)', value: 'parity' }
                    )
            )
            .addIntegerOption(option =>
                option.setName('number')
                    .setDescription('Number to bet on (0-36, only for single number bets)')
                    .setMinValue(0)
                    .setMaxValue(36)
            )
            .addStringOption(option =>
                option.setName('color')
                    .setDescription('Color to bet on (for color bets)')
                    .addChoices(
                        { name: 'Red', value: 'red' },
                        { name: 'Black', value: 'black' }
                    )
            )
            .addStringOption(option =>
                option.setName('parity')
                    .setDescription('Even or Odd (for parity bets)')
                    .addChoices(
                        { name: 'Even', value: 'even' },
                        { name: 'Odd', value: 'odd' }
                    )
            )
    );

    const caseCommand = new SlashCommandBuilder()
        .setName('case')
        .setDescription('CS:GO-style case system')
        .addSubcommand(sub => sub.setName('list').setDescription('List available cases and their costs'))
        .addSubcommand(sub => 
            sub.setName('open')
               .setDescription('Open a case')
               .addStringOption(o =>
                   o.setName('type')
                    .setDescription('Type of case to open')
                    .setRequired(true)
               )
        )
        .addSubcommand(sub =>
            sub.setName('inventory')
               .setDescription('View your case inventory')
        )
        .addSubcommand(sub =>
            sub.setName('sell')
               .setDescription('Sell an item from your inventory')
               .addStringOption(o =>
                   o.setName('id')
                    .setDescription('ID of the item to sell (from /case inventory)')
                    .setRequired(true)
               )
        )
        .addSubcommand(sub =>
            sub.setName('leaderboard')
               .setDescription('Show global leaderboard of richest users')
               .addIntegerOption(o =>
                   o.setName('page')
                    .setDescription('Page number to view')
                    .setRequired(false)
               )
        )
        .addSubcommand(sub =>
            sub.setName('stats')
               .setDescription('View your case opening statistics')
        );

    const marketCommand = new SlashCommandBuilder()
        .setName('market')
        .setDescription('CS:GO skin marketplace')
        .addSubcommand(sub =>
            sub.setName('list')
               .setDescription('List an item for sale')
               .addStringOption(o =>
                   o.setName('item')
                    .setDescription('Name of the item to sell')
                    .setRequired(true)
               )
               .addIntegerOption(o =>
                   o.setName('price')
                    .setDescription('Price in coins')
                    .setRequired(true)
               )
        )
        .addSubcommand(sub =>
            sub.setName('buy')
               .setDescription('Buy an item from the market')
               .addStringOption(o =>
                   o.setName('id')
                    .setDescription('ID of the listing to buy')
                    .setRequired(true)
               )
        )
        .addSubcommand(sub =>
            sub.setName('search')
               .setDescription('Search market listings')
               .addStringOption(o =>
                   o.setName('query')
                    .setDescription('Search by name, rarity, or wear')
                    .setRequired(true)
               )
        )
        .addSubcommand(sub =>
            sub.setName('listings')
               .setDescription('View your active market listings')
        )
        .addSubcommand(sub =>
            sub.setName('remove')
               .setDescription('Remove your listing from the market')
               .addStringOption(o =>
                   o.setName('id')
                    .setDescription('ID of the listing to remove')
                    .setRequired(true)
               )
        );

    const dailyCommand = new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward');

    const streakCommand = new SlashCommandBuilder()
        .setName('streak')
        .setDescription('Check your daily reward streak');
    cmds.push(caseCommand);
    cmds.push(dailyCommand);
    cmds.push(streakCommand);
    cmds.push(marketCommand);
    cmds.push(new SlashCommandBuilder().setName('dice').setDescription('Roll a 6-sided die!'));
    
    // Additional commands - non-duplicates
    const other = [
        new SlashCommandBuilder().setName('guess').setDescription('Guess a number between 1 and 10!').addIntegerOption(opt => opt.setName('number').setDescription('Your guess').setRequired(true)),
        new SlashCommandBuilder().setName('slots').setDescription('Play a simple slot machine!'),
        new SlashCommandBuilder().setName('balance').setDescription('Check your balance'),
        new SlashCommandBuilder().setName('bal').setDescription('Alias for /balance'),
        new SlashCommandBuilder().setName('bet').setDescription('Place a bet (heads/tails)').addIntegerOption(opt => opt.setName('amount').setDescription('Amount to bet').setRequired(true)).addStringOption(opt => opt.setName('choice').setDescription('heads or tails').setRequired(true)),
        new SlashCommandBuilder().setName('give').setDescription('Give coins to a user (admin only)').addUserOption(opt => opt.setName('user').setDescription('User to give coins to').setRequired(true)).addIntegerOption(opt => opt.setName('amount').setDescription('Amount to give').setRequired(true)),
        new SlashCommandBuilder().setName('playquery').setDescription('Search YouTube and return a playable link').addStringOption(opt => opt.setName('query').setDescription('Search query or URL').setRequired(true)),
        new SlashCommandBuilder().setName('trivia').setDescription('Get a random trivia question!'),
        new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball a question!').addStringOption(opt => opt.setName('question').setDescription('Your question').setRequired(true)),
        new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin!'),
        new SlashCommandBuilder().setName('rps').setDescription('Play rock-paper-scissors!').addStringOption(opt => opt.setName('choice').setDescription('rock, paper, or scissors').setRequired(true)),
        new SlashCommandBuilder().setName('mute').setDescription('Mute a member').addUserOption(opt => opt.setName('user').setDescription('User to mute').setRequired(true)),
        new SlashCommandBuilder().setName('unmute').setDescription('Unmute a member').addUserOption(opt => opt.setName('user').setDescription('User to unmute').setRequired(true)),
        new SlashCommandBuilder().setName('ban').setDescription('Ban a member').addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true)),
        new SlashCommandBuilder().setName('unban').setDescription('Unban a user by ID').addStringOption(opt => opt.setName('userid').setDescription('User ID to unban').setRequired(true)),
        new SlashCommandBuilder().setName('warn').setDescription('Warn a member with a reason').addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true)).addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true)).addStringOption(opt => opt.setName('duration').setDescription('Optional duration to timeout (e.g. 5m, 1h, 1d, 1w)').setRequired(false)),
        new SlashCommandBuilder().setName('setmodlog').setDescription('Set the mod-log channel').addChannelOption(opt => opt.setName('channel').setDescription('Channel to send mod logs').setRequired(true)),
        new SlashCommandBuilder().setName('trivia-leaderboard').setDescription('Show trivia leaderboard for this guild'),
        new SlashCommandBuilder().setName('warns').setDescription('View warns for a user').addUserOption(opt => opt.setName('user').setDescription('User to view').setRequired(true)),
        new SlashCommandBuilder().setName('clearwarns').setDescription('Clear warns for a user').addUserOption(opt => opt.setName('user').setDescription('User to clear').setRequired(true)),
        new SlashCommandBuilder().setName('help').setDescription('Show all available commands'),
        new SlashCommandBuilder().setName('gaytest').setDescription('Test how gay someone is').addUserOption(opt => opt.setName('user').setDescription('User to test').setRequired(true)),
        new SlashCommandBuilder().setName('owoify').setDescription('OwOify your text').addStringOption(opt => opt.setName('text').setDescription('Text to OwOify').setRequired(true)),
        new SlashCommandBuilder().setName('hug').setDescription('Hug another user').addUserOption(opt => opt.setName('user').setDescription('User to hug').setRequired(true)),
        new SlashCommandBuilder().setName('slap').setDescription('Slap another user').addUserOption(opt => opt.setName('user').setDescription('User to slap').setRequired(true)),
        new SlashCommandBuilder().setName('ship').setDescription('Ship two users').addUserOption(opt => opt.setName('user1').setDescription('First user').setRequired(true)).addUserOption(opt => opt.setName('user2').setDescription('Second user').setRequired(true)),
        new SlashCommandBuilder().setName('cat').setDescription('Get a random cat image'),
        new SlashCommandBuilder().setName('dog').setDescription('Get a random dog image'),
        new SlashCommandBuilder().setName('roll').setDescription('Roll a die with custom sides').addIntegerOption(opt => opt.setName('sides').setDescription('Number of sides (2–1000)').setRequired(true)),
        new SlashCommandBuilder().setName('kick').setDescription('Kick a member (mod only)').addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true)),
        new SlashCommandBuilder().setName('timeout').setDescription('Timeout a member (mod only)').addUserOption(opt => opt.setName('user').setDescription('User to timeout').setRequired(true)).addIntegerOption(opt => opt.setName('minutes').setDescription('Duration in minutes').setRequired(true)),
        new SlashCommandBuilder().setName('purge').setDescription('Delete recent messages (mod only)').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to delete (1–100)').setRequired(true)),
        new SlashCommandBuilder().setName('lock').setDescription('Lock the current channel (mod only)'),
        new SlashCommandBuilder().setName('unlock').setDescription('Unlock the current channel (mod only)')
    ];
    return cmds.concat(other).map(c => c.toJSON());
}
// Command descriptions for /help
const commandDescriptions = [
    // Case System
    { name: '/case list', desc: 'List available cases and their costs.' },
    { name: '/case leaderboard', desc: 'Show global leaderboard of richest users.' },
    { name: '/case open', desc: 'Open a case for a chance at rare items.' },
    { name: '/case inventory', desc: 'View your collection of case items.' },
    { name: '/case sell', desc: 'Sell an item from your inventory for coins.' },
    
    // Fun & Games
    { name: '/dice', desc: 'Roll a 6-sided die.' },
    { name: '/roll', desc: 'Roll a die with custom sides (2-1000).' },
    { name: '/guess', desc: 'Guess a number between 1 and 10.' },
    { name: '/8ball', desc: 'Ask the magic 8-ball a question.' },
    { name: '/coinflip', desc: 'Flip a coin!' },
    { name: '/rps', desc: 'Play rock-paper-scissors.' },
    { name: '/gaytest', desc: 'Test how gay someone is.' },
    { name: '/owoify', desc: 'OwOify your text.' },
    
    // Economy
    { name: '/slots', desc: 'Play slots! Costs 10 coins, win up to 5x.' },
    { name: '/balance', desc: 'Check your coin balance.' },
    { name: '/bal', desc: 'Short alias for /balance.' },
    { name: '/bet', desc: 'Bet coins on heads or tails.' },
    { name: '/give', desc: 'Give coins to a user (admin only).' },
    
    // Trivia
    { name: '/trivia', desc: 'Answer a random trivia question!' },
    { name: '/trivia-leaderboard', desc: 'View the trivia scoreboard.' },
    
    // Reaction Commands
    { name: '/hug', desc: 'Send a hug to someone.' },
    { name: '/slap', desc: 'Playfully slap someone.' },
    { name: '/ship', desc: 'Ship two users and get a match %.' },
    { name: '/meme', desc: 'Get a random meme' },
    { name: '/cat', desc: 'Get a random cat image.' },
    { name: '/dog', desc: 'Get a random dog image.' },
    
    // Music
    { name: '/playquery', desc: 'Search YouTube and get a playable link + info.' },
    
    // Moderation
    { name: '/mute', desc: 'Mute a member (1 hour, mod only).' },
    { name: '/unmute', desc: 'Unmute a member (mod only).' },
    { name: '/kick', desc: 'Kick a member (mod only).' },
    { name: '/ban', desc: 'Ban a member (mod only).' },
    { name: '/unban', desc: 'Unban a user by ID (mod only).' },
    { name: '/warn', desc: 'Warn a member with optional timeout (mod only).' },
    { name: '/warns', desc: 'View warnings for a user (mod only).' },
    { name: '/clearwarns', desc: 'Clear all warnings for a user (mod only).' },
    { name: '/timeout', desc: 'Timeout a member for X minutes (mod only).' },
    { name: '/purge', desc: 'Delete 1-100 recent messages (mod only).' },
    { name: '/lock', desc: 'Lock the current channel (mod only).' },
    { name: '/unlock', desc: 'Unlock the current channel (mod only).' },
    { name: '/setmodlog', desc: 'Set channel for mod action logs (admin only).' },
    
    // Help
    { name: '/help', desc: 'Show this command list with category navigation.' },
    { name: '/help [category]', desc: 'Show commands for a specific category.' },
];

// Command categories for help navigation
const commandCategories = {
    'Case System': ['/case list', '/case open', '/case inventory', '/case sell'],
    'Economy': ['/balance', '/bal', '/bet', '/give', '/slots'],
    'Fun & Games': ['/dice', '/roll', '/guess', '/8ball', '/coinflip', '/rps', '/gaytest', '/owoify'],
    'Trivia': ['/trivia', '/trivia-leaderboard'],
    'Reactions': ['/hug', '/slap', '/ship', '/meme', '/cat', '/dog'],
    'Music': ['/playquery'],
    'Moderation': ['/mute', '/unmute', '/kick', '/ban', '/unban', '/warn', '/warns', '/clearwarns', '/timeout', '/purge', '/lock', '/unlock', '/setmodlog']
};

// Register slash commands on ready (support both current 'ready' and future 'clientReady')
async function onClientReady() {
    if (onClientReady._ran) return; // idempotent guard: avoid double-run
    onClientReady._ran = true;
    console.log(`Logged in as ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        // Register commands. If GUILD_ID is set, register to that guild for instant updates (useful for testing).
        let cmds = buildCommands();
        // Post-process JSON to inject choices for /case open -> type option so the UI shows a dropdown.
        try {
            // cmds is an array of command JSON objects
            const caseCmd = cmds.find(c => c && c.name === 'case');
            if (caseCmd && Array.isArray(caseCmd.options)) {
                // find subcommand 'open'
                const openSub = caseCmd.options.find(op => op.type === 1 && op.name === 'open');
                if (openSub && Array.isArray(openSub.options)) {
                    const typeOpt = openSub.options.find(o => o.name === 'type' && o.type === 3);
                    if (typeOpt) {
                        const caseKeys = Object.keys(gifs.cases || {}).slice(0, 25);
                        const choices = caseKeys.map(k => {
                            const display = (gifs.cases[k] && gifs.cases[k].display) ? `${gifs.cases[k].display} (${gifs.cases[k].cost} coins)` : `${k}`;
                            // Discord limits choice name length to 100; truncate safely
                            return { name: display.length > 100 ? display.slice(0, 97) + '...' : display, value: k };
                        });
                        if (choices.length) typeOpt.choices = choices;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to inject command choices for /case open:', e && e.message ? e.message : e);
        }
        console.log('Attempting to register commands:', JSON.stringify(cmds, null, 2));
        
        if (process.env.GUILD_IDS) {
            // Split the GUILD_IDS string into an array of IDs
            const guildIds = process.env.GUILD_IDS.split(',').map(id => id.trim());
            console.log('Registering commands to guilds:', guildIds);
            
            // Register commands to each guild
            for (const guildId of guildIds) {
                try {
                    const data = await rest.put(
                        Routes.applicationGuildCommands(client.user.id, guildId),
                        { body: cmds }
                    );
                    console.log(`Successfully registered ${data.length} commands to guild ${guildId}`);
                } catch (error) {
                    console.error(`Failed to register commands to guild ${guildId}:`, error.message);
                }
            }
        } else {
            console.log('Registering commands globally (this may take up to an hour)');
            const data = await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: cmds }
            );
            console.log(`Successfully registered ${data.length} commands globally`);
        }
    } catch (err) {
        console.error('Error registering slash commands:', err);
    }
}

// Use both event names so this code works in current versions and remains compatible
// with future discord.js versions where the ready event name changes.
client.once('clientReady', onClientReady);
client.once('ready', onClientReady);
// --- Warn storage helpers ---
const WARNS_FILE = path.join(__dirname, 'data', 'warns.json');
function loadWarns() {
    try {
        if (!fs.existsSync(WARNS_FILE)) return {};
        const raw = fs.readFileSync(WARNS_FILE, 'utf8');
        return JSON.parse(raw || '{}');
    } catch (e) {
        console.error('Failed to load warns:', e);
        return {};
    }
}
function saveWarns(data) {
    try {
        fs.writeFileSync(WARNS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Failed to save warns:', e);
    }
}
// Ensure data dir exists
try { fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true }); } catch (e) { }
// Load into memory
let warnsData = loadWarns();
// duration parser: "5m", "1h", "1d", "1w" -> minutes
function parseDurationToMinutes(str) {
    if (!str) return 0;
    const s = str.trim().toLowerCase();
    const m = s.match(/^(\d+)\s*(m|min|minute|minutes)$/);
    if (m) return parseInt(m[1], 10);
    const h = s.match(/^(\d+)\s*(h|hr|hour|hours)$/);
    if (h) return parseInt(h[1], 10) * 60;
    const d = s.match(/^(\d+)\s*(d|day|days)$/);
    if (d) return parseInt(d[1], 10) * 60 * 24;
    const w = s.match(/^(\d+)\s*(w|week|weeks)$/);
    if (w) return parseInt(w[1], 10) * 60 * 24 * 7;
    // fallback: numeric only = minutes
    const n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
}
// Config helpers
const CONFIG_FILE = path.join(__dirname, 'data', 'config.json');
function loadConfig() {
    try { if (!fs.existsSync(CONFIG_FILE)) return {}; return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8') || '{}'); } catch (e) { console.error('Failed to load config:', e); return {}; }
}
function saveConfig(cfg) { try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); } catch (e) { console.error('Failed to save config:', e); } }
let configData = loadConfig();
// Trivia score helpers
const TRIVIA_FILE = path.join(__dirname, 'data', 'trivia_scores.json');
function loadTrivia() { try { if (!fs.existsSync(TRIVIA_FILE)) return {}; return JSON.parse(fs.readFileSync(TRIVIA_FILE, 'utf8') || '{}'); } catch (e) { console.error('Failed to load trivia:', e); return {}; } }
function saveTrivia(d) { try { fs.writeFileSync(TRIVIA_FILE, JSON.stringify(d, null, 2)); } catch (e) { console.error('Failed to save trivia:', e); } }
let triviaScores = loadTrivia();
// Load GIFs config
const GIFS_FILE = path.join(__dirname, 'data', 'gifs.json');
const MARKET_FILE = path.join(__dirname, 'data', 'market.json');
const DAILY_FILE = path.join(__dirname, 'data', 'daily.json');

function loadGifs() { try { if (!fs.existsSync(GIFS_FILE)) return {}; return JSON.parse(fs.readFileSync(GIFS_FILE, 'utf8') || '{}'); } catch (e) { console.error('Failed to load gifs:', e); return {}; } }
function loadMarket() { try { if (!fs.existsSync(MARKET_FILE)) return {}; return JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8') || '{}'); } catch (e) { console.error('Failed to load market:', e); return {}; } }
function saveMarket(data) { try { fs.writeFileSync(MARKET_FILE, JSON.stringify(data, null, 2)); } catch (e) { console.error('Failed to save market:', e); } }
function loadDaily() { try { if (!fs.existsSync(DAILY_FILE)) return {}; return JSON.parse(fs.readFileSync(DAILY_FILE, 'utf8') || '{}'); } catch (e) { console.error('Failed to load daily:', e); return {}; } }
function saveDaily(data) { try { fs.writeFileSync(DAILY_FILE, JSON.stringify(data, null, 2)); } catch (e) { console.error('Failed to save daily:', e); } }

// Generate a unique ID for market listings
function generateItemId() {
    return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

let gifs = loadGifs();
let market = loadMarket();
let daily = loadDaily();
if (!gifs) {
    console.error('Failed to load gifs.json, initializing with defaults');
    gifs = { cases: {}, hug: [], slap: [], ship: {} };
}
if (!gifs.cases) {
    console.error('No cases found in gifs.json, initializing cases object');
    gifs.cases = {};
}

// Helper: basic validation of image-like URLs (allows known host patterns too)
function looksLikeImageUrl(u) {
    if (!u || typeof u !== 'string') return false;
    try {
        // quick check for common extensions
        if (/\.(gif|png|jpg|jpeg|webp)(\?|$)/i.test(u)) return true;
        // tenor and steam image hosts are typically usable
        if (/tenor\.com/i.test(u) || /steamcommunity-a\.akamaihd\.net/i.test(u)) return true;
    } catch (e) {
        return false;
    }
    return false;
}

// Helper: check that a remote URL responds and is an image (HEAD then GET fallback)
async function isImageReachable(url, timeoutMs = 4000) {
    // If we have a cached copy, consider it reachable immediately
    try {
        if (urlToCache.has(url)) return true;
    } catch (e) {
        // continue to network check if map access fails
    }
    if (!url || typeof url !== 'string') return false;
    if (typeof fetch !== 'function') {
        try { global.fetch = require('node-fetch'); } catch (e) { return false; }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        let res = await fetch(url, { method: 'HEAD', signal: controller.signal });
        if (!res.ok) {
            // some hosts reject HEAD; try GET but don't buffer body
            res = await fetch(url, { method: 'GET', signal: controller.signal });
        }
        clearTimeout(timer);
        const ct = res.headers.get('content-type') || '';
        return res.ok && /^image\//i.test(ct);
    } catch (e) {
        clearTimeout(timer);
        return false;
    }
}

// Sanitize gifs object: ensure arrays exist and filter out clearly-bad URLs
function sanitizeGifs(g) {
    if (!g) return g;
    // sanitize top-level lists
    ['meme','hug','slap'].forEach(k => {
        if (!Array.isArray(g[k])) g[k] = [];
        else g[k] = g[k].filter(looksLikeImageUrl);
    });
    // sanitize ship ranges
    if (!g.ship || typeof g.ship !== 'object') g.ship = {};
    else Object.keys(g.ship).forEach(range => {
        if (!Array.isArray(g.ship[range])) g.ship[range] = [];
        else g.ship[range] = g.ship[range].filter(looksLikeImageUrl);
    });

    // sanitize cases: ensure each rarity has items array and gif urls
    if (!g.cases || typeof g.cases !== 'object') g.cases = {};
    for (const [caseId, caseData] of Object.entries(g.cases)) {
        if (!caseData.items || typeof caseData.items !== 'object') caseData.items = {};
        for (const [rarity, rarData] of Object.entries(caseData.items)) {
            if (!Array.isArray(rarData.items)) rarData.items = [];
            rarData.items = rarData.items.filter(it => it && it.name && looksLikeImageUrl(it.gif));
            // if baseValue missing, try to keep a sane default
            if (typeof rarData.baseValue === 'undefined') rarData.baseValue = 10;
        }
    }
    return g;
}

gifs = sanitizeGifs(gifs);
// Load cache manifest (populated by scripts/download-gifs.js) so runtime can prefer local attachments
const CACHE_DIR = path.join(__dirname, 'data', 'gifs-cache');
const CACHE_MANIFEST_FILE = path.join(CACHE_DIR, 'manifest.json');
let cacheManifest = [];
const urlToCache = new Map(); // map original URL -> { path: absolutePath, name, contentType }
try {
    if (fs.existsSync(CACHE_MANIFEST_FILE)) {
        cacheManifest = JSON.parse(fs.readFileSync(CACHE_MANIFEST_FILE, 'utf8') || '[]');
        for (const e of cacheManifest) {
            if (e && e.status === 'saved' && e.path) {
                const abs = path.isAbsolute(e.path) ? e.path : path.join(__dirname, e.path);
                if (fs.existsSync(abs)) {
                    urlToCache.set(e.url, { path: abs, name: path.basename(abs), contentType: e.contentType || '' });
                }
            }
        }
        console.log(`gifs-cache: loaded ${urlToCache.size} cached files from manifest`);
    }
} catch (e) {
    console.error('Failed to load gifs-cache manifest', e);
}
// Log a brief summary so owners can see counts at startup
try {
    const caseCount = Object.keys(gifs.cases || {}).length;
    const memeCount = (gifs.meme || []).length;
    const hugCount = (gifs.hug || []).length;
    const slapCount = (gifs.slap || []).length;
    console.log(`gifs loaded: cases=${caseCount}, meme=${memeCount}, hug=${hugCount}, slap=${slapCount}`);
} catch (e) {
    console.log('gifs summary log failed', e);
}

// Initialize all case properties to prevent undefined errors
for (const caseId in gifs.cases) {
    const caseData = gifs.cases[caseId];
    if (!caseData.items) caseData.items = {};
    if (!caseData.cost) caseData.cost = 10;
    if (!caseData.display) caseData.display = `📦 ${caseId} Case`;
}
// Helper: Get the rarity color for embeds
function getRarityColor(rarity) {
    const colors = {
        consumer: '#b0c3d9',
        industrial: '#5e98d9',
        'mil-spec': '#4b69ff',
        restricted: '#8847ff',
        classified: '#d32ce6',
        covert: '#eb4b4b'
    };
    return colors[rarity] || '#ffffff';
}

// Helper: Select a random item from case data based on rarity weights
function selectRandomItem(items) {
    // Default weights if none specified
    const DEFAULT_WEIGHTS = {
        consumer: 40,
        industrial: 30,
        'mil-spec': 15,
        restricted: 10,
        classified: 4,
        covert: 1
    };
    
    // Calculate total weight and build cumulative ranges
    let totalWeight = 0;
    const ranges = [];
    
    for (const [rarity, data] of Object.entries(items)) {
        const weight = data.chance || DEFAULT_WEIGHTS[rarity] || 1;
        if (data.items && data.items.length) {
            totalWeight += weight;
            ranges.push({
                rarity,
                items: data.items,
                baseValue: data.baseValue || 10,
                threshold: totalWeight
            });
        }
    }
    
    // Roll for rarity
    const roll = Math.random() * totalWeight;
    const selected = ranges.find(r => roll <= r.threshold);
    if (!selected) return null;
    
    // Pick random item from that rarity
    const item = selected.items[Math.floor(Math.random() * selected.items.length)];
    
    // Generate wear condition and value
    const wears = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];
    const wear = wears[Math.floor(Math.random() * wears.length)];
    
    // Value varies by rarity and has some randomness
    const baseValue = selected.baseValue;
    const variance = 0.3; // ±30%
    const valueMultiplier = 1 + (Math.random() * variance * 2 - variance);
    const value = Math.max(1, Math.floor(baseValue * valueMultiplier));
    
    return {
        ...item,
        id: generateItemId(),
        rarity: selected.rarity,
        wear,
        value,
        obtained: new Date().toISOString()
    };
}

// helper: check if a member is moderator or above
function isModerator(member) {
    if (!member) return false;
    try {
        return member.permissions.has(PermissionsBitField.Flags.ModerateMembers) || member.permissions.has(PermissionsBitField.Flags.ManageGuild) || member.permissions.has(PermissionsBitField.Flags.Administrator);
    } catch (e) {
        return false;
    }
}
// Economy and inventory helpers
const ECON_FILE = path.join(__dirname, 'data', 'economy.json');
const INVENTORY_FILE = path.join(__dirname, 'data', 'inventory.json');

function loadEconomy() { try { if (!fs.existsSync(ECON_FILE)) return {}; return JSON.parse(fs.readFileSync(ECON_FILE, 'utf8') || '{}'); } catch (e) { console.error('Failed to load economy:', e); return {}; } }
function saveEconomy(d) { try { fs.writeFileSync(ECON_FILE, JSON.stringify(d, null, 2)); } catch (e) { console.error('Failed to save economy:', e); } }
function loadInventory() { try { if (!fs.existsSync(INVENTORY_FILE)) return {}; return JSON.parse(fs.readFileSync(INVENTORY_FILE, 'utf8') || '{}'); } catch (e) { console.error('Failed to load inventory:', e); return {}; } }
function saveInventory(d) { try { fs.writeFileSync(INVENTORY_FILE, JSON.stringify(d, null, 2)); } catch (e) { console.error('Failed to save inventory:', e); } }

let economy = loadEconomy();
let inventory = loadInventory();
// simple cooldowns to prevent farming
const lastPlayed = {}; // key: userId, value: timestamp
// Handle slash commands
client.on('interactionCreate', async interaction => {
    // Cute emoticons and phrases for all bot responses
    const cuteEmoticons = [
        '(｡♡‿♡｡)', '(◕‿◕✿)', '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', '(づ｡◕‿‿◕｡)づ',
        '(ﾉ´ヮ`)ﾉ*: ･ﾟ', '(◠‿◠✿)', '╰(◡‿◡✿╰)', '(｡◕‿◕｡)',
        '(◕ᴗ◕✿)', '(｡♥‿♥｡)', '(ﾉ≧∀≦)ﾉ', '(◍•ᴗ•◍)❤'
    ];
    const cutePhrases = [
        'uwu~', 'nya~', 'hehe~', '✧˖°', 'rawr~', 
        '*nuzzles*', '*wiggles*', 'owo~', 'teehee~',
        '*blushes*', '*headpats*', '*purrs*', 'nyaa~'
    ];
    const getRandomCute = (message) => {
        const emoticon = cuteEmoticons[Math.floor(Math.random() * cuteEmoticons.length)];
        const phrase = Math.random() < 0.4 ? ` ${cutePhrases[Math.floor(Math.random() * cutePhrases.length)]}` : '';
        return `${emoticon} ${message}${Math.random() < 0.3 ? ` ${cutePhrases[Math.floor(Math.random() * cutePhrases.length)]}` : ''}`;
    };

    // Custom reply function to add cuteness to all responses
    const cutifyReply = async (options) => {
        if (typeof options === 'string') {
            return interaction.reply(getRandomCute(options));
        }
        if (options.content) {
            options.content = getRandomCute(options.content);
        }
        return interaction.reply(options);
    };

    // /case command
    if (interaction.commandName === 'case') {
        const subcommand = interaction.options.getSubcommand();

        // Initialize inventory for guild/user if needed
        const guildId = interaction.guildId;
        const userId = interaction.user.id;
        if (!inventory[guildId]) inventory[guildId] = {};
        if (!inventory[guildId][userId]) inventory[guildId][userId] = [];
        
        if (subcommand === 'list') {
            // Ensure gifs and gifs.cases are defined before iterating
            if (!gifs || !gifs.cases) {
                console.error('GIFs data or cases are not loaded properly.');
                return cutifyReply({ content: 'Cases data is unavailable.', ephemeral: true });
            }

            // Build an embed per case with item lists (grouped by rarity)
            const RARITY_EMOJI = {
                consumer: '🟢',
                industrial: '🔵',
                'mil-spec': '🔷',
                restricted: '🟣',
                classified: '🟠',
                covert: '🔴'
            };
            const MAX_VISIBLE_PER_RARITY = 6; // how many item names to show before truncating

            const embeds = [];
            for (const [id, caseData] of Object.entries(gifs.cases)) {
                const e = new EmbedBuilder()
                    .setTitle(caseData.display || id)
                    .setColor('#FF69B4')
                    .setFooter({ text: `Page ${embeds.length + 1} / ${Object.keys(gifs.cases).length}` });

                // Intentionally not setting an image here. User requested text-only case list.

                // For each rarity, add as a field with item names (truncate long lists)
                for (const [rarity, rarData] of Object.entries(caseData.items || {})) {
                    const rawNames = (rarData.items || []).map(it => `• ${it.name}`);
                    const visible = rawNames.slice(0, MAX_VISIBLE_PER_RARITY);
                    const remainder = Math.max(0, rawNames.length - visible.length);
                    let namesText = visible.join('\n') || '—';
                    if (remainder > 0) namesText += `\n… and ${remainder} more`;
                    const chance = rarData.chance != null ? ` (${rarData.chance}%)` : '';
                    const emoji = RARITY_EMOJI[rarity] || '';
                    // Capitalize rarity for display
                    const pretty = rarity.replace(/[-_]/g, ' ').replace(/\b\w/g, s => s.toUpperCase());
                    e.addFields({ name: `${emoji} ${pretty}${chance}`, value: namesText, inline: false });
                }

                embeds.push(e);
            }

            if (!embeds.length) return cutifyReply({ content: 'No cases available.', ephemeral: true });

            // Create navigation buttons like /help and a Details button to show full lists
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('case_first').setLabel('≪').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('case_prev').setLabel('←').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('case_next').setLabel('→').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('case_last').setLabel('≫').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('case_details').setLabel('Details').setStyle(ButtonStyle.Secondary)
                );

            const response = await interaction.reply({ embeds: [embeds[0]], components: [row], ephemeral: true });

            const collector = response.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 300000 });
            let current = 0;
            collector.on('collect', async i => {
                try {
                    if (i.customId === 'case_first') current = 0;
                    else if (i.customId === 'case_prev') current = current > 0 ? current - 1 : embeds.length - 1;
                    else if (i.customId === 'case_next') current = current < embeds.length - 1 ? current + 1 : 0;
                    else if (i.customId === 'case_last') current = embeds.length - 1;
                    else if (i.customId === 'case_details') {
                        // Show a detailed embed with full item lists for the current case
                        const caseEntries = Object.entries(gifs.cases);
                        const [caseId, caseData] = caseEntries[current];
                        const full = new EmbedBuilder()
                            .setTitle(`${caseData.display || caseId} — Full Contents`)
                            .setColor('#FF69B4')
                            .setFooter({ text: `Case: ${caseData.display || caseId}` });
                        for (const [rar, rarData] of Object.entries(caseData.items || {})) {
                            const names = (rarData.items || []).map(it => `• ${it.name}`).join('\n') || '—';
                            const chance = rarData.chance != null ? ` (${rarData.chance}%)` : '';
                            const emoji = RARITY_EMOJI[rar] || '';
                            const pretty = rar.replace(/[-_]/g, ' ').replace(/\b\w/g, s => s.toUpperCase());
                            full.addFields({ name: `${emoji} ${pretty}${chance}`, value: names, inline: false });
                        }
                        await i.reply({ embeds: [full], ephemeral: true }).catch(() => {});
                        return;
                    }
                    // update main paginator view for navigation buttons
                    await i.update({ embeds: [embeds[current]], components: [row] });
                } catch (err) {
                    console.error('Error handling case list button:', err);
                    try { await i.reply({ content: 'An error occurred.', ephemeral: true }); } catch (e) {}
                }
            });
            collector.on('end', () => { interaction.editReply({ components: [] }).catch(() => {}); });
            return;
        }
        
        if (subcommand === 'open') {
            const rawType = interaction.options.getString('type');
            console.log('Attempting to open case, raw type:', rawType);

            // Support either the internal case key or the human display (case-insensitive)
            let caseKey = null;
            if (rawType && gifs.cases && gifs.cases[rawType]) {
                caseKey = rawType;
            } else if (rawType && gifs.cases) {
                const lowered = rawType.toLowerCase();
                for (const [k, v] of Object.entries(gifs.cases)) {
                    if ((v.display && v.display.toLowerCase() === lowered) || k.toLowerCase() === lowered) {
                        caseKey = k;
                        break;
                    }
                }
            }

            if (!caseKey) {
                console.warn('Case open failed: unknown case type provided:', rawType);
                return interaction.reply({ content: `(｡•́︿•̀｡) nyaa~ invalid case type: ${rawType}. use /case list to see available cases uwu`, ephemeral: true });
            }
            const caseData = gifs.cases[caseKey];
            
            // Check if user has enough money
            const userId = interaction.user.id;
            if (!economy[interaction.guildId]) economy[interaction.guildId] = {};
            if (!economy[interaction.guildId][userId]) economy[interaction.guildId][userId] = { balance: 100 };
            
            if (economy[interaction.guildId][userId].balance < caseData.cost) {
                return interaction.reply({ 
                    content: `(＞﹏＜) you need ${caseData.cost} coins to open this case. your balance: ${economy[interaction.guildId][userId].balance} uwu`, 
                    ephemeral: true 
                });
            }
            
            // Deduct cost and save
            economy[interaction.guildId][userId].balance -= caseData.cost;
            saveEconomy(economy);
            
            // Select item
            const item = selectRandomItem(caseData.items);
            
            // Create fancy embed for the result
            const embed = new EmbedBuilder()
                .setTitle(`(｡♡‿♡｡) Case Opening Result - ${caseData.display}`)
                .setColor(getRarityColor(item.rarity))
                .setDescription(
                    `nyaa~ you unboxed:\n\n` +
                    `**${item.name}** (${item.wear}) ✧˖°\n` +
                    `Rarity: ${item.rarity} uwu\n` +
                    `Value: ${item.value} coins :3\n\n` +
                    `New balance: ${economy[interaction.guildId][userId].balance} coins (⑅˘꒳˘)♡`
                );

            try {
                const ok = await isImageReachable(item.gif);
                if (ok) embed.setImage(item.gif);
                else embed.setFooter({ text: 'Image unavailable' });
            } catch (e) {
                embed.setFooter({ text: 'Image check failed' });
            }

            // Add item to inventory
            inventory[interaction.guildId][interaction.user.id].push({
                id: item.id, // Save the generated ID
                name: item.name,
                rarity: item.rarity,
                wear: item.wear,
                value: item.value,
                gif: item.gif,
                obtained: new Date().toISOString()
            });
            saveInventory(inventory);
            
            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'inventory') {
            const userInv = inventory[interaction.guildId][interaction.user.id];
            if (!userInv || !userInv.length) {
                return interaction.reply({ content: 'owo your inventory is empty! open some cases to get items (｡•́︿•̀｡)', ephemeral: true });
            }

            // Add IDs to any items that don't have them
            userInv.forEach(item => {
                if (!item.id) {
                    item.id = generateItemId();
                }
            });

            // Sort by rarity (covert -> consumer)
            const rarityOrder = ['covert', 'classified', 'restricted', 'mil-spec', 'industrial', 'consumer'];
            userInv.sort((a, b) => {
                // First sort by rarity
                const rarityA = a.rarity.toLowerCase();
                const rarityB = b.rarity.toLowerCase();
                const rarityDiff = rarityOrder.indexOf(rarityA) - rarityOrder.indexOf(rarityB);
                if (rarityDiff !== 0) return rarityDiff;
                
                // If same rarity, sort by name
                if (a.name !== b.name) return a.name.localeCompare(b.name);
                
                // If same name, sort by wear
                if (a.wear !== b.wear) return a.wear.localeCompare(b.wear);
                
                // If everything else is the same, sort by ID to prevent merging
                return (a.id || '').localeCompare(b.id || '');
            });

            const embed = new EmbedBuilder()
                .setTitle(`(◕‿◕✿) ${interaction.user.username}'s Inventory`)
                .setColor('#FF69B4')
                .setDescription(userInv.map(item => 
                    `• ${item.name} (${item.wear})\n  ${getRarityColor(item.rarity)}■${getRarityColor(item.rarity)} ${item.rarity} | Value: ${item.value} coins\n  ID: \`${item.id || 'Not available'}\``
                ).join('\n\n'))
                .setFooter({ text: `Total items: ${userInv.length}` });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'stats') {
            const userInv = inventory[interaction.guildId][interaction.user.id] || [];
            
            // Calculate statistics
            const totalOpened = userInv.length;
            const byRarity = {};
            const byWear = {};
            let totalValue = 0;
            
            // Sort items by value for best unboxings
            const sortedByValue = [...userInv].sort((a, b) => b.value - a.value);
            const bestItems = sortedByValue.slice(0, 3);
            
            // Calculate statistics
            for (const item of userInv) {
                byRarity[item.rarity] = (byRarity[item.rarity] || 0) + 1;
                byWear[item.wear] = (byWear[item.wear] || 0) + 1;
                totalValue += item.value;
            }
            
            const embed = new EmbedBuilder()
                .setTitle(`📊 Case Statistics for ${interaction.user.username}`)
                .setColor('#FFD700')
                .addFields(
                    { name: '📦 Total Cases Opened', value: totalOpened.toString(), inline: true },
                    { name: '💰 Total Inventory Value', value: `${totalValue} coins`, inline: true },
                    { name: '🌟 Best Unboxings', value: bestItems.length ? 
                        bestItems.map((item, i) => 
                            `${i + 1}. ${item.name} (${item.wear}) - ${item.value} coins`
                        ).join('\n') : 'No items yet', inline: false },
                    { name: '📊 Rarity Breakdown', value: Object.entries(byRarity)
                        .map(([rarity, count]) => 
                            `${rarity}: ${count} (${Math.round(count/totalOpened*100)}%)`
                        ).join('\n') || 'No items yet', inline: true },
                    { name: '🔧 Wear Conditions', value: Object.entries(byWear)
                        .map(([wear, count]) => 
                            `${wear}: ${count} (${Math.round(count/totalOpened*100)}%)`
                        ).join('\n') || 'No items yet', inline: true }
                )
                .setFooter({ text: 'Stats are updated in real-time as you open cases' });
            
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
            
        if (subcommand === 'leaderboard') {
            const page = interaction.options.getInteger('page') || 1;
            const perPage = 10;
            
            // Calculate total value for each user across all servers
            const userTotals = new Map(); // userId -> {total, username}
            
            // Process all guilds and users
            for (const [guildId, guildData] of Object.entries(inventory)) {
                for (const [userId, userItems] of Object.entries(guildData)) {
                    try {
                        // Get user data if we haven't seen them before
                        if (!userTotals.has(userId)) {
                            const user = await client.users.fetch(userId).catch(() => null);
                            userTotals.set(userId, {
                                username: user ? user.username : 'Unknown User',
                                total: 0,
                                itemCount: 0
                            });
                        }
                        
                        const userData = userTotals.get(userId);
                        
                        // Add up inventory value
                        for (const item of userItems) {
                            userData.total += item.value;
                            userData.itemCount++;
                        }
                        
                        // Add balance if it exists
                        if (economy[guildId]?.[userId]?.balance) {
                            userData.total += economy[guildId][userId].balance;
                        }
                    } catch (error) {
                        console.error(`Error processing user ${userId}:`, error);
                    }
                }
            }
            
            // Convert to array and sort by total value
            const sortedUsers = Array.from(userTotals.entries())
                .map(([id, data]) => ({
                    id,
                    ...data
                }))
                .sort((a, b) => b.total - a.total);
            
            const maxPages = Math.ceil(sortedUsers.length / perPage);
            const validPage = Math.max(1, Math.min(page, maxPages));
            const startIdx = (validPage - 1) * perPage;
            const pageUsers = sortedUsers.slice(startIdx, startIdx + perPage);
            
            const embed = new EmbedBuilder()
                .setTitle('🏆 Global Wealth Leaderboard')
                .setColor('#FFD700')
                .setDescription(
                    pageUsers.map((user, idx) => {
                        const position = startIdx + idx + 1;
                        const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏅';
                        return `${medal} **#${position}** ${user.username}\n` +
                               `   💰 Total Value: ${user.total} coins\n` +
                               `   🎒 Items: ${user.itemCount}`;
                    }).join('\n\n')
                )
                .setFooter({ text: `Page ${validPage}/${maxPages} | Total Users: ${sortedUsers.length}` });
            
            // Add navigation buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('lb_first')
                        .setLabel('≪')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(validPage === 1),
                    new ButtonBuilder()
                        .setCustomId('lb_prev')
                        .setLabel('←')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(validPage === 1),
                    new ButtonBuilder()
                        .setCustomId('lb_next')
                        .setLabel('→')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(validPage === maxPages),
                    new ButtonBuilder()
                        .setCustomId('lb_last')
                        .setLabel('≫')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(validPage === maxPages)
                );
            
            const response = await interaction.reply({
                embeds: [embed],
                components: [row]
            });
            
            // Handle navigation
            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 300000
            });
            
            collector.on('collect', async i => {
                const newPage = 
                    i.customId === 'lb_first' ? 1 :
                    i.customId === 'lb_last' ? maxPages :
                    i.customId === 'lb_prev' ? validPage - 1 :
                    i.customId === 'lb_next' ? validPage + 1 :
                    validPage;
                
                // Update the embed with new page
                const newStartIdx = (newPage - 1) * perPage;
                const newPageUsers = sortedUsers.slice(newStartIdx, newStartIdx + perPage);
                
                const newEmbed = new EmbedBuilder()
                    .setTitle('🏆 Global Wealth Leaderboard')
                    .setColor('#FFD700')
                    .setDescription(
                        newPageUsers.map((user, idx) => {
                            const position = newStartIdx + idx + 1;
                            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏅';
                            return `${medal} **#${position}** ${user.username}\n` +
                                   `   💰 Total Value: ${user.total} coins\n` +
                                   `   🎒 Items: ${user.itemCount}`;
                        }).join('\n\n')
                    )
                    .setFooter({ text: `Page ${newPage}/${maxPages} | Total Users: ${sortedUsers.length}` });
                
                // Update navigation buttons
                const newRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('lb_first')
                            .setLabel('≪')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage === 1),
                        new ButtonBuilder()
                            .setCustomId('lb_prev')
                            .setLabel('←')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(newPage === 1),
                        new ButtonBuilder()
                            .setCustomId('lb_next')
                            .setLabel('→')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(newPage === maxPages),
                        new ButtonBuilder()
                            .setCustomId('lb_last')
                            .setLabel('≫')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(newPage === maxPages)
                    );
                
                await i.update({
                    embeds: [newEmbed],
                    components: [newRow]
                });
            });
            
            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => {});
            });
            
            return;
        }

        if (subcommand === 'sell') {
            const itemId = interaction.options.getString('id');
            const userInv = inventory[interaction.guildId][interaction.user.id];
            
            // Find item by ID
            const itemIndex = userInv.findIndex(i => i.id === itemId);
            
            if (itemIndex === -1) {
                return interaction.reply({ 
                    content: `Item "${itemId}" not found in your inventory. Use /case inventory to see your items.`,
                    ephemeral: true 
                });
            }

            const item = userInv[itemIndex];
            
            // Remove from inventory and add value to balance
            userInv.splice(itemIndex, 1);
            if (!economy[interaction.guildId]) economy[interaction.guildId] = {};
            if (!economy[interaction.guildId][interaction.user.id]) economy[interaction.guildId][interaction.user.id] = { balance: 0 };
            economy[interaction.guildId][interaction.user.id].balance += item.value;
            
            // Save both
            saveInventory(inventory);
            saveEconomy(economy);
            
            const embed = new EmbedBuilder()
                .setTitle('(づ｡◕‿‿◕｡)づ Item Sold')
                .setColor(getRarityColor(item.rarity))
                .setDescription(
                    `Sold ${item.name} (${item.wear})\n` +
                    `Value: ${item.value} coins\n\n` +
                    `New balance: ${economy[interaction.guildId][interaction.user.id].balance} coins`
                );

            return interaction.reply({ embeds: [embed] });
        }
    }

    // /gaytest command
    if (interaction.commandName === 'gaytest') {
        const user = interaction.options.getUser('user');
        const percent = Math.floor(Math.random() * 101);
        let comment = 'Not much to see here.';

        if (percent > 90) comment = 'That is about as gay as it gets.';
        else if (percent > 70) comment = 'Pretty gay, honestly.';
        else if (percent > 40) comment = 'You have got some gay energy.';
        else if (percent > 20) comment = 'A little bit, maybe.';

        // Cute emoticons and phrases for randomization
        const cuteEmoticons = [
            '(｡♡‿♡｡)', '(◕‿◕✿)', '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧', '(づ｡◕‿‿◕｡)づ',
            '(ﾉ´ヮ`)ﾉ*: ･ﾟ', '(◠‿◠✿)', '╰(◡‿◡✿╰)', '(｡◕‿◕｡)'
        ];
        const cutePhrases = [
            'uwu~', 'nya~', 'hehe~', '✧˖°', 'rawr~', 
            '*nuzzles*', '*wiggles*', 'owo~', 'teehee~'
        ];
        const getRandomCute = () => {
            const emoticon = cuteEmoticons[Math.floor(Math.random() * cuteEmoticons.length)];
            const phrase = cutePhrases[Math.floor(Math.random() * cutePhrases.length)];
            return `${emoticon} ${Math.random() < 0.5 ? phrase + ' ' : ''}`;
        };

        const context = `${user.tag} is ${percent}% gay. ${comment}`;
        // Optional AI-flavored reply
        if (typeof generateOpenAIReply === 'function' && Math.random() < 0.5) {
            try {
                const ai = await generateOpenAIReply('gaytest', context);
                if (ai) {
                    return cutifyReply({ 
                        content: `${user} is ${percent}% gay~ ${ai}`, 
                        allowedMentions: { users: [user.id] } 
                    });
                }
            } catch (e) {
                // ignore AI errors and fall back to normal reply with cute emoticon
                console.error('(｡•́︿•̀｡) AI response error:', e);
            }
        }

        return interaction.reply({ content: `${user} is ${percent}% gay. ${comment}`, allowedMentions: { users: [user.id] } });
    }
    // /owoify command
    if (interaction.commandName === 'owoify') {
        const text = interaction.options.getString('text');
        // Simple OwOify logic
        let owo = text.replace(/[lr]/g, 'w').replace(/[LR]/g, 'W').replace(/n([aeiou])/g, 'ny$1').replace(/N([aeiou])/g, 'Ny$1');
        owo += ' owo';
        return interaction.reply(owo);
    }

    // Reaction commands
    const handleReactionCommand = async (interaction, type, customText) => {
        const user = interaction.options.getUser('user');
        const list = (gifs[type] && gifs[type].length) ? gifs[type] : [];
        const pick = list.length ? list[Math.floor(Math.random() * list.length)] : null;
        const text = customText(interaction.user, user);
        
        if (pick) {
            const ok = await isImageReachable(pick);
            if (ok) {
                return interaction.reply({ 
                    content: text, 
                    files: [pick],
                    allowedMentions: { users: [interaction.user.id, user.id] }
                });
            }
            return interaction.reply({ 
                content: `${text} (image unavailable)`,
                allowedMentions: { users: [interaction.user.id, user.id] }
            });
        }
        return interaction.reply({ 
            content: text,
            allowedMentions: { users: [interaction.user.id, user.id] }
        });
    };

    // /hug command
    if (interaction.commandName === 'hug') {
        await handleReactionCommand(
            interaction,
            'hug',
            (sender, target) => `${sender} hugs ${target}`
        );
    }

    // /pat command
    if (interaction.commandName === 'pat') {
        await handleReactionCommand(
            interaction,
            'pat',
            (sender, target) => `${sender} pats ${target}`
        );
    }

    // /kiss command
    if (interaction.commandName === 'kiss') {
        await handleReactionCommand(
            interaction,
            'kiss',
            (sender, target) => `${sender} kisses ${target}`
        );
    }

    // /cuddle command
    if (interaction.commandName === 'cuddle') {
        await handleReactionCommand(
            interaction,
            'cuddle',
            (sender, target) => `${sender} cuddles with ${target}`
        );
    }

    // /poke command
    if (interaction.commandName === 'poke') {
        await handleReactionCommand(
            interaction,
            'poke',
            (sender, target) => `${sender} pokes ${target}`
        );
    }

    // /wave command
    if (interaction.commandName === 'wave') {
        await handleReactionCommand(
            interaction,
            'wave',
            (sender, target) => `${sender} waves at ${target}`
        );
    }

    // /highfive command
    if (interaction.commandName === 'highfive') {
        await handleReactionCommand(
            interaction,
            'highfive',
            (sender, target) => `${sender} high-fives ${target}`
        );
    }

    // /slap command
    if (interaction.commandName === 'slap') {
        const user = interaction.options.getUser('user');
        const list = (gifs.slap && gifs.slap.length) ? gifs.slap : [];
        const pick = list.length ? list[Math.floor(Math.random() * list.length)] : null;
        const text = `${interaction.user} slaps ${user}`;
        if (pick) {
            const ok = await isImageReachable(pick);
            if (ok) return interaction.reply({ content: text, allowedMentions: { users: [interaction.user.id, user.id] }, files: [pick] });
            return interaction.reply({ content: `${text} (image unavailable)`, allowedMentions: { users: [interaction.user.id, user.id] } });
        }
        return interaction.reply({ content: text, allowedMentions: { users: [interaction.user.id, user.id] } });
    }

    // /ship command
    if (interaction.commandName === 'ship') {
        const user1 = interaction.options.getUser('user1');
        const user2 = interaction.options.getUser('user2');
        const percent = Math.floor(Math.random() * 101);
        let comment = '💔 Not a match!';
        if (percent > 80) comment = '💖 True love!';
        else if (percent > 50) comment = '💕 Cute couple!';
        else if (percent > 30) comment = '💛 Maybe friends!';
        const context = `Shipping ${user1.tag} + ${user2.tag}: ${percent}% match. ${comment}`;
        // pick gif by percent range
        const ranges = gifs.ship || {};
        let rangeKey = Object.keys(ranges).find(k => {
            const [lo, hi] = k.split('-').map(s => parseInt(s, 10));
            return percent >= lo && percent <= hi;
        });
        let pick = null;
        if (rangeKey) {
            const arr = ranges[rangeKey];
            if (arr && arr.length) pick = arr[Math.floor(Math.random() * arr.length)];
        }
        const text = `shipping ${user1} + ${user2}: **${percent}%** match! ${comment}`;
        if (pick) {
            const ok = await isImageReachable(pick);
            if (ok) return interaction.reply({ content: text, allowedMentions: { users: [user1.id, user2.id] }, files: [pick] });
            return interaction.reply({ content: `${text} (image unavailable)`, allowedMentions: { users: [user1.id, user2.id] } });
        }
        return interaction.reply({ content: text, allowedMentions: { users: [user1.id, user2.id] } });
    }

    // /meme command: random curated meme gif
    if (interaction.commandName === 'meme') {
        const list = (gifs.meme && gifs.meme.length) ? gifs.meme : [];
        const pick = list.length ? list[Math.floor(Math.random() * list.length)] : null;
        if (pick) {
            const ok = await isImageReachable(pick);
            if (ok) return interaction.reply({ files: [pick] });
            return interaction.reply('no memes found (image unavailable).');
        }
        return interaction.reply('no memes found right now.');
    }

    // /cat command
    if (interaction.commandName === 'cat') {
        // Use a public cat API
        try {
            const res = await fetch('https://api.thecatapi.com/v1/images/search');
            const data = await res.json();
            return interaction.reply({ files: [data[0].url] });
        } catch {
            return interaction.reply('Could not fetch a cat image.');
        }
    }

    // /dog command
    if (interaction.commandName === 'dog') {
        try {
            const res = await fetch('https://dog.ceo/api/breeds/image/random');
            const data = await res.json();
            return interaction.reply({ files: [data.message] });
        } catch {
            return interaction.reply('Could not fetch a dog image.');
        }
    }

    // /roll command
    if (interaction.commandName === 'roll') {
        const sides = interaction.options.getInteger('sides');
        if (sides < 2 || sides > 1000) return interaction.reply('Please choose between 2 and 1000 sides.');
        const roll = Math.floor(Math.random() * sides) + 1;
        return interaction.reply(`🎲 You rolled a **${roll}** (1-${sides})!`);
    }
    // /kick command
    if (interaction.commandName === 'kick') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return interaction.reply({ content: 'You do not have permission to kick members.', ephemeral: true });
        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
        try {
            await member.kick('Kicked by bot');
            await interaction.reply(`${user.tag} has been kicked.`);
        } catch (err) {
            await interaction.reply({ content: 'Failed to kick user.', ephemeral: true });
        }
        return;
    }

    // /timeout command
    if (interaction.commandName === 'timeout') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return interaction.reply({ content: 'You do not have permission to timeout members.', ephemeral: true });
        const user = interaction.options.getUser('user');
        const minutes = interaction.options.getInteger('minutes');
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
        try {
            await member.timeout(minutes * 60 * 1000, `Timed out by bot for ${minutes} minutes`);
            await interaction.reply(`${user.tag} has been timed out for ${minutes} minutes.`);
        } catch (err) {
            await interaction.reply({ content: 'Failed to timeout user.', ephemeral: true });
        }
        return;
    }

    // /purge command
    if (interaction.commandName === 'purge') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return interaction.reply({ content: 'You do not have permission to purge messages.', ephemeral: true });
        const count = interaction.options.getInteger('count');
        if (count < 1 || count > 100) return interaction.reply({ content: 'You can only delete between 1 and 100 messages.', ephemeral: true });
        try {
            await interaction.channel.bulkDelete(count, true);
            await interaction.reply({ content: `Deleted ${count} messages.`, ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: 'Failed to delete messages.', ephemeral: true });
        }
        return;
    }

    // /lock command
    if (interaction.commandName === 'lock') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.reply({ content: 'You do not have permission to lock channels.', ephemeral: true });
        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
            await interaction.reply('🔒 Channel locked.');
        } catch (err) {
            await interaction.reply({ content: 'Failed to lock channel.', ephemeral: true });
        }
        return;
    }

    // /unlock command
    if (interaction.commandName === 'unlock') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) return interaction.reply({ content: 'You do not have permission to unlock channels.', ephemeral: true });
        try {
            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
            await interaction.reply('🔓 Channel unlocked.');
        } catch (err) {
            await interaction.reply({ content: 'Failed to unlock channel.', ephemeral: true });
        }
        return;
    }
    // /dice command
    if (interaction.commandName === 'dice') {
        const roll = Math.floor(Math.random() * 6) + 1;
        return interaction.reply(`🎲 You rolled a **${roll}**!`);
    }

    // /roulette command - casino game
    if (interaction.commandName === 'roulette') {
        const amount = interaction.options.getInteger('amount');
        const betType = interaction.options.getString('bet_type');
        const number = interaction.options.getInteger('number');
        const color = interaction.options.getString('color');
        const parity = interaction.options.getString('parity');

        // Validate user has enough coins
        const userId = interaction.user.id;
        if (!economy[interaction.guildId]) economy[interaction.guildId] = {};
        if (!economy[interaction.guildId][userId]) economy[interaction.guildId][userId] = { balance: 100 };
        const userAccount = economy[interaction.guildId][userId];

        if (userAccount.balance < amount) {
            return interaction.reply({ content: `Insufficient funds. You have ${userAccount.balance} coins.`, ephemeral: true });
        }

        // Validate bet parameters
        if (betType === 'number' && number === null) {
            return interaction.reply({ content: 'You must specify a number for number bets.', ephemeral: true });
        }
        if (betType === 'color' && !color) {
            return interaction.reply({ content: 'You must specify red or black for color bets.', ephemeral: true });
        }
        if (betType === 'parity' && !parity) {
            return interaction.reply({ content: 'You must specify even or odd for parity bets.', ephemeral: true });
        }

        // Define roulette wheel
        const wheel = {
            numbers: [...Array(37).keys()], // 0-36
            colors: {
                red: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
                black: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]
            }
        };

        // Spin the wheel
        const result = Math.floor(Math.random() * 37);
        const resultColor = wheel.colors.red.includes(result) ? 'red' : wheel.colors.black.includes(result) ? 'black' : 'green';
        const resultParity = result === 0 ? 'zero' : result % 2 === 0 ? 'even' : 'odd';

        // Check if bet won
        let won = false;
        let payout = 0;
        if (betType === 'number' && number === result) {
            won = true;
            payout = amount * 35; // 35:1 payout for number bets
        } else if (betType === 'color' && color === resultColor) {
            won = true;
            payout = amount * 2; // 2:1 payout for color bets
        } else if (betType === 'parity' && parity === resultParity) {
            won = true;
            payout = amount * 2; // 2:1 payout for parity bets
        }

        // Update balance
        if (won) {
            userAccount.balance += payout - amount;
        } else {
            userAccount.balance -= amount;
        }
        saveEconomy(economy);

        // Create result embed
        const embed = new EmbedBuilder()
            .setTitle('� Roulette Result')
            .setColor(resultColor === 'red' ? '#FF0000' : resultColor === 'black' ? '#000000' : '#00FF00')
            .setDescription(
                `The ball landed on: **${result}** (${resultColor}, ${resultParity})\n\n` +
                `Your bet: ${amount} coins on ${betType === 'number' ? `number ${number}` : betType === 'color' ? color : parity}\n\n` +
                (won ? `🎉 You won ${payout} coins!` : `❌ You lost ${amount} coins.`) +
                `\n\nNew balance: ${userAccount.balance} coins`
            );

        // Add roulette wheel ASCII art
        const wheelArt = 
            "  ┌─────────────┐\n" +
            `  │   ${result.toString().padStart(2, '0')}  ${resultColor[0].toUpperCase()}   │\n` +
            "  └─────────────┘";
        
        embed.addFields({ name: 'Roulette Wheel', value: `\`\`\`\n${wheelArt}\n\`\`\``, inline: false });

        return interaction.reply({ embeds: [embed] });
    }

    // /guess command
    if (interaction.commandName === 'guess') {
        const userGuess = interaction.options.getInteger('number');
        const answer = Math.floor(Math.random() * 10) + 1;
        if (userGuess === answer) {
            return interaction.reply(`🎉 Correct! The number was **${answer}**.`);
        } else {
            return interaction.reply(`❌ Wrong! The number was **${answer}**.`);
        }
    }

    // /slots command - Enhanced slot machine with multiple paylines and special features
    if (interaction.commandName === 'slots') {
        // economy cost
        const userId = interaction.user.id;
        const cost = 10; // base cost to play
        if (!economy[interaction.guildId]) economy[interaction.guildId] = {};
        if (!economy[interaction.guildId][userId]) economy[interaction.guildId][userId] = { balance: 100 };
        const userAcct = economy[interaction.guildId][userId];
        const now = Date.now();
        if (lastPlayed[userId] && now - lastPlayed[userId] < 5000) return interaction.reply({ content: 'Please wait a few seconds between plays.', ephemeral: true });
        if (userAcct.balance < cost) return interaction.reply({ content: `You need ${cost} coins to play. Your balance: ${userAcct.balance}`, ephemeral: true });
        
        // Slot configuration
        const slotItems = {
            '7️⃣': { weight: 1, payout: 50 },    // Highest payout
            '⭐': { weight: 2, payout: 25 },     // High payout
            '🎰': { weight: 3, payout: 15 },     // Medium-high payout
            '🍒': { weight: 4, payout: 10 },     // Medium payout
            '🍊': { weight: 5, payout: 8 },      // Medium-low payout
            '�': { weight: 6, payout: 5 },      // Low payout
            '🍉': { weight: 7, payout: 3 }       // Lowest payout
        };

        // Generate weighted random item
        const getRandomItem = () => {
            const weights = Object.values(slotItems).map(item => item.weight);
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            let random = Math.random() * totalWeight;
            
            for (const [symbol, data] of Object.entries(slotItems)) {
                random -= data.weight;
                if (random <= 0) return symbol;
            }
            return Object.keys(slotItems)[0];
        };

        // Generate 3x3 grid for multiple paylines
        const grid = Array(3).fill().map(() => 
            Array(3).fill().map(() => getRandomItem())
        );

        // Check paylines
        const paylines = [
            [[0,0], [0,1], [0,2]], // Top row
            [[1,0], [1,1], [1,2]], // Middle row
            [[2,0], [2,1], [2,2]], // Bottom row
            [[0,0], [1,1], [2,2]], // Diagonal top-left to bottom-right
            [[0,2], [1,1], [2,0]]  // Diagonal top-right to bottom-left
        ];

        let totalWin = 0;
        const winningLines = [];

        paylines.forEach((line, index) => {
            const symbols = line.map(([row, col]) => grid[row][col]);
            if (symbols.every(s => s === symbols[0])) {
                const payout = slotItems[symbols[0]].payout * cost;
                totalWin += payout;
                winningLines.push(`Line ${index + 1}: ${symbols.join(' ')} = ${payout} coins`);
            }
        });

        // Special feature: Random Multiplier (10% chance)
        let multiplier = 1;
        if (Math.random() < 0.1 && totalWin > 0) {
            multiplier = [2, 2, 2, 3, 3, 5][Math.floor(Math.random() * 6)];
            totalWin *= multiplier;
        }

        // Update balance
        userAcct.balance -= cost;
        if (totalWin > 0) {
            userAcct.balance += totalWin;
        }
        saveEconomy(economy);

        // Create fancy display
        const display = grid.map(row => `║ ${row.join(' │ ')} ║`).join('\n');
        const frameTop = '╔═══╤═══╤═══╗';
        const frameBottom = '╚═══╧═══╧═══╝';
        const frameDivider = '╟───┼───┼───╢';

        const embed = new EmbedBuilder()
            .setTitle('🎰 Slot Machine')
            .setColor(totalWin > 0 ? '#FFD700' : '#808080')
            .setDescription(
                '```\n' +
                frameTop + '\n' +
                display.split('\n').join('\n' + frameDivider + '\n') + '\n' +
                frameBottom + '\n```'
            )
            .addFields(
                { name: 'Bet Amount', value: `${cost} coins`, inline: true },
                { name: 'Outcome', value: totalWin > 0 ? '🎉 Winner!' : '❌ No win', inline: true },
                { name: 'Balance', value: `${userAcct.balance} coins`, inline: true }
            );

        if (winningLines.length > 0) {
            embed.addFields({
                name: 'Winning Lines',
                value: winningLines.join('\n')
            });
        }

        if (multiplier > 1) {
            embed.addFields({
                name: '🌟 Lucky Multiplier!',
                value: `All wins multiplied by ${multiplier}x!`
            });
        }

        return interaction.reply({ embeds: [embed] });
    }

    // Trade command
    if (interaction.commandName === 'trade') {
        const target = interaction.options.getUser('user');
        const guildId = interaction.guild.id;
        const amount = interaction.options.getInteger('coins') || 0;
        const itemId = interaction.options.getString('item');

        // Can't trade with yourself
        if (target.id === interaction.user.id) {
            return interaction.reply({ content: 'You cannot trade with yourself!', ephemeral: true });
        }

        // Can't trade with bots
        if (target.bot) {
            return interaction.reply({ content: 'You cannot trade with bots!', ephemeral: true });
        }

        // Initialize economy data
        if (!economy[guildId]) economy[guildId] = {};
        if (!economy[guildId][interaction.user.id]) economy[guildId][interaction.user.id] = { balance: 100 };
        if (!economy[guildId][target.id]) economy[guildId][target.id] = { balance: 100 };

        const sender = economy[guildId][interaction.user.id];
        const receiver = economy[guildId][target.id];

        // Validate coin amount if trading coins
        if (amount > 0) {
            if (sender.balance < amount) {
                return interaction.reply({ content: 'You don\'t have enough coins for this trade!', ephemeral: true });
            }
        }

        // Validate item if trading item
        let tradeItem = null;
        if (itemId) {
            // Load inventory data
            if (!inventory[guildId]) inventory[guildId] = {};
            if (!inventory[guildId][interaction.user.id]) inventory[guildId][interaction.user.id] = [];
            
            const userInv = inventory[guildId][interaction.user.id];
            const itemIndex = userInv.findIndex(i => i.id === itemId);
            
            if (itemIndex === -1) {
                return interaction.reply({ content: 'You don\'t have this item to trade!', ephemeral: true });
            }
            
            tradeItem = userInv[itemIndex];
        }

        // Create trade offer embed
        const embed = new EmbedBuilder()
            .setTitle('🤝 Trade Offer')
            .setColor('#00ff00')
            .setDescription(`${interaction.user} wants to trade with ${target}!`)
            .addFields(
                { name: 'Offering', value: `${amount > 0 ? `${amount} coins` : ''}${amount > 0 && tradeItem ? ' and ' : ''}${tradeItem ? tradeItem.name : ''}`, inline: true }
            );

        // Create accept/decline buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('trade_accept')
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('trade_decline')
                    .setLabel('Decline')
                    .setStyle(ButtonStyle.Danger)
            );

        // Send trade offer
        const response = await interaction.reply({
            content: `${target}`,
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        // Create collector for response
        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === target.id,
            time: 60000, // 1 minute to respond
            max: 1
        });

        collector.on('collect', async i => {
            if (i.customId === 'trade_accept') {
                // Double check balances and inventory
                if (amount > 0 && sender.balance < amount) {
                    return i.update({
                        content: 'Trade failed: Sender no longer has enough coins!',
                        components: []
                    });
                }

                if (tradeItem) {
                    const userInv = inventory[guildId][interaction.user.id];
                    const itemIndex = userInv.findIndex(item => item.id === itemId);
                    if (itemIndex === -1) {
                        return i.update({
                            content: 'Trade failed: Sender no longer has the item!',
                            components: []
                        });
                    }
                }

                // Process trade
                if (amount > 0) {
                    sender.balance -= amount;
                    receiver.balance += amount;
                }

                if (tradeItem) {
                    // Remove item from sender
                    const senderInv = inventory[guildId][interaction.user.id];
                    const itemIndex = senderInv.findIndex(item => item.id === itemId);
                    const [removedItem] = senderInv.splice(itemIndex, 1);

                    // Add item to receiver
                    if (!inventory[guildId][target.id]) inventory[guildId][target.id] = [];
                    inventory[guildId][target.id].push(removedItem);
                }

                // Save changes
                if (amount > 0) saveEconomy(economy);
                if (tradeItem) saveInventory(inventory);

                // Update message
                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Trade Complete!')
                    .setColor('#00ff00')
                    .setDescription('The trade was successful!')
                    .addFields(
                        { name: 'Traded', value: `${amount > 0 ? `${amount} coins` : ''}${amount > 0 && tradeItem ? ' and ' : ''}${tradeItem ? tradeItem.name : ''}`, inline: true }
                    );

                await i.update({
                    embeds: [successEmbed],
                    components: []
                });
            } else {
                // Trade declined
                const declineEmbed = new EmbedBuilder()
                    .setTitle('❌ Trade Declined')
                    .setColor('#ff0000')
                    .setDescription(`${target} declined the trade offer.`);

                await i.update({
                    embeds: [declineEmbed],
                    components: []
                });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Trade Expired')
                    .setColor('#ff0000')
                    .setDescription('The trade offer has expired.');

                interaction.editReply({
                    embeds: [timeoutEmbed],
                    components: []
                });
            }
        });
    }

    // Rob command
    if (interaction.commandName === 'rob') {
        const target = interaction.options.getUser('user');
        const guildId = interaction.guild.id;

        // Cannot rob yourself
        if (target.id === interaction.user.id) {
            return interaction.reply({ content: 'You cannot rob yourself!', ephemeral: true });
        }

        // Cannot rob bots
        if (target.bot) {
            return interaction.reply({ content: 'You cannot rob bots!', ephemeral: true });
        }

        // Initialize economy data
        if (!economy[guildId]) economy[guildId] = {};
        if (!economy[guildId][interaction.user.id]) economy[guildId][interaction.user.id] = { balance: 100 };
        if (!economy[guildId][target.id]) economy[guildId][target.id] = { balance: 100 };

        const robber = economy[guildId][interaction.user.id];
        const victim = economy[guildId][target.id];

        // Check cooldown (1 hour)
        const now = Date.now();
        if (!robber.lastRob) robber.lastRob = 0;
        const cooldown = 60 * 60 * 1000; // 1 hour
        const timeLeft = cooldown - (now - robber.lastRob);

        if (timeLeft > 0) {
            const minutes = Math.ceil(timeLeft / (60 * 1000));
            return interaction.reply({ 
                content: `You need to wait ${minutes} minutes before attempting another robbery!`,
                ephemeral: true 
            });
        }

        // Minimum victim balance required (100 coins)
        if (victim.balance < 100) {
            return interaction.reply({ 
                content: 'This user doesn\'t have enough coins to be worth robbing!',
                ephemeral: true 
            });
        }

        // Minimum robber balance required (50 coins as collateral)
        if (robber.balance < 50) {
            return interaction.reply({ 
                content: 'You need at least 50 coins to attempt a robbery!',
                ephemeral: true 
            });
        }

        // Calculate success chance and potential rewards/penalties
        let successChance = 0.3; // Base 30% chance

        // Factors that affect success chance:
        // 1. Victim's recent activity (if they've been active recently, harder to rob)
        if (victim.lastActive && now - victim.lastActive < 24 * 60 * 60 * 1000) {
            successChance -= 0.1; // -10% if victim was active in last 24h
        }

        // 2. Robber's experience (more successful robberies = higher chance)
        if (!robber.successfulRobs) robber.successfulRobs = 0;
        successChance += Math.min(0.2, robber.successfulRobs * 0.02); // +2% per successful rob, max +20%

        // 3. Victim's defense items (if implemented in inventory system)
        if (victim.hasDefenseItem) {
            successChance -= 0.15; // -15% if victim has defense item
        }

        // Random event: Critical failure (5% chance)
        const criticalFailure = Math.random() < 0.05;
        
        // Attempt robbery
        const success = !criticalFailure && Math.random() < successChance;

        if (success) {
            // Calculate stolen amount (10-30% of victim's balance)
            const maxSteal = Math.floor(victim.balance * 0.3);
            const minSteal = Math.floor(victim.balance * 0.1);
            const stolenAmount = Math.floor(Math.random() * (maxSteal - minSteal + 1)) + minSteal;

            // Transfer coins
            victim.balance -= stolenAmount;
            robber.balance += stolenAmount;
            robber.successfulRobs = (robber.successfulRobs || 0) + 1;

            const embed = new EmbedBuilder()
                .setTitle('🦹 Successful Heist!')
                .setColor('#00ff00')
                .setDescription(`You successfully robbed ${target.username}!`)
                .addFields(
                    { name: 'Stolen Amount', value: `${stolenAmount} coins`, inline: true },
                    { name: 'New Balance', value: `${robber.balance} coins`, inline: true },
                    { name: 'Success Rate', value: `${Math.floor(successChance * 100)}%`, inline: true }
                );

            // DM the victim
            try {
                const victimEmbed = new EmbedBuilder()
                    .setTitle('😱 You\'ve Been Robbed!')
                    .setColor('#ff0000')
                    .setDescription(`${interaction.user.username} stole ${stolenAmount} coins from you!`)
                    .addFields(
                        { name: 'Remaining Balance', value: `${victim.balance} coins`, inline: true },
                        { name: 'Tip', value: 'Buy defense items from the shop to reduce robbery success rates!', inline: false }
                    );
                await target.send({ embeds: [victimEmbed] });
            } catch (err) {
                // Ignore DM errors
            }

            interaction.reply({ embeds: [embed] });
        } else {
            // Failed robbery
            let penalty = 50; // Base penalty
            let failureMessage = 'Your robbery attempt failed!';

            if (criticalFailure) {
                penalty = 100; // Higher penalty for critical failure
                failureMessage = 'CRITICAL FAILURE! You were caught red-handed!';
            }

            // Apply penalty
            robber.balance -= penalty;

            const embed = new EmbedBuilder()
                .setTitle('💥 Failed Robbery!')
                .setColor('#ff0000')
                .setDescription(failureMessage)
                .addFields(
                    { name: 'Penalty', value: `${penalty} coins`, inline: true },
                    { name: 'New Balance', value: `${robber.balance} coins`, inline: true },
                    { name: 'Success Rate', value: `${Math.floor(successChance * 100)}%`, inline: true }
                );

            interaction.reply({ embeds: [embed] });
        }

        // Update cooldown
        robber.lastRob = now;
        saveEconomy(economy);
    }

    // Shop system commands
    if (interaction.commandName === 'shop') {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // Load shop data
        let shopData = {};
        try {
            shopData = JSON.parse(fs.readFileSync('./data/shop.json', 'utf8'));
        } catch (err) {
            shopData = {};
        }

        if (!shopData[guildId]) shopData[guildId] = { items: [] };

        if (subcommand === 'add') {
            // Check if user has permission to add items
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply({ content: 'You need the Manage Server permission to add shop items.', ephemeral: true });
            }

            const name = interaction.options.getString('name');
            const price = interaction.options.getInteger('price');
            const role = interaction.options.getRole('role');
            const description = interaction.options.getString('description') || 'No description provided.';

            // Validate input
            if (price < 0) {
                return interaction.reply({ content: 'Price must be positive.', ephemeral: true });
            }

            // Add item to shop
            const item = {
                id: Date.now().toString(),
                name,
                price,
                roleId: role?.id,
                description,
                addedBy: interaction.user.id,
                addedAt: Date.now()
            };

            shopData[guildId].items.push(item);
            fs.writeFileSync('./data/shop.json', JSON.stringify(shopData, null, 2));

            return interaction.reply(`Added "${name}" to the shop for ${price} coins.`);
        }

        if (subcommand === 'remove') {
            // Check if user has permission to remove items
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                return interaction.reply({ content: 'You need the Manage Server permission to remove shop items.', ephemeral: true });
            }

            const itemId = interaction.options.getString('item');
            const itemIndex = shopData[guildId].items.findIndex(item => item.id === itemId);

            if (itemIndex === -1) {
                return interaction.reply({ content: 'Item not found in the shop.', ephemeral: true });
            }

            const removedItem = shopData[guildId].items.splice(itemIndex, 1)[0];
            fs.writeFileSync('./data/shop.json', JSON.stringify(shopData, null, 2));

            return interaction.reply(`Removed "${removedItem.name}" from the shop.`);
        }

        if (subcommand === 'list') {
            const items = shopData[guildId].items;
            if (items.length === 0) {
                return interaction.reply('The shop is currently empty.');
            }

            const itemsPerPage = 5;
            const pages = Math.ceil(items.length / itemsPerPage);
            const currentPage = interaction.options.getInteger('page') || 1;
            
            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageItems = items.slice(start, end);

            const embed = new EmbedBuilder()
                .setTitle('🛍️ Server Shop')
                .setColor('#00ff00')
                .setDescription('Use `/buy item:<item_id>` to purchase items.');

            pageItems.forEach(item => {
                const role = item.roleId ? interaction.guild.roles.cache.get(item.roleId) : null;
                embed.addFields({
                    name: `${item.name} (${item.price} coins)`,
                    value: `ID: ${item.id}\n${item.description}\n${role ? `Role: @${role.name}` : ''}`,
                    inline: false
                });
            });

            embed.setFooter({ text: `Page ${currentPage}/${pages}` });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('shop_prev')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === 1),
                    new ButtonBuilder()
                        .setCustomId('shop_next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === pages)
                );

            const response = await interaction.reply({
                embeds: [embed],
                components: [row],
                fetchReply: true
            });

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 300000
            });

            collector.on('collect', async i => {
                const newPage = i.customId === 'shop_next' ? currentPage + 1 : currentPage - 1;
                const newStart = (newPage - 1) * itemsPerPage;
                const newEnd = newStart + itemsPerPage;
                const newPageItems = items.slice(newStart, newEnd);

                const newEmbed = EmbedBuilder.from(embed)
                    .setFields([])
                    .setFooter({ text: `Page ${newPage}/${pages}` });

                newPageItems.forEach(item => {
                    const role = item.roleId ? interaction.guild.roles.cache.get(item.roleId) : null;
                    newEmbed.addFields({
                        name: `${item.name} (${item.price} coins)`,
                        value: `ID: ${item.id}\n${item.description}\n${role ? `Role: @${role.name}` : ''}`,
                        inline: false
                    });
                });

                const newRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('shop_prev')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(newPage === 1),
                        new ButtonBuilder()
                            .setCustomId('shop_next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(newPage === pages)
                    );

                await i.update({
                    embeds: [newEmbed],
                    components: [newRow]
                });
            });

            collector.on('end', () => {
                const disabledRow = ActionRowBuilder.from(row).setComponents(
                    row.components.map(c => ButtonBuilder.from(c).setDisabled(true))
                );
                interaction.editReply({ components: [disabledRow] }).catch(console.error);
            });
        }
    }

    if (interaction.commandName === 'buy') {
        const itemId = interaction.options.getString('item');
        const guildId = interaction.guild.id;

        // Load shop data
        let shopData = {};
        try {
            shopData = JSON.parse(fs.readFileSync('./data/shop.json', 'utf8'));
        } catch (err) {
            return interaction.reply({ content: 'Shop system is currently unavailable.', ephemeral: true });
        }

        if (!shopData[guildId] || !shopData[guildId].items) {
            return interaction.reply({ content: 'No items are available in the shop.', ephemeral: true });
        }

        const item = shopData[guildId].items.find(i => i.id === itemId);
        if (!item) {
            return interaction.reply({ content: 'Item not found in the shop.', ephemeral: true });
        }

        // Check if user has enough coins
        if (!economy[guildId]) economy[guildId] = {};
        if (!economy[guildId][interaction.user.id]) economy[guildId][interaction.user.id] = { balance: 100 };
        const userAccount = economy[guildId][interaction.user.id];

        if (userAccount.balance < item.price) {
            return interaction.reply({ 
                content: `You don't have enough coins. The item costs ${item.price} coins, but you only have ${userAccount.balance} coins.`,
                ephemeral: true 
            });
        }

        // Process purchase
        try {
            // If item grants a role
            if (item.roleId) {
                const role = interaction.guild.roles.cache.get(item.roleId);
                if (!role) {
                    return interaction.reply({ content: 'The role associated with this item no longer exists.', ephemeral: true });
                }

                // Check if bot has permission to assign the role
                const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
                if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    return interaction.reply({ content: 'I don\'t have permission to assign roles.', ephemeral: true });
                }

                // Check if the bot's highest role is above the role to assign
                if (botMember.roles.highest.position <= role.position) {
                    return interaction.reply({ content: 'I can\'t assign a role that is higher than or equal to my highest role.', ephemeral: true });
                }

                // Assign the role
                const member = await interaction.guild.members.fetch(interaction.user.id);
                await member.roles.add(role);
            }

            // Deduct coins
            userAccount.balance -= item.price;
            saveEconomy(economy);

            // Create purchase receipt
            const embed = new EmbedBuilder()
                .setTitle('🛍️ Purchase Successful')
                .setColor('#00ff00')
                .setDescription(`You bought ${item.name} for ${item.price} coins!`)
                .addFields(
                    { name: 'Remaining Balance', value: `${userAccount.balance} coins`, inline: true }
                );

            if (item.roleId) {
                const role = interaction.guild.roles.cache.get(item.roleId);
                if (role) {
                    embed.addFields({ name: 'Role Granted', value: role.name, inline: true });
                }
            }

            return interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Purchase error:', error);
            return interaction.reply({ 
                content: 'An error occurred while processing your purchase. Your coins have not been deducted.',
                ephemeral: true 
            });
        }
    }

    // Basic utility commands
    if (interaction.commandName === 'ping') {
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
        const wsHeartbeat = interaction.client.ws.ping;
        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .setColor('#00ff00')
            .addFields(
                { name: 'Roundtrip', value: `${roundtrip}ms`, inline: true },
                { name: 'Websocket', value: `${wsHeartbeat}ms`, inline: true }
            );
        await interaction.editReply({ content: null, embeds: [embed] });
    }

    if (interaction.commandName === 'avatar') {
        const user = interaction.options.getUser('user') || interaction.user;
        const embed = new EmbedBuilder()
            .setTitle(`${user.username}'s Avatar`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }))
            .setColor('#ff69b4');
        await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'userinfo') {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(user.id);
        const embed = new EmbedBuilder()
            .setTitle('User Information')
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setColor('#ff69b4')
            .addFields(
                { name: 'Username', value: user.username, inline: true },
                { name: 'Discriminator', value: user.discriminator, inline: true },
                { name: 'ID', value: user.id, inline: true },
                { name: 'Joined Server', value: member.joinedAt.toLocaleDateString(), inline: true },
                { name: 'Account Created', value: user.createdAt.toLocaleDateString(), inline: true },
                { name: 'Roles', value: member.roles.cache.map(r => r.name).join(', ') || 'None' }
            );
        await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === 'serverinfo') {
        const guild = interaction.guild;
        const totalMembers = guild.memberCount;
        const embed = new EmbedBuilder()
            .setTitle('Server Information')
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setColor('#ff69b4')
            .addFields(
                { name: 'Server Name', value: guild.name, inline: true },
                { name: 'Server ID', value: guild.id, inline: true },
                { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: 'Members', value: totalMembers.toString(), inline: true },
                { name: 'Created On', value: guild.createdAt.toLocaleDateString(), inline: true },
                { name: 'Boost Level', value: `Level ${guild.premiumTier}`, inline: true },
                { name: 'Boost Count', value: `${guild.premiumSubscriptionCount || 0} boosts`, inline: true }
            );
        await interaction.reply({ embeds: [embed] });
    }

    // /work command
    if (interaction.commandName === 'work') {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // Initialize economy and work tracking
        if (!economy[guildId]) economy[guildId] = {};
        if (!economy[guildId][userId]) {
            economy[guildId][userId] = { 
                balance: 100, 
                lastWork: 0,
                workExperience: 0 // Track total work sessions
            };
        }
        const userAccount = economy[guildId][userId];

        // Check cooldown (30 minutes)
        const now = Date.now();
        const lastWork = userAccount.lastWork || 0;
        const cooldown = 30 * 60 * 1000; // 30 minutes
        const timeLeft = cooldown - (now - lastWork);

        if (timeLeft > 0) {
            const minutes = Math.ceil(timeLeft / (60 * 1000));
            return interaction.reply({ 
                content: `You need to rest! Try working again in ${minutes} minutes.`,
                ephemeral: true 
            });
        }

        // Define jobs with varying difficulty and rewards
        const jobs = [
            { name: 'Delivery Driver', reward: [50, 100], difficulty: 'easy' },
            { name: 'Office Assistant', reward: [70, 120], difficulty: 'easy' },
            { name: 'Street Performer', reward: [60, 150], difficulty: 'medium' },
            { name: 'Freelance Artist', reward: [80, 200], difficulty: 'medium' },
            { name: 'Stock Trader', reward: [0, 300], difficulty: 'hard' },
            { name: 'Crypto Miner', reward: [-100, 400], difficulty: 'hard' }
        ];

        // Select random job
        const job = jobs[Math.floor(Math.random() * jobs.length)];
        
        // Calculate reward based on job difficulty and user's experience
        const experienceBonus = Math.floor(userAccount.workExperience / 10) * 5; // +5 coins per 10 work sessions
        const baseReward = Math.floor(
            job.reward[0] + Math.random() * (job.reward[1] - job.reward[0])
        );
        const totalReward = baseReward + experienceBonus;

        // Update user's account
        userAccount.balance += totalReward;
        userAccount.lastWork = now;
        userAccount.workExperience = (userAccount.workExperience || 0) + 1;
        saveEconomy(economy);

        // Create response embed
        const embed = new EmbedBuilder()
            .setTitle('💼 Work Results')
            .setColor(totalReward >= 0 ? '#00ff00' : '#ff0000')
            .setDescription(`You worked as a ${job.name}!`)
            .addFields(
                { name: 'Base Earnings', value: `${baseReward} coins`, inline: true },
                { name: 'Experience Bonus', value: `${experienceBonus} coins`, inline: true },
                { name: 'Total Earned', value: `${totalReward} coins`, inline: true },
                { name: 'New Balance', value: `${userAccount.balance} coins`, inline: true },
                { name: 'Work Experience', value: `${userAccount.workExperience} shifts completed`, inline: true }
            );

        // Add flavor text based on the outcome
        if (totalReward >= 200) {
            embed.setFooter({ text: '📈 An exceptional day at work!' });
        } else if (totalReward >= 100) {
            embed.setFooter({ text: '👍 A good day\'s work!' });
        } else if (totalReward >= 0) {
            embed.setFooter({ text: '😊 Honest work for honest pay.' });
        } else {
            embed.setFooter({ text: '📉 Better luck next time!' });
        }

        return interaction.reply({ embeds: [embed] });
    }

    // /daily command
    if (interaction.commandName === 'daily') {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        
        // Initialize economy and daily tracking
        if (!economy[guildId]) economy[guildId] = {};
        if (!economy[guildId][userId]) economy[guildId][userId] = { balance: 100, lastDaily: 0, dailyStreak: 0 };
        const userAccount = economy[guildId][userId];

        const now = Date.now();
        const lastDaily = userAccount.lastDaily || 0;
        const oneDay = 24 * 60 * 60 * 1000;
        const timeSinceLastDaily = now - lastDaily;

        // Check if enough time has passed
        if (timeSinceLastDaily < oneDay) {
            const timeLeft = oneDay - timeSinceLastDaily;
            const hours = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            return interaction.reply({ 
                content: `You've already claimed your daily reward! Try again in ${hours}h ${minutes}m`,
                ephemeral: true 
            });
        }

        // Calculate streak
        if (timeSinceLastDaily <= 2 * oneDay) {
            userAccount.dailyStreak = (userAccount.dailyStreak || 0) + 1;
        } else {
            userAccount.dailyStreak = 1;
        }

        // Calculate rewards
        let baseReward = 100;
        let streakBonus = Math.floor(baseReward * (userAccount.dailyStreak * 0.1)); // 10% bonus per streak day
        let totalReward = baseReward + streakBonus;

        // Apply special bonuses
        if (userAccount.dailyStreak % 7 === 0) { // Weekly bonus
            totalReward += 500;
        }
        if (userAccount.dailyStreak % 30 === 0) { // Monthly bonus
            totalReward += 2000;
        }

        // Update user's balance and timestamp
        userAccount.balance += totalReward;
        userAccount.lastDaily = now;
        saveEconomy(economy);

        // Create response embed
        const embed = new EmbedBuilder()
            .setTitle('💰 Daily Reward')
            .setColor('#FFD700')
            .setDescription(`Here's your daily reward, ${interaction.user}!`)
            .addFields(
                { name: 'Base Reward', value: `${baseReward} coins`, inline: true },
                { name: 'Streak', value: `${userAccount.dailyStreak} days`, inline: true },
                { name: 'Streak Bonus', value: `${streakBonus} coins`, inline: true }
            );

        if (userAccount.dailyStreak % 7 === 0) {
            embed.addFields({ name: '🎉 Weekly Bonus!', value: '500 coins', inline: true });
        }
        if (userAccount.dailyStreak % 30 === 0) {
            embed.addFields({ name: '🎊 Monthly Bonus!', value: '2000 coins', inline: true });
        }

        embed.addFields({ 
            name: 'Total Reward', 
            value: `${totalReward} coins`, 
            inline: false 
        });

        return interaction.reply({ embeds: [embed] });
    }

    // /balance command
    if (interaction.commandName === 'balance' || interaction.commandName === 'bal') {
        const userId = interaction.user.id;
        if (!economy[interaction.guildId]) economy[interaction.guildId] = {};
        if (!economy[interaction.guildId][userId]) economy[interaction.guildId][userId] = { balance: 100 };
        const bal = economy[interaction.guildId][userId].balance;
        return cutifyReply({ content: `${interaction.user}, your balance is ${bal} coins!`, ephemeral: true });
    }

    // /give command (admin only)
    if (interaction.commandName === 'give') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'You do not have permission to give coins.', ephemeral: true });
        }
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        if (amount <= 0) return interaction.reply({ content: 'Amount must be positive.', ephemeral: true });
        if (!economy[interaction.guildId]) economy[interaction.guildId] = {};
        if (!economy[interaction.guildId][target.id]) economy[interaction.guildId][target.id] = { balance: 100 };
        economy[interaction.guildId][target.id].balance += amount;
        saveEconomy(economy);
        return interaction.reply({ content: `Gave ${amount} coins to ${target.tag}.`, ephemeral: false });
    }

    // /bet command (heads/tails)
    if (interaction.commandName === 'bet') {
        const amount = interaction.options.getInteger('amount');
        const choice = (interaction.options.getString('choice') || '').toLowerCase();
        if (!['heads', 'tails'].includes(choice)) return interaction.reply({ content: 'Choice must be heads or tails.', ephemeral: true });
        if (!economy[interaction.guildId]) economy[interaction.guildId] = {};
        if (!economy[interaction.guildId][interaction.user.id]) economy[interaction.guildId][interaction.user.id] = { balance: 100 };
        const acct = economy[interaction.guildId][interaction.user.id];
        if (amount <= 0) return interaction.reply({ content: 'Bet must be positive.', ephemeral: true });
        if (acct.balance < amount) return interaction.reply({ content: `Insufficient balance. You have ${acct.balance}`, ephemeral: true });
        // simple coin flip
        const flip = Math.random() < 0.5 ? 'heads' : 'tails';
        let resultText = `The coin landed on **${flip}**.`;
        if (flip === choice) {
            const payout = Math.floor(amount * 1.9);
            acct.balance += payout;
            resultText += ` You won ${payout} coins! New balance: ${acct.balance}`;
        } else {
            acct.balance -= amount;
            resultText += ` You lost ${amount} coins. New balance: ${acct.balance}`;
        }
        saveEconomy(economy);
        return interaction.reply(resultText);
    }

    // /rps command
    if (interaction.commandName === 'rps') {
        const amount = interaction.options.getInteger('bet');
        const choice = interaction.options.getString('choice').toLowerCase();
        const opponent = interaction.options.getUser('opponent');

        // Validate choices
        if (!['rock', 'paper', 'scissors'].includes(choice)) {
            return interaction.reply({ content: 'Choice must be rock, paper, or scissors.', ephemeral: true });
        }

        // Check if playing against bot or user
        if (!opponent) {
            // Playing against bot
            if (amount) {
                // Check economy for bets
                if (!economy[interaction.guildId]) economy[interaction.guildId] = {};
                if (!economy[interaction.guildId][interaction.user.id]) economy[interaction.guildId][interaction.user.id] = { balance: 100 };
                const acct = economy[interaction.guildId][interaction.user.id];
                
                if (amount <= 0) return interaction.reply({ content: 'Bet must be positive.', ephemeral: true });
                if (acct.balance < amount) return interaction.reply({ content: `Insufficient balance. You have ${acct.balance}`, ephemeral: true });
            }

            // Bot's choice
            const choices = ['rock', 'paper', 'scissors'];
            const botChoice = choices[Math.floor(Math.random() * choices.length)];

            // Determine winner
            let result;
            if (choice === botChoice) result = 'tie';
            else if (
                (choice === 'rock' && botChoice === 'scissors') ||
                (choice === 'paper' && botChoice === 'rock') ||
                (choice === 'scissors' && botChoice === 'paper')
            ) result = 'win';
            else result = 'lose';

            // Create response embed
            const embed = new EmbedBuilder()
                .setTitle('🎮 Rock Paper Scissors')
                .setColor(result === 'win' ? '#00ff00' : result === 'lose' ? '#ff0000' : '#ffff00')
                .addFields(
                    { name: 'Your Choice', value: choice, inline: true },
                    { name: 'Bot\'s Choice', value: botChoice, inline: true },
                    { name: 'Result', value: result === 'win' ? 'You won!' : result === 'lose' ? 'You lost!' : 'It\'s a tie!', inline: true }
                );

            // Handle betting if enabled
            if (amount) {
                const acct = economy[interaction.guildId][interaction.user.id];
                if (result === 'win') {
                    const payout = Math.floor(amount * 1.5);
                    acct.balance += payout;
                    embed.addFields({ name: 'Payout', value: `You won ${payout} coins!\nNew balance: ${acct.balance}`, inline: false });
                } else if (result === 'lose') {
                    acct.balance -= amount;
                    embed.addFields({ name: 'Loss', value: `You lost ${amount} coins.\nNew balance: ${acct.balance}`, inline: false });
                } else {
                    embed.addFields({ name: 'Tie', value: 'Bet returned', inline: false });
                }
                saveEconomy(economy);
            }

            return interaction.reply({ embeds: [embed] });
        } else {
            // Implement player vs player logic here if needed
            return interaction.reply('Player vs Player RPS coming soon!');
        }
    }

    // /playquery - search YouTube and return top result with metadata
    if (interaction.commandName === 'playquery') {
        const q = interaction.options.getString('query');
        await interaction.deferReply();
        try {
            const r = await yts(q);
            const video = r && r.videos && r.videos.length ? r.videos[0] : null;
            if (!video) return interaction.followUp({ content: 'No video results found.' });
            const embed = new EmbedBuilder()
                .setTitle(video.title)
                .setURL(video.url)
                .setDescription(`${video.author.name} • ${video.timestamp}`)
                .setThumbnail(video.thumbnail)
                .addFields({ name: 'Duration', value: video.timestamp || 'N/A', inline: true }, { name: 'Views', value: String(video.views || 0), inline: true });
            return interaction.followUp({ embeds: [embed] });
        } catch (e) {
            console.error('yt-search error', e);
            return interaction.followUp({ content: 'Failed to search YouTube.' });
        }
    }

    // /trivia command
    if (interaction.commandName === 'trivia') {
            // Interactive trivia: ask question and wait for first correct answer within 20s
            const questions = [
                { q: 'What is the capital of France?', a: 'paris' },
                { q: 'Who wrote "To be, or not to be"?', a: 'shakespeare' },
                { q: 'What is the largest planet in our solar system?', a: 'jupiter' },
                { q: 'What year did the Titanic sink?', a: '1912' },
                { q: 'What is the chemical symbol for water?', a: 'h2o' }
            ];
            const pick = questions[Math.floor(Math.random() * questions.length)];
            await interaction.reply(`❓ Trivia: **${pick.q}**\n(First correct answer within 20 seconds wins)`);
            const filter = m => !m.author.bot;
            const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });
            collector.on('collect', m => {
                if (m.content.toLowerCase().trim() === pick.a.toString().toLowerCase().trim()) {
                    // award point
                    const guildId = interaction.guild.id;
                    triviaScores[guildId] = triviaScores[guildId] || {};
                    triviaScores[guildId][m.author.id] = triviaScores[guildId][m.author.id] || { score: 0 };
                    triviaScores[guildId][m.author.id].score += 1;
                    saveTrivia(triviaScores);
                    interaction.followUp(`${m.author} answered correctly and earns 1 point!`);
                } else {
                    interaction.followUp(`${m.author} answered but was incorrect.`);
                }
            });
            collector.on('end', collected => {
                if (collected.size === 0) {
                    interaction.followUp("no correct answers — time's up.");
                }
            });
            return;
    }
    // /help command
    if (interaction.commandName === 'help') {
        // Group commands by category
        const categories = {
            'Cases & Inventory': [
                'case list', 'case open', 'case inventory', 'case stats',
                'case sell', 'case leaderboard'
            ],
            'Fun & Games': [
                'dice', 'roll', 'guess', '8ball', 'coinflip', 'rps',
                'gaytest', 'owoify', 'roulette', 'slots', 'bet'
            ],
            'Economy & Trading': [
                'balance', 'give', 'daily', 'work', 'rob', 'trade',
                'shop', 'buy', 'sell', 'inventory', 'market'
            ],
            'Trivia & Games': [
                'trivia', 'trivia-leaderboard', 'quiz', 'hangman',
                'wordle', 'akinator', 'truth', 'dare'
            ],
            'Reactions & Social': [
                'hug', 'slap', 'ship', 'meme', 'cat', 'dog',
                'pat', 'kiss', 'cuddle', 'poke', 'wave', 'highfive'
            ],
            'Music & Audio': [
                'playquery', 'play', 'skip', 'queue', 'nowplaying',
                'pause', 'resume', 'stop', 'volume', 'playlist'
            ],
            'Moderation & Admin': [
                'mute', 'unmute', 'kick', 'ban', 'unban', 'warn',
                'warns', 'clearwarns', 'timeout', 'purge', 'lock',
                'unlock', 'setmodlog', 'slowmode', 'raid-protect',
                'automod', 'filter', 'nickname', 'role', 'welcome'
            ],
            'Utility & Info': [
                'help', 'serverinfo', 'userinfo', 'avatar',
                'ping', 'uptime', 'stats', 'permissions', 'reminders'
            ]
        };

        // Create embeds for each category
        const embeds = [];
        
        // First page - Overview
        const overviewEmbed = new EmbedBuilder()
            .setTitle('📖 Help Menu')
            .setDescription('Use the buttons below to navigate through command categories.\n\n' + 
                          'Categories:\n' +
                          '📦 Cases & Inventory\n' +
                          '🎮 Fun & Games\n' +
                          '💰 Economy & Trading\n' +
                          '❓ Trivia & Games\n' +
                          '🎭 Reactions & Social\n' +
                          '🎵 Music & Audio\n' +
                          '🛡️ Moderation & Admin\n' +
                          '🔧 Utility & Info\n\n' +
                          'Tip: All commands use slash (/) command format!')
            .setColor('#FF69B4')
            .setFooter({ text: 'Page 1/9' });
        embeds.push(overviewEmbed);

        // Create an embed for each category
        Object.entries(categories).forEach(([category, commandList], index) => {
            const embed = new EmbedBuilder()
                .setTitle(`${category} Commands`)
                .setColor('#FF69B4')
                .setFooter({ text: `Page ${index + 2}/7` });

            let description = '';
            commandList.forEach(cmdName => {
                const cmd = commandDescriptions.find(c => c.name === '/' + cmdName);
                if (cmd) {
                    description += `**${cmd.name}**\n${cmd.desc}\n\n`;
                }
            });
            // Add usage examples and additional info for certain categories
            if (category === 'Cases & Inventory') {
                embed.addFields({
                    name: 'Case Values',
                    value: 'Common: 100-500 coins\nRare: 500-2000 coins\nLegendary: 2000+ coins'
                });
            } else if (category === 'Economy & Trading') {
                embed.addFields({
                    name: 'Daily Rewards',
                    value: 'Daily: 100 coins\nWeekly bonus: 500 coins\nMonthly bonus: 2000 coins'
                });
            } else if (category === 'Music & Audio') {
                embed.addFields({
                    name: 'Supported Sources',
                    value: 'YouTube, Spotify, SoundCloud'
                });
            }
            
            embed.setDescription(description);
            embeds.push(embed);
        });

        // Create navigation buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('help_first')
                    .setLabel('≪')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('help_prev')
                    .setLabel('←')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('help_next')
                    .setLabel('→')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('help_last')
                    .setLabel('≫')
                    .setStyle(ButtonStyle.Secondary)
            );

        // Send initial embed with buttons
        const response = await interaction.reply({
            embeds: [embeds[0]],
            components: [row],
            ephemeral: true
        });

        // Create button collector
        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 300000 // 5 minutes
        });

        let currentPage = 0;

        collector.on('collect', async i => {
            switch (i.customId) {
                case 'help_first':
                    currentPage = 0;
                    break;
                case 'help_prev':
                    currentPage = currentPage > 0 ? currentPage - 1 : embeds.length - 1;
                    break;
                case 'help_next':
                    currentPage = currentPage < embeds.length - 1 ? currentPage + 1 : 0;
                    break;
                case 'help_last':
                    currentPage = embeds.length - 1;
                    break;
            }

            await i.update({
                embeds: [embeds[currentPage]],
                components: [row]
            });
        });

        collector.on('end', () => {
            interaction.editReply({
                components: [] // Remove buttons when collector expires
            }).catch(console.error);
        });

        return;
    }
    // /trivia-leaderboard command
    if (interaction.commandName === 'trivia-leaderboard') {
        const guildId = interaction.guild.id;
        const board = (triviaScores[guildId]) || {};
        const arr = Object.entries(board).map(([id, v]) => ({ id, score: v.score || 0 }));
        if (arr.length === 0) return interaction.reply({ content: 'No trivia scores yet in this guild.', ephemeral: true });
        arr.sort((a, b) => b.score - a.score);
        let out = '**Trivia Leaderboard:**\n';
        for (let i = 0; i < Math.min(10, arr.length); i++) {
            const entry = arr[i];
            out += `${i+1}. <@${entry.id}> — ${entry.score} pts\n`;
        }
        return interaction.reply({ content: out, ephemeral: false });
    }
    // /warn command
    if (interaction.commandName === 'warn') {
        if (!isModerator(interaction.member)) return interaction.reply({ content: 'You do not have permission to warn members.', ephemeral: true });
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        try {
            await interaction.reply(`${user.tag} has been warned. Reason: ${reason}`);
            // Persist warn
            const guildId = interaction.guild.id;
            warnsData[guildId] = warnsData[guildId] || {};
            warnsData[guildId][user.id] = warnsData[guildId][user.id] || [];
            const warnObj = { id: Date.now().toString(), mod: interaction.user.id, reason, timestamp: Date.now() };
            warnsData[guildId][user.id].push(warnObj);
            saveWarns(warnsData);
            // If duration provided, attempt to timeout the member
            const durationStr = interaction.options.getString('duration');
            if (durationStr) {
                const minutes = parseDurationToMinutes(durationStr);
                const member = interaction.guild.members.cache.get(user.id);
                if (member && minutes > 0) {
                    try {
                        await member.timeout(minutes * 60 * 1000, `Timed out by warn for ${durationStr}`);
                        await interaction.followUp({ content: `${user.tag} has been timed out for ${durationStr}.`, ephemeral: true });
                    } catch (err) {
                        console.log('Failed to timeout user:', err);
                        await interaction.followUp({ content: `Warn saved but failed to timeout user for ${durationStr}.`, ephemeral: true });
                    }
                }
            }
            // Post to mod-log if configured
            const guildId2 = interaction.guild.id;
            const cfg = configData[guildId2] || {};
            if (cfg.modlogChannelId) {
                const ch = interaction.guild.channels.cache.get(cfg.modlogChannelId);
                if (ch) ch.send(`:warning: ${user.tag} was warned by ${interaction.user.tag}. Reason: ${reason}`);
            }
            // Optionally DM the user:
            try { await user.send(`You have been warned in ${interaction.guild.name}. Reason: ${reason}`); }
            catch (dmErr) { console.log('Failed to DM user warning:', dmErr); }
        } catch (err) {
            await interaction.reply({ content: 'Failed to warn user.', ephemeral: true });
        }
        return;
    }
    // /warns command
    if (interaction.commandName === 'warns') {
        if (!isModerator(interaction.member)) return interaction.reply({ content: 'You do not have permission to view warns.', ephemeral: true });
        const user = interaction.options.getUser('user');
        const guildId = interaction.guild.id;
        const list = (warnsData[guildId] && warnsData[guildId][user.id]) || [];
        if (list.length === 0) return interaction.reply({ content: `${user.tag} has no warns.`, ephemeral: true });
        let out = `Warns for ${user.tag}:\n`;
        for (const w of list) {
            out += `• ID: ${w.id} — By <@${w.mod}> at ${new Date(w.timestamp).toLocaleString()} — ${w.reason}\n`;
        }
        return interaction.reply({ content: out, ephemeral: true });
    }
    // /clearwarns command
    if (interaction.commandName === 'clearwarns') {
        if (!isModerator(interaction.member)) return interaction.reply({ content: 'You do not have permission to clear warns.', ephemeral: true });
        const user = interaction.options.getUser('user');
        const guildId = interaction.guild.id;
        if (warnsData[guildId] && warnsData[guildId][user.id]) {
            delete warnsData[guildId][user.id];
            saveWarns(warnsData);
            return interaction.reply({ content: `Cleared warns for ${user.tag}.`, ephemeral: true });
        } else {
            return interaction.reply({ content: `${user.tag} has no warns.`, ephemeral: true });
        }
    }
    // /setmodlog command
    if (interaction.commandName === 'setmodlog') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return interaction.reply({ content: 'You need Manage Server permission to set modlog.', ephemeral: true });
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guild.id;
        configData[guildId] = configData[guildId] || {};
        configData[guildId].modlogChannelId = channel.id;
        saveConfig(configData);
        return interaction.reply({ content: `Mod-log channel set to ${channel}.`, ephemeral: true });
    }
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;
    if (commandName === '8ball') {
        const responses = [
            'Yes.', 'No.', 'Maybe.', 'Ask again later.', 'Definitely!', 'Absolutely not.', 'It is certain.', 'Very doubtful.'
        ];
        const answer = responses[Math.floor(Math.random() * responses.length)];
        await interaction.reply(`🎱 ${answer}`);
    } else if (commandName === 'coinflip') {
        const result = Math.random() < 0.5 ? 'Heads!' : 'Tails!';
        await interaction.reply(`🪙 ${result}`);
    } else if (commandName === 'rps') {
        const userChoice = interaction.options.getString('choice').toLowerCase();
        const choices = ['rock', 'paper', 'scissors'];
        if (!choices.includes(userChoice)) return interaction.reply({ content: 'Choose rock, paper, or scissors!', ephemeral: true });
        const botChoice = choices[Math.floor(Math.random() * 3)];
        let result = '';
        if (userChoice === botChoice) result = "It's a tie!";
        else if ((userChoice === 'rock' && botChoice === 'scissors') || (userChoice === 'paper' && botChoice === 'rock') || (userChoice === 'scissors' && botChoice === 'paper')) result = 'You win!';
        else result = 'You lose!';
        await interaction.reply(`You chose **${userChoice}**. I chose **${botChoice}**. ${result}`);
    } else if (commandName === 'mute') {
        if (!isModerator(interaction.member)) return interaction.reply({ content: 'You do not have permission to mute members.', ephemeral: true });
        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
        try {
            await member.timeout(60 * 60 * 1000, 'Muted by bot'); // 1 hour mute
            await interaction.reply(`${user.tag} has been muted for 1 hour.`);
        } catch (err) {
            await interaction.reply({ content: 'Failed to mute user.', ephemeral: true });
        }
    } else if (commandName === 'unmute') {
        if (!isModerator(interaction.member)) return interaction.reply({ content: 'You do not have permission to unmute members.', ephemeral: true });
        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
        try {
            await member.timeout(null, 'Unmuted by bot');
            await interaction.reply(`${user.tag} has been unmuted.`);
        } catch (err) {
            await interaction.reply({ content: 'Failed to unmute user.', ephemeral: true });
        }
    } else if (commandName === 'market') {
        const subcommand = interaction.options.getSubcommand();

        // Initialize global market data structure
        if (!market.listings) market.listings = [];

        if (subcommand === 'list') {
            const itemId = interaction.options.getString('item');
            const price = interaction.options.getInteger('price');
            const userInv = inventory[interaction.guildId][interaction.user.id];
            
            if (!userInv) {
                return interaction.reply({ 
                    content: 'You have no items to sell!',
                    ephemeral: true 
                });
            }

            // Find item by ID
            const itemIndex = userInv.findIndex(i => i.id === itemId);
            if (itemIndex === -1) {
                return interaction.reply({ 
                    content: `Item ID "${itemId}" not found in your inventory. Use /case inventory to see your items.`,
                    ephemeral: true 
                });
            }

            const item = userInv[itemIndex];
            const listingId = generateItemId();

            // Add listing
            market.listings.push({
                id: listingId,
                itemId: item.id,
                item: {...item},
                price,
                sellerId: interaction.user.id,
                sellerName: interaction.user.username,
                sellerGuildId: interaction.guildId,
                listed: new Date().toISOString(),
                guildName: interaction.guild.name
            });

            // Remove item from inventory
            userInv.splice(itemIndex, 1);
            
            // Save changes
            saveMarket(market);
            saveInventory(inventory);

            return interaction.reply({
                content: `Listed ${item.name} (${item.wear}) for ${price} coins! Listing ID: \`${listingId}\``,
                ephemeral: true
            });
        }

        if (subcommand === 'buy') {
            const listingId = interaction.options.getString('id');
            
            if (!market.listings?.length) {
                return interaction.reply({
                    content: 'No listings available in the global market.',
                    ephemeral: true
                });
            }

            const listingIndex = market.listings.findIndex(l => l.id === listingId);
            if (listingIndex === -1) {
                return interaction.reply({
                    content: `Listing "${listingId}" not found. Use /market search to see available listings.`,
                    ephemeral: true
                });
            }

            const listing = market.listings[listingIndex];

            // Prevent buying your own listings
            if (listing.sellerId === interaction.user.id) {
                return interaction.reply({
                    content: 'You cannot buy your own listing! Use /market remove to remove it instead.',
                    ephemeral: true
                });
            }
            
            // Set up economy for seller's guild if needed
            if (!economy[listing.sellerGuildId]) {
                economy[listing.sellerGuildId] = {};
            }
            if (!economy[listing.sellerGuildId][listing.sellerId]) {
                economy[listing.sellerGuildId][listing.sellerId] = { balance: 0 };
            }

            // Check if buyer has enough coins
            // Set up economy for buyer
            if (!economy[interaction.guildId][interaction.user.id]) {
                economy[interaction.guildId][interaction.user.id] = { balance: 0 };
            }

            if (economy[interaction.guildId][interaction.user.id].balance < listing.price) {
                return interaction.reply({
                    content: `You don't have enough coins! The item costs ${listing.price} coins.`,
                    ephemeral: true
                });
            }

            // Transfer coins across servers
            economy[interaction.guildId][interaction.user.id].balance -= listing.price;
            economy[listing.sellerGuildId][listing.sellerId].balance += listing.price;

            // Transfer item
            if (!inventory[interaction.guildId][interaction.user.id]) {
                inventory[interaction.guildId][interaction.user.id] = [];
            }
            inventory[interaction.guildId][interaction.user.id].push({
                ...listing.item,
                id: generateItemId() // Generate new ID for the item
            });

            // Remove listing
            market.listings.splice(listingIndex, 1);

            // Save changes
            saveMarket(market);
            saveInventory(inventory);
            saveEconomy(economy);

            return interaction.reply({
                content: `Successfully bought ${listing.item.name} (${listing.item.wear}) for ${listing.price} coins from ${listing.sellerName} (${listing.guildName})!`,
                ephemeral: true
            });
        }

        if (subcommand === 'search') {
            const query = interaction.options.getString('query').toLowerCase();
            
            if (!market.listings?.length) {
                return interaction.reply({
                    content: 'No listings available in the global market.',
                    ephemeral: true
                });
            }

            const matches = market.listings.filter(l => 
                l.item.name.toLowerCase().includes(query) ||
                l.item.rarity.toLowerCase().includes(query) ||
                l.item.wear.toLowerCase().includes(query)
            );

            if (!matches.length) {
                return interaction.reply({
                    content: `No listings found matching "${query}".`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🏪 Global Market Search Results')
                .setColor('#FF69B4')
                .setDescription(matches.map(l =>
                    `• ${l.item.name} (${l.item.wear})\n` +
                    `  ${getRarityColor(l.item.rarity)}■${getRarityColor(l.item.rarity)} ${l.item.rarity}\n` +
                    `  Price: ${l.price} coins\n` +
                    `  Seller: ${l.sellerName}\n` +
                    `  Server: ${l.guildName}\n` +
                    `  ID: \`${l.id}\``
                ).join('\n\n'))
                .setFooter({ text: `Found ${matches.length} listings` });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'listings') {
            if (!market.listings?.length) {
                return interaction.reply({
                    content: 'No listings available in the global market.',
                    ephemeral: true
                });
            }

            const userListings = market.listings.filter(l => 
                l.sellerId === interaction.user.id
            );

            if (!userListings.length) {
                return interaction.reply({
                    content: 'You have no active listings.',
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('📋 Your Market Listings')
                .setColor('#FF69B4')
                .setDescription(userListings.map(l =>
                    `• ${l.item.name} (${l.item.wear})\n` +
                    `  ${getRarityColor(l.item.rarity)}■${getRarityColor(l.item.rarity)} ${l.item.rarity}\n` +
                    `  Price: ${l.price} coins\n` +
                    `  Listed: ${new Date(l.listed).toLocaleString()}\n` +
                    `  ID: \`${l.id}\``
                ).join('\n\n'))
                .setFooter({ text: `${userListings.length} active listings` });

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === 'remove') {
            const listingId = interaction.options.getString('id');
            
            if (!market.listings?.length) {
                return interaction.reply({
                    content: 'No listings available in the global market.',
                    ephemeral: true
                });
            }

            const listingIndex = market.listings.findIndex(l => 
                l.id === listingId && l.sellerId === interaction.user.id
            );

            if (listingIndex === -1) {
                return interaction.reply({
                    content: `Listing "${listingId}" not found or doesn't belong to you.`,
                    ephemeral: true
                });
            }

            const listing = market[interaction.guildId].listings[listingIndex];

            // Return item to inventory
            if (!inventory[interaction.guildId][interaction.user.id]) {
                inventory[interaction.guildId][interaction.user.id] = [];
            }
            inventory[interaction.guildId][interaction.user.id].push({
                ...listing.item,
                id: generateItemId() // Generate new ID for returned item
            });

            // Remove listing
            market.listings.splice(listingIndex, 1);

            // Save changes
            saveMarket(market);
            saveInventory(inventory);

            return interaction.reply({
                content: `Removed listing for ${listing.item.name} (${listing.item.wear}) and returned item to your inventory.`,
                ephemeral: true
            });
        }
    } else if (commandName === 'ban') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers) && !isModerator(interaction.member)) return interaction.reply({ content: 'You do not have permission to ban members.', ephemeral: true });
        const user = interaction.options.getUser('user');
        try {
            await interaction.guild.members.ban(user.id, { reason: 'Banned by bot' });
            await interaction.reply(`${user.tag} has been banned.`);
        } catch (err) {
            await interaction.reply({ content: 'Failed to ban user.', ephemeral: true });
        }
    } else if (commandName === 'unban') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers) && !isModerator(interaction.member)) return interaction.reply({ content: 'You do not have permission to unban members.', ephemeral: true });
        const userId = interaction.options.getString('userid');
        try {
            await interaction.guild.members.unban(userId);
            await interaction.reply(`User with ID ${userId} has been unbanned.`);
        } catch (err) {
            await interaction.reply({ content: 'Failed to unban user.', ephemeral: true });
        }
    }
});

// Prepare connect to OpenAI API (latest SDK)
const { OpenAI } = require('openai');
const openai = new OpenAI({
    organization: process.env.OPENAI_ORG,
    apiKey: process.env.OPENAI_KEY
});

// Case opening helpers
function getRarityColor(rarity) {
    switch(rarity.toLowerCase()) {
        case 'consumer': return '#b0c3d9';     // Light gray/blue
        case 'industrial': return '#5e98d9';    // Light blue
        case 'mil-spec': return '#4b69ff';      // Blue
        case 'restricted': return '#8847ff';     // Purple
        case 'classified': return '#d32ce6';     // Pink
        case 'covert': return '#eb4b4b';        // Red
        case 'gold': return '#ffd700';          // Gold
        default: return '#000000';
    }
}

function selectRandomItem(items) {
    // First determine rarity with updated probabilities
    const roll = Math.random() * 100;
    let selectedRarity, selectedItems;
    
    if (roll < 50) { // 50% Consumer
        selectedRarity = 'consumer';
        selectedItems = items.consumer.items;
    } else if (roll < 75) { // 25% Industrial
        selectedRarity = 'industrial';
        selectedItems = items.industrial.items;
    } else if (roll < 90) { // 15% Mil-Spec
        selectedRarity = 'mil-spec';
        selectedItems = items['mil-spec'].items;
    } else if (roll < 97) { // 7% Restricted
        selectedRarity = 'restricted';
        selectedItems = items.restricted.items;
    } else if (roll < 99.5) { // 2.5% Classified
        selectedRarity = 'classified';
        selectedItems = items.classified.items;
    } else if (roll < 99.9) { // 0.4% Covert
        selectedRarity = 'covert';
        selectedItems = items.covert.items;
    } else { // 0.1% Gold
        selectedRarity = 'gold';
        selectedItems = items.covert.items; // Gold items are from covert pool
    }
    
    // If selectedItems is missing or empty, try to find any non-empty rarity
    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
        selectedItems = [];
        for (const rKey of Object.keys(items || {})) {
            const pool = (items[rKey] && items[rKey].items) || [];
            if (Array.isArray(pool) && pool.length > 0) {
                selectedItems = pool;
                selectedRarity = rKey;
                break;
            }
        }
    }
    // Final fallback: if still empty, return a placeholder junk item
    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
        return { name: 'Mysterious Trinket', gif: null, rarity: 'Common', wear: 'Worn', value: 0 };
    }

    const selectedItem = selectedItems[Math.floor(Math.random() * selectedItems.length)];
    
    // Determine wear condition
    const wearRoll = Math.random() * 100;
    let wear;
    
    if (wearRoll < 10) { // 10% Factory New
        wear = gifs.wearSystem.factoryNew;
    } else if (wearRoll < 30) { // 20% Minimal Wear
        wear = gifs.wearSystem.minimalWear;
    } else if (wearRoll < 65) { // 35% Field-Tested
        wear = gifs.wearSystem.fieldTested;
    } else if (wearRoll < 85) { // 20% Well-Worn
        wear = gifs.wearSystem.wellWorn;
    } else { // 15% Battle-Scarred
        wear = gifs.wearSystem.battleScarred;
    }
    
    // Calculate item value based on rarity and wear
    const rarityMeta = items[selectedRarity] || {};
    const baseValue = typeof rarityMeta.baseValue === 'number' ? rarityMeta.baseValue : (rarityMeta.items && rarityMeta.items[0] && rarityMeta.items[0].baseValue) || 100;
    const finalValue = Math.floor(baseValue * wear.valueMultiplier);
    
    return {
        ...selectedItem,
        rarity: selectedRarity.charAt(0).toUpperCase() + selectedRarity.slice(1),
        wear: wear.display,
        value: finalValue
    };
}

// Commands that should use OpenAI for more flavorful replies
const OPENAI_COMMANDS = new Set(['gaytest', '8ball', 'hug', 'slap', 'ship']);

// Helper: generate a short reply from OpenAI for a given command and context
async function generateOpenAIReply(commandName, promptText, { max_tokens = 80, temperature = 0.8 } = {}) {
    try {
        const systemMsg = { role: 'system', content: 'you are a chill, casual discord assistant. keep replies short, lowercase, human-like, use light gen-z slang occasionally, minimal emojis, and stay friendly and supportive.' };
        const userMsg = { role: 'user', content: `Command: ${commandName}\nContext: ${promptText}` };
        const gptResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [systemMsg, userMsg],
            max_tokens,
            temperature
        });
        const txt = gptResponse?.choices?.[0]?.message?.content;
        if (txt) return txt.trim();
    } catch (e) {
        console.error('OpenAI helper error for', commandName, e?.message || e);
    }
    return null;
}

// Check for when a message on discord is sent
client.on('messageCreate', async function(message){
   try {
  console.log('Received message:', message.content, 'from', message.author.username, 'in channel', message.channel.id);
  if (message.author.bot) return;

  const allowedChannels = ['1420238916190994555', '1421188776910393464', '1420238577102618657'];
  if (!allowedChannels.includes(message.channel.id)) {
    console.log('Message not in allowed channels, ignoring.');
    return;
  }

  const displayName = message.member ? message.member.displayName : message.author.username;
  const channelId = message.channel.id;

    // Ignore short laugh or reaction-only messages to avoid chaining replies
    const lc = message.content.toLowerCase().trim();
    const laughPatterns = ['lol', 'lmao', 'rofl', 'haha', 'hehe', 'lmfao', 'xd'];
    if (laughPatterns.includes(lc) || /^[:\-\(]*joy[:\-\)]*$/.test(lc)) {
        console.log('Ignoring laugh/reaction-like message to avoid chained bot replies.');
        return;
    }

  // Set up memory for this channel if it doesn't exist
    if (!messageHistories.has(channelId)) {
        messageHistories.set(channelId, [
            { role: "system", content: "you are a chill, friendly discord bot with a subtle femboy vibe. speak casually and human-like: lowercase, short sentences, a little gen-z slang allowed, minimal emojis, supportive and playful but not try-hard." }
        ]);
    }

  const history = messageHistories.get(channelId);

  // Add the user's message to the history
  history.push({ role: "user", content: `${displayName}: ${message.content}` });

  // Send the full history to OpenAI
    try {
        const gptResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: history,
            max_tokens: 150,
            temperature: 0.9
        });
        console.log('OpenAI response:', gptResponse.choices); // ✅ Keep this!
        const reply = gptResponse.choices[0].message.content.trim();
        history.push({ role: "assistant", content: reply });
        if (history.length > 20) history.splice(1, history.length - 20);
        message.reply(reply);
    } catch (openaiErr) {
        console.log('OpenAI API error:', openaiErr);
    message.reply('uh oh, having trouble connecting to the brain rn. try again in a bit.');
    }
} catch (err) {
    console.log('Error in message handler:', err);
}
});
// Log the bot into Discord
client.login(process.env.DISCORD_TOKEN);
console.log("Femboy Adventure is Online on Discord")