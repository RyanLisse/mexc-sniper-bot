"use client";

/**
 * Feature Flag Dashboard
 *
 * Comprehensive dashboard for managing feature flags with rollout controls,
 * A/B testing, and real-time monitoring.
 */

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Eye,
  Flag,
  FlaskConical,
  Pause,
  Play,
  StopCircle,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
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
import { Switch } from "@/src/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Textarea } from "@/src/components/ui/textarea";

interface FeatureFlagConfig {
  name: string;
  description: string;
  strategy: string;
  enabled: boolean;
  percentage?: number;
  environments?: string[];
  trackingEnabled: boolean;
  rollbackOnError: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface FeatureFlagAnalytics {
  evaluations: number;
  enabledCount: number;
  enabledRate: number;
  lastEvaluated: string | null;
}

interface DashboardData {
  flags: Record<string, FeatureFlagConfig>;
  analytics: {
    evaluations: number;
    enabledCount: number;
    enabledRate: number;
    byFlag: Record<string, FeatureFlagAnalytics>;
  };
  count: number;
}

export function FeatureFlagDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null);
  const [newFlagForm, setNewFlagForm] = useState({
    name: "",
    description: "",
    strategy: "percentage",
    enabled: false,
    percentage: 0,
    environments: ["development"],
  });

  // Fetch feature flags data
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/feature-flags?analytics=true");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      setData(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch feature flags");
    } finally {
      setLoading(false);
    }
  };

  // Update feature flag
  const updateFlag = async (flagName: string, updates: any) => {
    try {
      const response = await fetch("/api/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flagName,
          action: "update",
          ...updates,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update flag: ${response.statusText}`);
      }

      await fetchData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update flag");
    }
  };

  // Emergency disable flag
  const emergencyDisable = async (flagName: string) => {
    try {
      const response = await fetch("/api/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flagName,
          action: "emergency_disable",
          reason: "Emergency disable from dashboard",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to disable flag: ${response.statusText}`);
      }

      await fetchData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable flag");
    }
  };

  // Create new feature flag
  const createFlag = async () => {
    try {
      const response = await fetch("/api/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          ...newFlagForm,
          createdBy: "dashboard",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create flag: ${response.statusText}`);
      }

      setNewFlagForm({
        name: "",
        description: "",
        strategy: "percentage",
        enabled: false,
        percentage: 0,
        environments: ["development"],
      });

      await fetchData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create flag");
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading feature flags...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span>Error loading feature flags: {error}</span>
          </div>
          <Button onClick={fetchData} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return <div>No feature flags data available</div>;
  }

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case "all_users":
        return <Users className="h-4 w-4" />;
      case "percentage":
        return <BarChart3 className="h-4 w-4" />;
      case "a_b_test":
        return <FlaskConical className="h-4 w-4" />;
      case "gradual":
        return <TrendingUp className="h-4 w-4" />;
      case "canary":
        return <Target className="h-4 w-4" />;
      default:
        return <Flag className="h-4 w-4" />;
    }
  };

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case "all_users":
        return "bg-green-100 text-green-800";
      case "percentage":
        return "bg-blue-100 text-blue-800";
      case "a_b_test":
        return "bg-purple-100 text-purple-800";
      case "gradual":
        return "bg-yellow-100 text-yellow-800";
      case "canary":
        return "bg-orange-100 text-orange-800";
      case "disabled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const flags = Object.entries(data.flags);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Feature Flag Dashboard</h2>
          <p className="text-gray-600">
            Manage feature rollouts, A/B tests, and system configurations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{data.count} flags</Badge>
          <Button onClick={fetchData} variant="outline" size="sm">
            <Activity className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Evaluations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.analytics.evaluations.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enabled Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.analytics.enabledCount.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enable Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data.analytics.enabledRate * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {flags.filter(([, flag]) => flag.enabled).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="create">Create Flag</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4">
            {flags.map(([flagName, flag]) => {
              const flagAnalytics = data.analytics.byFlag[flagName];

              return (
                <Card
                  key={flagName}
                  className={selectedFlag === flagName ? "ring-2 ring-blue-500" : ""}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{flag.name}</CardTitle>
                        <Badge className={getStrategyColor(flag.strategy)}>
                          {getStrategyIcon(flag.strategy)}
                          <span className="ml-1">{flag.strategy}</span>
                        </Badge>
                        {flag.enabled ? (
                          <Badge className="bg-green-100 text-green-800">
                            <Play className="h-3 w-3 mr-1" />
                            Enabled
                          </Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800">
                            <Pause className="h-3 w-3 mr-1" />
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSelectedFlag(selectedFlag === flagName ? null : flagName)
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateFlag(flagName, { enabled: !flag.enabled })}
                        >
                          {flag.enabled ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => emergencyDisable(flagName)}
                          disabled={!flag.enabled}
                        >
                          <StopCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 mb-4">{flag.description}</p>

                    {/* Flag Configuration */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {flag.strategy === "percentage" && flag.percentage !== undefined && (
                        <div>
                          <Label className="text-sm font-medium">Rollout %</Label>
                          <div className="mt-1">
                            <Progress value={flag.percentage} className="h-2" />
                            <span className="text-sm text-gray-600">{flag.percentage}%</span>
                          </div>
                        </div>
                      )}

                      <div>
                        <Label className="text-sm font-medium">Environments</Label>
                        <div className="mt-1 flex gap-1">
                          {flag.environments?.map((env) => (
                            <Badge key={env} variant="outline" className="text-xs">
                              {env}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Created</Label>
                        <div className="text-sm text-gray-600">{formatDate(flag.createdAt)}</div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Tags</Label>
                        <div className="mt-1 flex gap-1">
                          {flag.tags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Flag Analytics */}
                    {flagAnalytics && (
                      <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                        <div>
                          <Label className="text-sm font-medium">Evaluations</Label>
                          <div className="text-lg font-semibold">{flagAnalytics.evaluations}</div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Enabled</Label>
                          <div className="text-lg font-semibold">{flagAnalytics.enabledCount}</div>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Enable Rate</Label>
                          <div className="text-lg font-semibold">
                            {(flagAnalytics.enabledRate * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Detailed Configuration (when selected) */}
                    {selectedFlag === flagName && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`${flagName}-percentage`}>Rollout Percentage</Label>
                            <Input
                              id={`${flagName}-percentage`}
                              type="number"
                              min="0"
                              max="100"
                              value={flag.percentage || 0}
                              onChange={(e) =>
                                updateFlag(flagName, { percentage: parseInt(e.target.value) })
                              }
                            />
                          </div>
                          <div>
                            <Label htmlFor={`${flagName}-strategy`}>Strategy</Label>
                            <Select
                              value={flag.strategy}
                              onValueChange={(value) => updateFlag(flagName, { strategy: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all_users">All Users</SelectItem>
                                <SelectItem value="percentage">Percentage</SelectItem>
                                <SelectItem value="a_b_test">A/B Test</SelectItem>
                                <SelectItem value="gradual">Gradual</SelectItem>
                                <SelectItem value="canary">Canary</SelectItem>
                                <SelectItem value="disabled">Disabled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`${flagName}-tracking`}
                              checked={flag.trackingEnabled}
                              onCheckedChange={(checked) =>
                                updateFlag(flagName, { trackingEnabled: checked })
                              }
                            />
                            <Label htmlFor={`${flagName}-tracking`}>Tracking Enabled</Label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`${flagName}-rollback`}
                              checked={flag.rollbackOnError}
                              onCheckedChange={(checked) =>
                                updateFlag(flagName, { rollbackOnError: checked })
                              }
                            />
                            <Label htmlFor={`${flagName}-rollback`}>Auto Rollback</Label>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Create Flag Tab */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Feature Flag</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="flag-name">Flag Name</Label>
                  <Input
                    id="flag-name"
                    value={newFlagForm.name}
                    onChange={(e) => setNewFlagForm({ ...newFlagForm, name: e.target.value })}
                    placeholder="my_new_feature"
                  />
                </div>

                <div>
                  <Label htmlFor="flag-strategy">Strategy</Label>
                  <Select
                    value={newFlagForm.strategy}
                    onValueChange={(value) => setNewFlagForm({ ...newFlagForm, strategy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="all_users">All Users</SelectItem>
                      <SelectItem value="a_b_test">A/B Test</SelectItem>
                      <SelectItem value="gradual">Gradual</SelectItem>
                      <SelectItem value="canary">Canary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="flag-description">Description</Label>
                <Textarea
                  id="flag-description"
                  value={newFlagForm.description}
                  onChange={(e) => setNewFlagForm({ ...newFlagForm, description: e.target.value })}
                  placeholder="Describe what this feature flag controls..."
                />
              </div>

              {newFlagForm.strategy === "percentage" && (
                <div>
                  <Label htmlFor="flag-percentage">Initial Percentage</Label>
                  <Input
                    id="flag-percentage"
                    type="number"
                    min="0"
                    max="100"
                    value={newFlagForm.percentage}
                    onChange={(e) =>
                      setNewFlagForm({ ...newFlagForm, percentage: parseInt(e.target.value) })
                    }
                  />
                </div>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="flag-enabled"
                  checked={newFlagForm.enabled}
                  onCheckedChange={(checked) =>
                    setNewFlagForm({ ...newFlagForm, enabled: checked })
                  }
                />
                <Label htmlFor="flag-enabled">Enable immediately</Label>
              </div>

              <Button onClick={createFlag} className="w-full">
                Create Feature Flag
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4">
            {flags.map(([flagName, flag]) => {
              const flagAnalytics = data.analytics.byFlag[flagName];

              if (!flagAnalytics || flagAnalytics.evaluations === 0) return null;

              return (
                <Card key={flagName}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      {flag.name} Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Total Evaluations</Label>
                        <div className="text-2xl font-bold">{flagAnalytics.evaluations}</div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Times Enabled</Label>
                        <div className="text-2xl font-bold">{flagAnalytics.enabledCount}</div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Enable Rate</Label>
                        <div className="text-2xl font-bold">
                          {(flagAnalytics.enabledRate * 100).toFixed(1)}%
                        </div>
                        <Progress value={flagAnalytics.enabledRate * 100} className="h-2 mt-1" />
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Last Evaluated</Label>
                        <div className="text-sm text-gray-600">
                          {flagAnalytics.lastEvaluated
                            ? formatDate(flagAnalytics.lastEvaluated)
                            : "Never"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
