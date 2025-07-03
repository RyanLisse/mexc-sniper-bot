/**
 * Enhanced Auto-Sniping Execution Hook
 * Comprehensive state management for auto-sniping operations
 * Connects to real API endpoints and provides proper error handling
 */

import { useEffect, useState, useCallback } from "react";

// Enhanced types for execution data
export interface ExecutionData {
  isActive: boolean;
  totalTrades: number;
  successRate: number;
  totalPnl: number;
  activePositions: number;
  successfulTrades: number;
  failedTrades: number;
  executedToday: number;
  isHealthy: boolean;
  lastExecution?: string;
  status: "active" | "inactive" | "paused" | "error";
}

export interface ExecutionState {
  data: ExecutionData | null;
  isLoading: boolean;
  error: string | null;
}

// Enhanced hook for auto-sniping execution
export function useAutoSnipingExecution() {
  const [state, setState] = useState<ExecutionState>({
    data: null,
    isLoading: false,
    error: null,
  });

  // Load execution data from status endpoint
  const loadData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch("/api/auto-sniping/control");
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to load execution data");
      }
      
      const statusData = result.data.status;
      const executionData: ExecutionData = {
        isActive: statusData.autoSnipingEnabled || false,
        totalTrades: statusData.executedToday || 0,
        successRate: statusData.successRate || 0,
        totalPnl: statusData.dailyPnL || 0,
        activePositions: statusData.activePositions || 0,
        successfulTrades: statusData.successCount || 0,
        failedTrades: statusData.errorCount || 0,
        executedToday: statusData.executedToday || 0,
        isHealthy: statusData.isHealthy !== false,
        lastExecution: statusData.lastExecution,
        status: statusData.autoSnipingEnabled ? "active" : "inactive",
      };
      
      setState({
        data: executionData,
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
  }, []);

  // Start execution using control endpoint
  const startExecution = async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch("/api/auto-sniping/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update state immediately for better UX
        setState(prev => ({
          ...prev,
          data: prev.data ? { ...prev.data, isActive: true, status: "active" } : null,
          isLoading: false,
        }));
        
        // Refresh full data after a delay
        setTimeout(loadData, 1000);
        return true;
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || "Failed to start execution",
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to start execution",
      }));
      return false;
    }
  };

  // Stop execution using control endpoint
  const stopExecution = async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch("/api/auto-sniping/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update state immediately for better UX
        setState(prev => ({
          ...prev,
          data: prev.data ? { ...prev.data, isActive: false, status: "inactive" } : null,
          isLoading: false,
        }));
        
        // Refresh full data after a delay
        setTimeout(loadData, 1000);
        return true;
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || "Failed to stop execution",
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to stop execution",
      }));
      return false;
    }
  };

  // Pause execution
  const pauseExecution = async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch("/api/auto-sniping/execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause_execution" }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          data: prev.data ? { ...prev.data, status: "paused" } : null,
          isLoading: false,
        }));
        
        setTimeout(loadData, 1000);
        return true;
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || "Failed to pause execution",
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to pause execution",
      }));
      return false;
    }
  };

  // Resume execution
  const resumeExecution = async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch("/api/auto-sniping/execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume_execution" }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          data: prev.data ? { ...prev.data, status: "active" } : null,
          isLoading: false,
        }));
        
        setTimeout(loadData, 1000);
        return true;
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || "Failed to resume execution",
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to resume execution",
      }));
      return false;
    }
  };

  // Emergency stop all
  const emergencyStop = async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch("/api/auto-sniping/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "emergency_stop",
          reason: "User requested emergency stop" 
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          data: prev.data ? { 
            ...prev.data, 
            isActive: false, 
            status: "inactive",
            activePositions: 0 
          } : null,
          isLoading: false,
        }));
        
        setTimeout(loadData, 1000);
        return true;
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: result.error || "Failed to execute emergency stop",
        }));
        return false;
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to execute emergency stop",
      }));
      return false;
    }
  };

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Load data on mount and set up periodic refresh
  useEffect(() => {
    loadData();
    
    // Set up periodic refresh when active
    const interval = setInterval(() => {
      if (state.data?.isActive) {
        loadData();
      }
    }, 30000); // Refresh every 30 seconds when active
    
    return () => clearInterval(interval);
  }, [loadData, state.data?.isActive]);

  return {
    ...state,
    startExecution,
    stopExecution,
    pauseExecution,
    resumeExecution,
    emergencyStop,
    refreshData: loadData,
    clearError,
  };
}

// Export legacy types for backward compatibility
export interface ExecutionStats {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  successRate: number;
  totalPnl: string;
  totalPnL: number;
  dailyTradeCount: number;
  activePositions: number;
  totalVolume: number;
  averageExecutionTime: number;
  slippageAverage: number;
  maxDrawdown: number;
}

export default useAutoSnipingExecution;
