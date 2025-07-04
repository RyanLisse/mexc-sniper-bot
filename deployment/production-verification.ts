#!/usr/bin/env bun
/**
 * Production Deployment Verification Script
 * 
 * Comprehensive verification system for production deployments with automated
 * health checks, performance validation, and rollback trigger detection.
 * 
 * Usage:
 *   bun run deployment/production-verification.ts [deployment-url]
 *   bun run deployment/production-verification.ts --url https://your-app.vercel.app
 *   bun run deployment/production-verification.ts --quick (basic checks only)
 *   bun run deployment/production-verification.ts --continuous (monitoring mode)
 */

interface VerificationConfig {
  deploymentUrl: string;
  timeout: number;
  retries: number;
  quick: boolean;
  continuous: boolean;
  thresholds: {
    responseTime: number;
    errorRate: number;
    healthScore: number;
    uptime: number;
  };
}

interface HealthCheckResult {
  endpoint: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  statusCode: number;
  data?: any;
  error?: string;
}

interface VerificationReport {
  overall: 'PASS' | 'FAIL' | 'WARNING';
  timestamp: string;
  deploymentUrl: string;
  checks: HealthCheckResult[];
  performance: {
    averageResponseTime: number;
    maxResponseTime: number;
    successRate: number;
  };
  recommendations: string[];
  errors: string[];
}

class ProductionVerificationAgent {
  private config: VerificationConfig;

  constructor(config: VerificationConfig) {
    this.config = config;
  }

  /**
   * Run complete production verification suite
   */
  async runVerification(): Promise<VerificationReport> {
    console.log('🚀 Production Deployment Verification');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔗 Target: ${this.config.deploymentUrl}`);
    console.log(`⚡ Mode: ${this.config.quick ? 'Quick' : 'Comprehensive'}`);
    console.log(`🔄 Continuous: ${this.config.continuous ? 'Yes' : 'No'}\n`);

    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];

    try {
      // Core health check endpoints
      const healthEndpoints = this.getHealthEndpoints();

      console.log('📋 Running Health Checks...');
      for (const endpoint of healthEndpoints) {
        console.log(`   🔍 Checking ${endpoint.name}...`);
        const result = await this.checkEndpoint(endpoint);
        checks.push(result);
        
        const statusEmoji = this.getStatusEmoji(result.status);
        console.log(`   ${statusEmoji} ${endpoint.name}: ${result.status} (${result.responseTime}ms)`);
      }

      if (!this.config.quick) {
        console.log('\n🎯 Running Comprehensive Checks...');
        
        // Performance validation
        console.log('   📈 Performance validation...');
        const performanceCheck = await this.validatePerformance();
        checks.push(performanceCheck);

        // API endpoint validation
        console.log('   🔌 API endpoint validation...');
        const apiChecks = await this.validateApiEndpoints();
        checks.push(...apiChecks);

        // Database connectivity
        console.log('   🗄️  Database connectivity...');
        const dbCheck = await this.validateDatabaseConnectivity();
        checks.push(dbCheck);

        // Security headers validation
        console.log('   🔒 Security headers validation...');
        const securityCheck = await this.validateSecurityHeaders();
        checks.push(securityCheck);
      }

      // Generate verification report
      const report = this.generateReport(checks, startTime);

      // Display results
      this.displayReport(report);

      // Continuous monitoring mode
      if (this.config.continuous) {
        console.log('\n🔄 Starting continuous monitoring...');
        await this.startContinuousMonitoring();
      }

      return report;

    } catch (error) {
      console.error('\n❌ Verification failed:', error);
      return {
        overall: 'FAIL',
        timestamp: new Date().toISOString(),
        deploymentUrl: this.config.deploymentUrl,
        checks: [],
        performance: { averageResponseTime: 0, maxResponseTime: 0, successRate: 0 },
        recommendations: ['Deployment verification failed - investigate errors'],
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Get list of health check endpoints
   */
  private getHealthEndpoints() {
    return [
      {
        name: 'Primary Health Check',
        path: '/api/health',
        method: 'GET',
        critical: true,
        expectedStatus: 200
      },
      {
        name: 'Lightweight Health Check',
        path: '/api/health',
        method: 'HEAD',
        critical: true,
        expectedStatus: 200
      },
      {
        name: 'Environment Configuration',
        path: '/api/health/environment',
        method: 'GET',
        critical: false,
        expectedStatus: 200
      },
      {
        name: 'Agent System Status',
        path: '/api/agents/health',
        method: 'GET',
        critical: false,
        expectedStatus: 200
      },
      {
        name: 'MEXC Connectivity',
        path: '/api/mexc/connectivity',
        method: 'GET',
        critical: false,
        expectedStatus: 200
      }
    ];
  }

  /**
   * Check individual endpoint
   */
  private async checkEndpoint(endpoint: any): Promise<HealthCheckResult> {
    const url = `${this.config.deploymentUrl}${endpoint.path}`;
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: endpoint.method,
        headers: {
          'User-Agent': 'ProductionVerificationAgent/1.0.0',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      const responseTime = Date.now() - startTime;
      let data: any = null;

      if (endpoint.method === 'GET' && response.headers.get('content-type')?.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          // Ignore JSON parse errors for non-JSON responses
        }
      }

      const status = this.determineHealthStatus(response.status, responseTime, data);

      return {
        endpoint: endpoint.name,
        status,
        responseTime,
        statusCode: response.status,
        data,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        endpoint: endpoint.name,
        status: 'unhealthy',
        responseTime,
        statusCode: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate performance metrics
   */
  private async validatePerformance(): Promise<HealthCheckResult> {
    const runs = 5;
    const results: number[] = [];

    for (let i = 0; i < runs; i++) {
      const startTime = Date.now();
      try {
        await fetch(`${this.config.deploymentUrl}/api/health`, {
          signal: AbortSignal.timeout(this.config.timeout)
        });
        results.push(Date.now() - startTime);
      } catch {
        results.push(this.config.timeout);
      }
    }

    const averageResponseTime = results.reduce((a, b) => a + b, 0) / results.length;
    const maxResponseTime = Math.max(...results);

    const status = averageResponseTime < this.config.thresholds.responseTime ? 'healthy' : 'degraded';

    return {
      endpoint: 'Performance Validation',
      status,
      responseTime: averageResponseTime,
      statusCode: 200,
      data: {
        averageResponseTime,
        maxResponseTime,
        runs,
        threshold: this.config.thresholds.responseTime
      }
    };
  }

  /**
   * Validate API endpoints
   */
  private async validateApiEndpoints(): Promise<HealthCheckResult[]> {
    const apiEndpoints = [
      { name: 'System Status', path: '/api/alerts/system/status' },
      { name: 'User Preferences', path: '/api/user-preferences' },
      { name: 'Feature Flags', path: '/api/feature-flags' }
    ];

    const results: HealthCheckResult[] = [];

    for (const endpoint of apiEndpoints) {
      try {
        const response = await fetch(`${this.config.deploymentUrl}${endpoint.path}`, {
          signal: AbortSignal.timeout(this.config.timeout)
        });

        results.push({
          endpoint: endpoint.name,
          status: response.ok ? 'healthy' : 'degraded',
          responseTime: 0,
          statusCode: response.status
        });
      } catch (error) {
        results.push({
          endpoint: endpoint.name,
          status: 'unhealthy',
          responseTime: 0,
          statusCode: 0,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Validate database connectivity
   */
  private async validateDatabaseConnectivity(): Promise<HealthCheckResult> {
    try {
      // Check if health endpoint reports database connectivity
      const response = await fetch(`${this.config.deploymentUrl}/api/health`, {
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        return {
          endpoint: 'Database Connectivity',
          status: 'unhealthy',
          responseTime: 0,
          statusCode: response.status,
          error: 'Health check failed'
        };
      }

      const data = await response.json();
      const dbStatus = data?.services?.database?.status || 'unknown';

      return {
        endpoint: 'Database Connectivity',
        status: dbStatus === 'operational' ? 'healthy' : 'degraded',
        responseTime: data?.services?.database?.responseTime || 0,
        statusCode: 200,
        data: { status: dbStatus }
      };

    } catch (error) {
      return {
        endpoint: 'Database Connectivity',
        status: 'unhealthy',
        responseTime: 0,
        statusCode: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate security headers
   */
  private async validateSecurityHeaders(): Promise<HealthCheckResult> {
    try {
      const response = await fetch(this.config.deploymentUrl, {
        signal: AbortSignal.timeout(this.config.timeout)
      });

      const requiredHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'referrer-policy'
      ];

      const presentHeaders = requiredHeaders.filter(header => 
        response.headers.has(header)
      );

      const status = presentHeaders.length === requiredHeaders.length ? 'healthy' : 'degraded';

      return {
        endpoint: 'Security Headers',
        status,
        responseTime: 0,
        statusCode: response.status,
        data: {
          required: requiredHeaders.length,
          present: presentHeaders.length,
          missing: requiredHeaders.filter(h => !response.headers.has(h))
        }
      };

    } catch (error) {
      return {
        endpoint: 'Security Headers',
        status: 'unhealthy',
        responseTime: 0,
        statusCode: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Determine health status based on response
   */
  private determineHealthStatus(statusCode: number, responseTime: number, data?: any): 'healthy' | 'degraded' | 'unhealthy' {
    if (statusCode < 200 || statusCode >= 500) {
      return 'unhealthy';
    }

    if (statusCode >= 400 || responseTime > this.config.thresholds.responseTime) {
      return 'degraded';
    }

    if (data?.status === 'healthy' || data?.system?.healthy === true) {
      return 'healthy';
    }

    return statusCode < 300 ? 'healthy' : 'degraded';
  }

  /**
   * Generate comprehensive verification report
   */
  private generateReport(checks: HealthCheckResult[], startTime: number): VerificationReport {
    const totalTime = Date.now() - startTime;
    const successfulChecks = checks.filter(c => c.status === 'healthy').length;
    const successRate = (successfulChecks / checks.length) * 100;

    const responseTimes = checks.map(c => c.responseTime).filter(t => t > 0);
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0;
    const maxResponseTime = Math.max(...responseTimes, 0);

    const errors = checks.filter(c => c.error).map(c => `${c.endpoint}: ${c.error}`);
    const criticalFailures = checks.filter(c => c.status === 'unhealthy').length;

    let overall: 'PASS' | 'FAIL' | 'WARNING' = 'PASS';
    const recommendations: string[] = [];

    if (criticalFailures > 0) {
      overall = 'FAIL';
      recommendations.push('Critical health checks failed - investigate immediately');
    } else if (successRate < 90) {
      overall = 'WARNING';
      recommendations.push('Some health checks degraded - monitor closely');
    }

    if (averageResponseTime > this.config.thresholds.responseTime) {
      recommendations.push(`Response time ${averageResponseTime.toFixed(0)}ms exceeds threshold ${this.config.thresholds.responseTime}ms`);
    }

    if (checks.some(c => c.endpoint === 'Security Headers' && c.status !== 'healthy')) {
      recommendations.push('Security headers missing or incomplete');
    }

    return {
      overall,
      timestamp: new Date().toISOString(),
      deploymentUrl: this.config.deploymentUrl,
      checks,
      performance: {
        averageResponseTime,
        maxResponseTime,
        successRate
      },
      recommendations,
      errors
    };
  }

  /**
   * Display verification report
   */
  private displayReport(report: VerificationReport): void {
    console.log('\n📊 Verification Report');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const overallEmoji = {
      'PASS': '✅',
      'WARNING': '⚠️',
      'FAIL': '❌'
    }[report.overall];

    console.log(`${overallEmoji} Overall Status: ${report.overall}`);
    console.log(`📈 Success Rate: ${report.performance.successRate.toFixed(1)}%`);
    console.log(`⚡ Average Response Time: ${report.performance.averageResponseTime.toFixed(0)}ms`);
    console.log(`🕐 Timestamp: ${report.timestamp}\n`);

    // Health check results
    console.log('🔍 Health Check Results:');
    for (const check of report.checks) {
      const emoji = this.getStatusEmoji(check.status);
      console.log(`   ${emoji} ${check.endpoint}: ${check.status}`);
      if (check.responseTime > 0) {
        console.log(`      ⏱️  Response Time: ${check.responseTime}ms`);
      }
      if (check.error) {
        console.log(`      ❌ Error: ${check.error}`);
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const rec of report.recommendations) {
        console.log(`   🔧 ${rec}`);
      }
    }

    // Errors
    if (report.errors.length > 0) {
      console.log('\n🚨 Errors:');
      for (const error of report.errors) {
        console.log(`   ❌ ${error}`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Start continuous monitoring mode
   */
  private async startContinuousMonitoring(): Promise<void> {
    const interval = 30000; // 30 seconds

    while (true) {
      await new Promise(resolve => setTimeout(resolve, interval));
      
      console.log(`\n🔄 Continuous Check - ${new Date().toLocaleTimeString()}`);
      
      const quickCheck = await this.checkEndpoint({
        name: 'Health Monitor',
        path: '/api/health',
        method: 'HEAD'
      });

      const emoji = this.getStatusEmoji(quickCheck.status);
      console.log(`${emoji} Status: ${quickCheck.status} (${quickCheck.responseTime}ms)`);

      if (quickCheck.status === 'unhealthy') {
        console.log('🚨 ALERT: System unhealthy - consider rollback');
      }
    }
  }

  /**
   * Get status emoji for display
   */
  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      healthy: '✅',
      degraded: '⚠️',
      unhealthy: '❌',
      unknown: '❓'
    };
    return emojis[status] || '❓';
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  let deploymentUrl = process.env.RAILWAY_PUBLIC_DOMAIN ? 
    process.env.RAILWAY_PUBLIC_DOMAIN : 
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
    'http://localhost:3008';
  let quick = false;
  let continuous = false;

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--url':
        deploymentUrl = args[i + 1] || deploymentUrl;
        i++;
        break;
      case '--quick':
        quick = true;
        break;
      case '--continuous':
        continuous = true;
        break;
      case '--help':
        console.log(`
🚀 Production Deployment Verification

Usage:
  bun run deployment/production-verification.ts [options]

Options:
  --url <url>        Deployment URL to verify (default: localhost:3008)
  --quick           Run basic health checks only
  --continuous      Start continuous monitoring mode
  --help            Show this help message

Examples:
  bun run deployment/production-verification.ts --url https://your-app.vercel.app
  bun run deployment/production-verification.ts --quick
  bun run deployment/production-verification.ts --continuous
        `);
        process.exit(0);
        break;
      default:
        if (!arg.startsWith('--') && arg.startsWith('http')) {
          deploymentUrl = arg;
        }
        break;
    }
  }

  const config: VerificationConfig = {
    deploymentUrl,
    timeout: 30000,
    retries: 3,
    quick,
    continuous,
    thresholds: {
      responseTime: 1000,
      errorRate: 0.05,
      healthScore: 80,
      uptime: 0.999
    }
  };

  const verificationAgent = new ProductionVerificationAgent(config);
  
  try {
    const report = await verificationAgent.runVerification();
    
    // Exit with appropriate code
    if (report.overall === 'FAIL') {
      process.exit(1);
    } else if (report.overall === 'WARNING') {
      process.exit(2);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}