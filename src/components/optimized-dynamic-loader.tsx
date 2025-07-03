"use client";

import { Suspense, type ReactNode } from "react";

interface OptimizedDynamicLoaderProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function OptimizedDynamicLoader({ 
  children, 
  fallback = <div>Loading...</div> 
}: OptimizedDynamicLoaderProps) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}