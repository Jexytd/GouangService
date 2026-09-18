const { Events, EmbedBuilder } = require('discord.js');
const GuildConfigService = require('../../services/GuildConfigService');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message.guild || message.author?.bot) return;

        const config = GuildConfigService.getConfig(message.guild.id);
        if (!config || !config.modLogChannelId) return;

        const logChannel = message.guild.channels.cache.get(config.modLogChannelId);
        if (!logChannel || logChannel.id === message.channelId) return;

        const content = message.content ? (message.content.length > 1000 ? message.content.slice(0, 1000) + '...' : message.content) : '*No text content (embed or attachment)*';

        const embed = new EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle('🗑️ Message Deleted')
            .addFields(
                { name: 'Author', value: message.author ? `<@${message.author.id}> (\`${message.author.tag}\`)` : 'Unknown', inline: true },
                { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
                { name: 'Content', value: content, inline: false }
            )
            .setTimestamp();

        if (message.attachments && message.attachments.size > 0) {
            const fileNames = message.attachments.map(a => a.name).join(', ');
            embed.addFields({ name: 'Attachments', value: fileNames.slice(0, 200) });
        }

        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
};
