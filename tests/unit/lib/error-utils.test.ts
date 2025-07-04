/**
 * Unit tests for error-utils
 * Tests custom error classes, error classification, retry logic, and error collection
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ValidationError,
  AuthError,
  RateLimitError,
  ErrorClassifier,
  RetryHandler,
  ErrorCollector,
  getErrorMessage,
  formatErrorForDisplay,
  createSafeError,
} from '../../../src/lib/error-utils';

describe('ValidationError', () => {
  it('should create validation error with message', () => {
    const error = new ValidationError('Invalid input');
    
    expect(error.message).toBe('Invalid input');
    expect(error.name).toBe('ValidationError');
    expect(error.field).toBeUndefined();
    expect(error instanceof Error).toBe(true);
  });

  it('should create validation error with field', () => {
    const error = new ValidationError('Invalid email format', 'email');
    
    expect(error.message).toBe('Invalid email format');
    expect(error.name).toBe('ValidationError');
    expect(error.field).toBe('email');
  });
});

describe('AuthError', () => {
  it('should create auth error with message', () => {
    const error = new AuthError('Unauthorized access');
    
    expect(error.message).toBe('Unauthorized access');
    expect(error.name).toBe('AuthError');
    expect(error instanceof Error).toBe(true);
  });
});

describe('RateLimitError', () => {
  it('should create rate limit error with message', () => {
    const error = new RateLimitError('Too many requests');
    
    expect(error.message).toBe('Too many requests');
    expect(error.name).toBe('RateLimitError');
    expect(error.retryAfter).toBeUndefined();
    expect(error instanceof Error).toBe(true);
  });

  it('should create rate limit error with retry after', () => {
    const error = new RateLimitError('Too many requests', 60);
    
    expect(error.message).toBe('Too many requests');
    expect(error.name).toBe('RateLimitError');
    expect(error.retryAfter).toBe(60);
  });
});

describe('ErrorClassifier', () => {
  describe('isTimeout', () => {
    it('should detect timeout errors', () => {
      const abortError = new Error('Operation aborted');
      abortError.name = 'AbortError';
      
      const timeoutError = new Error('Request timeout');
      const timedOutError = new Error('Connection timed out');
      
      expect(ErrorClassifier.isTimeout(abortError)).toBe(true);
      expect(ErrorClassifier.isTimeout(timeoutError)).toBe(true);
      expect(ErrorClassifier.isTimeout(timedOutError)).toBe(true);
    });

    it('should not detect non-timeout errors', () => {
      const normalError = new Error('Something went wrong');
      const notError = 'string error';
      
      expect(ErrorClassifier.isTimeout(normalError)).toBe(false);
      expect(ErrorClassifier.isTimeout(notError)).toBe(false);
      expect(ErrorClassifier.isTimeout(null)).toBe(false);
    });
  });

  describe('isConnection', () => {
    it('should detect connection errors', () => {
      const fetchError = new Error('fetch failed');
      const resetError = new Error('ECONNRESET');
      const notFoundError = new Error('ENOTFOUND');
      const timeoutError = new Error('ETIMEDOUT');
      const refusedError = new Error('ECONNREFUSED');
      const networkError = new Error('network error');
      
      expect(ErrorClassifier.isConnection(fetchError)).toBe(true);
      expect(ErrorClassifier.isConnection(resetError)).toBe(true);
      expect(ErrorClassifier.isConnection(notFoundError)).toBe(true);
      expect(ErrorClassifier.isConnection(timeoutError)).toBe(true);
      expect(ErrorClassifier.isConnection(refusedError)).toBe(true);
      expect(ErrorClassifier.isConnection(networkError)).toBe(true);
    });

    it('should not detect non-connection errors', () => {
      const normalError = new Error('Something went wrong');
      const notError = 'string error';
      
      expect(ErrorClassifier.isConnection(normalError)).toBe(false);
      expect(ErrorClassifier.isConnection(notError)).toBe(false);
      expect(ErrorClassifier.isConnection(null)).toBe(false);
    });
  });

  describe('isRetryable', () => {
    it('should detect retryable errors', () => {
      const timeoutError = new Error('timeout');
      const connectionError = new Error('ECONNRESET');
      
      expect(ErrorClassifier.isRetryable(timeoutError)).toBe(true);
      expect(ErrorClassifier.isRetryable(connectionError)).toBe(true);
    });

    it('should not detect non-retryable errors', () => {
      const authError = new AuthError('Unauthorized');
      const validationError = new ValidationError('Invalid input');
      
      expect(ErrorClassifier.isRetryable(authError)).toBe(false);
      expect(ErrorClassifier.isRetryable(validationError)).toBe(false);
    });
  });

  describe('isAuth', () => {
    it('should detect auth errors', () => {
      const authError = new AuthError('Unauthorized');
      const error401 = new Error('401 Unauthorized');
      const unauthorizedError = new Error('unauthorized access');
      const authenticationError = new Error('authentication failed');
      
      expect(ErrorClassifier.isAuth(authError)).toBe(true);
      expect(ErrorClassifier.isAuth(error401)).toBe(true);
      expect(ErrorClassifier.isAuth(unauthorizedError)).toBe(true);
      expect(ErrorClassifier.isAuth(authenticationError)).toBe(true);
    });

    it('should not detect non-auth errors', () => {
      const normalError = new Error('Something went wrong');
      const notError = 'string error';
      
      expect(ErrorClassifier.isAuth(normalError)).toBe(false);
      expect(ErrorClassifier.isAuth(notError)).toBe(false);
    });
  });

  describe('isRateLimit', () => {
    it('should detect rate limit errors', () => {
      const rateLimitError = new RateLimitError('Too many requests');
      const error429 = new Error('429 Too Many Requests');
      const rateLimitMessage = new Error('rate limit exceeded');
      const tooManyRequests = new Error('too many requests');
      
      expect(ErrorClassifier.isRateLimit(rateLimitError)).toBe(true);
      expect(ErrorClassifier.isRateLimit(error429)).toBe(true);
      expect(ErrorClassifier.isRateLimit(rateLimitMessage)).toBe(true);
      expect(ErrorClassifier.isRateLimit(tooManyRequests)).toBe(true);
    });

    it('should not detect non-rate-limit errors', () => {
      const normalError = new Error('Something went wrong');
      const notError = 'string error';
      
      expect(ErrorClassifier.isRateLimit(normalError)).toBe(false);
      expect(ErrorClassifier.isRateLimit(notError)).toBe(false);
    });
  });

  describe('isValidation', () => {
    it('should detect validation errors', () => {
      const validationError = new ValidationError('Invalid input');
      const error400 = new Error('400 Bad Request');
      const validationMessage = new Error('validation failed');
      const invalidMessage = new Error('invalid data');
      
      expect(ErrorClassifier.isValidation(validationError)).toBe(true);
      expect(ErrorClassifier.isValidation(error400)).toBe(true);
      expect(ErrorClassifier.isValidation(validationMessage)).toBe(true);
      expect(ErrorClassifier.isValidation(invalidMessage)).toBe(true);
    });

    it('should not detect non-validation errors', () => {
      const normalError = new Error('Something went wrong');
      const notError = 'string error';
      
      expect(ErrorClassifier.isValidation(normalError)).toBe(false);
      expect(ErrorClassifier.isValidation(notError)).toBe(false);
    });
  });

  describe('getErrorType', () => {
    it('should return correct error types', () => {
      expect(ErrorClassifier.getErrorType(new Error('timeout'))).toBe('timeout');
      expect(ErrorClassifier.getErrorType(new Error('ECONNRESET'))).toBe('connection');
      expect(ErrorClassifier.getErrorType(new AuthError('Unauthorized'))).toBe('auth');
      expect(ErrorClassifier.getErrorType(new RateLimitError('Too many requests'))).toBe('rate_limit');
      expect(ErrorClassifier.getErrorType(new ValidationError('Invalid input'))).toBe('validation');
      expect(ErrorClassifier.getErrorType(new Error('Something else'))).toBe('unknown');
    });
  });

  describe('getStatusCode', () => {
    it('should return correct status codes', () => {
      expect(ErrorClassifier.getStatusCode(new ValidationError('Invalid input'))).toBe(400);
      expect(ErrorClassifier.getStatusCode(new AuthError('Unauthorized'))).toBe(401);
      expect(ErrorClassifier.getStatusCode(new RateLimitError('Too many requests'))).toBe(429);
      expect(ErrorClassifier.getStatusCode(new Error('timeout'))).toBe(503);
      expect(ErrorClassifier.getStatusCode(new Error('ECONNRESET'))).toBe(503);
      expect(ErrorClassifier.getStatusCode(new Error('Unknown error'))).toBe(500);
    });
  });

  describe('shouldRetry', () => {
    it('should determine retry based on error type and attempt count', () => {
      const retryableError = new Error('timeout');
      const nonRetryableError = new AuthError('Unauthorized');
      
      expect(ErrorClassifier.shouldRetry(retryableError, 1, 3)).toBe(true);
      expect(ErrorClassifier.shouldRetry(retryableError, 3, 3)).toBe(false);
      expect(ErrorClassifier.shouldRetry(retryableError, 4, 3)).toBe(false);
      expect(ErrorClassifier.shouldRetry(nonRetryableError, 1, 3)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('should calculate exponential backoff with jitter', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      
      const delay1 = ErrorClassifier.getRetryDelay(1, 1000, 30000);
      const delay2 = ErrorClassifier.getRetryDelay(2, 1000, 30000);
      const delay3 = ErrorClassifier.getRetryDelay(3, 1000, 30000);
      
      expect(delay1).toBe(1500); // 1000 + 500 jitter
      expect(delay2).toBe(2500); // 2000 + 500 jitter
      expect(delay3).toBe(4500); // 4000 + 500 jitter
    });

    it('should not exceed max delay', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      
      const delay = ErrorClassifier.getRetryDelay(10, 1000, 5000);
      expect(delay).toBe(5000);
    });
  });
});

describe('RetryHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should succeed on first attempt', async () => {
    const operation = vi.fn().mockResolvedValue('success');
    
    const result = await RetryHandler.withRetry(operation, 3, 100);
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce('success');
    
    // Mock setTimeout to resolve immediately
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
      fn();
      return {} as any;
    });
    
    const result = await RetryHandler.withRetry(operation, 3, 100);
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should not retry on non-retryable errors', async () => {
    const operation = vi.fn().mockRejectedValue(new AuthError('Unauthorized'));
    
    await expect(RetryHandler.withRetry(operation, 3, 100)).rejects.toThrow('Unauthorized');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should throw last error after max retries', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('timeout'));
    
    // Mock setTimeout to resolve immediately
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
      fn();
      return {} as any;
    });
    
    await expect(RetryHandler.withRetry(operation, 2, 100)).rejects.toThrow('timeout');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

describe('ErrorCollector', () => {
  let collector: ErrorCollector;

  beforeEach(() => {
    collector = new ErrorCollector();
  });

  describe('add', () => {
    it('should add error without field', () => {
      collector.add('General error');
      
      expect(collector.hasErrors()).toBe(true);
      expect(collector.getErrors()).toEqual({
        general: ['General error']
      });
    });

    it('should add error with field', () => {
      collector.add('Invalid email', 'email');
      
      expect(collector.hasErrors()).toBe(true);
      expect(collector.getErrors()).toEqual({
        email: ['Invalid email']
      });
    });

    it('should group errors by field', () => {
      collector.add('Invalid email format', 'email');
      collector.add('Email already exists', 'email');
      collector.add('Password too short', 'password');
      
      expect(collector.getErrors()).toEqual({
        email: ['Invalid email format', 'Email already exists'],
        password: ['Password too short']
      });
    });
  });

  describe('hasErrors', () => {
    it('should return false when no errors', () => {
      expect(collector.hasErrors()).toBe(false);
    });

    it('should return true when errors exist', () => {
      collector.add('Error');
      expect(collector.hasErrors()).toBe(true);
    });
  });

  describe('getFirstError', () => {
    it('should return null when no errors', () => {
      expect(collector.getFirstError()).toBeNull();
    });

    it('should return first error message', () => {
      collector.add('First error');
      collector.add('Second error');
      
      expect(collector.getFirstError()).toBe('First error');
    });
  });

  describe('throwIfErrors', () => {
    it('should not throw when no errors', () => {
      expect(() => collector.throwIfErrors()).not.toThrow();
    });

    it('should throw validation error when errors exist', () => {
      collector.add('Validation failed');
      
      expect(() => collector.throwIfErrors()).toThrow(ValidationError);
      expect(() => collector.throwIfErrors()).toThrow('Validation failed');
    });
  });
});

describe('getErrorMessage', () => {
  it('should return error message for Error instances', () => {
    const error = new Error('Test error');
    expect(getErrorMessage(error)).toBe('Test error');
  });

  it('should return string for string errors', () => {
    expect(getErrorMessage('String error')).toBe('String error');
  });

  it('should extract message from objects with message property', () => {
    const error = { message: 'Object error' };
    expect(getErrorMessage(error)).toBe('Object error');
  });

  it('should extract error from objects with error property', () => {
    const error = { error: 'Object error' };
    expect(getErrorMessage(error)).toBe('Object error');
  });

  it('should stringify objects without message or error property', () => {
    const error = { code: 500, status: 'failed' };
    expect(getErrorMessage(error)).toBe('{"code":500,"status":"failed"}');
  });

  it('should handle circular references in objects', () => {
    const error: any = { message: 'Test' };
    error.circular = error;
    
    // The function should extract the message since it has one, even with circular refs
    expect(getErrorMessage(error)).toBe('Test');
  });

  it('should handle circular references in objects without message property', () => {
    const error: any = { code: 500 };
    error.circular = error;
    
    // This should cause JSON.stringify to fail and return fallback
    expect(getErrorMessage(error)).toBe('An error occurred');
  });

  it('should handle null and undefined', () => {
    expect(getErrorMessage(null)).toBe('An unknown error occurred');
    expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
  });

  it('should handle primitive values', () => {
    expect(getErrorMessage(42)).toBe('An unknown error occurred');
    expect(getErrorMessage(true)).toBe('An unknown error occurred');
  });
});

describe('formatErrorForDisplay', () => {
  it('should format error without context', () => {
    const error = new Error('Test error');
    expect(formatErrorForDisplay(error)).toBe('Test error');
  });

  it('should format error with context', () => {
    const error = new Error('Test error');
    expect(formatErrorForDisplay(error, 'API call')).toBe('API call: Test error');
  });

  it('should handle complex error types', () => {
    const error = { message: 'Complex error' };
    expect(formatErrorForDisplay(error, 'Database')).toBe('Database: Complex error');
  });
});

describe('createSafeError', () => {
  it('should create safe error from Error instance', () => {
    const error = new Error('Test error');
    const safeError = createSafeError(error);
    
    expect(safeError).toEqual({
      message: 'Test error',
      type: 'Error'
    });
  });

  it('should create safe error from custom error class', () => {
    const error = new ValidationError('Invalid input');
    const safeError = createSafeError(error);
    
    expect(safeError).toEqual({
      message: 'Invalid input',
      type: 'ValidationError'
    });
  });

  it('should create safe error from string', () => {
    const safeError = createSafeError('String error');
    
    expect(safeError).toEqual({
      message: 'String error',
      type: 'string'
    });
  });

  it('should create safe error from object', () => {
    const error = { message: 'Object error' };
    const safeError = createSafeError(error);
    
    expect(safeError).toEqual({
      message: 'Object error',
      type: 'object'
    });
  });
});