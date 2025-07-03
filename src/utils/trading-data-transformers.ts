/**
 * Simple Trading Data Transformers
 */

export function normalizeVcoinId(vcoinId: string | number): string {
  return vcoinId.toString();
}

/**
 * Validate trading target data
 */
export function validateTradingTarget(target: any): boolean {
  if (!target || typeof target !== "object") {
    return false;
  }

  // Basic validation - check for required fields
  const requiredFields = ["vcoinId", "symbolName"];
  return requiredFields.every((field) => target[field] != null);
}

/**
 * Transform trading target data
 */
export function transformTradingTarget(target: any): {
  vcoinId: string;
  symbolName: string;
  listingDate?: string;
  isReady?: boolean;
} {
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
export function safeGetProperty<T>(obj: any, key: string, fallback: T): T {
  if (!obj || typeof obj !== "object") {
    return fallback;
  }

  return obj[key] !== undefined ? obj[key] : fallback;
}
