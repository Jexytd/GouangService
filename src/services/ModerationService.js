const { EmbedBuilder } = require('discord.js');
const db = require('../database');
const LogService = require('./LogService');

class ModerationService {
    static getNextCaseId(guildId) {
        const data = db.getData();
        if (!data.moderationCases) data.moderationCases = [];
        const guildCases = data.moderationCases.filter(c => c.guildId === guildId);
        return guildCases.length + 1;
    }

    static addCase({ guildId, targetId, targetTag, moderatorId, moderatorTag, action, reason = 'No reason provided', duration = null }) {
        const data = db.getData();
        if (!data.moderationCases) data.moderationCases = [];

        const caseId = this.getNextCaseId(guildId);
        const caseRecord = {
            id: caseId,
            guildId,
            targetId,
            targetTag: targetTag || `User:${targetId}`,
            moderatorId,
            moderatorTag: moderatorTag || `Mod:${moderatorId}`,
            action: action.toUpperCase(),
            reason: reason || 'No reason provided',
            duration,
            createdAt: new Date().toISOString()
        };

        data.moderationCases.unshift(caseRecord);
        // Keep maximum 5000 cases in database
        if (data.moderationCases.length > 5000) {
            data.moderationCases = data.moderationCases.slice(0, 5000);
        }
        db.save();

        LogService.addAuditLog({
            actor: moderatorTag,
            action: `MOD_${action.toUpperCase()}`,
            targetId,
            metadata: { caseId, guildId, reason, duration }
        });

        return caseRecord;
    }

    static getCasesForUser(guildId, targetId) {
        const data = db.getData();
        if (!data.moderationCases) return [];
        return data.moderationCases.filter(c => c.guildId === guildId && c.targetId === targetId);
    }

    static getWarningsForUser(guildId, targetId) {
        const data = db.getData();
        if (!data.moderationCases) return [];
        return data.moderationCases.filter(c => c.guildId === guildId && c.targetId === targetId && c.action === 'WARN');
    }

    static clearWarnings(guildId, targetId, actor = 'SYSTEM') {
        const data = db.getData();
        if (!data.moderationCases) return 0;

        const initialLength = data.moderationCases.length;
        data.moderationCases = data.moderationCases.filter(c => !(c.guildId === guildId && c.targetId === targetId && c.action === 'WARN'));
        const removed = initialLength - data.moderationCases.length;

        if (removed > 0) {
            db.save();
            LogService.addAuditLog({
                actor,
                action: 'WARNINGS_CLEARED',
                targetId,
                metadata: { guildId, removedCount: removed }
            });
        }

        return removed;
    }

    static getAllCases({ page = 1, limit = 20, guildId = null, action = null } = {}) {
        const data = db.getData();
        let cases = data.moderationCases || [];

        if (guildId) cases = cases.filter(c => c.guildId === guildId);
        if (action) cases = cases.filter(c => c.action === action.toUpperCase());

        const startIndex = (page - 1) * limit;
        const paged = cases.slice(startIndex, startIndex + limit);

        return {
            cases: paged,
            total: cases.length,
            page,
            limit,
            totalPages: Math.ceil(cases.length / limit) || 1
        };
    }

    static buildLogEmbed(caseRecord) {
        const colorMap = {
            WARN: 0xf59e0b,      // Amber
            TIMEOUT: 0xeab308,   // Yellow
            UNTIMEOUT: 0x10b981, // Emerald
            KICK: 0xf97316,     // Orange
            BAN: 0xef4444,      // Red
            UNBAN: 0x22c55e     // Green
        };

        const embed = new EmbedBuilder()
            .setColor(colorMap[caseRecord.action] || 0x64748b)
            .setTitle(`Case #${caseRecord.id} | Action: ${caseRecord.action}`)
            .addFields(
                { name: 'Target User', value: `<@${caseRecord.targetId}> (\`${caseRecord.targetTag}\` - \`${caseRecord.targetId}\`)`, inline: false },
                { name: 'Moderator', value: `<@${caseRecord.moderatorId}> (\`${caseRecord.moderatorTag}\`)`, inline: true },
                { name: 'Reason', value: caseRecord.reason || 'None provided', inline: true }
            )
            .setTimestamp(new Date(caseRecord.createdAt));

        if (caseRecord.duration) {
            embed.addFields({ name: 'Duration', value: String(caseRecord.duration), inline: true });
        }

        return embed;
    }
}

module.exports = ModerationService;
