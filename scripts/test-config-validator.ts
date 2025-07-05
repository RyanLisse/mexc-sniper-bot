#!/usr/bin/env bun

/**
 * Test Configuration Validator
 * MISSION: Test Configuration Alignment Agent - Validation System
 * 
 * FEATURES:
 * - Validates all vitest configuration files for conflicts
 * - Checks environment variable consistency
 * - Verifies timeout alignment and setup file ordering
 * - Detects pool configuration conflicts
 * - Provides detailed conflict resolution recommendations
 * - Ensures master configuration is properly aligned
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface ConfigValidationResult {
  isValid: boolean;
  conflicts: string[];
  warnings: string[];
  recommendations: string[];
}

interface ConfigFile {
  path: string;
  exists: boolean;
  content?: string;
  parsed?: any;
}

class TestConfigValidator {
  private projectRoot: string;
  private configFiles: ConfigFile[] = [];

  constructor() {
    this.projectRoot = process.cwd();
    this.initializeConfigFiles();
  }

  private initializeConfigFiles(): void {
    const configPaths = [
      'vitest.config.master.ts',
      'vitest.config.unified.ts',
      'vitest.config.performance.ts',
      'vitest.config.integration.ts',
      'vitest.config.stability.ts',
      'vitest.config.supabase.ts',
      'vitest.config.sync.ts',
    ];

    this.configFiles = configPaths.map(path => {
      const fullPath = join(this.projectRoot, path);
      const exists = existsSync(fullPath);
      
      return {
        path,
        exists,
        content: exists ? readFileSync(fullPath, 'utf-8') : undefined,
      };
    });
  }

  public async validateConfigurations(): Promise<ConfigValidationResult> {
    console.log('🔍 Test Configuration Validation Starting...\n');

    const result: ConfigValidationResult = {
      isValid: true,
      conflicts: [],
      warnings: [],
      recommendations: [],
    };

    // Check if master config exists
    const masterConfig = this.configFiles.find(f => f.path === 'vitest.config.master.ts');
    if (!masterConfig?.exists) {
      result.isValid = false;
      result.conflicts.push('❌ Master configuration file (vitest.config.master.ts) is missing');
      result.recommendations.push('✅ Run test:config:migrate to create the master configuration');
    } else {
      console.log('✅ Master configuration file exists');
      result.recommendations.push('✅ Consider migrating to use only the master configuration');
    }

    // Check for legacy config files
    const legacyConfigs = this.configFiles.filter(f => 
      f.exists && f.path !== 'vitest.config.master.ts'
    );

    if (legacyConfigs.length > 0) {
      result.warnings.push(`⚠️  Found ${legacyConfigs.length} legacy configuration files:`);
      legacyConfigs.forEach(config => {
        result.warnings.push(`   - ${config.path}`);
      });
      result.recommendations.push('✅ After validating master config works, consider removing legacy configs');
    }

    // Validate timeout consistency
    await this.validateTimeoutConsistency(result);

    // Validate environment variables
    await this.validateEnvironmentVariables(result);

    // Validate pool configurations
    await this.validatePoolConfigurations(result);

    // Validate setup file ordering
    await this.validateSetupFileOrdering(result);

    // Check package.json script alignment
    await this.validatePackageJsonScripts(result);

    return result;
  }

  private async validateTimeoutConsistency(result: ConfigValidationResult): Promise<void> {
    console.log('🕐 Validating timeout configurations...');

    const timeoutPatterns = [
      { pattern: /testTimeout:\s*(\d+)/, name: 'testTimeout' },
      { pattern: /hookTimeout:\s*(\d+)/, name: 'hookTimeout' },
      { pattern: /teardownTimeout:\s*(\d+)/, name: 'teardownTimeout' },
    ];

    const configTimeouts: Record<string, Record<string, number[]>> = {};

    this.configFiles.forEach(config => {
      if (!config.exists || !config.content) return;

      configTimeouts[config.path] = {};
      
      timeoutPatterns.forEach(({ pattern, name }) => {
        const matches = config.content!.match(new RegExp(pattern.source, 'g'));
        if (matches) {
          configTimeouts[config.path][name] = matches.map(match => {
            const value = match.match(/\d+/)?.[0];
            return value ? parseInt(value) : 0;
          });
        }
      });
    });

    // Check for extreme timeout variations
    Object.entries(configTimeouts).forEach(([configPath, timeouts]) => {
      Object.entries(timeouts).forEach(([timeoutType, values]) => {
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        if (max / min > 10) { // More than 10x difference
          result.warnings.push(
            `⚠️  ${configPath} has extreme ${timeoutType} variations: ${min}ms to ${max}ms`
          );
        }
      });
    });

    console.log('✅ Timeout validation complete');
  }

  private async validateEnvironmentVariables(result: ConfigValidationResult): Promise<void> {
    console.log('🌍 Validating environment variable consistency...');

    const envVarPatterns = [
      'FORCE_MOCK_DB',
      'SKIP_AUTH_IN_TESTS',
      'TEST_TYPE',
      'VITEST_STABILITY_MODE',
      'ENABLE_DEBUG_LOGGING',
    ];

    const configEnvVars: Record<string, Record<string, string[]>> = {};

    this.configFiles.forEach(config => {
      if (!config.exists || !config.content) return;

      configEnvVars[config.path] = {};
      
      envVarPatterns.forEach(envVar => {
        const pattern = new RegExp(`${envVar}:\\s*['"]([^'"]+)['"]`, 'g');
        const matches = [...config.content!.matchAll(pattern)];
        
        if (matches.length > 0) {
          configEnvVars[config.path][envVar] = matches.map(match => match[1]);
        }
      });
    });

    // Check for conflicting environment variable values
    envVarPatterns.forEach(envVar => {
      const allValues = new Set<string>();
      const configsWithVar: string[] = [];

      Object.entries(configEnvVars).forEach(([configPath, envVars]) => {
        if (envVars[envVar]) {
          envVars[envVar].forEach(value => allValues.add(value));
          configsWithVar.push(configPath);
        }
      });

      if (allValues.size > 2 && configsWithVar.length > 1) { // Allow for true/false variations
        result.conflicts.push(
          `❌ Environment variable ${envVar} has conflicting values: ${Array.from(allValues).join(', ')} across configs: ${configsWithVar.join(', ')}`
        );
      }
    });

    console.log('✅ Environment variable validation complete');
  }

  private async validatePoolConfigurations(result: ConfigValidationResult): Promise<void> {
    console.log('🧵 Validating pool configurations...');

    const poolPatterns = [
      { pattern: /pool:\s*['"](\w+)['"]/, name: 'pool' },
      { pattern: /maxThreads:\s*(\d+)/, name: 'maxThreads' },
      { pattern: /isolate:\s*(true|false)/, name: 'isolate' },
    ];

    const configPools: Record<string, Record<string, string[]>> = {};

    this.configFiles.forEach(config => {
      if (!config.exists || !config.content) return;

      configPools[config.path] = {};
      
      poolPatterns.forEach(({ pattern, name }) => {
        const matches = [...config.content!.matchAll(new RegExp(pattern.source, 'g'))];
        if (matches.length > 0) {
          configPools[config.path][name] = matches.map(match => match[1]);
        }
      });
    });

    // Check for mixed pool strategies
    const poolTypes = new Set<string>();
    Object.values(configPools).forEach(pools => {
      if (pools.pool) {
        pools.pool.forEach(type => poolTypes.add(type));
      }
    });

    if (poolTypes.size > 2) {
      result.warnings.push(
        `⚠️  Multiple pool strategies detected: ${Array.from(poolTypes).join(', ')}. This may cause execution inconsistencies.`
      );
    }

    console.log('✅ Pool configuration validation complete');
  }

  private async validateSetupFileOrdering(result: ConfigValidationResult): Promise<void> {
    console.log('🔧 Validating setup file ordering...');

    const setupFilePatterns = [
      'react-dom-fix.ts',
      'vitest-setup.ts',
      'test-stability-utilities.ts',
      'hook-timeout-configuration.ts',
    ];

    this.configFiles.forEach(config => {
      if (!config.exists || !config.content) return;

      const setupFilesMatch = config.content.match(/setupFiles:\s*\[([\s\S]*?)\]/);
      if (setupFilesMatch) {
        const setupFilesContent = setupFilesMatch[1];
        const foundFiles: string[] = [];

        setupFilePatterns.forEach(pattern => {
          if (setupFilesContent.includes(pattern)) {
            foundFiles.push(pattern);
          }
        });

        // Check if react-dom-fix is first when present
        if (foundFiles.includes('react-dom-fix.ts')) {
          const reactDomIndex = setupFilesContent.indexOf('react-dom-fix.ts');
          const otherFilesBeforeReactDom = setupFilePatterns
            .filter(p => p !== 'react-dom-fix.ts')
            .some(pattern => {
              const index = setupFilesContent.indexOf(pattern);
              return index !== -1 && index < reactDomIndex;
            });

          if (otherFilesBeforeReactDom) {
            result.conflicts.push(
              `❌ ${config.path}: react-dom-fix.ts should be loaded FIRST in setupFiles array`
            );
          }
        }
      }
    });

    console.log('✅ Setup file ordering validation complete');
  }

  private async validatePackageJsonScripts(result: ConfigValidationResult): Promise<void> {
    console.log('📦 Validating package.json script alignment...');

    const packageJsonPath = join(this.projectRoot, 'package.json');
    if (!existsSync(packageJsonPath)) {
      result.conflicts.push('❌ package.json not found');
      return;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const scripts = packageJson.scripts || {};

    // Check if scripts are using master config
    const testScripts = Object.entries(scripts).filter(([key]) => key.startsWith('test'));
    const legacyConfigUsage = testScripts.filter(([_, script]) => 
      typeof script === 'string' && 
      script.includes('vitest.config.') && 
      !script.includes('vitest.config.master.ts')
    );

    if (legacyConfigUsage.length > 0) {
      result.warnings.push('⚠️  Some test scripts are still using legacy configurations:');
      legacyConfigUsage.forEach(([key, script]) => {
        result.warnings.push(`   - ${key}: ${script}`);
      });
      result.recommendations.push('✅ Update remaining scripts to use vitest.config.master.ts');
    }

    // Check for TEST_TYPE environment variable usage
    const masterConfigScripts = testScripts.filter(([_, script]) => 
      typeof script === 'string' && script.includes('vitest.config.master.ts')
    );

    const scriptsWithoutTestType = masterConfigScripts.filter(([_, script]) => 
      typeof script === 'string' && !script.includes('TEST_TYPE=')
    );

    if (scriptsWithoutTestType.length > 0) {
      result.warnings.push('⚠️  Some scripts using master config are missing TEST_TYPE:');
      scriptsWithoutTestType.forEach(([key, script]) => {
        result.warnings.push(`   - ${key}: ${script}`);
      });
    }

    console.log('✅ Package.json script validation complete');
  }

  public printResults(result: ConfigValidationResult): void {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 TEST CONFIGURATION VALIDATION RESULTS');
    console.log('='.repeat(80));

    if (result.isValid && result.conflicts.length === 0) {
      console.log('✅ VALIDATION PASSED - No critical conflicts detected\n');
    } else {
      console.log('❌ VALIDATION FAILED - Critical conflicts detected\n');
    }

    if (result.conflicts.length > 0) {
      console.log('🚨 CRITICAL CONFLICTS:');
      result.conflicts.forEach(conflict => console.log(conflict));
      console.log('');
    }

    if (result.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      result.warnings.forEach(warning => console.log(warning));
      console.log('');
    }

    if (result.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS:');
      result.recommendations.forEach(rec => console.log(rec));
      console.log('');
    }

    console.log('📊 CONFIGURATION SUMMARY:');
    const existingConfigs = this.configFiles.filter(f => f.exists);
    console.log(`   - Total configurations: ${existingConfigs.length}`);
    console.log(`   - Master config exists: ${existingConfigs.some(f => f.path === 'vitest.config.master.ts') ? '✅' : '❌'}`);
    console.log(`   - Legacy configs: ${existingConfigs.filter(f => f.path !== 'vitest.config.master.ts').length}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('🎯 NEXT STEPS:');
    
    if (result.conflicts.length > 0) {
      console.log('1. ❗ Fix critical conflicts listed above');
      console.log('2. 🧪 Run tests with master config: npm run test');
      console.log('3. 🔧 Run migration script: npm run test:config:migrate');
    } else {
      console.log('1. ✅ Validation passed - configuration is aligned');
      console.log('2. 🧪 Test all scenarios: npm run test, npm run test:integration, etc.');
      console.log('3. 🗂️  Consider removing legacy configs when confident');
    }
    
    console.log('='.repeat(80));
  }
}

// Main execution
async function main() {
  try {
    const validator = new TestConfigValidator();
    const result = await validator.validateConfigurations();
    validator.printResults(result);
    
    // Exit with error code if validation failed
    process.exit(result.isValid && result.conflicts.length === 0 ? 0 : 1);
  } catch (error) {
    console.error('❌ Validation failed with error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { TestConfigValidator };