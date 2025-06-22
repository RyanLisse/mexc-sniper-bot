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

  // Show a minimal loading state during hydration
  if (!isHydrated) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <StatusProvider
      autoRefreshInterval={autoRefreshInterval}
      enableRealTimeUpdates={enableRealTimeUpdates}
    >
      {children}
    </StatusProvider>
  );
}

export default StatusProviderWrapper;
