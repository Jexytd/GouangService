const crypto = require('node:crypto');
const db = require('../database');
const config = require('../config');
const LogService = require('./LogService');
const GlobalKeyService = require('./GlobalKeyService');

class KeyService {
    static hashValue(val) {
        if (!val) return "";
        return crypto.createHmac('sha256', config.serverSecret).update(String(val).trim()).digest('hex');
    }

    static generateRandomKey(prefix = "RCH") {
        const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
        const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();
        return `${prefix}-${part1}-${part2}-${part3}`;
    }

    static createKey({ tier = 'premium', durationDays = 30, maxClients = 1, createdBy = 'SYSTEM', note = '', discordId = null } = {}) {
        const plainKey = this.generateRandomKey();
        const keyHash = this.hashValue(plainKey);
        const keyPrefix = `${plainKey.substring(0, 8)}****`;

        let expiresAt = null;
        if (durationDays && durationDays > 0) {
            const exp = new Date();
            exp.setDate(exp.getDate() + parseInt(durationDays, 10));
            expiresAt = exp.toISOString();
        }

        const data = db.getData();
        const keyRecord = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
            keyHash,
            keyPrefix,
            tier: tier || 'premium',
            status: 'active',
            isGlobal: false,
            discordId: discordId || null,
            maxClients: parseInt(maxClients, 10) || 1,
            expiresAt,
            createdBy,
            note: note || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        data.keys.unshift(keyRecord);
        db.save();

        LogService.addAuditLog({
            actor: createdBy,
            action: 'KEY_CREATED',
            targetId: keyRecord.id,
            metadata: { keyPrefix, tier, durationDays, maxClients }
        });

        return { plainKey, keyRecord };
    }

    static redeemKey({ key, discordId }) {
        if (!key || !discordId) {
            return { success: false, error: 'KEY_OR_DISCORD_ID_MISSING', message: 'License key and Discord user are required.' };
        }

        const keyHash = this.hashValue(key);
        const data = db.getData();

        const keyRecord = data.keys.find(k => k.keyHash === keyHash);
        if (!keyRecord) {
            return { success: false, error: 'INVALID_KEY', message: 'Invalid or non-existent license key.' };
        }

        if (keyRecord.status !== 'active') {
            return { success: false, error: 'KEY_REVOKED', message: `This key has been ${keyRecord.status}.` };
        }

        if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
            keyRecord.status = 'expired';
            db.save();
            return { success: false, error: 'KEY_EXPIRED', message: 'This license key has expired.' };
        }

        if (keyRecord.discordId && keyRecord.discordId !== discordId) {
            return { success: false, error: 'ALREADY_REDEEMED', message: 'This key has already been redeemed by another Discord user.' };
        }

        // Check if user already owns another active key
        const existingKey = data.keys.find(k => k.discordId === discordId && k.status === 'active' && k.id !== keyRecord.id);
        if (existingKey) {
            return {
                success: false,
                error: 'ALREADY_HAS_KEY',
                message: `You already have an active license key (${existingKey.keyPrefix}).`
            };
        }

        keyRecord.discordId = discordId;
        keyRecord.updatedAt = new Date().toISOString();
        db.save();

        LogService.addAuditLog({
            actor: discordId,
            action: 'KEY_REDEEMED',
            targetId: keyRecord.id,
            metadata: { keyPrefix: keyRecord.keyPrefix }
        });

        return {
            success: true,
            message: 'Key successfully redeemed!',
            keyRecord
        };
    }

    static checkUserKey(discordId) {
        const data = db.getData();
        const keyRecord = data.keys.find(k => k.discordId === discordId && k.status === 'active');
        if (!keyRecord) return null;

        // Check expiration
        if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
            keyRecord.status = 'expired';
            db.save();
            return null;
        }

        const bindings = data.bindings.filter(b => b.keyId === keyRecord.id);
        return {
            ...keyRecord,
            bindingsCount: bindings.length,
            bindings
        };
    }

    static resetHwid(identifier, actor = 'SYSTEM') {
        const data = db.getData();
        // identifier can be keyId, keyPrefix, plain key, or discordId
        let keyRecord = null;
        const keyHash = this.hashValue(identifier);

        keyRecord = data.keys.find(k =>
            k.id === identifier ||
            k.keyHash === keyHash ||
            k.keyPrefix.startsWith(identifier) ||
            k.discordId === identifier
        );

        if (!keyRecord) {
            return { success: false, error: 'KEY_NOT_FOUND', message: 'Could not find matching license key.' };
        }

        const initialCount = data.bindings.filter(b => b.keyId === keyRecord.id).length;
        data.bindings = data.bindings.filter(b => b.keyId !== keyRecord.id);
        keyRecord.updatedAt = new Date().toISOString();
        db.save();

        LogService.addAuditLog({
            actor,
            action: 'HWID_RESET',
            targetId: keyRecord.id,
            metadata: { keyPrefix: keyRecord.keyPrefix, removedBindings: initialCount }
        });

        return {
            success: true,
            message: `Successfully reset ${initialCount} device binding(s) for ${keyRecord.keyPrefix}.`,
            keyRecord
        };
    }

    static revokeKey(keyId, actor = 'SYSTEM') {
        const data = db.getData();
        const keyRecord = data.keys.find(k => k.id === keyId);
        if (!keyRecord) {
            return { success: false, error: 'KEY_NOT_FOUND', message: 'Key not found.' };
        }

        keyRecord.status = 'revoked';
        keyRecord.updatedAt = new Date().toISOString();
        db.save();

        LogService.addAuditLog({
            actor,
            action: 'KEY_REVOKED',
            targetId: keyRecord.id,
            metadata: { keyPrefix: keyRecord.keyPrefix }
        });

        return { success: true, keyRecord };
    }

    static listKeys({ page = 1, limit = 20, search = '', status = '', tier = '' } = {}) {
        const data = db.getData();
        let list = data.keys;

        if (status) {
            list = list.filter(k => k.status === status);
        }
        if (tier) {
            list = list.filter(k => k.tier === tier);
        }
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(k =>
                k.keyPrefix.toLowerCase().includes(q) ||
                (k.discordId && k.discordId.includes(q)) ||
                (k.note && k.note.toLowerCase().includes(q))
            );
        }

        const startIndex = (page - 1) * limit;
        const paged = list.slice(startIndex, startIndex + limit).map(k => {
            const bindings = data.bindings.filter(b => b.keyId === k.id);
            return {
                ...k,
                bindingsCount: bindings.length
            };
        });

        return {
            keys: paged,
            total: list.length,
            page,
            limit,
            totalPages: Math.ceil(list.length / limit) || 1
        };
    }

    static getStats() {
        const data = db.getData();
        const now = new Date();
        const totalKeys = data.keys.length;
        const activeKeys = data.keys.filter(k => k.status === 'active' && (!k.expiresAt || new Date(k.expiresAt) >= now)).length;
        const expiredKeys = data.keys.filter(k => k.status === 'expired' || (k.expiresAt && new Date(k.expiresAt) < now)).length;
        const revokedKeys = data.keys.filter(k => k.status === 'revoked').length;
        const claimedKeys = data.keys.filter(k => k.discordId !== null && k.discordId !== undefined).length;
        const unclaimedKeys = Math.max(0, totalKeys - claimedKeys);
        const totalBindings = data.bindings ? data.bindings.length : 0;
        const globalKey = GlobalKeyService.getGlobalKey();

        // Tier Breakdown
        const tierBreakdown = {};
        for (const k of data.keys) {
            const tier = (k.tier || 'standard').toLowerCase();
            tierBreakdown[tier] = (tierBreakdown[tier] || 0) + 1;
        }

        // Status Breakdown
        const statusBreakdown = {
            active: activeKeys,
            expired: expiredKeys,
            revoked: revokedKeys
        };

        // Claim Breakdown
        const claimBreakdown = {
            claimed: claimedKeys,
            unclaimed: unclaimedKeys
        };

        // 7-day Activity Timeline
        const activityTimeline = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const label = `${dayNames[d.getDay()]} (${monthNames[d.getMonth()]} ${d.getDate()})`;

            const vLogs = (data.verificationLogs || []).filter(l => l.createdAt && l.createdAt.slice(0, 10) === dateStr);
            const verificationsSuccess = vLogs.filter(l => l.success).length;
            const verificationsFailed = vLogs.filter(l => !l.success).length;

            const keysCreated = (data.keys || []).filter(k => k.createdAt && k.createdAt.slice(0, 10) === dateStr).length;

            activityTimeline.push({
                date: dateStr,
                label,
                verificationsSuccess,
                verificationsFailed,
                totalVerifications: vLogs.length,
                keysCreated
            });
        }

        return {
            totalKeys,
            activeKeys,
            claimedKeys,
            unclaimedKeys,
            totalBindings,
            statusBreakdown,
            tierBreakdown,
            claimBreakdown,
            activityTimeline,
            globalKeyEnabled: globalKey.enabled,
            globalKeyName: globalKey.key,
            recentLogsCount: (data.verificationLogs || []).length
        };
    }
}

module.exports = KeyService;
