"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { StatusProvider } from "../../contexts/status-context-v2";

/**
 * Status Provider Wrapper - Updated to use React Query-based StatusProvider
 *
 * This component wraps the application with the React Query-based StatusProvider (v2)
 * to ensure all components have access to synchronized status information with better
 * caching, error handling, and automatic refresh capabilities.
 *
 * FIXED: Migrated from reducer-based v1 to React Query-based v2 for better performance
 * and status synchronization.
 */

interface StatusProviderWrapperProps {
  children: React.ReactNode;
  autoRefreshInterval?: number;
  enableRealTimeUpdates?: boolean;
}

export function StatusProviderWrapper({
  children,
  autoRefreshInterval = 30000, // 30 seconds
  enableRealTimeUpdates = true,
}: StatusProviderWrapperProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Prevent hydration mismatches by only enabling after client-side hydration
    setIsHydrated(true);
  }, []);

  // Render the same content during SSR and hydration to prevent mismatches
  return (
    <StatusProvider
      autoRefreshInterval={isHydrated ? autoRefreshInterval : 0}
      enableRealTimeUpdates={isHydrated && enableRealTimeUpdates}
    >
      {children}
    </StatusProvider>
  );
}

export default StatusProviderWrapper;
