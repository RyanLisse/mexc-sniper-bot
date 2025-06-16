"use client";

import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { type MexcConnectivityResult, useMexcConnectivity } from "@/src/hooks/use-mexc-data";
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

interface EnhancedCredentialStatusProps {
  showDetailsButton?: boolean;
  className?: string;
}

export const EnhancedCredentialStatus = React.memo(function EnhancedCredentialStatus({
  showDetailsButton = true,
  className = "",
}: EnhancedCredentialStatusProps) {
  const { data: connectivity, isLoading, error, refetch } = useMexcConnectivity();
  const [showDetails, setShowDetails] = useState(false);

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

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <div className="font-medium text-red-600">Connectivity Check Failed</div>
                <div className="text-sm text-muted-foreground">
                  Unable to verify MEXC connection
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!connectivity) {
    return null;
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
            <StatusBadge connectivity={connectivity} />
            {showDetailsButton && (
              <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)}>
                <Info className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
        <CardDescription>{connectivity.message}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Main Status Row */}
        <MainStatusRow connectivity={connectivity} onRefresh={() => refetch()} />

        {/* Credential Source Information */}
        <CredentialSourceInfo connectivity={connectivity} />

        {/* Detailed Information (expandable) */}
        {showDetails && <DetailedStatusInfo connectivity={connectivity} />}

        {/* Action Suggestions */}
        <ActionSuggestions connectivity={connectivity} />
      </CardContent>
    </Card>
  );
});

function StatusBadge({ connectivity }: { connectivity: MexcConnectivityResult }) {
  const getStatusConfig = () => {
    switch (connectivity.status) {
      case "fully_connected":
        return {
          variant: "default" as const,
          icon: CheckCircle,
          text: "Connected",
          color: "text-green-500",
        };
      case "no_credentials":
        return {
          variant: "secondary" as const,
          icon: Key,
          text: "No Credentials",
          color: "text-yellow-500",
        };
      case "invalid_credentials":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          text: "Invalid Credentials",
          color: "text-red-500",
        };
      case "network_error":
        return {
          variant: "destructive" as const,
          icon: XCircle,
          text: "Network Error",
          color: "text-red-500",
        };
      default:
        return {
          variant: "secondary" as const,
          icon: AlertTriangle,
          text: "Unknown",
          color: "text-gray-500",
        };
    }
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

function MainStatusRow({
  connectivity,
  onRefresh,
}: { connectivity: MexcConnectivityResult; onRefresh: () => void }) {
  const getOverallStatus = () => {
    if (!connectivity.connected) {
      return { text: "Network Disconnected", color: "text-red-500", bgColor: "bg-red-500" };
    }
    if (!connectivity.hasCredentials) {
      return { text: "No Credentials", color: "text-yellow-500", bgColor: "bg-yellow-500" };
    }
    if (!connectivity.credentialsValid) {
      return { text: "Invalid Credentials", color: "text-red-500", bgColor: "bg-red-500" };
    }
    return { text: "Fully Connected", color: "text-green-500", bgColor: "bg-green-500" };
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="space-y-3">
      {/* Overall Status Banner */}
      <div
        className={`flex items-center justify-between p-3 rounded-lg border ${
          overallStatus.color === "text-green-500"
            ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
            : overallStatus.color === "text-yellow-500"
              ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800"
              : "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
        }`}
      >
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${overallStatus.bgColor} animate-pulse`} />
          <span className={`font-medium ${overallStatus.color}`}>{overallStatus.text}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} className="border-current">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Detailed Status Grid */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="flex items-center space-x-2">
          <Globe
            className={`h-4 w-4 ${connectivity.connected ? "text-green-500" : "text-red-500"}`}
          />
          <span className={connectivity.connected ? "text-green-600" : "text-red-600"}>
            {connectivity.connected ? "Network OK" : "Network Error"}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Key
            className={`h-4 w-4 ${connectivity.hasCredentials ? "text-green-500" : "text-gray-400"}`}
          />
          <span className={connectivity.hasCredentials ? "text-green-600" : "text-gray-500"}>
            {connectivity.hasCredentials ? "Keys Found" : "No Keys"}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Lock
            className={`h-4 w-4 ${connectivity.credentialsValid ? "text-green-500" : "text-red-500"}`}
          />
          <span className={connectivity.credentialsValid ? "text-green-600" : "text-red-600"}>
            {connectivity.credentialsValid ? "Valid" : "Invalid"}
          </span>
        </div>
      </div>
    </div>
  );
}

function CredentialSourceInfo({ connectivity }: { connectivity: MexcConnectivityResult }) {
  const getSourceConfig = () => {
    switch (connectivity.credentialSource) {
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

function DetailedStatusInfo({ connectivity }: { connectivity: MexcConnectivityResult }) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-muted-foreground">Detailed Information</div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="font-medium">User Credentials</div>
          <div className={connectivity.hasUserCredentials ? "text-green-600" : "text-gray-400"}>
            {connectivity.hasUserCredentials ? "✓ Available" : "✗ Not configured"}
          </div>
        </div>
        <div>
          <div className="font-medium">Environment Variables</div>
          <div
            className={connectivity.hasEnvironmentCredentials ? "text-green-600" : "text-gray-400"}
          >
            {connectivity.hasEnvironmentCredentials ? "✓ Available" : "✗ Not set"}
          </div>
        </div>
        <div>
          <div className="font-medium">Last Check</div>
          <div className="text-muted-foreground">
            {new Date(connectivity.timestamp).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="font-medium">Status Code</div>
          <div className="text-muted-foreground">{connectivity.status}</div>
        </div>
      </div>
      {connectivity.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">Error Details</div>
            <div className="text-sm mt-1">{connectivity.error}</div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ActionSuggestions({ connectivity }: { connectivity: MexcConnectivityResult }) {
  if (connectivity.status === "fully_connected") {
    return null;
  }

  const suggestions = [];

  if (connectivity.credentialSource === "none") {
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

  if (!connectivity.connected) {
    suggestions.push(
      <div key="network" className="text-sm text-muted-foreground">
        Check your internet connection and MEXC API status
      </div>
    );
  }

  if (connectivity.hasCredentials && !connectivity.credentialsValid) {
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
