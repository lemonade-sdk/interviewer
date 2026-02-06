# 🚀 Quick Start: CI/CD Setup

## ⚡ 5-Minute Setup

### Step 1: Update Your Repository (2 minutes)

1. **Replace placeholder username** in these files:
   - `README.md` - Change `YOUR-USERNAME` to your GitHub username
   - `.github/dependabot.yml` - Change `your-github-username` to your GitHub username

2. **Commit and push**:
   ```bash
   git add .
   git commit -m "ci: setup CI/CD infrastructure"
   git push origin main
   ```

### Step 2: Enable GitHub Pages (1 minute)

1. Go to **Settings** → **Pages**
2. Under **Source**, select **"GitHub Actions"**
3. Click **Save**

### Step 3: Configure Branch Protection (2 minutes)

1. Go to **Settings** → **Branches**
2. Click **Add rule**
3. Branch name pattern: `main`
4. Enable:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
     - Search and add: `Python CI`, `Node.js CI`, `CodeQL`
   - ✅ Require conversation resolution before merging
5. Click **Create** or **Save changes**

### That's it! 🎉

Your CI/CD is now fully operational!

## 🧪 Test Your Setup

### Create a Test PR

```bash
# Create a test branch
git checkout -b test/ci-setup

# Make a small change
echo "# CI/CD Test" >> test-file.md

# Commit and push
git add test-file.md
git commit -m "test: verify CI/CD setup"
git push origin test/ci-setup
```

### Create PR on GitHub

1. Go to your repository
2. Click **Pull requests** → **New pull request**
3. Select `test/ci-setup` branch
4. Click **Create pull request**

### Watch CI in Action

You should see these checks running:
- ✅ Main CI
- ✅ Python CI (if Python files changed)
- ✅ Node.js CI (if JS/TS files changed)
- ✅ CodeQL Security
- ✅ Dependency Review

## 📊 What Happens Now?

### On Every Pull Request
- Automatic linting and formatting checks
- Type checking (MyPy, TypeScript)
- Test execution with coverage
- Security scanning (CodeQL)
- Dependency vulnerability checks

### On Merge to Main
- All CI checks run again
- Documentation deploys to GitHub Pages
- Main branch stays stable

### On Version Tag (e.g., v1.0.0)
- Electron app builds for Linux, Windows, macOS
- GitHub Release created automatically
- Installers uploaded as release assets

### Every Monday at 9 AM
- Dependabot checks for updates
- Creates PRs for outdated dependencies
- Includes security patches

## 🔍 Monitoring Your CI/CD

### Check Workflow Status

**Actions Tab**: `https://github.com/YOUR-USERNAME/ai-interviewer/actions`
- View all workflow runs
- Check logs for failures
- Re-run failed jobs

**Security Tab**: `https://github.com/YOUR-USERNAME/ai-interviewer/security`
- View CodeQL alerts
- Check Dependabot alerts
- Security advisories

**Pull Request Checks**:
- Inline check status
- Click "Details" for logs
- Green checkmarks = passing

## 💡 Pro Tips

### Local Testing Before Push

**Python:**
```bash
black --check lemonade_api/
ruff check lemonade_api/
mypy lemonade_api/
pytest
```

**Node.js:**
```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

### Speed Up CI

- Use `[skip ci]` in commit message to skip workflows
- CI automatically skips based on file paths
- Caching speeds up subsequent runs

### Release a New Version

```bash
# Update version in package.json and pyproject.toml
# Then:
git tag v1.0.0
git push origin v1.0.0
# Watch the magic happen in Actions tab!
```

## 📚 Learn More

- **[Full CI/CD Documentation](.github/CI_CD_DOCUMENTATION.md)** - Complete guide
- **[Workflow Reference](.github/workflows/README.md)** - Technical details
- **[Implementation Summary](.github/CI_CD_IMPLEMENTATION_SUMMARY.md)** - What was built

## 🆘 Troubleshooting

### CI Not Running?
- Check if `.github/workflows/` files are in main branch
- Verify YAML syntax (no tabs, proper indentation)
- Check Actions tab for error messages

### Tests Failing?
- Run tests locally first
- Check test logs in Actions tab
- Ensure all dependencies are installed

### Build Failing?
- Check for TypeScript errors: `npx tsc --noEmit`
- Verify all imports are correct
- Check for missing dependencies

### Need Help?
- Check workflow logs in Actions tab
- Review error messages carefully
- Consult documentation files
- Open an issue with `ci/cd` label

## ✅ Verification Checklist

After setup, verify:

- [ ] README badges show workflow status
- [ ] GitHub Pages enabled and docs deploy
- [ ] Branch protection rules configured
- [ ] Test PR triggers CI workflows
- [ ] All checks pass on test PR
- [ ] Dependabot PRs appear (after first Monday)
- [ ] Security tab shows CodeQL results
- [ ] Actions tab shows workflow history

## 🎯 Next Steps

1. **Customize workflows** as needed for your project
2. **Add more tests** to improve coverage
3. **Configure secrets** for advanced features (Codecov, code signing)
4. **Review Dependabot PRs** weekly
5. **Monitor CI execution times** and optimize if needed

---

**You're all set!** Your project now has enterprise-grade CI/CD. Happy coding! 🚀
