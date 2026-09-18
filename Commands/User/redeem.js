const { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, EmbedBuilder } = require('discord.js');
const KeyService = require('../../src/services/KeyService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('redeem')
        .setDescription('Redeem and link a whitelist license key to your Discord account')
        .addStringOption(option =>
            option.setName('key')
                .setDescription('The license key you received')
                .setRequired(true)
        )
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),

    async execute(interaction) {
        const inputKey = interaction.options.getString('key').trim();
        const discordId = interaction.user.id;

        const result = KeyService.redeemKey({ key: inputKey, discordId });

        if (!result.success) {
            return interaction.reply({
                content: `**Redeem Failed:** ${result.message}`,
                ephemeral: true
            });
        }

        const key = result.keyRecord;
        const embed = new EmbedBuilder()
            .setColor(0x7c3aed)
            .setTitle('Whitelist Key Redeemed!')
            .setDescription(`Your license key has been successfully activated and bound to your account.`)
            .addFields(
                { name: 'Key Identifier', value: `\`${key.keyPrefix}\``, inline: true },
                { name: 'Tier', value: `**${key.tier.toUpperCase()}**`, inline: true },
                { name: 'Max Devices', value: `${key.maxClients}`, inline: true },
                { name: 'Expires', value: key.expiresAt ? `<t:${Math.floor(new Date(key.expiresAt).getTime() / 1000)}:R>` : 'Lifetime', inline: true }
            )
            .setFooter({ text: 'You can now launch the script in Roblox.' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
