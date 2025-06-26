"use client";

import React from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { StrategyManager } from "@/src/components/strategy-manager";

export default function StrategiesPage() {
  return (
    <DashboardLayout>
      <StrategyManager />
    </DashboardLayout>
  );
}