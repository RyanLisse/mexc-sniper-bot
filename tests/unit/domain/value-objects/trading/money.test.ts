/**
 * Unit tests for Money Value Object
 * Tests monetary amount handling with currency and precision
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Money } from '../../../../../src/domain/value-objects/trading/money';
import { DomainValidationError } from '../../../../../src/domain/errors/trading-errors';

describe('Money Value Object', () => {
  describe('Money Creation', () => {
    it('should create money with valid amount and currency', () => {
      const money = Money.create(100.50, 'USD');

      expect(money.amount).toBe(100.5);
      expect(money.currency).toBe('USD');
      expect(money.precision).toBe(8); // Default precision
    });

    it('should create money with custom precision', () => {
      const money = Money.create(100.123456789, 'BTC', 2);

      expect(money.amount).toBe(100.12); // Rounded to 2 decimal places
      expect(money.currency).toBe('BTC');
      expect(money.precision).toBe(2);
    });

    it('should convert currency to uppercase', () => {
      const money = Money.create(100, 'usd');

      expect(money.currency).toBe('USD');
    });

    it('should handle zero amount', () => {
      const money = Money.create(0, 'USD');

      expect(money.amount).toBe(0);
      expect(money.currency).toBe('USD');
    });


    it('should reject infinite amount', () => {
      expect(() => Money.create(Number.POSITIVE_INFINITY, 'USD')).toThrow(DomainValidationError);
    });

    it('should reject NaN amount', () => {
      expect(() => Money.create(Number.NaN, 'USD')).toThrow(DomainValidationError);
    });

    it('should reject empty currency', () => {
      expect(() => Money.create(100, '')).toThrow(DomainValidationError);
    });

    it('should reject invalid precision', () => {
      expect(() => Money.create(100, 'USD', -1)).toThrow(DomainValidationError);
      expect(() => Money.create(100, 'USD', 19)).toThrow(DomainValidationError);
    });

    it('should reject negative amounts', () => {
      expect(() => Money.create(-50.25, 'USD')).toThrow(DomainValidationError);
    });
  });

  describe('Money from String', () => {
    it('should create money from valid string', () => {
      const money = Money.fromString('123.45', 'USD');

      expect(money.amount).toBe(123.45);
      expect(money.currency).toBe('USD');
    });

    it('should handle string with many decimal places', () => {
      const money = Money.fromString('0.123456789', 'BTC', 8);

      expect(money.amount).toBe(0.12345679); // Rounded to 8 decimal places
      expect(money.currency).toBe('BTC');
    });

    it('should handle integer string', () => {
      const money = Money.fromString('100', 'USD');

      expect(money.amount).toBe(100);
      expect(money.currency).toBe('USD');
    });

    it('should reject invalid string', () => {
      expect(() => Money.fromString('not-a-number', 'USD')).toThrow(DomainValidationError);
    });

    it('should reject empty string', () => {
      expect(() => Money.fromString('', 'USD')).toThrow(DomainValidationError);
    });

    it('should reject negative string', () => {
      expect(() => Money.fromString('-50.25', 'USD')).toThrow(DomainValidationError);
    });
  });

  describe('Money Operations', () => {
    let money1: Money;
    let money2: Money;

    beforeEach(() => {
      money1 = Money.create(100, 'USD');
      money2 = Money.create(50, 'USD');
    });

    it('should add money with same currency', () => {
      const result = money1.add(money2);

      expect(result.amount).toBe(150);
      expect(result.currency).toBe('USD');
    });

    it('should subtract money with same currency', () => {
      const result = money1.subtract(money2);

      expect(result.amount).toBe(50);
      expect(result.currency).toBe('USD');
    });

    it('should reject subtraction resulting in negative amount', () => {
      expect(() => money2.subtract(money1)).toThrow(DomainValidationError);
    });

    it('should multiply by scalar', () => {
      const result = money1.multiply(2.5);

      expect(result.amount).toBe(250);
      expect(result.currency).toBe('USD');
    });

    it('should divide by scalar', () => {
      const result = money1.divide(2);

      expect(result.amount).toBe(50);
      expect(result.currency).toBe('USD');
    });

    it('should reject addition with different currencies', () => {
      const eurMoney = Money.create(50, 'EUR');

      expect(() => money1.add(eurMoney)).toThrow(DomainValidationError);
    });

    it('should reject subtraction with different currencies', () => {
      const eurMoney = Money.create(50, 'EUR');

      expect(() => money1.subtract(eurMoney)).toThrow(DomainValidationError);
    });

    it('should reject division by zero', () => {
      expect(() => money1.divide(0)).toThrow(DomainValidationError);
    });

    it('should handle multiplication by zero', () => {
      const result = money1.multiply(0);

      expect(result.amount).toBe(0);
      expect(result.currency).toBe('USD');
    });

    it('should reject negative multiplication', () => {
      expect(() => money1.multiply(-1)).toThrow(DomainValidationError);
    });
  });

  describe('Money Comparison', () => {
    let money1: Money;
    let money2: Money;
    let money3: Money;

    beforeEach(() => {
      money1 = Money.create(100, 'USD');
      money2 = Money.create(100, 'USD');
      money3 = Money.create(50, 'USD');
    });

    it('should be equal to money with same amount and currency', () => {
      expect(money1.equals(money2)).toBe(true);
    });

    it('should not be equal to money with different amount', () => {
      expect(money1.equals(money3)).toBe(false);
    });

    it('should not be equal to money with different currency', () => {
      const eurMoney = Money.create(100, 'EUR');

      expect(money1.equals(eurMoney)).toBe(false);
    });

    it('should compare greater than', () => {
      expect(money1.isGreaterThan(money3)).toBe(true);
      expect(money3.isGreaterThan(money1)).toBe(false);
    });

    it('should compare less than', () => {
      expect(money3.isLessThan(money1)).toBe(true);
      expect(money1.isLessThan(money3)).toBe(false);
    });

    it('should compare greater than or equal', () => {
      expect(money1.isGreaterThanOrEqual(money2)).toBe(true);
      expect(money1.isGreaterThanOrEqual(money3)).toBe(true);
      expect(money3.isGreaterThanOrEqual(money1)).toBe(false);
    });

    it('should compare less than or equal', () => {
      expect(money1.isLessThanOrEqual(money2)).toBe(true);
      expect(money3.isLessThanOrEqual(money1)).toBe(true);
      expect(money1.isLessThanOrEqual(money3)).toBe(false);
    });

    it('should reject comparison with different currencies', () => {
      const eurMoney = Money.create(100, 'EUR');

      expect(() => money1.isGreaterThan(eurMoney)).toThrow(DomainValidationError);
    });
  });

  describe('Money Properties', () => {
    it('should check if money is positive', () => {
      const positiveMoney = Money.create(100, 'USD');
      const zeroMoney = Money.create(0, 'USD');

      expect(positiveMoney.isPositive()).toBe(true);
      expect(zeroMoney.isPositive()).toBe(false);
    });

    it('should check if money is zero', () => {
      const positiveMoney = Money.create(100, 'USD');
      const zeroMoney = Money.create(0, 'USD');

      expect(zeroMoney.isZero()).toBe(true);
      expect(positiveMoney.isZero()).toBe(false);
    });
  });

  describe('Money Formatting', () => {
    it('should format to string with default format', () => {
      const money = Money.create(1234.56, 'USD');
      const formatted = money.toString();

      expect(formatted).toBe('1234.56000000 USD');
    });

    it('should format with custom decimal places', () => {
      const money = Money.create(1234.56789, 'BTC', 8);
      const formatted = money.toFormattedString(4);

      expect(formatted).toContain('1234.5679');
      expect(formatted).toContain('BTC');
    });

    it('should format crypto with high precision', () => {
      const money = Money.create(0.00012345, 'BTC', 8);
      const formatted = money.toString();

      expect(formatted).toBe('0.00012345 BTC');
    });

    it('should convert to number', () => {
      const money = Money.create(1234.56, 'USD');
      const number = money.toNumber();

      expect(number).toBe(1234.56);
    });
  });

  describe('Money Conversion', () => {
    it('should convert to another currency with exchange rate', () => {
      const usdMoney = Money.create(100, 'USD');
      const eurMoney = usdMoney.convertTo('EUR', 0.85, 2);

      expect(eurMoney.amount).toBe(85);
      expect(eurMoney.currency).toBe('EUR');
      expect(eurMoney.precision).toBe(2);
    });

    it('should reject invalid exchange rate', () => {
      const money = Money.create(100, 'USD');
      
      expect(() => money.convertTo('EUR', 0)).toThrow(DomainValidationError);
      expect(() => money.convertTo('EUR', -1)).toThrow(DomainValidationError);
    });

    it('should calculate percentage of money', () => {
      const money = Money.create(100, 'USD');
      const percentage = money.percentage(10);

      expect(percentage.amount).toBe(10);
      expect(percentage.currency).toBe('USD');
    });
  });

  describe('Money Validation', () => {
    it('should validate supported currencies', () => {
      const supportedCurrencies = ['USD', 'EUR', 'BTC', 'ETH', 'USDT'];
      
      supportedCurrencies.forEach(currency => {
        expect(() => Money.create(100, currency)).not.toThrow();
      });
    });

    it('should handle edge case amounts', () => {
      // Very small amount
      const tiny = Money.create(0.00000001, 'BTC', 8);
      expect(tiny.amount).toBe(0.00000001);

      // Very large amount
      const large = Money.create(1000000000, 'USD');
      expect(large.amount).toBe(1000000000);
    });

    it('should maintain precision consistency', () => {
      const money1 = Money.create(1.111111111, 'USD', 2);
      const money2 = Money.create(2.222222222, 'USD', 2);
      const result = money1.add(money2);

      expect(result.amount).toBe(3.33); // Proper rounding to 2 decimal places
      expect(result.precision).toBe(2);
    });
  });

  describe('Static Utility Methods', () => {
    it('should create zero money', () => {
      const zeroMoney = Money.zero('USD');

      expect(zeroMoney.amount).toBe(0);
      expect(zeroMoney.currency).toBe('USD');
      expect(zeroMoney.precision).toBe(8);
    });

    it('should find maximum money', () => {
      const money1 = Money.create(100, 'USD');
      const money2 = Money.create(150, 'USD');
      const money3 = Money.create(75, 'USD');

      const max = Money.max(money1, money2, money3);

      expect(max.amount).toBe(150);
      expect(max.currency).toBe('USD');
    });

    it('should find minimum money', () => {
      const money1 = Money.create(100, 'USD');
      const money2 = Money.create(150, 'USD');
      const money3 = Money.create(75, 'USD');

      const min = Money.min(money1, money2, money3);

      expect(min.amount).toBe(75);
      expect(min.currency).toBe('USD');
    });

    it('should sum money amounts', () => {
      const money1 = Money.create(100, 'USD');
      const money2 = Money.create(150, 'USD');
      const money3 = Money.create(75, 'USD');

      const sum = Money.sum(money1, money2, money3);

      expect(sum.amount).toBe(325);
      expect(sum.currency).toBe('USD');
    });

    it('should reject empty arrays for utility methods', () => {
      expect(() => Money.max()).toThrow(DomainValidationError);
      expect(() => Money.min()).toThrow(DomainValidationError);
      expect(() => Money.sum()).toThrow(DomainValidationError);
    });

    it('should convert to plain object', () => {
      const money = Money.create(100.50, 'USD', 2);
      const plainObject = money.toPlainObject();

      expect(plainObject.amount).toBe(100.50);
      expect(plainObject.currency).toBe('USD');
      expect(plainObject.precision).toBe(2);
    });
  });

  describe('Money Immutability', () => {
    it('should not modify original money in operations', () => {
      const original = Money.create(100, 'USD');
      const added = Money.create(50, 'USD');
      
      const result = original.add(added);

      expect(original.amount).toBe(100); // Original unchanged
      expect(result.amount).toBe(150); // New instance created
    });

    it('should not modify original money in multiplication', () => {
      const original = Money.create(100, 'USD');
      
      const result = original.multiply(2);

      expect(original.amount).toBe(100); // Original unchanged
      expect(result.amount).toBe(200); // New instance created
    });
  });

  describe('Performance Tests', () => {
    it('should create money efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        Money.create(i * 1.5, 'USD');
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should create 1000 instances in under 100ms
    });

    it('should perform operations efficiently', () => {
      const money1 = Money.create(100, 'USD');
      const money2 = Money.create(50, 'USD');
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        money1.add(money2).multiply(1.1).subtract(money2);
      }
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50); // Should perform 1000 operations in under 50ms
    });
  });
});