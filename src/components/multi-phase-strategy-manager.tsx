"use client";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Progress } from "@/src/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";
import { useToast } from "@/src/components/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useState } from "react";

// ===========================================
// MULTI-PHASE STRATEGY MANAGER
// ===========================================

interface TradingStrategy {
  id: number;
  name: string;
  symbol: string;
  status: "pending" | "active" | "paused" | "completed" | "failed" | "cancelled";
  entryPrice: number;
  currentPrice?: number;
  positionSize: number;
  positionSizeUsdt: number;
  levels: {
    percentage: number;
    multiplier: number;
    sellPercentage: number;
  }[];
  executedPhases: number;
  totalPhases: number;
  totalPnl?: number;
  totalPnlPercent?: number;
  realizedPnl?: number;
  unrealizedPnl?: number;
  remainingPosition?: number;
  confidenceScore?: number;
  aiInsights?: string;
  createdAt: string;
  activatedAt?: string;
  completedAt?: string;
}

interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  riskLevel: "low" | "medium" | "high";
  category: string;
  estimatedDuration: string;
  suitableFor: string[];
  levels?: {
    percentage: number;
    multiplier: number;
    sellPercentage: number;
  }[];
}

interface CreateStrategyData {
  name: string;
  symbol: string;
  vcoinId?: string;
  entryPrice: number;
  positionSize: number;
  positionSizeUsdt: number;
  stopLossPercent: number;
  description?: string;
  strategyType: "predefined" | "custom";
  templateId?: string;
  customLevels?: {
    percentage: number;
    multiplier: number;
    sellPercentage: number;
  }[];
}

export function MultiPhaseStrategyManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_selectedStrategy, setSelectedStrategy] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("active");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createFormData, setCreateFormData] = useState<Partial<CreateStrategyData>>({
    strategyType: "predefined",
    stopLossPercent: 15,
  });

  // Fetch strategies
  const { data: strategiesData, isLoading } = useQuery({
    queryKey: ["strategies"],
    queryFn: async () => {
      const response = await fetch("/api/strategies");
      if (!response.ok) throw new Error("Failed to fetch strategies");
      return response.json();
    },
    refetchInterval: 5000,
  });

  // Fetch strategy templates
  const { data: templatesData } = useQuery({
    queryKey: ["strategy-templates"],
    queryFn: async () => {
      const response = await fetch("/api/strategies/templates");
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });

  // Create strategy mutation
  const createStrategy = useMutation({
    mutationFn: async (data: CreateStrategyData) => {
      const response = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create strategy");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Strategy Created",
        description: "Multi-phase strategy has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      setShowCreateDialog(false);
      setCreateFormData({ strategyType: "predefined", stopLossPercent: 15 });
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create strategy",
        variant: "destructive",
      });
    },
  });

  // Control strategy mutation
  const controlStrategy = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: string }) => {
      const response = await fetch(`/api/strategies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });
      if (!response.ok) throw new Error("Failed to update strategy");
      return response.json();
    },
    onSuccess: (_, { action }) => {
      toast({
        title: "Strategy Updated",
        description: `Strategy ${action} successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
    },
    onError: () => {
      toast({
        title: "Action Failed",
        description: "Failed to update strategy",
        variant: "destructive",
      });
    },
  });

  const strategies = strategiesData?.data?.strategies || [];
  const summary = strategiesData?.data?.summary || {
    total: 0,
    active: 0,
    totalPnl: 0,
    totalInvested: 0,
    avgPnlPercent: 0,
  };

  const activeStrategies = strategies.filter((s: TradingStrategy) => s.status === "active");
  const completedStrategies = strategies.filter((s: TradingStrategy) => s.status === "completed");
  const allTemplates = templatesData?.data || { predefined: [], quickStart: [], advanced: [] };

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

  const handleCreateStrategy = () => {
    if (
      !createFormData.name ||
      !createFormData.symbol ||
      !createFormData.entryPrice ||
      !createFormData.positionSizeUsdt
    ) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createStrategy.mutate(createFormData as CreateStrategyData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Active Strategies</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.active}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPnLColor(summary.totalPnl)}`}>
              ${summary.totalPnl > 0 ? "+" : ""}
              {summary.totalPnl.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.avgPnlPercent > 0 ? "+" : ""}
              {summary.avgPnlPercent.toFixed(1)}% avg
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary.totalInvested.toFixed(0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all strategies</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Avg Phases</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {strategies.length > 0
                ? (
                    strategies.reduce((sum: number, s: TradingStrategy) => sum + s.totalPhases, 0) /
                    strategies.length
                  ).toFixed(1)
                : "0"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per strategy</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">AI Confidence</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {strategies.length > 0
                ? (
                    strategies.reduce(
                      (sum: number, s: TradingStrategy) => sum + (s.confidenceScore || 0),
                      0
                    ) / strategies.length
                  ).toFixed(0)
                : "0"}
              %
            </div>
            <p className="text-xs text-muted-foreground mt-1">Average confidence</p>
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

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Multi-Phase Strategy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Multi-Phase Strategy</DialogTitle>
                <DialogDescription>
                  Set up a new multi-phase take profit strategy with automated execution phases.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Strategy Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., BTC Multi-Phase"
                      value={createFormData.name || ""}
                      onChange={(e) =>
                        setCreateFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="symbol">Symbol</Label>
                    <Input
                      id="symbol"
                      placeholder="e.g., BTCUSDT"
                      value={createFormData.symbol || ""}
                      onChange={(e) =>
                        setCreateFormData((prev) => ({
                          ...prev,
                          symbol: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="entryPrice">Entry Price ($)</Label>
                    <Input
                      id="entryPrice"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={createFormData.entryPrice || ""}
                      onChange={(e) =>
                        setCreateFormData((prev) => ({
                          ...prev,
                          entryPrice: Number.parseFloat(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="positionSizeUsdt">Position Size (USDT)</Label>
                    <Input
                      id="positionSizeUsdt"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={createFormData.positionSizeUsdt || ""}
                      onChange={(e) =>
                        setCreateFormData((prev) => ({
                          ...prev,
                          positionSizeUsdt: Number.parseFloat(e.target.value),
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stopLoss">Stop Loss (%)</Label>
                    <Input
                      id="stopLoss"
                      type="number"
                      step="0.1"
                      placeholder="15"
                      value={createFormData.stopLossPercent || ""}
                      onChange={(e) =>
                        setCreateFormData((prev) => ({
                          ...prev,
                          stopLossPercent: Number.parseFloat(e.target.value),
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="strategyType">Strategy Type</Label>
                  <Select
                    value={createFormData.strategyType}
                    onValueChange={(value) =>
                      setCreateFormData((prev) => ({
                        ...prev,
                        strategyType: value as "predefined" | "custom",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="predefined">Predefined Template</SelectItem>
                      <SelectItem value="custom">Custom Strategy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {createFormData.strategyType === "predefined" && (
                  <div className="space-y-2">
                    <Label htmlFor="template">Template</Label>
                    <Select
                      value={createFormData.templateId}
                      onValueChange={(value) =>
                        setCreateFormData((prev) => ({ ...prev, templateId: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {allTemplates.predefined?.map((template: StrategyTemplate) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name} - {template.riskLevel} risk
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Strategy notes and objectives..."
                    value={createFormData.description || ""}
                    onChange={(e) =>
                      setCreateFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateStrategy} disabled={createStrategy.isPending}>
                    {createStrategy.isPending ? "Creating..." : "Create Strategy"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="active" className="space-y-4">
          {activeStrategies.map((strategy: TradingStrategy) => (
            <Card key={strategy.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{strategy.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        {strategy.symbol}
                        <Badge variant="outline" className="text-xs">
                          {strategy.executedPhases}/{strategy.totalPhases} phases
                        </Badge>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(strategy.status)}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedStrategy(strategy.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        controlStrategy.mutate({
                          id: strategy.id,
                          action: strategy.status === "active" ? "paused" : "active",
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
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Price Info */}
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Entry Price</p>
                    <p className="font-medium">${strategy.entryPrice.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current Price</p>
                    <p className="font-medium">
                      {strategy.currentPrice
                        ? `$${strategy.currentPrice.toLocaleString()}`
                        : "Not available"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Position Size</p>
                    <p className="font-medium">${strategy.positionSizeUsdt.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total P&L</p>
                    <p className={`font-medium ${getPnLColor(strategy.totalPnl || 0)}`}>
                      ${strategy.totalPnl ? (strategy.totalPnl > 0 ? "+" : "") : ""}
                      {(strategy.totalPnl || 0).toFixed(2)} (
                      {(strategy.totalPnlPercent || 0).toFixed(2)}%)
                    </p>
                  </div>
                </div>

                {/* Phase Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Phase Progress</span>
                    <span className="text-muted-foreground">
                      {strategy.executedPhases}/{strategy.totalPhases} completed
                    </span>
                  </div>
                  <Progress
                    value={(strategy.executedPhases / strategy.totalPhases) * 100}
                    className="h-2"
                  />
                </div>

                {/* Phase Levels */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Take Profit Phases</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {strategy.levels.slice(0, 4).map((level, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded border ${
                          index < strategy.executedPhases
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex justify-between">
                          <span>Phase {index + 1}</span>
                          {index < strategy.executedPhases && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {level.sellPercentage}% @ +{level.percentage}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Insights */}
                {strategy.aiInsights && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start gap-2">
                      <Brain className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          AI Insights ({(strategy.confidenceScore || 0).toFixed(0)}% confidence)
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {strategy.aiInsights}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {activeStrategies.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Strategies</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first multi-phase strategy to start automated profit taking.
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Strategy
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedStrategies.map((strategy: TradingStrategy) => (
            <Card key={strategy.id} className="opacity-90">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{strategy.name}</CardTitle>
                    <CardDescription>{strategy.symbol}</CardDescription>
                  </div>
                  <div className={`text-lg font-bold ${getPnLColor(strategy.totalPnl || 0)}`}>
                    ${strategy.totalPnl ? (strategy.totalPnl > 0 ? "+" : "") : ""}
                    {(strategy.totalPnl || 0).toFixed(2)} (
                    {(strategy.totalPnlPercent || 0).toFixed(2)}%)
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    Completed{" "}
                    {new Date(strategy.completedAt || strategy.createdAt).toLocaleDateString()}
                  </span>
                  <span>
                    {strategy.executedPhases}/{strategy.totalPhases} phases executed
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="space-y-6">
            {/* Predefined Templates */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Predefined Strategies</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {allTemplates.predefined?.map((template: StrategyTemplate) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Risk Level</span>
                          <Badge variant="outline" className={getRiskColor(template.riskLevel)}>
                            {template.riskLevel}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duration</span>
                          <span>{template.estimatedDuration}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Category</span>
                          <span>{template.category}</span>
                        </div>
                        <Button
                          className="w-full mt-4"
                          size="sm"
                          onClick={() => {
                            setCreateFormData((prev) => ({
                              ...prev,
                              templateId: template.id,
                              strategyType: "predefined",
                            }));
                            setShowCreateDialog(true);
                          }}
                        >
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Quick Start Templates */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Quick Start</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {allTemplates.quickStart?.map((template: StrategyTemplate) => (
                  <Card key={template.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Risk Level</span>
                          <Badge variant="outline" className={getRiskColor(template.riskLevel)}>
                            {template.riskLevel}
                          </Badge>
                        </div>
                        <Button
                          className="w-full mt-4"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Handle quick start template creation
                            toast({
                              title: "Quick Start",
                              description: "Quick start templates coming soon!",
                            });
                          }}
                        >
                          Quick Setup
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Advanced Patterns */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Advanced Patterns</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {allTemplates.advanced?.map((template: StrategyTemplate) => (
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
                        <Button
                          className="w-full mt-4"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // Handle advanced pattern creation
                            toast({
                              title: "Advanced Pattern",
                              description: "Advanced patterns coming soon!",
                            });
                          }}
                        >
                          Build Pattern
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
