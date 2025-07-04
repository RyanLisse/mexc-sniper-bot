/**
 * Enhanced Memory Manager
 * 
 * Addresses memory pressure issues identified in chaos engineering tests
 * Implements automatic garbage collection, memory monitoring, and pressure relief
 */

import { EventEmitter } from 'events'

export interface MemoryMetrics {
  heapUsed: number
  heapTotal: number
  heapUtilization: number
  external: number
  rss: number
  buffers: number
  arrayBuffers: number
  timestamp: number
}

export interface MemoryPressureConfig {
  warningThreshold: number    // 70% heap utilization
  criticalThreshold: number   // 85% heap utilization
  emergencyThreshold: number  // 95% heap utilization
  monitoringInterval: number  // 5 seconds
  gcTriggerThreshold: number  // 80% heap utilization
  memoryLeakThreshold: number // 50MB/minute growth
  maxHeapSize?: number        // Optional max heap size in bytes
}

export enum MemoryPressureLevel {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING', 
  CRITICAL = 'CRITICAL',
  EMERGENCY = 'EMERGENCY'
}

export interface MemoryPressureEvent {
  level: MemoryPressureLevel
  metrics: MemoryMetrics
  recommendations: string[]
  timestamp: number
}

export class EnhancedMemoryManager extends EventEmitter {
  private isMonitoring: boolean = false
  private monitoringInterval?: NodeJS.Timeout
  private metricsHistory: MemoryMetrics[] = []
  private lastGcTime: number = 0
  private cacheCleanupHandlers: (() => void)[] = []
  private memoryLeakDetected: boolean = false
  
  private readonly config: MemoryPressureConfig = {
    warningThreshold: 0.70,    // 70%
    criticalThreshold: 0.85,   // 85%
    emergencyThreshold: 0.95,  // 95%
    monitoringInterval: 5000,  // 5 seconds
    gcTriggerThreshold: 0.80,  // 80%
    memoryLeakThreshold: 50 * 1024 * 1024, // 50MB
    maxHeapSize: undefined
  }

  constructor(config: Partial<MemoryPressureConfig> = {}) {
    super()
    Object.assign(this.config, config)
    this.startMonitoring()
  }

  startMonitoring(): void {
    if (this.isMonitoring) return

    this.isMonitoring = true
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics()
    }, this.config.monitoringInterval)

    console.log('[Memory Manager] Started memory monitoring')
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return

    this.isMonitoring = false
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }

    console.log('[Memory Manager] Stopped memory monitoring')
  }

  private collectMetrics(): void {
    const memoryUsage = process.memoryUsage()
    
    const metrics: MemoryMetrics = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      heapUtilization: memoryUsage.heapUsed / memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      buffers: (memoryUsage as any).buffers || 0,
      arrayBuffers: memoryUsage.arrayBuffers,
      timestamp: Date.now()
    }

    // Add to history and keep only recent metrics
    this.metricsHistory.push(metrics)
    if (this.metricsHistory.length > 120) { // Keep 10 minutes of data at 5s intervals
      this.metricsHistory = this.metricsHistory.slice(-60) // Keep only last 5 minutes
    }

    // Analyze memory pressure
    const pressureLevel = this.analyzePressureLevel(metrics)
    
    // Detect memory leaks
    this.detectMemoryLeak()

    // Handle pressure events
    if (pressureLevel !== MemoryPressureLevel.NORMAL) {
      this.handleMemoryPressure(pressureLevel, metrics)
    }

    // Auto-trigger garbage collection if needed
    if (metrics.heapUtilization >= this.config.gcTriggerThreshold) {
      this.triggerGarbageCollection()
    }

    // Emit metrics for monitoring
    this.emit('metrics', metrics)
  }

  private analyzePressureLevel(metrics: MemoryMetrics): MemoryPressureLevel {
    const utilization = metrics.heapUtilization

    if (utilization >= this.config.emergencyThreshold) {
      return MemoryPressureLevel.EMERGENCY
    } else if (utilization >= this.config.criticalThreshold) {
      return MemoryPressureLevel.CRITICAL
    } else if (utilization >= this.config.warningThreshold) {
      return MemoryPressureLevel.WARNING
    } else {
      return MemoryPressureLevel.NORMAL
    }
  }

  private detectMemoryLeak(): void {
    if (this.metricsHistory.length < 12) return // Need at least 1 minute of data

    const recent = this.metricsHistory.slice(-12) // Last minute
    const older = this.metricsHistory.slice(-24, -12) // Previous minute
    
    if (older.length === 0) return

    const recentAvg = recent.reduce((sum, m) => sum + m.heapUsed, 0) / recent.length
    const olderAvg = older.reduce((sum, m) => sum + m.heapUsed, 0) / older.length
    
    const growth = recentAvg - olderAvg
    
    if (growth > this.config.memoryLeakThreshold) {
      if (!this.memoryLeakDetected) {
        this.memoryLeakDetected = true
        this.emit('memory-leak-detected', {
          growthRate: growth,
          growthPerMinute: growth,
          recentAverage: recentAvg,
          previousAverage: olderAvg
        })
        
        console.warn(`[Memory Manager] Potential memory leak detected: ${(growth / 1024 / 1024).toFixed(2)}MB/min growth`)
      }
    } else {
      this.memoryLeakDetected = false
    }
  }

  private handleMemoryPressure(level: MemoryPressureLevel, metrics: MemoryMetrics): void {
    const recommendations: string[] = []

    switch (level) {
      case MemoryPressureLevel.WARNING:
        recommendations.push('Monitor memory usage closely')
        recommendations.push('Consider clearing non-essential caches')
        break

      case MemoryPressureLevel.CRITICAL:
        recommendations.push('Trigger garbage collection')
        recommendations.push('Clear all non-essential caches')
        recommendations.push('Reduce concurrent operations')
        this.triggerGarbageCollection()
        this.triggerCacheCleanup()
        break

      case MemoryPressureLevel.EMERGENCY:
        recommendations.push('Emergency memory cleanup required')
        recommendations.push('Stop non-essential processes')
        recommendations.push('Consider process restart')
        this.emergencyCleanup()
        break
    }

    const event: MemoryPressureEvent = {
      level,
      metrics,
      recommendations,
      timestamp: Date.now()
    }

    this.emit('memory-pressure', event)
    
    console.warn(`[Memory Manager] Memory pressure detected: ${level}`, {
      heapUtilization: (metrics.heapUtilization * 100).toFixed(2) + '%',
      heapUsed: (metrics.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
      heapTotal: (metrics.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
      recommendations
    })
  }

  triggerGarbageCollection(): void {
    const now = Date.now()
    
    // Avoid triggering GC too frequently (max once per 30 seconds)
    if (now - this.lastGcTime < 30000) return
    
    this.lastGcTime = now
    
    try {
      if (global.gc) {
        const beforeGc = process.memoryUsage()
        global.gc()
        const afterGc = process.memoryUsage()
        
        const heapFreed = beforeGc.heapUsed - afterGc.heapUsed
        
        console.log(`[Memory Manager] Garbage collection completed: freed ${(heapFreed / 1024 / 1024).toFixed(2)}MB`)
        
        this.emit('gc-completed', {
          beforeGc,
          afterGc,
          heapFreed,
          timestamp: now
        })
      } else {
        console.warn('[Memory Manager] Garbage collection not available (--expose-gc not enabled)')
      }
    } catch (error) {
      console.error('[Memory Manager] Garbage collection failed:', error)
    }
  }

  triggerCacheCleanup(): void {
    console.log('[Memory Manager] Triggering cache cleanup')
    
    this.cacheCleanupHandlers.forEach((handler, index) => {
      try {
        handler()
      } catch (error) {
        console.error(`[Memory Manager] Cache cleanup handler ${index} failed:`, error)
      }
    })

    this.emit('cache-cleanup-completed')
  }

  emergencyCleanup(): void {
    console.error('[Memory Manager] Emergency memory cleanup initiated')
    
    // Force garbage collection multiple times
    this.triggerGarbageCollection()
    
    // Clear all caches
    this.triggerCacheCleanup()
    
    // Clear metrics history except recent data
    if (this.metricsHistory.length > 10) {
      this.metricsHistory = this.metricsHistory.slice(-10)
    }

    this.emit('emergency-cleanup-completed')
  }

  registerCacheCleanupHandler(handler: () => void): void {
    this.cacheCleanupHandlers.push(handler)
  }

  unregisterCacheCleanupHandler(handler: () => void): void {
    const index = this.cacheCleanupHandlers.indexOf(handler)
    if (index !== -1) {
      this.cacheCleanupHandlers.splice(index, 1)
    }
  }

  getCurrentMetrics(): MemoryMetrics | null {
    return this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1] 
      : null
  }

  getMemoryTrend(minutes: number = 5): {
    trend: 'increasing' | 'stable' | 'decreasing'
    avgGrowthRate: number // bytes per minute
    samples: number
  } {
    const samplesNeeded = Math.min(Math.floor(minutes * 60 / (this.config.monitoringInterval / 1000)), this.metricsHistory.length)
    
    if (samplesNeeded < 2) {
      return { trend: 'stable', avgGrowthRate: 0, samples: samplesNeeded }
    }

    const recentMetrics = this.metricsHistory.slice(-samplesNeeded)
    const first = recentMetrics[0]
    const last = recentMetrics[recentMetrics.length - 1]
    
    const timeDiff = last.timestamp - first.timestamp
    const heapDiff = last.heapUsed - first.heapUsed
    
    const growthRate = timeDiff > 0 ? (heapDiff / timeDiff) * 60000 : 0 // bytes per minute
    
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    if (Math.abs(growthRate) > 1024 * 1024) { // > 1MB/min
      trend = growthRate > 0 ? 'increasing' : 'decreasing'
    }

    return {
      trend,
      avgGrowthRate: growthRate,
      samples: samplesNeeded
    }
  }

  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical' | 'emergency'
    metrics: MemoryMetrics | null
    pressureLevel: MemoryPressureLevel
    memoryLeakDetected: boolean
    recommendations: string[]
  } {
    const currentMetrics = this.getCurrentMetrics()
    const pressureLevel = currentMetrics 
      ? this.analyzePressureLevel(currentMetrics)
      : MemoryPressureLevel.NORMAL

    const recommendations: string[] = []
    let status: 'healthy' | 'warning' | 'critical' | 'emergency' = 'healthy'

    switch (pressureLevel) {
      case MemoryPressureLevel.WARNING:
        status = 'warning'
        recommendations.push('Monitor memory usage')
        break
      case MemoryPressureLevel.CRITICAL:
        status = 'critical'
        recommendations.push('Clear caches and reduce load')
        break
      case MemoryPressureLevel.EMERGENCY:
        status = 'emergency'
        recommendations.push('Emergency cleanup required')
        break
    }

    if (this.memoryLeakDetected) {
      recommendations.push('Potential memory leak detected - investigate')
    }

    const trend = this.getMemoryTrend()
    if (trend.trend === 'increasing' && trend.avgGrowthRate > 5 * 1024 * 1024) { // > 5MB/min
      recommendations.push('High memory growth rate detected')
    }

    return {
      status,
      metrics: currentMetrics,
      pressureLevel,
      memoryLeakDetected: this.memoryLeakDetected,
      recommendations
    }
  }

  // Utility method for manual cleanup
  async forceCleanup(): Promise<void> {
    console.log('[Memory Manager] Force cleanup initiated')
    
    this.triggerGarbageCollection()
    this.triggerCacheCleanup()
    
    // Wait a bit for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const afterMetrics = this.getCurrentMetrics()
    if (afterMetrics) {
      console.log(`[Memory Manager] Force cleanup completed. Heap utilization: ${(afterMetrics.heapUtilization * 100).toFixed(2)}%`)
    }
  }
}

// Global memory manager instance
export const globalMemoryManager = new EnhancedMemoryManager()

// Register default cleanup handlers for common Node.js caches
globalMemoryManager.registerCacheCleanupHandler(() => {
  // Clear require cache (be careful with this in production)
  if (process.env.NODE_ENV === 'development') {
    const keys = Object.keys(require.cache)
    keys.forEach(key => {
      if (key.includes('node_modules') && Math.random() < 0.1) {
        // Only clear 10% of node_modules cache to avoid breaking dependencies
        delete require.cache[key]
      }
    })
  }
})

// Export convenience functions
export function getCurrentMemoryStatus(): {
  healthy: boolean
  metrics: MemoryMetrics | null
  recommendations: string[]
} {
  const status = globalMemoryManager.getHealthStatus()
  return {
    healthy: status.status === 'healthy',
    metrics: status.metrics,
    recommendations: status.recommendations
  }
}

export function forceMemoryCleanup(): Promise<void> {
  return globalMemoryManager.forceCleanup()
}

export function getMemoryTrend(minutes?: number): ReturnType<EnhancedMemoryManager['getMemoryTrend']> {
  return globalMemoryManager.getMemoryTrend(minutes)
}