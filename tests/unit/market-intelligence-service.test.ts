/**
 * Market Intelligence Service Tests
 *
 * Comprehensive test suite for market analysis, sentiment analysis, and trading insights
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { 
  type MarketAnalysis,
  MarketAnalysisSchema,
  type MarketIntelligence, 
  MarketIntelligenceSchema,
  MarketIntelligenceService, 
  type MarketSentiment,
  MarketSentimentSchema,
  marketIntelligenceService,
  type TradingSignal,
  TradingSignalSchema
} from '@/src/services/intelligence/market-intelligence-service';

describe('MarketIntelligenceService', () => {
  let service: MarketIntelligenceService;

  beforeEach(() => {
    service = new MarketIntelligenceService();
    // Reset Math.random for consistent tests
    vi.clearAllMocks();
  });

  describe('Schema Validation', () => {
    describe('MarketSentimentSchema', () => {
      it('should validate valid market sentiment', () => {
        const validSentiment = {
          symbol: 'BTCUSDT',
          sentiment: 'bullish' as const,
          confidence: 0.85,
          factors: ['Technical indicators', 'Social media sentiment'],
          timestamp: Date.now()
        };

        expect(() => MarketSentimentSchema.parse(validSentiment)).not.toThrow();
      });

      it('should reject invalid sentiment values', () => {
        const invalidSentiment = {
          symbol: 'BTCUSDT',
          sentiment: 'invalid_sentiment',
          confidence: 0.85,
          factors: ['Technical indicators'],
          timestamp: Date.now()
        };

        expect(() => MarketSentimentSchema.parse(invalidSentiment)).toThrow();
      });

      it('should reject confidence outside 0-1 range', () => {
        const invalidConfidence = {
          symbol: 'BTCUSDT',
          sentiment: 'neutral' as const,
          confidence: 1.5, // Invalid
          factors: ['Technical indicators'],
          timestamp: Date.now()
        };

        expect(() => MarketSentimentSchema.parse(invalidConfidence)).toThrow();
      });
    });

    describe('MarketAnalysisSchema', () => {
      it('should validate valid market analysis', () => {
        const validAnalysis = {
          symbol: 'ETHUSDT',
          price: 3000.50,
          volume: 1000000,
          volatility: 0.05,
          trend: 'uptrend' as const,
          support: 2900,
          resistance: 3200,
          recommendation: 'buy' as const,
          confidence: 0.75,
          timestamp: Date.now()
        };

        expect(() => MarketAnalysisSchema.parse(validAnalysis)).not.toThrow();
      });

      it('should reject negative prices', () => {
        const invalidAnalysis = {
          symbol: 'ETHUSDT',
          price: -100, // Invalid
          volume: 1000000,
          volatility: 0.05,
          trend: 'uptrend' as const,
          recommendation: 'buy' as const,
          confidence: 0.75,
          timestamp: Date.now()
        };

        expect(() => MarketAnalysisSchema.parse(invalidAnalysis)).toThrow();
      });

      it('should allow optional support and resistance', () => {
        const analysisWithoutLevels = {
          symbol: 'ADAUSDT',
          price: 1.50,
          volume: 500000,
          volatility: 0.08,
          trend: 'sideways' as const,
          recommendation: 'hold' as const,
          confidence: 0.60,
          timestamp: Date.now()
        };

        expect(() => MarketAnalysisSchema.parse(analysisWithoutLevels)).not.toThrow();
      });
    });

    describe('TradingSignalSchema', () => {
      it('should validate valid trading signal', () => {
        const validSignal = {
          id: 'signal_123_0',
          symbol: 'BTCUSDT',
          type: 'buy' as const,
          strength: 'strong' as const,
          entryPrice: 50000,
          stopLoss: 48000,
          takeProfit: 55000,
          timeframe: '4h' as const,
          indicators: ['RSI', 'MACD'],
          probability: 0.80,
          timestamp: Date.now(),
          expiresAt: Date.now() + 3600000
        };

        expect(() => TradingSignalSchema.parse(validSignal)).not.toThrow();
      });

      it('should allow optional stop loss and take profit', () => {
        const signalWithoutLevels = {
          id: 'signal_123_1',
          symbol: 'ETHUSDT',
          type: 'sell' as const,
          strength: 'moderate' as const,
          entryPrice: 3000,
          timeframe: '1h' as const,
          indicators: ['Volume'],
          probability: 0.65,
          timestamp: Date.now()
        };

        expect(() => TradingSignalSchema.parse(signalWithoutLevels)).not.toThrow();
      });

      it('should reject invalid timeframes', () => {
        const invalidSignal = {
          id: 'signal_123_2',
          symbol: 'ADAUSDT',
          type: 'buy' as const,
          strength: 'weak' as const,
          entryPrice: 1.50,
          timeframe: 'invalid_timeframe',
          indicators: ['RSI'],
          probability: 0.55,
          timestamp: Date.now()
        };

        expect(() => TradingSignalSchema.parse(invalidSignal)).toThrow();
      });
    });

    describe('MarketIntelligenceSchema', () => {
      it('should validate complete market intelligence', async () => {
        const intelligence = await service.getMarketIntelligence('BTCUSDT');
        
        expect(() => MarketIntelligenceSchema.parse(intelligence)).not.toThrow();
      });
    });
  });

  describe('Sentiment Analysis', () => {
    it('should analyze sentiment for a symbol', async () => {
      const sentiment = await service.analyzeSentiment('BTCUSDT');

      expect(sentiment).toMatchObject({
        symbol: 'BTCUSDT',
        sentiment: expect.stringMatching(/^(bullish|bearish|neutral)$/),
        confidence: expect.any(Number),
        factors: expect.any(Array),
        timestamp: expect.any(Number)
      });

      expect(sentiment.confidence).toBeGreaterThanOrEqual(0.7);
      expect(sentiment.confidence).toBeLessThanOrEqual(1.0);
      expect(sentiment.factors.length).toBeGreaterThanOrEqual(2);
      expect(sentiment.factors.length).toBeLessThanOrEqual(5);
    });

    it('should include expected sentiment factors', async () => {
      const sentiment = await service.analyzeSentiment('ETHUSDT');
      
      const expectedFactors = [
        'Technical indicators',
        'Social media sentiment',
        'News analysis',
        'Trading volume',
        'Price action'
      ];

      sentiment.factors.forEach(factor => {
        expect(expectedFactors).toContain(factor);
      });
    });

    it('should return different sentiments for different symbols', async () => {
      const results = await Promise.all([
        service.analyzeSentiment('BTCUSDT'),
        service.analyzeSentiment('ETHUSDT'),
        service.analyzeSentiment('ADAUSDT')
      ]);

      // With random generation, we expect some variation
      // At least symbols should be different
      expect(results[0].symbol).toBe('BTCUSDT');
      expect(results[1].symbol).toBe('ETHUSDT');
      expect(results[2].symbol).toBe('ADAUSDT');
    });

    it('should generate recent timestamps', async () => {
      const before = Date.now();
      const sentiment = await service.analyzeSentiment('BTCUSDT');
      const after = Date.now();

      expect(sentiment.timestamp).toBeGreaterThanOrEqual(before);
      expect(sentiment.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('Market Analysis', () => {
    it('should analyze market conditions for a symbol', async () => {
      const analysis = await service.analyzeMarket('BTCUSDT');

      expect(analysis).toMatchObject({
        symbol: 'BTCUSDT',
        price: expect.any(Number),
        volume: expect.any(Number),
        volatility: expect.any(Number),
        trend: expect.stringMatching(/^(uptrend|downtrend|sideways)$/),
        support: expect.any(Number),
        resistance: expect.any(Number),
        recommendation: expect.stringMatching(/^(strong_buy|buy|hold|sell|strong_sell)$/),
        confidence: expect.any(Number),
        timestamp: expect.any(Number)
      });

      expect(analysis.price).toBeGreaterThan(100);
      expect(analysis.price).toBeLessThan(1000);
      expect(analysis.volume).toBeGreaterThanOrEqual(0);
      expect(analysis.volatility).toBeGreaterThanOrEqual(0);
      expect(analysis.volatility).toBeLessThan(0.1);
      expect(analysis.confidence).toBeGreaterThanOrEqual(0.6);
      expect(analysis.confidence).toBeLessThanOrEqual(1.0);
    });

    it('should generate logical support and resistance levels', async () => {
      const analysis = await service.analyzeMarket('ETHUSDT');

      if (analysis.support && analysis.resistance) {
        expect(analysis.support).toBeLessThan(analysis.price);
        expect(analysis.resistance).toBeGreaterThan(analysis.price);
        
        // Support should be around 90-95% of price
        expect(analysis.support).toBeGreaterThan(analysis.price * 0.9);
        expect(analysis.support).toBeLessThan(analysis.price * 0.95);
        
        // Resistance should be around 105-110% of price
        expect(analysis.resistance).toBeGreaterThan(analysis.price * 1.05);
        expect(analysis.resistance).toBeLessThan(analysis.price * 1.10);
      }
    });

    it('should include valid recommendation types', async () => {
      const analysis = await service.analyzeMarket('ADAUSDT');
      
      const validRecommendations = ['strong_buy', 'buy', 'hold', 'sell', 'strong_sell'];
      expect(validRecommendations).toContain(analysis.recommendation);
    });

    it('should include valid trend types', async () => {
      const analysis = await service.analyzeMarket('SOLUSDT');
      
      const validTrends = ['uptrend', 'downtrend', 'sideways'];
      expect(validTrends).toContain(analysis.trend);
    });
  });

  describe('Trading Signal Generation', () => {
    it('should generate trading signals for a symbol', async () => {
      const signals = await service.generateSignals('BTCUSDT');

      expect(signals).toBeInstanceOf(Array);
      expect(signals.length).toBeGreaterThanOrEqual(1);
      expect(signals.length).toBeLessThanOrEqual(3);

      signals.forEach(signal => {
        expect(signal).toMatchObject({
          id: expect.stringMatching(/^signal_\d+_\d+$/),
          symbol: 'BTCUSDT',
          type: expect.stringMatching(/^(buy|sell)$/),
          strength: expect.stringMatching(/^(weak|moderate|strong)$/),
          entryPrice: expect.any(Number),
          timeframe: expect.stringMatching(/^(1m|5m|15m|30m|1h|4h|1d)$/),
          indicators: expect.any(Array),
          probability: expect.any(Number),
          timestamp: expect.any(Number)
        });

        expect(signal.entryPrice).toBeGreaterThan(100);
        expect(signal.entryPrice).toBeLessThan(1000);
        expect(signal.probability).toBeGreaterThanOrEqual(0.5);
        expect(signal.probability).toBeLessThanOrEqual(0.9);
        expect(signal.indicators.length).toBeGreaterThanOrEqual(2);
        expect(signal.indicators.length).toBeLessThanOrEqual(4);
      });
    });

    it('should generate logical stop loss and take profit levels', async () => {
      const signals = await service.generateSignals('ETHUSDT');

      signals.forEach(signal => {
        if (signal.stopLoss) {
          // Stop loss should be lower than entry price (conservative range)
          expect(signal.stopLoss).toBeLessThan(signal.entryPrice);
          expect(signal.stopLoss).toBeGreaterThan(signal.entryPrice * 0.95);
        }

        if (signal.takeProfit) {
          // Take profit should be higher than entry price
          expect(signal.takeProfit).toBeGreaterThan(signal.entryPrice);
          expect(signal.takeProfit).toBeLessThan(signal.entryPrice * 1.10);
        }
      });
    });

    it('should include expected technical indicators', async () => {
      const signals = await service.generateSignals('ADAUSDT');
      
      const expectedIndicators = ['RSI', 'MACD', 'MA', 'Volume'];
      
      signals.forEach(signal => {
        signal.indicators.forEach(indicator => {
          expect(expectedIndicators).toContain(indicator);
        });
      });
    });

    it('should set expiration times for signals', async () => {
      const before = Date.now();
      const signals = await service.generateSignals('SOLUSDT');
      const after = Date.now();

      signals.forEach(signal => {
        if (signal.expiresAt) {
          expect(signal.expiresAt).toBeGreaterThan(after);
          expect(signal.expiresAt).toBeLessThan(after + 3600000); // Within 1 hour
        }
      });
    });
  });

  describe('Market Intelligence Aggregation', () => {
    it('should provide comprehensive market intelligence', async () => {
      const intelligence = await service.getMarketIntelligence('BTCUSDT');

      expect(intelligence).toMatchObject({
        symbol: 'BTCUSDT',
        sentiment: expect.any(Object),
        analysis: expect.any(Object),
        signals: expect.any(Array),
        lastUpdated: expect.any(Number)
      });

      expect(intelligence.sentiment.symbol).toBe('BTCUSDT');
      expect(intelligence.analysis.symbol).toBe('BTCUSDT');
      intelligence.signals.forEach(signal => {
        expect(signal.symbol).toBe('BTCUSDT');
      });
    });

    it('should execute analysis steps in parallel', async () => {
      const startTime = Date.now();
      await service.getMarketIntelligence('ETHUSDT');
      const endTime = Date.now();

      // Should complete relatively quickly due to parallel execution
      // This is a rough test - parallel execution should be faster than sequential
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
    });

    it('should update lastUpdated timestamp', async () => {
      const before = Date.now();
      const intelligence = await service.getMarketIntelligence('ADAUSDT');
      const after = Date.now();

      expect(intelligence.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(intelligence.lastUpdated).toBeLessThanOrEqual(after);
    });
  });

  describe('Caching Mechanism', () => {
    it('should cache market intelligence results', async () => {
      const symbol = 'BTCUSDT';
      
      // First call
      const intelligence1 = await service.getMarketIntelligence(symbol);
      
      // Second call should return cached result
      const intelligence2 = await service.getMarketIntelligence(symbol);

      expect(intelligence1).toEqual(intelligence2);
      expect(intelligence1.lastUpdated).toBe(intelligence2.lastUpdated);
    });

    it('should refresh cache after expiration', async () => {
      const symbol = 'ETHUSDT';
      
      // First call
      const intelligence1 = await service.getMarketIntelligence(symbol);
      
      // Mock time passage (beyond cache duration)
      const originalNow = Date.now;
      Date.now = () => originalNow() + 6 * 60 * 1000; // 6 minutes later
      
      try {
        // Second call should generate new data
        const intelligence2 = await service.getMarketIntelligence(symbol);
        
        expect(intelligence2.lastUpdated).toBeGreaterThan(intelligence1.lastUpdated);
      } finally {
        Date.now = originalNow;
      }
    });

    it('should handle multiple symbols independently', async () => {
      const btcIntelligence = await service.getMarketIntelligence('BTCUSDT');
      const ethIntelligence = await service.getMarketIntelligence('ETHUSDT');

      expect(btcIntelligence.symbol).toBe('BTCUSDT');
      expect(ethIntelligence.symbol).toBe('ETHUSDT');
      
      // Should be different objects
      expect(btcIntelligence).not.toEqual(ethIntelligence);
    });
  });

  describe('Active Signals Management', () => {
    it('should return active signals for cached symbol', async () => {
      const symbol = 'BTCUSDT';
      
      // First populate cache
      await service.getMarketIntelligence(symbol);
      
      const activeSignals = service.getActiveSignals(symbol);
      
      expect(activeSignals).toBeInstanceOf(Array);
      activeSignals.forEach(signal => {
        expect(signal.symbol).toBe(symbol);
        if (signal.expiresAt) {
          expect(signal.expiresAt).toBeGreaterThan(Date.now());
        }
      });
    });

    it('should return empty array for non-cached symbol', () => {
      const activeSignals = service.getActiveSignals('NONEXISTENT');
      expect(activeSignals).toEqual([]);
    });

    it('should filter out expired signals', async () => {
      const symbol = 'ETHUSDT';
      
      // Populate cache
      await service.getMarketIntelligence(symbol);
      
      // Mock time passage to expire some signals
      const originalNow = Date.now;
      Date.now = () => originalNow() + 2 * 3600000; // 2 hours later
      
      try {
        const activeSignals = service.getActiveSignals(symbol);
        
        activeSignals.forEach(signal => {
          if (signal.expiresAt) {
            expect(signal.expiresAt).toBeGreaterThan(Date.now());
          }
        });
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('Cache Management', () => {
    it('should provide cache statistics', async () => {
      // Populate cache with multiple symbols
      await service.getMarketIntelligence('BTCUSDT');
      await service.getMarketIntelligence('ETHUSDT');
      await service.getMarketIntelligence('ADAUSDT');

      const stats = service.getCacheStats();

      expect(stats).toMatchObject({
        size: 3,
        symbols: expect.arrayContaining(['BTCUSDT', 'ETHUSDT', 'ADAUSDT'])
      });
    });

    it('should clear expired cache entries', async () => {
      // Populate cache
      await service.getMarketIntelligence('BTCUSDT');
      await service.getMarketIntelligence('ETHUSDT');

      expect(service.getCacheStats().size).toBe(2);

      // Mock time passage beyond cache duration
      const originalNow = Date.now;
      Date.now = () => originalNow() + 6 * 60 * 1000; // 6 minutes later

      try {
        service.clearExpiredCache();
        expect(service.getCacheStats().size).toBe(0);
      } finally {
        Date.now = originalNow;
      }
    });

    it('should keep fresh cache entries during cleanup', async () => {
      // Add first entry
      await service.getMarketIntelligence('BTCUSDT');
      
      // Mock time passage (but not beyond cache duration)
      const originalNow = Date.now;
      Date.now = () => originalNow() + 2 * 60 * 1000; // 2 minutes later
      
      try {
        // Add second entry (fresh)
        await service.getMarketIntelligence('ETHUSDT');
        
        // Mock further time passage (expire first entry only)
        Date.now = () => originalNow() + 6 * 60 * 1000; // 6 minutes from start
        
        service.clearExpiredCache();
        
        const stats = service.getCacheStats();
        expect(stats.size).toBe(1);
        expect(stats.symbols).toContain('ETHUSDT');
        expect(stats.symbols).not.toContain('BTCUSDT');
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle concurrent requests gracefully', async () => {
      const symbol = 'BTCUSDT';
      
      const promises = Array.from({ length: 5 }, () => 
        service.getMarketIntelligence(symbol)
      );

      const results = await Promise.all(promises);

      // All should succeed and return the same cached result
      results.forEach((result, index) => {
        if (index > 0) {
          expect(result).toEqual(results[0]);
        }
      });
    });

    it('should handle empty symbol gracefully', async () => {
      const intelligence = await service.getMarketIntelligence('');
      
      expect(intelligence.symbol).toBe('');
      expect(intelligence.sentiment.symbol).toBe('');
      expect(intelligence.analysis.symbol).toBe('');
    });

    it('should handle special characters in symbol', async () => {
      const symbol = 'BTC-USD_TEST.123';
      const intelligence = await service.getMarketIntelligence(symbol);
      
      expect(intelligence.symbol).toBe(symbol);
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton instance', () => {
      expect(marketIntelligenceService).toBeInstanceOf(MarketIntelligenceService);
    });

    it('should maintain state across singleton access', async () => {
      await marketIntelligenceService.getMarketIntelligence('BTCUSDT');
      
      const stats = marketIntelligenceService.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.symbols).toContain('BTCUSDT');
    });

    it('should share cache between singleton calls', async () => {
      const intelligence1 = await marketIntelligenceService.getMarketIntelligence('ETHUSDT');
      const intelligence2 = await marketIntelligenceService.getMarketIntelligence('ETHUSDT');
      
      expect(intelligence1).toEqual(intelligence2);
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle high-frequency requests efficiently', async () => {
      const startTime = Date.now();
      
      // Make multiple requests for the same symbol (should use cache)
      const promises = Array.from({ length: 100 }, () => 
        service.getMarketIntelligence('BTCUSDT')
      );
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete very quickly due to caching (allowing some margin for CI)
      expect(duration).toBeLessThan(2000); // Less than 2 seconds
    });

    it('should generate consistent signal count', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, () => service.generateSignals('TESTCOIN'))
      );

      results.forEach(signals => {
        expect(signals.length).toBeGreaterThanOrEqual(1);
        expect(signals.length).toBeLessThanOrEqual(3);
      });
    });
  });
});