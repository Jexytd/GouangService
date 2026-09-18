const { Events } = require('discord.js');
const { handleComponentInteraction } = require('../handlers/componentHandler');
const { checkCooldown } = require('../utils/cooldown');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        // 1. Handle Slash Commands & Context Menu Commands
        if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.warn(`[Discord Bot] No command matching ${interaction.commandName} was found.`);
                return;
            }

            // Check Cooldown (default 3 seconds, or command.cooldown)
            const cooldownTime = command.cooldown !== undefined ? command.cooldown : 2;
            const cooldownCheck = checkCooldown(interaction.user.id, interaction.commandName, cooldownTime);
            if (cooldownCheck.onCooldown) {
                return interaction.reply({
                    content: `⏳ Please wait \`${cooldownCheck.remaining}s\` before using \`/${interaction.commandName}\` again.`,
                    ephemeral: true
                });
            }

            try {
                await command.execute(interaction);
            } catch (err) {
                console.error(`[Discord Bot] Error executing /${interaction.commandName}:`, err);
                const replyPayload = {
                    content: '❌ An error occurred while executing this command.',
                    ephemeral: true
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(replyPayload).catch(() => {});
                } else {
                    await interaction.reply(replyPayload).catch(() => {});
                }
            }
            return;
        }

        // 2. Handle Components (Buttons, Select Menus, Modals, Autocomplete)
        try {
            await handleComponentInteraction(interaction);
        } catch (err) {
            console.error(`[Discord Bot] Error in component interaction:`, err);
            const replyPayload = {
                content: '❌ An error occurred while processing this interaction.',
                ephemeral: true
            };
            if (interaction.isRepliable && interaction.isRepliable()) {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(replyPayload).catch(() => {});
                } else {
                    await interaction.reply(replyPayload).catch(() => {});
                }
            }
        }
    }
};
