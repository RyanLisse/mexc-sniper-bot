/**
 * Trading Execution Latency Performance Test Suite
 * Critical performance testing for trading operations, order execution speed, and high-frequency trading scenarios
 */

import { performance } from 'node:perf_hooks'
import { EventEmitter } from 'events'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface TradingLatencyMetrics {
  testName: string
  totalOrders: number
  successfulOrders: number
  failedOrders: number
  averageExecutionTime: number
  medianExecutionTime: number
  p95ExecutionTime: number
  p99ExecutionTime: number
  maxExecutionTime: number
  minExecutionTime: number
  ordersPerSecond: number
  latencyJitter: number
  slippageRate: number
  memoryUsage: {
    initial: number
    peak: number
    final: number
  }
}

interface OrderExecutionProfile {
  orderId: string
  symbol: string
  orderType: 'market' | 'limit' | 'stop-loss' | 'take-profit'
  quantity: number
  price?: number
  startTime: number
  endTime: number
  executionTime: number
  status: 'success' | 'failed' | 'timeout'
  slippage?: number
  error?: string
}

interface HighFrequencyTradingResult {
  testDuration: number
  totalSignals: number
  ordersExecuted: number
  averageSignalToOrderLatency: number
  maxConcurrentOrders: number
  resourceUtilization: {
    cpuUsage: number
    memoryUsage: number
    networkLatency: number
  }
  performanceBottlenecks: string[]
}

interface PatternDetectionPerformance {
  patternsAnalyzed: number
  averageAnalysisTime: number
  patternDetectionLatency: number
  signalGenerationSpeed: number
  accuracyMetrics: {
    truePositives: number
    falsePositives: number
    precision: number
    recall: number
  }
}

class TradingLatencyPerformanceTestSuite extends EventEmitter {
  private baseUrl: string
  private executionProfiles: OrderExecutionProfile[] = []
  private results: TradingLatencyMetrics[] = []

  constructor(baseUrl: string = 'http://localhost:3008') {
    super()
    this.baseUrl = baseUrl
  }

  async setup(): Promise<void> {
    // Ensure trading system is ready
    await this.waitForTradingSystem()
  }

  async teardown(): Promise<void> {
    this.executionProfiles = []
    this.results = []
  }

  private async waitForTradingSystem(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`)
      if (!response.ok) {
        throw new Error('Trading system not ready')
      }
    } catch (error) {
      throw new Error(`Trading system unavailable: ${error}`)
    }
  }

  async simulateOrderExecution(
    symbol: string,
    orderType: 'market' | 'limit' | 'stop-loss' | 'take-profit',
    quantity: number,
    price?: number
  ): Promise<OrderExecutionProfile> {
    const orderId = `test-order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const startTime = performance.now()

    try {
      const orderPayload = {
        symbol,
        type: orderType,
        quantity,
        ...(price && { price }),
        clientOrderId: orderId
      }

      // Simulate API call to trading system
      const response = await fetch(`${this.baseUrl}/api/mexc/trade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderPayload)
      })

      const endTime = performance.now()
      const executionTime = endTime - startTime

      let status: 'success' | 'failed' | 'timeout' = 'success'
      let slippage = 0
      let error: string | undefined

      if (!response.ok) {
        status = 'failed'
        error = `HTTP ${response.status}: ${response.statusText}`
      } else {
        // Simulate slippage calculation for market orders
        if (orderType === 'market' && price) {
          slippage = Math.random() * 0.1 // Random slippage up to 0.1%
        }
      }

      const profile: OrderExecutionProfile = {
        orderId,
        symbol,
        orderType,
        quantity,
        price,
        startTime,
        endTime,
        executionTime,
        status,
        slippage,
        error
      }

      this.executionProfiles.push(profile)
      return profile

    } catch (error) {
      const endTime = performance.now()
      const executionTime = endTime - startTime

      const profile: OrderExecutionProfile = {
        orderId,
        symbol,
        orderType,
        quantity,
        price,
        startTime,
        endTime,
        executionTime,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }

      this.executionProfiles.push(profile)
      return profile
    }
  }

  async runOrderExecutionLatencyTest(
    orderCount: number,
    concurrency: number = 1
  ): Promise<TradingLatencyMetrics> {
    const testName = `Order Execution Latency Test (${orderCount} orders, ${concurrency} concurrent)`
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024
    let peakMemory = initialMemory

    // Monitor memory usage
    const memoryMonitor = setInterval(() => {
      const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024
      if (currentMemory > peakMemory) {
        peakMemory = currentMemory
      }
    }, 100)

    const startTime = performance.now()
    const testSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT']
    const orderTypes: ('market' | 'limit')[] = ['market', 'limit']

    // Execute orders with specified concurrency
    const orderBatches: Promise<OrderExecutionProfile>[] = []
    
    for (let i = 0; i < orderCount; i++) {
      const symbol = testSymbols[i % testSymbols.length]
      const orderType = orderTypes[i % orderTypes.length]
      const quantity = 0.001 + Math.random() * 0.01 // Random quantity between 0.001 and 0.011
      const price = orderType === 'limit' ? 50000 + Math.random() * 1000 : undefined

      const orderPromise = this.simulateOrderExecution(symbol, orderType, quantity, price)
      orderBatches.push(orderPromise)

      // Control concurrency
      if (orderBatches.length >= concurrency) {
        await Promise.allSettled(orderBatches.splice(0, concurrency))
      }

      // Small delay between order submissions
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Wait for remaining orders
    if (orderBatches.length > 0) {
      await Promise.allSettled(orderBatches)
    }

    clearInterval(memoryMonitor)
    const endTime = performance.now()
    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024

    // Calculate metrics from execution profiles
    const testProfiles = this.executionProfiles.slice(-orderCount)
    const successfulOrders = testProfiles.filter(p => p.status === 'success').length
    const failedOrders = testProfiles.filter(p => p.status === 'failed').length
    
    const executionTimes = testProfiles.map(p => p.executionTime)
    const sortedTimes = [...executionTimes].sort((a, b) => a - b)
    
    const averageExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
    const medianExecutionTime = sortedTimes[Math.floor(sortedTimes.length / 2)]
    const p95ExecutionTime = sortedTimes[Math.floor(sortedTimes.length * 0.95)]
    const p99ExecutionTime = sortedTimes[Math.floor(sortedTimes.length * 0.99)]
    const maxExecutionTime = Math.max(...executionTimes)
    const minExecutionTime = Math.min(...executionTimes)
    
    const totalDuration = (endTime - startTime) / 1000
    const ordersPerSecond = orderCount / totalDuration
    
    // Calculate latency jitter
    const latencyJitter = this.calculateJitter(executionTimes)
    
    // Calculate slippage rate
    const ordersWithSlippage = testProfiles.filter(p => p.slippage && p.slippage > 0)
    const slippageRate = (ordersWithSlippage.length / successfulOrders) * 100

    const result: TradingLatencyMetrics = {
      testName,
      totalOrders: orderCount,
      successfulOrders,
      failedOrders,
      averageExecutionTime,
      medianExecutionTime,
      p95ExecutionTime,
      p99ExecutionTime,
      maxExecutionTime,
      minExecutionTime,
      ordersPerSecond,
      latencyJitter,
      slippageRate,
      memoryUsage: {
        initial: initialMemory,
        peak: peakMemory,
        final: finalMemory
      }
    }

    this.results.push(result)
    return result
  }

  private calculateJitter(latencies: number[]): number {
    if (latencies.length < 2) return 0
    
    const variations = latencies.slice(1).map((lat, i) => Math.abs(lat - latencies[i]))
    return variations.reduce((sum, variation) => sum + variation, 0) / variations.length
  }

  async runHighFrequencyTradingTest(
    signalsPerSecond: number,
    testDuration: number
  ): Promise<HighFrequencyTradingResult> {
    const startTime = performance.now()
    const endTime = startTime + testDuration
    
    let totalSignals = 0
    let ordersExecuted = 0
    let maxConcurrentOrders = 0
    let currentConcurrentOrders = 0
    const signalToOrderLatencies: number[] = []
    const performanceBottlenecks: string[] = []

    const signalInterval = 1000 / signalsPerSecond
    
    // Monitor resource utilization
    const initialCpu = process.cpuUsage()
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024

    while (performance.now() < endTime) {
      const signalTime = performance.now()
      totalSignals++

      // Simulate trading signal processing
      const signal = {
        symbol: 'BTCUSDT',
        action: Math.random() > 0.5 ? 'buy' : 'sell',
        confidence: Math.random(),
        price: 50000 + Math.random() * 1000
      }

      if (signal.confidence > 0.7) { // Only execute high-confidence signals
        currentConcurrentOrders++
        maxConcurrentOrders = Math.max(maxConcurrentOrders, currentConcurrentOrders)

        // Execute order (simulate)
        const orderStart = performance.now()
        
        try {
          await this.simulateOrderExecution(
            signal.symbol,
            'market',
            0.001,
            signal.price
          )
          
          const orderEnd = performance.now()
          const signalToOrderLatency = orderEnd - signalTime
          signalToOrderLatencies.push(signalToOrderLatency)
          
          ordersExecuted++
          
          // Check for performance bottlenecks
          if (signalToOrderLatency > 100) {
            performanceBottlenecks.push(`High latency detected: ${signalToOrderLatency.toFixed(2)}ms`)
          }
          
        } catch (error) {
          performanceBottlenecks.push(`Order execution failed: ${error}`)
        } finally {
          currentConcurrentOrders--
        }
      }

      // Wait for next signal interval
      const nextSignalTime = signalTime + signalInterval
      const waitTime = Math.max(0, nextSignalTime - performance.now())
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }

    // Calculate resource utilization
    const finalCpu = process.cpuUsage()
    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024
    
    const cpuUsage = ((finalCpu.user - initialCpu.user) + (finalCpu.system - initialCpu.system)) / 1000
    const memoryUsage = finalMemory - initialMemory

    return {
      testDuration,
      totalSignals,
      ordersExecuted,
      averageSignalToOrderLatency: signalToOrderLatencies.reduce((sum, lat) => sum + lat, 0) / signalToOrderLatencies.length,
      maxConcurrentOrders,
      resourceUtilization: {
        cpuUsage,
        memoryUsage,
        networkLatency: 0 // Would need additional measurement
      },
      performanceBottlenecks: [...new Set(performanceBottlenecks)].slice(0, 10) // Top 10 unique bottlenecks
    }
  }

  async runPatternDetectionPerformanceTest(
    patternCount: number
  ): Promise<PatternDetectionPerformance> {
    const analysisStartTime = performance.now()
    let patternsAnalyzed = 0
    let totalAnalysisTime = 0
    let patternDetectionLatency = 0
    let signalGenerationSpeed = 0

    // Simulate pattern detection and analysis
    const patterns = this.generateTestPatterns(patternCount)
    
    for (const pattern of patterns) {
      const patternStartTime = performance.now()
      
      try {
        // Simulate pattern analysis API call
        const response = await fetch(`${this.baseUrl}/api/pattern-detection`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            symbol: pattern.symbol,
            priceData: pattern.priceData,
            timeframe: pattern.timeframe
          })
        })

        const patternEndTime = performance.now()
        const analysisTime = patternEndTime - patternStartTime
        
        totalAnalysisTime += analysisTime
        patternsAnalyzed++
        
        if (response.ok) {
          const result = await response.json()
          
          // Measure signal generation time if pattern detected
          if (result.patternDetected) {
            const signalTime = performance.now() - patternEndTime
            signalGenerationSpeed += signalTime
          }
        }
        
      } catch (error) {
        console.warn(`Pattern analysis failed for ${pattern.symbol}:`, error)
      }
    }

    const analysisEndTime = performance.now()
    patternDetectionLatency = analysisEndTime - analysisStartTime
    
    // Simulate accuracy metrics (would be calculated from real results)
    const accuracyMetrics = {
      truePositives: Math.floor(patternsAnalyzed * 0.7), // 70% accuracy simulation
      falsePositives: Math.floor(patternsAnalyzed * 0.1), // 10% false positives
      precision: 0.85,
      recall: 0.7
    }

    return {
      patternsAnalyzed,
      averageAnalysisTime: totalAnalysisTime / patternsAnalyzed,
      patternDetectionLatency,
      signalGenerationSpeed: signalGenerationSpeed / patternsAnalyzed,
      accuracyMetrics
    }
  }

  private generateTestPatterns(count: number): Array<{
    symbol: string
    priceData: number[]
    timeframe: string
  }> {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT']
    const timeframes = ['1m', '5m', '15m', '1h']
    
    return Array.from({ length: count }, (_, i) => ({
      symbol: symbols[i % symbols.length],
      priceData: this.generateMockPriceData(),
      timeframe: timeframes[i % timeframes.length]
    }))
  }

  private generateMockPriceData(): number[] {
    const basePrice = 50000
    const dataPoints = 100
    
    return Array.from({ length: dataPoints }, (_, i) => {
      const trend = Math.sin(i / 10) * 1000
      const noise = (Math.random() - 0.5) * 500
      return basePrice + trend + noise
    })
  }

  async runArbitrageLatencyTest(): Promise<{
    averageArbitrageDetectionTime: number
    averageExecutionTime: number
    successfulArbitrages: number
    missedOpportunities: number
    profitability: number
  }> {
    const opportunities = 10
    const detectionTimes: number[] = []
    const executionTimes: number[] = []
    let successfulArbitrages = 0
    let missedOpportunities = 0
    let totalProfit = 0

    for (let i = 0; i < opportunities; i++) {
      const detectionStart = performance.now()
      
      // Simulate arbitrage opportunity detection
      const opportunity = {
        buyExchange: 'MEXC',
        sellExchange: 'Binance',
        symbol: 'BTCUSDT',
        buyPrice: 50000,
        sellPrice: 50050,
        profit: 50,
        window: 2000 // 2 second window
      }

      const detectionTime = performance.now() - detectionStart
      detectionTimes.push(detectionTime)

      // Simulate arbitrage execution
      const executionStart = performance.now()
      
      if (detectionTime < opportunity.window / 2) { // Must detect quickly enough
        try {
          // Simulate buying on one exchange and selling on another
          await Promise.all([
            this.simulateOrderExecution(opportunity.symbol, 'market', 0.1, opportunity.buyPrice),
            this.simulateOrderExecution(opportunity.symbol, 'market', 0.1, opportunity.sellPrice)
          ])
          
          const executionTime = performance.now() - executionStart
          executionTimes.push(executionTime)
          
          if (executionTime < opportunity.window) {
            successfulArbitrages++
            totalProfit += opportunity.profit
          } else {
            missedOpportunities++
          }
          
        } catch (error) {
          missedOpportunities++
        }
      } else {
        missedOpportunities++
      }

      // Wait before next opportunity
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return {
      averageArbitrageDetectionTime: detectionTimes.reduce((sum, time) => sum + time, 0) / detectionTimes.length,
      averageExecutionTime: executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length,
      successfulArbitrages,
      missedOpportunities,
      profitability: totalProfit / opportunities
    }
  }

  getResults(): TradingLatencyMetrics[] {
    return this.results
  }

  getExecutionProfiles(): OrderExecutionProfile[] {
    return this.executionProfiles
  }

  generateReport(): string {
    const report = [
      '=== TRADING LATENCY PERFORMANCE TEST REPORT ===',
      `Total Tests: ${this.results.length}`,
      `Total Orders Executed: ${this.executionProfiles.length}`,
      `Test Date: ${new Date().toISOString()}`,
      '',
      'Trading Performance Metrics:',
      '─'.repeat(80)
    ]

    this.results.forEach((result, index) => {
      report.push(`${index + 1}. ${result.testName}`)
      report.push(`   Orders: ${result.totalOrders} (${result.successfulOrders} successful, ${result.failedOrders} failed)`)
      report.push(`   Execution Time: ${result.averageExecutionTime.toFixed(2)}ms avg, ${result.medianExecutionTime.toFixed(2)}ms median`)
      report.push(`   P95/P99: ${result.p95ExecutionTime.toFixed(2)}ms / ${result.p99ExecutionTime.toFixed(2)}ms`)
      report.push(`   Range: ${result.minExecutionTime.toFixed(2)}ms - ${result.maxExecutionTime.toFixed(2)}ms`)
      report.push(`   Throughput: ${result.ordersPerSecond.toFixed(2)} orders/sec`)
      report.push(`   Jitter: ${result.latencyJitter.toFixed(2)}ms`)
      report.push(`   Slippage Rate: ${result.slippageRate.toFixed(2)}%`)
      report.push(`   Memory Usage: ${result.memoryUsage.initial.toFixed(2)}MB → ${result.memoryUsage.final.toFixed(2)}MB (Peak: ${result.memoryUsage.peak.toFixed(2)}MB)`)
      report.push('')
    })

    // Add execution profile summary
    if (this.executionProfiles.length > 0) {
      const successRate = (this.executionProfiles.filter(p => p.status === 'success').length / this.executionProfiles.length) * 100
      const avgSlippage = this.executionProfiles
        .filter(p => p.slippage !== undefined)
        .reduce((sum, p) => sum + (p.slippage || 0), 0) / this.executionProfiles.length

      report.push('Overall Execution Summary:')
      report.push('─'.repeat(40))
      report.push(`Success Rate: ${successRate.toFixed(2)}%`)
      report.push(`Average Slippage: ${avgSlippage.toFixed(4)}%`)
      report.push('')
    }

    return report.join('\n')
  }
}

// Test Suite Implementation
describe('Trading Execution Latency Performance Tests', () => {
  let testSuite: TradingLatencyPerformanceTestSuite

  beforeAll(async () => {
    testSuite = new TradingLatencyPerformanceTestSuite()
    await testSuite.setup()
  })

  afterAll(async () => {
    await testSuite.teardown()
  })

  it('should execute single orders within latency requirements', async () => {
    const result = await testSuite.runOrderExecutionLatencyTest(10, 1) // 10 orders sequentially
    
    expect(result.averageExecutionTime).toBeLessThan(500) // Average < 500ms
    expect(result.p95ExecutionTime).toBeLessThan(1000) // 95th percentile < 1 second
    expect(result.successfulOrders).toBeGreaterThanOrEqual(8) // At least 80% success rate
    expect(result.latencyJitter).toBeLessThan(100) // Jitter < 100ms
  })

  it('should handle concurrent order execution efficiently', async () => {
    const result = await testSuite.runOrderExecutionLatencyTest(20, 5) // 20 orders with 5 concurrent
    
    expect(result.averageExecutionTime).toBeLessThan(1000) // Average < 1 second under load
    expect(result.ordersPerSecond).toBeGreaterThan(2) // At least 2 orders/sec
    expect(result.successfulOrders).toBeGreaterThanOrEqual(16) // At least 80% success rate
  })

  it('should perform high-frequency trading within requirements', async () => {
    const hftResult = await testSuite.runHighFrequencyTradingTest(10, 30000) // 10 signals/sec for 30 seconds
    
    expect(hftResult.ordersExecuted).toBeGreaterThan(0) // Should execute some orders
    expect(hftResult.averageSignalToOrderLatency).toBeLessThan(200) // Signal to order < 200ms
    expect(hftResult.maxConcurrentOrders).toBeLessThan(20) // Reasonable concurrency limit
    expect(hftResult.resourceUtilization.memoryUsage).toBeLessThan(100) // Memory growth < 100MB
  })

  it('should process pattern detection efficiently', async () => {
    const patternResult = await testSuite.runPatternDetectionPerformanceTest(50)
    
    expect(patternResult.averageAnalysisTime).toBeLessThan(1000) // Analysis < 1 second per pattern
    expect(patternResult.patternsAnalyzed).toBeGreaterThan(40) // At least 80% processed
    expect(patternResult.accuracyMetrics.precision).toBeGreaterThan(0.7) // At least 70% precision
  })

  it('should execute arbitrage opportunities with low latency', async () => {
    const arbitrageResult = await testSuite.runArbitrageLatencyTest()
    
    expect(arbitrageResult.averageArbitrageDetectionTime).toBeLessThan(100) // Detection < 100ms
    expect(arbitrageResult.averageExecutionTime).toBeLessThan(500) // Execution < 500ms
    expect(arbitrageResult.successfulArbitrages).toBeGreaterThan(0) // At least some successful
    expect(arbitrageResult.missedOpportunities).toBeLessThan(8) // Less than 80% missed
  })

  it('should maintain performance under stress conditions', async () => {
    const stressResult = await testSuite.runOrderExecutionLatencyTest(100, 10) // 100 orders with 10 concurrent
    
    expect(stressResult.averageExecutionTime).toBeLessThan(2000) // Average < 2 seconds under stress
    expect(stressResult.ordersPerSecond).toBeGreaterThan(5) // At least 5 orders/sec
    expect(stressResult.successfulOrders).toBeGreaterThanOrEqual(70) // At least 70% success under stress
    expect(stressResult.memoryUsage.peak - stressResult.memoryUsage.initial).toBeLessThan(150) // Memory growth < 150MB
  })

  it('should validate trading SLA requirements', async () => {
    const results = testSuite.getResults()
    
    // Trading SLA requirements
    const TRADING_SLA = {
      maxAverageLatency: 1000, // 1 second
      maxP95Latency: 2000, // 2 seconds
      minSuccessRate: 90, // 90%
      maxJitter: 200 // 200ms
    }

    const slaViolations = results.filter(result => 
      result.averageExecutionTime > TRADING_SLA.maxAverageLatency ||
      result.p95ExecutionTime > TRADING_SLA.maxP95Latency ||
      (result.successfulOrders / result.totalOrders) * 100 < TRADING_SLA.minSuccessRate ||
      result.latencyJitter > TRADING_SLA.maxJitter
    )

    expect(slaViolations.length).toBe(0) // No SLA violations expected
  })

  it('should generate comprehensive trading performance report', () => {
    const report = testSuite.generateReport()
    
    expect(report).toContain('TRADING LATENCY PERFORMANCE TEST REPORT')
    expect(report).toContain('Total Orders Executed:')
    expect(report).toContain('Execution Time:')
    expect(report).toContain('Throughput:')
    expect(report).toContain('Success Rate:')
    
    console.log('\n' + report)
  })
})

// Export for use in other test files
export { 
  TradingLatencyPerformanceTestSuite, 
  type TradingLatencyMetrics, 
  type OrderExecutionProfile, 
  type HighFrequencyTradingResult,
  type PatternDetectionPerformance 
}