// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import type { AgentResponse } from "../base-agent";
import type { AgentRegistry } from "./agent-registry";
import type {
  WorkflowContext,
  WorkflowStepConfig,
  WorkflowStepResult,
} from "./workflow-engine-types";

/**
 * Workflow step execution with comprehensive error handling
 */
export class WorkflowStepExecutor {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[workflow-step-executor]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[workflow-step-executor]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[workflow-step-executor]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[workflow-step-executor]", message, context || ""),
  };

  constructor(private agentRegistry: AgentRegistry) {}

  /**
   * Execute a single step with comprehensive error handling
   */
  async executeStep(step: WorkflowStepConfig, context: WorkflowContext): Promise<void> {
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
   * Execute step with error handling (for parallel execution)
   */
  async executeStepWithErrorHandling(
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
  recordSkippedStep(step: WorkflowStepConfig, context: WorkflowContext): void {
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
}
