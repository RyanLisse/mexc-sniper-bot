import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiResponse } from "@/src/lib/api-response";
import { queryKeys } from "@/src/lib/query-client";
import { useAuth } from "@/src/lib/supabase-auth-client";
import type { ExitStrategy } from "../types/exit-strategies";

export interface TakeProfitLevels {
  level1: number; // Default: 5%
  level2: number; // Default: 10%
  level3: number; // Default: 15%
  level4: number; // Default: 25%
  custom?: number; // User-defined custom level
}

export interface TakeProfitSellQuantities {
  level1: number; // Default: 25%
  level2: number; // Default: 25%
  level3: number; // Default: 25%
  level4: number; // Default: 25%
  custom?: number; // Default: 100%
}

// New interface for multi-level take-profit configuration
export interface MultiLevelTakeProfitLevel {
  id: string;
  level: string;
  profitPercentage: number;
  sellPortion: number;
  actionWhenReached: string;
}

export interface MultiLevelTakeProfitConfig {
  enabled: boolean;
  entryPrice?: number;
  levels: MultiLevelTakeProfitLevel[];
  trailingStopEnabled: boolean;
  trailingStopPercentage?: number;
}

export interface UserTradingPreferences {
  userId: string;
  defaultBuyAmountUsdt: number;
  maxConcurrentSnipes: number;
  takeProfitLevels: TakeProfitLevels;
  takeProfitSellQuantities?: TakeProfitSellQuantities; // New: sell quantities for each level
  defaultTakeProfitLevel: number; // Which level to use by default (1-4)
  stopLossPercent: number;
  riskTolerance: "low" | "medium" | "high";
  readyStatePattern: [number, number, number]; // [sts, st, tt]
  targetAdvanceHours: number;
  calendarPollIntervalSeconds: number;
  symbolsPollIntervalSeconds: number;
  // Enhanced Take Profit Strategy Settings
  takeProfitStrategy?: string; // "conservative", "balanced", "aggressive", "custom"
  takeProfitLevelsConfig?: string; // JSON string for multi-level configuration
  // Legacy Exit Strategy Settings (for backward compatibility)
  selectedExitStrategy: string; // "conservative", "balanced", "aggressive", "custom"
  customExitStrategy?: ExitStrategy; // Custom strategy if selectedExitStrategy is "custom"
  autoBuyEnabled: boolean; // Auto-buy on ready state
  autoSellEnabled: boolean; // Auto-sell at targets
  autoSnipeEnabled: boolean; // Auto-snipe by default
  // Multi-Level Take-Profit Configuration
  multiLevelTakeProfit?: MultiLevelTakeProfitConfig;
}

// Hook to get user preferences
export function useUserPreferences(userId?: string) {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: queryKeys.userPreferences(userId || "anonymous"),
    queryFn: async (): Promise<UserTradingPreferences | null> => {
      if (!userId) {
        throw new Error("User ID is required");
      }

      try {
        const response = await fetch(`/api/user-preferences?userId=${encodeURIComponent(userId)}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch user preferences: ${response.statusText}`);
        }

        const apiResponse: ApiResponse<UserTradingPreferences | null> = await response.json();

        if (!apiResponse.success) {
          throw new Error(apiResponse.error || "Failed to fetch user preferences");
        }

        return apiResponse.data || null;
      } catch (error) {
        console.error("[useUserPreferences] Failed to fetch preferences:", error);
        throw error;
      }
    },
    // Only fetch if user is authenticated and accessing their own data
    enabled: !!userId && isAuthenticated && user?.id === userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook to update user preferences
export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<UserTradingPreferences> & { userId: string }) => {
      try {
        const response = await fetch("/api/user-preferences", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error(`Failed to update user preferences: ${response.statusText}`);
        }

        const apiResponse: ApiResponse<Partial<UserTradingPreferences>> = await response.json();

        if (!apiResponse.success) {
          throw new Error(apiResponse.error || "Failed to update user preferences");
        }

        return apiResponse.data || data;
      } catch (error) {
        console.error("[useUpdateUserPreferences] Failed to update preferences:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate and refetch user preferences
      queryClient.invalidateQueries({ queryKey: queryKeys.userPreferences(data?.userId || "") });
    },
  });
}

// Hook to get take profit levels with user-friendly names
export function useTakeProfitLevels(userId: string) {
  const { data: preferences } = useUserPreferences(userId);

  if (!preferences) {
    return {
      levels: [
        { id: 1, name: "Conservative", value: 5.0, description: "5% - Safe, quick profits" },
        { id: 2, name: "Balanced", value: 10.0, description: "10% - Balanced risk/reward" },
        { id: 3, name: "Aggressive", value: 15.0, description: "15% - Higher risk, higher reward" },
        {
          id: 4,
          name: "Very Aggressive",
          value: 25.0,
          description: "25% - Maximum profit potential",
        },
      ],
      defaultLevel: 2,
      customLevel: undefined,
    };
  }

  return {
    levels: [
      {
        id: 1,
        name: "Conservative",
        value: preferences.takeProfitLevels.level1,
        description: `${preferences.takeProfitLevels.level1}% - Safe, quick profits`,
      },
      {
        id: 2,
        name: "Balanced",
        value: preferences.takeProfitLevels.level2,
        description: `${preferences.takeProfitLevels.level2}% - Balanced risk/reward`,
      },
      {
        id: 3,
        name: "Aggressive",
        value: preferences.takeProfitLevels.level3,
        description: `${preferences.takeProfitLevels.level3}% - Higher risk, higher reward`,
      },
      {
        id: 4,
        name: "Very Aggressive",
        value: preferences.takeProfitLevels.level4,
        description: `${preferences.takeProfitLevels.level4}% - Maximum profit potential`,
      },
    ],
    defaultLevel: preferences.defaultTakeProfitLevel,
    customLevel: preferences.takeProfitLevels.custom,
  };
}

// Hook to quickly update just the take profit levels
export function useUpdateTakeProfitLevels() {
  const updatePreferences = useUpdateUserPreferences();

  return useMutation({
    mutationFn: async (data: {
      userId: string;
      levels: TakeProfitLevels;
      defaultLevel: number;
    }) => {
      return updatePreferences.mutateAsync({
        userId: data.userId,
        takeProfitLevels: data.levels,
        defaultTakeProfitLevel: data.defaultLevel,
      });
    },
  });
}

// Hook to reset preferences to defaults
export function useResetUserPreferences() {
  const updatePreferences = useUpdateUserPreferences();

  return useMutation({
    mutationFn: async (userId: string) => {
      const defaultPreferences: UserTradingPreferences = {
        userId,
        defaultBuyAmountUsdt: 100.0,
        maxConcurrentSnipes: 3,
        takeProfitLevels: {
          level1: 5.0,
          level2: 10.0,
          level3: 15.0,
          level4: 25.0,
        },
        takeProfitSellQuantities: {
          level1: 25.0,
          level2: 25.0,
          level3: 25.0,
          level4: 25.0,
          custom: 100.0,
        },
        defaultTakeProfitLevel: 2,
        stopLossPercent: 5.0,
        riskTolerance: "medium",
        readyStatePattern: [2, 2, 4],
        targetAdvanceHours: 3.5,
        calendarPollIntervalSeconds: 300,
        symbolsPollIntervalSeconds: 30,
        takeProfitStrategy: "balanced",
        selectedExitStrategy: "balanced",
        autoBuyEnabled: true,
        autoSellEnabled: true,
        autoSnipeEnabled: true,
      };

      return updatePreferences.mutateAsync(defaultPreferences);
    },
  });
}

// Hook to get exit strategy preferences
export function useExitStrategyPreferences(userId: string) {
  const { data: preferences } = useUserPreferences(userId);

  return {
    selectedExitStrategy: preferences?.selectedExitStrategy || "balanced",
    customExitStrategy: preferences?.customExitStrategy,
    autoBuyEnabled: preferences?.autoBuyEnabled ?? true,
    autoSellEnabled: preferences?.autoSellEnabled ?? true,
    autoSnipeEnabled: preferences?.autoSnipeEnabled ?? true,
  };
}

// Hook to update exit strategy preferences
export function useUpdateExitStrategyPreferences() {
  const updatePreferences = useUpdateUserPreferences();

  return useMutation({
    mutationFn: async (data: {
      userId: string;
      selectedExitStrategy: string;
      customExitStrategy?: ExitStrategy;
      autoBuyEnabled?: boolean;
      autoSellEnabled?: boolean;
      autoSnipeEnabled?: boolean;
    }) => {
      return updatePreferences.mutateAsync({
        userId: data.userId,
        selectedExitStrategy: data.selectedExitStrategy,
        customExitStrategy: data.customExitStrategy,
        autoBuyEnabled: data.autoBuyEnabled,
        autoSellEnabled: data.autoSellEnabled,
        autoSnipeEnabled: data.autoSnipeEnabled,
      });
    },
  });
}

// Default multi-level take-profit configuration
const defaultMultiLevelConfig: MultiLevelTakeProfitConfig = {
  enabled: false,
  entryPrice: undefined, // Entry price will be set when position is entered
  trailingStopEnabled: false,
  trailingStopPercentage: 5,
  levels: [
    {
      id: "tp1",
      level: "TP1",
      profitPercentage: 30,
      sellPortion: 25,
      actionWhenReached: "Sell 25%",
    },
    {
      id: "tp2",
      level: "TP2",
      profitPercentage: 50,
      sellPortion: 25,
      actionWhenReached: "Sell another 25%",
    },
    {
      id: "tp3",
      level: "TP3",
      profitPercentage: 75,
      sellPortion: 25,
      actionWhenReached: "Sell another 25%",
    },
    {
      id: "tp4",
      level: "TP4",
      profitPercentage: 100,
      sellPortion: 25,
      actionWhenReached: "Sell final 25%",
    },
  ],
};

// Hook to get multi-level take-profit configuration
export function useMultiLevelTakeProfit(userId: string) {
  const { data: preferences } = useUserPreferences(userId);

  return {
    config: preferences?.multiLevelTakeProfit || defaultMultiLevelConfig,
    isEnabled: preferences?.multiLevelTakeProfit?.enabled || false,
  };
}

// Hook to update multi-level take-profit configuration
export function useUpdateMultiLevelTakeProfit() {
  const updatePreferences = useUpdateUserPreferences();

  return useMutation({
    mutationFn: async (data: { userId: string; config: MultiLevelTakeProfitConfig }) => {
      return updatePreferences.mutateAsync({
        userId: data.userId,
        multiLevelTakeProfit: data.config,
      });
    },
  });
}
