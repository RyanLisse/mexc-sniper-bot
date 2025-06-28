/**
 * Trading Domain Errors
 * Specific errors that can occur in the trading domain
 */

// Base trading error
export abstract class TradingDomainError extends Error {
  abstract readonly errorCode: string;
  readonly timestamp: Date;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
  }
}

// Trade Execution Errors
export class InvalidTradeParametersError extends TradingDomainError {
  readonly errorCode = "INVALID_TRADE_PARAMETERS";

  constructor(parameter: string, reason: string) {
    super(`Invalid trade parameter '${parameter}': ${reason}`);
  }
}

export class InsufficientBalanceError extends TradingDomainError {
  readonly errorCode = "INSUFFICIENT_BALANCE";

  constructor(required: number, available: number, asset: string) {
    super(`Insufficient ${asset} balance. Required: ${required}, Available: ${available}`);
  }
}

export class OrderExecutionError extends TradingDomainError {
  readonly errorCode = "ORDER_EXECUTION_ERROR";

  constructor(reason: string, exchangeError?: string) {
    super(
      `Order execution failed: ${reason}${exchangeError ? ` (Exchange: ${exchangeError})` : ""}`
    );
  }
}

export class InvalidOrderStateError extends TradingDomainError {
  readonly errorCode = "INVALID_ORDER_STATE";

  constructor(currentState: string, operation: string) {
    super(`Cannot perform '${operation}' on order in '${currentState}' state`);
  }
}

// Position Management Errors
export class PositionNotFoundError extends TradingDomainError {
  readonly errorCode = "POSITION_NOT_FOUND";

  constructor(positionId: string) {
    super(`Position with ID '${positionId}' not found`);
  }
}

export class PositionAlreadyClosedError extends TradingDomainError {
  readonly errorCode = "POSITION_ALREADY_CLOSED";

  constructor(positionId: string) {
    super(`Position '${positionId}' is already closed`);
  }
}

export class InvalidPositionSizeError extends TradingDomainError {
  readonly errorCode = "INVALID_POSITION_SIZE";

  constructor(size: number, reason: string) {
    super(`Invalid position size ${size}: ${reason}`);
  }
}

// Strategy Errors
export class StrategyNotFoundError extends TradingDomainError {
  readonly errorCode = "STRATEGY_NOT_FOUND";

  constructor(strategyId: string) {
    super(`Strategy with ID '${strategyId}' not found`);
  }
}

export class StrategyValidationError extends TradingDomainError {
  readonly errorCode = "STRATEGY_VALIDATION_ERROR";

  constructor(field: string, reason: string) {
    super(`Strategy validation failed for '${field}': ${reason}`);
  }
}

export class StrategyConfigurationError extends TradingDomainError {
  readonly errorCode = "STRATEGY_CONFIGURATION_ERROR";

  constructor(message: string) {
    super(`Strategy configuration error: ${message}`);
  }
}

export class StrategyExecutionError extends TradingDomainError {
  readonly errorCode = "STRATEGY_EXECUTION_ERROR";

  constructor(strategyName: string, reason: string) {
    super(`Strategy '${strategyName}' execution failed: ${reason}`);
  }
}

// Risk Management Errors
export class RiskLimitExceededError extends TradingDomainError {
  readonly errorCode = "RISK_LIMIT_EXCEEDED";

  constructor(limitType: string, current: number, limit: number) {
    super(`${limitType} limit exceeded. Current: ${current}, Limit: ${limit}`);
  }
}

export class CircuitBreakerActiveError extends TradingDomainError {
  readonly errorCode = "CIRCUIT_BREAKER_ACTIVE";

  constructor(resetTime: Date) {
    super(`Circuit breaker is active until ${resetTime.toISOString()}`);
  }
}

export class UnsafeMarketConditionsError extends TradingDomainError {
  readonly errorCode = "UNSAFE_MARKET_CONDITIONS";

  constructor(reason: string) {
    super(`Trading blocked due to unsafe market conditions: ${reason}`);
  }
}

// Auto-Sniping Errors
export class AutoSnipeTargetNotFoundError extends TradingDomainError {
  readonly errorCode = "AUTO_SNIPE_TARGET_NOT_FOUND";

  constructor(targetId: number) {
    super(`Auto-snipe target with ID '${targetId}' not found`);
  }
}

export class InsufficientConfidenceError extends TradingDomainError {
  readonly errorCode = "INSUFFICIENT_CONFIDENCE";

  constructor(actual: number, required: number) {
    super(`Confidence score ${actual}% below required threshold ${required}%`);
  }
}

export class AutoSnipeExecutionError extends TradingDomainError {
  readonly errorCode = "AUTO_SNIPE_EXECUTION_ERROR";

  constructor(symbol: string, reason: string) {
    super(`Auto-snipe execution failed for ${symbol}: ${reason}`);
  }
}

// Market Data Errors
export class InvalidSymbolError extends TradingDomainError {
  readonly errorCode = "INVALID_SYMBOL";

  constructor(symbol: string) {
    super(`Invalid or unsupported symbol: ${symbol}`);
  }
}

export class MarketDataUnavailableError extends TradingDomainError {
  readonly errorCode = "MARKET_DATA_UNAVAILABLE";

  constructor(symbol: string, dataType: string) {
    super(`${dataType} data unavailable for symbol ${symbol}`);
  }
}

export class StaleMarketDataError extends TradingDomainError {
  readonly errorCode = "STALE_MARKET_DATA";

  constructor(symbol: string, lastUpdate: Date, maxAge: number) {
    super(
      `Market data for ${symbol} is stale. Last update: ${lastUpdate.toISOString()}, Max age: ${maxAge}ms`
    );
  }
}

// Concurrency Errors
export class OrderAlreadyProcessingError extends TradingDomainError {
  readonly errorCode = "ORDER_ALREADY_PROCESSING";

  constructor(orderId: string) {
    super(`Order '${orderId}' is already being processed`);
  }
}

export class ConcurrentModificationError extends TradingDomainError {
  readonly errorCode = "CONCURRENT_MODIFICATION_ERROR";

  constructor(resourceType: string, resourceId: string) {
    super(`Concurrent modification detected for ${resourceType} '${resourceId}'`);
  }
}

// Validation Errors
export class DomainValidationError extends TradingDomainError {
  readonly errorCode = "DOMAIN_VALIDATION_ERROR";

  constructor(field: string, value: any, constraint: string) {
    super(`Validation failed for '${field}' with value '${value}': ${constraint}`);
  }
}

export class BusinessRuleViolationError extends TradingDomainError {
  readonly errorCode = "BUSINESS_RULE_VIOLATION";

  constructor(rule: string, context?: string) {
    super(`Business rule violation: ${rule}${context ? ` (Context: ${context})` : ""}`);
  }
}

// Error Factory for common error creation patterns
export class TradingErrorFactory {
  static invalidTradeParameters(parameter: string, reason: string): InvalidTradeParametersError {
    return new InvalidTradeParametersError(parameter, reason);
  }

  static insufficientBalance(
    required: number,
    available: number,
    asset: string
  ): InsufficientBalanceError {
    return new InsufficientBalanceError(required, available, asset);
  }

  static orderExecutionFailed(reason: string, exchangeError?: string): OrderExecutionError {
    return new OrderExecutionError(reason, exchangeError);
  }

  static positionNotFound(positionId: string): PositionNotFoundError {
    return new PositionNotFoundError(positionId);
  }

  static strategyNotFound(strategyId: string): StrategyNotFoundError {
    return new StrategyNotFoundError(strategyId);
  }

  static riskLimitExceeded(
    limitType: string,
    current: number,
    limit: number
  ): RiskLimitExceededError {
    return new RiskLimitExceededError(limitType, current, limit);
  }

  static autoSnipeTargetNotFound(targetId: number): AutoSnipeTargetNotFoundError {
    return new AutoSnipeTargetNotFoundError(targetId);
  }

  static insufficientConfidence(actual: number, required: number): InsufficientConfidenceError {
    return new InsufficientConfidenceError(actual, required);
  }

  static invalidSymbol(symbol: string): InvalidSymbolError {
    return new InvalidSymbolError(symbol);
  }

  static businessRuleViolation(rule: string, context?: string): BusinessRuleViolationError {
    return new BusinessRuleViolationError(rule, context);
  }
}
