/**
 * Status Synchronization Hook
 *
 * Handles React Query cache invalidation and status synchronization
 * on the client side when status updates are received from the server.
 *
 * Addresses the client-side portion of the synchronization gaps.
 */

import { useAuth } from "@/src/lib/supabase-auth-client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface StatusSyncData {
  cacheInvalidated: boolean;
  timestamp: string;
  triggeredBy: string;
  success?: boolean;
  servicesNotified?: string[];
  statusRefreshed?: boolean;
}

export interface StatusSyncOptions {
  invalidateRelatedQueries?: boolean;
  refetchActiveQueries?: boolean;
  notifySuccess?: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useStatusSync() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  /**
   * Get all React Query keys that should be invalidated during status sync
   */
  const getQueryKeysToInvalidate = useCallback(
    (targetUserId?: string): (string | number)[][] => {
      const effectiveUserId = targetUserId || userId;

      if (!effectiveUserId) {
        console.warn("[useStatusSync] No user ID available for cache invalidation");
        return [];
      }

      return [
        // Status and connectivity queries
        ["mexc-connectivity", effectiveUserId],
        ["enhanced-connectivity"],
        ["mexc-status"],
        ["connectivity-status", effectiveUserId],

        // Credential-related queries
        ["api-credentials", effectiveUserId],
        ["credential-status", effectiveUserId],
        ["user-credentials", effectiveUserId, "mexc"],

        // Balance and account queries
        ["account-balance", effectiveUserId, "active"],
        ["account-balance", effectiveUserId],
        ["mexc-balances", effectiveUserId],

        // Health and monitoring queries
        ["connection-health"],
        ["system-health"],
        ["monitoring-status"],

        // Auto-sniping and trading queries
        ["auto-sniping-status", effectiveUserId],
        ["trading-status", effectiveUserId],
      ];
    },
    [userId]
  );

  /**
   * Handle status synchronization from server response
   */
  const handleStatusSync = useCallback(
    async (statusSyncData: StatusSyncData, options: StatusSyncOptions = {}) => {
      const {
        invalidateRelatedQueries = true,
        refetchActiveQueries = false,
        notifySuccess = false,
      } = options;

      console.info("[useStatusSync] Processing status sync data", {
        triggeredBy: statusSyncData.triggeredBy,
        success: statusSyncData.success,
        servicesNotified: statusSyncData.servicesNotified,
        timestamp: statusSyncData.timestamp,
      });

      try {
        if (statusSyncData.success && invalidateRelatedQueries) {
          // Get all query keys that need invalidation
          const queryKeys = getQueryKeysToInvalidate();

          console.info("[useStatusSync] Invalidating query cache keys", {
            keyCount: queryKeys.length,
            keys: queryKeys,
          });

          // Invalidate all related queries
          const invalidationPromises = queryKeys.map((queryKey) =>
            queryClient.invalidateQueries({ queryKey })
          );

          await Promise.allSettled(invalidationPromises);

          // Optionally refetch active queries immediately
          if (refetchActiveQueries) {
            const refetchPromises = queryKeys.map((queryKey) =>
              queryClient.refetchQueries({
                queryKey,
                type: "active",
              })
            );

            await Promise.allSettled(refetchPromises);
          }

          console.info("[useStatusSync] Cache invalidation completed", {
            invalidatedQueries: queryKeys.length,
            refetchedActive: refetchActiveQueries,
          });
        }

        if (notifySuccess && statusSyncData.success) {
          // Could integrate with a toast notification system here
          console.info("[useStatusSync] Status synchronization successful");
        }
      } catch (error) {
        console.error("[useStatusSync] Failed to process status sync:", {
          error: error instanceof Error ? error.message : String(error),
          statusSyncData,
        });
      }
    },
    [queryClient, getQueryKeysToInvalidate]
  );

  /**
   * Manually invalidate all status-related queries
   */
  const invalidateStatusQueries = useCallback(
    async (targetUserId?: string) => {
      const queryKeys = getQueryKeysToInvalidate(targetUserId);

      console.info("[useStatusSync] Manually invalidating status queries", {
        keyCount: queryKeys.length,
      });

      try {
        const invalidationPromises = queryKeys.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        );

        await Promise.allSettled(invalidationPromises);

        console.info("[useStatusSync] Manual invalidation completed");
      } catch (error) {
        console.error("[useStatusSync] Manual invalidation failed:", error);
      }
    },
    [queryClient, getQueryKeysToInvalidate]
  );

  /**
   * Force refetch of all status-related queries
   */
  const refetchStatusQueries = useCallback(
    async (targetUserId?: string) => {
      const queryKeys = getQueryKeysToInvalidate(targetUserId);

      console.info("[useStatusSync] Force refetching status queries", {
        keyCount: queryKeys.length,
      });

      try {
        const refetchPromises = queryKeys.map((queryKey) =>
          queryClient.refetchQueries({ queryKey })
        );

        await Promise.allSettled(refetchPromises);

        console.info("[useStatusSync] Force refetch completed");
      } catch (error) {
        console.error("[useStatusSync] Force refetch failed:", error);
      }
    },
    [queryClient, getQueryKeysToInvalidate]
  );

  /**
   * Get current cache status for debugging
   */
  const getCacheStatus = useCallback(() => {
    const queryKeys = getQueryKeysToInvalidate();
    const cacheStatus = queryKeys.map((queryKey) => ({
      queryKey,
      data: queryClient.getQueryData(queryKey),
      state: queryClient.getQueryState(queryKey),
    }));

    return cacheStatus;
  }, [queryClient, getQueryKeysToInvalidate]);

  return {
    handleStatusSync,
    invalidateStatusQueries,
    refetchStatusQueries,
    getCacheStatus,
    getQueryKeysToInvalidate,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract status sync data from API response
 */
export function extractStatusSyncData(response: any): StatusSyncData | null {
  if (response?.data?.statusSync) {
    return response.data.statusSync;
  }

  if (response?.statusSync) {
    return response.statusSync;
  }

  return null;
}

/**
 * Check if response contains status sync information
 */
export function hasStatusSyncData(response: any): boolean {
  return extractStatusSyncData(response) !== null;
}
