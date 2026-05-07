-- Signal — Activation tracking columns on users
-- Date: 2026-05-07
-- Branch: activation-pattern-2026-05-07
-- Purpose: Track whether the day-3 first-Pulse and day-7 first-Studio
--   activation events have fired for each user, so the daily cron doesn't
--   double-fire if it runs more than once on the qualifying day.
--
-- Locked in SIGNAL-OPS · 5/7 · activation pattern lock:
--   Day 3: real Pulse if captures ≥ 3, else silent-presence one-liner.
--   Day 7: first Studio re-read, fired regardless of capture count.
--
-- Idempotent. Safe to re-run.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS day3_pulse_sent_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS day7_studio_sent_at TIMESTAMPTZ DEFAULT NULL;

-- Index for the cron's "find users due for activation" lookup.
CREATE INDEX IF NOT EXISTS idx_users_activation_pending
ON users (created_at)
WHERE day3_pulse_sent_at IS NULL OR day7_studio_sent_at IS NULL;

-- Revert (manual):
--   ALTER TABLE users DROP COLUMN day3_pulse_sent_at;
--   ALTER TABLE users DROP COLUMN day7_studio_sent_at;
--   DROP INDEX IF EXISTS idx_users_activation_pending;
