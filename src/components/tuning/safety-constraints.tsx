"use client";

/**
 * Safety Constraints Component
 *
 * Manages and displays safety constraints for parameter optimization and trading operations.
 * Ensures that optimizations don't exceed safe risk boundaries.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Settings,
  Shield,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";

interface SafetyConstraint {
  id: string;
  name: string;
  description: string;
  type: "threshold" | "range" | "boolean" | "enum";
  category: "risk" | "performance" | "compliance" | "operational";
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
  locked: boolean; // Cannot be disabled by users
  value: any;
  defaultValue: any;
  validation: {
    min?: number;
    max?: number;
    options?: string[];
    required?: boolean;
  };
  currentStatus: "ok" | "warning" | "violation";
  lastChecked: string;
  violationCount: number;
}

interface SafetyConstraintsProps {
  constraints: SafetyConstraint[];
  onConstraintUpdate?: (constraintId: string, newValue: any) => void;
  onConstraintToggle?: (constraintId: string, enabled: boolean) => void;
  onValidateAll?: () => void;
  readOnly?: boolean;
}

export function SafetyConstraints({
  constraints,
  onConstraintUpdate,
  onConstraintToggle,
  onValidateAll,
  readOnly = false,
}: SafetyConstraintsProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["risk", "performance"])
  );

  const categorizedConstraints = constraints.reduce(
    (acc, constraint) => {
      if (!acc[constraint.category]) {
        acc[constraint.category] = [];
      }
      acc[constraint.category].push(constraint);
      return acc;
    },
    {} as Record<string, SafetyConstraint[]>
  );

  const overallStatus = useMemo(() => {
    const violationCount = constraints.filter(
      (c) => c.currentStatus === "violation"
    ).length;
    const warningCount = constraints.filter(
      (c) => c.currentStatus === "warning"
    ).length;
    const _enabledCount = constraints.filter((c) => c.enabled).length;

    if (violationCount > 0) return "critical";
    if (warningCount > 0) return "warning";
    return "healthy";
  }, [constraints]);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const renderConstraintControl = (constraint: SafetyConstraint) => {
    const handleValueChange = (newValue: any) => {
      if (!readOnly && onConstraintUpdate) {
        onConstraintUpdate(constraint.id, newValue);
      }
    };

    const handleToggle = (enabled: boolean) => {
      if (!readOnly && onConstraintToggle && !constraint.locked) {
        onConstraintToggle(constraint.id, enabled);
      }
    };

    switch (constraint.type) {
      case "threshold":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{constraint.name}</Label>
              <div className="flex items-center gap-2">
                {constraint.locked && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
                <Switch
                  checked={constraint.enabled}
                  onCheckedChange={handleToggle}
                  disabled={readOnly || constraint.locked}
                />
              </div>
            </div>

            <div className="px-3">
              <Slider
                value={[constraint.value]}
                onValueChange={(values) => handleValueChange(values[0])}
                min={constraint.validation.min || 0}
                max={constraint.validation.max || 100}
                step={0.1}
                disabled={!constraint.enabled || readOnly}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{constraint.validation.min || 0}</span>
                <span className="font-medium">{constraint.value}</span>
                <span>{constraint.validation.max || 100}</span>
              </div>
            </div>
          </div>
        );

      case "range": {
        const [min, max] = Array.isArray(constraint.value)
          ? constraint.value
          : [0, 100];
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{constraint.name}</Label>
              <div className="flex items-center gap-2">
                {constraint.locked && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
                <Switch
                  checked={constraint.enabled}
                  onCheckedChange={handleToggle}
                  disabled={readOnly || constraint.locked}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={min}
                onChange={(e) =>
                  handleValueChange([
                    Number.parseFloat(e.target.value) || 0,
                    max,
                  ])
                }
                disabled={!constraint.enabled || readOnly}
                className="text-sm"
              />
              <Input
                type="number"
                placeholder="Max"
                value={max}
                onChange={(e) =>
                  handleValueChange([
                    min,
                    Number.parseFloat(e.target.value) || 100,
                  ])
                }
                disabled={!constraint.enabled || readOnly}
                className="text-sm"
              />
            </div>
          </div>
        );
      }

      case "boolean":
        return (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-sm">{constraint.name}</Label>
              {constraint.locked && (
                <Lock className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <Switch
              checked={constraint.value}
              onCheckedChange={handleValueChange}
              disabled={!constraint.enabled || readOnly || constraint.locked}
            />
          </div>
        );

      case "enum":
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{constraint.name}</Label>
              <div className="flex items-center gap-2">
                {constraint.locked && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
                <Switch
                  checked={constraint.enabled}
                  onCheckedChange={handleToggle}
                  disabled={readOnly || constraint.locked}
                />
              </div>
            </div>

            <select
              value={constraint.value}
              onChange={(e) => handleValueChange(e.target.value)}
              disabled={!constraint.enabled || readOnly}
              className="w-full px-3 py-1 text-sm border rounded-md"
            >
              {constraint.validation.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );

      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ok":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "violation":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Settings className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants = {
      low: "secondary",
      medium: "default",
      high: "default",
      critical: "destructive",
    } as const;

    return (
      <Badge
        variant={variants[severity as keyof typeof variants] || "secondary"}
        className="text-xs"
      >
        {severity}
      </Badge>
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "risk":
        return <Shield className="h-4 w-4" />;
      case "performance":
        return <Settings className="h-4 w-4" />;
      case "compliance":
        return <Lock className="h-4 w-4" />;
      case "operational":
        return <Settings className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Safety Constraints
          </h2>
          <p className="text-muted-foreground">
            Configure safety limits for parameter optimization and trading
            operations
          </p>
        </div>

        <div className="flex items-center gap-2">
          {getStatusIcon(overallStatus)}
          <Badge
            variant={
              overallStatus === "critical"
                ? "destructive"
                : overallStatus === "warning"
                  ? "secondary"
                  : "default"
            }
          >
            {overallStatus}
          </Badge>

          {onValidateAll && (
            <Button variant="outline" size="sm" onClick={onValidateAll}>
              Validate All
            </Button>
          )}
        </div>
      </div>

      {/* Overall Status Alert */}
      {overallStatus !== "healthy" && (
        <Alert
          variant={overallStatus === "critical" ? "destructive" : "default"}
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {overallStatus === "critical"
              ? "Critical safety violations detected. Review and fix before proceeding."
              : "Some safety constraints are in warning state. Review recommended."}
          </AlertDescription>
        </Alert>
      )}

      {/* Constraint Categories */}
      {Object.entries(categorizedConstraints).map(
        ([category, categoryConstraints]) => (
          <Card key={category}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => toggleCategory(category)}
            >
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(category)}
                  <span className="capitalize">{category} Constraints</span>
                  <Badge variant="outline" className="text-xs">
                    {categoryConstraints.filter((c) => c.enabled).length}/
                    {categoryConstraints.length}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  {categoryConstraints.some(
                    (c) => c.currentStatus === "violation"
                  ) && <XCircle className="h-4 w-4 text-red-500" />}
                  {categoryConstraints.some(
                    (c) => c.currentStatus === "warning"
                  ) && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                  <span className="text-sm">
                    {expandedCategories.has(category) ? "▼" : "▶"}
                  </span>
                </div>
              </CardTitle>
            </CardHeader>

            {expandedCategories.has(category) && (
              <CardContent>
                <div className="space-y-6">
                  {categoryConstraints.map((constraint, index) => (
                    <div key={constraint.id}>
                      {index > 0 && <Separator />}

                      <div className="space-y-3">
                        {/* Constraint Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getStatusIcon(constraint.currentStatus)}
                              <span className="font-medium">
                                {constraint.name}
                              </span>
                              {getSeverityBadge(constraint.severity)}
                              {constraint.locked && (
                                <Badge variant="outline" className="text-xs">
                                  <Lock className="h-3 w-3 mr-1" />
                                  Locked
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {constraint.description}
                            </p>
                          </div>

                          <div className="text-right text-sm text-muted-foreground">
                            <div>
                              Last checked:{" "}
                              {new Date(
                                constraint.lastChecked
                              ).toLocaleTimeString()}
                            </div>
                            {constraint.violationCount > 0 && (
                              <div className="text-red-600">
                                {constraint.violationCount} violations
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Constraint Control */}
                        <div className="ml-6">
                          {renderConstraintControl(constraint)}
                        </div>

                        {/* Constraint Status */}
                        {constraint.currentStatus !== "ok" && (
                          <Alert
                            variant={
                              constraint.currentStatus === "violation"
                                ? "destructive"
                                : "default"
                            }
                            className="ml-6"
                          >
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              {constraint.currentStatus === "violation"
                                ? `Safety constraint violated! Current value exceeds safe limits.`
                                : `Warning: Constraint approaching limits. Monitor closely.`}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )
      )}

      {/* Constraint Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Constraint Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {constraints.filter((c) => c.currentStatus === "ok").length}
              </div>
              <div className="text-sm text-muted-foreground">Healthy</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {
                  constraints.filter((c) => c.currentStatus === "warning")
                    .length
                }
              </div>
              <div className="text-sm text-muted-foreground">Warnings</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {
                  constraints.filter((c) => c.currentStatus === "violation")
                    .length
                }
              </div>
              <div className="text-sm text-muted-foreground">Violations</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold">
                {constraints.filter((c) => c.enabled).length}
              </div>
              <div className="text-sm text-muted-foreground">Enabled</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm">
                Reset to Defaults
              </Button>
              <Button variant="outline" size="sm">
                Export Configuration
              </Button>
              <Button variant="outline" size="sm">
                Import Configuration
              </Button>
              <Button variant="outline" size="sm">
                View Violation History
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SafetyConstraints;
