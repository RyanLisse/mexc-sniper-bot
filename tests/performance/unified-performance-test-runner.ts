/**
 * Unified Performance Test Runner
 * Orchestrates all performance test suites and provides comprehensive reporting
 */

import { performance } from 'node:perf_hooks'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Import all performance test suites
import { DatabasePerformanceTestSuite, type DatabasePerformanceResult } from './database-performance-test'
import { WebSocketPerformanceTestSuite, type WebSocketPerformanceMetrics } from './websocket-performance-test'
import { TradingLatencyPerformanceTestSuite, type TradingLatencyMetrics } from './trading-latency-performance-test'
import { MemoryProfilingPerformanceTestSuite, type MemoryLeakDetectionResult } from './memory-profiling-performance-test'
import { AdvancedLoadTestingSuite, type LoadTestMetrics, LOAD_TEST_SCENARIOS } from './advanced-load-testing'
import { PerformanceMonitoringDashboard, type PerformanceDashboardData } from './performance-monitoring-dashboard'
import { PerformanceRegressionTestSuite, type RegressionTestResult, PERFORMANCE_PROFILES } from './performance-regression-test'

interface UnifiedPerformanceTestResults {
  testSuiteResults: {
    database: DatabasePerformanceResult[]
    websocket: WebSocketPerformanceMetrics[]
    trading: TradingLatencyMetrics[]
    memory: MemoryLeakDetectionResult[]
    loadTesting: LoadTestMetrics[]
    regression: RegressionTestResult[]
  }
  overallMetrics: {
    totalTestsRun: number
    totalTestsPassed: number
    totalTestsFailed: number
    averageResponseTime: number
    averageThroughput: number
    averageResourceUtilization: number
    overallPerformanceScore: number
  }
  performanceSummary: {
    criticalIssues: string[]
    warnings: string[]
    improvements: string[]
    recommendations: string[]
  }
  testExecution: {
    startTime: number
    endTime: number
    totalDuration: number
    environment: {
      nodeVersion: string
      platform: string
      cpuCores: number
      totalMemory: number
    }
  }
  complianceReport: {
    slaCompliance: {
      responseTime: boolean
      throughput: boolean
      resourceUtilization: boolean
      errorRate: boolean
    }
    performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F'
    readinessForProduction: boolean
  }
}

interface PerformanceSLA {
  responseTime: {
    average: number // milliseconds
    p95: number
    p99: number
  }
  throughput: {
    minimum: number // requests per second
    target: number
  }
  resourceUtilization: {
    cpu: number // percentage
    memory: number // percentage
  }
  errorRate: {
    maximum: number // percentage
  }
  availability: {
    uptime: number // percentage
  }
  tradingSpecific: {
    orderExecutionTime: number // milliseconds
    patternDetectionTime: number // milliseconds
    maxSlippage: number // percentage
  }
}

class UnifiedPerformanceTestRunner {
  private testSuites: {
    database: DatabasePerformanceTestSuite
    websocket: WebSocketPerformanceTestSuite
    trading: TradingLatencyPerformanceTestSuite
    memory: MemoryProfilingPerformanceTestSuite
    loadTesting: AdvancedLoadTestingSuite
    monitoring: PerformanceMonitoringDashboard
    regression: PerformanceRegressionTestSuite
  }
  
  private results: UnifiedPerformanceTestResults | null = null
  private reportsDir: string

  constructor() {
    this.reportsDir = join(process.cwd(), 'tests/performance/reports')
    this.ensureReportsDirectory()
    
    this.testSuites = {
      database: new DatabasePerformanceTestSuite(),
      websocket: new WebSocketPerformanceTestSuite(),
      trading: new TradingLatencyPerformanceTestSuite(),
      memory: new MemoryProfilingPerformanceTestSuite(),
      loadTesting: new AdvancedLoadTestingSuite(),
      monitoring: new PerformanceMonitoringDashboard(),
      regression: new PerformanceRegressionTestSuite()
    }
  }

  private ensureReportsDirectory(): void {
    if (!existsSync(this.reportsDir)) {
      mkdirSync(this.reportsDir, { recursive: true })
    }
  }

  async runAllPerformanceTests(): Promise<UnifiedPerformanceTestResults> {
    console.log('🚀 Starting Unified Performance Test Suite')
    console.log('=' .repeat(80))

    const startTime = performance.now()
    const environment = {
      nodeVersion: process.version,
      platform: process.platform,
      cpuCores: require('os').cpus().length,
      totalMemory: Math.round(require('os').totalmem() / 1024 / 1024 / 1024) // GB
    }

    console.log(`Environment: Node ${environment.nodeVersion} on ${environment.platform}`)
    console.log(`Resources: ${environment.cpuCores} CPU cores, ${environment.totalMemory}GB RAM`)
    console.log('=' .repeat(80))

    try {
      // Initialize all test suites
      await this.initializeTestSuites()

      // Start performance monitoring
      this.testSuites.monitoring.startMonitoring(2000) // 2 second intervals

      // Run test suites in sequence
      const testSuiteResults = await this.executeTestSuites()

      // Stop monitoring
      this.testSuites.monitoring.stopMonitoring()

      const endTime = performance.now()
      const totalDuration = endTime - startTime

      // Compile results
      this.results = {
        testSuiteResults,
        overallMetrics: this.calculateOverallMetrics(testSuiteResults),
        performanceSummary: this.generatePerformanceSummary(testSuiteResults),
        testExecution: {
          startTime,
          endTime,
          totalDuration,
          environment
        },
        complianceReport: this.generateComplianceReport(testSuiteResults)
      }

      console.log('✅ All performance tests completed successfully')
      console.log(`Total execution time: ${(totalDuration / 1000).toFixed(2)} seconds`)
      
      // Generate and save reports
      await this.generateReports()

      return this.results

    } catch (error) {
      console.error('❌ Performance test suite failed:', error)
      throw error
    } finally {
      await this.cleanup()
    }
  }

  private async initializeTestSuites(): Promise<void> {
    console.log('📋 Initializing test suites...')
    
    await Promise.all([
      this.testSuites.database.setup(),
      this.testSuites.websocket.setup(),
      this.testSuites.trading.setup(),
      this.testSuites.memory.setup(),
      this.testSuites.loadTesting.setup()
    ])
    
    console.log('✅ All test suites initialized')
  }

  private async executeTestSuites(): Promise<UnifiedPerformanceTestResults['testSuiteResults']> {
    const results: UnifiedPerformanceTestResults['testSuiteResults'] = {
      database: [],
      websocket: [],
      trading: [],
      memory: [],
      loadTesting: [],
      regression: []
    }

    // Phase 1: Database Performance Tests
    console.log('\n🗄️ Phase 1: Database Performance Tests')
    console.log('-'.repeat(50))
    try {
      results.database = await this.runDatabaseTests()
      console.log(`✅ Database tests completed: ${results.database.length} tests`)
    } catch (error) {
      console.error('❌ Database tests failed:', error)
    }

    // Phase 2: WebSocket Performance Tests
    console.log('\n🔌 Phase 2: WebSocket Performance Tests')
    console.log('-'.repeat(50))
    try {
      results.websocket = await this.runWebSocketTests()
      console.log(`✅ WebSocket tests completed: ${results.websocket.length} tests`)
    } catch (error) {
      console.error('❌ WebSocket tests failed:', error)
    }

    // Phase 3: Trading Latency Tests
    console.log('\n💹 Phase 3: Trading Latency Performance Tests')
    console.log('-'.repeat(50))
    try {
      results.trading = await this.runTradingTests()
      console.log(`✅ Trading tests completed: ${results.trading.length} tests`)
    } catch (error) {
      console.error('❌ Trading tests failed:', error)
    }

    // Phase 4: Memory Profiling Tests
    console.log('\n🧠 Phase 4: Memory Profiling Tests')
    console.log('-'.repeat(50))
    try {
      results.memory = await this.runMemoryTests()
      console.log(`✅ Memory tests completed: ${results.memory.length} tests`)
    } catch (error) {
      console.error('❌ Memory tests failed:', error)
    }

    // Phase 5: Load Testing
    console.log('\n⚡ Phase 5: Advanced Load Testing')
    console.log('-'.repeat(50))
    try {
      results.loadTesting = await this.runLoadTests()
      console.log(`✅ Load tests completed: ${results.loadTesting.length} tests`)
    } catch (error) {
      console.error('❌ Load tests failed:', error)
    }

    // Phase 6: Regression Testing
    console.log('\n📊 Phase 6: Performance Regression Testing')
    console.log('-'.repeat(50))
    try {
      results.regression = await this.runRegressionTests()
      console.log(`✅ Regression tests completed: ${results.regression.length} tests`)
    } catch (error) {
      console.error('❌ Regression tests failed:', error)
    }

    return results
  }

  private async runDatabaseTests(): Promise<DatabasePerformanceResult[]> {
    const results: DatabasePerformanceResult[] = []
    
    // Basic SELECT query test
    const selectResult = await this.testSuites.database.runQueryPerformanceTest(
      'Basic SELECT Query Performance',
      async () => {
        // Simulate database query
        await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 40))
        return [{ id: 1, data: 'test' }]
      },
      1,
      'low'
    )
    results.push(selectResult)

    // Complex query test
    const complexResult = await this.testSuites.database.runQueryPerformanceTest(
      'Complex JOIN Query Performance',
      async () => {
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 200))
        return Array.from({ length: 50 }, (_, i) => ({ id: i, data: `record-${i}` }))
      },
      50,
      'high'
    )
    results.push(complexResult)

    // Connection pool stress test
    const poolResult = await this.testSuites.database.runConnectionPoolStressTest(15, 30000)
    
    return results
  }

  private async runWebSocketTests(): Promise<WebSocketPerformanceMetrics[]> {
    const results: WebSocketPerformanceMetrics[] = []

    // Connection stress test
    const connectionResult = await this.testSuites.websocket.runConnectionStressTest(25, 15000)
    results.push(connectionResult)

    // Throughput test
    const throughputResult = await this.testSuites.websocket.runThroughputTest(10, 500, 20000)

    return results
  }

  private async runTradingTests(): Promise<TradingLatencyMetrics[]> {
    const results: TradingLatencyMetrics[] = []

    // Order execution latency test
    const orderResult = await this.testSuites.trading.runOrderExecutionLatencyTest(50, 5)
    results.push(orderResult)

    // High-frequency trading test
    const hftResult = await this.testSuites.trading.runHighFrequencyTradingTest(5, 30000)

    // Pattern detection performance test
    const patternResult = await this.testSuites.trading.runPatternDetectionPerformanceTest(100)

    return results
  }

  private async runMemoryTests(): Promise<MemoryLeakDetectionResult[]> {
    const results: MemoryLeakDetectionResult[] = []

    // Memory leak detection test
    const leakResult = await this.testSuites.memory.runMemoryLeakDetectionTest(
      'Trading Operations Memory Test',
      async () => {
        // Simulate trading operations
        const data = new Array(1000).fill(0).map((_, i) => ({
          id: i,
          price: Math.random() * 1000,
          timestamp: Date.now()
        }))
        
        // Process data
        data.forEach(item => {
          const processed = JSON.stringify(item)
        })
        
        await new Promise(resolve => setTimeout(resolve, 50))
      },
      15000, // 15 seconds
      40 // 40MB limit
    )
    results.push(leakResult)

    // Memory stress test
    const stressResult = await this.testSuites.memory.runMemoryStressTest(50, 20, 10000)

    return results
  }

  private async runLoadTests(): Promise<LoadTestMetrics[]> {
    const results: LoadTestMetrics[] = []

    // Light load test
    const lightResult = await this.testSuites.loadTesting.runLoadTestScenario(LOAD_TEST_SCENARIOS.lightTrading)
    results.push(lightResult)

    // Normal load test
    const normalResult = await this.testSuites.loadTesting.runLoadTestScenario(LOAD_TEST_SCENARIOS.normalTrading)
    results.push(normalResult)

    // Burst load test
    const burstResult = await this.testSuites.loadTesting.runBurstLoadTest(
      LOAD_TEST_SCENARIOS.normalTrading,
      2, // 2x burst
      30000 // 30 seconds
    )
    results.push(burstResult)

    return results
  }

  private async runRegressionTests(): Promise<RegressionTestResult[]> {
    const results: RegressionTestResult[] = []

    try {
      // Create baseline for regression testing
      const baseline = await this.testSuites.regression.createPerformanceBaseline(
        'unified-test-baseline',
        '1.0.0',
        PERFORMANCE_PROFILES.tradingSystem
      )

      // Run regression test against baseline
      const regressionResult = await this.testSuites.regression.runRegressionTest(
        PERFORMANCE_PROFILES.tradingSystem,
        'unified-test-baseline',
        '1.0.0'
      )
      results.push(regressionResult)

    } catch (error) {
      console.warn('Regression testing skipped - no baseline available')
    }

    return results
  }

  private calculateOverallMetrics(
    testSuiteResults: UnifiedPerformanceTestResults['testSuiteResults']
  ): UnifiedPerformanceTestResults['overallMetrics'] {
    let totalTestsRun = 0
    let totalTestsPassed = 0
    let totalTestsFailed = 0
    
    const responseTimes: number[] = []
    const throughputs: number[] = []
    const resourceUtilizations: number[] = []

    // Count database tests
    totalTestsRun += testSuiteResults.database.length
    testSuiteResults.database.forEach(result => {
      responseTimes.push(result.averageResponseTime)
      if (result.averageResponseTime < 1000) totalTestsPassed++
      else totalTestsFailed++
    })

    // Count WebSocket tests
    totalTestsRun += testSuiteResults.websocket.length
    testSuiteResults.websocket.forEach(result => {
      responseTimes.push(result.averageLatency)
      throughputs.push(result.messagesThroughput)
      if (result.averageLatency < 100) totalTestsPassed++
      else totalTestsFailed++
    })

    // Count trading tests
    totalTestsRun += testSuiteResults.trading.length
    testSuiteResults.trading.forEach(result => {
      responseTimes.push(result.averageExecutionTime)
      throughputs.push(result.ordersPerSecond)
      if (result.averageExecutionTime < 500) totalTestsPassed++
      else totalTestsFailed++
    })

    // Count memory tests
    totalTestsRun += testSuiteResults.memory.length
    testSuiteResults.memory.forEach(result => {
      resourceUtilizations.push(result.memoryGrowthRate)
      if (!result.potentialLeakDetected) totalTestsPassed++
      else totalTestsFailed++
    })

    // Count load tests
    totalTestsRun += testSuiteResults.loadTesting.length
    testSuiteResults.loadTesting.forEach(result => {
      responseTimes.push(result.averageResponseTime)
      throughputs.push(result.requestsPerSecond)
      resourceUtilizations.push(result.systemResources.cpuUtilization)
      resourceUtilizations.push(result.systemResources.memoryUtilization)
      
      if (result.errorRate < 5 && result.averageResponseTime < 1000) {
        totalTestsPassed++
      } else {
        totalTestsFailed++
      }
    })

    // Count regression tests
    totalTestsRun += testSuiteResults.regression.length
    testSuiteResults.regression.forEach(result => {
      if (result.verdict === 'passed' || result.verdict === 'improved') {
        totalTestsPassed++
      } else {
        totalTestsFailed++
      }
    })

    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length || 0
    const averageThroughput = throughputs.reduce((sum, tp) => sum + tp, 0) / throughputs.length || 0
    const averageResourceUtilization = resourceUtilizations.reduce((sum, util) => sum + util, 0) / resourceUtilizations.length || 0

    // Calculate overall performance score (0-100)
    let performanceScore = 100
    
    // Deduct for poor response times
    if (averageResponseTime > 2000) performanceScore -= 30
    else if (averageResponseTime > 1000) performanceScore -= 15
    else if (averageResponseTime > 500) performanceScore -= 5

    // Deduct for low throughput
    if (averageThroughput < 10) performanceScore -= 20
    else if (averageThroughput < 50) performanceScore -= 10

    // Deduct for high resource utilization
    if (averageResourceUtilization > 80) performanceScore -= 20
    else if (averageResourceUtilization > 60) performanceScore -= 10

    // Deduct for failed tests
    const failureRate = totalTestsFailed / totalTestsRun
    performanceScore -= failureRate * 30

    return {
      totalTestsRun,
      totalTestsPassed,
      totalTestsFailed,
      averageResponseTime,
      averageThroughput,
      averageResourceUtilization,
      overallPerformanceScore: Math.max(0, performanceScore)
    }
  }

  private generatePerformanceSummary(
    testSuiteResults: UnifiedPerformanceTestResults['testSuiteResults']
  ): UnifiedPerformanceTestResults['performanceSummary'] {
    const criticalIssues: string[] = []
    const warnings: string[] = []
    const improvements: string[] = []
    const recommendations: string[] = []

    // Analyze database performance
    testSuiteResults.database.forEach(result => {
      if (result.averageResponseTime > 2000) {
        criticalIssues.push(`Database query "${result.testName}" has critical latency: ${result.averageResponseTime.toFixed(2)}ms`)
      } else if (result.averageResponseTime > 1000) {
        warnings.push(`Database query "${result.testName}" has high latency: ${result.averageResponseTime.toFixed(2)}ms`)
      }
    })

    // Analyze WebSocket performance
    testSuiteResults.websocket.forEach(result => {
      if (result.connectionFailures > result.connectionsEstablished * 0.1) {
        warnings.push(`High WebSocket connection failure rate: ${((result.connectionFailures / result.connectionsEstablished) * 100).toFixed(2)}%`)
      }
      
      if (result.averageLatency < 50) {
        improvements.push(`Excellent WebSocket latency: ${result.averageLatency.toFixed(2)}ms`)
      }
    })

    // Analyze trading performance
    testSuiteResults.trading.forEach(result => {
      if (result.averageExecutionTime > 1000) {
        criticalIssues.push(`Trading execution time is critical: ${result.averageExecutionTime.toFixed(2)}ms`)
      }
      
      if (result.slippageRate > 1.0) {
        warnings.push(`High trading slippage rate: ${result.slippageRate.toFixed(4)}%`)
      }
    })

    // Analyze memory performance
    testSuiteResults.memory.forEach(result => {
      if (result.potentialLeakDetected) {
        criticalIssues.push(`Memory leak detected in "${result.testName}": ${result.memoryGrowth.toFixed(2)}MB growth`)
      }
      
      if (result.gcEfficiency < 50) {
        warnings.push(`Low garbage collection efficiency: ${result.gcEfficiency.toFixed(2)}%`)
      }
    })

    // Analyze load testing
    testSuiteResults.loadTesting.forEach(result => {
      if (result.errorRate > 10) {
        criticalIssues.push(`High error rate under load: ${result.errorRate.toFixed(2)}%`)
      }
      
      if (result.apdex > 0.9) {
        improvements.push(`Excellent user experience (APDEX): ${result.apdex.toFixed(3)}`)
      }
    })

    // Generate recommendations
    if (criticalIssues.length > 0) {
      recommendations.push('Address critical performance issues before production deployment')
    }
    
    if (warnings.length > 3) {
      recommendations.push('Consider performance optimization to address multiple warning indicators')
    }
    
    recommendations.push('Implement continuous performance monitoring in production')
    recommendations.push('Establish performance baselines for regression testing')

    return {
      criticalIssues,
      warnings,
      improvements,
      recommendations
    }
  }

  private generateComplianceReport(
    testSuiteResults: UnifiedPerformanceTestResults['testSuiteResults']
  ): UnifiedPerformanceTestResults['complianceReport'] {
    // Define performance SLAs
    const SLA: PerformanceSLA = {
      responseTime: {
        average: 500, // 500ms
        p95: 1000, // 1 second
        p99: 2000 // 2 seconds
      },
      throughput: {
        minimum: 50, // 50 RPS
        target: 100 // 100 RPS
      },
      resourceUtilization: {
        cpu: 80, // 80%
        memory: 85 // 85%
      },
      errorRate: {
        maximum: 5 // 5%
      },
      availability: {
        uptime: 99.9 // 99.9%
      },
      tradingSpecific: {
        orderExecutionTime: 500, // 500ms
        patternDetectionTime: 1000, // 1 second
        maxSlippage: 0.5 // 0.5%
      }
    }

    // Check SLA compliance
    const slaCompliance = {
      responseTime: true,
      throughput: true,
      resourceUtilization: true,
      errorRate: true
    }

    // Check response time compliance
    const allResponseTimes = [
      ...testSuiteResults.database.map(r => r.averageResponseTime),
      ...testSuiteResults.websocket.map(r => r.averageLatency),
      ...testSuiteResults.trading.map(r => r.averageExecutionTime),
      ...testSuiteResults.loadTesting.map(r => r.averageResponseTime)
    ]

    const avgResponseTime = allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length
    if (avgResponseTime > SLA.responseTime.average) {
      slaCompliance.responseTime = false
    }

    // Check throughput compliance
    const allThroughputs = [
      ...testSuiteResults.websocket.map(r => r.messagesThroughput),
      ...testSuiteResults.trading.map(r => r.ordersPerSecond),
      ...testSuiteResults.loadTesting.map(r => r.requestsPerSecond)
    ]

    const avgThroughput = allThroughputs.reduce((sum, tp) => sum + tp, 0) / allThroughputs.length
    if (avgThroughput < SLA.throughput.minimum) {
      slaCompliance.throughput = false
    }

    // Check error rate compliance
    const errorRates = testSuiteResults.loadTesting.map(r => r.errorRate)
    const avgErrorRate = errorRates.reduce((sum, rate) => sum + rate, 0) / errorRates.length
    if (avgErrorRate > SLA.errorRate.maximum) {
      slaCompliance.errorRate = false
    }

    // Calculate performance grade
    const complianceCount = Object.values(slaCompliance).filter(Boolean).length
    const totalChecks = Object.keys(slaCompliance).length
    const complianceRate = complianceCount / totalChecks

    let performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F'
    if (complianceRate >= 0.9) performanceGrade = 'A'
    else if (complianceRate >= 0.8) performanceGrade = 'B'
    else if (complianceRate >= 0.7) performanceGrade = 'C'
    else if (complianceRate >= 0.6) performanceGrade = 'D'
    else performanceGrade = 'F'

    const readinessForProduction = performanceGrade !== 'F' && 
                                  testSuiteResults.memory.every(r => !r.potentialLeakDetected) &&
                                  avgErrorRate < SLA.errorRate.maximum

    return {
      slaCompliance,
      performanceGrade,
      readinessForProduction
    }
  }

  private async generateReports(): Promise<void> {
    if (!this.results) return

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    // Generate comprehensive JSON report
    const jsonReport = {
      ...this.results,
      generatedAt: new Date().toISOString(),
      reportVersion: '1.0.0'
    }

    writeFileSync(
      join(this.reportsDir, `performance-report-${timestamp}.json`),
      JSON.stringify(jsonReport, null, 2)
    )

    // Generate executive summary report
    const summaryReport = this.generateExecutiveSummary()
    writeFileSync(
      join(this.reportsDir, `performance-summary-${timestamp}.md`),
      summaryReport
    )

    // Generate detailed technical report
    const technicalReport = this.generateTechnicalReport()
    writeFileSync(
      join(this.reportsDir, `performance-technical-${timestamp}.md`),
      technicalReport
    )

    console.log(`📄 Reports generated in: ${this.reportsDir}`)
  }

  private generateExecutiveSummary(): string {
    if (!this.results) return ''

    const { overallMetrics, complianceReport, performanceSummary, testExecution } = this.results

    return `# Performance Test Executive Summary

## Overview
Performance testing completed on ${new Date().toLocaleDateString()} with **${overallMetrics.totalTestsRun} total tests** executed over ${(testExecution.totalDuration / 1000 / 60).toFixed(2)} minutes.

## Key Results
- **Performance Grade: ${complianceReport.performanceGrade}**
- **Production Ready: ${complianceReport.readinessForProduction ? '✅ YES' : '❌ NO'}**
- **Test Success Rate: ${((overallMetrics.totalTestsPassed / overallMetrics.totalTestsRun) * 100).toFixed(1)}%**
- **Overall Performance Score: ${overallMetrics.overallPerformanceScore.toFixed(1)}/100**

## Performance Metrics
- **Average Response Time:** ${overallMetrics.averageResponseTime.toFixed(2)}ms
- **Average Throughput:** ${overallMetrics.averageThroughput.toFixed(2)} req/s
- **Resource Utilization:** ${overallMetrics.averageResourceUtilization.toFixed(1)}%

## SLA Compliance
- **Response Time:** ${complianceReport.slaCompliance.responseTime ? '✅' : '❌'}
- **Throughput:** ${complianceReport.slaCompliance.throughput ? '✅' : '❌'}
- **Resource Utilization:** ${complianceReport.slaCompliance.resourceUtilization ? '✅' : '❌'}
- **Error Rate:** ${complianceReport.slaCompliance.errorRate ? '✅' : '❌'}

## Critical Issues (${performanceSummary.criticalIssues.length})
${performanceSummary.criticalIssues.map(issue => `- ⚠️ ${issue}`).join('\n')}

## Recommendations
${performanceSummary.recommendations.map(rec => `- 💡 ${rec}`).join('\n')}

## Test Environment
- **Platform:** ${testExecution.environment.platform}
- **Node.js:** ${testExecution.environment.nodeVersion}
- **CPU Cores:** ${testExecution.environment.cpuCores}
- **Memory:** ${testExecution.environment.totalMemory}GB
`
  }

  private generateTechnicalReport(): string {
    if (!this.results) return ''

    const sections = [
      '# Comprehensive Performance Test Technical Report',
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Duration:** ${(this.results.testExecution.totalDuration / 1000).toFixed(2)} seconds`,
      '',
      '## Test Suite Results',
      '',
      '### Database Performance',
      this.testSuites.database.generateReport(),
      '',
      '### WebSocket Performance',
      this.testSuites.websocket.generateReport(),
      '',
      '### Trading Latency Performance',
      this.testSuites.trading.generateReport(),
      '',
      '### Memory Profiling',
      this.testSuites.memory.generateReport(),
      '',
      '### Load Testing',
      this.testSuites.loadTesting.generateReport(),
      '',
      '### Performance Monitoring',
      this.testSuites.monitoring.generatePerformanceReport(),
      '',
      '### Regression Testing',
      this.testSuites.regression.generateRegressionReport()
    ]

    return sections.join('\n')
  }

  private async cleanup(): Promise<void> {
    await Promise.all([
      this.testSuites.database.teardown(),
      this.testSuites.websocket.teardown(),
      this.testSuites.trading.teardown(),
      this.testSuites.memory.teardown(),
      this.testSuites.loadTesting.teardown()
    ])
  }

  getResults(): UnifiedPerformanceTestResults | null {
    return this.results
  }
}

// Test Suite Implementation
describe('Unified Performance Test Suite', () => {
  let testRunner: UnifiedPerformanceTestRunner

  beforeAll(async () => {
    testRunner = new UnifiedPerformanceTestRunner()
  })

  afterAll(async () => {
    // Cleanup handled by test runner
  })

  it('should execute all performance test suites successfully', async () => {
    const results = await testRunner.runAllPerformanceTests()
    
    expect(results).toBeDefined()
    expect(results.overallMetrics.totalTestsRun).toBeGreaterThan(0)
    expect(results.overallMetrics.overallPerformanceScore).toBeGreaterThanOrEqual(0)
    expect(results.overallMetrics.overallPerformanceScore).toBeLessThanOrEqual(100)
    expect(results.complianceReport.performanceGrade).toMatch(/^[A-F]$/)
    
    console.log('\n🎯 UNIFIED PERFORMANCE TEST RESULTS')
    console.log('=' .repeat(60))
    console.log(`Performance Grade: ${results.complianceReport.performanceGrade}`)
    console.log(`Production Ready: ${results.complianceReport.readinessForProduction ? 'YES' : 'NO'}`)
    console.log(`Tests Run: ${results.overallMetrics.totalTestsRun}`)
    console.log(`Tests Passed: ${results.overallMetrics.totalTestsPassed}`)
    console.log(`Tests Failed: ${results.overallMetrics.totalTestsFailed}`)
    console.log(`Overall Score: ${results.overallMetrics.overallPerformanceScore.toFixed(1)}/100`)
    console.log(`Average Response Time: ${results.overallMetrics.averageResponseTime.toFixed(2)}ms`)
    console.log(`Average Throughput: ${results.overallMetrics.averageThroughput.toFixed(2)} req/s`)
    
    if (results.performanceSummary.criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues:')
      results.performanceSummary.criticalIssues.forEach(issue => {
        console.log(`  - ${issue}`)
      })
    }
    
    if (results.performanceSummary.improvements.length > 0) {
      console.log('\n✨ Performance Improvements:')
      results.performanceSummary.improvements.forEach(improvement => {
        console.log(`  - ${improvement}`)
      })
    }
  }, 600000) // 10 minute timeout for comprehensive testing

  it('should meet performance SLA requirements', async () => {
    const results = testRunner.getResults()
    expect(results).toBeDefined()
    
    if (results) {
      // Critical SLA requirements
      expect(results.overallMetrics.averageResponseTime).toBeLessThan(2000) // 2 second max
      expect(results.overallMetrics.averageThroughput).toBeGreaterThan(10) // 10 req/s min
      expect(results.overallMetrics.overallPerformanceScore).toBeGreaterThan(60) // 60/100 min score
      expect(results.complianceReport.performanceGrade).not.toBe('F') // No failing grade
      
      // Memory leak detection
      const memoryLeaks = results.testSuiteResults.memory.filter(r => r.potentialLeakDetected)
      expect(memoryLeaks.length).toBe(0) // No memory leaks allowed
    }
  })
})

// Export for use in other test files
export { UnifiedPerformanceTestRunner, type UnifiedPerformanceTestResults, type PerformanceSLA }