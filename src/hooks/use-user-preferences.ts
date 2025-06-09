import { queryKeys } from "@/src/lib/query-client";
import type { ExitStrategy } from "@/src/types/exit-strategies";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface TakeProfitLevels {
  level1: number; // Default: 5%
  level2: number; // Default: 10%
  level3: number; // Default: 15%
  level4: number; // Default: 25%
  custom?: number; // User-defined custom level
}

export interface UserTradingPreferences {
  userId: string;
  defaultBuyAmountUsdt: number;
  maxConcurrentSnipes: number;
  takeProfitLevels: TakeProfitLevels;
  defaultTakeProfitLevel: number; // Which level to use by default (1-4)
  stopLossPercent: number;
  riskTolerance: "low" | "medium" | "high";
  readyStatePattern: [number, number, number]; // [sts, st, tt]
  targetAdvanceHours: number;
  calendarPollIntervalSeconds: number;
  symbolsPollIntervalSeconds: number;
  // Exit Strategy Settings
  selectedExitStrategy: string; // "conservative", "balanced", "aggressive", "custom"
  customExitStrategy?: ExitStrategy; // Custom strategy if selectedExitStrategy is "custom"
  autoBuyEnabled: boolean; // Auto-buy on ready state
  autoSellEnabled: boolean; // Auto-sell at targets
  autoSnipeEnabled: boolean; // Auto-snipe by default
}

// Hook to get user preferences
export function useUserPreferences(userId: string) {
  return useQuery({
    queryKey: queryKeys.userPreferences(userId),
    queryFn: async (): Promise<UserTradingPreferences | null> => {
      try {
        const response = await fetch(`/api/user-preferences?userId=${encodeURIComponent(userId)}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch user preferences: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error("[useUserPreferences] Failed to fetch preferences:", error);
        throw error;
      }
    },
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

        const result = await response.json();
        return result.data || data;
      } catch (error) {
        console.error("[useUpdateUserPreferences] Failed to update preferences:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate and refetch user preferences
      queryClient.invalidateQueries({ queryKey: queryKeys.userPreferences(data.userId) });
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
        defaultTakeProfitLevel: 2,
        stopLossPercent: 5.0,
        riskTolerance: "medium",
        readyStatePattern: [2, 2, 4],
        targetAdvanceHours: 3.5,
        calendarPollIntervalSeconds: 300,
        symbolsPollIntervalSeconds: 30,
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
