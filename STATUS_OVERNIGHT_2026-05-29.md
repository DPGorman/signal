# Signal Overnight Status — 2026-05-29

> Handoff reference: `signal-ios/docs/handoffs/SIGNAL_HANDOFF_2026-05-15_v15.md` (v15, highest found)

---

## Closed since last status

Based on past-24h commits, these v15 §11 open items appear **possibly closed**:

- ⚠️ **Push notifications backend sender** (was "unimplemented") — `00f1305` `feat(push): wire iOS push notifications for day-3 + day-7 activations` adds `api/_push.js` + updates `api/activation.js`. This appears to implement the Expo sender the v15 handoff flagged missing. **Verify** that `expo-server-sdk` calls are now in `activation.js` and that the token-read path is wired.
- ⚠️ **Studio "Tasks lockout"** — `c01c3de` `Studio: rebuild as the index for every surface (fixes Tasks lockout)` in `signal-ios`. The v15 punch list carried "Studio missing stable entry points / Tasks lockout" as an open item. Commit message says fixed.
- ⚠️ **Voice-card stale copy** — `a084b79` `Polish batch — voice-card copy, count reconciliation…` in `signal-ios` touches `studio/voice-card.tsx`. CLAUDE.md noted "stale 'endpoint isn't live yet' copy — fix that next." Likely closed.
- ⚠️ **`pulse.js` security** (partial) — `0e7c6a5` `fix(pulse): scope JWT-authed pulses to the verified user` in `signal`. Partially addresses the `pulse.js` CRON_SECRET/auth hardening item from v15 §11.
- ⚠️ **Calendar auth** — `cc6a217` `fix(calendar): require JWT auth + HMAC-signed OAuth state`. Not on v15 punch list, but closes a security gap.

---

## Still open

**v15 §11 items with no matching 24h commit (11 remain open):**

1. Voice card generator backend `/api/voicecard/generate` — NOTE: CLAUDE.md says it's now live with a daily cron; v15 §11 still listed it open. May already be closed pre-overnight.
2. Desktop Insight panel paste-in (`docs/proposals/desktop-insight-panel.jsx`)
3. Apple Developer enrollment (overdue since 5/7)
4. Anthropic credit top-up + auto-reload
5. TestFlight build + native auth (gated on Apple Dev)
6. Desktop "synced from phone" badge in `signal/src/app.jsx`
7. Remaining hardening: ErrorBoundary extension, loading skeletons, offline messaging, test suite
8. Wolf-moment samples per craft (safe data-file form, no UI; UI wiring needs DPG decision)
9. B7/B9/B10/B11/B14/B15 backlog items
10. Pulse rhythm refactor (~2 hrs)
11. Password reset UI, Stripe, beta tester recruitment, legacy retirement

---

## New work since handoff

Commits in past 24h not mapped to any v15 §11 open item — **undocumented progress the next handoff must capture:**

**signal repo (6 commits):**
- `d691bc2` ops: add `scripts/deploy-prod.sh` + refresh stale deploy docs (`CLAUDE.md`, `DEPLOYMENT_RULES.md`)
- `14d4e72` fix(admin): replace hardcoded `checkMetricsAuth` fallback with `isCronAuthorized`
- `cc6a217` fix(calendar): require JWT auth + HMAC-signed OAuth state
- `d90af70` fix(crons): drop `onboarding_complete` filter; rely on real eligibility (touches `augment-observations.js`, `refresh-voicecards.js`)
- `00f1305` feat(push): wire iOS push notifications for day-3 + day-7 activations (new `api/_push.js`)
- `0e7c6a5` fix(pulse): scope JWT-authed pulses to the verified user

**signal-ios repo (7 commits):**
- `483b255` OTA: `fallbackToCacheTimeout=0` + `checkAutomatically=ON_LOAD` (v15 mentioned these flags; now confirmed in `app.json`)
- `d54e62d` Login: remember recent emails for quick account switching (`lib/knownEmails.ts`)
- `e30076e` Library: Archived view + restore + Delete moved out of active library
- `c01c3de` Studio: rebuild as the index (fixes Tasks lockout)
- `aef0547` docs: refresh `CLAUDE.md` to match shipped state; update `.gitignore`
- `a084b79` Polish batch — voice-card copy, count reconciliation, vestigial flag, pull-to-refresh
- `9954cd7` Login: forgot-password link on the password fallback signin screen

---

## Anomalies

- **`/api/ai` POST health check:** curl is blocked in this sandbox (host allowlist). Used Vercel MCP instead. GET to `/api/ai` returned **405 Method Not Allowed** — endpoint exists and is reachable, POST required. Backend appears up.
- **`/api/activation?dry_run=1`:** Returned **401 Unauthorized** — expected, as the endpoint requires `CRON_SECRET`. Auth guard is working. Cannot verify `"ok":true` body without the secret.
- **`00f1305` push wiring vs v15 §11:** v15 §11 and CLAUDE.md both note the push backend sender was missing. This commit may close it, but v15's "Finding closed at v15 end" section explains push is dormant until a dev/TestFlight build anyway. No urgency.
- **`d90af70` drops `onboarding_complete` filter:** Eligibility logic changed for cron jobs. Worth DPG review to confirm no unintended users start receiving activation nudges.

---

## Needs DPG input

From v15 §12 / §11, still pending DPG action:

1. **Apple Developer enrollment** — blocks TestFlight, native auth, and live push pipeline end-to-end.
2. **Anthropic credit top-up + auto-reload** — billing state unknown; needed before V1 demo cohort.
3. **Wolf-moment samples per craft** — safe data-file form approved in v14, but UI wiring requires fresh DPG decision.
4. **Orphan branch cleanup** (v15 §11): `claude/review-signal-handoff-8p62X`, `claude/crispr-data-iteration-yMpnD` (error-boundary commit `451a3241` still pending PR+merge).
5. **Error-boundary commit `451a3241`** on `claude/crispr-data-iteration-yMpnD` — single-commit PR + merge + branch delete needed.
6. **Copy v15 handoff** to `/Users/dpg/THE MOTHERSHIP/SIGNAL-APP/SIGNAL_HANDOFF_2026-05-15_v15.md` once v15 PR merges.
7. **Verify `d90af70` eligibility change** is intentional (drops `onboarding_complete` filter on crons).
