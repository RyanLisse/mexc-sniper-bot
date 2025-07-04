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

export function normalizeVcoinId(vcoinId: string | number): string {
  return vcoinId.toString();
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
  if (!obj || typeof obj !== "object") {
    return fallback;
  }

  const value = obj[key];
  return value !== undefined ? (value as T) : fallback;
}
