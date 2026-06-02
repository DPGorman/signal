# Signal Overnight Status — 2026-05-18

## Closed since last status (past 24 hours)

No commits in the past 24 hours across any monitored repo (signal, signal-ios, signal-creatives, signal-android). Nothing newly closed overnight.

**However: 35+ commits on 2026-05-15–17 postdate v15 but are undocumented. See "New work since handoff" below. A v16 handoff is overdue.**

## Still open

Carried from v15 §11 — items not clearly closed by May 15–17 commits:

- Desktop Insight panel from `docs/proposals/desktop-insight-panel.jsx` (~60 sec DPG action)
- Apple Developer enrollment (overdue since 5/7)
- Anthropic credit top-up + auto-reload (mitigated: reverted to Sonnet 4.6 on `a9c6fce`)
- TestFlight build + native auth (gated on Apple Dev)
- Desktop "synced from phone" badge in `signal/src/app.jsx` (note: app.jsx now componentized — target file may have moved)
- Hardening pass: ErrorBoundary extension, loading skeletons, offline messaging, test suite
- Wolf-moment samples per craft (needs DPG decision before any UI wiring)
- Backlogs B7/B9/B10/B11/B15
- Pulse rhythm refactor (~2 hrs)
- Password reset UI, Stripe, beta tester recruitment, signal-navy-five + Telegram/WhatsApp retirement
- DPG: error-boundary commit `451a3241` on `claude/crispr-data-iteration-yMpnD` (PR + merge + branch delete)
- DPG: orphan branch cleanup (v15 §11)

## New work since handoff (v15, 2026-05-15) — **needs v16 handoff to document**

**signal repo (26 commits, May 15–17):**
- `b794c5a`+`6dd29f8`+`bdeb123` — voice card backend added + v2 generator (possibly closes v15 §11 voice card punch item)
- `e0abe82` — voice-card auto-refresh cron
- `7601c59` — endpoint auth hardening (CRON_SECRET on `/api/activation`, `/api/recrawl`; mixed-auth on `/api/pulse`) — possibly closes v15 §11 CRON_SECRET punch item
- `305b933`+`bf07274` — voice classify mode + 10-craft overlay refresh
- `e6aa2e8`+`119edc7` — new `ai_observations` table + writer (not in v15 at all)
- `4fa5d6d`→`bac75a3` — app.jsx split waves 1–5, COMPLETE (major refactor, not in v15)
- `bf81d34`+`1011679` — classifier integration + desktop multi-round clarifying-question UI (voice doc v2.3)
- `3b90dd0` — weekly augment-observations cron
- `3e8d7f7`+`a0ffd2a` — Incoming tab (non-creative triage) + admin endpoint consolidation
- `df1a99f` — capture-mode prompt rewired per AI Behavior Spec v1
- `a9c6fce` — reverted all callers to Sonnet 4.6 (cost reduction)

**signal-ios repo (15 commits, May 16–17):**
- Multi-round clarifying-question flow (`39417ddc`)
- Voice-overlay migration for capture + Insight (`c474ead4`, `5b1ce19c`)
- Classifier gate in captureIdea (`1f275794`)
- Incoming screen for non-creative triage (`e7c12f20`)
- creativeIdeas count scoping (4 fix commits, May 17)
- Auth parity for parse-file + pulse P0 fix (`fee45dd9`)

## Anomalies

1. **`/api/activation?dry_run=1` returned HTTP 401** — this is **expected, not a bug**. `7601c59` (May 16) added CRON_SECRET auth to all cron endpoints. The unauthenticated health probe now correctly 401s. Vercel's cron runner auto-includes the CRON_SECRET header, so actual cron fires should be unaffected.

2. **`/api/ai` POST health check skipped.** Sandbox network policy blocks shell `curl`; Vercel MCP tool is GET-only. Recommend manual verification: `curl -s -X POST https://signal-multi.vercel.app/api/ai -H "Content-Type: application/json" -d '{"system":"Reply ping","message":"ping","maxTokens":10}'` — expect `{"raw":"ping"}` HTTP 200.

3. **No handoff written for 35+ commits since v15.** The next session will load v15 and be unaware of the ai_observations table, app.jsx componentization, voice classify mode, Incoming tab, and endpoint auth changes. **Write v16 before starting the next feature session.**

## Needs DPG input

- **Write v16 handoff** — substantial undocumented state since v15.
- **Voice card backend**: confirm `b794c5a`+`6dd29f8` is the iOS UI's write target and that the endpoint is wired end-to-end.
- **Wolf-moment samples per craft** — safe form is craft-keyed data file, no onboarding surface; confirm before next session picks it up.
- **Apple Developer enrollment** — TestFlight, native auth, push pipeline all gated.
- **Anthropic billing state** — unknown per v15 §14; top up before V1 demo cohort.
