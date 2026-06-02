# Signal Overnight Status — 2026-05-19

Baseline: `SIGNAL_HANDOFF_2026-05-15_v15.md` (highest version in cloned repos).
**⚠ Handoff drift detected** — TODOS.md and today's commits reference v21 (2026-05-17);
handoffs v16–v21 exist on DPG's Mac but are not pushed to GitHub. Cross-reference below
uses v15 §11 + TODOS.md refreshed-to-v21 content as combined baseline.

---

## Closed since last status

- **TODOS #2 — AI Behavior Spec verb rewiring** (studio + pulse): `7a3e117`
  `feat: studio + pulse prompts rewired against AI Behavior Spec v1`
  Rewrites `api/_voice/modes.js` for studio and pulse modes against the 8-verb spec
  (NOTICE / THREAD / CHALLENGE / etc.). Capture was wired in `df1a99f`; classify and
  augment-observations were already handled. This **possibly completes** TODOS #2 —
  confirm all 5 modes are wired and taste-tested before closing.

- **callAI dead-code removal**: `38ce6592`
  `chore: drop unused callAI export + refresh TODOs to v21 state`
  Removes legacy `callAI` export from `lib/ai.ts` (signal-ios); zero callers, only
  `callAIv2` in use. Minor cleanup, no punch-list item — listed here as new closure.

---

## Still open

12+ items remain open (v15 §11 + TODOS.md v21 parking lot). Priority grouping:

**DPG-action-gated (can't unblock in code):**
- Apple Developer enrollment (overdue since 5/7) — gates TestFlight, native auth, push
- Anthropic credit top-up + auto-reload — billing state unknown
- Cold-restart phone ×2 to apply Incoming OTA + v20 carryovers (TODOS #1)
- Resurrect or kill `claude/post-v14-followups` (signal-ios, 4 days idle, 26-file diff)
  (TODOS #4)

**Queued (ready for next session):**
- Voice card generator backend `/api/voicecard/generate` in `signal/` — ~3 hrs (TODOS #6)
- Error-boundary commit `451a3241` on `claude/crispr-data-iteration-yMpnD` — pending
  single-commit PR + merge + branch delete (v15 §11)
- Switch sanity-check trigger to `/api/health` endpoint (TODOS #5)
- Marketing-site gaps ×5 surfaced in v21 (TODOS #3)
- Wolf-moment samples per craft (TODOS #8)
- Pulse rhythm refactor ~2 hrs; `pulse.js` CRON_SECRET hardening (v15 §11)

**Parked (gated on Apple Dev or long-horizon):**
B7/B10/B11/B14/B15; hardening pass; desktop badge; Stripe; password reset; recruitment.

---

## New work since handoff

Commits in past 24h that don't appear in v15 §11 open items:

| Hash | Repo | Message | Mapping |
|------|------|---------|--------|
| `7a3e117` | signal | feat: studio + pulse prompts rewired against AI Behavior Spec v1 | Possibly closes TODOS #2; AI Behavior Spec itself is post-v15 work |
| `d8cbb49` | signal | docs: TDZ hoist note at top of app.jsx | v21 lesson doc; no v15 punch-list item |
| `38ce6592` | signal-ios | chore: drop unused callAI export + refresh TODOs to v21 state | Cleanup; no v15 punch-list item |

signal-creatives and signal-android: no commits in past 24h.

The AI Behavior Spec (`SIGNAL_AI_BEHAVIOR_2026-05-17_v1.md`) was authored and saved
during a v17–v21 session; the spec itself and all work dependent on it are undocumented
in these repos (handoff drift). Next handoff should capture this in the cloned repo.

---

## Anomalies

1. **`/api/activation?dry_run=1` — 502 Bad Gateway (Cloudflare at api.anthropic.com).**
   The activation endpoint appears to be calling the Anthropic API; Cloudflare returned
   a 502 ("origin overloaded or misconfigured") with `retry_after: 60`. Could be
   transient Anthropic capacity; could indicate the activation route calls AI in a way
   it shouldn't (activation is supposed to be a pure DB read + push send, not an AI
   call). Needs investigation. The daily 14:00 UTC cron may be silently failing.
   `/api/health` returned `{"ok":true}` 200 — deployment itself is live.

2. **`/api/ai` endpoint — tested with GET, returned 405 (Method Not Allowed).**
   Expected: endpoint is POST-only. Full health unconfirmable from this sandbox (curl
   blocked by network allowlist; Vercel MCP does GET only). Not flagged as a failure —
   endpoint is responding normally. Use the v15 §15 ping command locally to confirm.

3. **Handoff version drift (v15 → v21):** Six handoff versions (v16–v21, covering
   2026-05-15 to 2026-05-17) exist on DPG's Mac but are not in the `signal-ios/docs/handoffs/`
   directory of the GitHub repo. The overnight agent read v15 as baseline; the real
   current state is v21. Push `SIGNAL_HANDOFF_2026-05-17_v21.md` to `signal-ios/docs/handoffs/`
   so future agents have the current baseline without needing Mac access.

4. **"v21" co-author attribution:** All three commits today show
   `Co-Authored-By: Claude Opus 4.7 (1M context)` — model upgrade from v14's Opus 4.6
   references. Matches CLAUDE.md note about model availability; no action needed.

---

## Needs DPG input

- **Activation 502:** Is the `/api/activation` route intentionally calling the
  Anthropic API? If so, the 502 means the daily cron may have misfired today.
  Check Vercel cron logs for the 14:00 UTC run.
- **`claude/post-v14-followups` decision:** 4 days idle, 26 files changed (+700/-1597).
  Merge the wins or delete. Can't auto-resolve.
- **Push handoff v21 to GitHub:** `SIGNAL_HANDOFF_2026-05-17_v21.md` is on the Mac
  only. Overnight agents will read v15 until this is pushed.
- **Session A commits still unlocated:** `3fae0e1`, `3ae0aea`, `d390178`, `80e188f`
  (v15 §11, carried forward from v14).
- **TODOS #2 taste test:** Studio + pulse prompts rewritten today — confirm via real
  captures before marking the verb-rewiring item closed.
