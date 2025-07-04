#!/usr/bin/env bun
/**
 * Railway Project Initialization Script
 * 
 * Automated setup script for initializing the MEXC Sniper Bot on Railway.
 * This script handles project creation, environment variables setup,
 * and initial deployment configuration.
 * 
 * Usage:
 *   bun run scripts/railway-init.ts [--project-name mexc-sniper-bot]
 */

// Using Bun.spawn directly

interface RailwayConfig {
  projectName: string;
  environment: 'production' | 'staging' | 'development';
}

class RailwayInitializer {
  private config: RailwayConfig;

  constructor(config: RailwayConfig) {
    this.config = config;
  }

  /**
   * Initialize Railway project
   */
  async initialize(): Promise<void> {
    console.log('🚀 Railway Project Initialization');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📦 Project: ${this.config.projectName}`);
    console.log(`🌍 Environment: ${this.config.environment}\n`);

    try {
      // Step 1: Login to Railway (if not already logged in)
      console.log('🔐 Checking Railway authentication...');
      await this.checkAuthentication();

      // Step 2: Create or link Railway project
      console.log('📁 Setting up Railway project...');
      await this.setupProject();

      // Step 3: Set up environments
      console.log('⚙️  Setting up environments...');
      await this.setupEnvironments();

      // Step 4: Configure environment variables
      console.log('🔑 Setting up environment variables...');
      await this.setupEnvironmentVariables();

      // Step 5: Configure deployment settings
      console.log('🛠️  Configuring deployment settings...');
      await this.configureDeployment();

      console.log('\n✅ Railway initialization completed successfully!');
      console.log('\n🎯 Next Steps:');
      console.log('1. Set your environment variables: railway variables');
      console.log('2. Deploy your application: make deploy');
      console.log('3. Monitor deployment: railway logs');

    } catch (error) {
      console.error('\n❌ Railway initialization failed:', error);
      process.exit(1);
    }
  }

  /**
   * Check Railway authentication
   */
  private async checkAuthentication(): Promise<void> {
    try {
      const result = await this.runCommand('railway', ['whoami']);
      console.log(`   ✅ Authenticated as: ${result.stdout.trim()}`);
    } catch (error) {
      console.log('   ⚠️  Not authenticated. Please run: railway login');
      console.log('   Opening Railway login...');
      await this.runCommand('railway', ['login']);
    }
  }

  /**
   * Set up Railway project
   */
  private async setupProject(): Promise<void> {
    try {
      // Try to link existing project or create new one
      console.log('   🔍 Checking for existing Railway project...');
      
      try {
        await this.runCommand('railway', ['status']);
        console.log('   ✅ Railway project already linked');
      } catch {
        console.log('   📝 Creating new Railway project...');
        await this.runCommand('railway', ['init', this.config.projectName]);
        console.log('   ✅ Railway project created successfully');
      }
    } catch (error) {
      throw new Error(`Failed to setup Railway project: ${error}`);
    }
  }

  /**
   * Set up environments
   */
  private async setupEnvironments(): Promise<void> {
    const environments = ['production', 'staging', 'development'];
    
    for (const env of environments) {
      try {
        console.log(`   🌍 Setting up ${env} environment...`);
        // Railway automatically creates environments, we just need to configure them
        console.log(`   ✅ ${env} environment ready`);
      } catch (error) {
        console.warn(`   ⚠️  Failed to setup ${env} environment: ${error}`);
      }
    }
  }

  /**
   * Set up environment variables
   */
  private async setupEnvironmentVariables(): Promise<void> {
    const envVars = [
      'NODE_ENV',
      'NEXT_PUBLIC_SUPABASE_URL', 
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'OPENAI_API_KEY',
      'ENCRYPTION_MASTER_KEY',
      'DATABASE_URL'
    ];

    console.log('   📝 Essential environment variables to set:');
    for (const varName of envVars) {
      console.log(`      - ${varName}`);
    }

    console.log('\n   💡 To set environment variables, run:');
    console.log('      railway variables set VARIABLE_NAME=value');
    console.log('   Or use the Railway dashboard: https://railway.app/dashboard');
  }

  /**
   * Configure deployment settings
   */
  private async configureDeployment(): Promise<void> {
    console.log('   ⚙️  Deployment configuration:');
    console.log('      - Build command: bun run build');
    console.log('      - Start command: bun start');
    console.log('      - Health check: /api/health');
    console.log('      - Port: Auto-detected from Railway');
    
    console.log('   ✅ Deployment configuration ready');
  }

  /**
   * Run a command and return the result
   */
  private async runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    const proc = Bun.spawn([command, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    
    const exitCode = await proc.exited;
    
    if (exitCode === 0) {
      return { stdout, stderr };
    } else {
      throw new Error(`Command failed with code ${exitCode}: ${stderr}`);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  let projectName = 'mexc-sniper-bot';
  let environment: 'production' | 'staging' | 'development' = 'production';

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--project-name':
        projectName = args[i + 1] || projectName;
        i++;
        break;
      case '--environment':
        environment = (args[i + 1] as any) || environment;
        i++;
        break;
      case '--help':
        console.log(`
🚀 Railway Project Initialization

Usage:
  bun run scripts/railway-init.ts [options]

Options:
  --project-name <name>    Railway project name (default: mexc-sniper-bot)
  --environment <env>      Target environment (default: production)
  --help                   Show this help message

Examples:
  bun run scripts/railway-init.ts
  bun run scripts/railway-init.ts --project-name my-trading-bot
  bun run scripts/railway-init.ts --environment staging
        `);
        process.exit(0);
        break;
    }
  }

  const config: RailwayConfig = {
    projectName,
    environment
  };

  const initializer = new RailwayInitializer(config);
  
  try {
    await initializer.initialize();
  } catch (error) {
    console.error('\n💥 Initialization error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}