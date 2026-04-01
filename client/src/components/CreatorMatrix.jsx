import { useState } from 'react';

export function CreatorMatrix({ creatorStatus, onOpenDashboard, onOpenApply, onOpenStatus, onOpenLogin, onEditProfile, onWithdraw, onLogout, showAlert }) {
  return (
    <section className="w-full max-w-4xl mx-auto mb-20 px-6 animate-fade-in-up">
      <div className="p-10 md:p-14 rounded-[60px] bg-[#0c0e1a]/80 border border-white/10 text-center relative overflow-hidden group shadow-[0_40px_100px_rgba(0,0,0,0.5)] backdrop-blur-3xl">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-8">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#22d3ee]" />
            Creator Hub
          </div>
          <h3 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter mb-6 leading-[0.9] text-white">Share your <span className="text-cyan-400 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]">Influence.</span></h3>
          <p className="text-[11px] md:text-sm font-bold text-white/30 uppercase tracking-[0.4em] mb-12 max-w-lg mx-auto leading-relaxed italic">Monetize your reach. Participate in the global social economy with ManaMingle.</p>

          <div className="flex flex-wrap items-center justify-center gap-5">
            <button
              onClick={() => creatorStatus?.handle_name ? onOpenDashboard() : onOpenApply()}
              className="px-10 py-5 bg-white text-black font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-cyan-400 hover:scale-105 hover:-rotate-1 transition-all shadow-2xl active:scale-95 flex items-center gap-2"
            >
              <span className="text-sm italic">⭐</span>
              {creatorStatus?.handle_name ? 'Open Dashboard' : 'Apply Now'}
            </button>

            {(!creatorStatus || !creatorStatus.handle_name) && (
              <>
                <button
                  onClick={onOpenStatus}
                  className="px-10 py-5 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-cyan-500/20 hover:text-cyan-400 hover:scale-105 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                  <span>🔍</span> Status Check
                </button>
                <button
                  onClick={onOpenLogin}
                  className="px-10 py-5 bg-black/60 border border-white/10 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-white hover:text-black hover:scale-105 transition-all backdrop-blur-3xl shadow-xl active:scale-95"
                >
                  Creator Login
                </button>
              </>
            )}
          </div>

          {creatorStatus?.handle_name && (
            <div className="mt-12 flex flex-col items-center gap-6">
               <div className="flex flex-wrap items-center justify-center gap-5 text-[10px] font-black uppercase tracking-widest text-white/40 italic">
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                    Verified: @{creatorStatus.handle_name}
                  </span>
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500">
                    Earnings: ₹{creatorStatus.earnings_rs || 0}
                  </span>
                  <button onClick={onEditProfile} className="text-cyan-400 hover:text-white transition-colors underline decoration-cyan-500/20">Edit Identity Profiler</button>
                  <button onClick={onLogout} className="text-rose-500/60 hover:text-rose-400 transition-colors">Logout Session</button>
               </div>

               {creatorStatus.status === 'approved' && (
                 <div className="flex flex-col items-center gap-3 animate-fade-in">
                    <button
                      onClick={async () => {
                        const upi = prompt('Enter UPI ID for Payout:');
                        if (upi) {
                          const res = await onWithdraw(upi);
                          if (res.error) alert(res.error);
                          else (await showAlert('Transmitted', 'Withdrawal request sent to admin. Coins will be debited after verified.'));
                        }
                      }}
                      className="px-10 py-5 bg-emerald-500 text-black text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-white hover:scale-105 transition-all shadow-[0_20px_40px_rgba(16,185,129,0.2)] active:scale-95 flex items-center gap-2"
                    >
                      💸 Withdraw Earnings
                    </button>
                    <div className="text-[9px] font-black text-white/10 uppercase tracking-widest italic animate-pulse">
                      10,000 Click-throughs = ₹150.00
                    </div>
                 </div>
               )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
