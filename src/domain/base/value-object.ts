/**
 * Base ValueObject class for all domain value objects
 * Value objects are immutable and equality is based on their properties
 */

export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props);
  }

  /**
   * Equality comparison based on properties
   */
  equals(other: ValueObject<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (other.constructor !== this.constructor) {
      return false;
    }

    return this.shallowEqual(this.props, other.props);
  }

  /**
   * Shallow equality comparison for objects
   */
  private shallowEqual(object1: T, object2: T): boolean {
    const keys1 = Object.keys(object1 as any);
    const keys2 = Object.keys(object2 as any);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const key of keys1) {
      if ((object1 as any)[key] !== (object2 as any)[key]) {
        return false;
      }
    }

    return true;
  }
}
