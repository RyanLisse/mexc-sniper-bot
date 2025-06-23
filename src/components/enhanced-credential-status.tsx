"use client";

import {
  AlertTriangle,
  CheckCircle,
  Database,
  Globe,
  Info,
  Key,
  RefreshCw,
  Settings,
  XCircle,
} from "lucide-react";
import React, { useState } from "react";
import { useStatus } from "../contexts/status-context-v2";
import { UnifiedStatusBadge } from "./status/unified-status-display";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

interface EnhancedCredentialStatusProps {
  showDetailsButton?: boolean;
  className?: string;
}

export const EnhancedCredentialStatus = React.memo(function EnhancedCredentialStatus({
  showDetailsButton = true,
  className = "",
}: EnhancedCredentialStatusProps) {
  const { status, refreshAll, refreshCredentials, getOverallStatus, getStatusMessage } =
    useStatus();
  const [showDetails, setShowDetails] = useState(false);
  const overallStatus = getOverallStatus();
  const statusMessage = getStatusMessage();

  if (status.isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            <div>
              <div className="font-medium">Checking MEXC connectivity...</div>
              <div className="text-sm text-muted-foreground">
                Verifying API credentials and connection
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="h-5 w-5" />
            <span>MEXC API Status</span>
          </div>
          <div className="flex items-center space-x-2">
            <UnifiedStatusBadge />
            {showDetailsButton && (
              <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)}>
                <Info className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
        <CardDescription>{statusMessage}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Main Status Row */}
        <UnifiedMainStatusRow onRefresh={refreshAll} />

        {/* Credential Source Information */}
        <UnifiedCredentialSourceInfo />

        {/* Detailed Information (expandable) */}
        {showDetails && <UnifiedDetailedStatusInfo />}

        {/* Action Suggestions */}
        <UnifiedActionSuggestions />
      </CardContent>
    </Card>
  );
});

// Unified Status Components using centralized status context

function UnifiedMainStatusRow({ onRefresh }: { onRefresh: () => void }) {
  const { status, getOverallStatus } = useStatus();
  const overallStatus = getOverallStatus();

  const getStatusDisplay = () => {
    switch (overallStatus) {
      case "healthy":
        return {
          text: "System Operational",
          color: "text-green-500",
          bgColor: "bg-green-500",
          icon: CheckCircle,
        };
      case "warning":
        return {
          text: "Minor Issues Detected",
          color: "text-yellow-500",
          bgColor: "bg-yellow-500",
          icon: AlertTriangle,
        };
      case "error":
        return {
          text: "System Issues",
          color: "text-red-500",
          bgColor: "bg-red-500",
          icon: XCircle,
        };
      case "loading":
        return {
          text: "Checking System Status...",
          color: "text-blue-500",
          bgColor: "bg-blue-500",
          icon: RefreshCw,
        };
      default:
        return {
          text: "Unknown Status",
          color: "text-gray-500",
          bgColor: "bg-gray-500",
          icon: AlertTriangle,
        };
    }
  };

  const statusDisplay = getStatusDisplay();
  const Icon = statusDisplay.icon;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
      <div className="flex items-center space-x-3">
        <div className={`w-3 h-3 rounded-full ${statusDisplay.bgColor}`} />
        <div>
          <div className={`font-medium ${statusDisplay.color}`}>{statusDisplay.text}</div>
          <div className="text-sm text-muted-foreground">
            Last updated: {new Date(status.lastGlobalUpdate).toLocaleTimeString()}
          </div>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onRefresh} disabled={status.isLoading}>
        <RefreshCw className={`h-4 w-4 ${status.isLoading ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}

function UnifiedCredentialSourceInfo() {
  const { status } = useStatus();
  const { credentials } = status;

  const getSourceConfig = () => {
    if (credentials.source === "database") {
      return {
        icon: Database,
        title: "User Settings",
        description: "Using API credentials from your user profile",
        color: "text-blue-500",
        bgColor: "bg-blue-50 dark:bg-blue-950/20",
        borderColor: "border-blue-200 dark:border-blue-800",
      };
    } else if (credentials.source === "environment") {
      return {
        icon: Settings,
        title: "Environment Variables",
        description: "Using API credentials from server environment",
        color: "text-green-500",
        bgColor: "bg-green-50 dark:bg-green-950/20",
        borderColor: "border-green-200 dark:border-green-800",
      };
    } else {
      return {
        icon: AlertTriangle,
        title: "No Credentials",
        description: "No API credentials configured - configure below to enable trading",
        color: "text-yellow-500",
        bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
        borderColor: "border-yellow-200 dark:border-yellow-800",
      };
    }
  };

  const config = getSourceConfig();
  const Icon = config.icon;

  return (
    <Alert className={`${config.bgColor} ${config.borderColor}`}>
      <Icon className={`h-4 w-4 ${config.color}`} />
      <AlertDescription>
        <div className="font-medium">{config.title}</div>
        <div className="text-sm text-muted-foreground mt-1">{config.description}</div>
      </AlertDescription>
    </Alert>
  );
}

function UnifiedDetailedStatusInfo() {
  const { status } = useStatus();
  const { network, credentials, trading } = status;

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">Detailed Information</div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="font-medium">Network Connection</div>
          <div className={network.connected ? "text-green-600" : "text-red-600"}>
            {network.connected ? "✓ Connected" : "✗ Disconnected"}
          </div>
        </div>
        <div>
          <div className="font-medium">API Credentials</div>
          <div className={credentials.hasCredentials ? "text-green-600" : "text-gray-400"}>
            {credentials.hasCredentials ? "✓ Configured" : "✗ Not set"}
          </div>
        </div>
        <div>
          <div className="font-medium">Credential Validation</div>
          <div className={credentials.isValid ? "text-green-600" : "text-red-600"}>
            {credentials.isValid ? "✓ Valid" : "✗ Invalid"}
          </div>
        </div>
        <div>
          <div className="font-medium">Trading Status</div>
          <div className={trading.canTrade ? "text-green-600" : "text-red-600"}>
            {trading.canTrade ? "✓ Enabled" : "✗ Disabled"}
          </div>
        </div>
        <div>
          <div className="font-medium">Credential Source</div>
          <div className="text-muted-foreground capitalize">{credentials.source || "None"}</div>
        </div>
        <div>
          <div className="font-medium">Last Updated</div>
          <div className="text-muted-foreground">
            {new Date(status.lastGlobalUpdate).toLocaleTimeString()}
          </div>
        </div>
      </div>
      {status.syncErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Recent Errors</div>
            <div className="text-sm mt-1">{status.syncErrors[status.syncErrors.length - 1]}</div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function UnifiedActionSuggestions() {
  const { status, getOverallStatus } = useStatus();
  const overallStatus = getOverallStatus();
  const { credentials, network, trading } = status;

  if (overallStatus === "healthy") {
    return null;
  }

  const suggestions = [];

  // If no credentials, show scroll-to-form suggestion instead of circular redirect
  if (!credentials.hasCredentials) {
    suggestions.push(
      <Button
        key="configure"
        variant="outline"
        size="sm"
        onClick={() => {
          const formElement = document.getElementById("api-credentials-form");
          if (formElement) {
            formElement.scrollIntoView({ behavior: "smooth" });
            // Focus on the first input
            const firstInput = formElement.querySelector("input");
            if (firstInput) {
              setTimeout(() => firstInput.focus(), 500);
            }
          }
        }}
        className="flex items-center space-x-2"
      >
        <Key className="h-4 w-4" />
        <span>Configure API Credentials Below</span>
      </Button>
    );
  }

  if (!network.connected) {
    suggestions.push(
      <div key="network" className="text-sm text-muted-foreground">
        Check your internet connection and MEXC API status
      </div>
    );
  }

  if (credentials.hasCredentials && !credentials.isValid) {
    suggestions.push(
      <div key="invalid" className="text-sm text-muted-foreground">
        Verify your API credentials are correct and have proper permissions
      </div>
    );
  }

  if (credentials.isValid && !trading.canTrade) {
    suggestions.push(
      <div key="trading" className="text-sm text-muted-foreground">
        Check trading permissions and account status
      </div>
    );
  }

  return suggestions.length > 0 ? (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">Suggested Actions</div>
      <div className="space-y-2">{suggestions}</div>
    </div>
  ) : null;
}
