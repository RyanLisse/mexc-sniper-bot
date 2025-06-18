/**
 * Memory Leak Optimizer
 * 
 * Phase 4: Memory Management (2h)
 * TARGET: Eliminate memory leaks and optimize memory usage
 * 
 * Features:
 * - React hook memory leak prevention
 * - WebSocket connection cleanup
 * - Event listener management
 * - Timer and interval cleanup
 * - Memory usage monitoring
 * - Reference cleanup utilities
 * - Performance tracking
 */

import { useCallback, useEffect, useRef } from "react";

// ============================================================================
// Memory Leak Detection and Prevention
// ============================================================================

interface MemoryStats {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  heapUsagePercent: number;
}

interface LeakDetectionConfig {
  checkInterval: number;
  memoryThreshold: number;
  alertThreshold: number;
  trackComponents: boolean;
  trackEventListeners: boolean;
  trackTimers: boolean;
}

export class MemoryLeakDetector {
  private static instance: MemoryLeakDetector;
  private config: LeakDetectionConfig = {
    checkInterval: 30000, // 30 seconds
    memoryThreshold: 100 * 1024 * 1024, // 100MB
    alertThreshold: 0.8, // 80% of heap limit
    trackComponents: true,
    trackEventListeners: true,
    trackTimers: true,
  };

  private components = new Set<string>();
  private eventListeners = new Map<string, Set<() => void>>();
  private timers = new Set<NodeJS.Timeout | number>();
  private intervals = new Set<NodeJS.Timeout | number>();
  private webSockets = new Set<WebSocket>();
  private checkInterval?: NodeJS.Timeout;
  private memoryHistory: MemoryStats[] = [];

  static getInstance(): MemoryLeakDetector {
    if (!MemoryLeakDetector.instance) {
      MemoryLeakDetector.instance = new MemoryLeakDetector();
    }
    return MemoryLeakDetector.instance;
  }

  startMonitoring(): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.performMemoryCheck();
    }, this.config.checkInterval);

    console.log("🔍 Memory leak detection started");
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    console.log("🔍 Memory leak detection stopped");
  }

  private performMemoryCheck(): void {
    if (typeof window === "undefined" || !("performance" in window)) return;

    const memory = (performance as any).memory;
    if (!memory) return;

    const stats: MemoryStats = {
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      totalJSHeapSize: memory.totalJSHeapSize,
      usedJSHeapSize: memory.usedJSHeapSize,
      heapUsagePercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
    };

    this.memoryHistory.push(stats);
    if (this.memoryHistory.length > 60) { // Keep last 60 readings (30 minutes)
      this.memoryHistory.shift();
    }

    // Check for memory leaks
    if (stats.heapUsagePercent > this.config.alertThreshold * 100) {
      console.warn("⚠️ High memory usage detected:", {
        usedMB: Math.round(stats.usedJSHeapSize / 1024 / 1024),
        limitMB: Math.round(stats.jsHeapSizeLimit / 1024 / 1024),
        usagePercent: Math.round(stats.heapUsagePercent),
        components: this.components.size,
        eventListeners: this.getTotalEventListeners(),
        timers: this.timers.size,
        intervals: this.intervals.size,
        webSockets: this.webSockets.size,
      });

      this.suggestCleanup();
    }

    // Detect growing memory usage
    if (this.memoryHistory.length >= 10) {
      const recent = this.memoryHistory.slice(-10);
      const trend = this.calculateMemoryTrend(recent);
      
      if (trend > 0.1) { // Memory growing by more than 10% over recent samples
        console.warn("📈 Memory leak suspected - increasing usage trend detected");
        this.analyzeLeakSources();
      }
    }
  }

  private calculateMemoryTrend(samples: MemoryStats[]): number {
    if (samples.length < 2) return 0;
    
    const first = samples[0].usedJSHeapSize;
    const last = samples[samples.length - 1].usedJSHeapSize;
    
    return (last - first) / first;
  }

  private analyzeLeakSources(): void {
    const analysis = {
      components: this.components.size,
      eventListeners: this.getTotalEventListeners(),
      timers: this.timers.size,
      intervals: this.intervals.size,
      webSockets: this.webSockets.size,
    };

    console.log("🔍 Memory leak analysis:", analysis);

    // Suggest specific actions
    if (analysis.eventListeners > 50) {
      console.warn("Too many event listeners - check for proper cleanup in useEffect");
    }
    if (analysis.timers > 10) {
      console.warn("Too many active timers - ensure setTimeout cleanup");
    }
    if (analysis.intervals > 5) {
      console.warn("Too many active intervals - ensure setInterval cleanup");
    }
    if (analysis.webSockets > 3) {
      console.warn("Too many WebSocket connections - check for proper disconnection");
    }
  }

  private suggestCleanup(): void {
    // Force garbage collection if available (Chrome DevTools)
    if ((window as any).gc) {
      console.log("🗑️ Forcing garbage collection");
      (window as any).gc();
    }

    // Clear old memory history to free up space
    if (this.memoryHistory.length > 30) {
      this.memoryHistory = this.memoryHistory.slice(-30);
    }
  }

  private getTotalEventListeners(): number {
    return Array.from(this.eventListeners.values())
      .reduce((sum, set) => sum + set.size, 0);
  }

  // Component tracking
  registerComponent(name: string): void {
    this.components.add(name);
  }

  unregisterComponent(name: string): void {
    this.components.delete(name);
  }

  // Event listener tracking
  registerEventListener(component: string, cleanup: () => void): void {
    if (!this.eventListeners.has(component)) {
      this.eventListeners.set(component, new Set());
    }
    this.eventListeners.get(component)!.add(cleanup);
  }

  unregisterEventListener(component: string, cleanup: () => void): void {
    const listeners = this.eventListeners.get(component);
    if (listeners) {
      listeners.delete(cleanup);
      if (listeners.size === 0) {
        this.eventListeners.delete(component);
      }
    }
  }

  cleanupComponent(component: string): void {
    const listeners = this.eventListeners.get(component);
    if (listeners) {
      listeners.forEach(cleanup => cleanup());
      this.eventListeners.delete(component);
    }
    this.components.delete(component);
  }

  // Timer tracking
  registerTimer(timer: NodeJS.Timeout | number): void {
    this.timers.add(timer);
  }

  unregisterTimer(timer: NodeJS.Timeout | number): void {
    this.timers.delete(timer);
  }

  registerInterval(interval: NodeJS.Timeout | number): void {
    this.intervals.add(interval);
  }

  unregisterInterval(interval: NodeJS.Timeout | number): void {
    this.intervals.delete(interval);
  }

  // WebSocket tracking
  registerWebSocket(ws: WebSocket): void {
    this.webSockets.add(ws);
  }

  unregisterWebSocket(ws: WebSocket): void {
    this.webSockets.delete(ws);
  }

  // Get current memory stats
  getMemoryStats(): MemoryStats | null {
    if (typeof window === "undefined" || !("performance" in window)) return null;

    const memory = (performance as any).memory;
    if (!memory) return null;

    return {
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      totalJSHeapSize: memory.totalJSHeapSize,
      usedJSHeapSize: memory.usedJSHeapSize,
      heapUsagePercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
    };
  }

  getMemoryHistory(): MemoryStats[] {
    return [...this.memoryHistory];
  }

  // Configuration
  updateConfig(config: Partial<LeakDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Emergency cleanup
  forceCleanup(): void {
    console.log("🚨 Performing emergency memory cleanup");

    // Clear all tracked resources
    this.timers.forEach(timer => clearTimeout(timer));
    this.intervals.forEach(interval => clearInterval(interval));
    this.webSockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    this.timers.clear();
    this.intervals.clear();
    this.webSockets.clear();
    this.eventListeners.clear();
    this.components.clear();

    // Clear memory history
    this.memoryHistory = [];

    console.log("✅ Emergency cleanup completed");
  }
}

// ============================================================================
// React Hook Memory Optimizations
// ============================================================================

/**
 * Enhanced useEffect that automatically tracks and cleans up resources
 */
export function useMemoryOptimizedEffect(
  effect: () => void | (() => void),
  deps?: React.DependencyList,
  componentName?: string
): void {
  const detector = MemoryLeakDetector.getInstance();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Register component if provided
    if (componentName) {
      detector.registerComponent(componentName);
    }

    // Execute effect
    const cleanup = effect();

    if (cleanup && typeof cleanup === "function") {
      cleanupRef.current = cleanup;
      
      // Register cleanup function
      if (componentName) {
        detector.registerEventListener(componentName, cleanup);
      }
    }

    return () => {
      // Execute cleanup
      if (cleanupRef.current) {
        cleanupRef.current();
        
        // Unregister cleanup
        if (componentName) {
          detector.unregisterEventListener(componentName, cleanupRef.current);
        }
        
        cleanupRef.current = null;
      }

      // Unregister component
      if (componentName) {
        detector.unregisterComponent(componentName);
      }
    };
  }, deps);
}

/**
 * Memory-safe timer hooks
 */
export function useMemoryOptimizedTimeout(
  callback: () => void,
  delay: number | null,
  componentName?: string
): void {
  const detector = MemoryLeakDetector.getInstance();
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update callback ref
  callbackRef.current = callback;

  useEffect(() => {
    if (delay === null) return;

    const timer = setTimeout(() => {
      callbackRef.current();
      if (timeoutRef.current) {
        detector.unregisterTimer(timeoutRef.current);
        timeoutRef.current = null;
      }
    }, delay);

    timeoutRef.current = timer;
    detector.registerTimer(timer);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        detector.unregisterTimer(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [delay, detector]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        detector.unregisterTimer(timeoutRef.current);
      }
      if (componentName) {
        detector.cleanupComponent(componentName);
      }
    };
  }, [detector, componentName]);
}

export function useMemoryOptimizedInterval(
  callback: () => void,
  delay: number | null,
  componentName?: string
): void {
  const detector = MemoryLeakDetector.getInstance();
  const callbackRef = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update callback ref
  callbackRef.current = callback;

  useEffect(() => {
    if (delay === null) return;

    const interval = setInterval(() => {
      callbackRef.current();
    }, delay);

    intervalRef.current = interval;
    detector.registerInterval(interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        detector.unregisterInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [delay, detector]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        detector.unregisterInterval(intervalRef.current);
      }
      if (componentName) {
        detector.cleanupComponent(componentName);
      }
    };
  }, [detector, componentName]);
}

/**
 * Memory-safe WebSocket hook
 */
export function useMemoryOptimizedWebSocket(
  url: string | null,
  options?: {
    onOpen?: (event: Event) => void;
    onMessage?: (event: MessageEvent) => void;
    onError?: (event: Event) => void;
    onClose?: (event: CloseEvent) => void;
    protocols?: string | string[];
    shouldReconnect?: boolean;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
  },
  componentName?: string
): {
  webSocket: WebSocket | null;
  readyState: number;
  send: (data: string | ArrayBufferLike | Blob | ArrayBufferView) => void;
  close: () => void;
} {
  const detector = MemoryLeakDetector.getInstance();
  const webSocketRef = useRef<WebSocket | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED);
  const optionsRef = useRef(options);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update options ref
  optionsRef.current = options;

  const connect = useCallback(() => {
    if (!url || webSocketRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(url, options?.protocols);
      webSocketRef.current = ws;
      detector.registerWebSocket(ws);

      ws.onopen = (event) => {
        setReadyState(WebSocket.OPEN);
        reconnectAttemptsRef.current = 0;
        optionsRef.current?.onOpen?.(event);
      };

      ws.onmessage = (event) => {
        optionsRef.current?.onMessage?.(event);
      };

      ws.onerror = (event) => {
        optionsRef.current?.onError?.(event);
      };

      ws.onclose = (event) => {
        setReadyState(WebSocket.CLOSED);
        detector.unregisterWebSocket(ws);
        optionsRef.current?.onClose?.(event);

        // Auto-reconnect logic
        if (options?.shouldReconnect && 
            reconnectAttemptsRef.current < (options.maxReconnectAttempts || 5)) {
          reconnectAttemptsRef.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, options.reconnectDelay || 3000);
          
          detector.registerTimer(reconnectTimeoutRef.current);
        }
      };

      ws.onopen = ws.onopen;
      setReadyState(ws.readyState);

    } catch (error) {
      console.error("WebSocket connection failed:", error);
      setReadyState(WebSocket.CLOSED);
    }
  }, [url, options?.protocols, options?.shouldReconnect, options?.reconnectDelay, options?.maxReconnectAttempts, detector]);

  const send = useCallback((data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      webSocketRef.current.send(data);
    } else {
      console.warn("WebSocket not connected, message not sent");
    }
  }, []);

  const close = useCallback(() => {
    if (webSocketRef.current) {
      webSocketRef.current.close();
      detector.unregisterWebSocket(webSocketRef.current);
      webSocketRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      detector.unregisterTimer(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, [detector]);

  // Connect on mount or URL change
  useEffect(() => {
    if (url) {
      connect();
    }
    
    return () => {
      close();
    };
  }, [url, connect, close]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      close();
      if (componentName) {
        detector.cleanupComponent(componentName);
      }
    };
  }, [close, componentName, detector]);

  return {
    webSocket: webSocketRef.current,
    readyState,
    send,
    close,
  };
}

/**
 * Memory-safe event listener hook
 */
export function useMemoryOptimizedEventListener<T extends keyof WindowEventMap>(
  eventType: T,
  listener: (event: WindowEventMap[T]) => void,
  target: EventTarget = window,
  options?: boolean | AddEventListenerOptions,
  componentName?: string
): void {
  const detector = MemoryLeakDetector.getInstance();
  const listenerRef = useRef(listener);

  // Update listener ref
  listenerRef.current = listener;

  useEffect(() => {
    const eventListener = (event: Event) => {
      listenerRef.current(event as WindowEventMap[T]);
    };

    target.addEventListener(eventType, eventListener, options);

    // Register with detector
    const cleanup = () => {
      target.removeEventListener(eventType, eventListener, options);
    };

    if (componentName) {
      detector.registerEventListener(componentName, cleanup);
    }

    return cleanup;
  }, [eventType, target, options, detector, componentName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (componentName) {
        detector.cleanupComponent(componentName);
      }
    };
  }, [componentName, detector]);
}

/**
 * Memory-optimized state with automatic cleanup
 */
export function useMemoryOptimizedState<T>(
  initialValue: T,
  componentName?: string
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const detector = MemoryLeakDetector.getInstance();
  const [state, setState] = useState<T>(initialValue);

  useEffect(() => {
    if (componentName) {
      detector.registerComponent(componentName);
    }

    return () => {
      if (componentName) {
        detector.unregisterComponent(componentName);
      }
    };
  }, [componentName, detector]);

  return [state, setState];
}

// ============================================================================
// Global Memory Management
// ============================================================================

export const memoryManager = {
  detector: MemoryLeakDetector.getInstance(),

  startMonitoring() {
    this.detector.startMonitoring();
  },

  stopMonitoring() {
    this.detector.stopMonitoring();
  },

  getStats() {
    return this.detector.getMemoryStats();
  },

  getHistory() {
    return this.detector.getMemoryHistory();
  },

  forceCleanup() {
    this.detector.forceCleanup();
  },

  configureDetection(config: Partial<LeakDetectionConfig>) {
    this.detector.updateConfig(config);
  },

  // Browser performance optimizations
  optimizePerformance() {
    // Force garbage collection if available
    if ((window as any).gc) {
      (window as any).gc();
    }

    // Clear console logs in production
    if (process.env.NODE_ENV === "production") {
      console.clear();
    }

    // Optimize images that are not visible
    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      if (!this.isElementVisible(img)) {
        img.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InRyYW5zcGFyZW50Ii8+PC9zdmc+";
      }
    });

    console.log("⚡ Performance optimization completed");
  },

  private isElementVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;

    return (
      rect.bottom >= 0 &&
      rect.right >= 0 &&
      rect.top <= windowHeight &&
      rect.left <= windowWidth
    );
  },

  // Development helpers
  logMemoryUsage() {
    const stats = this.getStats();
    if (stats) {
      console.log("📊 Memory Usage:", {
        used: `${Math.round(stats.usedJSHeapSize / 1024 / 1024)}MB`,
        total: `${Math.round(stats.totalJSHeapSize / 1024 / 1024)}MB`,
        limit: `${Math.round(stats.jsHeapSizeLimit / 1024 / 1024)}MB`,
        usage: `${Math.round(stats.heapUsagePercent)}%`,
      });
    }
  },

  // Initialize monitoring for development
  initDevelopmentMonitoring() {
    if (process.env.NODE_ENV === "development") {
      this.startMonitoring();
      
      // Log memory usage every minute in development
      setInterval(() => {
        this.logMemoryUsage();
      }, 60000);

      console.log("🔍 Development memory monitoring enabled");
    }
  },
};

// Auto-start monitoring in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  memoryManager.initDevelopmentMonitoring();
}

// ============================================================================
// React Component Memory Wrapper
// ============================================================================

/**
 * HOC for automatic memory management
 */
export function withMemoryOptimization<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  return function MemoryOptimizedComponent(props: P) {
    const detector = MemoryLeakDetector.getInstance();
    const name = componentName || Component.displayName || Component.name || "UnknownComponent";

    useEffect(() => {
      detector.registerComponent(name);
      
      return () => {
        detector.cleanupComponent(name);
      };
    }, [detector, name]);

    return <Component {...props} />;
  };
}