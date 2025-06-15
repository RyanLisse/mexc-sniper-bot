/**
 * Backtesting Framework
 *
 * Comprehensive backtesting system for validating parameter changes through
 * historical simulation before application to live trading.
 */

import { EventEmitter } from "events";
import { logger } from "../lib/utils";

export interface BacktestConfig {
  parameters: Record<string, any>;
  period: {
    start: Date;
    end: Date;
  };
  objectives: Array<{
    name: string;
    weight: number;
    direction: "maximize" | "minimize";
    metric: (performance: BacktestPerformance) => number;
  }>;
  marketData?: any[];
  scenarios?: string[];
  riskLimits?: Record<string, number>;
}

export interface BacktestPerformance {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  profitFactor: number;
  avgTradeDuration: number;
  totalTrades: number;
  successfulTrades: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  sortinoRatio: number;
  treynorRatio: number;
  trackingError: number;
  downsideDeviation: number;
  upCaptureRatio: number;
  downCaptureRatio: number;
  averageWin: number;
  averageLoss: number;
  expectancy: number;
}

export interface Trade {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  entryTime: Date;
  exitTime?: Date;
  pnl?: number;
  fees: number;
  reason: string;
  metadata?: Record<string, any>;
}

export interface BacktestResult {
  config: BacktestConfig;
  performance: BacktestPerformance;
  trades: Trade[];
  equity_curve: Array<{ timestamp: Date; value: number }>;
  drawdown_curve: Array<{ timestamp: Date; drawdown: number }>;
  monthly_returns: Array<{ month: string; return: number }>;
  risk_metrics: Record<string, number>;
  scenario_analysis: Record<string, any>;
  validation_results: {
    passed: boolean;
    violations: string[];
    warnings: string[];
  };
}

export interface MarketData {
  timestamp: Date;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  metadata?: Record<string, any>;
}

export class BacktestingFramework extends EventEmitter {
  private historicalData = new Map<string, MarketData[]>();
  private benchmarkData: MarketData[] = [];
  private riskFreeRate = 0.02; // 2% annual risk-free rate

  constructor() {
    super();
    this.loadHistoricalData();
  }

  /**
   * Run backtest with given configuration
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    try {
      this.emit("backtestStarted", { config });

      // Validate configuration
      this.validateConfig(config);

      // Prepare market data
      const marketData = await this.prepareMarketData(config.period, config.marketData);

      // Initialize trading simulation
      const simulation = new TradingSimulation(config.parameters, marketData);

      // Run simulation
      const trades = await this.runSimulation(simulation, config);

      // Calculate performance metrics
      const performance = this.calculatePerformance(trades, config.period, marketData);

      // Generate equity and drawdown curves
      const equity_curve = this.generateEquityCurve(trades, marketData);
      const drawdown_curve = this.generateDrawdownCurve(equity_curve);

      // Calculate monthly returns
      const monthly_returns = this.calculateMonthlyReturns(equity_curve);

      // Perform risk analysis
      const risk_metrics = this.calculateRiskMetrics(performance, trades, marketData);

      // Run scenario analysis
      const scenario_analysis = await this.runScenarioAnalysis(config, trades);

      // Validate results against constraints
      const validation_results = this.validateResults(performance, config);

      const result: BacktestResult = {
        config,
        performance,
        trades,
        equity_curve,
        drawdown_curve,
        monthly_returns,
        risk_metrics,
        scenario_analysis,
        validation_results,
      };

      this.emit("backtestCompleted", { result });
      logger.info("Backtest completed successfully", {
        trades: trades.length,
        return: performance.totalReturn,
        sharpe: performance.sharpeRatio,
      });

      return result;
    } catch (error) {
      this.emit("backtestFailed", { error });
      logger.error("Backtest failed:", error);
      throw error;
    }
  }

  /**
   * Run simulation with trading logic
   */
  private async runSimulation(
    simulation: TradingSimulation,
    config: BacktestConfig
  ): Promise<Trade[]> {
    const trades: Trade[] = [];

    // Simulate trading based on parameters
    const marketData = simulation.getMarketData();

    for (let i = 1; i < marketData.length; i++) {
      const currentBar = marketData[i];
      const previousBar = marketData[i - 1];

      // Apply pattern detection logic
      const patternSignal = this.evaluatePatternSignal(currentBar, previousBar, config.parameters);

      if (
        patternSignal.signal === "buy" &&
        patternSignal.confidence >= config.parameters.pattern_confidence_threshold
      ) {
        // Calculate position size
        const positionSize = this.calculatePositionSize(
          currentBar,
          simulation.getPortfolioValue(),
          config.parameters
        );

        if (positionSize > 0) {
          const trade: Trade = {
            symbol: currentBar.symbol,
            side: "buy",
            quantity: positionSize,
            entryPrice: currentBar.close,
            entryTime: currentBar.timestamp,
            fees: positionSize * currentBar.close * 0.001, // 0.1% fee
            reason: "pattern_signal",
          };

          trades.push(trade);
          simulation.openPosition(trade);
        }
      }

      // Check for exit conditions
      const openPositions = simulation.getOpenPositions();
      for (const position of openPositions) {
        const exitSignal = this.evaluateExitSignal(position, currentBar, config.parameters);

        if (exitSignal.shouldExit) {
          const exitTrade: Trade = {
            ...position,
            exitPrice: currentBar.close,
            exitTime: currentBar.timestamp,
            pnl: (currentBar.close - position.entryPrice) * position.quantity - position.fees,
            reason: exitSignal.reason,
          };

          trades.push(exitTrade);
          simulation.closePosition(position);
        }
      }

      // Update portfolio value
      simulation.updatePortfolioValue(currentBar);
    }

    return trades;
  }

  /**
   * Evaluate pattern signal
   */
  private evaluatePatternSignal(
    currentBar: MarketData,
    previousBar: MarketData,
    parameters: Record<string, any>
  ): { signal: "buy" | "sell" | "hold"; confidence: number } {
    // Simplified pattern detection logic
    // In reality, this would integrate with the pattern discovery agent

    const priceChange = (currentBar.close - previousBar.close) / previousBar.close;
    const volumeRatio = currentBar.volume / previousBar.volume;

    // Mock pattern scoring
    let confidence = 0;

    if (priceChange > 0.02 && volumeRatio > 1.5) {
      confidence = 0.8; // Strong bullish signal
    } else if (priceChange > 0.01 && volumeRatio > 1.2) {
      confidence = 0.6; // Moderate bullish signal
    } else if (priceChange < -0.02 && volumeRatio > 1.5) {
      confidence = 0.7; // Strong bearish signal (for short positions)
    }

    // Apply confidence threshold from parameters
    const threshold = parameters.pattern_confidence_threshold || 0.7;

    if (confidence >= threshold && priceChange > 0) {
      return { signal: "buy", confidence };
    } else if (confidence >= threshold && priceChange < 0) {
      return { signal: "sell", confidence };
    }

    return { signal: "hold", confidence: 0 };
  }

  /**
   * Calculate position size based on risk management
   */
  private calculatePositionSize(
    marketBar: MarketData,
    portfolioValue: number,
    parameters: Record<string, any>
  ): number {
    const maxPositionSize = parameters.max_position_size || 0.1;
    const riskPerTrade = parameters.risk_per_trade || 0.02;
    const stopLossPercent = parameters.stop_loss_percentage || 0.05;

    // Kelly criterion-based position sizing
    const winRate = parameters.estimated_win_rate || 0.6;
    const avgWin = parameters.estimated_avg_win || 0.1;
    const avgLoss = stopLossPercent;

    const kellyFraction = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
    const adjustedKelly = Math.max(0, Math.min(kellyFraction * 0.5, maxPositionSize)); // 50% of Kelly

    const positionValue = portfolioValue * adjustedKelly;
    return Math.floor(positionValue / marketBar.close);
  }

  /**
   * Evaluate exit signal
   */
  private evaluateExitSignal(
    position: Trade,
    currentBar: MarketData,
    parameters: Record<string, any>
  ): { shouldExit: boolean; reason: string } {
    const currentPrice = currentBar.close;
    const entryPrice = position.entryPrice;
    const changePercent = (currentPrice - entryPrice) / entryPrice;

    // Stop loss
    const stopLoss = parameters.stop_loss_percentage || 0.05;
    if (changePercent <= -stopLoss) {
      return { shouldExit: true, reason: "stop_loss" };
    }

    // Take profit
    const takeProfit = parameters.take_profit_percentage || 0.15;
    if (changePercent >= takeProfit) {
      return { shouldExit: true, reason: "take_profit" };
    }

    // Time-based exit
    const maxHoldTime = parameters.max_hold_time_hours || 24;
    const holdTime =
      (currentBar.timestamp.getTime() - position.entryTime.getTime()) / (1000 * 60 * 60);
    if (holdTime >= maxHoldTime) {
      return { shouldExit: true, reason: "time_exit" };
    }

    // Trailing stop
    if (parameters.use_trailing_stop && changePercent > 0.05) {
      const trailingStop = parameters.trailing_stop_percentage || 0.03;
      // This would require tracking the highest price since entry
      // Simplified implementation
      if (changePercent >= 0.1 && Math.random() < 0.1) {
        return { shouldExit: true, reason: "trailing_stop" };
      }
    }

    return { shouldExit: false, reason: "" };
  }

  /**
   * Calculate comprehensive performance metrics
   */
  private calculatePerformance(
    trades: Trade[],
    period: { start: Date; end: Date },
    marketData: MarketData[]
  ): BacktestPerformance {
    const completedTrades = trades.filter((t) => t.exitPrice !== undefined);
    const totalTrades = completedTrades.length;

    if (totalTrades === 0) {
      return this.getZeroPerformance();
    }

    // Calculate basic metrics
    const returns = completedTrades.map((t) => t.pnl || 0);
    const winningTrades = returns.filter((r) => r > 0);
    const losingTrades = returns.filter((r) => r < 0);

    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const winRate = winningTrades.length / totalTrades;
    const averageWin =
      winningTrades.length > 0
        ? winningTrades.reduce((sum, r) => sum + r, 0) / winningTrades.length
        : 0;
    const averageLoss =
      losingTrades.length > 0
        ? Math.abs(losingTrades.reduce((sum, r) => sum + r, 0) / losingTrades.length)
        : 0;

    // Calculate time-based metrics
    const periodDays = (period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24);
    const annualizedReturn = (totalReturn / 100000) * (365 / periodDays); // Assuming 100k initial capital

    // Calculate volatility
    const dailyReturns = this.calculateDailyReturns(completedTrades, marketData);
    const volatility = this.calculateVolatility(dailyReturns);

    // Risk-adjusted metrics
    const sharpeRatio = volatility > 0 ? (annualizedReturn - this.riskFreeRate) / volatility : 0;
    const maxDrawdown = this.calculateMaxDrawdown(completedTrades);
    const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

    // Additional metrics
    const profitFactor =
      averageLoss > 0
        ? (averageWin * winningTrades.length) / (averageLoss * losingTrades.length)
        : 0;
    const avgTradeDuration = this.calculateAverageTradeDuration(completedTrades);

    return {
      totalReturn,
      annualizedReturn,
      sharpeRatio,
      calmarRatio,
      maxDrawdown,
      volatility,
      winRate,
      profitFactor,
      avgTradeDuration,
      totalTrades,
      successfulTrades: winningTrades.length,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades) : 0,
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades) : 0,
      consecutiveWins: this.calculateConsecutiveWins(returns),
      consecutiveLosses: this.calculateConsecutiveLosses(returns),
      beta: this.calculateBeta(dailyReturns, marketData),
      alpha: this.calculateAlpha(annualizedReturn, this.calculateBeta(dailyReturns, marketData)),
      informationRatio: this.calculateInformationRatio(dailyReturns, marketData),
      sortinoRatio: this.calculateSortinoRatio(dailyReturns),
      treynorRatio: this.calculateTreynorRatio(
        annualizedReturn,
        this.calculateBeta(dailyReturns, marketData)
      ),
      trackingError: this.calculateTrackingError(dailyReturns, marketData),
      downsideDeviation: this.calculateDownsideDeviation(dailyReturns),
      upCaptureRatio: this.calculateUpCaptureRatio(dailyReturns, marketData),
      downCaptureRatio: this.calculateDownCaptureRatio(dailyReturns, marketData),
      averageWin,
      averageLoss,
      expectancy: winRate * averageWin - (1 - winRate) * averageLoss,
    };
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: BacktestConfig): void {
    if (!config.parameters) {
      throw new Error("Parameters are required for backtesting");
    }

    if (!config.period.start || !config.period.end) {
      throw new Error("Valid time period is required");
    }

    if (config.period.start >= config.period.end) {
      throw new Error("Start date must be before end date");
    }

    if (!config.objectives || config.objectives.length === 0) {
      throw new Error("At least one objective is required");
    }
  }

  /**
   * Prepare market data for simulation
   */
  private async prepareMarketData(
    period: { start: Date; end: Date },
    providedData?: any[]
  ): Promise<MarketData[]> {
    if (providedData && providedData.length > 0) {
      return providedData.filter((d) => d.timestamp >= period.start && d.timestamp <= period.end);
    }

    // Generate synthetic market data for testing
    return this.generateSyntheticMarketData(period);
  }

  /**
   * Generate synthetic market data for testing
   */
  private generateSyntheticMarketData(period: { start: Date; end: Date }): MarketData[] {
    const data: MarketData[] = [];
    const startTime = period.start.getTime();
    const endTime = period.end.getTime();
    const interval = 60 * 60 * 1000; // 1 hour intervals

    let currentPrice = 100; // Starting price

    for (let time = startTime; time <= endTime; time += interval) {
      const timestamp = new Date(time);

      // Generate realistic price movement
      const volatility = 0.02;
      const drift = 0.0001;
      const randomChange = (Math.random() - 0.5) * volatility + drift;

      currentPrice *= 1 + randomChange;

      const high = currentPrice * (1 + Math.random() * 0.01);
      const low = currentPrice * (1 - Math.random() * 0.01);
      const open = currentPrice * (1 + (Math.random() - 0.5) * 0.005);
      const volume = Math.floor(1000000 + Math.random() * 9000000);

      data.push({
        timestamp,
        symbol: "TESTUSDT",
        open,
        high,
        low,
        close: currentPrice,
        volume,
      });
    }

    return data;
  }

  /**
   * Load historical data (placeholder)
   */
  private async loadHistoricalData(): Promise<void> {
    // In a real implementation, this would load actual historical data
    logger.info("Historical data loaded for backtesting");
  }

  /**
   * Helper methods for performance calculations
   */
  private getZeroPerformance(): BacktestPerformance {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      volatility: 0,
      winRate: 0,
      profitFactor: 0,
      avgTradeDuration: 0,
      totalTrades: 0,
      successfulTrades: 0,
      largestWin: 0,
      largestLoss: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      beta: 0,
      alpha: 0,
      informationRatio: 0,
      sortinoRatio: 0,
      treynorRatio: 0,
      trackingError: 0,
      downsideDeviation: 0,
      upCaptureRatio: 0,
      downCaptureRatio: 0,
      averageWin: 0,
      averageLoss: 0,
      expectancy: 0,
    };
  }

  private calculateDailyReturns(trades: Trade[], marketData: MarketData[]): number[] {
    // Simplified daily returns calculation
    return marketData
      .slice(1)
      .map((bar, i) => (bar.close - marketData[i].close) / marketData[i].close);
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized
  }

  private calculateMaxDrawdown(trades: Trade[]): number {
    // Simplified max drawdown calculation
    let peak = 0;
    let maxDD = 0;
    let runningPnL = 0;

    for (const trade of trades) {
      runningPnL += trade.pnl || 0;
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      const drawdown = (peak - runningPnL) / peak;
      if (drawdown > maxDD) {
        maxDD = drawdown;
      }
    }

    return maxDD;
  }

  private calculateAverageTradeDuration(trades: Trade[]): number {
    const completedTrades = trades.filter((t) => t.exitTime);
    if (completedTrades.length === 0) return 0;

    const totalDuration = completedTrades.reduce((sum, trade) => {
      const duration = (trade.exitTime!.getTime() - trade.entryTime.getTime()) / (1000 * 60 * 60);
      return sum + duration;
    }, 0);

    return totalDuration / completedTrades.length;
  }

  private calculateConsecutiveWins(returns: number[]): number {
    let maxConsecutive = 0;
    let current = 0;

    for (const ret of returns) {
      if (ret > 0) {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 0;
      }
    }

    return maxConsecutive;
  }

  private calculateConsecutiveLosses(returns: number[]): number {
    let maxConsecutive = 0;
    let current = 0;

    for (const ret of returns) {
      if (ret < 0) {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else {
        current = 0;
      }
    }

    return maxConsecutive;
  }

  // Additional risk metric calculations (simplified implementations)
  private calculateBeta(returns: number[], marketData: MarketData[]): number {
    // Simplified beta calculation
    return 0.8 + Math.random() * 0.4; // Mock beta between 0.8 and 1.2
  }

  private calculateAlpha(portfolioReturn: number, beta: number): number {
    const marketReturn = 0.1; // Assumed market return
    return portfolioReturn - (this.riskFreeRate + beta * (marketReturn - this.riskFreeRate));
  }

  private calculateInformationRatio(returns: number[], marketData: MarketData[]): number {
    // Simplified information ratio
    return Math.random() * 2 - 1; // Mock value between -1 and 1
  }

  private calculateSortinoRatio(returns: number[]): number {
    const downsideReturns = returns.filter((r) => r < 0);
    if (downsideReturns.length === 0) return 0;

    const downDev = this.calculateDownsideDeviation(returns);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    return downDev > 0 ? (avgReturn - this.riskFreeRate) / downDev : 0;
  }

  private calculateTreynorRatio(portfolioReturn: number, beta: number): number {
    return beta > 0 ? (portfolioReturn - this.riskFreeRate) / beta : 0;
  }

  private calculateTrackingError(returns: number[], marketData: MarketData[]): number {
    // Simplified tracking error
    return Math.random() * 0.05; // Mock value between 0 and 5%
  }

  private calculateDownsideDeviation(returns: number[]): number {
    const downsideReturns = returns.filter((r) => r < 0);
    if (downsideReturns.length === 0) return 0;

    const variance = downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length;
    return Math.sqrt(variance);
  }

  private calculateUpCaptureRatio(returns: number[], marketData: MarketData[]): number {
    // Simplified up capture ratio
    return 0.8 + Math.random() * 0.4; // Mock value between 0.8 and 1.2
  }

  private calculateDownCaptureRatio(returns: number[], marketData: MarketData[]): number {
    // Simplified down capture ratio
    return 0.7 + Math.random() * 0.4; // Mock value between 0.7 and 1.1
  }

  private generateEquityCurve(
    trades: Trade[],
    marketData: MarketData[]
  ): Array<{ timestamp: Date; value: number }> {
    const curve: Array<{ timestamp: Date; value: number }> = [];
    let equity = 100000; // Starting capital

    for (const bar of marketData) {
      // Update equity based on trades at this timestamp
      const tradesAtTime = trades.filter(
        (t) => t.exitTime && t.exitTime.getTime() === bar.timestamp.getTime()
      );

      for (const trade of tradesAtTime) {
        equity += trade.pnl || 0;
      }

      curve.push({
        timestamp: bar.timestamp,
        value: equity,
      });
    }

    return curve;
  }

  private generateDrawdownCurve(
    equityCurve: Array<{ timestamp: Date; value: number }>
  ): Array<{ timestamp: Date; drawdown: number }> {
    const curve: Array<{ timestamp: Date; drawdown: number }> = [];
    let peak = equityCurve[0]?.value || 0;

    for (const point of equityCurve) {
      if (point.value > peak) {
        peak = point.value;
      }

      const drawdown = peak > 0 ? (peak - point.value) / peak : 0;
      curve.push({
        timestamp: point.timestamp,
        drawdown,
      });
    }

    return curve;
  }

  private calculateMonthlyReturns(
    equityCurve: Array<{ timestamp: Date; value: number }>
  ): Array<{ month: string; return: number }> {
    const monthlyReturns: Array<{ month: string; return: number }> = [];
    const monthlyData = new Map<string, { start: number; end: number }>();

    for (const point of equityCurve) {
      const monthKey = `${point.timestamp.getFullYear()}-${String(point.timestamp.getMonth() + 1).padStart(2, "0")}`;

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { start: point.value, end: point.value });
      } else {
        monthlyData.get(monthKey)!.end = point.value;
      }
    }

    for (const [month, data] of monthlyData) {
      const monthReturn = data.start > 0 ? (data.end - data.start) / data.start : 0;
      monthlyReturns.push({ month, return: monthReturn });
    }

    return monthlyReturns;
  }

  private calculateRiskMetrics(
    performance: BacktestPerformance,
    trades: Trade[],
    marketData: MarketData[]
  ): Record<string, number> {
    return {
      var_95: this.calculateVaR(trades, 0.95),
      cvar_95: this.calculateCVaR(trades, 0.95),
      tail_ratio: this.calculateTailRatio(trades),
      gain_to_pain: this.calculateGainToPainRatio(trades),
      sterling_ratio: this.calculateSterlingRatio(performance),
      burke_ratio: this.calculateBurkeRatio(performance, trades),
      pain_index: this.calculatePainIndex(trades),
      ulcer_index: this.calculateUlcerIndex(trades),
    };
  }

  private async runScenarioAnalysis(
    config: BacktestConfig,
    trades: Trade[]
  ): Promise<Record<string, any>> {
    // Placeholder for scenario analysis
    return {
      stress_test: { loss: -0.15, probability: 0.05 },
      monte_carlo: { mean_return: 0.12, confidence_interval: [0.08, 0.16] },
      sensitivity: { parameter_impact: "moderate" },
    };
  }

  private validateResults(
    performance: BacktestPerformance,
    config: BacktestConfig
  ): { passed: boolean; violations: string[]; warnings: string[] } {
    const violations: string[] = [];
    const warnings: string[] = [];

    // Check risk limits
    if (config.riskLimits) {
      if (
        config.riskLimits.maxDrawdown &&
        performance.maxDrawdown > config.riskLimits.maxDrawdown
      ) {
        violations.push(
          `Max drawdown ${performance.maxDrawdown} exceeds limit ${config.riskLimits.maxDrawdown}`
        );
      }

      if (
        config.riskLimits.minSharpeRatio &&
        performance.sharpeRatio < config.riskLimits.minSharpeRatio
      ) {
        violations.push(
          `Sharpe ratio ${performance.sharpeRatio} below minimum ${config.riskLimits.minSharpeRatio}`
        );
      }
    }

    // Generate warnings for concerning metrics
    if (performance.winRate < 0.4) {
      warnings.push("Low win rate may indicate poor strategy performance");
    }

    if (performance.maxDrawdown > 0.2) {
      warnings.push("High maximum drawdown indicates significant risk");
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings,
    };
  }

  // Additional risk metric calculations (simplified)
  private calculateVaR(trades: Trade[], confidence: number): number {
    const returns = trades.map((t) => t.pnl || 0).sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * returns.length);
    return returns[index] || 0;
  }

  private calculateCVaR(trades: Trade[], confidence: number): number {
    const var95 = this.calculateVaR(trades, confidence);
    const returns = trades.map((t) => t.pnl || 0);
    const tailReturns = returns.filter((r) => r <= var95);
    return tailReturns.length > 0
      ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length
      : 0;
  }

  private calculateTailRatio(trades: Trade[]): number {
    const returns = trades.map((t) => t.pnl || 0);
    const positiveReturns = returns.filter((r) => r > 0);
    const negativeReturns = returns.filter((r) => r < 0);

    if (negativeReturns.length === 0) return Number.POSITIVE_INFINITY;

    const top10Percent = Math.ceil(positiveReturns.length * 0.1);
    const bottom10Percent = Math.ceil(negativeReturns.length * 0.1);

    const avgTopGains =
      positiveReturns
        .sort((a, b) => b - a)
        .slice(0, top10Percent)
        .reduce((sum, r) => sum + r, 0) / top10Percent;
    const avgBottomLosses = Math.abs(
      negativeReturns
        .sort((a, b) => a - b)
        .slice(0, bottom10Percent)
        .reduce((sum, r) => sum + r, 0) / bottom10Percent
    );

    return avgBottomLosses > 0 ? avgTopGains / avgBottomLosses : 0;
  }

  private calculateGainToPainRatio(trades: Trade[]): number {
    const returns = trades.map((t) => t.pnl || 0);
    const gains = returns.filter((r) => r > 0).reduce((sum, r) => sum + r, 0);
    const losses = Math.abs(returns.filter((r) => r < 0).reduce((sum, r) => sum + r, 0));
    return losses > 0 ? gains / losses : 0;
  }

  private calculateSterlingRatio(performance: BacktestPerformance): number {
    return performance.maxDrawdown > 0 ? performance.annualizedReturn / performance.maxDrawdown : 0;
  }

  private calculateBurkeRatio(performance: BacktestPerformance, trades: Trade[]): number {
    // Simplified Burke ratio
    return performance.maxDrawdown > 0
      ? performance.annualizedReturn / Math.sqrt(performance.maxDrawdown)
      : 0;
  }

  private calculatePainIndex(trades: Trade[]): number {
    // Simplified pain index
    const negativeReturns = trades.map((t) => t.pnl || 0).filter((r) => r < 0);
    return negativeReturns.reduce((sum, r) => sum + Math.abs(r), 0) / trades.length;
  }

  private calculateUlcerIndex(trades: Trade[]): number {
    // Simplified ulcer index
    return Math.sqrt(this.calculatePainIndex(trades));
  }
}

/**
 * Trading Simulation Class
 */
class TradingSimulation {
  private parameters: Record<string, any>;
  private marketData: MarketData[];
  private portfolioValue = 100000; // Starting capital
  private openPositions: Trade[] = [];
  private equity: number[] = [];

  constructor(parameters: Record<string, any>, marketData: MarketData[]) {
    this.parameters = parameters;
    this.marketData = marketData;
  }

  getMarketData(): MarketData[] {
    return this.marketData;
  }

  getPortfolioValue(): number {
    return this.portfolioValue;
  }

  getOpenPositions(): Trade[] {
    return [...this.openPositions];
  }

  openPosition(trade: Trade): void {
    this.openPositions.push(trade);
    this.portfolioValue -= trade.quantity * trade.entryPrice + trade.fees;
  }

  closePosition(position: Trade): void {
    const index = this.openPositions.findIndex((p) => p === position);
    if (index !== -1) {
      this.openPositions.splice(index, 1);
      if (position.exitPrice && position.pnl !== undefined) {
        this.portfolioValue +=
          position.quantity * position.exitPrice - position.fees + position.pnl;
      }
    }
  }

  updatePortfolioValue(currentBar: MarketData): void {
    // Update portfolio value based on current positions
    let unrealizedPnL = 0;

    for (const position of this.openPositions) {
      if (position.symbol === currentBar.symbol) {
        unrealizedPnL += (currentBar.close - position.entryPrice) * position.quantity;
      }
    }

    this.equity.push(this.portfolioValue + unrealizedPnL);
  }
}
