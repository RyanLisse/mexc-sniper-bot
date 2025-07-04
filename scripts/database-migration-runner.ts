#!/usr/bin/env bun

/**
 * Database Migration Runner
 * 
 * Ensures all Drizzle migrations are applied to the database.
 * This resolves "Unknown table: error_logs" and other missing table errors.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface MigrationRunnerConfig {
  databaseUrl: string
  migrationsFolder: string
  verbose?: boolean
}

class DatabaseMigrationRunner {
  private config: MigrationRunnerConfig

  constructor(config: MigrationRunnerConfig) {
    this.config = config
  }

  private log(message: string, ...args: any[]) {
    if (this.config.verbose) {
      console.log(`[DatabaseMigrationRunner] ${message}`, ...args)
    }
  }

  async runMigrations(): Promise<void> {
    let client: postgres.Sql | null = null

    try {
      this.log('Starting database migration process...')

      // Create PostgreSQL client
      client = postgres(this.config.databaseUrl, {
        max: 1, // Single connection for migrations
        idle_timeout: 20,
        connect_timeout: 10,
        ssl: this.config.databaseUrl.includes('supabase.co') ? 'require' : false,
      })

      this.log('Database connection established')

      // Create Drizzle instance
      const db = drizzle(client)

      this.log('Running migrations from:', this.config.migrationsFolder)

      // Run migrations
      await migrate(db, { 
        migrationsFolder: this.config.migrationsFolder,
      })

      this.log('✅ All migrations completed successfully')

      // Verify error_logs table exists
      await this.verifyTables(client)

    } catch (error) {
      console.error('❌ Migration failed:', error)
      throw error
    } finally {
      if (client) {
        await client.end()
        this.log('Database connection closed')
      }
    }
  }

  private async verifyTables(client: postgres.Sql): Promise<void> {
    try {
      this.log('Verifying critical tables exist...')

      // Check if error_logs table exists
      const result = await client`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'error_logs'
      `

      if (result.length === 0) {
        throw new Error('error_logs table was not created by migrations')
      }

      this.log('✅ error_logs table verified')

      // Check for other critical tables
      const criticalTables = [
        'users',
        'api_credentials', 
        'snipe_targets',
        'transactions',
        'error_incidents',
        'system_health_metrics'
      ]

      for (const tableName of criticalTables) {
        const tableResult = await client`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        `

        if (tableResult.length > 0) {
          this.log(`✅ ${tableName} table verified`)
        } else {
          this.log(`⚠️  ${tableName} table not found (might be optional)`)
        }
      }

    } catch (error) {
      console.error('❌ Table verification failed:', error)
      throw error
    }
  }
}

async function main() {
  try {
    // Get database URL from environment
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      console.error('❌ DATABASE_URL environment variable is required')
      process.exit(1)
    }

    // Verify it's a PostgreSQL URL
    if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
      console.error('❌ DATABASE_URL must be a PostgreSQL connection string')
      process.exit(1)
    }

    // Determine migrations folder path
    const migrationsFolder = path.resolve(__dirname, '../src/db/migrations')

    const config: MigrationRunnerConfig = {
      databaseUrl,
      migrationsFolder,
      verbose: process.argv.includes('--verbose') || process.env.MIGRATION_VERBOSE === 'true'
    }

    console.log('🚀 Starting database migration runner...')
    console.log(`Database: ${databaseUrl.split('@')[1] || 'localhost'}`)
    console.log(`Migrations: ${migrationsFolder}`)

    const runner = new DatabaseMigrationRunner(config)
    await runner.runMigrations()

    console.log('✅ Database migration runner completed successfully')

  } catch (error) {
    console.error('❌ Database migration runner failed:', error)
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

export { DatabaseMigrationRunner, type MigrationRunnerConfig }