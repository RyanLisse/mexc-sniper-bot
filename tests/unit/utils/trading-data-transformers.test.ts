/**
 * Unit tests for trading-data-transformers
 * Tests trading data transformation and validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeVcoinId,
  validateTradingTarget,
  transformTradingTarget,
  safeGetProperty,
} from '../../../src/utils/trading-data-transformers';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../utils/timeout-elimination-helpers';

describe('normalizeVcoinId', () => {
  it('should convert string to string', () => {
    expect(normalizeVcoinId('123')).toBe('123');
    expect(normalizeVcoinId('abc')).toBe('abc');
    expect(normalizeVcoinId('vcoin-123')).toBe('vcoin-123');
  });

  it('should convert number to string', () => {
    expect(normalizeVcoinId(123)).toBe('123');
    expect(normalizeVcoinId(0)).toBe('0');
    expect(normalizeVcoinId(-1)).toBe('-1');
    expect(normalizeVcoinId(123.45)).toBe('123.45');
  });

  it('should handle edge cases', () => {
    expect(normalizeVcoinId('')).toBe('');
    expect(normalizeVcoinId(NaN)).toBe('NaN');
    expect(normalizeVcoinId(Infinity)).toBe('Infinity');
  });
});

describe('validateTradingTarget', () => {
  it('should validate valid trading targets with vcoinId and symbolName', () => {
    const validTarget = {
      vcoinId: '123',
      symbolName: 'BTCUSDT',
    };

    expect(validateTradingTarget(validTarget)).toBe(true);
  });

  it('should validate valid trading targets with id and symbol', () => {
    const validTarget = {
      id: 456,
      symbol: 'ETHUSDT',
    };

    expect(validateTradingTarget(validTarget)).toBe(true);
  });

  it('should validate mixed property names', () => {
    const validTarget = {
      vcoinId: '123',
      symbol: 'BTCUSDT',
    };

    expect(validateTradingTarget(validTarget)).toBe(true);
  });

  it('should validate targets with additional properties', () => {
    const validTarget = {
      vcoinId: '123',
      symbolName: 'BTCUSDT',
      listingDate: '2024-01-01',
      isReady: true,
      extraProperty: 'extra value',
    };

    expect(validateTradingTarget(validTarget)).toBe(true);
  });

  it('should reject targets missing required properties', () => {
    expect(validateTradingTarget({ symbolName: 'BTCUSDT' })).toBe(false);
    expect(validateTradingTarget({ vcoinId: '123' })).toBe(false);
    expect(validateTradingTarget({})).toBe(false);
  });

  it('should reject null and undefined values for required properties', () => {
    expect(validateTradingTarget({
      vcoinId: null,
      symbolName: 'BTCUSDT',
    })).toBe(false);

    expect(validateTradingTarget({
      vcoinId: '123',
      symbolName: null,
    })).toBe(false);

    expect(validateTradingTarget({
      vcoinId: undefined,
      symbolName: 'BTCUSDT',
    })).toBe(false);
  });

  it('should reject non-object inputs', () => {
    expect(validateTradingTarget(null)).toBe(false);
    expect(validateTradingTarget(undefined)).toBe(false);
    expect(validateTradingTarget('string')).toBe(false);
    expect(validateTradingTarget(123)).toBe(false);
    expect(validateTradingTarget([])).toBe(false);
    expect(validateTradingTarget(true)).toBe(false);
  });

  it('should handle zero values as valid', () => {
    const validTarget = {
      vcoinId: 0,
      symbolName: '',
    };

    expect(validateTradingTarget(validTarget)).toBe(true);
  });
});

describe('transformTradingTarget', () => {
  it('should transform target with vcoinId and symbolName', () => {
    const rawTarget = {
      vcoinId: '123',
      symbolName: 'BTCUSDT',
      listingDate: '2024-01-01',
      isReady: true,
    };

    const result = transformTradingTarget(rawTarget);

    expect(result).toEqual({
      vcoinId: '123',
      symbolName: 'BTCUSDT',
      listingDate: '2024-01-01',
      isReady: true,
    });
  });

  it('should transform target with id and symbol', () => {
    const rawTarget = {
      id: 456,
      symbol: 'ETHUSDT',
      listing_date: '2024-02-01',
      is_ready: false,
    };

    const result = transformTradingTarget(rawTarget);

    expect(result).toEqual({
      vcoinId: '456',
      symbolName: 'ETHUSDT',
      listingDate: '2024-02-01',
      isReady: false,
    });
  });

  it('should prefer vcoinId over id', () => {
    const rawTarget = {
      vcoinId: '123',
      id: '456',
      symbolName: 'BTCUSDT',
    };

    const result = transformTradingTarget(rawTarget);

    expect(result.vcoinId).toBe('123');
  });

  it('should prefer symbolName over symbol', () => {
    const rawTarget = {
      vcoinId: '123',
      symbolName: 'BTCUSDT',
      symbol: 'ETHUSDT',
    };

    const result = transformTradingTarget(rawTarget);

    expect(result.symbolName).toBe('BTCUSDT');
  });

  it('should prefer listingDate over listing_date', () => {
    const rawTarget = {
      vcoinId: '123',
      symbolName: 'BTCUSDT',
      listingDate: '2024-01-01',
      listing_date: '2024-02-01',
    };

    const result = transformTradingTarget(rawTarget);

    expect(result.listingDate).toBe('2024-01-01');
  });

  it('should prefer isReady over is_ready', () => {
    const rawTarget = {
      vcoinId: '123',
      symbolName: 'BTCUSDT',
      isReady: true,
      is_ready: false,
    };

    const result = transformTradingTarget(rawTarget);

    expect(result.isReady).toBe(true);
  });

  it('should handle missing optional properties', () => {
    const rawTarget = {
      vcoinId: '123',
      symbolName: 'BTCUSDT',
    };

    const result = transformTradingTarget(rawTarget);

    expect(result).toEqual({
      vcoinId: '123',
      symbolName: 'BTCUSDT',
      listingDate: undefined,
      isReady: false,
    });
  });

  it('should handle empty or falsy values', () => {
    const rawTarget = {
      vcoinId: '',
      id: '456',
      symbolName: '',
      symbol: 'BTCUSDT',
      listingDate: '',
      isReady: false,
    };

    const result = transformTradingTarget(rawTarget);

    expect(result).toEqual({
      vcoinId: '456', // Falls back to id when vcoinId is empty
      symbolName: 'BTCUSDT', // Falls back to symbol when symbolName is empty
      listingDate: '',
      isReady: false,
    });
  });

  it('should convert numeric vcoinId to string', () => {
    const rawTarget = {
      vcoinId: 123,
      symbolName: 'BTCUSDT',
    };

    const result = transformTradingTarget(rawTarget);

    expect(result.vcoinId).toBe('123');
    expect(typeof result.vcoinId).toBe('string');
  });

  it('should convert truthy values to boolean for isReady', () => {
    const cases = [
      { input: 1, expected: true },
      { input: 'true', expected: true },
      { input: 'yes', expected: true },
      { input: {}, expected: true },
      { input: [], expected: true },
      { input: 0, expected: false },
      { input: '', expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
    ];

    cases.forEach(({ input, expected }) => {
      const rawTarget = {
        vcoinId: '123',
        symbolName: 'BTCUSDT',
        isReady: input,
      };

      const result = transformTradingTarget(rawTarget);
      expect(result.isReady).toBe(expected);
    });
  });

  it('should handle additional properties gracefully', () => {
    const rawTarget = {
      vcoinId: '123',
      symbolName: 'BTCUSDT',
      extraProperty: 'extra value',
      anotherProperty: 456,
    };

    const result = transformTradingTarget(rawTarget);

    // Should only include transformed properties
    expect(result).toEqual({
      vcoinId: '123',
      symbolName: 'BTCUSDT',
      listingDate: undefined,
      isReady: false,
    });
  });
});

describe('safeGetProperty', () => {
  it('should get property from valid object', () => {
    const obj = { name: 'John', age: 30 };
    
    expect(safeGetProperty(obj, 'name', 'default')).toBe('John');
    expect(safeGetProperty(obj, 'age', 0)).toBe(30);
  });

  it('should return fallback for missing property', () => {
    const obj = { name: 'John' };
    
    expect(safeGetProperty(obj, 'age', 25)).toBe(25);
    expect(safeGetProperty(obj, 'missing', 'default')).toBe('default');
  });

  it('should return fallback for null or undefined objects', () => {
    expect(safeGetProperty(null, 'name', 'default')).toBe('default');
    expect(safeGetProperty(undefined, 'name', 'default')).toBe('default');
  });

  it('should return fallback for non-object inputs', () => {
    expect(safeGetProperty('string', 'name', 'default')).toBe('default');
    expect(safeGetProperty(123, 'name', 'default')).toBe('default');
    expect(safeGetProperty([], 'name', 'default')).toBe('default');
    expect(safeGetProperty(true, 'name', 'default')).toBe('default');
  });

  it('should handle undefined property values', () => {
    const obj = { name: undefined, age: null };
    
    expect(safeGetProperty(obj, 'name', 'default')).toBe('default');
    expect(safeGetProperty(obj, 'age', 'default')).toBe(null); // null is not undefined
  });

  it('should work with different data types', () => {
    const obj = {
      string: 'text',
      number: 42,
      boolean: true,
      array: [1, 2, 3],
      object: { nested: 'value' },
      nullValue: null,
    };

    expect(safeGetProperty(obj, 'string', 'default')).toBe('text');
    expect(safeGetProperty(obj, 'number', 0)).toBe(42);
    expect(safeGetProperty(obj, 'boolean', false)).toBe(true);
    expect(safeGetProperty(obj, 'array', [])).toEqual([1, 2, 3]);
    expect(safeGetProperty(obj, 'object', {})).toEqual({ nested: 'value' });
    expect(safeGetProperty(obj, 'nullValue', 'default')).toBe(null);
  });

  it('should handle zero and empty string values correctly', () => {
    const obj = { zero: 0, empty: '', space: ' ' };
    
    expect(safeGetProperty(obj, 'zero', 5)).toBe(0);
    expect(safeGetProperty(obj, 'empty', 'default')).toBe('');
    expect(safeGetProperty(obj, 'space', 'default')).toBe(' ');
  });

  it('should work with nested property access pattern', () => {
    const obj = {
      user: {
        profile: {
          name: 'John'
        }
      }
    };

    // Note: This function doesn't support dot notation, but can access first level
    const userObj = safeGetProperty(obj, 'user', {});
    expect(userObj).toEqual({ profile: { name: 'John' } });
  });

  it('should handle symbol keys', () => {
    const symbolKey = Symbol('test');
    const obj = { [symbolKey]: 'value', normalKey: 'normal' };
    
    // Should work with string keys
    expect(safeGetProperty(obj, 'normalKey', 'default')).toBe('normal');
    
    // Symbol keys would require string conversion
    expect(safeGetProperty(obj, symbolKey.toString(), 'default')).toBe('default');
  });
});