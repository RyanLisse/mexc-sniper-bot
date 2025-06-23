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
    queryKey: ["account-balance", userId || "anonymous", "active"],
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
        credentials: "include", // Include authentication cookies
      });

      if (!response.ok) {
        // Don't throw errors for 403/401 when not authenticated
        if (!isAuthenticated && (response.status === 403 || response.status === 401)) {
          return {
            balances: [],
            totalUsdtValue: 0,
            lastUpdated: new Date().toISOString(),
          };
        }
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
    staleTime: 25 * 1000, // 25 seconds - balance data cache
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    refetchOnWindowFocus: false, // Don't refetch on window focus for financial data
    placeholderData: {
      balances: [],
      totalUsdtValue: 0,
      lastUpdated: new Date().toISOString(),
    }, // Prevent loading flicker
    retry: (failureCount, error) => {
      // Don't retry auth errors
      const errorMessage = error?.message || '';
      if (errorMessage.includes('401') || errorMessage.includes('403')) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export type { BalanceEntry } from "../services/mexc-unified-exports";
