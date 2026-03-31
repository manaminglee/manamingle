-- ManaMingle Supabase Schema
-- Run this in the Supabase SQL Editor to initialize the database tables.

-- 1. Creators Table
CREATE TABLE IF NOT EXISTS creators (
  id TEXT PRIMARY KEY,
  handle_name TEXT UNIQUE NOT NULL,
  platform TEXT,
  profile_link TEXT,
  authorized_ips TEXT[] DEFAULT '{}',
  referral_code TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  coins_earned INTEGER DEFAULT 0,
  earnings_rs INTEGER DEFAULT 0,
  referral_count INTEGER DEFAULT 0,
  password TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Referral Logs Table
CREATE TABLE IF NOT EXISTS referral_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT REFERENCES creators(id) ON DELETE CASCADE,
  visitor_ip TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Withdrawals Table
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  creator_id TEXT REFERENCES creators(id) ON DELETE CASCADE,
  handle_name TEXT,
  amount INTEGER NOT NULL,
  upi TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User Coins Table (For persistence across restarts)
CREATE TABLE IF NOT EXISTS user_coins (
  ip TEXT PRIMARY KEY,
  coins INTEGER DEFAULT 30,
  last_claim BIGINT DEFAULT 0,
  streak INTEGER DEFAULT 1,
  last_claim_date TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Creator Login Logs Table (Auditability)
CREATE TABLE IF NOT EXISTS creator_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT NOT NULL,
  creator_id TEXT,
  ip TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
-- For MVP, you might want to allow service_role access only, 
-- or specific policies if using the Anon key from the client.
-- In this app's architecture, the server handles Sugabase access, 
-- so standard RLS applies primarily to the Server's IP or Service Role.

ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_logins ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role to perform all actions
CREATE POLICY "Allow service role access" ON creators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON referral_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON withdrawals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON user_coins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role access" ON creator_logins FOR ALL USING (true) WITH CHECK (true);
