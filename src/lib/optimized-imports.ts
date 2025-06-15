/**
 * Optimized Import Utilities
 * Tree-shakeable imports and utilities to reduce bundle size
 * Part of Task 5.1: Bundle Size Optimization
 */

// Date-fns optimized imports - Import only what we need
export { format } from 'date-fns/format';
export { parseISO } from 'date-fns/parseISO';
export { addDays } from 'date-fns/addDays';
export { subDays } from 'date-fns/subDays';
export { isToday } from 'date-fns/isToday';
export { isSameDay } from 'date-fns/isSameDay';
export { startOfDay } from 'date-fns/startOfDay';
export { endOfDay } from 'date-fns/endOfDay';
export { differenceInMinutes } from 'date-fns/differenceInMinutes';
export { differenceInHours } from 'date-fns/differenceInHours';
export { addMinutes } from 'date-fns/addMinutes';
export { addHours } from 'date-fns/addHours';

// Utility function combinations for common date operations
export const formatDateTime = (date: Date | string) => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'yyyy-MM-dd HH:mm:ss');
};

export const formatDateOnly = (date: Date | string) => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'yyyy-MM-dd');
};

export const formatTimeOnly = (date: Date | string) => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, 'HH:mm:ss');
};

// Class utility functions - Optimized imports
export { clsx } from 'clsx';
export { cva, type VariantProps } from 'class-variance-authority';
export { twMerge } from 'tailwind-merge';

// Combined utility for className management
export const cn = (...inputs: Parameters<typeof clsx>) => {
  return twMerge(clsx(inputs));
};

// Zod optimized imports - Only import specific validators
export { z } from 'zod';

// Common validation schemas for reuse
export const createOptimizedSchema = {
  email: () => z.string().email(),
  password: () => z.string().min(8),
  url: () => z.string().url(),
  uuid: () => z.string().uuid(),
  number: (min?: number, max?: number) => {
    let schema = z.number();
    if (min !== undefined) schema = schema.min(min);
    if (max !== undefined) schema = schema.max(max);
    return schema;
  },
  enum: <T extends readonly [string, ...string[]]>(values: T) => z.enum(values),
  array: <T>(itemSchema: z.ZodType<T>) => z.array(itemSchema),
};

// React Query optimized imports and configurations
export {
  useQuery,
  useMutation,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

// Optimized query client configuration
export const createOptimizedQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        retry: (failureCount, error) => {
          // Smart retry logic
          if (failureCount >= 3) return false;
          if (error instanceof Error && error.message.includes('401')) return false;
          return true;
        },
        refetchOnWindowFocus: false,
        refetchOnMount: true,
      },
      mutations: {
        retry: 1,
      },
    },
  });
};

// Common query keys factory for consistency
export const queryKeys = {
  // Agent-related queries
  agents: {
    all: ['agents'] as const,
    health: () => [...queryKeys.agents.all, 'health'] as const,
    status: (agentId: string) => [...queryKeys.agents.all, 'status', agentId] as const,
    performance: () => [...queryKeys.agents.all, 'performance'] as const,
  },
  
  // MEXC API queries
  mexc: {
    all: ['mexc'] as const,
    account: () => [...queryKeys.mexc.all, 'account'] as const,
    balance: () => [...queryKeys.mexc.all, 'balance'] as const,
    symbols: () => [...queryKeys.mexc.all, 'symbols'] as const,
    calendar: () => [...queryKeys.mexc.all, 'calendar'] as const,
  },
  
  // Trading queries
  trading: {
    all: ['trading'] as const,
    targets: () => [...queryKeys.trading.all, 'targets'] as const,
    history: () => [...queryKeys.trading.all, 'history'] as const,
    portfolio: () => [...queryKeys.trading.all, 'portfolio'] as const,
  },
  
  // Pattern discovery queries
  patterns: {
    all: ['patterns'] as const,
    ready: () => [...queryKeys.patterns.all, 'ready'] as const,
    analysis: (symbol: string) => [...queryKeys.patterns.all, 'analysis', symbol] as const,
  },
  
  // Bundle analysis queries
  bundle: {
    all: ['bundle'] as const,
    analysis: () => [...queryKeys.bundle.all, 'analysis'] as const,
    optimization: () => [...queryKeys.bundle.all, 'optimization'] as const,
  },
};

// React optimized imports
export {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useId,
  useReducer,
  useContext,
  createContext,
  forwardRef,
  memo,
  lazy,
  Suspense,
  type ReactNode,
  type ComponentProps,
  type ElementRef,
} from 'react';

// Common custom hooks factory
export const createOptimizedHooks = () => {
  const useLocalStorage = <T>(key: string, initialValue: T) => {
    const [storedValue, setStoredValue] = useState<T>(() => {
      try {
        if (typeof window !== 'undefined') {
          const item = window.localStorage.getItem(key);
          return item ? JSON.parse(item) : initialValue;
        }
        return initialValue;
      } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error);
        return initialValue;
      }
    });

    const setValue = useCallback((value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    }, [key, storedValue]);

    return [storedValue, setValue] as const;
  };

  const useDebounce = <T>(value: T, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);

      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);

    return debouncedValue;
  };

  const useToggle = (initialValue = false) => {
    const [value, setValue] = useState(initialValue);
    
    const toggle = useCallback(() => setValue(v => !v), []);
    const setTrue = useCallback(() => setValue(true), []);
    const setFalse = useCallback(() => setValue(false), []);

    return [value, { toggle, setTrue, setFalse }] as const;
  };

  return {
    useLocalStorage,
    useDebounce,
    useToggle,
  };
};

// Export optimized hooks
export const { useLocalStorage, useDebounce, useToggle } = createOptimizedHooks();

// Performance monitoring utilities
export const createPerformanceMonitor = () => {
  const measureComponentRender = (componentName: string) => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const startTime = performance.now();
      
      return () => {
        const endTime = performance.now();
        const renderTime = endTime - startTime;
        
        if (renderTime > 16) { // Longer than 1 frame at 60fps
          console.warn(`[Performance] ${componentName} render took ${renderTime.toFixed(2)}ms`);
        }
        
        return renderTime;
      };
    }
    
    return () => 0;
  };

  const measureAsyncOperation = async <T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`[Performance] ${operationName} completed in ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.error(`[Performance] ${operationName} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  };

  return {
    measureComponentRender,
    measureAsyncOperation,
  };
};

// Export performance monitor
export const { measureComponentRender, measureAsyncOperation } = createPerformanceMonitor();

// Bundle size tracking utilities
export const bundleTracker = {
  logChunkLoad: (chunkName: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Bundle] Loaded chunk: ${chunkName}`);
    }
  },
  
  measureChunkSize: (chunkName: string, sizeBytes: number) => {
    if (process.env.NODE_ENV === 'development') {
      const sizeKB = (sizeBytes / 1024).toFixed(2);
      console.log(`[Bundle] Chunk ${chunkName}: ${sizeKB}KB`);
    }
  },
  
  trackComponentLoad: (componentName: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Bundle] Lazy loaded component: ${componentName}`);
    }
  },
};

// Type-safe environment variable access
export const getOptimizedEnv = () => {
  return {
    isDev: process.env.NODE_ENV === 'development',
    isProd: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
    isServer: typeof window === 'undefined',
    isClient: typeof window !== 'undefined',
    enableBundleAnalysis: process.env.ANALYZE === 'true',
    enablePerformanceTracking: process.env.TRACK_PERFORMANCE === 'true',
  };
};

export const env = getOptimizedEnv();