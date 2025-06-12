import { queryKeys } from "@/src/lib/query-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Type definitions for MEXC API responses
interface MexcSymbol {
  sts: number;
  st: number;
  tt: number;
  cd: string;
  [key: string]: unknown;
}

interface CalendarEntry {
  firstOpenTime: string | number;
  vcoinId: string;
  symbol: string;
  [key: string]: unknown;
}

// MEXC Calendar Data Hook
export function useMexcCalendar() {
  return useQuery({
    queryKey: queryKeys.mexcCalendar(),
    queryFn: async () => {
      const response = await fetch("/api/mexc/calendar");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes
    retry: 3,
  });
}

// MEXC Symbols Data Hook
export function useMexcSymbols(vcoinId?: string) {
  return useQuery({
    queryKey: queryKeys.mexcSymbols(vcoinId),
    queryFn: async () => {
      const url = vcoinId ? `/api/mexc/symbols?vcoinId=${vcoinId}` : "/api/mexc/symbols";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data;
    },
    enabled: true, // Always enabled for symbols data
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
    retry: 3,
  });
}

// MEXC Server Time Hook
export function useMexcServerTime() {
  return useQuery({
    queryKey: queryKeys.mexcServerTime(),
    queryFn: async () => {
      const response = await fetch("/api/mexc/server-time");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      return result.serverTime;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Auto-refetch every minute
    retry: 3,
  });
}

// MEXC Connectivity Test Hook
export function useMexcConnectivity() {
  return useQuery({
    queryKey: ["mexc", "connectivity"],
    queryFn: async () => {
      const response = await fetch("/api/mexc/connectivity");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      return result.connected;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 3,
  });
}

// Mutation for Manual Calendar Refresh
export function useRefreshMexcCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/mexc/calendar");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data;
    },
    onSuccess: (data) => {
      // Update the calendar cache
      queryClient.setQueryData(queryKeys.mexcCalendar(), data);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["mexc"] });
    },
  });
}

// Mutation for Manual Symbols Refresh
export function useRefreshMexcSymbols() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vcoinId?: string) => {
      const url = vcoinId ? `/api/mexc/symbols?vcoinId=${vcoinId}` : "/api/mexc/symbols";
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      return { vcoinId, data: result.data };
    },
    onSuccess: ({ vcoinId, data }) => {
      // Update the symbols cache
      queryClient.setQueryData(queryKeys.mexcSymbols(vcoinId), data);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["mexc", "symbols"] });
    },
  });
}

// Hook for real-time pattern detection
export function useMexcPatternDetection(vcoinId?: string) {
  const { data: symbols, isLoading, error } = useMexcSymbols(vcoinId);

  // Analyze symbols for ready state pattern (sts:2, st:2, tt:4)
  const readyStatePattern = symbols?.find(
    (symbol: MexcSymbol) => symbol.sts === 2 && symbol.st === 2 && symbol.tt === 4
  );

  const hasReadyPattern = !!readyStatePattern;
  const patternConfidence = hasReadyPattern ? 95 : 0;

  return {
    symbols,
    readyStatePattern,
    hasReadyPattern,
    patternConfidence,
    isLoading,
    error,
  };
}

// Hook for upcoming launches (next 24 hours)
export function useUpcomingLaunches() {
  const { data: calendar, ...rest } = useMexcCalendar();

  const upcomingLaunches = Array.isArray(calendar)
    ? calendar.filter((entry: CalendarEntry) => {
        const launchTime = new Date(entry.firstOpenTime);
        const now = new Date();
        const hours24 = 24 * 60 * 60 * 1000;

        return (
          launchTime.getTime() > now.getTime() &&
          launchTime.getTime() < now.getTime() + hours24
        );
      })
    : [];

  return {
    data: upcomingLaunches,
    count: upcomingLaunches.length,
    ...rest,
  };
}

// Hook for ready targets (launching within 4 hours)
export function useReadyTargets() {
  const { data: calendar, ...rest } = useMexcCalendar();

  const readyTargets = Array.isArray(calendar)
    ? calendar.filter((entry: CalendarEntry) => {
        const launchTime = new Date(entry.firstOpenTime);
        const now = new Date();
        const hours4 = 4 * 60 * 60 * 1000;

        return (
          launchTime.getTime() > now.getTime() &&
          launchTime.getTime() < now.getTime() + hours4
        );
      })
    : [];

  return {
    data: readyTargets,
    count: readyTargets.length,
    ...rest,
  };
}

// Hook for MEXC account balance
export function useMexcAccount(userId: string) {
  return useQuery({
    queryKey: ["mexc", "account", userId],
    queryFn: async () => {
      const response = await fetch(`/api/mexc/account?userId=${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      return result;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Auto-refetch every minute
    retry: 2,
    enabled: !!userId,
  });
}
