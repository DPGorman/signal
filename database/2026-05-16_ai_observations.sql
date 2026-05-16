-- Signal — AI observations (private AI knowledge layer)
-- Date: 2026-05-16
-- Purpose: Append-only AI-private memory. The AI writes observations about a user
--   (failures it learned from, patterns it noticed, user-provided facts, canon
--   divergences). User does NOT see this table. Voice card refresh reads from it
--   to synthesize the user-facing signature. Other AI calls may read from it for
--   per-user context.
--
-- Design notes:
-- - Soft enum on `type` (TEXT, not CHECK constraint). Forward-compatible: the AI
--   can invent new observation types without DB migrations. The prompt restricts
--   valid types; the DB doesn't.
-- - `context` JSONB carries type-specific payload (e.g., {ai_wrong_move,
--   correct_move} for failure rows; {evidence_capture_ids} for pattern rows).
--   Avoids proliferation of nullable columns.
-- - `user_verbatim` is the gold field for failure-type rows — the user's exact
--   pushback language, captured so future AI calls can read what the user
--   actually said, not the AI's paraphrase.
-- - Privacy: RLS enabled with NO policies granting user access. Service key only.
--   Anon-key queries return empty / fail.
--
-- Apply via: Supabase Management API / MCP / SQL editor.

-- ============================================================================
-- 1. Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_observations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Soft-enum text. Suggested values (AI prompt enforces):
  --   Failure types:    'fabrication' | 'force_fit_category' | 'ignored_canon'
  --                     | 'wrong_register' | 'missed_pushback_signal'
  --   Pattern types:    'pattern_noticed' | 'recurring_concern' | 'tonal_drift'
  --   Divergence types: 'canon_divergence' | 'capture_canon_mismatch'
  --   User-provided:    'user_fact' | 'preference_stated' | 'context_provided'
  --   Emergent dim:     'emergent_dimension' | 'craft_signal'
  type TEXT NOT NULL,

  -- Optional pointer to the capture / reply / canon doc that triggered this
  -- observation. Don't store the source content here — that's in its own table.
  source_id UUID,
  source_type TEXT, -- 'idea' | 'reply' | 'canon' | null

  -- The AI's observation text. Always present. For failures, this is the AI's
  -- description of what it learned. For patterns, this is what was noticed.
  text TEXT NOT NULL,

  -- The user's exact pushback / correction / provided-fact phrasing.
  -- Verbatim, not paraphrased. The gold field for failure rows: future AI calls
  -- read this to learn from the user's actual language.
  user_verbatim TEXT,

  -- Type-specific structured payload. Examples:
  --   For failure rows: {"ai_wrong_move": "...", "correct_move": "..."}
  --   For pattern rows: {"evidence_capture_ids": ["uuid", ...], "first_seen": "..."}
  --   For divergence rows: {"canon_claim": "...", "capture_claim": "..."}
  --   For user-fact rows: {"fact_category": "schedule" | "preference" | ...}
  context JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. Indexes
-- ============================================================================

-- Most recent observations for a user (voice card refresh, recent-context reads)
CREATE INDEX IF NOT EXISTS idx_ai_observations_user_created
  ON ai_observations(user_id, created_at DESC);

-- Most recent observations of a given type for a user
-- (e.g., "show me all failures from the past 30 days")
CREATE INDEX IF NOT EXISTS idx_ai_observations_user_type_created
  ON ai_observations(user_id, type, created_at DESC);

-- All observations triggered by a specific capture/reply/canon doc
CREATE INDEX IF NOT EXISTS idx_ai_observations_source
  ON ai_observations(source_id) WHERE source_id IS NOT NULL;

-- ============================================================================
-- 3. RLS — service-key only
-- ============================================================================
-- This table is the AI's private memory. Users must NEVER read or write it
-- through client-side Supabase queries. RLS is enabled with NO policies; the
-- only path is the server-side service key (which bypasses RLS by design).

ALTER TABLE ai_observations ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies. Any anon-key or auth.uid()-based SELECT / INSERT /
-- UPDATE / DELETE will fail / return empty.

-- ============================================================================
-- 4. Verification queries
-- ============================================================================

-- Confirm the table exists:
--   SELECT table_name FROM information_schema.tables WHERE table_name = 'ai_observations';

-- Confirm RLS is enabled and policy count is 0 (privacy lock-in):
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'ai_observations';
--   SELECT count(*) FROM pg_policies WHERE tablename = 'ai_observations';

-- Test that anon-key reads return empty (run from a client, not the SQL editor):
--   The Supabase JS client should return [] for SELECT * FROM ai_observations.

-- ============================================================================
-- REVERT
-- ============================================================================

-- DROP TABLE IF EXISTS ai_observations;
-- (Cascades remove all data, indexes, and the RLS state.)
