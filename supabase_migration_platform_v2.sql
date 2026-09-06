-- Platform v2: push subscriptions, scheduled lives, live replay metadata

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_owner ON push_subscriptions(owner_key);

CREATE TABLE IF NOT EXISTS mm_scheduled_lives (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  title TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  reminder_sent BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scheduled_lives_starts ON mm_scheduled_lives(starts_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_lives_creator ON mm_scheduled_lives(creator_id);

-- Post-live recap (chat/gift timeline already in mm_live_comments / mm_live_gift_receipts)
ALTER TABLE mm_live_streams ADD COLUMN IF NOT EXISTS replay_summary JSONB;
ALTER TABLE mm_live_streams ADD COLUMN IF NOT EXISTS replay_url TEXT;
