# MEXC Sniper Bot - Production Deployment Guide

This guide covers deploying the MEXC Sniper Bot with TypeScript multi-agent system to Vercel with TursoDB and Inngest.

## 🚀 Quick Deployment Checklist

- [ ] Install Turso CLI and login
- [ ] Set up TursoDB production database  
- [ ] Configure Vercel environment variables
- [ ] Install Inngest Vercel integration
- [ ] Deploy to Vercel
- [ ] Verify Inngest function registration
- [ ] Test end-to-end functionality

## 📋 Prerequisites

1. **Vercel Account**: [vercel.com](https://vercel.com)
2. **TursoDB Account**: [turso.tech](https://turso.tech)
3. **Inngest Account**: [inngest.com](https://inngest.com)
4. **OpenAI API Key**: [platform.openai.com](https://platform.openai.com)

## 🗄️ Database Setup (TursoDB)

### Option 1: Automated Setup (Recommended)

```bash
# Login to TursoDB (opens browser)
turso auth login

# Run automated setup script
./scripts/setup-turso-production.sh
```

### Option 2: Manual Setup

```bash
# Login to TursoDB
turso auth login

# Create production database
turso db create mexc-sniper-bot-prod --location fra1

# Get database URL
turso db show mexc-sniper-bot-prod --url

# Create authentication token
turso db tokens create mexc-sniper-bot-prod

# Run migrations
TURSO_DATABASE_URL="libsql://your-db.turso.io" \
TURSO_AUTH_TOKEN="your-token" \
npm run db:migrate
```

## 🔧 Vercel Configuration

### 1. Environment Variables

Add these variables in your Vercel project dashboard:

**Required Variables:**
```bash
# Database
TURSO_DATABASE_URL=libsql://your-database-url.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# AI Integration
OPENAI_API_KEY=sk-xxxxx

# Application
NODE_ENV=production
ENVIRONMENT=production
```

**Optional Variables:**
```bash
# MEXC Trading (for live trading)
MEXC_API_KEY=mx_xxxxx
MEXC_SECRET_KEY=xxxxx

# Additional AI Providers
ANTHROPIC_API_KEY=sk-ant-xxxxx
PERPLEXITY_API_KEY=pplx-xxxxx
```

See `.env.production.example` for complete list.

### 2. Inngest Integration

1. **Install Inngest Integration:**
   - Go to [Vercel Integrations](https://vercel.com/integrations)
   - Search for "Inngest" and install
   - Connect to your Inngest account
   - Select your project

2. **Verify Integration:**
   - `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` should be automatically added
   - Check in Vercel project → Settings → Environment Variables

## 🚢 Deployment

### 1. Deploy to Vercel

```bash
# Deploy to production
vercel --prod

# Or deploy specific branch
git push origin main  # Auto-deploys if connected to Git
```

### 2. Verify Deployment

```bash
# Check deployment status
vercel ls

# Check function logs (if deployment fails)
vercel logs <deployment-url>
```

## ✅ Post-Deployment Verification

### 1. Test Database Connection

```bash
curl https://your-app.vercel.app/api/mexc/connectivity
```

### 2. Verify Inngest Functions

1. Go to [Inngest Dashboard](https://app.inngest.com)
2. Navigate to your project
3. Verify these functions are registered:
   - `pollMexcCalendar`
   - `watchMexcSymbol` 
   - `analyzeMexcPatterns`
   - `createMexcTradingStrategy`

### 3. Test Multi-Agent Workflows

```bash
# Test calendar polling
curl -X POST https://your-app.vercel.app/api/triggers/calendar-poll

# Test pattern analysis
curl -X POST https://your-app.vercel.app/api/triggers/pattern-analysis

# Test symbol analysis  
curl -X POST https://your-app.vercel.app/api/triggers/symbol-watch \
  -H "Content-Type: application/json" \
  -d '{"vcoinId": "BTC"}'
```

## 🔍 Troubleshooting

### Common Issues

**1. Database Connection Errors**
```bash
# Verify TursoDB credentials
turso db show mexc-sniper-bot-prod
turso db tokens list mexc-sniper-bot-prod
```

**2. Inngest Functions Not Registering**
```bash
# Check if INNGEST_SIGNING_KEY is set
vercel env ls

# Verify endpoint is accessible
curl https://your-app.vercel.app/api/inngest
```

**3. TypeScript Compilation Errors**
```bash
# Run type check locally
npm run type-check

# Check build locally
npm run build
```

**4. Function Timeout Errors**
- Check `vercel.json` function timeout settings
- Increase timeout for complex agent operations
- Consider breaking down large workflows

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=inngest:*
VERCEL_DEBUG=1
```

## 📊 Monitoring

### 1. Vercel Analytics
- Enabled automatically for function performance
- View at: Vercel Dashboard → Your Project → Analytics

### 2. Inngest Monitoring
- Real-time function execution logs
- Error tracking and retry logic
- View at: [Inngest Dashboard](https://app.inngest.com)

### 3. Database Monitoring
- TursoDB provides built-in metrics
- View at: [TursoDB Dashboard](https://app.turso.tech)

## 🔄 Updates & Maintenance

### Updating the Application
```bash
# Deploy updates
git push origin main

# Or manual deploy
vercel --prod
```

### Database Migrations
```bash
# Generate new migration
npm run db:generate

# Apply migration to production
TURSO_DATABASE_URL="your-url" \
TURSO_AUTH_TOKEN="your-token" \
npm run db:migrate
```

### Rotating API Keys
```bash
# Create new TursoDB token
turso db tokens create mexc-sniper-bot-prod

# Update in Vercel dashboard
# Revoke old token
turso db tokens revoke mexc-sniper-bot-prod <old-token>
```

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vercel Edge   │────│  Next.js App     │────│   TursoDB       │
│   Functions     │    │  (TypeScript)    │    │   (SQLite)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Inngest       │────│  Multi-Agent     │────│   MEXC API      │
│   Workflows     │    │  System (GPT-4)  │    │   (REST)        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📞 Support

- **Vercel Issues**: [Vercel Support](https://vercel.com/support)
- **TursoDB Issues**: [TursoDB Discord](https://discord.gg/4B5D7hYwub)
- **Inngest Issues**: [Inngest Discord](https://www.inngest.com/discord)
- **Application Issues**: Check project GitHub issues

## 🔐 Security Notes

- Never commit API keys to git
- Use Vercel environment variables for all secrets
- Rotate API keys regularly
- Enable Vercel Deployment Protection for production
- Use different TursoDB databases for staging/production