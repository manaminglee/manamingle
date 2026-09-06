/** Shared Framer Motion presets for the landing page. */

export const springSnappy = { type: 'spring', stiffness: 380, damping: 28, mass: 0.85 };
export const springSoft = { type: 'spring', stiffness: 120, damping: 18, mass: 0.9 };
export const easeOut = [0.22, 1, 0.36, 1];

export const fadeUp = {
  hidden: { opacity: 0, y: 28, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: easeOut },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.45, ease: easeOut } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: easeOut },
  },
};

export const slideDown = {
  hidden: { opacity: 0, y: -16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: easeOut },
  },
};

export const stagger = (delay = 0.08, delayChildren = 0.04) => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: delay, delayChildren },
  },
});

export const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -4, transition: springSnappy },
  tap: { scale: 0.98, transition: { duration: 0.12 } },
};

export const floatY = (distance = 12, duration = 4) => ({
  y: [0, -distance, 0],
  transition: { duration, repeat: Infinity, ease: 'easeInOut' },
});

export const pulseGlow = {
  opacity: [0.45, 0.85, 0.45],
  scale: [1, 1.06, 1],
  transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
};
