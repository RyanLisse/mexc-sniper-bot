"use client";

import {
  AlertTriangle,
  CheckCircle,
  Database,
  ExternalLink,
  Globe,
  Info,
  Key,
  Lock,
  RefreshCw,
  Settings,
  XCircle,
} from "lucide-react";
import React, { useState } from "react";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { useStatus } from "../contexts/status-context";

/**
 * Enhanced Credential Status Component V2
 * 
 * Updated to use the centralized StatusContext to eliminate contradictory
 * status messages. This replaces the original EnhancedCredentialStatus component.
 */

interface EnhancedCredentialStatusV2Props {
  showDetailsButton?: boolean;
  className?: string;
}

export const EnhancedCredentialStatusV2 = React.memo(function EnhancedCredentialStatusV2({
  showDetailsButton = true,
  className = "",
}: EnhancedCredentialStatusV2Props) {
  const { 
    status, 
    refreshCredentials, 
    refreshNetwork,
    getOverallStatus,
    getStatusMessage,
    clearErrors
  } = useStatus();
  
  const [showDetails, setShowDetails] = useState(false);
  const overallStatus = getOverallStatus();
  const isLoading = status.isLoading;

  if (isLoading) {
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

  // Handle sync errors
  if (status.syncErrors.length > 0) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <div className="font-medium text-red-600">Connectivity Check Failed</div>
                <div className="text-sm text-muted-foreground">
                  {status.syncErrors[status.syncErrors.length - 1]}
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={clearErrors} className="ml-4">
                <XCircle className="mr-2 h-4 w-4" />
                Clear
              </Button>
              <Button variant="outline" size="sm" onClick={refreshCredentials} className="ml-4">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
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
            <StatusBadge />
            {showDetailsButton && (
              <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)}>
                <Info className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
        <CardDescription>{getStatusMessage()}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Main Status Row */}
        <MainStatusRow onRefresh={refreshCredentials} />

        {/* Credential Source Information */}
        <CredentialSourceInfo />

        {/* Detailed Information (expandable) */}
        {showDetails && <DetailedStatusInfo />}

        {/* Action Suggestions */}
        <ActionSuggestions />
      </CardContent>
    </Card>
  );
});

function StatusBadge() {
  const { status, getOverallStatus } = useStatus();
  const overallStatus = getOverallStatus();
  const { network, credentials } = status;

  const getStatusConfig = () => {
    // Determine status based on the centralized state
    if (!network.connected) {
      return {
        variant: "destructive" as const,
        icon: XCircle,
        text: "Network Error",
        color: "text-red-500",
      };
    }
    
    if (!credentials.hasCredentials) {
      return {
        variant: "secondary" as const,
        icon: Key,
        text: "No Credentials",
        color: "text-yellow-500",
      };
    }
    
    if (!credentials.isValid) {
      return {
        variant: "destructive" as const,
        icon: XCircle,
        text: "Invalid Credentials",
        color: "text-red-500",
      };
    }
    
    return {
      variant: "default" as const,
      icon: CheckCircle,
      text: "Connected",
      color: "text-green-500",
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center space-x-1">
      <Icon className={`h-3 w-3 ${config.color}`} />
      <span>{config.text}</span>
    </Badge>
  );
}

function MainStatusRow({ onRefresh }: { onRefresh: () => void }) {
  const { status, getOverallStatus, getStatusMessage } = useStatus();
  const { network, credentials } = status;
  const overallStatus = getOverallStatus();

  // Use centralized status logic to eliminate contradictions
  const getOverallStatusForDisplay = () => {
    if (!network.connected) {
      return { text: "Network Disconnected", color: "text-red-500", bgColor: "bg-red-500" };
    }
    if (!credentials.hasCredentials) {
      return { text: "No Credentials", color: "text-yellow-500", bgColor: "bg-yellow-500" };
    }
    if (!credentials.isValid) {
      return { text: "Invalid Credentials", color: "text-red-500", bgColor: "bg-red-500" };
    }
    return { text: "Fully Connected", color: "text-green-500", bgColor: "bg-green-500" };
  };

  const displayStatus = getOverallStatusForDisplay();

  return (
    <div className="space-y-3">
      {/* Overall Status Banner */}
      <div
        className={`flex items-center justify-between p-3 rounded-lg border ${
          displayStatus.color === "text-green-500"
            ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
            : displayStatus.color === "text-yellow-500"
              ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800"
              : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${displayStatus.bgColor} animate-pulse`} />
          <span className={`font-medium ${displayStatus.color}`}>{displayStatus.text}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} className="border-current">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Detailed Status Grid - Now using centralized status */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="flex items-center space-x-2">
          <Globe
            className={`h-4 w-4 ${network.connected ? "text-green-500" : "text-red-500"}`}
          />
          <span className={network.connected ? "text-green-600" : "text-red-600"}>
            {network.connected ? "Network OK" : "Network Error"}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Key
            className={`h-4 w-4 ${credentials.hasCredentials ? "text-green-500" : "text-gray-400"}`}
          />
          <span className={credentials.hasCredentials ? "text-green-600" : "text-gray-500"}>
            {credentials.hasCredentials ? "Keys Found" : "No Keys"}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Lock
            className={`h-4 w-4 ${credentials.isValid ? "text-green-500" : "text-red-500"}`}
          />
          <span className={credentials.isValid ? "text-green-600" : "text-red-600"}>
            {credentials.isValid ? "Valid" : "Invalid"}
          </span>
        </div>
      </div>
    </div>
  );
}

function CredentialSourceInfo() {
  const { status } = useStatus();
  const { credentials } = status;

  const getSourceConfig = () => {
    switch (credentials.source) {
      case "database":
        return {
          icon: Database,
          title: "User Settings",
          description: "Using API credentials from your user profile",
          color: "text-blue-500",
          bgColor: "bg-blue-50 dark:bg-blue-950/20",
          borderColor: "border-blue-200 dark:border-blue-800",
        };
      case "environment":
        return {
          icon: Settings,
          title: "Environment Variables",
          description: "Using API credentials from server environment",
          color: "text-green-500",
          bgColor: "bg-green-50 dark:bg-green-950/20",
          borderColor: "border-green-200 dark:border-green-800",
        };
      default:
        return {
          icon: AlertTriangle,
          title: "No Credentials",
          description: "No API credentials configured",
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

function DetailedStatusInfo() {
  const { status } = useStatus();
  const { credentials, network } = status;

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">Detailed Information</div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="font-medium">User Credentials</div>
          <div className={credentials.hasUserCredentials ? "text-green-600" : "text-gray-400"}>
            {credentials.hasUserCredentials ? "✓ Available" : "✗ Not configured"}
          </div>
        </div>
        <div>
          <div className="font-medium">Environment Variables</div>
          <div
            className={credentials.hasEnvironmentCredentials ? "text-green-600" : "text-gray-400"}
          >
            {credentials.hasEnvironmentCredentials ? "✓ Available" : "✗ Not set"}
          </div>
        </div>
        <div>
          <div className="font-medium">Last Check</div>
          <div className="text-muted-foreground">
            {new Date(credentials.lastValidated).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="font-medium">Status Source</div>
          <div className="text-muted-foreground">Centralized Status Context</div>
        </div>
      </div>
      {(credentials.error || network.error) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Error Details</div>
            <div className="text-sm mt-1">
              {credentials.error || network.error || "Unknown error"}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ActionSuggestions() {
  const { status } = useStatus();
  const { credentials, network } = status;

  // Only show suggestions if there are actual issues
  if (network.connected && credentials.hasCredentials && credentials.isValid) {
    return null;
  }

  const suggestions = [];

  if (credentials.source === "none") {
    suggestions.push(
      <Button
        key="configure"
        variant="outline"
        size="sm"
        onClick={() => window.open("/config", "_self")}
        className="flex items-center space-x-2"
      >
        <Key className="h-4 w-4" />
        <span>Configure API Credentials</span>
        <ExternalLink className="h-3 w-3" />
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

  return suggestions.length > 0 ? (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">Suggested Actions</div>
      <div className="space-y-2">{suggestions}</div>
    </div>
  ) : null;
}

export default EnhancedCredentialStatusV2;