/**
 * Event Handling Module
 *
 * Provides event handling functionality including timer coordination, scheduled operations,
 * and operation lifecycle management for the Real-time Safety Monitoring Service.
 *
 * Part of the modular refactoring of real-time-safety-monitoring-service.ts
 */

import type { ScheduledOperation } from "../../schemas/safety-monitoring-schemas";
import { validateScheduledOperation } from "../../schemas/safety-monitoring-schemas";

export interface EventHandlingConfig {
  baseTickMs?: number;
  maxConcurrentOperations?: number;
  operationTimeoutMs?: number;
}

export interface OperationRegistration {
  id: string;
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
}

export interface OperationStatus {
  id: string;
  name: string;
  intervalMs: number;
  lastExecuted: number;
  isRunning: boolean;
  nextExecution: number;
  executionCount: number;
  lastError?: string;
}

export interface TimerCoordinatorStats {
  isActive: boolean;
  totalOperations: number;
  runningOperations: number;
  totalExecutions: number;
  totalErrors: number;
  averageExecutionTime: number;
  uptime: number;
}

export class EventHandling {
  private operations: Map<
    string,
    ScheduledOperation & {
      handler: () => Promise<void>;
      executionCount: number;
      totalExecutionTime: number;
      lastError?: string;
    }
  > = new Map();

  private coordinatorTimer: NodeJS.Timeout | null = null;
  private isActive = false;
  private readonly baseTickMs: number;
  private readonly maxConcurrentOperations: number;
  private readonly operationTimeoutMs: number;
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[event-handling]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[event-handling]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[event-handling]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[event-handling]", message, context || ""),
  };

  private stats = {
    totalExecutions: 0,
    totalErrors: 0,
    totalExecutionTime: 0,
    startTime: 0,
  };

  constructor(config: EventHandlingConfig = {}) {
    this.baseTickMs = config.baseTickMs || 5000; // 5-second base tick
    this.maxConcurrentOperations = config.maxConcurrentOperations || 5;
    this.operationTimeoutMs = config.operationTimeoutMs || 30000; // 30 seconds

    console.info("Event handling initialized", {
      operation: "initialization",
      baseTickMs: this.baseTickMs,
      maxConcurrentOperations: this.maxConcurrentOperations,
      operationTimeoutMs: this.operationTimeoutMs,
    });
  }

  /**
   * Register a scheduled operation
   */
  public registerOperation(operation: OperationRegistration): void {
    const scheduledOp = {
      id: operation.id,
      name: operation.name,
      intervalMs: operation.intervalMs,
      lastExecuted: 0,
      isRunning: false,
      handler: operation.handler,
      executionCount: 0,
      totalExecutionTime: 0,
    };

    // Validate the operation structure
    const { handler, executionCount, totalExecutionTime, lastError, ...validationData } =
      scheduledOp;
    validateScheduledOperation(validationData);

    this.operations.set(operation.id, scheduledOp);

    console.info("Operation registered", {
      operation: "register_operation",
      operationId: operation.id,
      operationName: operation.name,
      intervalMs: operation.intervalMs,
      totalOperations: this.operations.size,
    });
  }

  /**
   * Unregister a scheduled operation
   */
  public unregisterOperation(operationId: string): boolean {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn("Operation not found for unregistration", {
        operation: "unregister_operation",
        operationId,
        totalOperations: this.operations.size,
      });
      return false;
    }

    if (operation.isRunning) {
      console.warn("Cannot unregister running operation", {
        operation: "unregister_operation",
        operationId,
        operationName: operation.name,
        isRunning: operation.isRunning,
      });
      return false;
    }

    this.operations.delete(operationId);

    console.info("Operation unregistered", {
      operation: "unregister_operation",
      operationId,
      operationName: operation.name,
      totalOperations: this.operations.size,
    });

    return true;
  }

  /**
   * Start the timer coordinator
   */
  public start(): void {
    if (this.isActive) {
      console.warn("Timer coordinator already active", {
        operation: "start_coordinator",
        isActive: this.isActive,
        operationsCount: this.operations.size,
      });
      return;
    }

    this.isActive = true;
    this.stats.startTime = Date.now();

    console.info("Starting timer coordination", {
      operation: "start_coordinator",
      baseTickMs: this.baseTickMs,
      operationsCount: this.operations.size,
      maxConcurrentOperations: this.maxConcurrentOperations,
    });

    this.coordinatorTimer = setInterval(() => {
      this.coordinateCycle().catch((error) => {
        console.error(
          "Coordination cycle failed",
          {
            operation: "coordination_cycle",
            activeOperations: this.operations.size,
            baseTickMs: this.baseTickMs,
          },
          error
        );
      });
    }, this.baseTickMs);
  }

  /**
   * Stop the timer coordinator and cleanup
   */
  public stop(): void {
    console.info("Stopping timer coordination", {
      operation: "stop_coordinator",
      isActive: this.isActive,
      totalOperations: this.operations.size,
      uptime: Date.now() - this.stats.startTime,
    });

    this.isActive = false;

    if (this.coordinatorTimer) {
      clearInterval(this.coordinatorTimer);
      this.coordinatorTimer = null;
    }

    // Wait for any running operations to complete
    const allOperations = Array.from(this.operations.values());
    const runningOps = allOperations.filter((op) => op.isRunning);

    if (runningOps.length > 0) {
      console.info("Waiting for operations to complete", {
        operation: "stop_coordinator",
        runningOperations: runningOps.length,
        runningOperationNames: runningOps.map((op) => op.name),
      });
    }
  }

  /**
   * Clear all operations and reset
   */
  public clear(): void {
    if (this.isActive) {
      this.stop();
    }

    const clearedCount = this.operations.size;
    this.operations.clear();

    console.info("All operations cleared", {
      operation: "clear_operations",
      clearedCount,
    });
  }

  /**
   * Get operation status for monitoring
   */
  public getOperationStatus(): OperationStatus[] {
    const allOperations = Array.from(this.operations.values());
    return allOperations.map((op) => ({
      id: op.id,
      name: op.name,
      intervalMs: op.intervalMs,
      lastExecuted: op.lastExecuted,
      isRunning: op.isRunning,
      nextExecution: op.lastExecuted + op.intervalMs,
      executionCount: op.executionCount,
      lastError: op.lastError,
    }));
  }

  /**
   * Get timer coordinator statistics
   */
  public getStats(): TimerCoordinatorStats {
    const allOperations = Array.from(this.operations.values());
    const runningOperations = allOperations.filter((op) => op.isRunning).length;
    const totalExecutions = allOperations.reduce((sum, op) => sum + op.executionCount, 0);
    const totalExecutionTime = allOperations.reduce((sum, op) => sum + op.totalExecutionTime, 0);

    return {
      isActive: this.isActive,
      totalOperations: this.operations.size,
      runningOperations,
      totalExecutions: this.stats.totalExecutions,
      totalErrors: this.stats.totalErrors,
      averageExecutionTime: totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0,
      uptime: this.isActive ? Date.now() - this.stats.startTime : 0,
    };
  }

  /**
   * Force execution of a specific operation (for testing)
   */
  public async forceExecution(operationId: string): Promise<boolean> {
    const operation = this.operations.get(operationId);
    if (!operation) {
      console.warn("Operation not found for forced execution", {
        operation: "force_execution",
        operationId,
      });
      return false;
    }

    if (operation.isRunning) {
      console.warn("Operation already running", {
        operation: "force_execution",
        operationId,
        operationName: operation.name,
      });
      return false;
    }

    try {
      await this.executeOperationSafely(operation);
      return true;
    } catch (error) {
      console.error(
        "Forced execution failed",
        {
          operation: "force_execution",
          operationId,
          operationName: operation.name,
        },
        error
      );
      return false;
    }
  }

  // Private methods

  /**
   * Main coordination cycle - prevents overlapping operations
   */
  private async coordinateCycle(): Promise<void> {
    if (!this.isActive) return;

    const now = Date.now();
    const readyOperations: (typeof this.operations extends Map<string, infer T> ? T : never)[] = [];

    // Find operations that are ready to execute
    const allOperations = Array.from(this.operations.values());

    for (const operation of allOperations) {
      if (operation.isRunning) {
        continue; // Skip operations that are already running
      }

      const timeSinceLastExecution = now - operation.lastExecuted;
      if (timeSinceLastExecution >= operation.intervalMs) {
        readyOperations.push(operation);
      }
    }

    // Limit concurrent operations
    const runningCount = allOperations.filter((op) => op.isRunning).length;
    const availableSlots = this.maxConcurrentOperations - runningCount;

    if (availableSlots <= 0) {
      return;
    }

    // Execute ready operations in order of priority (shortest interval first)
    readyOperations
      .sort((a, b) => a.intervalMs - b.intervalMs)
      .slice(0, availableSlots)
      .forEach((operation) => {
        if (!this.isActive) return; // Check if coordinator was stopped

        // Execute asynchronously to prevent blocking
        this.executeOperationSafely(operation).catch((error) => {
          console.error(
            "Operation execution failed in coordination cycle",
            {
              operation: "coordination_cycle",
              operationId: operation.id,
              operationName: operation.name,
            },
            error
          );
        });
      });
  }

  /**
   * Execute an operation with proper error handling and state management
   */
  private async executeOperationSafely(
    operation: typeof this.operations extends Map<string, infer T> ? T : never
  ): Promise<void> {
    const timer = createTimer("operation_execution", "event-handling");

    try {
      operation.isRunning = true;
      operation.lastExecuted = Date.now(); // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error(`Operation timeout after ${this.operationTimeoutMs}ms`)),
          this.operationTimeoutMs
        );
      });

      // Race between operation execution and timeout
      await Promise.race([operation.handler(), timeoutPromise]);

      const duration = timer.end({
        operationId: operation.id,
        operationName: operation.name,
        status: "success",
      });

      operation.executionCount++;
      operation.totalExecutionTime += duration;
      this.stats.totalExecutions++;

      // Clear any previous error
      delete operation.lastError;
    } catch (error) {
      const duration = timer.end({
        operationId: operation.id,
        operationName: operation.name,
        status: "failed",
      });

      operation.lastError = error.message;
      this.stats.totalErrors++;

      console.error(
        "Operation failed",
        {
          operation: "execute_operation",
          operationId: operation.id,
          operationName: operation.name,
          duration,
          executionCount: operation.executionCount,
          status: "failed",
        },
        error
      );

      throw error;
    } finally {
      operation.isRunning = false;
    }
  }

  /**
   * Get coordinator status
   */
  public getStatus(): { isActive: boolean; operationsCount: number; runningOperations: number } {
    const runningOperations = Array.from(this.operations.values()).filter(
      (op) => op.isRunning
    ).length;

    return {
      isActive: this.isActive,
      operationsCount: this.operations.size,
      runningOperations,
    };
  }
}

/**
 * Factory function to create EventHandling instance
 */
export function createEventHandling(config?: EventHandlingConfig): EventHandling {
  return new EventHandling(config);
}
