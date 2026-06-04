# Signal — Desktop Web Application

## Source of truth
For the latest project-wide state, **read `/Users/dpg/MOTHERSHIP/signal/docs/SIGNAL_HANDOFF_*.md` (highest-versioned file)** first. This CLAUDE.md is the local reference for the desktop sub-project only.

## Overview
Signal is a creative ideation and production management platform for screenwriters and other creative professionals (10 V1 craft overlays). Capture raw creative impulses, get AI analysis via Claude, generate actionable next steps, and track production work.

**Deployed (canonical):** `signal-multi.vercel.app` — **MANUAL** deploys via `./scripts/deploy-prod.sh` from `signal/desktop/`. The Vercel project is linked but intentionally not GitHub-auto-deploy connected; `git push` alone does NOT update production. The script handles git-sync + safety checks; see `DEPLOYMENT_RULES.md` §3 and the script header for details.
**Sibling deploy:** `signal-navy-five.vercel.app` — auto-deploys this repo's `main` to a separate Vercel project (`signal`). Same code as signal-multi (NOT pre-migration code, despite older notes), but it's a build-canary, NOT the user-facing API. iOS / Telegram cron / production traffic all hit `signal-multi.vercel.app`.
**Database:** Supabase project `czgjbblkoyyojnaziyuy` (signal-multi). 17 tables, RLS enabled on all via `auth.uid()`-indirected policies through `users.auth_id` (verified 2026-06-01 — every table has 1 policy except `ai_observations`, which is RLS-on with 0 policies, i.e. default-deny / server-role-only access). NOT `krhidwibweznwakaoxjw` (old project, parked).
**AI:** Anthropic Claude via `/api/ai` proxy (service-role key bypasses RLS).

## Tech Stack
- **Frontend:** React 18 + Vite
- **Backend:** Vercel serverless functions (api/)
- **Database:** Supabase (auth + PostgreSQL + RLS)
- **AI:** Claude Sonnet (4.5/4.6) via Anthropic API
- **Integrations:** Google Calendar OAuth (live, no-calendar path verified, with-calendar path needs Daniel OAuth-connect), Telegram + WhatsApp bots (capture-only since `2cbcae0` — possibly retiring)

## Auth model
- **Primary:** Email → 6-digit OTP code → signed in (matches iOS surface)
- **Fallback:** Email + password under "Use a password instead"
- **Deferred until Apple Dev clearance:** Apple, Google, Passkey

## Project Structure
- `src/app.jsx` — Main application logic (~1,926 lines as of 2026-06-01; major screens already extracted to `src/components/views/`, the remaining shell still slated for further componentization)
- `src/components/views/` — Major view components
- `src/components/OnboardingFlow.jsx` — 4-step onboarding (name → craft → collaborator → canon teach)
- `src/lib/constants.js` — Design tokens, categories, typography (single source of truth; app.jsx imports from here)
- `src/lib/supabase.js` — Supabase client (points at signal-multi)
- `src/global.css` — Global CSS (fonts, scrollbars, body resets, keyframes)
- `src/utils/priorityEngine.js` — Priority conflict detection & daily focus
- `src/engine/actions.js` — `loadProjectData(uid)` helper. Currently NOT wired into app.jsx (which inlines an equivalent). Pre-built for the app.jsx split.
- `src/hooks/useCheckIn.js` — Daily check-in hook
- `api/_supabase.js` — Shared service-role Supabase client (used by all server endpoints)
- `api/_anthropic.js` — Shared `callClaude({ system, messages, maxTokens, model, betas })`. Default model is Sonnet 4.6; `HIGH_QUALITY_MODEL` exported for callers that need Opus (e.g. voicecard).
- `api/_auth.js` — `isCronAuthorized` / `getAuthedUser` / `isWebhookAuthorized` endpoint auth helpers
- `api/` — Vercel serverless endpoints (ai, pulse, calendar, telegram, whatsapp, parse-file, recrawl, voicecard/generate, activation, admin/metrics, plus _voice/_calendar internal helpers)
- `database/` — SQL migrations for Supabase tables

## Key Patterns
- All state managed via React useState in app.jsx
- Supabase is single source of truth
- AI calls go through `/api/ai` server-side proxy (never client-direct to Anthropic). All server AI calls route through `api/_anthropic.js` `callClaude()`.
- All tables have Row-Level Security — users only access their own data (verified via 8 programmatic RLS tests in v9)
- Background connection generation after idea capture
- Design system: dark theme with gold (#E8C547) accent

## Endpoint auth (added 2026-05-16)
- **User-session endpoints** (e.g. `/api/parse-file`): require `Authorization: Bearer <Supabase JWT>`. Frontend grabs the JWT via `supabase.auth.getSession()`.
- **Cron endpoints** (`/api/activation`, `/api/recrawl`): require `Authorization: Bearer <CRON_SECRET>`. Vercel cron sets this header automatically when `CRON_SECRET` is set in project env.
- **Mixed-auth endpoint** (`/api/pulse`): accepts either CRON_SECRET (for internal hops from activation.js + telegram.js) OR a user JWT (for the frontend "Pulse" button).
- **Webhook endpoints** (`/api/whatsapp`): gated by `?key=<WHATSAPP_WEBHOOK_SECRET>` query param. Fail-OPEN until that env var is set (preserves legacy behavior).
- `/api/ai`, `/api/voicecard/generate`, `/api/calendar`, `/api/admin/metrics`, `/api/telegram` — auth posture documented per-file; see source.

## Categories
Default screenwriter set (`premise, character, scene, dialogue, arc, production, research, business`). Per voice doc v2.1, categories should evolve to craft-overlay-supplied. The hardcoded list is V1 default.

## Environment Variables (server-side, set in Vercel for signal-multi project)
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (server) / publishable key (client, hardcoded in `src/lib/supabase.js`)
- `CRON_SECRET` — required by `/api/activation`, `/api/recrawl`, and the cron path of `/api/pulse`. Vercel cron auto-includes it as `Authorization: Bearer <value>`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `WHATSAPP_WEBHOOK_SECRET` — optional. When set, `/api/whatsapp` requires `?key=<value>` (Twilio webhook URL must include it). Until set, whatsapp endpoint fail-opens.
- Pull locally via `vercel env pull` (project must be linked)

## Development
```bash
npm run dev    # Vite dev server (http://localhost:5173)
npm run build  # Production build
vercel --prod  # Manual deploy to signal-multi.vercel.app
```

## Branch state (as of 2026-05-12)
- `activation-pattern-2026-05-07` has unpushed commits: `fd9fd9b` (signal-multi migration) + `b018cce` (OTP login)
- These are NOT yet on main. Pushing them to main causes the old signal-navy-five.vercel.app to redeploy on new code.

## Known Issues / Refinement Areas
- `app.jsx` is large — candidate for componentization (long-deferred)
- No test suite (no Jest/Vitest)
- WhatsApp integration is capture-only stub
- No pagination on large idea lists
- `MindMapView.jsx` "Remap" / `mapAllConnections` is **one** batch server call (`/api/connections/generate` → a single Haiku 4.5 call, maxTokens 4000) — NOT the old serial per-idea loop, so it's fast at small N (≈seconds at 44 ideas). The real scaling limit is one-shot pairwise reasoning quality + the 4000-token output cap truncating connections past a few hundred ideas — not client-side lag. (Corrected 2026-06-04; the prior "serial for…await lags past 50" note described removed code.) Map now auto-catches-up on open (once per project per session, silent) so the user never presses a button.
- Error handling is generic ("success"/"error" notifications)
- Canon teach screen wording in `OnboardingFlow.jsx` step 4 is NOT YET the locked copy ("You technically can skip this for now, but you shouldn't"); needs ~5-min sweep for lock parity with iOS
