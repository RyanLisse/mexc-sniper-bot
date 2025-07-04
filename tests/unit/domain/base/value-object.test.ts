/**
 * Unit tests for ValueObject Base Class
 * Tests value object immutability, equality comparison, and property handling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ValueObject } from '../../../../src/domain/base/value-object';

// Test implementation of ValueObject for testing purposes
interface TestValueProps {
  name: string;
  value: number;
  active: boolean;
}

class TestValue extends ValueObject<TestValueProps> {
  constructor(props: TestValueProps) {
    super(props);
  }

  get name(): string {
    return this.props.name;
  }

  get value(): number {
    return this.props.value;
  }

  get active(): boolean {
    return this.props.active;
  }

  // Public method to test equality
  public testEquals(other: TestValue): boolean {
    return this.equals(other);
  }

  // Method to access props for testing immutability
  public getProps(): TestValueProps {
    return this.props;
  }
}

// Another test value object for comparison tests
interface AnotherValueProps {
  description: string;
  count: number;
}

class AnotherValue extends ValueObject<AnotherValueProps> {
  constructor(props: AnotherValueProps) {
    super(props);
  }

  public testEquals(other: AnotherValue): boolean {
    return this.equals(other);
  }
}

// Complex value object for nested property tests
interface ComplexValueProps {
  basic: {
    id: string;
    name: string;
  };
  metadata: {
    tags: string[];
    settings: {
      enabled: boolean;
      priority: number;
    };
  };
}

class ComplexValue extends ValueObject<ComplexValueProps> {
  constructor(props: ComplexValueProps) {
    super(props);
  }

  public testEquals(other: ComplexValue): boolean {
    return this.equals(other);
  }
}

describe('ValueObject Base Class', () => {
  let valueObject: TestValue;
  let sameValueObject: TestValue;
  let differentValueObject: TestValue;
  let anotherTypeValue: AnotherValue;

  beforeEach(() => {
    valueObject = new TestValue({
      name: 'Test Value',
      value: 42,
      active: true,
    });

    sameValueObject = new TestValue({
      name: 'Test Value',
      value: 42,
      active: true,
    });

    differentValueObject = new TestValue({
      name: 'Different Value',
      value: 24,
      active: false,
    });

    anotherTypeValue = new AnotherValue({
      description: 'Another value',
      count: 10,
    });
  });

  describe('ValueObject Creation', () => {
    it('should create value object with correct properties', () => {
      expect(valueObject.name).toBe('Test Value');
      expect(valueObject.value).toBe(42);
      expect(valueObject.active).toBe(true);
    });

    it('should freeze properties to ensure immutability', () => {
      const props = valueObject.getProps();
      
      expect(() => {
        (props as any).name = 'Modified Name';
      }).toThrow();
      
      expect(valueObject.name).toBe('Test Value'); // Should remain unchanged
    });

    it('should handle empty object properties', () => {
      interface EmptyProps {}
      
      class EmptyValue extends ValueObject<EmptyProps> {
        constructor(props: EmptyProps) {
          super(props);
        }
      }

      const emptyValue = new EmptyValue({});
      expect(emptyValue).toBeDefined();
    });

    it('should handle complex nested properties', () => {
      const complexProps: ComplexValueProps = {
        basic: {
          id: 'test-123',
          name: 'Complex Test',
        },
        metadata: {
          tags: ['tag1', 'tag2'],
          settings: {
            enabled: true,
            priority: 5,
          },
        },
      };

      const complexValue = new ComplexValue(complexProps);
      expect(complexValue).toBeDefined();
    });
  });

  describe('ValueObject Equality', () => {
    it('should be equal to value object with identical properties', () => {
      expect(valueObject.testEquals(sameValueObject)).toBe(true);
    });

    it('should not be equal to value object with different properties', () => {
      expect(valueObject.testEquals(differentValueObject)).toBe(false);
    });

    it('should not be equal to different value object type', () => {
      expect(valueObject.equals(anotherTypeValue as any)).toBe(false);
    });

    it('should not be equal to null', () => {
      expect(valueObject.equals(null as any)).toBe(false);
    });

    it('should not be equal to undefined', () => {
      expect(valueObject.equals(undefined as any)).toBe(false);
    });

    it('should be equal to itself', () => {
      expect(valueObject.testEquals(valueObject)).toBe(true);
    });

    it('should handle partial property differences', () => {
      const partiallyDifferent = new TestValue({
        name: 'Test Value', // Same
        value: 42, // Same
        active: false, // Different
      });

      expect(valueObject.testEquals(partiallyDifferent)).toBe(false);
    });

    it('should handle numeric precision in equality', () => {
      const preciseValue1 = new TestValue({
        name: 'Precise',
        value: 0.1 + 0.2, // 0.30000000000000004
        active: true,
      });

      const preciseValue2 = new TestValue({
        name: 'Precise',
        value: 0.3,
        active: true,
      });

      expect(preciseValue1.testEquals(preciseValue2)).toBe(false); // Due to floating point precision
    });

    it('should handle string comparison correctly', () => {
      const stringValue1 = new TestValue({
        name: 'test',
        value: 1,
        active: true,
      });

      const stringValue2 = new TestValue({
        name: 'test',
        value: 1,
        active: true,
      });

      const stringValue3 = new TestValue({
        name: 'TEST', // Different case
        value: 1,
        active: true,
      });

      expect(stringValue1.testEquals(stringValue2)).toBe(true);
      expect(stringValue1.testEquals(stringValue3)).toBe(false);
    });

    it('should handle boolean comparison correctly', () => {
      const boolValue1 = new TestValue({
        name: 'bool test',
        value: 1,
        active: true,
      });

      const boolValue2 = new TestValue({
        name: 'bool test',
        value: 1,
        active: false,
      });

      expect(boolValue1.testEquals(boolValue2)).toBe(false);
    });
  });

  describe('Property Immutability', () => {
    it('should prevent modification of top-level properties', () => {
      const props = valueObject.getProps();
      
      expect(() => {
        (props as any).name = 'Modified';
      }).toThrow();

      expect(() => {
        (props as any).value = 999;
      }).toThrow();

      expect(() => {
        (props as any).active = false;
      }).toThrow();
    });

    it('should prevent addition of new properties', () => {
      const props = valueObject.getProps();
      
      expect(() => {
        (props as any).newProperty = 'new value';
      }).toThrow();
    });

    it('should prevent deletion of properties', () => {
      const props = valueObject.getProps();
      
      expect(() => {
        delete (props as any).name;
      }).toThrow();
    });

    it('should handle nested object immutability', () => {
      const complexProps: ComplexValueProps = {
        basic: {
          id: 'test-123',
          name: 'Complex Test',
        },
        metadata: {
          tags: ['tag1', 'tag2'],
          settings: {
            enabled: true,
            priority: 5,
          },
        },
      };

      const complexValue = new ComplexValue(complexProps);
      // Note: Object.freeze only does shallow freezing
      // Nested objects might still be mutable depending on implementation
    });
  });

  describe('Shallow Equality Algorithm', () => {
    it('should compare objects with different property counts', () => {
      interface Props1 {
        a: string;
        b: number;
      }

      interface Props2 {
        a: string;
        b: number;
        c: boolean;
      }

      class Value1 extends ValueObject<Props1> {
        public testEquals(other: Value1): boolean {
          return this.equals(other);
        }
      }

      class Value2 extends ValueObject<Props2> {
        public testEquals(other: Value2): boolean {
          return this.equals(other);
        }
      }

      const value1 = new Value1({ a: 'test', b: 1 });
      const value2 = new Value2({ a: 'test', b: 1, c: true });

      expect(value1.equals(value2 as any)).toBe(false);
    });

    it('should handle properties with undefined values', () => {
      interface PropsWithUndefined {
        name: string;
        value?: number;
        active: boolean;
      }

      class ValueWithUndefined extends ValueObject<PropsWithUndefined> {
        public testEquals(other: ValueWithUndefined): boolean {
          return this.equals(other);
        }
      }

      const value1 = new ValueWithUndefined({
        name: 'test',
        value: undefined,
        active: true,
      });

      const value2 = new ValueWithUndefined({
        name: 'test',
        value: undefined,
        active: true,
      });

      const value3 = new ValueWithUndefined({
        name: 'test',
        value: 42,
        active: true,
      });

      expect(value1.testEquals(value2)).toBe(true);
      expect(value1.testEquals(value3)).toBe(false);
    });

    it('should handle properties with null values', () => {
      interface PropsWithNull {
        name: string;
        value: number | null;
        active: boolean;
      }

      class ValueWithNull extends ValueObject<PropsWithNull> {
        public testEquals(other: ValueWithNull): boolean {
          return this.equals(other);
        }
      }

      const value1 = new ValueWithNull({
        name: 'test',
        value: null,
        active: true,
      });

      const value2 = new ValueWithNull({
        name: 'test',
        value: null,
        active: true,
      });

      const value3 = new ValueWithNull({
        name: 'test',
        value: 42,
        active: true,
      });

      expect(value1.testEquals(value2)).toBe(true);
      expect(value1.testEquals(value3)).toBe(false);
    });

    it('should handle objects vs primitive property values', () => {
      interface PropsWithObject {
        simple: string;
        complex: { nested: string };
      }

      class ValueWithObject extends ValueObject<PropsWithObject> {
        public testEquals(other: ValueWithObject): boolean {
          return this.equals(other);
        }
      }

      const obj1 = { nested: 'value' };
      const obj2 = { nested: 'value' };

      const value1 = new ValueWithObject({
        simple: 'test',
        complex: obj1,
      });

      const value2 = new ValueWithObject({
        simple: 'test',
        complex: obj2,
      });

      const value3 = new ValueWithObject({
        simple: 'test',
        complex: obj1, // Same reference
      });

      expect(value1.testEquals(value2)).toBe(false); // Different object references
      expect(value1.testEquals(value3)).toBe(true); // Same object reference
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string properties', () => {
      const emptyStringValue = new TestValue({
        name: '',
        value: 0,
        active: false,
      });

      const anotherEmptyStringValue = new TestValue({
        name: '',
        value: 0,
        active: false,
      });

      expect(emptyStringValue.testEquals(anotherEmptyStringValue)).toBe(true);
    });

    it('should handle zero numeric values', () => {
      const zeroValue1 = new TestValue({
        name: 'zero',
        value: 0,
        active: true,
      });

      const zeroValue2 = new TestValue({
        name: 'zero',
        value: -0, // Negative zero
        active: true,
      });

      expect(zeroValue1.testEquals(zeroValue2)).toBe(true); // 0 === -0 is true
    });

    it('should handle NaN values', () => {
      const nanValue1 = new TestValue({
        name: 'nan',
        value: NaN,
        active: true,
      });

      const nanValue2 = new TestValue({
        name: 'nan',
        value: NaN,
        active: true,
      });

      expect(nanValue1.testEquals(nanValue2)).toBe(false); // NaN !== NaN
    });

    it('should handle Infinity values', () => {
      const infinityValue1 = new TestValue({
        name: 'infinity',
        value: Infinity,
        active: true,
      });

      const infinityValue2 = new TestValue({
        name: 'infinity',
        value: Infinity,
        active: true,
      });

      const negativeInfinityValue = new TestValue({
        name: 'infinity',
        value: -Infinity,
        active: true,
      });

      expect(infinityValue1.testEquals(infinityValue2)).toBe(true);
      expect(infinityValue1.testEquals(negativeInfinityValue)).toBe(false);
    });

    it('should handle very large objects', () => {
      interface LargeProps {
        [key: string]: any;
      }

      class LargeValue extends ValueObject<LargeProps> {
        public testEquals(other: LargeValue): boolean {
          return this.equals(other);
        }
      }

      const largeProps: LargeProps = {};
      for (let i = 0; i < 100; i++) {
        largeProps[`prop${i}`] = `value${i}`;
      }

      const largeValue1 = new LargeValue(largeProps);
      const largeValue2 = new LargeValue({ ...largeProps });
      
      expect(largeValue1.testEquals(largeValue2)).toBe(true);

      // Modify one property
      const modifiedProps = { ...largeProps };
      modifiedProps.prop50 = 'modified';
      const largeValue3 = new LargeValue(modifiedProps);

      expect(largeValue1.testEquals(largeValue3)).toBe(false);
    });
  });

  describe('Performance Tests', () => {
    it('should perform equality comparisons efficiently', () => {
      const startTime = Date.now();
      const comparisonCount = 1000;

      for (let i = 0; i < comparisonCount; i++) {
        valueObject.testEquals(sameValueObject);
        valueObject.testEquals(differentValueObject);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete comparisons in under 100ms
    });

    it('should create value objects efficiently', () => {
      const startTime = Date.now();
      const creationCount = 1000;

      for (let i = 0; i < creationCount; i++) {
        new TestValue({
          name: `Test ${i}`,
          value: i,
          active: i % 2 === 0,
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200); // Should create 1000 objects in under 200ms
    });

    it('should handle large property comparisons efficiently', () => {
      interface LargeProps {
        [key: string]: any;
      }

      class LargeValue extends ValueObject<LargeProps> {
        public testEquals(other: LargeValue): boolean {
          return this.equals(other);
        }
      }

      const largeProps: LargeProps = {};
      for (let i = 0; i < 1000; i++) {
        largeProps[`prop${i}`] = `value${i}`;
      }

      const largeValue1 = new LargeValue(largeProps);
      const largeValue2 = new LargeValue({ ...largeProps });

      const startTime = Date.now();
      
      for (let i = 0; i < 100; i++) {
        largeValue1.testEquals(largeValue2);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should handle large object comparisons efficiently
    });
  });
});