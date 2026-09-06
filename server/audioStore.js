/**
 * Cross-instance audio channel metadata (Redis + memory mirror).
 * Membership / WebRTC signalling stays local; public channel lists and
 * scheduled events are shared so every instance sees the same rooms.
 */
const PREFIX = () => (process.env.REDIS_PREFIX || 'helloooo').replace(/:$/, '');

const K = {
  channel: (id) => `${PREFIX()}:audio:ch:${id}`,
  active: () => `${PREFIX()}:audio:active`,
  scheduled: () => `${PREFIX()}:audio:scheduled`,
};

function createAudioStore({ getRedis }) {
  const memory = new Map();

  async function redis() {
    try {
      const r = typeof getRedis === 'function' ? await getRedis() : null;
      return r?.isOpen ? r : null;
    } catch {
      return null;
    }
  }

  function encodeChannel(ch) {
    return JSON.stringify({
      id: ch.id,
      topic: ch.topic,
      interest: ch.interest || 'general',
      isPa: !!ch.isPa,
      scheduledStartAt: ch.scheduledStartAt || null,
      scheduledTopic: ch.scheduledTopic || null,
      memberCount: ch.members?.size ?? ch.memberCount ?? 0,
      updatedAt: Date.now(),
    });
  }

  function decodeChannel(raw) {
    try { return JSON.parse(raw); } catch { return null; }
  }

  async function upsertChannel(channel) {
    if (!channel?.id) return;
    const payload = encodeChannel(channel);
    memory.set(channel.id, decodeChannel(payload));
    const r = await redis();
    if (!r) return;
    try {
      await r.hSet(K.channel(channel.id), { data: payload });
      await r.zAdd(K.active(), [{ score: Date.now(), value: channel.id }]);
      if (channel.scheduledStartAt && channel.scheduledStartAt > Date.now()) {
        await r.zAdd(K.scheduled(), [{ score: channel.scheduledStartAt, value: channel.id }]);
      } else {
        await r.zRem(K.scheduled(), channel.id);
      }
      await r.expire(K.channel(channel.id), 86400);
    } catch { /* memory mirror still works */ }
  }

  async function removeChannel(channelId) {
    memory.delete(channelId);
    const r = await redis();
    if (!r) return;
    try {
      await r.del(K.channel(channelId));
      await r.zRem(K.active(), channelId);
      await r.zRem(K.scheduled(), channelId);
    } catch { /* */ }
  }

  async function listChannels(limit = 100) {
    const r = await redis();
    if (r) {
      try {
        const ids = await r.zRange(K.active(), 0, limit - 1, { REV: true });
        const out = [];
        for (const id of ids) {
          const h = await r.hGetAll(K.channel(id));
          const ch = h?.data ? decodeChannel(h.data) : null;
          if (ch) out.push(ch);
        }
        if (out.length) return out;
      } catch { /* fall through */ }
    }
    return [...memory.values()].slice(0, limit);
  }

  async function listScheduled(beforeMs = Date.now() + 7 * 86400000) {
    const now = Date.now();
    const r = await redis();
    if (r) {
      try {
        const ids = await r.zRangeByScore(K.scheduled(), now, beforeMs);
        const out = [];
        for (const id of ids) {
          const h = await r.hGetAll(K.channel(id));
          const ch = h?.data ? decodeChannel(h.data) : null;
          if (ch?.scheduledStartAt) out.push(ch);
        }
        if (out.length) return out.sort((a, b) => a.scheduledStartAt - b.scheduledStartAt);
      } catch { /* */ }
    }
    return [...memory.values()]
      .filter((c) => c.scheduledStartAt && c.scheduledStartAt > now && c.scheduledStartAt <= beforeMs)
      .sort((a, b) => a.scheduledStartAt - b.scheduledStartAt);
  }

  async function claimReminderLock(ttlMs = 55_000) {
    const r = await redis();
    if (!r) return true;
    try {
      const ok = await r.set(`${PREFIX()}:audio:reminder-lock`, '1', { NX: true, PX: ttlMs });
      return ok === 'OK';
    } catch {
      return true;
    }
  }

  function isRedis() {
    return !!getRedis;
  }

  return {
    upsertChannel,
    removeChannel,
    listChannels,
    listScheduled,
    claimReminderLock,
    isRedis,
  };
}

module.exports = { createAudioStore };
