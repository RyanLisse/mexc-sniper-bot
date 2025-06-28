/**
 * Money Value Object
 * Represents monetary amounts with currency and precision handling
 */

import { z } from "zod";
import { ValueObject } from "../../base/value-object";
import { DomainValidationError } from "../../errors/trading-errors";

interface MoneyProps {
  readonly amount: number;
  readonly currency: string;
  readonly precision: number;
}

// Validation schema
const MoneyPropsSchema = z.object({
  amount: z.number().finite(),
  currency: z.string().min(1).max(10),
  precision: z.number().int().min(0).max(18),
});

export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  static create(amount: number, currency: string, precision: number = 8): Money {
    const moneyProps: MoneyProps = {
      amount: Math.round(amount * 10 ** precision) / 10 ** precision,
      currency: currency.toUpperCase(),
      precision,
    };

    return Money.createWithValidation(moneyProps);
  }

  static fromString(amountStr: string, currency: string, precision: number = 8): Money {
    const amount = parseFloat(amountStr);
    if (Number.isNaN(amount)) {
      throw new DomainValidationError("amount", amountStr, "Invalid numeric format");
    }
    return Money.create(amount, currency, precision);
  }

  static zero(currency: string, precision: number = 8): Money {
    return Money.create(0, currency, precision);
  }

  static fromExisting(props: MoneyProps): Money {
    return Money.createWithValidation(props);
  }

  private static createWithValidation(props: MoneyProps): Money {
    // Validate props
    const validationResult = MoneyPropsSchema.safeParse(props);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      throw new DomainValidationError(
        firstError.path.join("."),
        "invalid value",
        firstError.message
      );
    }

    // Business rule validations
    if (props.amount < 0) {
      throw new DomainValidationError("amount", props.amount, "Amount cannot be negative");
    }

    return new Money(props);
  }

  // Getters
  get amount(): number {
    return this.props.amount;
  }

  get currency(): string {
    return this.props.currency;
  }

  get precision(): number {
    return this.props.precision;
  }

  // Business logic methods
  isZero(): boolean {
    return this.props.amount === 0;
  }

  isPositive(): boolean {
    return this.props.amount > 0;
  }

  isGreaterThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.props.amount > other.props.amount;
  }

  isGreaterThanOrEqual(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.props.amount >= other.props.amount;
  }

  isLessThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.props.amount < other.props.amount;
  }

  isLessThanOrEqual(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.props.amount <= other.props.amount;
  }

  equals(other: Money): boolean {
    return (
      super.equals(other) &&
      this.props.currency === other.props.currency &&
      this.props.amount === other.props.amount
    );
  }

  // Arithmetic operations (return new instances)
  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return Money.create(
      this.props.amount + other.props.amount,
      this.props.currency,
      Math.max(this.props.precision, other.props.precision)
    );
  }

  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    const result = this.props.amount - other.props.amount;
    if (result < 0) {
      throw new DomainValidationError("amount", result, "Subtraction result cannot be negative");
    }
    return Money.create(
      result,
      this.props.currency,
      Math.max(this.props.precision, other.props.precision)
    );
  }

  multiply(factor: number): Money {
    if (factor < 0) {
      throw new DomainValidationError("factor", factor, "Multiplication factor cannot be negative");
    }
    return Money.create(this.props.amount * factor, this.props.currency, this.props.precision);
  }

  divide(divisor: number): Money {
    if (divisor <= 0) {
      throw new DomainValidationError("divisor", divisor, "Division by zero or negative number");
    }
    return Money.create(this.props.amount / divisor, this.props.currency, this.props.precision);
  }

  percentage(percent: number): Money {
    return this.multiply(percent / 100);
  }

  // Currency conversion (requires exchange rate)
  convertTo(targetCurrency: string, exchangeRate: number, precision: number = 8): Money {
    if (exchangeRate <= 0) {
      throw new DomainValidationError(
        "exchangeRate",
        exchangeRate,
        "Exchange rate must be positive"
      );
    }
    return Money.create(this.props.amount * exchangeRate, targetCurrency, precision);
  }

  // Formatting methods
  toString(): string {
    return `${this.props.amount.toFixed(this.props.precision)} ${this.props.currency}`;
  }

  toFormattedString(decimalPlaces?: number): string {
    const places = decimalPlaces ?? this.props.precision;
    return `${this.props.amount.toFixed(places)} ${this.props.currency}`;
  }

  toNumber(): number {
    return this.props.amount;
  }

  // Utility methods
  private ensureSameCurrency(other: Money): void {
    if (this.props.currency !== other.props.currency) {
      throw new DomainValidationError(
        "currency",
        other.props.currency,
        `Currency mismatch: ${this.props.currency} vs ${other.props.currency}`
      );
    }
  }

  // Static utility methods
  static max(...moneys: Money[]): Money {
    if (moneys.length === 0) {
      throw new DomainValidationError(
        "moneys",
        "empty array",
        "At least one Money instance required"
      );
    }

    return moneys.reduce((max, current) => (current.isGreaterThan(max) ? current : max));
  }

  static min(...moneys: Money[]): Money {
    if (moneys.length === 0) {
      throw new DomainValidationError(
        "moneys",
        "empty array",
        "At least one Money instance required"
      );
    }

    return moneys.reduce((min, current) => (current.isLessThan(min) ? current : min));
  }

  static sum(...moneys: Money[]): Money {
    if (moneys.length === 0) {
      throw new DomainValidationError(
        "moneys",
        "empty array",
        "At least one Money instance required"
      );
    }

    return moneys.reduce((sum, current) => sum.add(current));
  }

  // Convert to plain object for persistence
  toPlainObject(): MoneyProps {
    return { ...this.props };
  }
}
