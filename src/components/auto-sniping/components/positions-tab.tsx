/**
 * Positions Tab Component
 *
 * Displays and manages active trading positions
 */

import { Target, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Position } from "@/src/services/trading/consolidated/core-trading.types";
import { PnLIndicator } from "./pnl-indicator";

interface PositionsTabProps {
  activePositions: ExecutionPosition[];
  isClosingPosition: boolean;
  onClosePosition: (positionId: string) => Promise<void>;
  onEmergencyStop: () => Promise<void>;
  formatCurrency: (value: string | number) => string;
}

export function PositionsTab({
  activePositions,
  isClosingPosition,
  onClosePosition,
  onEmergencyStop,
  formatCurrency,
}: PositionsTabProps) {
  const handleClosePosition = async (positionId: string) => {
    const confirmed = window.confirm("Are you sure you want to close this position?");
    if (confirmed) {
      await onClosePosition(positionId);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Active Positions ({activePositions.length})
          </CardTitle>
          <CardDescription>Monitor and manage your active trading positions</CardDescription>
        </div>
        {activePositions.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onEmergencyStop}
            className="bg-red-600 hover:bg-red-700"
          >
            Close All
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {activePositions.length > 0 ? (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {activePositions.map((position) => (
                <div key={position.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-lg">
                        {position.symbol}
                      </Badge>
                      <Badge variant="default">{position.side}</Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClosePosition(position.id)}
                      disabled={isClosingPosition}
                    >
                      <X className="h-4 w-4" />
                      Close
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-gray-600">Entry Price</p>
                      <p className="font-medium">{formatCurrency(position.entryPrice)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Current Price</p>
                      <p className="font-medium">{formatCurrency(position.currentPrice)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Quantity</p>
                      <p className="font-medium">{position.quantity}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">P&L</p>
                      <PnLIndicator position={position} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>
                      Pattern: {position.patternMatch.patternType}(
                      {position.patternMatch.confidence}% confidence)
                    </span>
                    <span>Opened: {new Date(position.entryTime).toLocaleString()}</span>
                  </div>

                  {(position.stopLossPrice || position.takeProfitPrice) && (
                    <div className="mt-2 pt-2 border-t text-sm">
                      {position.stopLossPrice && (
                        <span className="text-red-600">
                          SL: {formatCurrency(position.stopLossPrice)}
                        </span>
                      )}
                      {position.stopLossPrice && position.takeProfitPrice && " • "}
                      {position.takeProfitPrice && (
                        <span className="text-green-600">
                          TP: {formatCurrency(position.takeProfitPrice)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-gray-500">No active positions</div>
        )}
      </CardContent>
    </Card>
  );
}
