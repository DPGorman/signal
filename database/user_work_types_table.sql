-- User work types table for adaptive onboarding
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS user_work_types (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type_name VARCHAR(100) NOT NULL,
  creator_category VARCHAR(50),   -- screenwriter, designer, filmmaker, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, type_name)
);

ALTER TABLE user_work_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own work types" ON user_work_types
  USING (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));

CREATE INDEX IF NOT EXISTS idx_user_work_types_user_id ON user_work_types(user_id);