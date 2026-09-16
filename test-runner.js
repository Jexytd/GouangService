const KeyService = require('./src/services/KeyService');
const GlobalKeyService = require('./src/services/GlobalKeyService');
const VerificationService = require('./src/services/VerificationService');
const LogService = require('./src/services/LogService');

async function runTests() {
    console.log("--- STARTING TESTS ---");

    // 1. Test Global Key Verification
    const globalKey = GlobalKeyService.getGlobalKey();
    console.log("1. Current Global Key:", globalKey.key, "| Enabled:", globalKey.enabled);

    const gvResult = await VerificationService.verify({
        key: globalKey.key,
        clientId: "test-client-device-1"
    });
    console.log("2. Verify with Global Key:", gvResult.valid, "| Tier:", gvResult.tier, "| Features:", gvResult.features);
    if (!gvResult.valid || gvResult.tier !== 'free') throw new Error("Global key test failed");

    // 2. Test Key Generation
    const { plainKey, keyRecord } = KeyService.createKey({
        tier: 'premium',
        durationDays: 30,
        maxClients: 1,
        createdBy: 'TEST_ADMIN',
        note: 'Automated test key'
    });
    console.log("3. Generated Key:", plainKey, "| Prefix:", keyRecord.keyPrefix);

    // 3. Test Verify with Fresh Key (before redeem)
    const firstVerif = await VerificationService.verify({
        key: plainKey,
        clientId: "device-alpha"
    });
    console.log("4. Verify with Fresh Key:", firstVerif.valid, "| Tier:", firstVerif.tier, "| Features:", firstVerif.features);
    if (!firstVerif.valid || firstVerif.tier !== 'premium') throw new Error("Fresh key verif failed");

    // 4. Test Max Clients Limit (Try to verify from second device with maxClients=1)
    const secondVerif = await VerificationService.verify({
        key: plainKey,
        clientId: "device-beta"
    });
    console.log("5. Verify Second Device (Should Fail Limit):", secondVerif.valid, "| Error:", secondVerif.error?.code);
    if (secondVerif.valid || secondVerif.error?.code !== 'CLIENT_LIMIT') throw new Error("Client limit test failed");

    // 5. Test HWID Reset
    const resetResult = KeyService.resetHwid(keyRecord.id, 'TEST_ADMIN');
    console.log("6. Reset HWID:", resetResult.success, "| Message:", resetResult.message);
    if (!resetResult.success) throw new Error("HWID reset failed");

    // 6. Test Verify after Reset (device-beta should now be able to bind)
    const thirdVerif = await VerificationService.verify({
        key: plainKey,
        clientId: "device-beta"
    });
    console.log("7. Verify Device Beta after Reset:", thirdVerif.valid);
    if (!thirdVerif.valid) throw new Error("Device beta verif failed after reset");

    // 7. Test Discord Redeem
    const testDiscordId = `TEST_USER_${Date.now()}`;
    const redeemResult = KeyService.redeemKey({ key: plainKey, discordId: testDiscordId });
    console.log("8. Redeem Key to Discord User:", redeemResult.success, "| Message:", redeemResult.message);
    if (!redeemResult.success) throw new Error("Redeem failed");

    // 8. Test Check Key
    const userKey = KeyService.checkUserKey(testDiscordId);
    console.log("9. Check User Key:", userKey.keyPrefix, "| Discord:", userKey.discordId, "| Bindings:", userKey.bindingsCount);
    if (!userKey || userKey.discordId !== testDiscordId) throw new Error("Check user key failed");

    // 9. Stats
    const stats = KeyService.getStats();
    console.log("10. Stats Overview:", stats);

    console.log("--- ALL TESTS PASSED SUCCESSFULLY! ---");
}

runTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
