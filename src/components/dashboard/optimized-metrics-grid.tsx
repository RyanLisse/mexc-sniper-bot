"use client";

import { ArrowUpRight, DollarSign, Eye, Target, TrendingUp, Zap } from "lucide-react";
import React from "react";
import { useCurrencyFormatting } from "../../hooks/use-currency-formatting";
import { Card, CardContent } from "../ui/card";

interface Metrics {
  readyTokens: number;
  totalDetections: number;
  successfulSnipes: number;
  totalProfit: number;
  successRate: number;
  averageROI: number;
  bestTrade: number;
}

interface SniperStats {
  readyTargets: number;
  executedTargets: number;
  totalTargets: number;
}

interface MetricsGridProps {
  metrics?: Metrics;
  sniperStats?: SniperStats;
  calendarTargets?: number;
  pendingDetection?: number;
  isLoading?: boolean;
}

// Memoized MetricCard component to prevent unnecessary re-renders
const MetricCard = React.memo(
  ({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    color = "blue",
    isLoading = false,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ComponentType<{ className?: string }>;
    trend?: "up" | "down" | "neutral";
    color?: "blue" | "green" | "red" | "yellow" | "purple";
    isLoading?: boolean;
  }) => {
    const colorClasses = {
      blue: "text-blue-600 bg-blue-100",
      green: "text-green-600 bg-green-100",
      red: "text-red-600 bg-red-100",
      yellow: "text-yellow-600 bg-yellow-100",
      purple: "text-purple-600 bg-purple-100",
    };

    const trendIcon =
      trend && trend !== "neutral" ? (
        <ArrowUpRight
          className={`h-3 w-3 ${trend === "up" ? "text-green-500" : "text-red-500 rotate-90"}`}
        />
      ) : null;

    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
                <div className="flex items-center space-x-1">
                  <p className="text-lg font-bold text-gray-900">{isLoading ? "..." : value}</p>
                  {trendIcon}
                </div>
                {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);
MetricCard.displayName = "MetricCard";

// Loading skeleton component
const LoadingSkeleton = React.memo(() => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: 8 }, (_, i) => `metric-loading-${i}`).map((key) => (
      <Card key={key}>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-6 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-200 rounded w-2/3" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
));
LoadingSkeleton.displayName = "LoadingSkeleton";

// Section component for better organization
const MetricsSection = React.memo(
  ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">{title}</h3>
      {children}
    </div>
  )
);
MetricsSection.displayName = "MetricsSection";

// Main component with optimizations
export const OptimizedMetricsGrid = React.memo(
  ({
    metrics,
    sniperStats,
    calendarTargets = 0,
    pendingDetection = 0,
    isLoading = false,
  }: MetricsGridProps) => {
    const { formatCurrency, formatPercentage } = useCurrencyFormatting();

    if (isLoading) {
      return <LoadingSkeleton />;
    }

    return (
      <div className="space-y-4">
        {/* System Performance Metrics */}
        <MetricsSection title="Trading Performance">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Ready Tokens"
              value={metrics?.readyTokens || sniperStats?.readyTargets || 0}
              subtitle="Currently ready for snipe"
              icon={Target}
              color="green"
              trend="up"
              isLoading={isLoading}
            />
            <MetricCard
              title="Total Detections"
              value={metrics?.totalDetections || sniperStats?.totalTargets || 0}
              subtitle="Patterns detected"
              icon={Eye}
              color="blue"
              isLoading={isLoading}
            />
            <MetricCard
              title="Successful Snipes"
              value={metrics?.successfulSnipes || sniperStats?.executedTargets || 0}
              subtitle="Executed trades"
              icon={Zap}
              color="purple"
              trend="up"
              isLoading={isLoading}
            />
            <MetricCard
              title="Success Rate"
              value={formatPercentage(metrics?.successRate || 0)}
              subtitle="Hit rate percentage"
              icon={TrendingUp}
              color="green"
              isLoading={isLoading}
            />
          </div>
        </MetricsSection>

        {/* Financial Metrics */}
        <MetricsSection title="Financial Metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Total Profit"
              value={formatCurrency(metrics?.totalProfit || 0)}
              subtitle="All-time earnings"
              icon={DollarSign}
              color="green"
              trend="up"
              isLoading={isLoading}
            />
            <MetricCard
              title="Average ROI"
              value={formatPercentage(metrics?.averageROI || 0)}
              subtitle="Return on investment"
              icon={TrendingUp}
              color="blue"
              isLoading={isLoading}
            />
            <MetricCard
              title="Best Trade"
              value={formatCurrency(metrics?.bestTrade || 0)}
              subtitle="Highest single profit"
              icon={ArrowUpRight}
              color="purple"
              trend="up"
              isLoading={isLoading}
            />
          </div>
        </MetricsSection>

        {/* Current Activity */}
        <MetricsSection title="Current Activity">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard
              title="Calendar Targets"
              value={calendarTargets}
              subtitle="Upcoming launches tracked"
              icon={Target}
              color="yellow"
              isLoading={isLoading}
            />
            <MetricCard
              title="Pending Detection"
              value={pendingDetection}
              subtitle="Awaiting pattern confirmation"
              icon={Eye}
              color="blue"
              isLoading={isLoading}
            />
          </div>
        </MetricsSection>
      </div>
    );
  }
);

OptimizedMetricsGrid.displayName = "OptimizedMetricsGrid";
