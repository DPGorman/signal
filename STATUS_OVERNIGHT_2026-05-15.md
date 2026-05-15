# Signal Overnight Status — 2026-05-15

**Handoff ref:** v14 (2026-05-13) · §11 punch list · §12 open decisions

---

## Closed since last status

- **§17.D resolved — Session A mystery commits confirmed.** `3fae0e1`, `3ae0aea`, `d390178`, `80e188f` are all present in the `signal/` (desktop) repo: dead-click audit + 7 fixes, TODAY scroll, completed-todo styling. These were Mac-side pushes to the desktop repo, not signal-ios. DPG can close the "locate or clarify" item from §11 new-items.

---

## Still open

**19 items remain open from §11.** Grouped summary:

- **Pending merge (2):** PR #4 (Voice Card + push + drift-audit + docs); error boundary commit `451a3241` on `claude/crispr-data-iteration-yMpnD`.
- **Backend build (1):** Voice card generator `/api/voicecard/generate` in `signal/` (~3 hrs).
- **DPG-side actions (5):** Apply desktop Insight panel (60 sec); Apple Dev enrollment (overdue since 5/7); Anthropic credit top-up + auto-reload; copy v14 to Mac canonical path; create 2 missing memory files (rules 24 + 27); delete orphan branch `claude/review-signal-handoff-8p62X`.
- **Gated on Apple Dev (2):** TestFlight build + native auth; multi-user push activation (also gated on PR #4 merge + a user opening the build).
- **Longer-horizon (9):** Desktop "synced from phone" badge; B7/B9/B10/B11/B14/B15 from v11; hardening pass (error boundaries, skeletons, virtualization, tests); wolf-moment samples per craft; Pulse rhythm refactor (~2 hrs); pulse.js CRON_SECRET + signal-multi Vercel↔GitHub auto-deploy; password reset UI, Stripe, beta recruitment, navy-five + Telegram/WhatsApp retirements.

---

## New work since handoff

Commits in the past 24 hours not mapped to any open punch-list item:

| Repo | Hash | Message |
|---|---|---|
| `signal` | `eded24b` | chore: gitignore .claude/ (session-local Claude Code config) |
| `signal` | `da009dd` | ai: migrate sonnet-4-6 to opus-4-6 (Anthropic retiring sonnet-4-6) |
| `signal-ios` | `2289836f` | ops: harden OTA workflow + add RESUME_SESSION.md runbook (#8) |
| `signal-creatives` | `4740a03` | Hero subhead: add "every idea" + "every to-do" beats |

Notes: the model migration (`da009dd`) is maintenance, not a punch-list item — next handoff should note it. The OTA hardening (`2289836f`) is adjacent to the §11 CI/CD item (`pulse.js CRON_SECRET check; signal-multi Vercel↔GitHub auto-deploy`) but does not close it. `signal-android` had no commits.

---

## Anomalies

- **`curl` blocked by environment network policy** (HTTP 403 "Host not in allowlist") for both `/api/ai` and `/api/activation`. Fell back to Vercel MCP — no data loss.
- **`/api/ai` health test inconclusive.** Vercel MCP GET returned a protection-bypass conflict (409). Endpoint requires POST with JSON body; a GET is expected to fail. Not treated as a service outage. To confirm AI health, use: `curl -s -X POST https://signal-multi.vercel.app/api/ai -H "Content-Type: application/json" -d '{"system":"Reply ping","message":"ping","maxTokens":10}'` from a non-sandboxed shell.
- **`/api/activation?dry_run=1`** → HTTP 200, `{"ok":true,"dry_run":true,"scanned":4,"fired":0,"events":[]}`. Healthy. 4 users scanned, no activations fired (expected — no Day-7 triggers due yet, or push tokens not registered).

---

## Needs DPG input

From §12 open decisions + §11 DPG-side items:

1. **Anthropic credit top-up** (§12.5) — state unknown since v8; needed before V1 demo.
2. **Voice card generator green-light** (§12.6) — ~3 hrs of backend work in `signal/`; agent can build once DPG says go.
3. **Apple Developer enrollment** — overdue since 5/7; blocks TestFlight, native auth (Face ID, Apple Sign In, Google Sign In).
4. **Create 2 missing memory files** (rules 24 + 27) — see §17.C of v14 for exact `cat > ...` commands to run on the Mac.
