import { Metadata } from "next";
import { AlertsDashboard } from "@/src/components/alerts/alerts-dashboard";

export const metadata: Metadata = {
  title: "Alerts Dashboard - MEXC Sniper Bot",
  description: "Enterprise-grade automated alerting system with ML-powered anomaly detection",
};

export default function AlertsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <AlertsDashboard />
    </div>
  );
}