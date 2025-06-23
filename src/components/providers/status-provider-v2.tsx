"use client";

import type React from "react";
import { StatusProvider as StatusProviderV2 } from "../../contexts/status-context-v2";

/**
 * React Query-based Status Provider Wrapper
 *
 * This component provides a migration-friendly wrapper for the new React Query-based
 * StatusContext while maintaining backward compatibility with existing components.
 */

interface StatusProviderWrapperProps {
  children: React.ReactNode;
  // Migration options
  enableReactQuery?: boolean;
  autoRefreshInterval?: number;
  enableRealTimeUpdates?: boolean;
  // Development options
  enableDevTools?: boolean;
  logStatusUpdates?: boolean;
}

export function StatusProviderWrapper({
  children,
  enableReactQuery = true,
  autoRefreshInterval = 30000,
  enableRealTimeUpdates = true,
  enableDevTools = false,
  logStatusUpdates = false,
}: StatusProviderWrapperProps) {
  // Environment-based configuration
  const isProduction = process.env.NODE_ENV === "production";
  const shouldEnableDevTools = !isProduction && enableDevTools;
  const shouldLogUpdates = !isProduction && logStatusUpdates;

  // For now, always use React Query version
  // In the future, this could be controlled by feature flags or environment variables
  if (enableReactQuery) {
    return (
      <StatusProviderV2
        autoRefreshInterval={autoRefreshInterval}
        enableRealTimeUpdates={enableRealTimeUpdates}
      >
        {shouldEnableDevTools && <StatusDevTools />}
        {shouldLogUpdates && <StatusLogger />}
        {children}
      </StatusProviderV2>
    );
  }

  // Fallback to legacy provider (if needed)
  // This would import and use the original StatusProvider
  // For now, we always use the React Query version
  return (
    <StatusProviderV2
      autoRefreshInterval={autoRefreshInterval}
      enableRealTimeUpdates={enableRealTimeUpdates}
    >
      {children}
    </StatusProviderV2>
  );
}

/**
 * Development Tools Component
 * Shows status information in development mode
 */
function StatusDevTools() {
  // This could be expanded to show React Query DevTools
  // or custom status debugging information
  return null;
}

/**
 * Status Logger Component
 * Logs status changes in development mode
 */
function StatusLogger() {
  // This could be expanded to log status changes to console
  // or send to analytics in development
  return null;
}

export default StatusProviderWrapper;
