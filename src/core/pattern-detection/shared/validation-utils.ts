/**
 * Shared Validation Utilities - Pattern Detection
 *
 * Centralized validation utilities to eliminate redundant validation code
 * across pattern detection modules. Optimized for performance and consistency.
 *
 * OPTIMIZATION: Replaces duplicate validation logic across multiple modules
 */

import type { CalendarEntry, SymbolEntry } from "../../../services/mexc-unified-exports";
import type { PatternAnalysisRequest, PatternMatch } from "../interfaces";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Fast symbol entry validation
 *
 * OPTIMIZATION: Single-pass validation with early exit for invalid data
 */
export function validateSymbolEntry(symbol: SymbolEntry): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Early exit for null/undefined
  if (!symbol) {
    return { isValid: false, errors: ["Symbol entry is null or undefined"], warnings: [] };
  }

  // Required field validation - fail fast
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

  // Early exit if critical errors found
  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  // Range validation for performance-critical fields
  if (symbol.sts < 0 || symbol.sts > 5) {
    warnings.push("Symbol trading status (sts) outside normal range (0-5)");
  }
  if (symbol.st < 0 || symbol.st > 5) {
    warnings.push("Symbol state (st) outside normal range (0-5)");
  }
  if (symbol.tt < 0 || symbol.tt > 10) {
    warnings.push("Trading time (tt) outside normal range (0-10)");
  }

  // Optional field validation - batch check for performance
  if (
    symbol.cd &&
    (symbol.cd.length < 3 || symbol.cd.length > 20 || !/^[A-Z0-9]+$/.test(symbol.cd))
  ) {
    warnings.push("Symbol code format may be invalid");
  }

  return { isValid: true, errors, warnings };
}

/**
 * Fast calendar entry validation
 *
 * OPTIMIZATION: Streamlined validation with minimal timestamp conversion overhead
 */
export function validateCalendarEntry(entry: CalendarEntry): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Early exit for null/undefined
  if (!entry) {
    return { isValid: false, errors: ["Calendar entry is null or undefined"], warnings: [] };
  }

  // Critical field validation
  if (!entry.symbol || typeof entry.symbol !== "string") {
    errors.push("Symbol is required and must be a string");
  }
  if (!entry.firstOpenTime) {
    errors.push("First open time is required");
  }

  // Early exit if critical errors found
  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  // Timestamp validation - optimized for performance
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
      if (timestamp > now + 31536000000) {
        // 1 year in ms
        warnings.push("First open time is more than 1 year in the future");
      }
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Fast pattern match validation
 *
 * OPTIMIZATION: Essential validation only, performance-focused
 */
export function validatePatternMatch(match: PatternMatch): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Early exit for null/undefined
  if (!match) {
    return { isValid: false, errors: ["Pattern match is null or undefined"], warnings: [] };
  }

  // Critical field validation - batch check
  const requiredFields = [
    { field: match.patternType, name: "patternType", type: "string" },
    { field: match.confidence, name: "confidence", type: "number" },
    { field: match.symbol, name: "symbol", type: "string" },
    { field: match.advanceNoticeHours, name: "advanceNoticeHours", type: "number" },
  ];

  for (const { field, name, type } of requiredFields) {
    if (!field || typeof field !== type) {
      errors.push(`${name} is required and must be a ${type}`);
    }
  }

  // Early exit if critical errors found
  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  // Value range validation
  if (match.confidence < 0 || match.confidence > 100) {
    errors.push("Confidence must be between 0 and 100");
  }
  if (match.advanceNoticeHours < 0) {
    errors.push("Advance notice hours cannot be negative");
  }

  // Enum validation
  if (!["low", "medium", "high"].includes(match.riskLevel)) {
    errors.push("Risk level must be one of: low, medium, high");
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Fast analysis request validation
 *
 * OPTIMIZATION: Streamlined validation for API requests
 */
export function validateAnalysisRequest(request: PatternAnalysisRequest): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Early exit for null/undefined
  if (!request) {
    return { isValid: false, errors: ["Analysis request is null or undefined"], warnings: [] };
  }

  // Required field validation
  if (!request.analysisType || typeof request.analysisType !== "string") {
    errors.push("Analysis type is required and must be a string");
  }

  // Data presence validation
  if (!request.symbols && !request.calendarEntries) {
    errors.push("Either symbols or calendar entries must be provided");
  }

  // Array validation
  if (request.symbols && !Array.isArray(request.symbols)) {
    errors.push("Symbols must be an array if provided");
  }
  if (request.calendarEntries && !Array.isArray(request.calendarEntries)) {
    errors.push("Calendar entries must be an array if provided");
  }

  // Early exit if critical errors found
  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  // Optional field validation
  if (
    request.confidenceThreshold !== undefined &&
    (typeof request.confidenceThreshold !== "number" ||
      request.confidenceThreshold < 0 ||
      request.confidenceThreshold > 100)
  ) {
    errors.push("Confidence threshold must be a number between 0 and 100");
  }

  // Performance warnings
  if (request.symbols?.length > 1000) {
    warnings.push("Large number of symbols may impact performance");
  }
  if (request.calendarEntries?.length > 500) {
    warnings.push("Large number of calendar entries may impact performance");
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Optimized confidence score validation (shared utility)
 *
 * PERFORMANCE: Single validation function used across all modules
 */
export function validateConfidenceScore(score: number): boolean {
  return (
    typeof score === "number" && !isNaN(score) && isFinite(score) && score >= 0 && score <= 100
  );
}
