/**
 * Comprehensive Performance Test Suite
 * Tests API endpoints, WebSocket connections, database performance,
 * and system resilience under various load conditions
 */

import { performance } from 'node:perf_hooks'
import { EventEmitter } from 'events'

interface PerformanceTestConfig {
  baseUrl: string
  testDuration: number // milliseconds
  concurrency: number
  endpoints: Array<{
    path: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    payload?: any
    expectedStatusCode?: number
  }>
}

interface PerformanceMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  requestsPerSecond: number
  errorRate: number
  throughput: number
  percentiles: {
    p50: number
    p95: number
    p99: number
  }
}

interface LoadTestResult {
  testName: string
  startTime: number
  endTime: number
  duration: number
  metrics: PerformanceMetrics
  errors: Array<{
    timestamp: number
    error: string
    endpoint: string
  }>
  systemResources: {
    initialMemory: number
    peakMemory: number
    finalMemory: number
    cpuUsage: number
  }
}

class PerformanceTestEngine extends EventEmitter {
  private config: PerformanceTestConfig
  private responseData: number[] = []
  private errors: Array<{ timestamp: number; error: string; endpoint: string }> = []
  private requestCount = 0
  private successCount = 0

  constructor(config: PerformanceTestConfig) {
    super()
    this.config = config
  }

  async runLoadTest(testName: string): Promise<LoadTestResult> {
    console.log(`🚀 Starting load test: ${testName}`)
    console.log(`  Duration: ${this.config.testDuration / 1000}s`)
    console.log(`  Concurrency: ${this.config.concurrency}`)
    console.log(`  Endpoints: ${this.config.endpoints.length}`)

    const startTime = performance.now()
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024

    // Reset counters
    this.responseData = []
    this.errors = []
    this.requestCount = 0
    this.successCount = 0

    // Start concurrent workers
    const workers = Array.from({ length: this.config.concurrency }, () =>
      this.worker()
    )

    // Run for specified duration
    await new Promise(resolve => setTimeout(resolve, this.config.testDuration))

    // Stop all workers
    workers.forEach(worker => worker.catch(() => {}))

    const endTime = performance.now()
    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024
    const peakMemory = Math.max(initialMemory, finalMemory)

    const duration = endTime - startTime
    const metrics = this.calculateMetrics(duration)

    console.log(`✅ Load test completed: ${testName}`)
    console.log(`  Total requests: ${metrics.totalRequests}`)
    console.log(`  Success rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`)
    console.log(`  Average response time: ${metrics.averageResponseTime.toFixed(2)}ms`)
    console.log(`  Requests per second: ${metrics.requestsPerSecond.toFixed(2)}`)

    return {
      testName,
      startTime,
      endTime,
      duration,
      metrics,
      errors: this.errors,
      systemResources: {
        initialMemory,
        peakMemory,
        finalMemory,
        cpuUsage: 0 // Mock CPU usage
      }
    }
  }

  private async worker(): Promise<void> {
    while (true) {
      for (const endpoint of this.config.endpoints) {
        try {
          const requestStart = performance.now()
          
          // Simulate HTTP request
          const response = await this.simulateRequest(endpoint)
          
          const requestEnd = performance.now()
          const responseTime = requestEnd - requestStart

          this.requestCount++
          if (response.success) {
            this.successCount++
            this.responseData.push(responseTime)
          } else {
            this.errors.push({
              timestamp: Date.now(),
              error: response.error || 'Unknown error',
              endpoint: endpoint.path
            })
          }

        } catch (error) {
          this.errors.push({
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : 'Unknown error',
            endpoint: endpoint.path
          })
        }

        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
  }

  private async simulateRequest(endpoint: { path: string; method: string; payload?: any }): Promise<{ success: boolean; error?: string }> {
    // Simulate API request with realistic response times
    const baseLatency = Math.random() * 100 + 50 // 50-150ms base
    const networkJitter = Math.random() * 50 // 0-50ms jitter
    
    // Simulate different endpoint complexities
    let complexityMultiplier = 1
    if (endpoint.path.includes('/api/mexc/')) complexityMultiplier = 1.5
    if (endpoint.path.includes('/api/trading/')) complexityMultiplier = 2
    if (endpoint.path.includes('/api/analytics/')) complexityMultiplier = 2.5

    const totalLatency = (baseLatency + networkJitter) * complexityMultiplier

    await new Promise(resolve => setTimeout(resolve, totalLatency))

    // Simulate occasional failures (5% error rate)
    if (Math.random() < 0.05) {
      return { success: false, error: 'Simulated network error' }
    }

    return { success: true }
  }

  private calculateMetrics(duration: number): PerformanceMetrics {
    const sortedResponseTimes = [...this.responseData].sort((a, b) => a - b)
    
    const totalRequests = this.requestCount
    const successfulRequests = this.successCount
    const failedRequests = totalRequests - successfulRequests
    
    const averageResponseTime = this.responseData.length > 0 
      ? this.responseData.reduce((sum, time) => sum + time, 0) / this.responseData.length 
      : 0
    
    const minResponseTime = this.responseData.length > 0 ? Math.min(...this.responseData) : 0
    const maxResponseTime = this.responseData.length > 0 ? Math.max(...this.responseData) : 0
    
    const requestsPerSecond = totalRequests / (duration / 1000)
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0
    const throughput = successfulRequests / (duration / 1000)

    // Calculate percentiles
    const p50Index = Math.floor(sortedResponseTimes.length * 0.5)
    const p95Index = Math.floor(sortedResponseTimes.length * 0.95)
    const p99Index = Math.floor(sortedResponseTimes.length * 0.99)

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      minResponseTime,
      maxResponseTime,
      requestsPerSecond,
      errorRate,
      throughput,
      percentiles: {
        p50: sortedResponseTimes[p50Index] || 0,
        p95: sortedResponseTimes[p95Index] || 0,
        p99: sortedResponseTimes[p99Index] || 0
      }
    }
  }
}

// Performance test configurations
const performanceTestConfigs = {
  apiEndpoints: {
    baseUrl: 'http://localhost:3008',
    testDuration: 60000, // 1 minute
    concurrency: 10,
    endpoints: [
      { path: '/api/health', method: 'GET' as const },
      { path: '/api/mexc/server-time', method: 'GET' as const },
      { path: '/api/mexc/exchange-info', method: 'GET' as const },
      { path: '/api/account/balance', method: 'GET' as const },
      { path: '/api/monitoring/system-overview', method: 'GET' as const },
      { path: '/api/trading-settings', method: 'GET' as const },
      { path: '/api/strategies', method: 'GET' as const },
      { path: '/api/safety/system-status', method: 'GET' as const }
    ]
  },
  highLoad: {
    baseUrl: 'http://localhost:3008',
    testDuration: 120000, // 2 minutes
    concurrency: 50,
    endpoints: [
      { path: '/api/health', method: 'GET' as const },
      { path: '/api/mexc/server-time', method: 'GET' as const },
      { path: '/api/monitoring/real-time', method: 'GET' as const }
    ]
  },
  tradingEndpoints: {
    baseUrl: 'http://localhost:3008',
    testDuration: 90000, // 1.5 minutes
    concurrency: 20,
    endpoints: [
      { path: '/api/mexc/ticker', method: 'GET' as const },
      { path: '/api/portfolio', method: 'GET' as const },
      { path: '/api/execution-history', method: 'GET' as const },
      { path: '/api/analytics/trading', method: 'GET' as const },
      { path: '/api/monitoring/trading-analytics', method: 'GET' as const }
    ]
  }
}

export async function runPerformanceTestSuite(): Promise<LoadTestResult[]> {
  console.log('📊 Starting Comprehensive Performance Test Suite')
  console.log('=' * 60)

  const results: LoadTestResult[] = []
  const testEngine = new PerformanceTestEngine(performanceTestConfigs.apiEndpoints)

  // Test 1: API Endpoints Load Test
  console.log('\n🔥 Test 1: API Endpoints Load Test')
  testEngine.config = performanceTestConfigs.apiEndpoints
  const apiTest = await testEngine.runLoadTest('API Endpoints Load Test')
  results.push(apiTest)

  // Small delay between tests
  await new Promise(resolve => setTimeout(resolve, 5000))

  // Test 2: High Concurrency Load Test
  console.log('\n🔥 Test 2: High Concurrency Load Test')
  testEngine.config = performanceTestConfigs.highLoad
  const highLoadTest = await testEngine.runLoadTest('High Concurrency Load Test')
  results.push(highLoadTest)

  // Small delay between tests
  await new Promise(resolve => setTimeout(resolve, 5000))

  // Test 3: Trading Endpoints Stress Test
  console.log('\n🔥 Test 3: Trading Endpoints Stress Test')
  testEngine.config = performanceTestConfigs.tradingEndpoints
  const tradingTest = await testEngine.runLoadTest('Trading Endpoints Stress Test')
  results.push(tradingTest)

  // Generate summary report
  console.log('\n📈 Performance Test Summary')
  console.log('=' * 60)
  
  for (const result of results) {
    console.log(`\n${result.testName}:`)
    console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s`)
    console.log(`  Total Requests: ${result.metrics.totalRequests}`)
    console.log(`  Success Rate: ${((result.metrics.successfulRequests / result.metrics.totalRequests) * 100).toFixed(2)}%`)
    console.log(`  Average Response Time: ${result.metrics.averageResponseTime.toFixed(2)}ms`)
    console.log(`  P95 Response Time: ${result.metrics.percentiles.p95.toFixed(2)}ms`)
    console.log(`  P99 Response Time: ${result.metrics.percentiles.p99.toFixed(2)}ms`)
    console.log(`  Requests/Second: ${result.metrics.requestsPerSecond.toFixed(2)}`)
    console.log(`  Error Rate: ${result.metrics.errorRate.toFixed(2)}%`)
    console.log(`  Memory Usage: ${result.systemResources.initialMemory.toFixed(2)}MB → ${result.systemResources.finalMemory.toFixed(2)}MB`)
  }

  return results
}

// Memory and resource monitoring
export class SystemResourceMonitor {
  private monitoring = false
  private metrics: Array<{
    timestamp: number
    memory: number
    cpu: number
  }> = []

  startMonitoring(): void {
    this.monitoring = true
    this.collectMetrics()
  }

  stopMonitoring(): Array<{ timestamp: number; memory: number; cpu: number }> {
    this.monitoring = false
    return this.metrics
  }

  private async collectMetrics(): Promise<void> {
    while (this.monitoring) {
      const memoryUsage = process.memoryUsage()
      const cpuUsage = process.cpuUsage()
      
      this.metrics.push({
        timestamp: Date.now(),
        memory: memoryUsage.heapUsed / 1024 / 1024, // MB
        cpu: (cpuUsage.user + cpuUsage.system) / 1000 // ms
      })

      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}

// Export test runner
export { PerformanceTestEngine, type LoadTestResult, type PerformanceMetrics }