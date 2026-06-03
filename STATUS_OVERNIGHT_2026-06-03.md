# Signal Overnight Status — 2026-06-03

## Closed since last status
None of the three open items from v17 are closed by today's commits. The 24-hour commit wave (all in the `signal` desktop repo) is independent new work. See "New work since handoff" below.

## Still open (3 items — v17 §Open items)
1. **Canon docs missing under CRISPR project** — blocked pending correct Supabase credentials. `stores/useCanon.ts` filters by `project_id`; the ~10 docs exist but are invisible under the active project. No code change safe until data is inspected. (v17 item 1)
2. **Wrong-account connections** — this sandbox's Supabase MCP is signed into `theweekendapp` (Weekend app account), not `dpgorman@gmail.com`. Every query against `czgjbblkoyyojnaziyuu` returns permission-denied. Credential-guardrail design is ready; needs DPG to run the Mac prompt. (v17 item 2)
3. **`/handoff` command not available in cloud sessions** — the command lives in the Mac's `~/.claude/commands/` only; fix is to commit it into each repo's `.claude/commands/`. (v17 item 3)

## New work since handoff
All 9 commits landed on `signal` (desktop/web) today via PR #4 (`build/wave1-reposition-2026-06-03`), merged to `origin/main`. Zero commits in `signal-ios`, `signal-android`, or `signal-creatives`.

| Hash | Description |
|------|-------------|
| `3bb4cc9` | 1.1a: surface link suggestion at capture time |
| `f6055a7` | 1.1b: wire orphaned batch connections endpoint to MAP ALL |
| `7390ab0` | 1.3 + 2.1: source-cited answers + contradiction detection |
| `ffac6b5` | chore: untrack node_modules (was committed before .gitignore) |
| `fd5b7fb` | 1.3 hardening: bracket-aware canon citation match (suppress false positives) |
| `c022e23` | Merge PR #4 from build/wave1-reposition-2026-06-03 |
| `3054f03` | cleanup: drop dead MindMapView props + hoist double-computed citation lookup |
| `1cfb898` | Fix MAP ALL silently writing 0 connections |
| `a62cacd` | Extract connection-resolution into tested `_resolve.js` helper |

This is an undocumented wave — significant desktop work around connections (MAP ALL fix, batch endpoint wiring, link suggestions at capture) and canon citation quality (source-cited answers, contradiction detection, bracket-aware match). None of it appears in v17. **The next handoff doc should capture this wave.**

## Anomalies
- **`/api/ai` GET → 405:** Expected. The endpoint requires `POST` with a body; 405 confirms the serverless function is deployed and responding correctly.
- **`/api/activation?dry_run=1`:** Vercel MCP tool returned "Unable to create shareable URL." This is a tool limitation (query-param URLs are sometimes blocked by the shareable-URL generator), not necessarily a backend failure. Cannot confirm cron health from this environment — no anomaly assumed, but unverified.
- **Local `signal` clone was behind `origin/main` by 9 commits** at session start (detached HEAD). Fast-forwarded before writing this note. No data loss.
- **Orphaned remote branch `claude/canon-user-wide-scope`** on `signal-ios` still not deleted (noted in v17; delete kept failing on a network error in that session).

## Needs DPG input
1. **Run the credential-guardrail prompt** on Mac Terminal at `/Users/dpg` (designed in v17 session). Unblocks Canon diagnosis + all Supabase inspection from cloud sessions.
2. **Reconnect Signal's Supabase MCP** to `dpgorman@gmail.com` so the next session can inspect `czgjbblkoyyojnaziyuu` and fix the Canon project-scoping bug.
3. **Write a v18 handoff** capturing the wave1-reposition desktop wave (connections overhaul, source-cited answers, MAP ALL fix). v17 predates all of it.
4. **Delete orphaned branch** `claude/canon-user-wide-scope` on `signal-ios` remote (cosmetic, low priority).
