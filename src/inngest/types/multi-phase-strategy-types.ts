/**
 * Multi-Phase Strategy Types
 *
 * Shared type definitions for multi-phase strategy workflows
 */

// Core strategy interfaces
export interface StrategyAnalysisResult {
  strategy: TradingStrategy;
  analytics: {
    executionTrend?: string;
    progress?: number;
    [key: string]: unknown;
  };
  performanceMetrics: {
    totalPnlPercent?: number;
    successRate?: number;
    totalTrades?: number;
    [key: string]: unknown;
  };
  currentPhases: number;
  totalPhases: number;
  efficiency: string;
}

export interface StrategyRecommendationResult {
  recommendedStrategy: {
    name: string;
    description: string;
    levels: any[];
  };
  riskAssessment: {
    riskLevel: string;
    timeHorizon: string;
    suitabilityScore: number;
  };
  alternativeStrategies: Array<{
    name: string;
    description: string;
    levels: any[];
  }>;
  executionGuidance: {
    optimalEntryConditions: string[];
    monitoringPoints: string[];
    riskManagement: string[];
  };
  reasoning: string;
}

export interface TradingStrategy {
  id?: string;
  name: string;
  description: string;
  phases: StrategyPhase[];
  riskLevel: string;
  timeframe: string;
  [key: string]: unknown;
}

export interface StrategyPhase {
  id: string;
  name: string;
  allocation: number;
  conditions: string[];
  actions: PhaseAction[];
}

export interface PhaseAction {
  type: string;
  parameters: Record<string, unknown>;
  priority: number;
}

// Event interfaces
export interface MultiPhaseStrategyCreateEvent {
  data: {
    userId: string;
    symbol: string;
    marketData: Record<string, unknown>;
    riskTolerance: string;
    timeframe: string;
    capital: number;
    entryPrice?: number;
    aiRecommendation?: string;
    workflowId: string;
  };
}

export interface MultiPhaseStrategyExecuteEvent {
  data: {
    strategyId: string;
    userId: string;
    executionMode: string;
    phaseOverrides?: Record<string, unknown>;
    workflowId: string;
  };
}

export interface PerformanceAnalysisEvent {
  data: {
    strategyId: string;
    analysisType: string;
    timeframe?: string;
    includeRecommendations?: boolean;
  };
}

export interface HealthCheckEvent {
  data: {
    targetStrategies?: string[];
    checkType: string;
    includeCorrectiveActions?: boolean;
  };
}

// Validation interfaces
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// Service response interfaces
export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Risk assessment interfaces
export interface RiskAssessment {
  riskLevel: "low" | "medium" | "high" | "critical";
  factors: RiskFactor[];
  score: number;
  recommendations: string[];
}

export interface RiskFactor {
  category: string;
  severity: number;
  description: string;
  impact: string;
}

// Optimization interfaces
export interface OptimizationRecommendation {
  type: string;
  description: string;
  expectedImpact: string;
  priority: number;
  parameters: Record<string, unknown>;
}

export interface OptimizationCriteria {
  objectives: string[];
  constraints: Record<string, unknown>;
  autoApply: boolean;
  riskTolerance: string;
}
