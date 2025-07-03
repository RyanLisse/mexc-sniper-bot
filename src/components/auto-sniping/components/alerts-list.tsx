/**
 * Alerts List Component
 *
 * Displays and manages execution alerts with acknowledgment capabilities
 */

import { Bell, BellOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExecutionAlert } from "../schemas/validation-schemas";

interface AlertsListProps {
  activeAlerts: ExecutionAlert[];
  onAcknowledgeAlert: (alertId: string) => void;
  onClearAlerts: () => void;
}

// Helper functions
const getAlertBadgeVariant = (
  severity: string
): "destructive" | "secondary" | "outline" => {
  if (severity === "critical" || severity === "error") return "destructive";
  if (severity === "warning") return "secondary";
  return "outline";
};

const formatAlertType = (type: string): string => {
  return type.replace("_", " ").toUpperCase();
};

export function AlertsList({
  activeAlerts,
  onAcknowledgeAlert,
  onClearAlerts,
}: AlertsListProps) {
  const hasAcknowledgedAlerts = activeAlerts.some(
    (alert) => alert.acknowledged
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Execution Alerts ({activeAlerts.length})
          </CardTitle>
          <CardDescription>
            Trade execution notifications and system alerts
          </CardDescription>
        </div>
        {hasAcknowledgedAlerts && (
          <Button variant="outline" size="sm" onClick={onClearAlerts}>
            Clear Acknowledged
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {activeAlerts.length > 0 ? (
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {activeAlerts.map((alert: ExecutionAlert, index: number) => (
                <div
                  key={alert.id || `alert-${index}`}
                  className={`border rounded-lg p-3 transition-opacity ${
                    alert.acknowledged ? "bg-gray-50 opacity-60" : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={getAlertBadgeVariant(alert.severity)}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <span className="font-medium">
                        {formatAlertType(alert.type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                      {!alert.acknowledged && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAcknowledgeAlert(alert.id)}
                        >
                          <BellOff className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 mt-2">{alert.message}</p>
                  {alert.symbol && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        {alert.symbol}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-gray-500">No active alerts</div>
        )}
      </CardContent>
    </Card>
  );
}
