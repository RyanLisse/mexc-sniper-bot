/**
 * Auto-Sniping Dashboard Helper Utilities
 *
 * Common utility functions for formatting, validation, and data processing
 */

/**
 * Format currency values with USD formatting
 */
export const formatCurrency = (value: string | number): string => {
  const num = typeof value === "string" ? Number.parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/**
 * Format percentage values
 */
export const formatPercentage = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format large numbers with K/M suffixes
 */
export const formatCompactNumber = (value: number): string => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
};

/**
 * Calculate P&L color class based on value
 */
export const getPnLColorClass = (pnl: string | number): string => {
  const pnlValue = typeof pnl === "string" ? Number.parseFloat(pnl) : pnl;

  if (pnlValue > 0) return "text-green-600";
  if (pnlValue < 0) return "text-red-600";
  return "text-gray-600";
};

/**
 * Get alert badge variant based on severity
 */
export const getAlertBadgeVariant = (severity: string): "destructive" | "secondary" | "outline" => {
  if (severity === "critical" || severity === "error") return "destructive";
  if (severity === "warning") return "secondary";
  return "outline";
};

/**
 * Format alert type for display
 */
export const formatAlertType = (type: string): string => {
  return type.replace(/_/g, " ").toUpperCase();
};

/**
 * Check if execution is in active state
 */
export const isExecutionActive = (status: string): boolean => {
  return ["running", "paused"].includes(status.toLowerCase());
};

/**
 * Get status indicator color
 */
export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case "running":
      return "bg-green-500";
    case "paused":
      return "bg-yellow-500";
    case "stopping":
    case "error":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
};

/**
 * Safe number parsing with fallback
 */
export const safeParseNumber = (value: string | number, fallback = 0): number => {
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * Validate number within range
 */
export const validateNumberRange = (
  value: number,
  min: number,
  max: number
): { isValid: boolean; error?: string } => {
  if (value < min) {
    return { isValid: false, error: `Value must be at least ${min}` };
  }
  if (value > max) {
    return { isValid: false, error: `Value cannot exceed ${max}` };
  }
  return { isValid: true };
};

/**
 * Debounce function for input validation
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Calculate success rate percentage
 */
export const calculateSuccessRate = (successful: number, total: number): number => {
  if (total === 0) return 0;
  return (successful / total) * 100;
};

/**
 * Format execution time duration
 */
export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

/**
 * Generate unique key for React lists
 */
export const generateKey = (prefix: string, ...identifiers: (string | number)[]): string => {
  return `${prefix}-${identifiers.join("-")}`;
};

/**
 * Check if value is positive, negative, or neutral
 */
export const getValueTrend = (value: number): "positive" | "negative" | "neutral" => {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
};

/**
 * Format timestamp for display
 */
export const formatTimestamp = (timestamp: string | Date): string => {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};
