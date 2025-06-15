/**
 * Load Testing Framework
 * High-frequency trading performance testing infrastructure
 */

import { performance } from 'node:perf_hooks'
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import { EventEmitter } from 'events'

// ===================== LOAD TESTING TYPES =====================

export interface LoadTestConfig {
  name: string
  duration: number // milliseconds
  rampUpDuration: number // milliseconds
  rampDownDuration: number // milliseconds
  targetRPS: number // requests per second
  maxConcurrency: number
  testType: 'constant' | 'ramp' | 'spike' | 'stress' | 'volume' | 'endurance'
  scenarios: LoadTestScenario[]
  thresholds: PerformanceThresholds
  resourceMonitoring: boolean
  distributedMode: boolean
  workers: number
}

export interface LoadTestScenario {
  id: string
  name: string
  weight: number // 0-100 percentage
  endpoint?: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  payload?: unknown
  timeout: number
  retries: number
  validation?: ValidationRule[]
  customLogic?: string // JavaScript code for custom test logic
}

export interface PerformanceThresholds {
  maxResponseTime: number // milliseconds
  p95ResponseTime: number // milliseconds
  p99ResponseTime: number // milliseconds
  minThroughput: number // RPS
  maxErrorRate: number // percentage
  maxMemoryUsage: number // MB
  maxCPUUsage: number // percentage
  maxLatency: number // milliseconds
}

export interface ValidationRule {
  type: 'status' | 'response_time' | 'content' | 'header' | 'custom'
  condition: string
  expected: unknown
  critical: boolean
}

export interface LoadTestResult {
  testId: string
  startTime: number
  endTime: number
  duration: number
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  errorRate: number
  throughput: number
  responseTime: ResponseTimeMetrics
  resourceUsage: ResourceUsageMetrics
  errors: ErrorMetrics[]
  scenarios: ScenarioResult[]
  thresholdViolations: ThresholdViolation[]
  success: boolean
}

export interface ResponseTimeMetrics {
  min: number
  max: number
  mean: number
  median: number
  p95: number
  p99: number
  stdDev: number
  distribution: ResponseTimeDistribution[]
}

export interface ResponseTimeDistribution {
  range: string
  count: number
  percentage: number
}

export interface ResourceUsageMetrics {
  memory: {
    min: number
    max: number
    mean: number
    timeline: Array<{ timestamp: number, value: number }>
  }
  cpu: {
    min: number
    max: number
    mean: number
    timeline: Array<{ timestamp: number, value: number }>
  }
  networkIO: {
    bytesIn: number
    bytesOut: number
    connectionsActive: number
  }
}

export interface ErrorMetrics {
  type: string
  count: number
  percentage: number
  message: string
  firstOccurrence: number
  lastOccurrence: number
  affectedScenarios: string[]
}

export interface ScenarioResult {
  scenarioId: string
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  throughput: number
  errors: string[]
}

export interface ThresholdViolation {
  metric: string
  threshold: number
  actual: number
  severity: 'warning' | 'critical'
  timestamp: number
}

// ===================== LOAD TEST EXECUTOR =====================

export class LoadTestExecutor extends EventEmitter {
  private config: LoadTestConfig
  private isRunning: boolean = false
  private workers: Worker[] = []
  private results: LoadTestResult | null = null
  private resourceMonitor: ResourceMonitor | null = null
  private startTime: number = 0

  constructor(config: LoadTestConfig) {
    super()
    this.config = config
    this.resourceMonitor = new ResourceMonitor()
  }

  // ===================== TEST EXECUTION =====================

  async executeTest(): Promise<LoadTestResult> {
    console.log(`🚀 Starting load test: ${this.config.name}`)
    console.log(`  Target RPS: ${this.config.targetRPS}`)
    console.log(`  Duration: ${this.config.duration / 1000}s`)
    console.log(`  Scenarios: ${this.config.scenarios.length}`)

    this.isRunning = true
    this.startTime = performance.now()

    try {
      // Start resource monitoring
      if (this.config.resourceMonitoring) {
        await this.resourceMonitor?.start()
      }

      // Initialize workers for distributed testing
      if (this.config.distributedMode) {
        await this.initializeWorkers()
      }

      // Execute test phases
      await this.executeTestPhases()

      // Collect and analyze results
      this.results = await this.collectResults()

      console.log(`✅ Load test completed: ${this.results.success ? 'PASSED' : 'FAILED'}`)
      return this.results

    } catch (error) {
      console.error(`❌ Load test failed:`, error)
      throw error
    } finally {
      this.isRunning = false
      await this.cleanup()
    }
  }

  private async executeTestPhases(): Promise<void> {
    const totalDuration = this.config.duration
    const rampUpDuration = this.config.rampUpDuration
    const rampDownDuration = this.config.rampDownDuration
    const steadyStateDuration = totalDuration - rampUpDuration - rampDownDuration

    console.log('📈 Phase 1: Ramp-up')
    await this.executeRampUp(rampUpDuration)

    console.log('🔄 Phase 2: Steady state')
    await this.executeSteadyState(steadyStateDuration)

    console.log('📉 Phase 3: Ramp-down')
    await this.executeRampDown(rampDownDuration)
  }

  private async executeRampUp(duration: number): Promise<void> {
    const steps = 10
    const stepDuration = duration / steps
    const rpsIncrement = this.config.targetRPS / steps

    for (let step = 1; step <= steps; step++) {
      if (!this.isRunning) break

      const currentRPS = rpsIncrement * step
      await this.executeConcurrentRequests(currentRPS, stepDuration)
      
      this.emit('rampup-progress', {
        step,
        totalSteps: steps,
        currentRPS,
        targetRPS: this.config.targetRPS
      })
    }
  }

  private async executeSteadyState(duration: number): Promise<void> {
    await this.executeConcurrentRequests(this.config.targetRPS, duration)
  }

  private async executeRampDown(duration: number): Promise<void> {
    const steps = 5
    const stepDuration = duration / steps
    const rpsDecrement = this.config.targetRPS / steps

    for (let step = 1; step <= steps; step++) {
      if (!this.isRunning) break

      const currentRPS = this.config.targetRPS - (rpsDecrement * step)
      await this.executeConcurrentRequests(Math.max(0, currentRPS), stepDuration)
    }
  }

  // ===================== CONCURRENT REQUEST EXECUTION =====================

  private async executeConcurrentRequests(targetRPS: number, duration: number): Promise<void> {
    if (targetRPS <= 0 || duration <= 0) return

    const requestInterval = 1000 / targetRPS // milliseconds between requests
    const totalRequests = Math.floor((targetRPS * duration) / 1000)
    
    console.log(`  Executing ${totalRequests} requests at ${targetRPS} RPS for ${duration/1000}s`)

    const requestPromises: Promise<void>[] = []
    const startTime = performance.now()

    for (let i = 0; i < totalRequests && this.isRunning; i++) {
      const requestStartTime = startTime + (i * requestInterval)
      const delay = Math.max(0, requestStartTime - performance.now())

      requestPromises.push(
        this.scheduleRequest(delay, i)
      )

      // Limit concurrent requests
      if (requestPromises.length >= this.config.maxConcurrency) {
        await Promise.race(requestPromises)
        // Remove completed promises
        const completedCount = requestPromises.length - this.config.maxConcurrency + 10
        requestPromises.splice(0, completedCount)
      }
    }

    // Wait for remaining requests
    await Promise.allSettled(requestPromises)
  }

  private async scheduleRequest(delay: number, requestId: number): Promise<void> {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    if (!this.isRunning) return

    // Select scenario based on weight distribution
    const scenario = this.selectScenario()
    await this.executeScenario(scenario, requestId)
  }

  // ===================== SCENARIO EXECUTION =====================

  private selectScenario(): LoadTestScenario {
    const random = Math.random() * 100
    let cumulativeWeight = 0

    for (const scenario of this.config.scenarios) {
      cumulativeWeight += scenario.weight
      if (random <= cumulativeWeight) {
        return scenario
      }
    }

    // Fallback to first scenario
    return this.config.scenarios[0]
  }

  private async executeScenario(scenario: LoadTestScenario, requestId: number): Promise<void> {
    const startTime = performance.now()

    try {
      // Execute based on scenario type
      if (scenario.endpoint) {
        await this.executeHTTPRequest(scenario, requestId)
      } else if (scenario.customLogic) {
        await this.executeCustomLogic(scenario, requestId)
      } else {
        await this.executeAgentTest(scenario, requestId)
      }

      const endTime = performance.now()
      const responseTime = endTime - startTime

      this.recordSuccessfulRequest(scenario.id, responseTime)

    } catch (error) {
      const endTime = performance.now()
      const responseTime = endTime - startTime

      this.recordFailedRequest(scenario.id, responseTime, error)
    }
  }

  private async executeHTTPRequest(scenario: LoadTestScenario, requestId: number): Promise<void> {
    if (!scenario.endpoint) throw new Error('No endpoint specified')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), scenario.timeout)

    try {
      const response = await fetch(scenario.endpoint, {
        method: scenario.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-load-test': 'true',
          'x-request-id': requestId.toString(),
          ...scenario.headers
        },
        body: scenario.payload ? JSON.stringify(scenario.payload) : undefined,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Validate response
      if (scenario.validation) {
        await this.validateResponse(response, scenario.validation)
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

    } finally {
      clearTimeout(timeoutId)
    }
  }

  private async executeCustomLogic(scenario: LoadTestScenario, requestId: number): Promise<void> {
    if (!scenario.customLogic) throw new Error('No custom logic specified')

    // Execute custom JavaScript logic
    const customFunction = new Function('requestId', 'scenario', scenario.customLogic)
    await customFunction(requestId, scenario)
  }

  private async executeAgentTest(scenario: LoadTestScenario, requestId: number): Promise<void> {
    // Simulate agent processing for load testing
    const processingTime = 100 + Math.random() * 200 // 100-300ms
    await new Promise(resolve => setTimeout(resolve, processingTime))

    // Simulate occasional failures
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Simulated agent processing failure')
    }
  }

  // ===================== WORKER MANAGEMENT =====================

  private async initializeWorkers(): Promise<void> {
    console.log(`🔧 Initializing ${this.config.workers} worker threads...`)

    for (let i = 0; i < this.config.workers; i++) {
      const worker = new Worker(__filename, {
        workerData: {
          workerId: i,
          config: this.config,
          scenarios: this.config.scenarios
        }
      })

      worker.on('message', (message) => {
        this.handleWorkerMessage(i, message)
      })

      worker.on('error', (error) => {
        console.error(`Worker ${i} error:`, error)
      })

      this.workers.push(worker)
    }

    // Wait for workers to be ready
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  private handleWorkerMessage(workerId: number, message: any): void {
    switch (message.type) {
      case 'request-complete':
        this.emit('request-complete', {
          workerId,
          ...message.data
        })
        break
      case 'error':
        this.emit('worker-error', {
          workerId,
          error: message.error
        })
        break
    }
  }

  // ===================== RESULT COLLECTION =====================

  private async collectResults(): Promise<LoadTestResult> {
    const endTime = performance.now()
    const duration = endTime - this.startTime

    // Stop resource monitoring
    const resourceUsage = this.config.resourceMonitoring
      ? await this.resourceMonitor?.stop()
      : this.createEmptyResourceMetrics()

    // Calculate metrics from collected data
    const metrics = this.calculateMetrics(duration)

    // Check threshold violations
    const thresholdViolations = this.checkThresholds(metrics)

    const result: LoadTestResult = {
      testId: `load-test-${Date.now()}`,
      startTime: this.startTime,
      endTime,
      duration,
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      failedRequests: metrics.failedRequests,
      errorRate: (metrics.failedRequests / metrics.totalRequests) * 100,
      throughput: (metrics.totalRequests / duration) * 1000, // RPS
      responseTime: metrics.responseTime,
      resourceUsage,
      errors: metrics.errors,
      scenarios: metrics.scenarios,
      thresholdViolations,
      success: thresholdViolations.filter(v => v.severity === 'critical').length === 0
    }

    return result
  }

  private calculateMetrics(duration: number): any {
    // This would collect actual metrics from the test execution
    // For now, returning mock data structure
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTime: this.createEmptyResponseTimeMetrics(),
      errors: [],
      scenarios: []
    }
  }

  private checkThresholds(metrics: any): ThresholdViolation[] {
    const violations: ThresholdViolation[] = []
    const thresholds = this.config.thresholds

    // Check response time thresholds
    if (metrics.responseTime.p95 > thresholds.p95ResponseTime) {
      violations.push({
        metric: 'p95_response_time',
        threshold: thresholds.p95ResponseTime,
        actual: metrics.responseTime.p95,
        severity: 'warning',
        timestamp: Date.now()
      })
    }

    if (metrics.responseTime.p99 > thresholds.p99ResponseTime) {
      violations.push({
        metric: 'p99_response_time',
        threshold: thresholds.p99ResponseTime,
        actual: metrics.responseTime.p99,
        severity: 'critical',
        timestamp: Date.now()
      })
    }

    // Check error rate threshold
    const errorRate = (metrics.failedRequests / metrics.totalRequests) * 100
    if (errorRate > thresholds.maxErrorRate) {
      violations.push({
        metric: 'error_rate',
        threshold: thresholds.maxErrorRate,
        actual: errorRate,
        severity: 'critical',
        timestamp: Date.now()
      })
    }

    return violations
  }

  // ===================== UTILITY METHODS =====================

  private recordSuccessfulRequest(scenarioId: string, responseTime: number): void {
    this.emit('request-success', {
      scenarioId,
      responseTime,
      timestamp: Date.now()
    })
  }

  private recordFailedRequest(scenarioId: string, responseTime: number, error: unknown): void {
    this.emit('request-failure', {
      scenarioId,
      responseTime,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now()
    })
  }

  private async validateResponse(response: Response, rules: ValidationRule[]): Promise<void> {
    for (const rule of rules) {
      switch (rule.type) {
        case 'status':
          if (response.status !== rule.expected) {
            throw new Error(`Status validation failed: expected ${rule.expected}, got ${response.status}`)
          }
          break
        case 'header':
          const headerValue = response.headers.get(rule.condition)
          if (headerValue !== rule.expected) {
            throw new Error(`Header validation failed: ${rule.condition}`)
          }
          break
        // Add more validation types as needed
      }
    }
  }

  private createEmptyResponseTimeMetrics(): ResponseTimeMetrics {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p95: 0,
      p99: 0,
      stdDev: 0,
      distribution: []
    }
  }

  private createEmptyResourceMetrics(): ResourceUsageMetrics {
    return {
      memory: {
        min: 0,
        max: 0,
        mean: 0,
        timeline: []
      },
      cpu: {
        min: 0,
        max: 0,
        mean: 0,
        timeline: []
      },
      networkIO: {
        bytesIn: 0,
        bytesOut: 0,
        connectionsActive: 0
      }
    }
  }

  private async cleanup(): Promise<void> {
    // Terminate workers
    for (const worker of this.workers) {
      await worker.terminate()
    }
    this.workers = []

    // Stop resource monitoring
    if (this.resourceMonitor) {
      await this.resourceMonitor.stop()
    }
  }

  // ===================== PUBLIC API =====================

  stop(): void {
    this.isRunning = false
  }

  getResults(): LoadTestResult | null {
    return this.results
  }

  isTestRunning(): boolean {
    return this.isRunning
  }
}

// ===================== RESOURCE MONITOR =====================

class ResourceMonitor {
  private isMonitoring: boolean = false
  private monitoringInterval: NodeJS.Timeout | null = null
  private resourceData: Array<{ timestamp: number, memory: number, cpu: number }> = []

  async start(interval: number = 1000): Promise<void> {
    this.isMonitoring = true
    this.resourceData = []

    this.monitoringInterval = setInterval(() => {
      if (!this.isMonitoring) return

      const memoryUsage = process.memoryUsage()
      const cpuUsage = process.cpuUsage()

      this.resourceData.push({
        timestamp: Date.now(),
        memory: memoryUsage.heapUsed / 1024 / 1024, // MB
        cpu: (cpuUsage.user + cpuUsage.system) / 1000 // milliseconds
      })
    }, interval)
  }

  async stop(): Promise<ResourceUsageMetrics> {
    this.isMonitoring = false
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    if (this.resourceData.length === 0) {
      return this.createEmptyMetrics()
    }

    const memoryValues = this.resourceData.map(d => d.memory)
    const cpuValues = this.resourceData.map(d => d.cpu)

    return {
      memory: {
        min: Math.min(...memoryValues),
        max: Math.max(...memoryValues),
        mean: memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length,
        timeline: this.resourceData.map(d => ({ timestamp: d.timestamp, value: d.memory }))
      },
      cpu: {
        min: Math.min(...cpuValues),
        max: Math.max(...cpuValues),
        mean: cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length,
        timeline: this.resourceData.map(d => ({ timestamp: d.timestamp, value: d.cpu }))
      },
      networkIO: {
        bytesIn: 0, // Would require OS-level monitoring
        bytesOut: 0,
        connectionsActive: 0
      }
    }
  }

  private createEmptyMetrics(): ResourceUsageMetrics {
    return {
      memory: { min: 0, max: 0, mean: 0, timeline: [] },
      cpu: { min: 0, max: 0, mean: 0, timeline: [] },
      networkIO: { bytesIn: 0, bytesOut: 0, connectionsActive: 0 }
    }
  }
}

// ===================== PREDEFINED LOAD TEST CONFIGURATIONS =====================

export const PredefinedLoadTests: LoadTestConfig[] = [
  {
    name: 'Agent System Load Test',
    duration: 5 * 60 * 1000, // 5 minutes
    rampUpDuration: 60 * 1000, // 1 minute
    rampDownDuration: 30 * 1000, // 30 seconds
    targetRPS: 50,
    maxConcurrency: 100,
    testType: 'stress',
    scenarios: [
      {
        id: 'pattern-detection',
        name: 'Pattern Detection Load',
        weight: 40,
        timeout: 5000,
        retries: 2,
        customLogic: `
          // Simulate pattern detection workload
          const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
          const symbol = symbols[Math.floor(Math.random() * symbols.length)];
          
          // Simulate API call delay
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
          
          // Simulate processing
          const result = {
            symbol,
            pattern: 'ready_state',
            confidence: 80 + Math.random() * 20,
            timestamp: Date.now()
          };
          
          return result;
        `
      },
      {
        id: 'agent-coordination',
        name: 'Multi-Agent Coordination',
        weight: 30,
        timeout: 10000,
        retries: 1,
        customLogic: `
          // Simulate multi-agent workflow
          const agents = ['calendar', 'pattern', 'risk', 'strategy'];
          const results = [];
          
          for (const agent of agents) {
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
            results.push({ agent, success: true, processingTime: Math.random() * 200 });
          }
          
          return { workflow: 'complete', agents: results };
        `
      },
      {
        id: 'api-endpoints',
        name: 'API Endpoint Load',
        weight: 30,
        endpoint: 'http://localhost:3008/api/mexc/symbols',
        method: 'GET',
        timeout: 3000,
        retries: 3,
        validation: [
          { type: 'status', condition: 'status', expected: 200, critical: true }
        ]
      }
    ],
    thresholds: {
      maxResponseTime: 5000,
      p95ResponseTime: 2000,
      p99ResponseTime: 3000,
      minThroughput: 40,
      maxErrorRate: 5,
      maxMemoryUsage: 512,
      maxCPUUsage: 80,
      maxLatency: 1000
    },
    resourceMonitoring: true,
    distributedMode: false,
    workers: 4
  },
  {
    name: 'High-Frequency Trading Simulation',
    duration: 10 * 60 * 1000, // 10 minutes
    rampUpDuration: 2 * 60 * 1000, // 2 minutes
    rampDownDuration: 1 * 60 * 1000, // 1 minute
    targetRPS: 200,
    maxConcurrency: 500,
    testType: 'volume',
    scenarios: [
      {
        id: 'rapid-pattern-analysis',
        name: 'Rapid Pattern Analysis',
        weight: 50,
        timeout: 1000,
        retries: 0,
        customLogic: `
          // High-frequency pattern detection
          const patterns = [
            { sts: 2, st: 2, tt: 4 },
            { sts: 1, st: 1, tt: 2 },
            { sts: 2, st: 1, tt: 3 }
          ];
          
          const pattern = patterns[Math.floor(Math.random() * patterns.length)];
          await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 50));
          
          return { detected: true, pattern, confidence: 90 + Math.random() * 10 };
        `
      },
      {
        id: 'websocket-simulation',
        name: 'WebSocket Data Processing',
        weight: 50,
        timeout: 500,
        retries: 0,
        customLogic: `
          // Simulate real-time data processing
          const dataPoints = Math.floor(Math.random() * 100) + 1;
          
          for (let i = 0; i < dataPoints; i++) {
            // Simulate data processing
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          
          return { processed: dataPoints, timestamp: Date.now() };
        `
      }
    ],
    thresholds: {
      maxResponseTime: 1000,
      p95ResponseTime: 500,
      p99ResponseTime: 800,
      minThroughput: 180,
      maxErrorRate: 2,
      maxMemoryUsage: 1024,
      maxCPUUsage: 90,
      maxLatency: 100
    },
    resourceMonitoring: true,
    distributedMode: true,
    workers: 8
  }
]

// ===================== WORKER THREAD LOGIC =====================

if (!isMainThread && parentPort) {
  // Worker thread implementation
  const { workerId, config, scenarios } = workerData

  parentPort.on('message', async (message) => {
    switch (message.type) {
      case 'execute-scenario':
        try {
          const result = await executeScenarioInWorker(message.scenario, message.requestId)
          parentPort?.postMessage({
            type: 'request-complete',
            data: result
          })
        } catch (error) {
          parentPort?.postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : String(error)
          })
        }
        break
    }
  })

  async function executeScenarioInWorker(scenario: LoadTestScenario, requestId: number): Promise<any> {
    const startTime = performance.now()
    
    // Execute scenario logic (simplified for worker)
    if (scenario.customLogic) {
      const customFunction = new Function('requestId', 'scenario', scenario.customLogic)
      await customFunction(requestId, scenario)
    } else {
      // Default simulation
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200))
    }
    
    const endTime = performance.now()
    
    return {
      scenarioId: scenario.id,
      responseTime: endTime - startTime,
      success: true,
      timestamp: Date.now()
    }
  }
}

// ===================== FACTORY FUNCTIONS =====================

export function createLoadTest(config: Partial<LoadTestConfig>): LoadTestExecutor {
  const defaultConfig: LoadTestConfig = {
    name: 'Default Load Test',
    duration: 60 * 1000, // 1 minute
    rampUpDuration: 10 * 1000, // 10 seconds
    rampDownDuration: 10 * 1000, // 10 seconds
    targetRPS: 10,
    maxConcurrency: 50,
    testType: 'constant',
    scenarios: [],
    thresholds: {
      maxResponseTime: 5000,
      p95ResponseTime: 2000,
      p99ResponseTime: 3000,
      minThroughput: 8,
      maxErrorRate: 10,
      maxMemoryUsage: 512,
      maxCPUUsage: 80,
      maxLatency: 1000
    },
    resourceMonitoring: true,
    distributedMode: false,
    workers: 2
  }

  return new LoadTestExecutor({ ...defaultConfig, ...config })
}

export function createAgentLoadTest(targetRPS: number, duration: number): LoadTestExecutor {
  return createLoadTest({
    name: `Agent Load Test - ${targetRPS} RPS`,
    targetRPS,
    duration,
    scenarios: [
      {
        id: 'agent-processing',
        name: 'Agent Processing Load',
        weight: 100,
        timeout: 5000,
        retries: 2,
        customLogic: `
          // Simulate comprehensive agent workload
          const agentTypes = ['pattern', 'calendar', 'risk', 'strategy', 'safety'];
          const selectedAgent = agentTypes[Math.floor(Math.random() * agentTypes.length)];
          
          // Different processing times for different agent types
          const processingTimes = {
            'pattern': 100 + Math.random() * 200,
            'calendar': 50 + Math.random() * 100,
            'risk': 200 + Math.random() * 300,
            'strategy': 300 + Math.random() * 500,
            'safety': 50 + Math.random() * 100
          };
          
          await new Promise(resolve => setTimeout(resolve, processingTimes[selectedAgent]));
          
          return {
            agent: selectedAgent,
            success: true,
            processingTime: processingTimes[selectedAgent],
            confidence: 80 + Math.random() * 20
          };
        `
      }
    ]
  })
}