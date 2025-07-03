"use client";

import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export function UnifiedStatusDisplay() {
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between">
              <span>Network:</span>
              <Badge variant="default">Connected</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Credentials:</span>
              <Badge variant="secondary">Not Set</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Trading:</span>
              <Badge variant="secondary">Inactive</Badge>
            </div>
          </div>
          <Button 
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Refreshing..." : "Refresh All"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}