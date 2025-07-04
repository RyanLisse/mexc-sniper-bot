/**
 * Memory Leak Cleanup Manager
 *
 * AUTONOMOUS MEMORY MANAGEMENT AGENT IMPLEMENTATION
 *
 * Centralized system for managing and preventing EventEmitter memory leaks.
 * Provides automatic cleanup, monitoring, and prevention mechanisms.
 */

import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events";

// Track all EventEmitter instances for cleanup
export class MemoryLeakCleanupManager {
  private static instance: MemoryLeakCleanupManager;
  private eventEmitterRegistry = new WeakSet<EventEmitter>();
  private cleanupHandlers = new Map<string, () => Promise<void> | void>();
  private isShuttingDown = false;

  static getInstance(): MemoryLeakCleanupManager {
    if (!MemoryLeakCleanupManager.instance) {
      MemoryLeakCleanupManager.instance = new MemoryLeakCleanupManager();
    }
    return MemoryLeakCleanupManager.instance;
  }

  /**
   * Register an EventEmitter for automatic cleanup
   */
  registerEventEmitter(
    emitter: BrowserCompatibleEventEmitter,
    identifier?: string
  ): void {
    this.eventEmitterRegistry.add(emitter);

    // Set max listeners to prevent warnings during normal operation
    if (emitter.getMaxListeners() === 10) {
      emitter.setMaxListeners(20); // Reasonable increase
    }

    if (identifier) {
      console.log(`[Memory Cleanup] Registered EventEmitter: ${identifier}`);
    }
  }

  /**
   * Register a cleanup handler for a specific service
   */
  registerCleanupHandler(
    identifier: string,
    handler: () => Promise<void> | void
  ): void {
    this.cleanupHandlers.set(identifier, handler);
    console.log(`[Memory Cleanup] Registered cleanup handler: ${identifier}`);
  }

  /**
   * Clean up a specific EventEmitter
   */
  cleanupEventEmitter(
    emitter: BrowserCompatibleEventEmitter,
    identifier?: string
  ): void {
    try {
      // Remove all listeners
      emitter.removeAllListeners();

      // Reset max listeners to default
      emitter.setMaxListeners(10);

      if (identifier) {
        console.log(`[Memory Cleanup] Cleaned up EventEmitter: ${identifier}`);
      }
    } catch (error) {
      console.error(
        `[Memory Cleanup] Error cleaning up EventEmitter ${identifier}:`,
        error
      );
    }
  }

  /**
   * Execute a specific cleanup handler
   */
  async executeCleanupHandler(identifier: string): Promise<void> {
    const handler = this.cleanupHandlers.get(identifier);
    if (!handler) {
      console.warn(
        `[Memory Cleanup] No cleanup handler found for: ${identifier}`
      );
      return;
    }

    try {
      console.log(`[Memory Cleanup] Executing cleanup handler: ${identifier}`);
      await handler();
      console.log(`[Memory Cleanup] Completed cleanup handler: ${identifier}`);
    } catch (error) {
      console.error(
        `[Memory Cleanup] Error in cleanup handler ${identifier}:`,
        error
      );
    }
  }

  /**
   * Execute all registered cleanup handlers
   */
  async executeAllCleanupHandlers(): Promise<void> {
    if (this.isShuttingDown) {
      console.log("[Memory Cleanup] Already shutting down, skipping cleanup");
      return;
    }

    this.isShuttingDown = true;
    console.log("[Memory Cleanup] Executing all cleanup handlers...");

    const cleanupPromises = Array.from(this.cleanupHandlers.entries()).map(
      async ([identifier, handler]) => {
        try {
          console.log(`[Memory Cleanup] Starting cleanup: ${identifier}`);
          await handler();
          console.log(`[Memory Cleanup] Completed cleanup: ${identifier}`);
        } catch (error) {
          console.error(
            `[Memory Cleanup] Error in cleanup ${identifier}:`,
            error
          );
        }
      }
    );

    await Promise.allSettled(cleanupPromises);
    console.log("[Memory Cleanup] All cleanup handlers executed");
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): void {
    if (global.gc) {
      console.log("[Memory Cleanup] Forcing garbage collection...");
      global.gc();
      console.log("[Memory Cleanup] Garbage collection completed");
    } else {
      console.log(
        "[Memory Cleanup] Garbage collection not available (run with --expose-gc)"
      );
    }
  }

  /**
   * Emergency memory cleanup - removes all listeners from all tracked EventEmitters
   */
  emergencyCleanup(): void {
    console.log("[Memory Cleanup] EMERGENCY CLEANUP INITIATED");

    // Force cleanup all registered handlers
    this.executeAllCleanupHandlers().catch((error) => {
      console.error("[Memory Cleanup] Error during emergency cleanup:", error);
    });

    // Force garbage collection
    this.forceGarbageCollection();

    console.log("[Memory Cleanup] Emergency cleanup completed");
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    heapUsed: number;
    heapTotal: number;
    heapUtilization: number;
    registeredHandlers: number;
    isShuttingDown: boolean;
  } {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUtilization: memUsage.heapUsed / memUsage.heapTotal,
      registeredHandlers: this.cleanupHandlers.size,
      isShuttingDown: this.isShuttingDown,
    };
  }

  /**
   * Reset the cleanup manager (for testing)
   */
  reset(): void {
    this.cleanupHandlers.clear();
    this.isShuttingDown = false;
    console.log("[Memory Cleanup] Manager reset");
  }
}

// Global instance
export const memoryLeakCleanupManager = MemoryLeakCleanupManager.getInstance();

/**
 * Decorator for auto-registering EventEmitter classes
 */
export function AutoCleanupEventEmitter(identifier?: string) {
  return <T extends { new (...args: any[]): BrowserCompatibleEventEmitter }>(
    constructor: T
  ) =>
    class extends constructor {
      constructor(...args: any[]) {
        super(...args);
        memoryLeakCleanupManager.registerEventEmitter(
          this,
          identifier || constructor.name
        );
      }
    };
}

/**
 * Utility function to create EventEmitter with automatic cleanup registration
 */
export function createManagedEventEmitter(
  identifier?: string
): BrowserCompatibleEventEmitter {
  const emitter = new BrowserCompatibleEventEmitter();
  memoryLeakCleanupManager.registerEventEmitter(emitter, identifier);
  return emitter;
}

/**
 * Process signal handlers for graceful shutdown using centralized manager
 */
if (typeof process !== "undefined") {
  // Import the centralized process event manager
  import("./process-event-manager")
    .then(({ registerProcessEventHandler }) => {
      const gracefulShutdown = async (signal: string) => {
        console.log(
          `[Memory Cleanup] Received ${signal}, initiating graceful shutdown...`
        );

        try {
          await memoryLeakCleanupManager.executeAllCleanupHandlers();
          memoryLeakCleanupManager.forceGarbageCollection();

          console.log(
            `[Memory Cleanup] Graceful shutdown completed for ${signal}`
          );
          process.exit(0);
        } catch (error) {
          console.error(
            `[Memory Cleanup] Error during graceful shutdown:`,
            error
          );
          process.exit(1);
        }
      };

      // Register handlers through centralized manager to prevent listener accumulation
      registerProcessEventHandler(
        "memory-cleanup-sigint",
        "SIGINT",
        () => gracefulShutdown("SIGINT"),
        "memory-leak-cleanup-manager"
      );

      registerProcessEventHandler(
        "memory-cleanup-sigterm",
        "SIGTERM",
        () => gracefulShutdown("SIGTERM"),
        "memory-leak-cleanup-manager"
      );

      registerProcessEventHandler(
        "memory-cleanup-beforeexit",
        "beforeExit",
        () => {
          memoryLeakCleanupManager
            .executeAllCleanupHandlers()
            .catch(console.error);
        },
        "memory-leak-cleanup-manager"
      );

      // Handle unhandled promise rejections
      registerProcessEventHandler(
        "memory-cleanup-rejection",
        "unhandledRejection",
        (reason: any, promise: Promise<any>) => {
          console.error(
            "[Memory Cleanup] Unhandled Rejection at:",
            promise,
            "reason:",
            reason
          );
          memoryLeakCleanupManager.emergencyCleanup();
        },
        "memory-leak-cleanup-manager"
      );

      // Handle uncaught exceptions
      registerProcessEventHandler(
        "memory-cleanup-exception",
        "uncaughtException",
        (error: Error) => {
          console.error("[Memory Cleanup] Uncaught Exception:", error);
          memoryLeakCleanupManager.emergencyCleanup();
          process.exit(1);
        },
        "memory-leak-cleanup-manager"
      );
    })
    .catch((error) => {
      console.error(
        "[Memory Cleanup] Failed to register process handlers:",
        error
      );
    });
}
