"use client";

import { AlertTriangle, Clock, Eye, Target, Trash2, TrendingUp, Zap } from "lucide-react";
import React, { useCallback, useMemo } from "react";
import { useTimeFormatting } from "../../hooks/use-time-formatting";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

interface TradingTarget {
  vcoinId: string;
  symbol: string;
  projectName: string;
  launchTime: Date;
  hoursAdvanceNotice: number;
  priceDecimalPlaces: number;
  quantityDecimalPlaces: number;
  confidence?: number;
  status?: "ready" | "monitoring" | "pending";
}

interface CalendarTarget {
  vcoinId: string;
  symbol: string;
  projectName: string;
  firstOpenTime: number;
}

interface TradingTargetsProps {
  readyTargets?: TradingTarget[];
  pendingDetection?: string[];
  calendarTargets?: CalendarTarget[];
  onExecuteSnipe: (target: TradingTarget) => void;
  onRemoveTarget: (vcoinId: string) => void;
  isLoading?: boolean;
  className?: string;
}

// Target details component
const TargetDetails = React.memo(
  ({
    launchTime,
    hoursAdvanceNotice,
    priceDecimalPlaces,
    quantityDecimalPlaces,
  }: Pick<
    TradingTarget,
    "launchTime" | "hoursAdvanceNotice" | "priceDecimalPlaces" | "quantityDecimalPlaces"
  >) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-500">
      <div>
        <span className="font-medium">Launch:</span>
        <span className="block text-xs">{launchTime.toLocaleString()}</span>
      </div>
      <div>
        <span className="font-medium">Advance:</span>
        <span className="block text-xs">{hoursAdvanceNotice.toFixed(1)}h</span>
      </div>
      <div>
        <span className="font-medium">Price Precision:</span>
        <span className="block text-xs">{priceDecimalPlaces} decimals</span>
      </div>
      <div>
        <span className="font-medium">Qty Precision:</span>
        <span className="block text-xs">{quantityDecimalPlaces} decimals</span>
      </div>
    </div>
  )
);
TargetDetails.displayName = "TargetDetails";

// Ready target item component
const ReadyTargetItem = React.memo(
  ({
    target,
    formatTimeRemaining,
    onExecute,
    onRemove,
  }: {
    target: TradingTarget;
    formatTimeRemaining: (launchTime: Date | number) => string;
    onExecute: () => void;
    onRemove: () => void;
  }) => (
    <div className="bg-white border border-green-200 p-4 rounded-lg hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="font-bold text-green-700 text-lg truncate">{target.symbol}</h3>
            <Badge className="bg-green-500 hover:bg-green-600 text-white">READY</Badge>
            <Badge variant="outline" className="border-green-500 text-green-600">
              {formatTimeRemaining(target.launchTime)}
            </Badge>
            {target.confidence && (
              <Badge variant="outline" className="border-blue-500 text-blue-600">
                {Math.round(target.confidence * 100)}% confidence
              </Badge>
            )}
          </div>
          <p className="text-gray-600 mb-3 truncate">{target.projectName}</p>
          <TargetDetails
            launchTime={target.launchTime}
            hoursAdvanceNotice={target.hoursAdvanceNotice}
            priceDecimalPlaces={target.priceDecimalPlaces}
            quantityDecimalPlaces={target.quantityDecimalPlaces}
          />
        </div>
        <div className="flex flex-col space-y-2 ml-4">
          <Button
            size="sm"
            onClick={onExecute}
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            <Zap className="h-4 w-4 mr-1" />
            Execute
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onRemove}
            className="border-red-500 text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
);
ReadyTargetItem.displayName = "ReadyTargetItem";

// Monitoring target item component
const MonitoringTargetItem = React.memo(
  ({
    target,
    formatTimeRemaining,
  }: {
    target: CalendarTarget;
    formatTimeRemaining: (launchTime: Date | number) => string;
  }) => (
    <div className="flex justify-between items-center p-3 bg-white border border-yellow-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-center space-x-3">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        <div>
          <span className="font-medium text-yellow-700">{target.symbol}</span>
          <span className="text-gray-600 ml-2 text-sm">{target.projectName}</span>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <div className="text-right">
          <span className="text-sm font-medium text-yellow-600">
            {formatTimeRemaining(target.firstOpenTime)}
          </span>
          <div className="text-xs text-gray-500">
            {new Date(target.firstOpenTime).toLocaleDateString()}
          </div>
        </div>
        <Badge variant="outline" className="border-yellow-500 text-yellow-600">
          <Eye className="h-3 w-3 mr-1" />
          Scanning...
        </Badge>
      </div>
    </div>
  )
);
MonitoringTargetItem.displayName = "MonitoringTargetItem";

// Empty state component
const EmptyState = React.memo(() => (
  <Card className="border-dashed border-2 border-gray-300">
    <CardContent className="text-center py-12">
      <div className="space-y-4">
        <div className="flex justify-center space-x-2">
          <Target className="h-12 w-12 text-gray-400" />
          <TrendingUp className="h-12 w-12 text-gray-400" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Trading Targets</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Start pattern discovery to identify potential trading opportunities. The system will
            automatically detect tokens matching the ready state pattern.
          </p>
        </div>
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
          <Clock className="h-4 w-4" />
          <span>Waiting for pattern detection...</span>
        </div>
      </div>
    </CardContent>
  </Card>
));
EmptyState.displayName = "EmptyState";

// High volume warning component
const HighVolumeWarning = React.memo(({ count }: { count: number }) => (
  <Card className="border-orange-200 bg-orange-50">
    <CardContent className="p-4">
      <div className="flex items-center space-x-2 text-orange-700">
        <AlertTriangle className="h-5 w-5" />
        <span className="font-medium">High Target Volume</span>
      </div>
      <p className="text-sm text-orange-600 mt-1">
        You have {count} targets being tracked. Consider reviewing your detection criteria to focus
        on the most promising opportunities.
      </p>
    </CardContent>
  </Card>
));
HighVolumeWarning.displayName = "HighVolumeWarning";

// Loading skeleton
const LoadingSkeleton = React.memo(() => (
  <div className="space-y-6">
    {Array.from({ length: 2 }, (_, i) => `target-loading-${i}`).map((key) => (
      <Card key={key}>
        <CardHeader>
          <div className="animate-pulse space-y-2">
            <div className="h-5 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }, (_, j) => `target-item-${j}`).map((subKey) => (
              <div key={subKey} className="h-16 bg-gray-200 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
));
LoadingSkeleton.displayName = "LoadingSkeleton";

// Main component
export const OptimizedTradingTargets = React.memo(
  ({
    readyTargets = [],
    pendingDetection = [],
    calendarTargets = [],
    onExecuteSnipe,
    onRemoveTarget,
    isLoading = false,
    className,
  }: TradingTargetsProps) => {
    const { formatTimeRemaining } = useTimeFormatting();

    // Memoize pending targets with calendar data
    const pendingTargetsWithData = useMemo(
      () =>
        pendingDetection
          .map((vcoinId) => calendarTargets.find((t) => t.vcoinId === vcoinId))
          .filter((target): target is CalendarTarget => target !== undefined),
      [pendingDetection, calendarTargets]
    );

    // Memoize callbacks
    const handleExecuteSnipe = useCallback(
      (target: TradingTarget) => {
        onExecuteSnipe(target);
      },
      [onExecuteSnipe]
    );

    const handleRemoveTarget = useCallback(
      (vcoinId: string) => {
        onRemoveTarget(vcoinId);
      },
      [onRemoveTarget]
    );

    const totalTargets = readyTargets.length + pendingDetection.length;

    if (isLoading) {
      return <LoadingSkeleton />;
    }

    return (
      <div className={`space-y-6 ${className}`}>
        {/* Ready to Execute Targets */}
        {readyTargets.length > 0 && (
          <Card className="border-green-200 bg-green-50/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-700">
                <Target className="h-5 w-5" />
                <span>Ready to Execute ({readyTargets.length})</span>
              </CardTitle>
              <CardDescription>
                Tokens with confirmed ready state pattern (sts:2, st:2, tt:4)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {readyTargets.map((target) => (
                  <ReadyTargetItem
                    key={target.vcoinId}
                    target={target}
                    formatTimeRemaining={formatTimeRemaining}
                    onExecute={() => handleExecuteSnipe(target)}
                    onRemove={() => handleRemoveTarget(target.vcoinId)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monitoring Targets */}
        {pendingTargetsWithData.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-yellow-700">
                <Eye className="h-5 w-5" />
                <span>Monitoring ({pendingTargetsWithData.length})</span>
              </CardTitle>
              <CardDescription>Waiting for ready state pattern detection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingTargetsWithData.map((target) => (
                  <MonitoringTargetItem
                    key={target.vcoinId}
                    target={target}
                    formatTimeRemaining={formatTimeRemaining}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {totalTargets === 0 && <EmptyState />}

        {/* Warning for high target count */}
        {totalTargets > 10 && <HighVolumeWarning count={totalTargets} />}
      </div>
    );
  }
);

OptimizedTradingTargets.displayName = "OptimizedTradingTargets";
