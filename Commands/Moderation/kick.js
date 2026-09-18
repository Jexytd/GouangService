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
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(opt =>
            opt.setName('target')
                .setDescription('The member to kick')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('reason')
                .setDescription('Reason for kicking')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),
    cooldown: 3,

    async execute(interaction) {
        const targetUser = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const guild = interaction.guild;

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: '❌ You cannot kick yourself.', ephemeral: true });
        }

        const member = await guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: '❌ Target member is not in this server.', ephemeral: true });
        }

        if (!member.kickable) {
            return interaction.reply({
                content: '🚫 The bot cannot kick this user due to role hierarchy or missing permissions.',
                ephemeral: true
            });
        }

        if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.user.id !== guild.ownerId) {
            return interaction.reply({
                content: '🚫 You cannot kick this user because their role is above or equal to yours.',
                ephemeral: true
            });
        }

        // Try DMing target before kicking
        try {
            const dmEmbed = new EmbedBuilder()
                .setColor(0xf97316)
                .setTitle(`👢 You were kicked from ${guild.name}`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Moderator', value: interaction.user.tag }
                )
                .setTimestamp();
            await targetUser.send({ embeds: [dmEmbed] }).catch(() => {});
        } catch {}

        await member.kick(`${reason} (kicked by ${interaction.user.tag})`);

        const caseRecord = ModerationService.addCase({
            guildId: guild.id,
            targetId: targetUser.id,
            targetTag: targetUser.tag,
            moderatorId: interaction.user.id,
            moderatorTag: interaction.user.tag,
            action: 'KICK',
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

        await interaction.reply({
            content: `👢 **Kicked:** \`${targetUser.tag}\` | Case #${caseRecord.id} | Reason: *${reason}*`
        });
    }
};
