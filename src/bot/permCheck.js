const config = require('../config');

function isUserAdmin(interaction) {
    // 1. Owner ID bypass
    if (config.ownerId && interaction.user.id === config.ownerId) {
        return true;
    }

    // 2. Check if user has any of the admin role IDs
    if (interaction.member && interaction.member.roles && config.adminRoleIds.length > 0) {
        const hasRole = interaction.member.roles.cache.some(role => config.adminRoleIds.includes(role.id));
        if (hasRole) return true;
    }

    // 3. Guild Administrator permission fallback
    if (interaction.memberPermissions && interaction.memberPermissions.has('Administrator')) {
        return true;
    }

    return false;
}

module.exports = { isUserAdmin };
