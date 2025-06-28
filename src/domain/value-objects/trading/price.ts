/**
 * Price Value Object
 * Represents market prices with validation and comparison logic
 */

import { z } from "zod";
import { ValueObject } from "../../base/value-object";
import { DomainValidationError } from "../../errors/trading-errors";

interface PriceProps {
  readonly value: number;
  readonly symbol: string;
  readonly timestamp: Date;
  readonly source: string;
  readonly precision: number;
}

// Validation schema
const PricePropsSchema = z.object({
  value: z.number().positive().finite(),
  symbol: z.string().min(1),
  timestamp: z.date(),
  source: z.string().min(1),
  precision: z.number().int().min(0).max(18),
});

export class Price extends ValueObject<PriceProps> {
  private constructor(props: PriceProps) {
    super(props);
  }

  static create(
    value: number,
    symbol: string,
    source: string = "unknown",
    precision: number = 8,
    timestamp?: Date
  ): Price {
    const priceProps: PriceProps = {
      value: Math.round(value * 10 ** precision) / 10 ** precision,
      symbol: symbol.toUpperCase(),
      timestamp: timestamp || new Date(),
      source,
      precision,
    };

    return Price.createWithValidation(priceProps);
  }

  static fromString(
    valueStr: string,
    symbol: string,
    source: string = "unknown",
    precision: number = 8,
    timestamp?: Date
  ): Price {
    const value = parseFloat(valueStr);
    if (Number.isNaN(value)) {
      throw new DomainValidationError("value", valueStr, "Invalid numeric format");
    }
    return Price.create(value, symbol, source, precision, timestamp);
  }

  static fromExisting(props: PriceProps): Price {
    return Price.createWithValidation(props);
  }

  private static createWithValidation(props: PriceProps): Price {
    // Validate props
    const validationResult = PricePropsSchema.safeParse(props);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      throw new DomainValidationError(
        firstError.path.join("."),
        "invalid value",
        firstError.message
      );
    }

    return new Price(props);
  }

  // Getters
  get value(): number {
    return this.props.value;
  }

  get symbol(): string {
    return this.props.symbol;
  }

  get timestamp(): Date {
    return this.props.timestamp;
  }

  get source(): string {
    return this.props.source;
  }

  get precision(): number {
    return this.props.precision;
  }

  // Business logic methods
  isHigherThan(other: Price): boolean {
    this.ensureSameSymbol(other);
    return this.props.value > other.props.value;
  }

  isLowerThan(other: Price): boolean {
    this.ensureSameSymbol(other);
    return this.props.value < other.props.value;
  }

  isEqualTo(other: Price): boolean {
    this.ensureSameSymbol(other);
    return Math.abs(this.props.value - other.props.value) < 10 ** -this.props.precision;
  }

  // Calculate percentage difference
  percentageDifferenceFrom(other: Price): number {
    this.ensureSameSymbol(other);
    if (other.props.value === 0) {
      throw new DomainValidationError(
        "other.value",
        0,
        "Cannot calculate percentage from zero price"
      );
    }
    return ((this.props.value - other.props.value) / other.props.value) * 100;
  }

  // Calculate absolute difference
  absoluteDifferenceFrom(other: Price): number {
    this.ensureSameSymbol(other);
    return Math.abs(this.props.value - other.props.value);
  }

  // Check if price is within a percentage range of another price
  isWithinPercentageOf(other: Price, percentage: number): boolean {
    this.ensureSameSymbol(other);
    const diff = Math.abs(this.percentageDifferenceFrom(other));
    return diff <= Math.abs(percentage);
  }

  // Check if price is stale based on age
  isStale(maxAgeMs: number): boolean {
    const ageMs = Date.now() - this.props.timestamp.getTime();
    return ageMs > maxAgeMs;
  }

  // Get age in milliseconds
  getAgeMs(): number {
    return Date.now() - this.props.timestamp.getTime();
  }

  // Update price with new value (returns new instance)
  updateValue(newValue: number, newTimestamp?: Date, newSource?: string): Price {
    return Price.create(
      newValue,
      this.props.symbol,
      newSource || this.props.source,
      this.props.precision,
      newTimestamp
    );
  }

  // Calculate stop loss price
  calculateStopLoss(percentage: number): Price {
    if (percentage <= 0 || percentage >= 100) {
      throw new DomainValidationError(
        "percentage",
        percentage,
        "Stop loss percentage must be between 0 and 100"
      );
    }
    const stopLossValue = this.props.value * (1 - percentage / 100);
    return Price.create(stopLossValue, this.props.symbol, this.props.source, this.props.precision);
  }

  // Calculate take profit price
  calculateTakeProfit(percentage: number): Price {
    if (percentage <= 0) {
      throw new DomainValidationError(
        "percentage",
        percentage,
        "Take profit percentage must be positive"
      );
    }
    const takeProfitValue = this.props.value * (1 + percentage / 100);
    return Price.create(
      takeProfitValue,
      this.props.symbol,
      this.props.source,
      this.props.precision
    );
  }

  // Calculate slippage from expected price
  calculateSlippage(expectedPrice: Price): number {
    this.ensureSameSymbol(expectedPrice);
    if (expectedPrice.props.value === 0) {
      throw new DomainValidationError("expectedPrice", 0, "Expected price cannot be zero");
    }
    return ((this.props.value - expectedPrice.props.value) / expectedPrice.props.value) * 100;
  }

  // Formatting methods
  toString(): string {
    return `${this.props.value.toFixed(this.props.precision)} (${this.props.symbol})`;
  }

  toFormattedString(decimalPlaces?: number): string {
    const places = decimalPlaces ?? this.props.precision;
    return `${this.props.value.toFixed(places)}`;
  }

  toNumber(): number {
    return this.props.value;
  }

  // Utility methods
  private ensureSameSymbol(other: Price): void {
    if (this.props.symbol !== other.props.symbol) {
      throw new DomainValidationError(
        "symbol",
        other.props.symbol,
        `Symbol mismatch: ${this.props.symbol} vs ${other.props.symbol}`
      );
    }
  }

  // Static utility methods
  static findHighest(...prices: Price[]): Price {
    if (prices.length === 0) {
      throw new DomainValidationError(
        "prices",
        "empty array",
        "At least one Price instance required"
      );
    }

    return prices.reduce((highest, current) => (current.isHigherThan(highest) ? current : highest));
  }

  static findLowest(...prices: Price[]): Price {
    if (prices.length === 0) {
      throw new DomainValidationError(
        "prices",
        "empty array",
        "At least one Price instance required"
      );
    }

    return prices.reduce((lowest, current) => (current.isLowerThan(lowest) ? current : lowest));
  }

  static calculateAverage(...prices: Price[]): Price {
    if (prices.length === 0) {
      throw new DomainValidationError(
        "prices",
        "empty array",
        "At least one Price instance required"
      );
    }

    // Ensure all prices are for the same symbol
    const symbol = prices[0].symbol;
    const source = prices[0].source;
    const precision = prices[0].precision;

    for (const price of prices) {
      if (price.symbol !== symbol) {
        throw new DomainValidationError(
          "symbol",
          price.symbol,
          `All prices must be for the same symbol: ${symbol}`
        );
      }
    }

    const sum = prices.reduce((total, price) => total + price.value, 0);
    const average = sum / prices.length;

    return Price.create(average, symbol, source, precision);
  }

  // Convert to plain object for persistence
  toPlainObject(): PriceProps {
    return { ...this.props };
  }
}
