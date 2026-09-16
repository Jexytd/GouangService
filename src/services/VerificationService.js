const db = require('../database');
const KeyService = require('./KeyService');
const GlobalKeyService = require('./GlobalKeyService');
const LogService = require('./LogService');

class VerificationService {
    static async verify({ key, clientId, ip = null }) {
        if (!key || !clientId) {
            return {
                valid: false,
                statusCode: 400,
                error: {
                    code: 'BAD_REQUEST',
                    message: 'Missing key or clientId in verification payload.'
                }
            };
        }

        const cleanKey = String(key).trim();
        const cleanClientId = String(clientId).trim();
        const clientIdHash = KeyService.hashValue(cleanClientId);
        const ipHash = ip ? KeyService.hashValue(ip) : null;

        const globalKey = GlobalKeyService.getGlobalKey();

        // 1. Check if the key matches the Global Key
        if (cleanKey === globalKey.key) {
            if (!globalKey.enabled) {
                LogService.addVerificationLog({
                    keyId: null,
                    keyPrefix: 'GLOBAL',
                    clientIdHash,
                    ipHash,
                    tier: globalKey.tier,
                    success: false,
                    reason: 'GLOBAL_KEY_DISABLED'
                });

                return {
                    valid: false,
                    statusCode: 403,
                    error: {
                        code: 'GLOBAL_KEY_DISABLED',
                        message: 'The public global key is currently disabled by administrator.'
                    }
                };
            }

            // Global Key success (limited features, unbindable)
            LogService.addVerificationLog({
                keyId: null,
                keyPrefix: 'GLOBAL',
                clientIdHash,
                ipHash,
                tier: globalKey.tier,
                success: true,
                reason: 'OK'
            });

            return {
                valid: true,
                statusCode: 200,
                tier: globalKey.tier || 'free',
                features: globalKey.features || ['basic'],
                isGlobal: true,
                message: 'Verified via Global Key.'
            };
        }

        // 2. Personal / Premium Key Verification
        const keyHash = KeyService.hashValue(cleanKey);
        const data = db.getData();
        const keyRecord = data.keys.find(k => k.keyHash === keyHash);

        if (!keyRecord) {
            LogService.addVerificationLog({
                keyId: null,
                keyPrefix: cleanKey.substring(0, 8),
                clientIdHash,
                ipHash,
                tier: 'unknown',
                success: false,
                reason: 'INVALID_KEY'
            });

            return {
                valid: false,
                statusCode: 401,
                error: {
                    code: 'INVALID_KEY',
                    message: 'License key not found or invalid.'
                }
            };
        }

        if (keyRecord.status !== 'active') {
            LogService.addVerificationLog({
                keyId: keyRecord.id,
                keyPrefix: keyRecord.keyPrefix,
                clientIdHash,
                ipHash,
                tier: keyRecord.tier,
                success: false,
                reason: 'KEY_REVOKED'
            });

            return {
                valid: false,
                statusCode: 403,
                error: {
                    code: 'KEY_REVOKED',
                    message: `License key status is ${keyRecord.status}.`
                }
            };
        }

        if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
            keyRecord.status = 'expired';
            db.save();

            LogService.addVerificationLog({
                keyId: keyRecord.id,
                keyPrefix: keyRecord.keyPrefix,
                clientIdHash,
                ipHash,
                tier: keyRecord.tier,
                success: false,
                reason: 'KEY_EXPIRED'
            });

            return {
                valid: false,
                statusCode: 403,
                error: {
                    code: 'KEY_EXPIRED',
                    message: 'License key has expired.'
                }
            };
        }

        // 3. Client Binding Check
        const bindings = data.bindings.filter(b => b.keyId === keyRecord.id);
        const existingBinding = bindings.find(b => b.clientIdHash === clientIdHash);

        if (existingBinding) {
            existingBinding.lastSeen = new Date().toISOString();
            db.save();
        } else {
            // New device attempting to bind
            if (bindings.length >= (keyRecord.maxClients || 1)) {
                LogService.addVerificationLog({
                    keyId: keyRecord.id,
                    keyPrefix: keyRecord.keyPrefix,
                    clientIdHash,
                    ipHash,
                    tier: keyRecord.tier,
                    success: false,
                    reason: 'CLIENT_LIMIT'
                });

                return {
                    valid: false,
                    statusCode: 403,
                    error: {
                        code: 'CLIENT_LIMIT',
                        message: `Device limit reached (${bindings.length}/${keyRecord.maxClients}). Please ask admin to reset your HWID/device.`
                    }
                };
            }

            // Create new binding
            const newBinding = {
                id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
                keyId: keyRecord.id,
                clientIdHash,
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString()
            };
            data.bindings.push(newBinding);
            db.save();
        }

        // Feature mapping based on tier
        const featureMap = {
            free: ['basic'],
            basic: ['basic', 'standard'],
            premium: ['basic', 'standard', 'advanced', 'premium', 'all'],
            enterprise: ['basic', 'standard', 'advanced', 'premium', 'enterprise', 'all']
        };

        const features = featureMap[keyRecord.tier] || ['basic', 'premium'];

        LogService.addVerificationLog({
            keyId: keyRecord.id,
            keyPrefix: keyRecord.keyPrefix,
            clientIdHash,
            ipHash,
            tier: keyRecord.tier,
            success: true,
            reason: 'OK'
        });

        return {
            valid: true,
            statusCode: 200,
            tier: keyRecord.tier,
            features,
            expiresAt: keyRecord.expiresAt,
            isGlobal: false,
            message: 'Verified successfully.'
        };
    }
}

module.exports = VerificationService;
