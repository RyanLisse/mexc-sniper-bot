"use client";
import { createSafeLogger } from "../../lib/structured-logger";

/**
 * Parameter Monitor Component
 *
 * Real-time monitoring and visualization of system parameters with
 * change tracking, validation status, and manual override capabilities.
 */

import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Edit,
  Minus,
  RotateCcw,
  Save,
  Settings,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "../ui/optimized-icons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface Parameter {
  name: string;
  category: "trading" | "risk" | "agent" | "system" | "pattern";
  currentValue: any;
  defaultValue: any;
  type: "number" | "boolean" | "string";
  description: string;
  lastChanged: Date;
  changedBy: string;
  impactLevel: "low" | "medium" | "high" | "critical";
  constraints: {
    min?: number;
    max?: number;
    options?: any[];
  };
  trend?: "up" | "down" | "stable";
  validationStatus: "valid" | "warning" | "error";
  validationMessage?: string;
}

interface ParameterChange {
  parameter: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  source: string;
  reason?: string;
}

const logger = createSafeLogger("parameter-monitor");

export function ParameterMonitor() {
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [filteredParameters, setFilteredParameters] = useState<Parameter[]>([]);
  const [changeHistory, setChangeHistory] = useState<ParameterChange[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingParameter, setEditingParameter] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<any>("");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch parameters and change history
  useEffect(() => {
    const fetchParameters = async () => {
      try {
        setIsLoading(true);

        // Fetch current parameters
        const paramsResponse = await fetch(
          "/api/tuning/parameters?includeDefinitions=true&includeHistory=true"
        );
        const paramsData = await paramsResponse.json();

        // Convert to Parameter objects
        const parameterList: Parameter[] = Object.entries(paramsData.parameters).map(
          ([name, value]) => {
            const definition = paramsData.definitions[name];
            const recentChanges =
              paramsData.changeHistory
                ?.filter((change: ParameterChange) => change.parameter === name)
                .slice(0, 5) || [];

            return {
              name,
              category: definition?.category || "system",
              currentValue: value,
              defaultValue: definition?.defaultValue || value,
              type: definition?.type || "string",
              description: definition?.description || "",
              lastChanged: recentChanges[0]?.timestamp
                ? new Date(recentChanges[0].timestamp)
                : new Date(),
              changedBy: recentChanges[0]?.source || "system",
              impactLevel: definition?.impactLevel || "medium",
              constraints: definition?.constraints || {},
              trend: calculateTrend(recentChanges),
              validationStatus: "valid",
              validationMessage: undefined,
            };
          }
        );

        setParameters(parameterList);
        setChangeHistory(paramsData.changeHistory || []);
      } catch (error) {
        logger.error("Failed to fetch parameters:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchParameters();
    const interval = setInterval(fetchParameters, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Filter parameters based on category and search
  useEffect(() => {
    let filtered = parameters;

    if (selectedCategory !== "all") {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredParameters(filtered);
  }, [parameters, selectedCategory, searchTerm]);

  const calculateTrend = (changes: ParameterChange[]): "up" | "down" | "stable" => {
    if (changes.length < 2) return "stable";

    const recent = changes.slice(0, 2);
    const current = typeof recent[0].newValue === "number" ? recent[0].newValue : 0;
    const previous = typeof recent[1].newValue === "number" ? recent[1].newValue : 0;

    if (current > previous) return "up";
    if (current < previous) return "down";
    return "stable";
  };

  const handleEdit = (parameterName: string, currentValue: any) => {
    setEditingParameter(parameterName);
    setEditValue(currentValue);
  };

  const handleSave = async (parameterName: string) => {
    try {
      const parameter = parameters.find((p) => p.name === parameterName);
      if (!parameter) return;

      // Validate value
      const validation = validateParameterValue(parameter, editValue);
      if (!validation.valid) {
        alert(validation.message);
        return;
      }

      // Update parameter
      const response = await fetch("/api/tuning/parameters", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parameters: { [parameterName]: editValue },
          source: "manual_ui",
          reason: "Manual parameter adjustment via UI",
        }),
      });

      if (response.ok) {
        // Update local state
        setParameters((prev) =>
          prev.map((p) =>
            p.name === parameterName
              ? { ...p, currentValue: editValue, lastChanged: new Date(), changedBy: "manual_ui" }
              : p
          )
        );

        setEditingParameter(null);
        setEditValue("");
      } else {
        const error = await response.json();
        alert(`Failed to update parameter: ${error.error}`);
      }
    } catch (error) {
      logger.error("Failed to save parameter:", error);
      alert("Failed to save parameter");
    }
  };

  const handleReset = async (parameterName: string) => {
    try {
      const response = await fetch("/api/tuning/parameters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_parameter",
          parameterName,
        }),
      });

      if (response.ok) {
        // Refresh parameters
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Failed to reset parameter: ${error.error}`);
      }
    } catch (error) {
      logger.error("Failed to reset parameter:", error);
      alert("Failed to reset parameter");
    }
  };

  const validateParameterValue = (
    parameter: Parameter,
    value: any
  ): { valid: boolean; message?: string } => {
    if (parameter.type === "number") {
      const numValue = Number(value);
      if (Number.isNaN(numValue)) {
        return { valid: false, message: "Value must be a number" };
      }

      if (parameter.constraints.min !== undefined && numValue < parameter.constraints.min) {
        return { valid: false, message: `Value must be at least ${parameter.constraints.min}` };
      }

      if (parameter.constraints.max !== undefined && numValue > parameter.constraints.max) {
        return { valid: false, message: `Value must be at most ${parameter.constraints.max}` };
      }
    }

    if (parameter.constraints.options && !parameter.constraints.options.includes(value)) {
      return {
        valid: false,
        message: `Value must be one of: ${parameter.constraints.options.join(", ")}`,
      };
    }

    return { valid: true };
  };

  const getParameterIcon = (category: string) => {
    switch (category) {
      case "trading":
        return <Target className="w-4 h-4" />;
      case "risk":
        return <Shield className="w-4 h-4" />;
      case "agent":
        return <Zap className="w-4 h-4" />;
      case "system":
        return <Settings className="w-4 h-4" />;
      case "pattern":
        return <BarChart3 className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getImpactColor = (level: string) => {
    switch (level) {
      case "low":
        return "bg-gray-100 text-gray-700";
      case "medium":
        return "bg-blue-100 text-blue-700";
      case "high":
        return "bg-orange-100 text-orange-700";
      case "critical":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div>
            <Label htmlFor="search">Search Parameters</Label>
            <Input
              id="search"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="trading">Trading Strategy</SelectItem>
                <SelectItem value="risk">Risk Management</SelectItem>
                <SelectItem value="agent">Agent Configuration</SelectItem>
                <SelectItem value="system">System Performance</SelectItem>
                <SelectItem value="pattern">Pattern Detection</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="current" className="space-y-4">
        <TabsList>
          <TabsTrigger value="current">Current Parameters</TabsTrigger>
          <TabsTrigger value="history">Change History</TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredParameters.map((parameter) => (
              <Card key={parameter.name} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getParameterIcon(parameter.category)}
                      <CardTitle className="text-lg">{parameter.name}</CardTitle>
                      {getTrendIcon(parameter.trend || "stable")}
                    </div>

                    <div className="flex items-center space-x-2">
                      <Badge className={getImpactColor(parameter.impactLevel)}>
                        {parameter.impactLevel}
                      </Badge>

                      {parameter.validationStatus === "error" && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      {parameter.validationStatus === "warning" && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      )}
                      {parameter.validationStatus === "valid" && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mt-1">{parameter.description}</p>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Current Value:</span>

                    {editingParameter === parameter.name ? (
                      <div className="flex items-center space-x-2">
                        {parameter.type === "boolean" ? (
                          <Select
                            value={editValue.toString()}
                            onValueChange={(value) => setEditValue(value === "true")}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">True</SelectItem>
                              <SelectItem value="false">False</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : parameter.constraints.options ? (
                          <Select value={editValue} onValueChange={setEditValue}>
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {parameter.constraints.options.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={parameter.type === "number" ? "number" : "text"}
                            value={editValue}
                            onChange={(e) =>
                              setEditValue(
                                parameter.type === "number"
                                  ? Number(e.target.value)
                                  : e.target.value
                              )
                            }
                            className="w-32"
                            min={parameter.constraints.min}
                            max={parameter.constraints.max}
                          />
                        )}

                        <Button size="sm" onClick={() => handleSave(parameter.name)}>
                          <Save className="w-3 h-3" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingParameter(null)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                          {typeof parameter.currentValue === "boolean"
                            ? parameter.currentValue.toString()
                            : parameter.currentValue}
                        </code>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(parameter.name, parameter.currentValue)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>
                      Default: <code>{parameter.defaultValue?.toString()}</code>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReset(parameter.name)}
                      disabled={parameter.currentValue === parameter.defaultValue}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Reset
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {parameter.lastChanged.toLocaleString()}
                    </span>
                    <span>by {parameter.changedBy}</span>
                  </div>

                  {parameter.validationMessage && (
                    <Alert className="py-2">
                      <AlertTriangle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        {parameter.validationMessage}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Parameter Change History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {changeHistory.slice(0, 50).map((change, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{change.parameter}</span>
                        <Badge variant="outline">{change.source}</Badge>
                      </div>

                      <div className="text-sm text-gray-600 mt-1">
                        <span className="line-through text-red-600">
                          {change.oldValue?.toString()}
                        </span>
                        <span className="mx-2">→</span>
                        <span className="text-green-600">{change.newValue?.toString()}</span>
                      </div>

                      {change.reason && (
                        <p className="text-xs text-gray-500 mt-1">{change.reason}</p>
                      )}
                    </div>

                    <div className="text-xs text-gray-400 text-right">
                      {new Date(change.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}

                {changeHistory.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No parameter changes recorded
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
