// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import type { AgentRegistry } from "./agent-registry";
import { WorkflowDependencyResolver } from "./workflow-dependency-resolver";
import type { WorkflowDefinition } from "./workflow-engine-types";

/**
 * Workflow definition validation and agent registration checking
 */
export class WorkflowValidator {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[workflow-validator]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[workflow-validator]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[workflow-validator]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[workflow-validator]", message, context || ""),
  };
  private deferredWarnings: string[] = [];
  private dependencyResolver = new WorkflowDependencyResolver();

  constructor(private agentRegistry: AgentRegistry) {}

  /**
   * Validate workflow definition
   */
  validateWorkflowDefinition(definition: WorkflowDefinition): void {
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
    const dependencyErrors = this.dependencyResolver.validateDependencies(
      definition.steps
    );
    if (dependencyErrors.length > 0) {
      throw new Error(
        `Dependency validation failed: ${dependencyErrors.join("; ")}`
      );
    }

    // Check for agent existence during registration
    for (const step of definition.steps) {
      if (!this.agentRegistry.getAgent(step.agentId)) {
        // Store the warning but don't print it immediately to avoid spam during tests
        this.deferredWarnings.push(
          `Agent '${step.agentId}' for step '${step.id}' is not registered`
        );
      }

      // Also check fallback agent if specified
      if (
        step.fallbackAgentId &&
        !this.agentRegistry.getAgent(step.fallbackAgentId)
      ) {
        this.deferredWarnings.push(
          `Fallback agent '${step.fallbackAgentId}' for step '${step.id}' is not registered`
        );
      }
    }

    // Validate step configuration
    this.validateStepConfigurations(definition);
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
      this.logger.debug(
        `[WorkflowValidator] Resolved ${resolvedWarnings.length} agent registration warnings`
      );
    }

    // Log remaining warnings if any
    if (remainingWarnings.length > 0) {
      this.logger.warn(
        `[WorkflowValidator] ${remainingWarnings.length} agent registration warnings remain:`
      );
      remainingWarnings.forEach((warning) =>
        this.logger.warn(`  - ${warning}`)
      );
    }

    return { resolvedWarnings, remainingWarnings };
  }

  /**
   * Get all deferred warnings
   */
  getDeferredWarnings(): string[] {
    return [...this.deferredWarnings];
  }

  /**
   * Clear all deferred warnings
   */
  clearDeferredWarnings(): void {
    const clearedCount = this.deferredWarnings.length;
    this.deferredWarnings = [];

    if (clearedCount > 0) {
      this.logger.debug(
        `[WorkflowValidator] Cleared ${clearedCount} deferred warnings`
      );
    }
  }

  /**
   * Validate step configurations for common issues
   */
  private validateStepConfigurations(definition: WorkflowDefinition): void {
    for (const step of definition.steps) {
      // Validate timeout values
      if (step.timeout !== undefined && step.timeout <= 0) {
        throw new Error(
          `Step '${step.id}' has invalid timeout: ${step.timeout}`
        );
      }

      // Validate retry configuration
      if (step.retries !== undefined && step.retries < 0) {
        throw new Error(
          `Step '${step.id}' has invalid retry count: ${step.retries}`
        );
      }

      if (step.retryDelay !== undefined && step.retryDelay < 0) {
        throw new Error(
          `Step '${step.id}' has invalid retry delay: ${step.retryDelay}`
        );
      }

      // Validate fallback configuration
      if (step.failureStrategy === "fallback" && !step.fallbackAgentId) {
        throw new Error(
          `Step '${step.id}' uses fallback strategy but no fallbackAgentId is specified`
        );
      }

      // Validate execution mode consistency
      if (
        definition.executionMode === "sequential" &&
        step.dependencies?.length
      ) {
        // In sequential mode, dependencies should form a simple chain
        const circularDeps = this.checkForCircularDependencies(
          definition.steps,
          step.id
        );
        if (circularDeps.length > 0) {
          this.logger.warn(
            `Step '${step.id}' has complex dependencies in sequential mode: ${circularDeps.join(", ")}`
          );
        }
      }
    }

    // Validate overall workflow timeout
    if (definition.timeout !== undefined && definition.timeout <= 0) {
      throw new Error(
        `Workflow '${definition.id}' has invalid timeout: ${definition.timeout}`
      );
    }
  }

  /**
   * Check for circular dependencies starting from a specific step
   */
  private checkForCircularDependencies(
    steps: WorkflowDefinition["steps"],
    startStepId: string,
    visited = new Set<string>()
  ): string[] {
    if (visited.has(startStepId)) {
      return [startStepId];
    }

    visited.add(startStepId);
    const step = steps.find((s) => s.id === startStepId);

    if (!step?.dependencies) {
      visited.delete(startStepId);
      return [];
    }

    for (const depId of step.dependencies) {
      const circular = this.checkForCircularDependencies(
        steps,
        depId,
        new Set(visited)
      );
      if (circular.length > 0) {
        visited.delete(startStepId);
        return [startStepId, ...circular];
      }
    }

    visited.delete(startStepId);
    return [];
  }
}
