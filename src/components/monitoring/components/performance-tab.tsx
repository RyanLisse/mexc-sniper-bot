/**
 * Performance Tab Component
 *
 * Performance monitoring tab content for the production monitoring dashboard.
 * Extracted from the main dashboard component for better modularity.
 */

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import type { ProductionMetrics } from "../types/monitoring-types";

interface PerformanceTabProps {
  metrics: ProductionMetrics;
}

export function PerformanceTab({ metrics }: PerformanceTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>24-Hour Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Average Response Time</p>
                  <p className="text-2xl font-bold">
                    {metrics.performance.last24h.averageResponseTime}ms
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Throughput</p>
                  <p className="text-2xl font-bold">
                    {metrics.performance.last24h.throughput}/min
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Error Rate</p>
                  <p className="text-2xl font-bold">
                    {metrics.performance.last24h.errorRate}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Uptime</p>
                  <p className="text-2xl font-bold">
                    {metrics.performance.last24h.uptime}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Requests per Minute</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {metrics.performance.current.requestsPerMinute}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Errors per Minute</p>
                  <p className="text-2xl font-bold text-red-600">
                    {metrics.performance.current.errorsPerMinute}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Connections</p>
                  <p className="text-2xl font-bold text-green-600">
                    {metrics.performance.current.activeConnections}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
