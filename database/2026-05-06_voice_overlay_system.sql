-- Signal — Voice Overlay System schema migration
-- Date: 2026-05-06
-- Purpose: Foundation for the persona-system redesign (voice doc v2.1)
--   Adds: craft + sub_craft + collaborator_name to users, plus user_lexicon and user_voice_card tables.
--
-- STATUS: NOT YET APPLIED to live Supabase as of 2026-05-06 evening.
-- Apply via: Supabase SQL editor (dashboard → SQL editor → paste → run)
--   OR via supabase CLI if configured: `supabase db execute --file 2026-05-06_voice_overlay_system.sql`
--
-- REVERT INSTRUCTIONS at the bottom of this file.
-- All changes are additive (no DROPs, no ALTERs of existing data) and reversible.

-- ============================================================================
-- 1. Extend users table
-- ============================================================================

-- Craft: which of the 10 V1 crafts this user identifies with.
-- Stored as text (not enum) for flexibility — adding a craft later is a no-op.
-- Default 'screenwriter' for backward compatibility with existing users.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS craft TEXT DEFAULT 'screenwriter';

-- Sub-craft: scaffolding for V2 (e.g., 'editorial' vs 'comics' for illustrators).
-- Hidden in UI at V1; surfaced in onboarding at V2.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS sub_craft TEXT DEFAULT NULL;

-- Collaborator name: optional user-supplied handle ("Sal", "V", "Kai").
-- NULL means use default "Signal" in voice.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS collaborator_name TEXT DEFAULT NULL;

-- Constrain craft to known values (drop & recreate if list changes).
-- This is a soft constraint — invalid values fall back to 'screenwriter' in code.
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_craft_check;

ALTER TABLE users
ADD CONSTRAINT users_craft_check CHECK (
  craft IN (
    'screenwriter',
    'novelist',
    'fashion_designer',
    'architect',
    'interior_designer',
    'chef',
    'illustrator',
    'game_designer',
    'product_designer',
    'founder'
  )
);


-- ============================================================================
-- 2. user_lexicon — distinctive vocabulary, extracted from captures
-- ============================================================================
-- Per voice doc v2.1 §15.1.
-- Populated by extending the existing capture-analysis prompt to also return
-- a `lexicon_extract` JSON. Top 30 ranked terms get injected into system prompt.

CREATE TABLE IF NOT EXISTS user_lexicon (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('proper_noun', 'project_term', 'user_phrasing')),
  frequency INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Composite uniqueness: a term appears once per user, regardless of type.
  UNIQUE (user_id, term)
);

CREATE INDEX IF NOT EXISTS idx_user_lexicon_user_id ON user_lexicon(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lexicon_user_freq ON user_lexicon(user_id, frequency DESC);
CREATE INDEX IF NOT EXISTS idx_user_lexicon_last_seen ON user_lexicon(user_id, last_seen);

-- RLS — users can only read/write their own lexicon entries.
ALTER TABLE user_lexicon ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_lexicon_select_own ON user_lexicon
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_lexicon_insert_own ON user_lexicon
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_lexicon_update_own ON user_lexicon
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_lexicon_delete_own ON user_lexicon
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 3. user_voice_card — peer-readable summary of how the user thinks
-- ============================================================================
-- Per voice doc v2.1 §15.2.
-- Generated via single Sonnet call every 30 captures or 14 days.
-- Sycophancy-guarded by structural prompt design.
-- User-editable, user-deletable. Versioned for rollback.

CREATE TABLE IF NOT EXISTS user_voice_card (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signature TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_user_edited BOOLEAN NOT NULL DEFAULT FALSE,
  -- When the user last edited the card; auto-refresh respects edits for 30 days.
  user_edited_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_voice_card_user_active ON user_voice_card(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_voice_card_user_version ON user_voice_card(user_id, version DESC);

-- Only one active voice card per user at a time (enforced via partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_voice_card_one_active_per_user
  ON user_voice_card(user_id) WHERE is_active = TRUE;

-- RLS
ALTER TABLE user_voice_card ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_voice_card_select_own ON user_voice_card
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_voice_card_insert_own ON user_voice_card
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_voice_card_update_own ON user_voice_card
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY user_voice_card_delete_own ON user_voice_card
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 4. Verification queries (run after applying)
-- ============================================================================

-- Confirm new columns on users:
--   SELECT column_name, data_type, column_default FROM information_schema.columns
--   WHERE table_name = 'users' AND column_name IN ('craft', 'sub_craft', 'collaborator_name');

-- Confirm new tables exist:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('user_lexicon', 'user_voice_card');

-- Confirm RLS enabled:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE tablename IN ('user_lexicon', 'user_voice_card');


-- ============================================================================
-- REVERT — paste these statements into Supabase SQL editor to undo this migration
-- ============================================================================

-- Drop new tables (cascades remove all data and policies):
--   DROP TABLE IF EXISTS user_voice_card;
--   DROP TABLE IF EXISTS user_lexicon;

-- Drop the craft constraint:
--   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_craft_check;

-- Drop new columns from users (data in those columns is permanently lost on drop):
--   ALTER TABLE users DROP COLUMN IF EXISTS craft;
--   ALTER TABLE users DROP COLUMN IF EXISTS sub_craft;
--   ALTER TABLE users DROP COLUMN IF EXISTS collaborator_name;

-- After revert, no schema changes from this migration remain.
