/**
 * Pattern Detection Engine - Refactored Entry Point
 * 
 * This file replaces the original 1816-line monolithic pattern-detection-engine.ts
 * with a clean module-based architecture for better maintainability.
 * 
 * ARCHITECTURE:
 * - Core orchestration: PatternDetectionCore
 * - Modular components in src/core/pattern-detection/
 * - Clean separation of concerns
 * - Preserved all original functionality
 * 
 * MODULES:
 * - interfaces.ts: All type definitions
 * - pattern-detection-core.ts: Main orchestrator
 * - pattern-analyzer.ts: Core analysis logic
 * - confidence-calculator.ts: Confidence scoring
 * - pattern-storage.ts: Data persistence
 * - pattern-validator.ts: Validation logic
 */

// Export the main PatternDetectionCore as the primary interface
export { PatternDetectionCore } from "../core/pattern-detection/pattern-detection-core";

// Export all interfaces and types for backward compatibility
export type {
  // Core interfaces
  PatternAnalysisRequest,
  PatternAnalysisResult,
  PatternMatch,
  ReadyStatePattern,
  PatternDetectionConfig,
  PatternDetectionMetrics,
  
  // Analysis interfaces  
  CorrelationAnalysis,
  PatternCorrelation,
  PatternStatistics,
  
  // Component interfaces
  IPatternAnalyzer,
  IConfidenceCalculator,
  IPatternStorage,
  IPatternValidator,
  
  // Utility types
  PatternType,
  ConfidenceLevel,
  PatternSource,
} from "../core/pattern-detection/interfaces";

// Export individual components for advanced usage
export { PatternAnalyzer } from "../core/pattern-detection/pattern-analyzer";
export { ConfidenceCalculator } from "../core/pattern-detection/confidence-calculator";
export { PatternStorage } from "../core/pattern-detection/pattern-storage";
export { PatternValidator } from "../core/pattern-detection/pattern-validator";

// Convenience function for backward compatibility
export function createPatternDetectionEngine(config?: any) {
  return PatternDetectionCore.getInstance(config);
}

// Export default instance for legacy compatibility
export const patternDetectionEngine = PatternDetectionCore.getInstance();

/**
 * MIGRATION GUIDE:
 * 
 * OLD (monolithic):
 * ```ts
 * import { PatternDetectionEngine } from './pattern-detection-engine';
 * const engine = new PatternDetectionEngine();
 * ```
 * 
 * NEW (modular):
 * ```ts
 * import { PatternDetectionCore } from './pattern-detection-engine';
 * const engine = PatternDetectionCore.getInstance();
 * ```
 * 
 * Or use the convenience export:
 * ```ts
 * import { patternDetectionEngine } from './pattern-detection-engine';
 * ```
 */