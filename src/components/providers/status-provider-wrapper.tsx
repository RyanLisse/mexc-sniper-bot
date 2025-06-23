"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { StatusProvider } from "../../contexts/status-context";

/**
 * Status Provider Wrapper
 *
 * This component wraps the application with the centralized StatusProvider
 * to ensure all components have access to synchronized status information.
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
