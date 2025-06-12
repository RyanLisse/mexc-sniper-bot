import { ErrorCollector, ValidationError } from "./error-utils";

/**
 * Validation utilities for common data validation patterns
 */
export class Validators {
  /**
   * Validates a take profit level percentage
   */
  static takeProfitLevel(value: number, levelName: string): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new ValidationError(`${levelName} must be a valid number`);
    }
    if (value < 0) {
      throw new ValidationError(`${levelName} cannot be negative`);
    }
    if (value > 1000) {
      throw new ValidationError(`${levelName} cannot exceed 1000%`);
    }
    return value;
  }

  /**
   * Validates stop loss percentage
   */
  static stopLossPercent(value: number): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new ValidationError("Stop loss percent must be a valid number");
    }
    if (value < 0) {
      throw new ValidationError("Stop loss percent cannot be negative");
    }
    if (value > 100) {
      throw new ValidationError("Stop loss percent cannot exceed 100%");
    }
    return value;
  }

  /**
   * Validates user ID
   */
  static userId(value: unknown): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new ValidationError("User ID is required and must be a non-empty string");
    }
    return value.trim();
  }

  /**
   * Validates buy amount in USDT
   */
  static buyAmountUsdt(value: number): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new ValidationError("Buy amount must be a valid number");
    }
    if (value <= 0) {
      throw new ValidationError("Buy amount must be greater than 0");
    }
    if (value > 1000000) {
      throw new ValidationError("Buy amount cannot exceed $1,000,000");
    }
    return value;
  }

  /**
   * Validates max concurrent snipes
   */
  static maxConcurrentSnipes(value: number): number {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isInteger(value)) {
      throw new ValidationError("Max concurrent snipes must be a valid integer");
    }
    if (value < 1) {
      throw new ValidationError("Max concurrent snipes must be at least 1");
    }
    if (value > 100) {
      throw new ValidationError("Max concurrent snipes cannot exceed 100");
    }
    return value;
  }

  /**
   * Validates risk tolerance
   */
  static riskTolerance(value: string): "low" | "medium" | "high" {
    if (!["low", "medium", "high"].includes(value)) {
      throw new ValidationError("Risk tolerance must be 'low', 'medium', or 'high'");
    }
    return value as "low" | "medium" | "high";
  }

  /**
   * Validates ready state pattern
   */
  static readyStatePattern(value: unknown): [number, number, number] {
    if (!Array.isArray(value) || value.length !== 3) {
      throw new ValidationError("Ready state pattern must be an array of 3 numbers");
    }

    const [sts, st, tt] = value;

    if (!Number.isInteger(sts) || sts < 0 || sts > 10) {
      throw new ValidationError("STS value must be an integer between 0 and 10");
    }
    if (!Number.isInteger(st) || st < 0 || st > 10) {
      throw new ValidationError("ST value must be an integer between 0 and 10");
    }
    if (!Number.isInteger(tt) || tt < 0 || tt > 10) {
      throw new ValidationError("TT value must be an integer between 0 and 10");
    }

    return [sts, st, tt];
  }

  /**
   * Validates target advance hours
   */
  static targetAdvanceHours(value: number): number {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new ValidationError("Target advance hours must be a valid number");
    }
    if (value < 0.5) {
      throw new ValidationError("Target advance hours must be at least 0.5 hours");
    }
    if (value > 168) {
      throw new ValidationError("Target advance hours cannot exceed 168 hours (1 week)");
    }
    return value;
  }

  /**
   * Validates poll interval in seconds
   */
  static pollInterval(value: number, minSeconds = 10, maxSeconds = 3600): number {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isInteger(value)) {
      throw new ValidationError("Poll interval must be a valid integer");
    }
    if (value < minSeconds) {
      throw new ValidationError(`Poll interval must be at least ${minSeconds} seconds`);
    }
    if (value > maxSeconds) {
      throw new ValidationError(`Poll interval cannot exceed ${maxSeconds} seconds`);
    }
    return value;
  }

  /**
   * Validates all take profit levels at once
   */
  static validateTakeProfitLevels(data: Record<string, unknown>): Record<string, number> {
    const collector = new ErrorCollector();
    const validated: Record<string, number> = {};

    const levels = [
      { key: "takeProfitLevel1", name: "Take profit level 1" },
      { key: "takeProfitLevel2", name: "Take profit level 2" },
      { key: "takeProfitLevel3", name: "Take profit level 3" },
      { key: "takeProfitLevel4", name: "Take profit level 4" },
      { key: "takeProfitCustom", name: "Custom take profit level" },
    ];

    for (const { key, name } of levels) {
      if (data[key] !== undefined) {
        try {
          validated[key] = Validators.takeProfitLevel(Number(data[key]), name);
        } catch (error) {
          if (error instanceof ValidationError) {
            collector.add(error.message, key);
          }
        }
      }
    }

    collector.throwIfErrors();
    return validated;
  }

  /**
   * Validates a complete user preferences object
   */
  static validateUserPreferences(data: Record<string, unknown>): Record<string, unknown> {
    const collector = new ErrorCollector();
    const validated: Record<string, unknown> = {};

    // Required fields
    try {
      validated.userId = Validators.userId(data.userId);
    } catch (error) {
      if (error instanceof ValidationError) {
        collector.add(error.message, "userId");
      }
    }

    // Optional fields with validation
    if (data.defaultBuyAmountUsdt !== undefined) {
      try {
        validated.defaultBuyAmountUsdt = Validators.buyAmountUsdt(
          Number(data.defaultBuyAmountUsdt)
        );
      } catch (error) {
        if (error instanceof ValidationError) {
          collector.add(error.message, "defaultBuyAmountUsdt");
        }
      }
    }

    if (data.maxConcurrentSnipes !== undefined) {
      try {
        validated.maxConcurrentSnipes = Validators.maxConcurrentSnipes(
          Number(data.maxConcurrentSnipes)
        );
      } catch (error) {
        if (error instanceof ValidationError) {
          collector.add(error.message, "maxConcurrentSnipes");
        }
      }
    }

    if (data.stopLossPercent !== undefined) {
      try {
        validated.stopLossPercent = Validators.stopLossPercent(Number(data.stopLossPercent));
      } catch (error) {
        if (error instanceof ValidationError) {
          collector.add(error.message, "stopLossPercent");
        }
      }
    }

    if (data.riskTolerance !== undefined) {
      try {
        validated.riskTolerance = Validators.riskTolerance(String(data.riskTolerance));
      } catch (error) {
        if (error instanceof ValidationError) {
          collector.add(error.message, "riskTolerance");
        }
      }
    }

    if (data.readyStatePattern !== undefined) {
      try {
        validated.readyStatePattern = Validators.readyStatePattern(data.readyStatePattern);
      } catch (error) {
        if (error instanceof ValidationError) {
          collector.add(error.message, "readyStatePattern");
        }
      }
    }

    if (data.targetAdvanceHours !== undefined) {
      try {
        validated.targetAdvanceHours = Validators.targetAdvanceHours(
          Number(data.targetAdvanceHours)
        );
      } catch (error) {
        if (error instanceof ValidationError) {
          collector.add(error.message, "targetAdvanceHours");
        }
      }
    }

    if (data.calendarPollIntervalSeconds !== undefined) {
      try {
        validated.calendarPollIntervalSeconds = Validators.pollInterval(
          Number(data.calendarPollIntervalSeconds),
          60, // min 1 minute
          3600 // max 1 hour
        );
      } catch (error) {
        if (error instanceof ValidationError) {
          collector.add(error.message, "calendarPollIntervalSeconds");
        }
      }
    }

    if (data.symbolsPollIntervalSeconds !== undefined) {
      try {
        validated.symbolsPollIntervalSeconds = Validators.pollInterval(
          Number(data.symbolsPollIntervalSeconds),
          10, // min 10 seconds
          300 // max 5 minutes
        );
      } catch (error) {
        if (error instanceof ValidationError) {
          collector.add(error.message, "symbolsPollIntervalSeconds");
        }
      }
    }

    // Validate take profit levels
    try {
      const takeProfitLevels = Validators.validateTakeProfitLevels(data);
      Object.assign(validated, takeProfitLevels);
    } catch (error) {
      if (error instanceof ValidationError) {
        collector.add(error.message);
      }
    }

    collector.throwIfErrors();
    return validated;
  }
}
