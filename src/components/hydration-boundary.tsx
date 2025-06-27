"use client";

import { Suspense, useEffect, useState } from "react";
import { SSRSafeErrorBoundary } from "./error-boundary";

interface HydrationBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  preserveSSR?: boolean;
  errorFallback?: React.ReactNode;
}

/**
 * Prevents hydration mismatches by only rendering children after hydration
 * Enhanced with error boundaries and SSR preservation options
 */
export function HydrationBoundary({ 
  children, 
  fallback, 
  preserveSSR = false,
  errorFallback 
}: HydrationBoundaryProps) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  // For SSR preservation, render children immediately but wrap in error boundary
  if (preserveSSR && !hasMounted) {
    return (
      <SSRSafeErrorBoundary fallback={errorFallback}>
        <Suspense fallback={fallback || <div>Loading...</div>}>
          {children}
        </Suspense>
      </SSRSafeErrorBoundary>
    );
  }

  if (!isHydrated) {
    return <>{fallback || <div style={{ visibility: 'hidden' }}>{children}</div>}</>;
  }

  return (
    <SSRSafeErrorBoundary fallback={errorFallback}>
      {children}
    </SSRSafeErrorBoundary>
  );
}

/**
 * Hook to check if component has hydrated
 * Enhanced with mount detection
 */
export function useHydration() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    setIsHydrated(true);
  }, []);

  return { isHydrated, hasMounted };
}

/**
 * Component that only renders on client-side
 */
export function ClientOnly({ 
  children, 
  fallback 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode; 
}) {
  const { hasMounted } = useHydration();

  if (!hasMounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook for safe localStorage access
 */
export function useSafeLocalStorage(key: string, defaultValue: string = "") {
  const [value, setValue] = useState(defaultValue);
  const { hasMounted } = useHydration();

  useEffect(() => {
    if (!hasMounted) return;

    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setValue(stored);
      }
    } catch (error) {
      console.warn(`Failed to read localStorage key "${key}":`, error);
    }
  }, [key, hasMounted]);

  const setSafeValue = (newValue: string) => {
    setValue(newValue);
    if (hasMounted) {
      try {
        localStorage.setItem(key, newValue);
      } catch (error) {
        console.warn(`Failed to write localStorage key "${key}":`, error);
      }
    }
  };

  return [value, setSafeValue] as const;
}

/**
 * Hook for safe window access
 */
export function useSafeWindow() {
  const { hasMounted } = useHydration();
  
  return hasMounted && typeof window !== "undefined" ? window : null;
}
