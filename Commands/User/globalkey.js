const { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, EmbedBuilder } = require('discord.js');
const GlobalKeyService = require('../../src/services/GlobalKeyService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('globalkey')
        .setDescription('View the public free-trial global key and its features')
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),

    async execute(interaction) {
        const globalKey = GlobalKeyService.getGlobalKey();

        if (!globalKey.enabled) {
            return interaction.reply({
                content: `⚠️ The public Global Key is currently **disabled**. You must have an individual key redeemed to use the script.`,
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x3b82f6)
            .setTitle('🌐 Public Global Access Key')
            .setDescription(`Anyone can use this global key without generating or redeeming a personal license. It includes basic features.`)
            .addFields(
                { name: 'Global Key', value: `\`\`\`${globalKey.key}\`\`\`` },
                { name: 'Tier', value: `\`${globalKey.tier.toUpperCase()}\``, inline: true },
                { name: 'Included Features', value: (globalKey.features || ['basic']).map(f => `• \`${f}\``).join('\n'), inline: true },
                { name: 'Limitations', value: 'Does not grant access to Premium/VIP modules.', inline: false }
            )
            .setFooter({ text: 'Upgrade to a personal license for advanced & full features.' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
