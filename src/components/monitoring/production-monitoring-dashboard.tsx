"use client";

/**
 * Production Monitoring Dashboard Component - Refactored
 *
 * Real-time production monitoring interface for operations teams with
 * system health, performance metrics, alerts, and deployment status.
 *
 * Modular architecture with components under 500 LOC for better maintainability.
 */

import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { AlertsTab } from "./components/alerts-tab";
// Modular component imports
import { DashboardHeader } from "./components/dashboard-header";
import { OverviewTab } from "./components/overview-tab";
import { PerformanceTab } from "./components/performance-tab";
import { ServicesTab } from "./components/services-tab";
import { StatusOverviewCards } from "./components/status-overview-cards";
import { SystemTab } from "./components/system-tab";

// Type imports
import type {
  MonitoringDashboardProps,
  ProductionMetrics,
} from "./types/monitoring-types";

export function ProductionMonitoringDashboard({
  autoRefreshInterval = 30000,
  className = "",
}: MonitoringDashboardProps = {}) {
  const [metrics, setMetrics] = useState<ProductionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch production metrics
  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/production/status");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setMetrics(data.data.metrics);
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, autoRefreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, autoRefreshInterval, fetchMetrics]);

  // Loading state
  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading production metrics...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load production metrics: {error}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // No metrics available
  if (!metrics) {
    return <div>No metrics available</div>;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Dashboard Header */}
      <DashboardHeader
        lastUpdate={lastUpdate}
        autoRefresh={autoRefresh}
        onAutoRefreshToggle={() => setAutoRefresh(!autoRefresh)}
        onRefreshNow={fetchMetrics}
      />

      {/* Status Overview Cards */}
      <StatusOverviewCards metrics={metrics} />

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab metrics={metrics} />
        </TabsContent>

        <TabsContent value="system">
          <SystemTab metrics={metrics} />
        </TabsContent>

        <TabsContent value="services">
          <ServicesTab metrics={metrics} />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceTab metrics={metrics} />
        </TabsContent>

        <TabsContent value="alerts">
          <AlertsTab metrics={metrics} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
