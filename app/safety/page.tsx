import { Metadata } from "next";
import { SafetyMonitoringDashboard } from "@/src/components/safety-monitoring-dashboard";

export const metadata: Metadata = {
  title: "Safety Monitoring - MEXC Sniper Bot",
  description: "Real-time monitoring of all safety systems, risk metrics, and agent health",
};

export default function SafetyPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <SafetyMonitoringDashboard />
    </div>
  );
}