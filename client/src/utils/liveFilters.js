/**
 * Beauty / look presets for a creator's camera.
 *
 * These are applied in the canvas pipeline BEFORE the track is published, so
 * what the audience sees is what the creator picked — not a CSS filter that
 * only exists on their own screen. That distinction matters: a CSS filter on
 * the local <video> looks identical in preview and does nothing for viewers.
 *
 * Each preset is a small recipe the renderer executes:
 *   tone     a ctx.filter string applied to the base draw (free — one pass)
 *   smooth   0..1 blend of a blurred copy over the face region only
 *   glow     0..1 screen-ish bloom from a blurred bright copy (one extra pass)
 *   vignette 0..1 corner darkening, drawn as a radial gradient (cheap)
 *
 * Cost is stated per preset so the picker can warn on low-end devices: every
 * extra pass is a full-frame blur at 28fps, which is exactly where a mid-range
 * Android starts dropping the stream.
 */

export const LIVE_FILTERS = [
  {
    id: 'off',
    label: 'Off',
    hint: 'Straight from the camera',
    tone: null,
    smooth: 0, glow: 0, vignette: 0,
    cost: 0,
  },
  {
    id: 'natural',
    label: 'Natural',
    hint: 'Gentle lift, nothing obvious',
    tone: 'brightness(1.04) contrast(1.03) saturate(1.05)',
    smooth: 0.18, glow: 0, vignette: 0,
    cost: 1,
  },
  {
    id: 'smooth',
    label: 'Smooth',
    hint: 'Softer skin, even tone',
    tone: 'brightness(1.07) contrast(1.02) saturate(1.06)',
    smooth: 0.42, glow: 0, vignette: 0,
    cost: 1,
  },
  {
    id: 'glow',
    label: 'Glow',
    hint: 'Soft bloom in the highlights',
    tone: 'brightness(1.06) contrast(1.04) saturate(1.10)',
    smooth: 0.30, glow: 0.30, vignette: 0.10,
    cost: 2,
  },
  {
    id: 'warm',
    label: 'Warm',
    hint: 'Golden, evening light',
    tone: 'brightness(1.05) contrast(1.05) saturate(1.14) sepia(0.16)',
    smooth: 0.26, glow: 0.14, vignette: 0.14,
    cost: 2,
  },
  {
    id: 'rose',
    label: 'Rose',
    hint: 'Warm pink cast',
    tone: 'brightness(1.06) contrast(1.02) saturate(1.18) hue-rotate(-8deg)',
    smooth: 0.34, glow: 0.18, vignette: 0.10,
    cost: 2,
  },
  {
    id: 'cool',
    label: 'Cool',
    hint: 'Clean, blue-leaning',
    tone: 'brightness(1.03) contrast(1.08) saturate(1.02) hue-rotate(6deg)',
    smooth: 0.20, glow: 0, vignette: 0.12,
    cost: 1,
  },
  {
    id: 'film',
    label: 'Film',
    hint: 'Faded, cinematic',
    tone: 'brightness(1.02) contrast(1.14) saturate(0.88) sepia(0.10)',
    smooth: 0.14, glow: 0, vignette: 0.28,
    cost: 1,
  },
  {
    id: 'mono',
    label: 'Mono',
    hint: 'Black and white',
    tone: 'grayscale(1) brightness(1.06) contrast(1.12)',
    smooth: 0.16, glow: 0, vignette: 0.22,
    cost: 1,
  },
];

export const DEFAULT_FILTER = 'natural';

const BY_ID = new Map(LIVE_FILTERS.map((f) => [f.id, f]));

export function getFilter(id) {
  return BY_ID.get(String(id || '')) || BY_ID.get(DEFAULT_FILTER);
}

/**
 * Scale a preset by a 0..1 strength dial, so one slider covers every look.
 * Tone is left alone — half a hue rotation is not "half the preset", it is a
 * different colour. Only the blend amounts scale.
 */
export function scaleFilter(preset, strength = 1) {
  const s = Math.max(0, Math.min(1, Number(strength)));
  if (s === 1) return preset;
  return {
    ...preset,
    smooth: preset.smooth * s,
    glow: preset.glow * s,
    vignette: preset.vignette * s,
  };
}

/** A CSS filter string for previewing a look on a plain <video> or thumbnail. */
export function cssPreview(id) {
  const f = getFilter(id);
  return f.tone || 'none';
}
