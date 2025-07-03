/**
 * Simplified Enhanced Connectivity Hook
 * Basic connectivity status management
 */

import { useEffect, useState } from "react";

// Simplified types
export interface ConnectivityData {
  connected: boolean;
  hasCredentials: boolean;
  isValid: boolean;
  canTrade: boolean;
  status: "connected" | "disconnected" | "error";
  message: string;
}

export interface ConnectivityState {
  data: ConnectivityData | null;
  isLoading: boolean;
  error: string | null;
}

// Simple hook for enhanced connectivity
export function useEnhancedConnectivity() {
  const [state, setState] = useState<ConnectivityState>({
    data: null,
    isLoading: false,
    error: null,
  });

  // Load connectivity data
  const loadData = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch("/api/mexc/enhanced-connectivity");
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to load connectivity data");
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

  // Test credentials
  const testCredentials = async () => {
    try {
      const response = await fetch("/api/mexc/enhanced-connectivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
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
    refresh: loadData,
    testCredentials,
  };
}

// Legacy compatibility hooks
export function useMexcConnectivityEnhanced() {
  const { data, isLoading, error, refresh } = useEnhancedConnectivity();

  return {
    data: data?.connected || false,
    isConnected: data?.connected || false,
    hasCredentials: data?.hasCredentials || false,
    isValid: data?.isValid || false,
    isLoading,
    error,
    refetch: refresh,
  };
}

export function useConnectivityHealth() {
  const { data } = useEnhancedConnectivity();
  
  return {
    health: data?.connected ? "good" : "poor",
    isHealthy: data?.connected || false,
    canTrade: data?.canTrade || false,
  };
}

export function useTradingConnectivity() {
  const { data, refresh, testCredentials } = useEnhancedConnectivity();

  return {
    canTrade: data?.canTrade || false,
    isReady: data?.status === "connected",
    refresh,
    testCredentials,
  };
}
