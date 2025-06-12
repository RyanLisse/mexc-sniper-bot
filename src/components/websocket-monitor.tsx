/**
 * WebSocket Monitor Component
 * Displays real-time memory usage and connection stats for the WebSocket service
 */

import { webSocketPriceService } from "@/src/services/websocket-price-service";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface MemoryStats {
  current: {
    heapUsed: number;
    heapTotal: number;
    subscriptionCount: number;
    cacheSize: number;
  } | null;
  growthRate: number | null;
}

interface ServiceStatus {
  isConnected: boolean;
  isConnecting: boolean;
  subscribedSymbols: string[];
  cachedPrices: number;
  reconnectAttempts: number;
}

export function WebSocketMonitor() {
  const [memoryStats, setMemoryStats] = useState<MemoryStats>({ current: null, growthRate: null });
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    isConnected: false,
    isConnecting: false,
    subscribedSymbols: [],
    cachedPrices: 0,
    reconnectAttempts: 0,
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    const updateStats = () => {
      if (!isMountedRef.current) return;

      const status = webSocketPriceService.getStatus();
      setServiceStatus({
        isConnected: status.isConnected,
        isConnecting: status.isConnecting,
        subscribedSymbols: status.subscribedSymbols,
        cachedPrices: status.cachedPrices,
        reconnectAttempts: status.reconnectAttempts,
      });

      const stats = webSocketPriceService.getMemoryStats();
      setMemoryStats({
        current: stats.current
          ? {
              heapUsed: stats.current.heapUsed,
              heapTotal: stats.current.heapTotal,
              subscriptionCount: stats.current.subscriptionCount,
              cacheSize: stats.current.cacheSize,
            }
          : null,
        growthRate: stats.growthRate,
      });
    };

    // Initial update
    updateStats();

    // Update every 5 seconds
    const interval = setInterval(updateStats, 5000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  const formatBytes = (bytes: number): string => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatGrowthRate = (rate: number | null): string => {
    if (rate === null) return "N/A";
    const mbPerHour = rate / 1024 / 1024;
    if (Math.abs(mbPerHour) < 0.1) {
      return "Stable";
    }
    return `${mbPerHour > 0 ? "+" : ""}${mbPerHour.toFixed(2)} MB/hour`;
  };

  const getStatusColor = (): string => {
    if (!serviceStatus.isConnected) return "text-red-500";
    if (memoryStats.growthRate && memoryStats.growthRate > 50 * 1024 * 1024)
      return "text-yellow-500";
    return "text-green-500";
  };

  const getGrowthRateColor = (rate: number | null): string => {
    if (rate === null) return "";
    const mbPerHour = rate / 1024 / 1024;
    if (mbPerHour > 50) return "text-red-500 font-semibold";
    if (mbPerHour > 20) return "text-yellow-500";
    if (mbPerHour > 10) return "text-orange-500";
    return "text-green-500";
  };

  return (
    <Card className="relative">
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${getStatusColor()} ${serviceStatus.isConnected ? "animate-pulse" : ""}`}
              />
              WebSocket Monitor
            </CardTitle>
            <CardDescription>
              {serviceStatus.isConnected
                ? `Connected • ${serviceStatus.subscribedSymbols.length} symbols`
                : serviceStatus.isConnecting
                  ? "Connecting..."
                  : "Disconnected"}
            </CardDescription>
          </div>
          <div className="text-sm text-muted-foreground">{isExpanded ? "▼" : "▶"}</div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Connection</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className={`ml-2 ${getStatusColor()}`}>
                  {serviceStatus.isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Reconnects:</span>
                <span className="ml-2">{serviceStatus.reconnectAttempts}</span>
              </div>
            </div>
          </div>

          {/* Memory Usage */}
          {memoryStats.current && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Memory Usage</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Heap Used:</span>
                  <span className="ml-2">{formatBytes(memoryStats.current.heapUsed)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Heap Total:</span>
                  <span className="ml-2">{formatBytes(memoryStats.current.heapTotal)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Growth Rate:</span>
                  <span className={`ml-2 ${getGrowthRateColor(memoryStats.growthRate)}`}>
                    {formatGrowthRate(memoryStats.growthRate)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Usage:</span>
                  <span className="ml-2">
                    {((memoryStats.current.heapUsed / memoryStats.current.heapTotal) * 100).toFixed(
                      1
                    )}
                    %
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Data Stats */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Data Statistics</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Subscriptions:</span>
                <span className="ml-2">{serviceStatus.subscribedSymbols.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Cached Prices:</span>
                <span className="ml-2">{serviceStatus.cachedPrices}</span>
              </div>
            </div>
          </div>

          {/* Subscribed Symbols */}
          {serviceStatus.subscribedSymbols.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Active Symbols</h4>
              <div className="flex flex-wrap gap-1">
                {serviceStatus.subscribedSymbols.slice(0, 10).map((symbol) => (
                  <span key={symbol} className="px-2 py-1 text-xs bg-muted rounded">
                    {symbol}
                  </span>
                ))}
                {serviceStatus.subscribedSymbols.length > 10 && (
                  <span className="px-2 py-1 text-xs text-muted-foreground">
                    +{serviceStatus.subscribedSymbols.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={async () => {
                await webSocketPriceService.connect();
              }}
              disabled={serviceStatus.isConnected || serviceStatus.isConnecting}
              className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded disabled:opacity-50"
            >
              Connect
            </button>
            <button
              type="button"
              onClick={() => {
                webSocketPriceService.disconnect();
              }}
              disabled={!serviceStatus.isConnected}
              className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded disabled:opacity-50"
            >
              Disconnect
            </button>
            {memoryStats.growthRate && memoryStats.growthRate > 20 * 1024 * 1024 && (
              <button
                type="button"
                onClick={async () => {
                  webSocketPriceService.disconnect();
                  await new Promise((resolve) => setTimeout(resolve, 100));
                  await webSocketPriceService.connect();
                }}
                className="px-3 py-1 text-xs bg-yellow-500 text-white rounded"
              >
                Restart Service
              </button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
