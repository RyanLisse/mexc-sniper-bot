#!/usr/bin/env bun
/**
 * Environment Setup Script
 * 
 * Interactive script to help developers set up their environment variables
 * with validation, templates, and health checking.
 * 
 * Usage:
 *   bun run scripts/environment-setup.ts
 *   bun run scripts/environment-setup.ts --check
 *   bun run scripts/environment-setup.ts --template
 *   bun run scripts/environment-setup.ts --validate [var1,var2,...]
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { environmentValidation } from '../src/services/enhanced-environment-validation';

interface SetupOptions {
  check?: boolean;
  template?: boolean;
  validate?: string[];
  interactive?: boolean;
  force?: boolean;
}

class EnvironmentSetup {
  private projectRoot: string;
  private envLocalPath: string;
  private templatePath: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.envLocalPath = join(this.projectRoot, '.env.local');
    this.templatePath = join(this.projectRoot, '.env.development.template');
  }

  /**
   * Main setup function
   */
  async setup(options: SetupOptions = {}) {
    console.log('🚀 MEXC Sniper Bot - Environment Setup\n');

    if (options.check) {
      await this.runHealthCheck();
      return;
    }

    if (options.template) {
      await this.generateTemplate();
      return;
    }

    if (options.validate) {
      await this.validateSpecific(options.validate);
      return;
    }

    if (options.interactive) {
      await this.interactiveSetup();
      return;
    }

    // Default: comprehensive analysis
    await this.comprehensiveAnalysis();
  }

  /**
   * Run comprehensive environment analysis
   */
  private async comprehensiveAnalysis() {
    console.log('📊 Running comprehensive environment analysis...\n');
    
    const validation = environmentValidation.validateEnvironment();
    const healthSummary = environmentValidation.getHealthSummary();
    const missingByCategory = environmentValidation.getMissingByCategory();

    // Display overall status
    this.displayStatus(healthSummary);
    
    // Display summary statistics
    this.displaySummary(validation.summary);
    
    // Display missing variables by category
    this.displayMissingByCategory(missingByCategory);
    
    // Display recommendations
    this.displayRecommendations(validation.recommendations);
    
    // Show next steps
    this.displayNextSteps(validation, healthSummary);
  }

  /**
   * Run health check only
   */
  private async runHealthCheck() {
    console.log('🔍 Running environment health check...\n');
    
    const healthSummary = environmentValidation.getHealthSummary();
    
    this.displayStatus(healthSummary);
    
    if (healthSummary.issues.length > 0) {
      console.log('\n🚨 Issues Found:');
      healthSummary.issues.forEach(issue => {
        console.log(`   ❌ ${issue}`);
      });
    }
    
    if (healthSummary.recommendedActions.length > 0) {
      console.log('\n💡 Recommended Actions:');
      healthSummary.recommendedActions.forEach(action => {
        console.log(`   🔧 ${action}`);
      });
    }

    // Exit with appropriate code
    if (healthSummary.status === 'critical') {
      process.exit(1);
    } else if (healthSummary.status === 'warning') {
      process.exit(2);
    } else {
      process.exit(0);
    }
  }

  /**
   * Generate development template
   */
  private async generateTemplate() {
    console.log('📝 Generating development environment template...\n');
    
    const template = environmentValidation.generateDevelopmentTemplate();
    const validation = environmentValidation.validateEnvironment();
    
    // Write template to file
    const templateFile = join(this.projectRoot, '.env.development.generated');
    writeFileSync(templateFile, template, 'utf8');
    
    console.log(`✅ Template generated: ${templateFile}`);
    console.log(`📊 Missing variables: ${validation.summary.missing}`);
    console.log('\n📋 Setup Instructions:');
    console.log('   1. Copy .env.development.generated to .env.local');
    console.log('   2. Fill in required values marked as REQUIRED_VALUE');
    console.log('   3. Customize optional values as needed');
    console.log('   4. Run health check to verify: bun run scripts/environment-setup.ts --check');
    console.log('\n⚠️  Never commit .env.local to version control!');
  }

  /**
   * Validate specific variables
   */
  private async validateSpecific(variables: string[]) {
    console.log(`🔍 Validating specific variables: ${variables.join(', ')}\n`);
    
    const validation = environmentValidation.validateEnvironment();
    const specificResults = validation.results.filter(r => 
      variables.includes(r.key)
    );

    if (specificResults.length === 0) {
      console.log('❌ No matching variables found');
      return;
    }

    specificResults.forEach(result => {
      const status = this.getStatusEmoji(result.status);
      console.log(`${status} ${result.key}`);
      console.log(`   Category: ${result.category}`);
      console.log(`   Required: ${result.required ? 'Yes' : 'No'}`);
      
      if (result.message) {
        console.log(`   Message: ${result.message}`);
      }
      
      if (result.value && result.status === 'configured') {
        console.log(`   Value: ${result.value}`);
      }
      console.log('');
    });

    const configured = specificResults.filter(r => r.status === 'configured').length;
    console.log(`📊 Summary: ${configured}/${specificResults.length} variables configured`);
  }

  /**
   * Interactive setup (future enhancement)
   */
  private async interactiveSetup() {
    console.log('🤖 Interactive setup mode coming soon...\n');
    console.log('For now, use:');
    console.log('   bun run scripts/environment-setup.ts --template');
    console.log('   bun run scripts/environment-setup.ts --check');
  }

  /**
   * Display status with emoji
   */
  private displayStatus(healthSummary: any) {
    const statusEmoji = {
      healthy: '✅',
      warning: '⚠️',
      critical: '🚨'
    };

    const emoji = statusEmoji[healthSummary.status as keyof typeof statusEmoji] || '❓';
    console.log(`${emoji} Environment Status: ${healthSummary.status.toUpperCase()}`);
    console.log(`📊 Health Score: ${healthSummary.score}/100\n`);
  }

  /**
   * Display summary statistics
   */
  private displaySummary(summary: any) {
    console.log('📈 Configuration Summary:');
    console.log(`   Total Variables: ${summary.total}`);
    console.log(`   ✅ Configured: ${summary.configured}`);
    console.log(`   ❌ Missing: ${summary.missing}`);
    console.log(`   🚫 Invalid: ${summary.invalid}`);
    console.log(`   ⚠️  Warnings: ${summary.warnings}\n`);
  }

  /**
   * Display missing variables by category
   */
  private displayMissingByCategory(missingByCategory: any) {
    if (Object.keys(missingByCategory).length === 0) {
      console.log('🎉 All variables configured!\n');
      return;
    }

    console.log('📋 Missing Variables by Category:\n');
    
    Object.entries(missingByCategory).forEach(([category, variables]: [string, unknown]) => {
      const variablesList = variables as any[];
      console.log(`   ${category.toUpperCase()}:`);
      variablesList.forEach(variable => {
        const required = variable.required ? '[REQUIRED]' : '[OPTIONAL]';
        console.log(`     ${required} ${variable.key} - ${variable.description}`);
        if (variable.warningIfMissing) {
          console.log(`       ⚠️  ${variable.warningIfMissing}`);
        }
      });
      console.log('');
    });
  }

  /**
   * Display recommendations
   */
  private displayRecommendations(recommendations: string[]) {
    if (recommendations.length === 0) return;

    console.log('💡 Recommendations:\n');
    recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
    console.log('');
  }

  /**
   * Display next steps
   */
  private displayNextSteps(validation: any, healthSummary: any) {
    console.log('🎯 Next Steps:\n');

    if (healthSummary.status === 'critical') {
      console.log('   🚨 CRITICAL: Set required environment variables immediately');
      console.log('   📝 Generate template: bun run scripts/environment-setup.ts --template');
      console.log('   📖 See .env.example for detailed setup instructions');
    } else if (healthSummary.status === 'warning') {
      console.log('   ⚠️  RECOMMENDED: Configure optional variables for enhanced functionality');
      console.log('   📝 Generate missing template: bun run scripts/environment-setup.ts --template');
      console.log('   🔍 Regular health checks: bun run scripts/environment-setup.ts --check');
    } else {
      console.log('   ✅ Configuration is healthy!');
      console.log('   🔍 Monitor with: bun run scripts/environment-setup.ts --check');
      console.log('   🚀 Start development: npm run dev');
    }

    console.log('\n📚 Additional Resources:');
    console.log('   📖 Full setup guide: /docs/ENVIRONMENT_SETUP.md');
    console.log('   🌐 Health check API: http://localhost:3008/api/health/environment');
    console.log('   🔧 Configuration management: /src/lib/unified-configuration-management.ts');
  }

  /**
   * Get status emoji for display
   */
  private getStatusEmoji(status: string): string {
    const statusEmojis: Record<string, string> = {
      configured: '✅',
      missing: '❌',
      invalid: '🚫',
      default: '🔧'
    };
    return statusEmojis[status] || '❓';
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const options: SetupOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--check':
      case '-c':
        options.check = true;
        break;
      case '--template':
      case '-t':
        options.template = true;
        break;
      case '--validate':
      case '-v':
        options.validate = args[i + 1]?.split(',') || [];
        i++; // Skip next argument
        break;
      case '--interactive':
      case '-i':
        options.interactive = true;
        break;
      case '--force':
      case '-f':
        options.force = true;
        break;
      case '--help':
      case '-h':
        console.log(`
🚀 MEXC Sniper Bot - Environment Setup

Usage:
  bun run scripts/environment-setup.ts [options]

Options:
  --check, -c              Run environment health check only
  --template, -t           Generate development environment template
  --validate VAR1,VAR2     Validate specific variables
  --interactive, -i        Interactive setup mode
  --force, -f              Force operations (skip confirmations)
  --help, -h               Show this help message

Examples:
  bun run scripts/environment-setup.ts
  bun run scripts/environment-setup.ts --check
  bun run scripts/environment-setup.ts --template
  bun run scripts/environment-setup.ts --validate OPENAI_API_KEY,MEXC_API_KEY
        `);
        process.exit(0);
        break;
    }
  }

  const setup = new EnvironmentSetup();
  
  try {
    await setup.setup(options);
  } catch (error) {
    console.error('\n❌ Environment setup failed:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}