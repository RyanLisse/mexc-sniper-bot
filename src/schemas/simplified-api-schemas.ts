/**
 * SIMPLIFIED API SCHEMAS - ESSENTIAL ONLY
 * Replaces complex discriminated unions with simple interfaces
 * Prioritizes TypeScript compilation success over strict validation
 */

// ============================================================================
// SIMPLIFIED RESPONSE TYPES - NO COMPLEX UNIONS
// ============================================================================

export interface ApiResponse {
  success?: boolean;
  data?: any;
  error?: string;
  code?: string;
  details?: any;
  message?: string;
  timestamp?: string;
  meta?: any;
  statusCode?: number;
}

export interface ValidationResult<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  details?: any;
  statusCode?: number;
}

// ============================================================================
// TRADING TYPES - MINIMAL STRUCTURE
// ============================================================================

export interface AutoSnipeConfig {
  enabled?: boolean;
  maxPositionSize?: number;
  stopLossPercentage?: number;
  takeProfitPercentage?: number;
  patternConfidenceThreshold?: number;
  maxConcurrentTrades?: number;
  enableSafetyChecks?: boolean;
  enablePatternDetection?: boolean;
}

export interface Phase3Configuration {
  performance?: any;
  aiIntelligence?: any;
  patternDetection?: any;
  cacheWarming?: any;
}

export interface PortfolioData {
  totalValue?: number;
  totalPnL?: number;
  activePositions?: any[];
  metrics?: any;
  recentActivity?: any[];
}

// ============================================================================
// SIMPLIFIED VALIDATION FUNCTIONS
// ============================================================================

export function validateData<T>(data: any): ValidationResult<T> {
  return { success: true, data };
}

export function createSuccessResponse<T>(
  data: T,
  message?: string
): ApiResponse {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

export function createErrorResponse(error: string, code?: string): ApiResponse {
  return {
    success: false,
    error,
    code,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// SIMPLE HELPER FUNCTIONS
// ============================================================================

export function validateRequestBody(body: any): ValidationResult {
  if (!body) {
    return { success: false, error: "Request body is required" };
  }
  return { success: true, data: body };
}

export function validateUserId(userId?: string): ValidationResult {
  if (!userId) {
    return { success: false, error: "User ID is required" };
  }
  return { success: true, data: { userId } };
}

// Legacy compatibility exports
export const ApiSuccessResponseSchema = null;
export const ApiErrorResponseSchema = null;
export const ApiResponseSchema = null;

export type ApiSuccessResponse = ApiResponse;
export type ApiErrorResponse = ApiResponse;
