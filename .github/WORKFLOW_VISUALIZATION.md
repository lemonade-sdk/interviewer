# 🔄 Git + PR + CI/CD Workflow Visualization

## 📊 The Complete Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                         │
│                   lemonade-sdk/interviewer                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌──────────────────────────────────────────┐
        │          main branch (protected)         │
        │     • Always stable & deployable          │
        │     • Never commit directly               │
        └──────────────────────────────────────────┘
                              │
                   git checkout -b feature/xxx
                              │
                              ▼
        ┌──────────────────────────────────────────┐
        │         feature/your-feature              │
        │     • Your work happens here              │
        │     • Isolated from main                  │
        └──────────────────────────────────────────┘
                              │
                   make changes, test locally
                              │
                              ▼
        ┌──────────────────────────────────────────┐
        │        git add & git commit               │
        │     • Stage your changes                  │
        │     • Write clear commit message          │
        └──────────────────────────────────────────┘
                              │
                   git push origin feature/xxx
                              │
                              ▼
        ┌──────────────────────────────────────────┐
        │       Create Pull Request (PR)            │
        │     • On GitHub web UI or gh CLI          │
        │     • Describe changes                    │
        │     • Request reviewers                   │
        └──────────────────────────────────────────┘
                              │
                              ▼
        ╔══════════════════════════════════════════╗
        ║        CI/CD Workflows Triggered         ║
        ║              AUTOMATICALLY               ║
        ╚══════════════════════════════════════════╝
                              │
        ┌─────────────────────┴──────────────────────┐
        │                                             │
        ▼                                             ▼
┌──────────────────┐                    ┌──────────────────────┐
│   Node.js CI     │                    │    Python CI         │
│  • npm install   │                    │  • pip install       │
│  • lint          │                    │  • black/ruff        │
│  • type check    │                    │  • mypy              │
│  • test          │                    │  • pytest            │
│  • build         │                    │                      │
└──────────────────┘                    └──────────────────────┘
        │                                             │
        ├─────────────────────┬───────────────────────┤
        │                     │                       │
        ▼                     ▼                       ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   CodeQL     │   │  Dependency      │   │  Other Checks    │
│  Security    │   │  Review          │   │  (if any)        │
│  Scanning    │   │                  │   │                  │
└──────────────┘   └──────────────────┘   └──────────────────┘
        │                     │                       │
        └─────────────────────┴───────────────────────┘
                              │
                              ▼
                  ┌───────────────────────┐
                  │  All Checks Complete  │
                  └───────────────────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
            ✅ PASS                    ❌ FAIL
                 │                         │
                 ▼                         ▼
    ┌────────────────────┐    ┌──────────────────────┐
    │  Ready for Review  │    │   Fix Issues         │
    │  • Tag reviewers   │    │   • Click "Details"  │
    │  • Wait for        │    │   • Read logs        │
    │    approval        │    │   • Fix locally      │
    └────────────────────┘    │   • Push again       │
                 │             │   (CI re-runs)       │
                 │             └──────────────────────┘
                 │                         │
                 └──────────┬──────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │    Code Review Phase     │
              │  • Reviewer comments     │
              │  • Request changes       │
              │  • Approve               │
              └──────────────────────────┘
                            │
                    Address feedback
                   (commit, push, repeat)
                            │
                            ▼
              ┌──────────────────────────┐
              │   ✅ Approved + CI Pass  │
              │      Ready to Merge      │
              └──────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │      Merge PR to main    │
              │  • Squash and merge      │
              │  • Merge commit          │
              │  • Rebase and merge      │
              └──────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │         main branch updated          │
        │      (your changes now in main)      │
        └──────────────────────────────────────┘
                            │
                   Delete feature branch
                            │
                            ▼
        ┌──────────────────────────────────────┐
        │    Local Cleanup                     │
        │  git checkout main                   │
        │  git pull origin main                │
        │  git branch -d feature/your-feature  │
        └──────────────────────────────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │   🎉 Done!   │
                    │ Ready for    │
                    │ next feature │
                    └──────────────┘
```

## 🎯 Key Decision Points

### When to Create a Branch?
```
You need to make changes
    ↓
Are you on main?
    ↓
YES → Create feature branch FIRST
NO → Already on feature branch, continue
```

### When to Push?
```
Made changes
    ↓
Changes tested locally?
    ↓
YES → git add, commit, push
NO → Test first! (npm run dev, npm test, etc.)
```

### When to Merge?
```
PR Created
    ↓
CI Passed? → NO → Fix and push again
    ↓
   YES
    ↓
Approved? → NO → Address feedback
    ↓
   YES
    ↓
MERGE! 🎉
```

## 🔍 Parallel Development Flow

```
        main
         │
    ┌────┴────┬──────────┐
    │         │          │
feature-1  feature-2  feature-3
    │         │          │
   PR #1     PR #2      PR #3
    │         │          │
  CI/CD     CI/CD      CI/CD
    │         │          │
  ✅ merge → ✅ merge → ✅ merge
    │         │          │
    └────┬────┴──────────┘
         │
    main (updated)
```

**Note:** Multiple branches can exist simultaneously!

## 📦 What Happens Where?

```
┌─────────────────────────────────────────────────────────┐
│                    Local Machine                        │
│  • git checkout -b                                      │
│  • edit files                                           │
│  • git add                                              │
│  • git commit                                           │
│  • npm run dev (test)                                   │
│  • git push                                             │
└─────────────────────────────────────────────────────────┘
                        │
                        │ git push
                        ▼
┌─────────────────────────────────────────────────────────┐
│                     GitHub.com                          │
│  • Create PR (web UI)                                   │
│  • Code review                                          │
│  • Merge PR                                             │
│  • View history                                         │
└─────────────────────────────────────────────────────────┘
                        │
                        │ triggers
                        ▼
┌─────────────────────────────────────────────────────────┐
│                 GitHub Actions (CI/CD)                  │
│  • Runs on GitHub's servers                             │
│  • Executes workflows (.github/workflows/*.yml)         │
│  • Tests, builds, security scans                        │
│  • Reports results to PR                                │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ Branching Strategies Comparison

### ❌ Working Directly on Main (DON'T DO THIS)
```
main ──●──●──●──●──●──●──●──
       │  │  │  │  │  │  │
       feature changes mixed with fixes
       hard to review
       breaks easily
```

### ✅ Feature Branch Workflow (DO THIS)
```
main ───●────────●────────●───
         \      / \      /
feature-1 ●──●──●   \    /
                feature-2 ●──●──●

Clean, reviewable, isolated
```

## 📈 PR Lifecycle Timeline

```
Day 1:
09:00 - Create feature branch
10:00 - Make changes
11:00 - Test locally
12:00 - Push & create PR
12:05 - CI starts running
12:15 - CI completes ✅
12:20 - Request reviewers

Day 1-2:
      - Wait for review
      - Address feedback
      - Push updates

Day 2:
10:00 - Final approval ✅
10:05 - Merge to main 🎉
10:06 - Feature branch deleted
10:10 - Update local main
```

## 🎓 Common Patterns

### The "Oh No, I Worked on Main" Fix
```
BEFORE:
main ──●──●──● (your uncommitted changes)
        (on main branch)

AFTER:
main ──────────● (clean)
         \
  feature ●──●──● (your changes)
```

**How:**
```bash
git checkout -b feature/my-work  # Creates branch with changes
git checkout main                # Switch back
git reset --hard origin/main     # Reset main to remote
git checkout feature/my-work     # Back to your work
```

### The "Keep My Branch Updated" Pattern
```
main ──●──●──●──●──●
         \         \
  feature ●──●──●──●──●
              (merge main in)
```

**How:**
```bash
git checkout feature/my-work
git fetch origin
git merge origin/main
# or: git rebase origin/main
```

## 💡 Pro Tips

### Small, Focused PRs
```
✅ GOOD:
feature/add-login-button
  • 3 files changed
  • 50 lines
  • Clear purpose

❌ BAD:
feature/massive-refactor
  • 50 files changed
  • 5000 lines
  • Multiple features
```

### Commit Early, Commit Often
```
✅ GOOD:
●──●──●──●──●──●
 10 small commits
 clear history

❌ BAD:
●────────────────●
    1 huge commit
    "fixed everything"
```

### Clear Branch Names
```
✅ GOOD:
feature/user-authentication
fix/database-connection-timeout
refactor/extract-api-client
docs/update-installation-guide

❌ BAD:
temp
asdf
new-stuff
fixes
```

## 🚨 Emergency Procedures

### "I Need to Undo Everything"
```bash
# Reset to remote state (DESTRUCTIVE)
git fetch origin
git reset --hard origin/main
```

### "I Need to Stash Changes"
```bash
# Save changes temporarily
git stash save "my work in progress"

# Do something else (switch branches, etc.)

# Restore changes
git stash pop
```

### "I Need to Cherry-Pick a Commit"
```bash
# Copy a commit from one branch to another
git checkout target-branch
git cherry-pick <commit-hash>
```

## 📚 Further Reading

- **Your Complete Guide:** `.github/YOUR_WORKFLOW_GUIDE.md`
- **Execute Your First PR:** `.github/EXECUTE_YOUR_FIRST_PR.md`
- **CI/CD Quick Start:** `.github/QUICK_START.md`
- **GitHub Flow:** https://guides.github.com/introduction/flow/

---

**Print this out and stick it on your wall!** 📌
