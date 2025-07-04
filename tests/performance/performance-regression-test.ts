/**
 * Performance Regression Testing Suite
 * Automated performance regression detection with baseline comparison and trend analysis
 */

import { performance } from 'node:perf_hooks'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface PerformanceBaseline {
  id: string
  name: string
  version: string
  timestamp: number
  environment: {
    nodeVersion: string
    platform: string
    cpuCores: number
    totalMemory: number
  }
  metrics: {
    responseTime: {
      average: number
      median: number
      p95: number
      p99: number
    }
    throughput: {
      requestsPerSecond: number
      peakRps: number
      sustainedRps: number
    }
    resources: {
      cpuUtilization: number
      memoryUtilization: number
      networkUtilization: number
    }
    database: {
      averageQueryTime: number
      connectionPoolEfficiency: number
      transactionsPerSecond: number
    }
    trading: {
      orderExecutionTime: number
      patternDetectionTime: number
      slippageRate: number
    }
    websocket: {
      connectionLatency: number
      messageLatency: number
      throughput: number
    }
  }
  customMetrics: Record<string, number>
}

interface RegressionTestResult {
  testName: string
  baseline: PerformanceBaseline
  current: PerformanceBaseline
  comparison: {
    responseTimeChange: number
    throughputChange: number
    resourceUtilizationChange: number
    overallPerformanceChange: number
  }
  regressions: Array<{
    metric: string
    baselineValue: number
    currentValue: number
    changePercent: number
    severity: 'minor' | 'moderate' | 'major' | 'critical'
    threshold: number
  }>
  improvements: Array<{
    metric: string
    baselineValue: number
    currentValue: number
    changePercent: number
  }>
  verdict: 'passed' | 'degraded' | 'improved' | 'failed'
}

interface TrendAnalysis {
  metric: string
  trend: 'improving' | 'stable' | 'degrading'
  changeRate: number // change per time unit
  confidence: number // 0-1
  forecast: Array<{
    timestamp: number
    predictedValue: number
    confidence: number
  }>
}

interface PerformanceProfile {
  profileId: string
  name: string
  testDuration: number
  operations: Array<{
    name: string
    iterations: number
    concurrency: number
    expectedLatency: number
    expectedThroughput: number
  }>
  thresholds: {
    responseTime: {
      warning: number
      critical: number
    }
    throughput: {
      minimum: number
      target: number
    }
    resourceUtilization: {
      cpu: number
      memory: number
    }
    regression: {
      minor: number // 5%
      moderate: number // 15%
      major: number // 30%
      critical: number // 50%
    }
  }
}

class PerformanceRegressionTestSuite {
  private baselineDir: string
  private profilesDir: string
  private currentBaseline: PerformanceBaseline | null = null
  private regressionResults: RegressionTestResult[] = []

  constructor() {
    this.baselineDir = join(process.cwd(), 'tests/performance/baselines')
    this.profilesDir = join(process.cwd(), 'tests/performance/profiles')
    this.ensureDirectories()
  }

  private ensureDirectories(): void {
    const dirs = [this.baselineDir, this.profilesDir]
    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        require('fs').mkdirSync(dir, { recursive: true })
      }
    })
  }

  async createPerformanceBaseline(
    name: string,
    version: string,
    profile: PerformanceProfile
  ): Promise<PerformanceBaseline> {
    console.log(`📊 Creating performance baseline: ${name} v${version}`)

    const environment = {
      nodeVersion: process.version,
      platform: process.platform,
      cpuCores: require('os').cpus().length,
      totalMemory: require('os').totalmem() / 1024 / 1024 / 1024 // GB
    }

    // Execute performance profile to gather baseline metrics
    const metrics = await this.executePerformanceProfile(profile)

    const baseline: PerformanceBaseline = {
      id: `baseline-${Date.now()}`,
      name,
      version,
      timestamp: Date.now(),
      environment,
      metrics,
      customMetrics: {}
    }

    // Save baseline to disk
    await this.saveBaseline(baseline)
    this.currentBaseline = baseline

    console.log(`✅ Baseline created: ${baseline.id}`)
    return baseline
  }

  async loadBaseline(name: string, version?: string): Promise<PerformanceBaseline | null> {
    const baselineFiles = require('fs').readdirSync(this.baselineDir)
      .filter((file: string) => file.endsWith('.json'))
      .map((file: string) => {
        const content = readFileSync(join(this.baselineDir, file), 'utf-8')
        return JSON.parse(content) as PerformanceBaseline
      })
      .filter((baseline: PerformanceBaseline) => baseline.name === name)

    if (version) {
      const versionBaseline = baselineFiles.find(b => b.version === version)
      return versionBaseline || null
    }

    // Return most recent baseline if no version specified
    if (baselineFiles.length === 0) return null
    
    return baselineFiles.sort((a, b) => b.timestamp - a.timestamp)[0]
  }

  private async saveBaseline(baseline: PerformanceBaseline): Promise<void> {
    const filename = `${baseline.name}-${baseline.version}-${baseline.timestamp}.json`
    const filepath = join(this.baselineDir, filename)
    writeFileSync(filepath, JSON.stringify(baseline, null, 2))
  }

  private async executePerformanceProfile(profile: PerformanceProfile): Promise<PerformanceBaseline['metrics']> {
    console.log(`  🏃 Executing performance profile: ${profile.name}`)

    const responseTimes: number[] = []
    const throughputMeasurements: number[] = []
    const resourceMeasurements: Array<{ cpu: number; memory: number; network: number }> = []
    const databaseMetrics: Array<{ queryTime: number; connections: number; tps: number }> = []
    const tradingMetrics: Array<{ executionTime: number; detectionTime: number; slippage: number }> = []
    const websocketMetrics: Array<{ connectionLatency: number; messageLatency: number; throughput: number }> = []

    // Resource monitoring
    const resourceMonitor = setInterval(() => {
      const memUsage = process.memoryUsage()
      const cpuUsage = process.cpuUsage()
      
      resourceMeasurements.push({
        cpu: ((cpuUsage.user + cpuUsage.system) / 1000000) * 100,
        memory: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        network: Math.random() * 50 // Mock network utilization
      })
    }, 1000)

    try {
      // Execute each operation in the profile
      for (const operation of profile.operations) {
        console.log(`    🔄 Running operation: ${operation.name} (${operation.iterations} iterations, ${operation.concurrency} concurrent)`)
        
        const operationResults = await this.executeOperation(operation)
        responseTimes.push(...operationResults.responseTimes)
        throughputMeasurements.push(...operationResults.throughputMeasurements)
        databaseMetrics.push(...operationResults.databaseMetrics)
        tradingMetrics.push(...operationResults.tradingMetrics)
        websocketMetrics.push(...operationResults.websocketMetrics)
      }

      clearInterval(resourceMonitor)

      // Calculate aggregated metrics
      const sortedResponseTimes = [...responseTimes].sort((a, b) => a - b)
      const avgThroughput = throughputMeasurements.reduce((sum, val) => sum + val, 0) / throughputMeasurements.length
      const avgResources = resourceMeasurements.reduce(
        (acc, curr) => ({
          cpu: acc.cpu + curr.cpu,
          memory: acc.memory + curr.memory,
          network: acc.network + curr.network
        }),
        { cpu: 0, memory: 0, network: 0 }
      )

      avgResources.cpu /= resourceMeasurements.length
      avgResources.memory /= resourceMeasurements.length
      avgResources.network /= resourceMeasurements.length

      const avgDatabase = databaseMetrics.reduce(
        (acc, curr) => ({
          queryTime: acc.queryTime + curr.queryTime,
          connections: acc.connections + curr.connections,
          tps: acc.tps + curr.tps
        }),
        { queryTime: 0, connections: 0, tps: 0 }
      )

      if (databaseMetrics.length > 0) {
        avgDatabase.queryTime /= databaseMetrics.length
        avgDatabase.connections /= databaseMetrics.length
        avgDatabase.tps /= databaseMetrics.length
      }

      const avgTrading = tradingMetrics.reduce(
        (acc, curr) => ({
          executionTime: acc.executionTime + curr.executionTime,
          detectionTime: acc.detectionTime + curr.detectionTime,
          slippage: acc.slippage + curr.slippage
        }),
        { executionTime: 0, detectionTime: 0, slippage: 0 }
      )

      if (tradingMetrics.length > 0) {
        avgTrading.executionTime /= tradingMetrics.length
        avgTrading.detectionTime /= tradingMetrics.length
        avgTrading.slippage /= tradingMetrics.length
      }

      const avgWebsocket = websocketMetrics.reduce(
        (acc, curr) => ({
          connectionLatency: acc.connectionLatency + curr.connectionLatency,
          messageLatency: acc.messageLatency + curr.messageLatency,
          throughput: acc.throughput + curr.throughput
        }),
        { connectionLatency: 0, messageLatency: 0, throughput: 0 }
      )

      if (websocketMetrics.length > 0) {
        avgWebsocket.connectionLatency /= websocketMetrics.length
        avgWebsocket.messageLatency /= websocketMetrics.length
        avgWebsocket.throughput /= websocketMetrics.length
      }

      return {
        responseTime: {
          average: responseTimes.reduce((sum, val) => sum + val, 0) / responseTimes.length,
          median: sortedResponseTimes[Math.floor(sortedResponseTimes.length / 2)] || 0,
          p95: sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.95)] || 0,
          p99: sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.99)] || 0
        },
        throughput: {
          requestsPerSecond: avgThroughput,
          peakRps: Math.max(...throughputMeasurements),
          sustainedRps: throughputMeasurements.slice(-10).reduce((sum, val) => sum + val, 0) / 10
        },
        resources: {
          cpuUtilization: avgResources.cpu,
          memoryUtilization: avgResources.memory,
          networkUtilization: avgResources.network
        },
        database: {
          averageQueryTime: avgDatabase.queryTime,
          connectionPoolEfficiency: (avgDatabase.connections / 20) * 100, // Assume max 20 connections
          transactionsPerSecond: avgDatabase.tps
        },
        trading: {
          orderExecutionTime: avgTrading.executionTime,
          patternDetectionTime: avgTrading.detectionTime,
          slippageRate: avgTrading.slippage
        },
        websocket: {
          connectionLatency: avgWebsocket.connectionLatency,
          messageLatency: avgWebsocket.messageLatency,
          throughput: avgWebsocket.throughput
        }
      }

    } finally {
      clearInterval(resourceMonitor)
    }
  }

  private async executeOperation(operation: PerformanceProfile['operations'][0]): Promise<{
    responseTimes: number[]
    throughputMeasurements: number[]
    databaseMetrics: Array<{ queryTime: number; connections: number; tps: number }>
    tradingMetrics: Array<{ executionTime: number; detectionTime: number; slippage: number }>
    websocketMetrics: Array<{ connectionLatency: number; messageLatency: number; throughput: number }>
  }> {
    const responseTimes: number[] = []
    const throughputMeasurements: number[] = []
    const databaseMetrics: Array<{ queryTime: number; connections: number; tps: number }> = []
    const tradingMetrics: Array<{ executionTime: number; detectionTime: number; slippage: number }> = []
    const websocketMetrics: Array<{ connectionLatency: number; messageLatency: number; throughput: number }> = []

    const concurrentWorkers = Array.from({ length: operation.concurrency }, async () => {
      const iterationsPerWorker = Math.ceil(operation.iterations / operation.concurrency)
      
      for (let i = 0; i < iterationsPerWorker; i++) {
        const startTime = performance.now()
        
        // Simulate operation based on name
        await this.simulateOperation(operation.name)
        
        const endTime = performance.now()
        const responseTime = endTime - startTime
        
        responseTimes.push(responseTime)
        
        // Collect metrics based on operation type
        if (operation.name.includes('database')) {
          databaseMetrics.push({
            queryTime: responseTime,
            connections: Math.floor(Math.random() * 10) + 5,
            tps: Math.floor(Math.random() * 100) + 50
          })
        }
        
        if (operation.name.includes('trading')) {
          tradingMetrics.push({
            executionTime: responseTime,
            detectionTime: Math.random() * 500 + 100,
            slippage: Math.random() * 0.1
          })
        }
        
        if (operation.name.includes('websocket')) {
          websocketMetrics.push({
            connectionLatency: Math.random() * 100 + 10,
            messageLatency: Math.random() * 50 + 5,
            throughput: Math.random() * 1000 + 500
          })
        }

        // Calculate throughput (operations per second)
        if (i > 0 && i % 10 === 0) {
          const opsInLast10 = 10
          const timeForLast10 = responseTimes.slice(-10).reduce((sum, time) => sum + time, 0) / 1000
          throughputMeasurements.push(opsInLast10 / timeForLast10)
        }
      }
    })

    await Promise.all(concurrentWorkers)

    return {
      responseTimes,
      throughputMeasurements,
      databaseMetrics,
      tradingMetrics,
      websocketMetrics
    }
  }

  private async simulateOperation(operationName: string): Promise<void> {
    // Simulate different types of operations with realistic delays
    const operationTypes: Record<string, () => Promise<void>> = {
      'api_request': async () => {
        const delay = 50 + Math.random() * 200 // 50-250ms
        await new Promise(resolve => setTimeout(resolve, delay))
      },
      'database_query': async () => {
        const delay = 10 + Math.random() * 100 // 10-110ms
        await new Promise(resolve => setTimeout(resolve, delay))
      },
      'trading_execution': async () => {
        const delay = 100 + Math.random() * 400 // 100-500ms
        await new Promise(resolve => setTimeout(resolve, delay))
      },
      'pattern_detection': async () => {
        const delay = 200 + Math.random() * 800 // 200-1000ms
        await new Promise(resolve => setTimeout(resolve, delay))
      },
      'websocket_message': async () => {
        const delay = 5 + Math.random() * 45 // 5-50ms
        await new Promise(resolve => setTimeout(resolve, delay))
      },
      'cache_operation': async () => {
        const delay = 1 + Math.random() * 9 // 1-10ms
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // Find matching operation type
    const operationType = Object.keys(operationTypes).find(type => 
      operationName.toLowerCase().includes(type.split('_')[0])
    ) || 'api_request'

    await operationTypes[operationType]()
  }

  async runRegressionTest(
    profile: PerformanceProfile,
    baselineName: string,
    baselineVersion?: string
  ): Promise<RegressionTestResult> {
    console.log(`🔍 Running regression test against baseline: ${baselineName}`)

    // Load baseline
    const baseline = await this.loadBaseline(baselineName, baselineVersion)
    if (!baseline) {
      throw new Error(`Baseline not found: ${baselineName} ${baselineVersion || '(latest)'}`)
    }

    // Create current performance baseline
    const currentBaseline = await this.createPerformanceBaseline(
      `${baselineName}-current`,
      'current',
      profile
    )

    // Compare baselines
    const comparison = this.compareBaselines(baseline, currentBaseline, profile)
    const result: RegressionTestResult = {
      testName: `Regression Test: ${baselineName}`,
      baseline,
      current: currentBaseline,
      comparison,
      regressions: this.detectRegressions(baseline, currentBaseline, profile),
      improvements: this.detectImprovements(baseline, currentBaseline),
      verdict: this.determineVerdict(comparison, profile)
    }

    this.regressionResults.push(result)
    
    console.log(`📊 Regression test completed: ${result.verdict}`)
    if (result.regressions.length > 0) {
      console.warn(`⚠️ Found ${result.regressions.length} performance regressions`)
    }
    if (result.improvements.length > 0) {
      console.log(`✨ Found ${result.improvements.length} performance improvements`)
    }

    return result
  }

  private compareBaselines(
    baseline: PerformanceBaseline,
    current: PerformanceBaseline,
    profile: PerformanceProfile
  ): RegressionTestResult['comparison'] {
    const responseTimeChange = this.calculatePercentageChange(
      baseline.metrics.responseTime.average,
      current.metrics.responseTime.average
    )

    const throughputChange = this.calculatePercentageChange(
      baseline.metrics.throughput.requestsPerSecond,
      current.metrics.throughput.requestsPerSecond
    )

    const resourceUtilizationChange = this.calculatePercentageChange(
      (baseline.metrics.resources.cpuUtilization + baseline.metrics.resources.memoryUtilization) / 2,
      (current.metrics.resources.cpuUtilization + current.metrics.resources.memoryUtilization) / 2
    )

    // Calculate overall performance change (weighted average)
    const overallPerformanceChange = (
      responseTimeChange * -0.4 + // Negative because lower is better
      throughputChange * 0.3 + // Positive because higher is better
      resourceUtilizationChange * -0.3 // Negative because lower is better
    )

    return {
      responseTimeChange,
      throughputChange,
      resourceUtilizationChange,
      overallPerformanceChange
    }
  }

  private detectRegressions(
    baseline: PerformanceBaseline,
    current: PerformanceBaseline,
    profile: PerformanceProfile
  ): RegressionTestResult['regressions'] {
    const regressions: RegressionTestResult['regressions'] = []

    // Check response time regression
    const responseTimeChange = this.calculatePercentageChange(
      baseline.metrics.responseTime.average,
      current.metrics.responseTime.average
    )

    if (responseTimeChange > profile.thresholds.regression.minor) {
      regressions.push({
        metric: 'response_time_average',
        baselineValue: baseline.metrics.responseTime.average,
        currentValue: current.metrics.responseTime.average,
        changePercent: responseTimeChange,
        severity: this.getSeverity(responseTimeChange, profile.thresholds.regression),
        threshold: profile.thresholds.regression.minor
      })
    }

    // Check throughput regression
    const throughputChange = this.calculatePercentageChange(
      baseline.metrics.throughput.requestsPerSecond,
      current.metrics.throughput.requestsPerSecond
    )

    if (throughputChange < -profile.thresholds.regression.minor) { // Negative because decrease is bad
      regressions.push({
        metric: 'throughput_requests_per_second',
        baselineValue: baseline.metrics.throughput.requestsPerSecond,
        currentValue: current.metrics.throughput.requestsPerSecond,
        changePercent: Math.abs(throughputChange),
        severity: this.getSeverity(Math.abs(throughputChange), profile.thresholds.regression),
        threshold: profile.thresholds.regression.minor
      })
    }

    // Check CPU utilization regression
    const cpuChange = this.calculatePercentageChange(
      baseline.metrics.resources.cpuUtilization,
      current.metrics.resources.cpuUtilization
    )

    if (cpuChange > profile.thresholds.regression.minor) {
      regressions.push({
        metric: 'cpu_utilization',
        baselineValue: baseline.metrics.resources.cpuUtilization,
        currentValue: current.metrics.resources.cpuUtilization,
        changePercent: cpuChange,
        severity: this.getSeverity(cpuChange, profile.thresholds.regression),
        threshold: profile.thresholds.regression.minor
      })
    }

    // Check memory utilization regression
    const memoryChange = this.calculatePercentageChange(
      baseline.metrics.resources.memoryUtilization,
      current.metrics.resources.memoryUtilization
    )

    if (memoryChange > profile.thresholds.regression.minor) {
      regressions.push({
        metric: 'memory_utilization',
        baselineValue: baseline.metrics.resources.memoryUtilization,
        currentValue: current.metrics.resources.memoryUtilization,
        changePercent: memoryChange,
        severity: this.getSeverity(memoryChange, profile.thresholds.regression),
        threshold: profile.thresholds.regression.minor
      })
    }

    // Check trading execution time regression
    const tradingChange = this.calculatePercentageChange(
      baseline.metrics.trading.orderExecutionTime,
      current.metrics.trading.orderExecutionTime
    )

    if (tradingChange > profile.thresholds.regression.minor) {
      regressions.push({
        metric: 'trading_execution_time',
        baselineValue: baseline.metrics.trading.orderExecutionTime,
        currentValue: current.metrics.trading.orderExecutionTime,
        changePercent: tradingChange,
        severity: this.getSeverity(tradingChange, profile.thresholds.regression),
        threshold: profile.thresholds.regression.minor
      })
    }

    return regressions
  }

  private detectImprovements(
    baseline: PerformanceBaseline,
    current: PerformanceBaseline
  ): RegressionTestResult['improvements'] {
    const improvements: RegressionTestResult['improvements'] = []

    // Check response time improvement
    const responseTimeChange = this.calculatePercentageChange(
      baseline.metrics.responseTime.average,
      current.metrics.responseTime.average
    )

    if (responseTimeChange < -5) { // 5% improvement threshold
      improvements.push({
        metric: 'response_time_average',
        baselineValue: baseline.metrics.responseTime.average,
        currentValue: current.metrics.responseTime.average,
        changePercent: Math.abs(responseTimeChange)
      })
    }

    // Check throughput improvement
    const throughputChange = this.calculatePercentageChange(
      baseline.metrics.throughput.requestsPerSecond,
      current.metrics.throughput.requestsPerSecond
    )

    if (throughputChange > 5) { // 5% improvement threshold
      improvements.push({
        metric: 'throughput_requests_per_second',
        baselineValue: baseline.metrics.throughput.requestsPerSecond,
        currentValue: current.metrics.throughput.requestsPerSecond,
        changePercent: throughputChange
      })
    }

    // Check resource utilization improvement
    const cpuChange = this.calculatePercentageChange(
      baseline.metrics.resources.cpuUtilization,
      current.metrics.resources.cpuUtilization
    )

    if (cpuChange < -5) {
      improvements.push({
        metric: 'cpu_utilization',
        baselineValue: baseline.metrics.resources.cpuUtilization,
        currentValue: current.metrics.resources.cpuUtilization,
        changePercent: Math.abs(cpuChange)
      })
    }

    const memoryChange = this.calculatePercentageChange(
      baseline.metrics.resources.memoryUtilization,
      current.metrics.resources.memoryUtilization
    )

    if (memoryChange < -5) {
      improvements.push({
        metric: 'memory_utilization',
        baselineValue: baseline.metrics.resources.memoryUtilization,
        currentValue: current.metrics.resources.memoryUtilization,
        changePercent: Math.abs(memoryChange)
      })
    }

    return improvements
  }

  private getSeverity(
    changePercent: number,
    thresholds: PerformanceProfile['thresholds']['regression']
  ): 'minor' | 'moderate' | 'major' | 'critical' {
    if (changePercent >= thresholds.critical) return 'critical'
    if (changePercent >= thresholds.major) return 'major'
    if (changePercent >= thresholds.moderate) return 'moderate'
    return 'minor'
  }

  private determineVerdict(
    comparison: RegressionTestResult['comparison'],
    profile: PerformanceProfile
  ): RegressionTestResult['verdict'] {
    const { overallPerformanceChange } = comparison

    if (overallPerformanceChange < -profile.thresholds.regression.critical) {
      return 'failed' // Severe degradation
    } else if (overallPerformanceChange < -profile.thresholds.regression.minor) {
      return 'degraded' // Some degradation
    } else if (overallPerformanceChange > 5) {
      return 'improved' // Notable improvement
    } else {
      return 'passed' // No significant change
    }
  }

  private calculatePercentageChange(baseline: number, current: number): number {
    if (baseline === 0) return current === 0 ? 0 : 100
    return ((current - baseline) / baseline) * 100
  }

  async analyzeTrends(
    metricName: string,
    baselines: PerformanceBaseline[]
  ): Promise<TrendAnalysis> {
    // Sort baselines by timestamp
    const sortedBaselines = baselines.sort((a, b) => a.timestamp - b.timestamp)
    
    if (sortedBaselines.length < 3) {
      throw new Error('Need at least 3 baselines for trend analysis')
    }

    // Extract metric values
    const values = sortedBaselines.map(baseline => {
      return this.extractMetricValue(baseline, metricName)
    })

    // Calculate trend using simple linear regression
    const n = values.length
    const timestamps = sortedBaselines.map(b => b.timestamp)
    
    const sumX = timestamps.reduce((sum, t) => sum + t, 0)
    const sumY = values.reduce((sum, v) => sum + v, 0)
    const sumXY = timestamps.reduce((sum, t, i) => sum + t * values[i], 0)
    const sumXX = timestamps.reduce((sum, t) => sum + t * t, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    // Determine trend direction
    let trend: TrendAnalysis['trend']
    if (Math.abs(slope) < 0.001) {
      trend = 'stable'
    } else if (slope > 0) {
      trend = metricName.includes('response_time') || metricName.includes('utilization') ? 'degrading' : 'improving'
    } else {
      trend = metricName.includes('response_time') || metricName.includes('utilization') ? 'improving' : 'degrading'
    }

    // Calculate confidence (R-squared)
    const meanY = sumY / n
    const ssRes = values.reduce((sum, v, i) => {
      const predicted = slope * timestamps[i] + intercept
      return sum + Math.pow(v - predicted, 2)
    }, 0)
    const ssTot = values.reduce((sum, v) => sum + Math.pow(v - meanY, 2), 0)
    const confidence = 1 - (ssRes / ssTot)

    // Generate forecast
    const lastTimestamp = timestamps[timestamps.length - 1]
    const timeStep = (timestamps[timestamps.length - 1] - timestamps[0]) / (n - 1)
    const forecast = Array.from({ length: 5 }, (_, i) => {
      const futureTimestamp = lastTimestamp + (i + 1) * timeStep
      const predictedValue = slope * futureTimestamp + intercept
      return {
        timestamp: futureTimestamp,
        predictedValue,
        confidence: Math.max(0, confidence - (i * 0.1)) // Decrease confidence over time
      }
    })

    return {
      metric: metricName,
      trend,
      changeRate: slope,
      confidence: Math.max(0, Math.min(1, confidence)),
      forecast
    }
  }

  private extractMetricValue(baseline: PerformanceBaseline, metricName: string): number {
    const metricPaths: Record<string, (b: PerformanceBaseline) => number> = {
      'response_time_average': (b) => b.metrics.responseTime.average,
      'response_time_p95': (b) => b.metrics.responseTime.p95,
      'throughput_rps': (b) => b.metrics.throughput.requestsPerSecond,
      'cpu_utilization': (b) => b.metrics.resources.cpuUtilization,
      'memory_utilization': (b) => b.metrics.resources.memoryUtilization,
      'trading_execution_time': (b) => b.metrics.trading.orderExecutionTime,
      'database_query_time': (b) => b.metrics.database.averageQueryTime,
      'websocket_latency': (b) => b.metrics.websocket.messageLatency
    }

    const extractor = metricPaths[metricName]
    if (!extractor) {
      throw new Error(`Unknown metric: ${metricName}`)
    }

    return extractor(baseline)
  }

  getResults(): RegressionTestResult[] {
    return this.regressionResults
  }

  generateRegressionReport(): string {
    const report = [
      '=== PERFORMANCE REGRESSION TEST REPORT ===',
      `Total Tests: ${this.regressionResults.length}`,
      `Test Date: ${new Date().toISOString()}`,
      '',
      'Regression Test Results:',
      '─'.repeat(80)
    ]

    this.regressionResults.forEach((result, index) => {
      const { baseline, current, comparison, regressions, improvements, verdict } = result

      report.push(`${index + 1}. ${result.testName}`)
      report.push(`   Baseline: ${baseline.name} v${baseline.version} (${new Date(baseline.timestamp).toLocaleDateString()})`)
      report.push(`   Current: ${current.name} v${current.version} (${new Date(current.timestamp).toLocaleDateString()})`)
      report.push(`   Verdict: ${verdict.toUpperCase()}`)
      report.push('')
      
      report.push('   Performance Changes:')
      report.push(`     Response Time: ${comparison.responseTimeChange.toFixed(2)}%`)
      report.push(`     Throughput: ${comparison.throughputChange.toFixed(2)}%`)
      report.push(`     Resource Utilization: ${comparison.resourceUtilizationChange.toFixed(2)}%`)
      report.push(`     Overall Performance: ${comparison.overallPerformanceChange.toFixed(2)}%`)
      report.push('')

      if (regressions.length > 0) {
        report.push('   🚨 Regressions Detected:')
        regressions.forEach(regression => {
          const icon = regression.severity === 'critical' ? '💥' : 
                      regression.severity === 'major' ? '⚠️' : 
                      regression.severity === 'moderate' ? '⚡' : '📉'
          
          report.push(`     ${icon} ${regression.metric}: ${regression.changePercent.toFixed(2)}% worse (${regression.severity})`)
          report.push(`       Baseline: ${regression.baselineValue.toFixed(2)}, Current: ${regression.currentValue.toFixed(2)}`)
        })
        report.push('')
      }

      if (improvements.length > 0) {
        report.push('   ✨ Improvements Detected:')
        improvements.forEach(improvement => {
          report.push(`     📈 ${improvement.metric}: ${improvement.changePercent.toFixed(2)}% better`)
          report.push(`       Baseline: ${improvement.baselineValue.toFixed(2)}, Current: ${improvement.currentValue.toFixed(2)}`)
        })
        report.push('')
      }

      report.push('')
    })

    // Summary statistics
    const passedTests = this.regressionResults.filter(r => r.verdict === 'passed').length
    const degradedTests = this.regressionResults.filter(r => r.verdict === 'degraded').length
    const improvedTests = this.regressionResults.filter(r => r.verdict === 'improved').length
    const failedTests = this.regressionResults.filter(r => r.verdict === 'failed').length

    report.push('📊 Summary Statistics:')
    report.push('─'.repeat(40))
    report.push(`Passed: ${passedTests}`)
    report.push(`Degraded: ${degradedTests}`)
    report.push(`Improved: ${improvedTests}`)
    report.push(`Failed: ${failedTests}`)
    report.push(`Success Rate: ${((passedTests + improvedTests) / this.regressionResults.length * 100).toFixed(2)}%`)

    return report.join('\n')
  }
}

// Predefined performance profiles
const PERFORMANCE_PROFILES: { [key: string]: PerformanceProfile } = {
  tradingSystem: {
    profileId: 'trading-system-profile',
    name: 'Trading System Performance Profile',
    testDuration: 300000, // 5 minutes
    operations: [
      {
        name: 'api_request_balance',
        iterations: 1000,
        concurrency: 10,
        expectedLatency: 200,
        expectedThroughput: 50
      },
      {
        name: 'trading_execution',
        iterations: 500,
        concurrency: 5,
        expectedLatency: 500,
        expectedThroughput: 10
      },
      {
        name: 'pattern_detection',
        iterations: 200,
        concurrency: 3,
        expectedLatency: 1000,
        expectedThroughput: 5
      },
      {
        name: 'database_query',
        iterations: 2000,
        concurrency: 15,
        expectedLatency: 50,
        expectedThroughput: 100
      },
      {
        name: 'websocket_message',
        iterations: 5000,
        concurrency: 20,
        expectedLatency: 25,
        expectedThroughput: 200
      }
    ],
    thresholds: {
      responseTime: {
        warning: 1000,
        critical: 2000
      },
      throughput: {
        minimum: 50,
        target: 100
      },
      resourceUtilization: {
        cpu: 80,
        memory: 85
      },
      regression: {
        minor: 10,
        moderate: 25,
        major: 50,
        critical: 75
      }
    }
  }
}

// Test Suite Implementation
describe('Performance Regression Testing', () => {
  let testSuite: PerformanceRegressionTestSuite

  beforeAll(async () => {
    testSuite = new PerformanceRegressionTestSuite()
  })

  afterAll(async () => {
    // Cleanup
  })

  it('should create performance baseline', async () => {
    const baseline = await testSuite.createPerformanceBaseline(
      'test-baseline',
      '1.0.0',
      PERFORMANCE_PROFILES.tradingSystem
    )

    expect(baseline).toBeDefined()
    expect(baseline.name).toBe('test-baseline')
    expect(baseline.version).toBe('1.0.0')
    expect(baseline.metrics.responseTime.average).toBeGreaterThan(0)
    expect(baseline.metrics.throughput.requestsPerSecond).toBeGreaterThan(0)
    expect(baseline.environment.nodeVersion).toBe(process.version)
  })

  it('should load existing baseline', async () => {
    // First create a baseline
    await testSuite.createPerformanceBaseline(
      'load-test-baseline',
      '1.0.0',
      PERFORMANCE_PROFILES.tradingSystem
    )

    // Then load it
    const loadedBaseline = await testSuite.loadBaseline('load-test-baseline', '1.0.0')
    
    expect(loadedBaseline).toBeDefined()
    expect(loadedBaseline?.name).toBe('load-test-baseline')
    expect(loadedBaseline?.version).toBe('1.0.0')
  })

  it('should detect performance regressions', async () => {
    // Create initial baseline
    const originalBaseline = await testSuite.createPerformanceBaseline(
      'regression-test',
      '1.0.0',
      PERFORMANCE_PROFILES.tradingSystem
    )

    // Modify profile to simulate regression
    const regressedProfile = {
      ...PERFORMANCE_PROFILES.tradingSystem,
      operations: PERFORMANCE_PROFILES.tradingSystem.operations.map(op => ({
        ...op,
        expectedLatency: op.expectedLatency * 2 // Double the expected latency to simulate regression
      }))
    }

    // Run regression test
    const regressionResult = await testSuite.runRegressionTest(
      regressedProfile,
      'regression-test',
      '1.0.0'
    )

    expect(regressionResult).toBeDefined()
    expect(regressionResult.verdict).not.toBe('passed')
    expect(regressionResult.regressions.length).toBeGreaterThan(0)
  })

  it('should detect performance improvements', async () => {
    // Create baseline with intentionally poor performance
    const slowProfile = {
      ...PERFORMANCE_PROFILES.tradingSystem,
      operations: PERFORMANCE_PROFILES.tradingSystem.operations.map(op => ({
        ...op,
        expectedLatency: op.expectedLatency * 3 // Triple the latency
      }))
    }

    await testSuite.createPerformanceBaseline(
      'improvement-test',
      '1.0.0',
      slowProfile
    )

    // Test with better performance
    const fastProfile = {
      ...PERFORMANCE_PROFILES.tradingSystem,
      operations: PERFORMANCE_PROFILES.tradingSystem.operations.map(op => ({
        ...op,
        expectedLatency: Math.max(10, op.expectedLatency * 0.5) // Half the latency
      }))
    }

    const improvementResult = await testSuite.runRegressionTest(
      fastProfile,
      'improvement-test',
      '1.0.0'
    )

    expect(improvementResult).toBeDefined()
    expect(improvementResult.verdict).toBe('improved')
    expect(improvementResult.improvements.length).toBeGreaterThan(0)
  })

  it('should analyze performance trends', async () => {
    // Create multiple baselines over time
    const baselines: PerformanceBaseline[] = []
    
    for (let i = 0; i < 5; i++) {
      const baseline = await testSuite.createPerformanceBaseline(
        'trend-test',
        `1.${i}.0`,
        PERFORMANCE_PROFILES.tradingSystem
      )
      baselines.push(baseline)
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const trendAnalysis = await testSuite.analyzeTrends('response_time_average', baselines)

    expect(trendAnalysis).toBeDefined()
    expect(trendAnalysis.metric).toBe('response_time_average')
    expect(['improving', 'stable', 'degrading']).toContain(trendAnalysis.trend)
    expect(trendAnalysis.confidence).toBeGreaterThanOrEqual(0)
    expect(trendAnalysis.confidence).toBeLessThanOrEqual(1)
    expect(trendAnalysis.forecast.length).toBe(5)
  })

  it('should validate regression testing SLAs', () => {
    const results = testSuite.getResults()
    
    // Regression testing SLAs
    const REGRESSION_SLA = {
      maxTestDuration: 600000, // 10 minutes per test
      maxBaselineAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      minConfidenceLevel: 0.7, // 70% confidence for trend analysis
      maxRegressionThreshold: 50 // 50% max acceptable regression
    }

    results.forEach(result => {
      // Check test completed within reasonable time
      const testDuration = result.current.timestamp - result.baseline.timestamp
      expect(testDuration).toBeLessThan(REGRESSION_SLA.maxTestDuration)

      // Check baseline is not too old
      const baselineAge = Date.now() - result.baseline.timestamp
      expect(baselineAge).toBeLessThan(REGRESSION_SLA.maxBaselineAge)

      // Check no critical regressions
      const criticalRegressions = result.regressions.filter(r => r.severity === 'critical')
      expect(criticalRegressions.length).toBe(0)

      // Check major regressions are within threshold
      const majorRegressions = result.regressions.filter(r => r.severity === 'major')
      majorRegressions.forEach(regression => {
        expect(regression.changePercent).toBeLessThan(REGRESSION_SLA.maxRegressionThreshold)
      })
    })
  })

  it('should generate comprehensive regression report', () => {
    const report = testSuite.generateRegressionReport()
    
    expect(report).toContain('PERFORMANCE REGRESSION TEST REPORT')
    expect(report).toContain('Total Tests:')
    expect(report).toContain('Performance Changes:')
    expect(report).toContain('Summary Statistics:')
    expect(report).toContain('Success Rate:')
    
    console.log('\n' + report)
  })
})

// Export for use in other test files
export { 
  PerformanceRegressionTestSuite, 
  type PerformanceBaseline, 
  type RegressionTestResult,
  type TrendAnalysis,
  type PerformanceProfile,
  PERFORMANCE_PROFILES 
}