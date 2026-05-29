# DEPLOYMENT_RULES.md

**Read this before pushing code to `main`.**

This document defines how changes get into the live Signal app. The goal is simple: stop the bug-fix loop. Every regression that hits production is a tax on future work and a risk to the beta launch.

These rules apply to all surfaces — the desktop web app, the marketing site, the iOS app, the Android app — and to all contributors, including AI agents (Claude, Claude Code, Gemini, etc.) acting on the codebase.

---

## The core rule

**No code reaches `main` without being tested first.**

That's it. Everything below is how to follow that rule without slowing down.

---

## Three required behaviors

### 1. Smoke test before every push to `main`

Before running `git push`, take 60 seconds to verify the app still works:

```bash
npm run dev
# Open http://localhost:5173
# Click through: Library → Capture (type something) → Studio → Insight
# If any of those break → back the change out, do NOT push a fix on top
```

If you cannot run the app locally for any reason, the change does not go to `main`. Period.

### 2. Risky changes go on a branch first

Anything in this list goes on a branch, gets tested, then merges:

- Database schema or RLS changes
- Refactors that touch more than one file
- Changes to data flow (how the frontend reads or writes Supabase)
- Changes to auth, workspace handling, or project switching
- Anything that modifies a working feature you didn't write yourself
- Anything where the AI agent says "this should work" but hasn't actually run it

Branch workflow:

```bash
# Start from a clean main
git checkout main && git pull

# Create the branch
git checkout -b fix/short-description
#   Use prefixes: fix/, feature/, experiment/

# Make the change. Test locally with npm run dev.
# Commit on the branch.
git add -A && git commit -m "what you did"
git push origin fix/short-description

# At this point, Vercel automatically builds a preview URL.
# Find it in the Vercel dashboard or in the GitHub PR.
# It looks like: signal-multi-git-fix-short-description-dpgormans-projects.vercel.app
# Open it. Verify the change works in production-equivalent conditions.

# If preview works:
git checkout main
git merge fix/short-description
git push origin main

# If preview fails:
git checkout main
git branch -D fix/short-description    # local delete
git push origin --delete fix/short-description    # remote delete
# No harm done. main is untouched.
```

### 3. Verify the live deployment after every push to `main`

**Deploy model (as of 2026-05-29):** canonical `signal-multi.vercel.app` is **MANUAL-deploy via `scripts/deploy-prod.sh`**. The Vercel project is linked but intentionally not GitHub-auto-deploy connected — pushing to `main` does NOT update the live API. The script wraps `vercel --prod` with the safety checks `vercel --prod` alone doesn't do (see the script header for details — it refuses to deploy if local diverges from origin/main, working tree is dirty, or you're not on main).

A separate Vercel project `signal` continues to auto-deploy this repo's `main` to `signal-navy-five.vercel.app`. That URL is NOT the API the iOS app / Telegram cron / production traffic hits — those all hit `signal-multi.vercel.app`. Treat signal-navy-five as a build-canary: if it deploys cleanly, the code at least compiles, but the only deploy that matters for users is the manual one below.

After pushing to `main`:

```bash
cd ~/MOTHERSHIP/SIGNAL/desktop
./scripts/deploy-prod.sh                 # walks you through git-sync + vercel --prod
# Wait ~30s for the build, then:
curl -s -o /dev/null -w '%{http_code}\n' https://signal-multi.vercel.app/api/health
# Expect 200
# Open https://signal-multi.vercel.app in incognito (⌘+Shift+N) and re-run the smoke test from §1.
# If it broke in production but worked locally → revert immediately:
git revert HEAD
git push
./scripts/deploy-prod.sh                 # redeploy the revert so production catches up
```

**Critical:** `git push` alone does NOT update production. Every backend change needs the script run as a separate step. Forgetting this is how stale code stays live indefinitely — see the 2026-05-29 incident where 5 backend commits sat on `main` for 24+ hours before anyone noticed they hadn't deployed.

---

## Things that should never happen on `main` directly

- "Quick fix" commits without local testing
- Committing files you haven't read (e.g. AI-generated changes you didn't review)
- Force-pushing (`git push --force`) — this rewrites history and breaks everyone's clones
- Committing while the app is broken locally and "hoping prod is different"
- Committing credentials, `.env` files, or anything matching the patterns in `.gitignore`

If any of these happen by accident, revert immediately:

```bash
git revert HEAD && git push
```

---

## Recovery: if main breaks

There is a permanent baseline tag at `v1.0-baseline` representing the known-good state on April 30, 2026.

To return to it:

```bash
git checkout v1.0-baseline
# This puts you in "detached HEAD" — you're looking at the past.
# To reset main back to this point (destructive, only if main is unrecoverable):
git checkout main
git reset --hard v1.0-baseline
git push --force-with-lease    # only if absolutely necessary
```

Future stable points should get their own tags: `v1.1`, `v1.2`, etc. Tag liberally — they cost nothing and save time.

---

## For AI agents working on this codebase

If you are Claude, Claude Code, or another AI agent making changes here:

1. **Read this document first.** Confirm you understand the rules before making any changes.
2. **Do not push directly to main.** Branch all non-trivial changes.
3. **Do not declare a task "done" until the smoke test passes.** "The code should work" is not the same as "the code works."
4. **If you make a change that breaks something:** revert it. Do not pile fixes on top.
5. **If you do not know what a change might affect:** ask, don't guess.

---

## Why this exists

Between February and April 2026, a stretch of ~20 commits showed a repeating pattern: ship → break → fix → break → fix. Connection queries leaked data twice. A `priorityEngine.js` had wrong field names that silently broke conflict detection. A refactor was reverted. Credentials got committed and removed. None of these were caught before deploy because nobody ran the app first.

The rules in this document exist because beta testers are coming, and beta testers do not tolerate regressions. Every minute spent following these rules saves an hour of unwinding a broken deploy with users watching.

---

*Last updated: 2026-05-29 — added `scripts/deploy-prod.sh` wrapper; corrected stale claim about signal-navy-five being on pre-migration code (it auto-deploys current main, but isn't the user-facing API); added the "git push doesn't deploy production" critical note after the 2026-05-29 stale-code incident.*

*Prior: 2026-05-12 — refreshed backend URL (signal-multi), deploy model (manual `vercel --prod`), and old-project parked status.*
