/**
 * Performance Metrics Component
 *
 * Displays performance statistics and progress bars
 */

import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ExecutionStats } from "../../../services/auto-sniping-execution-service";

interface PerformanceMetricsProps {
  successRate: number;
  dailyTradeCount: number;
  maxDailyTrades?: number;
  stats?: ExecutionStats | null;
}

export function PerformanceMetrics({
  successRate,
  dailyTradeCount,
  maxDailyTrades = 0,
  stats,
}: PerformanceMetricsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Success Rate</span>
              <span className="text-sm font-medium">{successRate.toFixed(1)}%</span>
            </div>
            <Progress value={successRate} className="w-full" />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Daily Trade Progress</span>
              <span className="text-sm font-medium">
                {dailyTradeCount}/{maxDailyTrades}
              </span>
            </div>
            <Progress
              value={maxDailyTrades ? (dailyTradeCount / maxDailyTrades) * 100 : 0}
              className="w-full"
            />
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-lg font-semibold">{stats.averageExecutionTime.toFixed(0)}ms</div>
              <p className="text-xs text-gray-600">Avg Execution</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-lg font-semibold">{stats.averageSlippage.toFixed(2)}%</div>
              <p className="text-xs text-gray-600">Avg Slippage</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-lg font-semibold">{stats.maxDrawdown.toFixed(1)}%</div>
              <p className="text-xs text-gray-600">Max Drawdown</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded">
              <div className="text-lg font-semibold">{stats.averageTradeReturn.toFixed(1)}%</div>
              <p className="text-xs text-gray-600">Avg Return</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
