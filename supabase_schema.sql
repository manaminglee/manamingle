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

-- 7. Delta/Migration Patches (Safe to run multiple times)
-- This ensures existing tables get any newly added columns.
DO $$ 
BEGIN 
    -- Add authorized_ips if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='creators' AND column_name='authorized_ips') THEN
        ALTER TABLE creators ADD COLUMN authorized_ips TEXT[] DEFAULT '{}';
    END IF;

    -- Add password if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='creators' AND column_name='password') THEN
        ALTER TABLE creators ADD COLUMN password TEXT;
    END IF;

    -- Add earnings_rs if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='creators' AND column_name='earnings_rs') THEN
        ALTER TABLE creators ADD COLUMN earnings_rs INTEGER DEFAULT 0;
    END IF;

    -- Add referral_count if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='creators' AND column_name='referral_count') THEN
        ALTER TABLE creators ADD COLUMN referral_count INTEGER DEFAULT 0;
    END IF;

    -- Add coins_earned if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='creators' AND column_name='coins_earned') THEN
        ALTER TABLE creators ADD COLUMN coins_earned INTEGER DEFAULT 0;
    END IF;

    -- Fix ID column types if they were accidentally set to UUID
    -- This checks if the column is NOT text (e.g. if it's uuid)
    IF (SELECT data_type FROM information_schema.columns WHERE table_name='creators' AND column_name='id') <> 'text' THEN
        -- Temporarily drop foreign keys
        ALTER TABLE referral_logs DROP CONSTRAINT IF EXISTS referral_logs_creator_id_fkey;
        ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_creator_id_fkey;
        
        -- Convert columns to TEXT
        ALTER TABLE creators ALTER COLUMN id TYPE TEXT;
        ALTER TABLE referral_logs ALTER COLUMN creator_id TYPE TEXT;
        ALTER TABLE withdrawals ALTER COLUMN creator_id TYPE TEXT;
        
        -- Re-add foreign keys
        ALTER TABLE referral_logs ADD CONSTRAINT referral_logs_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE;
        ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE;
    END IF;

    -- Fix user_coins columns if any are missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_coins' AND column_name='last_claim_date') THEN
        ALTER TABLE user_coins ADD COLUMN last_claim_date TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_coins' AND column_name='streak') THEN
        ALTER TABLE user_coins ADD COLUMN streak INTEGER DEFAULT 1;
    END IF;
END $$;




