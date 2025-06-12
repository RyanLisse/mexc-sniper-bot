/**
 * Custom hook for time formatting utilities
 * Provides memoized time formatting functions to reduce re-renders
 */

import { useCallback, useMemo } from "react";

export function useTimeFormatting() {
  const formatTimeAgo = useCallback((timestamp: string | Date) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }, []);

  const formatTimeRemaining = useCallback((launchTime: Date | number) => {
    const launch = typeof launchTime === "number" ? new Date(launchTime) : launchTime;
    const now = Date.now();
    const hoursRemaining = (launch.getTime() - now) / (1000 * 60 * 60);

    if (hoursRemaining < 0) return "Launched";
    if (hoursRemaining < 1) return `${Math.floor(hoursRemaining * 60)}m`;
    if (hoursRemaining < 24) return `${hoursRemaining.toFixed(1)}h`;
    return `${Math.floor(hoursRemaining / 24)}d ${Math.floor(hoursRemaining % 24)}h`;
  }, []);

  const formatUptime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }, []);

  return useMemo(
    () => ({
      formatTimeAgo,
      formatTimeRemaining,
      formatUptime,
    }),
    [formatTimeAgo, formatTimeRemaining, formatUptime]
  );
}
