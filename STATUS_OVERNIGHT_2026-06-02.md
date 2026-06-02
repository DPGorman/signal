# Signal Overnight Status — 2026-06-02

## Closed since last status
None. No commit in the past 24h plausibly closes any open punch-list item from handoff v17.

## Still open (3 items — v17 §"Open items")
1. **Canon docs missing under CRISPR project — blocked.** `loadCanon` filters by `project_id`; the ~10
   docs exist but are invisible under the active project. No code change until the rows are inspected in
   Supabase `czgjbblkoyyojnaziyuy`. Blocked on item 2.
2. **Wrong-account connections — DPG action required.** This sandbox's Supabase MCP is wired to
   `theweekend.app.au@gmail.com` instead of `dpgorman@gmail.com`. A credential-guardrail fix was designed
   and the prompt handed to DPG (run in Terminal at `/Users/dpg`). Until re-wired, no Supabase-touching
   cloud work can proceed.
3. **`/handoff` unavailable in cloud sessions.** Custom command lives on the Mac only; not committed
   into repos. Fix: commit to `.claude/commands/handoff.md` in each repo.

## New work since handoff
All 7 signal-ios commits in the past 24h are already documented in v16/v17. No undocumented work.

| Commit | Summary | Handoff coverage |
|---|---|---|
| `62169f3` | Handoff v17 doc (#26) | v17 itself |
| `6f12629` | Capture double-count fix + ASC key recorded (#24) | v17 §Shipped |
| `e3e12e4` | Handoff v16 doc (#23) | v16 itself |
| `7679936` | Credential preflight for CI (#22) | v17 §CI/ASC resolved |
| `7b1f79b` | Fix TestFlight CI submit (#21) | v17 §CI/ASC resolved |
| `14c9d43` | Fix Drop-a-Signal crash (#20) | v17 §Shipped |
| `f7a84f6` | Fix launch crash + prod OTA workflow (#19) | v17 §Shipped |

signal, signal-creatives, signal-android: no commits in past 24h.

## Anomalies
- **`/api/activation?dry_run=1` → HTTP 401 Unauthorized.** Expected `"ok":true`. The push-notification
  activation cron endpoint is rejecting unauthenticated requests. Either the endpoint requires a Bearer
  token that wasn't supplied, the `dry_run` param isn't whitelisted, or this is a regression in the
  current deploy. Needs a manual check.
- **`/api/ai` health unconfirmed.** Vercel MCP only supports GET; endpoint requires POST. GET returned
  405 (Method Not Allowed) — endpoint is alive and deployed, but AI proxy health itself is untested.
- **Backend curl blocked by sandbox network policy.** `curl` to `signal-multi.vercel.app` returned HTTP
  403 "Host not in allowlist". Vercel MCP used as workaround; POST endpoints remain untestable.
- **Orphaned branch `claude/canon-user-wide-scope`** still on `signal-ios` remote (v17 noted deletion
  failed on network error). Harmless; delete when convenient.

## Needs DPG input
- **Run credential-guardrail prompt on Mac** (v17 §Next actions #1): Terminal session at `/Users/dpg`.
  This unblocks all Supabase work in cloud sessions and resolves the Canon docs issue.
- **Reconnect Supabase to `dpgorman@gmail.com`** (v17 §Next actions #2): re-wire this environment so
  cloud sessions can read `czgjbblkoyyojnaziyuy` and Canon docs can be diagnosed.
- **`/api/activation` 401**: Is this endpoint intentionally auth-gated, or is it a regression?
  (Was working in v14/v15 timeframe per handoff history.)
