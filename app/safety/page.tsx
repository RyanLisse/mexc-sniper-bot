import type { Metadata } from "next";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ComprehensiveSafetyDashboard } from "@/components/safety/comprehensive-safety-dashboard";

export const metadata: Metadata = {
  title: "Comprehensive Safety Dashboard - MEXC Sniper Bot",
  description:
    "Advanced safety monitoring with emergency controls, risk analysis, and agent health monitoring",
};

export default function SafetyPage() {
  return (
    <DashboardLayout>
      <ComprehensiveSafetyDashboard />
    </DashboardLayout>
  );
}
