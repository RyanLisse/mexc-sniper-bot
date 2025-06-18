"use client";

/**
 * Optimization History Component
 *
 * Displays the history and timeline of parameter optimization runs,
 * showing progress, results, and trends over time.
 */

import { Clock, TrendingUp, TrendingDown, Target, Play, Pause, CheckCircle2, XCircle, Settings } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface OptimizationRun {
  id: string;
  name: string;
  algorithm: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  startTime: string;
  endTime?: string;
  progress: number;
  currentIteration: number;
  maxIterations: number;
  bestScore: number;
  improvementPercent: number;
  parameters: Record<string, any>;
  objective: string;
  metadata: {
    totalEvaluations: number;
    convergenceReached: boolean;
    executionTime: number;
    resourceUsage: {
      cpu: number;
      memory: number;
    };
  };
}

interface OptimizationHistoryProps {
  runs: OptimizationRun[];
  onRunSelect?: (runId: string) => void;
  onRunAction?: (runId: string, action: 'pause' | 'resume' | 'stop' | 'restart') => void;
  selectedRunId?: string;
}

export function OptimizationHistory({ 
  runs, 
  onRunSelect, 
  onRunAction, 
  selectedRunId 
}: OptimizationHistoryProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('startTime');

  const filteredAndSortedRuns = useMemo(() => {
    let filtered = runs;
    
    if (filterStatus !== 'all') {
      filtered = runs.filter(run => run.status === filterStatus);
    }
    
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'startTime':
          return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        case 'bestScore':
          return b.bestScore - a.bestScore;
        case 'improvement':
          return b.improvementPercent - a.improvementPercent;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }, [runs, filterStatus, sortBy]);

  const selectedRun = useMemo(() => 
    runs.find(run => run.id === selectedRunId), 
    [runs, selectedRunId]
  );

  const runningRuns = runs.filter(run => run.status === 'running');
  const completedRuns = runs.filter(run => run.status === 'completed');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return <Settings className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'running':
        return 'default';
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'paused':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runs.length}</div>
            <p className="text-xs text-muted-foreground">
              {runningRuns.length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedRuns.length}</div>
            <p className="text-xs text-muted-foreground">
              {((completedRuns.length / Math.max(runs.length, 1)) * 100).toFixed(0)}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedRuns.length > 0 
                ? Math.max(...completedRuns.map(r => r.bestScore)).toFixed(2)
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Highest achieved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Improvement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              +{completedRuns.length > 0 
                ? (completedRuns.reduce((sum, r) => sum + r.improvementPercent, 0) / completedRuns.length).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Performance gain
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="startTime">Start Time</SelectItem>
              <SelectItem value="bestScore">Best Score</SelectItem>
              <SelectItem value="improvement">Improvement</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Optimization Run List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Optimization History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredAndSortedRuns.map((run) => (
                <div
                  key={run.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedRunId === run.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => onRunSelect?.(run.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(run.status)}
                      <h4 className="font-medium">{run.name}</h4>
                    </div>
                    <Badge variant={getStatusBadgeVariant(run.status)}>
                      {run.status}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Algorithm:</span>
                      <span className="font-medium">{run.algorithm}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Best Score:</span>
                      <span className="font-medium">{run.bestScore.toFixed(3)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Improvement:</span>
                      <span className={`font-medium flex items-center gap-1 ${
                        run.improvementPercent > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {run.improvementPercent > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {run.improvementPercent.toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Duration:</span>
                      <span>{formatDuration(run.startTime, run.endTime)}</span>
                    </div>
                  </div>

                  {/* Progress Bar for Running Tests */}
                  {run.status === 'running' && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Progress:</span>
                        <span>{run.currentIteration}/{run.maxIterations} iterations</span>
                      </div>
                      <Progress value={run.progress} className="h-2" />
                    </div>
                  )}

                  {/* Action Buttons for Running Tests */}
                  {run.status === 'running' && onRunAction && (
                    <div className="mt-3 pt-3 border-t flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRunAction(run.id, 'pause');
                        }}
                      >
                        <Pause className="h-3 w-3 mr-1" />
                        Pause
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRunAction(run.id, 'stop');
                        }}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Stop
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {filteredAndSortedRuns.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No optimization runs found matching the current filters.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Run Information */}
        {selectedRun && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                {selectedRun.name} - Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Run Metadata */}
                <div>
                  <h4 className="font-medium mb-3">Run Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(selectedRun.status)}
                        <span>{selectedRun.status}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Algorithm:</span>
                      <span>{selectedRun.algorithm}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Objective:</span>
                      <span>{selectedRun.objective}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Started:</span>
                      <span>{new Date(selectedRun.startTime).toLocaleString()}</span>
                    </div>
                    {selectedRun.endTime && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ended:</span>
                        <span>{new Date(selectedRun.endTime).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration:</span>
                      <span>{formatDuration(selectedRun.startTime, selectedRun.endTime)}</span>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div>
                  <h4 className="font-medium mb-3">Performance</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Best Score:</span>
                      <span className="text-lg font-bold">{selectedRun.bestScore.toFixed(4)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Improvement:</span>
                      <span className={`text-lg font-bold flex items-center gap-1 ${
                        selectedRun.improvementPercent > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedRun.improvementPercent > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {selectedRun.improvementPercent.toFixed(1)}%
                      </span>
                    </div>

                    {selectedRun.status === 'running' && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Progress:</span>
                          <span>{selectedRun.currentIteration}/{selectedRun.maxIterations}</span>
                        </div>
                        <Progress value={selectedRun.progress} className="h-2" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Resource Usage */}
                <div>
                  <h4 className="font-medium mb-3">Resource Usage</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CPU Usage:</span>
                      <span>{selectedRun.metadata.resourceUsage.cpu.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Memory Usage:</span>
                      <span>{selectedRun.metadata.resourceUsage.memory.toFixed(1)} MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Evaluations:</span>
                      <span>{selectedRun.metadata.totalEvaluations.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Execution Time:</span>
                      <span>{selectedRun.metadata.executionTime.toFixed(2)}s</span>
                    </div>
                  </div>
                </div>

                {/* Best Parameters */}
                <div>
                  <h4 className="font-medium mb-3">Best Parameters</h4>
                  <div className="space-y-1">
                    {Object.entries(selectedRun.parameters).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{key}:</span>
                        <span className="font-mono">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Convergence Status */}
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    {selectedRun.metadata.convergenceReached ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Target className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="font-medium text-sm">Convergence Status</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedRun.metadata.convergenceReached 
                      ? "Optimization has converged to an optimal solution."
                      : "Optimization is still searching for better solutions."
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default OptimizationHistory;