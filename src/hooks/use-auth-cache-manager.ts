import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/src/lib/supabase-auth-client";

/**
 * Hook to manage cache clearing when authentication state changes
 * This ensures that old user data doesn't persist when users switch accounts
 */
export function useAuthCacheManager() {
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user?.id) {
      // When a user is authenticated, clear any caches that might contain
      // data from previous sessions or anonymous users
      const userId = user.id;

      // Clear any old localStorage entries that might conflict
      const keysToRemove = [
        "mexc-user-id", // Random user ID cache
        "pattern-sniper-monitoring", // If it contains user-specific data
      ];

      keysToRemove.forEach((key) => {
        const existing = localStorage.getItem(key);
        if (existing && existing !== userId) {
          localStorage.removeItem(key);
        }
      });

      // Invalidate React Query caches that might have old user data
      // Only do this once per authentication change to avoid excessive cache clearing
      const hasBeenCleared = sessionStorage.getItem(`cache-cleared-${userId}`);
      if (!hasBeenCleared) {
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            // Clear queries that include user-related data
            return (
              Array.isArray(queryKey) &&
              (queryKey.includes("api-credentials") ||
                queryKey.includes("account-balance") ||
                queryKey.includes("user-preferences") ||
                queryKey.includes("transactions"))
            );
          },
        });

        // Mark as cleared for this session
        sessionStorage.setItem(`cache-cleared-${userId}`, "true");
      }
    }
  }, [user?.id, isLoading, queryClient]);

  return {
    clearUserCaches: () => {
      // Manual cache clearing function
      queryClient.clear();
      localStorage.removeItem("mexc-user-id");
      localStorage.removeItem("pattern-sniper-monitoring");

      // Clear all session markers
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("cache-cleared-")) {
          sessionStorage.removeItem(key);
        }
      });
    },
  };
}
