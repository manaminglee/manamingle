import { useState } from 'react';

// Optional: pass podCounts={{ gaming: 43, music: 12, ... }} for live counts
const REALMS = [
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'movies', label: 'Movies', emoji: '🎬' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'tech', label: 'Tech', emoji: '💻' },
  { id: 'art', label: 'Art', emoji: '🎨' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'books', label: 'Books', emoji: '📚' },
  { id: 'fitness', label: 'Fitness', emoji: '💪' },
  { id: 'cooking', label: 'Cooking', emoji: '🍳' },
  { id: 'photography', label: 'Photography', emoji: '📷' },
  { id: 'entrepreneur', label: 'Startups', emoji: '🚀' },
];

const VIBES = [
  { id: 'chill', label: 'Chill', desc: 'Relaxed, low-key' },
  { id: 'hype', label: 'Hype', desc: 'High energy' },
  { id: 'deep', label: 'Deep talks', desc: 'Meaningful convos' },
  { id: 'fun', label: 'Fun & jokes', desc: 'Light-hearted' },
  { id: 'learn', label: 'Learn something', desc: 'Share knowledge' },
];

export function InterestEntry({ onJoin, connected, podCounts }) {
  const [realm, setRealm] = useState('');
  const [vibe, setVibe] = useState('chill');
  const [nickname, setNickname] = useState('');
  const [customRealm, setCustomRealm] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleSubmit = (e, quickMatch = false) => {
    e?.preventDefault();
    const interest = quickMatch ? REALMS[Math.floor(Math.random() * REALMS.length)].id : (realm || customRealm.trim().toLowerCase());
    if (!interest && !quickMatch) return;
    setIsJoining(true);
    onJoin(interest, nickname.trim() || 'Anonymous', vibe || 'chill');
    // Reset joining state when parent navigates (connection flow handles transition)
    setTimeout(() => setIsJoining(false), 3000);
  };

  const selected = realm || customRealm;

  return (
    <div className="min-h-screen flex flex-col bg-realm-void bg-realm-gradient">
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* Ambient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/6 w-72 h-72 bg-realm-teal/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-1/3 right-1/6 w-56 h-56 bg-realm-amber/8 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-realm-mint/5 rounded-full blur-3xl animate-pulse-soft" />
        </div>

        <div className="relative w-full max-w-lg">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-realm-mint via-realm-teal to-realm-gold font-display tracking-tight">
              Realm
            </h1>
            <p className="text-realm-muted mt-2 text-sm max-w-md mx-auto">
              Join a small chat pod (max 4 people) based on shared interests.
            </p>
          </div>

          {!connected && (
            <div className="flex items-center gap-2 justify-center mb-6 py-2 px-4 rounded-full bg-realm-card/80 border border-realm-border">
              <span className="w-2 h-2 rounded-full bg-realm-amber animate-pulse" />
              <span className="text-sm text-realm-muted">Connecting…</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-realm-muted mb-3">Pick a realm (or type your own)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {REALMS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setRealm(r.id); setCustomRealm(''); }}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-teal-500/20 ${
                      realm === r.id
                        ? 'bg-realm-teal/20 text-realm-mint border border-realm-teal/50 shadow-pod scale-105 shadow-lg'
                        : 'bg-realm-card text-realm-muted border border-realm-border hover:border-realm-muted/50 hover:text-white'
                    }`}
                  >
                    <span className="mr-1.5">{r.emoji}</span>
                    {r.label}
                    {podCounts?.[r.id] != null && (
                      <span className="ml-1.5 text-[10px] text-realm-muted font-normal">{podCounts[r.id]} pods</span>
                    )}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customRealm}
                onChange={(e) => { setCustomRealm(e.target.value); setRealm(''); }}
                placeholder="Or type: anime, crypto, kpop..."
                className="w-full px-4 py-3 rounded-xl bg-realm-surface border border-realm-border text-white placeholder-realm-muted/60 focus:border-realm-teal focus:ring-1 focus:ring-realm-teal/50 outline-none transition font-sans"
                maxLength={25}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-realm-muted mb-2">Your vibe</label>
              <div className="flex flex-wrap gap-2">
                {VIBES.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVibe(v.id)}
                    className={`px-3 py-2 rounded-xl text-sm transition-all ${
                      vibe === v.id
                        ? 'bg-realm-gold/15 text-realm-gold border border-realm-gold/40'
                        : 'bg-realm-card/60 text-realm-muted border border-realm-border hover:border-realm-gold/30 hover:text-realm-gold/80'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-realm-muted mb-1">Display name (optional)</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Anonymous"
                className="w-full px-4 py-3 rounded-xl bg-realm-surface border border-realm-border text-white placeholder-realm-muted/60 focus:border-realm-teal focus:ring-1 focus:ring-realm-teal/50 outline-none transition"
                maxLength={25}
                autoComplete="off"
              />
            </div>

            <p className="text-xs text-realm-muted/70 -mt-2">Pod size: 2–4 people</p>

            <button
              type="submit"
              disabled={!connected || !selected || isJoining}
              className="w-full py-4 rounded-2xl font-semibold text-realm-void bg-gradient-to-r from-realm-mint to-realm-teal hover:from-realm-teal hover:to-realm-mint focus:ring-2 focus:ring-realm-mint/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 shadow-pod flex items-center justify-center gap-2"
            >
              {isJoining ? (
                <>
                  <span className="animate-pulse">🔎</span>
                  <span>Searching pod...</span>
                </>
              ) : (
                'Find My Pod'
              )}
            </button>

            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              disabled={!connected || isJoining}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-realm-muted border border-realm-border hover:border-realm-teal/40 hover:text-realm-mint transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Quick Match — random pod
            </button>
          </form>

          <p className="text-center text-realm-muted/70 text-xs mt-6">
            Same realm = same pod. Meet up to 3 others who share your interest.
          </p>
        </div>
      </div>
    </div>
  );
}
