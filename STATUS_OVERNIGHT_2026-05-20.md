# Signal Overnight Status — 2026-05-20

Handoff reference: v15 (2026-05-15) at `signal-ios/docs/handoffs/SIGNAL_HANDOFF_2026-05-15_v15.md`

---

## Closed since last status

No open punch-list items from v15 §11 are plausibly closed by today's commits. See "New work" below for what did land.

---

## Still open

17 open items from v15 §11 remain. Summary by category:

**DPG-gated (requires external action):**
- Apple Developer enrollment — overdue since 5/7
- Anthropic credit top-up + auto-reload
- TestFlight build + native auth — gated on Apple Dev
- Copy v15 to Mac canonical path (`/Users/dpg/THE MOTHERSHIP/...`)
- Delete 3 orphan branches: `claude/review-signal-handoff-8p62X`, `claude/crispr-data-iteration-yMpnD`, `claude/fix-todo-overlap-I2tBT`
- Locate Session A commits: `3fae0e1`, `3ae0aea`, `d390178`, `80e188f`
- Create two missing memory files for rules 24 + 27

**Code-ready (can be done in next session):**
- Error-boundary commit `451a3241` on `claude/crispr-data-iteration-yMpnD` — PR + merge + branch delete (§11 newly opened in v15)
- Voice card generator backend `/api/voicecard/generate` in `signal/` (~3 hrs)
- Apply desktop Insight panel from `docs/proposals/desktop-insight-panel.jsx` (~60 sec)
- Desktop "synced from phone" badge in `signal/src/app.jsx`
- `pulse.js` CRON_SECRET hardening; Vercel ↔ GitHub auto-deploy
- Hardening pass: ErrorBoundary wrap beyond Capture, loading skeletons, offline messaging, test suite
- Pulse rhythm refactor (~2 hrs)

**Decision/backlog:**
- Wolf-moment samples per craft (D2) — decision form TBD (v14 §11)
- B7, B9, B10, B11, B14, B15 backlog items
- Password reset UI, Stripe, beta tester recruitment, legacy app retirement

---

## New work since handoff

Four commits not mapped to any v15 open punch-list item — undocumented work the next handoff should capture:

**signal-ios** (all 2026-05-20):
- `1b0fff03` feat: relocate nav — HomeNavRow under logo + floating CaptureFAB elsewhere (#15)
  - Files: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `components/HomeNavRow.tsx`, `components/CaptureFAB.tsx`
- `d3812f0d` feat: iOS persistent Capture shelf + slimmed Home (#14)
  - Files: `app/(tabs)/index.tsx`, `components/CaptureBar.tsx`
- `1c7e080c` chore: update audit-drift.sh + RESUME_SESSION.md for ~/code/ paths
  - Files: `docs/scripts/audit-drift.sh`, `docs/RESUME_SESSION.md`

**signal-creatives** (2026-05-20):
- `86c7c89` Final-edit pass: share metadata, real footer, success exit, polish
  - Files: `index.html`, `src/app.jsx`, `src/components/SignupForm.jsx`, `src/styles.css`, `public/` (og-image, favicons, privacy, terms)

signal and signal-android: no commits in past 24h.

---

## Anomalies

- **Backend curl blocked:** Sandbox network allowlist prevents outbound curl to `signal-multi.vercel.app`. Not a backend issue.
- **`/api/activation?dry_run=1` → HTTP 401:** Expected (CRON_SECRET required). Confirms endpoint is live and routing correctly.
- **`/api/ai` unverified:** GET via Vercel MCP returned "unable to create shareable URL" (POST-only endpoint). No POST possible from this sandbox. AI endpoint health unconfirmed — not necessarily down.
- **Vercel MCP transient 502** on first call; second call succeeded. No action needed.
- **`signal-health-log` branch has unrelated code conflicts** (`api/voicecard/generate.js`, `src/app.jsx`, `api/admin/metrics.js`, `api/recrawl.js`) — pushed status file directly via GitHub MCP rather than resolving.

---

## Needs DPG input

From v15 §11 "pending DPG attention" + newly flagged:
- Apple Developer enrollment (blocks TestFlight, native auth, push pipeline)
- Anthropic billing state unknown — top up before V1 demo cohort
- Wolf-moment samples decision: safe form is a craft-keyed data file, no onboarding UI surface — confirm or redirect
- Session A commits `3fae0e1`, `3ae0aea`, `d390178`, `80e188f` — locate or mark stale
- v15 nav restructuring (PRs #14 + #15 in signal-ios) is undocumented in any handoff — confirm it should roll into v16
- `signal-health-log` branch has code-level conflicts that need resolution before it can be merged to main
