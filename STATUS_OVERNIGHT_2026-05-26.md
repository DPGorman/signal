# Signal Overnight Status — 2026-05-26

> Reference handoff: `signal-ios/docs/handoffs/SIGNAL_HANDOFF_2026-05-15_v15.md`

---

## Closed since last status

None of the v15 §11 open items are definitively closed by recent commits. See "New work" below for the connections scoping fix which is related to — but does not close — the B10 connections-viz backlog item.

---

## Still open

**14 open punch items** carried from v15 §11 (summary by cluster):

- **Voice card generator** — `/api/voicecard/generate` in `signal/` (~3 hrs). iOS UI ready; backend not started.
- **Desktop Insight panel** — paste-in from `docs/proposals/desktop-insight-panel.jsx`. ~60 sec DPG action.
- **Apple Developer enrollment** — overdue since 2026-05-07; gates TestFlight, native auth, and push tokens.
- **Anthropic credit top-up + auto-reload** — state unknown; risks Opus 4.6 calls going dark before V1 demo.
- **Desktop "synced from phone" badge** — `signal/src/app.jsx` library view, reads `ideas.source = "phone"`.
- **Hardening pass** — ErrorBoundary extension, loading skeletons, offline messaging, test suite.
- **Wolf-moment samples per craft** (B2/D2) — safe form: craft-keyed data file only. UI wiring needs DPG decision.
- **Backlog** — B7 (pairwise synthesis), B9 (session-aware AI), B10 (connections viz), B11 (feedback loop), B14 (Haiku 4.5), B15 (image capture).
- **Pulse rhythm refactor** (~2 hrs); `pulse.js` CRON_SECRET hardening; signal-multi Vercel ↔ GitHub auto-deploy.
- **Error-boundary commit `451a3241`** on `claude/crispr-data-iteration-yMpnD` — single-commit PR still pending (v15 §11).
- **Password reset UI, Stripe, beta recruitment, navy-five + Telegram/WhatsApp retirement.**

---

## New work since handoff

Two PRs landed **after v15** that are not on the punch list — undocumented work the next handoff must capture:

| Repo | PR | Commit | Summary | Files touched |
|---|---|---|---|---|
| `signal` | PR #2 | `026f820` | Fix: scope connections load to active project | `src/app.jsx`, `src/engine/actions.js`, `.gitignore`, `CLAUDE.md` |
| `signal-ios` | PR #17 | `af0b155` | Fix: scope connections load to active project | `stores/useConnections.ts`, `app/_layout.tsx`, `app/(tabs)/index.tsx` |

**Assessment:** Correctness bug — `connections` store/loader was running a bare `select("*")` with no project_id filter, so connections from all projects bled into the active project's view. Fix adds `(userId, projectId)` params matching the pattern used by ideas/deliverables/canon stores. Landed in both desktop and iOS simultaneously (~20:28 UTC on 2026-05-25). Possibly closes the data-scoping aspect of B10 (connections), but the mind-map *visualization* is still unbuilt.

`signal-creatives` and `signal-android`: no activity in the past 24 hours.

---

## Anomalies

**1. `/api/activation` returning 401 — cron health unclear.**
Vercel MCP `web_fetch_vercel_url` for `?dry_run=1` returned a Cloudflare 502. Runtime logs confirm the endpoint returned **401** on all 5 attempts (including this agent's health check). The cron fires at 14:00 UTC daily; no successful activation call appears in the 24-hour Vercel log window (2026-05-25 12:14 → 2026-05-26 12:14), which *should* cover yesterday's 14:00 UTC fire. Either: (a) `?dry_run=1` is not a bypass — the endpoint always requires `CRON_SECRET` in the `Authorization` header; or (b) the cron itself didn't fire yesterday. The pulse-sent timestamps for DPG's account are already populated through day7; a missed cron fire today would only affect new users. Recommend DPG verify via Supabase: `SELECT day3_pulse_sent_at, day7_studio_sent_at FROM users ORDER BY created_at DESC LIMIT 5`.

**2. `/api/ai` — POST endpoint reachable, GET correctly returns 405.** Server is up.

**3. Sandbox curl blocked.** Direct `curl` to `signal-multi.vercel.app` returns "Host not in allowlist" (403). Backend checks performed via Vercel MCP instead — per CLAUDE.md guidance.

**4. `signal` repo HEAD detached on checkout.** Three commits (`f17aa9a`, `026f820`, `13c2017`) were present on the detached HEAD and not connected to any named branch. Moved to `main` cleanly; those commits appear to be the merged PR #2 content already on `origin/main`.

---

## Needs DPG input

From v15 §11 "pending DPG attention" + new items:

- **Activation cron health** — confirm yesterday's 14:00 UTC cron fired (see Anomaly #1 above). Check `pulse_sent_at` for recently created test users.
- **`expo_push_token` still NULL** — gated on Apple Dev clearance + dev/TestFlight build. No action until Apple Dev resolves.
- **Apple Developer enrollment** — most urgent gate; blocks TestFlight, push, native auth.
- **Wolf-moment samples UI wiring** — needs fresh decision (v15 §11 note: safe form is data-file only; UI surface requires DPG go/no-go).
- **Orphan branches cleanup** (v15 §11): `claude/review-signal-handoff-8p62X`, `claude/crispr-data-iteration-yMpnD` (has unmerged commit `451a3241`), `claude/fix-todo-overlap-I2tBT`, `claude/create-handoff-todos-G067Y`. Verify `claude/harden-eas-workflow` was auto-deleted post-PR-#8 merge.
- **Locate orphan commits** `3fae0e1`, `3ae0aea`, `d390178`, `80e188f` (v14/v15 §11, still unresolved).
- **Next handoff must document** the connections-scoping PR (#2 signal, #17 signal-ios) — not captured in v15.
