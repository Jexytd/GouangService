const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function resolveDbPath() {
    if (process.env.DATABASE_FILE_PATH) {
        return path.resolve(process.cwd(), process.env.DATABASE_FILE_PATH);
    }
    const monorepoPath = path.resolve(__dirname, '../../Database/whitelist.json');
    if (fs.existsSync(monorepoPath)) return monorepoPath;

    const localRepoPath = path.resolve(__dirname, '../Database/whitelist.json');
    if (fs.existsSync(localRepoPath)) return localRepoPath;

    return monorepoPath;
}

const DB_PATH = resolveDbPath();

// Default initial state
const DEFAULT_DATA = {
    keys: [],
    bindings: [],
    verificationLogs: [],
    auditLogs: [],
    guildConfigs: [],
    moderationCases: [],
    tickets: [],
    settings: {
        globalKey: {
            enabled: true,
            key: "GLOBAL-FREE-2026",
            tier: "free",
            features: ["basic"],
            maxClients: 999999,
            note: "Default public global key"
        }
    }
};

class Database {
    constructor() {
        this.cache = null;
        this.init();
    }

    init() {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (!fs.existsSync(DB_PATH)) {
            this.cache = JSON.parse(JSON.stringify(DEFAULT_DATA));
            this.flushSync();
        } else {
            try {
                const raw = fs.readFileSync(DB_PATH, 'utf-8');
                this.cache = JSON.parse(raw);
                if (!this.cache.settings) this.cache.settings = DEFAULT_DATA.settings;
                if (!this.cache.keys) this.cache.keys = [];
                if (!this.cache.bindings) this.cache.bindings = [];
                if (!this.cache.verificationLogs) this.cache.verificationLogs = [];
                if (!this.cache.auditLogs) this.cache.auditLogs = [];
                if (!this.cache.guildConfigs) this.cache.guildConfigs = [];
                if (!this.cache.moderationCases) this.cache.moderationCases = [];
                if (!this.cache.tickets) this.cache.tickets = [];
            } catch (err) {
                console.error("Failed to read database, initializing default data:", err);
                this.cache = JSON.parse(JSON.stringify(DEFAULT_DATA));
                this.flushSync();
            }
        }
    }

    flushSync() {
        const tempPath = `${DB_PATH}.tmp.${crypto.randomBytes(4).toString('hex')}`;
        fs.writeFileSync(tempPath, JSON.stringify(this.cache, null, 2), 'utf-8');
        fs.renameSync(tempPath, DB_PATH);
    }

    getData() {
        if (!this.cache) this.init();
        return this.cache;
    }

    save() {
        this.flushSync();
    }
}

const db = new Database();
module.exports = db;
