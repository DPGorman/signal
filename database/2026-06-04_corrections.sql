-- Signal — Corrections ("What I've taught Signal")
-- Date: 2026-06-04
-- Purpose: A correction is the user's authored truth filed against a specific
--   AI analysis line. The AI's original words are preserved verbatim (immutable
--   provenance); the user's correction becomes project canon and conditions ALL
--   future analysis. Unlike `ai_observations` (AI-private), corrections are
--   user-owned and user-visible — they drive the "What I've taught Signal"
--   review/undo surface.
--
-- Design notes:
-- - Distinct from `replies`: a reply is a freeform note the AI never reads back.
--   A correction is binding context — it enters every analysis prompt as
--   established truth (see api/_voice/assemble.js). Conflating them would either
--   silently feed old notes into the model or weaken corrections; kept separate.
-- - `ai_original` is the verbatim AI text at correction time. Immutable. This is
--   the provenance line the UI keeps visible ("corrected by you") so the AI's
--   words are never erased, only marked.
-- - `target_section` mirrors `replies.target_section`:
--   'ai_note' | 'canon_resonance' | 'canon_tension'.
-- - Per-project, like canon. `project_id` nullable (matches canon_documents);
--   a null-project correction conditions all of the user's analysis.
-- - Undo = set is_active=false (soft). Keeps the teaching history; stops it
--   conditioning future analysis. Hard delete also allowed (RLS DELETE policy).
-- - BINDING (locked with Daniel 2026-06-04): "fact accepted, challenge
--   preserved." A correction is treated as settled truth the model won't
--   re-litigate, but it NEVER softens a challenge — the model must keep
--   surfacing real contradictions, including any new tension the correction
--   itself creates. That contract lives in the prompt, not the schema.
--
-- Apply via: Supabase Management API / MCP / SQL editor.

-- ============================================================================
-- 1. Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS corrections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- The idea whose analysis line was corrected. Cascade so deleting an idea
  -- removes its corrections.
  idea_id UUID REFERENCES ideas(id) ON DELETE CASCADE,

  -- Project scope (canon is per-project). Nullable: a null-project correction
  -- conditions all of the user's analysis.
  project_id UUID,

  -- Which analysis line was corrected.
  --   'ai_note' | 'canon_resonance' | 'canon_tension'
  target_section TEXT NOT NULL,

  -- The AI's exact words at the moment of correction. Immutable provenance.
  ai_original TEXT NOT NULL,

  -- What the user says is true. This is what conditions future analysis.
  correction_text TEXT NOT NULL,

  -- Undo = set false (soft). Active corrections condition analysis + show on
  -- the "What I've taught Signal" surface as in-force.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. Indexes
-- ============================================================================

-- Conditioning fetch + review screen: active corrections for a user, newest first.
CREATE INDEX IF NOT EXISTS idx_corrections_user_active
  ON corrections(user_id, is_active, created_at DESC);

-- Project-scoped conditioning fetch.
CREATE INDEX IF NOT EXISTS idx_corrections_user_project_active
  ON corrections(user_id, project_id, is_active);

-- Mark corrected lines on a specific idea.
CREATE INDEX IF NOT EXISTS idx_corrections_idea
  ON corrections(idea_id) WHERE idea_id IS NOT NULL;

-- ============================================================================
-- 3. RLS — user-owned (mirrors replies)
-- ============================================================================
-- Users read/write their own corrections via the client (review + undo).
-- The server service key bypasses RLS to read active corrections when
-- assembling analysis prompts.

ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "corrections_select_own" ON corrections FOR SELECT
    USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "corrections_insert_own" ON corrections FOR INSERT
    WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "corrections_update_own" ON corrections FOR UPDATE
    USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "corrections_delete_own" ON corrections FOR DELETE
    USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()::text));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. Verification queries
-- ============================================================================

-- SELECT table_name FROM information_schema.tables WHERE table_name = 'corrections';
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'corrections';
-- SELECT count(*) FROM pg_policies WHERE tablename = 'corrections';  -- expect 4

-- ============================================================================
-- REVERT
-- ============================================================================

-- DROP TABLE IF EXISTS corrections;
