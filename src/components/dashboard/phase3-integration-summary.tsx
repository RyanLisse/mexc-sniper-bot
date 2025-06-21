"use client";

import { Brain, CheckCircle, Database, Gauge, Settings, Zap } from "lucide-react";
import { useAIServices } from "../../hooks/use-ai-services";
import { useCacheMetrics } from "../../hooks/use-cache-metrics";
import { useEnhancedPatterns } from "../../hooks/use-enhanced-patterns";
import { usePhase3FeatureStatus } from "../../hooks/use-phase3-config";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";

// Type definitions for component props
interface AIServicesData {
  overall?: {
    status: string;
    availableServices: number;
    totalServices: number;
  };
  services?: {
    cohere?: { available: boolean };
    perplexity?: { available: boolean };
    openai?: { available: boolean };
  };
}

interface CacheMetricsData {
  warming?: {
    isActive: boolean;
    metrics?: {
      successRate: number;
    };
  };
  connection?: {
    redis?: { connected: boolean };
    valkey?: { connected: boolean };
  };
  performance?: {
    hitRate: number;
  };
}

interface EnhancedPatternsData {
  summary?: {
    totalPatterns: number;
    aiEnhancedPatterns: number;
    averageConfidence: number;
    averageAdvanceHours: number;
  };
}

interface FeatureStatusData {
  aiIntelligenceEnabled?: boolean;
  cacheWarmingEnabled?: boolean;
  performanceMonitoringEnabled?: boolean;
  advanceDetectionEnabled?: boolean;
  targetAdvanceHours?: number;
}

// Helper function for overall status
const getOverallStatus = (
  aiServices: AIServicesData | undefined,
  cacheMetrics: CacheMetricsData | undefined,
  enhancedPatterns: EnhancedPatternsData | undefined,
  featureStatus: FeatureStatusData | undefined
) => {
  const checks = [
    aiServices?.overall?.status === "healthy",
    cacheMetrics?.connection?.redis?.connected || cacheMetrics?.connection?.valkey?.connected,
    enhancedPatterns?.summary?.totalPatterns > 0,
    featureStatus?.aiIntelligenceEnabled,
  ];

  const healthyCount = checks.filter(Boolean).length;
  const totalChecks = checks.length;

  if (healthyCount === totalChecks) return { status: "excellent", color: "green" };
  if (healthyCount >= totalChecks * 0.75) return { status: "good", color: "blue" };
  if (healthyCount >= totalChecks * 0.5) return { status: "fair", color: "yellow" };
  return { status: "needs attention", color: "red" };
};

// Sub-components for Phase3IntegrationSummary
function AIIntelligenceStatus({ aiServices }: { aiServices: AIServicesData | undefined }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4" />
        <h4 className="font-medium">AI Intelligence Integration</h4>
        <Badge variant={aiServices?.overall?.status === "healthy" ? "default" : "destructive"}>
          {aiServices?.overall?.status || "unknown"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex items-center justify-between p-2 border rounded">
          <span className="text-sm">Cohere Embeddings</span>
          <Badge variant={aiServices?.services?.cohere?.available ? "default" : "outline"}>
            {aiServices?.services?.cohere?.available ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex items-center justify-between p-2 border rounded">
          <span className="text-sm">Perplexity Research</span>
          <Badge variant={aiServices?.services?.perplexity?.available ? "default" : "outline"}>
            {aiServices?.services?.perplexity?.available ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex items-center justify-between p-2 border rounded">
          <span className="text-sm">OpenAI Fallback</span>
          <Badge variant={aiServices?.services?.openai?.available ? "default" : "outline"}>
            {aiServices?.services?.openai?.available ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      {aiServices?.overall && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Service Availability</span>
            <span>
              {aiServices.overall.availableServices}/{aiServices.overall.totalServices} services
            </span>
          </div>
          <Progress
            value={(aiServices.overall.availableServices / aiServices.overall.totalServices) * 100}
            className="h-2"
          />
        </div>
      )}
    </div>
  );
}

function PatternDetectionStatus({
  featureStatus,
  enhancedPatterns,
}: {
  featureStatus: FeatureStatusData | undefined;
  enhancedPatterns: EnhancedPatternsData | undefined;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4" />
        <h4 className="font-medium">Pattern Detection Enhancement</h4>
        <Badge variant={featureStatus?.advanceDetectionEnabled ? "default" : "outline"}>
          {featureStatus?.advanceDetectionEnabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Detected Patterns</span>
            <span>{enhancedPatterns?.summary?.totalPatterns || 0}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>AI Enhanced</span>
            <span>{enhancedPatterns?.summary?.aiEnhancedPatterns || 0}</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Avg Confidence</span>
            <span>{enhancedPatterns?.summary?.averageConfidence?.toFixed(1) || 0}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Avg Advance Hours</span>
            <span>{enhancedPatterns?.summary?.averageAdvanceHours?.toFixed(1) || 0}h</span>
          </div>
        </div>
      </div>

      {featureStatus?.targetAdvanceHours && (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>3.5+ Hour Detection Target</span>
            <span>
              {(enhancedPatterns?.summary?.averageAdvanceHours || 0) >=
              featureStatus.targetAdvanceHours
                ? "✅ Met"
                : "⏳ In Progress"}
            </span>
          </div>
          <Progress
            value={Math.min(
              100,
              ((enhancedPatterns?.summary?.averageAdvanceHours || 0) /
                featureStatus.targetAdvanceHours) *
                100
            )}
            className="h-2"
          />
        </div>
      )}
    </div>
  );
}

function CacheWarmingStatus({ cacheMetrics }: { cacheMetrics: CacheMetricsData | undefined }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4" />
        <h4 className="font-medium">Cache Warming Service</h4>
        <Badge variant={cacheMetrics?.warming?.isActive ? "default" : "outline"}>
          {cacheMetrics?.warming?.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Cache Hit Rate</span>
            <span>{cacheMetrics?.performance?.hitRate?.toFixed(1) || 0}%</span>
          </div>
          <Progress value={cacheMetrics?.performance?.hitRate || 0} className="h-2" />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Success Rate</span>
            <span>{cacheMetrics?.warming?.metrics?.successRate?.toFixed(1) || 0}%</span>
          </div>
          <Progress value={cacheMetrics?.warming?.metrics?.successRate || 0} className="h-2" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground">Redis:</span>
          <Badge
            variant={cacheMetrics?.connection?.redis?.connected ? "default" : "destructive"}
            className="ml-1"
          >
            {cacheMetrics?.connection?.redis?.connected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
        <div>
          <span className="text-muted-foreground">Valkey:</span>
          <Badge
            variant={cacheMetrics?.connection?.valkey?.connected ? "default" : "destructive"}
            className="ml-1"
          >
            {cacheMetrics?.connection?.valkey?.connected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function ConfigurationStatus({ featureStatus }: { featureStatus: FeatureStatusData | undefined }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4" />
        <h4 className="font-medium">Configuration Status</h4>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span>AI Intelligence</span>
          <Badge variant={featureStatus?.aiIntelligenceEnabled ? "default" : "outline"}>
            {featureStatus?.aiIntelligenceEnabled ? "On" : "Off"}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span>Cache Warming</span>
          <Badge variant={featureStatus?.cacheWarmingEnabled ? "default" : "outline"}>
            {featureStatus?.cacheWarmingEnabled ? "On" : "Off"}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span>Performance Monitoring</span>
          <Badge variant={featureStatus?.performanceMonitoringEnabled ? "default" : "outline"}>
            {featureStatus?.performanceMonitoringEnabled ? "On" : "Off"}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span>Advance Detection</span>
          <Badge variant={featureStatus?.advanceDetectionEnabled ? "default" : "outline"}>
            {featureStatus?.advanceDetectionEnabled ? "On" : "Off"}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export function Phase3IntegrationSummary() {
  const { data: aiServices } = useAIServices();
  const { data: cacheMetrics } = useCacheMetrics();
  const { data: enhancedPatterns } = useEnhancedPatterns();
  const { data: featureStatus } = usePhase3FeatureStatus();

  const overallStatus = getOverallStatus(aiServices, cacheMetrics, enhancedPatterns, featureStatus);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            <CardTitle>Phase 3 Integration Status</CardTitle>
            <Badge
              variant="outline"
              style={{
                borderColor: overallStatus.color,
                color: overallStatus.color,
              }}
            >
              {overallStatus.status.toUpperCase()}
            </Badge>
          </div>
          <CheckCircle className={`h-5 w-5 text-${overallStatus.color}-500`} />
        </div>
        <CardDescription>
          Real-time status of Phase 3 optimization features and integrations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AIIntelligenceStatus aiServices={aiServices} />
        <PatternDetectionStatus featureStatus={featureStatus} enhancedPatterns={enhancedPatterns} />
        <CacheWarmingStatus cacheMetrics={cacheMetrics} />
        <ConfigurationStatus featureStatus={featureStatus} />

        {/* Quick Actions */}
        <div className="border-t pt-3">
          <div className="text-xs text-muted-foreground text-center">
            All Phase 3 optimization features are now integrated and accessible through the
            dashboard. Use the tabs above to configure and monitor each component.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
