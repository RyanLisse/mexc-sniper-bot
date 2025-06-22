"use client";

import React from "react";
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
  enableRealTimeUpdates = true 
}: StatusProviderWrapperProps) {
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