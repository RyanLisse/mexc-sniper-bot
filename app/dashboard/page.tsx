"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// Type definitions for dashboard data
interface SnipeTarget {
  id: string;
  vcoinId?: string;
  symbolName?: string;
  symbol?: string;
  projectName?: string;
  status: "pending" | "ready" | "executed" | "cancelled";
  targetExecutionTime?: number;
  hoursAdvanceNotice?: number;
  priceDecimalPlaces?: number;
  quantityDecimalPlaces?: number;
  confidenceScore?: number;
  positionSizeUsdt?: number;
  entryStrategy?: string;
  stopLossPercent?: number;
  takeProfitCustom?: number;
}

interface CalendarEntry {
  vcoinId: string;
  symbol: string;
  projectName?: string;
  launchTime: Date;
  hoursAdvanceNotice?: number;
  priceDecimalPlaces?: number;
  quantityDecimalPlaces?: number;
  confidence?: number;
}

import { useAuth } from "@/src/components/auth/supabase-auth-provider";
import { AutoSnipingControlPanel } from "@/src/components/auto-sniping-control-panel";
import { AIEnhancedPatternDisplay } from "@/src/components/dashboard/ai-intelligence/ai-enhanced-pattern-display";
import { DashboardLayout } from "@/src/components/dashboard-layout";
import {
  CoinListingsBoard,
  LazyChartWrapper,
  LazyDashboardWrapper,
  LazyTableWrapper,
  MetricCard,
  OptimizedAccountBalance,
  OptimizedActivityFeed,
  OptimizedTradingTargets,
  preloadDashboardComponents,
  RecentTradesTable,
  TradingChart,
  UpcomingCoinsSection,
} from "@/src/components/dynamic-component-loader";
import { ManualTradingPanel } from "@/src/components/manual-trading-panel";
import { Button } from "@/src/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { useToast } from "@/src/components/ui/use-toast";
import { useAccountBalance } from "@/src/hooks/use-account-balance";
import { useEnhancedPatterns } from "@/src/hooks/use-enhanced-patterns";
import { useMexcCalendar, useReadyLaunches } from "@/src/hooks/use-mexc-data";
import {
  useDeleteSnipeTarget,
  usePortfolio,
  useSnipeTargets,
} from "@/src/hooks/use-portfolio";

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();

  // Use authenticated user ID
  const userId = user?.id;

  // Hooks for trading operations
  const deleteSnipeTarget = useDeleteSnipeTarget();

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
        import("@/src/components/dashboard/coin-listings-board").catch(
          console.error
        );
        break;
      case "ai-performance":
        Promise.all([
          import(
            "@/src/components/dashboard/ai-intelligence/ai-service-status-panel"
          ),
          import(
            "@/src/components/dashboard/ai-intelligence/ai-enhanced-pattern-display"
          ),
          import(
            "@/src/components/dashboard/cache-warming/cache-warming-control-panel"
          ),
          import("@/src/components/dashboard/performance-monitoring-dashboard"),
          import(
            "@/src/components/dashboard/phase3-config/phase3-configuration-panel"
          ),
          import("@/src/components/dashboard/phase3-integration-summary"),
        ]).catch(console.error);
        break;
      case "trades":
        import("@/src/components/dashboard/recent-trades-table").catch(
          console.error
        );
        break;
    }
  };
  const { data: accountBalance, isLoading: balanceLoading } = useAccountBalance(
    {
      userId: userId || "system", // Always provide a userId fallback
      enabled: true, // Always enable the query
    }
  );
  usePortfolio(userId || ""); // Keep hook active for potential future use
  const { data: calendarData } = useMexcCalendar();
  const { data: readyLaunches } = useReadyLaunches();
  const { data: snipeTargets, isLoading: snipeTargetsLoading } =
    useSnipeTargets(userId || "");
  const { data: enhancedPatterns, isLoading: patternsLoading } =
    useEnhancedPatterns({
      enableAI: true,
      confidenceThreshold: 70,
      includeAdvanceDetection: true,
    });

  // Handler functions for trading targets
  const handleExecuteSnipe = async (target: SnipeTarget) => {
    console.info("Executing snipe for target:", target);

    try {
      // Execute snipe using the auto-sniping execution API
      const response = await fetch("/api/auto-sniping/execution", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "execute_single_target",
          targetId: target.id,
          symbol: target.symbolName,
          positionSizeUsdt: target.positionSizeUsdt,
          confidenceScore: target.confidenceScore,
          strategy: target.entryStrategy || "normal",
          stopLossPercent: target.stopLossPercent,
          takeProfitPercent: target.takeProfitCustom,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Snipe Executed Successfully",
          description: `Target ${target.symbolName} executed successfully`,
          variant: "default",
        });

        // Refresh portfolio and balance data
        window.location.reload();
      } else {
        throw new Error(result.error || "Failed to execute snipe");
      }
    } catch (error) {
      console.error("Failed to execute snipe:", error);
      toast({
        title: "Snipe Execution Failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  const handleRemoveTarget = async (targetId: string | number) => {
    console.info("Removing target:", { targetId });

    try {
      await deleteSnipeTarget.mutateAsync(Number(targetId));

      toast({
        title: "Target Removed",
        description: "Snipe target has been successfully removed",
        variant: "default",
      });
    } catch (error) {
      console.error("Failed to remove target:", error);
      toast({
        title: "Removal Failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  };

  // Fetch execution history for calculating metrics
  const { data: executionHistoryData } = useQuery({
    queryKey: ["execution-history", userId],
    queryFn: async () => {
      if (!userId) return null;

      const thirtyDaysAgo = Math.floor(
        (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000
      );
      const response = await fetch(
        `/api/execution-history?userId=${encodeURIComponent(userId)}&fromDate=${thirtyDaysAgo}&limit=1000`,
        { credentials: "include" }
      );

      if (!response.ok) return null;
      const data = await response.json();
      return data.success ? data.data : null;
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute cache
    placeholderData: null,
  });

  // Fetch historical balance for balance change calculation
  const { data: historicalBalance } = useQuery({
    queryKey: ["historical-balance", userId],
    queryFn: async () => {
      if (!userId) return null;

      const twentyFourHoursAgo = Math.floor(
        (Date.now() - 24 * 60 * 60 * 1000) / 1000
      );
      const response = await fetch(
        `/api/account/balance?userId=${encodeURIComponent(userId)}&timestamp=${twentyFourHoursAgo}`,
        { credentials: "include" }
      );

      if (!response.ok) return null;
      const data = await response.json();
      return data.success ? data.data?.totalUsdtValue || 0 : 0;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minute cache
    placeholderData: 0,
  });

  // Fetch historical calendar data for new listings change calculation
  const { data: historicalCalendarData } = useQuery({
    queryKey: ["historical-calendar-data"],
    queryFn: async () => {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const response = await fetch(
          `/api/mexc/calendar?fromDate=${sevenDaysAgo.toISOString()}`,
          { credentials: "include" }
        );

        if (!response.ok) return [];
        const data = await response.json();
        return data.success ? data.data || [] : [];
      } catch (error) {
        console.error("Failed to fetch historical calendar data:", error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minute cache
    placeholderData: [],
  });

  // Fetch historical ready launches for active targets change calculation
  const { data: historicalReadyLaunches } = useQuery({
    queryKey: ["historical-ready-launches"],
    queryFn: async () => {
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const response = await fetch(
          `/api/ready-launches?fromDate=${sevenDaysAgo.toISOString()}`,
          { credentials: "include" }
        );

        if (!response.ok) return [];
        const data = await response.json();
        return data.success ? data.data || [] : [];
      } catch (error) {
        console.error("Failed to fetch historical ready launches:", error);
        return [];
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minute cache
    placeholderData: [],
  });

  // Transform snipe targets for display
  const transformedReadyTargets = useMemo(() => {
    if (!Array.isArray(snipeTargets)) return [];

    return snipeTargets
      .filter(
        (target: SnipeTarget) =>
          target.status === "pending" || target.status === "ready"
      )
      .map((target: SnipeTarget) => ({
        vcoinId: target.vcoinId || target.id?.toString(),
        symbol: target.symbolName || target.symbol,
        projectName:
          target.projectName || target.symbolName || "Unknown Project",
        launchTime: target.targetExecutionTime
          ? new Date(target.targetExecutionTime * 1000)
          : new Date(),
        hoursAdvanceNotice: target.hoursAdvanceNotice || 1,
        priceDecimalPlaces: target.priceDecimalPlaces || 8,
        quantityDecimalPlaces: target.quantityDecimalPlaces || 8,
        confidence: target.confidenceScore ? target.confidenceScore / 100 : 0.5,
        status: target.status === "ready" ? "ready" : "monitoring",
        // Include additional fields for execution
        id: target.id,
        positionSizeUsdt: target.positionSizeUsdt,
        entryStrategy: target.entryStrategy,
        stopLossPercent: target.stopLossPercent,
        takeProfitCustom: target.takeProfitCustom,
      }));
  }, [snipeTargets]);

  // Transform calendar data for pending targets
  const transformedCalendarTargets = useMemo(() => {
    if (!Array.isArray(calendarData)) return [];

    return calendarData.map((entry: CalendarEntry) => ({
      vcoinId: entry.vcoinId,
      symbol: entry.symbol,
      projectName: entry.projectName || "Unknown Project",
      firstOpenTime: new Date(entry.firstOpenTime).getTime(),
    }));
  }, [calendarData]);

  // Calculate metrics
  const totalBalance = accountBalance?.totalUsdtValue || 0;
  const balanceChange = totalBalance - (historicalBalance || totalBalance);
  const newListings = Array.isArray(calendarData) ? calendarData.length : 0;
  const activeTargets = transformedReadyTargets.length;

  // Calculate new listings change percentage
  const newListingsChange = useMemo(() => {
    if (!historicalCalendarData || historicalCalendarData.length === 0)
      return 0;

    const currentWeekListings = newListings;
    const lastWeekListings = historicalCalendarData.length;

    if (lastWeekListings === 0) return currentWeekListings > 0 ? 100 : 0;

    return ((currentWeekListings - lastWeekListings) / lastWeekListings) * 100;
  }, [newListings, historicalCalendarData]);

  // Calculate active targets change percentage
  const activeTargetsChange = useMemo(() => {
    if (!historicalReadyLaunches || historicalReadyLaunches.length === 0)
      return 0;

    const currentActiveTargets = activeTargets;
    const lastWeekActiveTargets = historicalReadyLaunches.length;

    if (lastWeekActiveTargets === 0) return currentActiveTargets > 0 ? 100 : 0;

    return (
      ((currentActiveTargets - lastWeekActiveTargets) / lastWeekActiveTargets) *
      100
    );
  }, [activeTargets, historicalReadyLaunches]);

  // Calculate win rate from execution history
  const winRate = useMemo(() => {
    if (!executionHistoryData?.summary) return 0;

    const { successRate } = executionHistoryData.summary;
    return typeof successRate === "number" ? successRate : 0;
  }, [executionHistoryData]);

  // Debug logging
  console.debug("[Dashboard] Balance data:", {
    accountBalance,
    totalBalance,
    balanceLoading,
    userId,
  });

  console.debug("[Dashboard] Calculated metrics:", {
    newListings,
    newListingsChange,
    historicalCalendarCount: historicalCalendarData?.length || 0,
    activeTargets,
    activeTargetsChange,
    historicalReadyLaunchesCount: historicalReadyLaunches?.length || 0,
    winRate,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Metrics Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Balance"
            value={`$${totalBalance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            change={balanceChange}
            changeLabel={balanceChange >= 0 ? "24h increase" : "24h decrease"}
            trend={balanceChange >= 0 ? "up" : "down"}
          />
          <MetricCard
            title="New Listings"
            value={newListings.toLocaleString()}
            change={Math.round(newListingsChange * 10) / 10}
            changeLabel={`${newListingsChange >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(newListingsChange * 10) / 10)}% vs last week`}
            description={
              newListingsChange >= 0
                ? "Strong listing growth"
                : "Listing acquisition needs attention"
            }
            trend={newListingsChange >= 0 ? "up" : "down"}
          />
          <MetricCard
            title="Active Targets"
            value={activeTargets.toLocaleString()}
            change={Math.round(activeTargetsChange * 10) / 10}
            changeLabel={`${activeTargetsChange >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(activeTargetsChange * 10) / 10)}% vs last week`}
            description={
              activeTargetsChange >= 0
                ? "Strong target retention"
                : "Target retention needs attention"
            }
            trend={activeTargetsChange >= 0 ? "up" : "down"}
          />
          <MetricCard
            title="Win Rate"
            value={`${winRate.toFixed(1)}%`}
            change={
              winRate > 50
                ? +(winRate - 50).toFixed(1)
                : -(50 - winRate).toFixed(1)
            }
            changeLabel={
              winRate > 50
                ? "Above average performance"
                : "Below average performance"
            }
            description={`Based on ${executionHistoryData?.summary?.totalExecutions || 0} trades`}
            trend={winRate > 50 ? "up" : "down"}
          />
        </div>

        {/* Chart Section */}
        <LazyChartWrapper>
          <TradingChart />
        </LazyChartWrapper>

        {/* Tabbed Content Section - Optimized for Auto-Sniping */}
        <Tabs
          defaultValue="auto-sniping"
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="auto-sniping">
                Auto-Sniping Control
              </TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger
                value="patterns"
                onMouseEnter={() => handleTabHover("patterns")}
              >
                Pattern Detection
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {readyLaunches ? readyLaunches.length : 0}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="trades"
                onMouseEnter={() => handleTabHover("trades")}
              >
                Trading History
              </TabsTrigger>
              <TabsTrigger
                value="listings"
                onMouseEnter={() => handleTabHover("listings")}
              >
                New Listings
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {newListings}
                </span>
              </TabsTrigger>
              <TabsTrigger value="manual-trading">Manual Trading</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
            </div>
          </div>

          <TabsContent value="auto-sniping" className="space-y-4">
            <AutoSnipingControlPanel />
          </TabsContent>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <UpcomingCoinsSection />
                <OptimizedActivityFeed />
              </div>
              <div className="space-y-4">
                <OptimizedAccountBalance userId={userId || "system"} />
                <OptimizedTradingTargets
                  readyTargets={transformedReadyTargets}
                  pendingDetection={transformedReadyTargets
                    .filter((t) => t.status === "monitoring")
                    .map((t) => t.vcoinId)}
                  calendarTargets={transformedCalendarTargets}
                  onExecuteSnipe={handleExecuteSnipe}
                  onRemoveTarget={handleRemoveTarget}
                  isLoading={snipeTargetsLoading}
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
              <div className="grid gap-4">
                <AIEnhancedPatternDisplay
                  patterns={enhancedPatterns?.patterns || []}
                  isLoading={patternsLoading}
                  showAdvanceDetection={true}
                />
                <CoinListingsBoard />
              </div>
            </LazyDashboardWrapper>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
