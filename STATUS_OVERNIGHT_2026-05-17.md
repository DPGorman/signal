# Signal Overnight Status — 2026-05-17

Handoff basis: v15 (2026-05-15). Open items from §11.

---

## Closed since last status

- **Voice card generator backend** (`/api/voicecard/generate`) — commits `b794c5a`, `6dd29f8`, `1573786`, `bdeb123` all on `signal/main`. v15 §11 listed this as ~3 hrs of work; it appears to have landed on main before or alongside v15. Mark **possibly closed** pending DPG confirmation.

---

## Still open

15 items remain open from v15 §11. Summary by cluster:

| Cluster | Count | Notes |
|---|---|---|
| DPG-gated blockers | 3 | Apple Dev enrollment (overdue since 5/7), Anthropic top-up, TestFlight + native auth |
| Desktop features | 3 | Insight panel (60-sec paste), "synced from phone" badge, voice-card generator (see above) |
| iOS hardening | 4 | Error boundary extension, loading skeletons, offline messaging, test suite |
| Backend/infra | 3 | Pulse rhythm refactor, `pulse.js` CRON_SECRET hardening, Vercel auto-deploy |
| Pending DPG action | 4 | Copy v15 to Mac path, delete orphan branches, create memory files for rules 24+27, PR + merge error-boundary commit `451a3241` from `claude/crispr-data-iteration-yMpnD` |
| Backlog | 6 | B7/B9/B10/B11/B14/B15 per v15 §11; wolf-moment samples (needs DPG decision) |

No past-24h commit plausibly closes the error-boundary commit (`451a3241`) or any DPG-gated item.

---

## New work since handoff

**signal-ios** — 5 commits on local `main`, **NOT yet pushed to `origin/main`**:
- `e7c12f20` feat: iOS Incoming screen — triage surface for non-creative captures
- `d7568fb7` fix: iOS Insight studio call + subtitle use creativeIdeas only
- `d4ff798f` fix(counts): iOS home + studio show creativeIdeas count only
- `271f33ca` fix(capture): interactive swipe-to-dismiss keyboard
- `2d620f18` fix(capture): don't auto-focus input on mount

**signal** — 14 commits on an **orphaned detached HEAD** (see Anomalies). Hashes for recovery:
`df1a99f`, `d1058ca`, `a0ffd2a`, `3e8d7f7`, `03a9930`, `4fa4c74`, `58ec306`, `723e7ad`, `c502b67`, `34c8adc`, `9184f53`, `5c2f975`, `e0abe82`, `3b90dd0`

Substance: Incoming tab (desktop), AI Behavior Spec v1 capture-mode rewire, creativeIdeas-vs-ideas sweep (6 count/scope fixes), `/api/admin` consolidation, public `/api/health` endpoint, weekly augment-observations cron, voice-card auto-refresh cron. None of these appear in v15's punch list.

**signal-creatives / signal-android**: no activity in past 24h.

---

## Anomalies

**CRITICAL — 14 signal commits stranded on detached HEAD.** When this session checked out `signal/main`, git warned: *"leaving 14 commits behind, not connected to any of your branches."* These commits are NOT on any local or remote branch. They represent substantial new features (Incoming tab, AI Behavior Spec rewire, two new crons) written in a prior session that was never committed to a named branch. Git will garbage-collect them. Recovery: from signal repo, run `git checkout df1a99f` then `git checkout -b recovery/may-17-detached` and push before GC runs. **Needs immediate DPG attention.**

**signal-ios local main is 5 commits ahead of origin.** Push required or those commits also at risk.

**/api/activation?dry_run=1 returned HTTP 401 Unauthorized.** Expected — dry_run param is not an authenticated path. Cron health unverifiable without CRON_SECRET from this environment; note for next session.

**Sandbox curl blocked** for all external URLs. Used Vercel MCP (`web_fetch_vercel_url`) as documented in CLAUDE.md. `/api/health` green; `/api/ai` ping not attempted via MCP.

---

## Needs DPG input

- **Detached HEAD recovery** (above) — time-sensitive, do before git GC.
- **signal-ios push** — 5 commits on local main not pushed; OTA won't publish until pushed.
- Wolf-moment samples per craft: v15 §11 marks as "needs fresh DPG decision" before any UI wiring.
- Locate or clarify Session A commits `3fae0e1`, `3ae0aea`, `d390178`, `80e188f` (v15 §11, pending).
- PR + merge `451a3241` from `claude/crispr-data-iteration-yMpnD` (single-commit error-boundary work, still unmerged).
