/**
 * Unit tests for use-currency-formatting hook
 * Tests currency and number formatting utilities
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurrencyFormatting } from '../../../src/hooks/use-currency-formatting';

describe('useCurrencyFormatting', () => {
  it('should return all formatting functions', () => {
    const { result } = renderHook(() => useCurrencyFormatting());
    
    expect(result.current).toHaveProperty('formatCurrency');
    expect(result.current).toHaveProperty('formatTokenAmount');
    expect(result.current).toHaveProperty('formatPercentage');
    expect(result.current).toHaveProperty('formatBytes');
    expect(result.current).toHaveProperty('formatGrowthRate');
    
    expect(typeof result.current.formatCurrency).toBe('function');
    expect(typeof result.current.formatTokenAmount).toBe('function');
    expect(typeof result.current.formatPercentage).toBe('function');
    expect(typeof result.current.formatBytes).toBe('function');
    expect(typeof result.current.formatGrowthRate).toBe('function');
  });

  describe('formatCurrency', () => {
    it('should format currency with default 2 decimals', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatCurrency(1234.567)).toBe('1,234.57');
      expect(result.current.formatCurrency(0)).toBe('0.00');
      expect(result.current.formatCurrency(1)).toBe('1.00');
      expect(result.current.formatCurrency(1000)).toBe('1,000.00');
    });

    it('should format currency with custom decimals', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatCurrency(1234.567, 0)).toBe('1,235');
      expect(result.current.formatCurrency(1234.567, 1)).toBe('1,234.6');
      expect(result.current.formatCurrency(1234.567, 3)).toBe('1,234.567');
      expect(result.current.formatCurrency(1234.567, 4)).toBe('1,234.5670');
    });

    it('should handle edge cases', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatCurrency(0)).toBe('0.00');
      expect(result.current.formatCurrency(-1234.567)).toBe('-1,234.57');
      expect(result.current.formatCurrency(0.1)).toBe('0.10');
      expect(result.current.formatCurrency(0.01)).toBe('0.01');
      expect(result.current.formatCurrency(0.001)).toBe('0.00');
    });

    it('should handle very large numbers', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatCurrency(1000000)).toBe('1,000,000.00');
      expect(result.current.formatCurrency(1234567890.123)).toBe('1,234,567,890.12');
    });
  });

  describe('formatTokenAmount', () => {
    it('should format small amounts with 6 decimals', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatTokenAmount(0.123456789)).toBe('0.123457');
      expect(result.current.formatTokenAmount(0.001)).toBe('0.001000');
      expect(result.current.formatTokenAmount(0.5)).toBe('0.500000');
    });

    it('should format medium amounts with 4 decimals', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatTokenAmount(1)).toBe('1.0000');
      expect(result.current.formatTokenAmount(50)).toBe('50.0000');
      expect(result.current.formatTokenAmount(99.999)).toBe('99.9990');
    });

    it('should format large amounts with 2 decimals', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatTokenAmount(100)).toBe('100.00');
      expect(result.current.formatTokenAmount(1000)).toBe('1,000.00');
      expect(result.current.formatTokenAmount(1234567.89)).toBe('1,234,567.89');
    });

    it('should handle edge case at boundaries', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatTokenAmount(1)).toBe('1.0000'); // exactly 1
      expect(result.current.formatTokenAmount(100)).toBe('100.00'); // exactly 100
      expect(result.current.formatTokenAmount(99.9999)).toBe('99.9999'); // just under 100
    });

    it('should ignore asset parameter', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatTokenAmount(100, 'BTC')).toBe('100.00');
      expect(result.current.formatTokenAmount(100, 'ETH')).toBe('100.00');
      expect(result.current.formatTokenAmount(100)).toBe('100.00');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages with 1 decimal place', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatPercentage(0)).toBe('0.0%');
      expect(result.current.formatPercentage(10)).toBe('10.0%');
      expect(result.current.formatPercentage(10.5)).toBe('10.5%');
      expect(result.current.formatPercentage(100)).toBe('100.0%');
    });

    it('should handle negative percentages', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatPercentage(-10)).toBe('-10.0%');
      expect(result.current.formatPercentage(-0.5)).toBe('-0.5%');
    });

    it('should round to 1 decimal place', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatPercentage(10.15)).toBe('10.2%');
      expect(result.current.formatPercentage(10.14)).toBe('10.1%');
      expect(result.current.formatPercentage(10.999)).toBe('11.0%');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes to MB with 2 decimal places', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatBytes(0)).toBe('0.00 MB');
      expect(result.current.formatBytes(1024)).toBe('0.00 MB'); // 1 KB
      expect(result.current.formatBytes(1024 * 1024)).toBe('1.00 MB'); // 1 MB
      expect(result.current.formatBytes(1024 * 1024 * 2)).toBe('2.00 MB'); // 2 MB
    });

    it('should handle fractional MB values', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatBytes(1024 * 1024 * 1.5)).toBe('1.50 MB'); // 1.5 MB
      expect(result.current.formatBytes(1024 * 1024 * 0.25)).toBe('0.25 MB'); // 0.25 MB
    });

    it('should handle large byte values', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatBytes(1024 * 1024 * 1000)).toBe('1000.00 MB'); // 1000 MB
      expect(result.current.formatBytes(1024 * 1024 * 1024)).toBe('1024.00 MB'); // 1 GB in MB
    });
  });

  describe('formatGrowthRate', () => {
    it('should return "N/A" for null values', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      expect(result.current.formatGrowthRate(null)).toBe('N/A');
    });

    it('should return "Stable" for very small rates', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      const smallPositive = 1024 * 1024 * 0.05; // 0.05 MB/hour in bytes
      const smallNegative = -1024 * 1024 * 0.05; // -0.05 MB/hour in bytes
      
      expect(result.current.formatGrowthRate(smallPositive)).toBe('Stable');
      expect(result.current.formatGrowthRate(smallNegative)).toBe('Stable');
      expect(result.current.formatGrowthRate(0)).toBe('Stable');
    });

    it('should format positive growth rates', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      const rate1MB = 1024 * 1024; // 1 MB/hour in bytes
      const rate2_5MB = 1024 * 1024 * 2.5; // 2.5 MB/hour in bytes
      
      expect(result.current.formatGrowthRate(rate1MB)).toBe('+1.00 MB/hour');
      expect(result.current.formatGrowthRate(rate2_5MB)).toBe('+2.50 MB/hour');
    });

    it('should format negative growth rates', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      const rateNeg1MB = -1024 * 1024; // -1 MB/hour in bytes
      const rateNeg2_5MB = -1024 * 1024 * 2.5; // -2.5 MB/hour in bytes
      
      expect(result.current.formatGrowthRate(rateNeg1MB)).toBe('-1.00 MB/hour');
      expect(result.current.formatGrowthRate(rateNeg2_5MB)).toBe('-2.50 MB/hour');
    });

    it('should handle boundary values', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      const boundary = 1024 * 1024 * 0.1; // exactly 0.1 MB/hour
      const justAbove = 1024 * 1024 * 0.11; // just above boundary
      const justBelow = 1024 * 1024 * 0.09; // just below boundary
      
      expect(result.current.formatGrowthRate(boundary)).toBe('+0.10 MB/hour');
      expect(result.current.formatGrowthRate(justAbove)).toBe('+0.11 MB/hour');
      expect(result.current.formatGrowthRate(justBelow)).toBe('Stable');
    });
  });

  describe('memoization', () => {
    it('should return the same function references on re-renders', () => {
      const { result, rerender } = renderHook(() => useCurrencyFormatting());
      
      const firstResult = result.current;
      
      rerender();
      
      const secondResult = result.current;
      
      // Functions should be the same reference due to useCallback
      expect(firstResult.formatCurrency).toBe(secondResult.formatCurrency);
      expect(firstResult.formatTokenAmount).toBe(secondResult.formatTokenAmount);
      expect(firstResult.formatPercentage).toBe(secondResult.formatPercentage);
      expect(firstResult.formatBytes).toBe(secondResult.formatBytes);
      expect(firstResult.formatGrowthRate).toBe(secondResult.formatGrowthRate);
      
      // The returned object should also be the same reference due to useMemo
      expect(firstResult).toBe(secondResult);
    });
  });

  describe('integration tests', () => {
    it('should work together for comprehensive formatting', () => {
      const { result } = renderHook(() => useCurrencyFormatting());
      
      // Simulate formatting various trading metrics
      const price = 1234.567;
      const volume = 0.00123;
      const changePercent = 15.5;
      const memoryUsage = 1024 * 1024 * 5.25; // 5.25 MB in bytes
      const growthRate = 1024 * 1024 * 2; // 2 MB/hour in bytes
      
      expect(result.current.formatCurrency(price)).toBe('1,234.57');
      expect(result.current.formatTokenAmount(volume)).toBe('0.001230');
      expect(result.current.formatPercentage(changePercent)).toBe('15.5%');
      expect(result.current.formatBytes(memoryUsage)).toBe('5.25 MB');
      expect(result.current.formatGrowthRate(growthRate)).toBe('+2.00 MB/hour');
    });
  });
});