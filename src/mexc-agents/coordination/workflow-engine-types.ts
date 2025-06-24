import type { AgentResponse } from "../base-agent";
import type { AgentRegistry } from "./agent-registry";

export type WorkflowExecutionMode = "sequential" | "parallel" | "mixed";
export type WorkflowStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "timeout";
export type FailureStrategy = "halt" | "continue" | "retry" | "fallback";

export interface WorkflowStepConfig {
  id: string;
  name: string;
  agentId: string;
  input: unknown;
  dependencies?: string[]; // Step IDs that must complete before this step
  timeout?: number; // Timeout in milliseconds
  retries?: number; // Number of retry attempts
  retryDelay?: number; // Delay between retries in milliseconds
  failureStrategy?: FailureStrategy;
  fallbackAgentId?: string; // Alternative agent to use if primary fails
  required?: boolean; // If false, step failure won't stop workflow
  condition?: (context: WorkflowContext) => boolean; // Conditional execution
  transform?: (input: unknown, context: WorkflowContext) => unknown; // Input transformation
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  steps: WorkflowStepConfig[];
  executionMode: WorkflowExecutionMode;
  timeout?: number; // Overall workflow timeout
  failureStrategy?: FailureStrategy;
  metadata?: Record<string, unknown>;
}

export interface WorkflowStepResult {
  stepId: string;
  status: WorkflowStepStatus;
  agentId: string;
  startTime: Date;
  endTime: Date | null;
  duration: number;
  attempt: number;
  input: unknown;
  output?: AgentResponse;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  status: "completed" | "failed" | "timeout" | "cancelled";
  startTime: Date;
  endTime: Date;
  duration: number;
  steps: WorkflowStepResult[];
  output?: unknown;
  error?: string;
  metadata: {
    agentsUsed: string[];
    stepsExecuted: number;
    stepsSkipped: number;
    stepsFailed: number;
    retriesPerformed: number;
    fallbacksUsed: number;
  };
}

export interface WorkflowContext {
  workflowId: string;
  executionId: string;
  startTime: Date;
  stepResults: Map<string, WorkflowStepResult>;
  variables: Map<string, unknown>;
  agentRegistry: AgentRegistry;
  cancelled: boolean;
}
