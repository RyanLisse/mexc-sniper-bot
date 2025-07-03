"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { AlertCircle, Loader2, Play, Square } from "lucide-react";

interface SimpleAutoSnipingControlProps {
  className?: string;
}

interface AutoSnipingStatus {
  isActive: boolean;
  autoSnipingEnabled: boolean;
  activePositions: number;
  isHealthy: boolean;
}

export function SimpleAutoSnipingControl({ 
  className 
}: SimpleAutoSnipingControlProps) {
  const [status, setStatus] = useState<AutoSnipingStatus>({
    isActive: false,
    autoSnipingEnabled: false,
    activePositions: 0,
    isHealthy: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/auto-sniping/control");
      const result = await response.json();
      
      if (result.success) {
        setStatus({
          isActive: result.data.status.autoSnipingEnabled || false,
          autoSnipingEnabled: result.data.status.autoSnipingEnabled || false,
          activePositions: result.data.status.activePositions || 0,
          isHealthy: result.data.status.isHealthy || false,
        });
        setError(null);
      } else {
        throw new Error(result.error || "Failed to fetch status");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

  // Load status on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Toggle auto-sniping
  const toggleAutoSniping = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const action = status.isActive ? "stop" : "start";
      const response = await fetch("/api/auto-sniping/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      if (result.success) {
        // Update status based on action
        setStatus(prev => ({
          ...prev,
          isActive: action === "start",
          autoSnipingEnabled: action === "start",
        }));
        
        // Refresh full status after a short delay
        setTimeout(fetchStatus, 1000);
      } else {
        throw new Error(result.error || `Failed to ${action} auto-sniping`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  // Emergency stop
  const emergencyStop = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auto-sniping/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          action: "emergency_stop",
          reason: "User requested emergency stop" 
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus(prev => ({
          ...prev,
          isActive: false,
          autoSnipingEnabled: false,
          activePositions: 0,
        }));
        
        // Refresh status
        setTimeout(fetchStatus, 1000);
      } else {
        throw new Error(result.error || "Failed to execute emergency stop");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Auto-Sniping Control
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStatus}
              disabled={isLoading}
            >
              <Loader2 className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status Display */}
            <div className="flex items-center gap-2">
              <Badge variant={status.isActive ? "default" : "secondary"}>
                {status.isActive ? "Active" : "Inactive"}
              </Badge>
              {!status.isHealthy && (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Unhealthy
                </Badge>
              )}
              {status.activePositions > 0 && (
                <Badge variant="outline">
                  {status.activePositions} Active Positions
                </Badge>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                <AlertCircle className="h-4 w-4 inline mr-1" />
                {error}
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-2">
              <Button 
                onClick={toggleAutoSniping}
                disabled={isLoading}
                variant={status.isActive ? "destructive" : "default"}
                className="flex-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : status.isActive ? (
                  <Square className="h-4 w-4 mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                {status.isActive ? "Stop" : "Start"}
              </Button>
              
              {status.isActive && (
                <Button 
                  onClick={emergencyStop}
                  disabled={isLoading}
                  variant="destructive"
                  size="sm"
                >
                  Emergency Stop
                </Button>
              )}
            </div>

            {/* Status Info */}
            <div className="text-xs text-gray-500 space-y-1">
              <div>System Health: {status.isHealthy ? "Good" : "Poor"}</div>
              <div>Auto-Sniping: {status.autoSnipingEnabled ? "Enabled" : "Disabled"}</div>
              <div>Active Positions: {status.activePositions}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}