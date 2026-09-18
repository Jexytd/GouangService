const {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');

const ModerationService = require('../../src/services/ModerationService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('View or manage user warning history')
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all warnings for a user')
                .addUserOption(opt =>
                    opt.setName('target')
                        .setDescription('The member whose warnings to inspect')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('clear')
                .setDescription('Clear all warnings for a user')
                .addUserOption(opt =>
                    opt.setName('target')
                        .setDescription('The member whose warnings to clear')
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),
    cooldown: 3,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('target');
        const guildId = interaction.guild.id;

        if (sub === 'list') {
            const warnings = ModerationService.getWarningsForUser(guildId, targetUser.id);

            if (warnings.length === 0) {
                return interaction.reply({
                    content: `ℹ️ <@${targetUser.id}> (\`${targetUser.tag}\`) has **0 warnings** on this server.`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0xf59e0b)
                .setTitle(`Warnings for ${targetUser.tag} (${warnings.length})`)
                .setDescription(
                    warnings.slice(0, 15).map(w =>
                        `• **Case #${w.id}** (<t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:d>): ${w.reason} *(by ${w.moderatorTag})*`
                    ).join('\n')
                )
                .setFooter({ text: warnings.length > 15 ? `Showing first 15 of ${warnings.length} warnings` : '' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'clear') {
            const removed = ModerationService.clearWarnings(guildId, targetUser.id, interaction.user.tag);
            return interaction.reply({
                content: `✅ Successfully cleared \`${removed}\` warning(s) for <@${targetUser.id}>.`
            });
        }
    }
};
