/**
 * CQRS Command Bus Implementation
 *
 * Handles command execution with validation, authorization, and event emission.
 * Part of Phase 3 Production Readiness - Event Sourcing and CQRS patterns.
 */

import { EventEmitter } from "node:events";
import { type DomainEvent, EventFactory, eventStoreManager } from "../event-sourcing/event-store";

// Base Command Interface
export interface Command {
  id: string;
  type: string;
  aggregateId: string;
  payload: any;
  metadata: {
    userId?: string;
    correlationId?: string;
    timestamp: Date;
    source: string;
  };
}

// Command Result
export interface CommandResult {
  success: boolean;
  aggregateId: string;
  version: number;
  events: DomainEvent[];
  errors?: string[];
}

// Command Handler Interface
export interface CommandHandler<T extends Command> {
  handle(command: T): Promise<CommandResult>;
  canHandle(command: Command): boolean;
}

// Command Validator Interface
export interface CommandValidator<T extends Command> {
  validate(command: T): Promise<{
    isValid: boolean;
    errors: string[];
  }>;
}

/**
 * Command Bus Implementation
 */
export class CommandBus extends EventEmitter {
  private handlers: Map<string, CommandHandler<any>> = new Map();
  private validators: Map<string, CommandValidator<any>> = new Map();
  private middleware: CommandMiddleware[] = [];

  /**
   * Register command handler
   */
  registerHandler<T extends Command>(commandType: string, handler: CommandHandler<T>): void {
    this.handlers.set(commandType, handler);
  }

  /**
   * Register command validator
   */
  registerValidator<T extends Command>(commandType: string, validator: CommandValidator<T>): void {
    this.validators.set(commandType, validator);
  }

  /**
   * Add middleware
   */
  addMiddleware(middleware: CommandMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Execute command
   */
  async execute<T extends Command>(command: T): Promise<CommandResult> {
    try {
      // Apply middleware
      for (const middleware of this.middleware) {
        const result = await middleware.execute(command, async (cmd) => cmd);
        if (!result) {
          throw new Error("Command blocked by middleware");
        }
      }

      // Validate command
      const validator = this.validators.get(command.type);
      if (validator) {
        const validation = await validator.validate(command);
        if (!validation.isValid) {
          return {
            success: false,
            aggregateId: command.aggregateId,
            version: 0,
            events: [],
            errors: validation.errors,
          };
        }
      }

      // Find handler
      const handler = this.handlers.get(command.type);
      if (!handler) {
        throw new Error(`No handler registered for command type: ${command.type}`);
      }

      // Execute command
      const result = await handler.handle(command);

      // Emit command executed event
      this.emit("command_executed", {
        command,
        result,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      const errorResult: CommandResult = {
        success: false,
        aggregateId: command.aggregateId,
        version: 0,
        events: [],
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };

      // Emit command failed event
      this.emit("command_failed", {
        command,
        error: error instanceof Error ? error : new Error("Unknown error"),
        timestamp: new Date(),
      });

      return errorResult;
    }
  }

  /**
   * Get registered handlers
   */
  getHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get registered validators
   */
  getValidators(): string[] {
    return Array.from(this.validators.keys());
  }
}

/**
 * Command Middleware Interface
 */
export interface CommandMiddleware {
  execute<T extends Command>(command: T, next: (command: T) => Promise<T>): Promise<T | null>;
}

/**
 * Logging Middleware
 */
export class LoggingMiddleware implements CommandMiddleware {
  async execute<T extends Command>(
    command: T,
    next: (command: T) => Promise<T>
  ): Promise<T | null> {
    console.log(`[COMMAND] Executing: ${command.type}`, {
      id: command.id,
      aggregateId: command.aggregateId,
      userId: command.metadata.userId,
      timestamp: command.metadata.timestamp,
    });

    const result = await next(command);

    console.log(`[COMMAND] Completed: ${command.type}`, {
      id: command.id,
      success: result !== null,
    });

    return result;
  }
}

/**
 * Authorization Middleware
 */
export class AuthorizationMiddleware implements CommandMiddleware {
  private permissions: Map<string, string[]> = new Map();

  addPermission(commandType: string, requiredRoles: string[]): void {
    this.permissions.set(commandType, requiredRoles);
  }

  async execute<T extends Command>(
    command: T,
    next: (command: T) => Promise<T>
  ): Promise<T | null> {
    const requiredRoles = this.permissions.get(command.type);

    if (requiredRoles && requiredRoles.length > 0) {
      // In real implementation, check user roles from auth service
      const userRoles = await this.getUserRoles(command.metadata.userId);

      const hasPermission = requiredRoles.some((role) => userRoles.includes(role));
      if (!hasPermission) {
        console.warn(`[AUTH] Access denied for command: ${command.type}`, {
          userId: command.metadata.userId,
          requiredRoles,
          userRoles,
        });
        return null;
      }
    }

    return next(command);
  }

  private async getUserRoles(userId?: string): Promise<string[]> {
    // Mock implementation - in production, fetch from auth service
    return userId ? ["user", "trader"] : ["anonymous"];
  }
}

/**
 * Command Factory
 */
export class CommandFactory {
  static createCommand<T = any>(
    type: string,
    aggregateId: string,
    payload: T,
    metadata: Partial<Command["metadata"]> = {}
  ): Command {
    return {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      aggregateId,
      payload,
      metadata: {
        timestamp: new Date(),
        source: "command_bus",
        ...metadata,
      },
    };
  }
}

/**
 * Base Command Handler
 */
export abstract class BaseCommandHandler<T extends Command> implements CommandHandler<T> {
  abstract handle(command: T): Promise<CommandResult>;

  canHandle(command: Command): boolean {
    return this.getSupportedCommandType() === command.type;
  }

  protected abstract getSupportedCommandType(): string;

  /**
   * Helper to create and save events
   */
  protected async saveEvents(
    aggregateId: string,
    aggregateType: string,
    expectedVersion: number,
    eventType: string,
    payload: any,
    metadata?: Partial<DomainEvent["metadata"]>
  ): Promise<CommandResult> {
    const event = EventFactory.createEvent(
      aggregateId,
      aggregateType,
      eventType,
      payload,
      metadata
    );

    await eventStoreManager.saveAggregate(aggregateId, expectedVersion, [event]);

    return {
      success: true,
      aggregateId,
      version: expectedVersion + 1,
      events: [event],
    };
  }
}

// Global command bus instance
export const commandBus = new CommandBus();

// Setup default middleware
commandBus.addMiddleware(new LoggingMiddleware());
commandBus.addMiddleware(new AuthorizationMiddleware());
