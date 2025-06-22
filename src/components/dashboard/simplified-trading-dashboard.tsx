"use client";

import { Activity, AlertTriangle, DollarSign, Hash, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { SimpleAutoSnipingControl } from "../auto-sniping/simple-auto-sniping-control";
import { UnifiedStatusBadge } from "../status/unified-status-display";
import { useStatus } from "../../contexts/status-context";
import { useAutoSnipingExecution } from "../../hooks/use-auto-sniping-execution";

/**
 * Simplified Trading Dashboard
 * 
 * Replaces complex technical dashboards with user-friendly essential information:
 * - Clear auto-sniping control
 * - Simple connection status
 * - Essential trading metrics
 * - User-friendly error messages
 */

interface SimplifiedTradingDashboardProps {
  className?: string;
}

export function SimplifiedTradingDashboard({ className = "" }: SimplifiedTradingDashboardProps) {
  const { status, getOverallStatus } = useStatus();
  const overallStatus = getOverallStatus();
  
  const {
    activePositionsCount,
    totalPnl,
    successRate,
    dailyTradeCount,
    stats,
  } = useAutoSnipingExecution({
    autoRefresh: true,
    refreshInterval: 30000,
    loadOnMount: true,
    includePositions: true,
    includeHistory: false,
    includeAlerts: false,
  });

  const pnlValue = Number.parseFloat(totalPnl);
  const isSystemReady = overallStatus === "healthy";

  return (
    <div className={`space-y-6 ${className}`}>
      {/* System Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Trading System
              </CardTitle>
              <CardDescription>
                {isSystemReady 
                  ? "System ready for automated trading"
                  : "System requires attention before trading"
                }
              </CardDescription>
            </div>
            <UnifiedStatusBadge />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Active Positions */}
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Hash className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{activePositionsCount}</span>
              </div>
              <p className="text-sm text-gray-600">Active Trades</p>
            </div>

            {/* Total P&L */}
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className={`flex items-center justify-center gap-2 mb-2 ${
                pnlValue >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                <DollarSign className="h-5 w-5" />
                <span className="text-2xl font-bold">
                  {pnlValue >= 0 ? "+" : ""}{pnlValue.toFixed(1)}
                </span>
              </div>
              <p className="text-sm text-gray-600">Total P&L (USDT)</p>
            </div>

            {/* Success Rate */}
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold">{successRate.toFixed(0)}%</span>
              </div>
              <p className="text-sm text-gray-600">Success Rate</p>
            </div>

            {/* Daily Trades */}
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-orange-500" />
                <span className="text-2xl font-bold">{dailyTradeCount}</span>
              </div>
              <p className="text-sm text-gray-600">Today's Trades</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Sniping Control */}
      <SimpleAutoSnipingControl showAdvancedSettings={false} />

      {/* Performance Summary - Only show if there's trading activity */}
      {(stats?.totalTrades || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-blue-600">
                  {stats?.totalTrades || 0}
                </div>
                <p className="text-sm text-gray-600">Total Trades</p>
              </div>
              <div>
                <div className="text-xl font-bold text-green-600">
                  {stats?.successfulTrades || 0}
                </div>
                <p className="text-sm text-gray-600">Successful</p>
              </div>
              <div>
                <div className="text-xl font-bold text-red-600">
                  {stats?.failedTrades || 0}
                </div>
                <p className="text-sm text-gray-600">Failed</p>
              </div>
              <div>
                <div className={`text-xl font-bold ${
                  pnlValue >= 0 ? "text-green-600" : "text-red-600"
                }`}>
                  {pnlValue >= 0 ? "+" : ""}{pnlValue.toFixed(2)}
                </div>
                <p className="text-sm text-gray-600">Net P&L (USDT)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Issues Alert */}
      {!isSystemReady && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              System Setup Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-yellow-700">
              {!status.network.connected && (
                <p>• Check your internet connection</p>
              )}
              {!status.credentials.hasCredentials && (
                <p>• Configure your MEXC API credentials in Settings</p>
              )}
              {!status.credentials.isValid && status.credentials.hasCredentials && (
                <p>• Verify your MEXC API credentials are correct</p>
              )}
              {!status.trading.canTrade && status.credentials.isValid && (
                <p>• Check your MEXC account trading permissions</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SimplifiedTradingDashboard;