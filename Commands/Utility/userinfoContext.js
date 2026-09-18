const {
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    ApplicationIntegrationType,
    InteractionContextType,
    EmbedBuilder
} = require('discord.js');
const KeyService = require('../../src/services/KeyService');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('User Info')
        .setType(ApplicationCommandType.User)
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),
    cooldown: 3,

    async execute(interaction) {
        const targetUser = interaction.targetUser;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        const userKey = KeyService.checkUserKey(targetUser.id);

        const embed = new EmbedBuilder()
            .setColor(0x3b82f6)
            .setTitle(`User Profile: ${targetUser.tag}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { name: '🆔 User ID', value: `\`${targetUser.id}\``, inline: true },
                { name: '🤖 Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true },
                { name: '📅 Registered', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true }
            );

        if (member) {
            const roles = member.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `<@&${r.id}>`);

            embed.addFields(
                { name: '📥 Joined Server', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
                { name: '🔑 Whitelist Status', value: userKey ? `🟢 **${userKey.tier.toUpperCase()}** (\`${userKey.keyPrefix}\`)` : '⚪ No active key', inline: true },
                { name: `🎭 Roles (${roles.length})`, value: roles.length > 0 ? (roles.length > 10 ? roles.slice(0, 10).join(' ') + ` *+${roles.length - 10} more*` : roles.join(' ')) : 'None', inline: false }
            );
        }

        embed.setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
