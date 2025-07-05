/**
 * Overview Tab Component
 *
 * Overview tab content for the production monitoring dashboard.
 * Extracted from the main dashboard component for better modularity.
 */

import { Activity, Globe, Server } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Progress } from "@/src/components/ui/progress";
import type { ProductionMetrics } from "../types/monitoring-types";
import { formatBytes } from "../utils/monitoring-utils";

interface OverviewTabProps {
  metrics: ProductionMetrics;
}

export function OverviewTab({ metrics }: OverviewTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deployment Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Globe className="h-5 w-5" />
              <span>Deployment Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Version:</span>
                <Badge variant="outline">{metrics.deployment.version}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Build ID:</span>
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                  {metrics.deployment.buildId.slice(0, 12)}...
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Region:</span>
                <span>{metrics.deployment.region}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Deployed:</span>
                <span>
                  {new Date(metrics.deployment.deployedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="h-5 w-5" />
              <span>System Resources</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Memory Usage</span>
                  <span>{metrics.system.memory.percentage}%</span>
                </div>
                <Progress value={metrics.system.memory.percentage} />
                <div className="text-xs text-gray-500 mt-1">
                  {formatBytes(metrics.system.memory.used)} /{" "}
                  {formatBytes(metrics.system.memory.total)}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Response Time</span>
                  <span>{metrics.system.responseTime}ms</span>
                </div>
                <Progress
                  value={Math.min(
                    (metrics.system.responseTime / 1000) * 100,
                    100
                  )}
                  className="bg-green-100"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Performance Overview (Last 24h)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {metrics.performance.last24h.averageResponseTime}ms
              </p>
              <p className="text-sm text-gray-600">Avg Response Time</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {metrics.performance.last24h.uptime.toFixed(2)}%
              </p>
              <p className="text-sm text-gray-600">Uptime</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {metrics.performance.last24h.throughput}
              </p>
              <p className="text-sm text-gray-600">Requests/min</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">
                {metrics.performance.last24h.errorRate.toFixed(2)}%
              </p>
              <p className="text-sm text-gray-600">Error Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
