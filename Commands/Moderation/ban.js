const {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');

const ModerationService = require('../../src/services/ModerationService');
const GuildConfigService = require('../../src/services/GuildConfigService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban or unban a user from the server')
        .addSubcommand(sub =>
            sub.setName('user')
                .setDescription('Ban a user from the server')
                .addUserOption(opt =>
                    opt.setName('target')
                        .setDescription('The user to ban')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('reason')
                        .setDescription('Reason for banning')
                        .setRequired(false)
                )
                .addIntegerOption(opt =>
                    opt.setName('delete_message_days')
                        .setDescription('Number of days of messages to delete (0-7)')
                        .setMinValue(0)
                        .setMaxValue(7)
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('unban')
                .setDescription('Unban a previously banned user by ID')
                .addStringOption(opt =>
                    opt.setName('user_id')
                        .setDescription('The Discord User ID to unban')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('reason')
                        .setDescription('Reason for unbanning')
                        .setRequired(false)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),
    cooldown: 3,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const config = GuildConfigService.getConfig(guild.id);

        if (sub === 'user') {
            const targetUser = interaction.options.getUser('target');
            const reason = interaction.options.getString('reason') || 'No reason provided';
            const deleteDays = interaction.options.getInteger('delete_message_days') || 0;

            if (targetUser.id === interaction.user.id) {
                return interaction.reply({ content: '❌ You cannot ban yourself.', ephemeral: true });
            }

            const member = await guild.members.fetch(targetUser.id).catch(() => null);
            if (member) {
                if (!member.bannable) {
                    return interaction.reply({
                        content: '🚫 The bot cannot ban this user due to role hierarchy or missing permissions.',
                        ephemeral: true
                    });
                }

                if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== guild.ownerId) {
                    return interaction.reply({
                        content: '🚫 You cannot ban this user because their role is above or equal to yours.',
                        ephemeral: true
                    });
                }
            }

            // DM user
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor(0xef4444)
                    .setTitle(`🔨 You were banned from ${guild.name}`)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Moderator', value: interaction.user.tag }
                    )
                    .setTimestamp();
                await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
            } catch {}

            await guild.members.ban(targetUser.id, {
                deleteMessageSeconds: deleteDays * 86400,
                reason: `${reason} (banned by ${interaction.user.tag})`
            });

            const caseRecord = ModerationService.addCase({
                guildId: guild.id,
                targetId: targetUser.id,
                targetTag: targetUser.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                action: 'BAN',
                reason
            });

            if (config.modLogChannelId) {
                const modChannel = guild.channels.cache.get(config.modLogChannelId);
                if (modChannel) {
                    const logEmbed = ModerationService.buildLogEmbed(caseRecord);
                    await modChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }

            return interaction.reply({
                content: `🔨 **Banned:** \`${targetUser.tag}\` | Case #${caseRecord.id} | Reason: *${reason}*`
            });
        }

        if (sub === 'unban') {
            const userId = interaction.options.getString('user_id').trim();
            const reason = interaction.options.getString('reason') || 'No reason provided';

            try {
                const banInfo = await guild.bans.fetch(userId).catch(() => null);
                if (!banInfo) {
                    return interaction.reply({
                        content: `❌ User with ID \`${userId}\` is not currently banned on this server.`,
                        ephemeral: true
                    });
                }

                await guild.members.unban(userId, `${reason} (unbanned by ${interaction.user.tag})`);

                const caseRecord = ModerationService.addCase({
                    guildId: guild.id,
                    targetId: userId,
                    targetTag: banInfo.user ? banInfo.user.tag : `User:${userId}`,
                    moderatorId: interaction.user.id,
                    moderatorTag: interaction.user.tag,
                    action: 'UNBAN',
                    reason
                });

                if (config.modLogChannelId) {
                    const modChannel = guild.channels.cache.get(config.modLogChannelId);
                    if (modChannel) {
                        const logEmbed = ModerationService.buildLogEmbed(caseRecord);
                        await modChannel.send({ embeds: [logEmbed] }).catch(() => {});
                    }
                }

                return interaction.reply({
                    content: `✅ **Unbanned:** <@${userId}> (\`${banInfo.user?.tag || userId}\`) | Case #${caseRecord.id} | Reason: *${reason}*`
                });
            } catch (err) {
                return interaction.reply({
                    content: `❌ Failed to unban user: ${err.message}`,
                    ephemeral: true
                });
            }
        }
    }
};
