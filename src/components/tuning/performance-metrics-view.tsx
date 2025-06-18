"use client";

/**
 * Performance Metrics View Component
 *
 * Displays real-time and historical performance metrics for trading operations,
 * including response times, throughput, error rates, and system health indicators.
 */

import { Activity, TrendingUp, TrendingDown, Zap, AlertTriangle, CheckCircle2, Clock, BarChart3 } from "lucide-react";
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "../ui/button";

interface PerformanceMetric {
  timestamp: string;
  operation: string;
  responseTime: number;
  throughput: number;
  errorRate: number;
  successRate: number;
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
}

interface MetricSummary {
  name: string;
  current: number;
  previous: number;
  unit: string;
  threshold: {
    good: number;
    warning: number;
    critical: number;
  };
  trend: 'up' | 'down' | 'stable';
  status: 'healthy' | 'warning' | 'critical';
}

interface PerformanceMetricsViewProps {
  metrics: PerformanceMetric[];
  isRealTime?: boolean;
  onRefresh?: () => void;
  onExport?: (format: 'csv' | 'json') => void;
}

export function PerformanceMetricsView({ 
  metrics, 
  isRealTime = false, 
  onRefresh, 
  onExport 
}: PerformanceMetricsViewProps) {
  const [timeRange, setTimeRange] = useState<string>('1h');
  const [selectedOperation, setSelectedOperation] = useState<string>('all');

  const operations = useMemo(() => {
    const ops = [...new Set(metrics.map(m => m.operation))];
    return ['all', ...ops];
  }, [metrics]);

  const filteredMetrics = useMemo(() => {
    const now = Date.now();
    const timeRanges = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };

    const cutoff = now - timeRanges[timeRange as keyof typeof timeRanges];
    
    return metrics
      .filter(m => new Date(m.timestamp).getTime() > cutoff)
      .filter(m => selectedOperation === 'all' || m.operation === selectedOperation)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [metrics, timeRange, selectedOperation]);

  const metricSummaries = useMemo(() => {
    if (filteredMetrics.length === 0) return [];

    const latest = filteredMetrics[filteredMetrics.length - 1];
    const previous = filteredMetrics[Math.max(0, filteredMetrics.length - 10)];

    const summaries: MetricSummary[] = [
      {
        name: 'Response Time',
        current: latest.responseTime,
        previous: previous.responseTime,
        unit: 'ms',
        threshold: { good: 500, warning: 2000, critical: 5000 },
        trend: latest.responseTime > previous.responseTime * 1.1 ? 'up' : 
               latest.responseTime < previous.responseTime * 0.9 ? 'down' : 'stable',
        status: latest.responseTime <= 500 ? 'healthy' : 
                latest.responseTime <= 2000 ? 'warning' : 'critical',
      },
      {
        name: 'Throughput',
        current: latest.throughput,
        previous: previous.throughput,
        unit: 'req/s',
        threshold: { good: 10, warning: 5, critical: 1 },
        trend: latest.throughput > previous.throughput * 1.1 ? 'up' : 
               latest.throughput < previous.throughput * 0.9 ? 'down' : 'stable',
        status: latest.throughput >= 10 ? 'healthy' : 
                latest.throughput >= 5 ? 'warning' : 'critical',
      },
      {
        name: 'Error Rate',
        current: latest.errorRate * 100,
        previous: previous.errorRate * 100,
        unit: '%',
        threshold: { good: 1, warning: 5, critical: 10 },
        trend: latest.errorRate > previous.errorRate * 1.1 ? 'up' : 
               latest.errorRate < previous.errorRate * 0.9 ? 'down' : 'stable',
        status: latest.errorRate <= 0.01 ? 'healthy' : 
                latest.errorRate <= 0.05 ? 'warning' : 'critical',
      },
      {
        name: 'Success Rate',
        current: latest.successRate * 100,
        previous: previous.successRate * 100,
        unit: '%',
        threshold: { good: 99, warning: 95, critical: 90 },
        trend: latest.successRate > previous.successRate * 1.01 ? 'up' : 
               latest.successRate < previous.successRate * 0.99 ? 'down' : 'stable',
        status: latest.successRate >= 0.99 ? 'healthy' : 
                latest.successRate >= 0.95 ? 'warning' : 'critical',
      },
      {
        name: 'CPU Usage',
        current: latest.cpuUsage,
        previous: previous.cpuUsage,
        unit: '%',
        threshold: { good: 50, warning: 80, critical: 95 },
        trend: latest.cpuUsage > previous.cpuUsage * 1.1 ? 'up' : 
               latest.cpuUsage < previous.cpuUsage * 0.9 ? 'down' : 'stable',
        status: latest.cpuUsage <= 50 ? 'healthy' : 
                latest.cpuUsage <= 80 ? 'warning' : 'critical',
      },
      {
        name: 'Memory Usage',
        current: latest.memoryUsage,
        previous: previous.memoryUsage,
        unit: 'MB',
        threshold: { good: 512, warning: 1024, critical: 2048 },
        trend: latest.memoryUsage > previous.memoryUsage * 1.1 ? 'up' : 
               latest.memoryUsage < previous.memoryUsage * 0.9 ? 'down' : 'stable',
        status: latest.memoryUsage <= 512 ? 'healthy' : 
                latest.memoryUsage <= 1024 ? 'warning' : 'critical',
      },
    ];

    return summaries;
  }, [filteredMetrics]);

  const overallHealth = useMemo(() => {
    if (metricSummaries.length === 0) return { status: 'warning', score: 0 };
    
    const healthyCount = metricSummaries.filter(m => m.status === 'healthy').length;
    const warningCount = metricSummaries.filter(m => m.status === 'warning').length;
    const criticalCount = metricSummaries.filter(m => m.status === 'critical').length;
    
    const score = (healthyCount * 100 + warningCount * 60) / metricSummaries.length;
    
    const status = criticalCount > 0 ? 'critical' : 
                   warningCount > healthyCount ? 'warning' : 'healthy';
    
    return { status, score: Math.round(score) };
  }, [metricSummaries]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-green-500" />;
      default:
        return <span className="h-3 w-3" />;
    }
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === '%') {
      return `${value.toFixed(1)}${unit}`;
    } else if (unit === 'ms') {
      return `${Math.round(value)}${unit}`;
    } else if (unit === 'req/s') {
      return `${value.toFixed(1)} ${unit}`;
    } else if (unit === 'MB') {
      return `${Math.round(value)} ${unit}`;
    }
    return `${value} ${unit}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Metrics</h2>
          <p className="text-muted-foreground">
            {isRealTime && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Live monitoring
              </span>
            )}
            {filteredMetrics.length} data points
          </p>
        </div>

        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">5m</SelectItem>
              <SelectItem value="15m">15m</SelectItem>
              <SelectItem value="1h">1h</SelectItem>
              <SelectItem value="6h">6h</SelectItem>
              <SelectItem value="24h">24h</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedOperation} onValueChange={setSelectedOperation}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operations.map(op => (
                <SelectItem key={op} value={op}>
                  {op === 'all' ? 'All Operations' : op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          )}

          {onExport && (
            <Select onValueChange={(format) => onExport(format as 'csv' | 'json')}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="Export" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Overall Health Score */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon(overallHealth.status)}
            System Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress 
                value={overallHealth.score} 
                className={`h-3 ${
                  overallHealth.status === 'healthy' ? 'bg-green-100' :
                  overallHealth.status === 'warning' ? 'bg-yellow-100' : 'bg-red-100'
                }`}
              />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{overallHealth.score}</div>
              <div className="text-sm text-muted-foreground">Health Score</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricSummaries.map((metric) => (
          <Card key={metric.name}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {metric.name}
                </span>
                <div className="flex items-center gap-1">
                  {getTrendIcon(metric.trend)}
                  {getStatusIcon(metric.status)}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  {formatValue(metric.current, metric.unit)}
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    vs {formatValue(metric.previous, metric.unit)}
                  </span>
                  <Badge 
                    variant={metric.status === 'healthy' ? 'default' : 
                             metric.status === 'warning' ? 'secondary' : 'destructive'}
                    className="text-xs"
                  >
                    {metric.status}
                  </Badge>
                </div>

                {/* Threshold Indicator */}
                <div className="relative">
                  <Progress 
                    value={Math.min(100, (metric.current / metric.threshold.critical) * 100)} 
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0</span>
                    <span>{metric.threshold.good}{metric.unit}</span>
                    <span>{metric.threshold.critical}{metric.unit}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      {filteredMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Recent Activity ({timeRange})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredMetrics.slice(-10).reverse().map((metric, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{metric.operation}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(metric.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <div className="font-medium">{Math.round(metric.responseTime)}ms</div>
                      <div className="text-muted-foreground">Response</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{metric.throughput.toFixed(1)}</div>
                      <div className="text-muted-foreground">req/s</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium ${
                        metric.errorRate === 0 ? 'text-green-600' : 
                        metric.errorRate < 0.05 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {(metric.errorRate * 100).toFixed(1)}%
                      </div>
                      <div className="text-muted-foreground">Errors</div>
                    </div>
                    
                    <Badge 
                      variant={
                        metric.errorRate === 0 && metric.responseTime < 1000 ? 'default' :
                        metric.errorRate < 0.05 && metric.responseTime < 2000 ? 'secondary' : 'destructive'
                      }
                    >
                      {metric.errorRate === 0 && metric.responseTime < 1000 ? 'Good' :
                       metric.errorRate < 0.05 && metric.responseTime < 2000 ? 'Fair' : 'Poor'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {filteredMetrics.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Performance Data</h3>
            <p className="text-muted-foreground mb-4">
              No metrics found for the selected time range and operation.
            </p>
            {onRefresh && (
              <Button onClick={onRefresh}>
                <Zap className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PerformanceMetricsView;