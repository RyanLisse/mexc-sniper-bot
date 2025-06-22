"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  AlertTriangle,
  DollarSign,
  Download,
  Pause,
  Play,
  Settings,
  Target,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useState } from "react";

// Import the trading strategy types and manager
import {
  TRADING_STRATEGIES,
  type TradingStrategy,
  TradingStrategyManager,
} from "../services/trading-strategy-manager";

interface StrategyPerformance {
  strategyId: string;
  successRate: number;
  averageProfit: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

interface ActivePosition {
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  currentPnL: number;
  currentPnLPercentage: number;
  triggeredLevels: number;
  nextTarget: number;
}

export function StrategyManager() {
  const [strategyManager] = useState(() => new TradingStrategyManager());
  const [activeStrategy, setActiveStrategy] = useState<TradingStrategy>(
    strategyManager.getActiveStrategy()
  );
  const [selectedStrategyId, setSelectedStrategyId] = useState(activeStrategy.id);
  const [isActive, setIsActive] = useState(false);
  const [_loading, setLoading] = useState(false);

  // Mock data for demonstration
  const [strategyPerformance] = useState<Record<string, StrategyPerformance>>({
    normal: {
      strategyId: "normal",
      successRate: 78.5,
      averageProfit: 45.2,
      totalTrades: 127,
      winRate: 68.5,
      maxDrawdown: 12.3,
      sharpeRatio: 1.8,
    },
    highPriceIncrease: {
      strategyId: "highPriceIncrease",
      successRate: 65.2,
      averageProfit: 89.7,
      totalTrades: 89,
      winRate: 58.4,
      maxDrawdown: 22.1,
      sharpeRatio: 1.4,
    },
    conservative: {
      strategyId: "conservative",
      successRate: 85.3,
      averageProfit: 18.9,
      totalTrades: 203,
      winRate: 79.8,
      maxDrawdown: 6.7,
      sharpeRatio: 2.1,
    },
  });

  const [activePositions] = useState<ActivePosition[]>([
    {
      symbol: "BTCUSDT",
      entryPrice: 45000,
      currentPrice: 67500,
      quantity: 0.1,
      currentPnL: 2250,
      currentPnLPercentage: 50,
      triggeredLevels: 1,
      nextTarget: 90000,
    },
    {
      symbol: "ETHUSDT",
      entryPrice: 3200,
      currentPrice: 3840,
      quantity: 1.5,
      currentPnL: 960,
      currentPnLPercentage: 20,
      triggeredLevels: 0,
      nextTarget: 4800,
    },
  ]);

  const handleStrategySwitch = async (strategyId: string) => {
    setLoading(true);
    try {
      const success = strategyManager.switchStrategy(strategyId);
      if (success) {
        setActiveStrategy(strategyManager.getActiveStrategy());
        setSelectedStrategyId(strategyId);
      }
    } catch (error) {
      console.error("Failed to switch strategy:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStrategyBadgeColor = (strategyId: string) => {
    const performance = strategyPerformance[strategyId];
    if (!performance) return "secondary";

    if (performance.successRate >= 80) return "default"; // green
    if (performance.successRate >= 70) return "secondary"; // blue
    return "destructive"; // red
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Strategy Manager</h1>
          <p className="text-muted-foreground">
            Manage and optimize your multi-phase trading strategies
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Active" : "Inactive"}
          </Badge>
          <Button
            onClick={() => setIsActive(!isActive)}
            variant={isActive ? "destructive" : "default"}
          >
            {isActive ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {isActive ? "Pause Trading" : "Start Trading"}
          </Button>
        </div>
      </div>

      {/* Quick Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Strategy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeStrategy.name}</div>
            <p className="text-xs text-muted-foreground">
              {activeStrategy.levels.length} profit levels
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePositions.length}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(activePositions.reduce((sum, pos) => sum + pos.currentPnL, 0))} total
              PnL
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatPercentage(strategyPerformance[selectedStrategyId]?.successRate || 0)}
            </div>
            <Progress
              value={strategyPerformance[selectedStrategyId]?.successRate || 0}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatPercentage(strategyPerformance[selectedStrategyId]?.averageProfit || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {strategyPerformance[selectedStrategyId]?.totalTrades || 0} total trades
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="strategies" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="strategies">Strategy Selection</TabsTrigger>
          <TabsTrigger value="positions">Active Positions</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Strategy Selection Tab */}
        <TabsContent value="strategies" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.values(TRADING_STRATEGIES).map((strategy) => {
              const performance = strategyPerformance[strategy.id];
              const isSelected = strategy.id === selectedStrategyId;

              return (
                <Card
                  key={strategy.id}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? "ring-2 ring-primary" : "hover:bg-muted/50"
                  }`}
                  onClick={() => handleStrategySwitch(strategy.id)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{strategy.name}</CardTitle>
                      <Badge variant={getStrategyBadgeColor(strategy.id)}>
                        {isSelected ? "Active" : "Available"}
                      </Badge>
                    </div>
                    <CardDescription>{strategy.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Profit Levels:</span>
                        <span className="font-medium">{strategy.levels.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Max Target:</span>
                        <span className="font-medium">
                          {formatPercentage(Math.max(...strategy.levels.map((l) => l.percentage)))}
                        </span>
                      </div>
                      {performance && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Success Rate:</span>
                            <span className="font-medium text-green-600">
                              {formatPercentage(performance.successRate)}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Avg. Profit:</span>
                            <span className="font-medium text-green-600">
                              {formatPercentage(performance.averageProfit)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Strategy Levels Preview */}
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Profit Levels:</h4>
                      {strategy.levels.slice(0, 3).map((level, index) => (
                        <div
                          key={index}
                          className="flex justify-between text-xs text-muted-foreground"
                        >
                          <span>Level {index + 1}:</span>
                          <span>
                            {formatPercentage(level.sellPercentage)} @ +
                            {formatPercentage(level.percentage)}
                          </span>
                        </div>
                      ))}
                      {strategy.levels.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{strategy.levels.length - 3} more levels...
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Strategy Details */}
          <Card>
            <CardHeader>
              <CardTitle>Strategy Details: {activeStrategy.name}</CardTitle>
              <CardDescription>
                Complete breakdown of profit-taking levels and targets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Level</TableHead>
                    <TableHead>Target %</TableHead>
                    <TableHead>Multiplier</TableHead>
                    <TableHead>Sell %</TableHead>
                    <TableHead>Expected Return</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeStrategy.levels.map((level, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">Level {index + 1}</TableCell>
                      <TableCell>{formatPercentage(level.percentage)}</TableCell>
                      <TableCell>{level.multiplier.toFixed(2)}x</TableCell>
                      <TableCell>{formatPercentage(level.sellPercentage)}</TableCell>
                      <TableCell className="text-green-600">
                        {formatPercentage(level.percentage * (level.sellPercentage / 100))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Positions Tab */}
        <TabsContent value="positions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Positions</CardTitle>
              <CardDescription>
                Monitor your current positions and profit-taking progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Entry Price</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>PnL</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Next Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activePositions.map((position, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{position.symbol}</TableCell>
                      <TableCell>{formatCurrency(position.entryPrice)}</TableCell>
                      <TableCell>{formatCurrency(position.currentPrice)}</TableCell>
                      <TableCell>{position.quantity}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span
                            className={`font-medium ${position.currentPnL >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {formatCurrency(position.currentPnL)}
                          </span>
                          <span
                            className={`text-xs ${position.currentPnLPercentage >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {formatPercentage(position.currentPnLPercentage)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>
                              Levels: {position.triggeredLevels}/{activeStrategy.levels.length}
                            </span>
                          </div>
                          <Progress
                            value={(position.triggeredLevels / activeStrategy.levels.length) * 100}
                            className="h-2"
                          />
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(position.nextTarget)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.values(strategyPerformance).map((perf) => {
              const strategy = TRADING_STRATEGIES[perf.strategyId];
              return (
                <Card key={perf.strategyId}>
                  <CardHeader>
                    <CardTitle className="text-lg">{strategy?.name || perf.strategyId}</CardTitle>
                    <CardDescription>Performance Metrics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Success Rate:</span>
                        <span className="font-medium text-green-600">
                          {formatPercentage(perf.successRate)}
                        </span>
                      </div>
                      <Progress value={perf.successRate} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Win Rate:</span>
                        <span className="font-medium">{formatPercentage(perf.winRate)}</span>
                      </div>
                      <Progress value={perf.winRate} className="h-2" />
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Avg. Profit</div>
                        <div className="font-medium text-green-600">
                          {formatPercentage(perf.averageProfit)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Total Trades</div>
                        <div className="font-medium">{perf.totalTrades}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Max Drawdown</div>
                        <div className="font-medium text-red-600">
                          {formatPercentage(perf.maxDrawdown)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Sharpe Ratio</div>
                        <div className="font-medium">{perf.sharpeRatio.toFixed(2)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Strategy Import/Export</CardTitle>
                <CardDescription>Manage your strategy configurations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex space-x-2">
                  <Button variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Export Strategy
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Strategy
                  </Button>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Always test imported strategies with small amounts before full deployment.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Management</CardTitle>
                <CardDescription>Configure risk parameters and safety limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Max Position Size:</span>
                    <span className="font-medium">$10,000</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Max Daily Loss:</span>
                    <span className="font-medium">5%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Max Drawdown:</span>
                    <span className="font-medium">15%</span>
                  </div>
                </div>

                <Button variant="outline" className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Risk Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
