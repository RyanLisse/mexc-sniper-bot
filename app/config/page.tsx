"use client";

// Force dynamic rendering for this page since it shows real-time system status
export const dynamic = 'force-dynamic';

import { RefreshCw } from "lucide-react";
import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { UnifiedSystemCheck } from "@/src/components/unified-system-check";
import { useAuth } from "@/src/lib/supabase-auth-client";

export default function SystemCheckPage() {
  const { isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Loading system check...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold">System Check</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive system validation and API management
          </p>
        </div>

        {/* Unified System Check Component */}
        <Suspense fallback={
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Loading system status...</span>
          </div>
        }>
          <UnifiedSystemCheck />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}