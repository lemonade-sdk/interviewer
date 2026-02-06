# 🎯 Your Personal Git + PR + CI/CD Workflow Guide

## 📍 Current Situation

You're working on the `lemonade-sdk/interviewer` repository and have uncommitted changes on the `main` branch. Here's how to properly manage your work with branches, PRs, and CI/CD.

## 🔑 Key Concepts

### Do You Need to Fork?

**NO!** You're already in the main repository (`lemonade-sdk/interviewer`), so you don't need to fork.

- **Forking** = Creating your own copy of someone else's repo to contribute
- **Branching** = Creating a separate line of development within the same repo

**You need BRANCHING, not forking.**

### The Professional Workflow

```
main branch (protected)
    ↓
feature branch (your work)
    ↓
commit changes
    ↓
push to GitHub
    ↓
create Pull Request (PR)
    ↓
CI/CD runs automatically
    ↓
code review & approval
    ↓
merge to main
    ↓
delete feature branch
```

## 🚀 Step-by-Step: Your Current Changes

### Step 1: Create a Feature Branch

Right now, you're on `main` with uncommitted changes. Let's move them to a proper feature branch:

```bash
# Create and switch to a new feature branch
# Use a descriptive name: feature/description or fix/description
git checkout -b feature/dev-environment-fixes

# Verify you're on the new branch
git branch
# You should see: * feature/dev-environment-fixes
```

**Branch Naming Conventions:**
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code improvements
- `docs/description` - Documentation changes
- `test/description` - Test additions/changes

### Step 2: Review Your Changes

```bash
# See what files changed
git status

# See the actual changes
git diff

# For specific files
git diff package.json
```

### Step 3: Stage and Commit Changes

```bash
# Stage specific files (recommended)
git add package.json
git add src/electron_app/main.ts
git add .github/

# OR stage all changes (use carefully)
git add -A

# Commit with a clear message
git commit -m "fix: resolve dev environment module resolution errors

- Modified dev:electron script to compile before running
- Now runs compiled JS instead of source TS with ts-node
- Eliminates MODULE_TYPELESS_PACKAGE_JSON warnings
- Ensures initial compilation completes before Electron starts"
```

**Good Commit Message Format:**
```
<type>: <short summary>

<detailed description>
- bullet point 1
- bullet point 2
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code restructuring
- `docs:` Documentation
- `test:` Tests
- `ci:` CI/CD changes
- `chore:` Maintenance

### Step 4: Push to GitHub

```bash
# Push your branch to GitHub
git push origin feature/dev-environment-fixes

# If this is the first push, Git will set up tracking automatically
```

### Step 5: Create a Pull Request (PR)

#### Option A: Using GitHub CLI (if installed)

```bash
gh pr create --title "Fix: Resolve dev environment module resolution" \
  --body "## Changes
- Fixed dev:electron script to compile TypeScript before running
- Eliminated module resolution errors
- Removed ts-node dependency in dev mode

## Testing
- Ran \`npm run dev\` successfully
- Verified Electron starts without errors
- Confirmed database initialization works

## Related Issues
Fixes #[issue-number]"
```

#### Option B: Using GitHub Web UI

1. Go to: `https://github.com/lemonade-sdk/interviewer`
2. You'll see a banner: "**feature/dev-environment-fixes** had recent pushes"
3. Click **"Compare & pull request"**
4. Fill in the PR template:
   - **Title**: Clear, descriptive (e.g., "Fix: Resolve dev environment module resolution")
   - **Description**: What changed and why
   - **Testing**: How you verified it works
   - **Related Issues**: Link any related issues

5. Click **"Create pull request"**

### Step 6: Watch CI/CD Run Automatically

Once you create the PR, these workflows will run automatically:

✅ **Main CI** - Orchestrates all checks
✅ **Node.js CI** - Linting, type checking, tests, build
✅ **Python CI** - Python linting and tests (if Python changed)
✅ **CodeQL** - Security scanning
✅ **Dependency Review** - Checks for vulnerable dependencies

**Where to Watch:**
- In your PR, scroll down to see "All checks have passed" or "Some checks failed"
- Click "Details" next to any check to see logs
- Go to: `https://github.com/lemonade-sdk/interviewer/actions`

**Typical Run Time:**
- Node.js CI: 2-5 minutes
- Python CI: 1-3 minutes
- CodeQL: 3-7 minutes
- Total: ~5-10 minutes

### Step 7: Address CI Failures (If Any)

If CI fails:

1. **Click "Details"** on the failed check
2. **Read the error logs** (usually near the bottom)
3. **Fix locally**:
   ```bash
   # Make fixes on your branch
   git add <fixed-files>
   git commit -m "fix: address CI lint errors"
   git push origin feature/dev-environment-fixes
   ```
4. **CI re-runs automatically** on new push

### Step 8: Code Review

**Request Reviewers:**
- Add reviewers in the right sidebar
- Tag team members: `@username please review`

**Address Review Comments:**
```bash
# Make requested changes
git add <files>
git commit -m "refactor: apply code review suggestions"
git push origin feature/dev-environment-fixes
```

**Respond to Comments:**
- Click "Reply" or "Add a comment"
- Mark conversations as "Resolved" when done

### Step 9: Merge the PR

Once approved and CI passes:

1. **Click "Merge pull request"**
2. Choose merge type:
   - **Squash and merge** (recommended for clean history)
   - **Merge commit** (preserves all commits)
   - **Rebase and merge** (linear history)
3. **Confirm merge**
4. **Delete the branch** (GitHub will prompt you)

### Step 10: Clean Up Locally

```bash
# Switch back to main
git checkout main

# Pull the merged changes
git pull origin main

# Delete the local feature branch
git branch -d feature/dev-environment-fixes

# Verify it's gone
git branch
```

## 🔄 For Your NEXT Feature

Now that main is updated, start fresh:

```bash
# Make sure you're on main
git checkout main

# Get latest changes
git pull origin main

# Create a new feature branch
git checkout -b feature/new-feature-name

# Make changes, commit, push, create PR
# Repeat steps 3-10
```

## 🛠️ Common Workflows

### Working on Multiple Features

```bash
# Feature 1
git checkout -b feature/feature-1
# work, commit, push, create PR

# Switch to Feature 2 (without waiting for PR to merge)
git checkout main
git checkout -b feature/feature-2
# work, commit, push, create PR

# List all branches
git branch
```

### Updating Your Branch with Latest Main

If `main` gets updated while you're working on your branch:

```bash
# On your feature branch
git checkout feature/your-feature

# Fetch latest from remote
git fetch origin

# Option A: Merge (preserves history)
git merge origin/main

# Option B: Rebase (cleaner, linear history)
git rebase origin/main

# Push updated branch
git push origin feature/your-feature --force-with-lease
```

### Checking Out Someone Else's PR

```bash
# Fetch all branches
git fetch origin

# Check out their branch
git checkout -b their-branch-name origin/their-branch-name

# Test it locally
npm install
npm run dev
```

## 🚨 Important Rules

### Never Work Directly on Main

❌ **Don't do this:**
```bash
git checkout main
# make changes
git commit
git push origin main  # BAD!
```

✅ **Always do this:**
```bash
git checkout main
git checkout -b feature/my-feature
# make changes
git commit
git push origin feature/my-feature
# create PR
```

### Always Pull Before Creating a New Branch

```bash
git checkout main
git pull origin main  # Get latest changes
git checkout -b feature/new-feature
```

### Keep Branches Small and Focused

- ✅ One branch = One feature/fix
- ✅ Aim for < 500 lines changed
- ✅ Complete work in < 1 week
- ❌ Don't create mega-branches with many unrelated changes

## 🧪 Testing Before Push

**Always test locally before pushing:**

```bash
# TypeScript compilation
npm run build

# Linting
npm run lint

# Tests
npm test

# Run the app
npm run dev
```

## 📊 PR Best Practices

### Good PR Title Examples

- ✅ `feat: add voice recording to interview module`
- ✅ `fix: resolve database connection timeout`
- ✅ `refactor: extract interview service logic`
- ✅ `docs: update API documentation for LemonadeClient`

### Good PR Description Template

```markdown
## Summary
Brief description of what this PR does

## Changes
- Change 1
- Change 2
- Change 3

## Testing
- [ ] Tested locally
- [ ] All tests pass
- [ ] Linting passes
- [ ] Manually tested feature X

## Screenshots (if applicable)
[Add screenshots]

## Related Issues
Closes #123
Related to #456
```

## 🔍 Monitoring & Debugging

### Check Workflow Status

```bash
# Using GitHub CLI
gh run list
gh run view [run-id]
gh run watch

# Or visit:
https://github.com/lemonade-sdk/interviewer/actions
```

### Common CI Issues

**Issue: Lint errors**
```bash
# Fix locally
npm run lint -- --fix
git add .
git commit -m "fix: resolve lint errors"
git push
```

**Issue: Type errors**
```bash
# Check types
npx tsc --noEmit

# Fix errors, then
git add .
git commit -m "fix: resolve TypeScript errors"
git push
```

**Issue: Tests failing**
```bash
# Run tests locally
npm test

# See detailed output
npm test -- --verbose

# Fix, then commit and push
```

## 🎓 Learning Resources

### GitHub Flow
- [Understanding GitHub Flow](https://guides.github.com/introduction/flow/)
- [About Pull Requests](https://docs.github.com/en/pull-requests)

### Git Commands
```bash
# See what branch you're on
git branch

# See remote branches
git branch -r

# See all branches
git branch -a

# See commit history
git log --oneline

# See what you changed
git diff

# Undo uncommitted changes
git restore <file>

# Undo last commit (keep changes)
git reset --soft HEAD~1
```

## ✅ Quick Reference Cheat Sheet

```bash
# Start new feature
git checkout main
git pull origin main
git checkout -b feature/feature-name

# Save work
git add .
git commit -m "type: description"
git push origin feature/feature-name

# Create PR
# (Use GitHub web UI or gh CLI)

# Update branch from main
git fetch origin
git merge origin/main

# After PR merged
git checkout main
git pull origin main
git branch -d feature/feature-name
```

## 🆘 Help & Troubleshooting

### "I committed to main by mistake!"

```bash
# Don't push yet! Create a branch from current state
git branch feature/my-changes

# Reset main to remote state
git checkout main
git reset --hard origin/main

# Switch to your feature branch
git checkout feature/my-changes

# Push your feature branch
git push origin feature/my-changes
```

### "I need to undo my last commit"

```bash
# Keep changes, undo commit
git reset --soft HEAD~1

# Discard changes AND commit
git reset --hard HEAD~1

# Undo but keep changes as uncommitted
git reset HEAD~1
```

### "My branch conflicts with main"

```bash
# Update your branch
git fetch origin
git merge origin/main

# Resolve conflicts in files
# Edit files, fix conflicts, then:
git add <resolved-files>
git commit -m "merge: resolve conflicts with main"
git push origin feature/your-branch
```

### "CI is taking too long"

- First PR in a repo takes longer (no cache)
- Subsequent PRs are faster (cached dependencies)
- Check Actions tab to see what's running
- Look for yellow dots = running, green = passed, red = failed

## 🎯 Next Steps

1. ✅ Create your first feature branch with current changes
2. ✅ Push and create a PR
3. ✅ Watch CI run
4. ✅ Merge after approval
5. ✅ Repeat for next feature!

---

**Remember:** This workflow keeps `main` stable, enables code review, and ensures quality through automated testing. Every professional team uses this approach!

Happy coding! 🚀
