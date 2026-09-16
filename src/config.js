require('dotenv').config();
const path = require('node:path');
const fs = require('node:fs');

let fileConfigs = {};
const configPath = path.resolve(__dirname, '../config.json');
if (fs.existsSync(configPath)) {
    try {
        fileConfigs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
        console.error("Error reading config.json:", e);
    }
}

module.exports = {
    token: process.env.DISCORD_TOKEN || fileConfigs.token || "",
    port: parseInt(process.env.PORT || fileConfigs.port || "3000", 10),
    dashboardPassword: process.env.DASHBOARD_PASSWORD || fileConfigs.dashboardPassword || "admin-secret-change-me",
    ownerId: process.env.DISCORD_OWNER_ID || fileConfigs.ownerId || "",
    adminRoleIds: (process.env.DISCORD_ADMIN_ROLE_IDS ? process.env.DISCORD_ADMIN_ROLE_IDS.split(',') : (fileConfigs.adminRoleIds || [])).map(s => s.trim()).filter(Boolean),
    serverSecret: process.env.SERVER_SECRET || fileConfigs.serverSecret || "ricoh-chuko-lito-secret-salt-2026",
    corsOrigin: process.env.CORS_ORIGIN || fileConfigs.corsOrigin || "*"
};
