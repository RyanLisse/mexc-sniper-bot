/**
 * Custom hook for currency and number formatting utilities
 * Provides memoized formatting functions to reduce re-renders
 */

import { useCallback, useMemo } from "react";

export function useCurrencyFormatting() {
  const formatCurrency = useCallback(
    (amount: number | null | undefined, decimals = 2) => {
      // Handle null/undefined/NaN values
      if (amount == null || Number.isNaN(amount) || !Number.isFinite(amount)) {
        return "0.00";
      }

      // Ensure decimals is a valid number
      const safeDecimals =
        typeof decimals === "number" && decimals >= 0 && decimals <= 20
          ? decimals
          : 2;

      try {
        return new Intl.NumberFormat("en-US", {
          minimumFractionDigits: safeDecimals,
          maximumFractionDigits: safeDecimals,
        }).format(amount);
      } catch (error) {
        console.warn("Currency formatting error:", error);
        return amount.toString();
      }
    },
    []
  );

  const formatTokenAmount = useCallback(
    (amount: number | null | undefined, _asset?: string) => {
      // Handle null/undefined values early
      if (amount == null || Number.isNaN(amount) || !Number.isFinite(amount)) {
        return "0.00";
      }

      const decimals = amount < 1 ? 6 : amount < 100 ? 4 : 2;
      return formatCurrency(amount, decimals);
    },
    [formatCurrency]
  );

  const formatPercentage = useCallback((value: number | null | undefined) => {
    // Handle null/undefined/NaN values
    if (value == null || Number.isNaN(value) || !Number.isFinite(value)) {
      return "0.0%";
    }

    try {
      return `${value.toFixed(1)}%`;
    } catch (error) {
      console.warn("Percentage formatting error:", error);
      return "0.0%";
    }
  }, []);

  const formatBytes = useCallback(
    (bytes: number | null | undefined): string => {
      // Handle null/undefined/NaN values
      if (bytes == null || Number.isNaN(bytes) || !Number.isFinite(bytes)) {
        return "0.00 MB";
      }

      try {
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
      } catch (error) {
        console.warn("Bytes formatting error:", error);
        return "0.00 MB";
      }
    },
    []
  );

  const formatGrowthRate = useCallback(
    (rate: number | null | undefined): string => {
      if (rate == null || Number.isNaN(rate) || !Number.isFinite(rate)) {
        return "N/A";
      }

      try {
        const mbPerHour = rate / 1024 / 1024;
        if (Math.abs(mbPerHour) < 0.1) {
          return "Stable";
        }
        return `${mbPerHour > 0 ? "+" : ""}${mbPerHour.toFixed(2)} MB/hour`;
      } catch (error) {
        console.warn("Growth rate formatting error:", error);
        return "N/A";
      }
    },
    []
  );

  return useMemo(
    () => ({
      formatCurrency,
      formatTokenAmount,
      formatPercentage,
      formatBytes,
      formatGrowthRate,
    }),
    [
      formatCurrency,
      formatTokenAmount,
      formatPercentage,
      formatBytes,
      formatGrowthRate,
    ]
  );
}
