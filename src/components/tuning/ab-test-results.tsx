"use client";

/**
 * A/B Test Results Component
 *
 * Displays results and analytics from A/B tests of trading parameters and strategies.
 * Helps users understand which parameter configurations perform better.
 */

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";

interface ABTestResult {
  id: string;
  name: string;
  description: string;
  status: "running" | "completed" | "paused";
  startDate: string;
  endDate?: string;
  variants: Array<{
    id: string;
    name: string;
    parameters: Record<string, unknown>;
    participants: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
    confidence: number;
    isControl: boolean;
    isWinner?: boolean;
  }>;
  metrics: {
    totalParticipants: number;
    duration: number;
    significance: number;
    improvementPercent: number;
  };
}

interface ABTestResultsProps {
  tests: ABTestResult[];
  onTestSelect?: (testId: string) => void;
  selectedTestId?: string;
}

export function ABTestResults({ tests, onTestSelect, selectedTestId }: ABTestResultsProps) {
  const selectedTest = useMemo(
    () => tests.find((test) => test.id === selectedTestId),
    [tests, selectedTestId]
  );

  const completedTests = tests.filter((test) => test.status === "completed");
  const runningTests = tests.filter((test) => test.status === "running");

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tests.length}</div>
            <p className="text-xs text-muted-foreground">
              {runningTests.length} running, {completedTests.length} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              +
              {completedTests.length > 0
                ? (
                    completedTests.reduce((sum, test) => sum + test.metrics.improvementPercent, 0) /
                    completedTests.length
                  ).toFixed(1)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">Across completed tests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Significance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedTests.length > 0
                ? (
                    completedTests.reduce((sum, test) => sum + test.metrics.significance, 0) /
                    completedTests.length
                  ).toFixed(1)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">Statistical confidence</p>
          </CardContent>
        </Card>
      </div>

      {/* Test List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              A/B Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedTestId === test.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                  onClick={() => onTestSelect?.(test.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium">{test.name}</h4>
                      <p className="text-sm text-muted-foreground">{test.description}</p>
                    </div>
                    <Badge
                      variant={
                        test.status === "completed"
                          ? "default"
                          : test.status === "running"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {test.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Participants:</span>
                      <span className="ml-1 font-medium">
                        {test.metrics.totalParticipants.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="ml-1 font-medium">{test.metrics.duration} days</span>
                    </div>
                  </div>

                  {test.status === "completed" && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {test.metrics.improvementPercent > 0 ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <TrendingUp className="h-4 w-4" />+
                              {test.metrics.improvementPercent.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-red-600 flex items-center gap-1">
                              <TrendingDown className="h-4 w-4" />
                              {test.metrics.improvementPercent.toFixed(1)}%
                            </span>
                          )}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {test.metrics.significance.toFixed(1)}% confidence
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Results */}
        {selectedTest && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {selectedTest.name} - Detailed Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Test Metadata */}
                <div>
                  <h4 className="font-medium mb-2">Test Information</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge
                        variant={selectedTest.status === "completed" ? "default" : "secondary"}
                      >
                        {selectedTest.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Start Date:</span>
                      <span>{new Date(selectedTest.startDate).toLocaleDateString()}</span>
                    </div>
                    {selectedTest.endDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">End Date:</span>
                        <span>{new Date(selectedTest.endDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Participants:</span>
                      <span>{selectedTest.metrics.totalParticipants.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Variant Results */}
                <div>
                  <h4 className="font-medium mb-3">Variant Performance</h4>
                  <div className="space-y-4">
                    {selectedTest.variants.map((variant) => (
                      <div key={variant.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{variant.name}</span>
                            {variant.isControl && (
                              <Badge variant="outline" className="text-xs">
                                Control
                              </Badge>
                            )}
                            {variant.isWinner && (
                              <Badge variant="default" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Winner
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm font-medium">
                            {variant.conversionRate.toFixed(2)}%
                          </span>
                        </div>

                        <div className="space-y-2">
                          <Progress value={variant.conversionRate} className="h-2" />

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Participants:</span>
                              <span className="ml-1">{variant.participants.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Conversions:</span>
                              <span className="ml-1">{variant.conversions.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Revenue:</span>
                              <span className="ml-1">${variant.revenue.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Confidence:</span>
                              <span className="ml-1">{variant.confidence.toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Parameter Configuration */}
                        <div className="mt-3 pt-3 border-t">
                          <span className="text-xs text-muted-foreground font-medium">
                            Parameters:
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(variant.parameters).map(([key, value]) => (
                              <Badge key={key} variant="outline" className="text-xs">
                                {key}: {String(value)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Statistical Significance */}
                {selectedTest.status === "completed" && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {selectedTest.metrics.significance >= 95 ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      )}
                      <span className="font-medium text-sm">Statistical Significance</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This test achieved {selectedTest.metrics.significance.toFixed(1)}% statistical
                      confidence.
                      {selectedTest.metrics.significance >= 95
                        ? " The results are statistically significant and reliable."
                        : " Consider running the test longer for more reliable results."}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default ABTestResults;
