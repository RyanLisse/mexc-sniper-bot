"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CredentialStatus, NetworkStatus, TradingStatus } from "../contexts/status-context-v2";
import { queryKeys } from "../lib/query-client";
import {
  CredentialStatusIndicator,
  NetworkStatusIndicator,
  StatusTooltip,
  TradingStatusIndicator,
  UnifiedStatusBadge,
} from "./status/unified-status-display";

/**
 * React Query-based Enhanced Credential Status Component
 *
 * This component uses React Query for data fetching instead of the StatusContext,
 * providing better caching, error handling, and optimistic updates.
 */

interface UnifiedStatusResponse {
  connected: boolean;
  hasCredentials: boolean;
  credentialsValid: boolean;
  canTrade: boolean;
  credentialSource: "database" | "environment" | "none";
  hasUserCredentials: boolean;
  hasEnvironmentCredentials: boolean;
  isTestCredentials?: boolean;
  connectionHealth?: "excellent" | "good" | "fair" | "poor";
  responseTime?: number;
  overallStatus: "healthy" | "warning" | "error" | "loading";
  statusMessage: string;
  lastChecked: string;
  source: "enhanced" | "legacy" | "fallback";
  error?: string;
  recommendations: string[];
  nextSteps: string[];
}

interface EnhancedCredentialStatusProps {
  variant?: "compact" | "detailed" | "card";
  showActions?: boolean;
  showTimestamp?: boolean;
  onCredentialConfigure?: () => void;
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function EnhancedCredentialStatusV4({
  variant = "detailed",
  showActions = true,
  showTimestamp = true,
  onCredentialConfigure,
  className = "",
  autoRefresh = true,
  refreshInterval = 30000,
}: EnhancedCredentialStatusProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

  // Unified status query
  const {
    data: unifiedData,
    error: unifiedError,
    isLoading,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: queryKeys.status.unified(),
    queryFn: async (): Promise<UnifiedStatusResponse> => {
      const response = await fetch("/api/mexc/unified-status");
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch unified status");
      }

      return result.data;
    },
    staleTime: 15000, // 15 seconds
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: false,
    retry: (failureCount, error) => {
      if (error.message.includes("fetch")) {
        return failureCount < 2;
      }
      return failureCount < 1;
    },
  });

  // Force refresh mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/mexc/unified-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh: true }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to refresh status");
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.status.unified() });
    },
  });

  // Transform unified data to individual status objects
  const networkStatus: NetworkStatus = {
    connected: unifiedData?.connected ?? false,
    lastChecked: unifiedData?.lastChecked ?? new Date().toISOString(),
    error: unifiedData?.connected ? undefined : unifiedData?.error,
  };

  const credentialStatus: CredentialStatus = {
    hasCredentials: unifiedData?.hasCredentials ?? false,
    isValid: unifiedData?.credentialsValid ?? false,
    source: unifiedData?.credentialSource ?? "none",
    hasUserCredentials: unifiedData?.hasUserCredentials ?? false,
    hasEnvironmentCredentials: unifiedData?.hasEnvironmentCredentials ?? false,
    lastValidated: unifiedData?.lastChecked ?? new Date().toISOString(),
    error: unifiedData?.credentialsValid ? undefined : unifiedData?.error,
    isTestCredentials: unifiedData?.isTestCredentials,
    connectionHealth: unifiedData?.connectionHealth,
  };

  const tradingStatus: TradingStatus = {
    canTrade: unifiedData?.canTrade ?? false,
    balanceLoaded: unifiedData?.credentialsValid && unifiedData?.connected,
    lastUpdate: unifiedData?.lastChecked ?? new Date().toISOString(),
    error: unifiedData?.canTrade ? undefined : "Trading not available",
  };

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const syncError = unifiedError?.message;
  const isRefreshing = refreshMutation.isPending;

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
    if (unifiedData?.recommendations) {
      return unifiedData.recommendations;
    }

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

  const handleRefresh = () => {
    refreshMutation.mutate();
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

  const handleClearError = () => {
    queryClient.removeQueries({
      queryKey: queryKeys.status.unified(),
      type: "all",
    });
  };

  // Compact variant
  if (variant === "compact") {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <StatusTooltip
          status={overallStatus}
          title="System Status"
          details={`Network: ${networkStatus.connected ? "Connected" : "Disconnected"}, Credentials: ${credentialStatus.isValid ? "Valid" : "Invalid"}`}
        >
          <UnifiedStatusBadge status={overallStatus} size="sm" />
        </StatusTooltip>
        <NetworkStatusIndicator status={networkStatus} size="sm" />
        <CredentialStatusIndicator status={credentialStatus} size="sm" />
        <TradingStatusIndicator status={tradingStatus} size="sm" />
        {isFetching && <div className="text-xs text-muted-foreground animate-pulse">•</div>}
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
            <UnifiedStatusBadge status={overallStatus} />
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
              title="Refresh status"
            >
              <svg
                className={`w-4 h-4 ${isRefreshing || isFetching ? "animate-spin" : ""}`}
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
          <NetworkStatusIndicator status={networkStatus} />
          <CredentialStatusIndicator status={credentialStatus} />
          <TradingStatusIndicator status={tradingStatus} />

          {showTimestamp && lastUpdated && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
              {isFetching && <span className="ml-2 animate-pulse">Updating...</span>}
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
                onClick={handleClearError}
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
          {isFetching && (
            <span className="text-sm text-muted-foreground animate-pulse">Updating...</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="flex items-center px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh status"
        >
          <svg
            className={`w-4 h-4 mr-1 ${isRefreshing || isFetching ? "animate-spin" : ""}`}
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
          Last updated: {lastUpdated.toLocaleString()}
          {isFetching && <span className="ml-2 animate-pulse">• Updating</span>}
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
            type="button"
            onClick={handleClearError}
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
              type="button"
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
                    type="button"
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

export default EnhancedCredentialStatusV4;
