const {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    EmbedBuilder,
    ChannelType
} = require('discord.js');

const TicketService = require('../../src/services/TicketService');
const { handleTicketClosePrompt } = require('../../src/bot/components/ticketComponents');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Support ticket management commands')
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Post a persistent interactive support ticket panel')
                .addChannelOption(opt =>
                    opt.setName('channel')
                        .setDescription('The channel to post the ticket panel into (default: current channel)')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('title')
                        .setDescription('Panel Title')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('description')
                        .setDescription('Panel Description')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('close')
                .setDescription('Close the current ticket channel')
                .addStringOption(opt =>
                    opt.setName('reason')
                        .setDescription('Reason for closing')
                        .setRequired(false)
                )
        )
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),
    cooldown: 5,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'setup') {
            // Require Manage Guild permission to set up panel
            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({
                    content: '🚫 You need `Manage Server` permission to configure ticket panels.',
                    ephemeral: true
                });
            }

            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
            const title = interaction.options.getString('title') || '🎫 Need Support? Open a Ticket!';
            const description = interaction.options.getString('description') ||
                'Click the button below or choose a specific category from the menu to open a private ticket with our staff team.\n\n• **General Support:** Questions or assistance\n• **Whitelist / Key Issues:** Hardware/HWID resets or key verification\n• **Bug Reports:** Script issues or exploits\n• **Billing & VIP:** Upgrades and licenses';

            const panelEmbed = new EmbedBuilder()
                .setColor(0x7c3aed)
                .setTitle(title)
                .setDescription(description)
                .setFooter({ text: 'Ricoh Shield Support System • 24/7' })
                .setTimestamp();

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket:category_select')
                .setPlaceholder('Choose a support category...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('General Support')
                        .setDescription('General inquiries, questions, or guidance')
                        .setValue('general')
                        .setEmoji('💬'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Whitelist / Key Issue')
                        .setDescription('Help with redeeming, HWID reset, or key expiry')
                        .setValue('key')
                        .setEmoji('🔑'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Bug Report')
                        .setDescription('Report technical issues or script errors')
                        .setValue('bug')
                        .setEmoji('🐛'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('VIP & Billing')
                        .setDescription('Upgrading tier or enterprise licensing')
                        .setValue('billing')
                        .setEmoji('⭐')
                );

            const button = new ButtonBuilder()
                .setCustomId('ticket:create:general')
                .setLabel('Create Ticket')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📩');

            const menuRow = new ActionRowBuilder().addComponents(selectMenu);
            const buttonRow = new ActionRowBuilder().addComponents(button);

            await targetChannel.send({
                embeds: [panelEmbed],
                components: [menuRow, buttonRow]
            });

            return interaction.reply({
                content: `✅ Ticket panel posted to <#${targetChannel.id}>!`,
                ephemeral: true
            });
        }

        if (sub === 'close') {
            const ticket = TicketService.getTicketByChannel(interaction.channelId);
            if (!ticket) {
                return interaction.reply({
                    content: '❌ This command can only be run inside an active ticket channel.',
                    ephemeral: true
                });
            }

            return handleTicketClosePrompt(interaction);
        }
    }
};
