/**
 * Browser-Compatible Event System
 *
 * Universal event emitter that works in both browser and Node.js environments.
 * Replaces Node.js EventEmitter with browser-native EventTarget for client-side compatibility.
 *
 * Features:
 * - Browser-native EventTarget API
 * - Node.js EventEmitter compatible interface
 * - TypeScript type safety
 * - Environment detection and fallback
 * - Performance optimized
 * - Memory leak prevention
 */

// Environment detection
const isBrowser =
  typeof window !== "undefined" && typeof window.document !== "undefined";
const isNode =
  typeof process !== "undefined" && process.versions && process.versions.node;

/**
 * Browser-compatible EventEmitter using EventTarget API
 *
 * This implementation provides a Node.js EventEmitter-like interface
 * while using the browser-native EventTarget underneath for maximum compatibility.
 */
export class BrowserCompatibleEventEmitter extends EventTarget {
  private listenerCount: Map<string, number> = new Map();
  private listenerMap: Map<string, Set<Function>> = new Map();
  private wrappedListenerMap: Map<Function, EventListener> = new Map();
  private maxListeners: number = 10;

  /**
   * Emit an event with optional data
   */
  emit(eventName: string, ...args: any[]): boolean {
    const event = new CustomEvent(eventName, {
      detail: args.length === 1 ? args[0] : args,
    });

    this.dispatchEvent(event);

    // Update listener count for compatibility
    const listeners = this.listenerMap.get(eventName);
    return listeners ? listeners.size > 0 : false;
  }

  /**
   * Add an event listener
   */
  on(eventName: string, listener: (...args: any[]) => void): this {
    const wrappedListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;

      // Handle both single and multiple arguments
      if (Array.isArray(detail)) {
        listener(...detail);
      } else if (detail !== undefined) {
        listener(detail);
      } else {
        listener();
      }
    };

    // Store wrapped listener mapping for proper cleanup
    this.wrappedListenerMap.set(listener, wrappedListener);

    // Store original listener reference for removal
    if (!this.listenerMap.has(eventName)) {
      this.listenerMap.set(eventName, new Set());
    }

    this.listenerMap.get(eventName)?.add(listener);
    this.addEventListener(eventName, wrappedListener);

    // Update listener count
    this.listenerCount.set(
      eventName,
      (this.listenerCount.get(eventName) || 0) + 1
    );

    // Warn about potential memory leaks
    const count = this.listenerCount.get(eventName) || 0;
    if (count > this.maxListeners) {
      console.warn(
        `MaxListenersExceededWarning: Possible EventEmitter memory leak detected. ` +
          `${count} ${eventName} listeners added. Use emitter.setMaxListeners() to increase limit.`
      );
    }

    return this;
  }

  /**
   * Add a one-time event listener
   */
  once(eventName: string, listener: (...args: any[]) => void): this {
    const wrappedListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;

      // Remove from our tracking
      const listeners = this.listenerMap.get(eventName);
      if (listeners) {
        listeners.delete(listener);
        this.listenerCount.set(
          eventName,
          Math.max(0, (this.listenerCount.get(eventName) || 0) - 1)
        );
      }

      // Remove from wrapped listener map
      this.wrappedListenerMap.delete(listener);

      // Call the original listener
      if (Array.isArray(detail)) {
        listener(...detail);
      } else if (detail !== undefined) {
        listener(detail);
      } else {
        listener();
      }
    };

    // Store wrapped listener mapping for cleanup
    this.wrappedListenerMap.set(listener, wrappedListener);

    // Add to our tracking
    if (!this.listenerMap.has(eventName)) {
      this.listenerMap.set(eventName, new Set());
    }
    this.listenerMap.get(eventName)?.add(listener);

    // Use built-in once functionality
    this.addEventListener(eventName, wrappedListener, { once: true });
    this.listenerCount.set(
      eventName,
      (this.listenerCount.get(eventName) || 0) + 1
    );

    return this;
  }

  /**
   * Remove an event listener
   */
  off(eventName: string, listener: (...args: any[]) => void): this {
    const listeners = this.listenerMap.get(eventName);
    if (listeners?.has(listener)) {
      listeners.delete(listener);
      this.listenerCount.set(
        eventName,
        Math.max(0, (this.listenerCount.get(eventName) || 0) - 1)
      );

      // Remove the wrapped listener from EventTarget using our mapping
      const wrappedListener = this.wrappedListenerMap.get(listener);
      if (wrappedListener) {
        this.removeEventListener(eventName, wrappedListener);
        this.wrappedListenerMap.delete(listener);
      }
    }

    return this;
  }

  /**
   * Remove a listener (alias for off)
   */
  removeListener(eventName: string, listener: (...args: any[]) => void): this {
    return this.off(eventName, listener);
  }

  /**
   * Remove all listeners for an event, or all events if no event specified
   */
  removeAllListeners(eventName?: string): this {
    if (eventName) {
      // Remove specific event listeners
      const listeners = this.listenerMap.get(eventName);
      if (listeners) {
        for (const listener of listeners) {
          const wrappedListener = this.wrappedListenerMap.get(listener);
          if (wrappedListener) {
            this.removeEventListener(eventName, wrappedListener);
            this.wrappedListenerMap.delete(listener);
          }
        }
      }
      this.listenerMap.delete(eventName);
      this.listenerCount.set(eventName, 0);
    } else {
      // Remove all listeners
      for (const [event, listeners] of this.listenerMap) {
        for (const listener of listeners) {
          const wrappedListener = this.wrappedListenerMap.get(listener);
          if (wrappedListener) {
            this.removeEventListener(event, wrappedListener);
            this.wrappedListenerMap.delete(listener);
          }
        }
      }
      this.listenerMap.clear();
      this.listenerCount.clear();
      this.wrappedListenerMap.clear();
    }

    return this;
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(eventName: string): number {
    return this.listenerCount.get(eventName) || 0;
  }

  /**
   * Get all event names that have listeners
   */
  eventNames(): string[] {
    return Array.from(this.listenerMap.keys());
  }

  /**
   * Get listeners for an event
   */
  listeners(eventName: string): Function[] {
    const listeners = this.listenerMap.get(eventName);
    return listeners ? Array.from(listeners) : [];
  }

  /**
   * Set the maximum number of listeners before warning
   */
  setMaxListeners(n: number): this {
    this.maxListeners = n;
    return this;
  }

  /**
   * Get the maximum number of listeners
   */
  getMaxListeners(): number {
    return this.maxListeners;
  }

  /**
   * Add listener to the beginning of the listeners array
   */
  prependListener(eventName: string, listener: (...args: any[]) => void): this {
    // EventTarget doesn't support prepending, so we use regular on()
    return this.on(eventName, listener);
  }

  /**
   * Add one-time listener to the beginning of the listeners array
   */
  prependOnceListener(
    eventName: string,
    listener: (...args: any[]) => void
  ): this {
    // EventTarget doesn't support prepending, so we use regular once()
    return this.once(eventName, listener);
  }
}

/**
 * Create a new browser-compatible event emitter
 */
export function createEventEmitter(): BrowserCompatibleEventEmitter {
  return new BrowserCompatibleEventEmitter();
}

/**
 * Environment-aware EventEmitter factory
 *
 * Returns the appropriate EventEmitter based on the environment:
 * - Browser: BrowserCompatibleEventEmitter (EventTarget-based)
 * - Node.js: BrowserCompatibleEventEmitter (for consistency)
 */
export function createCompatibleEventEmitter(): BrowserCompatibleEventEmitter {
  return new BrowserCompatibleEventEmitter();
}

/**
 * Type-safe EventEmitter for typed events
 */
export interface TypedEventEmitter<TEvents extends Record<string, any[]>> {
  emit<K extends keyof TEvents>(eventName: K, ...args: TEvents[K]): boolean;
  on<K extends keyof TEvents>(
    eventName: K,
    listener: (...args: TEvents[K]) => void
  ): this;
  once<K extends keyof TEvents>(
    eventName: K,
    listener: (...args: TEvents[K]) => void
  ): this;
  off<K extends keyof TEvents>(
    eventName: K,
    listener: (...args: TEvents[K]) => void
  ): this;
  removeListener<K extends keyof TEvents>(
    eventName: K,
    listener: (...args: TEvents[K]) => void
  ): this;
  removeAllListeners<K extends keyof TEvents>(eventName?: K): this;
  listenerCount<K extends keyof TEvents>(eventName: K): number;
  listeners<K extends keyof TEvents>(eventName: K): Function[];
}

/**
 * Create a typed EventEmitter
 */
export function createTypedEventEmitter<
  TEvents extends Record<string, any[]>,
>(): BrowserCompatibleEventEmitter & TypedEventEmitter<TEvents> {
  return new BrowserCompatibleEventEmitter() as BrowserCompatibleEventEmitter &
    TypedEventEmitter<TEvents>;
}

/**
 * Utility to check if the current environment is browser
 */
export function isBrowserEnvironment(): boolean {
  return isBrowser;
}

/**
 * Utility to check if the current environment is Node.js
 */
export function isNodeEnvironment(): boolean {
  return isNode;
}

/**
 * Universal WebSocket Implementation
 *
 * Provides a consistent WebSocket interface across browser and Node.js environments
 */
export function getUniversalWebSocket() {
  if (typeof window !== "undefined" && window.WebSocket) {
    // Browser environment
    return window.WebSocket;
  } else {
    // Node.js environment - fallback for browser compatibility
    throw new Error(
      'WebSocket implementation not available in this environment. Use in browser environment or install "ws" package for Node.js.'
    );
  }
}

// Backwards compatibility alias
export const UniversalWebSocket = getUniversalWebSocket;

/**
 * Universal crypto implementation for browser compatibility
 */
export function getUniversalCrypto() {
  if (typeof window !== "undefined" && window.crypto) {
    // Browser environment - use Web Crypto API
    return {
      randomUUID: () => window.crypto.randomUUID(),
      getRandomValues: (array: Uint8Array) =>
        window.crypto.getRandomValues(array),
      createHash: (_algorithm: string) => ({
        update: (data: string) => {
          // For browser compatibility, use a simple hash fallback
          // Note: This is not cryptographically secure - use only for non-security purposes
          let hash = 0;
          if (data.length === 0) return hash.toString();
          for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
          }
          return {
            digest: (_encoding?: string) => Math.abs(hash).toString(16),
          };
        },
      }),
    };
  } else {
    // Node.js environment - use fallback for browser compatibility
    return {
      randomUUID: () =>
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        }),
      getRandomValues: (array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      },
      createHash: (_algorithm: string) => ({
        update: (data: string) => ({
          digest: (_encoding?: string) => {
            // Simple hash for browser compatibility
            let hash = 0;
            if (data.length === 0) return hash.toString();
            for (let i = 0; i < data.length; i++) {
              const char = data.charCodeAt(i);
              hash = (hash << 5) - hash + char;
              hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash).toString(16);
          },
        }),
      }),
    };
  }
}

// Backwards compatibility alias
export const UniversalCrypto = getUniversalCrypto;

/**
 * Default export for convenience
 */
export default BrowserCompatibleEventEmitter;
