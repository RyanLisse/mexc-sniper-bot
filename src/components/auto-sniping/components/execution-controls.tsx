/**
 * Execution Controls Component
 *
 * Control buttons for starting, stopping, and managing execution
 */

import { Button } from "@/src/components/ui/button";
import { Pause, Play, RefreshCw, Shield, Square } from "lucide-react";

interface ExecutionControlsProps {
  isExecutionActive: boolean;
  executionStatus: string;
  isLoading: boolean;
  isStartingExecution: boolean;
  isPausingExecution: boolean;
  isResumingExecution: boolean;
  isStoppingExecution: boolean;
  onRefresh: () => void;
  onToggleExecution: () => Promise<void>;
  onStopExecution: () => Promise<void>;
  onEmergencyStop: () => Promise<void>;
  showControls?: boolean;
}

export function ExecutionControls({
  isExecutionActive,
  executionStatus,
  isLoading,
  isStartingExecution,
  isPausingExecution,
  isResumingExecution,
  isStoppingExecution,
  onRefresh,
  onToggleExecution,
  onStopExecution,
  onEmergencyStop,
  showControls = true,
}: ExecutionControlsProps) {
  if (!showControls) return null;

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        Refresh
      </Button>
      <Button
        variant={
          isExecutionActive ? (executionStatus === "paused" ? "default" : "secondary") : "default"
        }
        size="sm"
        onClick={onToggleExecution}
        disabled={isStartingExecution || isPausingExecution || isResumingExecution}
      >
        {isExecutionActive ? (
          executionStatus === "paused" ? (
            <>
              <Play className="h-4 w-4" />
              Resume
            </>
          ) : (
            <>
              <Pause className="h-4 w-4" />
              Pause
            </>
          )
        ) : (
          <>
            <Play className="h-4 w-4" />
            Start
          </>
        )}
      </Button>
      {isExecutionActive && (
        <Button
          variant="destructive"
          size="sm"
          onClick={onStopExecution}
          disabled={isStoppingExecution}
        >
          <Square className="h-4 w-4" />
          Stop
        </Button>
      )}
      <Button
        variant="destructive"
        size="sm"
        onClick={onEmergencyStop}
        className="bg-red-600 hover:bg-red-700"
      >
        <Shield className="h-4 w-4" />
        Emergency Stop
      </Button>
    </div>
  );
}
