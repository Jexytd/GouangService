const db = require('../database');

class LogService {
    static addVerificationLog({ keyId = null, keyPrefix = null, clientIdHash, ipHash = null, tier, success, reason }) {
        const data = db.getData();
        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
            keyId,
            keyPrefix,
            clientIdHash,
            ipHash,
            tier,
            success,
            reason,
            createdAt: new Date().toISOString()
        };

        data.verificationLogs.unshift(entry);
        // Keep maximum 1000 logs
        if (data.verificationLogs.length > 1000) {
            data.verificationLogs = data.verificationLogs.slice(0, 1000);
        }
        db.save();
        return entry;
    }

    static addAuditLog({ actor, action, targetId = null, metadata = {} }) {
        const data = db.getData();
        const entry = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
            actor,
            action,
            targetId,
            metadata,
            createdAt: new Date().toISOString()
        };

        data.auditLogs.unshift(entry);
        // Keep maximum 1000 logs
        if (data.auditLogs.length > 1000) {
            data.auditLogs = data.auditLogs.slice(0, 1000);
        }
        db.save();
        return entry;
    }

    static getVerificationLogs({ page = 1, limit = 50, success = null } = {}) {
        const data = db.getData();
        let logs = data.verificationLogs;

        if (success !== null) {
            logs = logs.filter(l => l.success === success);
        }

        const startIndex = (page - 1) * limit;
        const paged = logs.slice(startIndex, startIndex + limit);

        return {
            logs: paged,
            total: logs.length,
            page,
            limit,
            totalPages: Math.ceil(logs.length / limit) || 1
        };
    }

    static getAuditLogs({ page = 1, limit = 50 } = {}) {
        const data = db.getData();
        const startIndex = (page - 1) * limit;
        const paged = data.auditLogs.slice(startIndex, startIndex + limit);

        return {
            logs: paged,
            total: data.auditLogs.length,
            page,
            limit,
            totalPages: Math.ceil(data.auditLogs.length / limit) || 1
        };
    }
}

module.exports = LogService;
