/**
 * Execution Stats Component
 *
 * Displays comprehensive execution statistics and metrics overview
 */

import { DollarSign, Hash, Percent } from "lucide-react";
import type { ExecutionStats as ExecutionStatsType } from "../schemas/validation-schemas";
import { StatusIndicator } from "./status-indicator";

interface ExecutionStatsProps {
  executionStatus: string;
  activePositionsCount: number;
  totalPnl: string;
  successRate: number;
  stats: ExecutionStatsType | null;
  formatCurrency: (value: string | number) => string;
}

export function ExecutionStats({
  executionStatus,
  activePositionsCount,
  totalPnl,
  successRate,
  stats,
  formatCurrency,
}: ExecutionStatsProps) {
  const pnlValue = Number.parseFloat(totalPnl);

  return (
    <div className="space-y-4">
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
          <StatusIndicator status={executionStatus} />
          <p className="text-sm text-gray-600 mt-2">Execution Status</p>
        </div>
        <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-blue-500" />
            <span className="text-2xl font-bold">{activePositionsCount}</span>
          </div>
          <p className="text-sm text-gray-600">Active Positions</p>
        </div>
        <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
          <div
            className={`flex items-center gap-2 ${pnlValue >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            <DollarSign className="h-5 w-5" />
            <span className="text-2xl font-bold">{formatCurrency(totalPnl)}</span>
          </div>
          <p className="text-sm text-gray-600">Total P&L</p>
        </div>
        <div className="flex flex-col items-center p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-purple-500" />
            <span className="text-2xl font-bold">{successRate.toFixed(1)}%</span>
          </div>
          <p className="text-sm text-gray-600">Success Rate</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-xl font-bold text-blue-600">{stats?.totalTrades ?? 0}</div>
          <p className="text-sm text-gray-600">Total Trades</p>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-green-600">{stats?.successfulTrades ?? 0}</div>
          <p className="text-sm text-gray-600">Successful</p>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-red-600">{stats?.failedTrades ?? 0}</div>
          <p className="text-sm text-gray-600">Failed</p>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-orange-600">{stats?.dailyTradeCount ?? 0}</div>
          <p className="text-sm text-gray-600">Today</p>
        </div>
      </div>
    </div>
  );
}
