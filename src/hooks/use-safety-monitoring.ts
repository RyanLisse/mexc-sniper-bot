import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface SystemHealth {
  overall: "healthy" | "warning" | "critical";
  services: {
    [key: string]: {
      status: "online" | "degraded" | "offline";
      health: number;
      responseTime: number;
      errorRate: number;
      lastChecked: string;
    };
  };
  lastUpdated: string;
  totalServices: number;
  healthyServices: number;
}

export interface RiskMetrics {
  currentRisk: "low" | "medium" | "high" | "critical";
  totalPnL: number;
  maxDrawdown: number;
  riskScore: number;
  circuitBreakerStatus: "closed" | "open";
  activePositions: number;
  maxPositionsAllowed: number;
  emergencyHaltActive: boolean;
  dailyLoss: number;
  maxDailyLoss: number;
  positionSizeUtilization: number;
  riskEvents: Array<{
    id: string;
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    timestamp: string;
    description: string;
  }>;
}

export interface SimulationStatus {
  active: boolean;
  sessionId?: string;
  virtualBalance: number;
  totalTrades: number;
  winRate: number;
  virtualPnL: number;
  startTime?: string;
  configuration: {
    enabled: boolean;
    virtualBalance: number;
    realDataDelay: number;
  };
  recentTrades: Array<{
    id: string;
    symbol: string;
    type: "buy" | "sell";
    quantity: number;
    price: number;
    timestamp: string;
    profit?: number;
  }>;
}

export interface ReconciliationStatus {
  lastCheck: string;
  positionAccuracy: number;
  balanceAccuracy: number;
  discrepanciesFound: number;
  autoResolved: number;
  manualResolutionRequired: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  nextScheduledCheck: string;
  criticalDiscrepancies: Array<{
    type: "position" | "balance";
    asset: string;
    expected: number;
    actual: number;
    difference: number;
    severity: "low" | "medium" | "high";
  }>;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByService: { [service: string]: number };
  recentErrors: Array<{
    id: string;
    service: string;
    error: string;
    timestamp: string;
    severity: "low" | "medium" | "high" | "critical";
    resolved: boolean;
  }>;
  recoveryPatterns: Array<{
    pattern: string;
    occurrences: number;
    successRate: number;
  }>;
}

// Fetch system health
export function useSystemHealth(options: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: ["safety", "system-health"],
    queryFn: async (): Promise<SystemHealth> => {
      const response = await fetch(
        "/api/triggers/safety?action=system-health-check"
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch system health: ${response.statusText}`
        );
      }
      const result = await response.json();

      // Transform the API response to match our interface
      return {
        overall: result.status || "critical",
        services: result.services || {},
        lastUpdated: result.timestamp || new Date().toISOString(),
        totalServices: Object.keys(result.services || {}).length,
        healthyServices: Object.values(result.services || {}).filter(
          (service: any) => service.status === "online"
        ).length,
      };
    },
    refetchInterval: options.refetchInterval || 10000, // 10 seconds default
    retry: 3,
    staleTime: 5000,
  });
}

// Fetch risk metrics
export function useRiskMetrics(options: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: ["safety", "risk-metrics"],
    queryFn: async (): Promise<RiskMetrics> => {
      const response = await fetch(
        "/api/triggers/safety?action=risk-assessment"
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch risk metrics: ${response.statusText}`);
      }
      const result = await response.json();

      return {
        currentRisk: result.currentRisk || "low",
        totalPnL: result.totalPnL || 0,
        maxDrawdown: result.maxDrawdown || 0,
        riskScore: result.riskScore || 0,
        circuitBreakerStatus: result.circuitBreakerStatus || "closed",
        activePositions: result.activePositions || 0,
        maxPositionsAllowed: result.maxPositionsAllowed || 10,
        emergencyHaltActive: result.emergencyHaltActive || false,
        dailyLoss: result.dailyLoss || 0,
        maxDailyLoss: result.maxDailyLoss || 1000,
        positionSizeUtilization: result.positionSizeUtilization || 0,
        riskEvents: result.riskEvents || [],
      };
    },
    refetchInterval: options.refetchInterval || 5000, // 5 seconds default
    retry: 3,
    staleTime: 3000,
  });
}

// Fetch simulation status
export function useSimulationStatus(
  options: { refetchInterval?: number } = {}
) {
  return useQuery({
    queryKey: ["safety", "simulation-status"],
    queryFn: async (): Promise<SimulationStatus> => {
      const response = await fetch(
        "/api/triggers/safety?action=simulation-status"
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch simulation status: ${response.statusText}`
        );
      }
      const result = await response.json();

      return {
        active: result.active || false,
        sessionId: result.sessionId,
        virtualBalance: result.virtualBalance || 10000,
        totalTrades: result.totalTrades || 0,
        winRate: result.winRate || 0,
        virtualPnL: result.virtualPnL || 0,
        startTime: result.startTime,
        configuration: result.configuration || {
          enabled: false,
          virtualBalance: 10000,
          realDataDelay: 0,
        },
        recentTrades: result.recentTrades || [],
      };
    },
    refetchInterval: options.refetchInterval || 15000, // 15 seconds default
    retry: 3,
    staleTime: 10000,
  });
}

// Fetch reconciliation status
export function useReconciliationStatus(
  options: { refetchInterval?: number } = {}
) {
  return useQuery({
    queryKey: ["safety", "reconciliation-status"],
    queryFn: async (): Promise<ReconciliationStatus> => {
      const response = await fetch(
        "/api/triggers/safety?action=position-reconciliation"
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch reconciliation status: ${response.statusText}`
        );
      }
      const result = await response.json();

      return {
        lastCheck: result.lastCheck || new Date().toISOString(),
        positionAccuracy: result.positionAccuracy || 100,
        balanceAccuracy: result.balanceAccuracy || 100,
        discrepanciesFound: result.discrepanciesFound || 0,
        autoResolved: result.autoResolved || 0,
        manualResolutionRequired: result.manualResolutionRequired || 0,
        status: result.status || "completed",
        nextScheduledCheck:
          result.nextScheduledCheck ||
          new Date(Date.now() + 3600000).toISOString(),
        criticalDiscrepancies: result.criticalDiscrepancies || [],
      };
    },
    refetchInterval: options.refetchInterval || 30000, // 30 seconds default
    retry: 3,
    staleTime: 20000,
  });
}

// Emergency halt mutation
export function useEmergencyHalt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reason }: { reason: string }) => {
      const response = await fetch("/api/triggers/safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "emergency-halt",
          reason,
        }),
      });

      if (!response.ok) {
        throw new Error(`Emergency halt failed: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Emergency halt activated successfully");
      // Invalidate and refetch safety data
      queryClient.invalidateQueries({ queryKey: ["safety"] });
    },
    onError: (error) => {
      toast.error(`Emergency halt failed: ${error.message}`);
    },
  });
}

// Toggle simulation mutation
export function useToggleSimulation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ enable }: { enable: boolean }) => {
      const response = await fetch("/api/triggers/safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-simulation",
          enable,
        }),
      });

      if (!response.ok) {
        throw new Error(`Simulation toggle failed: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      toast.success(
        `Simulation ${variables.enable ? "enabled" : "disabled"} successfully`
      );
      // Invalidate simulation status
      queryClient.invalidateQueries({
        queryKey: ["safety", "simulation-status"],
      });
    },
    onError: (error) => {
      toast.error(`Simulation toggle failed: ${error.message}`);
    },
  });
}

// Comprehensive safety check mutation
export function useComprehensiveSafetyCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(
        "/api/triggers/safety?action=comprehensive-safety-check"
      );
      if (!response.ok) {
        throw new Error(`Safety check failed: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (result) => {
      toast.success(`Safety check completed: ${result.overall}`);
      // Invalidate all safety data
      queryClient.invalidateQueries({ queryKey: ["safety"] });
    },
    onError: (error) => {
      toast.error(`Safety check failed: ${error.message}`);
    },
  });
}

// Custom hook for real-time safety monitoring
export function useSafetyMonitoring() {
  const systemHealth = useSystemHealth({ refetchInterval: 10000 });
  const riskMetrics = useRiskMetrics({ refetchInterval: 5000 });
  const simulationStatus = useSimulationStatus({ refetchInterval: 15000 });
  const reconciliationStatus = useReconciliationStatus({
    refetchInterval: 30000,
  });

  const emergencyHalt = useEmergencyHalt();
  const toggleSimulation = useToggleSimulation();
  const comprehensiveSafetyCheck = useComprehensiveSafetyCheck();

  const isLoading =
    systemHealth.isLoading ||
    riskMetrics.isLoading ||
    simulationStatus.isLoading ||
    reconciliationStatus.isLoading;

  const hasError =
    systemHealth.error ||
    riskMetrics.error ||
    simulationStatus.error ||
    reconciliationStatus.error;

  const overallHealth = (() => {
    if (hasError) return "critical";
    if (
      systemHealth.data?.overall === "critical" ||
      riskMetrics.data?.currentRisk === "critical"
    ) {
      return "critical";
    }
    if (
      systemHealth.data?.overall === "warning" ||
      riskMetrics.data?.currentRisk === "high"
    ) {
      return "warning";
    }
    return "healthy";
  })();

  return {
    // Data
    systemHealth: systemHealth.data,
    riskMetrics: riskMetrics.data,
    simulationStatus: simulationStatus.data,
    reconciliationStatus: reconciliationStatus.data,

    // Loading states
    isLoading,
    hasError,
    overallHealth,

    // Actions
    emergencyHalt: emergencyHalt.mutate,
    toggleSimulation: toggleSimulation.mutate,
    runSafetyCheck: comprehensiveSafetyCheck.mutate,

    // Refetch functions
    refetchAll: () => {
      systemHealth.refetch();
      riskMetrics.refetch();
      simulationStatus.refetch();
      reconciliationStatus.refetch();
    },

    // Mutation states
    isEmergencyHalting: emergencyHalt.isPending,
    isTogglingSimulation: toggleSimulation.isPending,
    isRunningSafetyCheck: comprehensiveSafetyCheck.isPending,
  };
}
