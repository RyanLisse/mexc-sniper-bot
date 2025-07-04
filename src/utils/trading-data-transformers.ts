/**
 * Simple Trading Data Transformers
 */

// Type definitions for trading targets
interface RawTradingTarget {
  vcoinId?: string | number;
  id?: string | number;
  symbolName?: string;
  symbol?: string;
  listingDate?: string;
  listing_date?: string;
  isReady?: boolean;
  is_ready?: boolean;
  [key: string]: unknown;
}

interface TransformedTradingTarget {
  vcoinId: string;
  symbolName: string;
  listingDate?: string;
  isReady?: boolean;
}

export function normalizeVcoinId(vcoinId: string | number | null | undefined): string {
  // Handle null/undefined values
  if (vcoinId == null) {
    return "";
  }

  // Handle different types safely
  if (typeof vcoinId === 'string') {
    return vcoinId.trim();
  }

  if (typeof vcoinId === 'number') {
    // Handle NaN and infinite numbers
    if (isNaN(vcoinId) || !isFinite(vcoinId)) {
      return "";
    }
    return vcoinId.toString();
  }

  // Handle other types by converting to string safely
  try {
    return String(vcoinId);
  } catch (error) {
    console.warn('Error normalizing vcoinId:', error);
    return "";
  }
}

/**
 * Validate trading target data
 */
export function validateTradingTarget(
  target: unknown
): target is RawTradingTarget {
  if (!target || typeof target !== "object") {
    return false;
  }

  const typedTarget = target as Record<string, unknown>;

  // Basic validation - check for required fields
  return (
    (typedTarget.vcoinId != null || typedTarget.id != null) &&
    (typedTarget.symbolName != null || typedTarget.symbol != null)
  );
}

/**
 * Transform trading target data
 */
export function transformTradingTarget(
  target: RawTradingTarget
): TransformedTradingTarget {
  return {
    vcoinId: normalizeVcoinId(target.vcoinId || target.id || ""),
    symbolName: target.symbolName || target.symbol || "",
    listingDate: target.listingDate || target.listing_date,
    isReady: Boolean(target.isReady || target.is_ready),
  };
}

/**
 * Safely get property from object with fallback
 */
export function safeGetProperty<T>(
  obj: Record<string, unknown> | null | undefined,
  key: string,
  fallback: T
): T {
  // Enhanced null safety checks
  if (!obj || typeof obj !== "object" || obj === null) {
    return fallback;
  }

  // Validate key parameter
  if (!key || typeof key !== 'string') {
    return fallback;
  }

  try {
    const value = obj[key];
    // More comprehensive undefined/null check
    return (value !== undefined && value !== null) ? (value as T) : fallback;
  } catch (error) {
    console.warn('Error accessing property:', key, error);
    return fallback;
  }
}
