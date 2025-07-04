/**
 * WebSocket Performance Test Suite
 * Comprehensive performance testing for WebSocket connections, real-time data streaming, and message throughput
 */

import { performance } from 'node:perf_hooks'
import { WebSocket } from 'ws'
import { EventEmitter } from 'events'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface WebSocketPerformanceMetrics {
  testName: string
  duration: number
  connectionsEstablished: number
  totalMessagesSent: number
  totalMessagesReceived: number
  averageLatency: number
  minLatency: number
  maxLatency: number
  messagesThroughput: number
  connectionSuccess: number
  connectionFailures: number
  reconnectionAttempts: number
  dataTransferRate: number // MB/s
  memoryUsage: {
    initial: number
    peak: number
    final: number
  }
}

interface ConnectionLatencyMetrics {
  connectionTime: number
  firstMessageTime: number
  averageMessageLatency: number
  maxMessageLatency: number
  jitter: number
}

interface ThroughputTestResult {
  messagesPerSecond: number
  bytesPerSecond: number
  peakThroughput: number
  sustainedThroughput: number
  dropRate: number
}

class WebSocketPerformanceTestSuite extends EventEmitter {
  private baseUrl: string
  private connections: Map<string, WebSocket> = new Map()
  private latencyTracker: Map<string, number[]> = new Map()
  private messageCounters: Map<string, number> = new Map()
  private results: WebSocketPerformanceMetrics[] = []

  constructor(baseUrl: string = 'ws://localhost:3008') {
    super()
    this.baseUrl = baseUrl
  }

  async setup(): Promise<void> {
    // Wait for WebSocket server to be ready
    await this.waitForWebSocketServer()
  }

  async teardown(): Promise<void> {
    // Close all connections
    for (const [id, connection] of this.connections) {
      if (connection.readyState === WebSocket.OPEN) {
        connection.close()
      }
    }
    this.connections.clear()
    this.latencyTracker.clear()
    this.messageCounters.clear()
  }

  private async waitForWebSocketServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const testConnection = new WebSocket(`${this.baseUrl}/api/websocket`)
      
      testConnection.on('open', () => {
        testConnection.close()
        resolve()
      })

      testConnection.on('error', (error) => {
        reject(new Error(`WebSocket server not available: ${error.message}`))
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        testConnection.terminate()
        reject(new Error('WebSocket server connection timeout'))
      }, 5000)
    })
  }

  async establishConnection(connectionId: string): Promise<ConnectionLatencyMetrics> {
    const startTime = performance.now()
    
    return new Promise((resolve, reject) => {
      const connection = new WebSocket(`${this.baseUrl}/api/websocket`)
      let firstMessageReceived = false
      let firstMessageTime = 0
      const messageLatencies: number[] = []

      connection.on('open', () => {
        const connectionTime = performance.now() - startTime
        this.connections.set(connectionId, connection)
        
        // Send test message to measure first response time
        const testMessage = {
          type: 'ping',
          timestamp: performance.now(),
          data: 'performance-test'
        }
        
        connection.send(JSON.stringify(testMessage))
      })

      connection.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString())
          const receiveTime = performance.now()
          
          if (message.timestamp) {
            const latency = receiveTime - message.timestamp
            messageLatencies.push(latency)
            
            if (!firstMessageReceived) {
              firstMessageReceived = true
              firstMessageTime = receiveTime - startTime
            }
          }

          // After receiving response, calculate metrics
          if (message.type === 'pong' && firstMessageReceived) {
            const connectionTime = performance.now() - startTime
            
            resolve({
              connectionTime,
              firstMessageTime,
              averageMessageLatency: messageLatencies.reduce((sum, lat) => sum + lat, 0) / messageLatencies.length,
              maxMessageLatency: Math.max(...messageLatencies),
              jitter: this.calculateJitter(messageLatencies)
            })
          }
        } catch (error) {
          // Ignore malformed messages
        }
      })

      connection.on('error', (error) => {
        reject(error)
      })

      connection.on('close', () => {
        this.connections.delete(connectionId)
      })

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!firstMessageReceived) {
          connection.terminate()
          reject(new Error('Connection timeout'))
        }
      }, 10000)
    })
  }

  private calculateJitter(latencies: number[]): number {
    if (latencies.length < 2) return 0
    
    const variations = latencies.slice(1).map((lat, i) => Math.abs(lat - latencies[i]))
    return variations.reduce((sum, variation) => sum + variation, 0) / variations.length
  }

  async runConnectionStressTest(
    concurrentConnections: number,
    duration: number
  ): Promise<WebSocketPerformanceMetrics> {
    const testName = `Connection Stress Test (${concurrentConnections} connections)`
    const startTime = performance.now()
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024
    let peakMemory = initialMemory

    // Monitor memory usage
    const memoryMonitor = setInterval(() => {
      const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024
      if (currentMemory > peakMemory) {
        peakMemory = currentMemory
      }
    }, 1000)

    let connectionsEstablished = 0
    let connectionFailures = 0
    let totalMessagesSent = 0
    let totalMessagesReceived = 0
    const latencies: number[] = []

    // Establish connections
    const connectionPromises = Array.from({ length: concurrentConnections }, async (_, i) => {
      const connectionId = `stress-test-${i}`
      
      try {
        const connectionMetrics = await this.establishConnection(connectionId)
        connectionsEstablished++
        latencies.push(connectionMetrics.averageMessageLatency)
        return connectionMetrics
      } catch (error) {
        connectionFailures++
        return null
      }
    })

    // Wait for all connections to establish (or fail)
    const connectionResults = await Promise.allSettled(connectionPromises)

    // Run test for specified duration
    const testEndTime = startTime + duration
    
    while (performance.now() < testEndTime) {
      // Send messages through all active connections
      for (const [id, connection] of this.connections) {
        if (connection.readyState === WebSocket.OPEN) {
          const message = {
            type: 'market_data',
            timestamp: performance.now(),
            data: {
              symbol: 'BTCUSDT',
              price: 50000 + Math.random() * 1000,
              volume: Math.random() * 1000
            }
          }
          
          connection.send(JSON.stringify(message))
          totalMessagesSent++
        }
      }

      // Wait before next batch
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Close all connections
    for (const [id, connection] of this.connections) {
      if (connection.readyState === WebSocket.OPEN) {
        connection.close()
      }
    }

    clearInterval(memoryMonitor)
    const endTime = performance.now()
    const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024

    const result: WebSocketPerformanceMetrics = {
      testName,
      duration: endTime - startTime,
      connectionsEstablished,
      totalMessagesSent,
      totalMessagesReceived,
      averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
      minLatency: Math.min(...latencies),
      maxLatency: Math.max(...latencies),
      messagesThroughput: totalMessagesSent / ((endTime - startTime) / 1000),
      connectionSuccess: connectionsEstablished,
      connectionFailures,
      reconnectionAttempts: 0,
      dataTransferRate: (totalMessagesSent * 100) / 1024 / 1024 / ((endTime - startTime) / 1000), // Assume ~100 bytes per message
      memoryUsage: {
        initial: initialMemory,
        peak: peakMemory,
        final: finalMemory
      }
    }

    this.results.push(result)
    return result
  }

  async runThroughputTest(
    connectionCount: number,
    messagesPerSecond: number,
    duration: number
  ): Promise<ThroughputTestResult> {
    const connections: WebSocket[] = []
    const messagesSent: number[] = []
    const messagesReceived: number[] = []
    const startTime = performance.now()

    // Establish connections
    for (let i = 0; i < connectionCount; i++) {
      try {
        const connection = await this.createConnection()
        connections.push(connection)
        
        connection.on('message', () => {
          messagesReceived.push(performance.now())
        })
      } catch (error) {
        console.warn(`Failed to establish connection ${i}:`, error)
      }
    }

    // Send messages at specified rate
    const messageInterval = 1000 / messagesPerSecond
    const endTime = startTime + duration
    
    let intervalId: NodeJS.Timeout | null = null
    
    await new Promise<void>((resolve) => {
      intervalId = setInterval(() => {
        if (performance.now() >= endTime) {
          clearInterval(intervalId!)
          resolve()
          return
        }

        // Send message through random connection
        const connection = connections[Math.floor(Math.random() * connections.length)]
        if (connection && connection.readyState === WebSocket.OPEN) {
          const message = {
            type: 'throughput_test',
            timestamp: performance.now(),
            data: 'x'.repeat(100) // 100 byte message
          }
          
          connection.send(JSON.stringify(message))
          messagesSent.push(performance.now())
        }
      }, messageInterval)
    })

    // Close connections
    connections.forEach(connection => {
      if (connection.readyState === WebSocket.OPEN) {
        connection.close()
      }
    })

    // Calculate throughput metrics
    const totalDuration = (endTime - startTime) / 1000
    const actualMessagesSent = messagesSent.length
    const actualMessagesReceived = messagesReceived.length
    const dropRate = ((actualMessagesSent - actualMessagesReceived) / actualMessagesSent) * 100

    // Calculate peak throughput (messages per second in 1-second windows)
    const throughputWindows = this.calculateThroughputWindows(messagesSent, 1000)
    const peakThroughput = Math.max(...throughputWindows)
    const sustainedThroughput = throughputWindows.reduce((sum, tp) => sum + tp, 0) / throughputWindows.length

    return {
      messagesPerSecond: actualMessagesSent / totalDuration,
      bytesPerSecond: (actualMessagesSent * 100) / totalDuration,
      peakThroughput,
      sustainedThroughput,
      dropRate
    }
  }

  private calculateThroughputWindows(timestamps: number[], windowSize: number): number[] {
    if (timestamps.length === 0) return []
    
    const windows: number[] = []
    const startTime = timestamps[0]
    const endTime = timestamps[timestamps.length - 1]
    
    for (let windowStart = startTime; windowStart < endTime; windowStart += windowSize) {
      const windowEnd = windowStart + windowSize
      const messagesInWindow = timestamps.filter(ts => ts >= windowStart && ts < windowEnd).length
      windows.push(messagesInWindow)
    }
    
    return windows
  }

  private async createConnection(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const connection = new WebSocket(`${this.baseUrl}/api/websocket`)
      
      connection.on('open', () => {
        resolve(connection)
      })

      connection.on('error', (error) => {
        reject(error)
      })

      // Timeout after 5 seconds
      setTimeout(() => {
        connection.terminate()
        reject(new Error('Connection timeout'))
      }, 5000)
    })
  }

  async runLatencyTest(connectionCount: number, messageCount: number): Promise<{
    averageLatency: number
    p50Latency: number
    p95Latency: number
    p99Latency: number
    maxLatency: number
    jitter: number
  }> {
    const connections: WebSocket[] = []
    const latencies: number[] = []

    // Establish connections
    for (let i = 0; i < connectionCount; i++) {
      try {
        const connection = await this.createConnection()
        connections.push(connection)
        
        connection.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString())
            if (message.timestamp) {
              const latency = performance.now() - message.timestamp
              latencies.push(latency)
            }
          } catch (error) {
            // Ignore malformed messages
          }
        })
      } catch (error) {
        console.warn(`Failed to establish connection ${i}:`, error)
      }
    }

    // Send messages and measure latency
    for (let i = 0; i < messageCount; i++) {
      const connection = connections[i % connections.length]
      if (connection && connection.readyState === WebSocket.OPEN) {
        const message = {
          type: 'latency_test',
          timestamp: performance.now(),
          sequence: i
        }
        
        connection.send(JSON.stringify(message))
      }
      
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Wait for all responses
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Close connections
    connections.forEach(connection => {
      if (connection.readyState === WebSocket.OPEN) {
        connection.close()
      }
    })

    // Calculate latency statistics
    const sortedLatencies = latencies.sort((a, b) => a - b)
    const p50Index = Math.floor(sortedLatencies.length * 0.5)
    const p95Index = Math.floor(sortedLatencies.length * 0.95)
    const p99Index = Math.floor(sortedLatencies.length * 0.99)

    return {
      averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
      p50Latency: sortedLatencies[p50Index] || 0,
      p95Latency: sortedLatencies[p95Index] || 0,
      p99Latency: sortedLatencies[p99Index] || 0,
      maxLatency: Math.max(...latencies),
      jitter: this.calculateJitter(latencies)
    }
  }

  getResults(): WebSocketPerformanceMetrics[] {
    return this.results
  }

  generateReport(): string {
    const report = [
      '=== WEBSOCKET PERFORMANCE TEST REPORT ===',
      `Total Tests: ${this.results.length}`,
      `Test Date: ${new Date().toISOString()}`,
      '',
      'Performance Metrics:',
      '─'.repeat(80)
    ]

    this.results.forEach((result, index) => {
      report.push(`${index + 1}. ${result.testName}`)
      report.push(`   Duration: ${result.duration.toFixed(2)}ms`)
      report.push(`   Connections: ${result.connectionsEstablished} (${result.connectionFailures} failures)`)
      report.push(`   Messages: ${result.totalMessagesSent} sent, ${result.totalMessagesReceived} received`)
      report.push(`   Throughput: ${result.messagesThroughput.toFixed(2)} messages/sec`)
      report.push(`   Latency: ${result.averageLatency.toFixed(2)}ms avg (${result.minLatency.toFixed(2)}-${result.maxLatency.toFixed(2)}ms)`)
      report.push(`   Data Transfer: ${result.dataTransferRate.toFixed(2)} MB/s`)
      report.push(`   Memory Usage: ${result.memoryUsage.initial.toFixed(2)}MB → ${result.memoryUsage.final.toFixed(2)}MB (Peak: ${result.memoryUsage.peak.toFixed(2)}MB)`)
      report.push('')
    })

    return report.join('\n')
  }
}

// Test Suite Implementation
describe('WebSocket Performance Tests', () => {
  let testSuite: WebSocketPerformanceTestSuite

  beforeAll(async () => {
    testSuite = new WebSocketPerformanceTestSuite()
    await testSuite.setup()
  })

  afterAll(async () => {
    await testSuite.teardown()
  })

  it('should establish single connection within performance threshold', async () => {
    const connectionMetrics = await testSuite.establishConnection('single-connection-test')
    
    expect(connectionMetrics.connectionTime).toBeLessThan(1000) // Connect within 1 second
    expect(connectionMetrics.firstMessageTime).toBeLessThan(1500) // First message within 1.5 seconds
    expect(connectionMetrics.averageMessageLatency).toBeLessThan(50) // Average latency < 50ms
    expect(connectionMetrics.jitter).toBeLessThan(10) // Jitter < 10ms
  })

  it('should handle moderate concurrent connections', async () => {
    const result = await testSuite.runConnectionStressTest(10, 5000) // 10 connections for 5 seconds
    
    expect(result.connectionsEstablished).toBeGreaterThanOrEqual(8) // At least 80% success rate
    expect(result.connectionFailures).toBeLessThan(3) // Less than 30% failures
    expect(result.averageLatency).toBeLessThan(100) // Average latency < 100ms
    expect(result.messagesThroughput).toBeGreaterThan(50) // At least 50 messages/sec
  })

  it('should handle high-load concurrent connections', async () => {
    const result = await testSuite.runConnectionStressTest(50, 10000) // 50 connections for 10 seconds
    
    expect(result.connectionsEstablished).toBeGreaterThanOrEqual(40) // At least 80% success rate
    expect(result.averageLatency).toBeLessThan(200) // Average latency < 200ms under load
    expect(result.messagesThroughput).toBeGreaterThan(100) // At least 100 messages/sec
    expect(result.memoryUsage.peak - result.memoryUsage.initial).toBeLessThan(200) // Memory growth < 200MB
  })

  it('should maintain throughput under sustained load', async () => {
    const throughputResult = await testSuite.runThroughputTest(
      20, // 20 connections
      1000, // 1000 messages per second
      30000 // 30 seconds
    )
    
    expect(throughputResult.messagesPerSecond).toBeGreaterThanOrEqual(900) // At least 90% of target
    expect(throughputResult.dropRate).toBeLessThan(5) // Less than 5% drop rate
    expect(throughputResult.sustainedThroughput).toBeGreaterThan(800) // Sustained throughput > 800 msg/sec
  })

  it('should maintain low latency under various loads', async () => {
    const latencyResult = await testSuite.runLatencyTest(10, 1000)
    
    expect(latencyResult.averageLatency).toBeLessThan(50) // Average < 50ms
    expect(latencyResult.p95Latency).toBeLessThan(100) // 95th percentile < 100ms
    expect(latencyResult.p99Latency).toBeLessThan(200) // 99th percentile < 200ms
    expect(latencyResult.jitter).toBeLessThan(20) // Jitter < 20ms
  })

  it('should handle WebSocket reconnection scenarios', async () => {
    // Test connection resilience and reconnection
    const connectionId = 'reconnection-test'
    
    // Establish initial connection
    const initialMetrics = await testSuite.establishConnection(connectionId)
    expect(initialMetrics.connectionTime).toBeLessThan(1000)
    
    // Simulate connection drop and reconnection
    const connection = testSuite.connections.get(connectionId)
    if (connection) {
      connection.terminate() // Force disconnect
    }
    
    // Wait and reconnect
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const reconnectionMetrics = await testSuite.establishConnection(connectionId + '-reconnect')
    expect(reconnectionMetrics.connectionTime).toBeLessThan(1000) // Reconnect within 1 second
  })

  it('should validate real-time market data streaming performance', async () => {
    // Test real-time market data streaming performance
    const streamingResult = await testSuite.runThroughputTest(
      5, // 5 connections
      500, // 500 market updates per second
      15000 // 15 seconds
    )
    
    expect(streamingResult.messagesPerSecond).toBeGreaterThanOrEqual(450) // At least 90% of target
    expect(streamingResult.dropRate).toBeLessThan(2) // Less than 2% drop rate for market data
    expect(streamingResult.peakThroughput).toBeGreaterThan(400) // Peak throughput > 400 msg/sec
  })

  it('should generate comprehensive performance report', () => {
    const report = testSuite.generateReport()
    
    expect(report).toContain('WEBSOCKET PERFORMANCE TEST REPORT')
    expect(report).toContain('Total Tests:')
    expect(report).toContain('Connections:')
    expect(report).toContain('Throughput:')
    expect(report).toContain('Latency:')
    
    console.log('\n' + report)
  })
})

// Export for use in other test files
export { WebSocketPerformanceTestSuite, type WebSocketPerformanceMetrics, type ThroughputTestResult, type ConnectionLatencyMetrics }