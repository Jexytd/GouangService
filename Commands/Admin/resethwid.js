const { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, PermissionFlagsBits } = require('discord.js');
const KeyService = require('../../src/services/KeyService');
const { isUserAdmin } = require('../../src/bot/permCheck');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resethwid')
        .setDescription('[Admin] Reset HWID / device bindings for a user or key')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The Discord user whose HWID to reset')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('key')
                .setDescription('The license key or key prefix to reset')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),

    async execute(interaction) {
        if (!isUserAdmin(interaction)) {
            return interaction.reply({
                content: `🚫 You do not have permission to execute this administrative command.`,
                ephemeral: true
            });
        }

        const targetUser = interaction.options.getUser('user');
        const targetKey = interaction.options.getString('key');

        if (!targetUser && !targetKey) {
            return interaction.reply({
                content: `⚠️ Please specify either a \`user\` or a \`key\` to reset.`,
                ephemeral: true
            });
        }

        const targetIdentifier = targetUser ? targetUser.id : targetKey.trim();
        const result = KeyService.resetHwid(targetIdentifier, `Discord:${interaction.user.id}`);

        if (!result.success) {
            return interaction.reply({
                content: `❌ ${result.message}`,
                ephemeral: true
            });
        }

        await interaction.reply({
            content: `✅ **HWID Reset:** ${result.message}`,
            ephemeral: true
        });
    }
};
