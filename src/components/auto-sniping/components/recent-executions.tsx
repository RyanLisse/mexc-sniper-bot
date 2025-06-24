/**
 * Recent Executions Component
 *
 * Displays recent trade executions with status and performance indicators
 */

import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExecutionPosition } from "../../../services/optimized-auto-sniping-core";
import { PnLIndicator } from "./pnl-indicator";

interface RecentExecutionsProps {
  recentExecutions: ExecutionPosition[];
  formatCurrency: (value: string | number) => string;
}

export function RecentExecutions({ recentExecutions, formatCurrency }: RecentExecutionsProps) {
  if (recentExecutions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Executions ({recentExecutions.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {recentExecutions.map((execution, index) => (
              <div
                key={`execution-${execution.symbol}-${execution.entryTime || index}`}
                className="border rounded-lg p-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {execution.symbol}
                    </Badge>
                    <Badge variant={execution.status === "CLOSED" ? "default" : "secondary"}>
                      {execution.status}
                    </Badge>
                  </div>
                  <PnLIndicator position={execution} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Entry:</span>{" "}
                    {formatCurrency(execution.entryPrice)}
                  </div>
                  <div>
                    <span className="font-medium">Quantity:</span> {execution.quantity}
                  </div>
                  <div>
                    <span className="font-medium">Pattern:</span>{" "}
                    {execution.patternMatch.patternType}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>Confidence: {execution.patternMatch.confidence}%</span>
                  <span>{new Date(execution.entryTime).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
