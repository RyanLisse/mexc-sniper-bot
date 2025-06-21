"use client";

import React from "react";
import { DashboardLayout } from "../../src/components/dashboard-layout";
import { MetricCard } from "../../src/components/dashboard/metric-card";
import { TradingChart } from "../../src/components/dashboard/trading-chart";
import { CoinListingsBoard } from "../../src/components/dashboard/coin-listings-board";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/components/ui/tabs";
import { Button } from "../../src/components/ui/button";
import { Plus } from "lucide-react";
import { useMexcCalendar, useReadyTargets } from "../../src/hooks/use-mexc-data";
import { usePortfolio } from "../../src/hooks/use-portfolio";
import { useAccountBalance } from "../../src/hooks/use-account-balance";
import { OptimizedActivityFeed } from "../../src/components/dashboard/optimized-activity-feed";
import { OptimizedTradingTargets } from "../../src/components/dashboard/optimized-trading-targets";
import { RecentTradesTable } from "../../src/components/dashboard/recent-trades-table";
import { UpcomingCoinsSection } from "../../src/components/dashboard/upcoming-coins-section";
import { OptimizedAccountBalance } from "../../src/components/optimized-account-balance";
import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import { AIServiceStatusPanel } from "../../src/components/dashboard/ai-intelligence/ai-service-status-panel";
import { AIEnhancedPatternDisplay } from "../../src/components/dashboard/ai-intelligence/ai-enhanced-pattern-display";
import { CacheWarmingControlPanel } from "../../src/components/dashboard/cache-warming/cache-warming-control-panel";
import { Phase3ConfigurationPanel } from "../../src/components/dashboard/phase3-config/phase3-configuration-panel";
import PerformanceMonitoringDashboard from "../../src/components/dashboard/performance-monitoring-dashboard";
import { useEnhancedPatterns } from "../../src/hooks/use-enhanced-patterns";
import { Phase3IntegrationSummary } from "../../src/components/dashboard/phase3-integration-summary";

export default function DashboardPage() {
  const { user, isLoading: userLoading } = useKindeBrowserClient();

  // Use authenticated user ID
  const userId = user?.id;
  const { data: accountBalance, isLoading: balanceLoading } = useAccountBalance({ userId });
  const { data: portfolio } = usePortfolio(userId);
  const { data: calendarData } = useMexcCalendar();
  const { data: readyTargets } = useReadyTargets();
  const { data: enhancedPatterns, isLoading: patternsLoading } = useEnhancedPatterns({
    enableAI: true,
    confidenceThreshold: 70,
    includeAdvanceDetection: true,
  });

  // Handler functions for trading targets
  const handleExecuteSnipe = (target: any) => {
    console.log("Executing snipe for target:", target);
    // TODO: Implement snipe execution logic
  };

  const handleRemoveTarget = (vcoinId: string) => {
    console.log("Removing target:", vcoinId);
    // TODO: Implement target removal logic
  };

  // Calculate metrics
  const totalBalance = accountBalance?.totalUsdtValue || 0;
  const balanceChange = 0; // TODO: Calculate balance change from historical data
  const newListings = Array.isArray(calendarData) ? calendarData.length : 0;
  const activeTargets = Array.isArray(readyTargets) ? readyTargets.length : 0;
  const winRate = 0; // TODO: Calculate win rate from portfolio data

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Metrics Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Balance"
            value={`$${totalBalance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}`}
            change={balanceChange}
            changeLabel="Trending up this month"
            trend="up"
          />
          <MetricCard
            title="New Listings"
            value={newListings.toLocaleString()}
            change={-20}
            changeLabel="Down 20% this period"
            description="Acquisition needs attention"
            trend="down"
          />
          <MetricCard
            title="Active Targets"
            value={activeTargets.toLocaleString()}
            change={12.5}
            changeLabel="Strong target retention"
            description="Engagement exceed targets"
            trend="up"
          />
          <MetricCard
            title="Win Rate"
            value={`${winRate.toFixed(1)}%`}
            change={4.5}
            changeLabel="Steady performance increase"
            description="Meets growth projections"
            trend="up"
          />
        </div>

        {/* Chart Section */}
        <TradingChart />

        {/* Tabbed Content Section */}
        <Tabs defaultValue="overview" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="listings">
                New Listings
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {newListings}
                </span>
              </TabsTrigger>
              <TabsTrigger value="ai-performance">AI & Performance</TabsTrigger>
              <TabsTrigger value="trades">Recent Trades</TabsTrigger>
              <TabsTrigger value="patterns">Pattern Detection</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <UpcomingCoinsSection />
                <OptimizedActivityFeed />
              </div>
              <div className="space-y-4">
                <OptimizedAccountBalance userId={userId} />
                <OptimizedTradingTargets
                  onExecuteSnipe={handleExecuteSnipe}
                  onRemoveTarget={handleRemoveTarget}
                />
              </div>
            </div>
            <RecentTradesTable userId={userId} />
          </TabsContent>

          <TabsContent value="listings" className="space-y-4">
            <CoinListingsBoard />
          </TabsContent>


          <TabsContent value="ai-performance" className="space-y-4">
            <div className="grid gap-6">
              {/* Integration Summary */}
              <Phase3IntegrationSummary />

              {/* AI Intelligence Section */}
              <div className="grid gap-4 md:grid-cols-2">
                <AIServiceStatusPanel />
                <AIEnhancedPatternDisplay
                  patterns={enhancedPatterns?.patterns || []}
                  isLoading={patternsLoading}
                  showAdvanceDetection={true}
                />
              </div>

              {/* Cache and Performance Section */}
              <div className="grid gap-4 md:grid-cols-2">
                <CacheWarmingControlPanel />
                <PerformanceMonitoringDashboard refreshInterval={30000} />
              </div>

              {/* Configuration Section */}
              <Phase3ConfigurationPanel />
            </div>
          </TabsContent>

          <TabsContent value="trades" className="space-y-4">
            <RecentTradesTable userId={userId} />
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            <CoinListingsBoard />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}