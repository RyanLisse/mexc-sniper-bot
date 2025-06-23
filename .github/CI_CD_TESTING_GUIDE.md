# CI/CD Testing & Validation Guide

This guide covers how to test, validate, and monitor the CI/CD pipeline for the MEXC Sniper Bot project.

## 🚀 Quick Testing Commands

### Local Validation
```bash
# Run all local CI checks (recommended before commits)
bun run ci:local

# Check individual components
bun run ci:quality          # Lint, format, and type checks
bun run ci:build-check      # Verify build works
bun run test:smoke          # Run smoke tests
```

### CI/CD Pipeline Status
```bash
# Check current pipeline status
bun run ci:status

# View recent workflow runs
bun run ci:runs

# View logs for latest run
bun run ci:logs

# List configured secrets
bun run ci:secrets
```

## 🔧 Setup Validation

### 1. Initial Setup Verification
```bash
# Verify GitHub CLI is authenticated
gh auth status

# Check repository access
gh repo view

# Verify workflow files are valid
ls -la .github/workflows/
```

### 2. Secrets Configuration Test
```bash
# Setup secrets interactively
bun run ci:setup

# Or setup from environment file
cp .env.secrets.template .env.secrets
# Edit .env.secrets with your values
bun run ci:setup-from-env

# Verify secrets are configured
bun run ci:secrets
```

### 3. Environment Validation
```bash
# Trigger environment health check
bun run ci:validate

# Check validation results
bun run ci:status | grep "Environment Validation"
```

## 🧪 Testing Scenarios

### Scenario 1: New Feature Development
```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes and validate locally
bun run ci:local

# 3. Commit and push
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# 4. Create PR and verify CI runs
gh pr create --title "New Feature" --body "Description"
bun run ci:status
```

### Scenario 2: Production Deployment
```bash
# 1. Merge PR to main
gh pr merge --merge

# 2. Monitor deployment
bun run deploy:status

# 3. Check production health
bun run ci:validate
```

### Scenario 3: Security Monitoring
```bash
# 1. Trigger security scan
bun run ci:security

# 2. Check for vulnerabilities
bun run ci:status | grep "Security"

# 3. Review security alerts
gh run list --workflow="security.yml" --limit 3
```

### Scenario 4: Release Management
```bash
# 1. Create release
git tag v1.0.0
git push origin v1.0.0

# 2. Monitor release pipeline
bun run release:list

# 3. Check latest release
bun run release:latest
```

## 🔍 Troubleshooting Guide

### Common Issues & Solutions

#### 1. CI Pipeline Failures

**Linting/Format Errors:**
```bash
# Fix automatically
bun run ci:quality-fix

# Check what was fixed
git diff

# Commit fixes
git add . && git commit -m "fix: resolve linting issues"
```

**Build Failures:**
```bash
# Check build locally
bun run ci:build-check

# Common fixes
bun install            # Update dependencies
bun run type-check     # Check TypeScript errors
```

**Test Failures:**
```bash
# Run tests with verbose output
bun run test:unit --reporter=verbose

# Run specific test file
bun run test tests/unit/specific-test.test.ts

# Update snapshots if needed
bun run test:unit --update-snapshots
```

#### 2. Deployment Issues

**Missing Secrets:**
```bash
# Check which secrets are configured
bun run ci:secrets

# Add missing secrets
bun run ci:setup

# Validate configuration
bun run ci:validate
```

**Vercel Deployment Failures:**
```bash
# Check deployment status
bun run deploy:status

# View deployment logs
gh run view --log <run-id>

# Check Vercel environment variables
vercel env ls
```

#### 3. Security Scan Failures

**Dependency Vulnerabilities:**
```bash
# Check vulnerabilities
bun audit

# Update vulnerable packages
bun update

# Force update if needed
bun add package@latest
```

**Secret Leaks Detected:**
```bash
# Review detected secrets
gh run view --log <security-run-id>

# Remove secrets from git history
git filter-branch --index-filter 'git rm --cached --ignore-unmatch path/to/secret/file'

# Update secrets
bun run ci:setup
```

### Emergency Procedures

#### 1. Production Rollback
```bash
# Emergency rollback
bun run deploy:rollback

# Monitor rollback status
bun run deploy:status

# Verify application health
curl https://mexcsniper.com/api/health
```

#### 2. Security Incident Response
```bash
# Disable compromised API keys immediately
bun run ci:setup

# Trigger security scan
bun run ci:security

# Review all recent deployments
bun run deploy:status
```

## 📊 Monitoring & Metrics

### Pipeline Health Dashboard
```bash
# Overall CI/CD health
bun run ci:status

# Recent activity
bun run ci:runs

# Deployment history
bun run deploy:status
```

### Key Metrics to Monitor

1. **Build Success Rate**
   ```bash
   gh run list --workflow="ci.yml" --limit 10 --json conclusion | jq '[.[] | .conclusion] | group_by(.) | map({status: .[0], count: length})'
   ```

2. **Deployment Frequency**
   ```bash
   gh run list --workflow="deploy.yml" --limit 20 --json createdAt,conclusion
   ```

3. **Security Scan Results**
   ```bash
   gh run list --workflow="security.yml" --limit 5 --json name,conclusion,url
   ```

## 🔄 Continuous Improvement

### Weekly Reviews
```bash
# Generate weekly CI/CD report
echo "=== Weekly CI/CD Report ===" > ci-report.md
echo "Build Success Rate:" >> ci-report.md
gh run list --workflow="ci.yml" --limit 50 --json conclusion | jq '[.[] | .conclusion] | group_by(.) | map({status: .[0], count: length})' >> ci-report.md

echo "Deployment Summary:" >> ci-report.md
gh run list --workflow="deploy.yml" --limit 20 --json conclusion,createdAt >> ci-report.md

echo "Security Issues:" >> ci-report.md
gh run list --workflow="security.yml" --limit 10 --json conclusion,name >> ci-report.md
```

### Performance Optimization
```bash
# Check build times
gh run list --workflow="ci.yml" --limit 10 --json updatedAt,createdAt,name | jq '.[] | {name: .name, duration: (.updatedAt | fromdateiso8601) - (.createdAt | fromdateiso8601)}'

# Identify slow tests
bun run test:perf

# Review bundle size changes
bun run analyze
```

## 🎯 Best Practices

### Before Pushing Code
1. **Always run local validation:**
   ```bash
   bun run ci:local
   ```

2. **Check for secrets:**
   ```bash
   git diff --cached | grep -i -E "(api_key|secret|password|token)"
   ```

3. **Verify commit message format:**
   ```bash
   # Use conventional commits
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve bug in component"
   git commit -m "docs: update API documentation"
   ```

### During Development
1. **Monitor CI status regularly:**
   ```bash
   bun run ci:status
   ```

2. **Fix failing tests immediately:**
   ```bash
   bun run test:unit --watch
   ```

3. **Keep dependencies updated:**
   ```bash
   bun update && bun audit
   ```

### Production Releases
1. **Full validation before release:**
   ```bash
   bun run ci:validate
   bun run test:e2e
   bun run ci:security
   ```

2. **Monitor deployment:**
   ```bash
   bun run deploy:status
   ```

3. **Verify production health:**
   ```bash
   curl https://mexcsniper.com/api/health
   ```

## 📞 Support & Escalation

### Issue Resolution Flow
1. **Check logs:** `bun run ci:logs`
2. **Review documentation:** Check this guide and main CI/CD docs
3. **Search existing issues:** `gh issue list --label "ci-cd"`
4. **Create new issue:** `gh issue create --title "CI/CD Issue: Description"`

### Emergency Contacts
- **CI/CD Issues:** Create issue with `urgent` label
- **Security Incidents:** Create issue with `security` and `urgent` labels  
- **Production Down:** Create issue with `production` and `urgent` labels

---

## 📚 Additional Resources

- [Main CI/CD Documentation](./CI_CD_DOCUMENTATION.md)
- [Secrets Setup Guide](./SECRETS_SETUP.md)
- [Programmatic Setup Options](./PROGRAMMATIC_SECRETS_SETUP.md)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Vercel Deployment Guide](https://vercel.com/docs)

**Last Updated:** June 23, 2025  
**Version:** 1.0.0