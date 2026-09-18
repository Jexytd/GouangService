const { Events, EmbedBuilder } = require('discord.js');
const GuildConfigService = require('../../services/GuildConfigService');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const config = GuildConfigService.getConfig(member.guild.id);
        if (!config) return;

        // 1. Auto-assign Member Role if configured
        if (config.memberRoleId && member.guild.members.me.permissions.has('ManageRoles')) {
            const role = member.guild.roles.cache.get(config.memberRoleId);
            if (role && role.position < member.guild.members.me.roles.highest.position) {
                await member.roles.add(role, 'Auto-assigned member role on join').catch(err => {
                    console.error(`[GuildMemberAdd] Failed to add auto-role:`, err);
                });
            }
        }

        // 2. Send Welcome Announcement
        if (config.welcomeChannelId) {
            const welcomeChannel = member.guild.channels.cache.get(config.welcomeChannelId);
            if (welcomeChannel) {
                const messageText = (config.welcomeMessage || "Welcome {user} to **{server}**!")
                    .replace(/{user}/g, `<@${member.id}>`)
                    .replace(/{username}/g, member.user.username)
                    .replace(/{server}/g, member.guild.name)
                    .replace(/{memberCount}/g, member.guild.memberCount);

                const embed = new EmbedBuilder()
                    .setColor(0x7c3aed)
                    .setTitle(`👋 Welcome to ${member.guild.name}!`)
                    .setDescription(messageText)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .addFields(
                        { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Member Count', value: `#${member.guild.memberCount}`, inline: true }
                    )
                    .setTimestamp();

                await welcomeChannel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    }
};
