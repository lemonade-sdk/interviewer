# GitHub Actions Workflows

This directory contains all CI/CD workflow definitions for the AI Interviewer project.

## Quick Reference

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **Main CI** | `main-ci.yml` | PR, Push | Orchestrates all CI checks |
| **Python CI** | `python-ci.yml` | Python changes | Lint, type-check, test Python code |
| **Node.js CI** | `nodejs-ci.yml` | JS/TS changes | Lint, type-check, test Node.js code |
| **CodeQL** | `codeql-security.yml` | PR, Push, Schedule | Security vulnerability scanning |
| **Docs Deploy** | `docs-deploy.yml` | Main push | Deploy documentation to GitHub Pages |
| **Electron Release** | `electron-release.yml` | Version tags | Build & release desktop app |
| **Dependency Review** | `dependency-review.yml` | PR | Review dependency security |

## Workflow Architecture

```
┌─────────────────────────────────────────────────────┐
│                     main-ci.yml                     │
│              (Orchestrator Workflow)                │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐                 │
│  │Path Filtering│→│  Dispatch   │                  │
│  └─────────────┘  └─────────────┘                  │
└───────────┬──────────────┬───────────────────────┘
            │              │
            ↓              ↓
    ┌──────────────┐  ┌──────────────┐
    │ python-ci.yml│  │nodejs-ci.yml │
    │              │  │              │
    │ • Black      │  │ • ESLint     │
    │ • Ruff       │  │ • TypeScript │
    │ • MyPy       │  │ • Jest       │
    │ • pytest     │  │ • Build      │
    └──────────────┘  └──────────────┘

    ┌──────────────────────────────────┐
    │      codeql-security.yml         │
    │   (Runs independently on PR)     │
    └──────────────────────────────────┘

    ┌──────────────────────────────────┐
    │      dependency-review.yml       │
    │   (Runs on PR dependency changes)│
    └──────────────────────────────────┘
```

## Path Filtering

Workflows are triggered intelligently based on file changes:

- **Python CI:** Triggered by changes to:
  - `lemonade_api/**`
  - `pyproject.toml`
  - `requirements.txt`
  - `.github/workflows/python-ci.yml`

- **Node.js CI:** Triggered by changes to:
  - `src/**`
  - `package.json`
  - `package-lock.json`
  - `tsconfig.json`
  - `.github/workflows/nodejs-ci.yml`

- **Docs Deploy:** Triggered by changes to:
  - `lemonade_api/docs/**`
  - `lemonade_api/mkdocs.yml`
  - `.github/workflows/docs-deploy.yml`

## Matrix Strategies

### Python CI
```yaml
strategy:
  matrix:
    python-version: ['3.9', '3.10', '3.11', '3.12']
```
Tests across 4 Python versions to ensure compatibility.

### Node.js CI
```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node-version: ['18', '20']
```
Tests across 3 operating systems and 2 Node.js versions (6 total combinations).

### Electron Release
```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
```
Builds native installers for all three major platforms.

## Caching Strategy

All workflows implement intelligent dependency caching:

### Python
```yaml
- uses: actions/setup-python@v5
  with:
    python-version: ${{ matrix.python-version }}
    cache: 'pip'
```

### Node.js
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

This reduces CI runtime by 60-80% after the first run.

## Security Features

1. **CodeQL Analysis**
   - Runs on every PR and push
   - Weekly scheduled scans
   - Detects security vulnerabilities
   - Integrates with GitHub Security tab

2. **Dependency Review**
   - Scans all PR dependency changes
   - Fails on moderate+ severity vulnerabilities
   - Posts detailed report in PR comments

3. **Dependabot**
   - Weekly automated dependency updates
   - Grouped by dependency type
   - Automatic security patch PRs

## Adding a New Workflow

1. Create `.github/workflows/your-workflow.yml`
2. Use this template:

```yaml
name: Your Workflow Name

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  your-job:
    name: Job Name
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Your step
        run: echo "Your command"
```

3. Test in a feature branch
4. Add to this README
5. Update `main-ci.yml` if needed

## Workflow Debugging

### View Logs
1. Go to **Actions** tab
2. Click on workflow run
3. Click on specific job
4. Expand step to see detailed logs

### Re-run Failed Jobs
1. Open failed workflow run
2. Click **Re-run failed jobs**
3. Or **Re-run all jobs** to run everything

### Local Testing

**Python:**
```bash
# Run Python checks locally
black --check lemonade_api/
ruff check lemonade_api/
mypy lemonade_api/
pytest
```

**Node.js:**
```bash
# Run Node.js checks locally
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Workflow Best Practices

✅ **DO:**
- Use specific action versions (`@v4`, not `@main`)
- Implement caching for dependencies
- Use `continue-on-error` for non-critical steps
- Add descriptive step names
- Use matrix strategies for multi-version testing
- Set appropriate timeout values

❌ **DON'T:**
- Hardcode secrets (use GitHub Secrets)
- Use deprecated actions
- Run expensive operations on every commit
- Ignore security warnings
- Store credentials in workflow files

## Cost Management

### Free Tier Limits
- **Public repos:** 2000 minutes/month free
- **Private repos:** Varies by plan

### Optimization Tips
1. Use path filtering to skip unnecessary runs
2. Implement smart caching
3. Use `concurrency` to cancel outdated runs
4. Set appropriate artifact retention (7 days default)
5. Use `if` conditions to skip steps when not needed

### Current Estimated Usage
- Python CI: ~5 minutes × 4 versions = 20 minutes
- Node.js CI: ~8 minutes × 6 combinations = 48 minutes
- CodeQL: ~10 minutes × 2 languages = 20 minutes
- Documentation: ~3 minutes
- **Total per PR:** ~90 minutes

## Monitoring & Alerts

### Setup Notifications
1. Go to **Settings** → **Notifications**
2. Enable workflow notifications
3. Choose email or GitHub notifications

### Status Checks
- View in PR "Checks" tab
- Add required checks in branch protection
- Monitor from repository Actions tab

## Troubleshooting

### Common Issues

**Issue:** Workflow not triggering
- Check path filters match changed files
- Verify branch names in `on:` section
- Check workflow file syntax

**Issue:** Tests failing in CI but passing locally
- Check environment differences
- Verify dependency versions match
- Review CI logs for specifics

**Issue:** Caching not working
- Ensure cache key is consistent
- Check if dependencies changed
- Review cache size limits (10GB max)

**Issue:** Slow workflows
- Implement/optimize caching
- Use path filtering
- Parallelize independent jobs

## Reference Links

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Workflow Syntax](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [Available Actions](https://github.com/marketplace?type=actions)
- [Security Best Practices](https://docs.github.com/en/actions/security-guides)
