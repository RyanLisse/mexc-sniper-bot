import { AlertCircle, CheckCircle, XCircle, Zap } from "lucide-react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface SystemHealthData {
  status: string;
  uptime: number;
  errorRate: number;
  lastCheck: string;
  apiConnectivity: string;
  databaseHealth: string;
  cachePerformance: string;
}

interface SystemHealthSectionProps {
  systemHealth: SystemHealthData | undefined;
  overallHealth: string;
  isLoading: boolean;
}

export function SystemHealthSection({
  systemHealth,
  overallHealth,
  isLoading,
}: SystemHealthSectionProps) {
  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy":
      case "online":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
      case "degraded":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "critical":
      case "offline":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Zap className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading system health...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getHealthIcon(overallHealth)}
          System Health
          <Badge
            variant={overallHealth === "healthy" ? "default" : "destructive"}
          >
            {overallHealth?.toUpperCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Status:</span>
              <div className="flex items-center gap-1">
                {getHealthIcon(systemHealth?.status || "unknown")}
                <span className="text-sm font-medium">
                  {systemHealth?.status || "Unknown"}
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Uptime:</span>
              <span className="text-sm font-medium">
                {systemHealth?.uptime
                  ? formatUptime(systemHealth.uptime)
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Error Rate:</span>
              <span className="text-sm font-medium">
                {systemHealth?.errorRate
                  ? `${systemHealth.errorRate.toFixed(2)}%`
                  : "N/A"}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">API:</span>
              <div className="flex items-center gap-1">
                {getHealthIcon(systemHealth?.apiConnectivity || "unknown")}
                <span className="text-sm font-medium">
                  {systemHealth?.apiConnectivity || "Unknown"}
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Database:</span>
              <div className="flex items-center gap-1">
                {getHealthIcon(systemHealth?.databaseHealth || "unknown")}
                <span className="text-sm font-medium">
                  {systemHealth?.databaseHealth || "Unknown"}
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Cache:</span>
              <div className="flex items-center gap-1">
                {getHealthIcon(systemHealth?.cachePerformance || "unknown")}
                <span className="text-sm font-medium">
                  {systemHealth?.cachePerformance || "Unknown"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
