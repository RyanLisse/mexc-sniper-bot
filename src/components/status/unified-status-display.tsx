"use client";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Globe,
  Key,
  Loader2,
  RefreshCw,
  Shield,
  XCircle,
} from "lucide-react";
import { useStatus } from "../../contexts/status-context";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

/**
 * Unified Status Display Components
 *
 * These components provide consistent status information across the application
 * using the centralized StatusContext to eliminate contradictory messages.
 */

// Main Status Badge Component
interface StatusBadgeProps {
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function UnifiedStatusBadge({
  showText = true,
  size = "md",
  className = "",
}: StatusBadgeProps) {
  const { status, getOverallStatus, getStatusMessage } = useStatus();
  const overallStatus = getOverallStatus();

  const getStatusConfig = () => {
    switch (overallStatus) {
      case "healthy":
        return {
          variant: "default" as const,
          icon: CheckCircle,
          text: "Operational",
          color: "text-green-500",
          bg: "bg-green-50 border-green-200",
        };
      case "warning":
        return {
          variant: "secondary" as const,
          icon: AlertTriangle,
          text: "Warning",
          color: "text-yellow-500",
          bg: "bg-yellow-50 border-yellow-200",
        };
      case "error":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          text: "Error",
          color: "text-red-500",
          bg: "bg-red-50 border-red-200",
        };
      case "loading":
        return {
          variant: "secondary" as const,
          icon: Loader2,
          text: "Checking...",
          color: "text-blue-500",
          bg: "bg-blue-50 border-blue-200",
        };
      default:
        return {
          variant: "outline" as const,
          icon: AlertTriangle,
          text: "Unknown",
          color: "text-gray-500",
          bg: "bg-gray-50 border-gray-200",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const isLoading = overallStatus === "loading";

  return (
    <Badge variant={config.variant} className={`flex items-center space-x-1 ${className}`}>
      <Icon className={`${iconSize} ${config.color} ${isLoading ? "animate-spin" : ""}`} />
      {showText && <span>{config.text}</span>}
    </Badge>
  );
}

// Network Status Component
export function NetworkStatusIndicator() {
  const { status, refreshNetwork } = useStatus();
  const { network } = status;

  return (
    <div className="flex items-center space-x-2">
      <Globe className={`h-4 w-4 ${network.connected ? "text-green-500" : "text-red-500"}`} />
      <span className={`text-sm ${network.connected ? "text-green-600" : "text-red-600"}`}>
        {network.connected ? "Connected" : "Disconnected"}
      </span>
      {network.error && (
        <Button variant="ghost" size="sm" onClick={refreshNetwork} className="h-6 px-2 text-xs">
          Retry
        </Button>
      )}
    </div>
  );
}

// Credential Status Component
export function CredentialStatusIndicator() {
  const { status, refreshCredentials } = useStatus();
  const { credentials } = status;

  const getCredentialStatus = () => {
    if (!credentials.hasCredentials) {
      return { text: "No Credentials", color: "text-gray-500", icon: Key };
    }
    if (!credentials.isValid) {
      return { text: "Invalid", color: "text-red-500", icon: XCircle };
    }
    return { text: "Valid", color: "text-green-500", icon: CheckCircle };
  };

  const { text, color, icon: Icon } = getCredentialStatus();

  return (
    <div className="flex items-center space-x-2">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className={`text-sm ${color}`}>{text}</span>
      <span className="text-xs text-muted-foreground">({credentials.source})</span>
      {credentials.error && (
        <Button variant="ghost" size="sm" onClick={refreshCredentials} className="h-6 px-2 text-xs">
          Retry
        </Button>
      )}
    </div>
  );
}

// Trading Status Component
export function TradingStatusIndicator() {
  const { status, refreshTrading } = useStatus();
  const { trading, credentials } = status;

  if (!credentials.hasCredentials || !credentials.isValid) {
    return (
      <div className="flex items-center space-x-2">
        <Shield className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-500">Credentials Required</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Activity className={`h-4 w-4 ${trading.canTrade ? "text-green-500" : "text-red-500"}`} />
      <span className={`text-sm ${trading.canTrade ? "text-green-600" : "text-red-600"}`}>
        {trading.canTrade ? "Can Trade" : "Cannot Trade"}
      </span>
      {trading.accountType && (
        <span className="text-xs text-muted-foreground">({trading.accountType})</span>
      )}
      {trading.error && (
        <Button variant="ghost" size="sm" onClick={refreshTrading} className="h-6 px-2 text-xs">
          Retry
        </Button>
      )}
    </div>
  );
}

// Comprehensive Status Card
interface UnifiedStatusCardProps {
  title?: string;
  showRefreshButton?: boolean;
  showDetailedStatus?: boolean;
  className?: string;
}

export function UnifiedStatusCard({
  title = "System Status",
  showRefreshButton = true,
  showDetailedStatus = true,
  className = "",
}: UnifiedStatusCardProps) {
  const { status, refreshAll, clearErrors, getOverallStatus, getStatusMessage } = useStatus();
  const overallStatus = getOverallStatus();
  const statusMessage = getStatusMessage();

  const getStatusCardStyle = () => {
    switch (overallStatus) {
      case "healthy":
        return "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800";
      case "warning":
        return "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800";
      case "error":
        return "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800";
      case "loading":
        return "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800";
      default:
        return "bg-gray-50 border-gray-200 dark:bg-gray-950/20 dark:border-gray-800";
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="h-5 w-5" />
            <CardTitle>{title}</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <UnifiedStatusBadge />
            {showRefreshButton && (
              <Button variant="ghost" size="sm" onClick={refreshAll} disabled={status.isLoading}>
                <RefreshCw className={`h-4 w-4 ${status.isLoading ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
        </div>
        <CardDescription>{statusMessage}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Status Banner */}
        <div className={`p-3 rounded-lg border ${getStatusCardStyle()}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`w-3 h-3 rounded-full animate-pulse ${
                  overallStatus === "healthy"
                    ? "bg-green-500"
                    : overallStatus === "warning"
                      ? "bg-yellow-500"
                      : overallStatus === "error"
                        ? "bg-red-500"
                        : overallStatus === "loading"
                          ? "bg-blue-500"
                          : "bg-gray-500"
                }`}
              />
              <span
                className={`font-medium ${
                  overallStatus === "healthy"
                    ? "text-green-600"
                    : overallStatus === "warning"
                      ? "text-yellow-600"
                      : overallStatus === "error"
                        ? "text-red-600"
                        : overallStatus === "loading"
                          ? "text-blue-600"
                          : "text-gray-600"
                }`}
              >
                {statusMessage}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(status.lastGlobalUpdate).toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Detailed Status Grid */}
        {showDetailedStatus && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <NetworkStatusIndicator />
            <CredentialStatusIndicator />
            <TradingStatusIndicator />
          </div>
        )}

        {/* Error Messages */}
        {status.syncErrors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-red-600">Recent Errors:</span>
              <Button variant="ghost" size="sm" onClick={clearErrors} className="h-6 px-2 text-xs">
                Clear
              </Button>
            </div>
            {status.syncErrors.slice(-3).map((error, index) => (
              <Alert
                key={`error-${index}-${error.slice(0, 20)}`}
                variant="destructive"
                className="p-2"
              >
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Status Details */}
        {showDetailedStatus && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              Network: {status.network.connected ? "OK" : "Failed"}
              {status.network.lastChecked &&
                ` (${new Date(status.network.lastChecked).toLocaleTimeString()})`}
            </div>
            <div>
              Credentials: {status.credentials.hasCredentials ? "Configured" : "Missing"}
              {status.credentials.lastValidated &&
                ` (${new Date(status.credentials.lastValidated).toLocaleTimeString()})`}
            </div>
            <div>
              Trading: {status.trading.canTrade ? "Enabled" : "Disabled"}
              {status.trading.lastUpdate &&
                ` (${new Date(status.trading.lastUpdate).toLocaleTimeString()})`}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Mini Status Display for compact areas
export function MiniStatusDisplay() {
  const { getOverallStatus, getStatusMessage } = useStatus();
  const overallStatus = getOverallStatus();
  const statusMessage = getStatusMessage();

  return (
    <div className="flex items-center space-x-2">
      <UnifiedStatusBadge showText={false} size="sm" />
      <span className="text-sm truncate max-w-32" title={statusMessage}>
        {statusMessage}
      </span>
    </div>
  );
}

// Status Tooltip Component for header areas
export function StatusTooltip() {
  const { status, getOverallStatus } = useStatus();
  const overallStatus = getOverallStatus();

  return (
    <div className="p-3 space-y-2 text-sm">
      <div className="font-medium">System Status</div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Network:</span>
          <span className={status.network.connected ? "text-green-600" : "text-red-600"}>
            {status.network.connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>API:</span>
          <span className={status.credentials.isValid ? "text-green-600" : "text-red-600"}>
            {status.credentials.isValid ? "Valid" : "Invalid"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Trading:</span>
          <span className={status.trading.canTrade ? "text-green-600" : "text-red-600"}>
            {status.trading.canTrade ? "Enabled" : "Disabled"}
          </span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground pt-1 border-t">
        Last updated: {new Date(status.lastGlobalUpdate).toLocaleString()}
      </div>
    </div>
  );
}

export default {
  UnifiedStatusBadge,
  UnifiedStatusCard,
  NetworkStatusIndicator,
  CredentialStatusIndicator,
  TradingStatusIndicator,
  MiniStatusDisplay,
  StatusTooltip,
};
