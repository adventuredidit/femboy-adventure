// ...existing code...
// Create a Discord Bot using OpenAI API that interacts on the Discord Server
require('dotenv').config();
// Debug: Check if DISCORD_TOKEN is loaded
if (!process.env.DISCORD_TOKEN) {
    console.log('DISCORD_TOKEN is missing! Check your .env file.');
} else {
    console.log('DISCORD_TOKEN loaded, starts with:', process.env.DISCORD_TOKEN.slice(0, 5) + '...');
}

// Prepare to connect to Discord API
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
]});
// Slash command definitions
const commands = [
    new SlashCommandBuilder().setName('dice').setDescription('Roll a 6-sided die!'),
    new SlashCommandBuilder().setName('guess').setDescription('Guess a number between 1 and 10!').addIntegerOption(opt => opt.setName('number').setDescription('Your guess').setRequired(true)),
    new SlashCommandBuilder().setName('slots').setDescription('Play a simple slot machine!'),
    new SlashCommandBuilder().setName('trivia').setDescription('Get a random trivia question!'),
    new SlashCommandBuilder().setName('8ball').setDescription('Ask the magic 8-ball a question!').addStringOption(opt => opt.setName('question').setDescription('Your question').setRequired(true)),
    new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin!'),
    new SlashCommandBuilder().setName('rps').setDescription('Play rock-paper-scissors!').addStringOption(opt => opt.setName('choice').setDescription('rock, paper, or scissors').setRequired(true)),
    new SlashCommandBuilder().setName('mute').setDescription('Mute a member').addUserOption(opt => opt.setName('user').setDescription('User to mute').setRequired(true)),
    new SlashCommandBuilder().setName('unmute').setDescription('Unmute a member').addUserOption(opt => opt.setName('user').setDescription('User to unmute').setRequired(true)),
    new SlashCommandBuilder().setName('ban').setDescription('Ban a member').addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true)),
    new SlashCommandBuilder().setName('unban').setDescription('Unban a user by ID').addStringOption(opt => opt.setName('userid').setDescription('User ID to unban').setRequired(true)),
    new SlashCommandBuilder().setName('warn').setDescription('Warn a member with a reason').addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true)).addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true)),
    new SlashCommandBuilder().setName('help').setDescription('Show all available commands'),
].map(cmd => cmd.toJSON());
// Command descriptions for /help
const commandDescriptions = [
    { name: '/dice', desc: 'Roll a 6-sided die.' },
    { name: '/guess', desc: 'Guess a number between 1 and 10.' },
    { name: '/slots', desc: 'Play a simple slot machine.' },
    { name: '/trivia', desc: 'Get a random trivia question.' },
    { name: '/8ball', desc: 'Ask the magic 8-ball a question.' },
    { name: '/coinflip', desc: 'Flip a coin.' },
    { name: '/rps', desc: 'Play rock-paper-scissors.' },
    { name: '/mute', desc: 'Mute a member (mod only).' },
    { name: '/unmute', desc: 'Unmute a member (mod only).' },
    { name: '/ban', desc: 'Ban a member (mod only).' },
    { name: '/unban', desc: 'Unban a user by ID (mod only).' },
    { name: '/warn', desc: 'Warn a member with a reason (mod only).' },
    { name: '/help', desc: 'Show all available commands.' },
];

// Register slash commands on ready
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        // Register commands globally (or use guild-specific for faster update)
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Slash commands registered.');
    } catch (err) {
        console.error('Error registering slash commands:', err);
    }
});
// Handle slash commands
client.on('interactionCreate', async interaction => {
    // /gaytest command
    if (interaction.commandName === 'gaytest') {
        const user = interaction.options.getUser('user');
        const percent = Math.floor(Math.random() * 101);
        let comment = 'Not much to see here.';
        if (percent > 90) comment = 'That’s about as gay as it gets.';
        else if (percent > 70) comment = 'Pretty gay, honestly.';
        else if (percent > 40) comment = 'You’ve got some gay energy.';
        else if (percent > 20) comment = 'A little bit, maybe.';
        return interaction.reply(`${user} is ${percent}% gay. ${comment}`);
    }
    // /owoify command
    if (interaction.commandName === 'owoify') {
        const text = interaction.options.getString('text');
        // Simple OwOify logic
        let owo = text.replace(/[lr]/g, 'w').replace(/[LR]/g, 'W').replace(/n([aeiou])/g, 'ny$1').replace(/N([aeiou])/g, 'Ny$1');
        owo += ' owo';
        return interaction.reply(owo);
    }

    // /hug command
    if (interaction.commandName === 'hug') {
        const user = interaction.options.getUser('user');
        return interaction.reply(`🤗 ${interaction.user} hugs ${user}!`);
    }

    // /slap command
    if (interaction.commandName === 'slap') {
        const user = interaction.options.getUser('user');
        return interaction.reply(`👋 ${interaction.user} slaps ${user}!`);
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
        return interaction.reply(`💞 Shipping ${user1} + ${user2}: **${percent}%** match! ${comment}`);
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

    // /slots command
    if (interaction.commandName === 'slots') {
        const items = ['🍒', '🍋', '🍊', '🍉', '⭐', '7️⃣'];
        const slot1 = items[Math.floor(Math.random() * items.length)];
        const slot2 = items[Math.floor(Math.random() * items.length)];
        const slot3 = items[Math.floor(Math.random() * items.length)];
        const win = (slot1 === slot2 && slot2 === slot3);
        return interaction.reply(`🎰 | ${slot1} | ${slot2} | ${slot3} | ${win ? '\nYou win!' : '\nYou lose!'}`);
    }

    // /trivia command
    if (interaction.commandName === 'trivia') {
        // Simple hardcoded trivia for demo; can be expanded or made dynamic
        const questions = [
            { q: 'What is the capital of France?', a: 'Paris' },
            { q: 'Who wrote "To be, or not to be"?', a: 'Shakespeare' },
            { q: 'What is the largest planet in our solar system?', a: 'Jupiter' },
            { q: 'What year did the Titanic sink?', a: '1912' },
            { q: 'What is the chemical symbol for water?', a: 'H2O' }
        ];
        const pick = questions[Math.floor(Math.random() * questions.length)];
        return interaction.reply(`❓ Trivia: **${pick.q}**\n_Answer: ||${pick.a}||_`);
    }
    // /help command
    if (interaction.commandName === 'help') {
        let helpMsg = '**Available Commands:**\n';
        for (const cmd of commandDescriptions) {
            helpMsg += `
${cmd.name} — ${cmd.desc}`;
        }
        return interaction.reply({ content: helpMsg, ephemeral: true });
    }
    // /warn command
    if (interaction.commandName === 'warn') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) return interaction.reply({ content: 'You do not have permission to warn members.', ephemeral: true });
        const user = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        try {
            await interaction.reply(`${user.tag} has been warned. Reason: ${reason}`);
            // Optionally DM the user:
            try { await user.send(`You have been warned in ${interaction.guild.name}. Reason: ${reason}`); } catch {}
        } catch (err) {
            await interaction.reply({ content: 'Failed to warn user.', ephemeral: true });
        }
        return;
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
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.MuteMembers)) return interaction.reply({ content: 'You do not have permission to mute members.', ephemeral: true });
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
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.MuteMembers)) return interaction.reply({ content: 'You do not have permission to unmute members.', ephemeral: true });
        const user = interaction.options.getUser('user');
        const member = interaction.guild.members.cache.get(user.id);
        if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
        try {
            await member.timeout(null, 'Unmuted by bot');
            await interaction.reply(`${user.tag} has been unmuted.`);
        } catch (err) {
            await interaction.reply({ content: 'Failed to unmute user.', ephemeral: true });
        }
    } else if (commandName === 'ban') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.reply({ content: 'You do not have permission to ban members.', ephemeral: true });
        const user = interaction.options.getUser('user');
        try {
            await interaction.guild.members.ban(user.id, { reason: 'Banned by bot' });
            await interaction.reply(`${user.tag} has been banned.`);
        } catch (err) {
            await interaction.reply({ content: 'Failed to ban user.', ephemeral: true });
        }
    } else if (commandName === 'unban') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.reply({ content: 'You do not have permission to unban members.', ephemeral: true });
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

// Check for when a message on discord is sent
client.on('messageCreate', async function(message){
    try {
        console.log('Received message:', message.content, 'from', message.author.username, 'in channel', message.channel.id);
        if (message.author.bot) return; // Ignore messages from bots
        const allowedChannels = ['1420238916190994555', '1421188776910393464'];
        if (!allowedChannels.includes(message.channel.id)) {
            console.log('Message not in allowed channels, ignoring.');
            return;
        }

        console.log('Calling OpenAI API...');
        const displayName = message.member ? message.member.displayName : message.author.username;
        const gptResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are a chill, friendly, and mostly casual Discord bot with just a subtle, playful femboy flair. You talk like a real person, keep things light and supportive, and occasionally add a little playful or cute energy, but never over the top." },
                { role: "user", content: `${displayName}: ${message.content}` }
            ],
            max_tokens: 150,
            temperature: 0.9
        });
        console.log('OpenAI response:', gptResponse.choices);
        message.reply(gptResponse.choices[0].message.content.trim());
        return;
    } catch (err) {
        console.log('Error in message handler:', err);
    }
});
// Log the bot into Discord
client.login(process.env.DISCORD_TOKEN);
console.log("Femboy Adventure is Online on Discord")