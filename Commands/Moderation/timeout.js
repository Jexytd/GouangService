const {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    PermissionFlagsBits
} = require('discord.js');

const ModerationService = require('../../src/services/ModerationService');
const GuildConfigService = require('../../src/services/GuildConfigService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Apply or remove a timeout (mute) for a server member')
        .addSubcommand(sub =>
            sub.setName('apply')
                .setDescription('Timeout a member for a specified duration')
                .addUserOption(opt =>
                    opt.setName('target')
                        .setDescription('The member to timeout')
                        .setRequired(true)
                )
                .addIntegerOption(opt =>
                    opt.setName('duration')
                        .setDescription('Duration amount')
                        .setRequired(true)
                        .setMinValue(1)
                )
                .addStringOption(opt =>
                    opt.setName('unit')
                        .setDescription('Time unit')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Minutes', value: 'm' },
                            { name: 'Hours', value: 'h' },
                            { name: 'Days', value: 'd' }
                        )
                )
                .addStringOption(opt =>
                    opt.setName('reason')
                        .setDescription('Reason for timeout')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove timeout from a member early')
                .addUserOption(opt =>
                    opt.setName('target')
                        .setDescription('The member to untimeout')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('reason')
                        .setDescription('Reason for removal')
                        .setRequired(false)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),
    cooldown: 3,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const guild = interaction.guild;

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: '❌ You cannot timeout yourself.', ephemeral: true });
        }

        const member = await guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '❌ Target member is not in this server.', ephemeral: true });
        }

        // Check if bot has ModerateMembers permission
        if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: '❌ The bot lacks `Moderate Members` permission.', ephemeral: true });
        }

        // Hierarchy check
        if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== guild.ownerId) {
            return interaction.reply({
                content: '🚫 You cannot timeout this user because their highest role is above or equal to yours.',
                ephemeral: true
            });
        }
        if (member.roles.highest.position >= guild.members.me.roles.highest.position) {
            return interaction.reply({
                content: '🚫 The bot cannot timeout this user because their role is above or equal to the bot’s role.',
                ephemeral: true
            });
        }

        if (sub === 'apply') {
            const amount = interaction.options.getInteger('duration');
            const unit = interaction.options.getString('unit');

            let multiplier = 60 * 1000; // minutes
            if (unit === 'h') multiplier = 3600 * 1000;
            if (unit === 'd') multiplier = 24 * 3600 * 1000;

            const durationMs = amount * multiplier;
            // Discord max timeout is 28 days
            const maxDurationMs = 28 * 24 * 3600 * 1000;
            if (durationMs > maxDurationMs) {
                return interaction.reply({
                    content: '❌ Timeout duration cannot exceed 28 days.',
                    ephemeral: true
                });
            }

            const unitName = unit === 'm' ? 'minute(s)' : unit === 'h' ? 'hour(s)' : 'day(s)';
            const durationLabel = `${amount} ${unitName}`;

            await member.timeout(durationMs, `${reason} (by ${interaction.user.tag})`);

            const caseRecord = ModerationService.addCase({
                guildId: guild.id,
                targetId: targetUser.id,
                targetTag: targetUser.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                action: 'TIMEOUT',
                reason,
                duration: durationLabel
            });

            // Log to mod channel
            const config = GuildConfigService.getConfig(guild.id);
            if (config.modLogChannelId) {
                const modChannel = guild.channels.cache.get(config.modLogChannelId);
                if (modChannel) {
                    const logEmbed = ModerationService.buildLogEmbed(caseRecord);
                    await modChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }

            return interaction.reply({
                content: `🔇 **Timed Out:** <@${targetUser.id}> for \`${durationLabel}\` | Case #${caseRecord.id} | Reason: *${reason}*`
            });
        }

        if (sub === 'remove') {
            await member.timeout(null, `Timeout removed by ${interaction.user.tag}: ${reason}`);

            const caseRecord = ModerationService.addCase({
                guildId: guild.id,
                targetId: targetUser.id,
                targetTag: targetUser.tag,
                moderatorId: interaction.user.id,
                moderatorTag: interaction.user.tag,
                action: 'UNTIMEOUT',
                reason
            });

            // Log to mod channel
            const config = GuildConfigService.getConfig(guild.id);
            if (config.modLogChannelId) {
                const modChannel = guild.channels.cache.get(config.modLogChannelId);
                if (modChannel) {
                    const logEmbed = ModerationService.buildLogEmbed(caseRecord);
                    await modChannel.send({ embeds: [logEmbed] }).catch(() => {});
                }
            }

            return interaction.reply({
                content: `🔊 **Timeout Removed:** <@${targetUser.id}> | Case #${caseRecord.id} | Reason: *${reason}*`
            });
        }
    }
};
