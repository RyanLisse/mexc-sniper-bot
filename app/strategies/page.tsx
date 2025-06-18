"use client";

import React from "react";
import { DashboardLayout } from "../../src/components/dashboard-layout";
import { StrategyManager } from "../../src/components/strategy-manager";

export default function StrategiesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Trading Strategies</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered trading strategy management and monitoring
          </p>
        </div>
        
        <StrategyManager />
      </div>
    </DashboardLayout>
  );
}