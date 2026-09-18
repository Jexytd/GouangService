const {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
    EmbedBuilder,
    version: djsVersion
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('botinfo')
        .setDescription('Display bot statistics, latency, memory usage, and uptime')
        .setIntegrationTypes([ApplicationIntegrationType.GuildInstall])
        .setContexts([InteractionContextType.Guild]),
    cooldown: 3,

    async execute(interaction) {
        const client = interaction.client;
        const uptimeSeconds = Math.floor(process.uptime());
        const days = Math.floor(uptimeSeconds / (3600 * 24));
        const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;

        const memUsage = process.memoryUsage();
        const heapUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
        const rssMB = (memUsage.rss / 1024 / 1024).toFixed(2);

        const totalGuilds = client.guilds.cache.size;
        const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

        const embed = new EmbedBuilder()
            .setColor(0x7c3aed)
            .setTitle('🤖 Ricoh Shield Bot Status')
            .setThumbnail(client.user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: '⚡ WebSocket Latency', value: `\`${client.ws.ping} ms\``, inline: true },
                { name: '⏱️ Process Uptime', value: `\`${uptimeStr}\``, inline: true },
                { name: '🧠 Memory Usage', value: `Heap: \`${heapUsedMB} MB\` (RSS: \`${rssMB} MB\`)`, inline: true },
                { name: '🌐 Guilds Cached', value: `\`${totalGuilds}\` servers`, inline: true },
                { name: '👥 Users Cached', value: `\`${totalMembers}\` users`, inline: true },
                { name: '⚙️ Runtime Environment', value: `Node \`${process.version}\` | D.js \`v${djsVersion}\``, inline: true }
            )
            .setFooter({ text: 'Ricoh Shield Cloud 2026 Edition' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
