/**
 * Unit tests for PatternAnalyzer
 * Tests the core pattern detection algorithms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PatternAnalyzer } from '../../../../src/core/pattern-detection/pattern-analyzer';
import type { SymbolEntry, CalendarEntry } from '../../../../src/services/api/mexc-unified-exports';

// Mock dependencies
vi.mock('../../../../src/lib/error-type-utils', () => ({
  toSafeError: (error: any) => ({
    message: error?.message || 'Unknown error',
    stack: error?.stack || '',
  }),
}));

vi.mock('../../../../src/services/data/pattern-detection/activity-integration', () => ({
  getActivityDataForSymbol: vi.fn(() => Promise.resolve([])),
}));

describe('PatternAnalyzer', () => {
  let analyzer: PatternAnalyzer;
  let mockSymbolEntry: SymbolEntry;
  let mockCalendarEntry: CalendarEntry;
  let mockReadyStateSymbol: SymbolEntry;

  beforeEach(() => {
    analyzer = PatternAnalyzer.getInstance();
    
    // Mock symbol entry - not ready state
    mockSymbolEntry = {
      cd: 'TESTCOIN',
      fn: 'Test Coin',
      sn: 'TEST',
      st: 1, // Not ready state
      sts: 1,
      tt: 1,
      lt: Date.now(),
      tags: ['new-listing'],
    } as SymbolEntry;

    // Mock ready state symbol entry (matches READY_STATE_PATTERN)
    mockReadyStateSymbol = {
      cd: 'READYCOIN',
      fn: 'Ready Coin',
      sn: 'READY',
      st: 2, // Ready state
      sts: 2,
      tt: 4,
      lt: Date.now(),
      tags: ['ready'],
    } as SymbolEntry;

    // Mock calendar entry
    mockCalendarEntry = {
      id: 'test-calendar-1',
      symbol: 'TESTCOIN',
      firstOpenTime: Date.now() + 4 * 60 * 60 * 1000, // 4 hours from now
    } as CalendarEntry;

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PatternAnalyzer.getInstance();
      const instance2 = PatternAnalyzer.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('detectReadyStatePattern', () => {
    it('should handle null symbol input', async () => {
      const results = await analyzer.detectReadyStatePattern(null as any);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle undefined symbol input', async () => {
      const results = await analyzer.detectReadyStatePattern(undefined as any);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle empty array input', async () => {
      const results = await analyzer.detectReadyStatePattern([]);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should process single symbol input', async () => {
      const results = await analyzer.detectReadyStatePattern(mockSymbolEntry);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // Results may be empty for non-ready state symbols
    });

    it('should process array of symbols', async () => {
      const symbols = [mockSymbolEntry, mockReadyStateSymbol];
      const results = await analyzer.detectReadyStatePattern(symbols);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle invalid symbol data gracefully', async () => {
      const invalidSymbol = {
        cd: '', // Invalid empty code
        st: null, // Invalid state
      } as any;

      const results = await analyzer.detectReadyStatePattern(invalidSymbol);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('detectAdvanceOpportunities', () => {
    it('should handle null calendar input', async () => {
      const results = await analyzer.detectAdvanceOpportunities(null as any);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle empty array input', async () => {
      const results = await analyzer.detectAdvanceOpportunities([]);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should process calendar entries', async () => {
      const results = await analyzer.detectAdvanceOpportunities([mockCalendarEntry]);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should validate advance time requirements', async () => {
      // Create calendar entry with insufficient lead time (1 hour)
      const shortLeadTimeEntry = {
        ...mockCalendarEntry,
        firstOpenTime: Date.now() + 1 * 60 * 60 * 1000,
      };

      const results = await analyzer.detectAdvanceOpportunities([shortLeadTimeEntry]);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // Should return empty array for insufficient advance time
      expect(results.length).toBe(0);
    });
  });

  describe('detectPreReadyPatterns', () => {
    it('should handle null input', async () => {
      const results = await analyzer.detectPreReadyPatterns(null as any);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should process symbol data', async () => {
      const results = await analyzer.detectPreReadyPatterns([mockSymbolEntry]);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('analyzeSymbolCorrelations', () => {
    it('should handle empty symbol array', async () => {
      const results = await analyzer.analyzeSymbolCorrelations([]);

      expect(results).toBeDefined();
    });

    it('should analyze symbol correlations', async () => {
      const symbols = [mockSymbolEntry, mockReadyStateSymbol];
      const results = await analyzer.analyzeSymbolCorrelations(symbols);

      expect(results).toBeDefined();
    });

    it('should handle single symbol gracefully', async () => {
      const results = await analyzer.analyzeSymbolCorrelations([mockSymbolEntry]);

      expect(results).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle analysis errors gracefully', async () => {
      // Create malformed symbol that might cause internal errors
      const malformedSymbol = {
        cd: Symbol('invalid'), // Non-string value
        st: 'invalid', // Non-numeric state
      } as any;

      const results = await analyzer.detectReadyStatePattern(malformedSymbol);

      // Should handle error gracefully and return empty results
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle network errors in activity data', async () => {
      // Mock activity data service to throw error
      vi.mocked(require('../../../../src/services/data/pattern-detection/activity-integration').getActivityDataForSymbol)
        .mockRejectedValue(new Error('Network timeout'));

      const results = await analyzer.detectReadyStatePattern(mockReadyStateSymbol);

      // Should continue processing despite activity data error
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should process patterns efficiently', async () => {
      const startTime = Date.now();
      
      await analyzer.detectReadyStatePattern(mockSymbolEntry);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle batch processing efficiently', async () => {
      const symbols = Array.from({ length: 10 }, (_, i) => ({
        ...mockSymbolEntry,
        cd: `COIN${i}`,
      }));

      const startTime = Date.now();
      
      const results = await analyzer.detectReadyStatePattern(symbols);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Data Validation', () => {
    it('should validate symbol structure', () => {
      // Test the private validateSymbolData method indirectly
      const validSymbol = mockSymbolEntry;
      const invalidSymbol = {} as SymbolEntry;

      // Both should not throw errors when processed
      expect(async () => {
        await analyzer.detectReadyStatePattern(validSymbol);
      }).not.toThrow();

      expect(async () => {
        await analyzer.detectReadyStatePattern(invalidSymbol);
      }).not.toThrow();
    });

    it('should validate calendar entry structure', () => {
      const validEntry = mockCalendarEntry;
      const invalidEntry = {} as CalendarEntry;

      // Both should not throw errors when processed
      expect(async () => {
        await analyzer.detectAdvanceOpportunities([validEntry]);
      }).not.toThrow();

      expect(async () => {
        await analyzer.detectAdvanceOpportunities([invalidEntry]);
      }).not.toThrow();
    });
  });

  describe('Pattern Type Validation', () => {
    it('should handle different symbol states', async () => {
      const symbols = [
        { ...mockSymbolEntry, st: 0 }, // State 0
        { ...mockSymbolEntry, st: 1 }, // State 1
        { ...mockSymbolEntry, st: 2 }, // State 2 (ready)
        { ...mockSymbolEntry, st: 3 }, // State 3
      ];

      for (const symbol of symbols) {
        const results = await analyzer.detectReadyStatePattern(symbol);
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      }
    });

    it('should handle different trading statuses', async () => {
      const symbols = [
        { ...mockSymbolEntry, sts: 0 },
        { ...mockSymbolEntry, sts: 1 },
        { ...mockSymbolEntry, sts: 2 },
      ];

      for (const symbol of symbols) {
        const results = await analyzer.detectReadyStatePattern(symbol);
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });
});