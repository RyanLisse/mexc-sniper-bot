/**
 * WebSocket Message Router
 *
 * Routes incoming WebSocket messages to appropriate handlers based on channels and types.
 * Extracted from websocket-server.ts for modularity and maintainability.
 *
 * Features:
 * - Channel-based message routing
 * - Global message handlers
 * - Async handler execution
 * - Error handling and recovery
 * - Handler registration and management
 */

import type {
  MessageHandler,
  WebSocketMessage,
} from "@/src/lib/websocket-types";

export interface MessageRoutingStats {
  totalHandlers: number;
  channelHandlers: number;
  globalHandlers: number;
  activeChannels: string[];
  messagesRouted: number;
  routingErrors: number;
}

export class WebSocketMessageRouter {
  private handlers = new Map<string, MessageHandler[]>();
  private globalHandlers: MessageHandler[] = [];
  private routingStats = {
    messagesRouted: 0,
    routingErrors: 0,
  };

  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[websocket-message-router]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[websocket-message-router]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[websocket-message-router]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[websocket-message-router]", message, context || ""),
  };

  /**
   * Add a handler for a specific channel
   */
  addHandler(channel: string, handler: MessageHandler): void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, []);
    }
    this.handlers.get(channel)?.push(handler);

    this.logger.debug(`Handler added for channel: ${channel}`, {
      totalHandlersForChannel: this.handlers.get(channel)?.length || 0,
    });
  }

  /**
   * Add a global handler that processes all messages
   */
  addGlobalHandler(handler: MessageHandler): void {
    this.globalHandlers.push(handler);

    this.logger.debug("Global handler added", {
      totalGlobalHandlers: this.globalHandlers.length,
    });
  }

  /**
   * Remove a specific handler from a channel
   */
  removeHandler(channel: string, handler: MessageHandler): boolean {
    const channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) {
      return false;
    }

    const index = channelHandlers.indexOf(handler);
    if (index === -1) {
      return false;
    }

    channelHandlers.splice(index, 1);

    // Clean up empty channel handler arrays
    if (channelHandlers.length === 0) {
      this.handlers.delete(channel);
    }

    this.logger.debug(`Handler removed from channel: ${channel}`, {
      remainingHandlersForChannel: channelHandlers.length,
    });

    return true;
  }

  /**
   * Remove a global handler
   */
  removeGlobalHandler(handler: MessageHandler): boolean {
    const index = this.globalHandlers.indexOf(handler);
    if (index === -1) {
      return false;
    }

    this.globalHandlers.splice(index, 1);

    this.logger.debug("Global handler removed", {
      remainingGlobalHandlers: this.globalHandlers.length,
    });

    return true;
  }

  /**
   * Route a message to appropriate handlers
   */
  async routeMessage(
    message: WebSocketMessage,
    connectionId: string
  ): Promise<void> {
    const routingStart = Date.now();

    try {
      this.logger.debug(`Routing message from connection: ${connectionId}`, {
        channel: message.channel,
        type: message.type,
        messageId: message.id,
      });

      // Execute global handlers first
      await this.executeHandlers(
        this.globalHandlers,
        message,
        connectionId,
        "global"
      );

      // Execute channel-specific handlers
      const channelHandlers = this.handlers.get(message.channel) || [];
      await this.executeHandlers(
        channelHandlers,
        message,
        connectionId,
        message.channel
      );

      this.routingStats.messagesRouted++;

      const routingTime = Date.now() - routingStart;
      this.logger.debug(`Message routed successfully`, {
        connectionId,
        channel: message.channel,
        routingTimeMs: routingTime,
        globalHandlers: this.globalHandlers.length,
        channelHandlers: channelHandlers.length,
      });
    } catch (error) {
      this.routingStats.routingErrors++;
      const routingTime = Date.now() - routingStart;

      this.logger.error(
        `Error routing message from connection: ${connectionId}`,
        {
          channel: message.channel,
          type: message.type,
          messageId: message.id,
          routingTimeMs: routingTime,
        },
        error as Error
      );

      throw error;
    }
  }

  /**
   * Execute a list of handlers for a message
   */
  private async executeHandlers(
    handlers: MessageHandler[],
    message: WebSocketMessage,
    connectionId: string,
    handlerType: string
  ): Promise<void> {
    if (handlers.length === 0) {
      return;
    }

    const executionPromises = handlers.map(async (handler, index) => {
      const handlerStart = Date.now();
      try {
        await handler(message);
        const handlerTime = Date.now() - handlerStart;

        this.logger.debug(`Handler executed successfully`, {
          handlerType,
          handlerIndex: index,
          executionTimeMs: handlerTime,
          messageChannel: message.channel,
        });
      } catch (error) {
        const handlerTime = Date.now() - handlerStart;

        this.logger.error(
          `Handler execution failed`,
          {
            handlerType,
            handlerIndex: index,
            executionTimeMs: handlerTime,
            messageChannel: message.channel,
            connectionId,
          },
          error as Error
        );

        // Don't rethrow to prevent one failing handler from stopping others
      }
    });

    // Wait for all handlers to complete
    await Promise.allSettled(executionPromises);
  }

  /**
   * Get all registered channels
   */
  getRegisteredChannels(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get handler count for a specific channel
   */
  getChannelHandlerCount(channel: string): number {
    return this.handlers.get(channel)?.length || 0;
  }

  /**
   * Get global handler count
   */
  getGlobalHandlerCount(): number {
    return this.globalHandlers.length;
  }

  /**
   * Get routing statistics
   */
  getStats(): MessageRoutingStats {
    const channelHandlerCount = Array.from(this.handlers.values()).reduce(
      (total, handlers) => total + handlers.length,
      0
    );

    return {
      totalHandlers: channelHandlerCount + this.globalHandlers.length,
      channelHandlers: channelHandlerCount,
      globalHandlers: this.globalHandlers.length,
      activeChannels: Array.from(this.handlers.keys()),
      messagesRouted: this.routingStats.messagesRouted,
      routingErrors: this.routingStats.routingErrors,
    };
  }

  /**
   * Clear all handlers for a channel
   */
  clearChannelHandlers(channel: string): number {
    const handlers = this.handlers.get(channel);
    if (!handlers) {
      return 0;
    }

    const removedCount = handlers.length;
    this.handlers.delete(channel);

    this.logger.info(`Cleared all handlers for channel: ${channel}`, {
      removedHandlers: removedCount,
    });

    return removedCount;
  }

  /**
   * Clear all global handlers
   */
  clearGlobalHandlers(): number {
    const removedCount = this.globalHandlers.length;
    this.globalHandlers = [];

    this.logger.info("Cleared all global handlers", {
      removedHandlers: removedCount,
    });

    return removedCount;
  }

  /**
   * Clear all handlers
   */
  clearAllHandlers(): void {
    const channelHandlerCount = Array.from(this.handlers.values()).reduce(
      (total, handlers) => total + handlers.length,
      0
    );
    const globalHandlerCount = this.globalHandlers.length;

    this.handlers.clear();
    this.globalHandlers = [];

    this.logger.info("Cleared all handlers", {
      removedChannelHandlers: channelHandlerCount,
      removedGlobalHandlers: globalHandlerCount,
    });
  }

  /**
   * Check if a channel has any handlers
   */
  hasChannelHandlers(channel: string): boolean {
    const handlers = this.handlers.get(channel);
    return handlers ? handlers.length > 0 : false;
  }

  /**
   * Check if there are any global handlers
   */
  hasGlobalHandlers(): boolean {
    return this.globalHandlers.length > 0;
  }

  /**
   * Reset routing statistics
   */
  resetStats(): void {
    this.routingStats.messagesRouted = 0;
    this.routingStats.routingErrors = 0;

    this.logger.info("Routing statistics reset");
  }
}
