const {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ChannelType
} = require('discord.js');

const GuildConfigService = require('../../src/services/GuildConfigService');
const { handleVerifyClick } = require('../../src/bot/components/verifyComponents');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Server member verification system')
        .addSubcommand(sub =>
            sub.setName('panel')
                .setDescription('Post a persistent verification button panel into a channel')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('Channel to post the verification panel in (default: current)')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('The role granted upon successful verification')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('me')
                .setDescription('Verify your account directly')
        )
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),
    cooldown: 5,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'panel') {
            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({
                    content: '🚫 You need `Manage Server` permissions to set up the verification panel.',
                    ephemeral: true
                });
            }

            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
            const role = interaction.options.getRole('role');

            if (role) {
                GuildConfigService.updateConfig(interaction.guildId, { verificationRoleId: role.id }, interaction.user.tag);
            }

            const panelEmbed = new EmbedBuilder()
                .setColor(0x10b981)
                .setTitle('🛡️ Member Verification')
                .setDescription(
                    'Welcome to the server! To protect our community from automated bots and raids, please verify your membership.\n\n' +
                    'Click the **Verify** button below to complete verification and gain full access to the server channels.'
                )
                .setFooter({ text: 'Ricoh Shield Security' })
                .setTimestamp();

            const verifyButton = new ButtonBuilder()
                .setCustomId('verify:click')
                .setLabel('Verify Membership')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🛡️');

            const row = new ActionRowBuilder().addComponents(verifyButton);

            await targetChannel.send({
                embeds: [panelEmbed],
                components: [row]
            });

            return interaction.reply({
                content: `✅ Verification panel posted in <#${targetChannel.id}>!${role ? ` Assigned role: <@&${role.id}>.` : ''}`,
                ephemeral: true
            });
        }

        if (sub === 'me') {
            return handleVerifyClick(interaction);
        }
    }
};
