const fs = require('node:fs');
const path = require('node:path');

function registerEvents(client) {
    const eventsPath = path.join(__dirname, '../events');
    if (!fs.existsSync(eventsPath)) return;

    const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        try {
            const event = require(filePath);
            if (!event.name || !event.execute) continue;

            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
            console.log(`[Events] Registered event: ${event.name} (${file})`);
        } catch (err) {
            console.error(`[Events] Failed to load event file ${file}:`, err);
        }
    }
}

module.exports = { registerEvents };
