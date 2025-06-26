/**
 * Real-time Pattern Detection Hook
 *
 * Specialized React hook for real-time pattern discovery and ready state monitoring.
 * Integrates with the AI agent system for live pattern updates and trading signals.
 *
 * Features:
 * - Real-time pattern discovery streaming
 * - Ready state pattern monitoring (sts:2, st:2, tt:4)
 * - Pattern confidence scoring
 * - Historical pattern tracking
 * - Trading signal generation
 * - Performance analytics
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgentWorkflowMessage,
  PatternDiscoveryMessage,
  PatternReadyStateMessage,
  TradingSignalMessage,
} from "@/src/lib/websocket-types";
import { useWebSocket } from "./use-websocket";

// ======================
// Types and Interfaces
// ======================

export interface PatternMetrics {
  totalPatterns: number;
  readyStatePatterns: number;
  averageConfidence: number;
  successRate: number;
  falsePositiveRate: number;
  averageAdvanceNotice: number; // milliseconds
  topPerformingSymbols: string[];
  recentPatterns: PatternDiscoveryMessage[];
}

export interface ReadyStateStatus {
  symbol: string;
  isReady: boolean;
  confidence: number;
  detectedAt: number;
  estimatedLaunchTime?: number;
  advanceNotice: number;
  riskLevel: "low" | "medium" | "high";
  correlatedSymbols: string[];
  metadata?: Record<string, any>;
}

export interface PatternAlert {
  id: string;
  type: "pattern_discovered" | "ready_state" | "high_confidence" | "execution_opportunity";
  symbol: string;
  message: string;
  confidence: number;
  timestamp: number;
  priority: "low" | "medium" | "high" | "critical";
  actionable: boolean;
  metadata?: Record<string, any>;
}

export interface UseRealTimePatternsConfig {
  /** Symbols to monitor specifically */
  symbols?: string[];
  /** Minimum confidence threshold for alerts */
  minConfidence?: number;
  /** Enable trading signal generation */
  enableSignals?: boolean;
  /** Maximum number of patterns to track */
  maxPatterns?: number;
  /** Enable performance analytics */
  enableAnalytics?: boolean;
  /** Auto-subscribe to new symbols */
  autoSubscribeNewSymbols?: boolean;
}

export interface UseRealTimePatternsResult {
  /** All discovered patterns */
  patterns: PatternDiscoveryMessage[];
  /** Ready state patterns by symbol */
  readyStates: Map<string, ReadyStateStatus>;
  /** Generated trading signals */
  signals: TradingSignalMessage[];
  /** Active pattern alerts */
  alerts: PatternAlert[];
  /** Pattern performance metrics */
  metrics: PatternMetrics;
  /** Currently monitored symbols */
  monitoredSymbols: string[];
  /** Whether pattern discovery is active */
  isActive: boolean;
  /** Last update timestamp */
  lastUpdate: number;
  /** Manual pattern search */
  searchPatterns: (criteria: Record<string, any>) => void;
  /** Subscribe to specific symbol */
  subscribeToSymbol: (symbol: string) => void;
  /** Unsubscribe from symbol */
  unsubscribeFromSymbol: (symbol: string) => void;
  /** Clear historical data */
  clearHistory: () => void;
  /** Get pattern statistics for symbol */
  getSymbolStats: (symbol: string) => any;
  /** Get ready state for symbol */
  getReadyState: (symbol: string) => ReadyStateStatus | undefined;
  /** Dismiss alert */
  dismissAlert: (alertId: string) => void;
}

// ======================
// Pattern Analytics Engine
// ======================

class PatternAnalyticsEngine {
  private patterns: PatternDiscoveryMessage[] = [];
  private validatedPatterns = new Map<string, { success: boolean; executedAt: number }>();
  private performanceHistory: Array<{ timestamp: number; success: boolean; symbol: string }> = [];

  addPattern(pattern: PatternDiscoveryMessage): void {
    this.patterns.unshift(pattern);

    // Keep only last 1000 patterns for performance
    if (this.patterns.length > 1000) {
      this.patterns = this.patterns.slice(0, 1000);
    }
  }

  validatePattern(patternId: string, success: boolean): void {
    this.validatedPatterns.set(patternId, {
      success,
      executedAt: Date.now(),
    });

    this.performanceHistory.push({
      timestamp: Date.now(),
      success,
      symbol: this.patterns.find((p) => p.patternId === patternId)?.symbol || "",
    });

    // Keep only last 500 performance records
    if (this.performanceHistory.length > 500) {
      this.performanceHistory = this.performanceHistory.slice(0, 500);
    }
  }

  calculateMetrics(): PatternMetrics {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const recentPatterns = this.patterns.filter((p) => p.timing.detectedAt > last24h);

    const readyStatePatterns = recentPatterns.filter((p) => p.pattern.type === "ready_state");

    const validatedCount = this.performanceHistory.filter((p) => p.timestamp > last24h).length;
    const successCount = this.performanceHistory.filter(
      (p) => p.timestamp > last24h && p.success
    ).length;

    const successRate = validatedCount > 0 ? successCount / validatedCount : 0;
    const falsePositiveRate =
      validatedCount > 0 ? (validatedCount - successCount) / validatedCount : 0;

    const totalConfidence = recentPatterns.reduce((sum, p) => sum + p.pattern.confidence, 0);
    const averageConfidence =
      recentPatterns.length > 0 ? totalConfidence / recentPatterns.length : 0;

    const totalAdvanceNotice = recentPatterns.reduce((sum, p) => sum + p.timing.advanceNotice, 0);
    const averageAdvanceNotice =
      recentPatterns.length > 0 ? totalAdvanceNotice / recentPatterns.length : 0;

    // Calculate top performing symbols
    const symbolPerformance = new Map<string, { total: number; success: number }>();
    this.performanceHistory
      .filter((p) => p.timestamp > last24h)
      .forEach((p) => {
        if (!symbolPerformance.has(p.symbol)) {
          symbolPerformance.set(p.symbol, { total: 0, success: 0 });
        }
        const stats = symbolPerformance.get(p.symbol)!;
        stats.total++;
        if (p.success) stats.success++;
      });

    const topPerformingSymbols = Array.from(symbolPerformance.entries())
      .map(([symbol, stats]) => ({
        symbol,
        successRate: stats.success / stats.total,
        total: stats.total,
      }))
      .filter((s) => s.total >= 3) // At least 3 patterns
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10)
      .map((s) => s.symbol);

    return {
      totalPatterns: recentPatterns.length,
      readyStatePatterns: readyStatePatterns.length,
      averageConfidence,
      successRate,
      falsePositiveRate,
      averageAdvanceNotice,
      topPerformingSymbols,
      recentPatterns: recentPatterns.slice(0, 50), // Last 50 patterns
    };
  }

  getSymbolStats(symbol: string) {
    const symbolPatterns = this.patterns.filter((p) => p.symbol === symbol);
    const symbolPerformance = this.performanceHistory.filter((p) => p.symbol === symbol);

    const successCount = symbolPerformance.filter((p) => p.success).length;
    const successRate = symbolPerformance.length > 0 ? successCount / symbolPerformance.length : 0;

    return {
      totalPatterns: symbolPatterns.length,
      successRate,
      averageConfidence:
        symbolPatterns.reduce((sum, p) => sum + p.pattern.confidence, 0) / symbolPatterns.length ||
        0,
      lastPattern: symbolPatterns[0],
      recentPerformance: symbolPerformance.slice(0, 10),
    };
  }

  clear(): void {
    this.patterns = [];
    this.validatedPatterns.clear();
    this.performanceHistory = [];
  }
}

// ======================
// Alert Manager
// ======================

class AlertManager {
  private alerts: PatternAlert[] = [];
  private readonly maxAlerts = 100;

  addAlert(alert: Omit<PatternAlert, "id" | "timestamp">): PatternAlert {
    const newAlert: PatternAlert = {
      ...alert,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    this.alerts.unshift(newAlert);

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }

    return newAlert;
  }

  dismissAlert(alertId: string): void {
    this.alerts = this.alerts.filter((alert) => alert.id !== alertId);
  }

  getAlerts(): PatternAlert[] {
    return [...this.alerts];
  }

  getActiveAlerts(): PatternAlert[] {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    return this.alerts.filter(
      (alert) => alert.priority === "critical" || now - alert.timestamp < fiveMinutes
    );
  }

  clear(): void {
    this.alerts = [];
  }
}

// ======================
// Main Hook
// ======================

export function useRealTimePatterns(
  config: UseRealTimePatternsConfig = {}
): UseRealTimePatternsResult {
  const {
    symbols = [],
    minConfidence = 0.7,
    enableSignals = true,
    maxPatterns = 1000,
    enableAnalytics = true,
    autoSubscribeNewSymbols = true,
  } = config;

  // WebSocket connection
  const { subscribe, isConnected, send } = useWebSocket({
    autoConnect: true,
    debug: false,
  });

  // State management
  const [patterns, setPatterns] = useState<PatternDiscoveryMessage[]>([]);
  const [readyStates, setReadyStates] = useState(new Map<string, ReadyStateStatus>());
  const [signals, setSignals] = useState<TradingSignalMessage[]>([]);
  const [monitoredSymbols, setMonitoredSymbols] = useState<string[]>([]);
  const [lastUpdate, setLastUpdate] = useState(0);

  // Managers
  const analyticsRef = useRef(new PatternAnalyticsEngine());
  const alertManagerRef = useRef(new AlertManager());
  const [alerts, setAlerts] = useState<PatternAlert[]>([]);
  const [metrics, setMetrics] = useState<PatternMetrics>({
    totalPatterns: 0,
    readyStatePatterns: 0,
    averageConfidence: 0,
    successRate: 0,
    falsePositiveRate: 0,
    averageAdvanceNotice: 0,
    topPerformingSymbols: [],
    recentPatterns: [],
  });

  // Refs for cleanup
  const isMountedRef = useRef(true);
  const subscriptionsRef = useRef(new Set<() => void>());

  // Pattern discovery handler
  const handlePatternDiscovery = useCallback(
    (message: any) => {
      if (!isMountedRef.current) return;

      const pattern = message.data as PatternDiscoveryMessage;

      // Add to patterns list
      setPatterns((prev) => {
        const newPatterns = [pattern, ...prev.slice(0, maxPatterns - 1)];
        return newPatterns;
      });

      // Add to analytics
      if (enableAnalytics) {
        analyticsRef.current.addPattern(pattern);
      }

      // Generate alert if high confidence
      if (pattern.pattern.confidence >= minConfidence) {
        const _alert = alertManagerRef.current.addAlert({
          type: "pattern_discovered",
          symbol: pattern.symbol,
          message: `High confidence ${pattern.pattern.type} pattern detected (${Math.round(pattern.pattern.confidence * 100)}%)`,
          confidence: pattern.pattern.confidence,
          priority: pattern.pattern.confidence > 0.9 ? "critical" : "high",
          actionable: true,
          metadata: {
            patternId: pattern.patternId,
            patternType: pattern.pattern.type,
            advanceNotice: pattern.timing.advanceNotice,
          },
        });

        setAlerts(alertManagerRef.current.getActiveAlerts());
      }

      // Auto-subscribe to new symbol if enabled
      if (autoSubscribeNewSymbols && !monitoredSymbols.includes(pattern.symbol)) {
        setMonitoredSymbols((prev) => [...prev, pattern.symbol]);
      }

      setLastUpdate(Date.now());
    },
    [minConfidence, enableAnalytics, maxPatterns, autoSubscribeNewSymbols, monitoredSymbols]
  );

  // Ready state handler
  const handleReadyState = useCallback((message: any) => {
    if (!isMountedRef.current) return;

    const readyStateData = message.data as PatternReadyStateMessage;

    const status: ReadyStateStatus = {
      symbol: readyStateData.symbol,
      isReady: readyStateData.readyState.isReady,
      confidence: readyStateData.readyState.confidence,
      detectedAt: readyStateData.timestamp,
      estimatedLaunchTime: readyStateData.readyState.estimatedLaunchTime,
      advanceNotice: readyStateData.analysis.advanceNotice,
      riskLevel: readyStateData.analysis.riskLevel,
      correlatedSymbols: readyStateData.analysis.correlatedSymbols,
      metadata: readyStateData.metadata,
    };

    setReadyStates((prev) => {
      const newMap = new Map(prev);
      newMap.set(readyStateData.symbol, status);
      return newMap;
    });

    // Generate critical alert for ready state
    if (status.isReady) {
      const _alert = alertManagerRef.current.addAlert({
        type: "ready_state",
        symbol: status.symbol,
        message: `${status.symbol} is ready for trading (sts:2, st:2, tt:4)`,
        confidence: status.confidence,
        priority: "critical",
        actionable: true,
        metadata: {
          readyState: readyStateData.readyState,
          advanceNotice: status.advanceNotice,
          riskLevel: status.riskLevel,
        },
      });

      setAlerts(alertManagerRef.current.getActiveAlerts());
    }

    setLastUpdate(Date.now());
  }, []);

  // Trading signal handler
  const handleTradingSignal = useCallback(
    (message: any) => {
      if (!isMountedRef.current || !enableSignals) return;

      const signal = message.data as TradingSignalMessage;

      setSignals((prev) => [signal, ...prev.slice(0, 99)]); // Keep last 100 signals

      // Generate alert for high-strength signals
      if (signal.strength > 80) {
        const _alert = alertManagerRef.current.addAlert({
          type: "execution_opportunity",
          symbol: signal.symbol,
          message: `High-strength ${signal.type} signal (${signal.strength}% strength)`,
          confidence: signal.confidence,
          priority: "high",
          actionable: true,
          metadata: {
            signalId: signal.signalId,
            signalType: signal.type,
            strength: signal.strength,
            targetPrice: signal.targetPrice,
          },
        });

        setAlerts(alertManagerRef.current.getActiveAlerts());
      }

      setLastUpdate(Date.now());
    },
    [enableSignals]
  );

  // Workflow handler for pattern validation
  const handleWorkflow = useCallback(
    (message: any) => {
      if (!isMountedRef.current || !enableAnalytics) return;

      const workflow = message.data as AgentWorkflowMessage;

      // Track pattern validation results
      if (workflow.workflowType === "pattern_analysis" && workflow.status === "completed") {
        const success = workflow.result?.success || false;
        const patternId = (workflow.metadata as any)?.patternId;

        if (patternId) {
          analyticsRef.current.validatePattern(patternId, success);
        }
      }
    },
    [enableAnalytics]
  );

  // Set up subscriptions
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribers: (() => void)[] = [];

    // Subscribe to pattern discovery
    unsubscribers.push(subscribe("patterns:discovery", handlePatternDiscovery));

    // Subscribe to ready state patterns
    unsubscribers.push(subscribe("patterns:ready_state", handleReadyState));

    // Subscribe to trading signals
    if (enableSignals) {
      unsubscribers.push(subscribe("trading:signals", handleTradingSignal));
    }

    // Subscribe to workflows for validation
    if (enableAnalytics) {
      unsubscribers.push(subscribe("agents:workflows", handleWorkflow));
    }

    // Subscribe to specific symbols
    for (const symbol of symbols) {
      unsubscribers.push(subscribe(`patterns:${symbol}:discovery`, handlePatternDiscovery));
      unsubscribers.push(subscribe(`patterns:${symbol}:ready_state`, handleReadyState));

      if (enableSignals) {
        unsubscribers.push(subscribe(`trading:${symbol}:signals`, handleTradingSignal));
      }
    }

    // Store unsubscribers
    subscriptionsRef.current = new Set(unsubscribers);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      subscriptionsRef.current.clear();
    };
  }, [
    isConnected,
    subscribe,
    symbols,
    enableSignals,
    enableAnalytics,
    handlePatternDiscovery,
    handleReadyState,
    handleTradingSignal,
    handleWorkflow,
  ]);

  // Update metrics periodically
  useEffect(() => {
    if (!enableAnalytics) return;

    const updateMetrics = () => {
      if (isMountedRef.current) {
        setMetrics(analyticsRef.current.calculateMetrics());
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [enableAnalytics]);

  // Initialize monitored symbols
  useEffect(() => {
    setMonitoredSymbols(symbols);
  }, [symbols]);

  // API functions
  const searchPatterns = useCallback(
    (criteria: Record<string, any>) => {
      if (!isConnected) return;

      send({
        type: "agent:workflow",
        channel: "agents:workflows",
        data: {
          action: "execute",
          workflowType: "pattern_analysis",
          request: {
            analysisType: "search",
            criteria,
          },
        },
      });
    },
    [isConnected, send]
  );

  const subscribeToSymbol = useCallback(
    (symbol: string) => {
      if (!monitoredSymbols.includes(symbol)) {
        setMonitoredSymbols((prev) => [...prev, symbol]);
      }
    },
    [monitoredSymbols]
  );

  const unsubscribeFromSymbol = useCallback((symbol: string) => {
    setMonitoredSymbols((prev) => prev.filter((s) => s !== symbol));
  }, []);

  const clearHistory = useCallback(() => {
    setPatterns([]);
    setSignals([]);
    setAlerts([]);
    analyticsRef.current.clear();
    alertManagerRef.current.clear();
    setLastUpdate(Date.now());
  }, []);

  const getSymbolStats = useCallback((symbol: string) => {
    return analyticsRef.current.getSymbolStats(symbol);
  }, []);

  const getReadyState = useCallback(
    (symbol: string) => {
      return readyStates.get(symbol);
    },
    [readyStates]
  );

  const dismissAlert = useCallback((alertId: string) => {
    alertManagerRef.current.dismissAlert(alertId);
    setAlerts(alertManagerRef.current.getActiveAlerts());
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      for (const unsubscribe of subscriptionsRef.current) {
        unsubscribe();
      }
    };
  }, []);

  return {
    patterns,
    readyStates,
    signals,
    alerts,
    metrics,
    monitoredSymbols,
    isActive: isConnected,
    lastUpdate,
    searchPatterns,
    subscribeToSymbol,
    unsubscribeFromSymbol,
    clearHistory,
    getSymbolStats,
    getReadyState,
    dismissAlert,
  };
}
