"use client";

import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function UnifiedSystemCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [checks] = useState([
    { name: "Database Connection", status: "pass", icon: CheckCircle },
    { name: "API Credentials", status: "fail", icon: XCircle },
    { name: "Network Connectivity", status: "pass", icon: CheckCircle },
    { name: "Trading Engine", status: "warning", icon: AlertCircle },
  ]);

  const handleRunCheck = () => {
    setIsChecking(true);
    setTimeout(() => setIsChecking(false), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass":
        return "default";
      case "fail":
        return "destructive";
      case "warning":
        return "secondary";
      default:
        return "secondary";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Health Check</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {checks.map((check, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <check.icon className="w-4 h-4" />
                <span>{check.name}</span>
              </div>
              <Badge variant={getStatusColor(check.status) as any}>
                {check.status}
              </Badge>
            </div>
          ))}
          <Button
            onClick={handleRunCheck}
            disabled={isChecking}
            className="w-full"
          >
            {isChecking ? "Running Checks..." : "Run System Check"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
