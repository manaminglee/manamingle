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

-- 6. Admin History Table (Auditability & Records)
CREATE TABLE IF NOT EXISTS admin_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_coins ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe to re-run)
DROP POLICY IF EXISTS "Allow full access" ON creators;
DROP POLICY IF EXISTS "Allow full access" ON referral_logs;
DROP POLICY IF EXISTS "Allow full access" ON withdrawals;
DROP POLICY IF EXISTS "Allow full access" ON user_coins;
DROP POLICY IF EXISTS "Allow full access" ON creator_logins;
DROP POLICY IF EXISTS "Allow full access" ON admin_history;
DROP POLICY IF EXISTS "Allow service role access" ON creators;
DROP POLICY IF EXISTS "Allow service role access" ON referral_logs;
DROP POLICY IF EXISTS "Allow service role access" ON withdrawals;
DROP POLICY IF EXISTS "Allow service role access" ON user_coins;
DROP POLICY IF EXISTS "Allow service role access" ON creator_logins;
DROP POLICY IF EXISTS "Allow service role access" ON admin_history;

-- Policy: Allow ALL operations (server uses service_role key which bypasses RLS anyway)
-- These permissive policies are a safety net for anon key fallback
CREATE POLICY "Allow full access" ON creators FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access" ON referral_logs FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access" ON withdrawals FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access" ON user_coins FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access" ON creator_logins FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access" ON admin_history FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);
