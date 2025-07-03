"use client";

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  Shield,
  Target,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Progress } from "../ui/progress";

/**
 * System Validation Card
 *
 * Provides comprehensive system readiness validation for auto-sniping activation.
 * Shows clear status of all critical components and what needs to be fixed.
 */

interface SystemValidationCheck {
  component: string;
  status: "pass" | "warning" | "fail";
  message: string;
  details?: string;
  required: boolean;
  fixable: boolean;
  fix?: string;
}

interface SystemValidationData {
  overall: "ready" | "issues" | "critical_failure";
  readyForAutoSniping: boolean;
  score: number;
  timestamp: string;
  checks: SystemValidationCheck[];
  summary: {
    total: number;
    passed: number;
    warnings: number;
    failures: number;
    requiredPassed: number;
    requiredTotal: number;
  };
  recommendations: string[];
  nextSteps: string[];
}

interface SystemValidationCardProps {
  className?: string;
}

export function SystemValidationCard({
  className = "",
}: SystemValidationCardProps) {
  const [validationData, setValidationData] =
    useState<SystemValidationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchValidation = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/system/validation");
      const data = await response.json();

      if (data.success) {
        setValidationData(data.data);
        setLastUpdate(new Date());
      } else {
        console.error("Validation failed:", data.error);
        // Set a fallback state
        setValidationData({
          overall: "critical_failure",
          readyForAutoSniping: false,
          score: 0,
          timestamp: new Date().toISOString(),
          checks: [],
          summary: {
            total: 0,
            passed: 0,
            warnings: 0,
            failures: 1,
            requiredPassed: 0,
            requiredTotal: 1,
          },
          recommendations: ["System validation service unavailable"],
          nextSteps: ["Check system logs and restart services"],
        });
      }
    } catch (error) {
      console.error("Failed to fetch validation:", {
        error: error instanceof Error ? error.message : String(error),
      });
      setValidationData({
        overall: "critical_failure",
        readyForAutoSniping: false,
        score: 0,
        timestamp: new Date().toISOString(),
        checks: [],
        summary: {
          total: 0,
          passed: 0,
          warnings: 0,
          failures: 1,
          requiredPassed: 0,
          requiredTotal: 1,
        },
        recommendations: ["Unable to connect to validation service"],
        nextSteps: ["Check network connectivity and system health"],
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchValidation();
    const interval = setInterval(fetchValidation, 30000);
    return () => clearInterval(interval);
  }, [fetchValidation]);

  const getStatusConfig = () => {
    if (!validationData)
      return { color: "gray", icon: Loader2, bgClass: "bg-gray-50" };

    switch (validationData.overall) {
      case "ready":
        return {
          color: "green",
          icon: CheckCircle,
          bgClass:
            "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
        };
      case "issues":
        return {
          color: "yellow",
          icon: AlertTriangle,
          bgClass:
            "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800",
        };
      case "critical_failure":
        return {
          color: "red",
          icon: XCircle,
          bgClass:
            "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800",
        };
      default:
        return { color: "gray", icon: Clock, bgClass: "bg-gray-50" };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <CardTitle>Auto-Sniping Readiness</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            {validationData && (
              <Badge
                variant={
                  validationData.readyForAutoSniping ? "default" : "destructive"
                }
                className="flex items-center space-x-1"
              >
                <StatusIcon
                  className={`h-3 w-3 text-${statusConfig.color}-500`}
                />
                <span>
                  {validationData.readyForAutoSniping ? "Ready" : "Not Ready"}
                </span>
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchValidation}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
        <CardDescription>
          {validationData
            ? `System validation score: ${validationData.score}% (${validationData.summary.passed}/${validationData.summary.total} checks passed)`
            : "Checking system readiness..."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Loading State */}
        {isLoading && !validationData && (
          <div className="flex items-center space-x-3 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">
              Running system validation...
            </span>
          </div>
        )}

        {/* Validation Results */}
        {validationData && (
          <>
            {/* Score Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>System Health Score</span>
                <span className={`font-medium text-${statusConfig.color}-600`}>
                  {validationData.score}%
                </span>
              </div>
              <Progress value={validationData.score} className="h-2" />
            </div>

            {/* Overall Status Banner */}
            <div className={`p-3 rounded-lg border ${statusConfig.bgClass}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full bg-${statusConfig.color}-500 animate-pulse`}
                  />
                  <span
                    className={`font-medium text-${statusConfig.color}-600`}
                  >
                    {validationData.readyForAutoSniping
                      ? "System Ready for Auto-Sniping"
                      : validationData.overall === "critical_failure"
                        ? "Critical Issues Detected"
                        : "System Has Issues"}
                  </span>
                </div>
                {lastUpdate && (
                  <div className="text-xs text-muted-foreground">
                    {lastUpdate.toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="text-center">
                <div className="font-medium text-green-600">
                  {validationData.summary.passed}
                </div>
                <div className="text-muted-foreground">Passed</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-yellow-600">
                  {validationData.summary.warnings}
                </div>
                <div className="text-muted-foreground">Warnings</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-red-600">
                  {validationData.summary.failures}
                </div>
                <div className="text-muted-foreground">Failures</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-blue-600">
                  {validationData.summary.requiredPassed}/
                  {validationData.summary.requiredTotal}
                </div>
                <div className="text-muted-foreground">Critical</div>
              </div>
            </div>

            {/* Critical Issues Alert */}
            {validationData.summary.failures > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium">
                    {validationData.summary.failures} critical issue(s)
                    preventing auto-sniping
                  </div>
                  <div className="text-sm mt-1">
                    Fix these issues before enabling automated trading
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Auto-Sniping Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <Shield
                  className={`h-5 w-5 ${validationData.readyForAutoSniping ? "text-green-500" : "text-red-500"}`}
                />
                <div>
                  <div className="font-medium">Auto-Sniping Status</div>
                  <div className="text-sm text-muted-foreground">
                    {validationData.readyForAutoSniping
                      ? "Ready to activate automated trading"
                      : "System validation required before activation"}
                  </div>
                </div>
              </div>
              <Button
                variant={
                  validationData.readyForAutoSniping ? "default" : "outline"
                }
                size="sm"
                disabled={!validationData.readyForAutoSniping}
                onClick={() => {
                  if (validationData.readyForAutoSniping) {
                    window.location.href = "/auto-sniping";
                  }
                }}
              >
                {validationData.readyForAutoSniping ? "Activate" : "Fix Issues"}
              </Button>
            </div>

            {/* Detailed Checks (Expandable) */}
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="w-full justify-between"
              >
                <span>Detailed Validation Results</span>
                <span
                  className={`transform transition-transform ${showDetails ? "rotate-180" : ""}`}
                >
                  ▼
                </span>
              </Button>

              {showDetails && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {validationData.checks.map((check) => (
                    <div
                      key={check.component}
                      className="flex items-start space-x-3 p-2 border rounded text-sm"
                    >
                      <div className="mt-0.5">
                        {check.status === "pass" && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                        {check.status === "warning" && (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                        {check.status === "fail" && (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium flex items-center space-x-2">
                          <span>{check.component}</span>
                          {check.required && (
                            <Badge variant="outline" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        <div className="text-muted-foreground">
                          {check.message}
                        </div>
                        {check.details && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {check.details}
                          </div>
                        )}
                        {check.status !== "pass" && check.fix && (
                          <div className="text-xs text-blue-600 mt-1">
                            💡 {check.fix}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommendations */}
            {validationData.recommendations.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Recommendations
                </div>
                <div className="space-y-1">
                  {validationData.recommendations
                    .slice(0, 3)
                    .map((rec, index) => (
                      <div
                        key={index}
                        className="text-sm p-2 bg-blue-50 rounded border-l-2 border-blue-200"
                      >
                        {rec}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Next Steps */}
            {validationData.nextSteps.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Next Steps
                </div>
                <div className="space-y-1">
                  {validationData.nextSteps.slice(0, 3).map((step, index) => (
                    <div
                      key={index}
                      className="text-sm p-2 bg-gray-50 rounded flex items-start space-x-2"
                    >
                      <span className="text-gray-400 mt-0.5">{index + 1}.</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default SystemValidationCard;
