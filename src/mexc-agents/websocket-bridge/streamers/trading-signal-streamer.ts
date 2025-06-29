/**
 * Trading Signal Streamer
 * 
 * Handles streaming of trading signals and signal-based notifications
 */

import type {
  NotificationMessage,
  TradingSignalMessage,
} from "@/src/lib/websocket-types";
import { webSocketServer } from "@/src/services/data/websocket-server";
import type { TradingSignalData } from "../types";

export class TradingSignalStreamer {
  broadcastTradingSignal(signal: TradingSignalData): void {
    const message: TradingSignalMessage = {
      signalId: signal.signalId,
      symbol: signal.symbol,
      type: signal.type,
      strength: signal.strength,
      confidence: signal.confidence,
      source: signal.source as any,
      reasoning: signal.reasoning,
      targetPrice: signal.targetPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit,
      timeframe: signal.timeframe,
      timestamp: Date.now(),
      metadata: signal.metadata,
    };

    webSocketServer.broadcast({
      type: "trading:signal",
      channel: "trading:signals",
      data: message,
    });

    // Also broadcast to symbol-specific channel
    webSocketServer.broadcast({
      type: "trading:signal",
      channel: `trading:${signal.symbol}:signals`,
      data: message,
    });

    // Send notification for high-strength signals
    if (signal.strength > 80 && signal.confidence > 0.8) {
      this.broadcastSignalAlert(message);
    }
  }

  private broadcastSignalAlert(signal: TradingSignalMessage): void {
    const notification: NotificationMessage = {
      notificationId: crypto.randomUUID(),
      type: signal.type === "buy" ? "success" : signal.type === "sell" ? "warning" : "info",
      title: "High-Strength Trading Signal",
      message: `${signal.type.toUpperCase()} signal for ${signal.symbol} (Strength: ${signal.strength}%, Confidence: ${Math.round(signal.confidence * 100)}%)`,
      priority: "high",
      category: "trading",
      timestamp: Date.now(),
      actionable: true,
      actions: [
        {
          label: "View Signal",
          action: "navigate",
          params: { path: `/signals/${signal.signalId}` },
        },
        {
          label: "Execute Trade",
          action: "execute_trade",
          params: {
            symbol: signal.symbol,
            type: signal.type,
            signalId: signal.signalId,
          },
        },
      ],
      metadata: {
        symbol: signal.symbol,
        signalId: signal.signalId,
        strength: signal.strength,
        confidence: signal.confidence,
      } as any,
    };

    webSocketServer.broadcastNotification(notification);
  }
}