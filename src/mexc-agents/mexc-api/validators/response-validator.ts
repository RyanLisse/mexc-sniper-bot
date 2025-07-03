/**
 * Response Validator
 *
 * Validates API responses and data structures
 */

import type { MexcApiResponseData } from "../types";

export class ResponseValidator {
  /**
   * Validate API response structure
   */
  isValidApiResponseStructure(
    response: unknown
  ): response is MexcApiResponseData {
    return (
      typeof response === "object" &&
      response !== null &&
      "success" in response &&
      "data" in response &&
      typeof (response as MexcApiResponseData).success === "boolean"
    );
  }

  /**
   * Validate general API response
   */
  isValidApiResponse(response: unknown): boolean {
    if (!response || typeof response !== "object") {
      return false;
    }

    // Check for expected structure
    return (
      Object.hasOwn(response, "success") &&
      Object.hasOwn(response, "data") &&
      Object.hasOwn(response, "timestamp")
    );
  }

  /**
   * Validate symbol data structure
   */
  isValidSymbolData(data: unknown): boolean {
    if (!data || typeof data !== "object") return false;

    const obj = data as Record<string, unknown>;
    return (
      typeof obj.symbol === "string" &&
      typeof obj.vcoinId === "string" &&
      typeof obj.isTrading === "boolean" &&
      typeof obj.hasCompleteData === "boolean"
    );
  }

  /**
   * Validate calendar entry structure
   */
  isValidCalendarEntry(data: unknown): boolean {
    if (!data || typeof data !== "object") return false;

    const obj = data as Record<string, unknown>;
    return (
      typeof obj.vcoinId === "string" &&
      typeof obj.symbolName === "string" &&
      typeof obj.projectName === "string" &&
      typeof obj.launchTime === "string" &&
      Array.isArray(obj.tradingPairs)
    );
  }

  /**
   * Validate service response structure
   */
  isValidServiceResponse(response: unknown): boolean {
    if (!response || typeof response !== "object") return false;

    const obj = response as Record<string, unknown>;
    return (
      typeof obj.success === "boolean" &&
      obj.data !== undefined &&
      typeof obj.timestamp === "string"
    );
  }

  /**
   * Check if response contains error
   */
  hasError(response: unknown): boolean {
    if (!response || typeof response !== "object") return true;

    const obj = response as Record<string, unknown>;
    return obj.success === false || Boolean(obj.error);
  }

  /**
   * Extract error message from response
   */
  getErrorMessage(response: unknown): string {
    if (!response || typeof response !== "object") return "Invalid response";

    const obj = response as Record<string, unknown>;
    if (typeof obj.error === "string") return obj.error;
    if (obj.success === false) return "Operation failed";

    return "Unknown error";
  }

  /**
   * Validate trading signal data
   */
  isValidTradingSignal(data: unknown): boolean {
    if (!data || typeof data !== "object") return false;

    const obj = data as Record<string, unknown>;
    return (
      typeof obj.symbol === "string" &&
      typeof obj.confidence === "number" &&
      obj.confidence >= 0 &&
      obj.confidence <= 1
    );
  }

  /**
   * Validate array of data items
   */
  isValidDataArray(
    data: unknown,
    validator: (item: unknown) => boolean
  ): boolean {
    if (!Array.isArray(data)) return false;
    return data.every(validator);
  }
}
