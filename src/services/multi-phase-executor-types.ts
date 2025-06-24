import type { PriceMultiplier } from "./multi-phase-trading-service";

export interface PhaseExecutionHistory {
  phase: number;
  price: number;
  amount: number;
  profit: number;
  timestamp: Date;
  executionLatency?: number;
  slippage?: number;
}

export interface ExecutionSummary {
  totalSold: number;
  totalRemaining: number;
  realizedProfit: number;
  unrealizedProfit: number;
  completedPhases: number;
  nextPhaseTarget: number | null;
  totalFees: number;
  avgSlippage: number;
  executionEfficiency: number;
}

export interface PhaseStatus {
  phase: number;
  target: string;
  percentage: number;
  sellAmount: number;
  status: "completed" | "pending" | "triggered" | "failed";
  executionPrice?: number;
  profit?: number;
  timestamp?: Date;
}

export interface PhaseToExecute {
  phase: number;
  level: PriceMultiplier;
  amount: number;
  expectedProfit: number;
  targetPrice: number;
  urgency: "low" | "medium" | "high";
}

export interface ExecutionAnalytics {
  totalExecutions: number;
  avgExecutionTime: number;
  successRate: number;
  avgSlippage: number;
  totalProfitRealized: number;
  bestExecution: PhaseExecutionHistory | null;
  worstExecution: PhaseExecutionHistory | null;
  executionTrend: "improving" | "declining" | "stable";
}

export interface ExecutorState {
  executedPhases: number[];
  phaseHistory: PhaseExecutionHistory[];
  strategy: any;
  entryPrice: number;
  totalAmount: number;
}

export interface ExecutorOptions {
  strategyId?: number;
  userId?: string;
  executedPhases?: number[];
  existingHistory?: PhaseExecutionHistory[];
}

export interface ExecutionOptions {
  dryRun?: boolean;
  maxPhasesPerExecution?: number;
  priceThreshold?: number;
}

export interface RecordingOptions {
  fees?: number;
  slippage?: number;
  latency?: number;
  exchangeOrderId?: string;
  exchangeResponse?: string;
}
