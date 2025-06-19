"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  CheckCircle2,
  Clock,
  Edit,
  Pause,
  Play,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useToast } from "./ui/use-toast";

interface TradingStrategy {
  id: string;
  name: string;
  symbol: string;
  status: "active" | "paused" | "completed" | "failed";
  createdAt: string;
  type: "scalping" | "swing" | "momentum" | "arbitrage";
  riskLevel: "low" | "medium" | "high";
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfitLevels: {
    level: number;
    percentage: number;
    amount: number;
    reached: boolean;
  }[];
  positionSize: number;
  pnl: number;
  pnlPercentage: number;
  confidence: number;
  aiInsights: string;
  executedTrades: number;
  winRate: number;
  riskMetrics: {
    maxDrawdown: number;
    sharpeRatio: number;
    riskRewardRatio: number;
  };
}

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  riskLevel: string;
  defaultSettings: {
    stopLossPercent: number;
    takeProfitPercent: number[];
    positionSizePercent: number;
  };
}

export function StrategyManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("active");

  // Fetch strategies
  const { data: strategies, isLoading } = useQuery<TradingStrategy[]>({
    queryKey: ["trading-strategies"],
    queryFn: async () => {
      // In real implementation, fetch from API
      return [
        {
          id: "strat-1",
          name: "BTC Momentum Play",
          symbol: "BTCUSDT",
          status: "active",
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          type: "momentum",
          riskLevel: "medium",
          entryPrice: 42500,
          currentPrice: 43250,
          stopLoss: 41800,
          takeProfitLevels: [
            { level: 1, percentage: 5, amount: 44625, reached: false },
            { level: 2, percentage: 10, amount: 46750, reached: false },
            { level: 3, percentage: 15, amount: 48875, reached: false },
            { level: 4, percentage: 25, amount: 53125, reached: false },
          ],
          positionSize: 0.5,
          pnl: 375,
          pnlPercentage: 1.76,
          confidence: 85,
          aiInsights:
            "Strong momentum detected with bullish divergence on 4h timeframe. Volume profile supports upward movement.",
          executedTrades: 1,
          winRate: 100,
          riskMetrics: {
            maxDrawdown: 2.1,
            sharpeRatio: 1.8,
            riskRewardRatio: 3.2,
          },
        },
        {
          id: "strat-2",
          name: "ETH Scalping Strategy",
          symbol: "ETHUSDT",
          status: "active",
          createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          type: "scalping",
          riskLevel: "high",
          entryPrice: 2250,
          currentPrice: 2238,
          stopLoss: 2225,
          takeProfitLevels: [
            { level: 1, percentage: 2, amount: 2295, reached: false },
            { level: 2, percentage: 3, amount: 2317.5, reached: false },
          ],
          positionSize: 2.0,
          pnl: -24,
          pnlPercentage: -0.53,
          confidence: 72,
          aiInsights:
            "Quick scalp opportunity on oversold conditions. Tight stop loss recommended.",
          executedTrades: 3,
          winRate: 66.7,
          riskMetrics: {
            maxDrawdown: 1.2,
            sharpeRatio: 2.1,
            riskRewardRatio: 1.5,
          },
        },
        {
          id: "strat-3",
          name: "SOL Swing Trade",
          symbol: "SOLUSDT",
          status: "completed",
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          type: "swing",
          riskLevel: "low",
          entryPrice: 98.5,
          currentPrice: 112.3,
          stopLoss: 94.0,
          takeProfitLevels: [
            { level: 1, percentage: 5, amount: 103.4, reached: true },
            { level: 2, percentage: 10, amount: 108.4, reached: true },
            { level: 3, percentage: 15, amount: 113.3, reached: true },
          ],
          positionSize: 5.0,
          pnl: 690,
          pnlPercentage: 14.01,
          confidence: 91,
          aiInsights: "Successful swing trade completed. All profit targets reached.",
          executedTrades: 1,
          winRate: 100,
          riskMetrics: {
            maxDrawdown: 0.8,
            sharpeRatio: 3.2,
            riskRewardRatio: 4.5,
          },
        },
      ];
    },
    refetchInterval: 5000,
  });

  // Fetch strategy templates
  const { data: templates } = useQuery<StrategyTemplate[]>({
    queryKey: ["strategy-templates"],
    queryFn: async () => {
      return [
        {
          id: "template-1",
          name: "Conservative Swing",
          description: "Low-risk swing trading with wide stop loss",
          type: "swing",
          riskLevel: "low",
          defaultSettings: {
            stopLossPercent: 5,
            takeProfitPercent: [5, 10, 15, 20],
            positionSizePercent: 10,
          },
        },
        {
          id: "template-2",
          name: "Aggressive Scalping",
          description: "High-frequency scalping with tight stops",
          type: "scalping",
          riskLevel: "high",
          defaultSettings: {
            stopLossPercent: 1,
            takeProfitPercent: [2, 3],
            positionSizePercent: 25,
          },
        },
        {
          id: "template-3",
          name: "Momentum Rider",
          description: "Trend following with dynamic targets",
          type: "momentum",
          riskLevel: "medium",
          defaultSettings: {
            stopLossPercent: 3,
            takeProfitPercent: [5, 10, 15, 25],
            positionSizePercent: 15,
          },
        },
      ];
    },
  });

  // Control strategy
  const controlStrategy = useMutation({
    mutationFn: async ({
      strategyId: _strategyId,
      action: _action,
    }: { strategyId: string; action: "pause" | "resume" | "delete" }) => {
      // In real implementation, call API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: (_, { strategyId: _strategyId, action }) => {
      toast({
        title: "Strategy Updated",
        description: `Strategy ${action}d successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["trading-strategies"] });
    },
    onError: () => {
      toast({
        title: "Action Failed",
        description: "Failed to update strategy",
        variant: "destructive",
      });
    },
  });

  // Create new strategy
  const createStrategy = useMutation({
    mutationFn: async (params: { symbol: string; templateId: string }) => {
      const response = await fetch("/api/triggers/trading-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: params.symbol,
          templateId: params.templateId,
        }),
      });

      if (!response.ok) throw new Error("Failed to create strategy");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Strategy Created",
        description: "New trading strategy has been created",
      });
      queryClient.invalidateQueries({ queryKey: ["trading-strategies"] });
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create trading strategy",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Play className="h-4 w-4 text-green-500" />;
      case "paused":
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "low":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "high":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return "text-green-500";
    if (pnl < 0) return "text-red-500";
    return "text-gray-500";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeStrategies = strategies?.filter((s) => s.status === "active") || [];
  const completedStrategies = strategies?.filter((s) => s.status === "completed") || [];
  const totalPnL = strategies?.reduce((sum, s) => sum + s.pnl, 0) || 0;
  const avgWinRate = strategies?.length
    ? strategies.reduce((sum, s) => sum + s.winRate, 0) / strategies.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Strategies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStrategies.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPnLColor(totalPnL)}`}>
              ${totalPnL > 0 ? "+" : ""}
              {totalPnL.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all strategies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgWinRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Average success rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">AI Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {strategies
                ? (
                    strategies.reduce((sum, s) => sum + s.confidence, 0) / strategies.length
                  ).toFixed(0)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground mt-1">Average AI confidence</p>
          </CardContent>
        </Card>
      </div>

      {/* Strategy Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="active">Active ({activeStrategies.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedStrategies.length})</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>
          <Button
            onClick={() => {
              // In real app, open create strategy dialog
              createStrategy.mutate({ symbol: "BTCUSDT", templateId: "template-1" });
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Strategy
          </Button>
        </div>

        <TabsContent value="active" className="space-y-4">
          {activeStrategies.map((strategy) => (
            <Card key={strategy.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Brain className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{strategy.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {strategy.symbol}
                        <Badge variant="outline" className={getRiskColor(strategy.riskLevel)}>
                          {strategy.riskLevel} risk
                        </Badge>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(strategy.status)}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        controlStrategy.mutate({
                          strategyId: strategy.id,
                          action: strategy.status === "active" ? "pause" : "resume",
                        })
                      }
                    >
                      {strategy.status === "active" ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedStrategy(strategy.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Price Info */}
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Entry</p>
                    <p className="font-medium">${strategy.entryPrice.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current</p>
                    <p className="font-medium">${strategy.currentPrice.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stop Loss</p>
                    <p className="font-medium text-red-500">
                      ${strategy.stopLoss.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">P&L</p>
                    <p className={`font-medium ${getPnLColor(strategy.pnl)}`}>
                      ${strategy.pnl > 0 ? "+" : ""}
                      {strategy.pnl.toFixed(2)} ({strategy.pnlPercentage.toFixed(2)}%)
                    </p>
                  </div>
                </div>

                {/* Take Profit Levels */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Take Profit Targets</p>
                  <div className="space-y-2">
                    {strategy.takeProfitLevels.map((level) => (
                      <div key={level.level} className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span>
                              Level {level.level} (+{level.percentage}%)
                            </span>
                            <span>${level.amount.toLocaleString()}</span>
                          </div>
                          <Progress
                            value={Math.min(
                              100,
                              ((strategy.currentPrice - strategy.entryPrice) /
                                (level.amount - strategy.entryPrice)) *
                                100
                            )}
                            className="h-2"
                          />
                        </div>
                        {level.reached && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Insights */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-start gap-2">
                    <Brain className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        AI Insights ({strategy.confidence}% confidence)
                      </p>
                      <p className="text-sm text-muted-foreground">{strategy.aiInsights}</p>
                    </div>
                  </div>
                </div>

                {/* Risk Metrics */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-muted-foreground">Max Drawdown</p>
                    <p className="font-medium">{strategy.riskMetrics.maxDrawdown}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Sharpe Ratio</p>
                    <p className="font-medium">{strategy.riskMetrics.sharpeRatio}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground">Risk/Reward</p>
                    <p className="font-medium">1:{strategy.riskMetrics.riskRewardRatio}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedStrategies.map((strategy) => (
            <Card key={strategy.id} className="opacity-90">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{strategy.name}</CardTitle>
                    <CardDescription>{strategy.symbol}</CardDescription>
                  </div>
                  <div className={`text-lg font-bold ${getPnLColor(strategy.pnl)}`}>
                    ${strategy.pnl > 0 ? "+" : ""}
                    {strategy.pnl.toFixed(2)} ({strategy.pnlPercentage.toFixed(2)}%)
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Completed {new Date(strategy.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {templates?.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="capitalize">{template.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Risk</span>
                      <Badge variant="outline" className={getRiskColor(template.riskLevel)}>
                        {template.riskLevel}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stop Loss</span>
                      <span>{template.defaultSettings.stopLossPercent}%</span>
                    </div>
                    <Button
                      className="w-full mt-4"
                      size="sm"
                      onClick={() =>
                        createStrategy.mutate({
                          symbol: "BTCUSDT",
                          templateId: template.id,
                        })
                      }
                    >
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
