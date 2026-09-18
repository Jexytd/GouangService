const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('node:path');
const config = require('../config');

const KeyService = require('../services/KeyService');
const GlobalKeyService = require('../services/GlobalKeyService');
const VerificationService = require('../services/VerificationService');
const LogService = require('../services/LogService');
const GuildConfigService = require('../services/GuildConfigService');
const ModerationService = require('../services/ModerationService');
const TicketService = require('../services/TicketService');

let discordClientRef = null;

const app = express();

// Enable Trust Proxy for Nginx Reverse Proxy (resolves real client IP from X-Forwarded-For)
app.set('trust proxy', 1);

// Security & Parsing Middlewares
app.use(helmet({
    contentSecurityPolicy: false // Allow loading inline dashboard scripts & styles
}));
app.use(cors({
    origin: config.corsOrigin || '*',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple in-memory rate limiter for /api/v1/verify
const rateLimitMap = new Map();
const verifyRateLimiter = (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 30; // 30 req/min

    const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };
    if (now > record.resetAt) {
        record.count = 0;
        record.resetAt = now + windowMs;
    }

    record.count += 1;
    rateLimitMap.set(ip, record);

    if (record.count > maxRequests) {
        return res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMITED',
                message: 'Too many requests. Please try again later.'
            }
        });
    }

    next();
};

// Admin Authentication Middleware
const requireAdminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const providedSecret = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7).trim()
        : (req.headers['x-admin-key'] || req.query.adminKey);

    if (!providedSecret || providedSecret !== config.dashboardPassword) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid or missing admin dashboard secret.'
            }
        });
    }
    next();
};

// -------------------------------------------------------------
// 1. PUBLIC API (Roblox / Client Verification)
// -------------------------------------------------------------
app.post('/api/v1/verify', verifyRateLimiter, async (req, res) => {
    try {
        const { key, clientId } = req.body;
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        const result = await VerificationService.verify({ key, clientId, ip });
        if (!result.valid) {
            return res.status(result.statusCode || 400).json({
                valid: false,
                error: result.error
            });
        }

        return res.status(200).json(result);
    } catch (err) {
        console.error("Verification error:", err);
        return res.status(500).json({
            valid: false,
            error: {
                code: 'SERVER_ERROR',
                message: 'An internal server error occurred.'
            }
        });
    }
});

// Legacy backward-compatibility endpoint for /api/verify
app.post('/api/verify', (req, res) => {
    res.redirect(307, '/api/v1/verify');
});

// -------------------------------------------------------------
// 2. ADMIN API (Dashboard)
// -------------------------------------------------------------

// Verify admin login token
app.post('/api/v1/admin/auth/verify', requireAdminAuth, (req, res) => {
    return res.json({ success: true, message: 'Authenticated' });
});

// Stats overview
app.get('/api/v1/admin/stats', requireAdminAuth, (req, res) => {
    const stats = KeyService.getStats();
    return res.json({ success: true, stats });
});

// Keys list (with search & filter)
app.get('/api/v1/admin/keys', requireAdminAuth, (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const search = req.query.search || '';
    const status = req.query.status || '';
    const tier = req.query.tier || '';

    const result = KeyService.listKeys({ page, limit, search, status, tier });
    return res.json({ success: true, ...result });
});

// Generate new key
app.post('/api/v1/admin/keys', requireAdminAuth, (req, res) => {
    const { tier, durationDays, maxClients, note, count } = req.body;
    const qty = Math.min(Math.max(parseInt(count || '1', 10), 1), 50);

    const generated = [];
    for (let i = 0; i < qty; i++) {
        const item = KeyService.createKey({
            tier: tier || 'premium',
            durationDays: parseInt(durationDays || '30', 10),
            maxClients: parseInt(maxClients || '1', 10),
            createdBy: 'DASHBOARD',
            note: note || ''
        });
        generated.push(item);
    }

    return res.status(201).json({
        success: true,
        message: `Successfully created ${generated.length} key(s).`,
        keys: generated
    });
});

// Reset key HWID / bindings
app.post('/api/v1/admin/keys/:id/reset', requireAdminAuth, (req, res) => {
    const result = KeyService.resetHwid(req.params.id, 'DASHBOARD');
    if (!result.success) {
        return res.status(404).json(result);
    }
    return res.json(result);
});

// Revoke key
app.post('/api/v1/admin/keys/:id/revoke', requireAdminAuth, (req, res) => {
    const result = KeyService.revokeKey(req.params.id, 'DASHBOARD');
    if (!result.success) {
        return res.status(404).json(result);
    }
    return res.json({ success: true, message: 'Key has been revoked.' });
});

// Get Global Key settings
app.get('/api/v1/admin/global-key', requireAdminAuth, (req, res) => {
    const globalKey = GlobalKeyService.getGlobalKey();
    return res.json({ success: true, globalKey });
});

// Update Global Key settings
app.put('/api/v1/admin/global-key', requireAdminAuth, (req, res) => {
    const { enabled, key, tier, features, note } = req.body;
    const updated = GlobalKeyService.updateGlobalKey({ enabled, key, tier, features, note }, 'DASHBOARD');
    return res.json({ success: true, globalKey: updated });
});

// Verification logs
app.get('/api/v1/admin/logs/verification', requireAdminAuth, (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const result = LogService.getVerificationLogs({ page, limit });
    return res.json({ success: true, ...result });
});

// Audit logs
app.get('/api/v1/admin/logs/audit', requireAdminAuth, (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const result = LogService.getAuditLogs({ page, limit });
    return res.json({ success: true, ...result });
});

// -------------------------------------------------------------
// Discord Bot Dashboard Integration
// -------------------------------------------------------------
app.get('/api/v1/admin/discord/stats', requireAdminAuth, (req, res) => {
    const isBotOnline = discordClientRef ? Boolean(discordClientRef.isReady && discordClientRef.isReady()) : false;
    const guildsCount = discordClientRef?.guilds?.cache?.size || 0;
    let usersCount = 0;
    if (discordClientRef?.guilds?.cache) {
        for (const guild of discordClientRef.guilds.cache.values()) {
            usersCount += (guild.memberCount || 0);
        }
    }
    const ping = discordClientRef?.ws?.ping ?? -1;

    const ticketsData = TicketService.getAllTickets({ limit: 1 });
    const modData = ModerationService.getAllCases({ limit: 1 });

    return res.json({
        success: true,
        stats: {
            online: isBotOnline,
            botTag: discordClientRef?.user?.tag || null,
            uptime: Math.floor(process.uptime()),
            ping,
            guildsCount,
            usersCount,
            totalTickets: ticketsData.total,
            totalModerationCases: modData.total
        }
    });
});

app.get('/api/v1/admin/discord/guilds', requireAdminAuth, (req, res) => {
    if (!discordClientRef || !discordClientRef.isReady || !discordClientRef.isReady()) {
        return res.json({ success: true, guilds: [] });
    }

    const guilds = Array.from(discordClientRef.guilds.cache.values()).map(g => {
        const conf = GuildConfigService.getConfig(g.id);
        return {
            id: g.id,
            name: g.name,
            icon: typeof g.iconURL === 'function' ? g.iconURL() : null,
            memberCount: g.memberCount,
            ownerId: g.ownerId,
            config: conf
        };
    });

    return res.json({ success: true, guilds });
});

app.get('/api/v1/admin/discord/guilds/:guildId/details', requireAdminAuth, (req, res) => {
    const { guildId } = req.params;
    const config = GuildConfigService.getConfig(guildId);

    if (!discordClientRef || !discordClientRef.isReady || !discordClientRef.isReady()) {
        return res.json({
            success: true,
            guild: { id: guildId, name: `Guild (${guildId})` },
            channels: [],
            roles: [],
            config
        });
    }

    const guild = discordClientRef.guilds.cache.get(guildId);
    if (!guild) {
        return res.status(404).json({
            success: false,
            error: { code: 'GUILD_NOT_FOUND', message: 'Guild not found in bot cache.' }
        });
    }

    // Extract channels
    const channels = Array.from(guild.channels.cache.values()).map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentId: c.parentId || null
    })).sort((a, b) => a.name.localeCompare(b.name));

    // Extract roles
    const roles = Array.from(guild.roles.cache.values()).map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position
    })).sort((a, b) => b.position - a.position);

    return res.json({
        success: true,
        guild: {
            id: guild.id,
            name: guild.name,
            icon: typeof guild.iconURL === 'function' ? guild.iconURL() : null,
            memberCount: guild.memberCount,
            ownerId: guild.ownerId
        },
        channels,
        roles,
        config
    });
});

app.put('/api/v1/admin/discord/guilds/:guildId/config', requireAdminAuth, (req, res) => {
    const { guildId } = req.params;
    const updated = GuildConfigService.updateConfig(guildId, req.body, 'DASHBOARD');
    return res.json({
        success: true,
        message: 'Server configuration updated successfully.',
        config: updated
    });
});

app.get('/api/v1/admin/discord/tickets', requireAdminAuth, (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const status = req.query.status || null;
    const guildId = req.query.guildId || null;

    const result = TicketService.getAllTickets({ page, limit, status, guildId });
    return res.json({ success: true, ...result });
});

app.get('/api/v1/admin/discord/moderation', requireAdminAuth, (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const action = req.query.action || null;
    const guildId = req.query.guildId || null;

    const result = ModerationService.getAllCases({ page, limit, action, guildId });
    return res.json({ success: true, ...result });
});

// -------------------------------------------------------------
// 3. HEADLESS API HANDLERS (No Frontend UI on Service)
// -------------------------------------------------------------
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        service: 'Ricoh Shield Headless API',
        timestamp: new Date().toISOString()
    });
});

// 404 handler for unknown routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Endpoint not found.'
        }
    });
});

function startServer(port = config.port, discordClient = null) {
    if (discordClient) {
        discordClientRef = discordClient;
    }
    return new Promise((resolve) => {
        const server = app.listen(port, () => {
            console.log(`[Headless API] Running on port ${port}`);
            resolve(server);
        });
    });
}

module.exports = { app, startServer };
