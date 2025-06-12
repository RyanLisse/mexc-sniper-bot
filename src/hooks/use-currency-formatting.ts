/**
 * Custom hook for currency and number formatting utilities
 * Provides memoized formatting functions to reduce re-renders
 */

import { useCallback, useMemo } from "react";

export function useCurrencyFormatting() {
  const formatCurrency = useCallback((amount: number, decimals = 2) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  }, []);

  const formatTokenAmount = useCallback(
    (amount: number, _asset?: string) => {
      const decimals = amount < 1 ? 6 : amount < 100 ? 4 : 2;
      return formatCurrency(amount, decimals);
    },
    [formatCurrency]
  );

  const formatPercentage = useCallback((value: number) => {
    return `${value.toFixed(1)}%`;
  }, []);

  const formatBytes = useCallback((bytes: number): string => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }, []);

  const formatGrowthRate = useCallback((rate: number | null): string => {
    if (rate === null) return "N/A";
    const mbPerHour = rate / 1024 / 1024;
    if (Math.abs(mbPerHour) < 0.1) {
      return "Stable";
    }
    return `${mbPerHour > 0 ? "+" : ""}${mbPerHour.toFixed(2)} MB/hour`;
  }, []);

  return useMemo(
    () => ({
      formatCurrency,
      formatTokenAmount,
      formatPercentage,
      formatBytes,
      formatGrowthRate,
    }),
    [formatCurrency, formatTokenAmount, formatPercentage, formatBytes, formatGrowthRate]
  );
}
