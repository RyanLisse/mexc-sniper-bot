import { QueryClient } from "@tanstack/react-query";
// Import optimized query keys from modular MEXC service
import { mexcQueryKeys } from "../services/modules/mexc-api-types";
import { createSafeLogger } from "./structured-logger";

const logger = createSafeLogger("query-client");

/**
 * Optimized TanStack Query Client Configuration
 *
 * Enhanced configuration for better performance and type safety:
 * - Optimized stale times for different data types
 * - Intelligent retry logic with circuit breaker awareness
 * - Comprehensive error handling
 * - Memory-efficient garbage collection
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes - reduced for more up-to-date data
      gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (
          error instanceof Error &&
          "status" in error &&
          typeof error.status === "number" &&
          error.status >= 400 &&
          error.status < 500
        ) {
          return false;
        }

        // Don't retry if circuit breaker is open
        if (error instanceof Error && error.message.includes("Circuit breaker open")) {
          return false;
        }

        return failureCount < 3;
      },
      refetchOnWindowFocus: false, // Avoid unnecessary refetches
      refetchOnMount: true,
      retryOnMount: true,
    },
    mutations: {
      retry: 1,
      // Add error handling for mutations
      onError: (error) => {
        logger.error("[QueryClient] Mutation error:", error);
      },
    },
  },
});

// Optimized query key factories with type safety
export const queryKeys = {
  // User preferences
  userPreferences: (userId: string) => ["userPreferences", userId] as const,

  // MEXC data - using optimized modular keys
  mexc: mexcQueryKeys,

  // Legacy compatibility (gradually migrate these)
  mexcCalendar: () => mexcQueryKeys.calendar(),
  mexcSymbols: (vcoinId?: string) =>
    vcoinId ? mexcQueryKeys.symbol(vcoinId) : mexcQueryKeys.symbols(),
  mexcServerTime: () => mexcQueryKeys.serverTime(),

  // Monitored listings
  monitoredListings: () => ["monitoredListings"] as const,
  monitoredListing: (id: number) => ["monitoredListings", id] as const,

  // Snipe targets
  snipeTargets: (userId: string) => ["snipeTargets", userId] as const,
  snipeTarget: (id: number) => ["snipeTargets", id] as const,

  // Execution history
  executionHistory: (userId: string) => ["executionHistory", userId] as const,

  // Workflow status
  workflowStatus: () => ["workflowStatus"] as const,

  // Health checks
  healthCheck: () => ["health"] as const,

  // Status queries (React Query v2)
  status: {
    unified: () => ["status", "unified"] as const,
    system: () => ["status", "system"] as const,
    workflows: () => ["status", "workflows"] as const,
    credentials: () => ["status", "credentials"] as const,
    network: () => ["status", "network"] as const,
    trading: () => ["status", "trading"] as const,
  },

  // Auto-sniping queries
  autoSniping: {
    status: () => ["autoSniping", "status"] as const,
    config: () => ["autoSniping", "config"] as const,
    targets: () => ["autoSniping", "targets"] as const,
    execution: (id: string) => ["autoSniping", "execution", id] as const,
    performance: () => ["autoSniping", "performance"] as const,
  },
} as const;

/**
 * Create optimized query options for different data types
 */
export const createQueryOptions = {
  // Real-time data (tickers, prices) - short stale time
  realTime: <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) => ({
    queryKey,
    queryFn,
    staleTime: 15 * 1000, // 15 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // 30 seconds
    retry: 2,
  }),

  // Semi-static data (symbols, calendar) - medium stale time
  semiStatic: <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) => ({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: 3,
  }),

  // Static data (configuration) - long stale time
  static: <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) => ({
    queryKey,
    queryFn,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 3,
  }),

  // User-specific data - medium stale time, no background refetch
  user: <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) => ({
    queryKey,
    queryFn,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    refetchOnWindowFocus: false,
  }),
} as const;
