import { memo } from 'react';

/**
 * Avatar frames earned by level.
 *
 * Original geometry, generated from a few repeated elements rather than drawn
 * by hand — studs, points and laurels are placed on a circle by angle, so every
 * one is evenly spaced. Uneven ornament is what makes a status frame look
 * cheap, and these are the reward for spending real money.
 *
 * Tiers are deliberately far apart. A frame that changes every level stops
 * meaning anything; five steps across forty levels stays legible in a comment
 * row at 26px.
 */

export const FRAME_TIERS = [
  { id: 'none', min: 0, label: null },
  { id: 'bronze', min: 10, label: 'Bronze' },
  { id: 'silver', min: 20, label: 'Silver' },
  { id: 'gold', min: 30, label: 'Gold' },
  { id: 'royal', min: 40, label: 'Royal' },
  { id: 'mythic', min: 60, label: 'Mythic' },
];

export function frameFor(level = 0) {
  const n = Number(level) || 0;
  let tier = FRAME_TIERS[0];
  for (const t of FRAME_TIERS) if (n >= t.min) tier = t;
  return tier;
}

const PALETTE = {
  bronze: { a: '#e6a86a', b: '#a2662f', glow: 'rgba(230,168,106,0.42)' },
  silver: { a: '#e8eef7', b: '#94a3b8', glow: 'rgba(226,232,240,0.42)' },
  gold: { a: '#ffe9a8', b: '#d4a017', glow: 'rgba(251,191,36,0.5)' },
  royal: { a: '#e9c8ff', b: '#8b3ff0', glow: 'rgba(168,85,247,0.5)' },
  mythic: { a: '#ffd0e4', b: '#ff2d6f', glow: 'rgba(255,45,111,0.55)' },
};

/** Evenly spaced points on a circle — the reason the ornament reads as even. */
function ring(count, radius, cx = 28, cy = 28, offset = -90) {
  return Array.from({ length: count }, (_, i) => {
    const a = ((offset + (360 / count) * i) * Math.PI) / 180;
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  });
}

/** A small upright diamond — the ornament that repeats around the band. */
function jewel(x, y, s) {
  return `M${x} ${y - s}L${x + s} ${y}L${x} ${y + s}L${x - s} ${y}Z`;
}

export const LevelFrame = memo(function LevelFrame({ level = 0, size = 44, children, className = '' }) {
  const tier = frameFor(level);
  if (tier.id === 'none') {
    return <span className={`lvf lvf--none ${className}`.trim()} style={{ width: size, height: size }}>{children}</span>;
  }

  const c = PALETTE[tier.id];
  const s = Number(size) || 44;
  const gid = `lvf-${tier.id}`;
  const hasCrown = tier.id === 'royal' || tier.id === 'mythic';

  // The avatar sits in the middle 76%; the frame occupies the outer band.
  return (
    <span
      className={`lvf lvf--${tier.id} ${className}`.trim()}
      style={{ width: s, height: s, '--lvf-glow': c.glow }}
    >
      <span className="lvf__inner">{children}</span>
      <svg className="lvf__ring" viewBox="0 0 56 56" aria-hidden focusable="false">
        <defs>
          <linearGradient id={gid} x1="10" y1="6" x2="46" y2="50" gradientUnits="userSpaceOnUse">
            <stop stopColor={c.a} />
            <stop offset="1" stopColor={c.b} />
          </linearGradient>
        </defs>

        <circle cx="28" cy="28" r="22" fill="none" stroke={`url(#${gid})`} strokeWidth="2.6" />

        {/* Only the studs turn. A crown that rotates stops reading as a crown,
            so everything with an "up" stays outside this group. */}
        <g className="lvf__spin">
          {tier.id === 'bronze'
            ? ring(2, 22).map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="2.6" fill={`url(#${gid})`} />
            ))
            : ring(tier.id === 'silver' ? 4 : 8, 22).map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={tier.id === 'silver' ? 2.4 : 1.9} fill={`url(#${gid})`} />
            ))}
        </g>

        {/* Cardinal jewels sit OUTSIDE the ring, in the light tone, so they read
            as ornament rather than disappearing into the band. The north slot is
            skipped once a crown occupies it. */}
        {(tier.id === 'gold' || tier.id === 'royal' || tier.id === 'mythic') && ring(4, 25.8)
          .filter(([, y]) => !(hasCrown && y < 10))
          .filter(([x]) => !(tier.id === 'mythic' && Math.abs(x - 28) > 10))
          .map(([x, y], i) => (
            <path key={i} d={jewel(x, y, 2.7)} fill={c.a} stroke={c.b} strokeWidth="0.6" />
          ))}

        {/* mythic: plumes rooted on the ring's shoulders, fanning into the
            empty corners. Rooted anywhere lower they cross the avatar and read
            as whiskers rather than wings. */}
        {tier.id === 'mythic' && (
          <g stroke={c.a} strokeLinecap="round" fill="none">
            <path d="M12.4 12.4 2.6 8.4" strokeWidth="2.6" />
            <path d="M12.4 12.4 3.6 3.6" strokeWidth="2.4" />
            <path d="M12.4 12.4 8.4 2.6" strokeWidth="2.2" />
            <path d="M43.6 12.4 53.4 8.4" strokeWidth="2.6" />
            <path d="M43.6 12.4 52.4 3.6" strokeWidth="2.4" />
            <path d="M43.6 12.4 47.6 2.6" strokeWidth="2.2" />
          </g>
        )}

        {/* royal and up: an upright crown seated on the top of the ring */}
        {hasCrown && (
          <>
            <path
              d="M22.5 6.6 24.1 1.6 26.4 4.4 28 0.4 29.6 4.4 31.9 1.6 33.5 6.6Z"
              fill={`url(#${gid})`}
              stroke={c.a}
              strokeWidth="1"
              strokeLinejoin="round"
            />
            <circle cx="24.1" cy="1.6" r="1.15" fill={c.a} />
            <circle cx="28" cy="0.6" r="1.3" fill={c.a} />
            <circle cx="31.9" cy="1.6" r="1.15" fill={c.a} />
            <rect x="21.8" y="6.2" width="12.4" height="2.3" rx="1.15" fill={c.a} stroke={c.b} strokeWidth="0.5" />
          </>
        )}
      </svg>
    </span>
  );
});

export default LevelFrame;
