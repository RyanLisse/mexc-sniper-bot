# MEXC Sniper Bot - Vercel Configuration Guide

This document explains the Vercel configuration (`vercel.json`) for the MEXC Sniper Bot project, based on [Vercel's official documentation](https://vercel.com/docs/project-configuration).

## Configuration Overview

Our `vercel.json` is optimized for a TypeScript multi-agent trading system with the following requirements:
- Next.js 15 with App Router
- TypeScript multi-agent workflows (Inngest)
- MEXC API integrations
- Real-time WebSocket connections
- Database operations (SQLite/TursoDB)
- Edge-compatible serverless functions

## Configuration Properties

### Schema Validation
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json"
}
```
Enables IDE autocomplete and validation for the Vercel configuration.

### Build Configuration

#### Commands
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev", 
  "installCommand": "npm install --legacy-peer-deps",
  "framework": "nextjs"
}
```

- **buildCommand**: Runs Next.js production build
- **devCommand**: Starts development server on port 3008
- **installCommand**: Uses `--legacy-peer-deps` to resolve React 19 dependency conflicts
- **framework**: Specifies Next.js for optimized deployment

#### Build Environment
```json
{
  "build": {
    "env": {
      "TURBO_CACHE": "1",
      "VERCEL_SKIP_USAGE_INSIGHTS": "1"
    }
  }
}
```

- **TURBO_CACHE**: Enables Turbopack caching for faster builds
- **VERCEL_SKIP_USAGE_INSIGHTS**: Disables telemetry collection

### Environment Variables
```json
{
  "env": {
    "ENVIRONMENT": "production",
    "NODE_ENV": "production"
  }
}
```

Default environment variables applied to all deployments. Additional variables (API keys, database URLs) are set through Vercel dashboard for security.

### Function Configuration
```json
{
  "functions": {
    "app/api/inngest/route.ts": { "maxDuration": 300 },
    "app/api/triggers/**/route.ts": { "maxDuration": 60 },
    "app/api/mexc/**/route.ts": { "maxDuration": 30 },
    "app/api/auth/**/route.ts": { "maxDuration": 30 }
  }
}
```

Function-specific timeouts optimized for different operations:
- **Inngest workflows**: 5 minutes for complex multi-agent operations
- **Manual triggers**: 1 minute for user-initiated workflows
- **MEXC API calls**: 30 seconds for external API operations
- **Authentication**: 30 seconds for auth operations

### Security Headers
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, PUT, DELETE, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization, X-Requested-With" },
        { "key": "Access-Control-Max-Age", "value": "86400" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

#### API Routes Security
- **CORS**: Configured for API access from web clients
- **Content Security**: Prevents MIME-type sniffing attacks
- **Clickjacking Protection**: Denies iframe embedding
- **XSS Protection**: Enables browser XSS filtering

#### Global Security Headers
```json
{
  "source": "/(.*)",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "X-XSS-Protection", "value": "1; mode=block" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
  ]
}
```

Applied to all routes for comprehensive security coverage.

### URL Management

#### Redirects
```json
{
  "redirects": [
    {
      "source": "/",
      "destination": "/dashboard",
      "permanent": false
    }
  ]
}
```

Redirects root URL to the main dashboard interface.

#### Rewrites
```json
{
  "rewrites": [
    {
      "source": "/health",
      "destination": "/api/mexc/connectivity"
    }
  ]
}
```

Provides a simple health check endpoint for monitoring.

### Scheduled Functions (Cron Jobs)
```json
{
  "crons": [
    {
      "path": "/api/triggers/calendar-poll",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/triggers/pattern-analysis", 
      "schedule": "*/15 * * * *"
    }
  ]
}
```

Automated workflows:
- **Calendar polling**: Every 6 hours to discover new MEXC listings
- **Pattern analysis**: Every 15 minutes for trading signal detection

### Deployment Settings

#### Regional Configuration
```json
{
  "regions": ["fra1"]
}
```

Deployed to Frankfurt (fra1) region for optimal European latency.

#### URL Configuration
```json
{
  "cleanUrls": true,
  "trailingSlash": false,
  "outputFileTracing": false
}
```

- **cleanUrls**: Removes `.html` extensions from URLs
- **trailingSlash**: Enforces no trailing slashes
- **outputFileTracing**: Disabled to reduce bundle size (dependencies managed explicitly)

## Environment Variables (External Configuration)

The following environment variables should be configured in the Vercel dashboard:

### Required
```bash
# Database
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# AI Integration
OPENAI_API_KEY=sk-your-openai-key

# Workflow Orchestration (auto-set by Inngest integration)
INNGEST_SIGNING_KEY=signkey-prod-xxxxx
INNGEST_EVENT_KEY=your-event-key
```

### Optional
```bash
# MEXC Trading API
MEXC_API_KEY=mx_your-api-key
MEXC_SECRET_KEY=your-secret-key

# Additional AI Providers
ANTHROPIC_API_KEY=sk-ant-xxxxx
PERPLEXITY_API_KEY=pplx-xxxxx
```

## Deployment Verification

After deployment, verify configuration:

1. **Function Timeouts**: Check function logs don't show timeout errors
2. **Security Headers**: Inspect network tab for proper headers
3. **Cron Jobs**: Monitor Vercel functions tab for scheduled executions
4. **Redirects**: Test root URL redirects to `/dashboard`
5. **Health Check**: Access `/health` endpoint

## Best Practices Implemented

### Performance
- ✅ Function timeouts optimized per use case
- ✅ Regional deployment for reduced latency
- ✅ Build caching enabled
- ✅ Clean URLs for better SEO

### Security
- ✅ Comprehensive security headers
- ✅ CORS properly configured
- ✅ Environment variables externalized
- ✅ XSS and clickjacking protection

### Maintainability
- ✅ Schema validation for IDE support
- ✅ Clear function organization
- ✅ Documented configuration rationale
- ✅ Automated workflows for consistency

## Troubleshooting

### Common Issues

1. **Function Timeout Errors**
   - Increase `maxDuration` for affected functions
   - Consider breaking down complex operations

2. **CORS Issues**
   - Verify `Access-Control-Allow-Origin` settings
   - Check request headers match allowed headers

3. **Build Failures**
   - Ensure `installCommand` includes `--legacy-peer-deps`
   - Verify all dependencies are compatible

4. **Cron Job Failures**
   - Check function logs in Vercel dashboard
   - Verify endpoint paths are correct

## Related Documentation

- [Vercel Configuration Reference](https://vercel.com/docs/project-configuration)
- [Next.js Deployment](https://vercel.com/docs/frameworks/nextjs)
- [Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [Cron Jobs](https://vercel.com/docs/cron-jobs)

---

*This configuration is optimized for the MEXC Sniper Bot's TypeScript multi-agent architecture and trading system requirements.*