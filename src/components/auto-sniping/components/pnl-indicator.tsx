/**
 * P&L Indicator Component
 *
 * Displays profit/loss information with appropriate styling
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import type { ExecutionPosition } from "../schemas/validation-schemas";

interface PnLIndicatorProps {
  position: ExecutionPosition;
}

export function PnLIndicator({ position }: PnLIndicatorProps) {
  // Use the pnl property from ExecutionPosition schema
  const pnl =
    typeof position.pnl === "string"
      ? Number.parseFloat(position.pnl)
      : position.pnl || 0;
  const isProfit = pnl >= 0;

  // Calculate percentage based on entry price for display
  const entryPrice =
    typeof position.entryPrice === "string"
      ? Number.parseFloat(position.entryPrice)
      : position.entryPrice;
  const currentPrice =
    typeof position.currentPrice === "string"
      ? Number.parseFloat(position.currentPrice)
      : position.currentPrice;
  const _quantity =
    typeof position.quantity === "string"
      ? Number.parseFloat(position.quantity)
      : position.quantity;

  // Calculate percentage change if current price is available
  const percentageChange =
    entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0;

  return (
    <div
      className={`flex items-center gap-1 ${isProfit ? "text-green-600" : "text-red-600"}`}
    >
      {isProfit ? (
        <TrendingUp className="h-4 w-4" />
      ) : (
        <TrendingDown className="h-4 w-4" />
      )}
      <span className="font-medium">
        {isProfit ? "+" : ""}
        {pnl.toFixed(2)} USDT
      </span>
      {currentPrice > 0 && (
        <span className="text-sm">
          ({percentageChange > 0 ? "+" : ""}
          {percentageChange.toFixed(2)}%)
        </span>
      )}
    </div>
  );
}
