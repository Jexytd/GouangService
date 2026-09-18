const { Events, EmbedBuilder } = require('discord.js');
const GuildConfigService = require('../../services/GuildConfigService');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const config = GuildConfigService.getConfig(member.guild.id);
        if (!config || !config.leaveChannelId) return;

        const leaveChannel = member.guild.channels.cache.get(config.leaveChannelId);
        if (!leaveChannel) return;

        const embed = new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle(`👋 Member Left`)
            .setDescription(`**${member.user.tag}** (\`${member.id}\`) has left the server.`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: 'Joined Server', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
                { name: 'Remaining Members', value: `${member.guild.memberCount}`, inline: true }
            )
            .setTimestamp();

        await leaveChannel.send({ embeds: [embed] }).catch(() => {});
    }
};
