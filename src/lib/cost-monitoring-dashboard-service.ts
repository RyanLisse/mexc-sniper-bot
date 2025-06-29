/**
 * Cost Monitoring Dashboard Service
 * 
 * Provides comprehensive cost monitoring data and recommendations
 * for database operations and optimization opportunities.
 */

import { globalDatabaseCostProtector } from "./database-cost-protector";
import { globalQueryBatchingService } from "./database-query-batching-service";
import { globalQueryCacheMiddleware } from "./database-query-cache-middleware";

export interface CostDashboardData {
  overview: {
    totalQueries: number;
    totalCost: number;
    costPerHour: number;
    savings: {
      cachingSavings: number;
      batchingSavings: number;
      totalSavings: number;
      savingsPercentage: number;
    };
    status: 'healthy' | 'warning' | 'critical';
    lastUpdated: string;
  };
  
  endpoints: Array<{
    endpoint: string;
    queryCount: number;
    averageDuration: number;
    totalCost: number;
    cacheHitRate: number;
    batchingRate: number;
    optimization: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
  }>;
  
  performance: {
    queryMetrics: {
      totalQueries: number;
      avgQueryTime: number;
      slowestQueries: Array<{
        endpoint: string;
        duration: number;
        count: number;
      }>;
    };
    connectionMetrics: {
      currentConnections: number;
      maxConnections: number;
      connectionEfficiency: number;
    };
    cacheMetrics: {
      totalRequests: number;
      cacheHits: number;
      cacheMisses: number;
      hitRate: number;
      memorySaved: number;
    };
    batchingMetrics: {
      totalQueries: number;
      batchedQueries: number;
      batchingRate: number;
      connectionsSaved: number;
      timeSaved: number;
    };
  };
  
  trends: {
    hourlyUsage: Array<{
      hour: string;
      queries: number;
      cost: number;
      cacheHitRate: number;
    }>;
    dailyTrends: Array<{
      date: string;
      totalQueries: number;
      totalCost: number;
      efficiency: number;
    }>;
  };
  
  alerts: Array<{
    severity: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    timestamp: string;
    endpoint?: string;
    action?: string;
  }>;
  
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
    potentialSavings: {
      cachingImprovements: number;
      batchingImprovements: number;
      queryOptimizations: number;
      totalPotential: number;
    };
  };
  
  thresholds: {
    queries: {
      current: number;
      warning: number;
      critical: number;
    };
    cost: {
      current: number;
      warning: number;
      critical: number;
    };
    performance: {
      avgResponseTime: number;
      cacheHitRate: number;
      batchingRate: number;
    };
  };
}

class CostMonitoringDashboardService {
  private static instance: CostMonitoringDashboardService;
  
  private historicalData = new Map<string, Array<{
    timestamp: number;
    queries: number;
    cost: number;
    cacheHitRate: number;
    batchingRate: number;
  }>>();
  
  private alerts: Array<{
    severity: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    timestamp: string;
    endpoint?: string;
    action?: string;
  }> = [];
  
  static getInstance(): CostMonitoringDashboardService {
    if (!CostMonitoringDashboardService.instance) {
      CostMonitoringDashboardService.instance = new CostMonitoringDashboardService();
    }
    return CostMonitoringDashboardService.instance;
  }
  
  private constructor() {
    this.startDataCollection();
  }
  
  private startDataCollection(): void {
    // Collect metrics every minute
    setInterval(() => {
      this.collectMetrics();
    }, 60000);
    
    // Clean old data every hour
    setInterval(() => {
      this.cleanOldData();
    }, 3600000);
  }
  
  private collectMetrics(): void {
    const timestamp = Date.now();
    const hour = new Date().toISOString().substring(0, 13); // YYYY-MM-DDTHH
    
    // Get current metrics
    const costStats = globalDatabaseCostProtector.getUsageStats();
    const cacheStats = globalQueryCacheMiddleware.getCacheStats();
    const batchStats = globalQueryBatchingService.getBatchingStats();
    
    // Store historical data
    if (!this.historicalData.has(hour)) {
      this.historicalData.set(hour, []);
    }
    
    const hourlyData = this.historicalData.get(hour)!;
    hourlyData.push({
      timestamp,
      queries: costStats.queries.lastMinute,
      cost: costStats.cost.hourlyRate,
      cacheHitRate: cacheStats.cache.hitRate,
      batchingRate: batchStats.metrics.batchingRate,
    });
    
    // Keep only last 60 data points per hour
    if (hourlyData.length > 60) {
      hourlyData.shift();
    }
  }
  
  private cleanOldData(): void {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    
    for (const [hour, data] of this.historicalData) {
      const hourTimestamp = new Date(`${hour}:00:00Z`).getTime();
      if (hourTimestamp < cutoff) {
        this.historicalData.delete(hour);
      }
    }
    
    // Clean old alerts (keep last 100)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }
  
  /**
   * Get comprehensive cost monitoring dashboard data
   */
  getDashboardData(): CostDashboardData {
    const costStats = globalDatabaseCostProtector.getUsageStats();
    const cacheStats = globalQueryCacheMiddleware.getCacheStats();
    const batchStats = globalQueryBatchingService.getBatchingStats();
    
    // Calculate savings
    const savings = this.calculateSavings(costStats, cacheStats, batchStats);
    
    // Generate overview
    const overview = {
      totalQueries: costStats.queries.lastDay,
      totalCost: costStats.cost.total,
      costPerHour: costStats.cost.hourlyRate,
      savings,
      status: this.determineOverallStatus(costStats),
      lastUpdated: new Date().toISOString(),
    };
    
    // Generate endpoint analysis
    const endpoints = this.generateEndpointAnalysis(costStats, cacheStats);
    
    // Generate performance metrics
    const performance = this.generatePerformanceMetrics(costStats, cacheStats, batchStats);
    
    // Generate trends
    const trends = this.generateTrends();
    
    // Get current alerts
    const alerts = this.getRecentAlerts();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(costStats, cacheStats, batchStats);
    
    // Generate thresholds
    const thresholds = this.generateThresholds(costStats, cacheStats, batchStats);
    
    return {
      overview,
      endpoints,
      performance,
      trends,
      alerts,
      recommendations,
      thresholds,
    };
  }
  
  private calculateSavings(costStats: any, cacheStats: any, batchStats: any) {
    // Calculate caching savings
    const cachingSavings = cacheStats.performance.databaseQueriesSaved * 0.001; // $0.001 per query saved
    
    // Calculate batching savings  
    const batchingSavings = batchStats.metrics.connectionsSaved * 0.01; // $0.01 per connection saved
    
    const totalSavings = cachingSavings + batchingSavings;
    const potentialCost = costStats.cost.total + totalSavings;
    const savingsPercentage = potentialCost > 0 ? (totalSavings / potentialCost * 100) : 0;
    
    return {
      cachingSavings,
      batchingSavings,
      totalSavings,
      savingsPercentage: parseFloat(savingsPercentage.toFixed(2)),
    };
  }
  
  private determineOverallStatus(costStats: any): 'healthy' | 'warning' | 'critical' {
    if (costStats.emergency.mode) {
      return 'critical';
    }
    
    if (costStats.cost.hourlyRate > costStats.cost.hourlyLimit * 0.8) {
      return 'warning';
    }
    
    if (costStats.queries.lastHour > costStats.queries.perHourLimit * 0.8) {
      return 'warning';
    }
    
    return 'healthy';
  }
  
  private generateEndpointAnalysis(costStats: any, cacheStats: any): CostDashboardData['endpoints'] {
    const endpointMetrics = globalDatabaseCostProtector.getEndpointMetrics();
    const endpoints: CostDashboardData['endpoints'] = [];
    
    // Handle different return types from getEndpointMetrics
    const metricsMap = endpointMetrics instanceof Map ? endpointMetrics : new Map();
    
    for (const [endpoint, metrics] of metricsMap) {
      const endpointCacheStats = cacheStats.endpoints || {};
      const cacheHitRate = endpointCacheStats[endpoint]?.hitRate || 0;
      
      // Calculate optimization score
      const optimization = this.calculateOptimizationScore(metrics, cacheHitRate);
      
      // Generate recommendations for this endpoint
      const recommendations = this.generateEndpointRecommendations(endpoint, metrics, cacheHitRate);
      
      endpoints.push({
        endpoint,
        queryCount: metrics.totalQueries,
        averageDuration: metrics.averageDuration,
        totalCost: metrics.totalCost,
        cacheHitRate,
        batchingRate: 0, // Would need endpoint-specific batching data
        optimization,
        recommendations,
      });
    }
    
    // Sort by total cost (highest first)
    return endpoints.sort((a, b) => b.totalCost - a.totalCost);
  }
  
  private calculateOptimizationScore(metrics: any, cacheHitRate: number): 'excellent' | 'good' | 'fair' | 'poor' {
    let score = 0;
    
    // Cache hit rate scoring (40% weight)
    if (cacheHitRate >= 80) score += 40;
    else if (cacheHitRate >= 60) score += 30;
    else if (cacheHitRate >= 40) score += 20;
    else score += 10;
    
    // Average duration scoring (30% weight)
    if (metrics.averageDuration <= 100) score += 30;
    else if (metrics.averageDuration <= 500) score += 20;
    else if (metrics.averageDuration <= 1000) score += 10;
    else score += 5;
    
    // Query frequency scoring (30% weight)
    if (metrics.totalQueries <= 100) score += 30;
    else if (metrics.totalQueries <= 500) score += 20;
    else if (metrics.totalQueries <= 1000) score += 10;
    else score += 5;
    
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }
  
  private generateEndpointRecommendations(endpoint: string, metrics: any, cacheHitRate: number): string[] {
    const recommendations: string[] = [];
    
    if (cacheHitRate < 50) {
      recommendations.push('Increase cache TTL or enable stale-while-revalidate');
    }
    
    if (metrics.averageDuration > 1000) {
      recommendations.push('Optimize database queries or add database indexes');
    }
    
    if (metrics.totalQueries > 1000) {
      recommendations.push('Consider implementing query batching or result aggregation');
    }
    
    if (metrics.totalCost > 1.0) {
      recommendations.push('High cost endpoint - prioritize optimization efforts');
    }
    
    return recommendations;
  }
  
  private generatePerformanceMetrics(costStats: any, cacheStats: any, batchStats: any): CostDashboardData['performance'] {
    return {
      queryMetrics: {
        totalQueries: costStats.queries.lastDay,
        avgQueryTime: 150, // Would calculate from actual data
        slowestQueries: this.getSlowQueryAnalysis(),
      },
      connectionMetrics: {
        currentConnections: costStats.connections.current,
        maxConnections: costStats.connections.limit,
        connectionEfficiency: this.calculateConnectionEfficiency(costStats),
      },
      cacheMetrics: {
        totalRequests: cacheStats.cache.totalRequests,
        cacheHits: cacheStats.cache.cacheHits,
        cacheMisses: cacheStats.cache.cacheMisses,
        hitRate: cacheStats.cache.hitRate,
        memorySaved: cacheStats.performance.bytesServed / 1024 / 1024, // MB
      },
      batchingMetrics: {
        totalQueries: batchStats.metrics.totalQueries,
        batchedQueries: batchStats.metrics.batchedQueries,
        batchingRate: batchStats.metrics.batchingRate,
        connectionsSaved: batchStats.metrics.connectionsSaved,
        timeSaved: batchStats.metrics.totalTimeSaved,
      },
    };
  }
  
  private getSlowQueryAnalysis(): Array<{ endpoint: string; duration: number; count: number }> {
    const endpointMetrics = globalDatabaseCostProtector.getEndpointMetrics();
    const slowQueries: Array<{ endpoint: string; duration: number; count: number }> = [];
    
    // Handle different return types from getEndpointMetrics
    const metricsMap = endpointMetrics instanceof Map ? endpointMetrics : new Map();
    
    for (const [endpoint, metrics] of metricsMap) {
      if (metrics.averageDuration > 500) { // Consider >500ms as slow
        slowQueries.push({
          endpoint,
          duration: metrics.averageDuration,
          count: metrics.operationCount,
        });
      }
    }
    
    return slowQueries.sort((a, b) => b.duration - a.duration).slice(0, 10);
  }
  
  private calculateConnectionEfficiency(costStats: any): number {
    const utilizationRate = costStats.connections.current / costStats.connections.limit;
    return Math.min(100, utilizationRate * 100);
  }
  
  private generateTrends(): CostDashboardData['trends'] {
    const hourlyUsage: CostDashboardData['trends']['hourlyUsage'] = [];
    const dailyTrends: CostDashboardData['trends']['dailyTrends'] = [];
    
    // Generate hourly usage for last 24 hours
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourKey = hour.toISOString().substring(0, 13);
      const data = this.historicalData.get(hourKey) || [];
      
      const avgData = this.calculateHourlyAverage(data);
      hourlyUsage.push({
        hour: hour.toISOString(),
        queries: avgData.queries,
        cost: avgData.cost,
        cacheHitRate: avgData.cacheHitRate,
      });
    }
    
    // Generate daily trends for last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().substring(0, 10);
      
      const dailyData = this.calculateDailyAggregate(dateKey);
      dailyTrends.push({
        date: dateKey,
        totalQueries: dailyData.queries,
        totalCost: dailyData.cost,
        efficiency: dailyData.efficiency,
      });
    }
    
    return { hourlyUsage, dailyTrends };
  }
  
  private calculateHourlyAverage(data: Array<{ queries: number; cost: number; cacheHitRate: number }>): {
    queries: number;
    cost: number;
    cacheHitRate: number;
  } {
    if (data.length === 0) {
      return { queries: 0, cost: 0, cacheHitRate: 0 };
    }
    
    const sum = data.reduce((acc, item) => ({
      queries: acc.queries + item.queries,
      cost: acc.cost + item.cost,
      cacheHitRate: acc.cacheHitRate + item.cacheHitRate,
    }), { queries: 0, cost: 0, cacheHitRate: 0 });
    
    return {
      queries: Math.round(sum.queries / data.length),
      cost: parseFloat((sum.cost / data.length).toFixed(4)),
      cacheHitRate: parseFloat((sum.cacheHitRate / data.length).toFixed(2)),
    };
  }
  
  private calculateDailyAggregate(dateKey: string): {
    queries: number;
    cost: number;
    efficiency: number;
  } {
    let totalQueries = 0;
    let totalCost = 0;
    let totalCacheHitRate = 0;
    let dataPoints = 0;
    
    // Aggregate all hours for this date
    for (let hour = 0; hour < 24; hour++) {
      const hourKey = `${dateKey}T${hour.toString().padStart(2, '0')}`;
      const hourData = this.historicalData.get(hourKey) || [];
      
      for (const point of hourData) {
        totalQueries += point.queries;
        totalCost += point.cost;
        totalCacheHitRate += point.cacheHitRate;
        dataPoints++;
      }
    }
    
    return {
      queries: totalQueries,
      cost: parseFloat(totalCost.toFixed(4)),
      efficiency: dataPoints > 0 ? parseFloat((totalCacheHitRate / dataPoints).toFixed(2)) : 0,
    };
  }
  
  private getRecentAlerts(): CostDashboardData['alerts'] {
    return this.alerts.slice(-20); // Return last 20 alerts
  }
  
  private generateRecommendations(costStats: any, cacheStats: any, batchStats: any): CostDashboardData['recommendations'] {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];
    
    // Immediate recommendations
    if (costStats.emergency.mode) {
      immediate.push('Emergency mode active - disable non-essential endpoints');
    }
    
    if (cacheStats.cache.hitRate < 30) {
      immediate.push('Low cache hit rate - increase TTL values for stable endpoints');
    }
    
    if (batchStats.metrics.batchingRate < 20) {
      immediate.push('Low query batching rate - enable batching for read operations');
    }
    
    // Short-term recommendations
    if (costStats.cost.hourlyRate > costStats.cost.hourlyLimit * 0.7) {
      shortTerm.push('Approaching cost limits - implement query result caching');
    }
    
    if (costStats.connections.current > costStats.connections.limit * 0.8) {
      shortTerm.push('High connection usage - implement connection pooling optimization');
    }
    
    // Long-term recommendations
    longTerm.push('Consider implementing read replicas for heavy read workloads');
    longTerm.push('Evaluate query patterns for potential database schema optimizations');
    longTerm.push('Implement automated query performance monitoring');
    
    // Calculate potential savings
    const potentialSavings = this.calculatePotentialSavings(costStats, cacheStats, batchStats);
    
    return {
      immediate,
      shortTerm,
      longTerm,
      potentialSavings,
    };
  }
  
  private calculatePotentialSavings(costStats: any, cacheStats: any, batchStats: any) {
    // Calculate potential savings from various optimizations
    const cachingImprovements = (100 - cacheStats.cache.hitRate) * 0.01 * costStats.cost.total;
    const batchingImprovements = (100 - batchStats.metrics.batchingRate) * 0.005 * costStats.cost.total;
    const queryOptimizations = costStats.cost.total * 0.1; // Assume 10% potential from query optimization
    
    return {
      cachingImprovements: parseFloat(cachingImprovements.toFixed(2)),
      batchingImprovements: parseFloat(batchingImprovements.toFixed(2)),
      queryOptimizations: parseFloat(queryOptimizations.toFixed(2)),
      totalPotential: parseFloat((cachingImprovements + batchingImprovements + queryOptimizations).toFixed(2)),
    };
  }
  
  private generateThresholds(costStats: any, cacheStats: any, batchStats: any): CostDashboardData['thresholds'] {
    return {
      queries: {
        current: costStats.queries.lastHour,
        warning: costStats.queries.perHourLimit * 0.8,
        critical: costStats.queries.perHourLimit,
      },
      cost: {
        current: costStats.cost.hourlyRate,
        warning: costStats.cost.hourlyLimit * 0.8,
        critical: costStats.cost.hourlyLimit,
      },
      performance: {
        avgResponseTime: 250, // ms
        cacheHitRate: cacheStats.cache.hitRate,
        batchingRate: batchStats.metrics.batchingRate,
      },
    };
  }
  
  /**
   * Add an alert to the monitoring system
   */
  addAlert(
    severity: 'info' | 'warning' | 'error' | 'critical',
    title: string,
    message: string,
    endpoint?: string,
    action?: string
  ): void {
    this.alerts.push({
      severity,
      title,
      message,
      timestamp: new Date().toISOString(),
      endpoint,
      action,
    });
    
    console.log(`[COST ALERT] ${severity.toUpperCase()}: ${title} - ${message}`);
  }
  
  /**
   * Get optimization recommendations for a specific endpoint
   */
  getEndpointOptimizationAdvice(endpoint: string): {
    currentPerformance: any;
    recommendations: string[];
    potentialSavings: number;
  } {
    const endpointMetrics = globalDatabaseCostProtector.getEndpointMetrics();
    
    // Handle different return types from getEndpointMetrics
    const metricsMap = endpointMetrics instanceof Map ? endpointMetrics : new Map();
    const metrics = metricsMap.get(endpoint);
    
    if (!metrics) {
      return {
        currentPerformance: null,
        recommendations: ['No data available for this endpoint'],
        potentialSavings: 0,
      };
    }
    
    const recommendations = this.generateEndpointRecommendations(
      endpoint,
      metrics,
      75 // Mock cache hit rate
    );
    
    const potentialSavings = metrics.totalCost * 0.3; // Assume 30% potential savings
    
    return {
      currentPerformance: metrics,
      recommendations,
      potentialSavings,
    };
  }
}

// Global instance
export const globalCostMonitoringService = CostMonitoringDashboardService.getInstance();

/**
 * Get comprehensive cost monitoring dashboard data
 */
export function getCostDashboardData(): CostDashboardData {
  return globalCostMonitoringService.getDashboardData();
}

/**
 * Add a cost monitoring alert
 */
export function addCostAlert(
  severity: 'info' | 'warning' | 'error' | 'critical',
  title: string,
  message: string,
  endpoint?: string,
  action?: string
): void {
  globalCostMonitoringService.addAlert(severity, title, message, endpoint, action);
}

/**
 * Get optimization advice for a specific endpoint
 */
export function getEndpointOptimizationAdvice(endpoint: string) {
  return globalCostMonitoringService.getEndpointOptimizationAdvice(endpoint);
}