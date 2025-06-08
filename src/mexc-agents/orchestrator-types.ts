// Central type definitions for the orchestrator system

export interface CalendarDiscoveryWorkflowRequest {
  trigger: string;
  force?: boolean;
}

export interface SymbolAnalysisWorkflowRequest {
  vcoinId: string;
  symbolName?: string;
  projectName?: string;
  launchTime?: string;
  attempt?: number;
}

export interface PatternAnalysisWorkflowRequest {
  vcoinId?: string;
  symbols?: string[];
  analysisType: "discovery" | "monitoring" | "execution";
}

export interface TradingStrategyWorkflowRequest {
  vcoinId: string;
  symbolData: unknown;
  riskLevel?: "low" | "medium" | "high";
  capital?: number;
}

export interface MexcWorkflowResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    agentsUsed: string[];
    duration?: number;
    confidence?: number;
  };
}

export interface WorkflowExecutionContext {
  startTime: number;
  agentsUsed: string[];
  stepCount: number;
  currentStep: string;
}

export interface AgentOrchestrationMetrics {
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  errorRate: number;
  lastExecution: string;
}
