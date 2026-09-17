---
name: git-commit-push
description: >-
  Automates staging, committing, and pushing code changes to Git remote repository.
  Use this skill whenever the user requests to commit and push changes, directly
  submit work to Git ("直接提交到git", "提交并推送", "提交代码到远程", "git commit and push",
  or "auto commit").
---

# Git Commit & Push Workflow

This skill instructs the agent on how to reliably inspect, stage, commit, and push changes to the remote Git repository with meaningful commit messages and proper safety checks.

## Workflow Steps

### 1. Inspect Status & Changes
Before staging, verify the current working directory state:
```bash
git status -s
git diff --stat
```
Check what branch is currently active:
```bash
git branch --show-current
```

### 2. Safety Checks
Ensure unwanted or sensitive files are NOT accidentally committed:
- Sensitive secrets: `.env`, private keys (`*.pem`, `*.key`), credentials.
- Temporary / OS files: `.DS_Store`, `Thumbs.db`, editor swap files.
- Build artifacts / large logs / cache directories if not already in `.gitignore`.
If any unwanted file is detected in untracked status, add it to `.gitignore` first.

### 3. Determine Commit Message
- **User-specified**: If the user specified a commit message in their prompt, use it.
- **Auto-generated**: Otherwise, analyze the modified files and compose a clear [Conventional Commit](https://www.conventionalcommits.org/) message:
  - `feat: <summary>` for new features or capabilities
  - `fix: <summary>` for bug fixes
  - `refactor: <summary>` for code refactoring without behavior change
  - `style: <summary>` for CSS/styling/formatting adjustments
  - `docs: <summary>` for documentation updates
  - `chore: <summary>` for build scripts, configs, or minor maintenance

### 4. Stage, Commit, and Push

#### Method A: Direct Command Execution (Recommended for customized control)
```bash
# Stage changes
git add -A

# Commit with descriptive message
git commit -m "<type>: <concise description>"

# Push to current branch on remote
CURRENT_BRANCH=$(git branch --show-current)
git push origin "$CURRENT_BRANCH" || git push -u origin "$CURRENT_BRANCH"
```

#### Method B: Using the Helper Script
The skill includes a pre-configured helper script:
```bash
.agents/skills/git-commit-push/scripts/git_commit_push.sh "<optional commit message>"
```

### 5. Verification & Feedback
Verify that the commit and push completed successfully:
```bash
git log -1 --stat
git status -s
```
Report the following details back to the user:
1. Committed commit hash & message
2. Branch pushed to (e.g. `origin/main`)
3. List of changed/created files committed
