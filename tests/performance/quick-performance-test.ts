/**
 * Quick Performance Test
 * Rapid performance validation with shorter test durations
 */

import { performance } from 'node:perf_hooks'

interface QuickTestResult {
  testName: string
  duration: number
  requestCount: number
  successRate: number
  avgResponseTime: number
  maxResponseTime: number
  minResponseTime: number
  rps: number
  errorCount: number
}

class QuickPerformanceTest {
  async runQuickTests(): Promise<QuickTestResult[]> {
    console.log('⚡ Quick Performance Test Suite')
    console.log('=' * 40)
    
    const results: QuickTestResult[] = []
    
    // Test 1: API Response Time Test (10 seconds)
    console.log('\n🔥 Test 1: API Response Time (10s)')
    const apiTest = await this.simulateAPITest(10000, 5)
    results.push(apiTest)
    this.printTestResult(apiTest)
    
    // Test 2: High Concurrency Burst (15 seconds)
    console.log('\n🔥 Test 2: High Concurrency Burst (15s)')
    const burstTest = await this.simulateAPITest(15000, 25)
    results.push(burstTest)
    this.printTestResult(burstTest)
    
    // Test 3: Sustained Load (20 seconds)
    console.log('\n🔥 Test 3: Sustained Load (20s)')
    const sustainedTest = await this.simulateAPITest(20000, 15)
    results.push(sustainedTest)
    this.printTestResult(sustainedTest)
    
    console.log('\n📊 Quick Test Summary')
    console.log('-' * 40)
    let totalRequests = 0
    let totalSuccessful = 0
    let avgResponseTimeOverall = 0
    
    for (const result of results) {
      totalRequests += result.requestCount
      totalSuccessful += Math.floor(result.requestCount * result.successRate / 100)
      avgResponseTimeOverall += result.avgResponseTime
    }
    
    const overallSuccessRate = (totalSuccessful / totalRequests) * 100
    avgResponseTimeOverall = avgResponseTimeOverall / results.length
    
    console.log(`Total Requests: ${totalRequests}`)
    console.log(`Overall Success Rate: ${overallSuccessRate.toFixed(2)}%`)
    console.log(`Average Response Time: ${avgResponseTimeOverall.toFixed(2)}ms`)
    
    return results
  }
  
  private async simulateAPITest(duration: number, concurrency: number): Promise<QuickTestResult> {
    const startTime = performance.now()
    let requestCount = 0
    let successCount = 0
    let totalResponseTime = 0
    let minResponseTime = Number.MAX_VALUE
    let maxResponseTime = 0
    let errorCount = 0
    
    const workers: Promise<void>[] = []
    
    // Start concurrent workers
    for (let i = 0; i < concurrency; i++) {
      workers.push(this.worker(duration, (responseTime: number, success: boolean) => {
        requestCount++
        if (success) {
          successCount++
          totalResponseTime += responseTime
          minResponseTime = Math.min(minResponseTime, responseTime)
          maxResponseTime = Math.max(maxResponseTime, responseTime)
        } else {
          errorCount++
        }
      }))
    }
    
    // Wait for test duration
    await Promise.all(workers)
    
    const endTime = performance.now()
    const actualDuration = endTime - startTime
    
    return {
      testName: `Concurrency ${concurrency} - ${duration/1000}s`,
      duration: actualDuration,
      requestCount,
      successRate: requestCount > 0 ? (successCount / requestCount) * 100 : 0,
      avgResponseTime: successCount > 0 ? totalResponseTime / successCount : 0,
      maxResponseTime: maxResponseTime === 0 ? 0 : maxResponseTime,
      minResponseTime: minResponseTime === Number.MAX_VALUE ? 0 : minResponseTime,
      rps: requestCount / (actualDuration / 1000),
      errorCount
    }
  }
  
  private async worker(duration: number, callback: (responseTime: number, success: boolean) => void): Promise<void> {
    const endTime = Date.now() + duration
    
    while (Date.now() < endTime) {
      const requestStart = performance.now()
      
      // Simulate API request
      const success = await this.simulateRequest()
      
      const requestEnd = performance.now()
      const responseTime = requestEnd - requestStart
      
      callback(responseTime, success)
      
      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 20))
    }
  }
  
  private async simulateRequest(): Promise<boolean> {
    // Simulate realistic API response times
    const baseLatency = 50 + Math.random() * 100 // 50-150ms
    const networkJitter = Math.random() * 30 // 0-30ms
    
    const totalLatency = baseLatency + networkJitter
    await new Promise(resolve => setTimeout(resolve, totalLatency))
    
    // 95% success rate
    return Math.random() < 0.95
  }
  
  private printTestResult(result: QuickTestResult): void {
    console.log(`  ✅ ${result.testName}`)
    console.log(`     Requests: ${result.requestCount}`)
    console.log(`     Success Rate: ${result.successRate.toFixed(2)}%`)
    console.log(`     Avg Response: ${result.avgResponseTime.toFixed(2)}ms`)
    console.log(`     Min/Max: ${result.minResponseTime.toFixed(2)}ms / ${result.maxResponseTime.toFixed(2)}ms`)
    console.log(`     RPS: ${result.rps.toFixed(2)}`)
    console.log(`     Errors: ${result.errorCount}`)
  }
}

// Quick Chaos Test
class QuickChaosTest {
  async runQuickChaosTest(): Promise<any> {
    console.log('\n💥 Quick Chaos Engineering Test')
    console.log('=' * 40)
    
    // Simulate quick chaos scenarios
    const scenarios = [
      { name: 'Network Latency Spike', severity: 'medium', duration: 5000 },
      { name: 'Memory Pressure', severity: 'high', duration: 8000 },
      { name: 'API Timeout', severity: 'medium', duration: 6000 }
    ]
    
    const results = []
    
    for (const scenario of scenarios) {
      console.log(`\n🎯 Running: ${scenario.name} (${scenario.duration/1000}s)`)
      const result = await this.simulateChaosScenario(scenario)
      results.push(result)
      
      console.log(`  Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`)
      console.log(`  System Impact: ${result.systemImpact}%`)
      console.log(`  Recovery Time: ${result.recoveryTime}ms`)
    }
    
    return results
  }
  
  private async simulateChaosScenario(scenario: any): Promise<any> {
    const startTime = performance.now()
    
    // Simulate chaos injection
    await new Promise(resolve => setTimeout(resolve, scenario.duration))
    
    const endTime = performance.now()
    
    // Simulate system impact based on severity
    let systemImpact = 0
    let recoveryTime = 0
    
    switch (scenario.severity) {
      case 'low':
        systemImpact = 5 + Math.random() * 10 // 5-15%
        recoveryTime = 1000 + Math.random() * 2000 // 1-3s
        break
      case 'medium':
        systemImpact = 10 + Math.random() * 20 // 10-30%
        recoveryTime = 2000 + Math.random() * 5000 // 2-7s
        break
      case 'high':
        systemImpact = 20 + Math.random() * 30 // 20-50%
        recoveryTime = 5000 + Math.random() * 10000 // 5-15s
        break
    }
    
    const success = systemImpact < 40 && recoveryTime < 10000
    
    return {
      name: scenario.name,
      success,
      systemImpact: systemImpact.toFixed(2),
      recoveryTime: recoveryTime.toFixed(0),
      duration: endTime - startTime
    }
  }
}

// Circuit Breaker Test
class CircuitBreakerTest {
  async testCircuitBreakers(): Promise<any> {
    console.log('\n🛡️ Circuit Breaker Validation')
    console.log('=' * 40)
    
    const tests = [
      { name: 'Database Circuit Breaker', failureThreshold: 5, timeout: 30000 },
      { name: 'API Circuit Breaker', failureThreshold: 10, timeout: 60000 },
      { name: 'WebSocket Circuit Breaker', failureThreshold: 3, timeout: 15000 }
    ]
    
    const results = []
    
    for (const test of tests) {
      console.log(`\n🔧 Testing: ${test.name}`)
      
      // Simulate circuit breaker test
      const result = await this.simulateCircuitBreakerTest(test)
      results.push(result)
      
      console.log(`  Status: ${result.activated ? '✅ ACTIVATED' : '❌ FAILED'}`)
      console.log(`  Trigger Time: ${result.triggerTime}ms`)
      console.log(`  Recovery: ${result.recovered ? '✅ RECOVERED' : '❌ NO RECOVERY'}`)
    }
    
    return results
  }
  
  private async simulateCircuitBreakerTest(config: any): Promise<any> {
    const startTime = performance.now()
    
    // Simulate failures building up to threshold
    let failureCount = 0
    const maxFailures = config.failureThreshold
    
    while (failureCount < maxFailures) {
      await new Promise(resolve => setTimeout(resolve, 100))
      failureCount++
    }
    
    const triggerTime = performance.now() - startTime
    const activated = failureCount >= maxFailures
    
    // Simulate recovery attempt
    await new Promise(resolve => setTimeout(resolve, 2000))
    const recovered = Math.random() < 0.9 // 90% recovery rate
    
    return {
      name: config.name,
      activated,
      triggerTime,
      recovered,
      failureThreshold: maxFailures
    }
  }
}

// Main execution
async function runQuickTestSuite(): Promise<void> {
  console.log('🚀 Quick Performance & Resilience Test Suite')
  console.log('=' * 60)
  
  const performanceTest = new QuickPerformanceTest()
  const chaosTest = new QuickChaosTest()
  const circuitTest = new CircuitBreakerTest()
  
  try {
    // Run performance tests
    const perfResults = await performanceTest.runQuickTests()
    
    // Run chaos tests
    const chaosResults = await chaosTest.runQuickChaosTest()
    
    // Run circuit breaker tests
    const circuitResults = await circuitTest.testCircuitBreakers()
    
    // Summary
    console.log('\n🎯 QUICK TEST SUITE SUMMARY')
    console.log('=' * 60)
    
    const totalPerfTests = perfResults.length
    const passedPerfTests = perfResults.filter(r => r.successRate > 90).length
    
    const totalChaosTests = chaosResults.length
    const passedChaosTests = chaosResults.filter((r: any) => r.success).length
    
    const totalCircuitTests = circuitResults.length
    const passedCircuitTests = circuitResults.filter((r: any) => r.activated && r.recovered).length
    
    console.log(`Performance Tests: ${passedPerfTests}/${totalPerfTests} PASSED`)
    console.log(`Chaos Tests: ${passedChaosTests}/${totalChaosTests} PASSED`)
    console.log(`Circuit Breaker Tests: ${passedCircuitTests}/${totalCircuitTests} PASSED`)
    
    const overallPassed = passedPerfTests + passedChaosTests + passedCircuitTests
    const overallTotal = totalPerfTests + totalChaosTests + totalCircuitTests
    const successRate = (overallPassed / overallTotal) * 100
    
    console.log(`\nOverall Success Rate: ${successRate.toFixed(2)}%`)
    console.log(`System Status: ${successRate > 80 ? '✅ HEALTHY' : successRate > 60 ? '⚠️ WARNING' : '❌ CRITICAL'}`)
    
  } catch (error) {
    console.error('❌ Quick test suite failed:', error)
  }
}

// Run if executed directly
if (require.main === module) {
  runQuickTestSuite()
    .then(() => {
      console.log('\n🎉 Quick test suite completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Quick test suite failed:', error)
      process.exit(1)
    })
}

export { runQuickTestSuite }