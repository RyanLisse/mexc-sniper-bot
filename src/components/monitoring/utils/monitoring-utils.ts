/**
 * Production Monitoring Utilities
 *
 * Utility functions for the production monitoring dashboard.
 * Extracted from the main dashboard component for better modularity.
 */

import { AlertCircle, AlertTriangle, CheckCircle, Clock } from "lucide-react";

/**
 * Get CSS classes for status indicators
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case "healthy":
    case "operational":
      return "text-green-600 bg-green-50";
    case "degraded":
      return "text-yellow-600 bg-yellow-50";
    case "critical":
    case "outage":
      return "text-red-600 bg-red-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
};

/**
 * Get appropriate icon component for status
 */
export const getStatusIcon = (status: string) => {
  switch (status) {
    case "healthy":
    case "operational":
      return CheckCircle;
    case "degraded":
      return AlertTriangle;
    case "critical":
    case "outage":
      return AlertCircle;
    default:
      return Clock;
  }
};

/**
 * Format uptime seconds to human readable format
 */
export const formatUptime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

/**
 * Format bytes to MB with one decimal place
 */
export const formatBytes = (bytes: number): string => {
  const MB = bytes / (1024 * 1024);
  return `${MB.toFixed(1)} MB`;
};

/**
 * Get badge variant based on metric value and thresholds
 */
export const getBadgeVariant = (
  value: number,
  threshold: number
): "default" | "destructive" => {
  return value < threshold ? "default" : "destructive";
};

/**
 * Calculate progress percentage with maximum cap
 */
export const calculateProgress = (
  value: number,
  max: number,
  cap: number = 100
): number => {
  return Math.min((value / max) * 100, cap);
};
