"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Settings, AlertTriangle } from "lucide-react";
import Link from "next/link";

// Extracted Components
import { WorkflowStatusCard } from "@/src/components/dashboard/workflow-status-card";
import { MetricsGrid } from "@/src/components/dashboard/metrics-grid";
import { ActivityFeed } from "@/src/components/dashboard/activity-feed";
import { TradingTargets } from "@/src/components/dashboard/trading-targets";
import { AccountBalance } from "@/src/components/account-balance";

// Existing Components
import { CoinCalendar } from "@/components/coin-calendar";
import { UserPreferences } from "@/src/components/user-preferences";
import { EmergencyDashboard } from "@/src/components/emergency-dashboard";

// Hooks
import { useDashboardState } from "@/src/hooks/use-dashboard-state";
import { useMexcCalendar, useMexcConnectivity, useRefreshMexcCalendar } from "@/src/hooks/use-mexc-data";
import { usePatternSniper } from "@/src/hooks/use-pattern-sniper";
import { useAuth } from "@/src/lib/auth-client";

export default function DashboardPage() {
  const [showPreferences, setShowPreferences] = useState(false);
  
  // Auth status
  const { user, isAuthenticated, isAnonymous } = useAuth();
  const userId = user?.id || "anonymous";

  // Core dashboard state
  const {
    workflowStatus,
    isLoading,
    isDiscoveryRunning,
    lastRefresh,
    error: dashboardError,
    togglePatternDiscovery,
    runDiscoveryCycle,
    refreshStatus,
    clearError,
  } = useDashboardState({ userId });

  // MEXC data hooks
  const { data: calendarData, isLoading: calendarLoading, error: calendarError } = useMexcCalendar();
  const { data: mexcConnected } = useMexcConnectivity();
  const refreshCalendar = useRefreshMexcCalendar();

  // Pattern Sniper integration
  const {
    isMonitoring,
    isConnected: sniperConnected,
    calendarTargets,
    pendingDetection,
    readyTargets: sniperReadyTargets,
    stats: sniperStats,
    startMonitoring,
    stopMonitoring,
    clearAllTargets,
    forceRefresh,
    executeSnipe,
    removeTarget,
    errors: sniperErrors,
  } = usePatternSniper();

  // Error state
  const hasErrors = dashboardError || calendarError || sniperErrors?.calendar || sniperErrors?.symbols;

  // Event handlers
  const handleExecuteSnipe = async (target: any) => {
    try {
      await executeSnipe(target);
    } catch (error) {
      console.error('Failed to execute snipe:', error);
    }
  };

  const handleRemoveTarget = async (vcoinId: string) => {
    try {
      await removeTarget(vcoinId);
    } catch (error) {
      console.error('Failed to remove target:', error);
    }
  };

  const handleTogglePreferences = () => {
    setShowPreferences(!showPreferences);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            MEXC Sniper Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Real-time cryptocurrency pattern detection and trading automation
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Auth Status */}
          <Badge variant={isAuthenticated ? "default" : "secondary"}>
            {isAuthenticated ? `${user?.name || user?.email || 'User'}` : 'Anonymous'}
          </Badge>
          
          {/* Settings */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTogglePreferences}
          >
            <Settings className="h-4 w-4 mr-2" />
            Preferences
          </Button>
          
          {/* Emergency Access */}
          <Link href="/sniper">
            <Button variant="outline" size="sm">
              Emergency Access
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {hasErrors && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="font-medium text-red-800">System Errors Detected</span>
          </div>
          <div className="mt-2 space-y-1 text-sm text-red-700">
            {dashboardError && <div>Dashboard: {dashboardError}</div>}
            {calendarError && <div>Calendar: {calendarError.message}</div>}
            {sniperErrors?.calendar && <div>Sniper Calendar: {sniperErrors.calendar.message}</div>}
            {sniperErrors?.symbols && <div>Sniper Symbols: {sniperErrors.symbols.message}</div>}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearError}
            className="mt-3 text-red-700 border-red-300"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* User Preferences Modal */}
      {showPreferences && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">User Preferences</h2>
              <Button variant="outline" onClick={() => setShowPreferences(false)}>
                Close
              </Button>
            </div>
            <UserPreferences userId={userId} />
          </div>
        </div>
      )}

      {/* Main Dashboard Grid */}
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column - Status & Metrics */}
        <div className="lg:col-span-8 space-y-8">
          {/* System Status & Account Balance */}
          <div className="grid md:grid-cols-2 gap-6">
            <WorkflowStatusCard
              workflowStatus={workflowStatus}
              isLoading={isLoading}
              isDiscoveryRunning={isDiscoveryRunning}
              lastRefresh={lastRefresh}
              mexcConnected={mexcConnected}
              sniperConnected={sniperConnected}
              onRefresh={refreshStatus}
              onToggleMonitoring={togglePatternDiscovery}
              onRunDiscovery={runDiscoveryCycle}
            />
            
            <AccountBalance 
              userId={userId}
              className="h-fit"
            />
          </div>

          {/* Performance Metrics */}
          <MetricsGrid
            metrics={workflowStatus?.metrics}
            sniperStats={{
              totalTargets: sniperStats?.totalListings || 0,
              readyTargets: sniperStats?.readyToSnipe || 0,
              executedTargets: sniperStats?.executed || 0,
            }}
            calendarTargets={calendarTargets?.length || 0}
            pendingDetection={pendingDetection?.length || 0}
            isLoading={isLoading}
          />

          {/* Trading Targets */}
          <TradingTargets
            readyTargets={sniperReadyTargets}
            pendingDetection={pendingDetection}
            calendarTargets={calendarTargets}
            onExecuteSnipe={handleExecuteSnipe}
            onRemoveTarget={handleRemoveTarget}
            isLoading={isLoading}
          />
        </div>

        {/* Right Column - Activity & Calendar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Recent Activity */}
          <ActivityFeed
            activities={workflowStatus?.recentActivity}
            isLoading={isLoading}
          />

          {/* MEXC Calendar */}
          <CoinCalendar />

          {/* Emergency Dashboard */}
          <EmergencyDashboard />
        </div>
      </div>
    </div>
  );
}