"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Trading Settings Sync Hook
 * 
 * Manages synchronization between user preferences and the Core Trading Service
 * Provides real-time status monitoring and immediate configuration updates
 */

export interface TradingSettingsStatus {
  userSettings: {
    takeProfitStrategy: string;
    takeProfitLevels: {
      level1: number;
      level2: number;
      level3: number;
      level4: number;
    };
    customTakeProfitConfig: any;
    stopLossPercent: number;
    riskTolerance: string;
    maxConcurrentSnipes: number;
    defaultBuyAmount: number;
    autoSnipeEnabled: boolean;
    autoBuyEnabled: boolean;
    autoSellEnabled: boolean;
    readyStatePattern: string;
    targetAdvanceHours: number;
  };
  executionSettings: {
    paperTradingMode: boolean;
    tradingEnabled: boolean;
    autoSnipingEnabled: boolean;
    maxPositions: number;
    currentRiskLevel: string;
    totalPnL: number;
    totalTrades: number;
    successRate: number;
    uptime: number;
  };
  syncStatus: {
    lastSync: string;
    isInSync: boolean;
    pendingUpdates: string[];
  };
}

export interface TradingSettingsUpdateRequest {
  action: "sync" | "update" | "reset";
  userId: string;
  settings?: Record<string, unknown>;
}

/**
 * Main trading settings sync hook
 */
export function useTradingSettingsSync(userId?: string) {
  const queryClient = useQueryClient();
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);

  // Query for trading settings status
  const {
    data: settingsStatus,
    isLoading,
    error,
    refetch
  } = useQuery<TradingSettingsStatus>({
    queryKey: ["trading-settings", userId],
    queryFn: async () => {
      if (!userId) {
        throw new Error("User ID is required");
      }

      const response = await fetch(`/api/trading-settings?userId=${userId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch trading settings: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!userId,
    refetchInterval: autoSyncEnabled ? 10000 : false, // Refetch every 10 seconds if auto-sync enabled
    staleTime: 5000, // Consider data stale after 5 seconds
    gcTime: 30000, // Keep in cache for 30 seconds
  });

  // Mutation for trading settings updates
  const settingsUpdateMutation = useMutation({
    mutationFn: async (request: TradingSettingsUpdateRequest) => {
      const response = await fetch("/api/trading-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update trading settings: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch settings data
      queryClient.invalidateQueries({ queryKey: ["trading-settings", userId] });
    },
  });

  // Sync user preferences to Core Trading Service
  const syncToExecutionSystem = useCallback(async () => {
    if (!userId) {
      throw new Error("User ID is required for sync");
    }

    return settingsUpdateMutation.mutateAsync({
      action: "sync",
      userId,
    });
  }, [userId, settingsUpdateMutation]);

  // Update Core Trading Service configuration directly
  const updateExecutionSettings = useCallback(async (settings: Record<string, unknown>) => {
    if (!userId) {
      throw new Error("User ID is required for update");
    }

    return settingsUpdateMutation.mutateAsync({
      action: "update",
      userId,
      settings,
    });
  }, [userId, settingsUpdateMutation]);

  // Reset to default configuration
  const resetToDefaults = useCallback(async () => {
    if (!userId) {
      throw new Error("User ID is required for reset");
    }

    return settingsUpdateMutation.mutateAsync({
      action: "reset",
      userId,
    });
  }, [userId, settingsUpdateMutation]);

  // Auto-sync control
  const enableAutoSync = useCallback(() => {
    setAutoSyncEnabled(true);
  }, []);

  const disableAutoSync = useCallback(() => {
    setAutoSyncEnabled(false);
  }, []);

  // Force refresh
  const forceRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["trading-settings", userId] });
  }, [queryClient, userId]);

  // Check if settings are in sync
  const isInSync = settingsStatus?.syncStatus?.isInSync ?? false;
  const hasConfig = !!settingsStatus;

  // Calculate sync health
  const syncHealth = {
    isHealthy: isInSync && hasConfig && !error,
    lastSync: settingsStatus?.syncStatus?.lastSync,
    pendingUpdates: settingsStatus?.syncStatus?.pendingUpdates || [],
    errorMessage: error instanceof Error ? error.message : null,
  };

  return {
    // Data
    settingsStatus,
    isLoading,
    error,
    
    // Sync operations
    syncToExecutionSystem,
    updateExecutionSettings,
    resetToDefaults,
    
    // Auto-sync control
    autoSyncEnabled,
    enableAutoSync,
    disableAutoSync,
    forceRefresh,
    
    // Status monitoring
    isInSync,
    syncHealth,
    
    // Operation status
    isUpdating: settingsUpdateMutation.isPending,
    updateError: settingsUpdateMutation.error,
    
    // Computed values for easy access
    userSettings: settingsStatus?.userSettings,
    executionSettings: settingsStatus?.executionSettings,
    isExecutionSystemActive: settingsStatus?.executionSettings?.tradingEnabled ?? false,
    isAutoSnipingActive: settingsStatus?.executionSettings?.autoSnipingEnabled ?? false,
  };
}

/**
 * Hook for monitoring settings synchronization status
 */
export function useTradingSettingsSyncMonitor(userId?: string) {
  const { settingsStatus, syncHealth, autoSyncEnabled } = useTradingSettingsSync(userId);

  const syncMetrics = {
    // Sync status
    isInSync: settingsStatus?.syncStatus?.isInSync ?? false,
    lastSyncTime: settingsStatus?.syncStatus?.lastSync,
    pendingCount: settingsStatus?.syncStatus?.pendingUpdates?.length || 0,
    
    // System health
    isExecutionSystemHealthy: syncHealth.isHealthy,
    errorCount: syncHealth.errorMessage ? 1 : 0,
    
    // Performance metrics
    userSettingsCount: settingsStatus?.userSettings ? Object.keys(settingsStatus.userSettings).length : 0,
    executionSettingsCount: settingsStatus?.executionSettings ? Object.keys(settingsStatus.executionSettings).length : 0,
    
    // Auto-sync status
    autoSyncEnabled,
    nextSyncEstimate: autoSyncEnabled ? new Date(Date.now() + 10000).toISOString() : null,
  };

  return {
    syncMetrics,
    syncHealth,
    settingsStatus,
  };
}

/**
 * Hook for bulk settings operations
 */
export function useBulkTradingSettings(userId?: string) {
  const { updateExecutionSettings, syncToExecutionSystem } = useTradingSettingsSync(userId);

  const applyTradingProfile = useCallback(async (profileName: "conservative" | "balanced" | "aggressive") => {
    const profiles = {
      conservative: {
        maxConcurrentPositions: 2,
        stopLossPercent: 3.0,
        confidenceThreshold: 85,
        maxPositionSize: 0.05,
        autoSnipingEnabled: false,
      },
      balanced: {
        maxConcurrentPositions: 3,
        stopLossPercent: 5.0,
        confidenceThreshold: 75,
        maxPositionSize: 0.1,
        autoSnipingEnabled: true,
      },
      aggressive: {
        maxConcurrentPositions: 5,
        stopLossPercent: 8.0,
        confidenceThreshold: 65,
        maxPositionSize: 0.2,
        autoSnipingEnabled: true,
      },
    };

    const profile = profiles[profileName];
    return updateExecutionSettings(profile);
  }, [updateExecutionSettings]);

  const applyRiskLevel = useCallback(async (riskLevel: "low" | "medium" | "high") => {
    const riskSettings = {
      low: {
        maxConcurrentPositions: 2,
        stopLossPercent: 3.0,
        confidenceThreshold: 85,
        maxPositionSize: 0.05,
      },
      medium: {
        maxConcurrentPositions: 3,
        stopLossPercent: 5.0,
        confidenceThreshold: 75,
        maxPositionSize: 0.1,
      },
      high: {
        maxConcurrentPositions: 5,
        stopLossPercent: 8.0,
        confidenceThreshold: 65,
        maxPositionSize: 0.2,
      },
    };

    const settings = riskSettings[riskLevel];
    return updateExecutionSettings(settings);
  }, [updateExecutionSettings]);

  const enableTradingMode = useCallback(async (paperTrading: boolean) => {
    return updateExecutionSettings({
      enablePaperTrading: paperTrading,
      tradingEnabled: true,
    });
  }, [updateExecutionSettings]);

  const emergencyStop = useCallback(async () => {
    return updateExecutionSettings({
      autoSnipingEnabled: false,
      tradingEnabled: false,
      emergencyStop: true,
    });
  }, [updateExecutionSettings]);

  return {
    applyTradingProfile,
    applyRiskLevel,
    enableTradingMode,
    emergencyStop,
    syncToExecutionSystem,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format sync status for display
 */
export function formatSyncStatus(syncStatus: any): string {
  if (!syncStatus) return "Unknown";
  
  if (syncStatus.isInSync) {
    return "In Sync";
  }
  
  if (syncStatus.pendingUpdates?.length > 0) {
    return `${syncStatus.pendingUpdates.length} Pending Updates`;
  }
  
  return "Out of Sync";
}

/**
 * Calculate sync health score (0-100)
 */
export function calculateSyncHealthScore(syncHealth: any): number {
  if (!syncHealth) return 0;
  
  let score = 100;
  
  // Deduct for errors
  if (syncHealth.errorMessage) score -= 50;
  
  // Deduct for pending updates
  if (syncHealth.pendingUpdates?.length > 0) {
    score -= Math.min(syncHealth.pendingUpdates.length * 10, 30);
  }
  
  // Deduct for old sync time
  if (syncHealth.lastSync) {
    const syncAge = Date.now() - new Date(syncHealth.lastSync).getTime();
    const minutesOld = syncAge / (1000 * 60);
    
    if (minutesOld > 60) score -= 20; // Very old sync
    else if (minutesOld > 10) score -= 10; // Somewhat old sync
  }
  
  return Math.max(score, 0);
}