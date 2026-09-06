import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '../../config/apiBase';
import { NutsSymbol } from '../NutsSymbol';
import { GiftArt } from '../icons/GiftArt';
import { MmIcon } from '../icons/MmIcon';
import { Sheet } from './LiveBits';

/* Catalog is fetched once per page load and cached at module scope. The
   artwork is ours — inline SVG from components/icons/GiftArt — so a shelf of
   40 gifts costs zero network requests and looks identical on every device
   (emoji do not: each platform draws its own). */
let catalogCache = null;
let catalogPromise = null;

function loadCatalog() {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (!catalogPromise) {
    catalogPromise = fetch(`${API_BASE}/api/economy/catalog`)
      .then((r) => r.json())
      .then((d) => {
        catalogCache = {
          gifts: d.gifts || [],
          categories: d.categories || [],
        };
        return catalogCache;
      })
      .catch(() => ({ gifts: [], categories: [] }));
  }
  return catalogPromise;
}

const PER_PAGE = 8;   // 4 × 2 — one thumb-swipe per shelf page

/** Dot-grouped like the price ladder itself: 9.999.999 reads faster than 9999999. */
function nuts(n) {
  return Number(n || 0).toLocaleString('de-DE');
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/* ------------------------------------------------------------------ badges */

const LuckyChest = memo(function LuckyChest() {
  return (
    <svg className="gt-badge gt-badge--lucky" viewBox="0 0 24 24" aria-label="Lucky gift">
      <title>Lucky — every send rolls for a bonus</title>
      <path d="M3.2 9.6h17.6v10a1.6 1.6 0 0 1-1.6 1.6H4.8a1.6 1.6 0 0 1-1.6-1.6z" fill="#f59e0b" />
      <path d="M12 2.6c4.4 0 8.8 2.6 8.8 7H3.2c0-4.4 4.4-7 8.8-7Z" fill="#fbbf24" />
      <path d="M3.2 11.8h17.6v3H3.2z" fill="#b45309" />
      <path d="M10.2 11.8h3.6v5h-3.6z" fill="#fde68a" />
    </svg>
  );
});

const LevelLock = memo(function LevelLock({ level, unlocked }) {
  return (
    <span className={`gt-badge gt-badge--lv${unlocked ? ' gt-badge--lv-on' : ''}`}>
      <MmIcon name="crown" size={9} />
      Lv{level}
    </span>
  );
});

/* -------------------------------------------------------------------- card */

const GiftCard = memo(function GiftCard({ gift, selected, affordable, locked, still, onSelect }) {
  return (
    <button
      type="button"
      className={[
        'gt-card',
        `gt-card--${gift.tier}`,
        selected ? 'gt-card--on' : '',
        locked ? 'gt-card--locked' : '',
        !affordable && !locked ? 'gt-card--poor' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onSelect(gift)}
      aria-pressed={selected}
      aria-label={`${gift.name}, ${nuts(gift.cost)} Nuts${locked ? `, locked until level ${gift.minLevel}` : ''}`}
    >
      {gift.lucky && <LuckyChest />}
      {gift.minLevel > 0 && <LevelLock level={gift.minLevel} unlocked={!locked} />}

      <span className="gt-card__art">
        <GiftArt
          id={gift.art || gift.id}
          tier={gift.tier}
          motion={gift.motion}
          still={still}
          size={56}
        />
      </span>
      <span className="gt-card__name">{gift.name}</span>
      <span className="gt-card__cost">
        <NutsSymbol size={11} />
        {nuts(gift.cost)}
      </span>
    </button>
  );
});

/* -------------------------------------------------------------------- tray */

/**
 * The gift tray.
 *
 * Shelves across the top, a swipeable paged grid below, and a persistent
 * send bar. Selecting is separate from sending: pick, see the price against
 * your balance, then confirm. Repeat sends happen on the combo button out in
 * the room, so the tray does not have to reopen.
 *
 * Performance: only the page in view animates. Every other page is rendered
 * `still` and marked `content-visibility: auto`, so a 40-gift catalog costs
 * about as much as eight cards.
 */
export function LiveGiftTray({
  open,
  onClose,
  onSend,
  balance = 0,
  level = 0,
  battle = null,
  onRecharge,
}) {
  const [catalog, setCatalog] = useState(catalogCache || { gifts: [], categories: [] });
  const [category, setCategory] = useState('hot');
  const [selected, setSelected] = useState(null);
  const [side, setSide] = useState('A');
  const [sending, setSending] = useState(false);
  const [shortfall, setShortfall] = useState(null);
  const [page, setPage] = useState(0);
  const pagerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    loadCatalog().then((c) => { if (alive) setCatalog(c); });
    return () => { alive = false; };
  }, [open]);

  useEffect(() => {
    if (!open) { setShortfall(null); setSending(false); }
  }, [open]);

  const tabs = catalog.categories?.length
    ? catalog.categories
    : [{ id: 'hot', label: 'Hot' }];

  const shelf = useMemo(() => {
    const list = catalog.gifts || [];
    if (category === 'hot') {
      const flagged = list.filter((x) => x.hot).sort((a, b) => a.cost - b.cost);
      return flagged.length <= PER_PAGE
        ? flagged
        : [...flagged.slice(0, 6), ...flagged.slice(-2)];
    }
    return list.filter((x) => x.category === category).sort((a, b) => a.cost - b.cost);
  }, [catalog.gifts, category]);

  const pages = useMemo(() => chunk(shelf, PER_PAGE), [shelf]);

  // Changing shelf resets the pager to the first page.
  useEffect(() => {
    setPage(0);
    if (pagerRef.current) pagerRef.current.scrollLeft = 0;
  }, [category]);

  const onPagerScroll = useCallback((e) => {
    const el = e.currentTarget;
    const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setPage((cur) => (cur === next ? cur : next));
  }, []);

  const goToPage = useCallback((i) => {
    const el = pagerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }, []);

  const isLocked = useCallback((g) => (g.minLevel || 0) > level, [level]);
  const canAfford = selected ? balance >= selected.cost : false;
  const selectedLocked = selected ? isLocked(selected) : false;

  const topGift = useMemo(() => {
    const list = catalog.gifts || [];
    return list.reduce((best, g) => (!best || g.cost > best.cost ? g : best), null);
  }, [catalog.gifts]);

  const send = async () => {
    if (!selected || sending || selectedLocked) return;
    if (!canAfford) {
      setShortfall(selected.cost - balance);
      return;
    }
    setSending(true);
    const res = await onSend?.(selected.id, battle ? side : 'A', selected);
    setSending(false);
    if (res?.insufficient) {
      setShortfall(Math.max(1, (res.needed || selected.cost) - (res.balance ?? balance)));
      return;
    }
    if (res?.ok) onClose?.();
  };

  return (
    <Sheet
      open={open}
      className="live-sheet--gifts"
      title={topGift
        ? `Chasing the top gift — ${topGift.name}, ${nuts(topGift.cost)} Nuts`
        : 'Send a gift'}
      onClose={onClose}
      tall
      foot={shortfall ? null : (
        <div className="gt-foot">
          <button type="button" className="gt-balance" onClick={() => onRecharge?.(shortfall)}>
            <NutsSymbol size={15} />
            <span className="gt-balance__num">{nuts(balance)}</span>
            <span className="gt-balance__add">
              <MmIcon name="plus" size={11} />
            </span>
          </button>
          <button
            type="button"
            className="gt-send"
            disabled={!selected || sending || selectedLocked}
            onClick={send}
          >
            {sending ? 'Sending…'
              : selectedLocked ? `Unlocks at Lv${selected.minLevel}`
              : selected ? 'Send'
              : 'Pick a gift'}
          </button>
        </div>
      )}
    >
      {shortfall ? (
        <div className="live-recharge">
          <NutsSymbol size={40} />
          <p className="live-recharge__title">Not enough Nuts</p>
          <p className="live-recharge__sub">
            You need {nuts(shortfall)} more to send {selected?.name}.
          </p>
          <button type="button" className="live-recharge__btn" onClick={() => onRecharge?.(shortfall)}>
            Top up
          </button>
          <button type="button" className="live-chip" onClick={() => setShortfall(null)}>
            Pick another gift
          </button>
        </div>
      ) : (
        <>
          {battle && (
            <div className="gt-tabs gt-tabs--battle">
              <button
                type="button"
                className={`gt-tab${side === 'A' ? ' gt-tab--on' : ''}`}
                onClick={() => setSide('A')}
              >
                @{battle.handleA}
              </button>
              <button
                type="button"
                className={`gt-tab${side === 'B' ? ' gt-tab--on' : ''}`}
                onClick={() => setSide('B')}
              >
                @{battle.handleB}
              </button>
            </div>
          )}

          <div className="gt-tabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={category === t.id}
                className={`gt-tab${category === t.id ? ' gt-tab--on' : ''}`}
                onClick={() => setCategory(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="gt-pager" ref={pagerRef} onScroll={onPagerScroll}>
            {pages.map((rows, i) => (
              <div className="gt-page" key={i}>
                {rows.map((g) => (
                  <GiftCard
                    key={g.id}
                    gift={g}
                    selected={selected?.id === g.id}
                    affordable={balance >= g.cost}
                    locked={isLocked(g)}
                    still={i !== page}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            ))}
          </div>

          {pages.length > 1 && (
            <div className="gt-dots" role="tablist" aria-label="Gift pages">
              {pages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`gt-dot${i === page ? ' gt-dot--on' : ''}`}
                  onClick={() => goToPage(i)}
                  aria-label={`Page ${i + 1}`}
                  aria-selected={i === page}
                  role="tab"
                />
              ))}
            </div>
          )}

          {!shelf.length && (
            <p className="gt-empty">Loading gifts…</p>
          )}
        </>
      )}
    </Sheet>
  );
}

export default LiveGiftTray;
