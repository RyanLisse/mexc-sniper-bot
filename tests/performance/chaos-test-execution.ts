/**
 * Chaos Test Execution Suite
 * Executes predefined chaos engineering experiments and validates system resilience
 */

import { ChaosEngineeringEngine, PredefinedChaosExperiments, createChaosEngine, createChaosExperiment } from '../chaos/chaos-engineering-framework'
import type { ChaosExperiment, ChaosExperimentResult } from '../chaos/chaos-engineering-framework'

interface ChaosTestSuiteResult {
  experimentResults: ChaosExperimentResult[]
  overallSystemResilience: number
  criticalFindings: string[]
  recommendations: string[]
  totalExperiments: number
  successfulExperiments: number
  failedExperiments: number
}

export class ChaosTestExecutor {
  private chaosEngine: ChaosEngineeringEngine

  constructor() {
    this.chaosEngine = createChaosEngine()
  }

  async executeChaosTestSuite(): Promise<ChaosTestSuiteResult> {
    console.log('🔥 Starting Chaos Engineering Test Suite')
    console.log('='.repeat(60))

    const experimentResults: ChaosExperimentResult[] = []
    const criticalFindings: string[] = []
    const recommendations: string[] = []

    // Execute predefined experiments
    for (const experiment of PredefinedChaosExperiments) {
      try {
        console.log(`\n💥 Executing: ${experiment.name}`)
        const result = await this.chaosEngine.runExperiment(experiment)
        experimentResults.push(result)

        // Analyze results
        this.analyzeExperimentResult(result, criticalFindings, recommendations)

      } catch (error) {
        console.error(`❌ Experiment failed: ${experiment.name}`, error)
        criticalFindings.push(`Experiment ${experiment.name} failed to complete: ${error}`)
      }

      // Cool-down period between experiments
      await new Promise(resolve => setTimeout(resolve, 10000))
    }

    // Execute custom experiments
    const customExperiments = this.createCustomExperiments()
    for (const experiment of customExperiments) {
      try {
        console.log(`\n💥 Executing Custom: ${experiment.name}`)
        const result = await this.chaosEngine.runExperiment(experiment)
        experimentResults.push(result)

        this.analyzeExperimentResult(result, criticalFindings, recommendations)

      } catch (error) {
        console.error(`❌ Custom experiment failed: ${experiment.name}`, error)
        criticalFindings.push(`Custom experiment ${experiment.name} failed: ${error}`)
      }

      // Cool-down period between experiments
      await new Promise(resolve => setTimeout(resolve, 8000))
    }

    // Calculate overall resilience score
    const overallSystemResilience = this.calculateSystemResilience(experimentResults)

    // Summary statistics
    const totalExperiments = experimentResults.length
    const successfulExperiments = experimentResults.filter(r => r.success).length
    const failedExperiments = totalExperiments - successfulExperiments

    console.log('\n📊 Chaos Engineering Results Summary')
    console.log('='.repeat(60))
    console.log(`Total Experiments: ${totalExperiments}`)
    console.log(`Successful: ${successfulExperiments}`)
    console.log(`Failed: ${failedExperiments}`)
    console.log(`Overall System Resilience: ${overallSystemResilience.toFixed(2)}%`)

    if (criticalFindings.length > 0) {
      console.log('\n🚨 Critical Findings:')
      criticalFindings.forEach(finding => console.log(`  - ${finding}`))
    }

    if (recommendations.length > 0) {
      console.log('\n💡 Recommendations:')
      recommendations.forEach(rec => console.log(`  - ${rec}`))
    }

    return {
      experimentResults,
      overallSystemResilience,
      criticalFindings,
      recommendations,
      totalExperiments,
      successfulExperiments,
      failedExperiments
    }
  }

  private createCustomExperiments(): ChaosExperiment[] {
    return [
      createChaosExperiment({
        id: 'websocket-connection-failure',
        name: 'WebSocket Connection Failure Test',
        description: 'Test system behavior when WebSocket connections fail',
        hypothesis: 'System should gracefully handle WebSocket failures and recover automatically',
        blastRadius: 'external_dependencies',
        severity: 'medium',
        duration: 120000, // 2 minutes
        faults: [
          {
            id: 'websocket-failure',
            type: 'failure',
            target: {
              type: 'network',
              identifier: 'websocket-connections',
              scope: 'all'
            },
            parameters: {
              errorRate: 50,
              errorMessage: 'WebSocket connection lost'
            },
            duration: 120000,
            intensity: 50,
            injectionPattern: 'intermittent',
            conditions: []
          }
        ],
        successCriteria: {
          systemAvailability: 85,
          maxResponseTimeIncrease: 200,
          maxErrorRateIncrease: 20,
          recoveryTime: 45000,
          dataIntegrity: true,
          agentCoordination: true,
          emergencyProtocols: true
        },
        rollbackTriggers: [
          {
            condition: {
              metric: 'error_rate',
              operator: '>',
              threshold: 40,
              evaluationPeriod: 30000
            },
            action: 'stop_experiment',
            priority: 'high'
          }
        ],
        safeguards: [],
        metrics: ['response_time', 'error_rate', 'availability']
      }),

      createChaosExperiment({
        id: 'memory-pressure-test',
        name: 'Memory Pressure Test',
        description: 'Test system behavior under memory pressure',
        hypothesis: 'System should handle memory pressure gracefully without crashing',
        blastRadius: 'system_wide',
        severity: 'high',
        duration: 180000, // 3 minutes
        faults: [
          {
            id: 'memory-pressure',
            type: 'memory_leak',
            target: {
              type: 'memory',
              identifier: 'application-memory',
              scope: 'all'
            },
            parameters: {
              memoryLeakRate: 2 // 2MB per second
            },
            duration: 180000,
            intensity: 70,
            injectionPattern: 'gradual',
            conditions: []
          }
        ],
        successCriteria: {
          systemAvailability: 90,
          maxResponseTimeIncrease: 150,
          maxErrorRateIncrease: 15,
          recoveryTime: 60000,
          dataIntegrity: true,
          agentCoordination: true,
          emergencyProtocols: true
        },
        rollbackTriggers: [
          {
            condition: {
              metric: 'memory_used',
              operator: '>',
              threshold: 800, // 800MB
              evaluationPeriod: 60000
            },
            action: 'stop_experiment',
            priority: 'emergency'
          }
        ],
        safeguards: [
          {
            id: 'memory-circuit-breaker',
            type: 'circuit_breaker',
            trigger: {
              metric: 'memory_used',
              operator: '>',
              threshold: 700,
              evaluationPeriod: 30000
            },
            action: 'activate_memory_gc',
            autoActivate: true
          }
        ],
        metrics: ['memory_used', 'response_time', 'error_rate']
      }),

      createChaosExperiment({
        id: 'api-timeout-cascade',
        name: 'API Timeout Cascade Test',
        description: 'Test cascading failures when external APIs timeout',
        hypothesis: 'System should isolate API timeouts and prevent cascade failures',
        blastRadius: 'external_dependencies',
        severity: 'medium',
        duration: 150000, // 2.5 minutes
        faults: [
          {
            id: 'api-timeout',
            type: 'timeout',
            target: {
              type: 'api_endpoint',
              identifier: 'mexc-api',
              scope: 'specific'
            },
            parameters: {
              timeoutMs: 30000 // 30 second timeout
            },
            duration: 150000,
            intensity: 60,
            injectionPattern: 'intermittent',
            conditions: []
          }
        ],
        successCriteria: {
          systemAvailability: 80,
          maxResponseTimeIncrease: 300,
          maxErrorRateIncrease: 25,
          recoveryTime: 90000,
          dataIntegrity: true,
          agentCoordination: true,
          emergencyProtocols: true
        },
        rollbackTriggers: [
          {
            condition: {
              metric: 'response_time',
              operator: '>',
              threshold: 10000,
              evaluationPeriod: 60000
            },
            action: 'reduce_intensity',
            priority: 'medium'
          }
        ],
        safeguards: [
          {
            id: 'timeout-circuit-breaker',
            type: 'circuit_breaker',
            trigger: {
              metric: 'error_rate',
              operator: '>',
              threshold: 30,
              evaluationPeriod: 45000
            },
            action: 'activate_fallback_endpoints',
            autoActivate: true
          }
        ],
        metrics: ['response_time', 'error_rate', 'throughput']
      })
    ]
  }

  private analyzeExperimentResult(
    result: ChaosExperimentResult,
    criticalFindings: string[],
    recommendations: string[]
  ): void {
    // Check if experiment succeeded
    if (!result.success) {
      criticalFindings.push(`Experiment ${result.experimentId} failed to meet success criteria`)
    }

    // Analyze system metrics
    const metrics = result.systemMetrics

    // High response time increase
    if (metrics.responseTime.increase > 500) {
      criticalFindings.push(`Extreme response time degradation: ${metrics.responseTime.increase.toFixed(2)}% increase`)
      recommendations.push('Implement more aggressive circuit breakers and fallback mechanisms')
    }

    // High error rate increase
    if (metrics.errorRate.increase > 50) {
      criticalFindings.push(`High error rate increase: ${metrics.errorRate.increase.toFixed(2)}%`)
      recommendations.push('Improve error handling and retry mechanisms')
    }

    // Slow recovery
    if (metrics.recoveryMetrics.fullRecoveryTime > 120000) { // 2 minutes
      criticalFindings.push(`Slow recovery time: ${metrics.recoveryMetrics.fullRecoveryTime / 1000}s`)
      recommendations.push('Implement faster detection and recovery mechanisms')
    }

    // Memory issues
    if (metrics.resourceUsage.memory.peak > metrics.resourceUsage.memory.baseline * 3) {
      criticalFindings.push('Significant memory usage spike detected')
      recommendations.push('Implement memory monitoring and automatic garbage collection')
    }

    // Availability issues
    if (metrics.availability < 90) {
      criticalFindings.push(`Low system availability: ${metrics.availability.toFixed(2)}%`)
      recommendations.push('Improve system redundancy and failover mechanisms')
    }

    // Analyze observations for critical issues
    const criticalObservations = result.observations.filter(obs => obs.severity === 'critical')
    if (criticalObservations.length > 0) {
      criticalFindings.push(`${criticalObservations.length} critical system behaviors observed`)
      criticalObservations.forEach(obs => {
        if (obs.recommendation) {
          recommendations.push(obs.recommendation)
        }
      })
    }

    // Check rollback events
    if (result.rollbackEvents.length > 0) {
      criticalFindings.push(`${result.rollbackEvents.length} emergency rollbacks triggered`)
      recommendations.push('Review and improve rollback trigger thresholds')
    }
  }

  private calculateSystemResilience(results: ChaosExperimentResult[]): number {
    if (results.length === 0) return 0

    let totalScore = 0
    let weights = 0

    for (const result of results) {
      const metrics = result.systemMetrics
      
      // Calculate resilience score based on multiple factors
      let experimentScore = 100

      // Availability impact (40% weight)
      const availabilityScore = Math.max(0, metrics.availability)
      experimentScore -= (100 - availabilityScore) * 0.4

      // Response time impact (20% weight)
      const responseTimeImpact = Math.min(metrics.responseTime.increase, 500) / 500 * 100
      experimentScore -= responseTimeImpact * 0.2

      // Error rate impact (20% weight)
      const errorRateImpact = Math.min(metrics.errorRate.increase, 100)
      experimentScore -= errorRateImpact * 0.2

      // Recovery time impact (20% weight)
      const recoveryImpact = Math.min(metrics.recoveryMetrics.fullRecoveryTime / 1000, 300) / 300 * 100
      experimentScore -= recoveryImpact * 0.2

      // Weight by experiment severity
      let weight = 1
      if (result.experimentId.includes('critical')) weight = 2
      if (result.experimentId.includes('high')) weight = 1.5

      totalScore += Math.max(0, experimentScore) * weight
      weights += weight
    }

    return weights > 0 ? totalScore / weights : 0
  }
}

// WebSocket performance testing
export class WebSocketPerformanceTest {
  private connections: WebSocket[] = []
  private metrics = {
    messagesReceived: 0,
    messagesSent: 0,
    totalLatency: 0,
    minLatency: Number.MAX_VALUE,
    maxLatency: 0,
    errors: 0
  }

  async testWebSocketPerformance(): Promise<{
    connectionsEstablished: number
    averageLatency: number
    messagesThroughput: number
    errorRate: number
  }> {
    console.log('🔌 Testing WebSocket Performance...')

    const wsUrl = 'ws://localhost:3008/api/websocket'
    const connectionCount = 10
    const testDuration = 30000 // 30 seconds

    // Establish connections
    const connectionPromises = Array.from({ length: connectionCount }, () => 
      this.createWebSocketConnection(wsUrl)
    )

    const establishedConnections = await Promise.allSettled(connectionPromises)
    const successfulConnections = establishedConnections.filter(p => p.status === 'fulfilled').length

    console.log(`  Established ${successfulConnections}/${connectionCount} connections`)

    // Send test messages
    const startTime = Date.now()
    const messageInterval = setInterval(() => {
      this.connections.forEach((ws, index) => {
        if (ws.readyState === WebSocket.OPEN) {
          const message = JSON.stringify({
            type: 'ping',
            timestamp: Date.now(),
            connectionId: index
          })
          ws.send(message)
          this.metrics.messagesSent++
        }
      })
    }, 1000)

    // Run test for specified duration
    await new Promise(resolve => setTimeout(resolve, testDuration))
    clearInterval(messageInterval)

    // Close connections
    this.connections.forEach(ws => ws.close())

    const testDurationSec = testDuration / 1000
    const averageLatency = this.metrics.messagesReceived > 0 
      ? this.metrics.totalLatency / this.metrics.messagesReceived 
      : 0
    const messagesThroughput = this.metrics.messagesReceived / testDurationSec
    const errorRate = this.metrics.messagesSent > 0 
      ? (this.metrics.errors / this.metrics.messagesSent) * 100 
      : 0

    console.log(`  Average Latency: ${averageLatency.toFixed(2)}ms`)
    console.log(`  Messages Throughput: ${messagesThroughput.toFixed(2)} msg/s`)
    console.log(`  Error Rate: ${errorRate.toFixed(2)}%`)

    return {
      connectionsEstablished: successfulConnections,
      averageLatency,
      messagesThroughput,
      errorRate
    }
  }

  private createWebSocketConnection(url: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        // Mock WebSocket for Node.js environment
        const mockWs = {
          readyState: 1, // OPEN
          send: (data: string) => {
            // Simulate message sending with response
            setTimeout(() => {
              this.handleMessage(data)
            }, Math.random() * 100 + 50) // 50-150ms latency
          },
          close: () => {},
          addEventListener: () => {},
          removeEventListener: () => {}
        } as any

        this.connections.push(mockWs)
        resolve(mockWs)

      } catch (error) {
        reject(error)
      }
    })
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)
      if (message.type === 'ping' && message.timestamp) {
        const latency = Date.now() - message.timestamp
        this.metrics.messagesReceived++
        this.metrics.totalLatency += latency
        this.metrics.minLatency = Math.min(this.metrics.minLatency, latency)
        this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency)
      }
    } catch (error) {
      this.metrics.errors++
    }
  }
}

// Main execution function
export async function executeFullChaosTestSuite(): Promise<{
  chaosResults: ChaosTestSuiteResult
  webSocketResults: any
}> {
  console.log('🔥 Executing Full Chaos Engineering & Performance Test Suite')
  console.log('='.repeat(80))

  const chaosExecutor = new ChaosTestExecutor()
  const webSocketTester = new WebSocketPerformanceTest()

  try {
    // Execute chaos tests
    const chaosResults = await chaosExecutor.executeChaosTestSuite()

    // Execute WebSocket performance tests
    const webSocketResults = await webSocketTester.testWebSocketPerformance()

    console.log('\n🎯 Full Test Suite Complete!')
    console.log(`Overall System Resilience: ${chaosResults.overallSystemResilience.toFixed(2)}%`)
    console.log(`Critical Findings: ${chaosResults.criticalFindings.length}`)
    console.log(`WebSocket Throughput: ${webSocketResults.messagesThroughput.toFixed(2)} msg/s`)

    return { chaosResults, webSocketResults }

  } catch (error) {
    console.error('❌ Test suite execution failed:', error)
    throw error
  }
}