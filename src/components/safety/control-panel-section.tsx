import { Pause, Play, RefreshCw, RotateCcw, Shield } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface SimulationStatus {
  active: boolean;
  mode: string;
  duration: number;
}

interface ReconciliationStatus {
  lastRun: string;
  status: string;
  discrepancies: number;
}

interface ControlPanelSectionProps {
  simulationStatus: SimulationStatus | undefined;
  reconciliationStatus: ReconciliationStatus | undefined;
  isEmergencyHalting: boolean;
  isTogglingSimulation: boolean;
  isRunningSafetyCheck: boolean;
  onEmergencyHalt: () => void;
  onToggleSimulation: () => void;
  onRunSafetyCheck: () => void;
  onRefreshAll: () => void;
}

export function ControlPanelSection({
  simulationStatus,
  reconciliationStatus,
  isEmergencyHalting,
  isTogglingSimulation,
  isRunningSafetyCheck,
  onEmergencyHalt,
  onToggleSimulation,
  onRunSafetyCheck,
  onRefreshAll,
}: ControlPanelSectionProps) {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Safety Controls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Emergency Controls */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Emergency Controls</h4>
            <Button
              variant="destructive"
              onClick={onEmergencyHalt}
              disabled={isEmergencyHalting}
              className="w-full"
            >
              {isEmergencyHalting ? (
                <>
                  <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                  Halting...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Emergency Halt
                </>
              )}
            </Button>
          </div>

          {/* Simulation Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Simulation Mode</h4>
              <Badge variant={simulationStatus?.active ? "default" : "secondary"}>
                {simulationStatus?.active ? "ACTIVE" : "INACTIVE"}
              </Badge>
            </div>
            <Button
              variant={simulationStatus?.active ? "secondary" : "default"}
              onClick={onToggleSimulation}
              disabled={isTogglingSimulation}
              className="w-full"
            >
              {isTogglingSimulation ? (
                <>
                  <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                  Toggling...
                </>
              ) : simulationStatus?.active ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Stop Simulation
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Simulation
                </>
              )}
            </Button>
            {simulationStatus?.active && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Mode: {simulationStatus.mode}</div>
                <div>Duration: {formatDuration(simulationStatus.duration)}</div>
              </div>
            )}
          </div>

          {/* System Operations */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">System Operations</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={onRunSafetyCheck}
                disabled={isRunningSafetyCheck}
                size="sm"
              >
                {isRunningSafetyCheck ? (
                  <RotateCcw className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
              </Button>
              <Button variant="outline" onClick={onRefreshAll} size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Reconciliation Status */}
          {reconciliationStatus && (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-sm font-medium">Reconciliation</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Last Run: {new Date(reconciliationStatus.lastRun).toLocaleString()}</div>
                <div>Status: {reconciliationStatus.status}</div>
                <div>Discrepancies: {reconciliationStatus.discrepancies}</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
