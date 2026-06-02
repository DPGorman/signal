# Signal Overnight Status — 2026-05-23

*Generated from v15 handoff (2026-05-15). Next session should still read v15 first.*

---

## Closed since last status

**Possibly closed — needs confirmation:**

- **TestFlight build pipeline** (`signal-ios` commit `11d15b44`, merged ~14:16 UTC today): Adds `.github/workflows/eas-testflight.yml` — manual-dispatch workflow that builds the production iOS profile and auto-submits to TestFlight. Also sets `ITSAppUsesNonExemptEncryption=false` in `app.json`. Workflow is **dormant** until three App Store Connect API key secrets are added (`ASC_API_KEY_BASE64`, `ASC_KEY_ID`, `ASC_ISSUER_ID`). This partially advances the "TestFlight build + native auth providers" punch item (§11), but does not close it — still gated on Apple Dev enrollment and the ASC secrets.

---

## Still open

**16 items open** (unchanged from v15 §11). High-priority summary:

- **Voice card generator backend** `/api/voicecard/generate` in `signal/` — iOS UI ready, ~3 hrs (§11)
- **Error-boundary commit `451a3241`** on `claude/crispr-data-iteration-yMpnD` — single-commit PR still not opened (§11 newly opened in v15)
- **Apple Developer enrollment** — overdue since 5/7; gates TestFlight, native auth, and push registration (§11)
- **Desktop Insight panel** — `docs/proposals/desktop-insight-panel.jsx` paste-in, ~60 sec DPG action (§11)
- **Hardening pass** — ErrorBoundary extension, loading skeletons, offline messaging, test suite (§11)
- **`pulse.js` CRON_SECRET hardening**; signal-multi Vercel ↔ GitHub auto-deploy (§11)
- **DPG cleanup**: copy v15 to Mac canonical path, delete orphan branches, create two missing memory files for rules 24 & 27 (§11)
- Remaining: B7/B9/B10/B11/B14/B15 backlog, pulse rhythm refactor, password reset UI, Stripe, beta tester recruitment, signal-navy-five + Telegram/WhatsApp retirement (§11)

---

## New work since handoff

| Commit | Repo | Summary | Maps to punch list? |
|--------|------|---------|---------------------|
| `11d15b44` | signal-ios | `chore(ios): TestFlight build pipeline + export-compliance flag (#16)` — adds `eas-testflight.yml` + `app.json` encryption flag | **Partial** — advances "TestFlight + native auth" item but does not close it |

No commits in `signal`, `signal-android`, or `signal-creatives` in the past 24 hours.

---

## Anomalies

1. **Activation cron may not have fired.** The Vercel runtime log window covers 2026-05-22T12:03 → 2026-05-23T12:03 UTC. The daily cron fires at 14:00 UTC, so yesterday's run (2026-05-22T14:00) should appear — it does not. Only two requests logged: a `GET /api/ai` (405, expected) and a `GET /api/health` (200, minor deprecation warning). Cannot rule out that Vercel log sampling dropped the cron request, but worth verifying manually. SQL to confirm: `SELECT day7_studio_sent_at FROM users WHERE id = '4d4aaccc-68a7-4e96-8889-c7c22f94a25f'` — if still `2026-05-14 14:04 UTC` after today's 14:00 UTC window, cron skipped a beat.

2. **Node.js DEP0169 deprecation warning** on `/api/health`. Non-blocking, but signals a Node API call that will break in a future Node major version. Low priority.

3. **`/api/activation?dry_run=1` MCP fetch returned 409 Conflict** (Vercel protection bypass conflict). Direct `curl` is blocked in this sandbox. Cannot confirm response shape. Add to next session's startup verification.

4. **Sandbox curl blocked.** Direct `curl` to `signal-multi.vercel.app` returned "Host not in allowlist" in this remote execution environment. All backend checks routed through Vercel MCP instead. Backend is reachable (405 on GET /api/ai is correct behavior).

---

## Needs DPG input

Carried from v15 §11 — items explicitly marked as awaiting DPG:

- **Apple Developer enrollment** — everything TestFlight/push/native auth is blocked behind this.
- **Anthropic credit top-up + auto-reload** — billing state unknown; needed before V1 demo cohort.
- **ASC API key secrets** (`ASC_API_KEY_BASE64`, `ASC_KEY_ID`, `ASC_ISSUER_ID`) — required to activate the TestFlight workflow added today.
- **Wolf-moment samples per craft** — requires a fresh DPG decision on safe UI surface before any wiring (v15 §11).
- **Session A orphan commits** `3fae0e1`, `3ae0aea`, `d390178`, `80e188f` — locate or clarify.
- **Orphan branch cleanup** — `claude/review-signal-handoff-8p62X`, `claude/crispr-data-iteration-yMpnD`, `claude/fix-todo-overlap-I2tBT`, `claude/create-handoff-todos-G067Y`.
