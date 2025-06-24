import { createLogger } from "../../lib/structured-logger";
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

/**
 * Advanced workflow execution engine with dependency management,
 * parallel/sequential execution, and comprehensive failure handling
 */
export class WorkflowEngine {
  private logger = createLogger("workflow-engine");

  private agentRegistry: AgentRegistry;
  private runningWorkflows: Map<string, WorkflowContext> = new Map();
  private workflowDefinitions: Map<string, WorkflowDefinition> = new Map();
  private executionHistory: WorkflowExecutionResult[] = [];
  private maxHistorySize = 1000;
  private deferredWarnings: string[] = [];

  constructor(agentRegistry: AgentRegistry) {
    this.agentRegistry = agentRegistry;
  }

  /**
   * Register a workflow definition
   */
  registerWorkflow(definition: WorkflowDefinition): void {
    // Validate workflow definition
    this.validateWorkflowDefinition(definition);

    this.workflowDefinitions.set(definition.id, definition);
    logger.info(`[WorkflowEngine] Registered workflow: ${definition.id} (${definition.name})`);
  }

  /**
   * Unregister a workflow definition
   */
  unregisterWorkflow(workflowId: string): boolean {
    return this.workflowDefinitions.delete(workflowId);
  }

  /**
   * Get workflow definition
   */
  getWorkflowDefinition(workflowId: string): WorkflowDefinition | null {
    return this.workflowDefinitions.get(workflowId) || null;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowId: string,
    input?: unknown,
    variables?: Map<string, unknown>
  ): Promise<WorkflowExecutionResult> {
    const definition = this.workflowDefinitions.get(workflowId);
    if (!definition) {
      throw new Error(`Workflow '${workflowId}' not found`);
    }

    const executionId = `${workflowId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    const context: WorkflowContext = {
      workflowId,
      executionId,
      startTime,
      stepResults: new Map(),
      variables: variables || new Map(),
      agentRegistry: this.agentRegistry,
      cancelled: false,
    };

    // Store input in context
    if (input !== undefined) {
      context.variables.set("input", input);
    }

    this.runningWorkflows.set(executionId, context);

    try {
      logger.info(`[WorkflowEngine] Starting workflow ${workflowId} (execution: ${executionId})`);

      const result = await this.executeWorkflowSteps(definition, context);

      // Store in history
      this.addToExecutionHistory(result);

      return result;
    } catch (error) {
      const endTime = new Date();
      const result: WorkflowExecutionResult = {
        workflowId,
        status: "failed",
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        steps: Array.from(context.stepResults.values()),
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: this.generateExecutionMetadata(context),
      };

      this.addToExecutionHistory(result);
      throw error;
    } finally {
      this.runningWorkflows.delete(executionId);
    }
  }

  /**
   * Cancel a running workflow
   */
  cancelWorkflow(executionId: string): boolean {
    const context = this.runningWorkflows.get(executionId);
    if (!context) {
      return false;
    }

    context.cancelled = true;
    logger.info(`[WorkflowEngine] Cancelled workflow execution: ${executionId}`);
    return true;
  }

  /**
   * Get running workflows
   */
  getRunningWorkflows(): string[] {
    return Array.from(this.runningWorkflows.keys());
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): WorkflowExecutionResult[] {
    return limit ? this.executionHistory.slice(-limit) : [...this.executionHistory];
  }

  /**
   * Validate all registered workflows against current agent registry
   * and clear any resolved warnings
   */
  validateRegisteredWorkflows(): {
    resolvedWarnings: string[];
    remainingWarnings: string[];
  } {
    const resolvedWarnings: string[] = [];
    const remainingWarnings: string[] = [];

    // Check each deferred warning
    for (const warning of this.deferredWarnings) {
      // Extract agent ID from warning message
      const match = warning.match(/Agent '([^']+)'/);
      if (match) {
        const agentId = match[1];
        if (this.agentRegistry.getAgent(agentId)) {
          resolvedWarnings.push(warning);
        } else {
          remainingWarnings.push(warning);
        }
      } else {
        remainingWarnings.push(warning);
      }
    }

    // Update deferred warnings to only include remaining ones
    this.deferredWarnings = remainingWarnings;

    // Log resolved warnings for debugging
    if (resolvedWarnings.length > 0) {
      logger.debug(
        `[WorkflowEngine] Resolved ${resolvedWarnings.length} agent registration warnings`
      );
    }

    // Log remaining warnings if any
    if (remainingWarnings.length > 0) {
      logger.warn(
        `[WorkflowEngine] ${remainingWarnings.length} agent registration warnings remain:`
      );
      remainingWarnings.forEach((warning) => logger.warn(`  - ${warning}`));
    }

    return { resolvedWarnings, remainingWarnings };
  }

  /**
   * Execute workflow steps based on execution mode
   */
  private async executeWorkflowSteps(
    definition: WorkflowDefinition,
    context: WorkflowContext
  ): Promise<WorkflowExecutionResult> {
    const startTime = context.startTime;
    let endTime = new Date();

    try {
      switch (definition.executionMode) {
        case "sequential":
          await this.executeSequentialSteps(definition.steps, context);
          break;
        case "parallel":
          await this.executeParallelSteps(definition.steps, context);
          break;
        case "mixed":
          await this.executeMixedSteps(definition.steps, context);
          break;
        default:
          throw new Error(`Unknown execution mode: ${definition.executionMode}`);
      }

      endTime = new Date();

      // Determine final output
      const finalStepResults = Array.from(context.stepResults.values());
      const lastSuccessfulStep = finalStepResults
        .filter((step) => step.status === "completed")
        .sort((a, b) => b.endTime?.getTime() - a.endTime?.getTime())[0];

      return {
        workflowId: definition.id,
        status: "completed",
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        steps: finalStepResults,
        output: lastSuccessfulStep?.output,
        metadata: this.generateExecutionMetadata(context),
      };
    } catch (error) {
      endTime = new Date();

      return {
        workflowId: definition.id,
        status: "failed",
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        steps: Array.from(context.stepResults.values()),
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: this.generateExecutionMetadata(context),
      };
    }
  }

  /**
   * Execute steps sequentially with dependency management
   */
  private async executeSequentialSteps(
    steps: WorkflowStepConfig[],
    context: WorkflowContext
  ): Promise<void> {
    // Build dependency graph and determine execution order
    const executionOrder = this.resolveDependencies(steps);

    for (const step of executionOrder) {
      if (context.cancelled) {
        break;
      }

      // Check if step should be executed based on condition
      if (step.condition && !step.condition(context)) {
        this.recordSkippedStep(step, context);
        continue;
      }

      // Wait for dependencies
      await this.waitForDependencies(step, context);

      // Execute step
      await this.executeStep(step, context);

      // Check if we should continue based on failure strategy
      const stepResult = context.stepResults.get(step.id);
      if (stepResult?.status === "failed" && step.required !== false) {
        if (step.failureStrategy === "halt") {
          throw new Error(`Required step '${step.id}' failed: ${stepResult.error}`);
        }
      }
    }
  }

  /**
   * Execute steps in parallel
   */
  private async executeParallelSteps(
    steps: WorkflowStepConfig[],
    context: WorkflowContext
  ): Promise<void> {
    // Group steps by dependency level
    const dependencyGroups = this.groupStepsByDependencyLevel(steps);

    for (const group of dependencyGroups) {
      if (context.cancelled) {
        break;
      }

      // Execute all steps in current group in parallel
      const stepPromises = group.map((step) => this.executeStepWithErrorHandling(step, context));
      await Promise.allSettled(stepPromises);
    }
  }

  /**
   * Execute steps with mixed strategy (parallel where possible, sequential where required)
   */
  private async executeMixedSteps(
    steps: WorkflowStepConfig[],
    context: WorkflowContext
  ): Promise<void> {
    const dependencyGroups = this.groupStepsByDependencyLevel(steps);

    for (const group of dependencyGroups) {
      if (context.cancelled) {
        break;
      }

      // Execute steps in parallel within each dependency level
      const stepPromises = group
        .filter((step) => !step.condition || step.condition(context))
        .map((step) => this.executeStepWithErrorHandling(step, context));

      await Promise.allSettled(stepPromises);
    }
  }

  /**
   * Execute a single step with comprehensive error handling
   */
  private async executeStep(step: WorkflowStepConfig, context: WorkflowContext): Promise<void> {
    const startTime = new Date();
    let attempt = 0;
    const maxAttempts = (step.retries || 0) + 1;

    while (attempt < maxAttempts && !context.cancelled) {
      attempt++;

      try {
        // Get agent
        const agent = this.agentRegistry.getAgentInstance(step.agentId);
        if (!agent) {
          throw new Error(`Agent '${step.agentId}' not found`);
        }

        // Check agent availability
        if (!this.agentRegistry.isAgentAvailable(step.agentId)) {
          // Try fallback agent if available
          if (step.fallbackAgentId && this.agentRegistry.isAgentAvailable(step.fallbackAgentId)) {
            const fallbackAgent = this.agentRegistry.getAgentInstance(step.fallbackAgentId);
            if (fallbackAgent) {
              const output = await this.executeAgentWithTimeout(
                fallbackAgent,
                step,
                context,
                step.timeout || 30000
              );

              this.recordSuccessfulStep(
                step,
                startTime,
                output,
                context,
                attempt,
                step.fallbackAgentId
              );
              return;
            }
          }

          throw new Error(`Agent '${step.agentId}' is not available`);
        }

        // Transform input if needed
        const input = step.transform ? step.transform(step.input, context) : step.input;

        // Execute with timeout
        const output = await this.executeAgentWithTimeout(
          agent,
          { ...step, input },
          context,
          step.timeout || 30000
        );

        this.recordSuccessfulStep(step, startTime, output, context, attempt);
        return;
      } catch (error) {
        const isLastAttempt = attempt >= maxAttempts;

        if (isLastAttempt) {
          this.recordFailedStep(step, startTime, error, context, attempt);

          // Handle failure strategy
          if (step.failureStrategy === "fallback" && step.fallbackAgentId) {
            // Fallback was already tried above, so this is a complete failure
          }

          if (step.required !== false) {
            throw error;
          }
          return;
        }

        // Wait before retry
        if (step.retryDelay && step.retryDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, step.retryDelay));
        }
      }
    }
  }

  /**
   * Execute agent with timeout
   */
  private async executeAgentWithTimeout(
    agent: any,
    step: WorkflowStepConfig,
    context: WorkflowContext,
    timeout: number
  ): Promise<AgentResponse> {
    const agentPromise = agent.process(step.input, {
      workflowContext: context,
      stepId: step.id,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Step '${step.id}' timed out after ${timeout}ms`)),
        timeout
      );
    });

    return Promise.race([agentPromise, timeoutPromise]);
  }

  /**
   * Resolve step dependencies and return execution order
   */
  private resolveDependencies(steps: WorkflowStepConfig[]): WorkflowStepConfig[] {
    const stepMap = new Map(steps.map((step) => [step.id, step]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: WorkflowStepConfig[] = [];

    const visit = (stepId: string): void => {
      if (visited.has(stepId)) {
        return;
      }

      if (visiting.has(stepId)) {
        throw new Error(`Circular dependency detected involving step '${stepId}'`);
      }

      const step = stepMap.get(stepId);
      if (!step) {
        throw new Error(`Step '${stepId}' not found`);
      }

      visiting.add(stepId);

      // Visit dependencies first
      for (const depId of step.dependencies || []) {
        visit(depId);
      }

      visiting.delete(stepId);
      visited.add(stepId);
      result.push(step);
    };

    for (const step of steps) {
      visit(step.id);
    }

    return result;
  }

  /**
   * Group steps by dependency level for parallel execution
   */
  private groupStepsByDependencyLevel(steps: WorkflowStepConfig[]): WorkflowStepConfig[][] {
    const stepMap = new Map(steps.map((step) => [step.id, step]));
    const levels: WorkflowStepConfig[][] = [];
    const stepLevels = new Map<string, number>();

    const getStepLevel = (stepId: string, visited = new Set<string>()): number => {
      if (stepLevels.has(stepId)) {
        return stepLevels.get(stepId)!;
      }

      if (visited.has(stepId)) {
        throw new Error(`Circular dependency detected involving step '${stepId}'`);
      }

      const step = stepMap.get(stepId);
      if (!step) {
        throw new Error(`Step '${stepId}' not found`);
      }

      visited.add(stepId);

      let maxDependencyLevel = -1;
      for (const depId of step.dependencies || []) {
        const depLevel = getStepLevel(depId, new Set(visited));
        maxDependencyLevel = Math.max(maxDependencyLevel, depLevel);
      }

      const level = maxDependencyLevel + 1;
      stepLevels.set(stepId, level);
      visited.delete(stepId);

      return level;
    };

    // Calculate levels for all steps
    for (const step of steps) {
      const level = getStepLevel(step.id);

      while (levels.length <= level) {
        levels.push([]);
      }

      levels[level].push(step);
    }

    return levels;
  }

  /**
   * Wait for step dependencies to complete
   */
  private async waitForDependencies(
    step: WorkflowStepConfig,
    context: WorkflowContext
  ): Promise<void> {
    if (!step.dependencies || step.dependencies.length === 0) {
      return;
    }

    const checkInterval = 100; // Check every 100ms
    const timeout = 30000; // 30 second timeout
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const allCompleted = step.dependencies.every((depId) => {
        const depResult = context.stepResults.get(depId);
        return depResult && (depResult.status === "completed" || depResult.status === "skipped");
      });

      if (allCompleted) {
        return;
      }

      // Check for failed required dependencies
      const failedDependencies = step.dependencies.filter((depId) => {
        const depResult = context.stepResults.get(depId);
        return depResult && depResult.status === "failed";
      });

      if (failedDependencies.length > 0) {
        throw new Error(`Dependencies failed: ${failedDependencies.join(", ")}`);
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    throw new Error(`Timeout waiting for dependencies: ${step.dependencies.join(", ")}`);
  }

  /**
   * Execute step with error handling (for parallel execution)
   */
  private async executeStepWithErrorHandling(
    step: WorkflowStepConfig,
    context: WorkflowContext
  ): Promise<void> {
    try {
      await this.executeStep(step, context);
    } catch (error) {
      // Error is already recorded in executeStep
      if (step.required !== false && step.failureStrategy === "halt") {
        throw error;
      }
    }
  }

  /**
   * Record successful step execution
   */
  private recordSuccessfulStep(
    step: WorkflowStepConfig,
    startTime: Date,
    output: AgentResponse,
    context: WorkflowContext,
    attempt: number,
    actualAgentId?: string
  ): void {
    const endTime = new Date();
    const result: WorkflowStepResult = {
      stepId: step.id,
      status: "completed",
      agentId: actualAgentId || step.agentId,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      attempt,
      input: step.input,
      output,
    };

    context.stepResults.set(step.id, result);

    // Store output in context variables
    context.variables.set(`${step.id}_output`, output);
  }

  /**
   * Record failed step execution
   */
  private recordFailedStep(
    step: WorkflowStepConfig,
    startTime: Date,
    error: unknown,
    context: WorkflowContext,
    attempt: number
  ): void {
    const endTime = new Date();
    const result: WorkflowStepResult = {
      stepId: step.id,
      status: "failed",
      agentId: step.agentId,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      attempt,
      input: step.input,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    context.stepResults.set(step.id, result);
  }

  /**
   * Record skipped step
   */
  private recordSkippedStep(step: WorkflowStepConfig, context: WorkflowContext): void {
    const now = new Date();
    const result: WorkflowStepResult = {
      stepId: step.id,
      status: "skipped",
      agentId: step.agentId,
      startTime: now,
      endTime: now,
      duration: 0,
      attempt: 0,
      input: step.input,
    };

    context.stepResults.set(step.id, result);
  }

  /**
   * Generate execution metadata
   */
  private generateExecutionMetadata(context: WorkflowContext): {
    agentsUsed: string[];
    stepsExecuted: number;
    stepsSkipped: number;
    stepsFailed: number;
    retriesPerformed: number;
    fallbacksUsed: number;
  } {
    const stepResults = Array.from(context.stepResults.values());
    const agentsUsed = [...new Set(stepResults.map((step) => step.agentId))];
    const stepsExecuted = stepResults.filter((step) => step.status === "completed").length;
    const stepsSkipped = stepResults.filter((step) => step.status === "skipped").length;
    const stepsFailed = stepResults.filter((step) => step.status === "failed").length;
    const retriesPerformed = stepResults.reduce(
      (sum, step) => sum + Math.max(0, step.attempt - 1),
      0
    );
    const fallbacksUsed = 0; // Would need to track this separately in actual implementation

    return {
      agentsUsed,
      stepsExecuted,
      stepsSkipped,
      stepsFailed,
      retriesPerformed,
      fallbacksUsed,
    };
  }

  /**
   * Validate workflow definition
   */
  private validateWorkflowDefinition(definition: WorkflowDefinition): void {
    if (!definition.id || !definition.name || !definition.version) {
      throw new Error("Workflow definition must have id, name, and version");
    }

    if (!definition.steps || definition.steps.length === 0) {
      throw new Error("Workflow definition must have at least one step");
    }

    // Check for duplicate step IDs
    const stepIds = definition.steps.map((step) => step.id);
    const uniqueStepIds = new Set(stepIds);
    if (stepIds.length !== uniqueStepIds.size) {
      throw new Error("Workflow definition contains duplicate step IDs");
    }

    // Validate step dependencies
    for (const step of definition.steps) {
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          if (!uniqueStepIds.has(depId)) {
            throw new Error(`Step '${step.id}' has invalid dependency '${depId}'`);
          }
        }
      }
    }

    // Check for agent existence during registration
    for (const step of definition.steps) {
      if (!this.agentRegistry.getAgent(step.agentId)) {
        // Store the warning but don't print it immediately to avoid spam during tests
        this.deferredWarnings.push(
          `Agent '${step.agentId}' for step '${step.id}' is not registered`
        );
      }
    }
  }

  /**
   * Add result to execution history
   */
  private addToExecutionHistory(result: WorkflowExecutionResult): void {
    this.executionHistory.push(result);

    // Keep only the most recent entries
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.splice(0, this.executionHistory.length - this.maxHistorySize);
    }
  }
}
