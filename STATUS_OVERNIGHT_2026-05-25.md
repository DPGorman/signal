# Signal Overnight Status — 2026-05-25

*Handoff reference: v15 (2026-05-15). Checked at 12:15 UTC.*

---

## Closed since last status

- ✅ **Apple Developer enrollment** (v15 §11) — possibly closed. `e008840` (signal-ios) wires ASC API key and sets `ascAppId 6772788746`. A valid ascAppId requires an enrolled Apple Developer account. Yesterday's status had this blocked; today a build was submitted. Treat as closed pending DPG confirmation.
- ✅ **ASC API key secrets added** — PR #16 workflow was "dormant — waiting on 3 secrets" per 2026-05-24 note. `e008840` wires all three (`ASC_API_KEY_BASE64`, `ASC_KEY_ID`, `ASC_ISSUER_ID`). Workflow now runs.
- 🟡 **TestFlight build submitted** (v15 §11 "TestFlight build + native auth") — partially done. `d1f3766` confirms "build #2 uploaded, awaiting Apple processing." Counting as in-progress, not closed: Apple review still pending; native auth (Face ID, Apple Sign In, Google) not yet wired.

---

## Still open

**12+ items remain from v15 §11.** Priority order per §13:

1. **Error-boundary commit `451a3241`** on `claude/crispr-data-iteration-yMpnD` — single-commit PR, still not merged (v15 §11 "newly opened")
2. **Voice card generator** `/api/voicecard/generate` in `signal/` (~3 hrs) — zero commits toward this
3. **Desktop Insight panel** `docs/proposals/desktop-insight-panel.jsx` — ~60 sec DPG action
4. **TestFlight / native auth** — awaiting Apple processing; native auth still unimplemented
5. **Push token** — gated on dev/TestFlight build clearing (v15 §11 "push registration is gated on dev/TF build")
6. **Hardening:** ErrorBoundary extension, loading skeletons, offline messaging, test suite
7. **Desktop "synced from phone" badge** in `signal/src/app.jsx`
8. **DPG-side housekeeping:** copy v15 to Mac canonical path; delete orphan branches; create 2 missing memory files (rules 24 + 27)
9. **Longer-horizon:** wolf-moment samples per craft; B7/B9/B10/B11/B14/B15; pulse rhythm refactor; CRON_SECRET hardening; password reset / Stripe / beta / retirements

---

## New work since handoff

All 8 commits are in `signal-ios`. Zero in `signal`, `signal-android`, `signal-creatives`.

| Hash | Summary | Maps to v15 item? |
|---|---|---|
| `e20d4a4` | **App renamed → "SigNoise"**; bundle ID → `com.betterlab.signal`; SDK 54 dep cleanup | ❌ Not in any handoff |
| `339ba09`→`e401c25`→`6391d7f` | TestFlight signing iteration (APNs entitlement on/off, buildNumber 2) | TestFlight item |
| `e008840` | Wire TestFlight submit — ascAppId + ASC API key | TestFlight item; closes ASC secret gap |
| `d1f3766` | TestFlight status doc: build #2 uploaded, awaiting Apple | TestFlight item |
| `83c05fb` | CLAUDE.md MOTHERSHIP path fix; `.gitignore .claude/` | ❌ Housekeeping, not in §11 |
| `978c6c1` | Merge — brings in `eas-testflight.yml` workflow | TestFlight item |

---

## Anomalies

- **App renamed to "SigNoise"** (`e20d4a4`): `expo.name` changed "Signal" → "SigNoise"; bundle ID changed `com.signal.creative` → `com.betterlab.signal`. Not mentioned in v15 or any prior handoff. **Next handoff (v16, now overdue at 10 days) must document this.**
- **`/api/health` → HTTP 200** `{"ok":true,"ts":"2026-05-25T12:15:12Z","backend":"reachable"}` ✅ Backend healthy.
- **`/api/activation?dry_run=1` → 401 Unauthorized** — cron endpoint auth-gated since 2026-05-16 (per `signal/CLAUDE.md`); public dry_run probe no longer works. Cron health unverifiable without CRON_SECRET. Last confirmed firing: 2026-05-14 14:04 UTC (v15 §14).
- **`/api/ai` health check inconclusive** — POST-only; Vercel MCP returns 405 on GET. Not a failure. Backend confirmed up via `/api/health`.
- **v16 handoff overdue** — v15 is 10 days old; 30+ signal-ios commits since v15 (PRs #10–#16 + today's 8) are undocumented in any handoff.

---

## Needs DPG input

1. **App rename to "SigNoise"** — intentional and permanent? Confirm so v16 handoff can document it officially.
2. **TestFlight Apple processing** — check App Store Connect for build approval status; once approved, trigger native auth + push token work.
3. **Apple Developer enrollment** — confirm fully enrolled (account active, not pending payment/agreements).
4. **Error-boundary commit `451a3241`** — still pending PR on `claude/crispr-data-iteration-yMpnD`. 5-minute task.
5. **Anthropic billing** — top up before V1 demo cohort; state unknown.
6. **Write v16 handoff** — 30+ undocumented commits; SigNoise rename; TestFlight pipeline live.
