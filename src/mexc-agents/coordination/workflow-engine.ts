// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import type { AgentRegistry } from "./agent-registry";
import { WorkflowDependencyResolver } from "./workflow-dependency-resolver";
import type {
  WorkflowContext,
  WorkflowDefinition,
  WorkflowExecutionResult,
  WorkflowStepConfig,
} from "./workflow-engine-types";
import { WorkflowExecutionTracker } from "./workflow-execution-tracker";
import { WorkflowStepExecutor } from "./workflow-step-executor";
import { WorkflowValidator } from "./workflow-validator";

/**
 * Advanced workflow execution engine with dependency management,
 * parallel/sequential execution, and comprehensive failure handling
 */
export class WorkflowEngine {
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[workflow-engine]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[workflow-engine]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[workflow-engine]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[workflow-engine]", message, context || ""),
  };

  private agentRegistry: AgentRegistry;
  private runningWorkflows: Map<string, WorkflowContext> = new Map();
  private workflowDefinitions: Map<string, WorkflowDefinition> = new Map();

  // Modular components
  private dependencyResolver: WorkflowDependencyResolver;
  private executionTracker: WorkflowExecutionTracker;
  private stepExecutor: WorkflowStepExecutor;
  private validator: WorkflowValidator;

  constructor(agentRegistry: AgentRegistry) {
    this.agentRegistry = agentRegistry;

    // Initialize modular components
    this.dependencyResolver = new WorkflowDependencyResolver();
    this.executionTracker = new WorkflowExecutionTracker();
    this.stepExecutor = new WorkflowStepExecutor(agentRegistry);
    this.validator = new WorkflowValidator(agentRegistry);
  }

  /**
   * Register a workflow definition
   */
  registerWorkflow(definition: WorkflowDefinition): void {
    // Validate workflow definition
    this.validator.validateWorkflowDefinition(definition);

    this.workflowDefinitions.set(definition.id, definition);
    this.logger.info(
      `[WorkflowEngine] Registered workflow: ${definition.id} (${definition.name})`
    );
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
      this.logger.info(
        `[WorkflowEngine] Starting workflow ${workflowId} (execution: ${executionId})`
      );

      const result = await this.executeWorkflowSteps(definition, context);

      // Store in history
      this.executionTracker.addToExecutionHistory(result);

      return result;
    } catch (error) {
      const result = this.executionTracker.createExecutionResult(
        workflowId,
        "failed",
        startTime,
        context,
        error instanceof Error ? error.message : "Unknown error"
      );

      this.executionTracker.addToExecutionHistory(result);
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
    this.logger.info(
      `[WorkflowEngine] Cancelled workflow execution: ${executionId}`
    );
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
    return this.executionTracker.getExecutionHistory(limit);
  }

  /**
   * Validate all registered workflows against current agent registry
   */
  validateRegisteredWorkflows(): {
    resolvedWarnings: string[];
    remainingWarnings: string[];
  } {
    return this.validator.validateRegisteredWorkflows();
  }

  /**
   * Execute workflow steps based on execution mode
   */
  private async executeWorkflowSteps(
    definition: WorkflowDefinition,
    context: WorkflowContext
  ): Promise<WorkflowExecutionResult> {
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
          throw new Error(
            `Unknown execution mode: ${definition.executionMode}`
          );
      }

      return this.executionTracker.createExecutionResult(
        definition.id,
        "completed",
        context.startTime,
        context
      );
    } catch (error) {
      return this.executionTracker.createExecutionResult(
        definition.id,
        "failed",
        context.startTime,
        context,
        error instanceof Error ? error.message : "Unknown error"
      );
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
    const executionOrder = this.dependencyResolver.resolveDependencies(steps);

    for (const step of executionOrder) {
      if (context.cancelled) {
        break;
      }

      // Check if step should be executed based on condition
      if (step.condition && !step.condition(context)) {
        this.stepExecutor.recordSkippedStep(step, context);
        continue;
      }

      // Wait for dependencies
      await this.dependencyResolver.waitForDependencies(step, context);

      // Execute step
      await this.stepExecutor.executeStep(step, context);

      // Check if we should continue based on failure strategy
      const stepResult = context.stepResults.get(step.id);
      if (stepResult?.status === "failed" && step.required !== false) {
        if (step.failureStrategy === "halt") {
          throw new Error(
            `Required step '${step.id}' failed: ${stepResult.error}`
          );
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
    const dependencyGroups =
      this.dependencyResolver.groupStepsByDependencyLevel(steps);

    for (const group of dependencyGroups) {
      if (context.cancelled) {
        break;
      }

      // Execute all steps in current group in parallel
      const stepPromises = group.map((step) =>
        this.stepExecutor.executeStepWithErrorHandling(step, context)
      );
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
    const dependencyGroups =
      this.dependencyResolver.groupStepsByDependencyLevel(steps);

    for (const group of dependencyGroups) {
      if (context.cancelled) {
        break;
      }

      // Execute steps in parallel within each dependency level
      const stepPromises = group
        .filter((step) => !step.condition || step.condition(context))
        .map((step) =>
          this.stepExecutor.executeStepWithErrorHandling(step, context)
        );

      await Promise.allSettled(stepPromises);
    }
  }
}

// Re-export types for convenience
export type {
  FailureStrategy,
  WorkflowContext,
  WorkflowDefinition,
  WorkflowExecutionMode,
  WorkflowExecutionResult,
  WorkflowStepConfig,
  WorkflowStepResult,
  WorkflowStepStatus,
} from "./workflow-engine-types";
