/**
 * Test Suite for Extracted MEXC Schemas
 * 
 * Following TDD approach: writing tests before extracting schemas
 * from the monolithic unified-mexc-service.ts file
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  BalanceEntrySchema,
  CalendarEntrySchema,
  MexcServiceResponseSchema,
  OrderBookSchema,
  OrderParametersSchema,
  SymbolEntrySchema,
  TickerSchema,
} from "@/src/schemas/unified/mexc-api-schemas"

describe('MEXC Schemas - TDD Extraction Tests', () => {
  describe('CalendarEntrySchema', () => {
    it('should validate valid calendar entry', () => {
      const validEntry = {
        vcoinId: 'vcoin-12345',
        symbol: 'TESTUSDT',
        projectName: 'Test Project',
        firstOpenTime: Date.now()
      };

      expect(() => {
        CalendarEntrySchema.parse(validEntry);
      }).not.toThrow();
    });

    it('should reject invalid calendar entry missing required fields', () => {
      const invalidEntry = {
        vcoinId: 'vcoin-12345',
        // missing symbol, projectName, firstOpenTime
      };

      expect(() => {
        CalendarEntrySchema.parse(invalidEntry);
      }).toThrow();
    });

    it('should reject invalid calendar entry with wrong types', () => {
      const invalidEntry = {
        vcoinId: 123, // should be string
        symbol: 'TESTUSDT',
        projectName: 'Test Project',
        firstOpenTime: 'invalid-time' // should be number
      };

      expect(() => {
        CalendarEntrySchema.parse(invalidEntry);
      }).toThrow();
    });
  });

  describe('SymbolEntrySchema', () => {
    it('should validate valid symbol entry with all fields', () => {
      const validEntry = {
        cd: 'BTCUSDT',
        symbol: 'BTCUSDT',
        sts: 2,
        st: 2,
        tt: 4,
        ca: '0x1234567890abcdef', // Contract address should be a string
        ps: 100,
        qs: 50,
        ot: 1640995200000 // Open Time - number timestamp
      };

      expect(() => {
        SymbolEntrySchema.parse(validEntry);
      }).not.toThrow();
    });

    it('should validate valid symbol entry with only required fields', () => {
      const validEntry = {
        cd: 'BTCUSDT',
        sts: 2,
        st: 2,
        tt: 4
      };

      expect(() => {
        SymbolEntrySchema.parse(validEntry);
      }).not.toThrow();
    });

    it('should reject symbol entry missing required fields', () => {
      const invalidEntry = {
        cd: 'BTCUSDT',
        // missing sts, st, tt
      };

      expect(() => {
        SymbolEntrySchema.parse(invalidEntry);
      }).toThrow();
    });
  });

  describe('BalanceEntrySchema', () => {
    it('should validate valid balance entry', () => {
      const validEntry = {
        asset: 'USDT',
        free: '1000.50',
        locked: '100.25',
        total: 1100.75,
        usdtValue: 1100.75
      };

      expect(() => {
        BalanceEntrySchema.parse(validEntry);
      }).not.toThrow();
    });

    it('should validate balance entry without optional usdtValue', () => {
      const validEntry = {
        asset: 'BTC',
        free: '0.5',
        locked: '0.1',
        total: 0.6
      };

      expect(() => {
        BalanceEntrySchema.parse(validEntry);
      }).not.toThrow();
    });

    it('should reject balance entry with invalid types', () => {
      const invalidEntry = {
        asset: 'USDT',
        free: 1000.50, // should be string
        locked: 100.25, // should be string
        total: '1100.75' // should be number
      };

      expect(() => {
        BalanceEntrySchema.parse(invalidEntry);
      }).toThrow();
    });
  });

  describe('TickerSchema', () => {
    it('should validate valid ticker data', () => {
      const validTicker = {
        symbol: 'BTCUSDT',
        lastPrice: '45000.50',
        price: '45000.50',
        priceChange: '500.25',
        priceChangePercent: '1.12',
        volume: '1234.567',
        count: '8765',
        highPrice: '46000.00',
        lowPrice: '44000.00'
      };

      expect(() => {
        TickerSchema.parse(validTicker);
      }).not.toThrow();
    });

    it('should reject ticker with missing required fields', () => {
      const invalidTicker = {
        symbol: 'BTCUSDT',
        lastPrice: '45000.50'
        // missing other required fields
      };

      expect(() => {
        TickerSchema.parse(invalidTicker);
      }).toThrow();
    });
  });

  describe('OrderBookSchema', () => {
    it('should validate valid order book data', () => {
      const validOrderBook = {
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        bids: [['45000.50', '1.234'], ['45000.25', '2.567']],
        asks: [['45000.75', '0.891'], ['45001.00', '1.445']]
      };

      expect(() => {
        OrderBookSchema.parse(validOrderBook);
      }).not.toThrow();
    });

    it('should reject order book with invalid bid/ask format', () => {
      const invalidOrderBook = {
        symbol: 'BTCUSDT',
        timestamp: Date.now(),
        bids: [['invalid'], [45000.25, 2.567]], // invalid format
        asks: [['45000.75', '0.891']]
      };

      expect(() => {
        OrderBookSchema.parse(invalidOrderBook);
      }).toThrow();
    });
  });

  describe('MexcServiceResponse Schema', () => {
    it('should validate successful response', () => {
      const successResponse = {
        success: true,
        data: { result: 'test' },
        timestamp: new Date().toISOString(),
        requestId: 'req-123',
        responseTime: 150,
        cached: false,
        executionTimeMs: 145,
        retryCount: 0
      };

      expect(() => {
        MexcServiceResponseSchema.parse(successResponse);
      }).not.toThrow();
    });

    it('should validate error response', () => {
      const errorResponse = {
        success: false,
        error: 'API Error',
        code: 'MEXC_ERROR_001',
        timestamp: new Date().toISOString(),
        responseTime: 200,
        retryCount: 2
      };

      expect(() => {
        MexcServiceResponseSchema.parse(errorResponse);
      }).not.toThrow();
    });

    it('should reject response without required fields', () => {
      const invalidResponse = {
        data: { result: 'test' }
        // missing success and timestamp
      };

      expect(() => {
        MexcServiceResponseSchema.parse(invalidResponse);
      }).toThrow();
    });
  });

  describe('OrderParametersSchema', () => {
    it('should validate market buy order', () => {
      const marketBuy = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quantity: '0.001',
        timestamp: Date.now()
      };

      expect(() => {
        OrderParametersSchema.parse(marketBuy);
      }).not.toThrow();
    });

    it('should validate limit sell order', () => {
      const limitSell = {
        symbol: 'BTCUSDT',
        side: 'SELL' as const,
        type: 'LIMIT' as const,
        quantity: '0.001',
        price: '45000.50',
        timeInForce: 'GTC' as const,
        timestamp: Date.now()
      };

      expect(() => {
        OrderParametersSchema.parse(limitSell);
      }).not.toThrow();
    });

    it('should reject order with invalid side', () => {
      const invalidOrder = {
        symbol: 'BTCUSDT',
        side: 'INVALID_SIDE',
        type: 'MARKET',
        quantity: '0.001',
        timestamp: Date.now()
      };

      expect(() => {
        OrderParametersSchema.parse(invalidOrder);
      }).toThrow();
    });
  });
});