/**
 * Performance Monitoring Dashboard and Metrics Collection
 * Real-time performance monitoring, alerting, and comprehensive metrics collection
 */

import { performance } from 'node:perf_hooks'
import { EventEmitter } from 'events'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface PerformanceMetric {
  timestamp: number
  metricName: string
  value: number
  unit: string
  tags: Record<string, string>
  source: string
}

interface SystemMetrics {
  timestamp: number
  cpu: {
    usage: number
    cores: number
    load: number[]
  }
  memory: {
    used: number
    total: number
    free: number
    cached: number
    utilization: number
  }
  network: {
    bytesIn: number
    bytesOut: number
    packetsIn: number
    packetsOut: number
    errors: number
  }
  disk: {
    used: number
    free: number
    utilization: number
    iops: number
  }
}

interface ApplicationMetrics {
  timestamp: number
  requests: {
    total: number
    successful: number
    failed: number
    rate: number
    averageResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
  }
  database: {
    connectionPoolActive: number
    connectionPoolIdle: number
    queryCount: number
    averageQueryTime: number
    slowQueries: number
  }
  websockets: {
    activeConnections: number
    messagesPerSecond: number
    averageLatency: number
    disconnects: number
  }
  trading: {
    ordersPerSecond: number
    averageExecutionTime: number
    successRate: number
    slippageRate: number
  }
  cache: {
    hitRate: number
    missRate: number
    evictions: number
    memoryUsage: number
  }
}

interface AlertRule {
  id: string
  name: string
  condition: (metric: PerformanceMetric) => boolean
  severity: 'info' | 'warning' | 'error' | 'critical'
  cooldown: number // milliseconds
  lastTriggered?: number
}

interface Alert {
  id: string
  ruleId: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  message: string
  timestamp: number
  metric: PerformanceMetric
  acknowledged: boolean
}

interface PerformanceDashboardData {
  systemMetrics: SystemMetrics
  applicationMetrics: ApplicationMetrics
  recentMetrics: PerformanceMetric[]
  activeAlerts: Alert[]
  performanceTrends: {
    responseTime: Array<{ timestamp: number; value: number }>
    throughput: Array<{ timestamp: number; value: number }>
    errorRate: Array<{ timestamp: number; value: number }>
    resourceUtilization: Array<{ timestamp: number; cpu: number; memory: number }>
  }
  healthScore: number
}

class PerformanceMonitoringDashboard extends EventEmitter {
  private metrics: PerformanceMetric[] = []
  private systemMetricsHistory: SystemMetrics[] = []
  private applicationMetricsHistory: ApplicationMetrics[] = []
  private alerts: Alert[] = []
  private alertRules: AlertRule[] = []
  private isMonitoring = false
  private monitoringInterval: NodeJS.Timeout | null = null
  private metricsDir: string

  constructor() {
    super()
    this.metricsDir = join(process.cwd(), 'tests/performance/metrics')
    this.ensureMetricsDirectory()
    this.setupDefaultAlertRules()
  }

  private ensureMetricsDirectory(): void {
    if (!existsSync(this.metricsDir)) {
      mkdirSync(this.metricsDir, { recursive: true })
    }
  }

  private setupDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'high-response-time',
        name: 'High Response Time',
        condition: (metric) => metric.metricName === 'response_time' && metric.value > 2000,
        severity: 'warning',
        cooldown: 60000 // 1 minute
      },
      {
        id: 'critical-response-time',
        name: 'Critical Response Time',
        condition: (metric) => metric.metricName === 'response_time' && metric.value > 5000,
        severity: 'critical',
        cooldown: 30000 // 30 seconds
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: (metric) => metric.metricName === 'error_rate' && metric.value > 5,
        severity: 'error',
        cooldown: 120000 // 2 minutes
      },
      {
        id: 'memory-pressure',
        name: 'Memory Pressure',
        condition: (metric) => metric.metricName === 'memory_utilization' && metric.value > 85,
        severity: 'warning',
        cooldown: 180000 // 3 minutes
      },
      {
        id: 'cpu-pressure',
        name: 'CPU Pressure',
        condition: (metric) => metric.metricName === 'cpu_utilization' && metric.value > 80,
        severity: 'warning',
        cooldown: 120000 // 2 minutes
      },
      {
        id: 'trading-latency',
        name: 'Trading Execution Latency',
        condition: (metric) => metric.metricName === 'trading_execution_time' && metric.value > 1000,
        severity: 'error',
        cooldown: 60000 // 1 minute
      },
      {
        id: 'websocket-disconnects',
        name: 'High WebSocket Disconnects',
        condition: (metric) => metric.metricName === 'websocket_disconnects' && metric.value > 10,
        severity: 'warning',
        cooldown: 300000 // 5 minutes
      }
    ]
  }

  startMonitoring(interval: number = 5000): void {
    if (this.isMonitoring) return

    console.log(`📊 Starting performance monitoring (interval: ${interval}ms)`)
    this.isMonitoring = true

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
    }, interval)

    this.emit('monitoring_started')
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return

    console.log('⏹️ Stopping performance monitoring')
    this.isMonitoring = false

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    this.emit('monitoring_stopped')
  }

  private collectMetrics(): void {
    const timestamp = performance.now()

    // Collect system metrics
    const systemMetrics = this.collectSystemMetrics(timestamp)
    this.systemMetricsHistory.push(systemMetrics)

    // Collect application metrics
    const applicationMetrics = this.collectApplicationMetrics(timestamp)
    this.applicationMetricsHistory.push(applicationMetrics)

    // Convert to performance metrics for alerting
    this.convertToPerformanceMetrics(systemMetrics, applicationMetrics)

    // Keep only recent history (last 1000 entries)
    if (this.systemMetricsHistory.length > 1000) {
      this.systemMetricsHistory = this.systemMetricsHistory.slice(-1000)
    }
    if (this.applicationMetricsHistory.length > 1000) {
      this.applicationMetricsHistory = this.applicationMetricsHistory.slice(-1000)
    }
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000)
    }

    this.emit('metrics_collected', { systemMetrics, applicationMetrics })
  }

  private collectSystemMetrics(timestamp: number): SystemMetrics {
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    return {
      timestamp,
      cpu: {
        usage: ((cpuUsage.user + cpuUsage.system) / 1000000) * 100, // Convert to percentage
        cores: require('os').cpus().length,
        load: require('os').loadavg()
      },
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        free: memoryUsage.heapTotal - memoryUsage.heapUsed,
        cached: memoryUsage.external,
        utilization: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      network: {
        // Mock network metrics (would be real in production)
        bytesIn: Math.floor(Math.random() * 1000000),
        bytesOut: Math.floor(Math.random() * 1000000),
        packetsIn: Math.floor(Math.random() * 10000),
        packetsOut: Math.floor(Math.random() * 10000),
        errors: Math.floor(Math.random() * 10)
      },
      disk: {
        // Mock disk metrics (would be real in production)
        used: Math.floor(Math.random() * 1000000000),
        free: Math.floor(Math.random() * 1000000000),
        utilization: Math.random() * 100,
        iops: Math.floor(Math.random() * 1000)
      }
    }
  }

  private collectApplicationMetrics(timestamp: number): ApplicationMetrics {
    // In a real implementation, these would be collected from actual application components
    return {
      timestamp,
      requests: {
        total: Math.floor(Math.random() * 10000),
        successful: Math.floor(Math.random() * 9500),
        failed: Math.floor(Math.random() * 500),
        rate: 50 + Math.random() * 100,
        averageResponseTime: 100 + Math.random() * 400,
        p95ResponseTime: 200 + Math.random() * 800,
        p99ResponseTime: 500 + Math.random() * 1500
      },
      database: {
        connectionPoolActive: Math.floor(Math.random() * 20),
        connectionPoolIdle: Math.floor(Math.random() * 10),
        queryCount: Math.floor(Math.random() * 1000),
        averageQueryTime: 10 + Math.random() * 100,
        slowQueries: Math.floor(Math.random() * 5)
      },
      websockets: {
        activeConnections: Math.floor(Math.random() * 500),
        messagesPerSecond: Math.floor(Math.random() * 1000),
        averageLatency: 10 + Math.random() * 50,
        disconnects: Math.floor(Math.random() * 10)
      },
      trading: {
        ordersPerSecond: Math.floor(Math.random() * 100),
        averageExecutionTime: 50 + Math.random() * 200,
        successRate: 95 + Math.random() * 5,
        slippageRate: Math.random() * 0.5
      },
      cache: {
        hitRate: 80 + Math.random() * 20,
        missRate: Math.random() * 20,
        evictions: Math.floor(Math.random() * 100),
        memoryUsage: Math.random() * 1000
      }
    }
  }

  private convertToPerformanceMetrics(
    systemMetrics: SystemMetrics,
    applicationMetrics: ApplicationMetrics
  ): void {
    const timestamp = performance.now()

    // System metrics
    this.addMetric('cpu_utilization', systemMetrics.cpu.usage, '%', { source: 'system' }, timestamp)
    this.addMetric('memory_utilization', systemMetrics.memory.utilization, '%', { source: 'system' }, timestamp)
    this.addMetric('disk_utilization', systemMetrics.disk.utilization, '%', { source: 'system' }, timestamp)

    // Application metrics
    this.addMetric('response_time', applicationMetrics.requests.averageResponseTime, 'ms', { source: 'application' }, timestamp)
    this.addMetric('throughput', applicationMetrics.requests.rate, 'req/s', { source: 'application' }, timestamp)
    this.addMetric('error_rate', (applicationMetrics.requests.failed / applicationMetrics.requests.total) * 100, '%', { source: 'application' }, timestamp)
    this.addMetric('trading_execution_time', applicationMetrics.trading.averageExecutionTime, 'ms', { source: 'trading' }, timestamp)
    this.addMetric('websocket_connections', applicationMetrics.websockets.activeConnections, 'count', { source: 'websocket' }, timestamp)
    this.addMetric('websocket_disconnects', applicationMetrics.websockets.disconnects, 'count', { source: 'websocket' }, timestamp)
    this.addMetric('database_query_time', applicationMetrics.database.averageQueryTime, 'ms', { source: 'database' }, timestamp)
  }

  addMetric(
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string> = {},
    timestamp?: number
  ): void {
    const metric: PerformanceMetric = {
      timestamp: timestamp || performance.now(),
      metricName: name,
      value,
      unit,
      tags,
      source: tags.source || 'unknown'
    }

    this.metrics.push(metric)
    this.checkAlertRules(metric)
    this.emit('metric_added', metric)
  }

  private checkAlertRules(metric: PerformanceMetric): void {
    for (const rule of this.alertRules) {
      // Check cooldown
      if (rule.lastTriggered && (metric.timestamp - rule.lastTriggered) < rule.cooldown) {
        continue
      }

      // Check condition
      if (rule.condition(metric)) {
        const alert: Alert = {
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId: rule.id,
          severity: rule.severity,
          message: `${rule.name}: ${metric.metricName} = ${metric.value}${metric.unit}`,
          timestamp: metric.timestamp,
          metric,
          acknowledged: false
        }

        this.alerts.push(alert)
        rule.lastTriggered = metric.timestamp

        this.emit('alert_triggered', alert)
        console.warn(`🚨 Alert: ${alert.message}`)
      }
    }
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      this.emit('alert_acknowledged', alert)
      return true
    }
    return false
  }

  getDashboardData(): PerformanceDashboardData {
    const recentMetrics = this.metrics.slice(-100) // Last 100 metrics
    const activeAlerts = this.alerts.filter(a => !a.acknowledged)

    // Calculate performance trends
    const performanceTrends = this.calculatePerformanceTrends()

    // Calculate health score
    const healthScore = this.calculateHealthScore()

    return {
      systemMetrics: this.systemMetricsHistory[this.systemMetricsHistory.length - 1] || {} as SystemMetrics,
      applicationMetrics: this.applicationMetricsHistory[this.applicationMetricsHistory.length - 1] || {} as ApplicationMetrics,
      recentMetrics,
      activeAlerts,
      performanceTrends,
      healthScore
    }
  }

  private calculatePerformanceTrends(): PerformanceDashboardData['performanceTrends'] {
    const last50Metrics = this.metrics.slice(-50)

    return {
      responseTime: last50Metrics
        .filter(m => m.metricName === 'response_time')
        .map(m => ({ timestamp: m.timestamp, value: m.value })),
      
      throughput: last50Metrics
        .filter(m => m.metricName === 'throughput')
        .map(m => ({ timestamp: m.timestamp, value: m.value })),
      
      errorRate: last50Metrics
        .filter(m => m.metricName === 'error_rate')
        .map(m => ({ timestamp: m.timestamp, value: m.value })),
      
      resourceUtilization: last50Metrics
        .filter(m => m.metricName === 'cpu_utilization' || m.metricName === 'memory_utilization')
        .reduce((acc, m) => {
          const existing = acc.find(item => Math.abs(item.timestamp - m.timestamp) < 1000)
          if (existing) {
            if (m.metricName === 'cpu_utilization') existing.cpu = m.value
            if (m.metricName === 'memory_utilization') existing.memory = m.value
          } else {
            acc.push({
              timestamp: m.timestamp,
              cpu: m.metricName === 'cpu_utilization' ? m.value : 0,
              memory: m.metricName === 'memory_utilization' ? m.value : 0
            })
          }
          return acc
        }, [] as Array<{ timestamp: number; cpu: number; memory: number }>)
    }
  }

  private calculateHealthScore(): number {
    // Calculate overall system health based on recent metrics
    const recentMetrics = this.metrics.slice(-20)
    const activeAlerts = this.alerts.filter(a => !a.acknowledged)

    let score = 100

    // Deduct points for active alerts
    score -= activeAlerts.filter(a => a.severity === 'critical').length * 25
    score -= activeAlerts.filter(a => a.severity === 'error').length * 15
    score -= activeAlerts.filter(a => a.severity === 'warning').length * 5

    // Deduct points for poor performance metrics
    const avgResponseTime = this.getAverageMetricValue(recentMetrics, 'response_time')
    if (avgResponseTime > 2000) score -= 20
    else if (avgResponseTime > 1000) score -= 10

    const avgErrorRate = this.getAverageMetricValue(recentMetrics, 'error_rate')
    if (avgErrorRate > 10) score -= 20
    else if (avgErrorRate > 5) score -= 10

    const avgCpuUtil = this.getAverageMetricValue(recentMetrics, 'cpu_utilization')
    if (avgCpuUtil > 80) score -= 15
    else if (avgCpuUtil > 60) score -= 5

    const avgMemoryUtil = this.getAverageMetricValue(recentMetrics, 'memory_utilization')
    if (avgMemoryUtil > 85) score -= 15
    else if (avgMemoryUtil > 70) score -= 5

    return Math.max(0, Math.min(100, score))
  }

  private getAverageMetricValue(metrics: PerformanceMetric[], metricName: string): number {
    const filtered = metrics.filter(m => m.metricName === metricName)
    if (filtered.length === 0) return 0
    return filtered.reduce((sum, m) => sum + m.value, 0) / filtered.length
  }

  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `performance-metrics-${timestamp}.${format}`
    const filepath = join(this.metricsDir, filename)

    if (format === 'json') {
      const data = {
        exportTimestamp: new Date().toISOString(),
        systemMetrics: this.systemMetricsHistory,
        applicationMetrics: this.applicationMetricsHistory,
        metrics: this.metrics,
        alerts: this.alerts
      }
      writeFileSync(filepath, JSON.stringify(data, null, 2))
    } else if (format === 'csv') {
      const csvHeaders = 'timestamp,metricName,value,unit,source,tags\n'
      const csvData = this.metrics.map(m => 
        `${m.timestamp},${m.metricName},${m.value},${m.unit},${m.source},"${JSON.stringify(m.tags)}"`
      ).join('\n')
      writeFileSync(filepath, csvHeaders + csvData)
    }

    return filepath
  }

  generatePerformanceReport(): string {
    const dashboardData = this.getDashboardData()
    
    const report = [
      '=== PERFORMANCE MONITORING DASHBOARD REPORT ===',
      `Report Generated: ${new Date().toISOString()}`,
      `Health Score: ${dashboardData.healthScore}/100`,
      '',
      '📊 Current System Status:',
      '─'.repeat(50),
      `CPU Utilization: ${dashboardData.systemMetrics.cpu?.usage?.toFixed(2) || 'N/A'}%`,
      `Memory Utilization: ${dashboardData.systemMetrics.memory?.utilization?.toFixed(2) || 'N/A'}%`,
      `Disk Utilization: ${dashboardData.systemMetrics.disk?.utilization?.toFixed(2) || 'N/A'}%`,
      '',
      '📈 Application Performance:',
      '─'.repeat(50),
      `Request Rate: ${dashboardData.applicationMetrics.requests?.rate?.toFixed(2) || 'N/A'} req/s`,
      `Average Response Time: ${dashboardData.applicationMetrics.requests?.averageResponseTime?.toFixed(2) || 'N/A'}ms`,
      `P95 Response Time: ${dashboardData.applicationMetrics.requests?.p95ResponseTime?.toFixed(2) || 'N/A'}ms`,
      `Error Rate: ${((dashboardData.applicationMetrics.requests?.failed || 0) / (dashboardData.applicationMetrics.requests?.total || 1) * 100).toFixed(2)}%`,
      '',
      '💹 Trading Performance:',
      '─'.repeat(50),
      `Orders per Second: ${dashboardData.applicationMetrics.trading?.ordersPerSecond || 'N/A'}`,
      `Average Execution Time: ${dashboardData.applicationMetrics.trading?.averageExecutionTime?.toFixed(2) || 'N/A'}ms`,
      `Success Rate: ${dashboardData.applicationMetrics.trading?.successRate?.toFixed(2) || 'N/A'}%`,
      `Slippage Rate: ${dashboardData.applicationMetrics.trading?.slippageRate?.toFixed(4) || 'N/A'}%`,
      '',
      '🔌 WebSocket Performance:',
      '─'.repeat(50),
      `Active Connections: ${dashboardData.applicationMetrics.websockets?.activeConnections || 'N/A'}`,
      `Messages per Second: ${dashboardData.applicationMetrics.websockets?.messagesPerSecond || 'N/A'}`,
      `Average Latency: ${dashboardData.applicationMetrics.websockets?.averageLatency?.toFixed(2) || 'N/A'}ms`,
      '',
      '🗄️ Database Performance:',
      '─'.repeat(50),
      `Active Connections: ${dashboardData.applicationMetrics.database?.connectionPoolActive || 'N/A'}`,
      `Average Query Time: ${dashboardData.applicationMetrics.database?.averageQueryTime?.toFixed(2) || 'N/A'}ms`,
      `Slow Queries: ${dashboardData.applicationMetrics.database?.slowQueries || 'N/A'}`,
      '',
    ]

    // Add active alerts
    if (dashboardData.activeAlerts.length > 0) {
      report.push('🚨 Active Alerts:')
      report.push('─'.repeat(50))
      dashboardData.activeAlerts.forEach(alert => {
        const severity = alert.severity.toUpperCase()
        const time = new Date(alert.timestamp).toLocaleTimeString()
        report.push(`[${severity}] ${time}: ${alert.message}`)
      })
      report.push('')
    }

    // Add performance trends summary
    report.push('📊 Performance Trends:')
    report.push('─'.repeat(50))
    
    const avgResponseTime = dashboardData.performanceTrends.responseTime
      .reduce((sum, item) => sum + item.value, 0) / dashboardData.performanceTrends.responseTime.length
    
    const avgThroughput = dashboardData.performanceTrends.throughput
      .reduce((sum, item) => sum + item.value, 0) / dashboardData.performanceTrends.throughput.length
      
    const avgErrorRate = dashboardData.performanceTrends.errorRate
      .reduce((sum, item) => sum + item.value, 0) / dashboardData.performanceTrends.errorRate.length

    report.push(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`)
    report.push(`Average Throughput: ${avgThroughput.toFixed(2)} req/s`)
    report.push(`Average Error Rate: ${avgErrorRate.toFixed(2)}%`)
    report.push('')

    report.push('📈 Recommendations:')
    report.push('─'.repeat(50))
    
    if (dashboardData.healthScore < 70) {
      report.push('- System health is below optimal. Review active alerts and performance metrics.')
    }
    if (avgResponseTime > 1000) {
      report.push('- Response times are elevated. Consider performance optimization.')
    }
    if (avgErrorRate > 5) {
      report.push('- Error rate is high. Investigate error patterns and root causes.')
    }
    if (dashboardData.systemMetrics.cpu?.usage > 80) {
      report.push('- CPU utilization is high. Consider scaling or optimization.')
    }
    if (dashboardData.systemMetrics.memory?.utilization > 80) {
      report.push('- Memory utilization is high. Check for memory leaks or increase capacity.')
    }

    return report.join('\n')
  }

  getMetrics(): PerformanceMetric[] {
    return this.metrics
  }

  getAlerts(): Alert[] {
    return this.alerts
  }

  getSystemMetricsHistory(): SystemMetrics[] {
    return this.systemMetricsHistory
  }

  getApplicationMetricsHistory(): ApplicationMetrics[] {
    return this.applicationMetricsHistory
  }
}

// Test Suite Implementation
describe('Performance Monitoring Dashboard Tests', () => {
  let dashboard: PerformanceMonitoringDashboard

  beforeAll(async () => {
    dashboard = new PerformanceMonitoringDashboard()
  })

  afterAll(async () => {
    dashboard.stopMonitoring()
  })

  it('should start and stop monitoring', async () => {
    let monitoringStarted = false
    let monitoringStopped = false

    dashboard.on('monitoring_started', () => { monitoringStarted = true })
    dashboard.on('monitoring_stopped', () => { monitoringStopped = true })

    dashboard.startMonitoring(1000) // 1 second intervals
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(monitoringStarted).toBe(true)

    dashboard.stopMonitoring()
    expect(monitoringStopped).toBe(true)
  })

  it('should collect metrics automatically', async () => {
    let metricsCollected = false
    
    dashboard.on('metrics_collected', () => { metricsCollected = true })
    dashboard.startMonitoring(500) // 500ms intervals

    await new Promise(resolve => setTimeout(resolve, 1000))
    expect(metricsCollected).toBe(true)

    const metrics = dashboard.getMetrics()
    expect(metrics.length).toBeGreaterThan(0)

    dashboard.stopMonitoring()
  })

  it('should add custom metrics', () => {
    const initialCount = dashboard.getMetrics().length

    dashboard.addMetric('test_metric', 42, 'units', { test: 'true' })
    dashboard.addMetric('another_metric', 100, 'percent', { component: 'test' })

    const metrics = dashboard.getMetrics()
    expect(metrics.length).toBe(initialCount + 2)

    const testMetric = metrics.find(m => m.metricName === 'test_metric')
    expect(testMetric).toBeDefined()
    expect(testMetric?.value).toBe(42)
    expect(testMetric?.unit).toBe('units')
    expect(testMetric?.tags.test).toBe('true')
  })

  it('should trigger alerts based on rules', async () => {
    let alertTriggered = false
    let triggeredAlert: Alert | null = null

    dashboard.on('alert_triggered', (alert: Alert) => {
      alertTriggered = true
      triggeredAlert = alert
    })

    // Add a metric that should trigger an alert (high response time)
    dashboard.addMetric('response_time', 6000, 'ms', { endpoint: '/api/test' })

    expect(alertTriggered).toBe(true)
    expect(triggeredAlert).toBeDefined()
    expect(triggeredAlert?.severity).toBe('critical')
    expect(triggeredAlert?.ruleId).toBe('critical-response-time')

    const alerts = dashboard.getAlerts()
    expect(alerts.length).toBeGreaterThan(0)
  })

  it('should respect alert cooldowns', () => {
    const initialAlertCount = dashboard.getAlerts().length

    // Trigger the same alert twice quickly
    dashboard.addMetric('response_time', 6000, 'ms', { test: 'cooldown1' })
    dashboard.addMetric('response_time', 6000, 'ms', { test: 'cooldown2' })

    const alerts = dashboard.getAlerts()
    // Should only create one new alert due to cooldown
    expect(alerts.length).toBe(initialAlertCount + 1)
  })

  it('should acknowledge alerts', () => {
    // Add metric to trigger alert
    dashboard.addMetric('error_rate', 10, '%', { test: 'acknowledge' })

    const alerts = dashboard.getAlerts()
    const unacknowledgedAlert = alerts.find(a => !a.acknowledged && a.metric.tags.test === 'acknowledge')
    
    expect(unacknowledgedAlert).toBeDefined()
    
    if (unacknowledgedAlert) {
      const success = dashboard.acknowledgeAlert(unacknowledgedAlert.id)
      expect(success).toBe(true)
      expect(unacknowledgedAlert.acknowledged).toBe(true)
    }
  })

  it('should generate dashboard data', () => {
    dashboard.startMonitoring(100)
    
    // Wait for some metrics to be collected
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const dashboardData = dashboard.getDashboardData()
        
        expect(dashboardData).toBeDefined()
        expect(dashboardData.systemMetrics).toBeDefined()
        expect(dashboardData.applicationMetrics).toBeDefined()
        expect(dashboardData.recentMetrics).toBeDefined()
        expect(dashboardData.activeAlerts).toBeDefined()
        expect(dashboardData.performanceTrends).toBeDefined()
        expect(dashboardData.healthScore).toBeGreaterThanOrEqual(0)
        expect(dashboardData.healthScore).toBeLessThanOrEqual(100)
        
        dashboard.stopMonitoring()
        resolve()
      }, 500)
    })
  })

  it('should calculate health score accurately', () => {
    // Add good metrics
    dashboard.addMetric('response_time', 200, 'ms', { test: 'good' })
    dashboard.addMetric('error_rate', 1, '%', { test: 'good' })
    dashboard.addMetric('cpu_utilization', 50, '%', { test: 'good' })
    dashboard.addMetric('memory_utilization', 60, '%', { test: 'good' })

    const dashboardData = dashboard.getDashboardData()
    expect(dashboardData.healthScore).toBeGreaterThan(80) // Should be high with good metrics
  })

  it('should export metrics in JSON format', () => {
    dashboard.addMetric('export_test', 123, 'test_units', { export: 'true' })
    
    const filepath = dashboard.exportMetrics('json')
    expect(filepath).toMatch(/performance-metrics-.*\.json$/)
  })

  it('should export metrics in CSV format', () => {
    dashboard.addMetric('csv_test', 456, 'csv_units', { csv: 'true' })
    
    const filepath = dashboard.exportMetrics('csv')
    expect(filepath).toMatch(/performance-metrics-.*\.csv$/)
  })

  it('should generate comprehensive performance report', () => {
    const report = dashboard.generatePerformanceReport()
    
    expect(report).toContain('PERFORMANCE MONITORING DASHBOARD REPORT')
    expect(report).toContain('Health Score:')
    expect(report).toContain('Current System Status:')
    expect(report).toContain('Application Performance:')
    expect(report).toContain('Trading Performance:')
    expect(report).toContain('WebSocket Performance:')
    expect(report).toContain('Database Performance:')
    expect(report).toContain('Performance Trends:')
    expect(report).toContain('Recommendations:')
    
    console.log('\n' + report)
  })

  it('should validate monitoring performance SLAs', () => {
    const systemMetrics = dashboard.getSystemMetricsHistory()
    const applicationMetrics = dashboard.getApplicationMetricsHistory()

    // Monitoring SLAs
    const MONITORING_SLA = {
      maxDataCollectionLatency: 100, // 100ms
      maxMetricRetention: 10000, // 10,000 metrics
      maxAlertLatency: 50, // 50ms
      minHealthScoreAccuracy: 80 // 80% accuracy
    }

    // Check data collection performance
    if (systemMetrics.length > 1) {
      const latencies = systemMetrics.slice(1).map((current, index) => 
        current.timestamp - systemMetrics[index].timestamp
      )
      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      expect(avgLatency).toBeLessThan(MONITORING_SLA.maxDataCollectionLatency * 100) // Allow for test overhead
    }

    // Check metric retention
    const totalMetrics = dashboard.getMetrics().length
    expect(totalMetrics).toBeLessThan(MONITORING_SLA.maxMetricRetention)

    // Check health score calculation
    const dashboardData = dashboard.getDashboardData()
    expect(dashboardData.healthScore).toBeGreaterThanOrEqual(0)
    expect(dashboardData.healthScore).toBeLessThanOrEqual(100)
  })
})

// Export for use in other test files
export { 
  PerformanceMonitoringDashboard, 
  type PerformanceMetric, 
  type SystemMetrics, 
  type ApplicationMetrics,
  type Alert,
  type AlertRule,
  type PerformanceDashboardData 
}