const {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    EmbedBuilder
} = require('discord.js');
const KeyService = require('../../src/services/KeyService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Display detailed profile and membership info for a user')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to view info about (default: yourself)')
                .setRequired(false)
        )
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),
    cooldown: 3,

    async execute(interaction) {
        const targetUser = interaction.options.getUser('target') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        // Check if user has an active whitelist key
        const userKey = KeyService.checkUserKey(targetUser.id);

        const embed = new EmbedBuilder()
            .setColor(0x3b82f6)
            .setTitle(`User Profile: ${targetUser.tag}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { name: '🆔 User ID', value: `\`${targetUser.id}\``, inline: true },
                { name: '🤖 Bot Account', value: targetUser.bot ? 'Yes' : 'No', inline: true },
                { name: '📅 Registered', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true }
            );

        if (member) {
            const roles = member.roles.cache
                .filter(r => r.id !== interaction.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(r => `<@&${r.id}>`);

            embed.addFields(
                { name: '📥 Joined Server', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
                { name: '🎨 Highest Role', value: member.roles.highest ? `<@&${member.roles.highest.id}>` : 'None', inline: true },
                { name: '🔑 Whitelist Status', value: userKey ? `🟢 **${userKey.tier.toUpperCase()}** (\`${userKey.keyPrefix}\`)` : '⚪ No active key', inline: true },
                { name: `🎭 Roles (${roles.length})`, value: roles.length > 0 ? (roles.length > 15 ? roles.slice(0, 15).join(' ') + ` *+${roles.length - 15} more*` : roles.join(' ')) : 'None', inline: false }
            );
        } else {
            embed.addFields(
                { name: '📥 Joined Server', value: '*User is not currently in this server*', inline: false }
            );
        }

        embed.setFooter({ text: `Requested by ${interaction.user.tag}` }).setTimestamp();
        await interaction.reply({ embeds: [embed] });
    }
};
