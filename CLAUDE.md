# Signal — Desktop Web Application

## Source of truth
For the latest project-wide state, **read `/Users/dpg/THE MOTHERSHIP/SIGNAL-APP/SIGNAL_HANDOFF_*.md` (highest-versioned file)** first. This CLAUDE.md is the local reference for the desktop sub-project only.

## Overview
Signal is a creative ideation and production management platform for screenwriters and other creative professionals (10 V1 craft overlays). Capture raw creative impulses, get AI analysis via Claude, generate actionable next steps, and track production work.

**Deployed (canonical):** `signal-multi.vercel.app` — manual deploys via `vercel --prod` from `signal/` (linked Vercel project).
**Old deploy (PARKED, still live on pre-migration code):** `signal-navy-five.vercel.app` — auto-deploys from `DPGorman/signal` main. The signal-multi migration commit is on branch `activation-pattern-2026-05-07`, NOT pushed to main, so signal-navy-five remains on old code talking to the old (parked) Supabase project. Don't push that branch to main without thinking about it.
**Database:** Supabase project `czgjbblkoyyojnaziyuy` (signal-multi). 16 tables, RLS enabled on all via `auth.uid()`-indirected policies through `users.auth_id`. NOT `krhidwibweznwakaoxjw` (old project, parked).
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
- `src/app.jsx` — Main application logic (large monolithic file — verify current line count if it matters; ~2K+ in spring, grew significantly with onboarding + OTP work)
- `src/components/views/` — Major view components
- `src/components/OnboardingFlow.jsx` — 4-step onboarding (name → craft → collaborator → canon teach)
- `src/lib/constants.js` — Design tokens, categories, typography
- `src/lib/supabase.js` — Supabase client (points at signal-multi)
- `src/utils/priorityEngine.js` — Priority conflict detection & daily focus
- `src/engine/actions.js` — Shared data loading functions
- `src/hooks/useCheckIn.js` — Daily check-in hook
- `api/` — Vercel serverless endpoints (ai, pulse, calendar, telegram, whatsapp, parse-file, recrawl, plus admin/* and _voice/_calendar helpers)
- `database/` — SQL migrations for Supabase tables

## Key Patterns
- All state managed via React useState in app.jsx
- Supabase is single source of truth
- AI calls go through `/api/ai` server-side proxy (never client-direct to Anthropic)
- All tables have Row-Level Security — users only access their own data (verified via 8 programmatic RLS tests in v9)
- Background connection generation after idea capture
- Design system: dark theme with gold (#E8C547) accent

## Categories
Default screenwriter set (`premise, character, scene, dialogue, arc, production, research, business`). Per voice doc v2.1, categories should evolve to craft-overlay-supplied. The hardcoded list is V1 default.

## Environment Variables (server-side, set in Vercel for signal-multi project)
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server) / publishable key (client)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
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
- `MindMapView.jsx` is 12,000+ lines — performance concern at scale
- Error handling is generic ("success"/"error" notifications)
- Canon teach screen wording in `OnboardingFlow.jsx` step 4 is NOT YET the locked copy ("You technically can skip this for now, but you shouldn't"); needs ~5-min sweep for lock parity with iOS
