/**
 * Dashboard Header Component
 *
 * Header section for the production monitoring dashboard with controls.
 * Extracted from the main dashboard component for better modularity.
 */

import { RefreshCw } from "lucide-react";
import { Button } from "@/src/components/ui/button";

interface DashboardHeaderProps {
  lastUpdate: Date;
  autoRefresh: boolean;
  onAutoRefreshToggle: () => void;
  onRefreshNow: () => void;
}

export function DashboardHeader({
  lastUpdate,
  autoRefresh,
  onAutoRefreshToggle,
  onRefreshNow,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">Production Monitoring</h1>
        <p className="text-gray-600">
          Real-time system health and performance metrics
        </p>
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-sm text-gray-500">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
        <Button
          variant={autoRefresh ? "default" : "outline"}
          size="sm"
          onClick={onAutoRefreshToggle}
          className="flex items-center space-x-2"
        >
          <RefreshCw
            className={`h-4 w-4 ${autoRefresh ? "animate-spin" : ""}`}
          />
          <span>Auto-refresh</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onRefreshNow}>
          Refresh Now
        </Button>
      </div>
    </div>
  );
}
