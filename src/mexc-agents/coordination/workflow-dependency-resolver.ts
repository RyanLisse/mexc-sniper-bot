// Build-safe imports - avoid structured logger to prevent webpack bundling issues
import type {
  WorkflowContext,
  WorkflowStepConfig,
} from "./workflow-engine-types";

/**
 * Workflow dependency resolution and execution ordering
 */
export class WorkflowDependencyResolver {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[workflow-dependency-resolver]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[workflow-dependency-resolver]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[workflow-dependency-resolver]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[workflow-dependency-resolver]", message, context || ""),
  };

  /**
   * Resolve step dependencies and return execution order
   */
  resolveDependencies(steps: WorkflowStepConfig[]): WorkflowStepConfig[] {
    const stepMap = new Map(steps.map((step) => [step.id, step]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: WorkflowStepConfig[] = [];

    const visit = (stepId: string): void => {
      if (visited.has(stepId)) {
        return;
      }

      if (visiting.has(stepId)) {
        throw new Error(
          `Circular dependency detected involving step '${stepId}'`
        );
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
  groupStepsByDependencyLevel(
    steps: WorkflowStepConfig[]
  ): WorkflowStepConfig[][] {
    const stepMap = new Map(steps.map((step) => [step.id, step]));
    const levels: WorkflowStepConfig[][] = [];
    const stepLevels = new Map<string, number>();

    const getStepLevel = (
      stepId: string,
      visited = new Set<string>()
    ): number => {
      if (stepLevels.has(stepId)) {
        return stepLevels.get(stepId)!;
      }

      if (visited.has(stepId)) {
        throw new Error(
          `Circular dependency detected involving step '${stepId}'`
        );
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
  async waitForDependencies(
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
        return (
          depResult &&
          (depResult.status === "completed" || depResult.status === "skipped")
        );
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
        throw new Error(
          `Dependencies failed: ${failedDependencies.join(", ")}`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    throw new Error(
      `Timeout waiting for dependencies: ${step.dependencies.join(", ")}`
    );
  }

  /**
   * Validate step dependencies in workflow definition
   */
  validateDependencies(steps: WorkflowStepConfig[]): string[] {
    const errors: string[] = [];
    const stepIds = new Set(steps.map((step) => step.id));

    // Validate step dependencies
    for (const step of steps) {
      if (step.dependencies) {
        for (const depId of step.dependencies) {
          if (!stepIds.has(depId)) {
            errors.push(`Step '${step.id}' has invalid dependency '${depId}'`);
          }
        }
      }
    }

    // Check for circular dependencies by attempting resolution
    try {
      this.resolveDependencies(steps);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Circular dependency")
      ) {
        errors.push(error.message);
      }
    }

    return errors;
  }
}
