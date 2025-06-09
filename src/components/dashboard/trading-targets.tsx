"use client";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { AlertTriangle, Clock, Eye, Target, Trash2, TrendingUp, Zap } from "lucide-react";

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

export function TradingTargets({
  readyTargets = [],
  pendingDetection = [],
  calendarTargets = [],
  onExecuteSnipe,
  onRemoveTarget,
  isLoading = false,
  className,
}: TradingTargetsProps) {
  const formatTimeRemaining = (launchTime: Date | number) => {
    const launch = typeof launchTime === "number" ? new Date(launchTime) : launchTime;
    const now = Date.now();
    const hoursRemaining = (launch.getTime() - now) / (1000 * 60 * 60);

    if (hoursRemaining < 0) return "Launched";
    if (hoursRemaining < 1) return `${Math.floor(hoursRemaining * 60)}m`;
    if (hoursRemaining < 24) return `${hoursRemaining.toFixed(1)}h`;
    return `${Math.floor(hoursRemaining / 24)}d ${Math.floor(hoursRemaining % 24)}h`;
  };

  const _getStatusColor = (status?: string) => {
    switch (status) {
      case "ready":
        return "bg-green-100 text-green-800 border-green-200";
      case "monitoring":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "pending":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {Array.from({ length: 2 }, (_, i) => ({ id: `target-loading-${Date.now()}-${i}` })).map(
          (item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="animate-pulse space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="animate-pulse space-y-3">
                  {Array.from({ length: 3 }, (_, j) => ({
                    id: `target-item-${Date.now()}-${j}`,
                  })).map((subItem) => (
                    <div key={subItem.id} className="h-16 bg-gray-200 rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>
    );
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
                <div
                  key={target.vcoinId}
                  className="bg-white border border-green-200 p-4 rounded-lg hover:shadow-md transition-all duration-200"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-bold text-green-700 text-lg truncate">
                          {target.symbol}
                        </h3>
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-500">
                        <div>
                          <span className="font-medium">Launch:</span>
                          <span className="block text-xs">
                            {target.launchTime.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Advance:</span>
                          <span className="block text-xs">
                            {target.hoursAdvanceNotice.toFixed(1)}h
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Price Precision:</span>
                          <span className="block text-xs">
                            {target.priceDecimalPlaces} decimals
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Qty Precision:</span>
                          <span className="block text-xs">
                            {target.quantityDecimalPlaces} decimals
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => onExecuteSnipe(target)}
                        className="bg-green-500 hover:bg-green-600 text-white"
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        Execute
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRemoveTarget(target.vcoinId)}
                        className="border-red-500 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monitoring Targets */}
      {pendingDetection.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-yellow-700">
              <Eye className="h-5 w-5" />
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
                    className="flex justify-between items-center p-3 bg-white border border-yellow-200 rounded-lg hover:shadow-sm transition-shadow"
                  >
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
                ) : null;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {readyTargets.length === 0 && pendingDetection.length === 0 && (
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
                  Start pattern discovery to identify potential trading opportunities. The system
                  will automatically detect tokens matching the ready state pattern.
                </p>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
                <Clock className="h-4 w-4" />
                <span>Waiting for pattern detection...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning for high target count */}
      {readyTargets.length + pendingDetection.length > 10 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 text-orange-700">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">High Target Volume</span>
            </div>
            <p className="text-sm text-orange-600 mt-1">
              You have {readyTargets.length + pendingDetection.length} targets being tracked.
              Consider reviewing your detection criteria to focus on the most promising
              opportunities.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
