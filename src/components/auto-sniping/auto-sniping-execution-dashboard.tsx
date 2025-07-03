"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface AutoSnipingExecutionDashboardProps {
  className?: string;
}

export function AutoSnipingExecutionDashboard({ 
  className 
}: AutoSnipingExecutionDashboardProps) {
  const [isActive, setIsActive] = useState(false);

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle>Auto-Sniping Execution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={isActive ? "default" : "secondary"}>
                {isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <Button 
              onClick={() => setIsActive(!isActive)}
              variant={isActive ? "destructive" : "default"}
            >
              {isActive ? "Stop Execution" : "Start Execution"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}