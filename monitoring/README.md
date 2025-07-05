# Authentication Monitoring & Alerting

This directory contains comprehensive monitoring and alerting configurations for the MEXC Sniper Bot authentication system. The monitoring solution provides real-time visibility into authentication health, performance, and security metrics.

## Overview

The authentication monitoring system includes:

- **Real-time Health Monitoring**: Continuous monitoring of authentication endpoints and Supabase integration
- **Performance Tracking**: Response time, throughput, and availability metrics
- **Security Monitoring**: Failed login attempts, suspicious activities, and security violations
- **Automated Alerting**: Multi-channel notifications with severity-based routing
- **Deployment Validation**: Automated testing of authentication flows during deployments

## Components

### 1. Monitoring Configuration (`auth-monitoring-config.yml`)

Central configuration file defining:
- Health check intervals and thresholds
- Alert rules and escalation policies
- Notification channels and routing
- Environment-specific settings
- Security monitoring rules

### 2. GitHub Actions Monitoring (`../.github/workflows/auth-monitoring.yml`)

Automated monitoring workflow that:
- Runs scheduled health checks every 15 minutes
- Performs response time and availability monitoring
- Validates security headers and SSL certificates
- Creates GitHub issues for critical failures
- Generates monitoring reports

### 3. Monitoring API (`../app/api/monitoring/auth/route.ts`)

RESTful API endpoint providing:
- Real-time monitoring data in JSON format
- Prometheus metrics export
- Alert management (create/resolve)
- Performance metrics and trends
- Environment-specific data

### 4. Grafana Dashboard (`grafana-auth-dashboard.json`)

Pre-configured dashboard featuring:
- Authentication system status overview
- Performance trends and metrics
- Error rate and availability charts
- Security event monitoring
- Real-time alerting visualization

## Quick Start

### 1. Environment Setup

Set required environment variables:

```bash
# Core authentication
export KINDE_ISSUER_URL="https://your-org.kinde.com"
export KINDE_SITE_URL="https://your-app.com"
export KINDE_CLIENT_ID="your_client_id"
export KINDE_CLIENT_SECRET="your_client_secret"

# Monitoring notifications
export SLACK_WEBHOOK_CRITICAL="https://hooks.slack.com/..."
export SLACK_WEBHOOK_WARNINGS="https://hooks.slack.com/..."
```

### 2. Enable GitHub Actions Monitoring

The monitoring workflow automatically runs on schedule. To trigger manually:

```bash
gh workflow run auth-monitoring.yml
```

### 3. Access Monitoring Data

Fetch current monitoring status:

```bash
curl https://your-app.com/api/monitoring/auth
```

Get Prometheus metrics:

```bash
curl https://your-app.com/api/monitoring/auth?format=prometheus
```

### 4. Import Grafana Dashboard

1. Open Grafana
2. Go to Dashboards → Import
3. Upload `grafana-auth-dashboard.json`
4. Configure Prometheus data source

## Monitoring Endpoints

### Health Check
- **URL**: `/api/health/auth`
- **Method**: GET
- **Purpose**: Basic authentication system health

### Monitoring Dashboard
- **URL**: `/api/monitoring/auth`
- **Method**: GET/POST
- **Purpose**: Comprehensive monitoring data and alert management

### Prometheus Metrics
- **URL**: `/api/monitoring/auth?format=prometheus`
- **Method**: GET
- **Purpose**: Metrics export for Prometheus scraping

## Alert Severity Levels

### Critical Alerts
- Authentication system completely down
- Supabase connectivity failure
- Invalid authentication configuration
- Error rate > 5%

**Response**: Immediate action required, pages on-call team

### Warning Alerts
- Degraded response time (> 2s)
- Reduced availability (< 99%)
- Elevated error rate (> 1%)
- Supabase client warnings

**Response**: Investigation within 15 minutes

### Info Alerts
- Configuration changes
- Deployment notifications
- Performance trend changes

**Response**: Acknowledgment required

## Notification Channels

### Slack Integration
- **Critical**: `#alerts-critical` with @on-call mention
- **Warning**: `#alerts-warnings` with @auth-team mention

### Email Alerts
- **Recipients**: ops@mexcsniper.com, auth-team@mexcsniper.com
- **Frequency**: Critical alerts only

### GitHub Issues
- **Repository**: mexc-sniper-bot
- **Labels**: monitoring, authentication, auto-generated
- **Auto-resolution**: When alerts clear

## Performance Thresholds

### Production Environment
- **Response Time**: Warning > 1s, Critical > 3s
- **Availability**: Warning < 99.9%, Critical < 99%
- **Error Rate**: Warning > 0.1%, Critical > 1%

### Staging Environment
- **Response Time**: Warning > 2s, Critical > 5s
- **Availability**: Warning < 99%, Critical < 95%
- **Error Rate**: Warning > 1%, Critical > 5%

## Security Monitoring

### Monitored Events
- Failed login attempts
- Suspicious IP activities
- Rate limiting violations
- SSL certificate issues
- Security header validation

### Automated Responses
- IP blocking after 50 failed attempts
- Rate limiting at 100 requests/minute
- Alert generation for brute force attempts

## Maintenance Windows

### Scheduled Maintenance
- **Weekly**: Sunday 2 AM UTC (2 hours)
- **Suppressed Alerts**: Warning-level only

### Emergency Maintenance
- **Trigger**: Manual
- **Suppressed Alerts**: All non-critical

## Troubleshooting

### Common Issues

#### False Positive Alerts
1. Check maintenance window status
2. Verify environment configuration
3. Review recent deployments

#### Missing Metrics
1. Verify Prometheus scraping configuration
2. Check API endpoint accessibility
3. Validate environment variables

#### Alert Fatigue
1. Review and adjust thresholds
2. Implement alert grouping
3. Set up maintenance windows

### Debug Commands

Check authentication health:
```bash
curl -v https://your-app.com/api/health/auth
```

Test alert generation:
```bash
curl -X POST https://your-app.com/api/monitoring/auth \
  -H "Content-Type: application/json" \
  -d '{"type": "alert", "data": {"severity": "warning", "message": "Test alert"}}'
```

Resolve test alert:
```bash
curl -X POST https://your-app.com/api/monitoring/auth \
  -H "Content-Type: application/json" \
  -d '{"type": "resolve", "data": {"alertId": "alert-123"}}'
```

## Integration with External Services

### Prometheus
- **Scrape Interval**: 30 seconds
- **Metrics Endpoint**: `/api/monitoring/auth?format=prometheus`
- **Retention**: 30 days

### Grafana
- **Dashboard**: Import `grafana-auth-dashboard.json`
- **Data Source**: Prometheus
- **Refresh**: 30 seconds

### Slack
- **Webhooks**: Configure in environment variables
- **Channels**: #alerts-critical, #alerts-warnings
- **Mentions**: @on-call, @auth-team

## Best Practices

### Monitoring
1. Set appropriate thresholds for your environment
2. Use maintenance windows during deployments
3. Monitor trends, not just absolute values
4. Regularly review and update alert rules

### Alerting
1. Implement alert escalation policies
2. Use severity-based routing
3. Provide actionable alert messages
4. Set up alert acknowledgment workflows

### Security
1. Monitor authentication patterns
2. Set up automated responses to threats
3. Regularly audit security configurations
4. Implement rate limiting and IP blocking

## Support

For issues with monitoring:
1. Check GitHub Actions workflow logs
2. Review alert configurations
3. Validate environment variables
4. Contact the auth team in #alerts-warnings

For critical authentication issues:
1. Check #alerts-critical Slack channel
2. Review GitHub issues with monitoring label
3. Contact on-call team immediately
4. Follow incident response procedures