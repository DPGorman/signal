# Signal — Web Application

## Overview
Signal is a creative ideation and production management platform for screenwriters, showrunners, and creative professionals. Capture raw creative impulses, get AI analysis via Claude, generate actionable next steps, and track production work.

**Deployed:** Vercel (signal-navy-five.vercel.app)
**Database:** Supabase PostgreSQL with RLS
**AI:** Anthropic Claude via `/api/ai` proxy

## Tech Stack
- **Frontend:** React 18.2 + Vite 5
- **Backend:** Vercel serverless functions (api/)
- **Database:** Supabase (auth + PostgreSQL + RLS)
- **AI:** Claude Sonnet via Anthropic API
- **Integrations:** Google Calendar OAuth, Telegram Bot, WhatsApp (stub)

## Project Structure
- `src/app.jsx` — Main application logic (~2,168 lines, core state + all features)
- `src/components/views/` — 9 major view components (Capture, Dashboard, Library, MindMap, Deliverables, Tasks, Canon, Compose, Calendar)
- `src/lib/constants.js` — Design tokens, categories, typography
- `src/lib/supabase.js` — Supabase client
- `src/utils/priorityEngine.js` — Priority conflict detection & daily focus
- `src/engine/actions.js` — Shared data loading functions
- `src/hooks/useCheckIn.js` — Daily check-in hook
- `api/` — 7 Vercel serverless endpoints (ai, pulse, calendar, telegram, whatsapp, parse-file, recrawl)
- `database/` — SQL migrations for Supabase tables

## Key Patterns
- All state managed via React useState in app.jsx
- Supabase is single source of truth
- AI calls go through `/api/ai` server-side proxy (never client-direct to Anthropic)
- All tables have Row-Level Security — users only access their own data
- Background connection generation after idea capture
- Design system: dark theme with gold (#E8C547) accent

## 8 Idea Categories
premise, character, scene, dialogue, arc, production, research, business

## Environment Variables (server-side)
- ANTHROPIC_API_KEY
- SUPABASE_URL, SUPABASE_ANON_KEY (also in client)
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

## Development
```bash
npm run dev    # Vite dev server
npm run build  # Production build
```

## Known Issues / Refinement Areas
- app.jsx is 2,168 lines — candidate for componentization
- No test suite (no Jest/Vitest)
- WhatsApp integration is a placeholder
- No pagination on large idea lists
- MindMapView.jsx is 12,000+ lines — performance concern at scale
- Error handling is generic ("success"/"error" notifications)
- No README or developer documentation
