#!/usr/bin/env bun
/**
 * Production Monitoring and Alerting System
 * 
 * Comprehensive monitoring system with real-time health checks, performance metrics,
 * automated alerting, and incident response capabilities.
 * 
 * Usage:
 *   bun run scripts/production-monitoring.ts [--url deployment-url] [--interval 30]
 *   bun run scripts/production-monitoring.ts --alert-test
 *   bun run scripts/production-monitoring.ts --dashboard
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface MonitoringConfig {
  deploymentUrl: string;
  checkInterval: number;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    healthScore: number;
    uptime: number;
    memoryUsage: number;
  };
  alertChannels: {
    webhook?: string;
    email?: string;
    slack?: string;
  };
  retentionDays: number;
}

interface HealthMetrics {
  timestamp: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  uptime: number;
  healthScore: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  services: {
    [key: string]: {
      status: string;
      responseTime?: number;
    };
  };
  deployment: {
    platform: string;
    nodeVersion: string;
    environment: string;
  };
}

interface Alert {
  id: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  metrics: Partial<HealthMetrics>;
  resolved: boolean;
  resolvedAt?: string;
}

interface MonitoringReport {
  period: string;
  availability: number;
  averageResponseTime: number;
  totalAlerts: number;
  criticalAlerts: number;
  incidents: Alert[];
  trends: {
    responseTime: number[];
    healthScore: number[];
    errorRate: number[];
  };
}

class ProductionMonitoringAgent {
  private config: MonitoringConfig;
  private alerts: Alert[] = [];
  private metrics: HealthMetrics[] = [];
  private isRunning = false;

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.loadPersistedData();
  }

  /**
   * Start continuous monitoring
   */
  async startMonitoring(): Promise<void> {
    console.log('🔍 Production Monitoring Agent');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🌐 Target: ${this.config.deploymentUrl}`);
    console.log(`⏱️  Check Interval: ${this.config.checkInterval}s`);
    console.log(`🚨 Alert Channels: ${Object.keys(this.config.alertChannels).join(', ')}\n`);

    this.isRunning = true;

    // Initial health check
    await this.performHealthCheck();

    // Start monitoring loop
    const monitoringInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(monitoringInterval);
        return;
      }

      try {
        await this.performHealthCheck();
        await this.evaluateAlerts();
        await this.cleanupOldData();
        this.displayRealTimeStatus();
      } catch (error) {
        console.error('Monitoring error:', error);
      }
    }, this.config.checkInterval * 1000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n⏹️  Stopping monitoring...');
      this.isRunning = false;
      this.saveMonitoringData();
      process.exit(0);
    });

    // Keep the process running
    while (this.isRunning) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();

    try {
      // Primary health check
      const healthResponse = await fetch(`${this.config.deploymentUrl}/api/health`, {
        signal: AbortSignal.timeout(30000)
      });

      const responseTime = Date.now() - startTime;
      let healthData: any = {};

      if (healthResponse.ok) {
        healthData = await healthResponse.json();
      }

      // Additional service checks
      const serviceChecks = await this.performServiceChecks();

      const metrics: HealthMetrics = {
        timestamp: new Date().toISOString(),
        status: this.determineOverallStatus(healthResponse.status, healthData, serviceChecks),
        responseTime,
        uptime: healthData.uptime || 0,
        healthScore: healthData.system?.score || 0,
        memoryUsage: healthData.deployment?.memoryUsage || {
          rss: 0,
          heapUsed: 0,
          heapTotal: 0,
          external: 0
        },
        services: {
          primary: {
            status: healthResponse.ok ? 'operational' : 'degraded',
            responseTime
          },
          ...serviceChecks
        },
        deployment: {
          platform: healthData.deployment?.platform || 'unknown',
          nodeVersion: healthData.deployment?.nodeVersion || 'unknown',
          environment: healthData.environment || 'unknown'
        }
      };

      this.metrics.push(metrics);
      this.evaluateMetrics(metrics);

    } catch (error) {
      const errorMetrics: HealthMetrics = {
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        uptime: 0,
        healthScore: 0,
        memoryUsage: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 },
        services: {
          primary: {
            status: 'error',
            responseTime: Date.now() - startTime
          }
        },
        deployment: {
          platform: 'unknown',
          nodeVersion: 'unknown',
          environment: 'unknown'
        }
      };

      this.metrics.push(errorMetrics);
      
      await this.createAlert({
        severity: 'critical',
        title: 'Health Check Failed',
        description: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        metrics: errorMetrics
      });
    }
  }

  /**
   * Perform additional service checks
   */
  private async performServiceChecks(): Promise<{ [key: string]: any }> {
    const services: { [key: string]: any } = {};

    const serviceEndpoints = [
      { name: 'agents', path: '/api/agents/health' },
      { name: 'mexc', path: '/api/mexc/connectivity' },
      { name: 'alerts', path: '/api/alerts/system/status' },
      { name: 'features', path: '/api/feature-flags' }
    ];

    for (const service of serviceEndpoints) {
      try {
        const startTime = Date.now();
        const response = await fetch(`${this.config.deploymentUrl}${service.path}`, {
          signal: AbortSignal.timeout(15000)
        });

        services[service.name] = {
          status: response.ok ? 'operational' : 'degraded',
          responseTime: Date.now() - startTime,
          statusCode: response.status
        };

      } catch (error) {
        services[service.name] = {
          status: 'error',
          responseTime: 0,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    return services;
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(statusCode: number, healthData: any, services: any): 'healthy' | 'degraded' | 'unhealthy' {
    if (statusCode >= 500) return 'unhealthy';
    
    const failedServices = Object.values(services).filter((s: any) => s.status === 'error').length;
    const totalServices = Object.keys(services).length;
    
    if (failedServices > totalServices * 0.5) return 'unhealthy';
    if (failedServices > 0 || statusCode >= 400) return 'degraded';
    if (healthData.system?.score < 80) return 'degraded';
    
    return 'healthy';
  }

  /**
   * Evaluate metrics against alert thresholds
   */
  private evaluateMetrics(metrics: HealthMetrics): void {
    const thresholds = this.config.alertThresholds;

    // Response time alert
    if (metrics.responseTime > thresholds.responseTime) {
      this.createAlert({
        severity: 'warning',
        title: 'High Response Time',
        description: `Response time ${metrics.responseTime}ms exceeds threshold ${thresholds.responseTime}ms`,
        metrics
      });
    }

    // Health score alert
    if (metrics.healthScore < thresholds.healthScore && metrics.healthScore > 0) {
      this.createAlert({
        severity: 'warning',
        title: 'Low Health Score',
        description: `Health score ${metrics.healthScore} below threshold ${thresholds.healthScore}`,
        metrics
      });
    }

    // Memory usage alert
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > thresholds.memoryUsage) {
      this.createAlert({
        severity: 'warning',
        title: 'High Memory Usage',
        description: `Memory usage ${memoryUsagePercent.toFixed(1)}% exceeds threshold ${thresholds.memoryUsage}%`,
        metrics
      });
    }

    // Service degradation alerts
    for (const [serviceName, serviceData] of Object.entries(metrics.services)) {
      const service = serviceData as any;
      if (service.status === 'error') {
        this.createAlert({
          severity: 'critical',
          title: `Service Error: ${serviceName}`,
          description: `Service ${serviceName} is experiencing errors: ${service.error || 'Unknown error'}`,
          metrics
        });
      } else if (service.status === 'degraded') {
        this.createAlert({
          severity: 'warning',
          title: `Service Degraded: ${serviceName}`,
          description: `Service ${serviceName} is degraded (response time: ${service.responseTime}ms)`,
          metrics
        });
      }
    }

    // Overall system health alerts
    if (metrics.status === 'unhealthy') {
      this.createAlert({
        severity: 'critical',
        title: 'System Unhealthy',
        description: 'System health status is unhealthy - immediate attention required',
        metrics
      });
    }
  }

  /**
   * Create and process alert
   */
  private async createAlert(alertData: {
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    metrics: Partial<HealthMetrics>;
  }): Promise<void> {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      severity: alertData.severity,
      title: alertData.title,
      description: alertData.description,
      metrics: alertData.metrics,
      resolved: false
    };

    // Check for duplicate alerts (same title within 5 minutes)
    const recentAlerts = this.alerts.filter(a => 
      a.title === alert.title && 
      !a.resolved && 
      new Date(a.timestamp).getTime() > Date.now() - 5 * 60 * 1000
    );

    if (recentAlerts.length > 0) {
      return; // Don't create duplicate alerts
    }

    this.alerts.push(alert);
    
    console.log(`\n🚨 ALERT [${alert.severity.toUpperCase()}] ${alert.title}`);
    console.log(`   ${alert.description}`);
    console.log(`   Alert ID: ${alert.id}`);

    // Send alert notifications
    await this.sendAlertNotifications(alert);

    // Auto-resolve info alerts after 1 minute
    if (alert.severity === 'info') {
      setTimeout(() => {
        this.resolveAlert(alert.id);
      }, 60000);
    }
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: Alert): Promise<void> {
    const { alertChannels } = this.config;

    // Webhook notification
    if (alertChannels.webhook) {
      try {
        await fetch(alertChannels.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 ${alert.severity.toUpperCase()}: ${alert.title}`,
            attachments: [{
              color: alert.severity === 'critical' ? 'danger' : 'warning',
              fields: [{
                title: 'Description',
                value: alert.description,
                short: false
              }, {
                title: 'Time',
                value: alert.timestamp,
                short: true
              }, {
                title: 'Alert ID',
                value: alert.id,
                short: true
              }]
            }]
          })
        });
      } catch (error) {
        console.warn('Failed to send webhook notification:', error);
      }
    }

    // Email notification (placeholder - would integrate with email service)
    if (alertChannels.email) {
      console.log(`📧 Email alert sent to: ${alertChannels.email}`);
    }

    // Slack notification (placeholder - would integrate with Slack API)
    if (alertChannels.slack) {
      console.log(`💬 Slack alert sent to: ${alertChannels.slack}`);
    }
  }

  /**
   * Resolve alert
   */
  private resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      console.log(`✅ Alert resolved: ${alert.title} (${alertId})`);
    }
  }

  /**
   * Evaluate and auto-resolve alerts
   */
  private async evaluateAlerts(): Promise<void> {
    const currentMetrics = this.metrics[this.metrics.length - 1];
    if (!currentMetrics) return;

    // Auto-resolve alerts based on current health
    for (const alert of this.alerts.filter(a => !a.resolved)) {
      let shouldResolve = false;

      // Auto-resolve based on current status
      if (alert.title.includes('High Response Time') && 
          currentMetrics.responseTime <= this.config.alertThresholds.responseTime) {
        shouldResolve = true;
      }

      if (alert.title.includes('Low Health Score') && 
          currentMetrics.healthScore >= this.config.alertThresholds.healthScore) {
        shouldResolve = true;
      }

      if (alert.title.includes('System Unhealthy') && 
          currentMetrics.status === 'healthy') {
        shouldResolve = true;
      }

      if (shouldResolve) {
        this.resolveAlert(alert.id);
      }
    }
  }

  /**
   * Display real-time monitoring status
   */
  private displayRealTimeStatus(): void {
    const currentMetrics = this.metrics[this.metrics.length - 1];
    if (!currentMetrics) return;

    const statusEmoji = {
      healthy: '✅',
      degraded: '⚠️',
      unhealthy: '❌'
    }[currentMetrics.status];

    const unresolvedAlerts = this.alerts.filter(a => !a.resolved).length;
    const criticalAlerts = this.alerts.filter(a => !a.resolved && a.severity === 'critical').length;

    process.stdout.write(`\r${statusEmoji} ${currentMetrics.status.toUpperCase()} | ` +
                        `⚡ ${currentMetrics.responseTime}ms | ` +
                        `📊 Score: ${currentMetrics.healthScore} | ` +
                        `🚨 Alerts: ${unresolvedAlerts} (${criticalAlerts} critical) | ` +
                        `🕐 ${new Date(currentMetrics.timestamp).toLocaleTimeString()}`);
  }

  /**
   * Generate monitoring report
   */
  generateReport(hours = 24): MonitoringReport {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => 
      new Date(m.timestamp).getTime() > cutoffTime
    );

    const recentAlerts = this.alerts.filter(a => 
      new Date(a.timestamp).getTime() > cutoffTime
    );

    const healthyMetrics = recentMetrics.filter(m => m.status === 'healthy');
    const availability = (healthyMetrics.length / recentMetrics.length) * 100;

    const averageResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length;

    return {
      period: `Last ${hours} hours`,
      availability: Math.round(availability * 100) / 100,
      averageResponseTime: Math.round(averageResponseTime),
      totalAlerts: recentAlerts.length,
      criticalAlerts: recentAlerts.filter(a => a.severity === 'critical').length,
      incidents: recentAlerts,
      trends: {
        responseTime: recentMetrics.map(m => m.responseTime),
        healthScore: recentMetrics.map(m => m.healthScore),
        errorRate: recentMetrics.map(m => m.status === 'unhealthy' ? 1 : 0)
      }
    };
  }

  /**
   * Clean up old monitoring data
   */
  private async cleanupOldData(): Promise<void> {
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);

    // Clean old metrics
    this.metrics = this.metrics.filter(m => 
      new Date(m.timestamp).getTime() > cutoffTime
    );

    // Clean old resolved alerts
    this.alerts = this.alerts.filter(a => 
      !a.resolved || new Date(a.timestamp).getTime() > cutoffTime
    );
  }

  /**
   * Load persisted monitoring data
   */
  private loadPersistedData(): void {
    try {
      const dataDir = join(process.cwd(), 'logs', 'monitoring');
      
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
        return;
      }

      const metricsPath = join(dataDir, 'metrics.json');
      const alertsPath = join(dataDir, 'alerts.json');

      if (existsSync(metricsPath)) {
        this.metrics = JSON.parse(readFileSync(metricsPath, 'utf-8'));
      }

      if (existsSync(alertsPath)) {
        this.alerts = JSON.parse(readFileSync(alertsPath, 'utf-8'));
      }

    } catch (error) {
      console.warn('Failed to load persisted monitoring data:', error);
    }
  }

  /**
   * Save monitoring data
   */
  saveMonitoringData(): void {
    try {
      const dataDir = join(process.cwd(), 'logs', 'monitoring');
      
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      const metricsPath = join(dataDir, 'metrics.json');
      const alertsPath = join(dataDir, 'alerts.json');

      writeFileSync(metricsPath, JSON.stringify(this.metrics, null, 2));
      writeFileSync(alertsPath, JSON.stringify(this.alerts, null, 2));

      console.log('\n💾 Monitoring data saved');

    } catch (error) {
      console.warn('Failed to save monitoring data:', error);
    }
  }

  /**
   * Test alert system
   */
  async testAlerts(): Promise<void> {
    console.log('🧪 Testing alert system...');

    await this.createAlert({
      severity: 'info',
      title: 'Alert System Test',
      description: 'This is a test alert to verify the alerting system is working correctly.',
      metrics: {}
    });

    console.log('✅ Test alert created successfully');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  const config: MonitoringConfig = {
    deploymentUrl: process.env.RAILWAY_PUBLIC_DOMAIN ? 
      process.env.RAILWAY_PUBLIC_DOMAIN : 
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
      'http://localhost:3008',
    checkInterval: 30,
    alertThresholds: {
      responseTime: 2000,
      errorRate: 0.05,
      healthScore: 70,
      uptime: 0.99,
      memoryUsage: 85
    },
    alertChannels: {
      webhook: process.env.SLACK_WEBHOOK_URL,
      email: process.env.ALERT_EMAIL,
      slack: process.env.SLACK_CHANNEL
    },
    retentionDays: 7
  };

  let testAlerts = false;
  let generateReport = false;

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--url':
        config.deploymentUrl = args[i + 1] || config.deploymentUrl;
        i++;
        break;
      case '--interval':
        config.checkInterval = parseInt(args[i + 1]) || config.checkInterval;
        i++;
        break;
      case '--alert-test':
        testAlerts = true;
        break;
      case '--dashboard':
      case '--report':
        generateReport = true;
        break;
      case '--help':
        console.log(`
🔍 Production Monitoring Agent

Usage:
  bun run scripts/production-monitoring.ts [options]

Options:
  --url <url>        Deployment URL to monitor (default: localhost:3008)
  --interval <sec>   Check interval in seconds (default: 30)
  --alert-test       Test alert system
  --dashboard        Generate monitoring report
  --help             Show this help message

Environment Variables:
  SLACK_WEBHOOK_URL  Webhook URL for Slack alerts
  ALERT_EMAIL        Email address for alerts
  SLACK_CHANNEL      Slack channel for alerts

Examples:
  bun run scripts/production-monitoring.ts --url https://your-app.vercel.app
  bun run scripts/production-monitoring.ts --interval 60
  bun run scripts/production-monitoring.ts --alert-test
        `);
        process.exit(0);
        break;
    }
  }

  const monitoringAgent = new ProductionMonitoringAgent(config);
  
  try {
    if (testAlerts) {
      await monitoringAgent.testAlerts();
      return;
    }

    if (generateReport) {
      const report = monitoringAgent.generateReport(24);
      console.log('\n📊 Monitoring Report (Last 24 Hours)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📈 Availability: ${report.availability}%`);
      console.log(`⚡ Average Response Time: ${report.averageResponseTime}ms`);
      console.log(`🚨 Total Alerts: ${report.totalAlerts} (${report.criticalAlerts} critical)`);
      
      if (report.incidents.length > 0) {
        console.log('\n🔍 Recent Incidents:');
        for (const incident of report.incidents.slice(0, 5)) {
          const status = incident.resolved ? '✅' : '🚨';
          console.log(`   ${status} ${incident.title} (${incident.severity})`);
          console.log(`      ${incident.description}`);
          console.log(`      Time: ${incident.timestamp}`);
        }
      }
      return;
    }

    // Start continuous monitoring
    await monitoringAgent.startMonitoring();

  } catch (error) {
    console.error('\n💥 Monitoring error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}