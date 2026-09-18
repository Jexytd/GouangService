const { EmbedBuilder } = require('discord.js');
const GuildConfigService = require('../../services/GuildConfigService');

async function handleVerifyClick(interaction) {
    const guild = interaction.guild;
    const member = interaction.member;
    const config = GuildConfigService.getConfig(guild.id);

    const roleId = config.verificationRoleId || config.memberRoleId;

    if (!roleId) {
        return interaction.reply({
            content: '⚠️ No verified or member role has been configured on this server yet. Ask an administrator to run `/config role_verified: <role>` or `/config role_member: <role>`.',
            ephemeral: true
        });
    }

    const role = guild.roles.cache.get(roleId);
    if (!role) {
        return interaction.reply({
            content: '❌ Configured verification role could not be found. Please contact staff.',
            ephemeral: true
        });
    }

    if (member.roles.cache.has(role.id)) {
        return interaction.reply({
            content: `ℹ️ You are already verified and have the <@&${role.id}> role!`,
            ephemeral: true
        });
    }

    // Check bot permission
    if (!guild.members.me.permissions.has('ManageRoles')) {
        return interaction.reply({
            content: '❌ The bot lacks `Manage Roles` permission to assign your verification role.',
            ephemeral: true
        });
    }

    if (role.position >= guild.members.me.roles.highest.position) {
        return interaction.reply({
            content: '❌ The bot cannot assign this role because the role is higher than or equal to the bot’s highest role in server settings.',
            ephemeral: true
        });
    }

    try {
        await member.roles.add(role, 'User completed server verification flow');

        const successEmbed = new EmbedBuilder()
            .setColor(0x10b981)
            .setTitle('✅ Verification Successful!')
            .setDescription(`Welcome to **${guild.name}**! You have been granted the <@&${role.id}> role and unlocked access to the server.`)
            .setTimestamp();

        await interaction.reply({
            embeds: [successEmbed],
            ephemeral: true
        });
    } catch (err) {
        console.error("Failed to assign verification role:", err);
        await interaction.reply({
            content: '❌ An error occurred while assigning your role. Please try again or contact staff.',
            ephemeral: true
        });
    }
}

module.exports = { handleVerifyClick };
