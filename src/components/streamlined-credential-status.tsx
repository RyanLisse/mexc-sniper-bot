"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  Globe,
  Info,
  Key,
  RefreshCw,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { queryKeys } from "../lib/query-client";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

// Zod schema for API response validation
const UnifiedStatusSchema = z.object({
  connected: z.boolean(),
  hasCredentials: z.boolean(),
  credentialsValid: z.boolean(),
  canTrade: z.boolean(),
  credentialSource: z.enum(["database", "environment", "none"]),
  connectionHealth: z.enum(["excellent", "good", "fair", "poor"]).optional(),
  responseTime: z.number().optional(),
  overallStatus: z.enum(["healthy", "warning", "error", "loading"]),
  statusMessage: z.string(),
  lastChecked: z.string(),
  error: z.string().optional(),
  recommendations: z.array(z.string()).default([]),
});

type UnifiedStatus = z.infer<typeof UnifiedStatusSchema>;

interface StreamlinedCredentialStatusProps {
  variant?: "compact" | "card";
  showActions?: boolean;
  autoRefresh?: boolean;
  className?: string;
}

export function StreamlinedCredentialStatus({
  variant = "card",
  showActions = true,
  autoRefresh = true,
  className = "",
}: StreamlinedCredentialStatusProps) {
  const queryClient = useQueryClient();
  const [showDetails, setShowDetails] = useState(false);

  // Main status query with Zod validation
  const {
    data: status,
    error,
    isLoading,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: queryKeys.status.unified(),
    queryFn: async (): Promise<UnifiedStatus> => {
      const response = await fetch("/api/mexc/unified-status");
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch status");
      }

      // Validate with Zod
      return UnifiedStatusSchema.parse(result.data);
    },
    staleTime: 30000, // Increased to 30 seconds to reduce conflicts
    refetchInterval: autoRefresh ? 60000 : false, // Reduced frequency to 60 seconds
    retry: (failureCount, error) => failureCount < 2,
  });

  // Refresh mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.status.unified() });
    },
  });

  const getStatusConfig = () => {
    if (error || status?.overallStatus === "error") {
      return {
        color: "red",
        icon: XCircle,
        text: "Connection Error",
        bgClass: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800",
      };
    }

    if (isLoading || status?.overallStatus === "loading") {
      return {
        color: "blue",
        icon: RefreshCw,
        text: "Checking Status",
        bgClass: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800",
      };
    }

    if (status?.overallStatus === "warning") {
      return {
        color: "yellow",
        icon: AlertTriangle,
        text: "Configuration Required",
        bgClass: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800",
      };
    }

    if (status?.overallStatus === "healthy") {
      return {
        color: "green",
        icon: CheckCircle,
        text: "System Ready",
        bgClass: "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
      };
    }

    return {
      color: "gray",
      icon: AlertTriangle,
      text: "Unknown Status",
      bgClass: "bg-gray-50 dark:bg-gray-950/20 dark:border-gray-800",
    };
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;
  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  // Handle credential configuration
  const handleConfigureCredentials = () => {
    const configElement = document.getElementById("api-credentials-form");
    if (configElement) {
      configElement.scrollIntoView({ behavior: "smooth" });
      const firstInput = configElement.querySelector("input");
      if (firstInput) {
        setTimeout(() => (firstInput as HTMLInputElement).focus(), 500);
      }
    }
  };

  // Compact variant for dashboard headers
  if (variant === "compact") {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <StatusIcon
          className={`h-4 w-4 text-${statusConfig.color}-500 ${isFetching ? "animate-spin" : ""}`}
        />
        <Badge variant={status?.overallStatus === "healthy" ? "default" : "secondary"}>
          {statusConfig.text}
        </Badge>
        {status?.canTrade && (
          <Badge variant="outline" className="text-green-600">
            <TrendingUp className="h-3 w-3 mr-1" />
            Trading Ready
          </Badge>
        )}
      </div>
    );
  }

  // Card variant for detailed display
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="h-5 w-5" />
            <CardTitle>MEXC API Status</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={status?.overallStatus === "healthy" ? "default" : "secondary"}>
              <StatusIcon className={`h-3 w-3 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              {statusConfig.text}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending || isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading || isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <CardDescription>
          {status?.statusMessage || error?.message || "Checking connection..."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Status Display */}
        <div className={`p-3 rounded-lg border ${statusConfig.bgClass}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <StatusIcon className={`h-5 w-5 text-${statusConfig.color}-500`} />
              <div>
                <div
                  className={`font-medium text-${statusConfig.color}-600 dark:text-${statusConfig.color}-400`}
                >
                  {statusConfig.text}
                </div>
                {status && (
                  <div className="text-sm text-muted-foreground">
                    Connection: {status.connected ? "Active" : "Failed"} • Credentials:{" "}
                    {status.credentialsValid ? "Valid" : "Invalid"} • Trading:{" "}
                    {status.canTrade ? "Enabled" : "Disabled"}
                  </div>
                )}
              </div>
            </div>
            {lastUpdate && (
              <div className="text-xs text-muted-foreground">{lastUpdate.toLocaleTimeString()}</div>
            )}
          </div>
        </div>

        {/* Quick Status Grid */}
        {status && (
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="text-center p-2 border rounded">
              <div
                className={`font-medium ${status.connected ? "text-green-600" : "text-red-600"}`}
              >
                {status.connected ? "✓" : "✗"}
              </div>
              <div className="text-muted-foreground">Network</div>
            </div>
            <div className="text-center p-2 border rounded">
              <div
                className={`font-medium ${status.credentialsValid ? "text-green-600" : "text-red-600"}`}
              >
                {status.credentialsValid ? "✓" : "✗"}
              </div>
              <div className="text-muted-foreground">Credentials</div>
            </div>
            <div className="text-center p-2 border rounded">
              <div className={`font-medium ${status.canTrade ? "text-green-600" : "text-red-600"}`}>
                {status.canTrade ? "✓" : "✗"}
              </div>
              <div className="text-muted-foreground">Trading</div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {(error || status?.error) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error?.message || status?.error}</AlertDescription>
          </Alert>
        )}

        {/* Credential Source Info */}
        {status && status.credentialSource !== "none" && (
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <Key className="h-4 w-4 text-blue-500" />
            <AlertDescription>
              <div className="font-medium">
                Using{" "}
                {status.credentialSource === "database" ? "User Settings" : "Environment Variables"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {status.credentialSource === "database"
                  ? "API credentials from your user profile"
                  : "API credentials from server environment"}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Action Suggestions */}
        {showActions && status && status.recommendations.length > 0 && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center space-x-1"
            >
              <Info className="h-4 w-4" />
              <span>
                {showDetails ? "Hide" : "Show"} Actions ({status.recommendations.length})
              </span>
            </Button>

            {showDetails && (
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                <AlertDescription>
                  <div className="space-y-2">
                    {status.recommendations.map((suggestion, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <div className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                        <span className="text-sm text-blue-800 dark:text-blue-200">
                          {suggestion}
                        </span>
                      </div>
                    ))}

                    {!status.hasCredentials && (
                      <div className="mt-3 pt-2 border-t border-blue-200">
                        <Button
                          size="sm"
                          onClick={handleConfigureCredentials}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Key className="h-4 w-4 mr-2" />
                          Configure Credentials
                        </Button>
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Update indicator */}
        {isFetching && (
          <div className="text-center">
            <div className="text-xs text-muted-foreground animate-pulse">Updating status...</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default StreamlinedCredentialStatus;
