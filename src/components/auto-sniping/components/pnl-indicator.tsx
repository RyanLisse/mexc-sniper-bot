/**
 * P&L Indicator Component
 *
 * Displays profit/loss information with appropriate styling
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import type { Position } from "@/src/services/trading/consolidated/core-trading.types";

interface PnLIndicatorProps {
  position: ExecutionPosition;
}

export function PnLIndicator({ position }: PnLIndicatorProps) {
  const pnl = Number.parseFloat(position.unrealizedPnl);
  const isProfit = pnl >= 0;

  return (
    <div className={`flex items-center gap-1 ${isProfit ? "text-green-600" : "text-red-600"}`}>
      {isProfit ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      <span className="font-medium">
        {isProfit ? "+" : ""}
        {pnl.toFixed(2)} USDT
      </span>
      <span className="text-sm">
        ({position.unrealizedPnlPercentage > 0 ? "+" : ""}
        {position.unrealizedPnlPercentage.toFixed(2)}%)
      </span>
    </div>
  );
}
