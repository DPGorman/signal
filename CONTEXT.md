# CONTEXT — Signal/desktop
Last updated: 2026-06-05 (from last handoff)

## What this is
Signal desktop web app — Vite + React 18 + Supabase JS. Monolithic `src/app.jsx`. Deploys to `signal-multi.vercel.app` via `vercel --prod`. Repo: `DPGorman/signal`.

## Current status
- **F2 (line-level citations), F4 (server-side filler strip), F11 (per-overlay schemas) all SHIPPED** — commit range `357f5d7`–`e5516a4`, all deployed and health 200.
- **Correct-the-AI SHIPPED** — commit `6acf48e`. Corrections condition analysis via single injection point in `assemble.js`. Binding = "fact accepted, challenge preserved."
- **iOS correct-the-AI** is the immediate next surface (greenfield).

## Next action
Build iOS correct-the-AI — see Signal root CONTEXT.md.

## Open threads
- iOS correct-the-AI (next feature)
- `pulse`/`admin` corrections project-scoping (defer until 2nd project exists)
- Wiki ingest: `SIGNAL_HANDOFF_2026-06-05_v33.md` + correct-the-AI handoff not yet ingested
- Daniel runtime confirm of correct-the-AI desktop feel

## Key pointers
- Repo: `DPGorman/signal`, deploy: `cd desktop && echo y | ./scripts/deploy-prod.sh`
- Conditioning: `desktop/api/_voice/assemble.js` (~line 134)
- Corrections client: `CorrectionBox.jsx`, `TeachingsView.jsx`, `app.jsx`
- DB: Supabase `czgjbblkoyyojnaziyuy` — `corrections` table, migration at `desktop/database/2026-06-04_corrections.sql`
- Tokens: `~/.signal-secrets/tokens.md`
- Previously at `/Users/dpg/MOTHERSHIP/SIGNAL/desktop/` — now `/Users/dpg/Claude/Projects/Signal/desktop/`
