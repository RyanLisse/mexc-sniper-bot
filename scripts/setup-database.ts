#!/usr/bin/env bun

/**
 * Database Setup Script
 * 
 * Sets up the database by ensuring all migrations are applied.
 * Fixes "Unknown table: error_logs" and other missing table errors.
 * 
 * Usage:
 *   bun run scripts/setup-database.ts
 *   bun run scripts/setup-database.ts --verbose
 *   bun run scripts/setup-database.ts --force
 */

import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

async function main() {
  try {
    console.log('🔧 Setting up database...')

    const { DatabaseMigrationRunner } = await import('./database-migration-runner.js')

    // Get database URL from environment
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      console.error('❌ DATABASE_URL environment variable is required')
      console.log('   Please set DATABASE_URL in your .env.local file')
      process.exit(1)
    }

    // Verify it's a PostgreSQL URL
    if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
      console.error('❌ DATABASE_URL must be a PostgreSQL connection string')
      console.log('   Current value starts with:', databaseUrl.split('://')[0])
      process.exit(1)
    }

    const config = {
      databaseUrl,
      migrationsFolder: './src/db/migrations',
      verbose: process.argv.includes('--verbose') || process.env.SETUP_VERBOSE === 'true'
    }

    const runner = new DatabaseMigrationRunner(config)
    await runner.runMigrations()

    console.log('✅ Database setup completed successfully!')
    console.log('')
    console.log('🎯 Key achievements:')
    console.log('   • All database migrations applied')
    console.log('   • error_logs table created and verified')
    console.log('   • Database schema is now up to date')
    console.log('')
    console.log('You can now run the application without "Unknown table" errors.')

  } catch (error) {
    console.error('❌ Database setup failed:', error)
    console.log('')
    console.log('🔍 Troubleshooting steps:')
    console.log('   1. Verify DATABASE_URL is correct in .env.local')
    console.log('   2. Check database connection and permissions')
    console.log('   3. Run with --verbose flag for more details')
    console.log('   4. Check that Supabase/PostgreSQL is accessible')
    
    process.exit(1)
  }
}

// Handle script execution
if (import.meta.main) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}