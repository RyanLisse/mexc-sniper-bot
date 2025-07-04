/**
 * Alerts Tab Component
 *
 * Alerts monitoring tab content for the production monitoring dashboard.
 * Extracted from the main dashboard component for better modularity.
 */

import { AlertCircle, AlertTriangle, CheckCircle } from "lucide-react";
import React from "react";
import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import type { ProductionMetrics } from "../types/monitoring-types";

interface AlertsTabProps {
  metrics: ProductionMetrics;
}

export function AlertsTab({ metrics }: AlertsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Critical Alerts</p>
                <p className="text-2xl font-bold text-red-600">
                  {metrics.alerts.critical}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Warnings</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {metrics.alerts.warnings}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Notices</p>
                <p className="text-2xl font-bold text-blue-600">
                  {metrics.alerts.notices}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.alerts.recent.length > 0 ? (
            <div className="space-y-2">
              {metrics.alerts.recent.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.level === "critical"
                      ? "border-red-200 bg-red-50"
                      : alert.level === "warning"
                        ? "border-yellow-200 bg-yellow-50"
                        : "border-blue-200 bg-blue-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {alert.level === "critical" && (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                      {alert.level === "warning" && (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      )}
                      {alert.level === "notice" && (
                        <AlertTriangle className="h-4 w-4 text-blue-600" />
                      )}
                      <span className="font-medium">{alert.message}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {alert.service && (
                        <Badge variant="outline" className="text-xs">
                          {alert.service}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-600" />
              <p>No recent alerts - all systems operating normally</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
