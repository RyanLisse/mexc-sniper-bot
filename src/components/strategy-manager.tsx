"use client";

import {
  Activity,
  AlertTriangle,
  DollarSign,
  Download,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Target,
  TrendingUp,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useState } from "react";
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
import { useToast } from "@/components/ui/use-toast";
// Import the new strategy management hook
import { useStrategyManagement, useActivePositionsMonitor } from "@/src/hooks/use-strategy-management";

export function StrategyManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Use the new strategy management hook
  const {
    strategyData,
    activeStrategy,
    availableStrategies,
    strategyPerformance,
    tradingStatus,
    metrics,
    isLoading,
    error,
    switchStrategy,
    toggleTrading,
    isRealTimeEnabled,
    enableRealTime,
    disableRealTime,
    forceRefresh,
    isUpdating,
    updateError,
  } = useStrategyManagement();

  // Use positions monitoring hook
  const {
    positions: activePositions,
    totalPnL,
    positionCount,
  } = useActivePositionsMonitor();

  const selectedStrategyId = activeStrategy?.id || 'normal';

  const handleStrategySwitch = async (strategyId: string) => {
    setLoading(true);
    try {
      await switchStrategy(strategyId);
      
      toast({
        title: "Strategy Updated",
        description: `Successfully switched to ${availableStrategies.find(s => s.id === strategyId)?.name || strategyId}`,
      });
    } catch (error) {
      console.error("Failed to switch strategy:", error);
      toast({
        title: "Strategy Switch Failed",
        description: error instanceof Error ? error.message : "Failed to switch strategy",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTrading = async () => {
    try {
      await toggleTrading(!tradingStatus.isActive);
      
      toast({
        title: tradingStatus.isActive ? "Trading Stopped" : "Trading Started",
        description: tradingStatus.isActive 
          ? "Auto-sniping has been stopped" 
          : "Auto-sniping has been started",
      });
    } catch (error) {
      console.error("Failed to toggle trading:", error);
      toast({
        title: "Trading Toggle Failed",
        description: error instanceof Error ? error.message : "Failed to toggle trading",
        variant: "destructive",
      });
    }
  };

  // Show loading state
  if (isLoading && !strategyData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Strategy Manager</h1>
            <p className="text-muted-foreground">Loading strategy data...</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-muted animate-pulse rounded mb-2"></div>
                <div className="h-8 bg-muted animate-pulse rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Strategy Manager</h1>
            <p className="text-muted-foreground">Failed to load strategy data</p>
          </div>
          <Button onClick={forceRefresh} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : "Failed to load strategy data"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fallback to empty state if no data
  if (!activeStrategy) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Strategy Manager</h1>
            <p className="text-muted-foreground">No strategy data available</p>
          </div>
        </div>
      </div>
    );
  }

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
          {/* Real-time status indicator */}
          <div className="flex items-center space-x-2 mt-2">
            <div className="flex items-center space-x-1">
              {isRealTimeEnabled ? (
                <Wifi className="h-3 w-3 text-green-500" />
              ) : (
                <WifiOff className="h-3 w-3 text-gray-500" />
              )}
              <span className="text-xs text-muted-foreground">
                {isRealTimeEnabled ? "Live Updates" : "Static Data"}
              </span>
            </div>
            {updateError && (
              <span className="text-xs text-red-500">
                Update Failed
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Real-time toggle */}
          <Button
            onClick={isRealTimeEnabled ? disableRealTime : enableRealTime}
            variant="outline"
            size="sm"
          >
            {isRealTimeEnabled ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
          </Button>
          
          {/* Refresh button */}
          <Button
            onClick={forceRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          
          {/* Health status badge */}
          <Badge variant={tradingStatus.healthStatus ? "default" : "destructive"}>
            {tradingStatus.healthStatus ? "Healthy" : "Unhealthy"}
          </Badge>
          
          {/* Trading status badge */}
          <Badge variant={tradingStatus.isActive ? "default" : "secondary"}>
            {tradingStatus.isActive ? "Active" : "Inactive"}
          </Badge>
          
          {/* Paper trading indicator */}
          {tradingStatus.paperTradingMode && (
            <Badge variant="outline">
              Paper Trading
            </Badge>
          )}
          
          {/* Main trading toggle */}
          <Button
            onClick={handleToggleTrading}
            variant={tradingStatus.isActive ? "destructive" : "default"}
            disabled={isUpdating || !tradingStatus.tradingEnabled}
          >
            {tradingStatus.isActive ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {tradingStatus.isActive ? "Pause Trading" : "Start Trading"}
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
            <div className="text-2xl font-bold">{positionCount}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(totalPnL)} total PnL
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
              {formatPercentage(metrics.successRate)}
            </div>
            <Progress
              value={metrics.successRate}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total PnL</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(metrics.totalPnL)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalTrades} total trades
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
            {availableStrategies.map((strategy) => {
              const performance = strategyPerformance[strategy.id];
              const isSelected = strategy.id === selectedStrategyId;

              return (
                <Card
                  key={strategy.id}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? "ring-2 ring-primary" : "hover:bg-muted/50"
                  } ${(loading || isUpdating) ? "opacity-50 pointer-events-none" : ""}`}
                  onClick={() => !loading && !isUpdating && handleStrategySwitch(strategy.id)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{strategy.name}</CardTitle>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getStrategyBadgeColor(strategy.id)}>
                          {isSelected ? "Active" : "Available"}
                        </Badge>
                        {(loading || isUpdating) && isSelected && (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />
                        )}
                      </div>
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
                          <div className="flex justify-between text-sm">
                            <span>Total Trades:</span>
                            <span className="font-medium">
                              {performance.totalTrades}
                            </span>
                          </div>
                        </>
                      )}
                      {!performance && (
                        <div className="text-xs text-muted-foreground">
                          No performance data available
                        </div>
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
          {/* Overall Performance Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Overall Performance Summary</CardTitle>
              <CardDescription>
                Real-time performance metrics from Core Trading Service
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(metrics.totalPnL)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total PnL</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatPercentage(metrics.successRate)}
                  </div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {metrics.totalTrades}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Trades</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {Math.floor(metrics.uptime / 1000 / 60)} min
                  </div>
                  <div className="text-sm text-muted-foreground">Uptime</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Individual Strategy Performance */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.values(strategyPerformance).map((perf) => {
              const strategy = availableStrategies.find(s => s.id === perf.strategyId);
              const isActiveStrategy = perf.strategyId === selectedStrategyId;
              
              return (
                <Card key={perf.strategyId} className={isActiveStrategy ? "ring-2 ring-primary" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{strategy?.name || perf.strategyId}</CardTitle>
                      {isActiveStrategy && (
                        <Badge variant="default">Active</Badge>
                      )}
                    </div>
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

          {/* Performance Notice */}
          {Object.keys(strategyPerformance).length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Performance Data Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Performance metrics will appear here once trading strategies start executing trades.
                </p>
                <Button 
                  onClick={handleToggleTrading} 
                  disabled={tradingStatus.isActive || !tradingStatus.tradingEnabled}
                >
                  {tradingStatus.isActive ? "Trading Active" : "Start Trading"}
                </Button>
              </CardContent>
            </Card>
          )}
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
