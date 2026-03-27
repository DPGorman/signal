-- Check-ins table for task completion tracking
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS check_ins (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  check_in_type VARCHAR(20) NOT NULL,
  overdue_count INTEGER DEFAULT 0,
  today_count INTEGER DEFAULT 0,
  upcoming_count INTEGER DEFAULT 0,
  tasks_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

-- Users can only see their own check-ins
CREATE POLICY "Users can view own check-ins" ON check_ins
  FOR SELECT USING (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));

-- Users can insert their own check-ins  
CREATE POLICY "Users can insert own check-ins" ON check_ins
  FOR INSERT WITH CHECK (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_check_ins_user_id ON check_ins(user_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_created_at ON check_ins(created_at);
CREATE INDEX IF NOT EXISTS idx_check_ins_type ON check_ins(check_in_type);

-- Add completed_at column to deliverables if it doesn't exist
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;