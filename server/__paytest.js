/**
 * Payment + wallet security checks — node server/__paytest.js
 */
const assert = require('assert');
const { createWalletResolver } = require('./walletResolver');
const { GIFTS, COIN_PACKAGES, findCoinPackage, packForShortfall, firstBuyBonus,
  BASE_NUTS_PER_INR, MAX_NUTS_PER_INR, NUTS_PER_USD, RETIRED_PACKS } = require('./giftCatalog');

let passed = 0;
const ok = (name) => { passed += 1; console.log(`  ✓ ${name}`); };

async function testWalletResolver() {
  console.log('\n── unified wallet resolver ──');

  const users = new Map();
  const economy = {
    getBalance: async (ip) => (ip === '1.2.3.4' ? 100 : 0),
    debit: async (ip, amt) => {
      if (ip !== '1.2.3.4' || amt > 100) return { ok: false, error: 'Insufficient coins' };
      return { ok: true, balance: 100 - amt };
    },
    credit: async (ip, amt) => ({ ok: true, balance: amt }),
  };
  const audioIdentity = {
    debit: async (key, amt) => ({ ok: true, balance: 500 - amt, identity: { coins: 500 - amt, username: 'alice' } }),
    credit: async (key, amt) => ({ ok: true, balance: 500 + amt, identity: { coins: 500 + amt, username: 'alice' } }),
  };

  users.set('s1', { ip: '1.2.3.4', audioIdentity: { username: 'Alice', coins: 500 } });
  users.set('s2', { ip: '9.9.9.9' });

  const wallet = createWalletResolver({ users, audioIdentity, economy });

  const signed = wallet.ctxFromSocket('s1', '1.2.3.4');
  assert.strictEqual(wallet.usesAudio(signed), true);
  ok('signed-in socket uses audio wallet');

  const guest = wallet.ctxFromSocket('s2', '9.9.9.9');
  assert.strictEqual(wallet.usesAudio(guest), false);
  ok('guest socket uses IP wallet');

  const spend = await wallet.debit(signed, 10, 'test');
  assert.strictEqual(spend.ok, true);
  ok('audio wallet debit succeeds');

  const mig = await wallet.migrateGuestToAudio('1.2.3.4', 'alice');
  assert.strictEqual(mig.ok, true);
  assert.strictEqual(mig.migrated, 100);
  ok('guest balance migrates to audio wallet once');
}

function testCatalogIntegrity() {
  console.log('\n── gift + coin catalog integrity ──');

  for (const g of GIFTS) {
    assert.ok(g.id && g.cost > 0 && g.creatorShare > 0 && g.creatorShare <= 1);
  }
  ok('every gift has valid cost and creator share');

  for (const p of COIN_PACKAGES) {
    assert.ok(p.id && p.coins > 0 && p.priceInr > 0);
  }
  ok('every coin pack has server-side price and coin amount');

  const ids = new Set(GIFTS.map((g) => g.id));
  assert.strictEqual(ids.size, GIFTS.length);
  ok('gift ids are unique');

  // Value must climb with price. A ladder where a bigger pack is worse per
  // rupee trains buyers to distrust every pack on the shelf.
  for (let i = 1; i < COIN_PACKAGES.length; i += 1) {
    const prev = COIN_PACKAGES[i - 1];
    const cur = COIN_PACKAGES[i];
    assert.ok(cur.priceInr > prev.priceInr, `${cur.id} is not priced above ${prev.id}`);
    assert.ok(cur.perRupee > prev.perRupee, `${cur.id} is worse value than ${prev.id}`);
  }
  ok('coin packs get strictly better value as they get bigger');

  for (const p of COIN_PACKAGES) {
    assert.ok(p.coins >= p.priceInr * BASE_NUTS_PER_INR, `${p.id} pays under the base rate`);
    assert.ok(p.perRupee <= MAX_NUTS_PER_INR, `${p.id} exceeds the payout-safe ceiling`);
  }
  ok('every pack sits between the base rate and the payout-safe ceiling');

  // The binding case: a whale buys the best-value pack and spends it all on the
  // highest creator-share gift. The platform must still be ahead.
  const INR_PER_USD = 84;
  const maxShare = Math.max(...GIFTS.map((g) => g.creatorShare));
  for (const p of COIN_PACKAGES) {
    const payoutInr = (p.coins * maxShare / NUTS_PER_USD) * INR_PER_USD;
    const margin = (p.priceInr - payoutInr) / p.priceInr;
    assert.ok(margin >= 0.1, `${p.id} leaves only ${(margin * 100).toFixed(1)}% margin at ${maxShare} creator share`);
  }
  ok('every pack keeps >=10% gross margin at the highest creator share');

  for (const [old, replacement] of Object.entries(RETIRED_PACKS)) {
    const found = findCoinPackage(old);
    assert.ok(found && found.id === replacement, `retired pack ${old} does not resolve`);
  }
  ok('retired pack ids still resolve to a live pack');

  assert.strictEqual(packForShortfall(1).id, COIN_PACKAGES[0].id);
  assert.ok(packForShortfall(60000).coins >= 60000);
  assert.strictEqual(packForShortfall(999999999).id, COIN_PACKAGES[COIN_PACKAGES.length - 1].id);
  ok('shortfall picks the cheapest pack that covers it, and never returns null');

  assert.strictEqual(firstBuyBonus(5000), 2500);
  assert.strictEqual(firstBuyBonus(2360000), 8000);
  ok('the first-purchase bonus is capped so the biggest pack cannot be farmed');
}

async function testFirstBuyBonus() {
  console.log('\n── first-purchase bonus ──');

  const express = require('express');
  const { registerAudioIdentity } = require('./audioIdentity');
  const app = express();
  app.use(express.json());
  const localDb = {};
  const io = { to: () => ({ emit: () => {} }), emit: () => {} };
  const ai = registerAudioIdentity(app, io, {
    localDb, saveLocalDb: () => {}, audit: () => {}, supabase: null,
  });

  const reg = await ai.register({ username: 'bonustester', pin: '4917', ip: '5.5.5.5' });
  assert.ok(reg.ok, `register failed: ${reg.error}`);
  const key = 'bonustester';

  const pack = COIN_PACKAGES[0];
  const first = await ai.creditCoinPack(key, pack.coins, 'coin_pack_test', {}, firstBuyBonus);
  assert.strictEqual(first.ok, true);
  assert.strictEqual(first.firstBuy, true);
  assert.strictEqual(first.bonus, firstBuyBonus(pack.coins));
  assert.strictEqual(first.credited, pack.coins + first.bonus);
  ok('the first pack is credited with the bonus on top');

  const second = await ai.creditCoinPack(key, pack.coins, 'coin_pack_test', {}, firstBuyBonus);
  assert.strictEqual(second.firstBuy, false);
  assert.strictEqual(second.bonus, 0);
  assert.strictEqual(second.credited, pack.coins);
  ok('the bonus is not paid twice');

  // Two checkouts landing together must not both read a zero lifetime total.
  const reg2 = await ai.register({ username: 'racetester', pin: '5286', ip: '5.5.5.6' });
  assert.ok(reg2.ok, `register failed: ${reg2.error}`);
  const both = await Promise.all([
    ai.creditCoinPack('racetester', pack.coins, 'coin_pack_test', {}, firstBuyBonus),
    ai.creditCoinPack('racetester', pack.coins, 'coin_pack_test', {}, firstBuyBonus),
  ]);
  assert.strictEqual(both.filter((r) => r.bonus > 0).length, 1);
  ok('concurrent first purchases pay the bonus exactly once');
}

function testPushModuleLoads() {
  console.log('\n── push module loads safely ──');
  const { registerPushNotifications } = require('./pushNotifications');
  const express = require('express');
  const app = express();
  app.use(express.json());
  const localDb = { push_subscriptions: [] };
  const push = registerPushNotifications(app, {
    localDb,
    saveLocalDb: () => {},
    sanitize: (s) => String(s || '').slice(0, 80),
    rateLimit: async () => ({ ok: true }),
    audioIdentity: null,
    supabase: null,
  });
  assert.strictEqual(typeof push.sendToKeys, 'function');
  ok('push module registers without VAPID keys');
}

(async () => {
  await testWalletResolver();
  testCatalogIntegrity();
  await testFirstBuyBonus();
  testPushModuleLoads();
  console.log(`\n✅ ${passed} payment/wallet checks passed\n`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
