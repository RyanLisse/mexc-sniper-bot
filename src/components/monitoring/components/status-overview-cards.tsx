/**
 * Status Overview Cards Component
 *
 * High-level status overview cards for the production monitoring dashboard.
 * Extracted from the main dashboard component for better modularity.
 */

import { AlertTriangle, Clock, TrendingUp } from "lucide-react";
import React from "react";
import { Card, CardContent } from "@/src/components/ui/card";
import type { ProductionMetrics } from "../types/monitoring-types";
import {
  formatUptime,
  getStatusColor,
  getStatusIcon,
} from "../utils/monitoring-utils";

interface StatusOverviewCardsProps {
  metrics: ProductionMetrics;
}

export function StatusOverviewCards({ metrics }: StatusOverviewCardsProps) {
  const StatusIcon = getStatusIcon(metrics.deployment.status);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <StatusIcon className="h-4 w-4" />
            <div>
              <p className="text-sm text-gray-600">Deployment Status</p>
              <p
                className={`font-semibold ${getStatusColor(
                  metrics.deployment.status
                )}`}
              >
                {metrics.deployment.status.toUpperCase()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">System Score</p>
              <p className="font-semibold text-blue-600">
                {metrics.system.score}/100
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Uptime</p>
              <p className="font-semibold text-green-600">
                {formatUptime(metrics.deployment.uptime)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <div>
              <p className="text-sm text-gray-600">Active Alerts</p>
              <p className="font-semibold text-orange-600">
                {metrics.alerts.critical + metrics.alerts.warnings}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
