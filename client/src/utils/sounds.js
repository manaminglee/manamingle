/**
 * sounds.js — Lightweight Web Audio API sound engine for Mana Mingle
 * No external files needed — all synthesized in-browser
 */

let ctx = null;
const getCtx = () => {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
};

const play = (fn) => {
  try {
    const ac = getCtx();
    if (ac.state === 'suspended') ac.resume();
    fn(ac);
  } catch (e) {}
};

/** Warm "connected" chime — two ascending tones */
export const playConnectSound = () => play((ac) => {
  [[440, 0], [660, 0.15]].forEach(([freq, delay]) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
    gain.gain.setValueAtTime(0, ac.currentTime + delay);
    gain.gain.linearRampToValueAtTime(0.18, ac.currentTime + delay + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + 0.5);
    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + 0.55);
  });
});

/** Soft "message received" pop */
export const playMessageSound = () => play((ac) => {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(660, ac.currentTime + 0.12);
  gain.gain.setValueAtTime(0.12, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.22);
});

/** Descending "disconnect" tone */
export const playDisconnectSound = () => play((ac) => {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(220, ac.currentTime + 0.35);
  gain.gain.setValueAtTime(0.15, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.55);
});

/** Quick wave "whoosh" */
export const playWaveSound = () => play((ac) => {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain); gain.connect(ac.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(700, ac.currentTime + 0.2);
  gain.gain.setValueAtTime(0.1, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.35);
});
