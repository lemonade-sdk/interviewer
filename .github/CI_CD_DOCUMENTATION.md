# CI/CD Documentation

## Overview

This project uses a comprehensive GitHub Actions-based CI/CD pipeline to ensure code quality, security, and automated deployment across multiple platforms.

## Status Badges

Add these badges to your README.md:

```markdown
[![Main CI](https://github.com/YOUR-USERNAME/ai-interviewer/actions/workflows/main-ci.yml/badge.svg)](https://github.com/YOUR-USERNAME/ai-interviewer/actions/workflows/main-ci.yml)
[![Python CI](https://github.com/YOUR-USERNAME/ai-interviewer/actions/workflows/python-ci.yml/badge.svg)](https://github.com/YOUR-USERNAME/ai-interviewer/actions/workflows/python-ci.yml)
[![Node.js CI](https://github.com/YOUR-USERNAME/ai-interviewer/actions/workflows/nodejs-ci.yml/badge.svg)](https://github.com/YOUR-USERNAME/ai-interviewer/actions/workflows/nodejs-ci.yml)
[![CodeQL](https://github.com/YOUR-USERNAME/ai-interviewer/actions/workflows/codeql-security.yml/badge.svg)](https://github.com/YOUR-USERNAME/ai-interviewer/actions/workflows/codeql-security.yml)
[![Documentation](https://github.com/YOUR-USERNAME/ai-interviewer/actions/workflows/docs-deploy.yml/badge.svg)](https://github.com/YOUR-USERNAME/ai-interviewer/actions/workflows/docs-deploy.yml)
```

**Replace `YOUR-USERNAME` with your actual GitHub username or organization name.**

## Workflows

### 1. Main CI (`main-ci.yml`)

**Trigger:** Push to `main`/`develop`, Pull Requests  
**Purpose:** Orchestrates all CI checks

**Features:**
- Smart path filtering (only runs affected workflows)
- Coordinates Python and Node.js CI
- Verifies all checks pass before allowing merge

**Matrix Strategy:**
- Detects file changes
- Runs only relevant workflows

### 2. Python CI (`python-ci.yml`)

**Trigger:** Changes to `lemonade_api/**`, `pyproject.toml`  
**Purpose:** Ensures Python code quality

**Jobs:**
- **Lint & Type Check**
  - Black formatter validation
  - Ruff linting
  - MyPy type checking
  - Runs on Python 3.9, 3.10, 3.11, 3.12

- **Test**
  - pytest with coverage reporting
  - Coverage upload to Codecov
  - Multi-version testing

- **Package Check**
  - Validates package can be built
  - Checks package metadata with twine

**Dependencies Cached:** pip packages

### 3. Node.js CI (`nodejs-ci.yml`)

**Trigger:** Changes to `src/**`, `package.json`, TypeScript configs  
**Purpose:** Ensures TypeScript/React code quality

**Jobs:**
- **Lint & Type Check**
  - ESLint validation
  - TypeScript compilation check

- **Test**
  - Jest test execution
  - Cross-platform testing (Ubuntu, Windows, macOS)
  - Multi-version Node.js (18, 20)
  - Coverage reporting

- **Build**
  - Vite build verification
  - Artifact upload for inspection

**Dependencies Cached:** npm packages

### 4. CodeQL Security (`codeql-security.yml`)

**Trigger:** 
- Push to `main`/`develop`
- Pull Requests
- Weekly schedule (Monday midnight UTC)
- Manual dispatch

**Purpose:** Automated security vulnerability scanning

**Languages Analyzed:**
- JavaScript/TypeScript
- Python

**Features:**
- Security and quality queries
- Automated vulnerability detection
- Integration with GitHub Security tab

### 5. Documentation Deployment (`docs-deploy.yml`)

**Trigger:** Push to `main` (docs changes), Manual dispatch  
**Purpose:** Deploy MkDocs documentation to GitHub Pages

**Jobs:**
- Build documentation with MkDocs Material theme
- Deploy to GitHub Pages
- Automatic URL generation

**Requirements:**
- Enable GitHub Pages in repository settings
- Set source to "GitHub Actions"

### 6. Electron Release (`electron-release.yml`)

**Trigger:** Version tags (`v*.*.*`), Manual dispatch  
**Purpose:** Build and release desktop application

**Matrix Builds:**
- **Linux:** AppImage, deb, rpm
- **Windows:** exe, msi
- **macOS:** dmg, zip

**Features:**
- Multi-platform builds
- Automated GitHub Release creation
- Release notes generation
- Code signing support (configure secrets)

**Artifacts:** All platform-specific installers

### 7. Dependency Review (`dependency-review.yml`)

**Trigger:** Pull Requests  
**Purpose:** Review dependency changes for security

**Features:**
- Scans for vulnerable dependencies
- Fails on moderate+ severity issues
- Posts summary in PR comments

### 8. Dependabot (`dependabot.yml`)

**Schedule:** Weekly (Monday 9:00 AM)  
**Purpose:** Automated dependency updates

**Monitors:**
- npm packages
- pip packages
- GitHub Actions versions

**Features:**
- Grouped updates (production vs development)
- Automatic PR creation
- Configurable reviewers and labels

## Setup Instructions

### 1. Enable GitHub Pages

1. Go to **Settings** → **Pages**
2. Set **Source** to "GitHub Actions"
3. Save changes

### 2. Add Repository Secrets (Optional)

For enhanced functionality, add these secrets in **Settings** → **Secrets and variables** → **Actions**:

- `CODECOV_TOKEN`: For code coverage reporting (get from codecov.io)
- `MAC_CERT`: macOS code signing certificate (for production releases)
- `MAC_CERT_PASSWORD`: Certificate password

### 3. Configure Dependabot

Edit `.github/dependabot.yml` and replace `your-github-username` with your actual username.

### 4. Branch Protection Rules (Recommended)

Configure in **Settings** → **Branches** → **Branch protection rules**:

For `main` branch:
- ✅ Require pull request reviews
- ✅ Require status checks to pass
  - Select: Python CI, Node.js CI, CodeQL
- ✅ Require branches to be up to date
- ✅ Require conversation resolution before merging

### 5. Update README Badges

Copy the status badges from the top of this document to your `README.md` and replace `YOUR-USERNAME`.

## Development Workflow

### Pull Request Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and commit**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

3. **Push and create PR**
   ```bash
   git push origin feature/my-feature
   ```

4. **Automated checks run:**
   - Path filtering determines which workflows run
   - Linting, type checking, tests execute
   - Security scans analyze code
   - Dependency review checks new packages

5. **Review results:**
   - All checks must pass (green ✓)
   - Fix any issues reported
   - Request code review

6. **Merge to main:**
   - Upon merge, documentation deploys automatically
   - Main branch remains stable

### Release Workflow

1. **Update version** in `package.json` and `pyproject.toml`

2. **Create and push tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. **Automated release:**
   - Electron builds for all platforms
   - GitHub Release created automatically
   - Installers attached to release

## Maintenance

### Updating Workflows

- Workflow files in `.github/workflows/`
- Use GitHub's workflow editor for syntax validation
- Test changes in a separate branch first

### Monitoring

- **Actions tab:** View all workflow runs
- **Security tab:** CodeQL alerts
- **Pull Requests:** Automated check status
- **Insights → Dependency graph:** Dependabot PRs

### Troubleshooting

**Tests failing?**
- Check test logs in Actions tab
- Run tests locally: `npm test` or `pytest`

**Build failing?**
- Verify dependencies are installed
- Check for TypeScript compilation errors
- Review ESLint/Black formatting

**CodeQL alerts?**
- Review in Security tab
- Fix vulnerabilities before merging
- May require dependency updates

## Performance Optimization

### Caching Strategy

All workflows use dependency caching:
- **npm:** `~/.npm` cached by Node.js action
- **pip:** Cached by Python action
- **Actions:** GitHub Actions cache

### Concurrent Runs

- Multiple PRs can run simultaneously
- `concurrency` groups prevent duplicate documentation deploys
- Matrix builds run in parallel

### Cost Management

- Smart path filtering reduces unnecessary runs
- `continue-on-error` for non-critical checks
- Artifact retention: 7 days (configurable)

## Best Practices

1. **Keep workflows fast:** Target <10 minutes per workflow
2. **Use caching:** All dependency installations cached
3. **Fail fast:** Use `fail-fast: false` in matrices to see all failures
4. **Security first:** CodeQL and dependency review on all PRs
5. **Semantic versioning:** Use conventional commits for releases
6. **Test locally:** Run linters/tests before pushing
7. **Monitor costs:** GitHub provides 2000 free minutes/month for public repos

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Electron Builder](https://www.electron.build/)
- [MkDocs Material](https://squidfunk.github.io/mkdocs-material/)
- [CodeQL](https://codeql.github.com/docs/)
- [Dependabot](https://docs.github.com/en/code-security/dependabot)

## Support

For issues with CI/CD:
1. Check workflow logs in Actions tab
2. Review this documentation
3. Consult GitHub Actions documentation
4. Open an issue with `ci/cd` label
