/**
 * Unit tests for MEXC API Schemas and Type Definitions
 * Tests Zod schemas, TypeScript types, validation functions, and utility methods
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { z } from 'zod';
import {
  // Configuration Types
  UnifiedMexcConfig,
  MexcServiceResponse,

  // Zod Schemas
  CalendarEntrySchema,
  SymbolEntrySchema,
  BalanceEntrySchema,
  TradingFilterSchema,
  ExchangeSymbolSchema,
  ExchangeInfoSchema,
  TickerSchema,
  OrderParametersSchema,
  OrderResultSchema,
  OrderStatusSchema,
  OrderBookSchema,
  KlineSchema,
  MarketStatsSchema,
  PatternAnalysisSchema,
  TradingOpportunitySchema,
  PortfolioSchema,
  RiskAssessmentSchema,

  // Type Exports
  CalendarEntry,
  SymbolEntry,
  BalanceEntry,
  TradingFilter,
  ExchangeSymbol,
  ExchangeInfo,
  Ticker,
  OrderParameters,
  OrderResult,
  OrderStatus,
  OrderBook,
  Kline,
  MarketStats,
  PatternAnalysis,
  TradingOpportunity,
  Portfolio,
  RiskAssessment,

  // Schema Collections
  ALL_MEXC_SCHEMAS,
  MEXC_SCHEMA_NAMES,

  // Utility Functions
  validateMexcData,
  getMexcSchema,
  validateServiceResponse,
} from '../../../../src/services/api/mexc-schemas';

describe('MEXC API Schemas and Type Definitions', () => {
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods
    mockConsole = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    global.console.info = mockConsole.info;
    global.console.warn = mockConsole.warn;
    global.console.error = mockConsole.error;
    global.console.debug = mockConsole.debug;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration Types', () => {
    describe('UnifiedMexcConfig Interface', () => {
      it('should allow all optional configuration properties', () => {
        const config: UnifiedMexcConfig = {
          apiKey: 'test-api-key',
          secretKey: 'test-secret-key',
          passphrase: 'test-passphrase',
          baseUrl: 'https://api.mexc.com',
          timeout: 10000,
          maxRetries: 3,
          retryDelay: 1000,
          rateLimitDelay: 100,
          enableCaching: true,
          cacheTTL: 30000,
          enableCircuitBreaker: true,
          enableMetrics: true,
          enableEnhancedCaching: true,
          enablePerformanceMonitoring: true,
          apiResponseTTL: 1500,
        };

        expect(config).toBeDefined();
        expect(typeof config.apiKey).toBe('string');
        expect(typeof config.timeout).toBe('number');
        expect(typeof config.enableCaching).toBe('boolean');
      });

      it('should allow partial configuration', () => {
        const partialConfig: UnifiedMexcConfig = {
          apiKey: 'test-key',
          timeout: 5000,
        };

        expect(partialConfig.apiKey).toBe('test-key');
        expect(partialConfig.timeout).toBe(5000);
        expect(partialConfig.secretKey).toBeUndefined();
      });

      it('should allow empty configuration', () => {
        const emptyConfig: UnifiedMexcConfig = {};

        expect(emptyConfig).toBeDefined();
        expect(Object.keys(emptyConfig)).toHaveLength(0);
      });
    });

    describe('MexcServiceResponse Interface', () => {
      it('should allow valid service response structure', () => {
        const response: MexcServiceResponse<string> = {
          success: true,
          data: 'test-data',
          timestamp: '2024-01-01T00:00:00Z',
        };

        expect(response.success).toBe(true);
        expect(response.data).toBe('test-data');
        expect(response.timestamp).toBe('2024-01-01T00:00:00Z');
      });

      it('should allow error response structure', () => {
        const errorResponse: MexcServiceResponse = {
          success: false,
          error: 'Test error',
          code: 'ERROR_CODE',
          timestamp: '2024-01-01T00:00:00Z',
        };

        expect(errorResponse.success).toBe(false);
        expect(errorResponse.error).toBe('Test error');
        expect(errorResponse.code).toBe('ERROR_CODE');
      });

      it('should allow response with metadata', () => {
        const responseWithMetadata: MexcServiceResponse<number[]> = {
          success: true,
          data: [1, 2, 3],
          timestamp: '2024-01-01T00:00:00Z',
          requestId: 'req-123',
          responseTime: 150,
          cached: true,
          executionTimeMs: 250,
          retryCount: 1,
          metadata: { source: 'test', version: '1.0' },
        };

        expect(responseWithMetadata.metadata?.source).toBe('test');
        expect(responseWithMetadata.cached).toBe(true);
        expect(responseWithMetadata.retryCount).toBe(1);
      });
    });
  });

  describe('Core API Schemas', () => {
    describe('CalendarEntrySchema', () => {
      it('should validate correct calendar entry', () => {
        const validEntry = {
          vcoinId: 'btc-123',
          symbol: 'BTC',
          projectName: 'Bitcoin',
          firstOpenTime: 1640995200000,
        };

        const result = CalendarEntrySchema.parse(validEntry);

        expect(result).toEqual(validEntry);
      });

      it('should reject invalid calendar entry', () => {
        const invalidEntries = [
          { vcoinId: '', symbol: 'BTC', projectName: 'Bitcoin', firstOpenTime: 1640995200000 },
          { symbol: 'BTC', projectName: 'Bitcoin', firstOpenTime: 1640995200000 }, // Missing vcoinId
          { vcoinId: 'btc-123', symbol: 'BTC', projectName: 'Bitcoin' }, // Missing firstOpenTime
          { vcoinId: 'btc-123', symbol: 'BTC', projectName: 'Bitcoin', firstOpenTime: 'invalid' },
        ];

        invalidEntries.forEach(entry => {
          expect(() => CalendarEntrySchema.parse(entry)).toThrow();
        });
      });
    });

    describe('SymbolEntrySchema', () => {
      it('should validate correct symbol entry', () => {
        const validEntry = {
          cd: 'BTC',
          symbol: 'BTCUSDT',
          sts: 1,
          st: 1640995200000,
          tt: 1640995200000,
          ca: 0.1,
          ps: 1000,
          qs: 0.001,
          ot: { extraInfo: 'test' },
        };

        const result = SymbolEntrySchema.parse(validEntry);

        expect(result).toEqual(validEntry);
      });

      it('should validate minimal symbol entry', () => {
        const minimalEntry = {
          cd: 'BTC',
          sts: 1,
          st: 1640995200000,
          tt: 1640995200000,
        };

        const result = SymbolEntrySchema.parse(minimalEntry);

        expect(result.cd).toBe('BTC');
        expect(result.sts).toBe(1);
      });

      it('should reject invalid symbol entry', () => {
        const invalidEntries = [
          { sts: 1, st: 1640995200000, tt: 1640995200000 }, // Missing cd
          { cd: 'BTC', st: 1640995200000, tt: 1640995200000 }, // Missing sts
          { cd: 'BTC', sts: 'invalid', st: 1640995200000, tt: 1640995200000 },
        ];

        invalidEntries.forEach(entry => {
          expect(() => SymbolEntrySchema.parse(entry)).toThrow();
        });
      });
    });

    describe('BalanceEntrySchema', () => {
      it('should validate correct balance entry', () => {
        const validEntry = {
          asset: 'BTC',
          free: '1.5',
          locked: '0.5',
          total: 2.0,
          usdtValue: 45000.0,
        };

        const result = BalanceEntrySchema.parse(validEntry);

        expect(result).toEqual(validEntry);
      });

      it('should validate balance entry without optional fields', () => {
        const minimalEntry = {
          asset: 'ETH',
          free: '10.0',
          locked: '2.0',
          total: 12.0,
        };

        const result = BalanceEntrySchema.parse(minimalEntry);

        expect(result.asset).toBe('ETH');
        expect(result.usdtValue).toBeUndefined();
      });

      it('should reject invalid balance entry', () => {
        const invalidEntries = [
          { free: '1.5', locked: '0.5', total: 2.0 }, // Missing asset
          { asset: 'BTC', locked: '0.5', total: 2.0 }, // Missing free
          { asset: 'BTC', free: '1.5', total: 2.0 }, // Missing locked
          { asset: 'BTC', free: '1.5', locked: '0.5' }, // Missing total
          { asset: 'BTC', free: 1.5, locked: '0.5', total: 2.0 }, // Wrong type for free
        ];

        invalidEntries.forEach(entry => {
          expect(() => BalanceEntrySchema.parse(entry)).toThrow();
        });
      });
    });

    describe('TradingFilterSchema', () => {
      it('should validate trading filter with all fields', () => {
        const validFilter = {
          filterType: 'PRICE_FILTER',
          minPrice: '0.00001',
          maxPrice: '100000',
          tickSize: '0.00001',
          minQty: '0.001',
          maxQty: '10000',
          stepSize: '0.001',
          minNotional: '10',
          maxNotional: '100000',
          multiplierUp: '1.1',
          multiplierDown: '0.9',
          avgPriceMins: 5,
        };

        const result = TradingFilterSchema.parse(validFilter);

        expect(result).toEqual(validFilter);
      });

      it('should validate minimal trading filter', () => {
        const minimalFilter = {
          filterType: 'LOT_SIZE',
        };

        const result = TradingFilterSchema.parse(minimalFilter);

        expect(result.filterType).toBe('LOT_SIZE');
      });
    });

    describe('ExchangeSymbolSchema', () => {
      it('should validate complete exchange symbol', () => {
        const validSymbol = {
          symbol: 'BTCUSDT',
          status: 'TRADING',
          baseAsset: 'BTC',
          quoteAsset: 'USDT',
          baseAssetPrecision: 8,
          quotePrecision: 8,
          quoteAssetPrecision: 8,
          baseCommissionPrecision: 8,
          quoteCommissionPrecision: 8,
          orderTypes: ['LIMIT', 'MARKET'],
          icebergAllowed: true,
          ocoAllowed: false,
          quoteOrderQtyMarketAllowed: true,
          allowTrailingStop: false,
          isSpotTradingAllowed: true,
          isMarginTradingAllowed: false,
          filters: [
            { filterType: 'PRICE_FILTER', minPrice: '0.01', maxPrice: '100000' },
          ],
          permissions: ['SPOT'],
        };

        const result = ExchangeSymbolSchema.parse(validSymbol);

        expect(result.symbol).toBe('BTCUSDT');
        expect(result.baseAsset).toBe('BTC');
        expect(result.filters).toHaveLength(1);
      });

      it('should validate minimal exchange symbol', () => {
        const minimalSymbol = {
          symbol: 'ETHUSDT',
          status: 'TRADING',
          baseAsset: 'ETH',
          quoteAsset: 'USDT',
          baseAssetPrecision: 8,
          quotePrecision: 8,
          quoteAssetPrecision: 8,
        };

        const result = ExchangeSymbolSchema.parse(minimalSymbol);

        expect(result.symbol).toBe('ETHUSDT');
        expect(result.permissions).toBeUndefined();
      });
    });

    describe('OrderParametersSchema', () => {
      it('should validate buy limit order', () => {
        const buyOrder = {
          symbol: 'BTCUSDT',
          side: 'BUY' as const,
          type: 'LIMIT' as const,
          quantity: '0.001',
          price: '45000',
          timeInForce: 'GTC' as const,
        };

        const result = OrderParametersSchema.parse(buyOrder);

        expect(result.side).toBe('BUY');
        expect(result.type).toBe('LIMIT');
      });

      it('should validate sell market order', () => {
        const sellOrder = {
          symbol: 'ETHUSDT',
          side: 'SELL' as const,
          type: 'MARKET' as const,
          quantity: '1.0',
        };

        const result = OrderParametersSchema.parse(sellOrder);

        expect(result.side).toBe('SELL');
        expect(result.type).toBe('MARKET');
        expect(result.price).toBeUndefined();
      });

      it('should reject invalid order parameters', () => {
        const invalidOrders = [
          { side: 'BUY', type: 'LIMIT', quantity: '0.001' }, // Missing symbol
          { symbol: 'BTCUSDT', type: 'LIMIT', quantity: '0.001' }, // Missing side
          { symbol: 'BTCUSDT', side: 'INVALID', type: 'LIMIT', quantity: '0.001' },
          { symbol: 'BTCUSDT', side: 'BUY', type: 'INVALID', quantity: '0.001' },
          { symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT' }, // Missing quantity
        ];

        invalidOrders.forEach(order => {
          expect(() => OrderParametersSchema.parse(order)).toThrow();
        });
      });
    });

    describe('OrderStatusSchema', () => {
      it('should validate complete order status', () => {
        const orderStatus = {
          orderId: 'order-123',
          symbol: 'BTCUSDT',
          status: 'FILLED' as const,
          side: 'BUY' as const,
          type: 'LIMIT' as const,
          quantity: '0.001',
          price: '45000',
          stopPrice: '44000',
          executedQty: '0.001',
          cummulativeQuoteQty: '45.0',
          time: 1640995200000,
          updateTime: 1640995300000,
        };

        const result = OrderStatusSchema.parse(orderStatus);

        expect(result.status).toBe('FILLED');
        expect(result.executedQty).toBe('0.001');
      });

      it('should reject invalid order status', () => {
        const invalidStatuses = [
          'INVALID_STATUS',
          'PENDING',
          'PROCESSING',
        ];

        invalidStatuses.forEach(status => {
          const invalidOrder = {
            orderId: 'order-123',
            symbol: 'BTCUSDT',
            status,
            side: 'BUY',
            type: 'LIMIT',
            quantity: '0.001',
            executedQty: '0.001',
            cummulativeQuoteQty: '45.0',
            time: 1640995200000,
            updateTime: 1640995300000,
          };

          expect(() => OrderStatusSchema.parse(invalidOrder)).toThrow();
        });
      });
    });

    describe('TickerSchema', () => {
      it('should validate complete ticker data', () => {
        const ticker = {
          symbol: 'BTCUSDT',
          lastPrice: '45000',
          price: '45000',
          priceChange: '1000',
          priceChangePercent: '2.27',
          volume: '1000.5',
          quoteVolume: '45000000',
          openPrice: '44000',
          highPrice: '46000',
          lowPrice: '43000',
          count: '50000',
        };

        const result = TickerSchema.parse(ticker);

        expect(result.symbol).toBe('BTCUSDT');
        expect(result.priceChangePercent).toBe('2.27');
      });

      it('should validate minimal ticker data', () => {
        const minimalTicker = {
          symbol: 'ETHUSDT',
          lastPrice: '3000',
          price: '3000',
          priceChange: '50',
          priceChangePercent: '1.69',
          volume: '500.0',
        };

        const result = TickerSchema.parse(minimalTicker);

        expect(result.symbol).toBe('ETHUSDT');
        expect(result.quoteVolume).toBeUndefined();
      });
    });
  });

  describe('Advanced Analytics Schemas', () => {
    describe('PatternAnalysisSchema', () => {
      it('should validate pattern analysis result', () => {
        const patternAnalysis = {
          symbol: 'BTCUSDT',
          pattern: 'ready_state' as const,
          confidence: 85,
          strength: 7.5,
          timeframe: '1h',
          signals: [
            {
              type: 'volume_surge',
              strength: 8.0,
              description: 'High volume detected',
            },
          ],
          recommendations: ['Consider entry', 'Monitor closely'],
          riskFactors: ['High volatility', 'Market uncertainty'],
        };

        const result = PatternAnalysisSchema.parse(patternAnalysis);

        expect(result.pattern).toBe('ready_state');
        expect(result.confidence).toBe(85);
        expect(result.signals).toHaveLength(1);
      });

      it('should reject invalid pattern analysis', () => {
        const invalidAnalyses = [
          {
            symbol: 'BTCUSDT',
            pattern: 'invalid_pattern',
            confidence: 85,
            strength: 7.5,
            timeframe: '1h',
            signals: [],
            recommendations: [],
            riskFactors: [],
          },
          {
            symbol: 'BTCUSDT',
            pattern: 'ready_state',
            confidence: 105, // Invalid confidence > 100
            strength: 7.5,
            timeframe: '1h',
            signals: [],
            recommendations: [],
            riskFactors: [],
          },
          {
            symbol: 'BTCUSDT',
            pattern: 'ready_state',
            confidence: 85,
            strength: 15, // Invalid strength > 10
            timeframe: '1h',
            signals: [],
            recommendations: [],
            riskFactors: [],
          },
        ];

        invalidAnalyses.forEach(analysis => {
          expect(() => PatternAnalysisSchema.parse(analysis)).toThrow();
        });
      });
    });

    describe('TradingOpportunitySchema', () => {
      it('should validate trading opportunity', () => {
        const opportunity = {
          symbol: 'ETHUSDT',
          type: 'buy' as const,
          confidence: 75,
          expectedReturn: 0.15,
          riskLevel: 'medium' as const,
          timeHorizon: 'short' as const,
          entryPrice: 3000,
          exitPrice: 3450,
          stopLoss: 2850,
          reasoning: 'Technical breakout pattern detected',
          indicators: [
            {
              name: 'RSI',
              value: 65,
              signal: 'bullish' as const,
            },
          ],
        };

        const result = TradingOpportunitySchema.parse(opportunity);

        expect(result.type).toBe('buy');
        expect(result.riskLevel).toBe('medium');
        expect(result.indicators).toHaveLength(1);
      });

      it('should reject invalid trading opportunity', () => {
        const invalidOpportunities = [
          {
            symbol: 'ETHUSDT',
            type: 'invalid_type',
            confidence: 75,
            expectedReturn: 0.15,
            riskLevel: 'medium',
            timeHorizon: 'short',
            entryPrice: 3000,
            exitPrice: 3450,
            stopLoss: 2850,
            reasoning: 'Test',
            indicators: [],
          },
          {
            symbol: 'ETHUSDT',
            type: 'buy',
            confidence: 150, // Invalid confidence
            expectedReturn: 0.15,
            riskLevel: 'medium',
            timeHorizon: 'short',
            entryPrice: 3000,
            exitPrice: 3450,
            stopLoss: 2850,
            reasoning: 'Test',
            indicators: [],
          },
        ];

        invalidOpportunities.forEach(opportunity => {
          expect(() => TradingOpportunitySchema.parse(opportunity)).toThrow();
        });
      });
    });

    describe('RiskAssessmentSchema', () => {
      it('should validate risk assessment', () => {
        const riskAssessment = {
          overallRisk: 'medium' as const,
          factors: {
            marketVolatility: 0.75,
            positionSize: 0.25,
            correlation: 0.6,
            liquidityRisk: 0.3,
          },
          recommendations: ['Reduce position size', 'Set tight stop loss'],
          maxPositionSize: 0.1,
          suggestedStopLoss: 0.05,
        };

        const result = RiskAssessmentSchema.parse(riskAssessment);

        expect(result.overallRisk).toBe('medium');
        expect(result.factors.marketVolatility).toBe(0.75);
        expect(result.recommendations).toHaveLength(2);
      });

      it('should reject invalid risk assessment', () => {
        const invalidRisk = {
          overallRisk: 'invalid_risk',
          factors: {
            marketVolatility: 0.75,
            positionSize: 0.25,
            correlation: 0.6,
            liquidityRisk: 0.3,
          },
          recommendations: [],
          maxPositionSize: 0.1,
          suggestedStopLoss: 0.05,
        };

        expect(() => RiskAssessmentSchema.parse(invalidRisk)).toThrow();
      });
    });
  });

  describe('Schema Collections', () => {
    describe('ALL_MEXC_SCHEMAS', () => {
      it('should contain all defined schemas', () => {
        const expectedSchemas = [
          'CalendarEntrySchema',
          'SymbolEntrySchema',
          'BalanceEntrySchema',
          'TradingFilterSchema',
          'ExchangeSymbolSchema',
          'ExchangeInfoSchema',
          'TickerSchema',
          'OrderParametersSchema',
          'OrderResultSchema',
          'OrderStatusSchema',
          'OrderBookSchema',
          'KlineSchema',
          'MarketStatsSchema',
          'PatternAnalysisSchema',
          'TradingOpportunitySchema',
          'PortfolioSchema',
          'RiskAssessmentSchema',
        ];

        expectedSchemas.forEach(schemaName => {
          expect(ALL_MEXC_SCHEMAS).toHaveProperty(schemaName);
          expect(ALL_MEXC_SCHEMAS[schemaName as keyof typeof ALL_MEXC_SCHEMAS]).toBeDefined();
        });

        expect(Object.keys(ALL_MEXC_SCHEMAS)).toHaveLength(expectedSchemas.length);
      });

      it('should have all schemas as Zod schemas', () => {
        Object.values(ALL_MEXC_SCHEMAS).forEach(schema => {
          expect(schema).toBeInstanceOf(z.ZodSchema);
        });
      });
    });

    describe('MEXC_SCHEMA_NAMES', () => {
      it('should contain all schema names', () => {
        expect(MEXC_SCHEMA_NAMES).toEqual(Object.keys(ALL_MEXC_SCHEMAS));
      });

      it('should be an array of strings', () => {
        expect(Array.isArray(MEXC_SCHEMA_NAMES)).toBe(true);
        MEXC_SCHEMA_NAMES.forEach(name => {
          expect(typeof name).toBe('string');
        });
      });
    });
  });

  describe('Utility Functions', () => {
    describe('validateMexcData', () => {
      it('should validate correct data successfully', () => {
        const validCalendarEntry = {
          vcoinId: 'btc-123',
          symbol: 'BTC',
          projectName: 'Bitcoin',
          firstOpenTime: 1640995200000,
        };

        const result = validateMexcData(CalendarEntrySchema, validCalendarEntry);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(validCalendarEntry);
        expect(result.error).toBeUndefined();
      });

      it('should handle validation errors', () => {
        const invalidData = {
          vcoinId: '', // Invalid empty string
          symbol: 'BTC',
          projectName: 'Bitcoin',
          firstOpenTime: 1640995200000,
        };

        const result = validateMexcData(CalendarEntrySchema, invalidData);

        expect(result.success).toBe(false);
        expect(result.data).toBeUndefined();
        expect(result.error).toContain('Validation failed');
      });

      it('should handle unknown validation errors', () => {
        const faultySchema = z.object({}).refine(() => {
          throw new Error('Custom error');
        });

        const result = validateMexcData(faultySchema, {});

        expect(result.success).toBe(false);
        expect(result.error).toBe('Custom error');
      });

      it('should handle non-Error exceptions', () => {
        const faultySchema = z.object({}).refine(() => {
          throw 'String error';
        });

        const result = validateMexcData(faultySchema, {});

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unknown validation error');
      });
    });

    describe('getMexcSchema', () => {
      it('should return correct schema by name', () => {
        const calendarSchema = getMexcSchema('CalendarEntrySchema');
        const symbolSchema = getMexcSchema('SymbolEntrySchema');

        expect(calendarSchema).toBe(CalendarEntrySchema);
        expect(symbolSchema).toBe(SymbolEntrySchema);
      });

      it('should work with all schema names', () => {
        MEXC_SCHEMA_NAMES.forEach(schemaName => {
          const schema = getMexcSchema(schemaName);
          expect(schema).toBeDefined();
          expect(schema).toBeInstanceOf(z.ZodSchema);
        });
      });
    });

    describe('validateServiceResponse', () => {
      it('should validate valid service response without data schema', () => {
        const validResponse = {
          success: true,
          data: { test: 'data' },
          timestamp: '2024-01-01T00:00:00Z',
        };

        const result = validateServiceResponse(validResponse);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(validResponse);
        expect(result.error).toBeUndefined();
      });

      it('should validate service response with data schema', () => {
        const validResponse = {
          success: true,
          data: {
            vcoinId: 'btc-123',
            symbol: 'BTC',
            projectName: 'Bitcoin',
            firstOpenTime: 1640995200000,
          },
          timestamp: '2024-01-01T00:00:00Z',
        };

        const result = validateServiceResponse(validResponse, CalendarEntrySchema);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(validResponse);
      });

      it('should validate error response', () => {
        const errorResponse = {
          success: false,
          error: 'API Error',
          code: 'ERR_001',
          timestamp: '2024-01-01T00:00:00Z',
        };

        const result = validateServiceResponse(errorResponse);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(errorResponse);
      });

      it('should validate response with optional fields', () => {
        const responseWithOptionals = {
          success: true,
          data: 'test-data',
          timestamp: '2024-01-01T00:00:00Z',
          requestId: 'req-123',
          responseTime: 150,
          cached: true,
          executionTimeMs: 250,
          retryCount: 1,
          metadata: { source: 'test' },
        };

        const result = validateServiceResponse(responseWithOptionals);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(responseWithOptionals);
      });

      it('should handle invalid service response', () => {
        const invalidResponse = {
          // Missing required fields
          data: 'test-data',
        };

        const result = validateServiceResponse(invalidResponse);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Validation failed');
      });

      it('should handle response with invalid data when schema provided', () => {
        const responseWithInvalidData = {
          success: true,
          data: {
            vcoinId: '', // Invalid empty string
            symbol: 'BTC',
            projectName: 'Bitcoin',
            firstOpenTime: 1640995200000,
          },
          timestamp: '2024-01-01T00:00:00Z',
        };

        const result = validateServiceResponse(responseWithInvalidData, CalendarEntrySchema);

        expect(result.success).toBe(true); // Base response is valid, data validation is optional
        expect(result.data).toEqual(responseWithInvalidData);
      });
    });
  });

  describe('Type Exports', () => {
    it('should export all expected types', () => {
      // Test that types exist by creating instances
      const calendarEntry: CalendarEntry = {
        vcoinId: 'btc-123',
        symbol: 'BTC',
        projectName: 'Bitcoin',
        firstOpenTime: 1640995200000,
      };

      const symbolEntry: SymbolEntry = {
        cd: 'BTC',
        sts: 1,
        st: 1640995200000,
        tt: 1640995200000,
      };

      const balanceEntry: BalanceEntry = {
        asset: 'BTC',
        free: '1.0',
        locked: '0.0',
        total: 1.0,
      };

      expect(calendarEntry.symbol).toBe('BTC');
      expect(symbolEntry.cd).toBe('BTC');
      expect(balanceEntry.asset).toBe('BTC');
    });

    it('should have proper type inference from schemas', () => {
      type InferredCalendarEntry = z.infer<typeof CalendarEntrySchema>;
      type InferredSymbolEntry = z.infer<typeof SymbolEntrySchema>;

      const calendarEntry: InferredCalendarEntry = {
        vcoinId: 'btc-123',
        symbol: 'BTC',
        projectName: 'Bitcoin',
        firstOpenTime: 1640995200000,
      };

      const symbolEntry: InferredSymbolEntry = {
        cd: 'ETH',
        sts: 1,
        st: 1640995200000,
        tt: 1640995200000,
      };

      expect(calendarEntry.vcoinId).toBe('btc-123');
      expect(symbolEntry.cd).toBe('ETH');
    });
  });

  describe('Schema Edge Cases', () => {
    it('should handle empty arrays in schemas', () => {
      const exchangeInfo = {
        timezone: 'UTC',
        serverTime: 1640995200000,
        symbols: [], // Empty array
      };

      const result = ExchangeInfoSchema.parse(exchangeInfo);

      expect(result.symbols).toHaveLength(0);
    });

    it('should handle optional fields correctly', () => {
      const minimalTicker = {
        symbol: 'BTCUSDT',
        lastPrice: '45000',
        price: '45000',
        priceChange: '1000',
        priceChangePercent: '2.27',
        volume: '1000.5',
      };

      const result = TickerSchema.parse(minimalTicker);

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.openPrice).toBeUndefined();
      expect(result.highPrice).toBeUndefined();
    });

    it('should handle complex nested objects', () => {
      const complexPortfolio = {
        totalValue: 100000,
        totalValueBTC: 2.5,
        totalUsdtValue: 100000,
        balances: [
          {
            asset: 'BTC',
            free: '1.0',
            locked: '0.5',
            total: 1.5,
            usdtValue: 67500,
          },
          {
            asset: 'ETH',
            free: '10.0',
            locked: '2.0',
            total: 12.0,
            usdtValue: 32500,
          },
        ],
        allocation: {
          BTC: 0.675,
          ETH: 0.325,
        },
        performance24h: {
          change: 2500,
          changePercent: 2.56,
        },
      };

      const result = PortfolioSchema.parse(complexPortfolio);

      expect(result.balances).toHaveLength(2);
      expect(result.allocation.BTC).toBe(0.675);
      expect(result.performance24h.changePercent).toBe(2.56);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large arrays efficiently', () => {
      const largeSymbolArray = Array.from({ length: 1000 }, (_, i) => ({
        cd: `TOKEN${i}`,
        sts: 1,
        st: 1640995200000 + i,
        tt: 1640995200000 + i,
      }));

      const startTime = Date.now();
      const result = z.array(SymbolEntrySchema).parse(largeSymbolArray);
      const endTime = Date.now();

      expect(result).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle repeated validations efficiently', () => {
      const testData = {
        vcoinId: 'btc-123',
        symbol: 'BTC',
        projectName: 'Bitcoin',
        firstOpenTime: 1640995200000,
      };

      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        CalendarEntrySchema.parse(testData);
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});