"use client";

import { useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function EnhancedCredentialStatusConsolidated() {
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credential Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>API Credentials:</span>
            <Badge variant="secondary">Not Set</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Network Status:</span>
            <Badge variant="default">Connected</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Trading Status:</span>
            <Badge variant="secondary">Inactive</Badge>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? "Refreshing..." : "Refresh Status"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
