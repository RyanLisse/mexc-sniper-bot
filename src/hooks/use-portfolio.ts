import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { snipeTargets } from "../db/schema";
import { useAuth } from "../lib/kinde-auth-client";

export interface PortfolioPosition {
  id: number;
  vcoinId: string;
  symbolName: string;
  entryStrategy: string;
  positionSizeUsdt: number;
  executionPrice: number;
  actualPositionSize: number;
  status: string;
  stopLossPercent: number;
  takeProfitLevel: number;
  actualExecutionTime: number;
  createdAt: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

export interface PortfolioMetrics {
  totalActivePositions: number;
  totalUnrealizedPnL: number;
  totalCompletedTrades: number;
  successfulTrades: number;
  successRate: number;
  totalCapitalDeployed: number;
}

export interface PortfolioActivity {
  id: number;
  symbol: string;
  action: string;
  status: string;
  quantity: number;
  price: number;
  totalCost: number;
  timestamp: number;
  orderId: string;
}

export interface Portfolio {
  activePositions: PortfolioPosition[];
  metrics: PortfolioMetrics;
  recentActivity: PortfolioActivity[];
}

// Hook to get portfolio data
export function usePortfolio(userId: string) {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["portfolio", userId, "active"],
    queryFn: async (): Promise<Portfolio> => {
      const response = await fetch(`/api/portfolio?userId=${encodeURIComponent(userId)}`, {
        credentials: "include", // Include authentication cookies
      });

      if (!response.ok) {
        // Don't throw errors for 403/401 when not authenticated
        if (!isAuthenticated && (response.status === 403 || response.status === 401)) {
          return {
            activePositions: [],
            metrics: {
              totalActivePositions: 0,
              totalUnrealizedPnL: 0,
              totalCompletedTrades: 0,
              successfulTrades: 0,
              successRate: 0,
              totalCapitalDeployed: 0,
            },
            recentActivity: [],
          };
        }
        throw new Error(`Failed to fetch portfolio: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch portfolio");
      }

      return data.data;
    },
    staleTime: 30 * 1000, // 30 seconds - portfolio data cache
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
    refetchInterval: false, // Disable automatic refetch to prevent storms
    refetchOnWindowFocus: false, // Don't refetch on window focus for financial data
    placeholderData: {
      activePositions: [],
      metrics: {
        totalActivePositions: 0,
        totalUnrealizedPnL: 0,
        totalCompletedTrades: 0,
        successfulTrades: 0,
        successRate: 0,
        totalCapitalDeployed: 0,
      },
      recentActivity: [],
    }, // Prevent loading flicker
    retry: (failureCount, error) => {
      // Don't retry auth errors
      const errorMessage = error?.message || "";
      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        return false;
      }
      // Don't retry network errors to prevent cascade failures
      if (errorMessage.includes("timeout") || 
          errorMessage.includes("ECONNREFUSED") ||
          errorMessage.includes("Circuit breaker")) {
        return false;
      }
      // No retries to prevent storms
      return false;
    },
    enabled: !!userId && userId !== "anonymous" && isAuthenticated && user?.id === userId,
  });
}

// Hook to get snipe targets
export function useSnipeTargets(userId: string, status?: string) {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["snipeTargets", userId, status, "active"],
    queryFn: async () => {
      const params = new URLSearchParams({ userId });
      if (status) params.append("status", status);

      const response = await fetch(`/api/snipe-targets?${params.toString()}`, {
        credentials: "include", // Include authentication cookies
      });

      if (!response.ok) {
        // Don't throw errors for 403/401 when not authenticated
        if (!isAuthenticated && (response.status === 403 || response.status === 401)) {
          return [];
        }
        throw new Error(`Failed to fetch snipe targets: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch snipe targets");
      }

      return data.data;
    },
    staleTime: 10 * 1000, // 10 seconds - snipe targets cache
    gcTime: 2 * 60 * 1000, // 2 minutes garbage collection
    refetchOnWindowFocus: false, // Don't refetch on window focus
    placeholderData: [], // Prevent loading flicker
    retry: (failureCount, error) => {
      // Don't retry auth errors
      const errorMessage = error?.message || "";
      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        return false;
      }
      // Don't retry network errors to prevent cascade failures
      if (errorMessage.includes("timeout") || 
          errorMessage.includes("ECONNREFUSED") ||
          errorMessage.includes("Circuit breaker")) {
        return false;
      }
      // No retries to prevent storms
      return false;
    },
    enabled: !!userId && userId !== "anonymous" && isAuthenticated && user?.id === userId,
  });
}

// Hook to create snipe target
export function useCreateSnipeTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (snipeTarget: {
      userId: string;
      vcoinId: string;
      symbolName: string;
      entryStrategy?: string;
      entryPrice?: number;
      positionSizeUsdt: number;
      takeProfitLevel?: number;
      takeProfitCustom?: number;
      stopLossPercent?: number;
      status?: string;
      priority?: number;
      targetExecutionTime?: number;
      confidenceScore?: number;
      riskLevel?: string;
    }) => {
      const response = await fetch("/api/snipe-targets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include authentication cookies
        body: JSON.stringify(snipeTarget),
      });

      if (!response.ok) {
        throw new Error(`Failed to create snipe target: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to create snipe target");
      }

      return data.data;
    },
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["snipeTargets", data.userId] });
      queryClient.invalidateQueries({ queryKey: ["portfolio", data.userId] });
    },
  });
}

// Hook to update snipe target
export function useUpdateSnipeTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: number;
      updates: Partial<
        Pick<
          typeof snipeTargets.$inferInsert,
          | "status"
          | "priority"
          | "takeProfitLevel"
          | "stopLossPercent"
          | "entryStrategy"
          | "entryPrice"
          | "positionSizeUsdt"
          | "takeProfitCustom"
          | "confidenceScore"
          | "riskLevel"
          | "errorMessage"
        >
      >;
    }) => {
      const response = await fetch(`/api/snipe-targets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include authentication cookies
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update snipe target: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to update snipe target");
      }

      return data.data;
    },
    onSuccess: (_data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["snipeTargets"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
}

// Hook to delete snipe target
export function useDeleteSnipeTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/snipe-targets/${id}`, {
        method: "DELETE",
        credentials: "include", // Include authentication cookies
      });

      if (!response.ok) {
        throw new Error(`Failed to delete snipe target: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to delete snipe target");
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["snipeTargets"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
}

// Hook to control auto exit manager
export function useAutoExitManager() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["autoExitManager", "status", "active"],
    queryFn: async () => {
      const response = await fetch("/api/auto-exit-manager", {
        credentials: "include", // Include authentication cookies
      });

      if (!response.ok) {
        throw new Error(`Failed to get auto exit manager status: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to get auto exit manager status");
      }

      return data.data;
    },
    staleTime: 5 * 1000, // 5 seconds - exit manager status cache
    gcTime: 60 * 1000, // 1 minute garbage collection
    refetchInterval: 10 * 1000, // Refetch every 10 seconds
    refetchOnWindowFocus: false, // Don't refetch on window focus
    placeholderData: null, // Prevent loading flicker
    retry: (failureCount, error) => {
      // Don't retry auth errors
      const errorMessage = error?.message || "";
      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const controlMutation = useMutation({
    mutationFn: async (action: "start" | "stop") => {
      const response = await fetch("/api/auto-exit-manager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include authentication cookies
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} auto exit manager: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || `Failed to ${action} auto exit manager`);
      }

      return data;
    },
    onSuccess: () => {
      // Refetch status after control action
      queryClient.invalidateQueries({ queryKey: ["autoExitManager", "status"] });
    },
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    error: statusQuery.error,
    start: () => controlMutation.mutate("start"),
    stop: () => controlMutation.mutate("stop"),
    isControlling: controlMutation.isPending,
    controlError: controlMutation.error,
  };
}
