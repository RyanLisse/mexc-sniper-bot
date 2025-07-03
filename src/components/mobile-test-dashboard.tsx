"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function MobileTestDashboard() {
  const [isMobile, setIsMobile] = useState(false);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Mobile Test Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Device Type:</span>
            <span>{isMobile ? "Mobile" : "Desktop"}</span>
          </div>
          <Button 
            onClick={() => setIsMobile(!isMobile)}
            className="w-full"
          >
            Toggle Device Type
          </Button>
          <div className="p-4 bg-muted rounded">
            <p className="text-sm">
              This is a simplified mobile test dashboard for responsive testing.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}