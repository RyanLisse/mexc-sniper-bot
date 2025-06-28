/**
 * Trading Notification Service Adapter
 * Handles notifications for trading events
 */

import type { NotificationService } from "@/src/application/interfaces/trading-repository";
import type { Trade } from "@/src/domain/entities/trading/trade";
import { toSafeError } from "@/src/lib/error-type-utils";

export class TradingNotificationServiceAdapter implements NotificationService {
  constructor(
    private readonly logger: {
      info: (message: string, context?: any) => void;
      warn: (message: string, context?: any) => void;
      error: (message: string, context?: any) => void;
      debug: (message: string, context?: any) => void;
    } = console,
    private readonly eventEmitter?: {
      emit: (event: string, data: any) => void;
    }
  ) {}

  async notifyTradeExecution(trade: Trade): Promise<void> {
    try {
      this.logger.info("Trade execution notification", {
        tradeId: trade.id,
        symbol: trade.symbol,
        status: trade.status,
        isAutoSnipe: trade.isAutoSnipe,
        confidenceScore: trade.confidenceScore,
      });

      // Emit event if event emitter is available
      if (this.eventEmitter) {
        this.eventEmitter.emit("trade.execution.started", {
          tradeId: trade.id,
          userId: trade.userId,
          symbol: trade.symbol,
          status: trade.status,
          isAutoSnipe: trade.isAutoSnipe,
          confidenceScore: trade.confidenceScore,
          timestamp: new Date().toISOString(),
        });
      }

      // In a production system, this would send notifications via:
      // - Email
      // - SMS
      // - Push notifications
      // - Webhook calls
      // - Slack/Discord notifications
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to send trade execution notification", {
        tradeId: trade.id,
        error: safeError,
      });
      // Don't throw - notifications are non-critical
    }
  }

  async notifyTradeCompletion(trade: Trade): Promise<void> {
    try {
      const pnlPercentage = trade.calculatePnLPercentage();
      const executionDuration = trade.getExecutionDurationMs();

      this.logger.info("Trade completion notification", {
        tradeId: trade.id,
        symbol: trade.symbol,
        status: trade.status,
        pnlPercentage,
        executionDuration,
        totalCost: trade.totalCost?.amount,
        totalRevenue: trade.totalRevenue?.amount,
        realizedPnL: trade.realizedPnL?.amount,
      });

      // Emit event if event emitter is available
      if (this.eventEmitter) {
        this.eventEmitter.emit("trade.execution.completed", {
          tradeId: trade.id,
          userId: trade.userId,
          symbol: trade.symbol,
          status: trade.status,
          pnlPercentage,
          executionDuration,
          totalCost: trade.totalCost?.amount,
          totalRevenue: trade.totalRevenue?.amount,
          realizedPnL: trade.realizedPnL?.amount,
          isAutoSnipe: trade.isAutoSnipe,
          confidenceScore: trade.confidenceScore,
          timestamp: new Date().toISOString(),
        });
      }

      // Success notification logic would go here
      if (trade.isCompleted() && pnlPercentage && pnlPercentage > 0) {
        this.sendSuccessNotification(trade, pnlPercentage);
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to send trade completion notification", {
        tradeId: trade.id,
        error: safeError,
      });
      // Don't throw - notifications are non-critical
    }
  }

  async notifyTradeFailure(trade: Trade, error: string): Promise<void> {
    try {
      this.logger.warn("Trade failure notification", {
        tradeId: trade.id,
        symbol: trade.symbol,
        status: trade.status,
        error,
        isAutoSnipe: trade.isAutoSnipe,
        confidenceScore: trade.confidenceScore,
      });

      // Emit event if event emitter is available
      if (this.eventEmitter) {
        this.eventEmitter.emit("trade.execution.failed", {
          tradeId: trade.id,
          userId: trade.userId,
          symbol: trade.symbol,
          status: trade.status,
          error,
          isAutoSnipe: trade.isAutoSnipe,
          confidenceScore: trade.confidenceScore,
          timestamp: new Date().toISOString(),
        });
      }

      // Failure notification logic would go here
      this.sendFailureNotification(trade, error);
    } catch (notificationError) {
      const safeError = toSafeError(notificationError);
      this.logger.error("Failed to send trade failure notification", {
        tradeId: trade.id,
        originalError: error,
        notificationError: safeError,
      });
      // Don't throw - notifications are non-critical
    }
  }

  private sendSuccessNotification(trade: Trade, pnlPercentage: number): void {
    // In a production system, this would send success notifications
    this.logger.info("Sending success notification", {
      tradeId: trade.id,
      symbol: trade.symbol,
      pnlPercentage,
      message: `✅ Auto-snipe successful: ${trade.symbol} (+${pnlPercentage.toFixed(2)}%)`,
    });

    // Example notification channels:
    // - Email with profit summary
    // - Push notification to mobile app
    // - Webhook to external monitoring system
    // - Slack/Discord message to trading channel
  }

  private sendFailureNotification(trade: Trade, error: string): void {
    // In a production system, this would send failure notifications
    this.logger.warn("Sending failure notification", {
      tradeId: trade.id,
      symbol: trade.symbol,
      error,
      message: `❌ Auto-snipe failed: ${trade.symbol} - ${error}`,
    });

    // Example notification channels:
    // - Email with error details
    // - Push notification for critical failures
    // - Webhook to alerting system
    // - Slack/Discord alert to trading channel
  }

  // Additional notification methods

  async notifyPositionUpdate(
    trade: Trade,
    updateType: "stop_loss" | "take_profit" | "partial_fill"
  ): Promise<void> {
    try {
      this.logger.info("Position update notification", {
        tradeId: trade.id,
        symbol: trade.symbol,
        updateType,
        status: trade.status,
      });

      if (this.eventEmitter) {
        this.eventEmitter.emit("trade.position.updated", {
          tradeId: trade.id,
          userId: trade.userId,
          symbol: trade.symbol,
          updateType,
          status: trade.status,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to send position update notification", {
        tradeId: trade.id,
        updateType,
        error: safeError,
      });
    }
  }

  async notifyRiskAlert(
    trade: Trade,
    alertType: "stop_loss_triggered" | "max_loss_approaching"
  ): Promise<void> {
    try {
      this.logger.warn("Risk alert notification", {
        tradeId: trade.id,
        symbol: trade.symbol,
        alertType,
        status: trade.status,
      });

      if (this.eventEmitter) {
        this.eventEmitter.emit("trade.risk.alert", {
          tradeId: trade.id,
          userId: trade.userId,
          symbol: trade.symbol,
          alertType,
          status: trade.status,
          timestamp: new Date().toISOString(),
        });
      }

      // Send urgent notification for risk alerts
      this.sendRiskAlertNotification(trade, alertType);
    } catch (error) {
      const safeError = toSafeError(error);
      this.logger.error("Failed to send risk alert notification", {
        tradeId: trade.id,
        alertType,
        error: safeError,
      });
    }
  }

  private sendRiskAlertNotification(trade: Trade, alertType: string): void {
    this.logger.warn("Sending risk alert notification", {
      tradeId: trade.id,
      symbol: trade.symbol,
      alertType,
      message: `⚠️ Risk Alert: ${trade.symbol} - ${alertType}`,
    });

    // Risk alerts should be sent immediately via multiple channels
    // - Immediate push notification
    // - SMS for critical alerts
    // - Email with detailed analysis
    // - Webhook to monitoring dashboard
  }

  // Health check method
  isHealthy(): boolean {
    // In a production system, this would check:
    // - Email service connectivity
    // - Push notification service status
    // - Webhook endpoint availability
    return true;
  }
}
