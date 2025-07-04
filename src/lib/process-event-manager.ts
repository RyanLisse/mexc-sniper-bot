/**
 * Process Event Manager
 *
 * Centralized management of process-level event listeners to prevent
 * MaxListenersExceededWarning during test execution and normal operation.
 *
 * AUTONOMOUS MEMORY MANAGEMENT AGENT - CRITICAL FIX
 */

interface ProcessEventHandler {
  id: string;
  type:
    | "unhandledRejection"
    | "uncaughtException"
    | "SIGINT"
    | "SIGTERM"
    | "beforeExit";
  handler: (...args: any[]) => void;
  source: string;
}

export class ProcessEventManager {
  private static instance: ProcessEventManager;
  private handlers = new Map<string, ProcessEventHandler>();
  private attachedEvents = new Set<string>();
  private isShuttingDown = false;

  static getInstance(): ProcessEventManager {
    if (!ProcessEventManager.instance) {
      ProcessEventManager.instance = new ProcessEventManager();
    }
    return ProcessEventManager.instance;
  }

  /**
   * Register a process event handler with deduplication
   */
  registerHandler(
    id: string,
    type: ProcessEventHandler["type"],
    handler: ProcessEventHandler["handler"],
    source: string = "unknown"
  ): void {
    if (this.isShuttingDown) {
      console.warn(
        `[ProcessEventManager] Cannot register handler ${id} during shutdown`
      );
      return;
    }

    // Check if this exact handler is already registered
    const existingHandler = this.handlers.get(id);
    if (existingHandler) {
      console.log(
        `[ProcessEventManager] Handler ${id} already registered by ${existingHandler.source}, skipping`
      );
      return;
    }

    // Store the handler
    this.handlers.set(id, { id, type, handler, source });

    // Attach the event listener if not already attached for this type
    if (!this.attachedEvents.has(type)) {
      this.attachProcessListener(type);
      this.attachedEvents.add(type);
      console.log(
        `[ProcessEventManager] Attached process listener for ${type} (source: ${source})`
      );
    } else {
      console.log(
        `[ProcessEventManager] Process listener for ${type} already attached, handler registered (source: ${source})`
      );
    }
  }

  /**
   * Unregister a specific handler
   */
  unregisterHandler(id: string): void {
    const handler = this.handlers.get(id);
    if (handler) {
      this.handlers.delete(id);
      console.log(
        `[ProcessEventManager] Unregistered handler ${id} from ${handler.source}`
      );

      // Check if we should remove the process listener
      const remainingHandlersForType = Array.from(
        this.handlers.values()
      ).filter((h) => h.type === handler.type);

      if (
        remainingHandlersForType.length === 0 &&
        this.attachedEvents.has(handler.type)
      ) {
        // No more handlers for this event type, can remove the listener
        console.log(
          `[ProcessEventManager] No more handlers for ${handler.type}, keeping listener for safety`
        );
        // Note: We don't remove process listeners as they're critical for graceful shutdown
      }
    }
  }

  /**
   * Attach the actual process event listener
   */
  private attachProcessListener(type: ProcessEventHandler["type"]): void {
    switch (type) {
      case "unhandledRejection":
        process.on(
          "unhandledRejection",
          this.handleUnhandledRejection.bind(this)
        );
        break;
      case "uncaughtException":
        process.on(
          "uncaughtException",
          this.handleUncaughtException.bind(this)
        );
        break;
      case "SIGINT":
        process.on("SIGINT", this.handleSignal.bind(this, "SIGINT"));
        break;
      case "SIGTERM":
        process.on("SIGTERM", this.handleSignal.bind(this, "SIGTERM"));
        break;
      case "beforeExit":
        process.on("beforeExit", this.handleBeforeExit.bind(this));
        break;
    }
  }

  /**
   * Handle unhandled promise rejections
   */
  private handleUnhandledRejection(reason: any, promise: Promise<any>): void {
    const handlers = Array.from(this.handlers.values()).filter(
      (h) => h.type === "unhandledRejection"
    );

    if (handlers.length === 0) {
      console.error("[ProcessEventManager] Unhandled Rejection:", reason);
      console.error("Promise:", promise);
      return;
    }

    handlers.forEach((handler) => {
      try {
        handler.handler(reason, promise);
      } catch (error) {
        console.error(
          `[ProcessEventManager] Error in unhandledRejection handler ${handler.id}:`,
          error
        );
      }
    });
  }

  /**
   * Handle uncaught exceptions
   */
  private handleUncaughtException(error: Error): void {
    const handlers = Array.from(this.handlers.values()).filter(
      (h) => h.type === "uncaughtException"
    );

    if (handlers.length === 0) {
      console.error("[ProcessEventManager] Uncaught Exception:", error);
      process.exit(1);
      return;
    }

    handlers.forEach((handler) => {
      try {
        handler.handler(error);
      } catch (handlerError) {
        console.error(
          `[ProcessEventManager] Error in uncaughtException handler ${handler.id}:`,
          handlerError
        );
      }
    });
  }

  /**
   * Handle process signals
   */
  private handleSignal(signal: "SIGINT" | "SIGTERM"): void {
    if (this.isShuttingDown) {
      console.log(
        `[ProcessEventManager] Already shutting down, ignoring ${signal}`
      );
      return;
    }

    this.isShuttingDown = true;
    console.log(
      `[ProcessEventManager] Received ${signal}, executing handlers...`
    );

    const handlers = Array.from(this.handlers.values()).filter(
      (h) => h.type === signal
    );

    if (handlers.length === 0) {
      console.log(
        `[ProcessEventManager] No handlers for ${signal}, exiting immediately`
      );
      process.exit(0);
      return;
    }

    handlers.forEach((handler) => {
      try {
        handler.handler();
      } catch (error) {
        console.error(
          `[ProcessEventManager] Error in ${signal} handler ${handler.id}:`,
          error
        );
      }
    });
  }

  /**
   * Handle beforeExit event
   */
  private handleBeforeExit(): void {
    const handlers = Array.from(this.handlers.values()).filter(
      (h) => h.type === "beforeExit"
    );

    handlers.forEach((handler) => {
      try {
        handler.handler();
      } catch (error) {
        console.error(
          `[ProcessEventManager] Error in beforeExit handler ${handler.id}:`,
          error
        );
      }
    });
  }

  /**
   * Clean up all handlers (for testing)
   */
  cleanup(): void {
    console.log("[ProcessEventManager] Cleaning up all handlers...");
    this.handlers.clear();
    this.isShuttingDown = false;
    // Note: We don't remove process listeners as they may be needed for graceful shutdown
  }

  /**
   * Get current handler information for debugging
   */
  getHandlerInfo(): {
    handlerCount: number;
    attachedEvents: string[];
    handlers: Array<{ id: string; type: string; source: string }>;
    isShuttingDown: boolean;
  } {
    return {
      handlerCount: this.handlers.size,
      attachedEvents: Array.from(this.attachedEvents),
      handlers: Array.from(this.handlers.values()).map((h) => ({
        id: h.id,
        type: h.type,
        source: h.source,
      })),
      isShuttingDown: this.isShuttingDown,
    };
  }

  /**
   * Increase process max listeners to prevent warnings
   */
  increaseMaxListeners(newLimit: number = 20): void {
    const currentLimit = process.getMaxListeners();
    if (newLimit > currentLimit) {
      process.setMaxListeners(newLimit);
      console.log(
        `[ProcessEventManager] Increased process max listeners from ${currentLimit} to ${newLimit}`
      );
    }
  }
}

// Global instance
export const processEventManager = ProcessEventManager.getInstance();

/**
 * Helper function to safely register process event handlers
 */
export function registerProcessEventHandler(
  id: string,
  type: ProcessEventHandler["type"],
  handler: ProcessEventHandler["handler"],
  source?: string
): void {
  processEventManager.registerHandler(id, type, handler, source);
}

/**
 * Helper function to unregister process event handlers
 */
export function unregisterProcessEventHandler(id: string): void {
  processEventManager.unregisterHandler(id);
}

/**
 * Initialize default process event handling with increased limits
 */
export function initializeProcessEventHandling(
  source: string = "system"
): void {
  // Increase max listeners to prevent warnings
  processEventManager.increaseMaxListeners(25);

  // Register default error handlers if not in test environment
  if (!process.env.NODE_ENV?.includes("test") && !globalThis.__TEST_ENV__) {
    registerProcessEventHandler(
      "default-unhandled-rejection",
      "unhandledRejection",
      (reason: any, promise: Promise<any>) => {
        console.error("[Default] Unhandled Rejection:", reason);
        console.error("Promise:", promise);
      },
      source
    );

    registerProcessEventHandler(
      "default-uncaught-exception",
      "uncaughtException",
      (error: Error) => {
        console.error("[Default] Uncaught Exception:", error);
        process.exit(1);
      },
      source
    );
  }
}

// Initialize on module load if not in test environment
if (
  typeof process !== "undefined" &&
  !process.env.NODE_ENV?.includes("test") &&
  !globalThis.__TEST_ENV__
) {
  initializeProcessEventHandling("process-event-manager");
}
