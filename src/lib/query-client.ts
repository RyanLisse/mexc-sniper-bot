import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
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
        return failureCount < 3;
      },
    },
    mutations: {
      retry: 1,
    },
  },
});

// Query keys for type safety and consistency
export const queryKeys = {
  // User preferences
  userPreferences: (userId: string) => ["userPreferences", userId] as const,

  // MEXC data
  mexcCalendar: () => ["mexc", "calendar"] as const,
  mexcSymbols: (vcoinId?: string) => ["mexc", "symbols", vcoinId] as const,
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
} as const;
