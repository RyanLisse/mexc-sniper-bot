"use client";

import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Pause,
  Play,
  RefreshCw,
  Target,
  Trash2,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { type FC, memo, useCallback, useMemo, useState } from "react";
import { usePatternSniper } from "../hooks/use-pattern-sniper";
import { normalizeVcoinId } from "../utils/trading-data-transformers";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

// Utility functions
const formatUptime = (uptimeMs: number): string => {
  const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
  const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

const formatTimeRemaining = (targetTime: Date): string => {
  const now = new Date();
  const diff = targetTime.getTime() - now.getTime();

  if (diff <= 0) return "Now";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Component handles complex pattern detection UI with multiple conditional rendering paths
export const PatternSniperComponent: FC = memo(function PatternSniperComponent() {
  const {
    isMonitoring,
    isConnected,
    calendarTargets,
    pendingDetection,
    readyTargets,
    executedTargets,
    isLoading,
    errors,
    stats,
    startMonitoring,
    stopMonitoring,
    clearAllTargets,
    forceRefresh,
    executeSnipe,
    removeTarget,
  } = usePatternSniper();

  const [_selectedTarget, _setSelectedTarget] = useState<string | null>(null);

  // Memoized event handlers
  const handleExecuteSnipe = useCallback(
    (target: any) => {
      executeSnipe(target);
    },
    [executeSnipe]
  );

  const handleRemoveTarget = useCallback(
    (vcoinId: string) => {
      removeTarget(vcoinId);
    },
    [removeTarget]
  );

  const handleToggleMonitoring = useMemo(() => {
    return isMonitoring ? stopMonitoring : startMonitoring;
  }, [isMonitoring, stopMonitoring, startMonitoring]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">MEXC Pattern Sniper</h1>
          <p className="text-slate-400">Real-time pattern detection and automated execution</p>
        </div>

        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"}`} />
          <span className="text-sm text-slate-400">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Controls */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>System Control</span>
          </CardTitle>
          <CardDescription>Manage pattern detection and automated sniping</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={handleToggleMonitoring}
              disabled={isLoading}
              className={`${
                isMonitoring ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
              } text-white`}
            >
              {isMonitoring ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Stop Monitoring
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Monitoring
                </>
              )}
            </Button>

            <Button
              onClick={forceRefresh}
              disabled={isLoading}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>

            <Button
              onClick={clearAllTargets}
              variant="outline"
              className="border-red-600 text-red-300 hover:bg-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Total Listings</p>
                <p className="text-2xl font-bold text-blue-400">{stats.totalListings}</p>
              </div>
              <Eye className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Monitoring</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.pendingDetection}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Ready to Snipe</p>
                <p className="text-2xl font-bold text-green-400">{stats.readyToSnipe}</p>
              </div>
              <Target className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">Executed</p>
                <p className="text-2xl font-bold text-purple-400">{stats.executed}</p>
              </div>
              <Zap className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status */}
      {isMonitoring && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <span>System Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Uptime:</span>
                <span className="ml-2 text-white">{formatUptime(stats.uptime || 0)}</span>
              </div>
              <div>
                <span className="text-slate-400">Success Rate:</span>
                <span className="ml-2 text-green-400">
                  {stats.successRate?.toFixed(1) || "0.0"}%
                </span>
              </div>
              <div>
                <span className="text-slate-400">Status:</span>
                <Badge variant="default" className="ml-2 bg-green-500">
                  {isMonitoring ? "Active" : "Stopped"}
                </Badge>
              </div>
              <div>
                <span className="text-slate-400">Connection:</span>
                <Badge variant={isConnected ? "default" : "destructive"} className="ml-2">
                  {isConnected ? "Online" : "Offline"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Errors */}
      {(errors.calendar || errors.symbols) && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-400">
              <AlertCircle className="h-5 w-5" />
              <span>System Errors</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {errors.calendar && (
              <div className="text-red-300">
                <strong>Calendar API:</strong> {errors.calendar.message}
              </div>
            )}
            {errors.symbols && (
              <div className="text-red-300">
                <strong>Symbols API:</strong> {errors.symbols.message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ready Targets */}
      {readyTargets.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-green-400" />
              <span>Ready to Snipe ({readyTargets.length})</span>
            </CardTitle>
            <CardDescription>
              Tokens with confirmed ready state pattern (sts:2, st:2, tt:4)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {readyTargets.map((target) => (
                <div
                  key={target.symbol}
                  className="bg-green-50/5 border border-green-500/20 p-4 rounded-lg hover:bg-green-50/10 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-bold text-green-400 text-lg">{target.symbol}</h3>
                        <Badge variant="default" className="bg-green-500">
                          READY
                        </Badge>
                        <Badge variant="outline" className="border-green-500 text-green-400">
                          {formatTimeRemaining(target.launchTime)}
                        </Badge>
                      </div>
                      <p className="text-slate-300 mt-1">{target.projectName}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-slate-400">
                        <span>Launch: {target.launchTime.toLocaleString()}</span>
                        <span>Advance: {target.hoursAdvanceNotice.toFixed(1)}h</span>
                        <span>
                          Precision: {target.priceDecimalPlaces}/{target.quantityDecimalPlaces}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        onClick={() => handleExecuteSnipe(target)}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Execute
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveTarget(normalizeVcoinId(target.vcoinId))}
                        className="border-red-500 text-red-400 hover:bg-red-700"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-slate-700/50 rounded text-xs">
                    <strong>Order Params:</strong> {JSON.stringify(target.orderParameters, null, 2)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Detection */}
      {pendingDetection.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-yellow-400" />
              <span>Monitoring ({pendingDetection.length})</span>
            </CardTitle>
            <CardDescription>Waiting for ready state pattern detection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingDetection.map((vcoinId) => {
                const target = calendarTargets.find((t) => t.vcoinId === vcoinId);
                return target ? (
                  <div
                    key={vcoinId}
                    className="flex justify-between items-center p-3 bg-yellow-50/5 border border-yellow-500/20 rounded"
                  >
                    <div>
                      <span className="font-medium text-yellow-400">{target.symbol}</span>
                      <span className="text-slate-400 ml-2">{target.projectName}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-yellow-400">
                        {formatTimeRemaining(new Date(target.firstOpenTime))}
                      </span>
                      <Badge variant="outline" className="border-yellow-500 text-yellow-400">
                        Scanning...
                      </Badge>
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar Targets */}
      {calendarTargets.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-400" />
              <span>Upcoming Listings ({calendarTargets.length})</span>
            </CardTitle>
            <CardDescription>Detected from MEXC calendar feed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {calendarTargets.slice(0, 10).map((target) => (
                <div
                  key={target.vcoinId}
                  className="flex justify-between items-center p-3 bg-blue-50/5 border border-blue-500/20 rounded"
                >
                  <div>
                    <span className="font-medium text-blue-400">{target.symbol}</span>
                    <span className="text-slate-400 ml-2">{target.projectName}</span>
                  </div>
                  <span className="text-sm text-blue-400">
                    {new Date(target.firstOpenTime).toLocaleString()}
                  </span>
                </div>
              ))}
              {calendarTargets.length > 10 && (
                <div className="text-center text-slate-400 text-sm pt-2">
                  ... and {calendarTargets.length - 10} more
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Executed Snipes */}
      {executedTargets.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-purple-400" />
              <span>Executed Snipes ({executedTargets.length})</span>
            </CardTitle>
            <CardDescription>Successfully executed trades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {executedTargets.map((symbol) => (
                <div
                  key={symbol}
                  className="flex justify-between items-center p-3 bg-purple-50/5 border border-purple-500/20 rounded"
                >
                  <div>
                    <span className="font-medium text-purple-400">{symbol}</span>
                    <span className="text-slate-400 ml-2">Executed</span>
                  </div>
                  <Badge variant="default" className="bg-purple-500">
                    SUCCESS
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isMonitoring && calendarTargets.length === 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="text-center py-12">
            <Target className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-400 mb-2">No Active Monitoring</h3>
            <p className="text-slate-500 mb-4">
              Start monitoring to detect new MEXC listings and ready state patterns
            </p>
            <Button onClick={startMonitoring} className="bg-green-500 hover:bg-green-600">
              <Play className="mr-2 h-4 w-4" />
              Start Pattern Sniper
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
});

// Export aliases for dynamic loader compatibility
export const PatternSniper = PatternSniperComponent;
export default PatternSniperComponent;
