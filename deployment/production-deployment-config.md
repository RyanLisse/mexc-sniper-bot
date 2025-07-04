# Production Deployment Configuration

## Executive Summary
Production-ready deployment configuration for MEXC Sniper Bot on Railway with comprehensive monitoring, security hardening, and automated rollback capabilities.

## Production Environment Configuration

### Core Environment Variables (Required)
```bash
# Production Environment
NODE_ENV=production
VERCEL_ENV=production

# Security & Authentication
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ENCRYPTION_MASTER_KEY=your-32-byte-base64-key

# AI Services (Required for core functionality)
OPENAI_API_KEY=sk-your-openai-api-key

# Database
DATABASE_URL=postgresql://user:pass@host:5432/mexc_sniper_production

# Monitoring & Observability
SERVICE_NAME=mexc-trading-bot
SERVICE_VERSION=1.0.0
TRACING_ENABLED=true
METRICS_ENABLED=true
PERFORMANCE_MONITORING_ENABLED=true
```

### Optional Production Enhancements
```bash
# Enhanced AI Capabilities
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
PERPLEXITY_API_KEY=pplx-your-perplexity-key

# Live Trading (Optional)
MEXC_API_KEY=mx_your-mexc-api-key
MEXC_SECRET_KEY=your-mexc-secret-key

# External Monitoring
SENTRY_DSN=https://your-sentry-dsn
VERCEL_ANALYTICS_ID=your-analytics-id

# Cache & Performance
REDIS_URL=redis://your-redis-instance
CACHE_ENABLED=true
CACHE_TTL=300
```

## Security Hardening

### 1. Environment Variable Security
- ✅ Use Vercel environment variables dashboard (never commit secrets)
- ✅ Rotate API keys quarterly
- ✅ Separate keys for development/staging/production
- ✅ Enable ENCRYPTION_MASTER_KEY backup storage

### 2. API Security Headers (Already Configured)
```json
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY", 
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin"
}
```

### 3. Production Build Optimization
```json
{
  "build": {
    "env": {
      "TURBO_CACHE": "1",
      "VERCEL_SKIP_USAGE_INSIGHTS": "1",
      "NEXT_TELEMETRY_DISABLED": "1",
      "NODE_VERSION": "20"
    }
  }
}
```

## Monitoring & Observability

### 1. Health Check Endpoints
- **Primary**: `/api/health` - Comprehensive system health
- **Lightweight**: `HEAD /api/health` - Quick status check
- **Environment**: `/api/health/environment` - Configuration validation

### 2. OpenTelemetry Production Configuration
- **Tracing**: 10% sampling rate in production
- **Metrics**: 30-second export intervals
- **Performance**: Batch processing optimization
- **Security**: Sensitive data masking enabled

### 3. Real-time Monitoring
```typescript
// Automatic health monitoring every 30 seconds
const healthMetrics = {
  system: "healthy|degraded|unhealthy",
  uptime: process.uptime(),
  responseTime: "< 500ms target",
  memoryUsage: "< 80% threshold",
  errorRate: "< 1% threshold"
}
```

## Deployment Pipeline

### 1. Pre-deployment Validation
```bash
# Automated checks before deployment
make production-readiness-check

# Individual validation steps
make lint type-check     # Code quality
make test-unit          # Unit tests
make test-integration   # Integration tests
make build             # Production build
make test-e2e          # End-to-end tests
```

### 2. Deployment Command
```bash
# Deploy to production
make deploy

# Equivalent to: vercel --prod
```

### 3. Post-deployment Verification
```bash
# Verify deployment health
curl https://your-app.vercel.app/api/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2025-07-04T...",
  "uptime": 123.45,
  "responseTime": 45,
  "version": "1.0.0",
  "environment": "production"
}
```

## Performance Monitoring

### 1. Key Performance Indicators (KPIs)
- **Response Time**: < 500ms for 95th percentile
- **Uptime**: > 99.9% availability target
- **Error Rate**: < 1% of total requests
- **Memory Usage**: < 80% of allocated resources

### 2. Automated Alerts
```typescript
// Performance thresholds
const alerts = {
  responseTime: { threshold: 1000, action: "scale_up" },
  errorRate: { threshold: 0.05, action: "investigation" },
  memoryUsage: { threshold: 0.9, action: "restart" },
  diskSpace: { threshold: 0.95, action: "cleanup" }
}
```

### 3. Performance Optimization
- **Bundle Analysis**: `ANALYZE=true bun run build`
- **Tree Shaking**: Optimized imports for production
- **Compression**: Gzip enabled via Vercel
- **CDN**: Static assets served via Vercel Edge Network

## Rollback Procedures

### 1. Automated Rollback Triggers
- Health check failure for > 5 minutes
- Error rate > 5% for > 2 minutes
- Response time > 2000ms for > 3 minutes

### 2. Manual Rollback Process
```bash
# Emergency rollback to previous version
vercel rollback

# Or specific deployment
vercel rollback [deployment-id]

# Verify rollback
curl https://your-app.vercel.app/api/health
```

### 3. Database Rollback Safety
- Database migrations use Neon branching for safety
- Automatic backup before schema changes
- Read-only mode available for emergency situations

## Operational Runbooks

### 1. Daily Operations
```bash
# Morning health check
curl https://your-app.vercel.app/api/health

# Check error logs
vercel logs --since=24h

# Performance metrics review
# Access Vercel Analytics dashboard
```

### 2. Incident Response
1. **Detection**: Automated alerts or manual discovery
2. **Assessment**: Check health endpoints and logs
3. **Mitigation**: Scale, restart, or rollback
4. **Resolution**: Fix root cause
5. **Post-mortem**: Document and improve

### 3. Maintenance Windows
- **Frequency**: Monthly scheduled maintenance
- **Duration**: 15-minute windows
- **Notification**: 24-hour advance notice
- **Rollback Plan**: Always prepared before changes

## Compliance & Security

### 1. Data Protection
- API credentials encrypted at rest
- Sensitive data masked in logs
- Regular security audits scheduled

### 2. Access Control
- Vercel team access with MFA required
- Environment variable access restricted
- Deployment permissions role-based

### 3. Audit Trail
- All deployments logged with timestamps
- Configuration changes tracked
- User access events monitored

## Cost Optimization

### 1. Resource Monitoring
- Function execution time optimization
- Database query performance tracking
- CDN usage optimization

### 2. Scaling Strategy
- Auto-scaling based on traffic patterns
- Resource allocation optimization
- Cost alerts for budget management

## Disaster Recovery

### 1. Backup Strategy
- Database: Automated daily backups
- Code: Git repository redundancy
- Configuration: Environment variable backup

### 2. Recovery Procedures
- RTO (Recovery Time Objective): < 15 minutes
- RPO (Recovery Point Objective): < 1 hour
- Multi-region failover capability

### 3. Business Continuity
- Graceful degradation for non-critical features
- Essential services prioritization
- User communication protocols

## Production Deployment Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] SSL certificates valid
- [ ] Database migrations ready
- [ ] Performance tests passed
- [ ] Security scan completed

### Deployment
- [ ] Production build successful
- [ ] Health checks passing
- [ ] Performance metrics baseline
- [ ] Error monitoring active
- [ ] Rollback plan confirmed

### Post-Deployment
- [ ] End-to-end functionality verified
- [ ] Performance within SLA
- [ ] No error rate spikes
- [ ] User feedback channels monitored
- [ ] Documentation updated

---

**Production Deployment Status**: ✅ READY
**Next Action**: Execute deployment with `make deploy`
**Monitoring Dashboard**: Access via Vercel Analytics
**Emergency Contact**: Operations team on-call rotation