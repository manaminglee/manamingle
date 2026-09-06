/**
 * Unified wallet: signed-in users spend from their audio identity; guests use
 * the IP-keyed ledger. One resolver keeps gift/debit paths consistent.
 */

function createWalletResolver({ users, audioIdentity, economy }) {
  function ctxFromSocket(socketId, fallbackIp) {
    const u = users.get(socketId);
    const ip = u?.ip || fallbackIp;
    const usernameKey = u?.audioIdentity?.username
      ? String(u.audioIdentity.username).toLowerCase()
      : null;
    return { ip, usernameKey, socketId, user: u };
  }

  function usesAudio(ctx) {
    return !!(ctx?.usernameKey && audioIdentity);
  }

  async function getBalance(ctx) {
    if (usesAudio(ctx)) {
      const view = ctx.user?.audioIdentity;
      if (view?.coins != null) return Math.max(0, Number(view.coins) || 0);
      return 0;
    }
    return economy.getBalance(ctx.ip);
  }

  async function debit(ctx, amount, reason, meta) {
    if (usesAudio(ctx)) {
      return audioIdentity.debit(ctx.usernameKey, amount, reason, meta);
    }
    return economy.debit(ctx.ip, amount, reason, meta);
  }

  async function credit(ctx, amount, reason, meta) {
    if (usesAudio(ctx)) {
      return audioIdentity.credit(ctx.usernameKey, amount, reason, meta);
    }
    return economy.credit(ctx.ip, amount, reason, meta);
  }

  /** Fold guest IP balance into a durable audio wallet once on sign-in. */
  async function migrateGuestToAudio(ip, usernameKey) {
    if (!economy || !audioIdentity || !ip || !usernameKey) return { ok: true, migrated: 0 };
    const guestBal = await economy.getBalance(ip);
    if (guestBal <= 0) return { ok: true, migrated: 0 };

    const spend = await economy.debit(ip, guestBal, 'wallet_migration_out', { to: usernameKey });
    if (!spend.ok) return spend;
    const cred = await audioIdentity.credit(usernameKey, guestBal, 'wallet_migration_in', { fromIp: ip });
    if (!cred.ok) {
      await economy.credit(ip, guestBal, 'wallet_migration_rollback', { usernameKey });
      return cred;
    }
    return { ok: true, migrated: guestBal, balance: cred.balance };
  }

  return {
    ctxFromSocket,
    usesAudio,
    getBalance,
    debit,
    credit,
    migrateGuestToAudio,
  };
}

module.exports = { createWalletResolver };
