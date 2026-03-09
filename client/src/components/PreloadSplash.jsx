/**
 * PreloadSplash – Full-screen animated splash shown during initial app load
 */
import { useEffect, useState, useRef } from 'react';

const FALLBACK_MS = 6000;

export function PreloadSplash({ onReady, ready = false }) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const doneRef = useRef(false);

  // Fallback: let user through after FALLBACK_MS if socket never connects
  useEffect(() => {
    const t = setTimeout(() => {
      if (doneRef.current) return;
      setProgress(100);
    }, FALLBACK_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return Math.min(100, p + 10);
      });
    }, 35);
    return () => clearInterval(interval);
  }, [ready]);

  useEffect(() => {
    if (progress >= 100 && !doneRef.current) {
      doneRef.current = true;
      setFading(true);
      const t = setTimeout(() => {
        setVisible(false);
        onReady?.();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [progress, onReady]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#070811] text-white transition-opacity duration-300 ease-out ${fading ? 'opacity-0' : 'opacity-100'}`}
      style={{ animation: !fading && !ready ? 'preload-fade-in 0.4s ease-out' : undefined }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 40%, rgba(99,102,241,0.15), transparent)',
        }}
      />
      <div className="absolute inset-0 overflow-hidden">
        <div className="preload-grid" />
      </div>

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="preload-logo">
          <span className="text-4xl font-black text-white">M</span>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight text-white">Mana Mingle</h1>
          <p className="text-xs mt-1 text-white/40">WeConnect</p>
        </div>

        {/* Loading bar */}
        <div className="w-48 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Loading dots */}
        <div className="flex items-center gap-2">
          <div className="preload-dots">
            <span /><span /><span />
          </div>
          <span className="text-xs text-white/50">
            {ready ? (progress < 100 ? 'Loading...' : 'Ready!') : 'Initializing...'}
          </span>
        </div>
      </div>
    </div>
  );
}
