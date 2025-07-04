"use client";

/**
 * Client-Safe Wrapper Component
 *
 * Prevents hydration mismatches by ensuring consistent rendering between
 * server and client. This component addresses the client-side exception
 * "Application error: a client-side exception has occurred"
 */

import { type ReactNode, useEffect, useState } from "react";
import { ErrorBoundary } from "./error-boundary";

interface ClientSafeWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  suppressHydrationWarning?: boolean;
}

/**
 * Wrapper that ensures client-side consistency and prevents hydration mismatches
 */
export function ClientSafeWrapper({
  children,
  fallback,
  suppressHydrationWarning = true,
}: ClientSafeWrapperProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Mark as hydrated after client-side rendering
    setIsHydrated(true);
  }, []);

  // During SSR or before hydration, show fallback
  if (!isHydrated) {
    return (
      <div suppressHydrationWarning={suppressHydrationWarning}>
        {fallback || children}
      </div>
    );
  }

  // After hydration, wrap in error boundary for safety
  return <ErrorBoundary level="component">{children}</ErrorBoundary>;
}

/**
 * Hook to safely check if we're on the client side
 */
export function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}

/**
 * Hook to safely access window object
 */
export function useWindowSafe<T>(
  accessor: (window: Window) => T,
  defaultValue: T
): T {
  const [value, setValue] = useState<T>(defaultValue);
  const isClient = useIsClient();

  useEffect(() => {
    if (isClient && typeof window !== "undefined") {
      try {
        setValue(accessor(window));
      } catch (error) {
        console.warn("Error accessing window:", error);
        setValue(defaultValue);
      }
    }
  }, [isClient, accessor, defaultValue]);

  return value;
}

/**
 * Environment-safe component that handles NODE_ENV differences
 */
export function EnvironmentSafeComponent({
  children,
  developmentOnly = false,
  productionOnly = false,
}: {
  children: ReactNode;
  developmentOnly?: boolean;
  productionOnly?: boolean;
}) {
  const isClient = useIsClient();

  // Wait for hydration to check environment
  if (!isClient) {
    return null;
  }

  const isDevelopment = process.env.NODE_ENV === "development";

  if (developmentOnly && !isDevelopment) {
    return null;
  }

  if (productionOnly && isDevelopment) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Safe localStorage wrapper that handles access errors
 */
export function useLocalStorageSafe(
  key: string,
  defaultValue: string | null = null
): [string | null, (value: string | null) => void] {
  const [value, setValue] = useState<string | null>(defaultValue);
  const isClient = useIsClient();

  useEffect(() => {
    if (isClient) {
      try {
        const stored = localStorage.getItem(key);
        setValue(stored);
      } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error);
        setValue(defaultValue);
      }
    }
  }, [key, isClient, defaultValue]);

  const setStoredValue = (newValue: string | null) => {
    setValue(newValue);

    if (isClient) {
      try {
        if (newValue === null) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, newValue);
        }
      } catch (error) {
        console.warn(`Error writing to localStorage key "${key}":`, error);
      }
    }
  };

  return [value, setStoredValue];
}
