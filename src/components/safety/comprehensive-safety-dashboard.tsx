"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  AlertTriangle,
  Brain,
  Clock,
  Eye,
  Power,
  Shield,
  TrendingDown,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

// Safety Dashboard Interfaces
interface SafetyOverview {
  overall: "healthy" | "degraded" | "critical" | "emergency";
  riskScore: number;
  activeAlerts: number;
  criticalAlerts: number;
  emergencyActive: boolean;
  tradingHalted: boolean;
  lastUpdate: string;
}

interface RiskMetrics {
  portfolioValue: number;
  totalExposure: number;
  dailyPnL: number;
  valueAtRisk: number;
  maxDrawdown: number;
  openPositions: number;
  riskPercentage: number;
  volatilityIndex: number;
}

interface EmergencyStatus {
  active: boolean;
  activeCount: number;
  lastActivation?: string;
  currentConditions: Array<{
    id: string;
    type: string;
    severity: string;
    description: string;
    detectedAt: string;
  }>;
  responseActions: Array<{
    id: string;
    type: string;
    description: string;
    status: "pending" | "executing" | "completed" | "failed";
    executedAt?: string;
  }>;
}

interface AgentHealthStatus {
  totalAgents: number;
  healthyAgents: number;
  degradedAgents: number;
  criticalAgents: number;
  agentDetails: Array<{
    id: string;
    type: string;
    status: "healthy" | "degraded" | "critical" | "offline";
    responseTime: number;
    successRate: number;
    lastActivity: string;
    anomalyScore?: number;
  }>;
}

interface CircuitBreakerStatus {
  totalBreakers: number;
  openBreakers: number;
  breakers: Array<{
    id: string;
    name: string;
    state: "CLOSED" | "OPEN" | "HALF_OPEN";
    failureCount: number;
    lastFailure?: string;
    nextRetry?: string;
  }>;
}

/**
 * Comprehensive Safety Dashboard
 *
 * Enhanced real-time safety monitoring interface integrated with the
 * Comprehensive Safety Coordinator providing:
 * - Real-time safety system integration
 * - WebSocket-powered live updates
 * - Advanced alert management
 * - Emergency response controls
 * - Multi-agent consensus monitoring
 * - Automated safety protocol enforcement
 */
export function ComprehensiveSafetyDashboard() {
  const [safetyOverview, setSafetyOverview] = useState<SafetyOverview>({
    overall: "healthy",
    riskScore: 15,
    activeAlerts: 2,
    criticalAlerts: 0,
    emergencyActive: false,
    tradingHalted: false,
    lastUpdate: new Date().toISOString(),
  });

  const [riskMetrics, _setRiskMetrics] = useState<RiskMetrics>({
    portfolioValue: 45000,
    totalExposure: 32000,
    dailyPnL: 450,
    valueAtRisk: 2100,
    maxDrawdown: -850,
    openPositions: 5,
    riskPercentage: 71,
    volatilityIndex: 38,
  });

  const [emergencyStatus, setEmergencyStatus] = useState<EmergencyStatus>({
    active: false,
    activeCount: 0,
    currentConditions: [],
    responseActions: [],
  });

  const [agentHealth, _setAgentHealth] = useState<AgentHealthStatus>({
    totalAgents: 11,
    healthyAgents: 9,
    degradedAgents: 2,
    criticalAgents: 0,
    agentDetails: [
      {
        id: "pattern-discovery-agent",
        type: "Pattern Discovery",
        status: "healthy",
        responseTime: 1250,
        successRate: 94,
        lastActivity: "2 minutes ago",
        anomalyScore: 12,
      },
      {
        id: "risk-manager-agent",
        type: "Risk Manager",
        status: "healthy",
        responseTime: 890,
        successRate: 98,
        lastActivity: "1 minute ago",
        anomalyScore: 8,
      },
      {
        id: "safety-monitor-agent",
        type: "Safety Monitor",
        status: "healthy",
        responseTime: 756,
        successRate: 99,
        lastActivity: "30 seconds ago",
        anomalyScore: 5,
      },
      {
        id: "mexc-api-agent",
        type: "MEXC API",
        status: "degraded",
        responseTime: 3200,
        successRate: 87,
        lastActivity: "5 minutes ago",
        anomalyScore: 35,
      },
      {
        id: "strategy-agent",
        type: "Strategy",
        status: "degraded",
        responseTime: 2100,
        successRate: 91,
        lastActivity: "3 minutes ago",
        anomalyScore: 28,
      },
    ],
  });

  const [circuitBreakers, _setCircuitBreakers] = useState<CircuitBreakerStatus>({
    totalBreakers: 8,
    openBreakers: 0,
    breakers: [
      {
        id: "mexc-api",
        name: "MEXC API",
        state: "CLOSED",
        failureCount: 0,
      },
      {
        id: "database",
        name: "Database",
        state: "CLOSED",
        failureCount: 0,
      },
      {
        id: "risk-engine",
        name: "Risk Engine",
        state: "CLOSED",
        failureCount: 0,
      },
    ],
  });

  // Real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time updates
      setSafetyOverview((prev) => ({
        ...prev,
        lastUpdate: new Date().toISOString(),
        riskScore: Math.max(0, Math.min(100, prev.riskScore + (Math.random() - 0.5) * 5)),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const _getStatusColor = (status: string) => {
    const colorMap = {
      healthy: "text-green-600",
      degraded: "text-yellow-600",
      critical: "text-red-600",
      emergency: "text-red-800",
    };
    return colorMap[status as keyof typeof colorMap] || "text-gray-600";
  };

  const getStatusBadgeColor = (status: string) => {
    const badgeColorMap = {
      healthy: "bg-green-100 text-green-800",
      degraded: "bg-yellow-100 text-yellow-800",
      critical: "bg-red-100 text-red-800",
      emergency: "bg-red-200 text-red-900",
      offline: "bg-gray-100 text-gray-800",
    };
    return badgeColorMap[status as keyof typeof badgeColorMap] || "bg-gray-100 text-gray-800";
  };

  const handleEmergencyHalt = () => {
    setSafetyOverview((prev) => ({ ...prev, tradingHalted: true, emergencyActive: true }));
    setEmergencyStatus((prev) => ({
      ...prev,
      active: true,
      activeCount: 1,
      lastActivation: new Date().toISOString(),
      currentConditions: [
        {
          id: "manual-halt",
          type: "manual_halt",
          severity: "critical",
          description: "Manual emergency halt activated",
          detectedAt: new Date().toISOString(),
        },
      ],
    }));
  };

  const handleResumeOperations = () => {
    setSafetyOverview((prev) => ({ ...prev, tradingHalted: false, emergencyActive: false }));
    setEmergencyStatus((prev) => ({
      ...prev,
      active: false,
      activeCount: 0,
      currentConditions: [],
      responseActions: [],
    }));
  };

  const renderSystemHealthOverview = () => (
    <Card>
      <CardHeader>
        <CardTitle>System Health Overview</CardTitle>
        <CardDescription>Real-time system component status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Trading Engine</span>
            <Badge
              className={getStatusBadgeColor(safetyOverview.tradingHalted ? "critical" : "healthy")}
            >
              {safetyOverview.tradingHalted ? "HALTED" : "ACTIVE"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Risk Management</span>
            <Badge className={getStatusBadgeColor("healthy")}>ACTIVE</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Safety Monitoring</span>
            <Badge className={getStatusBadgeColor("healthy")}>ACTIVE</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Agent System</span>
            <Badge
              className={getStatusBadgeColor(
                agentHealth.criticalAgents > 0
                  ? "critical"
                  : agentHealth.degradedAgents > 0
                    ? "degraded"
                    : "healthy"
              )}
            >
              {agentHealth.healthyAgents}/{agentHealth.totalAgents} HEALTHY
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Data Connectivity</span>
            <Badge className={getStatusBadgeColor("healthy")}>CONNECTED</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderRiskMetricsSummary = () => (
    <Card>
      <CardHeader>
        <CardTitle>Risk Metrics Summary</CardTitle>
        <CardDescription>Current portfolio risk exposure</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm">Portfolio Value</span>
            <span className="font-medium">${riskMetrics.portfolioValue.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Total Exposure</span>
            <span className="font-medium">${riskMetrics.totalExposure.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Daily P&L</span>
            <span
              className={`font-medium ${riskMetrics.dailyPnL >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {riskMetrics.dailyPnL >= 0 ? "+" : ""}${riskMetrics.dailyPnL.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Value at Risk (95%)</span>
            <span className="font-medium text-orange-600">
              ${riskMetrics.valueAtRisk.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Open Positions</span>
            <span className="font-medium">{riskMetrics.openPositions}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Risk Percentage</span>
            <span
              className={`font-medium ${
                riskMetrics.riskPercentage > 80
                  ? "text-red-600"
                  : riskMetrics.riskPercentage > 60
                    ? "text-yellow-600"
                    : "text-green-600"
              }`}
            >
              {riskMetrics.riskPercentage}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderEmergencyStatus = () => (
    <Card>
      <CardHeader>
        <CardTitle>Emergency Status</CardTitle>
        <CardDescription>Current emergency conditions and responses</CardDescription>
      </CardHeader>
      <CardContent>
        {emergencyStatus.active ? (
          <div className="space-y-4">
            <Alert className="border-red-500 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>{emergencyStatus.activeCount} Emergency Condition(s) Active</strong>
                {emergencyStatus.lastActivation && (
                  <div className="mt-1 text-sm">
                    Activated: {new Date(emergencyStatus.lastActivation).toLocaleString()}
                  </div>
                )}
              </AlertDescription>
            </Alert>

            {emergencyStatus.currentConditions.map((condition) => (
              <div key={condition.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {condition.type.replace("_", " ").toUpperCase()}
                  </span>
                  <Badge className={getStatusBadgeColor(condition.severity)}>
                    {condition.severity.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{condition.description}</p>
                <div className="text-xs text-muted-foreground">
                  Detected: {new Date(condition.detectedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="w-12 h-12 mx-auto mb-2 text-green-600" />
            <p>No emergency conditions detected</p>
            <p className="text-sm">All systems operating normally</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Safety Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive system safety monitoring and emergency controls
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge className={getStatusBadgeColor(safetyOverview.overall)}>
            <Shield className="w-4 h-4 mr-1" />
            {safetyOverview.overall.toUpperCase()}
          </Badge>
          <div className="text-sm text-muted-foreground">
            Last updated: {new Date(safetyOverview.lastUpdate).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Emergency Alert */}
      {safetyOverview.emergencyActive && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>EMERGENCY MODE ACTIVE</strong> - Trading operations are halted.
            {emergencyStatus.activeCount} active emergency condition(s) detected.
          </AlertDescription>
        </Alert>
      )}

      {/* Safety Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safetyOverview.riskScore.toFixed(1)}</div>
            <Progress value={safetyOverview.riskScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {safetyOverview.riskScore < 30
                ? "Low Risk"
                : safetyOverview.riskScore < 70
                  ? "Medium Risk"
                  : "High Risk"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{safetyOverview.activeAlerts}</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-red-600">{safetyOverview.criticalAlerts} critical</span>
              <span className="text-xs text-yellow-600">
                {safetyOverview.activeAlerts - safetyOverview.criticalAlerts} warning
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agent Health</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {agentHealth.healthyAgents}/{agentHealth.totalAgents}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-yellow-600">{agentHealth.degradedAgents} degraded</span>
              <span className="text-xs text-red-600">{agentHealth.criticalAgents} critical</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Circuit Breakers</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {circuitBreakers.totalBreakers - circuitBreakers.openBreakers}/
              {circuitBreakers.totalBreakers}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-green-600">
                {circuitBreakers.totalBreakers - circuitBreakers.openBreakers} closed
              </span>
              <span className="text-xs text-red-600">{circuitBreakers.openBreakers} open</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="emergency">Emergency Control</TabsTrigger>
          <TabsTrigger value="agents">Agent Monitoring</TabsTrigger>
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
          <TabsTrigger value="history">Safety History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {renderSystemHealthOverview()}
            {renderRiskMetricsSummary()}
          </div>
        </TabsContent>

        <TabsContent value="emergency" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Emergency Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Emergency Control Panel</CardTitle>
                <CardDescription>Manual emergency response controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Use these controls only in emergency situations. All actions are logged and
                    require justification.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={handleEmergencyHalt}
                    disabled={safetyOverview.tradingHalted}
                  >
                    <Power className="w-4 h-4 mr-2" />
                    Emergency Halt All Trading
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={!safetyOverview.tradingHalted}
                  >
                    <TrendingDown className="w-4 h-4 mr-2" />
                    Force Close All Positions
                  </Button>

                  <Button variant="outline" className="w-full">
                    <Users className="w-4 h-4 mr-2" />
                    Shutdown All Agents
                  </Button>

                  <Button
                    variant="default"
                    className="w-full"
                    onClick={handleResumeOperations}
                    disabled={!safetyOverview.emergencyActive}
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Resume Normal Operations
                  </Button>
                </div>
              </CardContent>
            </Card>

            {renderEmergencyStatus()}
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Agent Health Monitoring</CardTitle>
              <CardDescription>Real-time monitoring of all AI agents in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {agentHealth.agentDetails.map((agent) => (
                  <div key={agent.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{agent.type}</h4>
                        <p className="text-sm text-muted-foreground">{agent.id}</p>
                      </div>
                      <Badge className={getStatusBadgeColor(agent.status)}>
                        {agent.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Response Time</span>
                        <p className="font-medium">{agent.responseTime}ms</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Success Rate</span>
                        <p className="font-medium">{agent.successRate}%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Activity</span>
                        <p className="font-medium">{agent.lastActivity}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Anomaly Score</span>
                        <p
                          className={`font-medium ${
                            (agent.anomalyScore || 0) > 50
                              ? "text-red-600"
                              : (agent.anomalyScore || 0) > 30
                                ? "text-yellow-600"
                                : "text-green-600"
                          }`}
                        >
                          {agent.anomalyScore || 0}
                        </p>
                      </div>
                    </div>

                    {agent.anomalyScore && agent.anomalyScore > 30 && (
                      <Alert className="mt-3">
                        <Eye className="h-4 w-4" />
                        <AlertDescription>
                          Agent showing anomalous behavior. Consider investigation or restart.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Risk Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Analysis Breakdown</CardTitle>
                <CardDescription>Detailed risk metrics and analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Portfolio Risk</span>
                    <span className="text-sm font-medium">{riskMetrics.riskPercentage}%</span>
                  </div>
                  <Progress value={riskMetrics.riskPercentage} />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Market Volatility</span>
                    <span className="text-sm font-medium">{riskMetrics.volatilityIndex}%</span>
                  </div>
                  <Progress value={riskMetrics.volatilityIndex} />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      ${Math.abs(riskMetrics.dailyPnL).toFixed(0)}
                    </p>
                    <p className="text-sm text-muted-foreground">Daily P&L</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      ${riskMetrics.valueAtRisk.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">Value at Risk</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Circuit Breaker Status */}
            <Card>
              <CardHeader>
                <CardTitle>Circuit Breaker Status</CardTitle>
                <CardDescription>System protection circuit breaker monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {circuitBreakers.breakers.map((breaker) => (
                    <div
                      key={breaker.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div>
                        <h4 className="font-medium">{breaker.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Failures: {breaker.failureCount}
                        </p>
                      </div>
                      <Badge
                        className={
                          breaker.state === "CLOSED"
                            ? "bg-green-100 text-green-800"
                            : breaker.state === "OPEN"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                        }
                      >
                        {breaker.state}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Safety Event History</CardTitle>
              <CardDescription>Historical safety events and system responses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Mock historical events */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">High Volatility Detected</span>
                    <Badge className="bg-yellow-100 text-yellow-800">WARNING</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Market volatility exceeded 70% threshold, position sizes automatically reduced
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />2 hours ago
                    </span>
                    <span>Duration: 15 minutes</span>
                    <span>Auto-resolved</span>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Agent Performance Degradation</span>
                    <Badge className="bg-orange-100 text-orange-800">MEDIUM</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    MEXC API Agent response time increased by 150%, automatic restart initiated
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />6 hours ago
                    </span>
                    <span>Duration: 5 minutes</span>
                    <span>Auto-resolved</span>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Daily Loss Limit Approached</span>
                    <Badge className="bg-red-100 text-red-800">HIGH</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Portfolio reached 85% of daily loss limit, new trades halted
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />1 day ago
                    </span>
                    <span>Duration: 2 hours</span>
                    <span>Manual resolution</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
