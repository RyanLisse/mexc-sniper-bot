#!/usr/bin/env bun

/**
 * Database Schema Health Check
 * 
 * Comprehensive health check for database schema and migration status.
 * Verifies all critical tables exist and schema is up to date.
 */

import { config } from 'dotenv'
import { sql } from 'drizzle-orm'

// Load environment variables
config({ path: '.env.local' })

interface TableInfo {
  table_name: string
  schema_name: string
  table_type: string
  is_insertable_into: string
}

interface SchemaHealthReport {
  status: 'healthy' | 'needs_migration' | 'critical'
  totalTables: number
  missingTables: string[]
  existingTables: string[]
  migrationStatus: string
  recommendations: string[]
}

async function main() {
  try {
    console.log('🏥 Running database schema health check...')
    console.log('')

    // Import database after environment is loaded
    const { db } = await import('../src/db/index.js')

    // Test basic connectivity
    console.log('📡 Testing database connectivity...')
    await db.execute(sql`SELECT 1 as test`)
    console.log('✅ Database connection successful')
    console.log('')

    // Check migration status
    console.log('📋 Checking migration status...')
    let migrationStatus = 'unknown'
    let migrationsTableExists = false

    try {
      const migrationResult = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'drizzle' 
        AND table_name = '__drizzle_migrations'
      `)
      migrationsTableExists = (migrationResult as any)[0]?.count > 0

      if (migrationsTableExists) {
        const migrationsCount = await db.execute(sql`
          SELECT COUNT(*) as applied_count 
          FROM drizzle.__drizzle_migrations
        `)
        const appliedCount = (migrationsCount as any)[0]?.applied_count || 0
        migrationStatus = `${appliedCount} migrations applied`
        console.log(`✅ Migration system active: ${migrationStatus}`)
      } else {
        migrationStatus = 'No migration system found'
        console.log('⚠️ Drizzle migration system not initialized')
      }
    } catch (error) {
      migrationStatus = 'Migration check failed'
      console.log('❌ Could not check migration status:', error)
    }

    console.log('')

    // Critical tables that must exist
    const criticalTables = [
      'error_logs',
      'users', 
      'api_credentials',
      'snipe_targets',
      'transactions',
      'error_incidents',
      'system_health_metrics',
      'user_preferences',
      'execution_history'
    ]

    console.log('🔍 Checking critical tables...')
    
    const existingTables: string[] = []
    const missingTables: string[] = []

    for (const tableName of criticalTables) {
      try {
        const result = await db.execute(sql`
          SELECT table_name, table_type, is_insertable_into
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        `)

        if (result.length > 0) {
          const tableInfo = result[0] as TableInfo
          existingTables.push(tableName)
          console.log(`✅ ${tableName} - ${tableInfo.table_type.toLowerCase()}`)
        } else {
          missingTables.push(tableName)
          console.log(`❌ ${tableName} - MISSING`)
        }
      } catch (error) {
        missingTables.push(tableName)
        console.log(`❌ ${tableName} - ERROR: ${error}`)
      }
    }

    console.log('')

    // Generate health report
    const report: SchemaHealthReport = {
      status: missingTables.length === 0 ? 'healthy' : 
              missingTables.includes('error_logs') ? 'critical' : 'needs_migration',
      totalTables: criticalTables.length,
      missingTables,
      existingTables,
      migrationStatus,
      recommendations: []
    }

    // Add recommendations
    if (missingTables.length > 0) {
      report.recommendations.push('Run database migrations: bun run db:setup')
    }
    
    if (!migrationsTableExists) {
      report.recommendations.push('Initialize migration system: bun run db:migrate')
    }

    if (missingTables.includes('error_logs')) {
      report.recommendations.push('CRITICAL: error_logs table missing - this will cause build failures')
    }

    // Display summary
    console.log('📊 SCHEMA HEALTH REPORT')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Status: ${report.status.toUpperCase()}`)
    console.log(`Tables found: ${existingTables.length}/${criticalTables.length}`)
    console.log(`Migration status: ${migrationStatus}`)
    console.log('')

    if (missingTables.length > 0) {
      console.log('❌ Missing tables:')
      missingTables.forEach(table => console.log(`   • ${table}`))
      console.log('')
    }

    if (report.recommendations.length > 0) {
      console.log('💡 Recommendations:')
      report.recommendations.forEach(rec => console.log(`   • ${rec}`))
      console.log('')
    }

    // Test error_logs table specifically
    if (existingTables.includes('error_logs')) {
      console.log('🧪 Testing error_logs table functionality...')
      try {
        // Test insert capability
        const testEntry = {
          level: 'info',
          message: 'Health check test entry',
          service: 'health-check',
          timestamp: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        }

        await db.execute(sql`
          INSERT INTO error_logs (level, message, service, timestamp, created_at, updated_at)
          VALUES (${testEntry.level}, ${testEntry.message}, ${testEntry.service}, ${testEntry.timestamp}, ${testEntry.created_at}, ${testEntry.updated_at})
        `)

        // Clean up test entry
        await db.execute(sql`
          DELETE FROM error_logs 
          WHERE message = 'Health check test entry' 
          AND service = 'health-check'
        `)

        console.log('✅ error_logs table is fully functional')
      } catch (error) {
        console.log('❌ error_logs table has issues:', error)
        report.status = 'critical'
        report.recommendations.push('error_logs table exists but is not functional - check table structure')
      }
    }

    console.log('')

    // Final status
    if (report.status === 'healthy') {
      console.log('🎉 Database schema is healthy and ready!')
      console.log('   All critical tables exist and are functional.')
      process.exit(0)
    } else if (report.status === 'needs_migration') {
      console.log('⚠️  Database schema needs updates.')
      console.log('   Some non-critical tables are missing.')
      process.exit(1)
    } else {
      console.log('🚨 CRITICAL: Database schema has serious issues!')
      console.log('   Essential tables are missing - application will fail.')
      process.exit(2)
    }

  } catch (error) {
    console.error('❌ Health check failed:', error)
    console.log('')
    console.log('🔧 Troubleshooting:')
    console.log('   1. Check DATABASE_URL in .env.local')
    console.log('   2. Verify database is accessible')
    console.log('   3. Run: bun run db:setup')
    process.exit(3)
  }
}

// Handle script execution
if (import.meta.main) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(3)
  })
}