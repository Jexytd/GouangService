const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs');
const config = require('./src/config');
const { startServer } = require('./src/api/server');

// Initialize Discord Client
const app = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});
app.commands = new Collection();

app.on(Events.ClientReady, async () => {
    console.log(`[Discord Bot] Logged in as ${app.user.tag}`);

    // Load Commands Modules recursively
    const commandsArray = [];
    const commandsBasePath = path.join(__dirname, 'Commands');

    if (fs.existsSync(commandsBasePath)) {
        const folders = fs.readdirSync(commandsBasePath, 'utf-8');
        for (const folder of folders) {
            const subFolderPath = path.join(commandsBasePath, folder);
            if (!fs.statSync(subFolderPath).isDirectory()) continue;

            const commandFiles = fs.readdirSync(subFolderPath, 'utf-8').filter(f => f.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(subFolderPath, file);
                try {
                    const module = require(filePath);
                    if (module.data?.name && module.execute) {
                        app.commands.set(module.data.name, module);
                        commandsArray.push(module.data);
                        console.log(`[Commands] Loaded: /${module.data.name} (${folder})`);
                    }
                } catch (err) {
                    console.error(`[Commands] Failed to load ${file}:`, err);
                }
            }
        }
    }

    // Register slash commands to every guild the bot is currently in (instant update)
    for (const guild of app.guilds.cache.values()) {
        try {
            await guild.commands.set(commandsArray);
            console.log(`[Discord Bot] Registered ${commandsArray.length} command(s) to server: ${guild.name}`);
        } catch (err) {
            console.error(`[Discord Bot] Failed to register commands to server ${guild.name}:`, err);
        }
    }
});

app.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = app.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (err) {
        console.error(`[Discord Bot] Error executing /${interaction.commandName}:`, err);
        const replyPayload = {
            content: '❌ An error occurred while executing this command.',
            ephemeral: true
        };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(replyPayload);
        } else {
            await interaction.reply(replyPayload);
        }
    }
});

// Start Express API Server and Login Discord Bot
async function main() {
    // 1. Start Express API and Dashboard
    await startServer(config.port);

    // 2. Login Discord Bot
    if (config.token && config.token.length > 20) {
        try {
            await app.login(config.token);
        } catch (err) {
            console.error("[Discord Bot] Login failed. Check your token in config.json or .env:", err.message);
        }
    } else {
        console.warn("[Discord Bot] No valid bot token provided. Discord Bot will not start.");
    }
}

main().catch(err => {
    console.error("[System] Fatal startup error:", err);
});