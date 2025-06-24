import { extractConfidencePercentage, sanitizeSymbolName } from "./analysis-utils";
import type { AgentResponse } from "./base-agent";

export interface SymbolDataInput {
  cd: string;
  sts: number;
  st: number;
  tt: number;
  ca?: string;
  ps?: number;
  qs?: number;
  ot?: number;
  [key: string]: unknown;
}

export interface TradingStrategyResult {
  strategy: CompiledTradingStrategy;
  riskManagement: RiskManagementPlan;
  executionPlan: ExecutionPlan;
  confidence: number;
  metadata: {
    strategyType: string;
    riskLevel: "low" | "medium" | "high";
    analysisTimestamp: string;
  };
}

export interface CompiledTradingStrategy {
  symbol: string;
  action: "buy" | "sell" | "hold" | "watch";
  entryPrice: number | null;
  targetPrices: number[];
  stopLoss: number | null;
  positionSize: number;
  timeframe: string;
  conditions: string[];
}

export interface RiskManagementPlan {
  maxLoss: number;
  positionSizing: number;
  diversification: string[];
  riskFactors: string[];
  mitigation: string[];
}

export interface ExecutionPlan {
  timing: {
    entry: string;
    monitoring: string[];
    exit: string[];
  };
  alerts: string[];
  fallbackPlan: string;
}

export class TradingStrategyWorkflow {
  // Simple console logger to avoid webpack bundling issues
  private logger = {
    info: (message: string, context?: any) => console.info('[trading-strategy-workflow]', message, context || ''),
    warn: (message: string, context?: any) => console.warn('[trading-strategy-workflow]', message, context || ''),
    error: (message: string, context?: any) => console.error('[trading-strategy-workflow]', message, context || ''),
    debug: (message: string, context?: any) => console.debug('[trading-strategy-workflow]', message, context || ''),
  };

  async compileTradingStrategy(
    strategyAnalysis: AgentResponse,
    vcoinId: string,
    symbolData: SymbolDataInput | SymbolDataInput[],
    riskLevel: "low" | "medium" | "high" = "medium",
    capital = 1000
  ): Promise<TradingStrategyResult> {
    console.info(`[TradingStrategyWorkflow] Compiling strategy for ${vcoinId}`);

    const baseStrategy = this.extractBaseStrategy(strategyAnalysis, symbolData);
    const riskManagement = this.createRiskManagementPlan(strategyAnalysis, riskLevel, capital);
    const executionPlan = this.createExecutionPlan(strategyAnalysis, baseStrategy);
    const confidence = this.calculateStrategyConfidence(
      strategyAnalysis,
      baseStrategy,
      riskManagement
    );

    const strategy = this.refineStrategyWithRisk(baseStrategy, riskManagement, capital);

    return {
      strategy,
      riskManagement,
      executionPlan,
      confidence,
      metadata: {
        strategyType: strategy.action === "buy" ? "long_entry" : "monitoring",
        riskLevel,
        analysisTimestamp: new Date().toISOString(),
      },
    };
  }

  private extractBaseStrategy(
    analysis: AgentResponse,
    symbolData: SymbolDataInput | SymbolDataInput[]
  ): CompiledTradingStrategy {
    const content = analysis.content || "";
    const symbol = sanitizeSymbolName(
      Array.isArray(symbolData) ? symbolData[0]?.cd || "UNKNOWN" : symbolData?.cd || "UNKNOWN"
    );

    // Extract action recommendation
    let action: "buy" | "sell" | "hold" | "watch" = "watch";
    if (/buy|long|enter/i.test(content)) action = "buy";
    else if (/sell|short|exit/i.test(content)) action = "sell";
    else if (/hold|maintain/i.test(content)) action = "hold";

    // Extract entry price
    const entryMatch = content.match(/entry[:\s]*\$?(\d+(?:\.\d+)?)/i);
    const entryPrice = entryMatch ? Number.parseFloat(entryMatch[1]) : null;

    // Extract target prices
    const targetMatches = content.match(/target[:\s]*\$?(\d+(?:\.\d+)?)/gi) || [];
    const targetPrices = targetMatches
      .map((match) => {
        const priceMatch = match.match(/(\d+(?:\.\d+)?)/);
        return priceMatch ? Number.parseFloat(priceMatch[1]) : 0;
      })
      .filter((price) => price > 0);

    // Extract stop loss
    const stopLossMatch = content.match(/stop.{0,10}loss[:\s]*\$?(\d+(?:\.\d+)?)/i);
    const stopLoss = stopLossMatch ? Number.parseFloat(stopLossMatch[1]) : null;

    // Extract position size percentage
    const positionMatch = content.match(/position[:\s]*(\d+(?:\.\d+)?)[%\s]/i);
    const positionSize = positionMatch ? Number.parseFloat(positionMatch[1]) / 100 : 0.05; // Default 5%

    // Extract timeframe
    let timeframe = "short_term";
    if (/long.{0,10}term/i.test(content)) timeframe = "long_term";
    else if (/medium.{0,10}term/i.test(content)) timeframe = "medium_term";
    else if (/scalp|immediate/i.test(content)) timeframe = "scalping";

    // Extract conditions
    const conditions: string[] = [];
    if (/ready.{0,10}state/i.test(content)) conditions.push("ready_state_confirmed");
    if (/volume.{0,10}spike/i.test(content)) conditions.push("volume_confirmation");
    if (/breakout/i.test(content)) conditions.push("breakout_signal");
    if (/3\.5.{0,10}hour/i.test(content)) conditions.push("optimal_timing");

    return {
      symbol,
      action,
      entryPrice,
      targetPrices,
      stopLoss,
      positionSize,
      timeframe,
      conditions,
    };
  }

  private createRiskManagementPlan(
    analysis: AgentResponse,
    riskLevel: "low" | "medium" | "high",
    capital: number
  ): RiskManagementPlan {
    const content = analysis.content || "";

    // Risk-based position sizing
    const positionSizing = riskLevel === "low" ? 0.02 : riskLevel === "medium" ? 0.05 : 0.1;
    const maxLoss = capital * positionSizing * 0.5; // Max 50% of position size

    // Extract risk factors
    const riskFactors: string[] = [];
    if (/volatile/i.test(content)) riskFactors.push("high_volatility");
    if (/low.{0,10}liquidity/i.test(content)) riskFactors.push("liquidity_risk");
    if (/new.{0,10}listing/i.test(content)) riskFactors.push("new_asset_risk");
    if (/market.{0,10}uncertainty/i.test(content)) riskFactors.push("market_risk");

    // Diversification recommendations
    const diversification: string[] = [];
    if (riskLevel === "low") {
      diversification.push("max_2_concurrent_positions");
      diversification.push("spread_across_market_caps");
    } else if (riskLevel === "medium") {
      diversification.push("max_3_concurrent_positions");
      diversification.push("balance_risk_levels");
    } else {
      diversification.push("max_5_concurrent_positions");
      diversification.push("concentrated_high_conviction");
    }

    // Risk mitigation strategies
    const mitigation: string[] = [
      "use_stop_losses",
      "monitor_volume_changes",
      "track_market_sentiment",
      "ready_exit_strategy",
    ];

    if (riskFactors.includes("high_volatility")) {
      mitigation.push("reduce_position_size");
      mitigation.push("tighter_stop_losses");
    }

    if (riskFactors.includes("liquidity_risk")) {
      mitigation.push("limit_orders_only");
      mitigation.push("smaller_position_sizes");
    }

    return {
      maxLoss,
      positionSizing,
      diversification,
      riskFactors,
      mitigation,
    };
  }

  private createExecutionPlan(
    analysis: AgentResponse,
    strategy: CompiledTradingStrategy
  ): ExecutionPlan {
    const content = analysis.content || "";

    // Timing plan
    const timing = {
      entry: "immediate",
      monitoring: ["every_15_minutes", "volume_alerts", "price_alerts"],
      exit: ["target_reached", "stop_loss_hit", "pattern_breakdown"],
    };

    if (strategy.timeframe === "scalping") {
      timing.entry = "immediate";
      timing.monitoring = ["every_5_minutes", "real_time_alerts"];
    } else if (strategy.timeframe === "medium_term") {
      timing.entry = "within_1_hour";
      timing.monitoring = ["every_30_minutes", "daily_review"];
    }

    // Generate alerts
    const alerts: string[] = [];
    if (strategy.entryPrice) {
      alerts.push(`Entry alert: ${strategy.symbol} reaches $${strategy.entryPrice}`);
    }

    for (const [index, target] of strategy.targetPrices.entries()) {
      alerts.push(`Target ${index + 1}: ${strategy.symbol} reaches $${target}`);
    }

    if (strategy.stopLoss) {
      alerts.push(`Stop loss: ${strategy.symbol} falls below $${strategy.stopLoss}`);
    }

    // Volume and pattern alerts
    alerts.push(`Volume spike: ${strategy.symbol} volume increases 3x`);
    alerts.push(`Pattern breakdown: ${strategy.symbol} loses key support`);

    // Fallback plan
    let fallbackPlan = "Exit position if conditions deteriorate";
    if (/ready.{0,10}state/i.test(content)) {
      fallbackPlan = "Exit if ready state pattern breaks down";
    } else if (/volume/i.test(content)) {
      fallbackPlan = "Exit if volume drops significantly";
    }

    return {
      timing,
      alerts,
      fallbackPlan,
    };
  }

  private calculateStrategyConfidence(
    analysis: AgentResponse,
    strategy: CompiledTradingStrategy,
    riskPlan: RiskManagementPlan
  ): number {
    const content = analysis.content || "";
    let confidence = extractConfidencePercentage(content);

    // Adjust confidence based on strategy completeness
    if (strategy.entryPrice) confidence += 5;
    if (strategy.targetPrices.length >= 2) confidence += 5;
    if (strategy.stopLoss) confidence += 10;
    if (strategy.conditions.length >= 2) confidence += 5;

    // Adjust for risk factors
    const riskAdjustment = riskPlan.riskFactors.length * -3;
    confidence = Math.max(confidence + riskAdjustment, 20);

    // Cap confidence based on market conditions
    if (strategy.action === "buy" && confidence > 90) confidence = 90;
    if (strategy.action === "watch" && confidence > 70) confidence = 70;

    return Math.min(confidence, 95);
  }

  private refineStrategyWithRisk(
    baseStrategy: CompiledTradingStrategy,
    riskPlan: RiskManagementPlan,
    _capital: number
  ): CompiledTradingStrategy {
    const refinedStrategy = { ...baseStrategy };

    // Adjust position size based on risk management
    refinedStrategy.positionSize = Math.min(refinedStrategy.positionSize, riskPlan.positionSizing);

    // Ensure stop loss is set if not present
    if (!refinedStrategy.stopLoss && refinedStrategy.entryPrice) {
      const stopLossPercent = riskPlan.riskFactors.includes("high_volatility") ? 0.03 : 0.05;
      refinedStrategy.stopLoss = refinedStrategy.entryPrice * (1 - stopLossPercent);
    }

    // Adjust targets based on risk level
    if (riskPlan.riskFactors.includes("high_volatility")) {
      refinedStrategy.targetPrices = refinedStrategy.targetPrices.map((price) => price * 0.9);
    }

    // Add risk-based conditions
    if (riskPlan.riskFactors.includes("liquidity_risk")) {
      refinedStrategy.conditions.push("confirm_liquidity");
    }

    if (riskPlan.riskFactors.includes("new_asset_risk")) {
      refinedStrategy.conditions.push("monitor_first_hour");
    }

    return refinedStrategy;
  }
}
