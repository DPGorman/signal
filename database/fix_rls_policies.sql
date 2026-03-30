-- ============================================================
-- SIGNAL: Fix incomplete RLS policies
-- Run in Supabase SQL Editor
-- ============================================================
-- Adds missing UPDATE policies for dimensions, replies, connections
-- Adds missing UPDATE/DELETE policies for check_ins
-- Fixes user_integrations and user_work_types policies
-- ============================================================

-- ─── dimensions: add UPDATE policy ───
DO $$ BEGIN
  CREATE POLICY "dimensions_update_own" ON dimensions FOR UPDATE
    USING (idea_id IN (SELECT id FROM ideas WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── replies: add UPDATE policy ───
DO $$ BEGIN
  CREATE POLICY "replies_update_own" ON replies FOR UPDATE
    USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── connections: add UPDATE policy ───
DO $$ BEGIN
  CREATE POLICY "connections_update_own" ON connections FOR UPDATE
    USING (idea_id_a IN (SELECT id FROM ideas WHERE user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── check_ins: add UPDATE and DELETE policies ───
DO $$ BEGIN
  CREATE POLICY "check_ins_update_own" ON check_ins FOR UPDATE
    USING (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "check_ins_delete_own" ON check_ins FOR DELETE
    USING (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── user_integrations: fix policies (existing one has no FOR clause) ───
DROP POLICY IF EXISTS "Users manage own integrations" ON user_integrations;

DO $$ BEGIN
  CREATE POLICY "user_integrations_select_own" ON user_integrations FOR SELECT
    USING (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "user_integrations_insert_own" ON user_integrations FOR INSERT
    WITH CHECK (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "user_integrations_update_own" ON user_integrations FOR UPDATE
    USING (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "user_integrations_delete_own" ON user_integrations FOR DELETE
    USING (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── user_work_types: fix policies (existing one has no FOR clause) ───
DROP POLICY IF EXISTS "Users manage own work types" ON user_work_types;

DO $$ BEGIN
  CREATE POLICY "user_work_types_select_own" ON user_work_types FOR SELECT
    USING (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "user_work_types_insert_own" ON user_work_types FOR INSERT
    WITH CHECK (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "user_work_types_update_own" ON user_work_types FOR UPDATE
    USING (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "user_work_types_delete_own" ON user_work_types FOR DELETE
    USING (auth.uid()::text = (SELECT auth_id FROM users WHERE id = user_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
