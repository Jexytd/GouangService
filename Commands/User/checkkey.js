const { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, EmbedBuilder } = require('discord.js');
const KeyService = require('../../src/services/KeyService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkkey')
        .setDescription('Check your current whitelist status and active license details')
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),

    async execute(interaction) {
        const discordId = interaction.user.id;
        const key = KeyService.checkUserKey(discordId);

        if (!key) {
            return interaction.reply({
                content: `ℹ️ You do not currently have an active license key redeemed. Use \`/redeem\` or use the free global key with \`/globalkey\`.`,
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x10b981)
            .setTitle('🛡️ Whitelist Status')
            .addFields(
                { name: 'Key Prefix', value: `\`${key.keyPrefix}\``, inline: true },
                { name: 'Tier', value: `**${key.tier.toUpperCase()}**`, inline: true },
                { name: 'Status', value: `\`${key.status.toUpperCase()}\``, inline: true },
                { name: 'Device Bindings', value: `${key.bindingsCount} / ${key.maxClients}`, inline: true },
                { name: 'Expires', value: key.expiresAt ? `<t:${Math.floor(new Date(key.expiresAt).getTime() / 1000)}:F>` : 'Lifetime', inline: true }
            )
            .setFooter({ text: 'Need a device/HWID reset? Ask an administrator.' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
