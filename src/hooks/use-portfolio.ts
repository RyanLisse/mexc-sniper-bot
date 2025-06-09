import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
  return useQuery({
    queryKey: ["portfolio", userId],
    queryFn: async (): Promise<Portfolio> => {
      const response = await fetch(`/api/portfolio?userId=${encodeURIComponent(userId)}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch portfolio: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch portfolio");
      }

      return data.data;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    enabled: !!userId && userId !== "anonymous",
  });
}

// Hook to get snipe targets
export function useSnipeTargets(userId: string, status?: string) {
  return useQuery({
    queryKey: ["snipeTargets", userId, status],
    queryFn: async () => {
      const params = new URLSearchParams({ userId });
      if (status) params.append("status", status);

      const response = await fetch(`/api/snipe-targets?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch snipe targets: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch snipe targets");
      }

      return data.data;
    },
    staleTime: 10 * 1000, // 10 seconds
    enabled: !!userId && userId !== "anonymous",
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
      updates: Record<string, any>;
    }) => {
      const response = await fetch(`/api/snipe-targets/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
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
    queryKey: ["autoExitManager", "status"],
    queryFn: async () => {
      const response = await fetch("/api/auto-exit-manager");

      if (!response.ok) {
        throw new Error(`Failed to get auto exit manager status: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to get auto exit manager status");
      }

      return data.data;
    },
    staleTime: 5 * 1000, // 5 seconds
    refetchInterval: 10 * 1000, // Refetch every 10 seconds
  });

  const controlMutation = useMutation({
    mutationFn: async (action: "start" | "stop") => {
      const response = await fetch("/api/auto-exit-manager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
