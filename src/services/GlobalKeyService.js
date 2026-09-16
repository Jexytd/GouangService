const db = require('../database');
const LogService = require('./LogService');

class GlobalKeyService {
    static getGlobalKey() {
        const data = db.getData();
        return data.settings.globalKey || {
            enabled: false,
            key: "GLOBAL-DISABLED",
            tier: "free",
            features: ["basic"],
            maxClients: 999999
        };
    }

    static updateGlobalKey({ enabled, key, tier, features, note }, actor = "SYSTEM") {
        const data = db.getData();
        const current = data.settings.globalKey || {};

        const updated = {
            enabled: enabled !== undefined ? Boolean(enabled) : current.enabled,
            key: key !== undefined && key.trim() !== "" ? key.trim() : current.key,
            tier: tier || current.tier || "free",
            features: Array.isArray(features) ? features : (current.features || ["basic"]),
            maxClients: current.maxClients || 999999,
            note: note !== undefined ? note : current.note,
            updatedAt: new Date().toISOString()
        };

        data.settings.globalKey = updated;
        db.save();

        LogService.addAuditLog({
            actor,
            action: 'GLOBAL_KEY_TOGGLED',
            targetId: updated.key,
            metadata: { enabled: updated.enabled, tier: updated.tier, features: updated.features }
        });

        return updated;
    }
}

module.exports = GlobalKeyService;
