/**
 * Supabase Real-time Subscriptions for Trading Data
 *
 * This module provides comprehensive real-time data subscriptions for:
 * - Trading activities and transactions
 * - Portfolio balance updates
 * - Snipe target status changes
 * - System alerts and notifications
 * - Price data and market updates
 */

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { supabase } from "@/src/db";

// Type definitions for real-time events
export interface TradingDataUpdate {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: any;
  old: any;
  timestamp: string;
}

export interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

export interface PortfolioUpdate {
  userId: string;
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  positions: any[];
  timestamp: string;
}

export interface SnipeTargetUpdate {
  id: string;
  symbol: string;
  status: "active" | "triggered" | "cancelled" | "expired";
  triggerPrice: number;
  currentPrice: number;
  timestamp: string;
}

export interface SystemAlert {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  userId?: string;
  timestamp: string;
}

// Subscription callback types
export type TradingDataCallback = (update: TradingDataUpdate) => void;
export type PriceUpdateCallback = (update: PriceUpdate) => void;
export type PortfolioUpdateCallback = (update: PortfolioUpdate) => void;
export type SnipeTargetCallback = (update: SnipeTargetUpdate) => void;
export type SystemAlertCallback = (alert: SystemAlert) => void;

/**
 * Real-time Trading Data Manager
 */
export class SupabaseRealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.setupConnectionMonitoring();
  }

  /**
   * Setup connection monitoring and auto-reconnect
   */
  private setupConnectionMonitoring() {
    // Monitor connection status using channel subscription callbacks
    // Note: Supabase realtime client doesn't expose direct connection events
    // We'll monitor through channel subscription status instead
    this.isConnected = true; // Assume connected initially

    // Set up periodic connection health check
    setInterval(() => {
      this.checkConnectionHealth();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check connection health by attempting to create a test channel
   */
  private async checkConnectionHealth() {
    try {
      const testChannel = supabase
        .channel("health_check")
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            this.isConnected = true;
            this.reconnectAttempts = 0;
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            this.isConnected = false;
            this.handleReconnect();
          }
          // Clean up test channel
          testChannel.unsubscribe();
        });
    } catch (error) {
      console.error("[Realtime] Connection health check failed:", error);
      this.isConnected = false;
      this.handleReconnect();
    }
  }

  /**
   * Handle automatic reconnection
   */
  private async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[Realtime] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * 2 ** (this.reconnectAttempts - 1);

    console.log(
      `[Realtime] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    setTimeout(() => {
      this.resubscribeAll();
    }, delay);
  }

  /**
   * Resubscribe to all channels after reconnection
   */
  private resubscribeAll() {
    console.log("[Realtime] Resubscribing to all channels");
    for (const [channelName, channel] of this.channels) {
      try {
        channel.unsubscribe();
        // The individual subscribe methods will recreate the channels
      } catch (error) {
        console.error(
          `[Realtime] Error resubscribing to ${channelName}:`,
          error
        );
      }
    }
  }

  /**
   * Subscribe to trading transactions in real-time
   */
  subscribeToTransactions(
    userId: string,
    callback: TradingDataCallback
  ): () => void {
    const channelName = `transactions:${userId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const update: TradingDataUpdate = {
            table: "transactions",
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
            timestamp: new Date().toISOString(),
          };
          callback(update);
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Transactions subscription status: ${status}`);
      });

    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  /**
   * Subscribe to portfolio balance updates
   */
  subscribeToPortfolio(
    userId: string,
    callback: PortfolioUpdateCallback
  ): () => void {
    const channelName = `portfolio:${userId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "portfolio_summary",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          if (payload.new) {
            const update: PortfolioUpdate = {
              userId: payload.new.user_id,
              totalValue: payload.new.total_value,
              totalPnl: payload.new.total_pnl,
              totalPnlPercent: payload.new.total_pnl_percent,
              positions: payload.new.positions || [],
              timestamp: payload.new.updated_at || new Date().toISOString(),
            };
            callback(update);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Portfolio subscription status: ${status}`);
      });

    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  /**
   * Subscribe to snipe target updates
   */
  subscribeToSnipeTargets(
    userId: string,
    callback: SnipeTargetCallback
  ): () => void {
    const channelName = `snipe_targets:${userId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "snipe_targets",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          if (payload.new) {
            const update: SnipeTargetUpdate = {
              id: payload.new.id,
              symbol: payload.new.symbol,
              status: payload.new.status,
              triggerPrice: payload.new.trigger_price,
              currentPrice: payload.new.current_price,
              timestamp: payload.new.updated_at || new Date().toISOString(),
            };
            callback(update);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Snipe targets subscription status: ${status}`);
      });

    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  /**
   * Subscribe to execution history updates
   */
  subscribeToExecutionHistory(
    userId: string,
    callback: TradingDataCallback
  ): () => void {
    const channelName = `execution_history:${userId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "execution_history",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const update: TradingDataUpdate = {
            table: "execution_history",
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
            timestamp: new Date().toISOString(),
          };
          callback(update);
        }
      )
      .subscribe((status) => {
        console.log(
          `[Realtime] Execution history subscription status: ${status}`
        );
      });

    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  /**
   * Subscribe to price updates via broadcast
   * Note: Price data typically comes from external sources and is broadcast
   */
  subscribeToPriceUpdates(
    symbols: string[],
    callback: PriceUpdateCallback
  ): () => void {
    const channelName = `price_updates:${symbols.join(",")}`;

    const channel = supabase
      .channel(channelName)
      .on("broadcast", { event: "price_update" }, (payload) => {
        const update: PriceUpdate = payload.payload;
        if (symbols.includes(update.symbol)) {
          callback(update);
        }
      })
      .subscribe((status) => {
        console.log(`[Realtime] Price updates subscription status: ${status}`);
      });

    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  /**
   * Subscribe to system alerts and notifications
   */
  subscribeToSystemAlerts(
    userId: string,
    callback: SystemAlertCallback
  ): () => void {
    const channelName = `system_alerts:${userId}`;

    const channel = supabase
      .channel(channelName)
      .on("broadcast", { event: "system_alert" }, (payload) => {
        const alert: SystemAlert = payload.payload;
        // Only process alerts for this user or global alerts
        if (!alert.userId || alert.userId === userId) {
          callback(alert);
        }
      })
      .subscribe((status) => {
        console.log(`[Realtime] System alerts subscription status: ${status}`);
      });

    this.channels.set(channelName, channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channelName);
    };
  }

  /**
   * Broadcast a price update to all subscribers
   */
  async broadcastPriceUpdate(priceUpdate: PriceUpdate): Promise<void> {
    try {
      await supabase.channel("price_updates").send({
        type: "broadcast",
        event: "price_update",
        payload: priceUpdate,
      });
    } catch (error) {
      console.error("[Realtime] Failed to broadcast price update:", error);
    }
  }

  /**
   * Broadcast a system alert
   */
  async broadcastSystemAlert(alert: SystemAlert): Promise<void> {
    try {
      await supabase.channel("system_alerts").send({
        type: "broadcast",
        event: "system_alert",
        payload: alert,
      });
    } catch (error) {
      console.error("[Realtime] Failed to broadcast system alert:", error);
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    channels: number;
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      channels: this.channels.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Disconnect all subscriptions
   */
  disconnectAll(): void {
    console.log("[Realtime] Disconnecting all subscriptions");

    for (const [channelName, channel] of this.channels) {
      try {
        channel.unsubscribe();
      } catch (error) {
        console.error(
          `[Realtime] Error unsubscribing from ${channelName}:`,
          error
        );
      }
    }

    this.channels.clear();
    this.isConnected = false;
  }

  /**
   * Subscribe to multiple data streams for a user
   */
  subscribeToUserData(
    userId: string,
    callbacks: {
      onTransaction?: TradingDataCallback;
      onPortfolio?: PortfolioUpdateCallback;
      onSnipeTarget?: SnipeTargetCallback;
      onExecution?: TradingDataCallback;
      onAlert?: SystemAlertCallback;
    }
  ): () => void {
    const unsubscribeFunctions: (() => void)[] = [];

    if (callbacks.onTransaction) {
      unsubscribeFunctions.push(
        this.subscribeToTransactions(userId, callbacks.onTransaction)
      );
    }

    if (callbacks.onPortfolio) {
      unsubscribeFunctions.push(
        this.subscribeToPortfolio(userId, callbacks.onPortfolio)
      );
    }

    if (callbacks.onSnipeTarget) {
      unsubscribeFunctions.push(
        this.subscribeToSnipeTargets(userId, callbacks.onSnipeTarget)
      );
    }

    if (callbacks.onExecution) {
      unsubscribeFunctions.push(
        this.subscribeToExecutionHistory(userId, callbacks.onExecution)
      );
    }

    if (callbacks.onAlert) {
      unsubscribeFunctions.push(
        this.subscribeToSystemAlerts(userId, callbacks.onAlert)
      );
    }

    // Return a function that unsubscribes from all
    return () => {
      unsubscribeFunctions.forEach((fn) => fn());
    };
  }
}

// Export singleton instance
export const realtimeManager = new SupabaseRealtimeManager();
