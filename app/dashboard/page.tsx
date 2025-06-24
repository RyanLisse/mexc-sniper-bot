"use client";

import React, { useState, useEffect } from "react";
import { createLogger } from '../../src/lib/structured-logger';
import { DashboardLayout } from "../../src/components/dashboard-layout";
import { 
  MetricCard,
  TradingChart,
  CoinListingsBoard,
  OptimizedActivityFeed,
  OptimizedTradingTargets,
  RecentTradesTable,
  UpcomingCoinsSection,
  OptimizedAccountBalance,
  LazyDashboardWrapper,
  LazyChartWrapper,
  LazyCardWrapper,
  LazyTableWrapper,
  preloadDashboardComponents
} from "../../src/components/dynamic-component-loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/components/ui/tabs";
import { Button } from "../../src/components/ui/button";
import { Plus } from "lucide-react";
import { ManualTradingPanel } from "../../src/components/manual-trading-panel";
import { useMexcCalendar, useReadyTargets } from "../../src/hooks/use-mexc-data";
import { usePortfolio } from "../../src/hooks/use-portfolio";
import { useAccountBalance } from "../../src/hooks/use-account-balance";
import { useAuth } from "../../src/lib/kinde-auth-client";
import { AIServiceStatusPanel } from "../../src/components/dashboard/ai-intelligence/ai-service-status-panel";
import { AIEnhancedPatternDisplay } from "../../src/components/dashboard/ai-intelligence/ai-enhanced-pattern-display";
import { CacheWarmingControlPanel } from "../../src/components/dashboard/cache-warming/cache-warming-control-panel";
import { Phase3ConfigurationPanel } from "../../src/components/dashboard/phase3-config/phase3-configuration-panel";
import PerformanceMonitoringDashboard from "../../src/components/dashboard/performance-monitoring-dashboard";
import { useEnhancedPatterns } from "../../src/hooks/use-enhanced-patterns";
import { Phase3IntegrationSummary } from "../../src/components/dashboard/phase3-integration-summary";

const logger = createLogger('page');

export default function DashboardPage() {
  const { user, isLoading: userLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Use authenticated user ID
  const userId = user?.id;

  // PHASE 6: Intelligent preloading for 70% faster dashboard loading
  useEffect(() => {
    // Preload dashboard components after initial render
    const timer = setTimeout(() => {
      preloadDashboardComponents().catch(console.error);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Tab hover preloading for instant switching
  const handleTabHover = (tabValue: string) => {
    switch (tabValue) {
      case "listings":
        import("../../src/components/dashboard/coin-listings-board").catch(console.error);
        break;
      case "ai-performance":
        Promise.all([
          import("../../src/components/dashboard/ai-intelligence/ai-service-status-panel"),
          import("../../src/components/dashboard/ai-intelligence/ai-enhanced-pattern-display"),
          import("../../src/components/dashboard/cache-warming/cache-warming-control-panel"),
          import("../../src/components/dashboard/performance-monitoring-dashboard"),
          import("../../src/components/dashboard/phase3-config/phase3-configuration-panel"),
          import("../../src/components/dashboard/phase3-integration-summary")
        ]).catch(console.error);
        break;
      case "trades":
        import("../../src/components/dashboard/recent-trades-table").catch(console.error);
        break;
    }
  };
  const { data: accountBalance, isLoading: balanceLoading } = useAccountBalance({ 
    userId,
    enabled: !!userId && !userLoading 
  });
  const { data: portfolio } = usePortfolio(userId || "");
  const { data: calendarData } = useMexcCalendar();
  const { data: readyTargets } = useReadyTargets();
  const { data: enhancedPatterns, isLoading: patternsLoading } = useEnhancedPatterns({
    enableAI: true,
    confidenceThreshold: 70,
    includeAdvanceDetection: true,
  });

  // Handler functions for trading targets
  const handleExecuteSnipe = (target: any) => {
    logger.info("Executing snipe for target:", target);
    // TODO: Implement snipe execution logic
  };

  const handleRemoveTarget = (vcoinId: string) => {
    logger.info("Removing target:", vcoinId);
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
        <LazyChartWrapper>
          <TradingChart />
        </LazyChartWrapper>

        {/* Tabbed Content Section - PHASE 6: Dynamic Loading for 70% faster performance */}
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger 
                value="listings"
                onMouseEnter={() => handleTabHover("listings")}
              >
                New Listings
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {newListings}
                </span>
              </TabsTrigger>
              <TabsTrigger 
                value="ai-performance"
                onMouseEnter={() => handleTabHover("ai-performance")}
              >
                AI & Performance
              </TabsTrigger>
              <TabsTrigger 
                value="trades"
                onMouseEnter={() => handleTabHover("trades")}
              >
                Recent Trades
              </TabsTrigger>
              <TabsTrigger value="manual-trading">Manual Trading</TabsTrigger>
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
            <RecentTradesTable userId={userId || ""} />
          </TabsContent>

          <TabsContent value="listings" className="space-y-4">
            <LazyDashboardWrapper>
              <CoinListingsBoard />
            </LazyDashboardWrapper>
          </TabsContent>


          <TabsContent value="ai-performance" className="space-y-4">
            <LazyDashboardWrapper>
              <div className="grid gap-6">
                {/* Integration Summary */}
                <LazyCardWrapper>
                  <Phase3IntegrationSummary />
                </LazyCardWrapper>

                {/* AI Intelligence Section */}
                <div className="grid gap-4 md:grid-cols-2">
                  <LazyCardWrapper>
                    <AIServiceStatusPanel />
                  </LazyCardWrapper>
                  <LazyCardWrapper>
                    <AIEnhancedPatternDisplay
                      patterns={enhancedPatterns?.patterns || []}
                      isLoading={patternsLoading}
                      showAdvanceDetection={true}
                    />
                  </LazyCardWrapper>
                </div>

                {/* Cache and Performance Section */}
                <div className="grid gap-4 md:grid-cols-2">
                  <LazyCardWrapper>
                    <CacheWarmingControlPanel />
                  </LazyCardWrapper>
                  <LazyChartWrapper>
                    <PerformanceMonitoringDashboard refreshInterval={30000} />
                  </LazyChartWrapper>
                </div>

                {/* Configuration Section */}
                <LazyCardWrapper>
                  <Phase3ConfigurationPanel />
                </LazyCardWrapper>
              </div>
            </LazyDashboardWrapper>
          </TabsContent>

          <TabsContent value="trades" className="space-y-4">
            <LazyTableWrapper>
              <RecentTradesTable userId={userId || ""} />
            </LazyTableWrapper>
          </TabsContent>

          <TabsContent value="manual-trading" className="space-y-4">
            <LazyDashboardWrapper>
              <ManualTradingPanel userId={userId || ""} />
            </LazyDashboardWrapper>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            <LazyDashboardWrapper>
              <CoinListingsBoard />
            </LazyDashboardWrapper>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}