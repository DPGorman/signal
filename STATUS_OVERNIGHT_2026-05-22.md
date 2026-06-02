# Signal Overnight Status — 2026-05-22

**Handoff read:** v15 (2026-05-15) — `signal-ios/docs/handoffs/SIGNAL_HANDOFF_2026-05-15_v15.md`
**Repos checked:** signal, signal-ios, signal-creatives, signal-android

---

## Closed since last status

No commits found in any repo in the past 24 hours. Nothing to mark as newly closed.

Items previously closed at v15 (recorded for continuity):
- PR #8 merged — OTA workflow hardening (`eas-cli@^18` pin + `eas whoami` verify)
- `users.expo_push_token` migration applied to signal-multi (unblocked push registration write path)
- Library `<FlatList>` virtualization shipped
- `day7_studio_sent_at` confirmed populated by cron

---

## Still open

**14 open items** from v15 §11 — highest-priority cluster:

1. **Error-boundary commit `451a3241`** on `claude/crispr-data-iteration-yMpnD` — pending PR + merge + branch delete. (v15 §11 "Newly opened")
2. **Voice card generator backend** `/api/voicecard/generate` in `signal/` — iOS UI waiting. ~3 hrs.
3. **Apply desktop Insight panel** from `docs/proposals/desktop-insight-panel.jsx` — ~60 sec DPG action.
4. **Apple Developer enrollment** — overdue since 5/7; gates TestFlight + native auth + push pipeline.
5. **Anthropic credit top-up + auto-reload** — billing state unknown; Opus 4.6 costs ~1.67× Sonnet.
6. **Hardening pass** — ErrorBoundary extension, loading skeletons, offline messaging, test suite.
7. **Desktop "synced from phone" badge** in `signal/src/app.jsx` (reads `ideas.source = "phone"`).
8. **Wolf-moment samples per craft** — safe form is a craft-keyed data file; UI wiring needs fresh DPG decision (v15 §11).
9. **`pulse.js` CRON_SECRET hardening** + signal-multi Vercel ↔ GitHub auto-deploy.
10. Backlog features: B7 (pairwise synthesis), B9 (session-aware AI), B10 (connections viz), B11 (feedback loop), B14 (Haiku 4.5), B15 (image capture), pulse rhythm refactor, password reset UI, Stripe, beta recruitment.

**DPG-attention items** (v15 §11):
- Locate/clarify Session A commits `3fae0e1`, `3ae0aea`, `d390178`, `80e188f`
- Copy v15 to `/Users/dpg/THE MOTHERSHIP/SIGNAL-APP/SIGNAL_HANDOFF_2026-05-15_v15.md`
- Delete 3 orphan branches: `claude/review-signal-handoff-8p62X`, `claude/crispr-data-iteration-yMpnD`, `claude/fix-todo-occur-I2tBT`
- Create two missing memory files for rules 24 and 27 (v14 §17.C)

---

## New work since handoff

**None.** Zero commits across all four repos in the past 24 hours. This is an idle period — next session picks up from v15 §13 sequencing.

---

## Anomalies

- **Backend health — partial check only.** Sandbox network policy blocks outbound `curl`; used Vercel MCP (`web_fetch_vercel_url`) as fallback (per CLAUDE.md guidance).
  - `/api/ai` (GET) → **405 Method Not Allowed** — correct; endpoint is POST-only. Server is up.
  - `/api/activation?dry_run=1` (GET) → **401 Unauthorized** — expected; requires `CRON_SECRET`. Server is up.
  - Full POST health check `{"raw":"ping"}` could not be executed: Vercel MCP tool only supports GET. Recommend wiring a GET `/api/health` ping endpoint for future overnight checks.
- **No commits in any repo in 24h** — not an error, but flagging as unusual. Confirms no undocumented parallel-session drift since v15.
- **Push registration still dormant** — `expo_push_token` remains NULL until Apple Dev clears and DPG opens a dev-client or TestFlight build (v15 §11 finding).
- **`git push` blocked (403)** in this sandbox environment — file delivered via GitHub MCP `create_or_update_file` instead.

---

## Needs DPG input

From v15 §11 and §13:

1. **Apple Developer enrollment** — everything downstream is gated here (TestFlight, push pipeline, native auth). Overdue since 5/7.
2. **Wolf-moment UI wiring** — v15 §11 flags this needs a fresh decision before any UI surface is added.
3. **Orphan branch cleanup** — three branches can be deleted once DPG confirms `451a3241` (error-boundary commit on `claude/crispr-data-iteration-yMpnD`) is handled.
4. **Session A commits** `3fae0e1`, `3ae0aea`, `d390178`, `80e188f` — locate or close the open question.
5. **Anthropic billing** — verify credit balance before V1 demo cohort.
