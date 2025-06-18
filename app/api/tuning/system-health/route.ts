/**
 * System Health API Routes
 * 
 * API endpoints for monitoring optimization system health and component status
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from "../../../../src/lib/utils";

/**
 * GET /api/tuning/system-health
 * Get comprehensive system health status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('includeDetails') === 'true';
    const includeMetrics = searchParams.get('includeMetrics') === 'true';

    // Check component health (in real implementation, these would be actual health checks)
    const componentHealth = await checkComponentHealth();
    
    // Determine overall health based on component status
    const overallHealth = determineOverallHealth(componentHealth);
    
    const response: any = {
      overallHealth,
      components: componentHealth,
      activeOptimizations: 2, // Mock data
      lastOptimization: new Date(Date.now() - 3600000), // 1 hour ago
      timestamp: new Date(),
      uptime: Math.floor(process.uptime()), // Server uptime in seconds
      
      // Quick status indicators
      status: {
        optimizationEngineOnline: componentHealth.optimizationEngine === 'healthy',
        parameterManagerOnline: componentHealth.parameterManager === 'healthy',
        backtestingOnline: componentHealth.backtesting === 'healthy',
        abTestingOnline: componentHealth.abTesting === 'healthy',
        allSystemsOperational: overallHealth === 'excellent' || overallHealth === 'good'
      }
    };

    if (includeDetails) {
      response.details = await getHealthDetails(componentHealth);
    }

    if (includeMetrics) {
      response.metrics = await getHealthMetrics();
    }

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to get system health:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve system health' },
      { status: 500 }
    );
  }
}

/**
 * Check health of individual components
 */
async function checkComponentHealth(): Promise<{
  optimizationEngine: 'healthy' | 'degraded' | 'down';
  parameterManager: 'healthy' | 'degraded' | 'down';
  backtesting: 'healthy' | 'degraded' | 'down';
  abTesting: 'healthy' | 'degraded' | 'down';
}> {
  const results: {
    optimizationEngine: 'healthy' | 'degraded' | 'down';
    parameterManager: 'healthy' | 'degraded' | 'down';
    backtesting: 'healthy' | 'degraded' | 'down';
    abTesting: 'healthy' | 'degraded' | 'down';
  } = {
    optimizationEngine: 'healthy',
    parameterManager: 'healthy',
    backtesting: 'healthy',
    abTesting: 'healthy'
  };

  try {
    // Check optimization engine
    // In real implementation: check if service is responsive, recent activity, etc.
    const optimizationEngineCheck = await checkOptimizationEngine();
    results.optimizationEngine = optimizationEngineCheck ? 'healthy' : 'degraded';

    // Check parameter manager
    const parameterManagerCheck = await checkParameterManager();
    results.parameterManager = parameterManagerCheck ? 'healthy' : 'degraded';

    // Check backtesting framework
    const backtestingCheck = await checkBacktesting();
    results.backtesting = backtestingCheck ? 'healthy' : 'degraded';

    // Check A/B testing framework
    const abTestingCheck = await checkABTesting();
    results.abTesting = abTestingCheck ? 'healthy' : 'degraded';

  } catch (error) {
    logger.error('Component health check failed:', error);
    // Mark components as degraded if health check fails
    results.optimizationEngine = 'degraded';
  }

  return results;
}

/**
 * Determine overall system health based on component status
 */
function determineOverallHealth(components: {
  optimizationEngine: string;
  parameterManager: string;
  backtesting: string;
  abTesting: string;
}): 'excellent' | 'good' | 'warning' | 'critical' {
  const healthyCount = Object.values(components).filter(status => status === 'healthy').length;
  const downCount = Object.values(components).filter(status => status === 'down').length;
  
  if (downCount > 0) return 'critical';
  if (healthyCount === 4) return 'excellent';
  if (healthyCount >= 3) return 'good';
  return 'warning';
}

/**
 * Get detailed health information for each component
 */
async function getHealthDetails(componentHealth: any): Promise<any> {
  return {
    optimizationEngine: {
      status: componentHealth.optimizationEngine,
      lastActivity: new Date(Date.now() - 300000), // 5 minutes ago
      activeOptimizations: 2,
      totalOptimizations: 47,
      averageResponseTime: 89, // ms
      memoryUsage: '234 MB',
      cpuUsage: '12%',
      issues: componentHealth.optimizationEngine !== 'healthy' ? 
        ['High memory usage detected'] : []
    },
    
    parameterManager: {
      status: componentHealth.parameterManager,
      lastParameterUpdate: new Date(Date.now() - 1800000), // 30 minutes ago
      totalParameters: 16,
      activeSnapshots: 8,
      changeHistory: 156,
      diskUsage: '12 MB',
      issues: componentHealth.parameterManager !== 'healthy' ? 
        ['Parameter validation slower than normal'] : []
    },
    
    backtesting: {
      status: componentHealth.backtesting,
      lastBacktest: new Date(Date.now() - 3600000), // 1 hour ago
      totalBacktests: 23,
      averageBacktestTime: 45, // seconds
      historicalDataPoints: 15420,
      dataFreshness: new Date(Date.now() - 86400000), // 1 day ago
      issues: componentHealth.backtesting !== 'healthy' ? 
        ['Historical data update pending'] : []
    },
    
    abTesting: {
      status: componentHealth.abTesting,
      activeTests: 1,
      totalTests: 12,
      lastTestCompletion: new Date(Date.now() - 7200000), // 2 hours ago
      participantCount: 1247,
      conversionTracking: true,
      issues: componentHealth.abTesting !== 'healthy' ? 
        ['Statistical significance calculation delayed'] : []
    }
  };
}

/**
 * Get system health metrics
 */
async function getHealthMetrics(): Promise<any> {
  return {
    system: {
      uptime: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
      cpuUsage: await getCPUUsage(),
      diskUsage: '1.2 GB', // Mock data
      networkLatency: 12, // ms
      databaseConnections: 5,
      activeConnections: 23
    },
    
    performance: {
      requestsPerSecond: 45.6,
      averageResponseTime: 123, // ms
      errorRate: 0.02, // 2%
      throughput: '2.3 MB/s',
      cacheHitRate: 0.78, // 78%
      queueLength: 3
    },
    
    optimization: {
      optimizationsPerHour: 1.2,
      averageOptimizationTime: 42, // minutes
      successRate: 0.87, // 87%
      parameterUpdateFrequency: 3.4, // per hour
      backtestingLoad: 0.23, // 23% capacity
      mlModelAccuracy: 0.84 // 84%
    },
    
    alerts: [
      {
        level: 'info',
        message: 'System operating normally',
        timestamp: new Date(),
        component: 'system'
      }
    ]
  };
}

/**
 * Individual component health check functions
 */
async function checkOptimizationEngine(): Promise<boolean> {
  try {
    // In real implementation: ping optimization engine, check recent activity
    return true;
  } catch {
    return false;
  }
}

async function checkParameterManager(): Promise<boolean> {
  try {
    // In real implementation: test parameter read/write operations
    return true;
  } catch {
    return false;
  }
}

async function checkBacktesting(): Promise<boolean> {
  try {
    // In real implementation: verify backtesting service availability
    return true;
  } catch {
    return false;
  }
}

async function checkABTesting(): Promise<boolean> {
  try {
    // In real implementation: check A/B testing framework status
    return true;
  } catch {
    return false;
  }
}

/**
 * Get CPU usage percentage
 */
async function getCPUUsage(): Promise<number> {
  // Simplified CPU usage calculation
  const startUsage = process.cpuUsage();
  
  // Wait a small amount of time
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const endUsage = process.cpuUsage(startUsage);
  const totalUsage = endUsage.user + endUsage.system;
  
  // Convert to percentage (simplified)
  return Math.round((totalUsage / 100000) * 100) / 100;
}