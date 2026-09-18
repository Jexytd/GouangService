const {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    EmbedBuilder,
    ChannelType
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Display detailed statistics and information about this Discord server')
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),
    cooldown: 5,

    async execute(interaction) {
        const guild = interaction.guild;
        await guild.fetch();

        const owner = await guild.fetchOwner().catch(() => null);
        const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
        const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
        const rolesCount = guild.roles.cache.size;
        const emojisCount = guild.emojis.cache.size;

        const embed = new EmbedBuilder()
            .setColor(0x7c3aed)
            .setTitle(`Server Information: ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
            .addFields(
                { name: '👑 Server Owner', value: owner ? `<@${owner.id}> (\`${owner.user.tag}\`)` : 'Unknown', inline: true },
                { name: '🆔 Server ID', value: `\`${guild.id}\``, inline: true },
                { name: '📅 Created On', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`, inline: false },
                { name: '👥 Total Members', value: `\`${guild.memberCount}\` members`, inline: true },
                { name: '🚀 Server Boosts', value: `Level \`${guild.premiumTier}\` (${guild.premiumSubscriptionCount || 0} boosts)`, inline: true },
                { name: '🛡️ Verification Level', value: `\`${guild.verificationLevel}\``, inline: true },
                { name: '💬 Channels', value: `📝 \`${textChannels}\` Text | 🔊 \`${voiceChannels}\` Voice | 📁 \`${categories}\` Categories`, inline: false },
                { name: '🎭 Roles & Emojis', value: `\`${rolesCount}\` roles | \`${emojisCount}\` emojis`, inline: false }
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        if (guild.bannerURL()) {
            embed.setImage(guild.bannerURL({ size: 1024 }));
        }

        await interaction.reply({ embeds: [embed] });
    }
};
