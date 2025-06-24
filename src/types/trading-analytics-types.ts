/**
 * Trading Analytics Types
 *
 * Comprehensive type definitions for trading analytics data structures.
 * Used across all trading analytics components for type safety.
 */

export interface TradingAnalyticsData {
  timestamp: string;
  tradingPerformance: {
    totalTrades: number;
    successfulTrades: number;
    successRate: number;
    averageTradeSize: number;
    averageHoldTime: number;
    tradingVolume: number;
    winLossRatio: number;
    sharpeRatio: number;
    maxDrawdown: number;
    profitFactor: number;
  };
  portfolioMetrics: {
    currentValue: number;
    totalReturn: number;
    returnPercentage: number;
    dayChange: number;
    weekChange: number;
    monthChange: number;
    allocations: Array<{
      asset: string;
      percentage: number;
      value: number;
    }>;
    topPerformers: Array<{
      symbol: string;
      return: number;
    }>;
    riskAdjustedReturn: number;
    beta: number;
    volatility: number;
  };
  patternAnalytics: {
    totalPatternsDetected: number;
    successfulPatterns: number;
    patternSuccessRate: number;
    averageConfidence: number;
    patternTypes: Array<{
      type: string;
      count: number;
    }>;
    readyStatePatterns: number;
    advanceDetectionMetrics: {
      averageAdvanceTime: number;
      optimalDetections: number;
      detectionAccuracy: number;
    };
    patternPerformance: Array<{
      pattern: string;
      successRate: number;
      avgReturn: number;
    }>;
  };
  riskManagement: {
    currentRiskScore: number;
    portfolioVaR: number;
    maxPositionSize: number;
    diversificationRatio: number;
    correlationMatrix: Array<{
      pair: string;
      correlation: number;
    }>;
    stressTestResults: {
      marketCrash: { impact: number; recovery: string };
      flashCrash: { impact: number; recovery: string };
      liquidityStress: { impact: number; recovery: string };
    };
    riskLimits: {
      dailyLoss: { limit: number; current: number };
      maxDrawdown: { limit: number; current: number };
      concentration: { limit: number; current: number };
    };
    exposureMetrics: {
      totalExposure: number;
      leverageRatio: number;
      marginUtilization: number;
    };
    circuitBreakerStatus: {
      active: boolean;
      lastTriggered: string;
      triggerCount: number;
    };
  };
  positionAnalytics: {
    activePositions: number;
    positionSizes: Array<{
      symbol: string;
      size: number;
      percentage: number;
    }>;
    positionDurations: Array<{
      symbol: string;
      duration: number;
    }>;
    sectorExposure: Array<{
      sector: string;
      exposure: number;
    }>;
    leverageMetrics: {
      averageLeverage: number;
      maxLeverage: number;
      leveragedPositions: number;
    };
    liquidityMetrics: {
      averageLiquidity: number;
      liquidityScore: number;
      illiquidPositions: number;
    };
    unrealizedPnL: number;
    realizedPnL: number;
  };
  executionAnalytics: {
    orderExecutionSpeed: {
      average: number;
      p95: number;
      p99: number;
    };
    slippageMetrics: {
      averageSlippage: number;
      maxSlippage: number;
      slippageDistribution: Array<{
        range: string;
        count: number;
      }>;
    };
    fillRates: {
      fullFill: number;
      partialFill: number;
      noFill: number;
    };
    marketImpact: number;
    executionCosts: {
      tradingFees: number;
      slippageCosts: number;
      marketImpactCosts: number;
    };
    latencyMetrics: {
      orderToExchange: number;
      marketDataLatency: number;
      systemLatency: number;
    };
    orderBookAnalysis: {
      averageSpread: number;
      bidAskImbalance: number;
      orderBookDepth: number;
    };
  };
  profitLossAnalytics: {
    dailyPnL: Array<{ date: string; pnl: number }>;
    weeklyPnL: Array<{ date: string; pnl: number }>;
    monthlyPnL: Array<{ date: string; pnl: number }>;
    yearlyPnL: number;
    pnLDistribution: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
    bestTrades: Array<{
      symbol: string;
      pnl: number;
      date: string;
      duration: string;
    }>;
    worstTrades: Array<{
      symbol: string;
      pnl: number;
      date: string;
      duration: string;
    }>;
    pnLByStrategy: Array<{
      strategy: string;
      pnl: number;
      trades: number;
    }>;
    pnLByTimeframe: Array<{
      timeframe: string;
      pnl: number;
      trades: number;
    }>;
  };
  marketAnalytics: {
    marketConditions: {
      trend: string;
      volatility: string;
      sentiment: string;
      fearGreedIndex: number;
    };
    correlationToMarket: {
      btcCorrelation: number;
      ethCorrelation: number;
      overallCorrelation: number;
    };
    sectorPerformance: Array<{
      sector: string;
      performance: number;
      trend: string;
    }>;
    volatilityIndex: number;
    marketSentiment: {
      social: string;
      news: string;
      technical: string;
      onChain: string;
    };
    tradingOpportunities: Array<{
      symbol: string;
      confidence: number;
      type: string;
    }>;
    marketTrends: Array<{
      trend: string;
      impact: string;
      timeframe: string;
    }>;
  };
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface AnalyticsTabProps {
  data: TradingAnalyticsData;
  formatCurrency: (value: number) => string;
  formatPercentage: (value: number) => string;
  getPerformanceColor: (value: number) => string;
}

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ComponentType<any>;
  className?: string;
}

export interface ChartDataItem {
  name: string;
  value: number;
  [key: string]: any;
}

export interface TooltipFormatterProps {
  value: any;
  name: string;
  payload: any;
}

// ============================================================================
// Utility Types
// ============================================================================

export type PerformanceMetric = {
  label: string;
  value: number;
  format: "currency" | "percentage" | "number";
  trend?: "up" | "down" | "neutral";
};

export type ChartConfig = {
  type: "area" | "bar" | "pie" | "line";
  dataKey: string;
  colors: string[];
  showTooltip?: boolean;
  showGrid?: boolean;
};

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AnalyticsAlert = {
  id: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
  resolved?: boolean;
};

// ============================================================================
// Constants
// ============================================================================

export const CHART_COLORS = {
  PRIMARY: ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#00ff00", "#ff00ff"],
  PERFORMANCE: {
    POSITIVE: "#10b981",
    NEGATIVE: "#ef4444",
    NEUTRAL: "#6b7280",
  },
  RISK: {
    LOW: "#10b981",
    MEDIUM: "#f59e0b",
    HIGH: "#ef4444",
    CRITICAL: "#7c2d12",
  },
} as const;

export const METRICS_CONFIG = {
  REFRESH_INTERVAL: 60000, // 1 minute
  CHART_ANIMATION_DURATION: 300,
  TOOLTIP_DELAY: 100,
} as const;

export const RISK_THRESHOLDS = {
  LOW: 30,
  MEDIUM: 60,
  HIGH: 80,
  CRITICAL: 95,
} as const;
