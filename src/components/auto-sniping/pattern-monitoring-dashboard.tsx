"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface PatternMonitoringDashboardProps {
  className?: string;
}

export function PatternMonitoringDashboard({ 
  className 
}: PatternMonitoringDashboardProps) {
  const [isMonitoring, setIsMonitoring] = useState(false);

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle>Pattern Monitoring</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={isMonitoring ? "default" : "secondary"}>
                {isMonitoring ? "Monitoring" : "Stopped"}
              </Badge>
            </div>
            <Button 
              onClick={() => setIsMonitoring(!isMonitoring)}
              variant={isMonitoring ? "destructive" : "default"}
            >
              {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}