/**
 * Test Validation Utilities
 * 
 * Comprehensive validation helpers for testing parameter validation,
 * NaN handling, and out-of-range values across the trading system.
 */

// ============================================================================
// Numeric Validation Utilities
// ============================================================================

export class NumericValidationUtils {
  /**
   * Validate that a function properly handles NaN inputs
   */
  static assertHandlesNaN<T>(
    fn: (...args: any[]) => T,
    args: any[],
    expectedBehavior: 'throws' | 'returns-null' | 'returns-default' = 'throws',
    defaultValue?: T
  ): void {
    const nanArgs = args.map(arg => 
      typeof arg === 'number' ? NaN : arg
    );

    switch (expectedBehavior) {
      case 'throws':
        expect(() => fn(...nanArgs)).toThrow();
        break;
      case 'returns-null':
        expect(fn(...nanArgs)).toBeNull();
        break;
      case 'returns-default':
        expect(fn(...nanArgs)).toBe(defaultValue);
        break;
    }
  }

  /**
   * Validate that a function properly handles Infinity inputs
   */
  static assertHandlesInfinity<T>(
    fn: (...args: any[]) => T,
    args: any[],
    expectedBehavior: 'throws' | 'returns-null' | 'returns-default' = 'throws',
    defaultValue?: T
  ): void {
    const infinityArgs = args.map(arg => 
      typeof arg === 'number' ? Infinity : arg
    );

    switch (expectedBehavior) {
      case 'throws':
        expect(() => fn(...infinityArgs)).toThrow();
        break;
      case 'returns-null':
        expect(fn(...infinityArgs)).toBeNull();
        break;
      case 'returns-default':
        expect(fn(...infinityArgs)).toBe(defaultValue);
        break;
    }
  }

  /**
   * Validate numeric range constraints
   */
  static assertRangeValidation<T>(
    fn: (...args: any[]) => T,
    argIndex: number,
    baseArgs: any[],
    validRange: { min: number; max: number },
    expectedBehavior: 'throws' | 'clamps' | 'returns-null' = 'throws'
  ): void {
    // Test below minimum
    const belowMinArgs = [...baseArgs];
    belowMinArgs[argIndex] = validRange.min - 1;

    // Test above maximum
    const aboveMaxArgs = [...baseArgs];
    aboveMaxArgs[argIndex] = validRange.max + 1;

    switch (expectedBehavior) {
      case 'throws':
        expect(() => fn(...belowMinArgs)).toThrow();
        expect(() => fn(...aboveMaxArgs)).toThrow();
        break;
      case 'clamps':
        // Should not throw, but clamp to valid range
        expect(() => fn(...belowMinArgs)).not.toThrow();
        expect(() => fn(...aboveMaxArgs)).not.toThrow();
        break;
      case 'returns-null':
        expect(fn(...belowMinArgs)).toBeNull();
        expect(fn(...aboveMaxArgs)).toBeNull();
        break;
    }
  }

  /**
   * Test percentage validation (0-100 range)
   */
  static assertPercentageValidation<T>(
    fn: (...args: any[]) => T,
    argIndex: number,
    baseArgs: any[],
    expectedBehavior: 'throws' | 'clamps' | 'returns-null' = 'throws'
  ): void {
    this.assertRangeValidation(
      fn,
      argIndex,
      baseArgs,
      { min: 0, max: 100 },
      expectedBehavior
    );
  }

  /**
   * Test that a function properly validates positive numbers
   */
  static assertPositiveNumberValidation<T>(
    fn: (...args: any[]) => T,
    argIndex: number,
    baseArgs: any[],
    expectedBehavior: 'throws' | 'returns-null' = 'throws'
  ): void {
    const negativeArgs = [...baseArgs];
    negativeArgs[argIndex] = -1;

    const zeroArgs = [...baseArgs];
    zeroArgs[argIndex] = 0;

    switch (expectedBehavior) {
      case 'throws':
        expect(() => fn(...negativeArgs)).toThrow();
        expect(() => fn(...zeroArgs)).toThrow();
        break;
      case 'returns-null':
        expect(fn(...negativeArgs)).toBeNull();
        expect(fn(...zeroArgs)).toBeNull();
        break;
    }
  }
}

// ============================================================================
// String Validation Utilities
// ============================================================================

export class StringValidationUtils {
  /**
   * Test that a function properly handles empty strings
   */
  static assertHandlesEmptyString<T>(
    fn: (...args: any[]) => T,
    argIndex: number,
    baseArgs: any[],
    expectedBehavior: 'throws' | 'returns-null' | 'returns-default' = 'throws',
    defaultValue?: T
  ): void {
    const emptyStringArgs = [...baseArgs];
    emptyStringArgs[argIndex] = '';

    switch (expectedBehavior) {
      case 'throws':
        expect(() => fn(...emptyStringArgs)).toThrow();
        break;
      case 'returns-null':
        expect(fn(...emptyStringArgs)).toBeNull();
        break;
      case 'returns-default':
        expect(fn(...emptyStringArgs)).toBe(defaultValue);
        break;
    }
  }

  /**
   * Test that a function properly handles null/undefined strings
   */
  static assertHandlesNullString<T>(
    fn: (...args: any[]) => T,
    argIndex: number,
    baseArgs: any[],
    expectedBehavior: 'throws' | 'returns-null' = 'throws'
  ): void {
    const nullArgs = [...baseArgs];
    nullArgs[argIndex] = null;

    const undefinedArgs = [...baseArgs];
    undefinedArgs[argIndex] = undefined;

    switch (expectedBehavior) {
      case 'throws':
        expect(() => fn(...nullArgs)).toThrow();
        expect(() => fn(...undefinedArgs)).toThrow();
        break;
      case 'returns-null':
        expect(fn(...nullArgs)).toBeNull();
        expect(fn(...undefinedArgs)).toBeNull();
        break;
    }
  }

  /**
   * Test string length validation
   */
  static assertStringLengthValidation<T>(
    fn: (...args: any[]) => T,
    argIndex: number,
    baseArgs: any[],
    constraints: { minLength?: number; maxLength?: number },
    expectedBehavior: 'throws' | 'returns-null' = 'throws'
  ): void {
    if (constraints.minLength !== undefined) {
      const tooShortArgs = [...baseArgs];
      tooShortArgs[argIndex] = 'a'.repeat(constraints.minLength - 1);

      switch (expectedBehavior) {
        case 'throws':
          expect(() => fn(...tooShortArgs)).toThrow();
          break;
        case 'returns-null':
          expect(fn(...tooShortArgs)).toBeNull();
          break;
      }
    }

    if (constraints.maxLength !== undefined) {
      const tooLongArgs = [...baseArgs];
      tooLongArgs[argIndex] = 'a'.repeat(constraints.maxLength + 1);

      switch (expectedBehavior) {
        case 'throws':
          expect(() => fn(...tooLongArgs)).toThrow();
          break;
        case 'returns-null':
          expect(fn(...tooLongArgs)).toBeNull();
          break;
      }
    }
  }
}

// ============================================================================
// Array Validation Utilities
// ============================================================================

export class ArrayValidationUtils {
  /**
   * Test that a function properly handles empty arrays
   */
  static assertHandlesEmptyArray<T>(
    fn: (...args: any[]) => T,
    argIndex: number,
    baseArgs: any[],
    expectedBehavior: 'throws' | 'returns-null' | 'returns-empty' = 'throws'
  ): void {
    const emptyArrayArgs = [...baseArgs];
    emptyArrayArgs[argIndex] = [];

    switch (expectedBehavior) {
      case 'throws':
        expect(() => fn(...emptyArrayArgs)).toThrow();
        break;
      case 'returns-null':
        expect(fn(...emptyArrayArgs)).toBeNull();
        break;
      case 'returns-empty':
        const result = fn(...emptyArrayArgs);
        expect(Array.isArray(result) && result.length === 0).toBe(true);
        break;
    }
  }

  /**
   * Test array length validation
   */
  static assertArrayLengthValidation<T>(
    fn: (...args: any[]) => T,
    argIndex: number,
    baseArgs: any[],
    constraints: { minLength?: number; maxLength?: number },
    expectedBehavior: 'throws' | 'returns-null' = 'throws'
  ): void {
    if (constraints.minLength !== undefined && constraints.minLength > 0) {
      const tooShortArgs = [...baseArgs];
      tooShortArgs[argIndex] = new Array(constraints.minLength - 1).fill('item');

      switch (expectedBehavior) {
        case 'throws':
          expect(() => fn(...tooShortArgs)).toThrow();
          break;
        case 'returns-null':
          expect(fn(...tooShortArgs)).toBeNull();
          break;
      }
    }

    if (constraints.maxLength !== undefined) {
      const tooLongArgs = [...baseArgs];
      tooLongArgs[argIndex] = new Array(constraints.maxLength + 1).fill('item');

      switch (expectedBehavior) {
        case 'throws':
          expect(() => fn(...tooLongArgs)).toThrow();
          break;
        case 'returns-null':
          expect(fn(...tooLongArgs)).toBeNull();
          break;
      }
    }
  }
}

// ============================================================================
// Trading-Specific Validation Utilities
// ============================================================================

export class TradingValidationUtils {
  /**
   * Validate price inputs (must be positive, finite numbers)
   */
  static assertPriceValidation<T>(
    fn: (...args: any[]) => T,
    priceArgIndex: number,
    baseArgs: any[],
    expectedBehavior: 'throws' | 'returns-null' = 'throws'
  ): void {
    // Test NaN
    NumericValidationUtils.assertHandlesNaN(fn, baseArgs, expectedBehavior);
    
    // Test Infinity
    NumericValidationUtils.assertHandlesInfinity(fn, baseArgs, expectedBehavior);
    
    // Test negative prices
    NumericValidationUtils.assertPositiveNumberValidation(
      fn, 
      priceArgIndex, 
      baseArgs, 
      expectedBehavior
    );
  }

  /**
   * Validate quantity inputs (must be positive, finite numbers)
   */
  static assertQuantityValidation<T>(
    fn: (...args: any[]) => T,
    quantityArgIndex: number,
    baseArgs: any[],
    expectedBehavior: 'throws' | 'returns-null' = 'throws'
  ): void {
    this.assertPriceValidation(fn, quantityArgIndex, baseArgs, expectedBehavior);
  }

  /**
   * Validate symbol format (should be non-empty string, typically ending with USDT)
   */
  static assertSymbolValidation<T>(
    fn: (...args: any[]) => T,
    symbolArgIndex: number,
    baseArgs: any[],
    expectedBehavior: 'throws' | 'returns-null' = 'throws'
  ): void {
    // Test empty string
    StringValidationUtils.assertHandlesEmptyString(
      fn,
      symbolArgIndex,
      baseArgs,
      expectedBehavior
    );

    // Test null/undefined
    StringValidationUtils.assertHandlesNullString(
      fn,
      symbolArgIndex,
      baseArgs,
      expectedBehavior
    );

    // Test invalid symbols
    const invalidSymbolArgs = [...baseArgs];
    invalidSymbolArgs[symbolArgIndex] = 'INVALID';

    switch (expectedBehavior) {
      case 'throws':
        expect(() => fn(...invalidSymbolArgs)).toThrow();
        break;
      case 'returns-null':
        expect(fn(...invalidSymbolArgs)).toBeNull();
        break;
    }
  }

  /**
   * Validate percentage-based parameters (0-100 range)
   */
  static assertPercentageParameterValidation<T>(
    fn: (...args: any[]) => T,
    percentageArgIndex: number,
    baseArgs: any[],
    expectedBehavior: 'throws' | 'clamps' | 'returns-null' = 'throws'
  ): void {
    NumericValidationUtils.assertPercentageValidation(
      fn,
      percentageArgIndex,
      baseArgs,
      expectedBehavior
    );
  }
}

// ============================================================================
// Comprehensive Validation Test Suite
// ============================================================================

export class ValidationTestSuite {
  /**
   * Run a comprehensive validation test suite on a function
   */
  static runComprehensiveValidation<T>(
    fn: (...args: any[]) => T,
    testConfig: {
      baseArgs: any[];
      parameterTypes: ('number' | 'string' | 'array' | 'price' | 'quantity' | 'symbol' | 'percentage')[];
      expectedBehavior?: 'throws' | 'returns-null' | 'clamps';
    }
  ): void {
    const { baseArgs, parameterTypes, expectedBehavior = 'throws' } = testConfig;

    parameterTypes.forEach((type, index) => {
      switch (type) {
        case 'number':
          NumericValidationUtils.assertHandlesNaN(fn, baseArgs, expectedBehavior);
          NumericValidationUtils.assertHandlesInfinity(fn, baseArgs, expectedBehavior);
          break;

        case 'string':
          StringValidationUtils.assertHandlesEmptyString(fn, index, baseArgs, expectedBehavior);
          StringValidationUtils.assertHandlesNullString(fn, index, baseArgs, expectedBehavior);
          break;

        case 'array':
          ArrayValidationUtils.assertHandlesEmptyArray(fn, index, baseArgs, expectedBehavior);
          break;

        case 'price':
          TradingValidationUtils.assertPriceValidation(fn, index, baseArgs, expectedBehavior);
          break;

        case 'quantity':
          TradingValidationUtils.assertQuantityValidation(fn, index, baseArgs, expectedBehavior);
          break;

        case 'symbol':
          TradingValidationUtils.assertSymbolValidation(fn, index, baseArgs, expectedBehavior);
          break;

        case 'percentage':
          TradingValidationUtils.assertPercentageParameterValidation(fn, index, baseArgs, expectedBehavior);
          break;
      }
    });
  }
}

// Export all utilities
export default {
  NumericValidationUtils,
  StringValidationUtils,
  ArrayValidationUtils,
  TradingValidationUtils,
  ValidationTestSuite,
};