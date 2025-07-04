/**
 * WebSocket Agent Broadcast Manager
 *
 * Specialized broadcasting methods for agent integration and system notifications.
 * Extracted from websocket-server.ts for better modularity and separation of concerns.
 *
 * Features:
 * - Agent status broadcasting
 * - Trading price updates
 * - Pattern discovery notifications
 * - User-specific notifications
 * - Channel-specific and global broadcasts
 */

import { UniversalCrypto as crypto } from "@/src/lib/browser-compatible-events";
import type {
  AgentStatusMessage,
  NotificationMessage,
  PatternDiscoveryMessage,
  TradingPriceMessage,
  WebSocketMessage,
} from "@/src/lib/websocket-types";

export type BroadcastFunction<T> = (
  message: Omit<WebSocketMessage<T>, "messageId" | "timestamp">
) => void;

export type UserBroadcastFunction<T> = (
  userId: string,
  message: WebSocketMessage<T>
) => void;

export interface AgentBroadcastConfig {
  broadcast: BroadcastFunction<any>;
  broadcastToUser: UserBroadcastFunction<any>;
}

export class AgentBroadcastManager {
  private broadcastFn: BroadcastFunction<any>;
  private broadcastToUserFn: UserBroadcastFunction<any>;

  private logger = {
    info: (message: string, context?: unknown) =>
      console.info("[agent-broadcast-manager]", message, context || ""),
    warn: (message: string, context?: unknown) =>
      console.warn("[agent-broadcast-manager]", message, context || ""),
    error: (message: string, context?: unknown, error?: Error) =>
      console.error(
        "[agent-broadcast-manager]",
        message,
        context || "",
        error || ""
      ),
    debug: (message: string, context?: unknown) =>
      console.debug("[agent-broadcast-manager]", message, context || ""),
  };

  constructor(config: AgentBroadcastConfig) {
    this.broadcastFn = config.broadcast;
    this.broadcastToUserFn = config.broadcastToUser;
  }

  /**
   * Broadcast agent status updates to subscribers
   */
  broadcastAgentStatus(agentStatus: AgentStatusMessage): void {
    try {
      // Broadcast to general agent status channel
      this.broadcastFn({
        type: "agent:status",
        channel: "agents:status",
        data: agentStatus,
      });

      // Also broadcast to specific agent channel
      this.broadcastFn({
        type: "agent:status",
        channel: `agent:${agentStatus.agentId}:status`,
        data: agentStatus,
      });

      this.logger.debug("Agent status broadcasted", {
        agentId: agentStatus.agentId,
        status: agentStatus.status,
        timestamp: agentStatus.timestamp,
      });
    } catch (error) {
      this.logger.error("Failed to broadcast agent status", {
        agentId: agentStatus.agentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Broadcast trading price updates
   */
  broadcastTradingPrice(priceData: TradingPriceMessage): void {
    try {
      // Broadcast to general trading prices channel
      this.broadcastFn({
        type: "trading:price",
        channel: "trading:prices",
        data: priceData,
      });

      // Also broadcast to symbol-specific channel
      this.broadcastFn({
        type: "trading:price",
        channel: `trading:${priceData.symbol}:price`,
        data: priceData,
      });

      this.logger.debug("Trading price broadcasted", {
        symbol: priceData.symbol,
        price: priceData.price,
        timestamp: priceData.timestamp,
      });
    } catch (error) {
      this.logger.error("Failed to broadcast trading price", {
        symbol: priceData.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Broadcast pattern discovery notifications
   */
  broadcastPatternDiscovery(pattern: PatternDiscoveryMessage): void {
    try {
      // Broadcast to general pattern discovery channel
      this.broadcastFn({
        type: "pattern:discovery",
        channel: "patterns:discovery",
        data: pattern,
      });

      // Also broadcast to symbol-specific channel
      this.broadcastFn({
        type: "pattern:discovery",
        channel: `patterns:${pattern.symbol}:discovery`,
        data: pattern,
      });

      this.logger.debug("Pattern discovery broadcasted", {
        symbol: pattern.symbol,
        patternType: pattern.patternType,
        confidence: pattern.confidence,
        timestamp: pattern.timestamp,
      });
    } catch (error) {
      this.logger.error("Failed to broadcast pattern discovery", {
        symbol: pattern.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Broadcast notifications (user-specific or global)
   */
  broadcastNotification(notification: NotificationMessage): void {
    try {
      if (notification.userId) {
        // Send to specific user
        this.broadcastToUserFn(notification.userId, {
          type: "notification:info",
          channel: `user:${notification.userId}:notifications`,
          data: notification,
          messageId: crypto.randomUUID(),
          timestamp: Date.now(),
        });

        this.logger.debug("User notification sent", {
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
        });
      } else {
        // Global notification
        this.broadcastFn({
          type: "notification:info",
          channel: "notifications:global",
          data: notification,
        });

        this.logger.debug("Global notification broadcasted", {
          type: notification.type,
          title: notification.title,
        });
      }
    } catch (error) {
      this.logger.error("Failed to broadcast notification", {
        userId: notification.userId,
        type: notification.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Broadcast system alerts (high priority notifications)
   */
  broadcastSystemAlert(alert: {
    level: "info" | "warning" | "error" | "critical";
    title: string;
    message: string;
    category?: string;
    metadata?: Record<string, unknown>;
  }): void {
    try {
      const alertNotification: NotificationMessage = {
        id: crypto.randomUUID(),
        type: "system",
        title: alert.title,
        message: alert.message,
        level: alert.level,
        timestamp: Date.now(),
        category: alert.category || "system",
        metadata: alert.metadata,
      };

      // Broadcast to system alerts channel
      this.broadcastFn({
        type: "system:alert",
        channel: "system:alerts",
        data: alertNotification,
      });

      // Also broadcast to level-specific channel
      this.broadcastFn({
        type: "system:alert",
        channel: `system:alerts:${alert.level}`,
        data: alertNotification,
      });

      this.logger.info("System alert broadcasted", {
        level: alert.level,
        title: alert.title,
        category: alert.category,
      });
    } catch (error) {
      this.logger.error("Failed to broadcast system alert", {
        level: alert.level,
        title: alert.title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Broadcast trading signals for algorithmic trading
   */
  broadcastTradingSignal(signal: {
    symbol: string;
    action: "BUY" | "SELL" | "HOLD";
    confidence: number;
    price: number;
    strategy: string;
    metadata?: Record<string, unknown>;
  }): void {
    try {
      const signalMessage = {
        id: crypto.randomUUID(),
        ...signal,
        timestamp: Date.now(),
      };

      // Broadcast to trading signals channel
      this.broadcastFn({
        type: "trading:signal",
        channel: "trading:signals",
        data: signalMessage,
      });

      // Also broadcast to symbol-specific signal channel
      this.broadcastFn({
        type: "trading:signal",
        channel: `trading:${signal.symbol}:signals`,
        data: signalMessage,
      });

      this.logger.debug("Trading signal broadcasted", {
        symbol: signal.symbol,
        action: signal.action,
        confidence: signal.confidence,
        strategy: signal.strategy,
      });
    } catch (error) {
      this.logger.error("Failed to broadcast trading signal", {
        symbol: signal.symbol,
        action: signal.action,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Broadcast market data updates
   */
  broadcastMarketData(marketData: {
    symbol: string;
    bid: number;
    ask: number;
    volume: number;
    high24h: number;
    low24h: number;
    change24h: number;
    timestamp: number;
  }): void {
    try {
      // Broadcast to market data channel
      this.broadcastFn({
        type: "market:data",
        channel: "market:data",
        data: marketData,
      });

      // Also broadcast to symbol-specific market data channel
      this.broadcastFn({
        type: "market:data",
        channel: `market:${marketData.symbol}:data`,
        data: marketData,
      });

      this.logger.debug("Market data broadcasted", {
        symbol: marketData.symbol,
        bid: marketData.bid,
        ask: marketData.ask,
        volume: marketData.volume,
      });
    } catch (error) {
      this.logger.error("Failed to broadcast market data", {
        symbol: marketData.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Broadcast agent coordination messages
   */
  broadcastAgentCoordination(coordination: {
    initiatorAgentId: string;
    targetAgentIds: string[];
    action: string;
    priority: "low" | "medium" | "high" | "critical";
    payload: Record<string, unknown>;
    expiresAt?: number;
  }): void {
    try {
      const coordinationMessage = {
        id: crypto.randomUUID(),
        ...coordination,
        timestamp: Date.now(),
      };

      // Broadcast to agent coordination channel
      this.broadcastFn({
        type: "agent:coordination",
        channel: "agents:coordination",
        data: coordinationMessage,
      });

      // Broadcast to each target agent's specific channel
      for (const targetAgentId of coordination.targetAgentIds) {
        this.broadcastFn({
          type: "agent:coordination",
          channel: `agent:${targetAgentId}:coordination`,
          data: coordinationMessage,
        });
      }

      this.logger.debug("Agent coordination broadcasted", {
        initiatorAgentId: coordination.initiatorAgentId,
        targetAgentCount: coordination.targetAgentIds.length,
        action: coordination.action,
        priority: coordination.priority,
      });
    } catch (error) {
      this.logger.error("Failed to broadcast agent coordination", {
        initiatorAgentId: coordination.initiatorAgentId,
        action: coordination.action,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get broadcasting statistics
   */
  getStats(): {
    totalBroadcasts: number;
    broadcastTypes: Record<string, number>;
    lastBroadcastTime: number;
  } {
    // This would be implemented with actual tracking in a real scenario
    return {
      totalBroadcasts: 0,
      broadcastTypes: {},
      lastBroadcastTime: Date.now(),
    };
  }
}
