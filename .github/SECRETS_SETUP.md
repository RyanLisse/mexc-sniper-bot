# Secrets and Environment Variables Setup

This document outlines all the secrets and environment variables required for the CI/CD pipeline to function properly.

## 🚀 Quick Programmatic Setup

**TL;DR:** Instead of manually entering secrets through GitHub UI, use our automated scripts:

```bash
# Method 1: Interactive setup (recommended)
./.github/scripts/setup-secrets.sh

# Method 2: Batch setup from environment file
cp .env.secrets.template .env.secrets
# Edit .env.secrets with your values
./.github/scripts/setup-secrets-from-env.sh
```

📖 **For detailed programmatic setup options, see:** [PROGRAMMATIC_SECRETS_SETUP.md](./PROGRAMMATIC_SECRETS_SETUP.md)

## 🔐 Required GitHub Secrets

Configure these secrets in your GitHub repository settings under `Settings > Secrets and variables > Actions`.

### Vercel Deployment Secrets

| Secret Name | Description | How to Obtain |
|-------------|-------------|---------------|
| `VERCEL_TOKEN` | Vercel CLI authentication token | 1. Go to [Vercel Account Settings](https://vercel.com/account/tokens)<br>2. Create new token<br>3. Copy the generated token |
| `VERCEL_ORG_ID` | Your Vercel organization/team ID | 1. Run `vercel link` in your project<br>2. Check `.vercel/project.json` for `orgId` |
| `VERCEL_PROJECT_ID` | Your Vercel project ID | 1. Run `vercel link` in your project<br>2. Check `.vercel/project.json` for `projectId` |

### Database & External Services

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `DATABASE_URL` | NeonDB PostgreSQL connection string | Database operations in tests |
| `MEXC_API_KEY` | MEXC Exchange API key | Trading functionality tests |
| `MEXC_SECRET_KEY` | MEXC Exchange secret key | Trading functionality tests |
| `OPENAI_API_KEY` | OpenAI API key for AI services | AI-powered features |
| `REDIS_URL` | Redis connection string | Caching and session management |

### Authentication & Security

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `KINDE_CLIENT_ID` | Kinde authentication client ID | Authentication tests |
| `KINDE_CLIENT_SECRET` | Kinde authentication client secret | Authentication tests |
| `KINDE_ISSUER_URL` | Kinde issuer URL | Authentication tests |
| `NEXTAUTH_SECRET` | NextAuth.js secret for session encryption | Authentication security |

### Monitoring & Analytics

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `CODECOV_TOKEN` | Codecov upload token | Code coverage reporting |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications | Optional: Team notifications |

## 🌍 Environment Variables by Environment

### Development (`.env.local`)
```bash
# Database
DATABASE_URL="postgresql://..."
POSTGRES_PRISMA_URL="postgresql://..."
POSTGRES_URL_NON_POOLING="postgresql://..."

# Authentication
KINDE_CLIENT_ID="your_dev_client_id"
KINDE_CLIENT_SECRET="your_dev_client_secret"
KINDE_ISSUER_URL="https://your-domain.kinde.com"
KINDE_SITE_URL="http://localhost:3008"
KINDE_POST_LOGOUT_REDIRECT_URL="http://localhost:3008"
KINDE_POST_LOGIN_REDIRECT_URL="http://localhost:3008/dashboard"

# Trading APIs
MEXC_API_KEY="your_dev_api_key"
MEXC_SECRET_KEY="your_dev_secret_key"
MEXC_BASE_URL="https://api.mexc.com"

# AI Services
OPENAI_API_KEY="sk-..."

# Cache & Session
REDIS_URL="redis://localhost:6379"

# Security
NEXTAUTH_SECRET="your-development-secret"
NEXTAUTH_URL="http://localhost:3008"

# Feature Flags
NODE_ENV="development"
NEXT_PUBLIC_APP_ENV="development"
DISABLE_TELEMETRY="true"
```

### Staging (Vercel Environment Variables)
```bash
# Database
DATABASE_URL="postgresql://staging-db..."

# Authentication
KINDE_CLIENT_ID="staging_client_id"
KINDE_CLIENT_SECRET="staging_client_secret"
KINDE_SITE_URL="https://staging.mexcsniper.com"
KINDE_POST_LOGOUT_REDIRECT_URL="https://staging.mexcsniper.com"
KINDE_POST_LOGIN_REDIRECT_URL="https://staging.mexcsniper.com/dashboard"

# Trading APIs (Use sandbox/testnet)
MEXC_API_KEY="staging_api_key"
MEXC_SECRET_KEY="staging_secret_key"

# Environment
NODE_ENV="production"
NEXT_PUBLIC_APP_ENV="staging"
```

### Production (Vercel Environment Variables)
```bash
# Database
DATABASE_URL="postgresql://production-db..."

# Authentication
KINDE_CLIENT_ID="production_client_id"
KINDE_CLIENT_SECRET="production_client_secret"
KINDE_SITE_URL="https://mexcsniper.com"
KINDE_POST_LOGOUT_REDIRECT_URL="https://mexcsniper.com"
KINDE_POST_LOGIN_REDIRECT_URL="https://mexcsniper.com/dashboard"

# Trading APIs (Production)
MEXC_API_KEY="production_api_key"
MEXC_SECRET_KEY="production_secret_key"

# Environment
NODE_ENV="production"
NEXT_PUBLIC_APP_ENV="production"
```

## 🚀 Quick Setup Guide

### 1. GitHub Repository Secrets

```bash
# Navigate to your repository on GitHub
# Go to Settings > Secrets and variables > Actions
# Click "New repository secret" for each required secret
```

### 2. Vercel Project Setup

```bash
# Install Vercel CLI
bun add -g vercel@latest

# Link your project
vercel link

# Set environment variables
vercel env add DATABASE_URL production
vercel env add KINDE_CLIENT_ID production
# ... add all other environment variables
```

### 3. Local Development Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your development values
nano .env.local

# Verify setup
bun run dev
```

## 🔍 Verification Checklist

### GitHub Actions
- [ ] All required secrets are configured in GitHub
- [ ] CI pipeline runs without authentication errors
- [ ] Deployment pipeline can access Vercel
- [ ] Security scans can access external services

### Vercel Deployment
- [ ] Environment variables set for all environments
- [ ] Database connections work in staging/production
- [ ] Authentication flows work correctly
- [ ] External API integrations function properly

### Local Development
- [ ] All services start without errors
- [ ] Database migrations run successfully
- [ ] Authentication works locally
- [ ] External APIs are accessible

## 🚨 Security Best Practices

### Secret Rotation
- Rotate API keys every 90 days
- Update database passwords quarterly
- Refresh authentication secrets annually

### Access Control
- Limit GitHub repository access to necessary team members
- Use environment-specific API keys (dev/staging/prod)
- Enable two-factor authentication on all service accounts

### Monitoring
- Set up alerts for failed authentication
- Monitor for unusual API usage patterns
- Track secret usage in application logs

## 🆘 Troubleshooting

### Common Issues

**1. Vercel Deployment Fails**
```bash
# Check if secrets are properly set
vercel env ls

# Verify project linking
vercel link --confirm
```

**2. Authentication Errors in CI**
```bash
# Verify GitHub secrets are set
gh secret list

# Check secret names match exactly (case-sensitive)
```

**3. Database Connection Issues**
```bash
# Test database connection
bun run db:check

# Verify connection string format
echo $DATABASE_URL
```

**4. API Integration Failures**
```bash
# Test API credentials
bun run test:mexc-credentials

# Check API rate limits and permissions
```

## 📞 Support

If you encounter issues with secrets setup:

1. Check the troubleshooting section above
2. Review the GitHub Actions logs for specific error messages
3. Verify all secrets are correctly named (case-sensitive)
4. Ensure all required secrets are set in the correct environment

For additional help, create an issue in the repository with:
- Error messages from CI/CD logs
- Steps you've already tried
- Environment where the issue occurs (dev/staging/prod)