/**
 * Position Manager Module
 *
 * Handles position tracking, management, and lifecycle operations.
 * Extracted from the original monolithic core-trading.service.ts for modularity.
 */

import { toSafeError } from "@/src/lib/error-type-utils";
import type {
  ModuleContext,
  ModuleState,
  Position,
  ServiceResponse,
  TradeParameters,
  TradeResult,
} from "./types";

export class PositionManager {
  private context: ModuleContext;
  private state: ModuleState;

  // Position tracking
  private activePositions = new Map<string, Position>();
  private positionHistory: Position[] = [];

  // Performance tracking
  private totalPnL = 0;
  private realizedPnL = 0;
  private unrealizedPnL = 0;

  constructor(context: ModuleContext) {
    this.context = context;
    this.state = {
      isInitialized: false,
      isHealthy: true,
      lastActivity: new Date(),
      metrics: {
        activePositions: 0,
        totalPositions: 0,
        totalPnL: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
      },
    };

    // Listen for trade executed events to create positions
    this.context.eventEmitter.on("trade_executed", (result: TradeResult) => {
      if (result.success && result.data && result.data.side === "BUY") {
        this.trackPosition(result);
      }
    });
  }

  /**
   * Initialize the position manager module
   */
  async initialize(): Promise<void> {
    this.context.logger.info("Initializing Position Manager Module");
    this.state.isInitialized = true;
    this.context.logger.info("Position Manager Module initialized successfully");
  }

  /**
   * Shutdown the position manager module
   */
  async shutdown(): Promise<void> {
    this.context.logger.info("Shutting down Position Manager Module");

    // Close all positions if not in paper trading mode
    if (!this.context.config.enablePaperTrading && this.activePositions.size > 0) {
      await this.closeAllPositions("Position Manager shutdown");
    }

    this.state.isInitialized = false;
  }

  /**
   * Update configuration
   */
  async updateConfig(config: any): Promise<void> {
    this.context.config = config;
    this.context.logger.info("Position Manager Module configuration updated");
  }

  /**
   * Get all active positions
   */
  async getActivePositions(): Promise<Position[]> {
    return Array.from(this.activePositions.values());
  }

  /**
   * Get a specific position by ID
   */
  async getPosition(positionId: string): Promise<Position | undefined> {
    return this.activePositions.get(positionId);
  }

  /**
   * Get position statistics
   */
  async getPositionStats() {
    return {
      activeCount: this.activePositions.size,
      totalCount: this.positionHistory.length + this.activePositions.size,
      totalPnL: this.totalPnL,
      realizedPnL: this.realizedPnL,
      unrealizedPnL: this.unrealizedPnL,
      averageHoldTime: this.calculateAverageHoldTime(),
      winRate: this.calculateWinRate(),
    };
  }

  /**
   * Close all positions
   */
  async closeAllPositions(reason: string): Promise<ServiceResponse<{ closedCount: number }>> {
    try {
      this.context.logger.info(`Closing all positions: ${reason}`);

      let closedCount = 0;

      for (const [positionId, position] of this.activePositions) {
        try {
          if (this.context.config.enablePaperTrading) {
            // Close paper position
            this.closePaperPosition(positionId, reason);
            closedCount++;
          } else {
            // Close real position
            await this.closeRealPosition(position, reason);
            closedCount++;
          }
        } catch (error) {
          const safeError = toSafeError(error);
          this.context.logger.error(`Failed to close position ${positionId}`, safeError);
        }
      }

      this.updateMetrics();

      return {
        success: true,
        data: { closedCount },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Close a specific position
   */
  async closePosition(positionId: string, reason: string): Promise<ServiceResponse<void>> {
    try {
      const position = this.activePositions.get(positionId);
      if (!position) {
        return {
          success: false,
          error: `Position ${positionId} not found`,
          timestamp: new Date().toISOString(),
        };
      }

      if (this.context.config.enablePaperTrading) {
        this.closePaperPosition(positionId, reason);
      } else {
        await this.closeRealPosition(position, reason);
      }

      this.updateMetrics();

      return {
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const safeError = toSafeError(error);
      return {
        success: false,
        error: safeError.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Update position with current market data
   */
  async updatePositionPrices(): Promise<void> {
    if (this.activePositions.size === 0) return;

    for (const [positionId, position] of this.activePositions) {
      try {
        // Get current market price
        const ticker = await this.context.mexcService.getTickerPrice(position.symbol);
        if (ticker.success && ticker.data?.price) {
          const currentPrice = parseFloat(ticker.data.price);

          // Update position
          position.currentPrice = currentPrice;

          // Calculate unrealized P&L with enhanced metrics
          const priceDiff = currentPrice - position.entryPrice;
          const positionPnL = priceDiff * position.quantity;
          position.unrealizedPnL = positionPnL;
          position.pnlPercentage = (priceDiff / position.entryPrice) * 100;

          // Enhanced risk calculations
          await this.calculateEnhancedRiskMetrics(position);

          // Check stop-loss and take-profit conditions with trailing stop logic
          await this.checkPositionTriggers(position);

          this.activePositions.set(positionId, position);
        }
      } catch (error) {
        const safeError = toSafeError(error);
        this.context.logger.error(`Failed to update position ${positionId}`, safeError);
      }
    }

    // Update unrealized P&L total with portfolio-level calculations
    this.unrealizedPnL = Array.from(this.activePositions.values()).reduce(
      (total, pos) => total + (pos.unrealizedPnL || 0),
      0
    );

    // Calculate portfolio-level risk metrics
    await this.calculatePortfolioRiskMetrics();

    this.updateMetrics();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Track a new position from trade result
   */
  private async trackPosition(result: TradeResult): Promise<void> {
    if (!result.data) return;

    try {
      const position: Position = {
        id: result.data.orderId,
        symbol: result.data.symbol,
        side: result.data.side as "BUY" | "SELL",
        orderId: result.data.orderId,
        clientOrderId: result.data.clientOrderId,
        entryPrice: parseFloat(result.data.price),
        quantity: parseFloat(result.data.executedQty),
        status: "open",
        openTime: new Date(),
        strategy: this.context.config.defaultStrategy,
        confidenceScore: result.data.confidenceScore,
        autoSnipe: result.data.autoSnipe,
        paperTrade: this.context.config.enablePaperTrading,
        tags: [],
      };

      // Set stop-loss and take-profit if specified
      if (result.data.autoSnipe) {
        // Auto-snipe positions get default risk management
        position.stopLossPercent = 10; // 10% stop-loss
        position.takeProfitPercent = 20; // 20% take-profit
        position.stopLossPrice = position.entryPrice * 0.9;
        position.takeProfitPrice = position.entryPrice * 1.2;
      }

      this.activePositions.set(position.id, position);
      this.context.eventEmitter.emit("position_opened", position);

      this.context.logger.info("Position tracked", {
        positionId: position.id,
        symbol: position.symbol,
        entryPrice: position.entryPrice,
        quantity: position.quantity,
      });

      this.updateMetrics();
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to track position", { result, error: safeError });
    }
  }

  /**
   * Check position triggers (stop-loss, take-profit)
   */
  private async checkPositionTriggers(position: Position): Promise<void> {
    if (!position.currentPrice) return;

    const currentPrice = position.currentPrice;

    // Check stop-loss
    if (position.stopLossPrice && currentPrice <= position.stopLossPrice) {
      this.context.logger.warn(`Stop-loss triggered for position ${position.id}`, {
        currentPrice,
        stopLossPrice: position.stopLossPrice,
      });

      if (this.context.config.enablePaperTrading) {
        this.closePaperPosition(position.id, "Stop-loss triggered");
      } else {
        await this.closeRealPosition(position, "Stop-loss triggered");
      }
      return;
    }

    // Check take-profit
    if (position.takeProfitPrice && currentPrice >= position.takeProfitPrice) {
      this.context.logger.info(`Take-profit triggered for position ${position.id}`, {
        currentPrice,
        takeProfitPrice: position.takeProfitPrice,
      });

      if (this.context.config.enablePaperTrading) {
        this.closePaperPosition(position.id, "Take-profit triggered");
      } else {
        await this.closeRealPosition(position, "Take-profit triggered");
      }
      return;
    }
  }

  /**
   * Close a paper trading position
   */
  private closePaperPosition(positionId: string, reason: string): void {
    const position = this.activePositions.get(positionId);
    if (!position) return;

    // Simulate P&L
    const currentPrice =
      position.currentPrice || position.entryPrice * (1 + (Math.random() - 0.5) * 0.1);
    const pnl = (currentPrice - position.entryPrice) * position.quantity;

    position.status = "closed";
    position.closeTime = new Date();
    position.currentPrice = currentPrice;
    position.realizedPnL = pnl;
    position.pnlPercentage = (pnl / (position.entryPrice * position.quantity)) * 100;
    position.notes = reason;

    this.activePositions.delete(positionId);
    this.positionHistory.push(position);
    this.totalPnL += pnl;
    this.realizedPnL += pnl;

    this.context.eventEmitter.emit("position_closed", position);

    this.context.logger.info("Paper position closed", {
      positionId,
      pnl,
      pnlPercentage: position.pnlPercentage,
      reason,
    });
  }

  /**
   * Close a real trading position
   */
  private async closeRealPosition(position: Position, reason: string): Promise<void> {
    try {
      const closeParams: TradeParameters = {
        symbol: position.symbol,
        side: position.side === "BUY" ? "SELL" : "BUY",
        type: "MARKET",
        quantity: position.quantity,
        timeInForce: "IOC",
      };

      // Execute close order through MEXC service
      const mexcResult = await this.context.mexcService.placeOrder(closeParams);

      if (mexcResult.success && mexcResult.data) {
        const exitPrice = parseFloat(mexcResult.data.price);
        const pnl =
          position.side === "BUY"
            ? (exitPrice - position.entryPrice) * position.quantity
            : (position.entryPrice - exitPrice) * position.quantity;

        position.status = "closed";
        position.closeTime = new Date();
        position.currentPrice = exitPrice;
        position.realizedPnL = pnl;
        position.pnlPercentage = (pnl / (position.entryPrice * position.quantity)) * 100;
        position.notes = reason;

        this.activePositions.delete(position.id);
        this.positionHistory.push(position);
        this.totalPnL += pnl;
        this.realizedPnL += pnl;

        this.context.eventEmitter.emit("position_closed", position);

        this.context.logger.info("Real position closed", {
          positionId: position.id,
          exitPrice,
          pnl,
          pnlPercentage: position.pnlPercentage,
          reason,
        });
      } else {
        const error = new Error(mexcResult.error || "Failed to close position");
        this.context.logger.error("MEXC position close failed", {
          component: 'PositionManager',
          operation: 'closeRealPosition',
          positionId: position.id,
          mexcError: mexcResult.error,
          context: { position, exitPrice, reason }
        });
        throw error;
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.context.logger.error("Failed to close real position", {
        positionId: position.id,
        error: safeError,
      });
      throw error;
    }
  }

  /**
   * Calculate average hold time for closed positions
   */
  private calculateAverageHoldTime(): number {
    const closedPositions = this.positionHistory.filter((p) => p.closeTime);
    if (closedPositions.length === 0) return 0;

    const totalHoldTime = closedPositions.reduce((total, position) => {
      if (position.closeTime) {
        return total + (position.closeTime.getTime() - position.openTime.getTime());
      }
      return total;
    }, 0);

    return totalHoldTime / closedPositions.length; // Average in milliseconds
  }

  /**
   * Calculate win rate for closed positions
   */
  private calculateWinRate(): number {
    const closedPositions = this.positionHistory.filter((p) => p.realizedPnL !== undefined);
    if (closedPositions.length === 0) return 0;

    const winningPositions = closedPositions.filter((p) => (p.realizedPnL || 0) > 0);
    return (winningPositions.length / closedPositions.length) * 100;
  }

  /**
   * Calculate enhanced risk metrics for individual positions
   */
  private async calculateEnhancedRiskMetrics(position: Position): Promise<void> {
    if (!position.currentPrice) return;

    // Value at Risk calculation (simplified)
    const positionValue = position.quantity * position.entryPrice;
    const volatility = await this.estimateVolatility(position.symbol);
    const confidenceLevel = 0.95; // 95% confidence
    const timeHorizon = 1; // 1 day
    const valueAtRisk = positionValue * volatility * Math.sqrt(timeHorizon) * 1.645; // 95% VaR

    // Expected Shortfall (Conditional VaR)
    const expectedShortfall = valueAtRisk * 1.25; // Simplified approximation

    // Position-specific risk metrics
    position.riskMetrics = {
      valueAtRisk,
      expectedShortfall,
      volatility,
      beta: await this.estimateBeta(position.symbol),
      sharpeRatio: this.calculatePositionSharpeRatio(position),
      maxFavorableExcursion: this.calculateMaxFavorableExcursion(position),
      maxAdverseExcursion: this.calculateMaxAdverseExcursion(position),
    };
  }

  /**
   * Calculate portfolio-level risk metrics
   */
  private async calculatePortfolioRiskMetrics(): Promise<void> {
    if (this.activePositions.size === 0) return;

    const positions = Array.from(this.activePositions.values());
    const totalValue = positions.reduce((sum, pos) => sum + pos.quantity * pos.entryPrice, 0);

    // Portfolio concentration risk
    const concentrationRisk = this.calculateConcentrationRisk(positions, totalValue);

    // Portfolio correlation risk
    const correlationRisk = await this.calculateCorrelationRisk(positions);

    // Portfolio beta
    const portfolioBeta = await this.calculatePortfolioBeta(positions, totalValue);

    // Update portfolio metrics
    this.state.metrics.portfolioRiskMetrics = {
      concentrationRisk,
      correlationRisk,
      portfolioBeta,
      diversificationRatio: this.calculateDiversificationRatio(positions),
      maxDrawdownPercent: (this.maxDrawdown / totalValue) * 100,
    };
  }

  /**
   * Estimate volatility for a symbol (simplified)
   */
  private async estimateVolatility(symbol: string): Promise<number> {
    try {
      // In a real implementation, this would use historical price data
      // For now, return a reasonable estimate based on asset type
      if (symbol.includes("BTC")) return 0.04; // 4% daily volatility
      if (symbol.includes("ETH")) return 0.05; // 5% daily volatility
      return 0.03; // 3% default volatility
    } catch {
      return 0.03; // Fallback volatility
    }
  }

  /**
   * Estimate beta coefficient for a symbol
   */
  private async estimateBeta(symbol: string): Promise<number> {
    try {
      // Simplified beta estimation - would use market correlation in real implementation
      if (symbol.includes("BTC")) return 1.0;
      if (symbol.includes("ETH")) return 1.2;
      return 0.8; // Default beta for altcoins
    } catch {
      return 1.0; // Market beta
    }
  }

  /**
   * Calculate position-specific Sharpe ratio
   */
  private calculatePositionSharpeRatio(position: Position): number {
    if (!position.unrealizedPnL || !position.currentPrice) return 0;

    const returns = (position.unrealizedPnL / (position.quantity * position.entryPrice)) * 100;
    const riskFreeRate = 0; // Assume 0 for simplicity
    const volatility = 5; // Estimated daily volatility percentage

    return (returns - riskFreeRate) / volatility;
  }

  /**
   * Calculate Maximum Favorable Excursion
   */
  private calculateMaxFavorableExcursion(position: Position): number {
    // In a real implementation, this would track the highest unrealized profit
    // For now, return current unrealized P&L if positive
    return Math.max(0, position.unrealizedPnL || 0);
  }

  /**
   * Calculate Maximum Adverse Excursion
   */
  private calculateMaxAdverseExcursion(position: Position): number {
    // In a real implementation, this would track the worst unrealized loss
    // For now, return current unrealized P&L if negative
    return Math.min(0, position.unrealizedPnL || 0);
  }

  /**
   * Calculate concentration risk
   */
  private calculateConcentrationRisk(positions: Position[], totalValue: number): number {
    if (positions.length === 0 || totalValue === 0) return 0;

    // Calculate Herfindahl-Hirschman Index for concentration
    const weights = positions.map((pos) => (pos.quantity * pos.entryPrice) / totalValue);
    const hhi = weights.reduce((sum, weight) => sum + weight * weight, 0);

    // Convert to concentration risk (0-1 scale, where 1 is maximum concentration)
    return hhi;
  }

  /**
   * Calculate correlation risk between positions
   */
  private async calculateCorrelationRisk(positions: Position[]): Promise<number> {
    if (positions.length < 2) return 0;

    // Simplified correlation risk calculation
    // In a real implementation, this would use historical correlations
    let totalCorrelation = 0;
    let pairCount = 0;

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const correlation = await this.estimateCorrelation(
          positions[i].symbol,
          positions[j].symbol
        );
        totalCorrelation += Math.abs(correlation);
        pairCount++;
      }
    }

    return pairCount > 0 ? totalCorrelation / pairCount : 0;
  }

  /**
   * Estimate correlation between two symbols
   */
  private async estimateCorrelation(symbol1: string, symbol2: string): Promise<number> {
    // Simplified correlation estimation
    if (symbol1 === symbol2) return 1;
    if (symbol1.includes("BTC") && symbol2.includes("ETH")) return 0.7;
    if (symbol1.includes("BTC") || symbol2.includes("BTC")) return 0.5;
    return 0.3; // Default correlation for crypto pairs
  }

  /**
   * Calculate portfolio beta
   */
  private async calculatePortfolioBeta(positions: Position[], totalValue: number): Promise<number> {
    if (positions.length === 0 || totalValue === 0) return 1;

    let weightedBeta = 0;
    for (const position of positions) {
      const weight = (position.quantity * position.entryPrice) / totalValue;
      const beta = await this.estimateBeta(position.symbol);
      weightedBeta += weight * beta;
    }

    return weightedBeta;
  }

  /**
   * Calculate diversification ratio
   */
  private calculateDiversificationRatio(positions: Position[]): number {
    if (positions.length === 0) return 0;

    // Simplified diversification ratio
    // Perfect diversification = 1, no diversification = 0
    return Math.min(1, positions.length / 10); // Assume 10 positions is well-diversified
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(): void {
    this.state.metrics = {
      activePositions: this.activePositions.size,
      totalPositions: this.positionHistory.length + this.activePositions.size,
      totalPnL: this.totalPnL,
      realizedPnL: this.realizedPnL,
      unrealizedPnL: this.unrealizedPnL,
    };

    this.state.lastActivity = new Date();
  }
}
