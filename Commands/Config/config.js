const {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType
} = require('discord.js');

const GuildConfigService = require('../../src/services/GuildConfigService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configure bot settings, logging channels, and roles for this server')
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View current guild configuration')
        )
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Update guild configuration channels and roles')
                .addChannelOption(opt =>
                    opt.setName('mod_log_channel')
                        .setDescription('Channel where moderation actions and deleted messages are logged')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addChannelOption(opt =>
                    opt.setName('welcome_channel')
                        .setDescription('Channel where new members are welcomed')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addChannelOption(opt =>
                    opt.setName('leave_channel')
                        .setDescription('Channel where member departures are logged')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addChannelOption(opt =>
                    opt.setName('ticket_log_channel')
                        .setDescription('Channel where ticket transcripts and closures are logged')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(false)
                )
                .addChannelOption(opt =>
                    opt.setName('ticket_category')
                        .setDescription('Category channel where new tickets will be placed')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(false)
                )
                .addRoleOption(opt =>
                    opt.setName('staff_role')
                        .setDescription('Staff / Support role allowed to view and claim tickets')
                        .setRequired(false)
                )
                .addRoleOption(opt =>
                    opt.setName('member_role')
                        .setDescription('Default member role auto-assigned when users join')
                        .setRequired(false)
                )
                .addRoleOption(opt =>
                    opt.setName('verification_role')
                        .setDescription('Role granted when users complete server verification')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('welcome_message')
                        .setDescription('Custom welcome text (Available placeholders: {user}, {username}, {server})')
                        .setRequired(false)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),
    cooldown: 5,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'view') {
            const config = GuildConfigService.getConfig(guildId);

            const embed = new EmbedBuilder()
                .setColor(0x7c3aed)
                .setTitle(`⚙️ Server Settings: ${interaction.guild.name}`)
                .addFields(
                    { name: '🛡️ Mod Log Channel', value: config.modLogChannelId ? `<#${config.modLogChannelId}>` : '*Not Set*', inline: true },
                    { name: '👋 Welcome Channel', value: config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : '*Not Set*', inline: true },
                    { name: '🚪 Leave Channel', value: config.leaveChannelId ? `<#${config.leaveChannelId}>` : '*Not Set*', inline: true },
                    { name: '🎫 Ticket Log Channel', value: config.ticketLogChannelId ? `<#${config.ticketLogChannelId}>` : '*Not Set*', inline: true },
                    { name: '📂 Ticket Category', value: config.ticketCategoryId ? `<#${config.ticketCategoryId}>` : '*Not Set*', inline: true },
                    { name: '👮 Staff Role', value: config.staffRoleId ? `<@&${config.staffRoleId}>` : '*Not Set*', inline: true },
                    { name: '👥 Member Auto-Role', value: config.memberRoleId ? `<@&${config.memberRoleId}>` : '*Not Set*', inline: true },
                    { name: '✅ Verification Role', value: config.verificationRoleId ? `<@&${config.verificationRoleId}>` : '*Not Set*', inline: true },
                    { name: '💬 Welcome Template', value: `\`${config.welcomeMessage || 'Default'}\``, inline: false }
                )
                .setFooter({ text: 'Use /config set to update any option' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'set') {
            const updates = {};
            const modLogChannel = interaction.options.getChannel('mod_log_channel');
            const welcomeChannel = interaction.options.getChannel('welcome_channel');
            const leaveChannel = interaction.options.getChannel('leave_channel');
            const ticketLogChannel = interaction.options.getChannel('ticket_log_channel');
            const ticketCategory = interaction.options.getChannel('ticket_category');
            const staffRole = interaction.options.getRole('staff_role');
            const memberRole = interaction.options.getRole('member_role');
            const verificationRole = interaction.options.getRole('verification_role');
            const welcomeMessage = interaction.options.getString('welcome_message');

            if (modLogChannel) updates.modLogChannelId = modLogChannel.id;
            if (welcomeChannel) updates.welcomeChannelId = welcomeChannel.id;
            if (leaveChannel) updates.leaveChannelId = leaveChannel.id;
            if (ticketLogChannel) updates.ticketLogChannelId = ticketLogChannel.id;
            if (ticketCategory) updates.ticketCategoryId = ticketCategory.id;
            if (staffRole) updates.staffRoleId = staffRole.id;
            if (memberRole) updates.memberRoleId = memberRole.id;
            if (verificationRole) updates.verificationRoleId = verificationRole.id;
            if (welcomeMessage) updates.welcomeMessage = welcomeMessage;

            if (Object.keys(updates).length === 0) {
                return interaction.reply({
                    content: '⚠️ Please select at least one channel, role, or message option to update.',
                    ephemeral: true
                });
            }

            const updatedConfig = GuildConfigService.updateConfig(guildId, updates, interaction.user.tag);

            const changedFields = Object.keys(updates).map(k => `• \`${k}\``).join('\n');
            const embed = new EmbedBuilder()
                .setColor(0x10b981)
                .setTitle('✅ Configuration Updated')
                .setDescription(`Successfully updated settings for **${interaction.guild.name}**:\n\n${changedFields}`)
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
