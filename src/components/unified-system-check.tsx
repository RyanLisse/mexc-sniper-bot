"use client";

/**
 * Unified System Check Component
 *
 * Consolidates all system status checking into a single, clear interface:
 * - Overall system health at a glance
 * - Component status with action buttons
 * - API credential management
 * - Auto-sniping always-enabled status
 */

import {
  AlertTriangle,
  CheckCircle,
  Database,
  Eye,
  EyeOff,
  GitBranch,
  Globe,
  Key,
  RefreshCw,
  Settings,
  Shield,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useStatus } from "../contexts/status-context-v2";
import { useAuth } from "../lib/kinde-auth-client";
import { ApiCredentialsForm } from "./api-credentials-form";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Separator } from "./ui/separator";

interface SystemCheckState {
  database: SystemStatus;
  openaiApi: SystemStatus;
  kindeAuth: SystemStatus;
  inngestWorkflows: SystemStatus;
  environment: SystemStatus;
  isRefreshing: boolean;
  lastFullCheck: string | null;
}

interface SystemStatus {
  status: "healthy" | "unhealthy" | "warning" | "loading" | "error";
  message?: string;
  details?: any;
  lastChecked?: string;
}

interface UnifiedSystemCheckProps {
  className?: string;
}

export function UnifiedSystemCheck({ className = "" }: UnifiedSystemCheckProps) {
  const { status: centralizedStatus, refreshAll, clearErrors } = useStatus();
  const { user } = useAuth();

  const [systemState, setSystemState] = useState<SystemCheckState>({
    database: { status: "loading" },
    openaiApi: { status: "loading" },
    kindeAuth: { status: "loading" },
    inngestWorkflows: { status: "loading" },
    environment: { status: "loading" },
    isRefreshing: false,
    lastFullCheck: null,
  });

  const [showCredentials, setShowCredentials] = useState(false);
  const [publicIP, setPublicIP] = useState<string | null>(null);
  const [isLoadingIP, setIsLoadingIP] = useState(false);

  // System health checks
  const checkDatabaseHealth = async (): Promise<SystemStatus> => {
    try {
      const response = await fetch("/api/health/db");
      const data = await response.json();

      if (response.ok && data.status === "healthy") {
        return {
          status: "healthy",
          message: "Database connected and operational",
          details: data,
          lastChecked: new Date().toISOString(),
        };
      } else {
        return {
          status: "unhealthy",
          message: data.error || "Database connection issues",
          details: data,
          lastChecked: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        status: "error",
        message: `Database check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        lastChecked: new Date().toISOString(),
      };
    }
  };

  const checkOpenAiApi = async (): Promise<SystemStatus> => {
    try {
      const response = await fetch("/api/health/openai");
      const data = await response.json();

      if (response.ok && data.status === "healthy") {
        return {
          status: "healthy",
          message: "OpenAI API configured and working",
          details: data,
          lastChecked: new Date().toISOString(),
        };
      } else {
        return {
          status: "unhealthy",
          message: data.error || "OpenAI API configuration issues",
          details: data,
          lastChecked: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        status: "error",
        message: `OpenAI API check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        lastChecked: new Date().toISOString(),
      };
    }
  };

  const checkKindeAuth = async (): Promise<SystemStatus> => {
    try {
      const response = await fetch("/api/auth/session");

      if (response.ok) {
        return {
          status: "healthy",
          message: "Authentication system working",
          details: { authenticated: !!user },
          lastChecked: new Date().toISOString(),
        };
      } else {
        return {
          status: "warning",
          message: "Authentication may have issues",
          lastChecked: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        status: "error",
        message: `Authentication check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        lastChecked: new Date().toISOString(),
      };
    }
  };

  const checkInngestWorkflows = async (): Promise<SystemStatus> => {
    try {
      const response = await fetch("/api/workflow-status");
      const data = await response.json();

      if (response.ok || data.fallbackData) {
        return {
          status: data.fallbackData ? "warning" : "healthy",
          message: data.fallbackData ? "Workflows in fallback mode" : "Workflows operational",
          details: data,
          lastChecked: new Date().toISOString(),
        };
      } else {
        return {
          status: "unhealthy",
          message: "Workflows not responding",
          lastChecked: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        status: "error",
        message: `Workflow check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        lastChecked: new Date().toISOString(),
      };
    }
  };

  const checkEnvironment = async (): Promise<SystemStatus> => {
    try {
      const response = await fetch("/api/health/environment");
      const data = await response.json();

      if (response.ok) {
        return {
          status: data.status as "healthy" | "unhealthy" | "warning",
          message: data.message || "Environment configuration checked",
          details: data,
          lastChecked: new Date().toISOString(),
        };
      } else {
        return {
          status: "unhealthy",
          message: data.error || "Environment configuration issues",
          details: data,
          lastChecked: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        status: "error",
        message: `Environment check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        lastChecked: new Date().toISOString(),
      };
    }
  };

  // Run comprehensive system check
  const runSystemCheck = async () => {
    setSystemState((prev) => ({ ...prev, isRefreshing: true }));

    try {
      const [database, openaiApi, kindeAuth, inngestWorkflows, environment] = await Promise.all([
        checkDatabaseHealth(),
        checkOpenAiApi(),
        checkKindeAuth(),
        checkInngestWorkflows(),
        checkEnvironment(),
      ]);

      // Also refresh centralized status
      await refreshAll();

      setSystemState({
        database,
        openaiApi,
        kindeAuth,
        inngestWorkflows,
        environment,
        isRefreshing: false,
        lastFullCheck: new Date().toISOString(),
      });
    } catch (error) {
      console.error("System check failed:", error);
      setSystemState((prev) => ({
        ...prev,
        isRefreshing: false,
        lastFullCheck: new Date().toISOString(),
      }));
    }
  };

  // Calculate overall system health
  const getOverallHealth = () => {
    const components = [
      systemState.database.status,
      systemState.openaiApi.status,
      systemState.kindeAuth.status,
      systemState.inngestWorkflows.status,
      systemState.environment.status,
      // Include MEXC API status from centralized status
      centralizedStatus?.network?.connected && centralizedStatus?.credentials?.isValid
        ? "healthy"
        : !centralizedStatus?.credentials?.hasCredentials
          ? "warning"
          : "unhealthy",
    ];

    const healthyCount = components.filter((status) => status === "healthy").length;
    const warningCount = components.filter((status) => status === "warning").length;
    const unhealthyCount = components.filter(
      (status) => status === "unhealthy" || status === "error"
    ).length;
    const loadingCount = components.filter((status) => status === "loading").length;

    const totalComponents = components.length;
    const healthScore = Math.round((healthyCount / totalComponents) * 100);

    if (loadingCount > 0) {
      return { status: "loading", score: 0, summary: "Checking system..." };
    } else if (unhealthyCount > 0) {
      return {
        status: "error",
        score: healthScore,
        summary: `${unhealthyCount} critical issue${unhealthyCount > 1 ? "s" : ""} detected`,
      };
    } else if (warningCount > 0) {
      return {
        status: "warning",
        score: healthScore,
        summary: `${warningCount} warning${warningCount > 1 ? "s" : ""} found`,
      };
    } else {
      return {
        status: "healthy",
        score: healthScore,
        summary: "All systems operational",
      };
    }
  };

  const overallHealth = getOverallHealth();

  // Get status icon and color
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "healthy":
        return { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" };
      case "unhealthy":
      case "error":
        return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" };
      case "warning":
        return { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10" };
      case "loading":
        return { icon: RefreshCw, color: "text-blue-500", bg: "bg-blue-500/10" };
      default:
        return { icon: XCircle, color: "text-gray-500", bg: "bg-gray-500/10" };
    }
  };

  // Fetch public IP address
  const fetchPublicIP = async () => {
    if (publicIP) {
      setPublicIP(null);
      return;
    }

    setIsLoadingIP(true);
    try {
      const services = [
        "https://ipapi.co/ip/",
        "https://api.ipify.org?format=text",
        "https://ipinfo.io/ip",
      ];

      for (const service of services) {
        try {
          const response = await fetch(service);
          if (response.ok) {
            const ip = (await response.text()).trim();
            if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
              setPublicIP(ip);
              break;
            }
          }
        } catch (serviceError) {
          console.warn(`Failed to fetch IP from ${service}:`, serviceError);
        }
      }

      if (!publicIP) {
        throw new Error("All IP services failed");
      }
    } catch (error) {
      console.error("Failed to fetch public IP:", error);
      setPublicIP("Unable to fetch IP");
    } finally {
      setIsLoadingIP(false);
    }
  };

  // Get user ID for API credentials
  const getUserId = () => {
    if (user?.id) {
      localStorage.removeItem("mexc-user-id");
      return user.id;
    }
    let userId = localStorage.getItem("mexc-user-id");
    if (!userId) {
      userId = `demo-user`;
      localStorage.setItem("mexc-user-id", userId);
    }
    return userId;
  };

  // Run initial system check
  useEffect(() => {
    runSystemCheck();
  }, []);

  const {
    icon: OverallIcon,
    color: overallColor,
    bg: overallBg,
  } = getStatusDisplay(overallHealth.status);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-lg ${overallBg}`}>
                <OverallIcon
                  className={`h-6 w-6 ${overallColor} ${overallHealth.status === "loading" ? "animate-spin" : ""}`}
                />
              </div>
              <div>
                <CardTitle className="text-xl">System Health</CardTitle>
                <CardDescription>{overallHealth.summary}</CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{overallHealth.score}%</div>
              <p className="text-sm text-muted-foreground">System Ready</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={overallHealth.score} className="w-full h-2" />

            <div className="flex items-center justify-between">
              {systemState.lastFullCheck && (
                <Badge variant="outline" className="text-xs">
                  Last check: {new Date(systemState.lastFullCheck).toLocaleTimeString()}
                </Badge>
              )}
              <Button
                onClick={runSystemCheck}
                disabled={systemState.isRefreshing}
                variant="outline"
                size="sm"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${systemState.isRefreshing ? "animate-spin" : ""}`}
                />
                {systemState.isRefreshing ? "Checking..." : "Refresh Status"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Component Status Grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Auto-Sniping Status - Always Enabled */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Zap className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h4 className="font-medium">Auto-Sniping</h4>
                  <p className="text-sm text-muted-foreground">Always Active</p>
                </div>
              </div>
              <Badge variant="default" className="bg-green-500">
                <TrendingUp className="h-3 w-3 mr-1" />
                Enabled
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* MEXC API Credentials */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg ${
                    getStatusDisplay(
                      centralizedStatus?.credentials?.isValid
                        ? "healthy"
                        : centralizedStatus?.credentials?.hasCredentials
                          ? "warning"
                          : "error"
                    ).bg
                  }`}
                >
                  <Key
                    className={`h-5 w-5 ${
                      getStatusDisplay(
                        centralizedStatus?.credentials?.isValid
                          ? "healthy"
                          : centralizedStatus?.credentials?.hasCredentials
                            ? "warning"
                            : "error"
                      ).color
                    }`}
                  />
                </div>
                <div>
                  <h4 className="font-medium">MEXC API</h4>
                  <p className="text-sm text-muted-foreground">
                    {centralizedStatus?.credentials?.isValid
                      ? "Configured & Valid"
                      : centralizedStatus?.credentials?.hasCredentials
                        ? "Configured"
                        : "Not Configured"}
                  </p>
                </div>
              </div>
              <Badge
                variant={
                  centralizedStatus?.credentials?.isValid
                    ? "default"
                    : centralizedStatus?.credentials?.hasCredentials
                      ? "secondary"
                      : "destructive"
                }
              >
                {centralizedStatus?.credentials?.isValid
                  ? "Valid"
                  : centralizedStatus?.credentials?.hasCredentials
                    ? "Needs Check"
                    : "Missing"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg ${getStatusDisplay(systemState.database.status).bg}`}
                >
                  <Database
                    className={`h-5 w-5 ${getStatusDisplay(systemState.database.status).color}`}
                  />
                </div>
                <div>
                  <h4 className="font-medium">Database</h4>
                  <p className="text-sm text-muted-foreground">
                    {systemState.database.status === "healthy"
                      ? "Connected"
                      : systemState.database.status === "loading"
                        ? "Checking..."
                        : "Issues"}
                  </p>
                </div>
              </div>
              <Badge
                variant={
                  systemState.database.status === "healthy"
                    ? "default"
                    : systemState.database.status === "warning"
                      ? "secondary"
                      : "destructive"
                }
              >
                {systemState.database.status === "loading"
                  ? "Checking"
                  : systemState.database.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Core Services */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg ${
                    getStatusDisplay(
                      systemState.openaiApi.status === "healthy" &&
                        systemState.kindeAuth.status === "healthy"
                        ? "healthy"
                        : "warning"
                    ).bg
                  }`}
                >
                  <Settings
                    className={`h-5 w-5 ${
                      getStatusDisplay(
                        systemState.openaiApi.status === "healthy" &&
                          systemState.kindeAuth.status === "healthy"
                          ? "healthy"
                          : "warning"
                      ).color
                    }`}
                  />
                </div>
                <div>
                  <h4 className="font-medium">Core Services</h4>
                  <p className="text-sm text-muted-foreground">OpenAI, Auth, Workflows</p>
                </div>
              </div>
              <Badge
                variant={
                  systemState.openaiApi.status === "healthy" &&
                  systemState.kindeAuth.status === "healthy"
                    ? "default"
                    : "secondary"
                }
              >
                {systemState.openaiApi.status === "healthy" &&
                systemState.kindeAuth.status === "healthy"
                  ? "Ready"
                  : "Partial"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Management Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Key className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <CardTitle>API Management</CardTitle>
                <CardDescription>Configure and test your MEXC trading credentials</CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCredentials(!showCredentials)}
            >
              {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="ml-2">{showCredentials ? "Hide" : "Show"} Configuration</span>
            </Button>
          </div>
        </CardHeader>
        {showCredentials && (
          <CardContent>
            <div className="space-y-6">
              <ApiCredentialsForm userId={getUserId()} />

              {/* Security Notice */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <div className="font-medium">Security Best Practices</div>
                    <div className="mt-1 space-y-1">
                      <div>• Use API keys with limited permissions (spot trading only)</div>
                      <div>• Never share your secret keys or store them in version control</div>
                      <div>• Regularly monitor your account for unauthorized activity</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Quick Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col space-y-2"
                onClick={() => window.open("/workflows", "_self")}
              >
                <GitBranch className="h-6 w-6" />
                <span>Monitoring</span>
                <span className="text-xs text-muted-foreground">View detailed system status</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col space-y-2"
                onClick={() => window.open("/settings", "_self")}
              >
                <Settings className="h-6 w-6" />
                <span>Trading Settings</span>
                <span className="text-xs text-muted-foreground">Advanced configuration</span>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col space-y-2"
                onClick={() => window.open("/api/health/db", "_blank")}
              >
                <Database className="h-6 w-6" />
                <span>Database Health</span>
                <span className="text-xs text-muted-foreground">View technical details</span>
              </Button>
            </div>

            {/* Public IP Section */}
            <Separator />
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Globe className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h4 className="font-medium">Public IP Address</h4>
                  <p className="text-xs text-muted-foreground">
                    For MEXC API allowlist configuration
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {publicIP && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {publicIP}
                  </Badge>
                )}
                <Button variant="outline" size="sm" onClick={fetchPublicIP} disabled={isLoadingIP}>
                  {isLoadingIP ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                  <span className="ml-2">{publicIP ? "Hide IP" : "Show IP"}</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default UnifiedSystemCheck;
