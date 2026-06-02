# Signal Overnight Status — 2026-05-16

**Handoff ref:** v15 (2026-05-15) · §11 punch list · §13 sequencing

---

## Closed since last status

- **Voice card generator backend** (v15 §11 #1) — **possibly closed.** Four commits shipped directly to `/api/voicecard/generate`: `b794c5a` (initial endpoint), `6dd29f8` (v2 generator, overlay-aware + observation-reading), `1573786` (auth fix — audit-miss closure), `bdeb123` (atomic swap via `swap_active_voice_card` RPC). iOS UI was already ready per v15. DPG to verify end-to-end before fully closing.

---

## Still open

**16 items remain open from v15 §11.** Grouped:

- **Pending merge (1):** Error-boundary commit `451a3241` on `claude/crispr-data-iteration-yMpnD` (v15 §11 Newly opened).
- **DPG-side actions (5):** Desktop Insight panel paste-in (`docs/proposals/desktop-insight-panel.jsx`, ~60 sec); Apple Dev enrollment (overdue since 5/7); Anthropic credit top-up + auto-reload; copy v15 to Mac canonical path (`/Users/dpg/THE MOTHERSHIP/SIGNAL-APP/`); delete orphan branches listed in v15 §11; create 2 missing memory files (rules 24 + 27).
- **Gated on Apple Dev (2):** TestFlight build + native auth; push token pipeline (wakes on TestFlight — see v15 §11 finding on Expo Go limitation).
- **Longer-horizon (8):** Desktop "synced from phone" badge; wolf-moment samples per craft (decision pending); B7/B9/B10/B11/B14/B15; hardening pass (error boundaries, skeletons, offline mode, test suite); Pulse rhythm refactor (~2 hrs); `pulse.js` CRON_SECRET hardening + Vercel↔GitHub auto-deploy; password reset, Stripe, beta recruitment, navy-five/Telegram/WhatsApp retirement.

---

## New work since handoff

Very active session — 25 commits across `signal` and `signal-ios` in the past 24 hours, none on `signal-android` or `signal-creatives`. Major new work not on v15 punch list:

| Repo | Hash | Work |
|---|---|---|
| `signal` | `e6aa2e8` | db: add `ai_observations` table (private AI knowledge layer) |
| `signal` | `119edc7` | feat: ai_observations writer — studio + high-signal capture |
| `signal` | `bf07274` | voice: overlays.js second-pass refresh for all 10 crafts |
| `signal` | `305b933` | voice: add classify mode (gate before craft analysis) |
| `signal` | `4fa5d6d`…`bac75a3` | refactor: app.jsx split — waves 1–5 complete (5 commits) |
| `signal` | `bf81d34` | feat: classifier integration (v2.3 §2.5) — desktop two-step capture |
| `signal` | `31e4a0f` | feat: desktop LibraryView filters by `kind=project_material` |
| `signal` | `8a30ca5` | fix: extend CATEGORIES with task/personal_note/unclear |
| `signal` | `1011679` | feat: desktop multi-round clarifying-question UI (v2.3 §2.5 + §2.7) |
| `signal-ios` | `1f275794` | feat: classifier gate in iOS captureIdea (v2.3 §2.5) |
| `signal-ios` | `c474ead4` | feat: iOS capture + library migrated to voice-overlay pattern |
| `signal-ios` | `5b1ce19c` | feat: iOS Insight screen migrated to voice-overlay (mode=studio) |
| `signal-ios` | `a2bd3683` | fix: iOS CATEGORIES extended + library scoped to creative-only |
| `signal-ios` | `39417ddc` | feat: iOS multi-round clarifying-question flow (v2.3 §2.5 + §2.7) |

The `ai_observations` table + multi-round clarifying questions + classifier gate represent significant new capability. Next handoff should document these in infrastructure state and open punch list.

---

## Anomalies

- **HEALTH-LOG YELLOW (9th consecutive):** Chronic/benign. Both `signal-multi` and `signal-navy-five` return HTTP 403 (sub-second, 0.32s / 0.75s) — Vercel Deployment Protection, not an outage. Latest deploy `dpl_3UNfxpX9k4ni3CzU6UgFefDmLzdF` READY (commit `1011679`). 0 runtime errors. Not actionable.
- **`/api/ai` check inconclusive from sandbox:** Curl blocked (403 host-not-allowlisted). Vercel MCP GET returned 405 (Method Not Allowed — expected; endpoint is POST-only). Server is running. `/api/activation?dry_run=1` returned 401 (CRON_SECRET required even for dry_run). Previous health agent confirmed 200 OK at 2026-05-15T11:05:47Z. No evidence of outage.
- **MCP transient 502:** First attempt at `/api/activation` via Vercel MCP returned 502 from Cloudflare on `api.anthropic.com` (MCP infrastructure error, not the Signal backend). Retry succeeded with 401.
- **`signal` model flipflop:** `a9c6fce` reverted opus-4-6 back to sonnet-4-6 same session it was migrated (cost decision). Current state: sonnet-4-6.

---

## Needs DPG input

1. **Verify voice card generator end-to-end** — 4 backend commits landed; iOS UI was already ready. One test from the app confirms close.
2. **Apple Developer enrollment** — overdue since 5/7; blocks TestFlight, push pipeline, native auth.
3. **Anthropic credit top-up** — state unknown; Opus 4.6 now active if voice card backend calls it. Check billing dashboard before V1 demo.
4. **Desktop Insight panel** (`docs/proposals/desktop-insight-panel.jsx`) — ~60 sec paste-in; still sitting.
5. **Error-boundary PR** — `451a3241` on `claude/crispr-data-iteration-yMpnD`. Single commit, small PR, merge + delete.
6. **DPG admin tasks** — copy v15 to Mac, delete listed orphan branches, create 2 missing memory files (v15 §17.C commands ready).
7. **Wolf-moment samples** — still awaiting DPG decision on safe form (craft-keyed data file, no onboarding UI).
