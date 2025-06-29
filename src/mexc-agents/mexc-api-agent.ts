/**
 * MEXC API Agent
 * 
 * This file has been refactored for maintainability.
 * The original 912-line implementation has been split into focused modules.
 * 
 * This file now serves as a backward-compatibility layer.
 */

// Re-export everything from the new modular structure
export { 
  MexcApiAgent,
  SymbolAnalyzer,
  CalendarAnalyzer,
  DataQualityAnalyzer,
  ResponseValidator,
  ResponseEnhancer
} from "./mexc-api";

export type {
  MexcApiParams,
  MexcApiRequest,
  MexcApiResponseData,
  MexcSymbolData,
  MexcSymbolFilterData,
  MexcCalendarEntry,
  EnhancedApiResponse,
  AnalysisResult,
} from "./mexc-api";