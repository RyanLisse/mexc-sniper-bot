/**
 * Unit tests for Trading Domain Errors
 * Tests all trading error classes, factory methods, and error handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TradingDomainError,
  InvalidTradeParametersError,
  InsufficientBalanceError,
  OrderExecutionError,
  InvalidOrderStateError,
  PositionNotFoundError,
  PositionAlreadyClosedError,
  InvalidPositionSizeError,
  StrategyNotFoundError,
  StrategyValidationError,
  StrategyConfigurationError,
  StrategyExecutionError,
  RiskLimitExceededError,
  CircuitBreakerActiveError,
  UnsafeMarketConditionsError,
  AutoSnipeTargetNotFoundError,
  InsufficientConfidenceError,
  AutoSnipeExecutionError,
  InvalidSymbolError,
  MarketDataUnavailableError,
  StaleMarketDataError,
  OrderAlreadyProcessingError,
  ConcurrentModificationError,
  DomainValidationError,
  BusinessRuleViolationError,
  TradingErrorFactory,
} from '../../../../src/domain/errors/trading-errors';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';

describe('Trading Domain Errors', () => {
  let testTimestamp: Date;

  beforeEach(() => {
    testTimestamp = new Date();
  });

  describe('Base TradingDomainError', () => {
    it('should create concrete error classes that extend TradingDomainError', () => {
      const error = new InvalidTradeParametersError('quantity', 'must be positive');
      
      expect(error).toBeInstanceOf(TradingDomainError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('InvalidTradeParametersError');
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.errorCode).toBe('INVALID_TRADE_PARAMETERS');
    });

    it('should set timestamp when error is created', () => {
      const beforeCreate = Date.now();
      const error = new DomainValidationError('field', 'value', 'constraint');
      const afterCreate = Date.now();
      
      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreate);
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(afterCreate);
    });
  });

  describe('Trade Execution Errors', () => {
    it('should create InvalidTradeParametersError with correct details', () => {
      const error = new InvalidTradeParametersError('quantity', 'must be positive');
      
      expect(error.errorCode).toBe('INVALID_TRADE_PARAMETERS');
      expect(error.message).toBe("Invalid trade parameter 'quantity': must be positive");
    });

    it('should create InsufficientBalanceError with correct details', () => {
      const error = new InsufficientBalanceError(1000, 500, 'USDT');
      
      expect(error.errorCode).toBe('INSUFFICIENT_BALANCE');
      expect(error.message).toBe('Insufficient USDT balance. Required: 1000, Available: 500');
    });

    it('should create OrderExecutionError with reason only', () => {
      const error = new OrderExecutionError('Market closed');
      
      expect(error.errorCode).toBe('ORDER_EXECUTION_ERROR');
      expect(error.message).toBe('Order execution failed: Market closed');
    });

    it('should create OrderExecutionError with exchange error', () => {
      const error = new OrderExecutionError('Insufficient liquidity', 'MEXC: LOW_LIQUIDITY');
      
      expect(error.errorCode).toBe('ORDER_EXECUTION_ERROR');
      expect(error.message).toBe('Order execution failed: Insufficient liquidity (Exchange: MEXC: LOW_LIQUIDITY)');
    });

    it('should create InvalidOrderStateError with correct details', () => {
      const error = new InvalidOrderStateError('FILLED', 'cancel');
      
      expect(error.errorCode).toBe('INVALID_ORDER_STATE');
      expect(error.message).toBe("Cannot perform 'cancel' on order in 'FILLED' state");
    });
  });

  describe('Position Management Errors', () => {
    it('should create PositionNotFoundError', () => {
      const error = new PositionNotFoundError('pos-123');
      
      expect(error.errorCode).toBe('POSITION_NOT_FOUND');
      expect(error.message).toBe("Position with ID 'pos-123' not found");
    });

    it('should create PositionAlreadyClosedError', () => {
      const error = new PositionAlreadyClosedError('pos-456');
      
      expect(error.errorCode).toBe('POSITION_ALREADY_CLOSED');
      expect(error.message).toBe("Position 'pos-456' is already closed");
    });

    it('should create InvalidPositionSizeError', () => {
      const error = new InvalidPositionSizeError(-100, 'size cannot be negative');
      
      expect(error.errorCode).toBe('INVALID_POSITION_SIZE');
      expect(error.message).toBe('Invalid position size -100: size cannot be negative');
    });
  });

  describe('Strategy Errors', () => {
    it('should create StrategyNotFoundError', () => {
      const error = new StrategyNotFoundError('strategy-789');
      
      expect(error.errorCode).toBe('STRATEGY_NOT_FOUND');
      expect(error.message).toBe("Strategy with ID 'strategy-789' not found");
    });

    it('should create StrategyValidationError', () => {
      const error = new StrategyValidationError('stopLoss', 'must be greater than zero');
      
      expect(error.errorCode).toBe('STRATEGY_VALIDATION_ERROR');
      expect(error.message).toBe("Strategy validation failed for 'stopLoss': must be greater than zero");
    });

    it('should create StrategyConfigurationError', () => {
      const error = new StrategyConfigurationError('Invalid parameter combination');
      
      expect(error.errorCode).toBe('STRATEGY_CONFIGURATION_ERROR');
      expect(error.message).toBe('Strategy configuration error: Invalid parameter combination');
    });

    it('should create StrategyExecutionError', () => {
      const error = new StrategyExecutionError('MeanReversion', 'Unable to calculate indicators');
      
      expect(error.errorCode).toBe('STRATEGY_EXECUTION_ERROR');
      expect(error.message).toBe("Strategy 'MeanReversion' execution failed: Unable to calculate indicators");
    });
  });

  describe('Risk Management Errors', () => {
    it('should create RiskLimitExceededError', () => {
      const error = new RiskLimitExceededError('Daily Loss', 5000, 3000);
      
      expect(error.errorCode).toBe('RISK_LIMIT_EXCEEDED');
      expect(error.message).toBe('Daily Loss limit exceeded. Current: 5000, Limit: 3000');
    });

    it('should create CircuitBreakerActiveError', () => {
      const resetTime = new Date('2024-01-01T12:00:00Z');
      const error = new CircuitBreakerActiveError(resetTime);
      
      expect(error.errorCode).toBe('CIRCUIT_BREAKER_ACTIVE');
      expect(error.message).toBe('Circuit breaker is active until 2024-01-01T12:00:00.000Z');
    });

    it('should create UnsafeMarketConditionsError', () => {
      const error = new UnsafeMarketConditionsError('High volatility detected');
      
      expect(error.errorCode).toBe('UNSAFE_MARKET_CONDITIONS');
      expect(error.message).toBe('Trading blocked due to unsafe market conditions: High volatility detected');
    });
  });

  describe('Auto-Sniping Errors', () => {
    it('should create AutoSnipeTargetNotFoundError', () => {
      const error = new AutoSnipeTargetNotFoundError(42);
      
      expect(error.errorCode).toBe('AUTO_SNIPE_TARGET_NOT_FOUND');
      expect(error.message).toBe("Auto-snipe target with ID '42' not found");
    });

    it('should create InsufficientConfidenceError', () => {
      const error = new InsufficientConfidenceError(75, 85);
      
      expect(error.errorCode).toBe('INSUFFICIENT_CONFIDENCE');
      expect(error.message).toBe('Confidence score 75% below required threshold 85%');
    });

    it('should create AutoSnipeExecutionError', () => {
      const error = new AutoSnipeExecutionError('BTCUSDT', 'Price moved beyond threshold');
      
      expect(error.errorCode).toBe('AUTO_SNIPE_EXECUTION_ERROR');
      expect(error.message).toBe('Auto-snipe execution failed for BTCUSDT: Price moved beyond threshold');
    });
  });

  describe('Market Data Errors', () => {
    it('should create InvalidSymbolError', () => {
      const error = new InvalidSymbolError('INVALIDPAIR');
      
      expect(error.errorCode).toBe('INVALID_SYMBOL');
      expect(error.message).toBe('Invalid or unsupported symbol: INVALIDPAIR');
    });

    it('should create MarketDataUnavailableError', () => {
      const error = new MarketDataUnavailableError('BTCUSDT', 'orderbook');
      
      expect(error.errorCode).toBe('MARKET_DATA_UNAVAILABLE');
      expect(error.message).toBe('orderbook data unavailable for symbol BTCUSDT');
    });

    it('should create StaleMarketDataError', () => {
      const lastUpdate = new Date('2024-01-01T10:00:00Z');
      const error = new StaleMarketDataError('ETHUSDT', lastUpdate, 30000);
      
      expect(error.errorCode).toBe('STALE_MARKET_DATA');
      expect(error.message).toBe('Market data for ETHUSDT is stale. Last update: 2024-01-01T10:00:00.000Z, Max age: 30000ms');
    });
  });

  describe('Concurrency Errors', () => {
    it('should create OrderAlreadyProcessingError', () => {
      const error = new OrderAlreadyProcessingError('order-123');
      
      expect(error.errorCode).toBe('ORDER_ALREADY_PROCESSING');
      expect(error.message).toBe("Order 'order-123' is already being processed");
    });

    it('should create ConcurrentModificationError', () => {
      const error = new ConcurrentModificationError('Position', 'pos-456');
      
      expect(error.errorCode).toBe('CONCURRENT_MODIFICATION_ERROR');
      expect(error.message).toBe("Concurrent modification detected for Position 'pos-456'");
    });
  });

  describe('Validation Errors', () => {
    it('should create DomainValidationError', () => {
      const error = new DomainValidationError('price', -10, 'must be positive');
      
      expect(error.errorCode).toBe('DOMAIN_VALIDATION_ERROR');
      expect(error.message).toBe("Validation failed for 'price' with value '-10': must be positive");
    });

    it('should create BusinessRuleViolationError without context', () => {
      const error = new BusinessRuleViolationError('Maximum 5 open positions allowed');
      
      expect(error.errorCode).toBe('BUSINESS_RULE_VIOLATION');
      expect(error.message).toBe('Business rule violation: Maximum 5 open positions allowed');
    });

    it('should create BusinessRuleViolationError with context', () => {
      const error = new BusinessRuleViolationError('Position size exceeds limit', 'Portfolio: aggressive');
      
      expect(error.errorCode).toBe('BUSINESS_RULE_VIOLATION');
      expect(error.message).toBe('Business rule violation: Position size exceeds limit (Context: Portfolio: aggressive)');
    });
  });

  describe('TradingErrorFactory', () => {
    it('should create InvalidTradeParametersError through factory', () => {
      const error = TradingErrorFactory.invalidTradeParameters('side', 'must be BUY or SELL');
      
      expect(error).toBeInstanceOf(InvalidTradeParametersError);
      expect(error.errorCode).toBe('INVALID_TRADE_PARAMETERS');
      expect(error.message).toBe("Invalid trade parameter 'side': must be BUY or SELL");
    });

    it('should create InsufficientBalanceError through factory', () => {
      const error = TradingErrorFactory.insufficientBalance(2000, 1500, 'BTC');
      
      expect(error).toBeInstanceOf(InsufficientBalanceError);
      expect(error.errorCode).toBe('INSUFFICIENT_BALANCE');
      expect(error.message).toBe('Insufficient BTC balance. Required: 2000, Available: 1500');
    });

    it('should create OrderExecutionError through factory without exchange error', () => {
      const error = TradingErrorFactory.orderExecutionFailed('Network timeout');
      
      expect(error).toBeInstanceOf(OrderExecutionError);
      expect(error.message).toBe('Order execution failed: Network timeout');
    });

    it('should create OrderExecutionError through factory with exchange error', () => {
      const error = TradingErrorFactory.orderExecutionFailed('Rate limit', 'MEXC: TOO_MANY_REQUESTS');
      
      expect(error).toBeInstanceOf(OrderExecutionError);
      expect(error.message).toBe('Order execution failed: Rate limit (Exchange: MEXC: TOO_MANY_REQUESTS)');
    });

    it('should create PositionNotFoundError through factory', () => {
      const error = TradingErrorFactory.positionNotFound('pos-999');
      
      expect(error).toBeInstanceOf(PositionNotFoundError);
      expect(error.message).toBe("Position with ID 'pos-999' not found");
    });

    it('should create StrategyNotFoundError through factory', () => {
      const error = TradingErrorFactory.strategyNotFound('strat-888');
      
      expect(error).toBeInstanceOf(StrategyNotFoundError);
      expect(error.message).toBe("Strategy with ID 'strat-888' not found");
    });

    it('should create RiskLimitExceededError through factory', () => {
      const error = TradingErrorFactory.riskLimitExceeded('Portfolio Risk', 85, 80);
      
      expect(error).toBeInstanceOf(RiskLimitExceededError);
      expect(error.message).toBe('Portfolio Risk limit exceeded. Current: 85, Limit: 80');
    });

    it('should create AutoSnipeTargetNotFoundError through factory', () => {
      const error = TradingErrorFactory.autoSnipeTargetNotFound(777);
      
      expect(error).toBeInstanceOf(AutoSnipeTargetNotFoundError);
      expect(error.message).toBe("Auto-snipe target with ID '777' not found");
    });

    it('should create InsufficientConfidenceError through factory', () => {
      const error = TradingErrorFactory.insufficientConfidence(60, 70);
      
      expect(error).toBeInstanceOf(InsufficientConfidenceError);
      expect(error.message).toBe('Confidence score 60% below required threshold 70%');
    });

    it('should create InvalidSymbolError through factory', () => {
      const error = TradingErrorFactory.invalidSymbol('FAKECOIN');
      
      expect(error).toBeInstanceOf(InvalidSymbolError);
      expect(error.message).toBe('Invalid or unsupported symbol: FAKECOIN');
    });

    it('should create BusinessRuleViolationError through factory without context', () => {
      const error = TradingErrorFactory.businessRuleViolation('Cannot trade during maintenance');
      
      expect(error).toBeInstanceOf(BusinessRuleViolationError);
      expect(error.message).toBe('Business rule violation: Cannot trade during maintenance');
    });

    it('should create BusinessRuleViolationError through factory with context', () => {
      const error = TradingErrorFactory.businessRuleViolation('Exceeds daily trade limit', 'User: premium');
      
      expect(error).toBeInstanceOf(BusinessRuleViolationError);
      expect(error.message).toBe('Business rule violation: Exceeds daily trade limit (Context: User: premium)');
    });
  });

  describe('Error Properties and Inheritance', () => {
    it('should have consistent error properties across all error types', () => {
      const errors = [
        new InvalidTradeParametersError('param', 'reason'),
        new InsufficientBalanceError(100, 50, 'ETH'),
        new OrderExecutionError('failed'),
        new PositionNotFoundError('pos-1'),
        new StrategyValidationError('field', 'reason'),
        new RiskLimitExceededError('type', 100, 50),
        new AutoSnipeTargetNotFoundError(1),
        new InvalidSymbolError('SYMBOL'),
        new DomainValidationError('field', 'value', 'constraint'),
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(TradingDomainError);
        expect(error).toBeInstanceOf(Error);
        expect(error.errorCode).toBeDefined();
        expect(typeof error.errorCode).toBe('string');
        expect(error.errorCode.length).toBeGreaterThan(0);
        expect(error.timestamp).toBeInstanceOf(Date);
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
        expect(error.name).toBe(error.constructor.name);
      });
    });

    it('should have unique error codes for each error type', () => {
      const errorCodes = [
        new InvalidTradeParametersError('', '').errorCode,
        new InsufficientBalanceError(0, 0, '').errorCode,
        new OrderExecutionError('').errorCode,
        new InvalidOrderStateError('', '').errorCode,
        new PositionNotFoundError('').errorCode,
        new PositionAlreadyClosedError('').errorCode,
        new InvalidPositionSizeError(0, '').errorCode,
        new StrategyNotFoundError('').errorCode,
        new StrategyValidationError('', '').errorCode,
        new StrategyConfigurationError('').errorCode,
        new StrategyExecutionError('', '').errorCode,
        new RiskLimitExceededError('', 0, 0).errorCode,
        new CircuitBreakerActiveError(new Date()).errorCode,
        new UnsafeMarketConditionsError('').errorCode,
        new AutoSnipeTargetNotFoundError(0).errorCode,
        new InsufficientConfidenceError(0, 0).errorCode,
        new AutoSnipeExecutionError('', '').errorCode,
        new InvalidSymbolError('').errorCode,
        new MarketDataUnavailableError('', '').errorCode,
        new StaleMarketDataError('', new Date(), 0).errorCode,
        new OrderAlreadyProcessingError('').errorCode,
        new ConcurrentModificationError('', '').errorCode,
        new DomainValidationError('', '', '').errorCode,
        new BusinessRuleViolationError('').errorCode,
      ];

      const uniqueCodes = new Set(errorCodes);
      expect(uniqueCodes.size).toBe(errorCodes.length); // All codes should be unique
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string parameters gracefully', () => {
      const error1 = new InvalidTradeParametersError('', '');
      const error2 = new StrategyNotFoundError('');
      const error3 = new InvalidSymbolError('');

      expect(error1.message).toContain("''");
      expect(error2.message).toContain("''");
      expect(error3.message).toContain('');
    });

    it('should handle special characters in parameters', () => {
      const specialChars = '!@#$%^&*()_+{}[]|:";\'<>?,./';
      const error = new StrategyNotFoundError(specialChars);
      
      expect(error.message).toContain(specialChars);
    });

    it('should handle very long parameters', () => {
      const longString = 'a'.repeat(1000);
      const error = new PositionNotFoundError(longString);
      
      expect(error.message).toContain(longString);
      expect(error.message.length).toBeGreaterThan(1000);
    });

    it('should handle numeric edge cases', () => {
      const error1 = new InsufficientBalanceError(Infinity, -Infinity, 'TEST');
      const error2 = new RiskLimitExceededError('Test', NaN, 0);
      const error3 = new InsufficientConfidenceError(-100, 200);

      expect(error1.message).toContain('Infinity');
      expect(error2.message).toContain('NaN');
      expect(error3.message).toContain('-100');
    });

    it('should handle Date edge cases', () => {
      const invalidDate = new Date('invalid');
      const futureDate = new Date('9999-12-31');
      const pastDate = new Date('1970-01-01');

      const error1 = new CircuitBreakerActiveError(invalidDate);
      const error2 = new CircuitBreakerActiveError(futureDate);
      const error3 = new StaleMarketDataError('BTC', pastDate, 1000);

      expect(error1.message).toBeDefined();
      expect(error2.message).toBeDefined();
      expect(error3.message).toBeDefined();
    });
  });

  describe('Performance Tests', () => {
    it('should create errors efficiently', () => {
      const startTime = Date.now();
      const errorCount = 1000;

      for (let i = 0; i < errorCount; i++) {
        new InvalidTradeParametersError(`param${i}`, `reason${i}`);
        new InsufficientBalanceError(i, i / 2, 'TOKEN');
        new PositionNotFoundError(`pos-${i}`);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200); // Should create 3000 errors in under 200ms
    });

    it('should create errors through factory efficiently', () => {
      const startTime = Date.now();
      const errorCount = 1000;

      for (let i = 0; i < errorCount; i++) {
        TradingErrorFactory.invalidTradeParameters(`param${i}`, `reason${i}`);
        TradingErrorFactory.insufficientBalance(i, i / 2, 'TOKEN');
        TradingErrorFactory.positionNotFound(`pos-${i}`);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200); // Should create 3000 errors through factory in under 200ms
    });
  });
});