-- User integrations table for storing OAuth tokens
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS user_integrations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  provider VARCHAR(50) NOT NULL,     -- e.g. 'google_calendar', 'apple_calendar'
  refresh_token TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own integrations
CREATE POLICY "Users manage own integrations" ON user_integrations
  USING (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));

CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON user_integrations(provider);