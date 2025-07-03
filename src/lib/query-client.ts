import { QueryClient } from "@tanstack/react-query";

/**
 * React Query Configuration - Anti-Retry Storm Configuration
 *
 * CRITICAL: This configuration is specifically designed to prevent retry storms
 * and cascade failures that can overwhelm the MEXC API and our backend services.
 *
 * Key Anti-Storm Measures:
 * 1. NO DEFAULT RETRIES: All retries are disabled by default (retry: false)
 * 2. LONGER DELAYS: When retries do occur, they use 5s+ delays
 * 3. NO AUTO-REFETCH: Automatic refetch intervals are disabled
 * 4. CIRCUIT BREAKER AWARE: Respects circuit breaker "open" states
 * 5. NETWORK ERROR DETECTION: Immediately fails on timeouts/connection errors
 *
 * Previous Issues Fixed:
 * - High-frequency failed requests were cascading into retry storms
 * - Auto-refetch was amplifying failures during outages
 * - Multiple queries retrying simultaneously overwhelmed the API
 * - Insufficient backoff delays caused immediate re-attempts
 *
 * Configuration Principles:
 * - Fail fast on permanent errors (auth, network timeouts)
 * - Use manual refetch instead of automatic intervals
 * - Rely on user-initiated actions rather than background polling
 * - Prefer stale data over cascading failures
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes - reduced for more up-to-date data
      gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
      retry: (_failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (
          error instanceof Error &&
          "status" in error &&
          typeof error.status === "number" &&
          error.status >= 400 &&
          error.status < 500
        ) {
          return false;
        }

        // Don't retry on specific server errors that indicate DB issues
        if (
          error instanceof Error &&
          error.message.includes("DB_CONNECTION_ERROR")
        ) {
          return false;
        }

        // Don't retry if circuit breaker is open
        if (
          error instanceof Error &&
          error.message.includes("Circuit breaker open")
        ) {
          return false;
        }

        // Don't retry on network timeout errors to prevent cascade failures
        if (
          error instanceof Error &&
          (error.message.includes("timeout") ||
            error.message.includes("ECONNREFUSED") ||
            error.message.includes("ENOTFOUND") ||
            error.message.includes("network error"))
        ) {
          return false;
        }

        // Extremely conservative retry to prevent storms - no retries by default
        return false; // Completely disable retries to prevent cascade failures
      },
      retryDelay: (attemptIndex) => Math.min(5000 * 2 ** attemptIndex, 60000), // Longer delays: 5s, 10s, 20s, max 60s
      refetchOnWindowFocus: false, // Avoid unnecessary refetches
      refetchOnMount: true,
      retryOnMount: false, // Don't retry failed queries on component mount
    },
    mutations: {
      retry: 0, // Don't retry mutations to prevent duplicate operations
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Add error handling for mutations
      onError: (error) => {
        console.error("[QueryClient] Mutation error:", error);
      },
    },
  },
});

// Optimized query key factories with type safety
export const queryKeys = {
  // User preferences
  userPreferences: (userId: string) => ["userPreferences", userId] as const,

  // MEXC data - simplified keys
  mexcCalendar: () => ["mexc", "calendar"] as const,
  mexcSymbols: (vcoinId?: string) =>
    vcoinId
      ? (["mexc", "symbol", vcoinId] as const)
      : (["mexc", "symbols"] as const),
  mexcServerTime: () => ["mexc", "serverTime"] as const,

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
    refetchInterval: false, // Disable automatic refetch to prevent storms
    retry: 0, // No retries for real-time data to prevent cascade failures
    refetchOnWindowFocus: false,
  }),

  // Semi-static data (symbols, calendar) - medium stale time
  semiStatic: <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) => ({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: 0, // No retries to prevent cascade failures
    refetchOnWindowFocus: false,
  }),

  // Static data (configuration) - long stale time
  static: <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) => ({
    queryKey,
    queryFn,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 0, // No retries to prevent cascade failures
    refetchOnWindowFocus: false,
  }),

  // User-specific data - medium stale time, no background refetch
  user: <T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) => ({
    queryKey,
    queryFn,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 0, // No retries to prevent cascade failures
    refetchOnWindowFocus: false,
  }),
} as const;
