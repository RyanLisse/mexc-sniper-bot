/**
 * Database Performance Test Suite
 * Comprehensive performance testing for database operations, connection pools, and query optimization
 */

import { performance } from 'node:perf_hooks'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { tradingTargets, balanceSnapshots, patterns } from '@/src/db/schema'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface DatabasePerformanceResult {
  testName: string
  duration: number
  recordsProcessed: number
  averageResponseTime: number
  throughput: number
  connectionPoolEfficiency: number
  queryComplexity: 'low' | 'medium' | 'high'
  memoryUsage: {
    initial: number
    peak: number
    final: number
  }
}

interface ConnectionPoolMetrics {
  totalConnections: number
  activeConnections: number
  idleConnections: number
  waitingClients: number
  maxConnections: number
  averageAcquisitionTime: number
}

class DatabasePerformanceTestSuite {
  private pool: Pool | null = null
  private db: ReturnType<typeof drizzle> | null = null
  private results: DatabasePerformanceResult[] = []

  async setup(): Promise<void> {
    // Initialize connection pool with performance-optimized settings
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/mexc_sniper_test',
      max: 20, // Maximum connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: true
    })

    this.db = drizzle(this.pool)
    
    // Warm up the connection pool
    await this.warmUpConnectionPool()
  }

  async teardown(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
    }
  }

  private async warmUpConnectionPool(): Promise<void> {
    const warmupPromises = Array.from({ length: 5 }, async () => {
      if (this.db) {
        await this.db.execute(sql`SELECT 1`)
      }
    })
    
    await Promise.all(warmupPromises)
  }

  async runQueryPerformanceTest(
    testName: string,
    query: () => Promise<any>,
    expectedRecords: number,
    complexity: 'low' | 'medium' | 'high'
  ): Promise<DatabasePerformanceResult> {
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024
    let peakMemory = initialMemory
    
    // Monitor memory usage during test
    const memoryMonitor = setInterval(() => {
      const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024
      if (currentMemory > peakMemory) {
        peakMemory = currentMemory
      }
    }, 100)

    const startTime = performance.now()
    
    try {
      const result = await query()
      const endTime = performance.now()
      
      clearInterval(memoryMonitor)
      
      const duration = endTime - startTime
      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024
      
      // Calculate connection pool efficiency
      const poolMetrics = await this.getConnectionPoolMetrics()
      const connectionPoolEfficiency = (poolMetrics.activeConnections / poolMetrics.maxConnections) * 100
      
      const performanceResult: DatabasePerformanceResult = {
        testName,
        duration,
        recordsProcessed: Array.isArray(result) ? result.length : expectedRecords,
        averageResponseTime: duration,
        throughput: expectedRecords / (duration / 1000),
        connectionPoolEfficiency,
        queryComplexity: complexity,
        memoryUsage: {
          initial: initialMemory,
          peak: peakMemory,
          final: finalMemory
        }
      }
      
      this.results.push(performanceResult)
      return performanceResult
      
    } catch (error) {
      clearInterval(memoryMonitor)
      throw error
    }
  }

  private async getConnectionPoolMetrics(): Promise<ConnectionPoolMetrics> {
    if (!this.pool) {
      throw new Error('Database pool not initialized')
    }

    return {
      totalConnections: this.pool.totalCount,
      activeConnections: this.pool.totalCount - this.pool.idleCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount,
      maxConnections: this.pool.options.max || 10,
      averageAcquisitionTime: 0 // Would need custom implementation to track
    }
  }

  async runConnectionPoolStressTest(concurrency: number, duration: number): Promise<{
    totalQueries: number
    successfulQueries: number
    failedQueries: number
    averageResponseTime: number
    maxResponseTime: number
    connectionPoolStats: ConnectionPoolMetrics
  }> {
    const results: number[] = []
    const errors: Error[] = []
    let totalQueries = 0
    let successfulQueries = 0
    let failedQueries = 0

    const startTime = performance.now()
    const endTime = startTime + duration

    const workers = Array.from({ length: concurrency }, async () => {
      while (performance.now() < endTime) {
        const queryStart = performance.now()
        totalQueries++
        
        try {
          if (this.db) {
            await this.db.execute(sql`SELECT NOW(), pg_sleep(0.001)`) // Simulate work
          }
          
          const queryEnd = performance.now()
          results.push(queryEnd - queryStart)
          successfulQueries++
        } catch (error) {
          errors.push(error as Error)
          failedQueries++
        }
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    })

    await Promise.all(workers)

    const connectionPoolStats = await this.getConnectionPoolMetrics()

    return {
      totalQueries,
      successfulQueries,
      failedQueries,
      averageResponseTime: results.reduce((sum, time) => sum + time, 0) / results.length,
      maxResponseTime: Math.max(...results),
      connectionPoolStats
    }
  }

  getResults(): DatabasePerformanceResult[] {
    return this.results
  }

  generateReport(): string {
    const report = [
      '=== DATABASE PERFORMANCE TEST REPORT ===',
      `Total Tests: ${this.results.length}`,
      `Test Date: ${new Date().toISOString()}`,
      '',
      'Individual Test Results:',
      '─'.repeat(80)
    ]

    this.results.forEach((result, index) => {
      report.push(`${index + 1}. ${result.testName}`)
      report.push(`   Duration: ${result.duration.toFixed(2)}ms`)
      report.push(`   Records: ${result.recordsProcessed}`)
      report.push(`   Throughput: ${result.throughput.toFixed(2)} records/sec`)
      report.push(`   Connection Pool Efficiency: ${result.connectionPoolEfficiency.toFixed(2)}%`)
      report.push(`   Query Complexity: ${result.queryComplexity}`)
      report.push(`   Memory Usage: ${result.memoryUsage.initial.toFixed(2)}MB → ${result.memoryUsage.final.toFixed(2)}MB (Peak: ${result.memoryUsage.peak.toFixed(2)}MB)`)
      report.push('')
    })

    return report.join('\n')
  }
}

// Test Suite Implementation
describe('Database Performance Tests', () => {
  let testSuite: DatabasePerformanceTestSuite

  beforeAll(async () => {
    testSuite = new DatabasePerformanceTestSuite()
    await testSuite.setup()
  })

  afterAll(async () => {
    await testSuite.teardown()
  })

  it('should perform basic SELECT query performance test', async () => {
    const result = await testSuite.runQueryPerformanceTest(
      'Basic SELECT Query',
      async () => {
        if (testSuite.db) {
          return await testSuite.db.execute(sql`SELECT 1`)
        }
        return []
      },
      1,
      'low'
    )

    expect(result.duration).toBeLessThan(100) // Should complete within 100ms
    expect(result.memoryUsage.peak - result.memoryUsage.initial).toBeLessThan(50) // Memory growth < 50MB
  })

  it('should perform trading targets query performance test', async () => {
    const result = await testSuite.runQueryPerformanceTest(
      'Trading Targets Query',
      async () => {
        if (testSuite.db) {
          return await testSuite.db.select().from(tradingTargets).limit(100)
        }
        return []
      },
      100,
      'medium'
    )

    expect(result.duration).toBeLessThan(500) // Should complete within 500ms
    expect(result.throughput).toBeGreaterThan(200) // Should process > 200 records/sec
  })

  it('should perform complex join query performance test', async () => {
    const result = await testSuite.runQueryPerformanceTest(
      'Complex Join Query',
      async () => {
        if (testSuite.db) {
          return await testSuite.db.execute(sql`
            SELECT t.*, b.balance, p.pattern_type
            FROM trading_targets t
            LEFT JOIN balance_snapshots b ON t.user_id = b.user_id
            LEFT JOIN patterns p ON t.symbol = p.symbol
            ORDER BY t.created_at DESC
            LIMIT 50
          `)
        }
        return []
      },
      50,
      'high'
    )

    expect(result.duration).toBeLessThan(1000) // Should complete within 1 second
    expect(result.connectionPoolEfficiency).toBeGreaterThan(0) // Should use connection pool
  })

  it('should perform bulk insert performance test', async () => {
    const testData = Array.from({ length: 1000 }, (_, i) => ({
      userId: 'test-user',
      symbol: `TEST${i}`,
      targetPrice: 100 + i,
      quantity: 10,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }))

    const result = await testSuite.runQueryPerformanceTest(
      'Bulk Insert Performance',
      async () => {
        if (testSuite.db) {
          return await testSuite.db.insert(tradingTargets).values(testData)
        }
        return []
      },
      1000,
      'high'
    )

    expect(result.duration).toBeLessThan(2000) // Should complete within 2 seconds
    expect(result.throughput).toBeGreaterThan(500) // Should process > 500 records/sec
  })

  it('should perform connection pool stress test', async () => {
    const stressTestResult = await testSuite.runConnectionPoolStressTest(
      10, // 10 concurrent connections
      5000 // 5 seconds
    )

    expect(stressTestResult.successfulQueries).toBeGreaterThan(0)
    expect(stressTestResult.failedQueries).toBeLessThan(stressTestResult.totalQueries * 0.05) // < 5% failure rate
    expect(stressTestResult.averageResponseTime).toBeLessThan(100) // Average response < 100ms
    expect(stressTestResult.connectionPoolStats.totalConnections).toBeGreaterThan(0)
  })

  it('should perform query optimization analysis', async () => {
    // Test various query patterns to identify optimization opportunities
    const queries = [
      {
        name: 'Index Utilization Test',
        query: async () => {
          if (testSuite.db) {
            return await testSuite.db.execute(sql`
              EXPLAIN ANALYZE SELECT * FROM trading_targets WHERE symbol = 'BTCUSDT' AND is_active = true
            `)
          }
          return []
        }
      },
      {
        name: 'Pagination Performance',
        query: async () => {
          if (testSuite.db) {
            return await testSuite.db.select().from(tradingTargets).limit(100).offset(1000)
          }
          return []
        }
      },
      {
        name: 'Aggregation Performance',
        query: async () => {
          if (testSuite.db) {
            return await testSuite.db.execute(sql`
              SELECT symbol, COUNT(*), AVG(target_price) 
              FROM trading_targets 
              GROUP BY symbol 
              ORDER BY COUNT(*) DESC 
              LIMIT 10
            `)
          }
          return []
        }
      }
    ]

    for (const queryTest of queries) {
      const result = await testSuite.runQueryPerformanceTest(
        queryTest.name,
        queryTest.query,
        100,
        'medium'
      )

      expect(result.duration).toBeLessThan(1000) // All queries should complete within 1 second
    }
  })

  it('should validate performance SLAs', async () => {
    const results = testSuite.getResults()
    
    // Define SLA thresholds
    const SLA_THRESHOLDS = {
      simpleQuery: 50,  // 50ms
      mediumQuery: 200, // 200ms
      complexQuery: 500 // 500ms
    }

    const slaViolations = results.filter(result => {
      switch (result.queryComplexity) {
        case 'low':
          return result.duration > SLA_THRESHOLDS.simpleQuery
        case 'medium':
          return result.duration > SLA_THRESHOLDS.mediumQuery
        case 'high':
          return result.duration > SLA_THRESHOLDS.complexQuery
        default:
          return false
      }
    })

    expect(slaViolations.length).toBe(0) // No SLA violations expected
    
    // Check memory usage thresholds
    const memoryViolations = results.filter(result => 
      result.memoryUsage.peak - result.memoryUsage.initial > 100 // 100MB growth limit
    )

    expect(memoryViolations.length).toBe(0) // No memory violations expected
  })

  it('should generate performance report', () => {
    const report = testSuite.generateReport()
    
    expect(report).toContain('DATABASE PERFORMANCE TEST REPORT')
    expect(report).toContain('Total Tests:')
    expect(report).toContain('Duration:')
    expect(report).toContain('Throughput:')
    
    console.log('\n' + report)
  })
})

// Export for use in other test files
export { DatabasePerformanceTestSuite, type DatabasePerformanceResult, type ConnectionPoolMetrics }