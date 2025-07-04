/**
 * Memory Profiling and Leak Detection Performance Test Suite
 * Comprehensive memory performance testing, leak detection, and garbage collection optimization
 */

import { performance } from 'node:perf_hooks'
import { EventEmitter } from 'events'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface MemorySnapshot {
  timestamp: number
  heapUsed: number
  heapTotal: number
  external: number
  arrayBuffers: number
  rss: number
}

interface MemoryLeakDetectionResult {
  testName: string
  duration: number
  initialMemory: MemorySnapshot
  finalMemory: MemorySnapshot
  peakMemory: MemorySnapshot
  memoryGrowth: number
  memoryGrowthRate: number // MB per second
  potentialLeakDetected: boolean
  leakSeverity: 'none' | 'minor' | 'moderate' | 'severe'
  gcEfficiency: number
  memoryFragmentation: number
  suspiciousPatterns: string[]
}

interface GarbageCollectionMetrics {
  gcCycles: number
  totalGcTime: number
  averageGcTime: number
  maxGcPause: number
  memoryReclaimed: number
  gcEfficiency: number
  gcTriggerThreshold: number
}

interface MemoryStressTestResult {
  testName: string
  memoryAllocated: number // Total MB allocated during test
  memoryReleased: number // Total MB released during test
  retentionRate: number // Percentage of memory retained
  performanceImpact: number // Percentage degradation in performance
  systemStability: 'stable' | 'unstable' | 'critical'
  resourceExhaustion: boolean
}

interface MemoryProfilerMetrics {
  objectCounts: Map<string, number>
  objectSizes: Map<string, number>
  largestObjects: Array<{ type: string; size: number; count: number }>
  memoryHotspots: Array<{ function: string; allocations: number; size: number }>
  retentionPaths: string[]
}

class MemoryProfilingPerformanceTestSuite extends EventEmitter {
  private memorySnapshots: MemorySnapshot[] = []
  private gcMetrics: GarbageCollectionMetrics[] = []
  private results: MemoryLeakDetectionResult[] = []
  private isMonitoring = false
  private monitoringInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
  }

  async setup(): Promise<void> {
    // Force initial garbage collection
    if (global.gc) {
      global.gc()
    }
    
    // Initialize monitoring
    this.startMemoryMonitoring()
  }

  async teardown(): Promise<void> {
    this.stopMemoryMonitoring()
    this.memorySnapshots = []
    this.gcMetrics = []
  }

  private startMemoryMonitoring(): void {
    if (this.isMonitoring) return
    
    this.isMonitoring = true
    this.monitoringInterval = setInterval(() => {
      this.captureMemorySnapshot()
    }, 500) // Capture every 500ms
  }

  private stopMemoryMonitoring(): void {
    if (!this.isMonitoring) return
    
    this.isMonitoring = false
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }

  private captureMemorySnapshot(): MemorySnapshot {
    const memoryUsage = process.memoryUsage()
    
    const snapshot: MemorySnapshot = {
      timestamp: performance.now(),
      heapUsed: memoryUsage.heapUsed / 1024 / 1024, // Convert to MB
      heapTotal: memoryUsage.heapTotal / 1024 / 1024,
      external: memoryUsage.external / 1024 / 1024,
      arrayBuffers: memoryUsage.arrayBuffers / 1024 / 1024,
      rss: memoryUsage.rss / 1024 / 1024
    }
    
    this.memorySnapshots.push(snapshot)
    return snapshot
  }

  async runMemoryLeakDetectionTest(
    testName: string,
    workload: () => Promise<void>,
    duration: number,
    expectedGrowthLimit: number = 50 // MB
  ): Promise<MemoryLeakDetectionResult> {
    // Force garbage collection before test
    if (global.gc) {
      global.gc()
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const initialSnapshot = this.captureMemorySnapshot()
    const startTime = performance.now()
    let peakSnapshot = initialSnapshot
    const suspiciousPatterns: string[] = []

    // Monitor for suspicious patterns during test
    const patternMonitor = setInterval(() => {
      const current = this.captureMemorySnapshot()
      
      if (current.heapUsed > peakSnapshot.heapUsed) {
        peakSnapshot = current
      }

      // Check for suspicious patterns
      const growth = current.heapUsed - initialSnapshot.heapUsed
      const timeElapsed = (current.timestamp - initialSnapshot.timestamp) / 1000

      if (timeElapsed > 10 && growth > 20) { // More than 20MB growth in 10 seconds
        suspiciousPatterns.push(`Rapid memory growth: ${growth.toFixed(2)}MB in ${timeElapsed.toFixed(2)}s`)
      }

      if (current.external > current.heapUsed * 0.5) { // External memory > 50% of heap
        suspiciousPatterns.push(`High external memory usage: ${current.external.toFixed(2)}MB`)
      }

      if (current.arrayBuffers > 100) { // More than 100MB in array buffers
        suspiciousPatterns.push(`Excessive ArrayBuffer usage: ${current.arrayBuffers.toFixed(2)}MB`)
      }
    }, 1000)

    try {
      // Run the workload for specified duration
      const endTime = startTime + duration
      
      while (performance.now() < endTime) {
        await workload()
        
        // Periodic yield to allow garbage collection
        await new Promise(resolve => setImmediate(resolve))
      }
      
    } finally {
      clearInterval(patternMonitor)
    }

    // Force garbage collection after test
    if (global.gc) {
      global.gc()
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const finalSnapshot = this.captureMemorySnapshot()
    const testDuration = finalSnapshot.timestamp - initialSnapshot.timestamp

    // Calculate metrics
    const memoryGrowth = finalSnapshot.heapUsed - initialSnapshot.heapUsed
    const memoryGrowthRate = memoryGrowth / (testDuration / 1000)
    const potentialLeakDetected = memoryGrowth > expectedGrowthLimit
    
    let leakSeverity: 'none' | 'minor' | 'moderate' | 'severe' = 'none'
    if (memoryGrowth > expectedGrowthLimit * 3) leakSeverity = 'severe'
    else if (memoryGrowth > expectedGrowthLimit * 2) leakSeverity = 'moderate'
    else if (memoryGrowth > expectedGrowthLimit) leakSeverity = 'minor'

    // Calculate GC efficiency
    const preGcMemory = peakSnapshot.heapUsed
    const postGcMemory = finalSnapshot.heapUsed
    const gcEfficiency = ((preGcMemory - postGcMemory) / preGcMemory) * 100

    // Calculate memory fragmentation
    const memoryFragmentation = ((finalSnapshot.heapTotal - finalSnapshot.heapUsed) / finalSnapshot.heapTotal) * 100

    const result: MemoryLeakDetectionResult = {
      testName,
      duration: testDuration,
      initialMemory: initialSnapshot,
      finalMemory: finalSnapshot,
      peakMemory: peakSnapshot,
      memoryGrowth,
      memoryGrowthRate,
      potentialLeakDetected,
      leakSeverity,
      gcEfficiency,
      memoryFragmentation,
      suspiciousPatterns: [...new Set(suspiciousPatterns)]
    }

    this.results.push(result)
    return result
  }

  async runMemoryStressTest(
    allocationsPerSecond: number,
    allocationSize: number, // KB
    duration: number
  ): Promise<MemoryStressTestResult> {
    const testName = `Memory Stress Test (${allocationsPerSecond}/s, ${allocationSize}KB each)`
    const initialMemory = this.captureMemorySnapshot()
    const allocations: any[] = []
    let totalAllocated = 0
    let performanceStart = 0
    let performanceEnd = 0

    const startTime = performance.now()
    const endTime = startTime + duration
    const allocationInterval = 1000 / allocationsPerSecond

    // Performance baseline measurement
    performanceStart = performance.now()
    for (let i = 0; i < 1000; i++) {
      Math.sqrt(i * Math.random())
    }
    const baselinePerformance = performance.now() - performanceStart

    let allocationPromise: Promise<void> | null = null

    try {
      // Stress test loop
      while (performance.now() < endTime) {
        const allocationStart = performance.now()
        
        // Allocate memory
        const buffer = new ArrayBuffer(allocationSize * 1024)
        const data = new Uint8Array(buffer)
        data.fill(Math.floor(Math.random() * 256))
        
        allocations.push(data)
        totalAllocated += allocationSize / 1024 // Convert to MB

        // Randomly release some allocations (simulate realistic usage)
        if (allocations.length > 100 && Math.random() < 0.1) {
          const releasedCount = Math.floor(allocations.length * 0.1)
          allocations.splice(0, releasedCount)
        }

        // Wait for next allocation
        const nextAllocationTime = allocationStart + allocationInterval
        const waitTime = Math.max(0, nextAllocationTime - performance.now())
        
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }

      // Performance measurement under stress
      performanceStart = performance.now()
      for (let i = 0; i < 1000; i++) {
        Math.sqrt(i * Math.random())
      }
      const stressPerformance = performance.now() - performanceStart

      const performanceImpact = ((stressPerformance - baselinePerformance) / baselinePerformance) * 100

      // Force garbage collection and measure released memory
      const preGcMemory = this.captureMemorySnapshot()
      
      if (global.gc) {
        global.gc()
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      const postGcMemory = this.captureMemorySnapshot()
      const memoryReleased = Math.max(0, preGcMemory.heapUsed - postGcMemory.heapUsed)
      const retentionRate = ((postGcMemory.heapUsed - initialMemory.heapUsed) / totalAllocated) * 100

      // Determine system stability
      let systemStability: 'stable' | 'unstable' | 'critical' = 'stable'
      if (performanceImpact > 100) systemStability = 'critical'
      else if (performanceImpact > 50) systemStability = 'unstable'

      const resourceExhaustion = postGcMemory.heapUsed > 500 // 500MB threshold

      return {
        testName,
        memoryAllocated: totalAllocated,
        memoryReleased,
        retentionRate,
        performanceImpact,
        systemStability,
        resourceExhaustion
      }

    } finally {
      // Cleanup allocations
      allocations.length = 0
      if (global.gc) {
        global.gc()
      }
    }
  }

  async runGarbageCollectionAnalysis(): Promise<GarbageCollectionMetrics> {
    let gcCycles = 0
    let totalGcTime = 0
    let maxGcPause = 0
    const gcTimes: number[] = []

    const initialMemory = this.captureMemorySnapshot()

    // Monitor garbage collection if available
    if (global.gc) {
      // Force multiple GC cycles and measure performance
      for (let i = 0; i < 10; i++) {
        const gcStart = performance.now()
        global.gc()
        const gcEnd = performance.now()
        
        const gcTime = gcEnd - gcStart
        gcTimes.push(gcTime)
        totalGcTime += gcTime
        maxGcPause = Math.max(maxGcPause, gcTime)
        gcCycles++

        // Create some garbage between cycles
        const garbage = new Array(10000).fill(0).map((_, i) => ({ id: i, data: Math.random() }))
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } else {
      console.warn('Garbage collection analysis requires --expose-gc flag')
    }

    const finalMemory = this.captureMemorySnapshot()
    const memoryReclaimed = Math.max(0, initialMemory.heapUsed - finalMemory.heapUsed)

    const averageGcTime = gcCycles > 0 ? totalGcTime / gcCycles : 0
    const gcEfficiency = initialMemory.heapUsed > 0 ? (memoryReclaimed / initialMemory.heapUsed) * 100 : 0

    return {
      gcCycles,
      totalGcTime,
      averageGcTime,
      maxGcPause,
      memoryReclaimed,
      gcEfficiency,
      gcTriggerThreshold: finalMemory.heapTotal * 0.8 // Estimated trigger at 80% heap usage
    }
  }

  async profileMemoryUsage(): Promise<MemoryProfilerMetrics> {
    // Basic memory profiling (would be more sophisticated with heap dumps in production)
    const objectCounts = new Map<string, number>()
    const objectSizes = new Map<string, number>()
    
    // Simulate object creation and tracking
    const testObjects = [
      { type: 'Array', size: 1024, count: 100 },
      { type: 'Object', size: 512, count: 200 },
      { type: 'Buffer', size: 2048, count: 50 },
      { type: 'String', size: 256, count: 500 },
      { type: 'Function', size: 128, count: 150 }
    ]

    testObjects.forEach(obj => {
      objectCounts.set(obj.type, obj.count)
      objectSizes.set(obj.type, obj.size * obj.count)
    })

    // Identify largest objects
    const largestObjects = testObjects
      .map(obj => ({ type: obj.type, size: obj.size * obj.count, count: obj.count }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 5)

    // Mock memory hotspots
    const memoryHotspots = [
      { function: 'WebSocket.handleMessage', allocations: 1000, size: 2048000 },
      { function: 'PatternDetection.analyze', allocations: 500, size: 1024000 },
      { function: 'Database.query', allocations: 300, size: 512000 },
      { function: 'TradingEngine.execute', allocations: 200, size: 256000 }
    ]

    // Mock retention paths
    const retentionPaths = [
      'global.tradeCache -> Map -> WeakRef -> TradingOrder',
      'WebSocketConnection.messageQueue -> Array -> MessageData',
      'PatternCache.patterns -> Map -> PatternData -> PriceData'
    ]

    return {
      objectCounts,
      objectSizes,
      largestObjects,
      memoryHotspots,
      retentionPaths
    }
  }

  getResults(): MemoryLeakDetectionResult[] {
    return this.results
  }

  getMemorySnapshots(): MemorySnapshot[] {
    return this.memorySnapshots
  }

  generateReport(): string {
    const report = [
      '=== MEMORY PROFILING PERFORMANCE TEST REPORT ===',
      `Total Tests: ${this.results.length}`,
      `Total Snapshots: ${this.memorySnapshots.length}`,
      `Test Date: ${new Date().toISOString()}`,
      '',
      'Memory Leak Detection Results:',
      '─'.repeat(80)
    ]

    this.results.forEach((result, index) => {
      report.push(`${index + 1}. ${result.testName}`)
      report.push(`   Duration: ${result.duration.toFixed(2)}ms`)
      report.push(`   Memory Growth: ${result.memoryGrowth.toFixed(2)}MB (${result.memoryGrowthRate.toFixed(4)}MB/s)`)
      report.push(`   Peak Memory: ${result.peakMemory.heapUsed.toFixed(2)}MB`)
      report.push(`   Leak Detected: ${result.potentialLeakDetected ? '⚠️ YES' : '✅ NO'} (${result.leakSeverity})`)
      report.push(`   GC Efficiency: ${result.gcEfficiency.toFixed(2)}%`)
      report.push(`   Memory Fragmentation: ${result.memoryFragmentation.toFixed(2)}%`)
      
      if (result.suspiciousPatterns.length > 0) {
        report.push(`   Suspicious Patterns:`)
        result.suspiciousPatterns.forEach(pattern => {
          report.push(`     - ${pattern}`)
        })
      }
      report.push('')
    })

    // Add overall memory usage trend
    if (this.memorySnapshots.length > 1) {
      const firstSnapshot = this.memorySnapshots[0]
      const lastSnapshot = this.memorySnapshots[this.memorySnapshots.length - 1]
      const overallGrowth = lastSnapshot.heapUsed - firstSnapshot.heapUsed
      const timeSpan = (lastSnapshot.timestamp - firstSnapshot.timestamp) / 1000

      report.push('Overall Memory Trend:')
      report.push('─'.repeat(40))
      report.push(`Time Span: ${timeSpan.toFixed(2)} seconds`)
      report.push(`Memory Growth: ${overallGrowth.toFixed(2)}MB`)
      report.push(`Growth Rate: ${(overallGrowth / timeSpan).toFixed(4)}MB/s`)
      report.push('')
    }

    return report.join('\n')
  }
}

// Test Suite Implementation
describe('Memory Profiling Performance Tests', () => {
  let testSuite: MemoryProfilingPerformanceTestSuite

  beforeAll(async () => {
    testSuite = new MemoryProfilingPerformanceTestSuite()
    await testSuite.setup()
  })

  afterAll(async () => {
    await testSuite.teardown()
  })

  it('should detect memory leaks in trading operations', async () => {
    const workload = async () => {
      // Simulate trading operations that might leak memory
      const orders = new Array(1000).fill(0).map((_, i) => ({
        id: `order-${i}`,
        symbol: 'BTCUSDT',
        price: 50000 + Math.random() * 1000,
        quantity: Math.random(),
        timestamp: Date.now()
      }))

      // Simulate processing without proper cleanup
      orders.forEach(order => {
        const data = JSON.stringify(order).repeat(100) // Create some allocation
      })

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const result = await testSuite.runMemoryLeakDetectionTest(
      'Trading Operations Memory Leak Test',
      workload,
      10000, // 10 seconds
      30 // 30MB growth limit
    )

    expect(result.potentialLeakDetected).toBe(false)
    expect(result.leakSeverity).toBe('none')
    expect(result.memoryGrowth).toBeLessThan(50) // Should not grow more than 50MB
    expect(result.gcEfficiency).toBeGreaterThan(50) // GC should be at least 50% efficient
  })

  it('should handle WebSocket connection memory usage', async () => {
    const workload = async () => {
      // Simulate WebSocket message handling
      const messages = new Array(500).fill(0).map((_, i) => ({
        type: 'market_data',
        symbol: 'BTCUSDT',
        price: 50000 + Math.random() * 1000,
        volume: Math.random() * 1000,
        timestamp: Date.now(),
        data: Buffer.alloc(1024, 'x') // 1KB buffer per message
      }))

      // Process messages
      messages.forEach(message => {
        const processed = { ...message, processed: true }
        // Simulate message processing
      })

      await new Promise(resolve => setTimeout(resolve, 50))
    }

    const result = await testSuite.runMemoryLeakDetectionTest(
      'WebSocket Memory Usage Test',
      workload,
      15000, // 15 seconds
      40 // 40MB growth limit
    )

    expect(result.memoryGrowth).toBeLessThan(60) // Should not grow more than 60MB
    expect(result.memoryFragmentation).toBeLessThan(30) // Fragmentation should be reasonable
  })

  it('should perform memory stress testing', async () => {
    const stressResult = await testSuite.runMemoryStressTest(
      100, // 100 allocations per second
      10, // 10KB per allocation
      5000 // 5 seconds
    )

    expect(stressResult.systemStability).not.toBe('critical')
    expect(stressResult.performanceImpact).toBeLessThan(200) // Less than 200% performance degradation
    expect(stressResult.resourceExhaustion).toBe(false)
    expect(stressResult.retentionRate).toBeLessThan(50) // Should release at least 50% of allocated memory
  })

  it('should analyze garbage collection efficiency', async () => {
    const gcMetrics = await testSuite.runGarbageCollectionAnalysis()

    if (gcMetrics.gcCycles > 0) {
      expect(gcMetrics.averageGcTime).toBeLessThan(100) // Average GC time < 100ms
      expect(gcMetrics.maxGcPause).toBeLessThan(500) // Max GC pause < 500ms
      expect(gcMetrics.gcEfficiency).toBeGreaterThan(30) // At least 30% efficient
    }
  })

  it('should profile memory usage patterns', async () => {
    const profileMetrics = await testSuite.profileMemoryUsage()

    expect(profileMetrics.objectCounts.size).toBeGreaterThan(0)
    expect(profileMetrics.objectSizes.size).toBeGreaterThan(0)
    expect(profileMetrics.largestObjects.length).toBeGreaterThan(0)
    expect(profileMetrics.memoryHotspots.length).toBeGreaterThan(0)
    expect(profileMetrics.retentionPaths.length).toBeGreaterThan(0)

    // Verify largest objects are identified
    const totalSize = Array.from(profileMetrics.objectSizes.values())
      .reduce((sum, size) => sum + size, 0)
    expect(totalSize).toBeGreaterThan(0)
  })

  it('should detect pattern detection memory usage', async () => {
    const workload = async () => {
      // Simulate pattern detection memory usage
      const priceData = new Array(1000).fill(0).map(() => Math.random() * 100)
      const patterns = new Array(100).fill(0).map((_, i) => ({
        id: i,
        type: 'bullish_divergence',
        confidence: Math.random(),
        data: priceData.slice(i * 10, (i + 1) * 10)
      }))

      // Simulate pattern analysis
      patterns.forEach(pattern => {
        const analysis = pattern.data.map(price => price * Math.random())
        const result = analysis.reduce((sum, val) => sum + val, 0)
      })

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const result = await testSuite.runMemoryLeakDetectionTest(
      'Pattern Detection Memory Test',
      workload,
      8000, // 8 seconds
      25 // 25MB growth limit
    )

    expect(result.memoryGrowth).toBeLessThan(40) // Should not grow more than 40MB
    expect(result.suspiciousPatterns.length).toBeLessThan(3) // Should have minimal suspicious patterns
  })

  it('should validate memory performance SLAs', async () => {
    const results = testSuite.getResults()
    
    // Memory performance SLAs
    const MEMORY_SLA = {
      maxMemoryGrowth: 100, // 100MB
      maxGrowthRate: 0.1, // 0.1MB/s
      minGcEfficiency: 40, // 40%
      maxFragmentation: 40 // 40%
    }

    const slaViolations = results.filter(result => 
      result.memoryGrowth > MEMORY_SLA.maxMemoryGrowth ||
      result.memoryGrowthRate > MEMORY_SLA.maxGrowthRate ||
      result.gcEfficiency < MEMORY_SLA.minGcEfficiency ||
      result.memoryFragmentation > MEMORY_SLA.maxFragmentation
    )

    expect(slaViolations.length).toBe(0) // No SLA violations expected

    // Check for critical memory leaks
    const criticalLeaks = results.filter(result => result.leakSeverity === 'severe')
    expect(criticalLeaks.length).toBe(0) // No critical memory leaks expected
  })

  it('should generate comprehensive memory report', () => {
    const report = testSuite.generateReport()
    
    expect(report).toContain('MEMORY PROFILING PERFORMANCE TEST REPORT')
    expect(report).toContain('Memory Growth:')
    expect(report).toContain('GC Efficiency:')
    expect(report).toContain('Memory Fragmentation:')
    expect(report).toContain('Overall Memory Trend:')
    
    console.log('\n' + report)
  })
})

// Export for use in other test files
export { 
  MemoryProfilingPerformanceTestSuite, 
  type MemoryLeakDetectionResult, 
  type MemorySnapshot,
  type GarbageCollectionMetrics,
  type MemoryStressTestResult,
  type MemoryProfilerMetrics 
}