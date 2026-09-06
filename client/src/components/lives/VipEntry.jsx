import { memo, useEffect, useRef, useState } from 'react';
import { GiftArt } from '../icons/GiftArt';
import { Avatar } from './LiveBits';
import { LevelFrame, frameFor } from './LevelFrame';

/**
 * Grand entrance for high-level viewers.
 *
 * Two rules keep this from becoming noise:
 *   · only levels that earned a frame get announced at all — an ordinary join
 *     is a one-line comment, not a takeover
 *   · entries QUEUE. Simultaneous arrivals play one at a time, and the queue is
 *     capped, so a raid cannot lock the screen behind a hundred banners.
 *
 * The vehicle is drawn from the gift catalog's own artwork, so entries and
 * gifts share one visual language instead of needing a second asset set.
 */

const SHOW_MS = 3200;
const GAP_MS = 260;
const MAX_QUEUE = 6;

/** Above this level the entry arrives in something. */
const VEHICLE_FOR = { gold: 'hyper_car', royal: 'private_jet', mythic: 'private_jet' };

export const VipEntry = memo(function VipEntry({ entries, onConsumed }) {
  const [current, setCurrent] = useState(null);
  const queueRef = useRef([]);
  const busyRef = useRef(false);
  const timerRef = useRef(null);

  // Ingest new arrivals without ever growing without bound.
  useEffect(() => {
    if (!entries?.length) return;
    const taken = [];
    for (const e of entries) {
      // Drop, don't buffer: a raid should not queue a minute of banners.
      if (queueRef.current.length < MAX_QUEUE) queueRef.current.push(e);
      taken.push(e.key);
    }
    onConsumed?.(taken);
  }, [entries, onConsumed]);

  // One at a time.
  useEffect(() => {
    const pump = () => {
      if (busyRef.current) return;
      const next = queueRef.current.shift();
      if (!next) return;
      busyRef.current = true;
      setCurrent(next);
      timerRef.current = setTimeout(() => {
        setCurrent(null);
        timerRef.current = setTimeout(() => {
          busyRef.current = false;
          pump();
        }, GAP_MS);
      }, SHOW_MS);
    };
    const t = setInterval(pump, 200);
    return () => { clearInterval(t); clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  if (!current) return null;

  const tier = frameFor(current.level);
  const vehicle = VEHICLE_FOR[tier.id] || null;

  return (
    <div className={`vip vip--${tier.id}`} aria-live="polite">
      <div className="vip__sweep" aria-hidden />

      {vehicle && (
        <span className="vip__vehicle" aria-hidden>
          <GiftArt id={vehicle} tier="legendary" size={40} />
        </span>
      )}

      <span className="vip__text">
        <span className="vip__name" style={{ color: current.nameColor || undefined }}>
          {current.username}
        </span>
        <span className="vip__verb">joined the room</span>
      </span>

      <LevelFrame level={current.level} size={38} className="vip__avatar">
        <Avatar className="vip__avatar-img" src={current.avatarUrl} name={current.username} />
      </LevelFrame>

      <span className="vip__lv">Lv{current.level}</span>
    </div>
  );
});

export default VipEntry;
