/**
 * Consolidated Enhanced Credential Status Component
 *
 * This component consolidates the functionality from:
 * - enhanced-credential-status.tsx (comprehensive status display)
 * - enhanced-credential-status-v2.tsx (clean implementation)
 *
 * Features:
 * - Uses unified status components for consistency
 * - Comprehensive status information
 * - Clean, modern implementation
 * - Proper error handling and loading states
 * - Action suggestions and troubleshooting
 */

import { useState } from "react";
import { useStatus } from "../contexts/status-context";
import { createLogger } from "../lib/structured-logger";
import {
  CredentialStatusIndicator,
  NetworkStatusIndicator,
  StatusTooltip,
  TradingStatusIndicator,
  UnifiedStatusBadge,
} from "./status/unified-status-display";

interface ConsolidatedCredentialStatusProps {
  variant?: "compact" | "detailed" | "card";
  showActions?: boolean;
  showTimestamp?: boolean;
  onCredentialConfigure?: () => void;
  className?: string;
}

const logger = createLogger("enhanced-credential-status-consolidated");

export function ConsolidatedCredentialStatus({
  variant = "detailed",
  showActions = true,
  showTimestamp = true,
  onCredentialConfigure,
  className = "",
}: ConsolidatedCredentialStatusProps) {
  const { status, refreshAll, clearErrors } = useStatus();

  // Safe access to status properties with defaults
  const networkStatus = status?.network || {
    connected: false,
    lastChecked: new Date().toISOString(),
  };
  const credentialStatus = status?.credentials || {
    hasCredentials: false,
    isValid: false,
    source: "none",
    hasUserCredentials: false,
    hasEnvironmentCredentials: false,
    lastValidated: new Date().toISOString(),
  };
  const tradingStatus = status?.trading || {
    canTrade: false,
    balanceLoaded: false,
    lastUpdate: new Date().toISOString(),
  };
  const isLoading = status?.isLoading ?? false;
  const lastUpdated = status?.lastGlobalUpdate || new Date().toISOString();
  const syncError =
    status?.syncErrors?.length > 0 ? status.syncErrors[status.syncErrors.length - 1] : null;
  const clearSyncError = clearErrors;
  const refreshStatus = refreshAll;

  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Determine overall status based on components
  const getOverallStatus = () => {
    if (isLoading) return "loading";
    if (syncError) return "error";
    if (!networkStatus.connected) return "error";
    if (!credentialStatus.hasCredentials) return "warning";
    if (!credentialStatus.isValid) return "error";
    if (!tradingStatus.canTrade) return "warning";
    return "success";
  };

  const overallStatus = getOverallStatus();

  // Generate action suggestions based on status
  const getActionSuggestions = () => {
    const suggestions: string[] = [];

    if (!networkStatus.connected) {
      suggestions.push("Check network connection");
      suggestions.push("Verify API endpoint accessibility");
    }

    if (!credentialStatus.hasCredentials) {
      suggestions.push("Configure MEXC API credentials");
      suggestions.push("Set MEXC_API_KEY and MEXC_SECRET_KEY environment variables");
    } else if (!credentialStatus.isValid) {
      suggestions.push("Verify API credentials are correct");
      suggestions.push("Check if server IP is allowlisted in MEXC settings");
      suggestions.push("Ensure credentials have required permissions");
    }

    if (credentialStatus?.isTestCredentials) {
      suggestions.push("Configure real MEXC API credentials for live trading");
    }

    if (!tradingStatus.canTrade && credentialStatus.isValid) {
      suggestions.push("Check account permissions and balances");
      suggestions.push("Verify trading is enabled for your account");
    }

    return suggestions;
  };

  const actionSuggestions = getActionSuggestions();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshStatus();
    } catch (error) {
      logger.error("Failed to refresh status:", { error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCredentialConfigure = () => {
    if (onCredentialConfigure) {
      onCredentialConfigure();
    } else {
      // Default behavior - scroll to credential configuration
      const configElement = document.getElementById("credential-configuration");
      if (configElement) {
        configElement.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  // Compact variant
  if (variant === "compact") {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <StatusTooltip
          title="System Status"
          details={`Network: ${networkStatus.connected ? "Connected" : "Disconnected"}, Credentials: ${credentialStatus.isValid ? "Valid" : "Invalid"}`}
        >
          <UnifiedStatusBadge size="sm" />
        </StatusTooltip>
        <NetworkStatusIndicator size="sm" />
        <CredentialStatusIndicator size="sm" />
        <TradingStatusIndicator size="sm" />
      </div>
    );
  }

  // Card variant
  if (variant === "card") {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Status</h3>
          <div className="flex items-center space-x-2">
            <UnifiedStatusBadge />
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
              title="Refresh status"
            >
              <svg
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <NetworkStatusIndicator />
          <CredentialStatusIndicator />
          <TradingStatusIndicator />

          {showTimestamp && lastUpdated && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </p>
          )}

          {syncError && (
            <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 text-red-500 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm text-red-700 dark:text-red-300">{syncError}</span>
              </div>
              <button
                type="button"
                onClick={clearSyncError}
                className="text-red-500 hover:text-red-700"
                title="Clear error"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          {showActions && actionSuggestions.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <svg
                  className={`w-4 h-4 mr-1 transform transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                {isExpanded ? "Hide" : "Show"} suggested actions ({actionSuggestions.length})
              </button>

              {isExpanded && (
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <ul className="space-y-1">
                    {actionSuggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start">
                        <svg
                          className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 10V3L4 14h7v7l9-11h-7z"
                          />
                        </svg>
                        <span className="text-sm text-blue-700 dark:text-blue-300">
                          {suggestion}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {!credentialStatus.hasCredentials && (
                    <button
                      type="button"
                      onClick={handleCredentialConfigure}
                      className="mt-3 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      Configure Credentials
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Detailed variant (default)
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UnifiedStatusBadge status={overallStatus} />
          <span className="text-lg font-semibold text-gray-900 dark:text-white">System Status</span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="flex items-center px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh status"
        >
          <svg
            className={`w-4 h-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <NetworkStatusIndicator status={networkStatus} />
        <CredentialStatusIndicator status={credentialStatus} />
        <TradingStatusIndicator status={tradingStatus} />
      </div>

      {showTimestamp && lastUpdated && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Last updated: {new Date(lastUpdated).toLocaleString()}
        </p>
      )}

      {syncError && (
        <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-red-500 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-red-700 dark:text-red-300">{syncError}</span>
          </div>
          <button
            onClick={clearSyncError}
            className="text-red-500 hover:text-red-700 p-1"
            title="Clear error"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {showActions && actionSuggestions.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-blue-900 dark:text-blue-100">Suggested Actions</h4>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          </div>

          {isExpanded && (
            <div className="space-y-2">
              {actionSuggestions.map((suggestion, index) => (
                <div key={index} className="flex items-start">
                  <svg
                    className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span className="text-sm text-blue-800 dark:text-blue-200">{suggestion}</span>
                </div>
              ))}

              {!credentialStatus.hasCredentials && (
                <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-700">
                  <button
                    onClick={handleCredentialConfigure}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Configure MEXC Credentials
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ConsolidatedCredentialStatus;
