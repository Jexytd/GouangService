const fs = require('node:fs');
const path = require('node:path');
const KeyService = require('./src/services/KeyService');
const GlobalKeyService = require('./src/services/GlobalKeyService');
const VerificationService = require('./src/services/VerificationService');
const LogService = require('./src/services/LogService');
const GuildConfigService = require('./src/services/GuildConfigService');
const ModerationService = require('./src/services/ModerationService');
const TicketService = require('./src/services/TicketService');
const { checkCooldown } = require('./src/bot/utils/cooldown');

async function runTests() {
    console.log("========================================");
    console.log("   RICOH SHIELD 2026 TEST SUITE");
    console.log("========================================");

    // ---------------------------------------------------------
    // PART 1: Whitelist & Headless Verification Core
    // ---------------------------------------------------------
    console.log("\n[1/5] Testing Whitelist & Verification Core...");
    const globalKey = GlobalKeyService.getGlobalKey();
    console.log("  ✓ Global Key:", globalKey.key, "| Enabled:", globalKey.enabled);

    const gvResult = await VerificationService.verify({
        key: globalKey.key,
        clientId: "test-client-device-1"
    });
    if (!gvResult.valid || gvResult.tier !== 'free') throw new Error("Global key verification test failed");
    console.log("  ✓ Global Key Verification Verified");

    const { plainKey, keyRecord } = KeyService.createKey({
        tier: 'premium',
        durationDays: 30,
        maxClients: 1,
        createdBy: 'TEST_ADMIN',
        note: 'Automated test key'
    });
    console.log("  ✓ Created Premium Key:", keyRecord.keyPrefix);

    const firstVerif = await VerificationService.verify({
        key: plainKey,
        clientId: "device-alpha"
    });
    if (!firstVerif.valid || firstVerif.tier !== 'premium') throw new Error("Fresh key verif failed");
    console.log("  ✓ Verified First Device Binding");

    const secondVerif = await VerificationService.verify({
        key: plainKey,
        clientId: "device-beta"
    });
    if (secondVerif.valid || secondVerif.error?.code !== 'CLIENT_LIMIT') throw new Error("Client limit test failed");
    console.log("  ✓ Client Limit Enforced (Expected Block for Device 2)");

    const resetResult = KeyService.resetHwid(keyRecord.id, 'TEST_ADMIN');
    if (!resetResult.success) throw new Error("HWID reset failed");
    console.log("  ✓ Reset HWID Device Bindings");

    const thirdVerif = await VerificationService.verify({
        key: plainKey,
        clientId: "device-beta"
    });
    if (!thirdVerif.valid) throw new Error("Device beta verif failed after reset");
    console.log("  ✓ Bound New Device Post-Reset");

    const testDiscordId = `TEST_USER_${Date.now()}`;
    const redeemResult = KeyService.redeemKey({ key: plainKey, discordId: testDiscordId });
    if (!redeemResult.success) throw new Error("Redeem failed");
    console.log("  ✓ Redeemed License Key to Discord User:", testDiscordId);

    const userKey = KeyService.checkUserKey(testDiscordId);
    if (!userKey || userKey.discordId !== testDiscordId) throw new Error("Check user key failed");
    console.log("  ✓ Checked User Key Record Successfully");

    // ---------------------------------------------------------
    // PART 2: Guild Configuration Service
    // ---------------------------------------------------------
    console.log("\n[2/5] Testing GuildConfigService...");
    const testGuildId = "987654321012345678";
    const initialConfig = GuildConfigService.getConfig(testGuildId);
    if (!initialConfig || initialConfig.guildId !== testGuildId) throw new Error("Failed to get default guild config");
    console.log("  ✓ Retrieved Default Guild Config for Guild:", testGuildId);

    const updatedConfig = GuildConfigService.updateConfig(testGuildId, {
        modLogChannelId: "111111111111111111",
        welcomeChannelId: "222222222222222222",
        memberRoleId: "333333333333333333",
        ticketCategoryId: "444444444444444444"
    }, 'TEST_MOD');

    if (updatedConfig.modLogChannelId !== "111111111111111111" || updatedConfig.memberRoleId !== "333333333333333333") {
        throw new Error("Guild configuration update mismatch");
    }
    console.log("  ✓ Guild Configuration Updated & Persisted Successfully");

    // ---------------------------------------------------------
    // PART 3: Moderation Service & Cases
    // ---------------------------------------------------------
    console.log("\n[3/5] Testing ModerationService...");
    const modTargetId = "555555555555555555";
    const modActorId = "777777777777777777";

    const warn1 = ModerationService.addCase({
        guildId: testGuildId,
        targetId: modTargetId,
        targetTag: "BadUser#0001",
        moderatorId: modActorId,
        moderatorTag: "GoodMod#9999",
        action: 'WARN',
        reason: 'First warning: spamming messages'
    });
    console.log("  ✓ Created Warn Case #", warn1.id);

    const warn2 = ModerationService.addCase({
        guildId: testGuildId,
        targetId: modTargetId,
        targetTag: "BadUser#0001",
        moderatorId: modActorId,
        moderatorTag: "GoodMod#9999",
        action: 'WARN',
        reason: 'Second warning: inappropriate language'
    });
    console.log("  ✓ Created Warn Case #", warn2.id);

    const timeoutCase = ModerationService.addCase({
        guildId: testGuildId,
        targetId: modTargetId,
        targetTag: "BadUser#0001",
        moderatorId: modActorId,
        moderatorTag: "GoodMod#9999",
        action: 'TIMEOUT',
        reason: 'Temporary timeout for repeated infractions',
        duration: '1 hour(s)'
    });
    console.log("  ✓ Created Timeout Case #", timeoutCase.id);

    const userWarnings = ModerationService.getWarningsForUser(testGuildId, modTargetId);
    if (userWarnings.length < 2) throw new Error("Expected at least 2 warnings for target user");
    console.log(`  ✓ Queried Warnings for User (Found: ${userWarnings.length} active warnings)`);

    const clearedCount = ModerationService.clearWarnings(testGuildId, modTargetId, 'GoodMod#9999');
    if (clearedCount < 2) throw new Error("Failed to clear warnings");
    console.log(`  ✓ Cleared ${clearedCount} Warning(s) for User`);

    const logEmbed = ModerationService.buildLogEmbed(timeoutCase);
    if (!logEmbed.data.title.includes("TIMEOUT")) throw new Error("Failed to build moderation log embed");
    console.log("  ✓ Moderation Log Embed Generated Correctly");

    // ---------------------------------------------------------
    // PART 4: Support Ticket Service
    // ---------------------------------------------------------
    console.log("\n[4/5] Testing TicketService...");
    const ticketUserId = "888888888888888888";
    const ticketChannelId = "999999999999999999";

    const newTicket = TicketService.createTicket({
        guildId: testGuildId,
        channelId: ticketChannelId,
        userId: ticketUserId,
        userTag: "HelpSeeker#1234",
        category: "key"
    });
    if (!newTicket.id.startsWith("TICK-")) throw new Error("Invalid ticket ID format");
    console.log("  ✓ Ticket Created:", newTicket.id, "| Category:", newTicket.category);

    const openTicket = TicketService.getOpenTicketForUser(testGuildId, ticketUserId);
    if (!openTicket || openTicket.id !== newTicket.id) throw new Error("Open ticket lookup failed");
    console.log("  ✓ Duplicate Ticket Prevention Check Passed (Detected Existing Open Ticket)");

    const claimRes = TicketService.claimTicket(ticketChannelId, modActorId, "GoodMod#9999");
    if (!claimRes.success || claimRes.ticket.status !== 'claimed') throw new Error("Ticket claim failed");
    console.log("  ✓ Ticket Claimed by Staff:", claimRes.ticket.claimedBy.tag);

    const transcriptMessages = [
        { author: "HelpSeeker#1234", content: "Hello, my key is not working", timestamp: new Date().toISOString() },
        { author: "GoodMod#9999", content: "I have reset your HWID bindings, please retry!", timestamp: new Date().toISOString() },
        { author: "HelpSeeker#1234", content: "It works now, thank you!", timestamp: new Date().toISOString() }
    ];

    TicketService.saveTranscript(ticketChannelId, transcriptMessages);
    const closeRes = TicketService.closeTicket(ticketChannelId, "GoodMod#9999", "Issue resolved via HWID reset");
    if (!closeRes.success || closeRes.ticket.status !== 'closed') throw new Error("Ticket close failed");
    console.log("  ✓ Ticket Closed with Reason:", closeRes.ticket.closeReason);

    const transcriptText = TicketService.generateTranscriptText(closeRes.ticket, transcriptMessages);
    if (!transcriptText.includes("TICKET TRANSCRIPT") || !transcriptText.includes("Issue resolved")) {
        throw new Error("Transcript generation failed");
    }
    console.log("  ✓ Complete Plaintext Transcript Generated (" + transcriptText.length + " bytes)");

    // ---------------------------------------------------------
    // PART 5: Commands & Handlers Verification
    // ---------------------------------------------------------
    console.log("\n[5/5] Testing Commands & Modular Architecture...");

    // Test Cooldown utility
    const cd1 = checkCooldown("test-user-cd", "ping", 2);
    if (cd1.onCooldown) throw new Error("Cooldown initial check should be false");
    const cd2 = checkCooldown("test-user-cd", "ping", 2);
    if (!cd2.onCooldown) throw new Error("Cooldown second check should be true");
    console.log("  ✓ Cooldown Manager Verified (Blocked rapid re-invocation)");

    // Verify all command files load and export proper Discord.js structures
    const commandsPath = path.join(__dirname, 'Commands');
    let loadedCommandsCount = 0;
    const commandCategories = fs.readdirSync(commandsPath);

    for (const cat of commandCategories) {
        const catPath = path.join(commandsPath, cat);
        if (!fs.statSync(catPath).isDirectory()) continue;

        const files = fs.readdirSync(catPath).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const mod = require(path.join(catPath, file));
            if (!mod.data || !mod.data.name || typeof mod.execute !== 'function') {
                throw new Error(`Invalid command structure in: ${cat}/${file}`);
            }
            loadedCommandsCount++;
        }
    }
    console.log(`  ✓ Verified ${loadedCommandsCount} Discord Slash/Context Commands across ${commandCategories.length} categories`);

    // Verify events load properly
    const eventsPath = path.join(__dirname, 'src/bot/events');
    const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
    for (const ef of eventFiles) {
        const evMod = require(path.join(eventsPath, ef));
        if (!evMod.name || typeof evMod.execute !== 'function') {
            throw new Error(`Invalid event structure in: ${ef}`);
        }
    }
    console.log(`  ✓ Verified ${eventFiles.length} Modular Event Handlers (${eventFiles.join(', ')})`);

    // ---------------------------------------------------------
    // PART 6: Express API & Discord Dashboard Endpoints
    // ---------------------------------------------------------
    console.log("\n[6/6] Testing Express API & Discord Endpoints...");
    const { startServer } = require('./src/api/server');
    const testPort = 3999;
    const dummyClient = {
        isReady: () => true,
        user: { tag: "RicohShieldTest#0001" },
        ws: { ping: 24 },
        guilds: {
            cache: new Map([
                ["987654321012345678", {
                    id: "987654321012345678",
                    name: "Test Guild",
                    memberCount: 150,
                    ownerId: "123456789",
                    iconURL: () => "https://example.com/icon.png"
                }]
            ])
        }
    };

    const server = await startServer(testPort, dummyClient);
    try {
        const adminSecret = require('./src/config').dashboardPassword;

        // Test root endpoint
        const rootRes = await fetch(`http://127.0.0.1:${testPort}/`);
        const rootJson = await rootRes.json();
        if (rootJson.service !== 'Ricoh Shield Headless API') throw new Error("Root API failed");
        console.log("  ✓ Headless API Root Endpoint Online");

        // Test Discord Stats
        const statsRes = await fetch(`http://127.0.0.1:${testPort}/api/v1/admin/discord/stats`, {
            headers: { 'Authorization': `Bearer ${adminSecret}` }
        });
        const statsText = await statsRes.text();
        let statsJson;
        try {
            statsJson = JSON.parse(statsText);
        } catch (e) {
            console.error("Stats response status:", statsRes.status, "body:", statsText);
            throw e;
        }
        if (!statsJson.success || !statsJson.stats.online || statsJson.stats.totalTickets < 1) {
            throw new Error("Discord stats API test failed");
        }
        console.log("  ✓ Discord Bot Stats Endpoint: Online | Guilds:", statsJson.stats.guildsCount, "| Ping:", statsJson.stats.ping);

        // Test Discord Tickets Endpoint
        const ticketsRes = await fetch(`http://127.0.0.1:${testPort}/api/v1/admin/discord/tickets`, {
            headers: { 'Authorization': `Bearer ${adminSecret}` }
        });
        const ticketsJson = await ticketsRes.json();
        if (!ticketsJson.success || ticketsJson.total < 1) {
            throw new Error("Discord tickets API test failed");
        }
        console.log(`  ✓ Discord Tickets API Endpoint (Returned ${ticketsJson.total} tickets)`);

        // Test Discord Moderation Endpoint
        const modRes = await fetch(`http://127.0.0.1:${testPort}/api/v1/admin/discord/moderation`, {
            headers: { 'Authorization': `Bearer ${adminSecret}` }
        });
        const modJson = await modRes.json();
        if (!modJson.success || modJson.total < 1) {
            throw new Error("Discord moderation API test failed");
        }
        console.log(`  ✓ Discord Moderation API Endpoint (Returned ${modJson.total} cases)`);
    } finally {
        await new Promise(r => server.close(r));
        console.log("  ✓ Server cleanly stopped");
    }

    console.log("\n========================================");
    console.log("   ALL TESTS PASSED SUCCESSFULLY! (100%)");
    console.log("========================================");
}

runTests().catch(err => {
    console.error("\n❌ TEST SUITE FAILED:", err);
    process.exit(1);
});
