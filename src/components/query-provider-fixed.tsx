"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { queryClient } from "../lib/query-client";
import { EnvironmentSafeComponent } from "./client-safe-wrapper";
import { ErrorBoundary } from "./error-boundary";

// Lazy load DevTools with better error handling
const ReactQueryDevtools = lazy(() =>
  import("@tanstack/react-query-devtools")
    .then((module) => ({
      default: module.ReactQueryDevtools,
    }))
    .catch((error) => {
      console.warn("Failed to load React Query DevTools:", error);
      // Return a fallback component that renders nothing
      return { default: () => null };
    })
);

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <ErrorBoundary level="component">
      <QueryClientProvider client={queryClient}>
        {children}
        
        {/* Safely render DevTools only in development */}
        <EnvironmentSafeComponent developmentOnly>
          <Suspense fallback={null}>
            <ErrorBoundary level="component" fallback={null}>
              <ReactQueryDevtools initialIsOpen={false} />
            </ErrorBoundary>
          </Suspense>
        </EnvironmentSafeComponent>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}