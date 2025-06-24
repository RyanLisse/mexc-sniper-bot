"use client";

import React from "react";
import { DashboardLayout } from "../../src/components/dashboard-layout";
import { OptimizedAgentsDashboard } from "../../src/components/optimized-agents-dashboard";

export default function AgentsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div>
          <h1 className="text-3xl font-bold">AI Agent Management</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and control the 5 specialized agents powering auto-sniping
          </p>
        </div>

        {/* Optimized Agents Dashboard */}
        <OptimizedAgentsDashboard autoRefresh={true} />
      </div>
    </DashboardLayout>
  );
}