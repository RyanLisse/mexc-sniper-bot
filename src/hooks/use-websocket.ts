/**
 * Enhanced WebSocket Hook
 *
 * React hook for WebSocket communication with the AI trading system.
 * Provides real-time updates for agents, trading data, and patterns.
 *
 * Features:
 * - Automatic connection management
 * - Authentication integration
 * - Channel subscription management
 * - Message buffering during disconnection
 * - TypeScript type safety
 * - Performance optimization
 */

import type {
  MessageHandler,
  SubscriptionRequest,
  WebSocketChannel,
  WebSocketClientMetrics,
  WebSocketMessage,
} from "@/src/lib/websocket-types";
import { type WebSocketClientState, webSocketClient } from "@/src/services/websocket-client";
import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ======================
// Hook Configuration
// ======================

export interface UseWebSocketConfig {
  /** Enable automatic connection on mount */
  autoConnect?: boolean;
  /** Enable automatic reconnection */
  autoReconnect?: boolean;
  /** Debug logging */
  debug?: boolean;
  /** Authentication token (overrides auto-detection) */
  authToken?: string;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Custom WebSocket URL */
  url?: string;
}

export interface UseWebSocketResult {
  /** Current connection state */
  state: WebSocketClientState;
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Whether currently attempting to connect */
  isConnecting: boolean;
  /** Connection metrics and statistics */
  metrics: WebSocketClientMetrics | null;
  /** Last connection error */
  error: string | null;
  /** Manual connect function */
  connect: () => Promise<void>;
  /** Manual disconnect function */
  disconnect: () => void;
  /** Manual reconnect function */
  reconnect: () => void;
  /** Send a message */
  send: <T>(message: Omit<WebSocketMessage<T>, "messageId" | "timestamp">) => boolean;
  /** Subscribe to a channel */
  subscribe: (
    channel: WebSocketChannel,
    handler: MessageHandler,
    request?: SubscriptionRequest
  ) => () => void;
  /** Get current subscriptions */
  subscriptions: string[];
  /** Connection ID if connected */
  connectionId?: string;
}

// ======================
// Main WebSocket Hook
// ======================

export function useWebSocket(config: UseWebSocketConfig = {}): UseWebSocketResult {
  const {
    autoConnect = true,
    autoReconnect = true,
    debug = false,
    authToken: configAuthToken,
    connectionTimeout = 10000,
    url,
  } = config;

  // State management
  const [state, setState] = useState<WebSocketClientState>("disconnected");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [metrics, setMetrics] = useState<WebSocketClientMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [connectionId, setConnectionId] = useState<string | undefined>();

  // Refs for cleanup and stability
  const isMountedRef = useRef(true);
  const clientRef = useRef(webSocketClient);
  const handlersRef = useRef(new Map<string, () => void>());

  // Authentication
  const { isAuthenticated, getToken } = useKindeBrowserClient();

  // Get auth token
  const authToken = useMemo(async () => {
    if (configAuthToken) return configAuthToken;
    if (isAuthenticated) {
      try {
        const token = await getToken();
        return token || "";
      } catch (error) {
        console.warn("[WebSocket Hook] Failed to get auth token:", error);
        return "";
      }
    }
    return "";
  }, [configAuthToken, isAuthenticated, getToken]);

  // Connect function
  const connect = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setError(null);
      setIsConnecting(true);

      const token = await authToken;

      // Configure client if URL is provided
      if (url) {
        clientRef.current = webSocketClient;
        // Would need to update client config here
      }

      await clientRef.current.connect(token);

      if (debug) {
        console.log("[WebSocket Hook] Connected successfully");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Connection failed";
      setError(errorMessage);

      if (debug) {
        console.error("[WebSocket Hook] Connection failed:", errorMessage);
      }
    } finally {
      if (isMountedRef.current) {
        setIsConnecting(false);
      }
    }
  }, [authToken, url, debug]);

  // Disconnect function
  const disconnect = useCallback(() => {
    clientRef.current.disconnect();

    if (debug) {
      console.log("[WebSocket Hook] Disconnected");
    }
  }, [debug]);

  // Reconnect function
  const reconnect = useCallback(() => {
    if (debug) {
      console.log("[WebSocket Hook] Reconnecting...");
    }

    clientRef.current.reconnect();
  }, [debug]);

  // Send message function
  const send = useCallback(
    <T>(message: Omit<WebSocketMessage<T>, "messageId" | "timestamp">) => {
      const success = clientRef.current.send(message);

      if (debug && !success) {
        console.warn("[WebSocket Hook] Failed to send message:", message);
      }

      return success;
    },
    [debug]
  );

  // Subscribe function
  const subscribe = useCallback(
    (channel: WebSocketChannel, handler: MessageHandler, request?: SubscriptionRequest) => {
      const unsubscribe = clientRef.current.subscribe(channel, handler, request);

      // Store unsubscribe function for cleanup
      const handlerId = `${channel}:${Date.now()}`;
      handlersRef.current.set(handlerId, unsubscribe);

      // Update subscriptions list
      setSubscriptions(clientRef.current.getSubscriptions());

      if (debug) {
        console.log(`[WebSocket Hook] Subscribed to ${channel}`);
      }

      // Return enhanced unsubscribe function
      return () => {
        unsubscribe();
        handlersRef.current.delete(handlerId);
        setSubscriptions(clientRef.current.getSubscriptions());

        if (debug) {
          console.log(`[WebSocket Hook] Unsubscribed from ${channel}`);
        }
      };
    },
    [debug]
  );

  // Set up event listeners
  useEffect(() => {
    const client = clientRef.current;

    const handleStateChange = ({ newState }: { newState: WebSocketClientState }) => {
      if (isMountedRef.current) {
        setState(newState);
        setIsConnected(newState === "connected");
        setIsConnecting(newState === "connecting" || newState === "reconnecting");
      }
    };

    const handleConnected = () => {
      if (isMountedRef.current) {
        setError(null);
        setConnectionId(client.getConnectionId());

        if (debug) {
          console.log("[WebSocket Hook] Connection established");
        }
      }
    };

    const handleDisconnected = () => {
      if (isMountedRef.current) {
        setConnectionId(undefined);

        if (debug) {
          console.log("[WebSocket Hook] Connection lost");
        }
      }
    };

    const handleError = (error: any) => {
      if (isMountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : "WebSocket error";
        setError(errorMessage);

        if (debug) {
          console.error("[WebSocket Hook] WebSocket error:", errorMessage);
        }
      }
    };

    const handleMessage = (message: WebSocketMessage) => {
      if (debug) {
        console.log("[WebSocket Hook] Message received:", message);
      }
    };

    // Add event listeners
    client.on("stateChange", handleStateChange);
    client.on("connected", handleConnected);
    client.on("disconnected", handleDisconnected);
    client.on("error", handleError);
    client.on("message", handleMessage);

    // Initial state sync
    setState(client.getState());
    setIsConnected(client.isConnected());
    setSubscriptions(client.getSubscriptions());
    setConnectionId(client.getConnectionId());

    return () => {
      client.off("stateChange", handleStateChange);
      client.off("connected", handleConnected);
      client.off("disconnected", handleDisconnected);
      client.off("error", handleError);
      client.off("message", handleMessage);
    };
  }, [debug]);

  // Auto-connect effect
  useEffect(() => {
    if (autoConnect && !isConnected && !isConnecting && state === "disconnected") {
      connect();
    }
  }, [autoConnect, isConnected, isConnecting, state, connect]);

  // Metrics update effect
  useEffect(() => {
    const updateMetrics = () => {
      if (isMountedRef.current) {
        setMetrics(clientRef.current.getMetrics());
      }
    };

    // Update metrics immediately and then every 5 seconds
    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      // Cleanup all subscriptions
      for (const unsubscribe of handlersRef.current.values()) {
        unsubscribe();
      }
      handlersRef.current.clear();

      // Disconnect if connected
      if (clientRef.current.isConnected()) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  return {
    state,
    isConnected,
    isConnecting,
    metrics,
    error,
    connect,
    disconnect,
    reconnect,
    send,
    subscribe,
    subscriptions,
    connectionId,
  };
}

// ======================
// Typed Subscription Hooks
// ======================

/**
 * Hook for subscribing to agent status updates
 */
export function useAgentStatus() {
  const { subscribe, isConnected } = useWebSocket();
  const [agentStatuses, setAgentStatuses] = useState(new Map());
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe("agents:status", (message) => {
      if (message.type === "agent:status") {
        setAgentStatuses((prev) => {
          const newMap = new Map(prev);
          newMap.set(message.data.agentId, message.data);
          return newMap;
        });
        setLastUpdate(Date.now());
      }
    });

    return unsubscribe;
  }, [isConnected, subscribe]);

  return {
    agentStatuses: Array.from(agentStatuses.values()),
    agentStatusMap: agentStatuses,
    lastUpdate,
  };
}

/**
 * Hook for subscribing to trading price updates
 */
export function useTradingPrices(symbols?: string[]) {
  const { subscribe, isConnected } = useWebSocket();
  const [prices, setPrices] = useState(new Map());
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribers: (() => void)[] = [];

    // Subscribe to general trading prices
    unsubscribers.push(
      subscribe("trading:prices", (message) => {
        if (message.type === "trading:price") {
          setPrices((prev) => {
            const newMap = new Map(prev);
            newMap.set(message.data.symbol, message.data);
            return newMap;
          });
          setLastUpdate(Date.now());
        }
      })
    );

    // Subscribe to specific symbol prices if provided
    if (symbols) {
      for (const symbol of symbols) {
        unsubscribers.push(
          subscribe(`trading:${symbol}:price`, (message) => {
            if (message.type === "trading:price") {
              setPrices((prev) => {
                const newMap = new Map(prev);
                newMap.set(message.data.symbol, message.data);
                return newMap;
              });
              setLastUpdate(Date.now());
            }
          })
        );
      }
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [isConnected, subscribe, symbols]);

  return {
    prices: Array.from(prices.values()),
    priceMap: prices,
    getPrice: useCallback((symbol: string) => prices.get(symbol), [prices]),
    lastUpdate,
  };
}

/**
 * Hook for subscribing to pattern discovery updates
 */
export function usePatternDiscovery(symbols?: string[]) {
  const { subscribe, isConnected } = useWebSocket();
  const [patterns, setPatterns] = useState<any[]>([]);
  const [readyStates, setReadyStates] = useState(new Map());
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribers: (() => void)[] = [];

    // Subscribe to pattern discovery
    unsubscribers.push(
      subscribe("patterns:discovery", (message) => {
        if (message.type === "pattern:discovery") {
          setPatterns((prev) => [message.data, ...prev.slice(0, 99)]); // Keep last 100
          setLastUpdate(Date.now());
        }
      })
    );

    // Subscribe to ready state patterns
    unsubscribers.push(
      subscribe("patterns:ready_state", (message) => {
        if (message.type === "pattern:ready_state") {
          setReadyStates((prev) => {
            const newMap = new Map(prev);
            newMap.set(message.data.symbol, message.data);
            return newMap;
          });
          setLastUpdate(Date.now());
        }
      })
    );

    // Subscribe to specific symbol patterns if provided
    if (symbols) {
      for (const symbol of symbols) {
        unsubscribers.push(
          subscribe(`patterns:${symbol}:discovery`, (message) => {
            if (message.type === "pattern:discovery") {
              setPatterns((prev) => [message.data, ...prev.slice(0, 99)]);
              setLastUpdate(Date.now());
            }
          })
        );

        unsubscribers.push(
          subscribe(`patterns:${symbol}:ready_state`, (message) => {
            if (message.type === "pattern:ready_state") {
              setReadyStates((prev) => {
                const newMap = new Map(prev);
                newMap.set(message.data.symbol, message.data);
                return newMap;
              });
              setLastUpdate(Date.now());
            }
          })
        );
      }
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [isConnected, subscribe, symbols]);

  return {
    patterns,
    readyStates: Array.from(readyStates.values()),
    readyStateMap: readyStates,
    getReadyState: useCallback((symbol: string) => readyStates.get(symbol), [readyStates]),
    lastUpdate,
  };
}

/**
 * Hook for subscribing to workflow updates
 */
export function useWorkflows() {
  const { subscribe, isConnected } = useWebSocket();
  const [workflows, setWorkflows] = useState(new Map());
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe("agents:workflows", (message) => {
      if (message.type === "agent:workflow") {
        setWorkflows((prev) => {
          const newMap = new Map(prev);
          newMap.set(message.data.workflowId, message.data);
          return newMap;
        });
        setLastUpdate(Date.now());
      }
    });

    return unsubscribe;
  }, [isConnected, subscribe]);

  return {
    workflows: Array.from(workflows.values()),
    workflowMap: workflows,
    getWorkflow: useCallback((workflowId: string) => workflows.get(workflowId), [workflows]),
    lastUpdate,
  };
}

/**
 * Hook for subscribing to notifications
 */
export function useNotifications(userId?: string) {
  const { subscribe, isConnected } = useWebSocket();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribers: (() => void)[] = [];

    // Subscribe to global notifications
    unsubscribers.push(
      subscribe("notifications:global", (message) => {
        if (message.type.startsWith("notification:")) {
          setNotifications((prev) => [message.data, ...prev.slice(0, 99)]);
          setUnreadCount((prev) => prev + 1);
        }
      })
    );

    // Subscribe to user-specific notifications if userId provided
    if (userId) {
      unsubscribers.push(
        subscribe(`user:${userId}:notifications`, (message) => {
          if (message.type.startsWith("notification:")) {
            setNotifications((prev) => [message.data, ...prev.slice(0, 99)]);
            setUnreadCount((prev) => prev + 1);
          }
        })
      );
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [isConnected, subscribe, userId]);

  const markAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    clearNotifications,
  };
}
