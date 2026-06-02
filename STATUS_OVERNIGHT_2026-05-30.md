# Signal Overnight Status — 2026-05-30

## Closed since last status

- **B10 (connections viz)** — possibly closed. Full stack landed in 24h: 6 backend commits in `signal/` adding and hardening `/api/connections/generate` (endpoint, error handling, JSON extraction fix, maxTokens 1500→4000, upsert constraint on `(idea_id_a, idea_id_b)` to prevent duplicate map taps); iOS commits `3e8d527` (radial SVG mind map), `1ecdffb` (Connections screen live), `a7ac071` (resilient JSON parse), `2fdaacc` (load on mount). Deployed to Vercel production; latest deployment READY as of `be2006d`.

- **Voice card generator backend** — closed before this 24h window (between v15 and now). `api/voicecard/generate.js` exists in `signal/`; CLAUDE.md marks it shipped with daily cron at 10:00 UTC. v15 §11 listed it as pending ~3h; it was completed in a session between v15 (May 15) and today. **Not documented in a handoff — next handoff must capture this.**

## Still open

10 open items from v15 §11 untouched in last 24h:

1. Desktop Insight panel — paste `docs/proposals/desktop-insight-panel.jsx` (~60s DPG action)
2. Anthropic credit top-up + auto-reload
3. Desktop "synced from phone" badge in `signal/src/app.jsx`
4. Hardening: loading skeletons, offline-mode messaging, test suite
5. Wolf-moment samples per craft (DPG decision required before implementation)
6. B7 (pairwise synthesis), B9 (session-aware AI), B11 (feedback loop), B14 (Haiku 4.5), B15 (image capture)
7. Pulse rhythm refactor (~2 hrs)
8. `pulse.js` CRON_SECRET hardening; Vercel ↔ GitHub auto-deploy
9. Password reset UI, Stripe, beta tester recruitment, signal-navy-five + Telegram retirement
10. DPG action items: copy v15 to Mac, delete orphan branches, create two missing memory files (rules 24/27), PR + merge error-boundary commit `451a3241` from `claude/crispr-data-iteration-yMpnD`

Note: v15 listed TestFlight + Apple Dev as open, but CLAUDE.md (updated today) shows TestFlight build 5 live and Apple Dev cleared 2026-05-12. Flagged in Needs DPG Input below.

## New work since handoff

22 commits in 24h not on the v15 punch list — substantial unhandoff'd feature work:

**signal-ios (16 commits):**
- `26bf40f` Bug fixes: 8 silent failures found by QA agents
- `8c184ac` Audit: library cleanup triage tool
- `801a976` Compose: freeform writing surface
- `efacb4d` Add deliverable to existing idea from detail screen
- `fca57fb` Re-analyze: run capture-mode AI on existing idea from detail screen
- `139ee20` / `2bc57ef` / `3e8d527` Canon: archive/restore flow + migration; fix loadCanon dropping archived docs
- `51521ec` Bug fixes: clarification escape, library error state, archived items, rollback on failure
- `5d56d23` Insight: remove 30-idea cap; tap-to-edit idea text; Incoming: fix archive copy
- `1ecdffb` Actions: tap-to-detail modal; Studio button style fix
- `ba70499` CLAUDE.md updated to current shipped state
- `1b9bd4e`, `a12cb9f` Studio/HomeNavRow minor UI polish

**signal/ backend (6 commits):** all `connections/generate` — see §Closed above.

**signal-android, signal-creatives:** no commits.

## Anomalies

- `curl` health checks for `/api/ai` and `/api/activation?dry_run=1` blocked by sandbox (HTTP 403 "Host not in allowlist") — this is a sandbox network restriction, NOT a backend failure. Vercel MCP confirms production deployment READY. Health check via direct curl is not possible from this environment; future runs should use `mcp__Vercel__web_fetch_vercel_url` instead.
- v15 handoff is stale: voice card backend, canon archive, compose, re-analyze, audit tool, and add-deliverable are all shipped but v15 doesn't reflect them. Next handoff needs a full reconciliation pass.

## Needs DPG input

- **Apple Dev / TestFlight status conflict:** v15 §11 says "Apple Developer enrollment overdue since 5/7"; CLAUDE.md (updated today) says Apple Dev cleared 2026-05-12 and TestFlight build 5 is live. Which is canonical? If cleared, close this item in the next handoff.
- **`expo_push_token` still NULL:** expected — Expo Go does not support remote push tokens (v15 §11 closing note). Wait on TestFlight / dev-client build. No action needed until Apple Dev path confirmed.
- **Session A commits `3fae0e1`, `3ae0aea`, `d390178`, `80e188f`:** still unlocated (v15 §11).
- **Wolf-moment samples** (v15 §11): safe form is a craft-keyed data file, no onboarding UI. UI wiring awaits DPG decision.
- **Handoff is overdue for v16:** 15 days since v15, substantial undocumented work. Next session should open with a handoff update before coding.
