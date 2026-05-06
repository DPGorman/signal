-- user_integrations — OAuth token storage for signal-multi
-- Applied to signal-multi (czgjbblkoyyojnaziyuy) on 2026-05-07.
--
-- Replaces the older draft database/user_integrations_table.sql which had
-- user_id INTEGER (incompatible with signal's UUID users.id) and was never
-- actually applied. This is the corrected version.
--
-- Stores OAuth refresh tokens server-side so the AI proxy can read calendar
-- events when assembling runtime context. Client never sees these tokens
-- (previously they were stored in localStorage via URL fragment — fixed).

CREATE TABLE IF NOT EXISTS user_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,           -- 'google_calendar', future: 'apple_calendar', 'microsoft_calendar'
  refresh_token TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
-- No policies — service role bypasses RLS, clients are denied by default.
-- Tokens are read/written exclusively via the API proxy using the service key.

CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON user_integrations(provider);

-- Revert: DROP TABLE IF EXISTS user_integrations;
