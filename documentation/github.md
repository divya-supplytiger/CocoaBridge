# GitHub

## Cloning the Repo

```bash
git clone https://github.com/SupplyTiger/CocoaBridge.git
cd CocoaBridge
```

---

## Branching Strategy

Never push directly to `main`. All changes go through a feature branch and a pull request.

**Workflow:**

```bash
# 1. Make sure your local main is up to date
git checkout main
git pull origin main

# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make your changes and commit
git add <files>
git commit -m "describe what you changed and why"

# 4. Push your branch to GitHub
git push origin feature/your-feature-name

# 5. Open a Pull Request on GitHub → merge into main
```

Once the PR is merged to `main`, Vercel automatically redeploys the app. There is no separate deploy step.

**Branch naming conventions:**
- New feature: `feature/feature-name`
- Bug fix: `fix/bug-description`
- Documentation: `docs/what-youre-documenting`

---

## Pulling Changes

Before starting any new work, always pull the latest from `main`:

```bash
git checkout main
git pull origin main
```

If you have a branch already in progress and `main` has moved forward:

```bash
git checkout your-branch
git merge main  # or: git rebase main
```

---

## Reverting Changes

### Safe revert (preferred)

If a bad commit has already been pushed and merged, use `git revert` — it creates a new commit that undoes the change without rewriting history:

```bash
git revert <commit-hash>
git push origin main
```

This is the safest option because it doesn't disrupt anyone else who may have pulled the bad code.

### Emergency hard reset

If something is seriously broken and you need to get back to a known good state immediately:

**Last known good commit hash:** `2edf282998b51a08cb52df3873885b8e39c6d4a6`

```bash
# Create a new branch from the known good commit (safer than resetting main)
git checkout 2edf282998b51a08cb52df3873885b8e39c6d4a6
git checkout -b recovery/rollback
git push origin recovery/rollback
# Then open a PR to merge recovery/rollback into main
```

Contact divyamalikverma@gmail.com before doing any hard reset — it is difficult to undo.

---

## Commit Message Tips

- Describe *what changed and why*, not just *what you did*
- Keep the first line under 72 characters
- Examples:
  - `fix: handle null responseDeadline in scoring pipeline`
  - `feat: add orphaned contact detection to contacts list`
  - `chore: update SAM.gov API key in Vercel env`
