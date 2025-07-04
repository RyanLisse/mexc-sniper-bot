# MEXC Sniper Bot - Production Deployment Guide

This comprehensive guide covers deploying the MEXC Sniper Bot with TypeScript multi-agent system to multiple platforms including Vercel (primary) and Railway (alternative), with Supabase as the managed PostgreSQL database and Inngest for workflow orchestration.

## 🚀 Quick Deployment Checklist

- [ ] Create Supabase account and project
- [ ] Set up Supabase production database  
- [ ] Configure Vercel environment variables
- [ ] Install Inngest Vercel integration
- [ ] Deploy to Vercel
- [ ] Verify Inngest function registration
- [ ] Test end-to-end functionality

## 📋 Prerequisites

1. **Vercel Account**: [vercel.com](https://vercel.com)
2. **Supabase Account**: [supabase.com](https://supabase.com)
3. **Inngest Account**: [inngest.com](https://inngest.com)
4. **OpenAI API Key**: [platform.openai.com](https://platform.openai.com)

## 🗄️ Database Setup (Supabase)

**⚠️ Migration Notice**: This guide has been updated to reflect the migration from TursoDB to Supabase. For the most current setup instructions, please refer to the Supabase documentation at [supabase.com/docs](https://supabase.com/docs).

### Setup Steps

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Get your connection string from Settings > Database
4. Configure environment variables (see below)

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

## 🚂 Alternative Deployment: Railway

Railway provides an alternative deployment platform with built-in database support and easier container-based deployments.

### Railway Setup

1. **Create Railway Account**: [railway.app](https://railway.app)

2. **Deploy from GitHub**:
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Initialize project
   railway init
   
   # Link to existing project
   railway link
   ```

3. **Configure Environment Variables**:
   ```bash
   # Set production variables
   railway variables set TURSO_DATABASE_URL="libsql://your-database-url.turso.io"
   railway variables set TURSO_AUTH_TOKEN="your-auth-token"
   railway variables set OPENAI_API_KEY="sk-xxxxx"
   railway variables set NODE_ENV="production"
   ```

4. **Deploy**:
   ```bash
   # Deploy to Railway
   railway up
   
   # Or use GitHub auto-deploy
   git push origin main
   ```

### Railway-Specific Configuration

Create `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Railway Advantages

- **Persistent Containers**: Better for long-running processes
- **Built-in Monitoring**: Comprehensive logs and metrics
- **Easy Rollbacks**: One-click deployment rollbacks
- **Database Add-ons**: Optional PostgreSQL/Redis support
- **Custom Domains**: Free SSL certificates

### Railway + TursoDB Integration

```bash
# Configure TursoDB for Railway
railway variables set DATABASE_PROVIDER="turso"
railway variables set TURSO_DATABASE_URL="libsql://your-db.turso.io"
railway variables set TURSO_AUTH_TOKEN="your-token"

# Deploy with TursoDB
railway up
```

## 🌍 TursoDB Best Practices

### Global Distribution

1. **Choose Strategic Locations**:
   ```bash
   # Create primary database
   turso db create mexc-sniper-prod --location iad1
   
   # Add read replicas
   turso db replicate mexc-sniper-prod sin1  # Singapore
   turso db replicate mexc-sniper-prod fra1  # Frankfurt
   turso db replicate mexc-sniper-prod syd1  # Sydney
   ```

2. **Connection String Configuration**:
   ```typescript
   // Use location hints for optimal routing
   const dbUrl = process.env.TURSO_DATABASE_URL + "?location_hint=auto";
   ```

### Performance Optimization

1. **Connection Pooling**:
   ```typescript
   // drizzle.config.ts
   export default {
     connection: {
       url: process.env.TURSO_DATABASE_URL,
       authToken: process.env.TURSO_AUTH_TOKEN,
       // Enable connection pooling
       maxConnections: 10,
       idleTimeout: 30
     }
   };
   ```

2. **Query Optimization**:
   - Use indexes for frequently queried columns
   - Batch operations when possible
   - Implement query result caching

### Monitoring & Maintenance

1. **Database Metrics**:
   ```bash
   # Check database stats
   turso db show mexc-sniper-prod --stats
   
   # Monitor replication lag
   turso db show mexc-sniper-prod --replicas
   ```

2. **Backup Strategy**:
   ```bash
   # Create backup
   turso db backup create mexc-sniper-prod
   
   # List backups
   turso db backup list mexc-sniper-prod
   
   # Restore from backup
   turso db backup restore mexc-sniper-prod --backup-id <id>
   ```

## 🔐 Security Notes

- Never commit API keys to git
- Use platform environment variables for all secrets
- Rotate API keys regularly
- Enable deployment protection for production
- Use different TursoDB databases for staging/production
- Implement IP allowlisting for database access
- Enable audit logging for compliance

## 📊 Production Monitoring

### Comprehensive Monitoring Stack

1. **Application Monitoring**:
   - Vercel Analytics (automatic)
   - Railway Metrics (built-in)
   - Custom OpenTelemetry integration

2. **Database Monitoring**:
   - TursoDB Dashboard
   - Query performance tracking
   - Replication health checks

3. **Workflow Monitoring**:
   - Inngest Dashboard
   - Function execution logs
   - Error tracking and alerts

4. **AI Agent Monitoring**:
   - Token usage tracking
   - Response time metrics
   - Success rate monitoring

### Alerting Setup

```typescript
// Example alert configuration
const alerts = {
  database: {
    connectionFailure: "critical",
    highLatency: "warning",
    replicationLag: "warning"
  },
  agents: {
    apiFailure: "critical",
    highTokenUsage: "warning",
    lowSuccessRate: "warning"
  },
  trading: {
    executionFailure: "critical",
    priceSlippage: "warning"
  }
};
```