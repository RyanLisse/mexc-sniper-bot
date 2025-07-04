/**
 * Advanced Load Testing Suite
 * Sophisticated load testing scenarios for peak usage, burst loads, and scalability testing
 */

import { performance } from 'node:perf_hooks'
import { EventEmitter } from 'events'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface LoadTestScenario {
  name: string
  userCount: number
  rampUpTime: number // milliseconds
  sustainTime: number // milliseconds
  rampDownTime: number // milliseconds
  thinkTime: number // milliseconds between requests
  endpoints: Array<{
    path: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    weight: number // probability of selection (0-1)
    payload?: any
  }>
}

interface LoadTestMetrics {
  scenarioName: string
  totalUsers: number
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  medianResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  requestsPerSecond: number
  errorsPerSecond: number
  throughputMBps: number
  concurrentUsers: number
  errorRate: number
  apdex: number // Application Performance Index
  systemResources: {
    cpuUtilization: number
    memoryUtilization: number
    networkUtilization: number
  }
}

interface UserSession {
  userId: string
  startTime: number
  endTime?: number
  requests: RequestMetrics[]
  errors: string[]
  thinkTimeTotal: number
}

interface RequestMetrics {
  endpoint: string
  method: string
  startTime: number
  endTime: number
  responseTime: number
  statusCode: number
  size: number
  success: boolean
  error?: string
}

interface ScalabilityTestResult {
  maxConcurrentUsers: number
  breakingPoint: number
  performanceDegradation: Array<{
    userCount: number
    responseTime: number
    errorRate: number
    throughput: number
  }>
  resourceBottlenecks: string[]
  scalabilityFactor: number
}

class AdvancedLoadTestingSuite extends EventEmitter {
  private baseUrl: string
  private activeSessions: Map<string, UserSession> = new Map()
  private results: LoadTestMetrics[] = []
  private isRunning = false

  constructor(baseUrl: string = 'http://localhost:3008') {
    super()
    this.baseUrl = baseUrl
  }

  async setup(): Promise<void> {
    // Verify system is ready for load testing
    await this.validateSystemReadiness()
  }

  async teardown(): Promise<void> {
    this.isRunning = false
    this.activeSessions.clear()
    // Allow time for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  private async validateSystemReadiness(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`)
      if (!response.ok) {
        throw new Error(`System not ready: HTTP ${response.status}`)
      }
    } catch (error) {
      throw new Error(`System validation failed: ${error}`)
    }
  }

  async runLoadTestScenario(scenario: LoadTestScenario): Promise<LoadTestMetrics> {
    console.log(`🚀 Starting load test scenario: ${scenario.name}`)
    console.log(`  Users: ${scenario.userCount}`)
    console.log(`  Ramp-up: ${scenario.rampUpTime}ms`)
    console.log(`  Sustain: ${scenario.sustainTime}ms`)
    console.log(`  Ramp-down: ${scenario.rampDownTime}ms`)

    this.isRunning = true
    const startTime = performance.now()
    const allRequestMetrics: RequestMetrics[] = []
    const userPromises: Promise<void>[] = []

    // Phase 1: Ramp-up
    await this.executeRampUp(scenario, userPromises, allRequestMetrics)
    
    // Phase 2: Sustain load
    await this.executeSustainLoad(scenario, allRequestMetrics)
    
    // Phase 3: Ramp-down
    await this.executeRampDown(scenario)

    // Wait for all users to complete
    await Promise.allSettled(userPromises)

    const endTime = performance.now()
    this.isRunning = false

    // Calculate metrics
    const metrics = this.calculateLoadTestMetrics(
      scenario.name,
      scenario.userCount,
      allRequestMetrics,
      endTime - startTime
    )

    this.results.push(metrics)
    console.log(`✅ Load test completed: ${scenario.name}`)
    console.log(`  Success rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`)
    console.log(`  Average response time: ${metrics.averageResponseTime.toFixed(2)}ms`)
    console.log(`  Requests per second: ${metrics.requestsPerSecond.toFixed(2)}`)

    return metrics
  }

  private async executeRampUp(
    scenario: LoadTestScenario,
    userPromises: Promise<void>[],
    allRequestMetrics: RequestMetrics[]
  ): Promise<void> {
    console.log('  📈 Ramping up users...')
    
    const userSpawnInterval = scenario.rampUpTime / scenario.userCount
    
    for (let i = 0; i < scenario.userCount; i++) {
      if (!this.isRunning) break
      
      const userId = `user-${i}`
      const userPromise = this.simulateUser(userId, scenario, allRequestMetrics)
      userPromises.push(userPromise)
      
      // Spawn users gradually
      if (i < scenario.userCount - 1) {
        await new Promise(resolve => setTimeout(resolve, userSpawnInterval))
      }
    }
  }

  private async executeSustainLoad(
    scenario: LoadTestScenario,
    allRequestMetrics: RequestMetrics[]
  ): Promise<void> {
    console.log('  ⚡ Sustaining load...')
    
    // Monitor system during sustained load
    const sustainStartTime = performance.now()
    const monitoringInterval = setInterval(() => {
      const elapsed = performance.now() - sustainStartTime
      const progress = (elapsed / scenario.sustainTime) * 100
      
      if (progress >= 100) {
        clearInterval(monitoringInterval)
        return
      }
      
      // Log progress every 25%
      if (progress % 25 < 1) {
        console.log(`    Progress: ${Math.floor(progress)}% - Active requests: ${allRequestMetrics.length}`)
      }
    }, 1000)

    await new Promise(resolve => setTimeout(resolve, scenario.sustainTime))
    clearInterval(monitoringInterval)
  }

  private async executeRampDown(scenario: LoadTestScenario): Promise<void> {
    console.log('  📉 Ramping down...')
    
    // Gracefully stop users
    await new Promise(resolve => setTimeout(resolve, scenario.rampDownTime))
    this.isRunning = false
  }

  private async simulateUser(
    userId: string,
    scenario: LoadTestScenario,
    allRequestMetrics: RequestMetrics[]
  ): Promise<void> {
    const session: UserSession = {
      userId,
      startTime: performance.now(),
      requests: [],
      errors: [],
      thinkTimeTotal: 0
    }

    this.activeSessions.set(userId, session)

    try {
      while (this.isRunning) {
        // Select endpoint based on weights
        const endpoint = this.selectEndpoint(scenario.endpoints)
        
        // Execute request
        const requestMetrics = await this.executeRequest(endpoint)
        session.requests.push(requestMetrics)
        allRequestMetrics.push(requestMetrics)

        // Handle errors
        if (!requestMetrics.success) {
          session.errors.push(requestMetrics.error || 'Unknown error')
        }

        // Think time (simulate user behavior)
        if (scenario.thinkTime > 0) {
          const thinkTime = scenario.thinkTime + (Math.random() * scenario.thinkTime * 0.5) // ±25% variation
          session.thinkTimeTotal += thinkTime
          await new Promise(resolve => setTimeout(resolve, thinkTime))
        }

        // Break if too many consecutive errors
        if (session.errors.length > 10) {
          console.warn(`User ${userId} experiencing too many errors, stopping`)
          break
        }
      }
    } catch (error) {
      session.errors.push(`Session error: ${error}`)
    } finally {
      session.endTime = performance.now()
      this.activeSessions.delete(userId)
    }
  }

  private selectEndpoint(endpoints: LoadTestScenario['endpoints']): LoadTestScenario['endpoints'][0] {
    const random = Math.random()
    let cumulativeWeight = 0
    
    for (const endpoint of endpoints) {
      cumulativeWeight += endpoint.weight
      if (random <= cumulativeWeight) {
        return endpoint
      }
    }
    
    // Fallback to first endpoint
    return endpoints[0]
  }

  private async executeRequest(endpoint: LoadTestScenario['endpoints'][0]): Promise<RequestMetrics> {
    const startTime = performance.now()
    let statusCode = 0
    let size = 0
    let success = false
    let error: string | undefined

    try {
      const options: RequestInit = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AdvancedLoadTest/1.0'
        }
      }

      if (endpoint.payload && (endpoint.method === 'POST' || endpoint.method === 'PUT')) {
        options.body = JSON.stringify(endpoint.payload)
      }

      const response = await fetch(`${this.baseUrl}${endpoint.path}`, options)
      statusCode = response.status
      success = response.ok

      const responseText = await response.text()
      size = responseText.length

      if (!success) {
        error = `HTTP ${statusCode}: ${response.statusText}`
      }

    } catch (fetchError) {
      error = fetchError instanceof Error ? fetchError.message : 'Network error'
      success = false
    }

    const endTime = performance.now()

    return {
      endpoint: endpoint.path,
      method: endpoint.method,
      startTime,
      endTime,
      responseTime: endTime - startTime,
      statusCode,
      size,
      success,
      error
    }
  }

  private calculateLoadTestMetrics(
    scenarioName: string,
    totalUsers: number,
    requestMetrics: RequestMetrics[],
    testDuration: number
  ): LoadTestMetrics {
    const totalRequests = requestMetrics.length
    const successfulRequests = requestMetrics.filter(r => r.success).length
    const failedRequests = totalRequests - successfulRequests

    const responseTimes = requestMetrics.map(r => r.responseTime)
    const sortedResponseTimes = [...responseTimes].sort((a, b) => a - b)

    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    const medianResponseTime = sortedResponseTimes[Math.floor(sortedResponseTimes.length / 2)] || 0
    const p95ResponseTime = sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.95)] || 0
    const p99ResponseTime = sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.99)] || 0
    const minResponseTime = Math.min(...responseTimes)
    const maxResponseTime = Math.max(...responseTimes)

    const testDurationSeconds = testDuration / 1000
    const requestsPerSecond = totalRequests / testDurationSeconds
    const errorsPerSecond = failedRequests / testDurationSeconds
    const errorRate = (failedRequests / totalRequests) * 100

    // Calculate throughput in MB/s
    const totalBytes = requestMetrics.reduce((sum, r) => sum + r.size, 0)
    const throughputMBps = (totalBytes / 1024 / 1024) / testDurationSeconds

    // Calculate APDEX (Application Performance Index)
    // Assuming satisfied = <500ms, tolerating = <2000ms
    const satisfiedRequests = requestMetrics.filter(r => r.responseTime <= 500).length
    const toleratingRequests = requestMetrics.filter(r => r.responseTime > 500 && r.responseTime <= 2000).length
    const apdex = (satisfiedRequests + (toleratingRequests * 0.5)) / totalRequests

    // Mock system resource utilization (would be real in production)
    const systemResources = {
      cpuUtilization: Math.min(90, 20 + (totalUsers * 1.5)), // Simulate CPU usage
      memoryUtilization: Math.min(85, 15 + (totalUsers * 0.8)), // Simulate memory usage
      networkUtilization: Math.min(95, 10 + (requestsPerSecond * 0.1)) // Simulate network usage
    }

    return {
      scenarioName,
      totalUsers,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      medianResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      minResponseTime,
      maxResponseTime,
      requestsPerSecond,
      errorsPerSecond,
      throughputMBps,
      concurrentUsers: totalUsers,
      errorRate,
      apdex,
      systemResources
    }
  }

  async runScalabilityTest(
    baseScenario: LoadTestScenario,
    maxUsers: number,
    step: number
  ): Promise<ScalabilityTestResult> {
    console.log(`🔬 Starting scalability test up to ${maxUsers} users`)
    
    const performanceDegradation: ScalabilityTestResult['performanceDegradation'] = []
    const resourceBottlenecks: string[] = []
    let breakingPoint = maxUsers
    let maxConcurrentUsers = 0

    for (let userCount = step; userCount <= maxUsers; userCount += step) {
      console.log(`\n📊 Testing with ${userCount} users...`)
      
      const scenario: LoadTestScenario = {
        ...baseScenario,
        name: `Scalability Test - ${userCount} users`,
        userCount,
        rampUpTime: Math.min(baseScenario.rampUpTime, userCount * 100), // Scale ramp-up time
        sustainTime: 30000 // 30 seconds sustain for scalability test
      }

      try {
        const metrics = await this.runLoadTestScenario(scenario)
        
        performanceDegradation.push({
          userCount,
          responseTime: metrics.averageResponseTime,
          errorRate: metrics.errorRate,
          throughput: metrics.requestsPerSecond
        })

        maxConcurrentUsers = userCount

        // Check for breaking point indicators
        if (metrics.errorRate > 5 || metrics.averageResponseTime > 5000) {
          breakingPoint = userCount
          resourceBottlenecks.push(`Breaking point at ${userCount} users: ${metrics.errorRate.toFixed(2)}% error rate, ${metrics.averageResponseTime.toFixed(2)}ms avg response time`)
          break
        }

        // Check for resource bottlenecks
        if (metrics.systemResources.cpuUtilization > 80) {
          resourceBottlenecks.push(`CPU bottleneck at ${userCount} users: ${metrics.systemResources.cpuUtilization.toFixed(2)}%`)
        }
        
        if (metrics.systemResources.memoryUtilization > 80) {
          resourceBottlenecks.push(`Memory bottleneck at ${userCount} users: ${metrics.systemResources.memoryUtilization.toFixed(2)}%`)
        }

        // Cool down between tests
        await new Promise(resolve => setTimeout(resolve, 5000))

      } catch (error) {
        breakingPoint = userCount
        resourceBottlenecks.push(`System failure at ${userCount} users: ${error}`)
        break
      }
    }

    // Calculate scalability factor
    const scalabilityFactor = this.calculateScalabilityFactor(performanceDegradation)

    return {
      maxConcurrentUsers,
      breakingPoint,
      performanceDegradation,
      resourceBottlenecks,
      scalabilityFactor
    }
  }

  private calculateScalabilityFactor(degradation: ScalabilityTestResult['performanceDegradation']): number {
    if (degradation.length < 2) return 1

    // Calculate how well performance scales with user count
    // Perfect scalability = 1, no scalability = 0
    const first = degradation[0]
    const last = degradation[degradation.length - 1]

    const userCountRatio = last.userCount / first.userCount
    const throughputRatio = last.throughput / first.throughput
    const responseTimeRatio = first.responseTime / last.responseTime

    // Ideal throughput should scale linearly with users
    const throughputScaling = Math.min(1, throughputRatio / userCountRatio)
    
    // Response time should remain stable
    const responseTimeScaling = Math.min(1, responseTimeRatio)

    return (throughputScaling + responseTimeScaling) / 2
  }

  async runBurstLoadTest(
    baseScenario: LoadTestScenario,
    burstMultiplier: number,
    burstDuration: number
  ): Promise<LoadTestMetrics> {
    console.log(`💥 Starting burst load test (${burstMultiplier}x normal load)`)

    const burstScenario: LoadTestScenario = {
      ...baseScenario,
      name: `Burst Load Test - ${burstMultiplier}x load`,
      userCount: baseScenario.userCount * burstMultiplier,
      rampUpTime: 5000, // Quick ramp-up for burst
      sustainTime: burstDuration,
      rampDownTime: 2000, // Quick ramp-down
      thinkTime: Math.max(10, baseScenario.thinkTime / burstMultiplier) // Faster requests
    }

    return await this.runLoadTestScenario(burstScenario)
  }

  getResults(): LoadTestMetrics[] {
    return this.results
  }

  getActiveSessions(): UserSession[] {
    return Array.from(this.activeSessions.values())
  }

  generateReport(): string {
    const report = [
      '=== ADVANCED LOAD TESTING REPORT ===',
      `Total Scenarios: ${this.results.length}`,
      `Test Date: ${new Date().toISOString()}`,
      '',
      'Load Test Results:',
      '─'.repeat(80)
    ]

    this.results.forEach((result, index) => {
      report.push(`${index + 1}. ${result.scenarioName}`)
      report.push(`   Users: ${result.totalUsers} concurrent`)
      report.push(`   Requests: ${result.totalRequests} (${result.successfulRequests} successful, ${result.failedRequests} failed)`)
      report.push(`   Success Rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`)
      report.push(`   Response Times: ${result.averageResponseTime.toFixed(2)}ms avg, ${result.medianResponseTime.toFixed(2)}ms median`)
      report.push(`   Percentiles: P95=${result.p95ResponseTime.toFixed(2)}ms, P99=${result.p99ResponseTime.toFixed(2)}ms`)
      report.push(`   Throughput: ${result.requestsPerSecond.toFixed(2)} req/s, ${result.throughputMBps.toFixed(2)} MB/s`)
      report.push(`   APDEX Score: ${result.apdex.toFixed(3)}`)
      report.push(`   System Resources: CPU=${result.systemResources.cpuUtilization.toFixed(1)}%, Memory=${result.systemResources.memoryUtilization.toFixed(1)}%, Network=${result.systemResources.networkUtilization.toFixed(1)}%`)
      report.push('')
    })

    return report.join('\n')
  }
}

// Predefined load test scenarios
const LOAD_TEST_SCENARIOS: { [key: string]: LoadTestScenario } = {
  lightTrading: {
    name: 'Light Trading Load',
    userCount: 10,
    rampUpTime: 30000,
    sustainTime: 60000,
    rampDownTime: 15000,
    thinkTime: 2000,
    endpoints: [
      { path: '/api/health', method: 'GET', weight: 0.1 },
      { path: '/api/account/balance', method: 'GET', weight: 0.3 },
      { path: '/api/mexc/ticker', method: 'GET', weight: 0.3 },
      { path: '/api/trading-settings', method: 'GET', weight: 0.2 },
      { path: '/api/strategies', method: 'GET', weight: 0.1 }
    ]
  },

  normalTrading: {
    name: 'Normal Trading Load',
    userCount: 50,
    rampUpTime: 60000,
    sustainTime: 120000,
    rampDownTime: 30000,
    thinkTime: 1000,
    endpoints: [
      { path: '/api/health', method: 'GET', weight: 0.05 },
      { path: '/api/account/balance', method: 'GET', weight: 0.25 },
      { path: '/api/mexc/ticker', method: 'GET', weight: 0.3 },
      { path: '/api/portfolio', method: 'GET', weight: 0.15 },
      { path: '/api/trading-settings', method: 'GET', weight: 0.1 },
      { path: '/api/strategies', method: 'GET', weight: 0.1 },
      { path: '/api/mexc/trade', method: 'POST', weight: 0.05, payload: { symbol: 'BTCUSDT', type: 'market', quantity: 0.001 } }
    ]
  },

  heavyTrading: {
    name: 'Heavy Trading Load',
    userCount: 100,
    rampUpTime: 120000,
    sustainTime: 180000,
    rampDownTime: 60000,
    thinkTime: 500,
    endpoints: [
      { path: '/api/health', method: 'GET', weight: 0.02 },
      { path: '/api/account/balance', method: 'GET', weight: 0.2 },
      { path: '/api/mexc/ticker', method: 'GET', weight: 0.3 },
      { path: '/api/portfolio', method: 'GET', weight: 0.15 },
      { path: '/api/trading-settings', method: 'GET', weight: 0.08 },
      { path: '/api/strategies', method: 'GET', weight: 0.1 },
      { path: '/api/mexc/trade', method: 'POST', weight: 0.1, payload: { symbol: 'BTCUSDT', type: 'market', quantity: 0.001 } },
      { path: '/api/monitoring/real-time', method: 'GET', weight: 0.05 }
    ]
  },

  peakTrading: {
    name: 'Peak Trading Load',
    userCount: 200,
    rampUpTime: 180000,
    sustainTime: 300000,
    rampDownTime: 120000,
    thinkTime: 250,
    endpoints: [
      { path: '/api/health', method: 'GET', weight: 0.01 },
      { path: '/api/account/balance', method: 'GET', weight: 0.15 },
      { path: '/api/mexc/ticker', method: 'GET', weight: 0.25 },
      { path: '/api/portfolio', method: 'GET', weight: 0.15 },
      { path: '/api/trading-settings', method: 'GET', weight: 0.05 },
      { path: '/api/strategies', method: 'GET', weight: 0.08 },
      { path: '/api/mexc/trade', method: 'POST', weight: 0.15, payload: { symbol: 'BTCUSDT', type: 'market', quantity: 0.001 } },
      { path: '/api/monitoring/real-time', method: 'GET', weight: 0.08 },
      { path: '/api/pattern-detection', method: 'POST', weight: 0.05, payload: { symbol: 'BTCUSDT' } },
      { path: '/api/analytics/trading', method: 'GET', weight: 0.03 }
    ]
  }
}

// Test Suite Implementation
describe('Advanced Load Testing Performance Tests', () => {
  let testSuite: AdvancedLoadTestingSuite

  beforeAll(async () => {
    testSuite = new AdvancedLoadTestingSuite()
    await testSuite.setup()
  })

  afterAll(async () => {
    await testSuite.teardown()
  })

  it('should handle light trading load efficiently', async () => {
    const result = await testSuite.runLoadTestScenario(LOAD_TEST_SCENARIOS.lightTrading)
    
    expect(result.errorRate).toBeLessThan(2) // Less than 2% error rate
    expect(result.averageResponseTime).toBeLessThan(500) // Average response < 500ms
    expect(result.apdex).toBeGreaterThan(0.8) // APDEX > 0.8 (good)
    expect(result.requestsPerSecond).toBeGreaterThan(5) // At least 5 req/s
  })

  it('should sustain normal trading load', async () => {
    const result = await testSuite.runLoadTestScenario(LOAD_TEST_SCENARIOS.normalTrading)
    
    expect(result.errorRate).toBeLessThan(5) // Less than 5% error rate
    expect(result.averageResponseTime).toBeLessThan(1000) // Average response < 1 second
    expect(result.p95ResponseTime).toBeLessThan(2000) // P95 < 2 seconds
    expect(result.apdex).toBeGreaterThan(0.7) // APDEX > 0.7 (acceptable)
    expect(result.requestsPerSecond).toBeGreaterThan(20) // At least 20 req/s
  })

  it('should handle heavy trading load with acceptable degradation', async () => {
    const result = await testSuite.runLoadTestScenario(LOAD_TEST_SCENARIOS.heavyTrading)
    
    expect(result.errorRate).toBeLessThan(10) // Less than 10% error rate under heavy load
    expect(result.averageResponseTime).toBeLessThan(2000) // Average response < 2 seconds
    expect(result.p99ResponseTime).toBeLessThan(5000) // P99 < 5 seconds
    expect(result.requestsPerSecond).toBeGreaterThan(30) // At least 30 req/s
    expect(result.systemResources.cpuUtilization).toBeLessThan(90) // CPU < 90%
  })

  it('should survive peak trading conditions', async () => {
    const result = await testSuite.runLoadTestScenario(LOAD_TEST_SCENARIOS.peakTrading)
    
    expect(result.errorRate).toBeLessThan(15) // Less than 15% error rate at peak
    expect(result.averageResponseTime).toBeLessThan(3000) // Average response < 3 seconds
    expect(result.requestsPerSecond).toBeGreaterThan(40) // At least 40 req/s at peak
    expect(result.systemResources.memoryUtilization).toBeLessThan(90) // Memory < 90%
  })

  it('should determine system scalability limits', async () => {
    const scalabilityResult = await testSuite.runScalabilityTest(
      LOAD_TEST_SCENARIOS.lightTrading,
      100, // Max 100 users
      20   // Step by 20
    )
    
    expect(scalabilityResult.maxConcurrentUsers).toBeGreaterThan(40) // Should handle at least 40 users
    expect(scalabilityResult.breakingPoint).toBeGreaterThan(40) // Breaking point > 40 users
    expect(scalabilityResult.scalabilityFactor).toBeGreaterThan(0.5) // Reasonable scalability
    expect(scalabilityResult.resourceBottlenecks.length).toBeLessThan(5) // Limited bottlenecks
  })

  it('should handle burst load scenarios', async () => {
    const burstResult = await testSuite.runBurstLoadTest(
      LOAD_TEST_SCENARIOS.normalTrading,
      3, // 3x burst
      60000 // 1 minute burst
    )
    
    expect(burstResult.errorRate).toBeLessThan(25) // Less than 25% error rate during burst
    expect(burstResult.averageResponseTime).toBeLessThan(5000) // Average response < 5 seconds during burst
    expect(burstResult.requestsPerSecond).toBeGreaterThan(30) // Maintain reasonable throughput
  })

  it('should validate load testing SLAs', async () => {
    const results = testSuite.getResults()
    
    // Load testing SLAs
    const LOAD_TEST_SLA = {
      maxErrorRateNormal: 5, // 5% for normal load
      maxErrorRateHeavy: 15, // 15% for heavy load
      maxResponseTimeNormal: 1000, // 1 second for normal load
      maxResponseTimeHeavy: 3000, // 3 seconds for heavy load
      minApdex: 0.7, // Minimum APDEX score
      maxResourceUtilization: 90 // 90% max resource usage
    }

    const normalLoadResults = results.filter(r => r.totalUsers <= 50)
    const heavyLoadResults = results.filter(r => r.totalUsers > 50)

    // Validate normal load SLAs
    normalLoadResults.forEach(result => {
      expect(result.errorRate).toBeLessThan(LOAD_TEST_SLA.maxErrorRateNormal)
      expect(result.averageResponseTime).toBeLessThan(LOAD_TEST_SLA.maxResponseTimeNormal)
      expect(result.apdex).toBeGreaterThan(LOAD_TEST_SLA.minApdex)
    })

    // Validate heavy load SLAs (more lenient)
    heavyLoadResults.forEach(result => {
      expect(result.errorRate).toBeLessThan(LOAD_TEST_SLA.maxErrorRateHeavy)
      expect(result.averageResponseTime).toBeLessThan(LOAD_TEST_SLA.maxResponseTimeHeavy)
    })

    // Validate resource utilization across all tests
    results.forEach(result => {
      expect(result.systemResources.cpuUtilization).toBeLessThan(LOAD_TEST_SLA.maxResourceUtilization)
      expect(result.systemResources.memoryUtilization).toBeLessThan(LOAD_TEST_SLA.maxResourceUtilization)
    })
  })

  it('should generate comprehensive load testing report', () => {
    const report = testSuite.generateReport()
    
    expect(report).toContain('ADVANCED LOAD TESTING REPORT')
    expect(report).toContain('Total Scenarios:')
    expect(report).toContain('Success Rate:')
    expect(report).toContain('Response Times:')
    expect(report).toContain('Throughput:')
    expect(report).toContain('APDEX Score:')
    expect(report).toContain('System Resources:')
    
    console.log('\n' + report)
  })
})

// Export for use in other test files
export { 
  AdvancedLoadTestingSuite, 
  type LoadTestScenario, 
  type LoadTestMetrics, 
  type ScalabilityTestResult,
  type UserSession,
  type RequestMetrics,
  LOAD_TEST_SCENARIOS 
}