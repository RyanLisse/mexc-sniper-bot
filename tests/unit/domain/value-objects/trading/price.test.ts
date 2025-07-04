/**
 * Unit tests for Price Value Object
 * Tests price creation, comparison, calculations, and business logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Price } from '../../../../../src/domain/value-objects/trading/price';
import { DomainValidationError } from '../../../../../src/domain/errors/trading-errors';

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../../utils/timeout-elimination-helpers';

describe('Price Value Object', () => {
  let validPrice: Price;
  let sameSymbolPrice: Price;
  let differentSymbolPrice: Price;

  beforeEach(() => {
    validPrice = Price.create(50000, 'BTCUSDT', 'exchange', 2);
    sameSymbolPrice = Price.create(55000, 'BTCUSDT', 'exchange', 2);
    differentSymbolPrice = Price.create(3000, 'ETHUSDT', 'exchange', 2);
  });

  describe('Price Creation', () => {
    it('should create price with all parameters', () => {
      const timestamp = new Date();
      const price = Price.create(50000, 'BTCUSDT', 'binance', 8, timestamp);

      expect(price.value).toBe(50000);
      expect(price.symbol).toBe('BTCUSDT');
      expect(price.source).toBe('binance');
      expect(price.precision).toBe(8);
      expect(price.timestamp).toBe(timestamp);
    });

    it('should create price with minimal parameters', () => {
      const price = Price.create(50000, 'BTCUSDT');

      expect(price.value).toBe(50000);
      expect(price.symbol).toBe('BTCUSDT');
      expect(price.source).toBe('unknown');
      expect(price.precision).toBe(8);
      expect(price.timestamp).toBeInstanceOf(Date);
    });

    it('should convert symbol to uppercase', () => {
      const price = Price.create(50000, 'btcusdt');

      expect(price.symbol).toBe('BTCUSDT');
    });

    it('should round value to specified precision', () => {
      const price = Price.create(50000.123456789, 'BTCUSDT', 'exchange', 4);

      expect(price.value).toBe(50000.1235);
      expect(price.precision).toBe(4);
    });

    it('should reject negative values', () => {
      expect(() => Price.create(-50000, 'BTCUSDT')).toThrow(DomainValidationError);
    });

    it('should reject zero values', () => {
      expect(() => Price.create(0, 'BTCUSDT')).toThrow(DomainValidationError);
    });

    it('should reject infinite values', () => {
      expect(() => Price.create(Number.POSITIVE_INFINITY, 'BTCUSDT')).toThrow(DomainValidationError);
    });

    it('should reject NaN values', () => {
      expect(() => Price.create(Number.NaN, 'BTCUSDT')).toThrow(DomainValidationError);
    });

    it('should reject empty symbol', () => {
      expect(() => Price.create(50000, '')).toThrow(DomainValidationError);
    });

    it('should reject empty source', () => {
      expect(() => Price.create(50000, 'BTCUSDT', '')).toThrow(DomainValidationError);
    });

    it('should reject invalid precision', () => {
      expect(() => Price.create(50000, 'BTCUSDT', 'exchange', -1)).toThrow(DomainValidationError);
      expect(() => Price.create(50000, 'BTCUSDT', 'exchange', 19)).toThrow(DomainValidationError);
    });
  });

  describe('Price from String', () => {
    it('should create price from valid string', () => {
      const price = Price.fromString('50000.25', 'BTCUSDT', 'exchange', 2);

      expect(price.value).toBe(50000.25);
      expect(price.symbol).toBe('BTCUSDT');
    });

    it('should handle integer string', () => {
      const price = Price.fromString('50000', 'BTCUSDT');

      expect(price.value).toBe(50000);
    });

    it('should reject invalid string', () => {
      expect(() => Price.fromString('not-a-number', 'BTCUSDT')).toThrow(DomainValidationError);
    });

    it('should reject empty string', () => {
      expect(() => Price.fromString('', 'BTCUSDT')).toThrow(DomainValidationError);
    });
  });

  describe('Price Comparison', () => {
    it('should compare prices correctly', () => {
      expect(sameSymbolPrice.isHigherThan(validPrice)).toBe(true);
      expect(validPrice.isHigherThan(sameSymbolPrice)).toBe(false);
      expect(validPrice.isLowerThan(sameSymbolPrice)).toBe(true);
      expect(sameSymbolPrice.isLowerThan(validPrice)).toBe(false);
    });

    it('should handle equal prices', () => {
      const samePrice = Price.create(50000, 'BTCUSDT', 'exchange', 2);
      
      expect(validPrice.isEqualTo(samePrice)).toBe(true);
      expect(validPrice.isHigherThan(samePrice)).toBe(false);
      expect(validPrice.isLowerThan(samePrice)).toBe(false);
    });

    it('should handle precision differences in equality', () => {
      const price1 = Price.create(50000.001, 'BTCUSDT', 'exchange', 2);
      const price2 = Price.create(50000.002, 'BTCUSDT', 'exchange', 2);
      
      // Both should be rounded to 50000.00 and therefore equal
      expect(price1.value).toBe(50000);
      expect(price2.value).toBe(50000);
      expect(price1.isEqualTo(price2)).toBe(true);
    });

    it('should reject comparison with different symbols', () => {
      expect(() => validPrice.isHigherThan(differentSymbolPrice)).toThrow(DomainValidationError);
      expect(() => validPrice.isLowerThan(differentSymbolPrice)).toThrow(DomainValidationError);
      expect(() => validPrice.isEqualTo(differentSymbolPrice)).toThrow(DomainValidationError);
    });
  });

  describe('Price Calculations', () => {
    it('should calculate percentage difference correctly', () => {
      const percentage = sameSymbolPrice.percentageDifferenceFrom(validPrice);
      
      expect(percentage).toBe(10); // (55000 - 50000) / 50000 * 100 = 10%
    });

    it('should calculate negative percentage difference', () => {
      const percentage = validPrice.percentageDifferenceFrom(sameSymbolPrice);
      
      expect(percentage).toBe(-9.090909090909092); // (50000 - 55000) / 55000 * 100
    });

    it('should reject percentage calculation with zero price', () => {
      const zeroPrice = Price.fromExisting({
        value: 1, // Can't create with zero, so we'll mock it
        symbol: 'BTCUSDT',
        timestamp: new Date(),
        source: 'exchange',
        precision: 2,
      });
      
      // Manually set value to 0 for testing - this is a bit of a hack
      (zeroPrice as any).props.value = 0;
      
      expect(() => validPrice.percentageDifferenceFrom(zeroPrice)).toThrow(DomainValidationError);
    });

    it('should calculate absolute difference', () => {
      const difference = sameSymbolPrice.absoluteDifferenceFrom(validPrice);
      
      expect(difference).toBe(5000);
    });

    it('should check if price is within percentage range', () => {
      expect(validPrice.isWithinPercentageOf(sameSymbolPrice, 15)).toBe(true);
      expect(validPrice.isWithinPercentageOf(sameSymbolPrice, 5)).toBe(false);
    });

    it('should calculate stop loss price', () => {
      const stopLoss = validPrice.calculateStopLoss(10); // 10% stop loss
      
      expect(stopLoss.value).toBe(45000); // 50000 * (1 - 0.1) = 45000
      expect(stopLoss.symbol).toBe('BTCUSDT');
    });

    it('should reject invalid stop loss percentage', () => {
      expect(() => validPrice.calculateStopLoss(0)).toThrow(DomainValidationError);
      expect(() => validPrice.calculateStopLoss(100)).toThrow(DomainValidationError);
      expect(() => validPrice.calculateStopLoss(-10)).toThrow(DomainValidationError);
    });

    it('should calculate take profit price', () => {
      const takeProfit = validPrice.calculateTakeProfit(20); // 20% take profit
      
      expect(takeProfit.value).toBe(60000); // 50000 * (1 + 0.2) = 60000
      expect(takeProfit.symbol).toBe('BTCUSDT');
    });

    it('should reject invalid take profit percentage', () => {
      expect(() => validPrice.calculateTakeProfit(0)).toThrow(DomainValidationError);
      expect(() => validPrice.calculateTakeProfit(-10)).toThrow(DomainValidationError);
    });

    it('should calculate slippage correctly', () => {
      const expectedPrice = Price.create(50000, 'BTCUSDT');
      const actualPrice = Price.create(50500, 'BTCUSDT');
      
      const slippage = actualPrice.calculateSlippage(expectedPrice);
      
      expect(slippage).toBe(1); // (50500 - 50000) / 50000 * 100 = 1%
    });

    it('should reject slippage calculation with zero expected price', () => {
      const zeroPrice = Price.fromExisting({
        value: 1,
        symbol: 'BTCUSDT',
        timestamp: new Date(),
        source: 'exchange',
        precision: 2,
      });
      
      (zeroPrice as any).props.value = 0;
      
      expect(() => validPrice.calculateSlippage(zeroPrice)).toThrow(DomainValidationError);
    });
  });

  describe('Price Age and Staleness', () => {
    it('should check if price is stale', () => {
      const oldTimestamp = new Date(Date.now() - 60000); // 1 minute ago
      const oldPrice = Price.create(50000, 'BTCUSDT', 'exchange', 2, oldTimestamp);
      
      expect(oldPrice.isStale(30000)).toBe(true); // 30 seconds max age
      expect(oldPrice.isStale(120000)).toBe(false); // 2 minutes max age
    });

    it('should calculate age in milliseconds', () => {
      const oldTimestamp = new Date(Date.now() - 10000); // 10 seconds ago
      const oldPrice = Price.create(50000, 'BTCUSDT', 'exchange', 2, oldTimestamp);
      
      const age = oldPrice.getAgeMs();
      
      expect(age).toBeGreaterThanOrEqual(9900); // Allow some tolerance
      expect(age).toBeLessThanOrEqual(10100);
    });
  });

  describe('Price Updates', () => {
    it('should create updated price with new value', () => {
      const newTimestamp = new Date();
      const updatedPrice = validPrice.updateValue(55000, newTimestamp, 'new-source');
      
      expect(updatedPrice.value).toBe(55000);
      expect(updatedPrice.symbol).toBe('BTCUSDT');
      expect(updatedPrice.source).toBe('new-source');
      expect(updatedPrice.timestamp).toBe(newTimestamp);
      expect(updatedPrice.precision).toBe(2);
    });

    it('should create updated price with minimal parameters', () => {
      const updatedPrice = validPrice.updateValue(55000);
      
      expect(updatedPrice.value).toBe(55000);
      expect(updatedPrice.symbol).toBe('BTCUSDT');
      expect(updatedPrice.source).toBe('exchange'); // Original source
      expect(updatedPrice.precision).toBe(2); // Original precision
    });
  });

  describe('Static Utility Methods', () => {
    it('should find highest price', () => {
      const price1 = Price.create(50000, 'BTCUSDT');
      const price2 = Price.create(55000, 'BTCUSDT');
      const price3 = Price.create(52000, 'BTCUSDT');
      
      const highest = Price.findHighest(price1, price2, price3);
      
      expect(highest.value).toBe(55000);
    });

    it('should find lowest price', () => {
      const price1 = Price.create(50000, 'BTCUSDT');
      const price2 = Price.create(55000, 'BTCUSDT');
      const price3 = Price.create(52000, 'BTCUSDT');
      
      const lowest = Price.findLowest(price1, price2, price3);
      
      expect(lowest.value).toBe(50000);
    });

    it('should calculate average price', () => {
      const price1 = Price.create(50000, 'BTCUSDT');
      const price2 = Price.create(60000, 'BTCUSDT');
      const price3 = Price.create(40000, 'BTCUSDT');
      
      const average = Price.calculateAverage(price1, price2, price3);
      
      expect(average.value).toBe(50000); // (50000 + 60000 + 40000) / 3
      expect(average.symbol).toBe('BTCUSDT');
    });

    it('should reject empty arrays for utility methods', () => {
      expect(() => Price.findHighest()).toThrow(DomainValidationError);
      expect(() => Price.findLowest()).toThrow(DomainValidationError);
      expect(() => Price.calculateAverage()).toThrow(DomainValidationError);
    });

    it('should reject mixed symbols for average calculation', () => {
      const btcPrice = Price.create(50000, 'BTCUSDT');
      const ethPrice = Price.create(3000, 'ETHUSDT');
      
      expect(() => Price.calculateAverage(btcPrice, ethPrice)).toThrow(DomainValidationError);
    });
  });

  describe('Price Formatting', () => {
    it('should format to string with symbol', () => {
      const formatted = validPrice.toString();
      
      expect(formatted).toBe('50000.00 (BTCUSDT)');
    });

    it('should format to string with custom decimal places', () => {
      const formatted = validPrice.toFormattedString(4);
      
      expect(formatted).toBe('50000.0000');
    });

    it('should format to string with default precision', () => {
      const formatted = validPrice.toFormattedString();
      
      expect(formatted).toBe('50000.00');
    });

    it('should convert to number', () => {
      const number = validPrice.toNumber();
      
      expect(number).toBe(50000);
    });
  });

  describe('Price Serialization', () => {
    it('should convert to plain object', () => {
      const plainObject = validPrice.toPlainObject();
      
      expect(plainObject.value).toBe(50000);
      expect(plainObject.symbol).toBe('BTCUSDT');
      expect(plainObject.source).toBe('exchange');
      expect(plainObject.precision).toBe(2);
      expect(plainObject.timestamp).toBeInstanceOf(Date);
    });

    it('should create from existing props', () => {
      const props = validPrice.toPlainObject();
      const recreatedPrice = Price.fromExisting(props);
      
      expect(recreatedPrice.value).toBe(validPrice.value);
      expect(recreatedPrice.symbol).toBe(validPrice.symbol);
      expect(recreatedPrice.source).toBe(validPrice.source);
      expect(recreatedPrice.precision).toBe(validPrice.precision);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small values', () => {
      const tinyPrice = Price.create(0.00000001, 'BTCUSDT', 'exchange', 8);
      
      expect(tinyPrice.value).toBe(0.00000001);
    });

    it('should handle very large values', () => {
      const largePrice = Price.create(1000000000, 'BTCUSDT', 'exchange', 2);
      
      expect(largePrice.value).toBe(1000000000);
    });

    it('should handle precise calculations', () => {
      const price1 = Price.create(0.1, 'ETHUSDT', 'exchange', 8);
      const price2 = Price.create(0.2, 'ETHUSDT', 'exchange', 8);
      
      const percentage = price2.percentageDifferenceFrom(price1);
      
      expect(percentage).toBe(100); // (0.2 - 0.1) / 0.1 * 100 = 100%
    });
  });

  describe('Performance Tests', () => {
    it('should create prices efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        Price.create(50000 + i, 'BTCUSDT', 'exchange', 8);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should create 1000 prices in under 100ms
    });

    it('should perform calculations efficiently', () => {
      const price1 = Price.create(50000, 'BTCUSDT');
      const price2 = Price.create(55000, 'BTCUSDT');
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        price1.percentageDifferenceFrom(price2);
        price1.isHigherThan(price2);
        price1.calculateStopLoss(10);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // Should perform 3000 operations in under 50ms
    });
  });
});