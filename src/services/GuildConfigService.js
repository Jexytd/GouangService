const db = require('../database');
const LogService = require('./LogService');

class GuildConfigService {
    static getDefaultConfig(guildId) {
        return {
            guildId,
            modLogChannelId: null,
            welcomeChannelId: null,
            welcomeMessage: "Welcome {user} to **{server}**! Enjoy your stay.",
            leaveChannelId: null,
            memberRoleId: null,
            staffRoleId: null,
            ticketCategoryId: null,
            ticketLogChannelId: null,
            verificationRoleId: null,
            updatedAt: new Date().toISOString()
        };
    }

    static getConfig(guildId) {
        if (!guildId) return null;
        const data = db.getData();
        if (!data.guildConfigs) data.guildConfigs = [];

        let config = data.guildConfigs.find(c => c.guildId === guildId);
        if (!config) {
            config = this.getDefaultConfig(guildId);
            data.guildConfigs.push(config);
            db.save();
        }
        return config;
    }

    static updateConfig(guildId, updates = {}, actor = 'SYSTEM') {
        if (!guildId) return null;
        const data = db.getData();
        if (!data.guildConfigs) data.guildConfigs = [];

        let config = data.guildConfigs.find(c => c.guildId === guildId);
        if (!config) {
            config = this.getDefaultConfig(guildId);
            data.guildConfigs.push(config);
        }

        const allowedKeys = [
            'modLogChannelId',
            'welcomeChannelId',
            'welcomeMessage',
            'leaveChannelId',
            'memberRoleId',
            'staffRoleId',
            'ticketCategoryId',
            'ticketLogChannelId',
            'verificationRoleId'
        ];

        for (const key of allowedKeys) {
            if (updates[key] !== undefined) {
                config[key] = updates[key];
            }
        }

        config.updatedAt = new Date().toISOString();
        db.save();

        LogService.addAuditLog({
            actor,
            action: 'GUILD_CONFIG_UPDATED',
            targetId: guildId,
            metadata: updates
        });

        return config;
    }

    static getAllConfigs() {
        const data = db.getData();
        return data.guildConfigs || [];
    }
}

module.exports = GuildConfigService;
