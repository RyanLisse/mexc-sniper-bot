/**
 * Unit tests for utils
 * Tests utility functions for CSS class merging and logging
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cn, logger } from '../../../src/lib/utils';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../utils/timeout-elimination-helpers';

describe('cn (className utility)', () => {
  it('should merge class names correctly', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    const result = cn('foo', false && 'bar', 'baz');
    expect(result).toBe('foo baz');
  });

  it('should handle objects with boolean values', () => {
    const result = cn('foo', { bar: true, baz: false });
    expect(result).toBe('foo bar');
  });

  it('should handle arrays of classes', () => {
    const result = cn(['foo', 'bar'], 'baz');
    expect(result).toBe('foo bar baz');
  });

  it('should handle empty inputs', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('should handle null and undefined', () => {
    const result = cn('foo', null, undefined, 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle Tailwind CSS conflicting classes', () => {
    // twMerge should resolve conflicts like padding classes
    const result = cn('p-4', 'p-6');
    expect(result).toBe('p-6'); // Later class should override
  });

  it('should handle complex class combinations', () => {
    const result = cn(
      'text-center',
      'bg-red-500',
      { 'text-white': true, 'font-bold': false },
      ['hover:bg-red-600', 'transition-colors']
    );
    expect(result).toBe('text-center bg-red-500 text-white hover:bg-red-600 transition-colors');
  });
});

describe('logger', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();
    vi.restoreAllMocks();
  
  });

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('Test info message');
      
      expect(consoleSpy.log).toHaveBeenCalledWith('[INFO] Test info message');
    });

    it('should log info messages with additional arguments', () => {
      logger.info('Test info message', { key: 'value' }, 123);
      
      expect(consoleSpy.log).toHaveBeenCalledWith('[INFO] Test info message', { key: 'value' }, 123);
    });

    it('should handle empty additional arguments', () => {
      logger.info('Test info message');
      
      expect(consoleSpy.log).toHaveBeenCalledWith('[INFO] Test info message');
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      logger.warn('Test warning message');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN] Test warning message');
    });

    it('should log warning messages with additional arguments', () => {
      logger.warn('Test warning message', { error: 'details' });
      
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN] Test warning message', { error: 'details' });
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      logger.error('Test error message');
      
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR] Test error message');
    });

    it('should log error messages with additional arguments', () => {
      const errorObj = new Error('Test error');
      logger.error('Test error message', errorObj, { context: 'test' });
      
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR] Test error message', errorObj, { context: 'test' });
    });
  });

  describe('debug', () => {
    it('should log debug messages', () => {
      logger.debug('Test debug message');
      
      expect(consoleSpy.debug).toHaveBeenCalledWith('[DEBUG] Test debug message');
    });

    it('should log debug messages with additional arguments', () => {
      logger.debug('Test debug message', { debugInfo: 'value' });
      
      expect(consoleSpy.debug).toHaveBeenCalledWith('[DEBUG] Test debug message', { debugInfo: 'value' });
    });
  });

  describe('logger methods integration', () => {
    it('should support all log levels', () => {
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      logger.debug('Debug message');
      
      expect(consoleSpy.log).toHaveBeenCalledWith('[INFO] Info message');
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN] Warning message');
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR] Error message');
      expect(consoleSpy.debug).toHaveBeenCalledWith('[DEBUG] Debug message');
    });

    it('should handle special characters in messages', () => {
      logger.info('Message with special chars: %s %d %o', 'test', 123, {});
      
      expect(consoleSpy.log).toHaveBeenCalledWith('[INFO] Message with special chars: %s %d %o', 'test', 123, {});
    });

    it('should handle undefined and null arguments', () => {
      logger.info('Test message', undefined, null);
      
      expect(consoleSpy.log).toHaveBeenCalledWith('[INFO] Test message', undefined, null);
    });
  });
});