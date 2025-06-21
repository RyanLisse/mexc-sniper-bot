import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/kinde-auth-client";
import type { BalanceEntry } from "../services/mexc-unified-exports";

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

  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["account-balance", userId || "anonymous"],
    queryFn: async (): Promise<{
      balances: BalanceEntry[];
      totalUsdtValue: number;
      lastUpdated: string;
    }> => {
      if (!userId) {
        throw new Error("User ID is required");
      }

      const url = `/api/account/balance?userId=${encodeURIComponent(userId)}`;
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
        balances: data.data.balances || [],
        totalUsdtValue: data.data.totalUsdtValue || 0,
        lastUpdated: data.data.lastUpdated || new Date().toISOString(),
      };
    },
    // Only fetch if user is authenticated and we have a valid userId
    enabled: enabled && !!userId && isAuthenticated && (user?.id === userId || !user?.id),
    refetchInterval: refreshInterval,
    staleTime: 25000, // Consider data stale after 25 seconds
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export type { BalanceEntry } from "../services/mexc-unified-exports";
