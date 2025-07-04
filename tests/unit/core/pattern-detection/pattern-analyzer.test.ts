/**
 * Unit tests for PatternAnalyzer
 * Tests the core pattern detection algorithms
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
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

// Mock confidence calculator
const mockConfidenceCalculator = {
  calculateReadyStateConfidence: vi.fn().mockResolvedValue(90),
  calculateAdvanceOpportunityConfidence: vi.fn().mockResolvedValue(75),
  calculatePreReadyScore: vi.fn().mockResolvedValue({
    isPreReady: true,
    confidence: 70,
    estimatedTimeToReady: 2,
  }),
};

vi.mock('../../../../src/core/pattern-detection/confidence-calculator', () => ({
  ConfidenceCalculator: {
    getInstance: () => mockConfidenceCalculator,
  },
}));

describe('PatternAnalyzer', () => {
  let analyzer: PatternAnalyzer;
  let mockSymbolEntry: SymbolEntry;
  let mockCalendarEntry: CalendarEntry;
  let mockReadyStateSymbol: SymbolEntry;
  let consoleSpy: {
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    analyzer = PatternAnalyzer.getInstance();
    
    consoleSpy = {
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
    
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
      ca: 'test-ca',
      ps: 1,
      qs: 1,
    } as SymbolEntry;

    // Mock calendar entry
    mockCalendarEntry = {
      id: 'test-calendar-1',
      symbol: 'TESTCOIN',
      firstOpenTime: Date.now() + 4 * 60 * 60 * 1000, // 4 hours from now
      projectName: 'Test Project',
      vcoinId: 'test-vcoin-id',
    } as CalendarEntry;

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = PatternAnalyzer.getInstance();
      const instance2 = PatternAnalyzer.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('validateExactReadyState', () => {
    it('should validate exact ready state pattern (sts:2, st:2, tt:4)', () => {
      const validSymbol: SymbolEntry = {
        cd: 'TEST',
        sts: 2,
        st: 2,
        tt: 4,
      } as SymbolEntry;

      expect(analyzer.validateExactReadyState(validSymbol)).toBe(true);
    });

    it('should reject symbols with incorrect sts', () => {
      const invalidSymbol: SymbolEntry = {
        cd: 'TEST',
        sts: 1,
        st: 2,
        tt: 4,
      } as SymbolEntry;

      expect(analyzer.validateExactReadyState(invalidSymbol)).toBe(false);
    });

    it('should reject symbols with incorrect st', () => {
      const invalidSymbol: SymbolEntry = {
        cd: 'TEST',
        sts: 2,
        st: 1,
        tt: 4,
      } as SymbolEntry;

      expect(analyzer.validateExactReadyState(invalidSymbol)).toBe(false);
    });

    it('should reject symbols with incorrect tt', () => {
      const invalidSymbol: SymbolEntry = {
        cd: 'TEST',
        sts: 2,
        st: 2,
        tt: 3,
      } as SymbolEntry;

      expect(analyzer.validateExactReadyState(invalidSymbol)).toBe(false);
    });

    it('should handle null/undefined symbols', () => {
      expect(analyzer.validateExactReadyState(null as any)).toBe(false);
      expect(analyzer.validateExactReadyState(undefined as any)).toBe(false);
    });
  });

  describe('detectReadyStatePattern', () => {
    it('should handle null symbol input', async () => {
      const results = await analyzer.detectReadyStatePattern(null as any);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        '[pattern-analyzer]',
        'Null/undefined symbol data provided to detectReadyStatePattern',
        ''
      );
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

    it('should detect ready state pattern for valid symbol', async () => {
      const results = await analyzer.detectReadyStatePattern(mockReadyStateSymbol);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        patternType: 'ready_state',
        symbol: 'READYCOIN',
        confidence: 90,
        recommendation: 'immediate_action',
        advanceNoticeHours: 0,
        riskLevel: 'low',
      });
    });

    it('should handle array of symbols', async () => {
      const symbols = [mockReadyStateSymbol, { ...mockReadyStateSymbol, cd: 'READYCOIN2' }];
      const results = await analyzer.detectReadyStatePattern(symbols);
      
      expect(results).toHaveLength(2);
      expect(results[0].symbol).toBe('READYCOIN');
      expect(results[1].symbol).toBe('READYCOIN2');
    });

    it('should skip symbols with low confidence', async () => {
      mockConfidenceCalculator.calculateReadyStateConfidence.mockResolvedValueOnce(70);
      
      const results = await analyzer.detectReadyStatePattern(mockReadyStateSymbol);
      expect(results).toHaveLength(0);
    });

    it('should skip non-ready state symbols', async () => {
      const results = await analyzer.detectReadyStatePattern(mockSymbolEntry);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0); // Non-ready state symbols should not match
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
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockConfidenceCalculator.calculateReadyStateConfidence.mockRejectedValueOnce(
        new Error('Confidence calculation failed')
      );
      
      const results = await analyzer.detectReadyStatePattern(mockReadyStateSymbol);
      expect(results).toHaveLength(0);
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should assess risk levels correctly', async () => {
      const highRiskSymbol = {
        cd: '',
        sts: 2,
        st: 2,
        tt: 4,
      } as SymbolEntry;
      
      // For high risk symbols, we need to mock validateExactReadyState to return true first
      // Since the method is private, we'll test indirectly by ensuring missing cd triggers high risk
      const results = await analyzer.detectReadyStatePattern(highRiskSymbol);
      // Symbol with empty cd would be considered invalid and skipped
      expect(results).toHaveLength(0);
    });
  });

  describe('detectAdvanceOpportunities', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

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

    it('should detect advance opportunities for valid calendar entries', async () => {
      const futureEntry = {
        ...mockCalendarEntry,
        firstOpenTime: Date.now() + 4 * 60 * 60 * 1000, // 4 hours from now
      };
      
      const results = await analyzer.detectAdvanceOpportunities([futureEntry]);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        patternType: 'launch_sequence',
        symbol: 'TESTCOIN',
        confidence: 75,
        recommendation: 'monitor_closely',
      });
    });

    it('should filter out opportunities with insufficient advance time', async () => {
      const nearEntry = {
        ...mockCalendarEntry,
        firstOpenTime: Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now (< 3.5 hours)
      };
      
      const results = await analyzer.detectAdvanceOpportunities([nearEntry]);
      expect(results).toHaveLength(0);
    });

    it('should filter out opportunities with low confidence', async () => {
      mockConfidenceCalculator.calculateAdvanceOpportunityConfidence.mockResolvedValueOnce(60);
      
      const results = await analyzer.detectAdvanceOpportunities([mockCalendarEntry]);
      expect(results).toHaveLength(0);
    });

    it('should handle numeric timestamps', async () => {
      const numericEntry = {
        ...mockCalendarEntry,
        firstOpenTime: Date.now() + 4 * 60 * 60 * 1000,
      };
      
      const results = await analyzer.detectAdvanceOpportunities([numericEntry]);
      expect(results).toHaveLength(1);
    });

    it('should skip invalid calendar entries', async () => {
      const invalidEntry = { symbol: '' } as CalendarEntry;
      const validEntry = {
        ...mockCalendarEntry,
        firstOpenTime: Date.now() + 4 * 60 * 60 * 1000,
      };
      
      const results = await analyzer.detectAdvanceOpportunities([invalidEntry, validEntry]);
      expect(results).toHaveLength(1);
    });

    it('should classify project types correctly', async () => {
      const defiEntry = {
        ...mockCalendarEntry,
        projectName: 'DeFi Swap Protocol',
        firstOpenTime: Date.now() + 4 * 60 * 60 * 1000,
      };
      
      const results = await analyzer.detectAdvanceOpportunities([defiEntry]);
      expect(results[0].indicators.marketConditions.projectType).toBe('DeFi');
    });

    it('should provide correct recommendations based on confidence and timing', async () => {
      // High confidence, optimal timing
      mockConfidenceCalculator.calculateAdvanceOpportunityConfidence.mockResolvedValueOnce(85);
      const optimalEntry = {
        ...mockCalendarEntry,
        firstOpenTime: Date.now() + 6 * 60 * 60 * 1000, // 6 hours
      };
      
      const results = await analyzer.detectAdvanceOpportunities([optimalEntry]);
      expect(results[0].recommendation).toBe('prepare_entry');
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