/**
 * Unit tests for ConfidenceCalculator
 * Tests the core confidence scoring and validation module
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { ConfidenceCalculator } from '../../../../src/core/pattern-detection/confidence-calculator';
import type { SymbolEntry, CalendarEntry } from '../../../../src/services/api/mexc-unified-exports';
import type { ActivityData } from '../../../../src/schemas/unified/mexc-api-schemas';

// Mock dependencies
vi.mock('../../../../src/lib/error-type-utils', () => ({
  toSafeError: (error: any) => ({
    message: error?.message || 'Unknown error',
    stack: error?.stack || '',
  }),
}));

vi.mock('../../../../src/schemas/unified/mexc-api-schemas', () => ({
  calculateActivityBoost: vi.fn(() => 5),
  hasHighPriorityActivity: vi.fn(() => true),
}));

describe('ConfidenceCalculator', () => {
  let calculator: ConfidenceCalculator;
  let mockSymbolEntry: SymbolEntry;
  let mockCalendarEntry: CalendarEntry;
  let mockActivityData: ActivityData[];

  beforeEach(() => {
    calculator = ConfidenceCalculator.getInstance();
    
    // Mock symbol entry
    mockSymbolEntry = {
      cd: 'TESTCOIN',
      fn: 'Test Coin',
      sn: 'TEST',
      st: 2, // Ready state
      lt: Date.now(),
      tags: ['new-listing'],
    } as SymbolEntry;

    // Mock calendar entry
    mockCalendarEntry = {
      id: 'test-calendar-1',
      coin: 'TESTCOIN',
      exchange: 'MEXC',
      date: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      timestamp: Date.now() + 4 * 60 * 60 * 1000,
      isConfirmed: true,
    } as CalendarEntry;

    // Mock activity data
    mockActivityData = [
      {
        type: 'trading',
        timestamp: Date.now(),
        data: { volume: 1000000, price_change: 0.15 },
        priority: 'high',
      },
      {
        type: 'social',
        timestamp: Date.now() - 60000,
        data: { mentions: 500, sentiment: 0.8 },
        priority: 'medium',
      },
    ] as ActivityData[];

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ConfidenceCalculator.getInstance();
      const instance2 = ConfidenceCalculator.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('calculateReadyStateConfidence', () => {
    it('should return 0 for null symbol', async () => {
      const confidence = await calculator.calculateReadyStateConfidence(null as any);
      expect(confidence).toBe(0);
    });

    it('should return base confidence for valid symbol', async () => {
      // Mock private methods
      const mockValidateExactReadyState = vi.spyOn(calculator as any, 'validateExactReadyState').mockReturnValue(true);
      const mockCalculateDataCompletenessScore = vi.spyOn(calculator as any, 'calculateDataCompletenessScore').mockReturnValue(15);
      const mockGetActivityDataForSymbol = vi.spyOn(calculator as any, 'getActivityDataForSymbol').mockResolvedValue(mockActivityData);
      const mockEnhanceConfidenceWithActivity = vi.spyOn(calculator as any, 'enhanceConfidenceWithActivity').mockReturnValue(90);
      const mockGetAIEnhancement = vi.spyOn(calculator as any, 'getAIEnhancement').mockResolvedValue(10);
      const mockGetHistoricalSuccessBoost = vi.spyOn(calculator as any, 'getHistoricalSuccessBoost').mockResolvedValue(5);
      const mockGetMarketConditionsAdjustment = vi.spyOn(calculator as any, 'getMarketConditionsAdjustment').mockResolvedValue(3);

      const confidence = await calculator.calculateReadyStateConfidence(mockSymbolEntry);

      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(100);
      expect(mockValidateExactReadyState).toHaveBeenCalledWith(mockSymbolEntry);
      expect(mockCalculateDataCompletenessScore).toHaveBeenCalledWith(mockSymbolEntry);
    });

    it('should handle activity enhancement failure gracefully', async () => {
      // Mock methods to throw error in activity enhancement
      vi.spyOn(calculator as any, 'validateExactReadyState').mockReturnValue(true);
      vi.spyOn(calculator as any, 'calculateDataCompletenessScore').mockReturnValue(15);
      vi.spyOn(calculator as any, 'getActivityDataForSymbol').mockRejectedValue(new Error('Activity service down'));
      vi.spyOn(calculator as any, 'getAIEnhancement').mockResolvedValue(0);
      vi.spyOn(calculator as any, 'getHistoricalSuccessBoost').mockResolvedValue(0);
      vi.spyOn(calculator as any, 'getMarketConditionsAdjustment').mockResolvedValue(0);

      const confidence = await calculator.calculateReadyStateConfidence(mockSymbolEntry);

      // Should still return a valid confidence despite activity enhancement failure
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(100);
    });

    it('should cap confidence at 100', async () => {
      // Mock methods to return very high values
      vi.spyOn(calculator as any, 'validateExactReadyState').mockReturnValue(true);
      vi.spyOn(calculator as any, 'calculateDataCompletenessScore').mockReturnValue(50);
      vi.spyOn(calculator as any, 'getActivityDataForSymbol').mockResolvedValue(mockActivityData);
      vi.spyOn(calculator as any, 'enhanceConfidenceWithActivity').mockReturnValue(200); // Intentionally high
      vi.spyOn(calculator as any, 'getAIEnhancement').mockResolvedValue(20);
      vi.spyOn(calculator as any, 'getHistoricalSuccessBoost').mockResolvedValue(50);
      vi.spyOn(calculator as any, 'getMarketConditionsAdjustment').mockResolvedValue(30);

      const confidence = await calculator.calculateReadyStateConfidence(mockSymbolEntry);

      expect(confidence).toBe(100);
    });

    it('should return base confidence on error', async () => {
      // Mock methods to throw errors
      vi.spyOn(calculator as any, 'validateExactReadyState').mockImplementation(() => {
        throw new Error('Validation failed');
      });

      const confidence = await calculator.calculateReadyStateConfidence(mockSymbolEntry);

      expect(confidence).toBe(50); // Base confidence on error
    });
  });

  describe('calculateAdvanceOpportunityConfidence', () => {
    it('should return 0 for invalid inputs', async () => {
      let confidence = await calculator.calculateAdvanceOpportunityConfidence(null as any, 4);
      expect(confidence).toBe(0);

      confidence = await calculator.calculateAdvanceOpportunityConfidence(mockCalendarEntry, null as any);
      expect(confidence).toBe(0);
    });

    it('should calculate confidence for valid advance opportunity', async () => {
      // Mock private methods
      vi.spyOn(calculator as any, 'calculateCalendarDataQuality').mockReturnValue(20);
      vi.spyOn(calculator as any, 'getAdvanceTimeBonus').mockReturnValue(15);
      vi.spyOn(calculator as any, 'getMarketReadinessScore').mockResolvedValue(10);

      const confidence = await calculator.calculateAdvanceOpportunityConfidence(mockCalendarEntry, 4);

      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(100);
    });

    it('should apply optimal advance window bonus', async () => {
      vi.spyOn(calculator as any, 'calculateCalendarDataQuality').mockReturnValue(20);
      vi.spyOn(calculator as any, 'getMarketReadinessScore').mockResolvedValue(10);

      // Mock getAdvanceTimeBonus to return different values based on hours
      const mockGetAdvanceTimeBonus = vi.spyOn(calculator as any, 'getAdvanceTimeBonus').mockImplementation((hours: number) => {
        if (hours >= 3 && hours <= 6) return 20; // Optimal window
        return 10;
      });

      const optimalConfidence = await calculator.calculateAdvanceOpportunityConfidence(mockCalendarEntry, 4);
      const suboptimalConfidence = await calculator.calculateAdvanceOpportunityConfidence(mockCalendarEntry, 8);

      expect(optimalConfidence).toBeGreaterThan(suboptimalConfidence);
    });
  });

  describe('enhanceConfidenceWithActivity', () => {
    it('should enhance confidence with high priority activity', () => {
      const baseConfidence = 60;
      const enhancedConfidence = (calculator as any).enhanceConfidenceWithActivity(baseConfidence, mockActivityData);

      expect(enhancedConfidence).toBeGreaterThan(baseConfidence);
    });

    it('should handle empty activity data', () => {
      const baseConfidence = 60;
      const enhancedConfidence = (calculator as any).enhanceConfidenceWithActivity(baseConfidence, []);

      expect(enhancedConfidence).toBe(baseConfidence);
    });

    it('should handle null activity data', () => {
      const baseConfidence = 60;
      const enhancedConfidence = (calculator as any).enhanceConfidenceWithActivity(baseConfidence, null);

      expect(enhancedConfidence).toBe(baseConfidence);
    });
  });

  describe('validateExactReadyState', () => {
    it('should validate ready state symbols correctly', () => {
      const readySymbol = { ...mockSymbolEntry, st: 2 }; // Ready state
      const notReadySymbol = { ...mockSymbolEntry, st: 1 }; // Not ready state

      const isReady = (calculator as any).validateExactReadyState(readySymbol);
      const isNotReady = (calculator as any).validateExactReadyState(notReadySymbol);

      expect(isReady).toBe(true);
      expect(isNotReady).toBe(false);
    });

    it('should handle symbols without state', () => {
      const symbolWithoutState = { ...mockSymbolEntry };
      delete symbolWithoutState.st;

      const isValid = (calculator as any).validateExactReadyState(symbolWithoutState);

      expect(isValid).toBe(false);
    });
  });

  describe('calculateDataCompletenessScore', () => {
    it('should score complete data higher', () => {
      const completeSymbol = {
        cd: 'TESTCOIN',
        fn: 'Test Coin',
        sn: 'TEST',
        st: 2,
        lt: Date.now(),
        tags: ['new-listing'],
        website: 'https://testcoin.com',
        twitter: '@testcoin',
      } as SymbolEntry;

      const incompleteSymbol = {
        cd: 'TESTCOIN',
        st: 2,
      } as SymbolEntry;

      const completeScore = (calculator as any).calculateDataCompletenessScore(completeSymbol);
      const incompleteScore = (calculator as any).calculateDataCompletenessScore(incompleteSymbol);

      expect(completeScore).toBeGreaterThan(incompleteScore);
      expect(completeScore).toBeGreaterThanOrEqual(0);
      expect(completeScore).toBeLessThanOrEqual(25); // Max score from the implementation
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock a network error in activity data fetching
      vi.spyOn(calculator as any, 'getActivityDataForSymbol').mockRejectedValue(new Error('Network timeout'));
      vi.spyOn(calculator as any, 'validateExactReadyState').mockReturnValue(true);
      vi.spyOn(calculator as any, 'calculateDataCompletenessScore').mockReturnValue(15);
      vi.spyOn(calculator as any, 'getAIEnhancement').mockResolvedValue(0);
      vi.spyOn(calculator as any, 'getHistoricalSuccessBoost').mockResolvedValue(0);
      vi.spyOn(calculator as any, 'getMarketConditionsAdjustment').mockResolvedValue(0);

      const confidence = await calculator.calculateReadyStateConfidence(mockSymbolEntry);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(100);
    });

    it('should handle AI service errors gracefully', async () => {
      vi.spyOn(calculator as any, 'validateExactReadyState').mockReturnValue(true);
      vi.spyOn(calculator as any, 'calculateDataCompletenessScore').mockReturnValue(15);
      vi.spyOn(calculator as any, 'getActivityDataForSymbol').mockResolvedValue([]);
      vi.spyOn(calculator as any, 'getAIEnhancement').mockRejectedValue(new Error('AI service unavailable'));
      vi.spyOn(calculator as any, 'getHistoricalSuccessBoost').mockResolvedValue(0);
      vi.spyOn(calculator as any, 'getMarketConditionsAdjustment').mockResolvedValue(0);

      const confidence = await calculator.calculateReadyStateConfidence(mockSymbolEntry);

      // Should continue without AI enhancement
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle minimum confidence values', async () => {
      // Mock all methods to return minimum values
      vi.spyOn(calculator as any, 'validateExactReadyState').mockReturnValue(false);
      vi.spyOn(calculator as any, 'calculateDataCompletenessScore').mockReturnValue(0);
      vi.spyOn(calculator as any, 'getActivityDataForSymbol').mockResolvedValue([]);
      vi.spyOn(calculator as any, 'getAIEnhancement').mockResolvedValue(0);
      vi.spyOn(calculator as any, 'getHistoricalSuccessBoost').mockResolvedValue(0);
      vi.spyOn(calculator as any, 'getMarketConditionsAdjustment').mockReturnValue(-60); // Large negative

      const confidence = await calculator.calculateReadyStateConfidence(mockSymbolEntry);

      expect(confidence).toBe(0); // Should be clamped to 0
    });

    it('should handle edge case symbol data', async () => {
      const edgeCaseSymbol = {
        cd: '', // Empty string
        st: 999, // Invalid state
        lt: 0, // Invalid timestamp
      } as SymbolEntry;

      const confidence = await calculator.calculateReadyStateConfidence(edgeCaseSymbol);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(100);
    });
  });
});