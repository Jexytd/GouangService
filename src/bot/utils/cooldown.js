const { Collection } = require('discord.js');

const cooldowns = new Collection();

function checkCooldown(userId, commandName, cooldownSeconds = 3) {
    if (cooldownSeconds <= 0) return { onCooldown: false, remaining: 0 };

    if (!cooldowns.has(commandName)) {
        cooldowns.set(commandName, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(commandName);
    const cooldownAmount = cooldownSeconds * 1000;

    if (timestamps.has(userId)) {
        const expirationTime = timestamps.get(userId) + cooldownAmount;
        if (now < expirationTime) {
            const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
            return { onCooldown: true, remaining: timeLeft };
        }
    }

    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownAmount);

    return { onCooldown: false, remaining: 0 };
}

module.exports = { checkCooldown };
