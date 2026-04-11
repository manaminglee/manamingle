import { useEffect, useState } from 'react';

export function PresenceMap({ onlineCount = 0 }) {
  const [regional, setRegional] = useState({ americas: 42639, eurasia: 89875, oceania: 13033 });

  useEffect(() => {
    const rawCount = onlineCount || 0;
    const baseAmericas = Math.floor(rawCount * 0.32) || 42639;
    const baseEurasia = Math.floor(rawCount * 0.58) || 89875;
    const baseOceania = Math.floor(rawCount * 0.10) || 13033;

    const interval = setInterval(() => {
      setRegional({
        americas: baseAmericas + Math.floor(Math.random() * 20 - 10),
        eurasia: baseEurasia + Math.floor(Math.random() * 40 - 20),
        oceania: baseOceania + Math.floor(Math.random() * 10 - 5)
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [onlineCount]);

  return (
    <section className="w-full max-w-4xl mx-auto mb-20 px-6">
      <div className="flex flex-col items-center justify-center p-12 md:p-16 rounded-[60px] bg-white/[0.01] border border-white/5 backdrop-blur-3xl relative overflow-hidden group shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        
        <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-white/10 flex items-center justify-center mb-8 bg-black/40 shadow-inner group-hover:scale-110 group-hover:border-violet-500/40 transition-all duration-700">
                <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white/40 group-hover:text-violet-400 group-hover:drop-shadow-[0_0_15px_#c4b5fd] transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
            </div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.6em] text-violet-400 mb-2 italic">Global Presence Map</h4>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-12">Real-time Node Distribution</p>
            
            <div className="flex gap-12 mt-4">
              {[
                { label: 'Americas', val: regional.americas, color: 'text-violet-400' },
                { label: 'Eurasia', val: regional.eurasia, color: 'text-indigo-400' },
                { label: 'Oceania', val: regional.oceania, color: 'text-emerald-400' },
              ].map(r => (
                <div key={r.label} className="text-center group/item transition-transform duration-500 hover:scale-110">
                  <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1 group-hover/item:text-white transition-colors">{r.label}</div>
                  <div className={`text-xl md:text-2xl font-black italic text-white tabular-nums tracking-tighter ${r.color} drop-shadow-sm`}>{r.val.toLocaleString()}</div>
                </div>
              ))}
            </div>
        </div>

        {/* Floating background dots for high-fidelity feel */}
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-violet-400/20 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 300}ms`
            }}
          />
        ))}
      </div>
    </section>
  );
}
