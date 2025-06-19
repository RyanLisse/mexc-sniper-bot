/**
 * Standardized error types for consistent error handling across the application
 */

export enum ErrorCode {
  // General errors
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR = "AUTHORIZATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",
  RATE_LIMIT_ERROR = "RATE_LIMIT_ERROR",

  // Network and API errors
  NETWORK_ERROR = "NETWORK_ERROR",
  API_ERROR = "API_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",

  // Database errors
  DATABASE_ERROR = "DATABASE_ERROR",
  DATABASE_CONNECTION_ERROR = "DATABASE_CONNECTION_ERROR",
  DATABASE_QUERY_ERROR = "DATABASE_QUERY_ERROR",
  DATABASE_CONSTRAINT_ERROR = "DATABASE_CONSTRAINT_ERROR",

  // Trading specific errors
  MEXC_API_ERROR = "MEXC_API_ERROR",
  MEXC_CONNECTIVITY_ERROR = "MEXC_CONNECTIVITY_ERROR",
  MEXC_AUTHENTICATION_ERROR = "MEXC_AUTHENTICATION_ERROR",
  TRADING_ERROR = "TRADING_ERROR",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  INVALID_SYMBOL = "INVALID_SYMBOL",
  MARKET_CLOSED = "MARKET_CLOSED",

  // Agent and workflow errors
  AGENT_ERROR = "AGENT_ERROR",
  WORKFLOW_ERROR = "WORKFLOW_ERROR",
  COORDINATION_ERROR = "COORDINATION_ERROR",
  PATTERN_DETECTION_ERROR = "PATTERN_DETECTION_ERROR",

  // Configuration errors
  CONFIG_ERROR = "CONFIG_ERROR",
  ENVIRONMENT_ERROR = "ENVIRONMENT_ERROR",
  ENCRYPTION_ERROR = "ENCRYPTION_ERROR",
}

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface ErrorContext {
  operation?: string;
  userId?: string;
  requestId?: string;
  agentName?: string;
  symbol?: string;
  vcoinId?: string;
  endpoint?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface ErrorMetadata {
  code: ErrorCode;
  severity: ErrorSeverity;
  retryable: boolean;
  userMessage?: string;
  technicalMessage?: string;
  context?: ErrorContext;
  stack?: string;
  cause?: Error;
}

/**
 * Base application error class with structured error information
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly retryable: boolean;
  public readonly userMessage?: string;
  public readonly technicalMessage?: string;
  public readonly context?: ErrorContext;
  public readonly timestamp: string;
  public readonly cause?: Error;

  constructor(message: string, metadata: Partial<ErrorMetadata> & { code: ErrorCode }) {
    super(message);
    this.name = "AppError";

    this.code = metadata.code;
    this.severity = metadata.severity ?? ErrorSeverity.MEDIUM;
    this.retryable = metadata.retryable ?? false;
    this.userMessage = metadata.userMessage;
    this.technicalMessage = metadata.technicalMessage;
    this.context = metadata.context;
    this.timestamp = new Date().toISOString();
    this.cause = metadata.cause;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Convert error to JSON for logging and API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      retryable: this.retryable,
      userMessage: this.userMessage,
      technicalMessage: this.technicalMessage,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    return this.userMessage || this.getDefaultUserMessage();
  }

  /**
   * Get default user message based on error code
   */
  private getDefaultUserMessage(): string {
    switch (this.code) {
      case ErrorCode.AUTHENTICATION_ERROR:
      case ErrorCode.MEXC_AUTHENTICATION_ERROR:
        return "Authentication failed. Please check your credentials.";
      case ErrorCode.AUTHORIZATION_ERROR:
        return "You don't have permission to perform this action.";
      case ErrorCode.NOT_FOUND:
        return "The requested resource was not found.";
      case ErrorCode.RATE_LIMIT_ERROR:
        return "Too many requests. Please try again later.";
      case ErrorCode.NETWORK_ERROR:
      case ErrorCode.MEXC_CONNECTIVITY_ERROR:
        return "Network connection error. Please check your internet connection.";
      case ErrorCode.VALIDATION_ERROR:
        return "The provided data is invalid.";
      case ErrorCode.INSUFFICIENT_BALANCE:
        return "Insufficient balance for this operation.";
      case ErrorCode.MARKET_CLOSED:
        return "Market is currently closed.";
      case ErrorCode.TIMEOUT_ERROR:
        return "The operation timed out. Please try again.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  }
}

/**
 * Specific error classes for different domains
 */
export class ValidationError extends AppError {
  constructor(message: string, field?: string, context?: ErrorContext) {
    super(message, {
      code: ErrorCode.VALIDATION_ERROR,
      severity: ErrorSeverity.LOW,
      retryable: false,
      userMessage: `Validation failed: ${message}`,
      context: { ...context, field },
    });
  }
}

export class NetworkError extends AppError {
  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super(message, {
      code: ErrorCode.NETWORK_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      context,
      cause,
    });
  }
}

export class MexcApiError extends AppError {
  constructor(message: string, apiCode?: string, context?: ErrorContext, cause?: Error) {
    super(message, {
      code: ErrorCode.MEXC_API_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: false,
      technicalMessage: `MEXC API Error: ${apiCode || "Unknown"} - ${message}`,
      context: { ...context, apiCode },
      cause,
    });
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, operation?: string, context?: ErrorContext, cause?: Error) {
    super(message, {
      code: ErrorCode.DATABASE_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      technicalMessage: `Database operation failed: ${operation || "Unknown"} - ${message}`,
      context: { ...context, operation },
      cause,
    });
  }
}

export class AgentError extends AppError {
  constructor(message: string, agentName: string, context?: ErrorContext, cause?: Error) {
    super(message, {
      code: ErrorCode.AGENT_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      technicalMessage: `Agent ${agentName} failed: ${message}`,
      context: { ...context, agentName },
      cause,
    });
  }
}

export class WorkflowError extends AppError {
  constructor(message: string, workflowType: string, context?: ErrorContext, cause?: Error) {
    super(message, {
      code: ErrorCode.WORKFLOW_ERROR,
      severity: ErrorSeverity.HIGH,
      retryable: true,
      technicalMessage: `Workflow ${workflowType} failed: ${message}`,
      context: { ...context, workflowType },
      cause,
    });
  }
}

/**
 * Error factory functions for common error scenarios
 */
export const ErrorFactory = {
  validation: (message: string, field?: string, context?: ErrorContext) =>
    new ValidationError(message, field, context),

  network: (message: string, context?: ErrorContext, cause?: Error) =>
    new NetworkError(message, context, cause),

  mexcApi: (message: string, apiCode?: string, context?: ErrorContext, cause?: Error) =>
    new MexcApiError(message, apiCode, context, cause),

  database: (message: string, operation?: string, context?: ErrorContext, cause?: Error) =>
    new DatabaseError(message, operation, context, cause),

  agent: (message: string, agentName: string, context?: ErrorContext, cause?: Error) =>
    new AgentError(message, agentName, context, cause),

  workflow: (message: string, workflowType: string, context?: ErrorContext, cause?: Error) =>
    new WorkflowError(message, workflowType, context, cause),

  authentication: (message = "Authentication failed", context?: ErrorContext) =>
    new AppError(message, {
      code: ErrorCode.AUTHENTICATION_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      context,
    }),

  authorization: (message = "Insufficient permissions", context?: ErrorContext) =>
    new AppError(message, {
      code: ErrorCode.AUTHORIZATION_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      context,
    }),

  notFound: (resource: string, context?: ErrorContext) =>
    new AppError(`${resource} not found`, {
      code: ErrorCode.NOT_FOUND,
      severity: ErrorSeverity.LOW,
      retryable: false,
      context: { ...context, resource },
    }),

  rateLimit: (resetTime?: number, context?: ErrorContext) =>
    new AppError("Rate limit exceeded", {
      code: ErrorCode.RATE_LIMIT_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      userMessage: "Too many requests. Please try again later.",
      context: { ...context, resetTime },
    }),

  timeout: (operation: string, context?: ErrorContext) =>
    new AppError(`Operation ${operation} timed out`, {
      code: ErrorCode.TIMEOUT_ERROR,
      severity: ErrorSeverity.MEDIUM,
      retryable: true,
      context: { ...context, operation },
    }),

  encryption: (message: string, context?: ErrorContext) =>
    new AppError(message, {
      code: ErrorCode.ENCRYPTION_ERROR,
      severity: ErrorSeverity.CRITICAL,
      retryable: false,
      userMessage: "Encryption service unavailable. Please contact support.",
      context,
    }),
};

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown, fallbackCode = ErrorCode.UNKNOWN_ERROR): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, {
      code: fallbackCode,
      severity: ErrorSeverity.MEDIUM,
      retryable: false,
      cause: error,
    });
  }

  return new AppError(String(error), {
    code: fallbackCode,
    severity: ErrorSeverity.MEDIUM,
    retryable: false,
  });
}
