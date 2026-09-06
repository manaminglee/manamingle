import { memo } from 'react';
import { motion } from 'framer-motion';
import { floatY, pulseGlow } from '../utils/landingMotion';

/**
 * Animated mesh background — gradient orbs + subtle grid.
 * Respects low-power mode (static fallback).
 */
export const LandingBackground = memo(function LandingBackground({ lowPower = false }) {
  if (lowPower) {
    return (
      <div className="lv2-bg lv2-bg--static" aria-hidden>
        <div className="lv2-bg__base" />
      </div>
    );
  }

  return (
    <div className="lv2-bg" aria-hidden>
      <div className="lv2-bg__base" />
      <div className="lv2-bg__grid" />
      <motion.div
        className="lv2-bg__orb lv2-bg__orb--violet"
        animate={floatY(18, 5.5)}
      />
      <motion.div
        className="lv2-bg__orb lv2-bg__orb--rose"
        animate={floatY(14, 6.8)}
      />
      <motion.div
        className="lv2-bg__orb lv2-bg__orb--cyan"
        animate={floatY(10, 7.2)}
      />
      <motion.div
        className="lv2-bg__orb lv2-bg__orb--amber"
        animate={floatY(8, 4.9)}
      />
      <motion.div className="lv2-bg__pulse" animate={pulseGlow} />
    </div>
  );
});

export default LandingBackground;
