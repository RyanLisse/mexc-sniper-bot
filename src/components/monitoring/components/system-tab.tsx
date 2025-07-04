/**
 * System Tab Component
 *
 * System monitoring tab content for the production monitoring dashboard.
 * Extracted from the main dashboard component for better modularity.
 */

import { CPU, Zap } from "lucide-react";
import React from "react";
import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Progress } from "@/src/components/ui/progress";
import type { ProductionMetrics } from "../types/monitoring-types";
import {
  formatBytes,
  getBadgeVariant,
  getStatusColor,
} from "../utils/monitoring-utils";

interface SystemTabProps {
  metrics: ProductionMetrics;
}

export function SystemTab({ metrics }: SystemTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CPU className="h-5 w-5" />
              <span>CPU & Memory</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Memory Usage</span>
                  <span>{metrics.system.memory.percentage}%</span>
                </div>
                <Progress value={metrics.system.memory.percentage} />
                <div className="text-xs text-gray-500 mt-1">
                  Used: {formatBytes(metrics.system.memory.used)} / Total:{" "}
                  {formatBytes(metrics.system.memory.total)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Response Time:</span>
                <Badge
                  variant={getBadgeVariant(metrics.system.responseTime, 500)}
                >
                  {metrics.system.responseTime}ms
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Health Score:</span>
                <Badge variant={getBadgeVariant(80, metrics.system.score)}>
                  {metrics.system.score}/100
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <Badge className={getStatusColor(metrics.system.health)}>
                  {metrics.system.health.toUpperCase()}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
