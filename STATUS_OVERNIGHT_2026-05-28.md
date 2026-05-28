# Signal Overnight Status — 2026-05-28

## Closed since last status

No open punch-list items from v15 §11 appear to be closed by today's commit. The commit touches `incoming.tsx`, `index.tsx`, and `stores/useIdeas.ts` — none of these map to any explicitly named open item.

## Still open

**11 open items** from v15 §11 (all carried forward unchanged):

1. Voice card generator backend `/api/voicecard/generate` in `signal/` (~3 hrs) — §13 step 4
2. Desktop Insight panel paste-in from `docs/proposals/desktop-insight-panel.jsx` — §13 step 5
3. Apple Developer enrollment — overdue since 5/7
4. Anthropic credit top-up + auto-reload
5. TestFlight build + native auth providers (gated on Apple Dev)
6. Desktop "synced from phone · HH:MMam" badge in `signal/src/app.jsx`
7. Hardening pass (ErrorBoundary extension, loading skeletons, offline messaging, test suite) — §13 step 6
8. Wolf-moment samples per craft (safe form: craft-keyed data file, no onboarding UI)
9. B7/B9/B10/B11/B14/B15 feature backlog
10. Pulse rhythm refactor (~2 hrs); `pulse.js` CRON_SECRET hardening
11. Password reset UI, Stripe, beta tester recruitment, legacy repo retirement

**DPG-action items still pending (v15 §11):**

- Locate/clarify orphan commits `3fae0e1`, `3ae0aea`, `d390178`, `80e188f`
- Copy v15 to canonical Mac path
- Delete orphan branches (see v15 §11 for full list)
- Create two missing memory files for rules 24 and 27
- PR + merge error-boundary commit `451a3241` from `claude/crispr-data-iteration-yMpnD` — §13 step 2

## New work since handoff

**signal-ios — 1 commit (2026-05-28 13:41 +0700):**

```
43d65e9  fix(ios): incoming triage fixes — preserve user tags, Move-anyway override, clearer copy (#18)
```

Files: `app/(tabs)/incoming.tsx`, `app/(tabs)/index.tsx`, `stores/useIdeas.ts`

Five fixes to the Incoming/triage screen from a 2026-05-28 audit (`docs/SIGNAL_IOS_AUDIT_2026-05-28_v1.md`):
1. Preserve user-set `auto_tag` on re-classify (was silently blanked by empty-string classifier return)
2. "Move anyway" manual override for project moves when classifier disagrees (new `force` intent)
3. Honest archive-dialog copy — drops unsupported "restore via database" claim
4. Tag chip empty state reads "+ add tag" (was "+ tag")
5. Per-card `isBusy` disable (was greying all cards on any single card's action)

Also: Home screen logo+nav cluster floated to upper-middle (16% from top) when screen is sparse.

This is undocumented work not referenced in v15 §11. **The v16 handoff must capture it.** An audit file was also created (`docs/SIGNAL_IOS_AUDIT_2026-05-28_v1.md`) — worth noting in v16 for context.

**signal, signal-creatives, signal-android — no commits in past 24 hours.**

## Anomalies

- **Backend health — shell curl blocked.** Sandbox network policy blocks outbound `curl` to `signal-multi.vercel.app`. Used Vercel MCP instead.
- **`/api/ai` (POST):** Vercel MCP can only issue GET; received HTTP 405 (Method Not Allowed). This confirms the endpoint is alive and reachable — 405 is the correct rejection for a GET on a POST-only route. Not a real failure.
- **`/api/activation?dry_run=1`:** HTTP 401 Unauthorized. The endpoint requires `CRON_SECRET` authorization header which is not available in this environment. Endpoint is reachable; CRON_SECRET auth is blocking the dry-run check. To verify cron health: check Vercel runtime logs or query `users.day3_pulse_sent_at` / `day7_studio_sent_at` via Supabase MCP for fresh timestamps.
- **Push registration still NULL.** Per v15 §11 closing note: `expo_push_token` will remain NULL in Expo Go regardless of migration. Not a new anomaly — gated on Apple Dev / dev-client build.

## Needs DPG input

From v15 §11 (still pending):

- **Apple Developer enrollment** — all native-build paths (TestFlight, push notifications, native auth) are blocked on this. Overdue since 5/7.
- **Wolf-moment samples per craft** — safe implementation form identified (craft-keyed data file), but UI wiring requires explicit DPG decision before proceeding.
- **Anthropic credit top-up** — Opus 4.6 running in prod; state unknown. Required before V1 demo cohort.
- **Error-boundary commit `451a3241`** on `claude/crispr-data-iteration-yMpnD` — single-commit PR is the next action (§13 step 2); no code decision needed, just a merge approval.
- **`/api/activation` dry-run unverifiable from agent environment** — DPG or next session should confirm cron fired at 14:00 UTC today by querying Supabase for latest `day3_pulse_sent_at` / `day7_studio_sent_at` timestamps.
