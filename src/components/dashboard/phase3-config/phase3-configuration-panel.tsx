"use client";

import { Brain, CheckCircle, Database, Settings, Zap } from "lucide-react";
import React, { useState, useEffect } from "react";
import { usePhase3Config, usePhase3ConfigUpdate, usePhase3ConfigValidation, getDefaultPhase3Config } from "../../../hooks/use-phase3-config";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Separator } from "../../ui/separator";
import { Switch } from "../../ui/switch";
import { useToast } from "../../ui/use-toast";

// ======================
// Types
// ======================

interface Phase3Configuration {
  aiIntelligence: {
    enabled: boolean;
    cohereEnabled: boolean;
    perplexityEnabled: boolean;
    openaiEnabled: boolean;
    confidenceThreshold: number;
    maxAIBoost: number;
  };
  patternDetection: {
    advanceDetectionEnabled: boolean;
    targetAdvanceHours: number;
    activityEnhancementEnabled: boolean;
    confidenceThreshold: number;
  };
  cacheWarming: {
    enabled: boolean;
    autoWarmingEnabled: boolean;
    warmingInterval: number;
    strategies: {
      mexcSymbols: boolean;
      patternData: boolean;
      activityData: boolean;
      calendarData: boolean;
    };
  };
  performance: {
    monitoringEnabled: boolean;
    alertsEnabled: boolean;
    metricsRetentionDays: number;
    performanceThresholds: {
      maxResponseTime: number;
      minHitRate: number;
      maxMemoryUsage: number;
    };
  };
}

// ======================
// Default Configuration
// ======================

const defaultConfig: Phase3Configuration = {
  aiIntelligence: {
    enabled: true,
    cohereEnabled: true,
    perplexityEnabled: true,
    openaiEnabled: false,
    confidenceThreshold: 70,
    maxAIBoost: 20,
  },
  patternDetection: {
    advanceDetectionEnabled: true,
    targetAdvanceHours: 3.5,
    activityEnhancementEnabled: true,
    confidenceThreshold: 70,
  },
  cacheWarming: {
    enabled: true,
    autoWarmingEnabled: true,
    warmingInterval: 30,
    strategies: {
      mexcSymbols: true,
      patternData: true,
      activityData: true,
      calendarData: true,
    },
  },
  performance: {
    monitoringEnabled: true,
    alertsEnabled: true,
    metricsRetentionDays: 7,
    performanceThresholds: {
      maxResponseTime: 100,
      minHitRate: 70,
      maxMemoryUsage: 500,
    },
  },
};

// ======================
// Main Component
// ======================

export function Phase3ConfigurationPanel() {
  const { data: configData, isLoading: configLoading, error: configError } = usePhase3Config();
  const { mutate: saveConfig, isPending: isSaving } = usePhase3ConfigUpdate();
  const { validateConfiguration } = usePhase3ConfigValidation();
  const { toast } = useToast();

  const [config, setConfig] = useState<Phase3Configuration>(getDefaultPhase3Config());
  const [hasChanges, setHasChanges] = useState(false);

  // Update local config when data is loaded
  useEffect(() => {
    if (configData?.configuration) {
      setConfig(configData.configuration);
      setHasChanges(false);
    }
  }, [configData]);

  const updateConfig = (section: keyof Phase3Configuration, key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const updateNestedConfig = (
    section: keyof Phase3Configuration,
    subsection: string,
    key: string,
    value: any
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subsection]: {
          ...(prev[section] as any)[subsection],
          [key]: value,
        },
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Validate configuration before saving
    const validation = validateConfiguration(config);
    if (!validation.valid) {
      toast({
        title: "Configuration Invalid",
        description: validation.errors.join(", "),
        variant: "destructive",
      });
      return;
    }

    saveConfig(config, {
      onSuccess: () => {
        toast({
          title: "Configuration Saved",
          description: "Phase 3 optimization settings have been updated successfully.",
        });
        setHasChanges(false);
      },
      onError: (error) => {
        toast({
          title: "Save Failed",
          description: error instanceof Error ? error.message : "Failed to save configuration. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const handleReset = () => {
    setConfig(getDefaultPhase3Config());
    setHasChanges(true);
    toast({
      title: "Configuration Reset",
      description: "Settings have been reset to default values.",
    });
  };

  if (configLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Phase 3 Configuration</CardTitle>
          </div>
          <CardDescription>Loading configuration...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (configError) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Phase 3 Configuration</CardTitle>
          </div>
          <CardDescription>Error loading configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-600">
            {configError instanceof Error ? configError.message : "Unknown error occurred"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Phase 3 Configuration</CardTitle>
            {hasChanges && (
              <Badge variant="secondary">Unsaved Changes</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              disabled={isSaving}
            >
              Reset to Defaults
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              size="sm"
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
        <CardDescription>
          Configure Phase 3 optimization features for enhanced performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI Intelligence Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            <h3 className="text-lg font-medium">AI Intelligence</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai-enabled">Enable AI Intelligence</Label>
              <Switch
                id="ai-enabled"
                checked={config.aiIntelligence.enabled}
                onCheckedChange={(checked) => updateConfig("aiIntelligence", "enabled", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="cohere-enabled">Cohere Embeddings</Label>
              <Switch
                id="cohere-enabled"
                checked={config.aiIntelligence.cohereEnabled}
                onCheckedChange={(checked) => updateConfig("aiIntelligence", "cohereEnabled", checked)}
                disabled={!config.aiIntelligence.enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="perplexity-enabled">Perplexity Research</Label>
              <Switch
                id="perplexity-enabled"
                checked={config.aiIntelligence.perplexityEnabled}
                onCheckedChange={(checked) => updateConfig("aiIntelligence", "perplexityEnabled", checked)}
                disabled={!config.aiIntelligence.enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="openai-enabled">OpenAI Fallback</Label>
              <Switch
                id="openai-enabled"
                checked={config.aiIntelligence.openaiEnabled}
                onCheckedChange={(checked) => updateConfig("aiIntelligence", "openaiEnabled", checked)}
                disabled={!config.aiIntelligence.enabled}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ai-confidence-threshold">AI Confidence Threshold (%)</Label>
              <Select
                value={config.aiIntelligence.confidenceThreshold.toString()}
                onValueChange={(value) => updateConfig("aiIntelligence", "confidenceThreshold", parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60%</SelectItem>
                  <SelectItem value="70">70%</SelectItem>
                  <SelectItem value="80">80%</SelectItem>
                  <SelectItem value="90">90%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-ai-boost">Max AI Boost (points)</Label>
              <Select
                value={config.aiIntelligence.maxAIBoost.toString()}
                onValueChange={(value) => updateConfig("aiIntelligence", "maxAIBoost", parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 points</SelectItem>
                  <SelectItem value="15">15 points</SelectItem>
                  <SelectItem value="20">20 points</SelectItem>
                  <SelectItem value="25">25 points</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Pattern Detection Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <h3 className="text-lg font-medium">Pattern Detection</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="advance-detection">3.5+ Hour Advance Detection</Label>
              <Switch
                id="advance-detection"
                checked={config.patternDetection.advanceDetectionEnabled}
                onCheckedChange={(checked) => updateConfig("patternDetection", "advanceDetectionEnabled", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="activity-enhancement">Activity Enhancement</Label>
              <Switch
                id="activity-enhancement"
                checked={config.patternDetection.activityEnhancementEnabled}
                onCheckedChange={(checked) => updateConfig("patternDetection", "activityEnhancementEnabled", checked)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target-advance-hours">Target Advance Hours</Label>
              <Select
                value={config.patternDetection.targetAdvanceHours.toString()}
                onValueChange={(value) => updateConfig("patternDetection", "targetAdvanceHours", parseFloat(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2.0">2.0 hours</SelectItem>
                  <SelectItem value="3.0">3.0 hours</SelectItem>
                  <SelectItem value="3.5">3.5 hours</SelectItem>
                  <SelectItem value="4.0">4.0 hours</SelectItem>
                  <SelectItem value="5.0">5.0 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pattern-confidence-threshold">Pattern Confidence Threshold (%)</Label>
              <Select
                value={config.patternDetection.confidenceThreshold.toString()}
                onValueChange={(value) => updateConfig("patternDetection", "confidenceThreshold", parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60%</SelectItem>
                  <SelectItem value="70">70%</SelectItem>
                  <SelectItem value="80">80%</SelectItem>
                  <SelectItem value="90">90%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Separator />

        {/* Cache Warming Configuration */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <h3 className="text-lg font-medium">Cache Warming</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="cache-warming-enabled">Enable Cache Warming</Label>
              <Switch
                id="cache-warming-enabled"
                checked={config.cacheWarming.enabled}
                onCheckedChange={(checked) => updateConfig("cacheWarming", "enabled", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="auto-warming">Auto Warming</Label>
              <Switch
                id="auto-warming"
                checked={config.cacheWarming.autoWarmingEnabled}
                onCheckedChange={(checked) => updateConfig("cacheWarming", "autoWarmingEnabled", checked)}
                disabled={!config.cacheWarming.enabled}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Warming Strategies</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(config.cacheWarming.strategies).map(([strategy, enabled]) => (
                <div key={strategy} className="flex items-center justify-between">
                  <Label htmlFor={`strategy-${strategy}`} className="text-sm">
                    {strategy.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Label>
                  <Switch
                    id={`strategy-${strategy}`}
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      updateNestedConfig("cacheWarming", "strategies", strategy, checked)
                    }
                    disabled={!config.cacheWarming.enabled}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
