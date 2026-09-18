const { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const GlobalKeyService = require('../../src/services/GlobalKeyService');
const { isUserAdmin } = require('../../src/bot/permCheck');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setglobalkey')
        .setDescription('[Admin] Configure or toggle the public Global Key')
        .addBooleanOption(option =>
            option.setName('enabled')
                .setDescription('Enable or disable the public global key')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('key')
                .setDescription('New global key string value')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('features')
                .setDescription('Comma-separated feature list (e.g. basic, standard)')
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

        const enabled = interaction.options.getBoolean('enabled');
        const key = interaction.options.getString('key');
        const featuresStr = interaction.options.getString('features');

        const updatePayload = {};
        if (enabled !== null) updatePayload.enabled = enabled;
        if (key !== null) updatePayload.key = key;
        if (featuresStr !== null) {
            updatePayload.features = featuresStr.split(',').map(s => s.trim()).filter(Boolean);
        }

        const updated = GlobalKeyService.updateGlobalKey(updatePayload, `Discord:${interaction.user.id}`);

        const embed = new EmbedBuilder()
            .setColor(updated.enabled ? 0x10b981 : 0xef4444)
            .setTitle('⚙️ Global Key Settings Updated')
            .addFields(
                { name: 'Status', value: updated.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**', inline: true },
                { name: 'Key String', value: `\`${updated.key}\``, inline: true },
                { name: 'Features', value: (updated.features || []).map(f => `\`${f}\``).join(', ') || 'basic', inline: false }
            )
            .setFooter({ text: `Updated by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
