/**
 * Simplified Pattern Monitoring Hook
 * Basic pattern monitoring state management
 */

import { useEffect, useState } from "react";

// Simplified types
export interface PatternData {
  isMonitoring: boolean;
  patternsFound: number;
  alertsCount: number;
  status: "active" | "inactive" | "error";
}

export interface PatternState {
  data: PatternData | null;
  isLoading: boolean;
  error: string | null;
}

// Simple hook for pattern monitoring
export function usePatternMonitoring() {
  const [state, setState] = useState<PatternState>({
    data: null,
    isLoading: false,
    error: null,
  });

  // Load pattern data
  const loadData = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch("/api/auto-sniping/pattern-monitoring");
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to load pattern data");
      }
      
      setState({
        data: result.data,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load data",
      }));
    }
  };

  // Start monitoring
  const startMonitoring = async () => {
    try {
      const response = await fetch("/api/auto-sniping/pattern-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      
      const result = await response.json();
      if (result.success) {
        await loadData();
      }
      return result.success;
    } catch {
      return false;
    }
  };

  // Stop monitoring
  const stopMonitoring = async () => {
    try {
      const response = await fetch("/api/auto-sniping/pattern-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      
      const result = await response.json();
      if (result.success) {
        await loadData();
      }
      return result.success;
    } catch {
      return false;
    }
  };

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  return {
    ...state,
    startMonitoring,
    stopMonitoring,
    refreshData: loadData,
  };
}

// Legacy compatibility hooks
export function usePatternStats() {
  return usePatternMonitoring();
}

export function usePatternDetection() {
  return usePatternMonitoring();
}

export default usePatternMonitoring;
