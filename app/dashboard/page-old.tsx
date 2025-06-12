"use client";

import { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import {
  TrendingUp,
  Bot,
  Activity,
  Target,
  Eye,
  Zap,
  AlertTriangle,
  Clock,
  DollarSign,
  ArrowUpRight,
  Loader2,
  RefreshCw,
  Play,
  Pause,
  Settings,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { CoinCalendar } from "@/src/components/coin-calendar";
import { UserPreferences } from "@/src/components/user-preferences";
import { EmergencyDashboard } from "@/src/components/emergency-dashboard";
import { useMexcCalendar, useMexcConnectivity, useRefreshMexcCalendar, useUpcomingLaunches, useReadyTargets, useMexcAccount } from "@/src/hooks/use-mexc-data";
import { AccountBalance } from "@/src/components/account-balance";
import { usePatternSniper } from "@/src/hooks/use-pattern-sniper";
import { useAuth } from "@/src/lib/auth-client";
import { UserMenu } from "@/src/components/user-menu";
import { useRouter } from "next/navigation";
// import { ExitStrategySelector } from "@/src/components/exit-strategy-selector";
// import { useExitStrategyPreferences, useUpdateExitStrategyPreferences } from "@/src/hooks/use-user-preferences";
// import type { ExitStrategy } from "@/src/types/exit-strategies";
// import { useAutoExitManager, usePortfolio } from "@/src/hooks/use-portfolio";

interface WorkflowStatus {
  systemStatus: "running" | "stopped" | "error";
  lastUpdate: string;
  activeWorkflows: string[];
  metrics: {
    readyTokens: number;
    totalDetections: number;
    successfulSnipes: number;
    totalProfit: number;
    successRate: number;
    averageROI: number;
    bestTrade: number;
  };
  recentActivity: Array<{
    id: string;
    type: "pattern" | "calendar" | "snipe" | "analysis";
    message: string;
    timestamp: string;
  }>;
}


export default function DashboardPage() {
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiscoveryRunning, setIsDiscoveryRunning] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showPreferences, setShowPreferences] = useState(false);
  const [showExitStrategy, setShowExitStrategy] = useState(false);

  // Get user info (middleware handles authentication protection)
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id || "anonymous";

  // TanStack Query hooks for real MEXC data
  const { data: calendarData, isLoading: calendarLoading, error: calendarError } = useMexcCalendar();
  const { data: mexcConnected } = useMexcConnectivity();
  const { data: accountData, isLoading: accountLoading, error: accountError } = useMexcAccount(userId);
  // const { data: upcomingLaunches, count: upcomingCount } = useUpcomingLaunches();
  // const { data: readyTargets, count: readyCount } = useReadyTargets();
  const refreshCalendar = useRefreshMexcCalendar();

  // Pattern Sniper integration
  const {
    isMonitoring,
    isConnected: sniperConnected,
    calendarTargets,
    pendingDetection,
    readyTargets: sniperReadyTargets,
    // executedTargets,
    stats: sniperStats,
    startMonitoring,
    stopMonitoring,
    clearAllTargets,
    forceRefresh,
    executeSnipe,
    removeTarget,
    errors: sniperErrors,
  } = usePatternSniper();

  // Exit Strategy preferences
  // const exitStrategyPrefs = useExitStrategyPreferences(userId);
  // const updateExitStrategy = useUpdateExitStrategyPreferences();

  // Auto Exit Manager
  // const autoExitManager = useAutoExitManager();

  // Portfolio data
  // const { data: portfolioData, isLoading: portfolioLoading } = usePortfolio(userId);

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 10000); // Faster refresh for trading data
    
    // Fallback timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Dashboard loading timeout reached, forcing load');
        setIsLoading(false);
      }
    }, 5000); // 5 second timeout
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isLoading]);

  // Auto-start pattern sniper when dashboard loads (auto-snipe by default)
  useEffect(() => {
    if (!isMonitoring && !isLoading && user) {
      console.log("🚀 Auto-starting pattern sniper for auto-snipe...");
      startMonitoring();
    }
  }, [isMonitoring, isLoading, user, startMonitoring]);

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/workflow-status');
      if (response.ok) {
        const data = await response.json();
        setWorkflowStatus(data);
        setIsDiscoveryRunning(data.systemStatus === "running");
      }
    } catch (error) {
      console.error('Failed to fetch workflow status:', error);
    } finally {
      setIsLoading(false);
      setLastRefresh(new Date());
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const togglePatternDiscovery = async () => {
    try {
      setIsLoading(true);
      const action = isDiscoveryRunning ? 'stop_monitoring' : 'start_monitoring';
      
      // Control scheduled monitoring
      const scheduleResponse = await fetch('/api/schedule/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (scheduleResponse.ok && action === 'start_monitoring') {
        // Also trigger immediate workflows
        await fetch('/api/triggers/calendar-poll', {
          method: 'POST',
        });
        
        await fetch('/api/triggers/pattern-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ symbols: [] }),
        });
      }

      await fetchSystemStatus();
    } catch (error) {
      console.error('Failed to toggle pattern discovery:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const runDiscoveryCycle = async () => {
    try {
      setIsLoading(true);
      
      // Force immediate comprehensive analysis
      const forceResponse = await fetch('/api/schedule/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'force_analysis',
          data: { symbols: [] }
        }),
      });

      if (forceResponse.ok) {
        // Add activity log
        await fetch('/api/workflow-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'addActivity',
            data: {
              activity: {
                type: 'analysis',
                message: 'Forced discovery cycle initiated',
              },
            },
          }),
        });
        
        await fetchSystemStatus();
      }
    } catch (error) {
      console.error('Failed to run discovery cycle:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Exit Strategy handlers
  // const handleStrategyChange = (strategyId: string) => {
  //   updateExitStrategy.mutate({
  //     userId,
  //     selectedExitStrategy: strategyId,
  //   });
  // };

  // const handleCustomStrategyChange = (strategy: ExitStrategy) => {
  //   updateExitStrategy.mutate({
  //     userId,
  //     selectedExitStrategy: "custom",
  //     customExitStrategy: strategy,
  //   });
  // };

  // const handleAutoBuyToggle = (enabled: boolean) => {
  //   updateExitStrategy.mutate({
  //     userId,
  //     selectedExitStrategy: exitStrategyPrefs.selectedExitStrategy,
  //     autoBuyEnabled: enabled,
  //   });
  // };

  // const handleAutoSellToggle = (enabled: boolean) => {
  //   updateExitStrategy.mutate({
  //     userId,
  //     selectedExitStrategy: exitStrategyPrefs.selectedExitStrategy,
  //     autoSellEnabled: enabled,
  //   });
  // };

  // Show loading state only for workflow status, auth loading is handled separately
  const showLoading = isLoading && !workflowStatus;
  
  // Add client-side mounting check to avoid hydration issues
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Don't render until mounted on client to avoid SSR/hydration issues
  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-400 mx-auto" />
          <p className="text-slate-400">Initializing...</p>
        </div>
      </div>
    );
  }

  // Show loading while getting user info
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-400 mx-auto" />
          <p className="text-slate-400">Loading user information...</p>
        </div>
      </div>
    );
  }
  
  if (showLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-400 mx-auto" />
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-green-400 to-green-600 rounded-lg">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Trading Dashboard</h1>
              <p className="text-sm text-slate-400">Real-time monitoring and control</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* User Info */}
            <div className="flex items-center space-x-2">
              {user ? (
                <UserMenu user={user} />
              ) : (
                <Link href="/auth">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
            
            <div className="text-sm text-slate-400">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchSystemStatus}
              disabled={isLoading}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
            <Link href="/config">
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Control Panel */}
        <section className="mb-8">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>System Control</span>
              </CardTitle>
              <CardDescription>
                Manage pattern discovery and monitoring systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">

                <Button
                  variant="outline"
                  onClick={() => setShowExitStrategy(!showExitStrategy)}
                  className="border-purple-600 text-purple-300 hover:bg-purple-700"
                >
                  <Target className="mr-2 h-4 w-4" />
                  {showExitStrategy ? 'Hide' : 'Show'} Exit Strategies
                </Button>
                
                <Button
                  onClick={() => refreshCalendar.mutate()}
                  disabled={refreshCalendar.isPending}
                  variant="outline"
                  className="border-green-600 text-green-300 hover:bg-green-700"
                >
                  {refreshCalendar.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh MEXC Data
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={isMonitoring ? stopMonitoring : startMonitoring}
                  disabled={isLoading}
                  className={`${
                    isMonitoring
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-green-500 hover:bg-green-600'
                  } text-white`}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : isMonitoring ? (
                    <Pause className="mr-2 h-4 w-4" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {isMonitoring ? 'Stop Auto-Snipe' : 'Start Auto-Snipe'}
                </Button>

                <Button
                  onClick={forceRefresh}
                  disabled={isLoading}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Force Refresh Data
                </Button>

                <Button
                  onClick={clearAllTargets}
                  variant="outline"
                  className="border-red-600 text-red-300 hover:bg-red-700"
                >
                  <Target className="mr-2 h-4 w-4" />
                  Clear All Targets
                </Button>

{/* <Button
                  onClick={autoExitManager.status?.isMonitoring ? autoExitManager.stop : autoExitManager.start}
                  disabled={autoExitManager.isControlling}
                  className={`${
                    autoExitManager.status?.isMonitoring
                      ? 'bg-yellow-500 hover:bg-yellow-600'
                      : 'bg-purple-500 hover:bg-purple-600'
                  } text-white`}
                >
                  {autoExitManager.isControlling ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : autoExitManager.status?.isMonitoring ? (
                    <Pause className="mr-2 h-4 w-4" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {autoExitManager.status?.isMonitoring ? 'Stop Auto-Exit' : 'Start Auto-Exit'}
                </Button> */}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* System Status Cards & Account Balance */}
        <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Auto-Snipe</p>
                  <p className={`text-2xl font-bold ${
                    isMonitoring ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {isMonitoring ? 'Active' : 'Stopped'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isMonitoring ? 'Auto-executing trades' : 'Manual mode only'}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${
                  isMonitoring ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  <Activity className={`h-6 w-6 ${
                    isMonitoring ? 'text-green-400' : 'text-red-400'
                  }`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Ready to Snipe</p>
                  <p className="text-2xl font-bold text-green-400">
                    {sniperStats.readyToSnipe}
                  </p>
                  <p className="text-xs text-slate-500">Pattern: sts:2, st:2, tt:4</p>
                </div>
                <div className="p-3 rounded-full bg-green-500/20">
                  <Target className="h-6 w-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Monitoring</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {sniperStats.pendingDetection}
                  </p>
                  <p className="text-xs text-slate-500">Pending detection</p>
                </div>
                <div className="p-3 rounded-full bg-yellow-500/20">
                  <Eye className="h-6 w-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">MEXC API</p>
                  <p className={`text-2xl font-bold ${
                    mexcConnected ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {mexcConnected ? 'Connected' : 'Offline'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {accountData?.hasCredentials ? 'Configured' : 'Not configured'}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${
                  mexcConnected ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  <Activity className={`h-6 w-6 ${
                    mexcConnected ? 'text-green-400' : 'text-red-400'
                  }`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Account Balance & Detailed API Status */}
        <section className="mb-8 grid md:grid-cols-2 gap-6">
          {/* Enhanced Account Balance with Token + USDT Values */}
          <AccountBalance userId={userId} />

          {/* Detailed MEXC API Status */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-green-400" />
                <span>MEXC API Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${mexcConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <div>
                    <p className="text-sm font-medium">API Connection</p>
                    <p className="text-xs text-slate-400">{mexcConnected ? 'Connected' : 'Disconnected'}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${calendarLoading ? 'bg-yellow-400' : calendarError ? 'bg-red-400' : 'bg-green-400'}`}></div>
                  <div>
                    <p className="text-sm font-medium">Calendar Data</p>
                    <p className="text-xs text-slate-400">
                      {calendarLoading ? 'Loading...' : calendarError ? 'Error' : `${calendarData?.length || 0} entries`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${accountData?.hasCredentials ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                  <div>
                    <p className="text-sm font-medium">Account Access</p>
                    <p className="text-xs text-slate-400">
                      {accountData?.hasCredentials ? 'Configured' : 'Not configured'}
                    </p>
                  </div>
                </div>
              </div>
              
              {calendarError && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">
                    Error loading calendar data: {calendarError.message}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Auto-Exit Monitor Card - Commented out
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Auto-Exit Monitor</p>
                  <p className="text-2xl font-bold text-green-400">Active</p>
                  <p className="text-xs text-slate-500">Position monitoring system</p>
                </div>
                <div className="p-3 rounded-full bg-green-500/20">
                  <Target className="h-6 w-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        */}

        {/* Coin Calendar - At the top */}
        <section className="mb-8">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-blue-400" />
                <span>Coin Listings Calendar</span>
                <Badge variant="secondary" className="ml-2">
                  {calendarData?.length || 0} listings
                </Badge>
              </CardTitle>
              <CardDescription>
                View coin listings by date - check today, tomorrow, or any future date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CoinCalendar />
            </CardContent>
          </Card>
        </section>

        {/* User Preferences Panel - Always visible */}
        <section className="mb-8">
          <UserPreferences userId={userId} />
        </section>

        {/* Exit Strategy Panel */}
        {/* {showExitStrategy && (
          <section className="mb-8">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-purple-400" />
                  <span>Auto-Trading & Exit Strategies</span>
                </CardTitle>
                <CardDescription>
                  Configure automatic trading behavior and exit strategies for profit taking
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExitStrategySelector
                  selectedStrategy={exitStrategyPrefs.selectedExitStrategy}
                  customStrategy={exitStrategyPrefs.customExitStrategy}
                  autoBuyEnabled={exitStrategyPrefs.autoBuyEnabled}
                  autoSellEnabled={exitStrategyPrefs.autoSellEnabled}
                  onStrategyChange={handleStrategyChange}
                  onCustomStrategyChange={handleCustomStrategyChange}
                  onAutoBuyToggle={handleAutoBuyToggle}
                  onAutoSellToggle={handleAutoSellToggle}
                />
              </CardContent>
            </Card>
          </section>
        )} */}

        {/* Pattern Sniper Errors */}
        {(sniperErrors.calendar || sniperErrors.symbols) && (
          <section className="mb-8">
            <Card className="bg-red-500/10 border-red-500/20">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Pattern Sniper Errors</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sniperErrors.calendar && (
                  <div className="text-red-300">
                    <strong>Calendar API:</strong> {sniperErrors.calendar.message}
                  </div>
                )}
                {sniperErrors.symbols && (
                  <div className="text-red-300">
                    <strong>Symbols API:</strong> {sniperErrors.symbols.message}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Ready to Snipe Targets */}
        {sniperReadyTargets.length > 0 && (
          <section className="mb-8">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-green-400" />
                  <span>Ready to Snipe ({sniperReadyTargets.length})</span>
                </CardTitle>
                <CardDescription>
                  Tokens with confirmed ready state pattern (sts:2, st:2, tt:4)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sniperReadyTargets.map((target) => (
                    <div 
                      key={target.symbol} 
                      className="bg-green-50/5 border border-green-500/20 p-4 rounded-lg hover:bg-green-50/10 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="font-bold text-green-400 text-lg">{target.symbol}</h3>
                            <Badge variant="default" className="bg-green-500">
                              READY
                            </Badge>
                            <Badge variant="outline" className="border-green-500 text-green-400">
                              {((target.launchTime.getTime() - Date.now()) / (1000 * 60 * 60)).toFixed(1)}h
                            </Badge>
                          </div>
                          <p className="text-slate-300 mt-1">{target.projectName}</p>
                          <div className="flex items-center space-x-4 mt-2 text-sm text-slate-400">
                            <span>Launch: {target.launchTime.toLocaleString()}</span>
                            <span>Advance: {target.hoursAdvanceNotice.toFixed(1)}h</span>
                            <span>Precision: {target.priceDecimalPlaces}/{target.quantityDecimalPlaces}</span>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => executeSnipe(target, userId)}
                            className="bg-green-500 hover:bg-green-600"
                          >
                            <Zap className="h-4 w-4 mr-1" />
                            Execute
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeTarget(target.vcoinId)}
                            className="border-red-500 text-red-400 hover:bg-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Monitoring Targets */}
        {pendingDetection.length > 0 && (
          <section className="mb-8">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="h-5 w-5 text-yellow-400" />
                  <span>Monitoring ({pendingDetection.length})</span>
                </CardTitle>
                <CardDescription>
                  Waiting for ready state pattern detection
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingDetection.map((vcoinId) => {
                    const target = calendarTargets.find(t => t.vcoinId === vcoinId);
                    return target ? (
                      <div key={vcoinId} className="flex justify-between items-center p-3 bg-yellow-50/5 border border-yellow-500/20 rounded">
                        <div>
                          <span className="font-medium text-yellow-400">{target.symbol}</span>
                          <span className="text-slate-400 ml-2">{target.projectName}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-yellow-400">
                            {((new Date(target.firstOpenTime).getTime() - Date.now()) / (1000 * 60 * 60)).toFixed(1)}h
                          </span>
                          <Badge variant="outline" className="border-yellow-500 text-yellow-400">
                            Scanning...
                          </Badge>
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Portfolio Overview */}
        {/* {portfolioData && (
          <section className="mb-8">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-green-400" />
                  <span>Portfolio Overview</span>
                </CardTitle>
                <CardDescription>
                  Active positions and trading performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">Active Positions</p>
                    <p className="text-xl font-bold text-green-400">
                      {portfolioData.metrics.totalActivePositions}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">Unrealized P&L</p>
                    <p className={`text-xl font-bold ${
                      portfolioData.metrics.totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      ${portfolioData.metrics.totalUnrealizedPnL.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">Capital Deployed</p>
                    <p className="text-xl font-bold text-blue-400">
                      ${portfolioData.metrics.totalCapitalDeployed.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">Success Rate</p>
                    <p className="text-xl font-bold text-purple-400">
                      {portfolioData.metrics.successRate.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {portfolioData.activePositions.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-3">Active Positions</h4>
                    <div className="space-y-2">
                      {portfolioData.activePositions.slice(0, 3).map((position) => (
                        <div key={position.id} className="flex justify-between items-center p-3 bg-slate-700/20 rounded">
                          <div>
                            <span className="font-medium text-white">{position.symbolName}</span>
                            <span className="text-sm text-slate-400 ml-2">
                              Entry: ${position.executionPrice?.toFixed(6)}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className={`font-medium ${
                              position.unrealizedPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {position.unrealizedPnLPercent >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%
                            </div>
                            <div className="text-sm text-slate-400">
                              ${position.unrealizedPnL.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                      {portfolioData.activePositions.length > 3 && (
                        <div className="text-center text-slate-400 text-sm">
                          +{portfolioData.activePositions.length - 3} more positions
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )} */}



        {/* Performance Metrics - Hidden by default, can be toggled */}
        {false && (
          <section className="grid md:grid-cols-2 gap-8 mb-8">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  <span>Pattern Sniper Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Listings</span>
                  <span className="text-blue-400 font-bold text-xl">
                    {sniperStats.totalListings}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Success Rate</span>
                  <span className="text-green-400 font-medium">
                    {sniperStats.successRate?.toFixed(1) || '0.0'}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">System Uptime</span>
                  <span className="text-green-400 font-medium">
                    {sniperStats.uptime != null ? 
                      `${Math.floor(sniperStats.uptime! / 60)}m ${Math.floor(sniperStats.uptime! % 60)}s` : 
                      '0m 0s'
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Detection Rate</span>
                  <span className="text-green-400 font-medium">
                    {sniperStats.totalListings > 0 ? ((sniperStats.readyToSnipe + sniperStats.executed) / sniperStats.totalListings * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-blue-400" />
                  <span>Recent Activity</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {workflowStatus?.recentActivity?.length ? (
                  workflowStatus!.recentActivity!.map((activity) => {
                    const getActivityIcon = (type: string) => {
                      switch (type) {
                        case 'pattern': return <ArrowUpRight className="h-4 w-4 text-green-400" />;
                        case 'calendar': return <Eye className="h-4 w-4 text-blue-400" />;
                        case 'snipe': return <Zap className="h-4 w-4 text-green-400" />;
                        case 'analysis': return <Bot className="h-4 w-4 text-purple-400" />;
                        default: return <Activity className="h-4 w-4 text-slate-400" />;
                      }
                    };
                    
                    const getActivityColor = (type: string) => {
                      switch (type) {
                        case 'pattern': return 'bg-green-400';
                        case 'calendar': return 'bg-blue-400';
                        case 'snipe': return 'bg-green-400';
                        case 'analysis': return 'bg-purple-400';
                        default: return 'bg-slate-400';
                      }
                    };

                    const formatTimeAgo = (timestamp: string) => {
                      const now = new Date();
                      const time = new Date(timestamp);
                      const diffMs = now.getTime() - time.getTime();
                      const diffMins = Math.floor(diffMs / 60000);
                      
                      if (diffMins < 1) return 'Just now';
                      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
                      const diffHours = Math.floor(diffMins / 60);
                      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                    };

                    return (
                      <div key={activity.id} className="flex items-center space-x-3 p-3 bg-slate-700/50 rounded-lg animate-slide-up">
                        <div className={`w-2 h-2 ${getActivityColor(activity.type)} rounded-full ${activity.type === 'pattern' ? 'animate-pulse-green' : ''}`}></div>
                        <div className="flex-1">
                          <p className="text-sm text-white">{activity.message}</p>
                          <p className="text-xs text-slate-400">{formatTimeAgo(activity.timestamp)}</p>
                        </div>
                        {getActivityIcon(activity.type)}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-slate-400 py-4">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs">Start discovery to see live updates</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Emergency Response Dashboard */}
        <section className="mb-8">
          <EmergencyDashboard />
        </section>


        {/* Risk Notice */}
        <section>
          <Card className="bg-amber-500/10 border-amber-500/20 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-6 w-6 text-amber-400 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-amber-400 mb-2">Live Trading Environment</h3>
                  <p className="text-amber-200/80 text-sm leading-relaxed">
                    This dashboard controls live trading systems. All actions will affect real trades and funds.
                    Monitor system performance carefully and ensure proper risk management settings are in place.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
