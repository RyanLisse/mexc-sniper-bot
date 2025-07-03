/**
 * Optimized WebSocket Monitor Component
 * Uses memo, composition, and custom hooks for better performance
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurrencyFormatting } from "../hooks/use-currency-formatting";
import { webSocketPriceService } from "../services/data/websocket-price-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

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

// Status indicator component
const StatusIndicator = memo(
  ({
    isConnected,
    isConnecting,
  }: {
    isConnected: boolean;
    isConnecting: boolean;
  }) => {
    const statusColor = isConnected
      ? "text-green-500"
      : isConnecting
        ? "text-yellow-500"
        : "text-red-500";

    return (
      <span
        className={`inline-block w-2 h-2 rounded-full ${statusColor} ${isConnected ? "animate-pulse" : ""}`}
      />
    );
  }
);
StatusIndicator.displayName = "StatusIndicator";

// Memory stats component
const MemoryStatsDisplay = memo(
  ({
    stats,
    formatBytes,
    formatGrowthRate,
  }: {
    stats: MemoryStats;
    formatBytes: (bytes: number) => string;
    formatGrowthRate: (rate: number | null) => string;
  }) => {
    const getGrowthRateColor = useCallback((rate: number | null): string => {
      if (rate === null) return "";
      const mbPerHour = rate / 1024 / 1024;
      if (mbPerHour > 50) return "text-red-500 font-semibold";
      if (mbPerHour > 20) return "text-yellow-500";
      if (mbPerHour > 10) return "text-orange-500";
      return "text-green-500";
    }, []);

    if (!stats.current) return null;

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Memory Usage</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Heap Used:</span>
            <span className="ml-2">{formatBytes(stats.current.heapUsed)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Heap Total:</span>
            <span className="ml-2">{formatBytes(stats.current.heapTotal)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Growth Rate:</span>
            <span className={`ml-2 ${getGrowthRateColor(stats.growthRate)}`}>
              {formatGrowthRate(stats.growthRate)}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Usage:</span>
            <span className="ml-2">
              {(
                (stats.current.heapUsed / stats.current.heapTotal) *
                100
              ).toFixed(1)}
              %
            </span>
          </div>
        </div>
      </div>
    );
  }
);
MemoryStatsDisplay.displayName = "MemoryStatsDisplay";

// Active symbols display
const ActiveSymbolsDisplay = memo(({ symbols }: { symbols: string[] }) => {
  if (symbols.length === 0) return null;

  const displaySymbols = symbols.slice(0, 10);
  const remainingCount = symbols.length - 10;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Active Symbols</h4>
      <div className="flex flex-wrap gap-1">
        {displaySymbols.map((symbol) => (
          <span key={symbol} className="px-2 py-1 text-xs bg-muted rounded">
            {symbol}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="px-2 py-1 text-xs text-muted-foreground">
            +{remainingCount} more
          </span>
        )}
      </div>
    </div>
  );
});
ActiveSymbolsDisplay.displayName = "ActiveSymbolsDisplay";

// Action buttons component
const ActionButtons = memo(
  ({
    serviceStatus,
    memoryGrowthRate,
    onConnect,
    onDisconnect,
    onRestart,
  }: {
    serviceStatus: ServiceStatus;
    memoryGrowthRate: number | null;
    onConnect: () => Promise<void>;
    onDisconnect: () => void;
    onRestart: () => Promise<void>;
  }) => {
    const showRestartButton =
      memoryGrowthRate && memoryGrowthRate > 20 * 1024 * 1024;

    return (
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onConnect}
          disabled={serviceStatus.isConnected || serviceStatus.isConnecting}
          className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded disabled:opacity-50"
        >
          Connect
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={!serviceStatus.isConnected}
          className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded disabled:opacity-50"
        >
          Disconnect
        </button>
        {showRestartButton && (
          <button
            type="button"
            onClick={onRestart}
            className="px-3 py-1 text-xs bg-yellow-500 text-white rounded"
          >
            Restart Service
          </button>
        )}
      </div>
    );
  }
);
ActionButtons.displayName = "ActionButtons";

// Main component
export const OptimizedWebSocketMonitor = memo(() => {
  const [memoryStats, setMemoryStats] = useState<MemoryStats>({
    current: null,
    growthRate: null,
  });
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    isConnected: false,
    isConnecting: false,
    subscribedSymbols: [],
    cachedPrices: 0,
    reconnectAttempts: 0,
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const isMountedRef = useRef(true);
  const { formatBytes, formatGrowthRate } = useCurrencyFormatting();

  const updateStats = useCallback(() => {
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
  }, []);

  useEffect(() => {
    updateStats();
    const interval = setInterval(updateStats, 5000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [updateStats]);

  const handleConnect = useCallback(async () => {
    await webSocketPriceService.connect();
  }, []);

  const handleDisconnect = useCallback(() => {
    webSocketPriceService.disconnect();
  }, []);

  const handleRestart = useCallback(async () => {
    webSocketPriceService.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await webSocketPriceService.connect();
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const statusColor = useMemo(() => {
    if (!serviceStatus.isConnected) return "text-red-500";
    if (memoryStats.growthRate && memoryStats.growthRate > 50 * 1024 * 1024)
      return "text-yellow-500";
    return "text-green-500";
  }, [serviceStatus.isConnected, memoryStats.growthRate]);

  return (
    <Card className="relative">
      <CardHeader className="cursor-pointer" onClick={toggleExpanded}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <StatusIndicator
                isConnected={serviceStatus.isConnected}
                isConnecting={serviceStatus.isConnecting}
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
          <div className="text-sm text-muted-foreground">
            {isExpanded ? "▼" : "▶"}
          </div>
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
                <span className={`ml-2 ${statusColor}`}>
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
          <MemoryStatsDisplay
            stats={memoryStats}
            formatBytes={formatBytes}
            formatGrowthRate={formatGrowthRate}
          />

          {/* Data Stats */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Data Statistics</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Subscriptions:</span>
                <span className="ml-2">
                  {serviceStatus.subscribedSymbols.length}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Cached Prices:</span>
                <span className="ml-2">{serviceStatus.cachedPrices}</span>
              </div>
            </div>
          </div>

          {/* Subscribed Symbols */}
          <ActiveSymbolsDisplay symbols={serviceStatus.subscribedSymbols} />

          {/* Actions */}
          <ActionButtons
            serviceStatus={serviceStatus}
            memoryGrowthRate={memoryStats.growthRate}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onRestart={handleRestart}
          />
        </CardContent>
      )}
    </Card>
  );
});

OptimizedWebSocketMonitor.displayName = "OptimizedWebSocketMonitor";
