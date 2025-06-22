/**
 * Pattern Detection Core Module - Entry Point
 * 
 * This module provides the decomposed pattern detection system with clear separation
 * of concerns and improved maintainability. Replaces the monolithic 1503-line engine.
 * 
 * Architecture:
 * - PatternAnalyzer: Core analysis algorithms
 * - ConfidenceCalculator: Scoring and validation
 * - PatternStorage: Repository and caching
 * - PatternValidation: Validation framework
 * 
 * @example
 * ```typescript
 * import { PatternDetectionCore } from './core/pattern-detection';
 * 
 * const detector = new PatternDetectionCore();
 * const result = await detector.analyzePatterns(symbols);
 * ```
 */

// Core interfaces
export * from './interfaces';

// Main modules
export { PatternAnalyzer } from './pattern-analyzer';
export { ConfidenceCalculator } from './confidence-calculator'; 
export { PatternStorage } from './pattern-storage';
export { PatternValidator } from './pattern-validator';

// Main orchestrator
export { PatternDetectionCore } from './pattern-detection-core';