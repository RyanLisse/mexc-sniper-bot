# Production Deployment Guide

## 🚀 Complete Production Deployment Workflow

This guide provides step-by-step instructions for deploying the MEXC Sniper Bot to Railway production with comprehensive monitoring and verification.

## 📋 Prerequisites

### Required Environment Variables
- `RAILWAY_PUBLIC_DOMAIN` - Your production deployment URL
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENAI_API_KEY` - OpenAI API key
- `ENCRYPTION_MASTER_KEY` - 32-byte encryption key

### Optional Monitoring Variables
- `SLACK_WEBHOOK_URL` - Slack webhook for alerts
- `ALERT_EMAIL` - Email address for alerts
- `SLACK_CHANNEL` - Slack channel for notifications

## 🔧 Quick Start Commands

### 1. Production Readiness Check
```bash
make production-readiness-check
# or short alias:
make prc
```

### 2. Deploy with Verification
```bash
make deploy-verify
# or short alias:
make dv
```

### 3. Complete Production Workflow
```bash
make workflow-production
```

## 🛠️ Step-by-Step Deployment

### Step 1: Configuration Validation
```bash
make validate-config
# or: make vc
```
Validates all production environment variables and configuration files.

### Step 2: Pre-deployment Testing
```bash
# Run comprehensive readiness check
make production-readiness-check

# Individual test categories (optional)
make test-production-security
make test-production-performance
make test-production-resilience
```

### Step 3: Deploy to Production
```bash
# Option A: Deploy with automatic verification
make deploy-verify

# Option B: Manual deployment + verification
make deploy
make verify-deployment
```

### Step 4: Post-deployment Monitoring
```bash
# Start continuous monitoring
make monitor-production
# or: make mp

# View monitoring dashboard
make monitor-dashboard
# or: make md
```

## 📊 Monitoring and Verification Tools

### Production Verification Script
```bash
# Basic verification
bun run deployment/production-verification.ts --url https://your-app.up.railway.app

# Quick health checks only
bun run deployment/production-verification.ts --quick

# Continuous monitoring mode
bun run deployment/production-verification.ts --continuous
```

### Production Monitoring Agent
```bash
# Start monitoring with custom interval
bun run scripts/production-monitoring.ts --url https://your-app.up.railway.app --interval 60

# Test alert system
bun run scripts/production-monitoring.ts --alert-test

# Generate monitoring report
bun run scripts/production-monitoring.ts --dashboard
```

### Production Readiness Dashboard
```bash
# Interactive dashboard
bun run scripts/production-readiness-dashboard.ts --watch

# Generate readiness report
bun run scripts/production-readiness-dashboard.ts --report

# Show deployment checklist
bun run scripts/production-readiness-dashboard.ts --checklist
```

## 🔍 Health Check Endpoints

After deployment, verify these endpoints are responding:

### Primary Health Checks
- `GET /api/health` - Comprehensive system health
- `HEAD /api/health` - Lightweight health check
- `GET /api/health/environment` - Configuration validation

### Service-Specific Health Checks
- `GET /api/agents/health` - Agent system status
- `GET /api/mexc/connectivity` - MEXC API connectivity
- `GET /api/alerts/system/status` - Alert system status
- `GET /api/websocket/health` - WebSocket service status

## 📈 Monitoring Dashboard

The production monitoring system provides:

### Real-time Metrics
- ✅ System health status
- ⚡ Response time monitoring
- 📊 Performance scores
- 🚨 Active alerts count
- 🔄 Service availability

### Alert Categories
- **Critical**: System failures requiring immediate attention
- **Warning**: Performance degradations to monitor
- **Info**: General system notifications

### Alert Thresholds
- Response Time: > 2000ms
- Error Rate: > 5%
- Health Score: < 70
- Memory Usage: > 85%

## 🚨 Incident Response

### Automated Responses
- **High Response Time**: Scale resources
- **Health Check Failure**: Trigger rollback evaluation
- **Service Error**: Generate incident ticket

### Manual Intervention
```bash
# Check current system status
make verify-deployment

# View detailed monitoring dashboard
make monitor-dashboard

# Generate incident report
bun run scripts/production-monitoring.ts --report
```

### Emergency Rollback
```bash
# Railway rollback to previous deployment
railway rollback

# Or rollback to specific deployment
railway rollback [deployment-id]

# View deployment history
railway status

# Verify rollback success
make verify-deployment
```

## 🔒 Security and Compliance

### Security Headers Validation
The verification script checks for:
- `X-Content-Type-Options`
- `X-Frame-Options`
- `X-XSS-Protection`
- `Referrer-Policy`

### API Security
- Rate limiting enabled
- Authentication required for sensitive endpoints
- Encryption for sensitive data
- CORS properly configured

## 📊 Performance Optimization

### Monitoring Metrics
- 95th percentile response time < 500ms
- Availability > 99.9%
- Error rate < 1%
- Memory usage < 80%

### Optimization Tools
```bash
# Bundle analysis
ANALYZE=true bun run build

# Performance testing
make test-production-performance

# Load testing
bun run scripts/production-monitoring.ts --stress-test
```

## 🔧 Troubleshooting

### Common Issues

#### Deployment Verification Fails
```bash
# Check detailed logs
bun run deployment/production-verification.ts --verbose

# Test individual endpoints
curl https://your-app.vercel.app/api/health
```

#### Monitoring Alerts
```bash
# Check alert history
bun run scripts/production-monitoring.ts --report

# Test alert system
bun run scripts/production-monitoring.ts --alert-test
```

#### Performance Issues
```bash
# Run performance diagnostics
make test-production-performance

# Check memory usage
bun run scripts/production-readiness-dashboard.ts --report
```

## 📝 Production Checklist

### Pre-deployment ✅
- [ ] Environment variables configured
- [ ] Configuration validation passed
- [ ] All tests passing
- [ ] Build successful
- [ ] Security scan completed
- [ ] Performance baseline established

### Deployment ✅
- [ ] Production deployment successful
- [ ] Health checks passing
- [ ] All services operational
- [ ] Response times within SLA
- [ ] No error rate spikes

### Post-deployment ✅
- [ ] Verification script passed
- [ ] Monitoring dashboard operational
- [ ] Alert system functional
- [ ] Performance metrics stable
- [ ] User acceptance validated

## 🎯 Best Practices

### 1. Regular Health Checks
```bash
# Daily health verification
make verify-deployment

# Weekly comprehensive check
make production-readiness-check
```

### 2. Continuous Monitoring
```bash
# Always run post-deployment monitoring
make deploy-verify && make monitor-production
```

### 3. Alert Management
- Monitor alert trends weekly
- Review and update thresholds monthly
- Test alert system quarterly

### 4. Performance Optimization
- Monitor response time trends
- Review resource usage weekly
- Optimize based on user patterns

## 🔄 Maintenance Windows

### Scheduled Maintenance
```bash
# Pre-maintenance verification
make production-readiness-check

# Post-maintenance verification
make verify-deployment
make monitor-dashboard
```

### Emergency Maintenance
```bash
# Quick health check
make verify-deployment --quick

# Emergency monitoring
make monitor-production --interval 10
```

---

## 📞 Support and Documentation

### Additional Resources
- [Production Configuration Guide](./production-deployment-config.md)
- [Environment Setup Guide](./production-env-template.env)
- [Kubernetes Deployment](./kubernetes/deployment.yaml)

### Emergency Contacts
- **Operations Team**: Set up your on-call rotation
- **Development Team**: Configure your incident response
- **Infrastructure Team**: Define your escalation procedures

---

**✅ Production Deployment Status**: READY
**🚀 Next Action**: Run `make workflow-production` to deploy
**📊 Monitoring**: Access via `make monitor-dashboard`