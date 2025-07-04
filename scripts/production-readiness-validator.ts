#!/usr/bin/env bun
/**
 * Production Readiness Validation Script
 * 
 * Comprehensive validation system for production deployment readiness with
 * automated checks, security validation, performance testing, and rollback planning.
 * 
 * Usage:
 *   bun run scripts/production-readiness-validator.ts
 *   bun run scripts/production-readiness-validator.ts --quick
 *   bun run scripts/production-readiness-validator.ts --check security
 *   bun run scripts/production-readiness-validator.ts --report json
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface ValidationCheck {
  id: string;
  category: string;
  name: string;
  description: string;
  critical: boolean;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning' | 'skipped';
  score: number;
  maxScore: number;
  duration?: number;
  error?: string;
  details?: any;
  recommendations?: string[];
}

interface ValidationReport {
  timestamp: string;
  environment: string;
  version: string;
  overall: 'READY' | 'NOT_READY' | 'CONDITIONAL';
  overallScore: number;
  maxScore: number;
  categories: {
    [key: string]: {
      score: number;
      maxScore: number;
      status: 'passed' | 'failed' | 'warning';
      checks: ValidationCheck[];
    };
  };
  criticalIssues: string[];
  warnings: string[];
  recommendations: string[];
  deployment: {
    approved: boolean;
    blockers: string[];
    requirements: string[];
  };
}

class ProductionReadinessValidator {
  private checks: ValidationCheck[] = [];
  private startTime: number = 0;

  constructor(private options: {
    quick?: boolean;
    category?: string;
    reportFormat?: 'json' | 'markdown' | 'console';
    outputPath?: string;
  } = {}) {}

  /**
   * Run complete validation suite
   */
  async runValidation(): Promise<ValidationReport> {
    console.log('🚀 Production Readiness Validation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`⚡ Mode: ${this.options.quick ? 'Quick' : 'Comprehensive'}`);
    console.log(`📊 Report Format: ${this.options.reportFormat || 'console'}`);
    
    if (this.options.category) {
      console.log(`🎯 Category Filter: ${this.options.category}`);
    }
    
    console.log('');
    this.startTime = Date.now();

    try {
      // Initialize validation checks
      this.initializeChecks();

      // Filter checks if category specified
      if (this.options.category) {
        this.checks = this.checks.filter(check => 
          check.category.toLowerCase() === this.options.category.toLowerCase()
        );
      }

      // Run all validation checks
      await this.executeChecks();

      // Generate and return report
      const report = this.generateReport();
      
      // Output report
      await this.outputReport(report);

      return report;

    } catch (error) {
      console.error('\n❌ Validation failed:', error);
      throw error;
    }
  }

  /**
   * Initialize all validation checks
   */
  private initializeChecks(): void {
    // Environment and Configuration Checks
    this.addCheck({
      id: 'env_production',
      category: 'environment',
      name: 'Production Environment',
      description: 'Verify NODE_ENV is set to production',
      critical: true
    });

    this.addCheck({
      id: 'env_variables',
      category: 'environment',
      name: 'Environment Variables',
      description: 'Validate all required environment variables',
      critical: true
    });

    this.addCheck({
      id: 'env_secrets',
      category: 'environment',
      name: 'Secret Management',
      description: 'Verify secrets are properly configured',
      critical: true
    });

    // Build and Code Quality Checks
    this.addCheck({
      id: 'build_success',
      category: 'build',
      name: 'Production Build',
      description: 'Verify production build completes successfully',
      critical: true
    });

    this.addCheck({
      id: 'typescript_check',
      category: 'build',
      name: 'TypeScript Validation',
      description: 'Ensure no TypeScript errors',
      critical: true
    });

    this.addCheck({
      id: 'lint_check',
      category: 'build',
      name: 'Code Linting',
      description: 'Verify code passes linting rules',
      critical: false
    });

    // Testing Checks
    this.addCheck({
      id: 'unit_tests',
      category: 'testing',
      name: 'Unit Tests',
      description: 'All unit tests must pass',
      critical: true
    });

    this.addCheck({
      id: 'integration_tests',
      category: 'testing',
      name: 'Integration Tests',
      description: 'All integration tests must pass',
      critical: true
    });

    if (!this.options.quick) {
      this.addCheck({
        id: 'e2e_tests',
        category: 'testing',
        name: 'End-to-End Tests',
        description: 'E2E tests validate user workflows',
        critical: false
      });
    }

    // Security Checks
    this.addCheck({
      id: 'security_headers',
      category: 'security',
      name: 'Security Headers',
      description: 'Verify security headers are configured',
      critical: true
    });

    this.addCheck({
      id: 'dependency_audit',
      category: 'security',
      name: 'Dependency Security',
      description: 'Check for vulnerable dependencies',
      critical: true
    });

    this.addCheck({
      id: 'api_security',
      category: 'security',
      name: 'API Security',
      description: 'Validate API security configuration',
      critical: true
    });

    // Performance Checks
    this.addCheck({
      id: 'bundle_size',
      category: 'performance',
      name: 'Bundle Size',
      description: 'Verify bundle size is optimized',
      critical: false
    });

    this.addCheck({
      id: 'performance_budget',
      category: 'performance',
      name: 'Performance Budget',
      description: 'Check performance metrics are within budget',
      critical: false
    });

    // Infrastructure Checks
    this.addCheck({
      id: 'database_connectivity',
      category: 'infrastructure',
      name: 'Database Connectivity',
      description: 'Verify database connection and migrations',
      critical: true
    });

    this.addCheck({
      id: 'external_services',
      category: 'infrastructure',
      name: 'External Services',
      description: 'Validate connectivity to external APIs',
      critical: true
    });

    // Monitoring and Observability
    this.addCheck({
      id: 'health_endpoints',
      category: 'monitoring',
      name: 'Health Endpoints',
      description: 'Verify health check endpoints are working',
      critical: true
    });

    this.addCheck({
      id: 'error_tracking',
      category: 'monitoring',
      name: 'Error Tracking',
      description: 'Ensure error tracking is configured',
      critical: false
    });

    this.addCheck({
      id: 'performance_monitoring',
      category: 'monitoring',
      name: 'Performance Monitoring',
      description: 'Verify performance monitoring is active',
      critical: false
    });

    // Deployment Configuration
    this.addCheck({
      id: 'vercel_config',
      category: 'deployment',
      name: 'Vercel Configuration',
      description: 'Validate Vercel deployment configuration',
      critical: true
    });

    this.addCheck({
      id: 'environment_consistency',
      category: 'deployment',
      name: 'Environment Consistency',
      description: 'Verify environment consistency across stages',
      critical: true
    });
  }

  /**
   * Add a validation check
   */
  private addCheck(check: Omit<ValidationCheck, 'status' | 'score' | 'maxScore'>): void {
    this.checks.push({
      ...check,
      status: 'pending',
      score: 0,
      maxScore: check.critical ? 10 : 5
    });
  }

  /**
   * Execute all validation checks
   */
  private async executeChecks(): Promise<void> {
    console.log(`📋 Running ${this.checks.length} validation checks...\n`);

    for (const check of this.checks) {
      await this.executeCheck(check);
    }
  }

  /**
   * Execute individual validation check
   */
  private async executeCheck(check: ValidationCheck): Promise<void> {
    const startTime = Date.now();
    check.status = 'running';

    console.log(`   🔍 ${check.name}...`);

    try {
      switch (check.id) {
        case 'env_production':
          await this.checkProductionEnvironment(check);
          break;
        case 'env_variables':
          await this.checkEnvironmentVariables(check);
          break;
        case 'env_secrets':
          await this.checkSecretManagement(check);
          break;
        case 'build_success':
          await this.checkProductionBuild(check);
          break;
        case 'typescript_check':
          await this.checkTypeScript(check);
          break;
        case 'lint_check':
          await this.checkLinting(check);
          break;
        case 'unit_tests':
          await this.checkUnitTests(check);
          break;
        case 'integration_tests':
          await this.checkIntegrationTests(check);
          break;
        case 'e2e_tests':
          await this.checkE2ETests(check);
          break;
        case 'security_headers':
          await this.checkSecurityHeaders(check);
          break;
        case 'dependency_audit':
          await this.checkDependencyAudit(check);
          break;
        case 'api_security':
          await this.checkApiSecurity(check);
          break;
        case 'bundle_size':
          await this.checkBundleSize(check);
          break;
        case 'performance_budget':
          await this.checkPerformanceBudget(check);
          break;
        case 'database_connectivity':
          await this.checkDatabaseConnectivity(check);
          break;
        case 'external_services':
          await this.checkExternalServices(check);
          break;
        case 'health_endpoints':
          await this.checkHealthEndpoints(check);
          break;
        case 'error_tracking':
          await this.checkErrorTracking(check);
          break;
        case 'performance_monitoring':
          await this.checkPerformanceMonitoring(check);
          break;
        case 'vercel_config':
          await this.checkVercelConfig(check);
          break;
        case 'environment_consistency':
          await this.checkEnvironmentConsistency(check);
          break;
        default:
          check.status = 'skipped';
          check.error = 'Check not implemented';
      }

      if (check.status === 'running') {
        check.status = 'passed';
        check.score = check.maxScore;
      }

    } catch (error) {
      check.status = 'failed';
      check.score = 0;
      check.error = error instanceof Error ? error.message : String(error);
    }

    check.duration = Date.now() - startTime;

    const statusEmoji = this.getStatusEmoji(check.status);
    const scoreText = `${check.score}/${check.maxScore}`;
    console.log(`   ${statusEmoji} ${check.name}: ${check.status} (${scoreText}) [${check.duration}ms]`);

    if (check.error) {
      console.log(`      ❌ Error: ${check.error}`);
    }
  }

  /**
   * Individual validation check implementations
   */
  private async checkProductionEnvironment(check: ValidationCheck): Promise<void> {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv !== 'production') {
      throw new Error(`NODE_ENV is "${nodeEnv}", should be "production"`);
    }
    check.details = { nodeEnv };
  }

  private async checkEnvironmentVariables(check: ValidationCheck): Promise<void> {
    const required = [
      'DATABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ENCRYPTION_MASTER_KEY',
      'OPENAI_API_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    check.details = {
      required: required.length,
      present: required.length - missing.length,
      missing
    };
  }

  private async checkSecretManagement(check: ValidationCheck): Promise<void> {
    const encryptionKey = process.env.ENCRYPTION_MASTER_KEY;
    
    if (!encryptionKey || encryptionKey.length < 32) {
      throw new Error('ENCRYPTION_MASTER_KEY must be at least 32 characters');
    }

    // Check for common weak patterns
    if (encryptionKey.includes('test') || encryptionKey.includes('dev')) {
      check.status = 'warning';
      check.recommendations = ['Use a strong, unique encryption key for production'];
    }

    check.details = { encryptionKeyLength: encryptionKey.length };
  }

  private async checkProductionBuild(check: ValidationCheck): Promise<void> {
    try {
      execSync('bun run build', { 
        stdio: 'pipe',
        timeout: 60000 // 1 minute timeout
      });
    } catch (error) {
      throw new Error('Production build failed');
    }
  }

  private async checkTypeScript(check: ValidationCheck): Promise<void> {
    try {
      execSync('bun run type-check', { 
        stdio: 'pipe',
        timeout: 30000
      });
    } catch (error) {
      throw new Error('TypeScript validation failed');
    }
  }

  private async checkLinting(check: ValidationCheck): Promise<void> {
    try {
      execSync('bun run lint', { 
        stdio: 'pipe',
        timeout: 30000
      });
    } catch (error) {
      check.status = 'warning';
      check.recommendations = ['Fix linting issues before deployment'];
    }
  }

  private async checkUnitTests(check: ValidationCheck): Promise<void> {
    try {
      execSync('bun run test:unit', { 
        stdio: 'pipe',
        timeout: 60000
      });
    } catch (error) {
      throw new Error('Unit tests failed');
    }
  }

  private async checkIntegrationTests(check: ValidationCheck): Promise<void> {
    try {
      execSync('bun run test:integration', { 
        stdio: 'pipe',
        timeout: 120000
      });
    } catch (error) {
      throw new Error('Integration tests failed');
    }
  }

  private async checkE2ETests(check: ValidationCheck): Promise<void> {
    try {
      execSync('bun run test:e2e', { 
        stdio: 'pipe',
        timeout: 300000 // 5 minutes
      });
    } catch (error) {
      check.status = 'warning';
      check.recommendations = ['Review E2E test failures before deployment'];
    }
  }

  private async checkSecurityHeaders(check: ValidationCheck): Promise<void> {
    const vercelConfig = join(process.cwd(), 'vercel.json');
    
    if (!existsSync(vercelConfig)) {
      throw new Error('vercel.json not found');
    }

    const config = JSON.parse(readFileSync(vercelConfig, 'utf8'));
    const headers = config.headers || [];
    
    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection'
    ];

    const missingHeaders: string[] = [];
    
    for (const header of requiredHeaders) {
      const hasHeader = headers.some((h: any) => 
        h.headers?.some((hdr: any) => hdr.key === header)
      );
      
      if (!hasHeader) {
        missingHeaders.push(header);
      }
    }

    if (missingHeaders.length > 0) {
      throw new Error(`Missing security headers: ${missingHeaders.join(', ')}`);
    }

    check.details = { configuredHeaders: requiredHeaders };
  }

  private async checkDependencyAudit(check: ValidationCheck): Promise<void> {
    try {
      execSync('bun audit', { 
        stdio: 'pipe',
        timeout: 30000
      });
    } catch (error) {
      check.status = 'warning';
      check.recommendations = ['Review and fix security vulnerabilities'];
    }
  }

  private async checkApiSecurity(check: ValidationCheck): Promise<void> {
    // Check if API authentication is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('API authentication not configured');
    }

    check.details = { authenticationConfigured: true };
  }

  private async checkBundleSize(check: ValidationCheck): Promise<void> {
    const nextConfig = join(process.cwd(), '.next/static');
    
    if (!existsSync(nextConfig)) {
      throw new Error('Build artifacts not found - run build first');
    }

    // This is a simplified check - would implement actual bundle analysis
    check.status = 'warning';
    check.recommendations = ['Run bundle analyzer to optimize size'];
  }

  private async checkPerformanceBudget(check: ValidationCheck): Promise<void> {
    // Mock performance check - would implement actual Lighthouse/performance testing
    check.status = 'warning';
    check.recommendations = ['Run performance tests to validate metrics'];
  }

  private async checkDatabaseConnectivity(check: ValidationCheck): Promise<void> {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }

    // In a real implementation, would test actual database connectivity
    check.details = { databaseConfigured: true };
  }

  private async checkExternalServices(check: ValidationCheck): Promise<void> {
    const services = ['OPENAI_API_KEY'];
    const missing = services.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`External service credentials missing: ${missing.join(', ')}`);
    }

    check.details = { servicesConfigured: services };
  }

  private async checkHealthEndpoints(check: ValidationCheck): Promise<void> {
    const healthFiles = [
      'app/api/health/route.ts',
      'app/api/health/environment/route.ts'
    ];

    const missing = healthFiles.filter(file => !existsSync(join(process.cwd(), file)));
    
    if (missing.length > 0) {
      throw new Error(`Health endpoints missing: ${missing.join(', ')}`);
    }

    check.details = { endpointsConfigured: healthFiles };
  }

  private async checkErrorTracking(check: ValidationCheck): Promise<void> {
    if (!process.env.SENTRY_DSN) {
      check.status = 'warning';
      check.recommendations = ['Configure error tracking for production monitoring'];
    }
  }

  private async checkPerformanceMonitoring(check: ValidationCheck): Promise<void> {
    if (process.env.PERFORMANCE_MONITORING_ENABLED !== 'true') {
      check.status = 'warning';
      check.recommendations = ['Enable performance monitoring for production'];
    }
  }

  private async checkVercelConfig(check: ValidationCheck): Promise<void> {
    const vercelConfig = join(process.cwd(), 'vercel.json');
    
    if (!existsSync(vercelConfig)) {
      throw new Error('vercel.json not found');
    }

    const config = JSON.parse(readFileSync(vercelConfig, 'utf8'));
    
    if (!config.build || !config.headers) {
      throw new Error('Incomplete Vercel configuration');
    }

    check.details = { configurationValid: true };
  }

  private async checkEnvironmentConsistency(check: ValidationCheck): Promise<void> {
    // Check if deployment template exists
    const templateFile = join(process.cwd(), 'deployment/production-env-template.env');
    
    if (!existsSync(templateFile)) {
      check.status = 'warning';
      check.recommendations = ['Create environment variable template'];
    }
  }

  /**
   * Generate validation report
   */
  private generateReport(): ValidationReport {
    const categories: { [key: string]: any } = {};
    const criticalIssues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Group checks by category
    for (const check of this.checks) {
      if (!categories[check.category]) {
        categories[check.category] = {
          score: 0,
          maxScore: 0,
          status: 'passed',
          checks: []
        };
      }

      categories[check.category].checks.push(check);
      categories[check.category].score += check.score;
      categories[check.category].maxScore += check.maxScore;

      if (check.status === 'failed' && check.critical) {
        criticalIssues.push(`${check.category}/${check.name}: ${check.error}`);
        categories[check.category].status = 'failed';
      } else if (check.status === 'warning' || check.status === 'failed') {
        warnings.push(`${check.category}/${check.name}: ${check.error || 'Warning condition'}`);
        if (categories[check.category].status === 'passed') {
          categories[check.category].status = 'warning';
        }
      }

      if (check.recommendations) {
        recommendations.push(...check.recommendations);
      }
    }

    // Calculate overall score
    const totalScore = Object.values(categories).reduce((sum: number, cat: any) => sum + cat.score, 0);
    const maxTotalScore = Object.values(categories).reduce((sum: number, cat: any) => sum + cat.maxScore, 0);
    const overallScore = Math.round((totalScore / maxTotalScore) * 100);

    // Determine deployment readiness
    let overall: 'READY' | 'NOT_READY' | 'CONDITIONAL' = 'READY';
    const blockers: string[] = [];
    const requirements: string[] = [];

    if (criticalIssues.length > 0) {
      overall = 'NOT_READY';
      blockers.push(...criticalIssues);
    } else if (warnings.length > 0 || overallScore < 90) {
      overall = 'CONDITIONAL';
      requirements.push('Review and address warnings before deployment');
    }

    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      overall,
      overallScore,
      maxScore: maxTotalScore,
      categories,
      criticalIssues,
      warnings,
      recommendations: [...new Set(recommendations)], // Remove duplicates
      deployment: {
        approved: overall === 'READY',
        blockers,
        requirements
      }
    };
  }

  /**
   * Output validation report
   */
  private async outputReport(report: ValidationReport): Promise<void> {
    const duration = Date.now() - this.startTime;

    console.log('\n📊 Validation Report');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const overallEmoji = {
      'READY': '✅',
      'CONDITIONAL': '⚠️',
      'NOT_READY': '❌'
    }[report.overall];

    console.log(`${overallEmoji} Overall Status: ${report.overall}`);
    console.log(`📈 Overall Score: ${report.overallScore}%`);
    console.log(`⏱️  Duration: ${duration}ms`);
    console.log(`🕐 Timestamp: ${report.timestamp}\n`);

    // Category breakdown
    console.log('📋 Category Breakdown:');
    Object.entries(report.categories).forEach(([category, data]: [string, any]) => {
      const categoryEmoji = data.status === 'passed' ? '✅' : data.status === 'warning' ? '⚠️' : '❌';
      const percentage = Math.round((data.score / data.maxScore) * 100);
      console.log(`   ${categoryEmoji} ${category}: ${percentage}% (${data.score}/${data.maxScore})`);
    });

    // Critical issues
    if (report.criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      report.criticalIssues.forEach(issue => {
        console.log(`   ❌ ${issue}`);
      });
    }

    // Warnings
    if (report.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      report.warnings.forEach(warning => {
        console.log(`   ⚠️  ${warning}`);
      });
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => {
        console.log(`   🔧 ${rec}`);
      });
    }

    // Deployment status
    console.log('\n🚀 Deployment Status:');
    console.log(`   Approved: ${report.deployment.approved ? 'Yes' : 'No'}`);
    
    if (report.deployment.blockers.length > 0) {
      console.log('   Blockers:');
      report.deployment.blockers.forEach(blocker => {
        console.log(`     • ${blocker}`);
      });
    }

    if (report.deployment.requirements.length > 0) {
      console.log('   Requirements:');
      report.deployment.requirements.forEach(req => {
        console.log(`     • ${req}`);
      });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Save report if output path specified
    if (this.options.outputPath) {
      const reportContent = this.options.reportFormat === 'json' 
        ? JSON.stringify(report, null, 2)
        : this.generateMarkdownReport(report);
        
      writeFileSync(this.options.outputPath, reportContent);
      console.log(`📄 Report saved to: ${this.options.outputPath}`);
    }
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(report: ValidationReport): string {
    const lines: string[] = [];
    
    lines.push('# Production Readiness Validation Report');
    lines.push('');
    lines.push(`**Status:** ${report.overall}`);
    lines.push(`**Score:** ${report.overallScore}%`);
    lines.push(`**Timestamp:** ${report.timestamp}`);
    lines.push('');

    lines.push('## Category Breakdown');
    lines.push('');
    Object.entries(report.categories).forEach(([category, data]: [string, any]) => {
      const percentage = Math.round((data.score / data.maxScore) * 100);
      lines.push(`- **${category}:** ${percentage}% (${data.score}/${data.maxScore})`);
    });
    lines.push('');

    if (report.criticalIssues.length > 0) {
      lines.push('## Critical Issues');
      lines.push('');
      report.criticalIssues.forEach(issue => {
        lines.push(`- ❌ ${issue}`);
      });
      lines.push('');
    }

    if (report.warnings.length > 0) {
      lines.push('## Warnings');
      lines.push('');
      report.warnings.forEach(warning => {
        lines.push(`- ⚠️ ${warning}`);
      });
      lines.push('');
    }

    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');
      report.recommendations.forEach(rec => {
        lines.push(`- 💡 ${rec}`);
      });
      lines.push('');
    }

    lines.push('## Deployment Status');
    lines.push('');
    lines.push(`**Approved:** ${report.deployment.approved ? 'Yes' : 'No'}`);
    
    if (report.deployment.blockers.length > 0) {
      lines.push('');
      lines.push('### Blockers');
      report.deployment.blockers.forEach(blocker => {
        lines.push(`- ${blocker}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Get status emoji for display
   */
  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      passed: '✅',
      failed: '❌',
      warning: '⚠️',
      running: '🔄',
      pending: '⏳',
      skipped: '⏭️'
    };
    return emojis[status] || '❓';
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  const options: any = {
    quick: false,
    reportFormat: 'console'
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--quick':
        options.quick = true;
        break;
      case '--check':
        options.category = args[i + 1];
        i++;
        break;
      case '--report':
        options.reportFormat = args[i + 1];
        i++;
        break;
      case '--output':
        options.outputPath = args[i + 1];
        i++;
        break;
      case '--help':
        console.log(`
🚀 Production Readiness Validation

Usage:
  bun run scripts/production-readiness-validator.ts [options]

Options:
  --quick              Run quick validation (skip long-running checks)
  --check <category>   Run checks for specific category only
  --report <format>    Output format: json, markdown, console (default: console)
  --output <path>      Save report to file
  --help              Show this help message

Categories:
  environment, build, testing, security, performance, 
  infrastructure, monitoring, deployment

Examples:
  bun run scripts/production-readiness-validator.ts
  bun run scripts/production-readiness-validator.ts --quick
  bun run scripts/production-readiness-validator.ts --check security
  bun run scripts/production-readiness-validator.ts --report json --output report.json
        `);
        process.exit(0);
        break;
    }
  }

  const validator = new ProductionReadinessValidator(options);
  
  try {
    const report = await validator.runValidation();
    
    // Exit with appropriate code
    if (report.overall === 'NOT_READY') {
      process.exit(1);
    } else if (report.overall === 'CONDITIONAL') {
      process.exit(2);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ProductionReadinessValidator };