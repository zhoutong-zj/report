#!/usr/bin/env bash
# Helper script to stage, commit, and push changes to git
set -e

# 1. Get commit message from argument, or generate default
COMMIT_MSG="$1"

# 2. Check if git repository
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: Not a git repository."
  exit 1
fi

# 3. Check for changes
if [[ -z "$(git status --porcelain)" ]]; then
  echo "Notice: No changes to commit. Working tree clean."
  exit 0
fi

# 4. Stage changes
git add -A

# 5. Default commit message if not provided
if [[ -z "$COMMIT_MSG" ]]; then
  BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
  CHANGED_FILES=$(git diff --cached --name-only | tr '\n' ' ' | head -c 80)
  COMMIT_MSG="chore: update ${CHANGED_FILES}"
fi

# 6. Commit
git commit -m "$COMMIT_MSG"

# 7. Push to current branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "Error: Detached HEAD state. Cannot push automatically."
  exit 1
fi

echo "Pushing to remote origin ${CURRENT_BRANCH}..."
git push origin "$CURRENT_BRANCH" || git push -u origin "$CURRENT_BRANCH"

echo "Successfully committed and pushed to origin/${CURRENT_BRANCH}."
git log -1 --oneline
