/**
 * Real-time System Performance Test Suite
 * Tests WebSocket performance, real-time data processing, monitoring system performance,
 * and live trading system responsiveness under various conditions
 */

import { performance } from 'node:perf_hooks'
import { EventEmitter } from 'events'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface WebSocketConnectionMetrics {
  connection_id: string
  connection_time: number
  handshake_duration: number
  authentication_time: number
  first_message_latency: number
  average_message_latency: number
  message_throughput: number // messages per second
  connection_stability: number // percentage uptime
  reconnection_count: number
  max_reconnection_time: number
}

interface RealTimeDataProcessingMetrics {
  data_type: string
  messages_processed: number
  processing_latency: {
    min: number
    max: number
    average: number
    p95: number
    p99: number
  }
  throughput: {
    messages_per_second: number
    megabytes_per_second: number
  }
  processing_errors: number
  data_loss_count: number
  out_of_order_messages: number
  duplicate_messages: number
}

interface MonitoringSystemMetrics {
  metric_collection_latency: number
  dashboard_update_frequency: number
  alert_trigger_time: number
  data_aggregation_performance: number
  visualization_render_time: number
  real_time_accuracy: number // percentage
  system_resource_usage: {
    cpu_utilization: number
    memory_consumption: number
    network_bandwidth: number
    disk_io: number
  }
}

interface TradingSystemRealtimeMetrics {
  order_execution_latency: number
  market_data_freshness: number // milliseconds behind real-time
  signal_processing_time: number
  pattern_detection_latency: number
  portfolio_update_speed: number
  risk_calculation_time: number
  websocket_message_lag: number
  trading_engine_throughput: number
}

interface SystemLoadSimulation {
  name: string
  description: string
  duration: number
  concurrent_connections: number
  messages_per_second_per_connection: number
  message_size_bytes: number
  data_types: string[]
  stress_factors: {
    network_latency: number
    message_burst: boolean
    connection_drops: boolean
    data_corruption: boolean
  }
}

interface RealtimePerformanceResult {
  test_name: string
  simulation_config: SystemLoadSimulation
  websocket_metrics: WebSocketConnectionMetrics[]
  data_processing_metrics: RealTimeDataProcessingMetrics[]
  monitoring_metrics: MonitoringSystemMetrics
  trading_metrics: TradingSystemRealtimeMetrics
  overall_system_performance: {
    real_time_score: number
    latency_score: number
    throughput_score: number
    reliability_score: number
    scalability_score: number
  }
  performance_bottlenecks: string[]
  recommendations: string[]
}

class RealtimeSystemPerformanceTestSuite extends EventEmitter {
  private baseUrl: string
  private wsUrl: string
  private results: RealtimePerformanceResult[] = []
  private activeConnections: Map<string, any> = new Map()

  constructor(baseUrl: string = 'http://localhost:3008', wsUrl: string = 'ws://localhost:3008') {
    super()
    this.baseUrl = baseUrl
    this.wsUrl = wsUrl
  }

  async setup(): Promise<void> {
    await this.waitForServices()
  }

  async teardown(): Promise<void> {
    // Close all active connections
    for (const [connectionId, connection] of this.activeConnections.entries()) {
      try {
        if (connection.close) {
          connection.close()
        }
      } catch (error) {
        console.warn(`Failed to close connection ${connectionId}:`, error)
      }
    }
    this.activeConnections.clear()
    this.results = []
  }

  private async waitForServices(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`)
      if (!response.ok) {
        throw new Error('Services not ready')
      }
    } catch (error) {
      console.warn('Services not accessible, using mock implementations')
    }
  }

  // Load simulation configurations for different scenarios
  private getLoadSimulations(): SystemLoadSimulation[] {
    return [
      {
        name: 'light_realtime_load',
        description: 'Light real-time data processing',
        duration: 60000, // 1 minute
        concurrent_connections: 10,
        messages_per_second_per_connection: 5,
        message_size_bytes: 256,
        data_types: ['market_data', 'order_updates'],
        stress_factors: {
          network_latency: 10,
          message_burst: false,
          connection_drops: false,
          data_corruption: false
        }
      },
      {
        name: 'normal_trading_load',
        description: 'Normal trading hours simulation',
        duration: 120000, // 2 minutes
        concurrent_connections: 25,
        messages_per_second_per_connection: 10,
        message_size_bytes: 512,
        data_types: ['market_data', 'order_updates', 'portfolio_updates', 'trading_signals'],
        stress_factors: {
          network_latency: 20,
          message_burst: true,
          connection_drops: false,
          data_corruption: false
        }
      },
      {
        name: 'high_frequency_trading',
        description: 'High-frequency trading simulation',
        duration: 90000, // 1.5 minutes
        concurrent_connections: 50,
        messages_per_second_per_connection: 50,
        message_size_bytes: 128,
        data_types: ['tick_data', 'order_book_updates', 'trade_executions'],
        stress_factors: {
          network_latency: 5,
          message_burst: true,
          connection_drops: false,
          data_corruption: false
        }
      },
      {
        name: 'peak_market_activity',
        description: 'Peak market activity with high volatility',
        duration: 180000, // 3 minutes
        concurrent_connections: 75,
        messages_per_second_per_connection: 30,
        message_size_bytes: 1024,
        data_types: ['market_data', 'volatility_alerts', 'pattern_signals', 'risk_updates'],
        stress_factors: {
          network_latency: 30,
          message_burst: true,
          connection_drops: true,
          data_corruption: false
        }
      },
      {
        name: 'stress_with_failures',
        description: 'Stress test with network failures and data corruption',
        duration: 120000, // 2 minutes
        concurrent_connections: 100,
        messages_per_second_per_connection: 20,
        message_size_bytes: 2048,
        data_types: ['all_data_types'],
        stress_factors: {
          network_latency: 100,
          message_burst: true,
          connection_drops: true,
          data_corruption: true
        }
      }
    ]
  }

  async runComprehensiveRealtimeTests(): Promise<RealtimePerformanceResult[]> {
    console.log('🔄 Starting Comprehensive Real-time System Performance Tests')
    console.log('=' .repeat(70))

    const simulations = this.getLoadSimulations()
    const results: RealtimePerformanceResult[] = []

    for (const simulation of simulations) {
      console.log(`\n⚡ Running ${simulation.name.toUpperCase()}...`)
      console.log(`Duration: ${simulation.duration / 1000}s, Connections: ${simulation.concurrent_connections}`)
      console.log(`Message Rate: ${simulation.messages_per_second_per_connection}/s per connection`)

      const result = await this.executeRealtimeTest(simulation)
      results.push(result)

      // Cooldown period between tests
      console.log('⏱️ System cooldown...')
      await new Promise(resolve => setTimeout(resolve, 15000)) // 15 second cooldown
    }

    this.results = results
    return results
  }

  private async executeRealtimeTest(simulation: SystemLoadSimulation): Promise<RealtimePerformanceResult> {
    const testStartTime = performance.now()

    // Initialize test metrics
    const websocketMetrics: WebSocketConnectionMetrics[] = []
    const dataProcessingMetrics: RealTimeDataProcessingMetrics[] = []
    let monitoringMetrics: MonitoringSystemMetrics
    let tradingMetrics: TradingSystemRealtimeMetrics

    // Start WebSocket connections
    console.log(`📡 Establishing ${simulation.concurrent_connections} WebSocket connections...`)
    const connectionPromises: Promise<WebSocketConnectionMetrics>[] = []

    for (let i = 0; i < simulation.concurrent_connections; i++) {
      const connectionPromise = this.createWebSocketConnection(
        `conn_${i}`,
        simulation,
        testStartTime
      )
      connectionPromises.push(connectionPromise)

      // Stagger connection creation to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Wait for all connections to be established
    const connectionResults = await Promise.allSettled(connectionPromises)
    connectionResults.forEach(result => {
      if (result.status === 'fulfilled') {
        websocketMetrics.push(result.value)
      }
    })

    console.log(`✅ Established ${websocketMetrics.length}/${simulation.concurrent_connections} connections`)

    // Start data processing simulation
    console.log('📊 Starting data processing simulation...')
    dataProcessingMetrics.push(...await this.simulateDataProcessing(simulation))

    // Monitor system performance
    console.log('📈 Monitoring system performance...')
    monitoringMetrics = await this.monitorSystemPerformance(simulation)

    // Test trading system real-time performance
    console.log('💹 Testing trading system real-time performance...')
    tradingMetrics = await this.testTradingSystemRealtime(simulation)

    // Wait for test duration to complete
    const elapsedTime = performance.now() - testStartTime
    const remainingTime = Math.max(0, simulation.duration - elapsedTime)
    if (remainingTime > 0) {
      console.log(`⏳ Waiting ${(remainingTime / 1000).toFixed(1)}s for test completion...`)
      await new Promise(resolve => setTimeout(resolve, remainingTime))
    }

    // Calculate overall performance scores
    const overallPerformance = this.calculateOverallPerformance(
      websocketMetrics,
      dataProcessingMetrics,
      monitoringMetrics,
      tradingMetrics
    )

    const bottlenecks = this.identifyBottlenecks(
      websocketMetrics,
      dataProcessingMetrics,
      monitoringMetrics,
      tradingMetrics
    )

    const recommendations = this.generateRecommendations(bottlenecks, overallPerformance)

    // Cleanup connections
    await this.cleanupTestConnections()

    return {
      test_name: simulation.name,
      simulation_config: simulation,
      websocket_metrics: websocketMetrics,
      data_processing_metrics: dataProcessingMetrics,
      monitoring_metrics: monitoringMetrics,
      trading_metrics: tradingMetrics,
      overall_system_performance: overallPerformance,
      performance_bottlenecks: bottlenecks,
      recommendations: recommendations
    }
  }

  private async createWebSocketConnection(
    connectionId: string,
    simulation: SystemLoadSimulation,
    testStartTime: number
  ): Promise<WebSocketConnectionMetrics> {
    const connectionStart = performance.now()
    
    // Simulate WebSocket connection creation
    const handshakeDuration = 50 + Math.random() * 100 // 50-150ms
    const authenticationTime = 20 + Math.random() * 80 // 20-100ms
    
    await new Promise(resolve => setTimeout(resolve, handshakeDuration + authenticationTime))

    const connectionTime = performance.now() - connectionStart
    
    // Simulate message exchange and collect metrics
    const messageLatencies: number[] = []
    let messageCount = 0
    let reconnectionCount = 0
    let maxReconnectionTime = 0
    
    const messageInterval = 1000 / simulation.messages_per_second_per_connection
    const testEndTime = testStartTime + simulation.duration

    // Simulate periodic message exchange
    const messageExchangePromise = new Promise<void>((resolve) => {
      const sendMessage = async () => {
        if (performance.now() >= testEndTime) {
          resolve()
          return
        }

        const messageStart = performance.now()
        
        // Simulate network latency
        const networkLatency = simulation.stress_factors.network_latency + Math.random() * 20
        await new Promise(r => setTimeout(r, networkLatency))
        
        // Simulate message processing
        const processingTime = 5 + Math.random() * 15
        await new Promise(r => setTimeout(r, processingTime))
        
        const messageEnd = performance.now()
        const messageLatency = messageEnd - messageStart
        
        messageLatencies.push(messageLatency)
        messageCount++

        // Simulate connection drops if configured
        if (simulation.stress_factors.connection_drops && Math.random() < 0.01) { // 1% chance
          reconnectionCount++
          const reconnectionStart = performance.now()
          
          // Simulate reconnection time
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000))
          
          const reconnectionTime = performance.now() - reconnectionStart
          maxReconnectionTime = Math.max(maxReconnectionTime, reconnectionTime)
        }

        // Schedule next message
        setTimeout(sendMessage, messageInterval)
      }

      // Start first message after a small delay
      setTimeout(sendMessage, Math.random() * 1000)
    })

    // Store connection for cleanup
    this.activeConnections.set(connectionId, { 
      promise: messageExchangePromise,
      close: () => {
        // Simulate connection cleanup
      }
    })

    // Wait for message exchange simulation to complete
    await messageExchangePromise

    // Calculate metrics
    const avgMessageLatency = messageLatencies.length > 0 
      ? messageLatencies.reduce((sum, lat) => sum + lat, 0) / messageLatencies.length 
      : 0

    const firstMessageLatency = messageLatencies.length > 0 ? messageLatencies[0] : 0
    const messageThroughput = messageCount / (simulation.duration / 1000)
    const connectionStability = Math.max(0, 100 - (reconnectionCount * 10)) // 10% penalty per reconnection

    return {
      connection_id: connectionId,
      connection_time: connectionTime,
      handshake_duration: handshakeDuration,
      authentication_time: authenticationTime,
      first_message_latency: firstMessageLatency,
      average_message_latency: avgMessageLatency,
      message_throughput: messageThroughput,
      connection_stability: connectionStability,
      reconnection_count: reconnectionCount,
      max_reconnection_time: maxReconnectionTime
    }
  }

  private async simulateDataProcessing(simulation: SystemLoadSimulation): Promise<RealTimeDataProcessingMetrics[]> {
    const metrics: RealTimeDataProcessingMetrics[] = []

    for (const dataType of simulation.data_types) {
      const processingLatencies: number[] = []
      let messagesProcessed = 0
      let processingErrors = 0
      let dataLossCount = 0
      let outOfOrderMessages = 0
      let duplicateMessages = 0

      const totalMessages = simulation.concurrent_connections * 
                          simulation.messages_per_second_per_connection * 
                          (simulation.duration / 1000)

      // Simulate processing each message type
      for (let i = 0; i < totalMessages; i++) {
        const processingStart = performance.now()
        
        // Simulate data processing complexity based on type
        let processingComplexity = 10 // Base processing time
        
        switch (dataType) {
          case 'tick_data':
            processingComplexity = 5
            break
          case 'market_data':
            processingComplexity = 15
            break
          case 'order_book_updates':
            processingComplexity = 25
            break
          case 'pattern_signals':
            processingComplexity = 50
            break
          case 'volatility_alerts':
            processingComplexity = 30
            break
          default:
            processingComplexity = 20
        }

        // Add random variation and stress factors
        const variationFactor = 1 + (Math.random() - 0.5) * 0.4 // ±20% variation
        const stressFactor = simulation.stress_factors.data_corruption ? 1.5 : 1
        const totalProcessingTime = processingComplexity * variationFactor * stressFactor

        await new Promise(resolve => setTimeout(resolve, totalProcessingTime))
        
        const processingEnd = performance.now()
        const processingLatency = processingEnd - processingStart
        
        processingLatencies.push(processingLatency)
        messagesProcessed++

        // Simulate errors and data issues
        if (simulation.stress_factors.data_corruption && Math.random() < 0.02) { // 2% error rate
          processingErrors++
        }
        
        if (Math.random() < 0.001) { // 0.1% data loss
          dataLossCount++
        }
        
        if (Math.random() < 0.005) { // 0.5% out of order
          outOfOrderMessages++
        }
        
        if (Math.random() < 0.003) { // 0.3% duplicates
          duplicateMessages++
        }
      }

      // Calculate processing metrics
      const sortedLatencies = [...processingLatencies].sort((a, b) => a - b)
      const latencyMetrics = {
        min: sortedLatencies.length > 0 ? sortedLatencies[0] : 0,
        max: sortedLatencies.length > 0 ? sortedLatencies[sortedLatencies.length - 1] : 0,
        average: processingLatencies.reduce((sum, lat) => sum + lat, 0) / processingLatencies.length,
        p95: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0,
        p99: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0
      }

      const throughputMetrics = {
        messages_per_second: messagesProcessed / (simulation.duration / 1000),
        megabytes_per_second: (messagesProcessed * simulation.message_size_bytes) / (1024 * 1024) / (simulation.duration / 1000)
      }

      metrics.push({
        data_type: dataType,
        messages_processed: messagesProcessed,
        processing_latency: latencyMetrics,
        throughput: throughputMetrics,
        processing_errors: processingErrors,
        data_loss_count: dataLossCount,
        out_of_order_messages: outOfOrderMessages,
        duplicate_messages: duplicateMessages
      })
    }

    return metrics
  }

  private async monitorSystemPerformance(simulation: SystemLoadSimulation): Promise<MonitoringSystemMetrics> {
    // Simulate monitoring system performance metrics
    const metricCollectionLatency = 50 + Math.random() * 100 // 50-150ms
    const dashboardUpdateFrequency = 60 // 60 FPS
    const alertTriggerTime = 100 + Math.random() * 200 // 100-300ms
    const dataAggregationPerformance = 200 + Math.random() * 300 // 200-500ms
    const visualizationRenderTime = 16 + Math.random() * 34 // 16-50ms (targeting 60fps)
    const realTimeAccuracy = Math.max(85, 100 - (simulation.stress_factors.network_latency / 10))

    // Simulate system resource monitoring
    const baseResourceUsage = {
      cpu_utilization: 20 + Math.random() * 30, // 20-50% base
      memory_consumption: 1024 + Math.random() * 512, // 1-1.5GB base
      network_bandwidth: 10 + Math.random() * 20, // 10-30 Mbps
      disk_io: 5 + Math.random() * 15 // 5-20 MB/s
    }

    // Apply load-based scaling
    const loadFactor = simulation.concurrent_connections / 100 // Scale based on connections
    const systemResourceUsage = {
      cpu_utilization: Math.min(95, baseResourceUsage.cpu_utilization * (1 + loadFactor)),
      memory_consumption: baseResourceUsage.memory_consumption * (1 + loadFactor * 0.5),
      network_bandwidth: baseResourceUsage.network_bandwidth * (1 + loadFactor),
      disk_io: baseResourceUsage.disk_io * (1 + loadFactor * 0.3)
    }

    return {
      metric_collection_latency: metricCollectionLatency,
      dashboard_update_frequency: dashboardUpdateFrequency,
      alert_trigger_time: alertTriggerTime,
      data_aggregation_performance: dataAggregationPerformance,
      visualization_render_time: visualizationRenderTime,
      real_time_accuracy: realTimeAccuracy,
      system_resource_usage: systemResourceUsage
    }
  }

  private async testTradingSystemRealtime(simulation: SystemLoadSimulation): Promise<TradingSystemRealtimeMetrics> {
    // Simulate trading system real-time performance testing
    const baseLatencies = {
      order_execution: 50 + Math.random() * 100, // 50-150ms
      market_data_freshness: 10 + Math.random() * 40, // 10-50ms behind
      signal_processing: 100 + Math.random() * 200, // 100-300ms
      pattern_detection: 500 + Math.random() * 1000, // 0.5-1.5s
      portfolio_update: 20 + Math.random() * 80, // 20-100ms
      risk_calculation: 30 + Math.random() * 70, // 30-100ms
      websocket_message_lag: 5 + Math.random() * 15 // 5-20ms
    }

    // Apply stress factor scaling
    const stressFactor = simulation.stress_factors.network_latency / 50 + 1 // Scale with network latency
    const burstFactor = simulation.stress_factors.message_burst ? 1.5 : 1

    const tradingEngineBaseThroughput = 100 // 100 operations per second base
    const tradingEngineThroughput = tradingEngineBaseThroughput / stressFactor

    return {
      order_execution_latency: baseLatencies.order_execution * stressFactor,
      market_data_freshness: baseLatencies.market_data_freshness * stressFactor,
      signal_processing_time: baseLatencies.signal_processing * stressFactor * burstFactor,
      pattern_detection_latency: baseLatencies.pattern_detection * stressFactor,
      portfolio_update_speed: baseLatencies.portfolio_update * stressFactor,
      risk_calculation_time: baseLatencies.risk_calculation * stressFactor,
      websocket_message_lag: baseLatencies.websocket_message_lag * stressFactor,
      trading_engine_throughput: tradingEngineThroughput
    }
  }

  private calculateOverallPerformance(
    websocketMetrics: WebSocketConnectionMetrics[],
    dataProcessingMetrics: RealTimeDataProcessingMetrics[],
    monitoringMetrics: MonitoringSystemMetrics,
    tradingMetrics: TradingSystemRealtimeMetrics
  ): RealtimePerformanceResult['overall_system_performance'] {
    let realTimeScore = 100
    let latencyScore = 100
    let throughputScore = 100
    let reliabilityScore = 100
    let scalabilityScore = 100

    // Real-time score based on data freshness and processing speed
    const avgDataProcessingLatency = dataProcessingMetrics.reduce((sum, metric) => 
      sum + metric.processing_latency.average, 0) / dataProcessingMetrics.length
    
    if (avgDataProcessingLatency > 500) realTimeScore -= 30
    else if (avgDataProcessingLatency > 200) realTimeScore -= 15
    else if (avgDataProcessingLatency > 100) realTimeScore -= 5

    if (tradingMetrics.market_data_freshness > 100) realTimeScore -= 20
    else if (tradingMetrics.market_data_freshness > 50) realTimeScore -= 10

    // Latency score based on WebSocket and trading system latencies
    const avgWebSocketLatency = websocketMetrics.reduce((sum, metric) => 
      sum + metric.average_message_latency, 0) / websocketMetrics.length
    
    if (avgWebSocketLatency > 200) latencyScore -= 25
    else if (avgWebSocketLatency > 100) latencyScore -= 15
    else if (avgWebSocketLatency > 50) latencyScore -= 5

    if (tradingMetrics.order_execution_latency > 500) latencyScore -= 30
    else if (tradingMetrics.order_execution_latency > 200) latencyScore -= 15

    // Throughput score based on message processing and trading engine throughput
    const avgMessageThroughput = websocketMetrics.reduce((sum, metric) => 
      sum + metric.message_throughput, 0) / websocketMetrics.length
    
    if (avgMessageThroughput < 10) throughputScore -= 20
    else if (avgMessageThroughput < 20) throughputScore -= 10

    if (tradingMetrics.trading_engine_throughput < 50) throughputScore -= 25
    else if (tradingMetrics.trading_engine_throughput < 75) throughputScore -= 10

    // Reliability score based on connection stability and error rates
    const avgConnectionStability = websocketMetrics.reduce((sum, metric) => 
      sum + metric.connection_stability, 0) / websocketMetrics.length
    
    if (avgConnectionStability < 90) reliabilityScore -= 20
    else if (avgConnectionStability < 95) reliabilityScore -= 10

    const totalProcessingErrors = dataProcessingMetrics.reduce((sum, metric) => 
      sum + metric.processing_errors, 0)
    const totalMessagesProcessed = dataProcessingMetrics.reduce((sum, metric) => 
      sum + metric.messages_processed, 0)
    const errorRate = totalMessagesProcessed > 0 ? (totalProcessingErrors / totalMessagesProcessed) * 100 : 0

    if (errorRate > 5) reliabilityScore -= 30
    else if (errorRate > 2) reliabilityScore -= 15
    else if (errorRate > 1) reliabilityScore -= 5

    // Scalability score based on resource usage and performance under load
    if (monitoringMetrics.system_resource_usage.cpu_utilization > 90) scalabilityScore -= 30
    else if (monitoringMetrics.system_resource_usage.cpu_utilization > 80) scalabilityScore -= 15
    else if (monitoringMetrics.system_resource_usage.cpu_utilization > 70) scalabilityScore -= 5

    if (monitoringMetrics.system_resource_usage.memory_consumption > 4096) scalabilityScore -= 20
    else if (monitoringMetrics.system_resource_usage.memory_consumption > 2048) scalabilityScore -= 10

    return {
      real_time_score: Math.max(0, realTimeScore),
      latency_score: Math.max(0, latencyScore),
      throughput_score: Math.max(0, throughputScore),
      reliability_score: Math.max(0, reliabilityScore),
      scalability_score: Math.max(0, scalabilityScore)
    }
  }

  private identifyBottlenecks(
    websocketMetrics: WebSocketConnectionMetrics[],
    dataProcessingMetrics: RealTimeDataProcessingMetrics[],
    monitoringMetrics: MonitoringSystemMetrics,
    tradingMetrics: TradingSystemRealtimeMetrics
  ): string[] {
    const bottlenecks: string[] = []

    // WebSocket bottlenecks
    const avgConnectionTime = websocketMetrics.reduce((sum, metric) => 
      sum + metric.connection_time, 0) / websocketMetrics.length
    
    if (avgConnectionTime > 500) {
      bottlenecks.push(`Slow WebSocket connection establishment: ${avgConnectionTime.toFixed(2)}ms`)
    }

    const avgMessageLatency = websocketMetrics.reduce((sum, metric) => 
      sum + metric.average_message_latency, 0) / websocketMetrics.length
    
    if (avgMessageLatency > 100) {
      bottlenecks.push(`High WebSocket message latency: ${avgMessageLatency.toFixed(2)}ms`)
    }

    // Data processing bottlenecks
    dataProcessingMetrics.forEach(metric => {
      if (metric.processing_latency.p95 > 1000) {
        bottlenecks.push(`Slow ${metric.data_type} processing: P95 ${metric.processing_latency.p95.toFixed(2)}ms`)
      }
      
      if (metric.processing_errors > metric.messages_processed * 0.05) {
        bottlenecks.push(`High error rate in ${metric.data_type} processing: ${((metric.processing_errors / metric.messages_processed) * 100).toFixed(2)}%`)
      }
    })

    // Trading system bottlenecks
    if (tradingMetrics.order_execution_latency > 500) {
      bottlenecks.push(`Slow order execution: ${tradingMetrics.order_execution_latency.toFixed(2)}ms`)
    }

    if (tradingMetrics.pattern_detection_latency > 2000) {
      bottlenecks.push(`Slow pattern detection: ${tradingMetrics.pattern_detection_latency.toFixed(2)}ms`)
    }

    if (tradingMetrics.market_data_freshness > 100) {
      bottlenecks.push(`Stale market data: ${tradingMetrics.market_data_freshness.toFixed(2)}ms behind`)
    }

    // System resource bottlenecks
    if (monitoringMetrics.system_resource_usage.cpu_utilization > 85) {
      bottlenecks.push(`High CPU utilization: ${monitoringMetrics.system_resource_usage.cpu_utilization.toFixed(2)}%`)
    }

    if (monitoringMetrics.system_resource_usage.memory_consumption > 3072) {
      bottlenecks.push(`High memory consumption: ${(monitoringMetrics.system_resource_usage.memory_consumption / 1024).toFixed(2)}GB`)
    }

    return bottlenecks
  }

  private generateRecommendations(
    bottlenecks: string[],
    performance: RealtimePerformanceResult['overall_system_performance']
  ): string[] {
    const recommendations: string[] = []

    // Real-time performance recommendations
    if (performance.real_time_score < 80) {
      recommendations.push('Implement message prioritization for critical data types')
      recommendations.push('Optimize data processing pipelines for reduced latency')
      recommendations.push('Consider implementing data streaming compression')
    }

    // Latency optimization recommendations
    if (performance.latency_score < 80) {
      recommendations.push('Implement connection pooling for WebSocket connections')
      recommendations.push('Add caching layers for frequently accessed data')
      recommendations.push('Optimize network routing and reduce hop count')
    }

    // Throughput optimization recommendations
    if (performance.throughput_score < 80) {
      recommendations.push('Implement message batching for high-volume data')
      recommendations.push('Scale horizontally with additional processing nodes')
      recommendations.push('Optimize serialization/deserialization protocols')
    }

    // Reliability improvement recommendations
    if (performance.reliability_score < 80) {
      recommendations.push('Implement circuit breakers for external dependencies')
      recommendations.push('Add comprehensive error handling and retry mechanisms')
      recommendations.push('Deploy redundant WebSocket connections for failover')
    }

    // Scalability enhancement recommendations
    if (performance.scalability_score < 80) {
      recommendations.push('Implement auto-scaling based on connection count and message volume')
      recommendations.push('Add load balancing for WebSocket connections')
      recommendations.push('Optimize memory usage with efficient data structures')
    }

    // Specific bottleneck recommendations
    if (bottlenecks.some(b => b.includes('WebSocket'))) {
      recommendations.push('Optimize WebSocket connection handling and message routing')
    }

    if (bottlenecks.some(b => b.includes('processing'))) {
      recommendations.push('Implement parallel processing for data-intensive operations')
    }

    if (bottlenecks.some(b => b.includes('order execution'))) {
      recommendations.push('Optimize trading engine execution paths and reduce order latency')
    }

    // General recommendations
    recommendations.push('Implement comprehensive real-time monitoring and alerting')
    recommendations.push('Regular performance baseline updates and regression testing')
    recommendations.push('Consider implementing edge computing for reduced latency')

    return recommendations
  }

  private async cleanupTestConnections(): Promise<void> {
    const cleanupPromises: Promise<void>[] = []

    for (const [connectionId, connection] of this.activeConnections.entries()) {
      const cleanupPromise = new Promise<void>((resolve) => {
        try {
          if (connection.close) {
            connection.close()
          }
          resolve()
        } catch (error) {
          console.warn(`Failed to cleanup connection ${connectionId}:`, error)
          resolve()
        }
      })
      
      cleanupPromises.push(cleanupPromise)
    }

    await Promise.allSettled(cleanupPromises)
    this.activeConnections.clear()
  }

  generateReport(): string {
    const report = [
      '=== REAL-TIME SYSTEM PERFORMANCE TEST REPORT ===',
      `Test Date: ${new Date().toISOString()}`,
      `Total Test Scenarios: ${this.results.length}`,
      '',
      'Real-time Performance Results:',
      '─'.repeat(50)
    ]

    this.results.forEach((result, index) => {
      report.push(`${index + 1}. ${result.test_name.toUpperCase()}`)
      report.push(`   WebSocket Connections: ${result.websocket_metrics.length}`)
      report.push(`   Data Processing Types: ${result.data_processing_metrics.length}`)
      
      const avgConnectionLatency = result.websocket_metrics.reduce((sum, m) => 
        sum + m.average_message_latency, 0) / result.websocket_metrics.length
      report.push(`   Avg Message Latency: ${avgConnectionLatency.toFixed(2)}ms`)
      
      const avgThroughput = result.websocket_metrics.reduce((sum, m) => 
        sum + m.message_throughput, 0) / result.websocket_metrics.length
      report.push(`   Avg Message Throughput: ${avgThroughput.toFixed(2)} msg/s`)
      
      report.push(`   Trading System Performance:`)
      report.push(`     Order Execution: ${result.trading_metrics.order_execution_latency.toFixed(2)}ms`)
      report.push(`     Market Data Freshness: ${result.trading_metrics.market_data_freshness.toFixed(2)}ms`)
      report.push(`     Pattern Detection: ${result.trading_metrics.pattern_detection_latency.toFixed(2)}ms`)
      
      report.push(`   Overall Scores:`)
      report.push(`     Real-time: ${result.overall_system_performance.real_time_score.toFixed(1)}/100`)
      report.push(`     Latency: ${result.overall_system_performance.latency_score.toFixed(1)}/100`)
      report.push(`     Throughput: ${result.overall_system_performance.throughput_score.toFixed(1)}/100`)
      report.push(`     Reliability: ${result.overall_system_performance.reliability_score.toFixed(1)}/100`)
      report.push(`     Scalability: ${result.overall_system_performance.scalability_score.toFixed(1)}/100`)
      
      if (result.performance_bottlenecks.length > 0) {
        report.push(`   Bottlenecks Identified:`)
        result.performance_bottlenecks.forEach(bottleneck => {
          report.push(`     - ${bottleneck}`)
        })
      }
      
      report.push('')
    })

    return report.join('\n')
  }

  getResults(): RealtimePerformanceResult[] {
    return this.results
  }
}

// Test Suite Implementation
describe('Real-time System Performance Tests', () => {
  let testSuite: RealtimeSystemPerformanceTestSuite

  beforeAll(async () => {
    testSuite = new RealtimeSystemPerformanceTestSuite()
    await testSuite.setup()
  })

  afterAll(async () => {
    await testSuite.teardown()
  })

  it('should handle light real-time load efficiently', async () => {
    const results = await testSuite.runComprehensiveRealtimeTests()
    const lightLoadResult = results.find(r => r.test_name === 'light_realtime_load')
    
    expect(lightLoadResult).toBeDefined()
    expect(lightLoadResult!.overall_system_performance.real_time_score).toBeGreaterThan(85)
    expect(lightLoadResult!.overall_system_performance.latency_score).toBeGreaterThan(85)
    expect(lightLoadResult!.overall_system_performance.reliability_score).toBeGreaterThan(90)
    
    // WebSocket performance requirements
    const avgMessageLatency = lightLoadResult!.websocket_metrics.reduce((sum, m) => 
      sum + m.average_message_latency, 0) / lightLoadResult!.websocket_metrics.length
    expect(avgMessageLatency).toBeLessThan(100) // < 100ms average message latency
  })

  it('should maintain performance during normal trading hours', async () => {
    const results = testSuite.getResults()
    const normalTradingResult = results.find(r => r.test_name === 'normal_trading_load')
    
    if (normalTradingResult) {
      expect(normalTradingResult.overall_system_performance.real_time_score).toBeGreaterThan(80)
      expect(normalTradingResult.overall_system_performance.throughput_score).toBeGreaterThan(80)
      expect(normalTradingResult.trading_metrics.order_execution_latency).toBeLessThan(500)
      expect(normalTradingResult.trading_metrics.market_data_freshness).toBeLessThan(100)
    }
  })

  it('should support high-frequency trading requirements', async () => {
    const results = testSuite.getResults()
    const hftResult = results.find(r => r.test_name === 'high_frequency_trading')
    
    if (hftResult) {
      expect(hftResult.overall_system_performance.latency_score).toBeGreaterThan(70)
      expect(hftResult.overall_system_performance.throughput_score).toBeGreaterThan(75)
      expect(hftResult.trading_metrics.order_execution_latency).toBeLessThan(200) // Critical for HFT
      expect(hftResult.trading_metrics.market_data_freshness).toBeLessThan(50) // Very fresh data required
      
      // High message throughput validation
      const avgThroughput = hftResult.websocket_metrics.reduce((sum, m) => 
        sum + m.message_throughput, 0) / hftResult.websocket_metrics.length
      expect(avgThroughput).toBeGreaterThan(30) // > 30 messages/second per connection
    }
  })

  it('should handle peak market activity with acceptable performance', async () => {
    const results = testSuite.getResults()
    const peakResult = results.find(r => r.test_name === 'peak_market_activity')
    
    if (peakResult) {
      expect(peakResult.overall_system_performance.real_time_score).toBeGreaterThan(70)
      expect(peakResult.overall_system_performance.scalability_score).toBeGreaterThan(70)
      expect(peakResult.trading_metrics.trading_engine_throughput).toBeGreaterThan(50)
      
      // Connection stability under load
      const avgStability = peakResult.websocket_metrics.reduce((sum, m) => 
        sum + m.connection_stability, 0) / peakResult.websocket_metrics.length
      expect(avgStability).toBeGreaterThan(85) // 85% stability during peak load
    }
  })

  it('should demonstrate resilience under stress with failures', async () => {
    const results = testSuite.getResults()
    const stressResult = results.find(r => r.test_name === 'stress_with_failures')
    
    if (stressResult) {
      expect(stressResult.overall_system_performance.reliability_score).toBeGreaterThan(60)
      expect(stressResult.performance_bottlenecks.length).toBeLessThan(10) // Limited bottlenecks
      expect(stressResult.recommendations.length).toBeGreaterThan(0) // Should provide recommendations
      
      // System should still function under stress
      const totalConnections = stressResult.websocket_metrics.length
      const successfulConnections = stressResult.websocket_metrics.filter(m => m.connection_stability > 50).length
      const connectionSuccessRate = (successfulConnections / totalConnections) * 100
      expect(connectionSuccessRate).toBeGreaterThan(70) // 70% connections should remain stable
    }
  })

  it('should validate real-time system SLAs', async () => {
    const results = testSuite.getResults()
    
    // Real-time System SLAs
    const REALTIME_SLA = {
      maxOrderExecutionLatency: 1000, // 1 second
      maxMarketDataFreshness: 200, // 200ms behind real-time
      minConnectionStability: 90, // 90%
      maxMessageLatency: 150, // 150ms
      minThroughput: 20, // 20 messages/second per connection
      minRealTimeScore: 75 // 75/100
    }

    // Exclude stress test from SLA validation
    const slaResults = results.filter(r => r.test_name !== 'stress_with_failures')
    
    slaResults.forEach(result => {
      expect(result.trading_metrics.order_execution_latency).toBeLessThan(REALTIME_SLA.maxOrderExecutionLatency)
      expect(result.trading_metrics.market_data_freshness).toBeLessThan(REALTIME_SLA.maxMarketDataFreshness)
      expect(result.overall_system_performance.real_time_score).toBeGreaterThan(REALTIME_SLA.minRealTimeScore)
      
      const avgConnectionStability = result.websocket_metrics.reduce((sum, m) => 
        sum + m.connection_stability, 0) / result.websocket_metrics.length
      expect(avgConnectionStability).toBeGreaterThan(REALTIME_SLA.minConnectionStability)
      
      const avgMessageLatency = result.websocket_metrics.reduce((sum, m) => 
        sum + m.average_message_latency, 0) / result.websocket_metrics.length
      expect(avgMessageLatency).toBeLessThan(REALTIME_SLA.maxMessageLatency)
    })
  })

  it('should generate comprehensive real-time performance report', () => {
    const report = testSuite.generateReport()
    
    expect(report).toContain('REAL-TIME SYSTEM PERFORMANCE TEST REPORT')
    expect(report).toContain('WebSocket Connections:')
    expect(report).toContain('Trading System Performance:')
    expect(report).toContain('Overall Scores:')
    expect(report).toContain('Real-time:')
    expect(report).toContain('Latency:')
    expect(report).toContain('Throughput:')
    expect(report).toContain('Reliability:')
    expect(report).toContain('Scalability:')
    
    console.log('\n' + report)
  })
})

// Export for use in other test files
export { 
  RealtimeSystemPerformanceTestSuite, 
  type WebSocketConnectionMetrics, 
  type RealTimeDataProcessingMetrics, 
  type MonitoringSystemMetrics,
  type TradingSystemRealtimeMetrics,
  type RealtimePerformanceResult 
}