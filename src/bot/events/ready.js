const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`[Discord Bot] Logged in as ${client.user.tag}`);

        // Set rich bot presence
        client.user.setPresence({
            activities: [{
                name: 'Ricoh Shield 2026 | /ticket /help',
                type: ActivityType.Custom
            }],
            status: 'online'
        });

        // Collect command data definitions
        const commandsArray = [];
        for (const command of client.commands.values()) {
            if (command.data) {
                commandsArray.push(command.data.toJSON ? command.data.toJSON() : command.data);
            }
        }

        // Register slash commands to every guild the bot is currently in (instant update)
        for (const guild of client.guilds.cache.values()) {
            try {
                await guild.commands.set(commandsArray);
                console.log(`[Discord Bot] Registered ${commandsArray.length} command(s) to server: ${guild.name}`);
            } catch (err) {
                console.error(`[Discord Bot] Failed to register commands to server ${guild.name}:`, err);
            }
        }
    }
};
