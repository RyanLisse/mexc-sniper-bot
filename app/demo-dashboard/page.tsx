"use client";

import React from "react";
import { DashboardLayout } from "@/src/components/dashboard-layout";
import { MetricCard } from "@/src/components/dashboard/metric-card";
import { TradingChart } from "@/src/components/dashboard/trading-chart";
import { CoinListingsBoard } from "@/src/components/dashboard/coin-listings-board";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Button } from "@/src/components/ui/button";
import { Plus } from "lucide-react";
import { useMexcCalendar, useReadyTargets } from "@/src/hooks/use-mexc-data";
import { usePortfolio } from "@/src/hooks/use-portfolio";
import { useAccountBalance } from "@/src/hooks/use-account-balance";
import { OptimizedActivityFeed } from "@/src/components/dashboard/optimized-activity-feed";
import { OptimizedTradingTargets } from "@/src/components/dashboard/optimized-trading-targets";
import { RecentTradesTable } from "@/src/components/dashboard/recent-trades-table";

export default function DemoDashboardPage() {
  // Note: This is a demo page for development viewing only
  // In production, this should be removed and proper authentication should be used
  
  const { data: accountBalance, isLoading: balanceLoading } = useAccountBalance();
  const { data: portfolio } = usePortfolio();
  const { data: calendarData } = useMexcCalendar();
  const { data: readyTargets } = useReadyTargets();

  // Calculate metrics
  const totalBalance = accountBalance?.totalUsdtValue || 0;
  const balanceChange = 0; // TODO: Calculate balance change from historical data
  const newListings = Array.isArray(calendarData) ? calendarData.length : 0;
  const activeTargets = Array.isArray(readyTargets) ? readyTargets.length : 0;
  const winRate = 0; // TODO: Calculate win rate from portfolio data

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Demo Notice */}
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            ⚠️ Demo Mode: This is a development preview without authentication. 
            Real data may be limited.
          </p>
        </div>

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
        <Tabs defaultValue="listings" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="listings">
                New Listings
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {newListings}
                </span>
              </TabsTrigger>
              <TabsTrigger value="trades">Recent Trades</TabsTrigger>
              <TabsTrigger value="patterns">Pattern Detection</TabsTrigger>
              <TabsTrigger value="overview">Overview</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Section
              </Button>
            </div>
          </div>

          <TabsContent value="listings" className="space-y-4">
            <CoinListingsBoard />
          </TabsContent>

          <TabsContent value="trades" className="space-y-4">
            <RecentTradesTable />
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            <CoinListingsBoard />
          </TabsContent>

          <TabsContent value="overview" className="space-y-4">
            <RecentTradesTable />
            <div className="grid gap-4 md:grid-cols-2">
              <OptimizedActivityFeed />
              <OptimizedTradingTargets />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}