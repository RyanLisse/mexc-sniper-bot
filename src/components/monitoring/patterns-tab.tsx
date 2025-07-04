"use client";

/**
 * Patterns Tab Component
 *
 * Displays pattern detection analytics including performance, advance detection metrics,
 * and pattern type distribution. Shows the core competitive advantage metrics.
 */

import { memo, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  createTooltipFormatter,
  generateListKey,
} from "../../lib/react-utilities";
import type { AnalyticsTabProps } from "../../types/trading-analytics-types";

export const PatternsTab = memo(function PatternsTab({
  data,
  formatCurrency,
  formatPercentage,
  getPerformanceColor,
}: AnalyticsTabProps) {
  // Memoize chart data for performance
  const patternPerformanceData = useMemo(() => {
    if (!data?.patternAnalytics?.patternPerformance) return [];
    return data.patternAnalytics.patternPerformance;
  }, [data?.patternAnalytics?.patternPerformance]);

  // Memoize tooltip formatters
  const percentageTooltipFormatter = useMemo(
    () => createTooltipFormatter((value) => `${value}%`),
    []
  );

  return (
    <div className="space-y-4">
      {/* Pattern Performance and Advance Detection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pattern Performance</CardTitle>
            <CardDescription>Success rates by pattern type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={patternPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="pattern" />
                <YAxis />
                <Tooltip formatter={percentageTooltipFormatter} />
                <Bar dataKey="successRate" fill="#8884d8" name="Success Rate" />
                <Bar dataKey="avgReturn" fill="#82ca9d" name="Avg Return" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Advance Detection Metrics</CardTitle>
            <CardDescription>
              3.5+ hour advance detection performance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {data.patternAnalytics.advanceDetectionMetrics.averageAdvanceTime.toFixed(
                    1
                  )}
                  h
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg Advance Time
                </p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {
                    data.patternAnalytics.advanceDetectionMetrics
                      .optimalDetections
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  Optimal Detections
                </p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {data.patternAnalytics.advanceDetectionMetrics.detectionAccuracy.toFixed(
                    1
                  )}
                  %
                </div>
                <p className="text-xs text-muted-foreground">Accuracy</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Detection Accuracy</span>
                  <span>
                    {data.patternAnalytics.advanceDetectionMetrics.detectionAccuracy.toFixed(
                      1
                    )}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    data.patternAnalytics.advanceDetectionMetrics
                      .detectionAccuracy
                  }
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Pattern Confidence</span>
                  <span>
                    {data.patternAnalytics.averageConfidence.toFixed(1)}%
                  </span>
                </div>
                <Progress value={data.patternAnalytics.averageConfidence} />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Ready State Patterns</span>
                  <span>
                    {data.patternAnalytics.readyStatePatterns} detected
                  </span>
                </div>
                <Progress
                  value={
                    (data.patternAnalytics.readyStatePatterns /
                      data.patternAnalytics.totalPatternsDetected) *
                    100
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pattern Types Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Pattern Types Distribution</CardTitle>
          <CardDescription>Breakdown of detected pattern types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.patternAnalytics.patternTypes.map((type, index) => (
              <div
                key={generateListKey(type, index, "type")}
                className="text-center p-4 rounded-lg border"
              >
                <div className="text-2xl font-bold text-blue-600">
                  {type.count}
                </div>
                <p className="text-sm text-muted-foreground capitalize">
                  {type.type.replace(/[-_]/g, " ")}
                </p>
                <div className="mt-2">
                  <Progress
                    value={
                      (type.count /
                        data.patternAnalytics.totalPatternsDetected) *
                      100
                    }
                    className="h-2"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pattern Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Detection Summary</CardTitle>
            <CardDescription>Overall pattern detection metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {data.patternAnalytics.totalPatternsDetected}
              </div>
              <p className="text-sm text-muted-foreground">
                Total Patterns Detected
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {data.patternAnalytics.successfulPatterns}
              </div>
              <p className="text-sm text-muted-foreground">
                Successful Patterns
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Success Rate</CardTitle>
            <CardDescription>Pattern execution success rate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {data.patternAnalytics.patternSuccessRate.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">
                Overall Success Rate
              </p>
            </div>
            <Progress
              value={data.patternAnalytics.patternSuccessRate}
              className="h-4"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Confidence Score</CardTitle>
            <CardDescription>Average pattern confidence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {data.patternAnalytics.averageConfidence.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground">
                Average Confidence
              </p>
            </div>
            <Progress
              value={data.patternAnalytics.averageConfidence}
              className="h-4"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default PatternsTab;
