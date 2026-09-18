const {
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder
} = require('discord.js');

const TicketService = require('../../services/TicketService');
const GuildConfigService = require('../../services/GuildConfigService');

async function handleTicketCreate(interaction, category = 'general') {
    const guild = interaction.guild;
    const user = interaction.user;
    const config = GuildConfigService.getConfig(guild.id);

    // 1. Prevent duplicate open tickets
    const existingTicket = TicketService.getOpenTicketForUser(guild.id, user.id);
    if (existingTicket) {
        return interaction.reply({
            content: `⚠️ You already have an open ticket: <#${existingTicket.channelId}>. Please use that channel or wait for it to be closed.`,
            ephemeral: true
        });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        // Build permission overwrites for private channel
        const permissionOverwrites = [
            {
                id: guild.id, // @everyone denied
                deny: [PermissionFlagsBits.ViewChannel]
            },
            {
                id: user.id, // Ticket owner allowed
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ReadMessageHistory
                ]
            },
            {
                id: guild.members.me.id, // Bot allowed
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.EmbedLinks,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ReadMessageHistory
                ]
            }
        ];

        // If staff role configured, allow staff
        if (config.staffRoleId && guild.roles.cache.has(config.staffRoleId)) {
            permissionOverwrites.push({
                id: config.staffRoleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ReadMessageHistory
                ]
            });
        }

        const channel = await guild.channels.create({
            name: `ticket-${user.username.slice(0, 15)}-${Math.floor(1000 + Math.random() * 9000)}`,
            type: ChannelType.GuildText,
            parent: config.ticketCategoryId || null,
            permissionOverwrites
        });

        const ticket = TicketService.createTicket({
            guildId: guild.id,
            channelId: channel.id,
            userId: user.id,
            userTag: user.tag,
            category
        });

        // Send Welcome & Controls in the new Ticket Channel
        const welcomeEmbed = new EmbedBuilder()
            .setColor(0x7c3aed)
            .setTitle(`Support Ticket | ${ticket.id}`)
            .setDescription(`Hello <@${user.id}>! Thank you for reaching out to support.\nStaff has been notified and will assist you shortly.\n\n**Category:** \`${category.toUpperCase()}\`\nPlease describe your inquiry or issue below in detail.`)
            .setTimestamp();

        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`ticket:claim:${ticket.id}`)
                .setLabel('Claim Ticket')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🙋'),
            new ButtonBuilder()
                .setCustomId(`ticket:close:${ticket.id}`)
                .setLabel('Close Ticket')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒')
        );

        await channel.send({
            content: `<@${user.id}> ${config.staffRoleId ? `<@&${config.staffRoleId}>` : ''}`,
            embeds: [welcomeEmbed],
            components: [controlRow]
        });

        await interaction.editReply({
            content: `✅ Your ticket has been created! Head over to <#${channel.id}>.`,
            ephemeral: true
        });
    } catch (err) {
        console.error("Error creating ticket channel:", err);
        await interaction.editReply({
            content: `❌ Failed to create ticket channel. Make sure the bot has the \`Manage Channels\` permission.`,
            ephemeral: true
        });
    }
}

async function handleTicketClaim(interaction) {
    const member = interaction.member;
    const ticket = TicketService.getTicketByChannel(interaction.channelId);

    if (!ticket) {
        return interaction.reply({ content: '❌ Ticket record not found.', ephemeral: true });
    }

    if (ticket.status === 'claimed') {
        return interaction.reply({ content: `⚠️ This ticket is already claimed by <@${ticket.claimedBy?.id}>.`, ephemeral: true });
    }

    TicketService.claimTicket(interaction.channelId, member.id, interaction.user.tag);

    const claimEmbed = new EmbedBuilder()
        .setColor(0x10b981)
        .setDescription(`🙋 **Ticket Claimed!** <@${member.id}> is now handling this ticket.`);

    await interaction.reply({ embeds: [claimEmbed] });
}

async function handleTicketClosePrompt(interaction) {
    const modal = new ModalBuilder()
        .setCustomId(`ticket:close_modal:${interaction.channelId}`)
        .setTitle('Close Support Ticket');

    const reasonInput = new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('Reason for closing')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Issue resolved / User assisted / Inactivity')
        .setRequired(false)
        .setMaxLength(300);

    const row = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

async function handleTicketCloseModal(interaction) {
    const channelId = interaction.customId.split(':')[2];
    const reason = interaction.fields.getTextInputValue('close_reason') || 'Ticket resolved';
    const channel = interaction.guild.channels.cache.get(channelId);

    await interaction.reply({
        content: '🔒 Closing ticket and compiling transcript, channel will be deleted shortly...'
    });

    const ticket = TicketService.getTicketByChannel(channelId);
    if (!ticket) {
        if (channel) await channel.delete('Ticket closed without record');
        return;
    }

    // Fetch messages for transcript
    let rawMessages = [];
    if (channel) {
        try {
            const fetched = await channel.messages.fetch({ limit: 100 });
            rawMessages = Array.from(fetched.values()).reverse().map(m => ({
                author: m.author.tag,
                content: m.cleanContent || m.content || '',
                timestamp: m.createdAt.toISOString(),
                attachments: m.attachments.map(a => a.url)
            }));
        } catch (e) {
            console.error("Failed to fetch messages for transcript:", e);
        }
    }

    TicketService.saveTranscript(channelId, rawMessages);
    TicketService.closeTicket(channelId, interaction.user.tag, reason);

    const transcriptText = TicketService.generateTranscriptText(ticket, rawMessages);
    const transcriptAttachment = new AttachmentBuilder(Buffer.from(transcriptText, 'utf-8'), {
        name: `transcript-${ticket.id}.txt`
    });

    // Send log to configured ticket log channel
    const config = GuildConfigService.getConfig(interaction.guildId);
    if (config.ticketLogChannelId) {
        const logChannel = interaction.guild.channels.cache.get(config.ticketLogChannelId);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setColor(0xef4444)
                .setTitle(`Ticket Closed: ${ticket.id}`)
                .addFields(
                    { name: 'Owner', value: `<@${ticket.userId}> (\`${ticket.userTag}\`)`, inline: true },
                    { name: 'Closed By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: 'Category', value: `\`${ticket.category.toUpperCase()}\``, inline: true },
                    { name: 'Reason', value: reason, inline: false }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [logEmbed], files: [transcriptAttachment] }).catch(err => {
                console.error("Failed to send ticket log:", err);
            });
        }
    }

    // Try sending transcript DM to ticket owner
    try {
        const ownerUser = await interaction.client.users.fetch(ticket.userId);
        if (ownerUser) {
            const dmEmbed = new EmbedBuilder()
                .setColor(0x7c3aed)
                .setTitle(`Your Support Ticket Was Closed`)
                .setDescription(`Your ticket **${ticket.id}** in **${interaction.guild.name}** has been closed.\nA copy of your conversation transcript is attached.`)
                .addFields({ name: 'Reason', value: reason })
                .setTimestamp();

            await ownerUser.send({ embeds: [dmEmbed], files: [transcriptAttachment] }).catch(() => {});
        }
    } catch {}

    // Delete channel after 3 seconds
    setTimeout(async () => {
        if (channel && channel.deletable) {
            await channel.delete(`Ticket ${ticket.id} closed by ${interaction.user.tag}`).catch(() => {});
        }
    }, 3000);
}

module.exports = {
    handleTicketCreate,
    handleTicketClaim,
    handleTicketClosePrompt,
    handleTicketCloseModal
};
