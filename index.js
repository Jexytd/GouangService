const { Client, GatewayIntentBits, Collection } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs');
const config = require('./src/config');
const { startServer } = require('./src/api/server');
const { registerEvents } = require('./src/bot/handlers/eventHandler');

// Initialize Discord Client with modern 2026 intents
const app = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});
app.commands = new Collection();

// Load Commands recursively from Commands directory
function loadCommands(client) {
    const commandsBasePath = path.join(__dirname, 'Commands');
    if (!fs.existsSync(commandsBasePath)) return;

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
                    client.commands.set(module.data.name, module);
                    console.log(`[Commands] Loaded: /${module.data.name} (${folder})`);
                }
            } catch (err) {
                console.error(`[Commands] Failed to load ${file}:`, err);
            }
        }
    }
}

// Global Process Error Handlers to ensure high reliability
process.on('unhandledRejection', (reason, promise) => {
    console.error('[System] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[System] Uncaught Exception:', err);
});

// Start Express API Server and Login Discord Bot
async function main() {
    // 1. Load Commands and Register Modular Event Handlers
    loadCommands(app);
    registerEvents(app);

    // 2. Start Express API and Dashboard with Discord client context
    await startServer(config.port, app);

    // 3. Login Discord Bot
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

module.exports = { app };