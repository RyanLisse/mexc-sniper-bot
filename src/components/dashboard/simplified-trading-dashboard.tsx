"use client";

import { useState } from "react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export function SimplifiedTradingDashboard() {
  const [status] = useState("ready");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Trading Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span>Status:</span>
              <Badge variant="default">{status}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded">
                <div className="text-sm text-muted-foreground">
                  Active Positions
                </div>
                <div className="text-2xl font-bold">0</div>
              </div>
              <div className="p-4 border rounded">
                <div className="text-sm text-muted-foreground">Total P&L</div>
                <div className="text-2xl font-bold">$0.00</div>
              </div>
              <div className="p-4 border rounded">
                <div className="text-sm text-muted-foreground">
                  Success Rate
                </div>
                <div className="text-2xl font-bold">0%</div>
              </div>
              <div className="p-4 border rounded">
                <div className="text-sm text-muted-foreground">
                  Daily Trades
                </div>
                <div className="text-2xl font-bold">0</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
