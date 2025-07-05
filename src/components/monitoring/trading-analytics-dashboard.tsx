"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSkeletonItems } from "../../lib/react-utilities";

import type { TradingAnalyticsData } from "../../types/trading-analytics-types";
import ExecutionTab from "./execution-tab";
import MarketTab from "./market-tab";
import PatternsTab from "./patterns-tab";
import PerformanceTab from "./performance-tab";
import PortfolioTab from "./portfolio-tab";
import RiskTab from "./risk-tab";
import TradingMetricsCards from "./trading-metrics-cards";

export const TradingAnalyticsDashboard = memo(
  function TradingAnalyticsDashboard() {
    const [data, setData] = useState<TradingAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Move hook calls to top level to follow Rules of Hooks
    const skeletonItems = useSkeletonItems(
      5,
      "h-32 bg-gray-100 rounded animate-pulse"
    );

    // Memoize utility functions to prevent recreation on every render
    const formatCurrency = useCallback((value: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    }, []);

    const formatPercentage = useCallback((value: number) => {
      return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
    }, []);

    const getPerformanceColor = useCallback((value: number) => {
      return value >= 0 ? "text-green-600" : "text-red-600";
    }, []);

    const fetchTradingAnalytics = useCallback(async () => {
      try {
        const response = await fetch("/api/monitoring/trading-analytics");
        if (!response.ok) {
          throw new Error("Failed to fetch trading analytics");
        }
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      fetchTradingAnalytics();
      const interval = setInterval(fetchTradingAnalytics, 60000); // Update every minute
      return () => clearInterval(interval);
    }, [fetchTradingAnalytics]);

    if (loading) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Loading Trading Analytics...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {skeletonItems.map((item) => (
                <div key={item.key} className={item.className} />
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (error) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Trading Analytics Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchTradingAnalytics} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!data) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Trading Analytics Dashboard</h2>
          <div className="flex items-center gap-2">
            <Button onClick={fetchTradingAnalytics} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Badge variant="default">
              Last Updated: {new Date(data.timestamp).toLocaleTimeString()}
            </Badge>
          </div>
        </div>

        {/* Key Trading Metrics */}
        <TradingMetricsCards
          data={data}
          formatCurrency={formatCurrency}
          formatPercentage={formatPercentage}
          getPerformanceColor={getPerformanceColor}
        />

        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
            <TabsTrigger value="risk">Risk Management</TabsTrigger>
            <TabsTrigger value="execution">Execution</TabsTrigger>
            <TabsTrigger value="market">Market Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4">
            <PerformanceTab
              data={data}
              formatCurrency={formatCurrency}
              formatPercentage={formatPercentage}
              getPerformanceColor={getPerformanceColor}
            />
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-4">
            <PortfolioTab
              data={data}
              formatCurrency={formatCurrency}
              formatPercentage={formatPercentage}
              getPerformanceColor={getPerformanceColor}
            />
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            <PatternsTab
              data={data}
              formatCurrency={formatCurrency}
              formatPercentage={formatPercentage}
              getPerformanceColor={getPerformanceColor}
            />
          </TabsContent>

          <TabsContent value="risk" className="space-y-4">
            <RiskTab
              data={data}
              formatCurrency={formatCurrency}
              formatPercentage={formatPercentage}
              getPerformanceColor={getPerformanceColor}
            />
          </TabsContent>

          <TabsContent value="execution" className="space-y-4">
            <ExecutionTab
              data={data}
              formatCurrency={formatCurrency}
              formatPercentage={formatPercentage}
              getPerformanceColor={getPerformanceColor}
            />
          </TabsContent>

          <TabsContent value="market" className="space-y-4">
            <MarketTab
              data={data}
              formatCurrency={formatCurrency}
              formatPercentage={formatPercentage}
              getPerformanceColor={getPerformanceColor}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }
);
