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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { useMexcCalendar } from "@/src/hooks/use-mexc-data";
import { usePatternSniper } from "@/src/hooks/use-pattern-sniper";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Eye,
  Target,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";

interface CoinListingCardProps {
  coin: {
    vcoinId: string;
    symbol: string;
    projectName?: string;
    launchTime: Date;
    status: "calendar" | "monitoring" | "ready" | "executed";
    confidence?: number;
    hoursAdvanceNotice?: number;
    priceDecimalPlaces?: number;
    quantityDecimalPlaces?: number;
    discoveredAt?: Date;
  };
  onExecute?: () => void;
  onRemove?: () => void;
}

function CoinListingCard({ coin, onExecute, onRemove }: CoinListingCardProps) {
  const getStatusColor = () => {
    switch (coin.status) {
      case "calendar":
        return "bg-blue-500/10 border-blue-500/20 text-blue-400";
      case "monitoring":
        return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
      case "ready":
        return "bg-green-500/10 border-green-500/20 text-green-400";
      case "executed":
        return "bg-purple-500/10 border-purple-500/20 text-purple-400";
    }
  };

  const getStatusIcon = () => {
    switch (coin.status) {
      case "calendar":
        return <Clock className="h-4 w-4" />;
      case "monitoring":
        return <Eye className="h-4 w-4" />;
      case "ready":
        return <Target className="h-4 w-4" />;
      case "executed":
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  const getStatusBadge = () => {
    switch (coin.status) {
      case "calendar":
        return "Upcoming";
      case "monitoring":
        return "Monitoring";
      case "ready":
        return "Ready";
      case "executed":
        return "Executed";
    }
  };

  const timeToLaunch = coin.launchTime.getTime() - Date.now();
  const hoursToLaunch = timeToLaunch / (1000 * 60 * 60);

  return (
    <div className={`p-4 rounded-lg border ${getStatusColor()} transition-all hover:scale-[1.02]`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{coin.symbol}</h3>
            <Badge variant="outline" className={getStatusColor()}>
              <span className="flex items-center gap-1">
                {getStatusIcon()}
                {getStatusBadge()}
              </span>
            </Badge>
            {coin.confidence && (
              <Badge variant="secondary" className="text-xs">
                {coin.confidence}% confidence
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">{coin.projectName || coin.symbol}</p>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3" />
              Launch: {coin.launchTime.toLocaleString()}
            </span>
            {hoursToLaunch > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {hoursToLaunch.toFixed(1)}h to launch
              </span>
            )}
            {coin.hoursAdvanceNotice && (
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {coin.hoursAdvanceNotice.toFixed(1)}h advance
              </span>
            )}
          </div>

          {(coin.priceDecimalPlaces !== undefined || coin.quantityDecimalPlaces !== undefined) && (
            <div className="flex gap-2 text-xs">
              <Badge variant="secondary">Price: {coin.priceDecimalPlaces} decimals</Badge>
              <Badge variant="secondary">Qty: {coin.quantityDecimalPlaces} decimals</Badge>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {coin.status === "ready" && onExecute && (
            <Button size="sm" onClick={onExecute} className="bg-green-600 hover:bg-green-700">
              <Zap className="h-4 w-4 mr-1" />
              Execute
            </Button>
          )}
          {onRemove && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRemove}
              className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to filter upcoming coins
function filterUpcomingCoins(calendarData: any[]) {
  return calendarData.filter((item) => {
    try {
      const launchTime = new Date(item.firstOpenTime);
      const now = new Date();
      return launchTime.getTime() > now.getTime();
    } catch {
      return false;
    }
  });
}

// Helper function to enrich calendar data with status
function enrichCalendarData(
  calendarData: any[],
  pendingDetection: string[],
  readyTargets: any[],
  executedTargets: string[]
) {
  return calendarData
    .map((item) => {
      const isPending = pendingDetection.includes(item.vcoinId);
      const isReady = readyTargets.some((target) => target.vcoinId === item.vcoinId);
      const isExecuted = executedTargets.includes(item.vcoinId);

      let status: "calendar" | "monitoring" | "ready" | "executed" = "calendar";
      if (isExecuted) status = "executed";
      else if (isReady) status = "ready";
      else if (isPending) status = "monitoring";

      return {
        ...item,
        status,
        launchTime: new Date(item.firstOpenTime),
      };
    })
    .sort((a, b) => a.launchTime.getTime() - b.launchTime.getTime());
}

// Helper function to process executed targets
function processExecutedTargets(executedTargets: string[], enrichedCalendarData: any[]) {
  return executedTargets
    .map((vcoinId) => {
      const calendarEntry = enrichedCalendarData.find((coin) => coin.vcoinId === vcoinId);
      if (!calendarEntry) return null;
      return {
        ...calendarEntry,
        status: "executed" as const,
      };
    })
    .filter((coin) => coin !== null);
}

export function CoinListingsBoard() {
  const {
    isMonitoring,
    isLoading,
    readyTargets,
    pendingDetection,
    executedTargets,
    stats,
    errors,
    startMonitoring,
    stopMonitoring,
    removeTarget,
    executeSnipe,
    forceRefresh,
    clearAllTargets,
  } = usePatternSniper();

  const { data: calendarData, isLoading: calendarLoading } = useMexcCalendar();

  // Process calendar data
  const upcomingCoins = Array.isArray(calendarData) ? filterUpcomingCoins(calendarData) : [];
  const enrichedCalendarData = enrichCalendarData(
    upcomingCoins,
    pendingDetection,
    readyTargets,
    executedTargets
  );

  const calendarTargets = enrichedCalendarData.filter((c) => c.status === "calendar");
  const monitoringTargets = enrichedCalendarData.filter((c) => c.status === "monitoring");
  const readyTargetsEnriched = readyTargets.map((target) => ({
    ...target,
    status: "ready" as const,
  }));
  const executedTargetsEnriched = processExecutedTargets(executedTargets, enrichedCalendarData);

  return (
    <div className="space-y-6">
      {/* System Control Bar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Pattern Sniper System
              </CardTitle>
              <CardDescription>Real-time pattern detection for new MEXC listings</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isMonitoring ? "default" : "secondary"} className="px-3 py-1">
                <Activity className={`h-3 w-3 mr-1 ${isMonitoring ? "animate-pulse" : ""}`} />
                {isMonitoring ? "Active" : "Inactive"}
              </Badge>
              <Button
                onClick={isMonitoring ? stopMonitoring : startMonitoring}
                variant={isMonitoring ? "destructive" : "default"}
                disabled={isLoading}
              >
                {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
              </Button>
              <Button onClick={forceRefresh} variant="outline" disabled={isLoading}>
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Listings</p>
                <p className="text-2xl font-bold">{stats.totalListings}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monitoring</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.pendingDetection}</p>
              </div>
              <Eye className="h-8 w-8 text-yellow-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ready to Snipe</p>
                <p className="text-2xl font-bold text-green-400">{stats.readyToSnipe}</p>
              </div>
              <Target className="h-8 w-8 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold text-purple-400">
                  {stats.successRate?.toFixed(1) || 0}%
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-purple-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Errors Display */}
      {(errors.calendar || errors.symbols) && (
        <Card className="border-red-500/20 bg-red-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              System Errors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {errors.calendar && (
              <p className="text-sm text-red-300">Calendar API: {errors.calendar.message}</p>
            )}
            {errors.symbols && (
              <p className="text-sm text-red-300">Symbols API: {errors.symbols.message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Coin Listings by Status */}
      <Card>
        <CardHeader>
          <CardTitle>Coin Listings</CardTitle>
          <CardDescription>All listings organized by their current status</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">
                All
                <Badge variant="secondary" className="ml-1">
                  {enrichedCalendarData.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="ready">
                Ready
                <Badge variant="secondary" className="ml-1 bg-green-500/20 text-green-400">
                  {readyTargetsEnriched.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="monitoring">
                Monitoring
                <Badge variant="secondary" className="ml-1 bg-yellow-500/20 text-yellow-400">
                  {monitoringTargets.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="upcoming">
                Upcoming
                <Badge variant="secondary" className="ml-1 bg-blue-500/20 text-blue-400">
                  {calendarTargets.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="executed">
                Executed
                <Badge variant="secondary" className="ml-1 bg-purple-500/20 text-purple-400">
                  {executedTargetsEnriched.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3">
              {enrichedCalendarData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No coin listings found</div>
              ) : (
                enrichedCalendarData.map((coin) => (
                  <CoinListingCard
                    key={coin.vcoinId}
                    coin={coin}
                    onExecute={
                      coin.status === "ready"
                        ? () => {
                            const target = readyTargets.find((t) => t.vcoinId === coin.vcoinId);
                            if (target) executeSnipe(target);
                          }
                        : undefined
                    }
                    onRemove={() => removeTarget(coin.vcoinId)}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="ready" className="space-y-3">
              {readyTargetsEnriched.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No coins ready to snipe
                </div>
              ) : (
                readyTargetsEnriched.map((target) => (
                  <CoinListingCard
                    key={target.vcoinId}
                    coin={target}
                    onExecute={() => executeSnipe(target)}
                    onRemove={() => removeTarget(target.vcoinId)}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-3">
              {monitoringTargets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No coins being monitored
                </div>
              ) : (
                monitoringTargets.map((coin) => (
                  <CoinListingCard
                    key={coin.vcoinId}
                    coin={coin}
                    onRemove={() => removeTarget(coin.vcoinId)}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="upcoming" className="space-y-3">
              {calendarTargets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No upcoming listings</div>
              ) : (
                calendarTargets.map((coin) => <CoinListingCard key={coin.vcoinId} coin={coin} />)
              )}
            </TabsContent>

            <TabsContent value="executed" className="space-y-3">
              {executedTargetsEnriched.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No executed trades</div>
              ) : (
                executedTargetsEnriched.map((target) => (
                  <CoinListingCard key={target.vcoinId} coin={target} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
