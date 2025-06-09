import { useQuery } from "@tanstack/react-query";

export interface ExecutionRecord {
  id: number;
  snipeTargetId: number;
  vcoinId: string;
  symbolName: string;
  action: string;
  orderType: string;
  orderSide: string;
  requestedQuantity: number;
  requestedPrice: number;
  executedQuantity: number;
  executedPrice: number;
  totalCost: number;
  fees: number;
  exchangeOrderId: string;
  exchangeStatus: string;
  executionLatencyMs: number;
  slippagePercent: number;
  status: string;
  errorCode: string;
  errorMessage: string;
  requestedAt: number;
  executedAt: number;
  createdAt: number;
  executedAtFormatted: string;
  requestedAtFormatted: string;
  profitLoss: number | null;
}

export interface ExecutionSummary {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalBuyVolume: number;
  totalSellVolume: number;
  totalFees: number;
  avgExecutionLatencyMs: number;
  avgSlippagePercent: number;
  successRate: number;
}

export interface SymbolStats {
  symbol: string;
  totalExecutions: number;
  successfulExecutions: number;
  totalVolume: number;
  avgPrice: number;
  lastExecution: number;
}

export interface ExecutionHistoryResponse {
  executions: ExecutionRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  summary: ExecutionSummary;
  symbolStats: SymbolStats[];
}

export interface ExecutionHistoryFilters {
  userId: string;
  limit?: number;
  offset?: number;
  action?: "buy" | "sell";
  status?: "success" | "failed";
  symbol?: string;
  fromDate?: number; // Unix timestamp
  toDate?: number; // Unix timestamp
}

// Hook to get execution history with filtering and pagination
export function useExecutionHistory(filters: ExecutionHistoryFilters) {
  const { userId, ...queryParams } = filters;

  return useQuery({
    queryKey: ["executionHistory", userId, queryParams],
    queryFn: async (): Promise<ExecutionHistoryResponse> => {
      const params = new URLSearchParams({ userId });

      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/execution-history?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch execution history: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch execution history");
      }

      return data.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!userId && userId !== "anonymous",
  });
}

// Hook to get recent executions (last 10)
export function useRecentExecutions(userId: string) {
  return useExecutionHistory({
    userId,
    limit: 10,
    offset: 0,
  });
}

// Hook to get trading performance metrics
export function useTradingMetrics(userId: string, days = 7) {
  const fromDate = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);

  return useExecutionHistory({
    userId,
    limit: 1000, // Get more records for better metrics
    fromDate,
  });
}

// Hook to get symbol-specific execution history
export function useSymbolExecutionHistory(userId: string, symbol: string) {
  return useExecutionHistory({
    userId,
    symbol,
    limit: 50,
  });
}

// Hook to get buy vs sell execution comparison
export function useBuySellComparison(userId: string) {
  const buyQuery = useExecutionHistory({
    userId,
    action: "buy",
    limit: 100,
  });

  const sellQuery = useExecutionHistory({
    userId,
    action: "sell",
    limit: 100,
  });

  return {
    buyData: buyQuery.data,
    sellData: sellQuery.data,
    isLoading: buyQuery.isLoading || sellQuery.isLoading,
    error: buyQuery.error || sellQuery.error,
    // Calculate comparison metrics
    comparison:
      buyQuery.data && sellQuery.data
        ? {
            buySuccessRate: buyQuery.data.summary.successRate,
            sellSuccessRate: sellQuery.data.summary.successRate,
            avgBuyLatency: buyQuery.data.summary.avgExecutionLatencyMs,
            avgSellLatency: sellQuery.data.summary.avgExecutionLatencyMs,
            avgBuySlippage: buyQuery.data.summary.avgSlippagePercent,
            avgSellSlippage: sellQuery.data.summary.avgSlippagePercent,
            totalBuyVolume: buyQuery.data.summary.totalBuyVolume,
            totalSellVolume: sellQuery.data.summary.totalSellVolume,
          }
        : null,
  };
}

// Helper function to format execution record for display
export function formatExecutionRecord(execution: ExecutionRecord) {
  return {
    ...execution,
    displayTime: new Date(execution.executedAt * 1000).toLocaleString(),
    displayCost: `$${execution.totalCost?.toFixed(2) || "0.00"}`,
    displayFees: `$${execution.fees?.toFixed(4) || "0.0000"}`,
    displayPrice: `$${execution.executedPrice?.toFixed(6) || "0.000000"}`,
    displayQuantity: execution.executedQuantity?.toFixed(4) || "0.0000",
    displayLatency: `${execution.executionLatencyMs || 0}ms`,
    displaySlippage: `${execution.slippagePercent?.toFixed(2) || "0.00"}%`,
    statusColor:
      execution.status === "success" ? "green" : execution.status === "failed" ? "red" : "yellow",
    actionColor:
      execution.action === "buy" ? "blue" : execution.action === "sell" ? "green" : "gray",
  };
}

// Helper function to calculate profit/loss between buy and sell orders
export function calculateProfitLoss(buyExecution: ExecutionRecord, sellExecution: ExecutionRecord) {
  if (!buyExecution || !sellExecution) return null;

  const buyValue = (buyExecution.executedPrice || 0) * (buyExecution.executedQuantity || 0);
  const sellValue = (sellExecution.executedPrice || 0) * (sellExecution.executedQuantity || 0);
  const totalFees = (buyExecution.fees || 0) + (sellExecution.fees || 0);

  const profitLoss = sellValue - buyValue - totalFees;
  const profitLossPercent = buyValue > 0 ? (profitLoss / buyValue) * 100 : 0;

  return {
    profitLoss,
    profitLossPercent,
    buyValue,
    sellValue,
    totalFees,
  };
}
