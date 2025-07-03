/**
 * Pattern Discovery Streamer
 *
 * Handles streaming of pattern discovery and ready state notifications
 */

import type {
  NotificationMessage,
  PatternDiscoveryMessage,
  PatternReadyStateMessage,
} from "@/src/lib/websocket-types";
import { webSocketServer } from "@/src/services/data/websocket-server";
import type { PatternDiscoveryData, ReadyStateData } from "../types";

export class PatternDiscoveryStreamer {
  private patternBuffer = new Map<string, PatternDiscoveryMessage>();
  private readyStateBuffer = new Map<string, PatternReadyStateMessage>();

  broadcastPatternDiscovery(pattern: PatternDiscoveryData): void {
    const message: PatternDiscoveryMessage = {
      patternId: pattern.patternId,
      symbol: pattern.symbol,
      pattern: {
        type: pattern.type as any,
        name: pattern.name,
        description: pattern.description,
        confidence: pattern.confidence,
        strength: pattern.strength,
      },
      timing: {
        detectedAt: pattern.detectedAt,
        estimatedExecution: pattern.estimatedExecution,
        advanceNotice: pattern.estimatedExecution - pattern.detectedAt,
        timeframe: "1h", // Default timeframe
      },
      criteria: pattern.criteria,
      metadata: pattern.metadata,
    };

    this.patternBuffer.set(pattern.patternId, message);
    webSocketServer.broadcastPatternDiscovery(message);

    // Broadcast pattern alert if high confidence
    if (pattern.confidence > 0.8) {
      this.broadcastPatternAlert(message);
    }
  }

  broadcastReadyStatePattern(data: ReadyStateData): void {
    const isReady = data.sts === 2 && data.st === 2 && data.tt === 4;
    const advanceNotice = data.estimatedLaunchTime
      ? data.estimatedLaunchTime - Date.now()
      : 0;

    const message: PatternReadyStateMessage = {
      symbol: data.symbol,
      vcoinId: data.vcoinId,
      readyState: {
        sts: data.sts,
        st: data.st,
        tt: data.tt,
        isReady,
        confidence: data.confidence,
        estimatedLaunchTime: data.estimatedLaunchTime,
      },
      analysis: {
        advanceNotice,
        riskLevel: data.riskLevel,
        expectedVolatility: data.expectedVolatility,
        correlatedSymbols: data.correlatedSymbols,
      },
      timestamp: Date.now(),
      metadata: data.metadata,
    };

    this.readyStateBuffer.set(data.symbol, message);

    webSocketServer.broadcast({
      type: "pattern:ready_state",
      channel: "patterns:ready_state",
      data: message,
    });

    // Also broadcast to symbol-specific channel
    webSocketServer.broadcast({
      type: "pattern:ready_state",
      channel: `patterns:${data.symbol}:ready_state`,
      data: message,
    });

    // Send high-priority notification if ready
    if (isReady) {
      this.broadcastReadyStateAlert(message);
    }
  }

  private broadcastPatternAlert(pattern: PatternDiscoveryMessage): void {
    const notification: NotificationMessage = {
      notificationId: crypto.randomUUID(),
      type: "info",
      title: "Pattern Discovered",
      message: `High confidence ${pattern.pattern.type} pattern detected for ${pattern.symbol}`,
      priority: "high",
      category: "pattern",
      timestamp: Date.now(),
      actionable: true,
      actions: [
        {
          label: "View Details",
          action: "navigate",
          params: { path: `/patterns/${pattern.patternId}` },
        },
        {
          label: "Create Strategy",
          action: "create_strategy",
          params: { symbol: pattern.symbol, patternId: pattern.patternId },
        },
      ],
      metadata: {
        symbol: pattern.symbol,
        patternId: pattern.patternId,
      } as any,
    };

    webSocketServer.broadcastNotification(notification);
  }

  private broadcastReadyStateAlert(readyState: PatternReadyStateMessage): void {
    const notification: NotificationMessage = {
      notificationId: crypto.randomUUID(),
      type: "success",
      title: "Symbol Ready for Trading",
      message: `${readyState.symbol} is now ready for trading (sts:${readyState.readyState.sts}, st:${readyState.readyState.st}, tt:${readyState.readyState.tt})`,
      priority: "critical",
      category: "pattern",
      timestamp: Date.now(),
      actionable: true,
      actions: [
        {
          label: "Execute Trade",
          action: "execute_trade",
          params: { symbol: readyState.symbol, vcoinId: readyState.vcoinId },
        },
        {
          label: "Monitor Price",
          action: "monitor_price",
          params: { symbol: readyState.symbol },
        },
      ],
      metadata: {
        symbol: readyState.symbol,
        vcoinId: readyState.vcoinId,
      } as any,
    };

    webSocketServer.broadcastNotification(notification);
  }

  // Buffer access methods
  getPatternBuffer(): Map<string, PatternDiscoveryMessage> {
    return new Map(this.patternBuffer);
  }

  getReadyStateBuffer(): Map<string, PatternReadyStateMessage> {
    return new Map(this.readyStateBuffer);
  }

  clearBuffers(): void {
    this.patternBuffer.clear();
    this.readyStateBuffer.clear();
  }
}
