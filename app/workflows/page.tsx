"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { WorkflowManager } from "@/components/workflow-manager";

export default function WorkflowsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Workflow Management</h1>
          <p className="text-muted-foreground mt-1">
            Control and monitor Inngest workflows and automation
          </p>
        </div>

        <WorkflowManager />
      </div>
    </DashboardLayout>
  );
}
