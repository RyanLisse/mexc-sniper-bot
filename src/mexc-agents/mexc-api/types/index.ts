/**
 * MEXC API Agent Type Definitions
 */

export interface MexcApiParams {
  vcoin_id?: string;
  vcoinId?: string;
  symbol?: string;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface MexcApiRequest {
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  params?: MexcApiParams;
  requireAuth?: boolean;
}

export interface MexcApiResponseData {
  success: boolean;
  data: unknown;
  timestamp: string;
  error?: string;
}

export interface MexcSymbolData {
  symbol: string;
  vcoinId: string;
  status: string;
  tradingStart?: string;
  tradingEnd?: string;
  price?: number;
  volume?: number;
  isTrading: boolean;
  hasCompleteData: boolean;
}

export interface MexcSymbolFilterData {
  cd: string;
  symbol?: string;
  sts?: number;
  st?: number;
  tt?: number;
  [key: string]: unknown;
}

export interface MexcCalendarEntry {
  vcoinId: string;
  symbolName: string;
  projectName: string;
  launchTime: string;
  status: string;
  tradingPairs: string[];
}

export interface EnhancedApiResponse {
  success: boolean;
  data: unknown;
  timestamp: string;
  endpoint: string;
  aiAnalysis?: {
    analysis: string;
    timestamp: string;
    endpoint: string;
    performanceMetrics?: {
      executionTimeMs?: number;
      cached?: boolean;
      circuitBreakerState?: string;
    };
  };
  error?: string;
  metadata?: {
    operation: string;
    errorType?: string;
  };
}

export interface AnalysisResult {
  type: "calendar" | "symbols" | "market_overview" | "health" | "data_quality";
  endpoint: string;
  insights: string;
  recommendations?: string[];
  riskLevel?: "low" | "medium" | "high";
  confidence?: number;
}
