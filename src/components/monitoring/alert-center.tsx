"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Download,
  Eye,
  EyeOff,
  Info,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Alert {
  id: string;
  severity: string;
  category: string;
  source: string;
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolved: boolean;
  resolvedAt?: string;
  count: number;
  tags: string[];
  metadata: {
    affectedComponents: string[];
    impactLevel: string;
    estimatedResolution: string;
    relatedAlerts: number;
  };
}

interface AlertSummary {
  total: number;
  unacknowledged: number;
  critical: number;
  error: number;
  warning: number;
  info: number;
  lastHour: number;
  last24Hours: number;
  topSources: Array<{
    source: string;
    count: number;
  }>;
  topCategories: Array<{
    category: string;
    count: number;
  }>;
}

interface AlertTrends {
  hourly: Array<{
    hour: string;
    count: number;
    critical: number;
    error: number;
    warning: number;
    info: number;
  }>;
  patterns: Array<{
    pattern: string;
    confidence: number;
  }>;
  recommendations: string[];
}

export function AlertCenter() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [trends, setTrends] = useState<AlertTrends | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    severity: "",
    category: "",
    acknowledged: "",
    search: "",
  });
  const [_sortBy, _setSortBy] = useState("timestamp");
  const [_sortOrder, _setSortOrder] = useState<"asc" | "desc">("desc");
  const [showOnlyCritical, setShowOnlyCritical] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    fetchAlerts();
    setupRealTimeConnection();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [filters]);

  const fetchAlerts = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.severity) params.append("severity", filters.severity);
      if (filters.category) params.append("category", filters.category);
      if (filters.acknowledged) params.append("acknowledged", filters.acknowledged);

      const response = await fetch(`/api/monitoring/alerts?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch alerts");
      }

      const result = await response.json();

      let filteredAlerts = result.alerts;
      if (filters.search) {
        filteredAlerts = filteredAlerts.filter(
          (alert: Alert) =>
            alert.title.toLowerCase().includes(filters.search.toLowerCase()) ||
            alert.message.toLowerCase().includes(filters.search.toLowerCase()) ||
            alert.source.toLowerCase().includes(filters.search.toLowerCase())
        );
      }

      if (showOnlyCritical) {
        filteredAlerts = filteredAlerts.filter(
          (alert: Alert) => alert.severity === "critical" && !alert.acknowledged
        );
      }

      setAlerts(filteredAlerts);
      setSummary(result.summary);
      setTrends(result.trends);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const setupRealTimeConnection = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource("/api/monitoring/real-time?type=alerts");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        if (update.alerts) {
          setAlerts((prev) => {
            const newAlerts = [...update.alerts, ...prev.slice(0, 100)]; // Keep latest 100
            return newAlerts;
          });
        }
      } catch (err) {
        console.error("Error parsing real-time alert data:", err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setTimeout(setupRealTimeConnection, 5000);
    };
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "error":
        return "destructive";
      case "warning":
        return "secondary";
      case "info":
        return "default";
      default:
        return "outline";
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch("/api/monitoring/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "acknowledge",
          alertId,
          acknowledgedBy: "admin",
          notes: "Acknowledged from monitoring dashboard",
        }),
      });

      if (response.ok) {
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === alertId
              ? {
                  ...alert,
                  acknowledged: true,
                  acknowledgedBy: "admin",
                  acknowledgedAt: new Date().toISOString(),
                }
              : alert
          )
        );
      }
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

  const handleBulkAcknowledge = async () => {
    if (selectedAlerts.size === 0) return;

    try {
      const response = await fetch("/api/monitoring/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_acknowledge",
          alertIds: Array.from(selectedAlerts),
          acknowledgedBy: "admin",
          notes: "Bulk acknowledged from monitoring dashboard",
        }),
      });

      if (response.ok) {
        setAlerts((prev) =>
          prev.map((alert) =>
            selectedAlerts.has(alert.id)
              ? {
                  ...alert,
                  acknowledged: true,
                  acknowledgedBy: "admin",
                  acknowledgedAt: new Date().toISOString(),
                }
              : alert
          )
        );
        setSelectedAlerts(new Set());
      }
    } catch (err) {
      console.error("Failed to bulk acknowledge alerts:", err);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      const response = await fetch("/api/monitoring/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dismiss",
          alertId,
          dismissedBy: "admin",
          reason: "Dismissed from monitoring dashboard",
        }),
      });

      if (response.ok) {
        setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
      }
    } catch (err) {
      console.error("Failed to dismiss alert:", err);
    }
  };

  const handleExportAlerts = () => {
    const csv = [
      [
        "Timestamp",
        "Severity",
        "Category",
        "Source",
        "Title",
        "Message",
        "Acknowledged",
        "Resolved",
      ],
      ...alerts.map((alert) => [
        alert.timestamp,
        alert.severity,
        alert.category,
        alert.source,
        alert.title,
        alert.message,
        alert.acknowledged ? "Yes" : "No",
        alert.resolved ? "Yes" : "No",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alerts-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffMs = now.getTime() - alertTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300"];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Loading Alert Center...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
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
            Alert Center Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchAlerts} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Alert Center</h2>
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? (
              <>
                <Activity className="h-3 w-3 mr-1" />
                Live
              </>
            ) : (
              "Disconnected"
            )}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowOnlyCritical(!showOnlyCritical)}
            variant={showOnlyCritical ? "destructive" : "outline"}
            size="sm"
          >
            {showOnlyCritical ? (
              <EyeOff className="h-4 w-4 mr-2" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Critical Only
          </Button>
          <Button onClick={handleExportAlerts} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={fetchAlerts} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alert Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
              <p className="text-xs text-muted-foreground">
                {summary.unacknowledged} unacknowledged
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{summary.critical}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Errors</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{summary.error}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warnings</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.warning}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Info</CardTitle>
              <Info className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary.info}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Hour</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.lastHour}</div>
              <p className="text-xs text-muted-foreground">{summary.last24Hours} in 24h</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="alerts">Alert List</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          {/* Filters and Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search alerts..."
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    className="w-64"
                  />
                </div>

                <Select
                  value={filters.severity}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, severity: value }))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.category}
                  onValueChange={(value) => setFilters((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Categories</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="trading">Trading</SelectItem>
                    <SelectItem value="websocket">WebSocket</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.acknowledged}
                  onValueChange={(value) =>
                    setFilters((prev) => ({ ...prev, acknowledged: value }))
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All</SelectItem>
                    <SelectItem value="true">Acknowledged</SelectItem>
                    <SelectItem value="false">Unacknowledged</SelectItem>
                  </SelectContent>
                </Select>

                {selectedAlerts.size > 0 && (
                  <Button onClick={handleBulkAcknowledge} variant="outline">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Acknowledge Selected ({selectedAlerts.size})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Alert Table */}
          <Card>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedAlerts.size === alerts.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedAlerts(new Set(alerts.map((a) => a.id)));
                            } else {
                              setSelectedAlerts(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((alert) => (
                      <TableRow
                        key={alert.id}
                        className={alert.severity === "critical" ? "bg-red-50" : ""}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedAlerts.has(alert.id)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedAlerts);
                              if (checked) {
                                newSelected.add(alert.id);
                              } else {
                                newSelected.delete(alert.id);
                              }
                              setSelectedAlerts(newSelected);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(alert.severity)}
                            <Badge variant={getSeverityColor(alert.severity) as any}>
                              {alert.severity}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatRelativeTime(alert.timestamp)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{alert.source}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <p className="font-medium text-sm truncate">{alert.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {alert.message}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{alert.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {alert.acknowledged ? (
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Acknowledged
                            </Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {!alert.acknowledged && (
                              <Button
                                onClick={() => handleAcknowledgeAlert(alert.id)}
                                variant="outline"
                                size="sm"
                              >
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                            )}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    {getSeverityIcon(alert.severity)}
                                    {alert.title}
                                  </DialogTitle>
                                  <DialogDescription>Alert Details and Metadata</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm font-medium">Source</p>
                                      <p className="text-sm text-muted-foreground">
                                        {alert.source}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">Category</p>
                                      <p className="text-sm text-muted-foreground">
                                        {alert.category}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">Timestamp</p>
                                      <p className="text-sm text-muted-foreground">
                                        {new Date(alert.timestamp).toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">Count</p>
                                      <p className="text-sm text-muted-foreground">
                                        {alert.count} occurrences
                                      </p>
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-sm font-medium mb-2">Message</p>
                                    <p className="text-sm text-muted-foreground p-3 bg-gray-50 rounded">
                                      {alert.message}
                                    </p>
                                  </div>

                                  <div>
                                    <p className="text-sm font-medium mb-2">Affected Components</p>
                                    <div className="flex flex-wrap gap-2">
                                      {alert.metadata.affectedComponents.map((component, index) => (
                                        <Badge key={index} variant="outline">
                                          {component}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-sm font-medium mb-2">Tags</p>
                                    <div className="flex flex-wrap gap-2">
                                      {alert.tags.map((tag, index) => (
                                        <Badge key={index} variant="secondary">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm font-medium">Impact Level</p>
                                      <p className="text-sm text-muted-foreground capitalize">
                                        {alert.metadata.impactLevel}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">Estimated Resolution</p>
                                      <p className="text-sm text-muted-foreground">
                                        {alert.metadata.estimatedResolution}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              onClick={() => handleDismissAlert(alert.id)}
                              variant="outline"
                              size="sm"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {summary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Alert Sources</CardTitle>
                  <CardDescription>Components generating the most alerts</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={summary.topSources}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="source" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Alert Categories</CardTitle>
                  <CardDescription>Distribution by category</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={summary.topCategories}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="count"
                        nameKey="category"
                        label={({ category, count }) => `${category}: ${count}`}
                      >
                        {summary.topCategories.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          {trends && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Alert Trends (24 Hours)</CardTitle>
                  <CardDescription>Hourly alert distribution by severity</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trends.hourly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="critical" stroke="#dc2626" name="Critical" />
                      <Line type="monotone" dataKey="error" stroke="#ea580c" name="Error" />
                      <Line type="monotone" dataKey="warning" stroke="#ca8a04" name="Warning" />
                      <Line type="monotone" dataKey="info" stroke="#2563eb" name="Info" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Detected Patterns</CardTitle>
                    <CardDescription>AI-identified alert patterns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {trends.patterns.map((pattern, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <span className="text-sm">{pattern.pattern.replace(/_/g, " ")}</span>
                          <Badge variant="outline">
                            {(pattern.confidence * 100).toFixed(0)}% confidence
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                    <CardDescription>Suggested actions to reduce alerts</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {trends.recommendations.map((recommendation, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                          <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5" />
                          <span className="text-sm">{recommendation}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
