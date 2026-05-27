# Signal Overnight Status — 2026-05-27

## Closed since last status
None. Zero commits across all four repos in the past 24 hours (last activity: `signal` on 2026-05-25T13:28 UTC).

## Still open
All v15 §11 items remain open (15+ items). Priority callouts per §13 sequencing:

- ⏳ **Error-boundary commit `451a3241`** on `claude/crispr-data-iteration-yMpnD` — pending PR + merge + branch delete (v15 §11 newly opened)
- ⏳ **Voice card generator** `/api/voicecard/generate` — *may be closed by post-v15 work; see New Work below*
- ⏳ **Apple Developer enrollment** (overdue since 5/7) — gates TestFlight, native auth, push registration
- ⏳ **Anthropic credit top-up + auto-reload**
- ⏳ **Desktop Insight panel** (`docs/proposals/desktop-insight-panel.jsx`) — ~60 sec DPG paste-in
- ⏳ **DPG cleanup:** copy v15 to Mac path; delete orphan branches; create 2 missing memory files (rules 24 + 27)
- ⏳ **Hardening pass:** error boundaries, loading skeletons, offline messaging, test suite
- ⏳ B7/B9/B10/B11/B14/B15; pulse rhythm refactor; `pulse.js` CRON_SECRET hardening; Stripe; password reset; signal-navy-five retirement

## New work since handoff
No commits in the 24-hour window. However **~37 commits on `signal` between 2026-05-16 and 2026-05-25 are undocumented in v15** — none captured in any handoff file. The next session must read `signal/CLAUDE.md` + recent git log before assuming v15 §11 is current.

Key post-v15 items (surface for v16 handoff):
- `6dd29f8` + `1573786` + `bdeb123` — voicecard v2 generator shipped + auth fixed + atomic swap (2026-05-16) — **possibly closes v15 "voice card backend" punch item**
- `e0abe82` — voice-card auto-refresh cron (2026-05-17)
- `3b90dd0` — weekly augment-observations cron
- `e6aa2e8` + `119edc7` — `ai_observations` table + AI knowledge-layer writer (new schema surface)
- `305b933` + `bf81d34` — classify mode + desktop two-step capture pipeline
- `bac75a3` ×5 waves — `app.jsx` split into components (complete)
- `1011679` — desktop multi-round clarifying-question UI (voice doc v2.3)
- `a0ffd2a` — `/api/admin` consolidation (health + recrawl + metrics merged)
- `3e8d7f7` — Incoming tab (non-creative capture triage)
- `7a3e117` + `df1a99f` — AI Behavior Spec v1 wired into all three prompts (studio, pulse, capture)
- `f17aa9a` PR #2 — connections scope bug fixed + merged to `signal` main (2026-05-25) — **not yet deployed**

## Anomalies

**Backend: unverifiable from this sandbox.** Sandbox network policy blocks direct `curl` to `signal-multi.vercel.app` (HTTP 403 `host_not_allowed`). Vercel MCP `web_fetch_vercel_url` returned Cloudflare 502 (transient/retryable). Last confirmed Vercel production deployment: `dpl_FrVYFRpHi72SAiJ46yxypiYTLdqH`, state READY, commit `7a3e117`, dated 2026-05-19. DPG should verify `/api/health` manually.

**3 `signal` commits on main are undeployed** — merged 2026-05-25, Vercel still serving 2026-05-19 code:
- `f17aa9a` Merge PR #2 (connections scope fix)
- `026f820` Fix: scope connections leaking across projects ← **bug in production right now**
- `13c2017` Fix stale CLAUDE.md paths

Run `vercel --prod` from `signal/` to close this gap.

**No handoff written since v15 (2026-05-15)** despite 10 days and ~37 commits on `signal`. A v16 handoff is overdue.

## Needs DPG input
From v15 §12 (still pending):
- ⏳ Locate Session A commits: `3fae0e1`, `3ae0aea`, `d390178`, `80e188f`
- ⏳ Copy v15 to `/Users/dpg/THE MOTHERSHIP/SIGNAL-APP/SIGNAL_HANDOFF_2026-05-15_v15.md`
- ⏳ Delete orphan branches (v15 §11): `claude/review-signal-handoff-8p62X`, `claude/crispr-data-iteration-yMpnD`

**New since v15:**
- **Deploy `signal` main to Vercel** — connections bug fix is stranded on main. `vercel --prod` from `signal/`.
- **Write v16 handoff** — ~37 undocumented commits since v15. Next session should not rely on v15 §11 alone.
