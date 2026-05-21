# Signal Overnight Status — 2026-05-21

_Handoff reference: v15 (2026-05-15) at `signal-ios/docs/handoffs/SIGNAL_HANDOFF_2026-05-15_v15.md`_

---

## Closed since last status

None. No commits were found in any repo in the past 24 hours.

---

## Still open

**13 open items** from v15 §11 (unchanged — no activity since handoff):

1. Voice card generator backend `/api/voicecard/generate` in `signal/` (~3 hrs)
2. Apply desktop Insight panel from `docs/proposals/desktop-insight-panel.jsx` (~60 sec DPG action)
3. Apple Developer enrollment — overdue since 5/7
4. Anthropic credit top-up + auto-reload
5. TestFlight build + native auth providers (gated on item 3)
6. Desktop "synced from phone · HH:MMam" badge in `signal/src/app.jsx`
7. Remaining hardening: ErrorBoundary extension, loading skeletons, offline messaging, test suite
8. Wolf-moment samples per craft — safe form is craft-keyed data file (awaits fresh DPG decision on UI wiring)
9. B7 (pairwise synthesis), B9 (session-aware AI), B10 (connections viz), B11 (feedback loop), B14 (Haiku 4.5), B15 (image capture)
10. Pulse rhythm refactor (~2 hrs)
11. `pulse.js` CRON_SECRET hardening; signal-multi Vercel ↔ GitHub auto-deploy
12. Password reset UI, Stripe, beta tester recruitment, signal-navy-five / Telegram / WhatsApp retirement
13. Error-boundary commit `451a3241` on `claude/crispr-data-iteration-yMpnD` — single-commit PR still pending

---

## New work since handoff

None. Zero commits in past 24 hours across all four repos (signal, signal-ios, signal-creatives, signal-android).

---

## Anomalies

- **Backend health checks inconclusive.** Both `/api/ai` (POST ping) and `/api/activation?dry_run=1` were unreachable from this environment. Direct `curl` returned HTTP 403 "Host not in allowlist" (sandbox network restriction). Vercel MCP fallback returned "MCP tool call requires approval" (tool not pre-authorized for this session). Status unknown — not a confirmed outage, but cannot verify green. Recommend DPG manually verify or re-run health checks from Mac.
- **`expo_push_token` still NULL expected.** Per v15 §11 note, push registration is dormant in Expo Go and will remain NULL until a dev-client or TestFlight build is in place. Not a regression — expected state until Apple Dev clears.
- **Repo HEAD state.** `signal` repo was in detached-HEAD state at session start; created `signal-health-log` branch from that point. No changes to main.

---

## Needs DPG input

From v15 §11 "pending DPG attention":

- **Locate or clarify Session A commits** `3fae0e1`, `3ae0aea`, `d390178`, `80e188f` — origin and disposition unknown.
- **Copy v15 handoff** to `/Users/dpg/THE MOTHERSHIP/SIGNAL-APP/SIGNAL_HANDOFF_2026-05-15_v15.md` once v15 PR merges.
- **Delete orphan branches**: `claude/review-signal-handoff-8p62X`, `claude/crispr-data-iteration-yMpnD`, `claude/fix-todo-overlap-I2tBT`, `claude/create-handoff-todos-G067Y` (last two already merged per v14).
- **Create two missing memory files** for rules 24 and 27 (v14 §17.C).
- **Wolf-moment UI wiring decision** — safe data-file form is ready to build once DPG confirms the surface.
- **Backend health verification** — confirm `/api/ai` and `/api/activation` are green (could not verify from this session's sandbox).
