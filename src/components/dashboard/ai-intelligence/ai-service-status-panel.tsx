"use client";

import { AlertTriangle, Bot, CheckCircle, Circle, RefreshCw, XCircle } from "lucide-react";
import { useAIServiceHealthCheck, useAIServices } from "../../../hooks/use-ai-services";
import { Alert, AlertDescription, AlertTitle } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Progress } from "../../ui/progress";
import { Skeleton } from "../../ui/skeleton";

export function AIServiceStatusPanel() {
  const { data, isLoading, error } = useAIServices();
  const { triggerHealthCheck } = useAIServiceHealthCheck();

  const handleRefresh = async () => {
    await triggerHealthCheck();
  };

  if (isLoading) {
    return <AIServiceStatusSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Services Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading AI Services</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Unknown error occurred"}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "unavailable":
        return <Circle className="h-4 w-4 text-gray-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "default";
      case "degraded":
        return "secondary";
      case "error":
        return "destructive";
      case "unavailable":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <CardTitle>AI Services Status</CardTitle>
            <Badge variant={getStatusColor(data.overall.status)}>
              {data.overall.status.toUpperCase()}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        <CardDescription>
          {data.overall.message} ({data.overall.availableServices}/{data.overall.totalServices}{" "}
          services)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Health Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Service Availability</span>
            <span>
              {Math.round((data.overall.availableServices / data.overall.totalServices) * 100)}%
            </span>
          </div>
          <Progress
            value={(data.overall.availableServices / data.overall.totalServices) * 100}
            className="h-2"
          />
        </div>

        {/* Individual Service Status */}
        <div className="space-y-3">
          {Object.entries(data.services).map(([serviceName, service]) => (
            <div
              key={serviceName}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(service.status)}
                <div>
                  <div className="font-medium capitalize">{service.name}</div>
                  <div className="text-sm text-muted-foreground">{service.message}</div>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={getStatusColor(service.status)} className="mb-1">
                  {service.status}
                </Badge>
                <div className="text-xs text-muted-foreground">
                  {service.capabilities.length} capabilities
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Capabilities Overview */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">Available Capabilities</h4>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Pattern Embedding</span>
              <Badge variant={data.capabilities.patternEmbedding ? "default" : "outline"}>
                {data.capabilities.patternEmbedding ? "Available" : "Unavailable"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Market Research</span>
              <Badge variant={data.capabilities.marketResearch ? "default" : "outline"}>
                {data.capabilities.marketResearch ? "Available" : "Unavailable"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Fallback Analysis</span>
              <Badge variant={data.capabilities.fallbackAnalysis ? "default" : "outline"}>
                {data.capabilities.fallbackAnalysis ? "Available" : "Unavailable"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Last Updated */}
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Last updated: {new Date(data.lastUpdated).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

function AIServiceStatusSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="text-right">
                <Skeleton className="h-5 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
