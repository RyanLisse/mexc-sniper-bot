import { Metadata } from "next";
import { DashboardLayout } from "@/src/components/dashboard-layout";
import { SafetyMonitoringDashboard } from "@/src/components/safety-monitoring-dashboard";

export const metadata: Metadata = {
  title: "Safety Monitoring - MEXC Sniper Bot",
  description: "Real-time monitoring of all safety systems, risk metrics, and agent health",
};

export default function SafetyPage() {
  return (
    <DashboardLayout>
      <SafetyMonitoringDashboard />
    </DashboardLayout>
  );
}