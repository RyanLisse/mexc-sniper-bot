"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Settings
} from "lucide-react";
import Link from "next/link";

interface SystemStatus {
  status: string;
  running: boolean;
  ready_tokens_count: number;
  last_update: string;
  statistics: {
    total_detections: number;
    successful_snipes: number;
    total_profit_usdt: number;
  };
}


export default function DashboardPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDiscoveryRunning, setIsDiscoveryRunning] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/agents/mexc/status');
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
        setIsDiscoveryRunning(data.system_status === "running");
      }
    } catch (error) {
      console.error('Failed to fetch system status:', error);
    } finally {
      setIsLoading(false);
      setLastRefresh(new Date());
    }
  };

  const togglePatternDiscovery = async () => {
    try {
      setIsLoading(true);
      const action = isDiscoveryRunning ? 'stop' : 'start';
      const response = await fetch('/api/agents/mexc/pattern-discovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        await fetchSystemStatus();
      }
    } catch (error) {
      console.error('Failed to toggle pattern discovery:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runDiscoveryCycle = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/agents/mexc/run-discovery', {
        method: 'POST',
      });

      if (response.ok) {
        await fetchSystemStatus();
      }
    } catch (error) {
      console.error('Failed to run discovery cycle:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !systemStatus) {
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
                Config
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                <Eye className="mr-2 h-4 w-4" />
                Home
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
                  onClick={togglePatternDiscovery}
                  disabled={isLoading}
                  className={`${
                    isDiscoveryRunning 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-green-500 hover:bg-green-600'
                  } text-white`}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : isDiscoveryRunning ? (
                    <Pause className="mr-2 h-4 w-4" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {isDiscoveryRunning ? 'Stop Discovery' : 'Start Discovery'}
                </Button>
                
                <Button
                  onClick={runDiscoveryCycle}
                  disabled={isLoading}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Target className="mr-2 h-4 w-4" />
                  )}
                  Run Discovery Cycle
                </Button>
                
                <Button
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  <Bot className="mr-2 h-4 w-4" />
                  Configure Agents
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* System Status Cards */}
        <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">System Status</p>
                  <p className={`text-2xl font-bold ${
                    systemStatus?.running ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {systemStatus?.running ? 'Active' : 'Stopped'}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${
                  systemStatus?.running ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  <Activity className={`h-6 w-6 ${
                    systemStatus?.running ? 'text-green-400' : 'text-red-400'
                  }`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Ready Tokens</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {systemStatus?.ready_tokens_count || 0}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/20">
                  <Target className="h-6 w-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Total Detections</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {systemStatus?.statistics?.total_detections || 0}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-purple-500/20">
                  <Eye className="h-6 w-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Successful Snipes</p>
                  <p className="text-2xl font-bold text-green-400">
                    {systemStatus?.statistics?.successful_snipes || 0}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-green-500/20">
                  <Zap className="h-6 w-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Performance Metrics */}
        <section className="grid md:grid-cols-2 gap-8 mb-8">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-400" />
                <span>Trading Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Profit (USDT)</span>
                <span className="text-green-400 font-bold text-xl">
                  +{systemStatus?.statistics?.total_profit_usdt?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Success Rate</span>
                <span className="text-green-400 font-medium">
                  {systemStatus?.statistics?.successful_snipes && systemStatus?.statistics?.total_detections 
                    ? ((systemStatus.statistics.successful_snipes / systemStatus.statistics.total_detections) * 100).toFixed(1)
                    : '0.0'
                  }%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Average ROI</span>
                <span className="text-green-400 font-medium">+127.3%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Best Trade</span>
                <span className="text-green-400 font-medium">+450.2%</span>
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
              <div className="flex items-center space-x-3 p-3 bg-slate-700/50 rounded-lg animate-slide-up">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse-green"></div>
                <div className="flex-1">
                  <p className="text-sm text-white">Pattern detected for NEWTOKEN</p>
                  <p className="text-xs text-slate-400">2 minutes ago</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-green-400" />
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-slate-700/50 rounded-lg animate-slide-up">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-white">Calendar scan completed</p>
                  <p className="text-xs text-slate-400">5 minutes ago</p>
                </div>
                <Eye className="h-4 w-4 text-blue-400" />
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-slate-700/50 rounded-lg animate-slide-up">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-white">Successful snipe executed</p>
                  <p className="text-xs text-slate-400">12 minutes ago</p>
                </div>
                <Zap className="h-4 w-4 text-green-400" />
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-slate-700/50 rounded-lg animate-slide-up">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-white">AI analysis updated</p>
                  <p className="text-xs text-slate-400">18 minutes ago</p>
                </div>
                <Bot className="h-4 w-4 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Market Overview */}
        <section className="mb-8">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm trading-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5 text-yellow-400" />
                <span>Market Overview</span>
              </CardTitle>
              <CardDescription>
                Current market conditions and monitored tokens
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h4 className="font-medium text-slate-300">Monitored Tokens</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-slate-700/50 rounded">
                      <span className="text-sm">BTCUSDT</span>
                      <span className="text-xs text-green-400">Ready</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-slate-700/50 rounded">
                      <span className="text-sm">ETHUSDT</span>
                      <span className="text-xs text-yellow-400">Monitoring</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-slate-700/50 rounded">
                      <span className="text-sm">NEWTOKEN</span>
                      <span className="text-xs text-blue-400">Detected</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium text-slate-300">Pattern States</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">sts:2, st:2, tt:4</span>
                      <span className="text-sm text-green-400">3 tokens</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">sts:1, st:1, tt:3</span>
                      <span className="text-sm text-yellow-400">7 tokens</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Other patterns</span>
                      <span className="text-sm text-slate-400">15 tokens</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium text-slate-300">System Health</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">API Latency</span>
                      <span className="text-sm text-green-400">89ms</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Cache Hit Rate</span>
                      <span className="text-sm text-green-400">94.2%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Error Rate</span>
                      <span className="text-sm text-green-400">0.1%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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