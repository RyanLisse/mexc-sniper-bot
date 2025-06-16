import type { BalanceEntry } from "@/src/services/mexc-unified-exports";
import { useQuery } from "@tanstack/react-query";

interface UseAccountBalanceOptions {
  userId?: string;
  refreshInterval?: number;
  enabled?: boolean;
}

export function useAccountBalance(options: UseAccountBalanceOptions = {}) {
  const {
    userId,
    refreshInterval = 30000, // Refresh every 30 seconds
    enabled = true,
  } = options;

  return useQuery({
    queryKey: ["account-balance", userId],
    queryFn: async (): Promise<{
      balances: BalanceEntry[];
      totalUsdtValue: number;
      lastUpdated: string;
    }> => {
      const url = userId
        ? `/api/mexc/account?userId=${encodeURIComponent(userId)}`
        : "/api/mexc/account";
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch account balance: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch account balance");
      }

      return {
        balances: data.balances || [],
        totalUsdtValue: data.totalUsdtValue || 0,
        lastUpdated: data.lastUpdated || new Date().toISOString(),
      };
    },
    enabled: enabled,
    refetchInterval: refreshInterval,
    staleTime: 25000, // Consider data stale after 25 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export type { BalanceEntry } from "@/src/services/mexc-unified-exports";
