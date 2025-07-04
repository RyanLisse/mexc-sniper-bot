#!/usr/bin/env bun
/**
 * Production Configuration Validator
 * 
 * Comprehensive validation of production configuration including environment variables,
 * security settings, performance optimizations, and deployment readiness.
 * 
 * Usage:
 *   bun run scripts/production-config-validator.ts [--fix] [--export-template]
 *   bun run scripts/production-config-validator.ts --security-only
 *   bun run scripts/production-config-validator.ts --performance-only
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

interface ValidationRule {
  key: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'url' | 'email' | 'base64' | 'json';
  description: string;
  validation?: (value: string) => boolean;
  recommendation?: string;
  security?: boolean;
  performance?: boolean;
}

interface ValidationResult {
  key: string;
  status: 'pass' | 'fail' | 'warning' | 'missing';
  value?: string;
  maskedValue?: string;
  error?: string;
  recommendation?: string;
  security: boolean;
  performance: boolean;
}

interface ConfigValidationReport {
  overall: 'pass' | 'fail' | 'warning';
  timestamp: string;
  environment: string;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  missing: number;
  securityScore: number;
  performanceScore: number;
  results: ValidationResult[];
  recommendations: string[];
  criticalIssues: string[];
}

class ProductionConfigValidator {
  private rules: ValidationRule[] = [
    // Core Application Configuration
    {
      key: 'NODE_ENV',
      required: true,
      type: 'string',
      description: 'Node.js environment mode',
      validation: (value) => value === 'production',
      recommendation: 'Must be set to "production" for production deployments',
      security: true,
      performance: true
    },
    {
      key: 'ENVIRONMENT',
      required: true,
      type: 'string',
      description: 'Application environment identifier',
      validation: (value) => ['production', 'staging'].includes(value),
      recommendation: 'Should be "production" for live deployments',
      security: true,
      performance: false
    },

    // Security & Authentication
    {
      key: 'ENCRYPTION_MASTER_KEY',
      required: true,
      type: 'base64',
      description: 'Master encryption key for sensitive data',
      validation: (value) => {
        try {
          const decoded = Buffer.from(value, 'base64');
          return decoded.length >= 32; // At least 256 bits
        } catch {
          return false;
        }
      },
      recommendation: 'Generate with: openssl rand -base64 32',
      security: true,
      performance: false
    },
    {
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      required: true,
      type: 'url',
      description: 'Supabase project URL',
      validation: (value) => value.startsWith('https://') && value.includes('.supabase.co'),
      recommendation: 'Must be a valid Supabase project URL',
      security: true,
      performance: false
    },
    {
      key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      required: true,
      type: 'string',
      description: 'Supabase anonymous key',
      validation: (value) => value.startsWith('eyJ') && value.length > 100,
      recommendation: 'Must be a valid Supabase JWT token',
      security: true,
      performance: false
    },
    {
      key: 'SUPABASE_SERVICE_ROLE_KEY',
      required: true,
      type: 'string',
      description: 'Supabase service role key',
      validation: (value) => value.startsWith('eyJ') && value.length > 100,
      recommendation: 'Must be a valid Supabase service role JWT',
      security: true,
      performance: false
    },

    // AI Services
    {
      key: 'OPENAI_API_KEY',
      required: true,
      type: 'string',
      description: 'OpenAI API key for AI services',
      validation: (value) => value.startsWith('sk-') && value.length > 40,
      recommendation: 'Must be a valid OpenAI API key',
      security: true,
      performance: false
    },
    {
      key: 'ANTHROPIC_API_KEY',
      required: false,
      type: 'string',
      description: 'Anthropic API key for enhanced AI capabilities',
      validation: (value) => value.startsWith('sk-ant-') && value.length > 40,
      recommendation: 'Optional - enables Claude AI features',
      security: true,
      performance: false
    },
    {
      key: 'PERPLEXITY_API_KEY',
      required: false,
      type: 'string',
      description: 'Perplexity API key for research capabilities',
      validation: (value) => value.startsWith('pplx-') && value.length > 40,
      recommendation: 'Optional - enables research-backed analysis',
      security: true,
      performance: false
    },

    // Database Configuration
    {
      key: 'DATABASE_URL',
      required: true,
      type: 'string',
      description: 'Production database connection string',
      validation: (value) => value.startsWith('postgresql://') && value.includes('@'),
      recommendation: 'Must be a valid PostgreSQL connection string',
      security: true,
      performance: true
    },
    {
      key: 'NEON_API_KEY',
      required: false,
      type: 'string',
      description: 'Neon API key for database management',
      validation: (value) => value.startsWith('napi_') && value.length > 40,
      recommendation: 'Optional - enables advanced database features',
      security: true,
      performance: false
    },

    // Trading Configuration (Optional)
    {
      key: 'MEXC_API_KEY',
      required: false,
      type: 'string',
      description: 'MEXC API key for live trading',
      validation: (value) => value.startsWith('mx_') && value.length > 30,
      recommendation: 'Optional - required only for live trading features',
      security: true,
      performance: false
    },
    {
      key: 'MEXC_SECRET_KEY',
      required: false,
      type: 'string',
      description: 'MEXC secret key for live trading',
      validation: (value) => value.length > 30,
      recommendation: 'Optional - required only for live trading features',
      security: true,
      performance: false
    },

    // Performance & Monitoring
    {
      key: 'TRACING_ENABLED',
      required: false,
      type: 'boolean',
      description: 'OpenTelemetry tracing enabled',
      validation: (value) => ['true', 'false'].includes(value.toLowerCase()),
      recommendation: 'Enable for production monitoring',
      security: false,
      performance: true
    },
    {
      key: 'METRICS_ENABLED',
      required: false,
      type: 'boolean',
      description: 'Performance metrics collection enabled',
      validation: (value) => ['true', 'false'].includes(value.toLowerCase()),
      recommendation: 'Enable for production monitoring',
      security: false,
      performance: true
    },
    {
      key: 'PERFORMANCE_MONITORING_ENABLED',
      required: false,
      type: 'boolean',
      description: 'Application performance monitoring enabled',
      validation: (value) => ['true', 'false'].includes(value.toLowerCase()),
      recommendation: 'Enable for production performance tracking',
      security: false,
      performance: true
    },
    {
      key: 'CACHE_ENABLED',
      required: false,
      type: 'boolean',
      description: 'Application caching enabled',
      validation: (value) => ['true', 'false'].includes(value.toLowerCase()),
      recommendation: 'Enable for better performance',
      security: false,
      performance: true
    },

    // External Services
    {
      key: 'REDIS_URL',
      required: false,
      type: 'string',
      description: 'Redis connection URL for caching',
      validation: (value) => value.startsWith('redis://') || value.startsWith('rediss://'),
      recommendation: 'Optional - improves performance with caching',
      security: false,
      performance: true
    },
    {
      key: 'SENTRY_DSN',
      required: false,
      type: 'string',
      description: 'Sentry DSN for error tracking',
      validation: (value) => value.startsWith('https://') && value.includes('@sentry.io'),
      recommendation: 'Recommended for production error monitoring',
      security: false,
      performance: false
    },

    // Workflow Engine
    {
      key: 'INNGEST_SIGNING_KEY',
      required: false,
      type: 'string',
      description: 'Inngest signing key for workflow engine',
      validation: (value) => value.startsWith('signkey-') && value.length > 40,
      recommendation: 'Required for workflow automation features',
      security: true,
      performance: false
    },
    {
      key: 'INNGEST_EVENT_KEY',
      required: false,
      type: 'string',
      description: 'Inngest event key for workflow triggers',
      validation: (value) => value.length > 30,
      recommendation: 'Required for workflow automation features',
      security: true,
      performance: false
    },

    // Feature Flags
    {
      key: 'ENABLE_LIVE_TRADING',
      required: false,
      type: 'boolean',
      description: 'Enable live trading functionality',
      validation: (value) => ['true', 'false'].includes(value.toLowerCase()),
      recommendation: 'Enable only after thorough testing',
      security: true,
      performance: false
    },
    {
      key: 'ENABLE_AUTO_SNIPING',
      required: false,
      type: 'boolean',
      description: 'Enable automated sniping features',
      validation: (value) => ['true', 'false'].includes(value.toLowerCase()),
      recommendation: 'Enable only with proper risk management',
      security: true,
      performance: false
    }
  ];

  /**
   * Validate production configuration
   */
  async validateConfiguration(options: {
    securityOnly?: boolean;
    performanceOnly?: boolean;
    fix?: boolean;
  } = {}): Promise<ConfigValidationReport> {
    console.log('🔍 Production Configuration Validator');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const startTime = Date.now();
    const results: ValidationResult[] = [];
    const recommendations: string[] = [];
    const criticalIssues: string[] = [];

    // Filter rules based on options
    let rulesToCheck = this.rules;
    if (options.securityOnly) {
      rulesToCheck = this.rules.filter(rule => rule.security);
    } else if (options.performanceOnly) {
      rulesToCheck = this.rules.filter(rule => rule.performance);
    }

    console.log(`📋 Checking ${rulesToCheck.length} configuration items...\n`);

    // Validate each rule
    for (const rule of rulesToCheck) {
      const result = this.validateRule(rule);
      results.push(result);

      // Display result
      const statusEmoji = {
        pass: '✅',
        fail: '❌',
        warning: '⚠️',
        missing: '🔍'
      }[result.status];

      const typeLabel = rule.security && rule.performance ? '🔒⚡' : 
                       rule.security ? '🔒' : 
                       rule.performance ? '⚡' : '📝';

      console.log(`${statusEmoji} ${typeLabel} ${rule.key}: ${result.status.toUpperCase()}`);
      console.log(`   ${rule.description}`);
      
      if (result.maskedValue && result.status === 'pass') {
        console.log(`   Value: ${result.maskedValue}`);
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.recommendation) {
        console.log(`   💡 ${result.recommendation}`);
      }
      
      console.log();

      // Collect recommendations and critical issues
      if (result.recommendation) {
        recommendations.push(`${rule.key}: ${result.recommendation}`);
      }

      if (rule.required && result.status === 'missing') {
        criticalIssues.push(`Missing required configuration: ${rule.key}`);
      }

      if (rule.required && result.status === 'fail') {
        criticalIssues.push(`Invalid configuration: ${rule.key} - ${result.error}`);
      }
    }

    // Calculate scores
    const totalChecks = results.length;
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    const missing = results.filter(r => r.status === 'missing').length;

    const securityResults = results.filter(r => r.security);
    const securityPassed = securityResults.filter(r => r.status === 'pass').length;
    const securityScore = securityResults.length > 0 ? 
      Math.round((securityPassed / securityResults.length) * 100) : 100;

    const performanceResults = results.filter(r => r.performance);
    const performancePassed = performanceResults.filter(r => r.status === 'pass').length;
    const performanceScore = performanceResults.length > 0 ? 
      Math.round((performancePassed / performanceResults.length) * 100) : 100;

    // Determine overall status
    let overall: 'pass' | 'fail' | 'warning' = 'pass';
    if (criticalIssues.length > 0 || failed > 0) {
      overall = 'fail';
    } else if (warnings > 0 || missing > 0) {
      overall = 'warning';
    }

    const report: ConfigValidationReport = {
      overall,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      totalChecks,
      passed,
      failed,
      warnings,
      missing,
      securityScore,
      performanceScore,
      results,
      recommendations,
      criticalIssues
    };

    this.displaySummary(report);

    // Auto-fix if requested
    if (options.fix && criticalIssues.length === 0) {
      await this.autoFixConfiguration(results);
    }

    return report;
  }

  /**
   * Validate individual rule
   */
  private validateRule(rule: ValidationRule): ValidationResult {
    const value = process.env[rule.key];

    // Check if missing
    if (!value) {
      return {
        key: rule.key,
        status: rule.required ? 'missing' : 'warning',
        error: rule.required ? 'Required environment variable not set' : 'Optional environment variable not set',
        recommendation: rule.recommendation,
        security: rule.security || false,
        performance: rule.performance || false
      };
    }

    // Type validation
    let typeValid = true;
    let typeError = '';

    switch (rule.type) {
      case 'url':
        try {
          new URL(value);
        } catch {
          typeValid = false;
          typeError = 'Invalid URL format';
        }
        break;
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          typeValid = false;
          typeError = 'Invalid email format';
        }
        break;
      case 'boolean':
        if (!['true', 'false', '1', '0'].includes(value.toLowerCase())) {
          typeValid = false;
          typeError = 'Must be true/false or 1/0';
        }
        break;
      case 'number':
        if (isNaN(Number(value))) {
          typeValid = false;
          typeError = 'Must be a valid number';
        }
        break;
      case 'base64':
        try {
          Buffer.from(value, 'base64');
        } catch {
          typeValid = false;
          typeError = 'Invalid base64 encoding';
        }
        break;
      case 'json':
        try {
          JSON.parse(value);
        } catch {
          typeValid = false;
          typeError = 'Invalid JSON format';
        }
        break;
    }

    if (!typeValid) {
      return {
        key: rule.key,
        status: 'fail',
        value,
        maskedValue: this.maskSensitiveValue(rule.key, value),
        error: typeError,
        recommendation: rule.recommendation,
        security: rule.security || false,
        performance: rule.performance || false
      };
    }

    // Custom validation
    if (rule.validation && !rule.validation(value)) {
      return {
        key: rule.key,
        status: 'fail',
        value,
        maskedValue: this.maskSensitiveValue(rule.key, value),
        error: 'Custom validation failed',
        recommendation: rule.recommendation,
        security: rule.security || false,
        performance: rule.performance || false
      };
    }

    return {
      key: rule.key,
      status: 'pass',
      value,
      maskedValue: this.maskSensitiveValue(rule.key, value),
      security: rule.security || false,
      performance: rule.performance || false
    };
  }

  /**
   * Mask sensitive values for display
   */
  private maskSensitiveValue(key: string, value: string): string {
    const sensitiveKeys = [
      'KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'DSN', 'URL'
    ];

    const isSensitive = sensitiveKeys.some(sensitive => 
      key.toUpperCase().includes(sensitive)
    );

    if (!isSensitive) {
      return value;
    }

    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }

    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  }

  /**
   * Auto-fix configuration issues
   */
  private async autoFixConfiguration(results: ValidationResult[]): Promise<void> {
    console.log('\n🔧 Auto-fixing configuration issues...');

    const fixes: string[] = [];

    // Generate missing encryption key
    const encryptionResult = results.find(r => r.key === 'ENCRYPTION_MASTER_KEY');
    if (encryptionResult && encryptionResult.status === 'missing') {
      const newKey = crypto.randomBytes(32).toString('base64');
      fixes.push(`ENCRYPTION_MASTER_KEY=${newKey}`);
      console.log('   ✅ Generated new encryption master key');
    }

    // Set default environment variables
    const defaultFixes = {
      'NODE_ENV': 'production',
      'ENVIRONMENT': 'production',
      'TRACING_ENABLED': 'true',
      'METRICS_ENABLED': 'true',
      'PERFORMANCE_MONITORING_ENABLED': 'true',
      'CACHE_ENABLED': 'true',
      'ENABLE_LIVE_TRADING': 'false',
      'ENABLE_AUTO_SNIPING': 'false'
    };

    for (const [key, defaultValue] of Object.entries(defaultFixes)) {
      const result = results.find(r => r.key === key);
      if (result && (result.status === 'missing' || result.status === 'fail')) {
        fixes.push(`${key}=${defaultValue}`);
        console.log(`   ✅ Set ${key} to default value: ${defaultValue}`);
      }
    }

    if (fixes.length > 0) {
      const envContent = fixes.join('\n') + '\n';
      writeFileSync('.env.production.generated', envContent);
      console.log(`\n💾 Generated .env.production.generated with ${fixes.length} fixes`);
      console.log('   Review and merge these values into your production configuration');
    } else {
      console.log('   No auto-fixes available');
    }
  }

  /**
   * Export configuration template
   */
  exportTemplate(): void {
    console.log('📄 Generating production configuration template...');

    const template = [
      '# Production Environment Configuration Template',
      '# Generated by Production Config Validator',
      '# ',
      '# SECURITY WARNING: Replace all placeholder values with actual production values',
      '# NEVER commit actual production secrets to version control',
      '',
      '# ==================== CRITICAL PRODUCTION VARIABLES ====================',
      ''
    ];

    const groupedRules = {
      'Core Application': this.rules.filter(r => ['NODE_ENV', 'ENVIRONMENT'].includes(r.key)),
      'Security & Authentication': this.rules.filter(r => r.security && !r.performance),
      'Database': this.rules.filter(r => r.key.includes('DATABASE') || r.key.includes('NEON')),
      'AI Services': this.rules.filter(r => r.key.includes('OPENAI') || r.key.includes('ANTHROPIC') || r.key.includes('PERPLEXITY')),
      'Trading (Optional)': this.rules.filter(r => r.key.includes('MEXC')),
      'Performance & Monitoring': this.rules.filter(r => r.performance),
      'External Services': this.rules.filter(r => ['REDIS_URL', 'SENTRY_DSN'].includes(r.key)),
      'Workflow Engine': this.rules.filter(r => r.key.includes('INNGEST')),
      'Feature Flags': this.rules.filter(r => r.key.startsWith('ENABLE_'))
    };

    for (const [groupName, rules] of Object.entries(groupedRules)) {
      if (rules.length === 0) continue;

      template.push(`# ${groupName}`);
      
      for (const rule of rules) {
        template.push(`# ${rule.description}`);
        if (rule.recommendation) {
          template.push(`# ${rule.recommendation}`);
        }
        
        let exampleValue = 'YOUR_VALUE_HERE';
        if (rule.type === 'boolean') exampleValue = 'true';
        if (rule.type === 'number') exampleValue = '1000';
        if (rule.type === 'base64') exampleValue = 'YOUR_BASE64_KEY_HERE';
        if (rule.key.includes('URL')) exampleValue = 'https://your-service.com';
        if (rule.key.includes('KEY') && rule.key.includes('OPENAI')) exampleValue = 'sk-your-openai-key';
        if (rule.key.includes('SUPABASE_URL')) exampleValue = 'https://your-project.supabase.co';

        const required = rule.required ? '' : '# ';
        template.push(`${required}${rule.key}=${exampleValue}`);
        template.push('');
      }
    }

    template.push('# ==================== DEPLOYMENT INSTRUCTIONS ====================');
    template.push('# 1. Replace all placeholder values with actual production values');
    template.push('# 2. Validate configuration: bun run scripts/production-config-validator.ts');
    template.push('# 3. Deploy: bun run scripts/deploy-production.ts');

    const templateContent = template.join('\n');
    writeFileSync('production.env.template', templateContent);
    
    console.log('✅ Template exported to: production.env.template');
  }

  /**
   * Display validation summary
   */
  private displaySummary(report: ConfigValidationReport): void {
    console.log('\n📊 Configuration Validation Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const overallEmoji = {
      pass: '✅',
      warning: '⚠️',
      fail: '❌'
    }[report.overall];

    console.log(`${overallEmoji} Overall Status: ${report.overall.toUpperCase()}`);
    console.log(`📈 Results: ${report.passed}/${report.totalChecks} passed`);
    console.log(`🔒 Security Score: ${report.securityScore}%`);
    console.log(`⚡ Performance Score: ${report.performanceScore}%`);
    
    if (report.failed > 0) {
      console.log(`❌ Failed: ${report.failed}`);
    }
    if (report.warnings > 0) {
      console.log(`⚠️  Warnings: ${report.warnings}`);
    }
    if (report.missing > 0) {
      console.log(`🔍 Missing: ${report.missing}`);
    }

    if (report.criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      for (const issue of report.criticalIssues) {
        console.log(`   ❌ ${issue}`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const rec of report.recommendations.slice(0, 5)) {
        console.log(`   🔧 ${rec}`);
      }
      if (report.recommendations.length > 5) {
        console.log(`   ... and ${report.recommendations.length - 5} more`);
      }
    }

    console.log(`\n⏱️  Validation completed in ${Date.now() - Date.parse(report.timestamp)}ms`);
    
    if (report.overall === 'pass') {
      console.log('🎉 Configuration is ready for production deployment!');
    } else if (report.overall === 'warning') {
      console.log('⚠️  Configuration has warnings but can proceed with caution');
    } else {
      console.log('❌ Configuration has critical issues that must be resolved');
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  let securityOnly = false;
  let performanceOnly = false;
  let fix = false;
  let exportTemplate = false;

  // Parse command line arguments
  for (const arg of args) {
    switch (arg) {
      case '--security-only':
        securityOnly = true;
        break;
      case '--performance-only':
        performanceOnly = true;
        break;
      case '--fix':
        fix = true;
        break;
      case '--export-template':
        exportTemplate = true;
        break;
      case '--help':
        console.log(`
🔍 Production Configuration Validator

Usage:
  bun run scripts/production-config-validator.ts [options]

Options:
  --security-only      Validate security configurations only
  --performance-only   Validate performance configurations only
  --fix               Auto-fix configuration issues where possible
  --export-template   Export configuration template
  --help              Show this help message

Examples:
  bun run scripts/production-config-validator.ts
  bun run scripts/production-config-validator.ts --security-only
  bun run scripts/production-config-validator.ts --fix
  bun run scripts/production-config-validator.ts --export-template
        `);
        process.exit(0);
        break;
    }
  }

  const validator = new ProductionConfigValidator();
  
  try {
    if (exportTemplate) {
      validator.exportTemplate();
      return;
    }

    const report = await validator.validateConfiguration({
      securityOnly,
      performanceOnly,
      fix
    });
    
    // Exit with appropriate code
    if (report.overall === 'fail') {
      process.exit(1);
    } else if (report.overall === 'warning') {
      process.exit(2);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('\n💥 Validation error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}