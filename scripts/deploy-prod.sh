#!/usr/bin/env bash
# scripts/deploy-prod.sh — safe production deploy for signal-multi.
#
# Why this exists: `vercel --prod` deploys the LOCAL working tree, not
# whatever is on origin/main. If commits arrived on origin/main from
# anywhere else (a co-author, a remote agent, an automated job), running
# `vercel --prod` from a stale local tree silently ships old code as
# "production." This script forecloses that mistake by:
#
#   1. Fetching + checking that local main is in sync with origin/main
#      (refuses to deploy if they diverge, or fast-forwards if local is behind).
#   2. Refusing to deploy with uncommitted changes in the working tree
#      (you'd be shipping unversioned code that can't be re-traced).
#   3. Refusing to deploy from a non-main branch.
#   4. Showing the commit that's about to ship and asking once for confirmation.
#   5. Running `vercel --prod --yes` and reporting the resulting deploy URL.
#
# This is the manual deploy model documented in DEPLOYMENT_RULES.md.
# signal-multi is intentionally NOT GitHub-auto-deploy connected;
# every production push goes through this script.

set -euo pipefail

# ── Sanity: run from the repo root ──────────────────────────────────────
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$REPO_ROOT" || ! -f "$REPO_ROOT/vercel.json" ]]; then
  echo "✗ Run this from inside the signal repo (need vercel.json at root)." >&2
  exit 1
fi
cd "$REPO_ROOT"

# ── Branch check ────────────────────────────────────────────────────────
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "main" ]]; then
  echo "✗ On branch '$BRANCH', not main. Deploy from main only." >&2
  echo "  (If this is intentional, run \`vercel --prod\` directly and accept the consequences.)" >&2
  exit 1
fi

# ── Working tree must be clean (excluding node_modules) ─────────────────
# node_modules/.package-lock.json is checked-in legacy state that npm
# rewrites on every install — we don't want that noise to block a deploy.
if ! git diff --quiet -- ':!node_modules' || ! git diff --cached --quiet -- ':!node_modules'; then
  echo "✗ Working tree has uncommitted changes. Commit or stash before deploying." >&2
  git status --short -- ':!node_modules' >&2
  exit 1
fi

# ── Sync with origin/main ───────────────────────────────────────────────
echo "→ fetching origin..."
git fetch origin main --quiet

LOCAL="$(git rev-parse main)"
REMOTE="$(git rev-parse origin/main)"
BASE="$(git merge-base main origin/main)"

if [[ "$LOCAL" == "$REMOTE" ]]; then
  echo "✓ local main == origin/main"
elif [[ "$LOCAL" == "$BASE" ]]; then
  echo "→ local main is behind origin/main; fast-forwarding..."
  git merge --ff-only origin/main
elif [[ "$REMOTE" == "$BASE" ]]; then
  echo "✗ local main is AHEAD of origin/main by $(git rev-list --count origin/main..main) commit(s)." >&2
  echo "  Push first (\`git push origin main\`) so the deploy reflects what's on GitHub." >&2
  exit 1
else
  echo "✗ local main and origin/main have DIVERGED. Resolve manually before deploying." >&2
  exit 1
fi

# ── Show what's about to ship ───────────────────────────────────────────
SHA="$(git rev-parse --short HEAD)"
SUBJECT="$(git log -1 --format=%s HEAD)"
echo ""
echo "  HEAD: $SHA  $SUBJECT"
echo ""

read -r -p "Deploy this to signal-multi.vercel.app? [y/N] " ANSWER
if [[ "$ANSWER" != "y" && "$ANSWER" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# ── Deploy ──────────────────────────────────────────────────────────────
echo "→ vercel --prod --yes ..."
vercel --prod --yes

echo ""
echo "✓ deploy submitted. Verify with:"
echo "    curl -s -o /dev/null -w '%{http_code}\\n' https://signal-multi.vercel.app/api/health"
echo "  (expect 200)"
echo ""
echo "Then smoke-test signal-multi.vercel.app per DEPLOYMENT_RULES.md §3."
