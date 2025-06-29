/**
 * React Hooks for Supabase Real-time Subscriptions
 * 
 * This module provides React hooks that make it easy to subscribe to
 * real-time trading data updates in components.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/src/lib/supabase-auth-client';
import {
  PortfolioUpdate,
  PriceUpdate,
  realtimeManager,
  SnipeTargetUpdate,
  SystemAlert, 
  TradingDataUpdate
} from '@/src/lib/supabase-realtime';

/**
 * Hook to subscribe to trading transactions in real-time
 */
export function useRealtimeTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<TradingDataUpdate[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = realtimeManager.subscribeToTransactions(
      user.id,
      (update) => {
        setTransactions(prev => [update, ...prev.slice(0, 99)]); // Keep last 100
        setLastUpdate(new Date());
      }
    );

    setIsConnected(true);

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [user?.id]);

  return {
    transactions,
    lastUpdate,
    isConnected,
    clearTransactions: () => setTransactions([])
  };
}

/**
 * Hook to subscribe to portfolio updates in real-time
 */
export function useRealtimePortfolio() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioUpdate | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = realtimeManager.subscribeToPortfolio(
      user.id,
      (update) => {
        setPortfolio(update);
        setLastUpdate(new Date());
      }
    );

    setIsConnected(true);

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [user?.id]);

  return {
    portfolio,
    lastUpdate,
    isConnected
  };
}

/**
 * Hook to subscribe to snipe targets in real-time
 */
export function useRealtimeSnipeTargets() {
  const { user } = useAuth();
  const [snipeTargets, setSnipeTargets] = useState<Map<string, SnipeTargetUpdate>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = realtimeManager.subscribeToSnipeTargets(
      user.id,
      (update) => {
        setSnipeTargets(prev => {
          const newMap = new Map(prev);
          newMap.set(update.id, update);
          return newMap;
        });
        setLastUpdate(new Date());
      }
    );

    setIsConnected(true);

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [user?.id]);

  const snipeTargetsArray = Array.from(snipeTargets.values());

  return {
    snipeTargets: snipeTargetsArray,
    snipeTargetsMap: snipeTargets,
    activeTargets: snipeTargetsArray.filter(t => t.status === 'active'),
    triggeredTargets: snipeTargetsArray.filter(t => t.status === 'triggered'),
    lastUpdate,
    isConnected
  };
}

/**
 * Hook to subscribe to execution history in real-time
 */
export function useRealtimeExecutionHistory() {
  const { user } = useAuth();
  const [executions, setExecutions] = useState<TradingDataUpdate[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = realtimeManager.subscribeToExecutionHistory(
      user.id,
      (update) => {
        setExecutions(prev => [update, ...prev.slice(0, 49)]); // Keep last 50
        setLastUpdate(new Date());
      }
    );

    setIsConnected(true);

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [user?.id]);

  return {
    executions,
    lastUpdate,
    isConnected,
    clearExecutions: () => setExecutions([])
  };
}

/**
 * Hook to subscribe to price updates for specific symbols
 */
export function useRealtimePrices(symbols: string[] = []) {
  const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (symbols.length === 0) return;

    const unsubscribe = realtimeManager.subscribeToPriceUpdates(
      symbols,
      (update) => {
        setPrices(prev => {
          const newMap = new Map(prev);
          newMap.set(update.symbol, update);
          return newMap;
        });
        setLastUpdate(new Date());
      }
    );

    setIsConnected(true);

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [symbols.join(',')]); // Re-subscribe when symbols change

  const getPrice = useCallback((symbol: string) => {
    return prices.get(symbol);
  }, [prices]);

  return {
    prices: Array.from(prices.values()),
    pricesMap: prices,
    getPrice,
    lastUpdate,
    isConnected
  };
}

/**
 * Hook to subscribe to system alerts
 */
export function useRealtimeAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = realtimeManager.subscribeToSystemAlerts(
      user.id,
      (alert) => {
        setAlerts(prev => [alert, ...prev.slice(0, 99)]); // Keep last 100
        setUnreadCount(prev => prev + 1);
        setLastUpdate(new Date());
      }
    );

    setIsConnected(true);

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [user?.id]);

  const markAllAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setUnreadCount(0);
  }, []);

  return {
    alerts,
    unreadCount,
    lastUpdate,
    isConnected,
    markAllAsRead,
    clearAlerts
  };
}

/**
 * Comprehensive hook that subscribes to all user trading data
 */
export function useRealtimeTradingData() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    channels: 0,
    reconnectAttempts: 0
  });

  // Individual hooks
  const transactions = useRealtimeTransactions();
  const portfolio = useRealtimePortfolio();
  const snipeTargets = useRealtimeSnipeTargets();
  const executions = useRealtimeExecutionHistory();
  const alerts = useRealtimeAlerts();

  // Update connection status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const status = realtimeManager.getConnectionStatus();
      setConnectionStatus(status);
      setIsConnected(status.connected);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const lastUpdate = [
    transactions.lastUpdate,
    portfolio.lastUpdate,
    snipeTargets.lastUpdate,
    executions.lastUpdate,
    alerts.lastUpdate
  ].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] || null;

  return {
    // Connection status
    isConnected,
    connectionStatus,
    lastUpdate,

    // Trading data
    transactions: transactions.transactions,
    portfolio: portfolio.portfolio,
    snipeTargets: snipeTargets.snipeTargets,
    activeTargets: snipeTargets.activeTargets,
    triggeredTargets: snipeTargets.triggeredTargets,
    executions: executions.executions,
    alerts: alerts.alerts,
    unreadAlerts: alerts.unreadCount,

    // Actions
    clearTransactions: transactions.clearTransactions,
    clearExecutions: executions.clearExecutions,
    markAlertsAsRead: alerts.markAllAsRead,
    clearAlerts: alerts.clearAlerts
  };
}

/**
 * Hook to manage real-time connection for a specific component
 */
export function useRealtimeConnection() {
  const connectionRef = useRef<boolean>(false);
  const [status, setStatus] = useState({
    connected: false,
    channels: 0,
    reconnectAttempts: 0
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const newStatus = realtimeManager.getConnectionStatus();
      setStatus(newStatus);
      connectionRef.current = newStatus.connected;
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const disconnect = useCallback(() => {
    realtimeManager.disconnectAll();
  }, []);

  return {
    ...status,
    disconnect
  };
}

/**
 * Hook for broadcasting system alerts (admin use)
 */
export function useRealtimeBroadcast() {
  const { user } = useAuth();

  const broadcastAlert = useCallback(async (alert: Omit<SystemAlert, 'id' | 'timestamp'>) => {
    if (!user?.id) return;

    const fullAlert: SystemAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };

    await realtimeManager.broadcastSystemAlert(fullAlert);
  }, [user?.id]);

  const broadcastPrice = useCallback(async (priceUpdate: PriceUpdate) => {
    await realtimeManager.broadcastPriceUpdate(priceUpdate);
  }, []);

  return {
    broadcastAlert,
    broadcastPrice
  };
}