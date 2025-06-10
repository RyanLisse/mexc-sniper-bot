/**
 * React Hook for WebSocket Price Data
 * Provides real-time price updates for trading symbols
 * Integrates with the WebSocket Price Service for efficient data streaming
 */

import { webSocketPriceService } from "@/src/services/websocket-price-service";
import { useCallback, useEffect, useState } from "react";

interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

interface UseWebSocketPriceResult {
  price: PriceUpdate | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  subscribe: () => void;
  unsubscribe: () => void;
  reconnect: () => void;
}

interface UseWebSocketPriceOptions {
  autoConnect?: boolean;
  retryOnError?: boolean;
  maxRetries?: number;
}

/**
 * Hook to subscribe to real-time price updates for a single symbol
 */
export function useWebSocketPrice(
  symbol: string,
  options: UseWebSocketPriceOptions = {}
): UseWebSocketPriceResult {
  const { autoConnect = true, retryOnError = true, maxRetries = 3 } = options;

  const [price, setPrice] = useState<PriceUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [unsubscribeFn, setUnsubscribeFn] = useState<(() => void) | null>(null);

  // Update connection status based on service status
  useEffect(() => {
    const updateStatus = () => {
      const status = webSocketPriceService.getStatus();
      setIsConnected(status.isConnected);
      setIsConnecting(status.isConnecting);
    };

    // Update status immediately
    updateStatus();

    // Set up periodic status updates
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: handles subscription lifecycle
  const subscribe = useCallback(async () => {
    if (!symbol || unsubscribeFn) return;

    try {
      setError(null);
      setIsConnecting(true);

      // Connect to WebSocket service if not connected
      if (!webSocketPriceService.getStatus().isConnected) {
        await webSocketPriceService.connect();
      }

      // Subscribe to price updates
      const unsubscribe = webSocketPriceService.subscribe(symbol, (priceUpdate) => {
        setPrice(priceUpdate);
        setError(null);
        setRetryCount(0);
      });

      setUnsubscribeFn(() => unsubscribe);

      // Get current cached price immediately
      const cachedPrice = webSocketPriceService.getCurrentPrice(symbol);
      if (cachedPrice) {
        setPrice(cachedPrice);
      }

      console.log(`📊 Subscribed to price updates for ${symbol}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to subscribe to price updates";
      setError(errorMessage);
      console.error(`❌ Failed to subscribe to ${symbol}:`, err);

      // Retry logic
      if (retryOnError && retryCount < maxRetries) {
        setRetryCount((prev) => prev + 1);
        setTimeout(
          () => {
            subscribe();
          },
          2 ** retryCount * 1000
        ); // Exponential backoff
      }
    } finally {
      setIsConnecting(false);
    }
  }, [symbol, unsubscribeFn, retryOnError, retryCount, maxRetries]);

  const unsubscribe = useCallback(() => {
    if (unsubscribeFn) {
      unsubscribeFn();
      setUnsubscribeFn(null);
      setPrice(null);
      console.log(`📊 Unsubscribed from price updates for ${symbol}`);
    }
  }, [unsubscribeFn, symbol]);

  const reconnect = useCallback(async () => {
    unsubscribe();
    setRetryCount(0);
    await subscribe();
  }, [unsubscribe, subscribe]);

  // Auto-connect effect
  useEffect(() => {
    if (autoConnect && symbol && !unsubscribeFn) {
      subscribe();
    }

    return () => {
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    };
  }, [symbol, autoConnect, subscribe, unsubscribeFn]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribe();
    };
  }, [unsubscribe]);

  return {
    price,
    isConnected,
    isConnecting,
    error,
    subscribe,
    unsubscribe,
    reconnect,
  };
}

/**
 * Hook to subscribe to real-time price updates for multiple symbols
 */
export function useWebSocketPrices(
  symbols: string[],
  options: UseWebSocketPriceOptions = {}
): {
  prices: Map<string, PriceUpdate>;
  isConnected: boolean;
  isConnecting: boolean;
  errors: Map<string, string>;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
  subscribeAll: () => void;
  unsubscribeAll: () => void;
  reconnect: () => void;
} {
  const { autoConnect = true, retryOnError = true, maxRetries = 3 } = options;

  const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [unsubscribeFns, setUnsubscribeFns] = useState<Map<string, () => void>>(new Map());
  const [retryCounts, setRetryCounts] = useState<Map<string, number>>(new Map());

  // Update connection status
  useEffect(() => {
    const updateStatus = () => {
      const status = webSocketPriceService.getStatus();
      setIsConnected(status.isConnected);
      setIsConnecting(status.isConnecting);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const subscribe = useCallback(
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: manages multiple websockets
    async (symbol: string) => {
      if (!symbol || unsubscribeFns.has(symbol)) return;

      try {
        setErrors((prev) => {
          const newErrors = new Map(prev);
          newErrors.delete(symbol);
          return newErrors;
        });

        // Connect to WebSocket service if not connected
        if (!webSocketPriceService.getStatus().isConnected) {
          await webSocketPriceService.connect();
        }

        // Subscribe to price updates
        const unsubscribe = webSocketPriceService.subscribe(symbol, (priceUpdate) => {
          setPrices((prev) => new Map(prev).set(symbol, priceUpdate));
          setErrors((prev) => {
            const newErrors = new Map(prev);
            newErrors.delete(symbol);
            return newErrors;
          });
          setRetryCounts((prev) => {
            const newCounts = new Map(prev);
            newCounts.delete(symbol);
            return newCounts;
          });
        });

        setUnsubscribeFns((prev) => new Map(prev).set(symbol, unsubscribe));

        // Get current cached price immediately
        const cachedPrice = webSocketPriceService.getCurrentPrice(symbol);
        if (cachedPrice) {
          setPrices((prev) => new Map(prev).set(symbol, cachedPrice));
        }

        console.log(`📊 Subscribed to price updates for ${symbol}`);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to subscribe to price updates";
        setErrors((prev) => new Map(prev).set(symbol, errorMessage));
        console.error(`❌ Failed to subscribe to ${symbol}:`, err);

        // Retry logic
        const currentRetryCount = retryCounts.get(symbol) || 0;
        if (retryOnError && currentRetryCount < maxRetries) {
          setRetryCounts((prev) => new Map(prev).set(symbol, currentRetryCount + 1));
          setTimeout(
            () => {
              subscribe(symbol);
            },
            2 ** currentRetryCount * 1000
          );
        }
      }
    },
    [unsubscribeFns, retryOnError, retryCounts, maxRetries]
  );

  const unsubscribe = useCallback(
    (symbol: string) => {
      const unsubscribeFn = unsubscribeFns.get(symbol);
      if (unsubscribeFn) {
        unsubscribeFn();
        setUnsubscribeFns((prev) => {
          const newMap = new Map(prev);
          newMap.delete(symbol);
          return newMap;
        });
        setPrices((prev) => {
          const newMap = new Map(prev);
          newMap.delete(symbol);
          return newMap;
        });
        console.log(`📊 Unsubscribed from price updates for ${symbol}`);
      }
    },
    [unsubscribeFns]
  );

  const subscribeAll = useCallback(async () => {
    for (const symbol of symbols) {
      await subscribe(symbol);
    }
  }, [symbols, subscribe]);

  const unsubscribeAll = useCallback(() => {
    for (const symbol of symbols) {
      unsubscribe(symbol);
    }
  }, [symbols, unsubscribe]);

  const reconnect = useCallback(async () => {
    unsubscribeAll();
    setRetryCounts(new Map());
    await subscribeAll();
  }, [unsubscribeAll, subscribeAll]);

  // Auto-connect effect
  useEffect(() => {
    if (autoConnect && symbols.length > 0) {
      subscribeAll();
    }

    return () => {
      unsubscribeAll();
    };
  }, [symbols, autoConnect, subscribeAll, unsubscribeAll]);

  return {
    prices,
    isConnected,
    isConnecting,
    errors,
    subscribe,
    unsubscribe,
    subscribeAll,
    unsubscribeAll,
    reconnect,
  };
}

/**
 * Hook to get WebSocket service status and control
 */
export function useWebSocketService(): {
  status: {
    isConnected: boolean;
    isConnecting: boolean;
    subscribedSymbols: string[];
    cachedPrices: number;
    reconnectAttempts: number;
  };
  connect: () => Promise<void>;
  disconnect: () => void;
  getAllPrices: () => Map<string, PriceUpdate>;
} {
  const [status, setStatus] = useState(() => webSocketPriceService.getStatus());

  useEffect(() => {
    const updateStatus = () => {
      setStatus(webSocketPriceService.getStatus());
    };

    // Update status immediately and then every second
    updateStatus();
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, []);

  const connect = useCallback(async () => {
    await webSocketPriceService.connect();
  }, []);

  const disconnect = useCallback(() => {
    webSocketPriceService.disconnect();
  }, []);

  const getAllPrices = useCallback(() => {
    return webSocketPriceService.getAllPrices();
  }, []);

  return {
    status,
    connect,
    disconnect,
    getAllPrices,
  };
}
