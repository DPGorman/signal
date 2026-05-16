-- Classifier integration (voice doc v2.3 §2.5, §2.6)
-- Adds kind (project_material | task | personal_note | unclear) + auto_tag to ideas.
-- Default kind=project_material so existing rows are unchanged.
-- Applied via Supabase MCP 2026-05-16; this file is the canonical record.

ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'project_material',
  ADD COLUMN IF NOT EXISTS auto_tag TEXT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ideas_kind_check'
  ) THEN
    ALTER TABLE public.ideas
      ADD CONSTRAINT ideas_kind_check
      CHECK (kind IN ('project_material', 'task', 'personal_note', 'unclear'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ideas_user_kind_created_idx
  ON public.ideas (user_id, kind, created_at DESC);

COMMENT ON COLUMN public.ideas.kind IS
  'Classifier output. project_material runs craft analysis; task/personal_note/unclear do not.';
COMMENT ON COLUMN public.ideas.auto_tag IS
  'Classifier-suggested tag (e.g. to-do, scene-note). User-editable.';
