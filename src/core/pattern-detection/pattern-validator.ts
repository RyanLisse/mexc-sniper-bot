/**
 * Pattern Validator - Validation Framework Module
 *
 * Comprehensive validation framework for pattern detection system.
 * Ensures data quality and prevents invalid pattern processing.
 *
 * Architecture:
 * - Type-safe validation
 * - Comprehensive error reporting
 * - Performance optimized
 * - Extensible validation rules
 */

import type { CalendarEntry, SymbolEntry } from "../../services/mexc-unified-exports";
import type { IPatternValidator, PatternAnalysisRequest, PatternMatch } from "./interfaces";

/**
 * Pattern Validator Implementation
 *
 * Provides comprehensive validation for all pattern detection inputs and outputs.
 */
export class PatternValidator implements IPatternValidator {
  private static instance: PatternValidator;
  private logger = {
    info: (message: string, context?: any) =>
      console.info("[pattern-validator]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[pattern-validator]", message, context || ""),
    error: (message: string, context?: any, error?: Error) =>
      console.error("[pattern-validator]", message, context || "", error || ""),
    debug: (message: string, context?: any) =>
      console.debug("[pattern-validator]", message, context || ""),
  };

  static getInstance(): PatternValidator {
    if (!PatternValidator.instance) {
      PatternValidator.instance = new PatternValidator();
    }
    return PatternValidator.instance;
  }

  /**
   * Validate Symbol Entry
   *
   * Validates symbol data for pattern analysis.
   */
  validateSymbolEntry(symbol: SymbolEntry): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if symbol exists
      if (!symbol) {
        errors.push("Symbol entry is null or undefined");
        return { isValid: false, errors, warnings };
      }

      // Required fields validation
      if (!symbol.cd || typeof symbol.cd !== "string") {
        errors.push("Symbol code (cd) is required and must be a string");
      }

      if (typeof symbol.sts !== "number") {
        errors.push("Symbol trading status (sts) is required and must be a number");
      }

      if (typeof symbol.st !== "number") {
        errors.push("Symbol state (st) is required and must be a number");
      }

      if (typeof symbol.tt !== "number") {
        errors.push("Trading time (tt) is required and must be a number");
      }

      // Value range validation
      if (typeof symbol.sts === "number" && (symbol.sts < 0 || symbol.sts > 5)) {
        warnings.push("Symbol trading status (sts) outside normal range (0-5)");
      }

      if (typeof symbol.st === "number" && (symbol.st < 0 || symbol.st > 5)) {
        warnings.push("Symbol state (st) outside normal range (0-5)");
      }

      if (typeof symbol.tt === "number" && (symbol.tt < 0 || symbol.tt > 10)) {
        warnings.push("Trading time (tt) outside normal range (0-10)");
      }

      // Optional fields validation
      if (symbol.ca !== undefined && (typeof symbol.ca !== "number" || symbol.ca < 0)) {
        warnings.push("Currency amount (ca) should be a positive number if provided");
      }

      if (symbol.ps !== undefined && (typeof symbol.ps !== "number" || symbol.ps < 0)) {
        warnings.push("Price scale (ps) should be a positive number if provided");
      }

      if (symbol.qs !== undefined && (typeof symbol.qs !== "number" || symbol.qs < 0)) {
        warnings.push("Quantity scale (qs) should be a positive number if provided");
      }

      // Symbol code format validation
      if (symbol.cd && typeof symbol.cd === "string") {
        if (symbol.cd.length < 3) {
          warnings.push("Symbol code seems too short (less than 3 characters)");
        }
        if (symbol.cd.length > 20) {
          warnings.push("Symbol code seems too long (more than 20 characters)");
        }
        if (!/^[A-Z0-9]+$/.test(symbol.cd)) {
          warnings.push("Symbol code contains non-alphanumeric characters");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown validation error";
      errors.push(`Validation error: ${errorMessage}`);
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }

  /**
   * Validate Calendar Entry
   *
   * Validates calendar entry data for advance opportunity analysis.
   */
  validateCalendarEntry(entry: CalendarEntry): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if entry exists
      if (!entry) {
        errors.push("Calendar entry is null or undefined");
        return { isValid: false, errors, warnings };
      }

      // Required fields validation
      if (!entry.symbol || typeof entry.symbol !== "string") {
        errors.push("Symbol is required and must be a string");
      }

      if (!entry.firstOpenTime) {
        errors.push("First open time is required");
      }

      // Validate firstOpenTime
      if (entry.firstOpenTime) {
        const timestamp =
          typeof entry.firstOpenTime === "number"
            ? entry.firstOpenTime
            : new Date(entry.firstOpenTime).getTime();

        if (isNaN(timestamp)) {
          errors.push("First open time is not a valid timestamp");
        } else {
          const now = Date.now();
          if (timestamp < now) {
            warnings.push("First open time is in the past");
          }

          const futureLimit = now + 365 * 24 * 60 * 60 * 1000; // 1 year
          if (timestamp > futureLimit) {
            warnings.push("First open time is more than 1 year in the future");
          }
        }
      }

      // Optional fields validation
      if (
        entry.vcoinId !== undefined &&
        (typeof entry.vcoinId !== "string" || entry.vcoinId.length === 0)
      ) {
        warnings.push("Vcoin ID should be a non-empty string if provided");
      }

      if (
        entry.projectName !== undefined &&
        (typeof entry.projectName !== "string" || entry.projectName.length === 0)
      ) {
        warnings.push("Project name should be a non-empty string if provided");
      }

      // Symbol format validation
      if (entry.symbol && typeof entry.symbol === "string") {
        if (entry.symbol.length < 3) {
          warnings.push("Symbol seems too short (less than 3 characters)");
        }
        if (entry.symbol.length > 20) {
          warnings.push("Symbol seems too long (more than 20 characters)");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown validation error";
      errors.push(`Validation error: ${errorMessage}`);
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }

  /**
   * Validate Pattern Match
   *
   * Validates pattern match results for consistency and completeness.
   */
  validatePatternMatch(match: PatternMatch): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if match exists
      if (!match) {
        errors.push("Pattern match is null or undefined");
        return { isValid: false, errors, warnings };
      }

      // Required fields validation
      if (!match.patternType || typeof match.patternType !== "string") {
        errors.push("Pattern type is required and must be a string");
      }

      if (typeof match.confidence !== "number") {
        errors.push("Confidence is required and must be a number");
      }

      if (!match.symbol || typeof match.symbol !== "string") {
        errors.push("Symbol is required and must be a string");
      }

      if (!match.detectedAt || !(match.detectedAt instanceof Date)) {
        errors.push("Detection time is required and must be a Date");
      }

      if (typeof match.advanceNoticeHours !== "number") {
        errors.push("Advance notice hours is required and must be a number");
      }

      if (!match.riskLevel || !["low", "medium", "high"].includes(match.riskLevel)) {
        errors.push("Risk level must be one of: low, medium, high");
      }

      if (
        !match.recommendation ||
        !["immediate_action", "monitor_closely", "prepare_entry", "wait", "avoid"].includes(
          match.recommendation
        )
      ) {
        errors.push(
          "Recommendation must be one of: immediate_action, monitor_closely, prepare_entry, wait, avoid"
        );
      }

      // Value validation
      if (typeof match.confidence === "number") {
        if (match.confidence < 0 || match.confidence > 100) {
          errors.push("Confidence must be between 0 and 100");
        }
      }

      if (typeof match.advanceNoticeHours === "number") {
        if (match.advanceNoticeHours < 0) {
          errors.push("Advance notice hours cannot be negative");
        }
        if (match.advanceNoticeHours > 8760) {
          // 1 year in hours
          warnings.push("Advance notice hours seems unusually high (over 1 year)");
        }
      }

      // Pattern type validation
      if (match.patternType && typeof match.patternType === "string") {
        const validTypes = ["ready_state", "pre_ready", "launch_sequence", "risk_warning"];
        if (!validTypes.includes(match.patternType)) {
          warnings.push(`Unknown pattern type: ${match.patternType}`);
        }
      }

      // Indicators validation
      if (match.indicators) {
        if (match.indicators.sts !== undefined && typeof match.indicators.sts !== "number") {
          warnings.push("Indicator sts should be a number if provided");
        }
        if (match.indicators.st !== undefined && typeof match.indicators.st !== "number") {
          warnings.push("Indicator st should be a number if provided");
        }
        if (match.indicators.tt !== undefined && typeof match.indicators.tt !== "number") {
          warnings.push("Indicator tt should be a number if provided");
        }
      }

      // Historical success validation
      if (match.historicalSuccess !== undefined) {
        if (
          typeof match.historicalSuccess !== "number" ||
          match.historicalSuccess < 0 ||
          match.historicalSuccess > 100
        ) {
          warnings.push("Historical success should be a percentage between 0 and 100");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown validation error";
      errors.push(`Validation error: ${errorMessage}`);
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }

  /**
   * Validate Analysis Request
   *
   * Validates pattern analysis request parameters.
   */
  validateAnalysisRequest(request: PatternAnalysisRequest): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if request exists
      if (!request) {
        errors.push("Analysis request is null or undefined");
        return { isValid: false, errors, warnings };
      }

      // Required fields validation
      if (!request.analysisType || typeof request.analysisType !== "string") {
        errors.push("Analysis type is required and must be a string");
      }

      // Analysis type validation
      if (request.analysisType && typeof request.analysisType === "string") {
        const validTypes = ["discovery", "monitoring", "validation", "correlation"];
        if (!validTypes.includes(request.analysisType)) {
          errors.push(
            `Invalid analysis type: ${request.analysisType}. Must be one of: ${validTypes.join(", ")}`
          );
        }
      }

      // Data validation
      if (!request.symbols && !request.calendarEntries) {
        errors.push("Either symbols or calendar entries must be provided");
      }

      if (request.symbols && !Array.isArray(request.symbols)) {
        errors.push("Symbols must be an array if provided");
      }

      if (request.calendarEntries && !Array.isArray(request.calendarEntries)) {
        errors.push("Calendar entries must be an array if provided");
      }

      // Optional fields validation
      if (request.confidenceThreshold !== undefined) {
        if (
          typeof request.confidenceThreshold !== "number" ||
          request.confidenceThreshold < 0 ||
          request.confidenceThreshold > 100
        ) {
          errors.push("Confidence threshold must be a number between 0 and 100");
        }
      }

      if (request.timeframe !== undefined && typeof request.timeframe !== "string") {
        warnings.push("Timeframe should be a string if provided");
      }

      if (
        request.includeHistorical !== undefined &&
        typeof request.includeHistorical !== "boolean"
      ) {
        warnings.push("Include historical should be a boolean if provided");
      }

      // Array size validation
      if (request.symbols && Array.isArray(request.symbols)) {
        if (request.symbols.length === 0) {
          warnings.push("Symbols array is empty");
        }
        if (request.symbols.length > 1000) {
          warnings.push("Large number of symbols may impact performance");
        }
      }

      if (request.calendarEntries && Array.isArray(request.calendarEntries)) {
        if (request.calendarEntries.length === 0) {
          warnings.push("Calendar entries array is empty");
        }
        if (request.calendarEntries.length > 500) {
          warnings.push("Large number of calendar entries may impact performance");
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown validation error";
      errors.push(`Validation error: ${errorMessage}`);
    }

    const isValid = errors.length === 0;
    return { isValid, errors, warnings };
  }
}
