# Signal Overnight Status — 2026-05-24

*Handoff reference: v15 (2026-05-15). Checked at 12:12 UTC.*

---

## Closed since last status

No punch-list items fully closed in the past 24 hours.

- **Possibly progressed — TestFlight CI pipeline:** Commit `11d15b4` (signal-ios, PR #16, merged 2026-05-23 ~14:16 UTC+7) adds `.github/workflows/eas-testflight.yml` and sets `ITSAppUsesNonExemptEncryption=false` in `app.json`. CI infrastructure is in place for "TestFlight build + native auth providers" (v15 §11). **Still dormant** — requires DPG to add three App Store Connect API key secrets (`ASC_API_KEY_BASE64`, `ASC_KEY_ID`, `ASC_ISSUER_ID`). Does not affect the OTA preview pipeline. Not marking closed.

---

## Still open

13+ items remain from v15 §11. Top items by sequencing (v15 §13):

1. Error-boundary commit `451a3241` on `claude/crispr-data-iteration-yMpnD` — single-commit PR, still not merged
2. Voice card generator backend `/api/voicecard/generate` in `signal/` (~3 hrs)
3. Desktop Insight panel (`docs/proposals/desktop-insight-panel.jsx`) — ~60 sec DPG action
4. Apple Developer enrollment — overdue since 5/7; gates TestFlight, push tokens, native auth
5. Anthropic credit top-up + auto-reload
6. Hardening pass: ErrorBoundary, loading skeletons, offline messaging, test suite
7. Orphan branch cleanup (v15 §11); wolf-moment samples; B7/B9/B10/B11/B14/B15; pulse rhythm refactor; CRON_SECRET hardening; password reset; Stripe; beta recruitment

---

## New work since handoff (past 24h only)

| Hash | Repo | Commit message | Maps to open item? |
|---|---|---|---|
| `11d15b4` | signal-ios | `chore(ios): TestFlight build pipeline + export-compliance flag (#16)` | Partially — "TestFlight build" item; dormant |

⚠️ **Stale handoff alert:** v15 is 9 days old. Signal-ios alone has 22+ commits since 2026-05-15 that are not reflected in any handoff, including PRs #10–#16 (shared `lib/api.ts` wrapper, voice-overlay migration for Capture + Insight, classifier gate, iOS Incoming screen, multi-round clarifying-question flow, persistent Capture shelf, nav relocation, TestFlight pipeline). Signal desktop has comparable undocumented volume. **A v16 handoff is overdue.**

---

## Anomalies

- **`/api/health` → HTTP 200** `{"ok":true,"ts":"2026-05-24T12:12:36Z","backend":"reachable"}` ✅ Backend reachable.
- **`/api/ai` POST check:** Sandbox curl blocked (403). Vercel MCP GET returned 405 Method Not Allowed — expected for a POST-only endpoint. Not a failure; backend is up per `/api/health`.
- **`/api/activation?dry_run=1`:** HTTP 401 Unauthorized — requires `CRON_SECRET`, not available in agent session. Cron health unverifiable without credentials. Last known state: firing daily at 14:00 UTC (verified in v15).
- **`/api/admin` path consolidation:** Signal desktop commit `a0ffd2a` ("refactor: consolidate /api/health + /api/recrawl + /api/admin/metrics → /api/admin") moved D14 metrics endpoint. v15 §14 still documents the old `/api/admin/metrics` path — this is a quiet doc drift. `/api/health` (public, added in `03a9930`) is confirmed working.
- **No commits in signal, signal-android, or signal-creatives in past 24h.** (signal-android and signal-creatives appear dormant.)

---

## Needs DPG input

From v15 §11 + new since v15:

1. **Add ASC secrets** (`ASC_API_KEY_BASE64`, `ASC_KEY_ID`, `ASC_ISSUER_ID`) to activate the TestFlight workflow — new from PR #16
2. **Apple Developer enrollment** — overdue since 5/7; blocks TestFlight, native auth, push pipeline
3. **Locate or clarify Session A commits** `3fae0e1`, `3ae0aea`, `d390178`, `80e188f` — still unresolved from v15
4. **Copy v15 to Mac path:** `/Users/dpg/THE MOTHERSHIP/SIGNAL-APP/SIGNAL_HANDOFF_2026-05-15_v15.md`
5. **Delete orphan branches** listed in v15 §11
6. **Create two missing memory files** for rules 24 and 27 (v14 §17.C)
7. **Write v16 handoff** — 22+ commits across both repos since v15 are undocumented
8. **Anthropic billing** — top up before V1 demo cohort; current state unknown
