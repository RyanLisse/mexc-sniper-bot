import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/src/lib/kinde-auth-client";
import type { BalanceEntry } from "@/src/services/api/mexc-unified-exports";

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

  // Use the provided userId or fallback to authenticated user ID or default
  const effectiveUserId = userId || user?.id || "default-user";

  // Debug logging
  console.debug("[useAccountBalance] Hook initialized:", {
    providedUserId: userId,
    authenticatedUserId: user?.id,
    effectiveUserId,
    isAuthenticated,
    enabled,
  });

  return useQuery({
    queryKey: ["account-balance", effectiveUserId, "active"],
    queryFn: async (): Promise<{
      balances: BalanceEntry[];
      totalUsdtValue: number;
      lastUpdated: string;
    }> => {
      const url = `/api/account/balance?userId=${encodeURIComponent(effectiveUserId)}`;
      console.debug("[useAccountBalance] Fetching from:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include authentication cookies
      });

      console.debug("[useAccountBalance] Response status:", response.status);

      if (!response.ok) {
        // Don't throw errors for 403/401 when not authenticated - return empty data instead
        if (!isAuthenticated && (response.status === 403 || response.status === 401)) {
          console.debug("[useAccountBalance] Auth error, returning empty data");
          return {
            balances: [],
            totalUsdtValue: 0,
            lastUpdated: new Date().toISOString(),
          };
        }
        throw new Error(`Failed to fetch account balance: ${response.statusText}`);
      }

      const data = await response.json();
      console.debug("[useAccountBalance] Response data:", data);

      if (!data.success) {
        // For auth errors, return empty data instead of throwing
        if (data.error?.includes("401") || data.error?.includes("403")) {
          console.debug("[useAccountBalance] Auth error in response, returning empty data");
          return {
            balances: [],
            totalUsdtValue: 0,
            lastUpdated: new Date().toISOString(),
          };
        }
        throw new Error(data.error || "Failed to fetch account balance");
      }

      const result = {
        balances: data.data.balances || [],
        totalUsdtValue: data.data.totalUsdtValue || 0,
        lastUpdated: data.data.lastUpdated || new Date().toISOString(),
      };

      console.debug("[useAccountBalance] Returning balance data:", result);
      return result;
    },
    // Enable the query when enabled flag is true
    enabled: enabled,
    refetchInterval: false, // Disable automatic refetch to prevent storms
    staleTime: 25 * 1000, // 25 seconds - balance data cache
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    refetchOnWindowFocus: false, // Don't refetch on window focus for financial data
    placeholderData: {
      balances: [],
      totalUsdtValue: 0,
      lastUpdated: new Date().toISOString(),
    }, // Prevent loading flicker
    retry: (_failureCount, error) => {
      // Don't retry auth errors
      const errorMessage = error?.message || "";
      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        return false;
      }
      // Don't retry network errors to prevent cascade failures
      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("Circuit breaker")
      ) {
        return false;
      }
      // No retries to prevent storms
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(5000 * 2 ** attemptIndex, 60000), // Longer delays if retries were enabled
  });
}

export type { BalanceEntry } from "@/src/services/api/mexc-unified-exports";
