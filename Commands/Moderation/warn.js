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
        .setName('warn')
        .setDescription('Issue a formal warning to a server member')
        .addUserOption(opt =>
            opt.setName('target')
                .setDescription('The member to warn')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),
    cooldown: 3,

    async execute(interaction) {
        const targetUser = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason');
        const guild = interaction.guild;

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: '❌ You cannot warn yourself.', ephemeral: true });
        }
        if (targetUser.bot) {
            return interaction.reply({ content: '❌ You cannot warn a bot account.', ephemeral: true });
        }

        const member = await guild.members.fetch(targetUser.id).catch(() => null);
        if (member) {
            // Role hierarchy check
            if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== guild.ownerId) {
                return interaction.reply({
                    content: '🚫 You cannot warn this user because their role is higher than or equal to yours.',
                    ephemeral: true
                });
            }
        }

        const caseRecord = ModerationService.addCase({
            guildId: guild.id,
            targetId: targetUser.id,
            targetTag: targetUser.tag,
            moderatorId: interaction.user.id,
            moderatorTag: interaction.user.tag,
            action: 'WARN',
            reason
        });

        const userWarnings = ModerationService.getWarningsForUser(guild.id, targetUser.id);

        // Try DMing target
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor(0xf59e0b)
                .setTitle(`⚠️ Warning Received from ${guild.name}`)
                .setDescription(`You have received a formal warning on **${guild.name}**.`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Total Warnings', value: `${userWarnings.length}`, inline: true }
                )
                .setTimestamp();
            await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch {}

        // Send log embed to mod log channel if configured
        const config = GuildConfigService.getConfig(guild.id);
        if (config.modLogChannelId) {
            const modChannel = guild.channels.cache.get(config.modLogChannelId);
            if (modChannel) {
                const logEmbed = ModerationService.buildLogEmbed(caseRecord);
                await modChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        }

        await interaction.reply({
            content: `⚠️ **Warned:** <@${targetUser.id}> (\`${targetUser.tag}\`) | Case #${caseRecord.id} | Reason: *${reason}* (Total Warnings: \`${userWarnings.length}\`)`
        });
    }
};
