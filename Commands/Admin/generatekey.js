const { SlashCommandBuilder, ApplicationIntegrationType, InteractionContextType, EmbedBuilder } = require('discord.js');
const KeyService = require('../../src/services/KeyService');
const { isUserAdmin } = require('../../src/bot/permCheck');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('generatekey')
        .setDescription('[Admin] Generate a new whitelist license key')
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duration in days (0 for lifetime)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('tier')
                .setDescription('Key license tier')
                .setRequired(false)
                .addChoices(
                    { name: 'Premium', value: 'premium' },
                    { name: 'Enterprise', value: 'enterprise' },
                    { name: 'Free/Basic', value: 'free' }
                )
        )
        .addIntegerOption(option =>
            option.setName('max_devices')
                .setDescription('Maximum client/device bindings (Default: 1)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('note')
                .setDescription('Optional admin note or user tag')
                .setRequired(false)
        )
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),

    async execute(interaction) {
        if (!isUserAdmin(interaction)) {
            return interaction.reply({
                content: `🚫 You do not have permission to execute this administrative command.`,
                ephemeral: true
            });
        }

        const duration = interaction.options.getInteger('duration');
        const tier = interaction.options.getString('tier') || 'premium';
        const maxClients = interaction.options.getInteger('max_devices') || 1;
        const note = interaction.options.getString('note') || `Generated via Discord by ${interaction.user.tag}`;

        const { plainKey, keyRecord } = KeyService.createKey({
            tier,
            durationDays: duration,
            maxClients,
            createdBy: `Discord:${interaction.user.id}`,
            note
        });

        const embed = new EmbedBuilder()
            .setColor(0x7c3aed)
            .setTitle('🔑 New License Key Created')
            .setDescription(`⚠️ **Copy this key immediately!** Plaintext keys are hashed and cannot be retrieved again from the server.`)
            .addFields(
                { name: 'Plain Key', value: `\`\`\`${plainKey}\`\`\`` },
                { name: 'Tier', value: `\`${keyRecord.tier.toUpperCase()}\``, inline: true },
                { name: 'Max Devices', value: `${keyRecord.maxClients}`, inline: true },
                { name: 'Duration', value: duration > 0 ? `${duration} Days` : 'Lifetime', inline: true }
            )
            .setFooter({ text: `Created by ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
