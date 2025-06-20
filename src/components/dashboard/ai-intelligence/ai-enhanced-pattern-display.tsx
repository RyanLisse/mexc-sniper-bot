"use client";

import { Brain, Eye, Target, TrendingUp, Zap } from "lucide-react";
import { Badge } from "../../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card";
import { Progress } from "../../ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";

// ======================
// Types
// ======================

interface AIEnhancedPattern {
  symbolName: string;
  vcoinId: string;
  confidence: number;
  aiEnhancedConfidence?: number;
  patternType: "ready_state" | "pre_ready" | "emerging";
  detectionTime: string;
  advanceHours?: number;
  aiInsights?: {
    cohereEmbedding?: number[];
    perplexityInsights?: {
      sentiment: string;
      marketAnalysis: string;
      riskFactors: string[];
      opportunities: string[];
      confidence: number;
    };
    recommendations?: string[];
    aiConfidence?: number;
  };
  activityData?: {
    volume24h?: number;
    priceChange24h?: number;
    marketCap?: number;
    tradingPairs?: number;
  };
}

interface AIEnhancedPatternDisplayProps {
  patterns: AIEnhancedPattern[];
  isLoading?: boolean;
  showAdvanceDetection?: boolean;
  onPatternClick?: (pattern: AIEnhancedPattern) => void;
}

// ======================
// Main Component
// ======================

export function AIEnhancedPatternDisplay({
  patterns,
  isLoading = false,
  showAdvanceDetection = true,
  onPatternClick,
}: AIEnhancedPatternDisplayProps) {
  if (isLoading) {
    return <PatternDisplaySkeleton />;
  }

  if (!patterns || patterns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI-Enhanced Pattern Detection
          </CardTitle>
          <CardDescription>No patterns detected with AI enhancement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No AI-enhanced patterns found</p>
            <p className="text-sm">
              Patterns will appear here when detected with 3.5+ hour advance capability
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI-Enhanced Pattern Detection
          <Badge variant="secondary">{patterns.length} patterns</Badge>
        </CardTitle>
        <CardDescription>
          Patterns detected with AI intelligence and 3.5+ hour advance capability
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {patterns.map((pattern, index) => (
            <PatternCard
              key={`${pattern.vcoinId}-${index}`}
              pattern={pattern}
              showAdvanceDetection={showAdvanceDetection}
              onClick={() => onPatternClick?.(pattern)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ======================
// Pattern Card Component
// ======================

// Helper functions for PatternCard
const getPatternTypeColor = (type: string) => {
  switch (type) {
    case "ready_state":
      return "default";
    case "pre_ready":
      return "secondary";
    case "emerging":
      return "outline";
    default:
      return "outline";
  }
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 85) return "text-green-600";
  if (confidence >= 70) return "text-yellow-600";
  return "text-red-600";
};

// Sub-components for PatternCard
function PatternHeader({
  pattern,
  hasAIEnhancement,
}: { pattern: AIEnhancedPattern; hasAIEnhancement: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4" />
        <span className="font-medium">{pattern.symbolName}</span>
        <Badge variant={getPatternTypeColor(pattern.patternType)}>
          {pattern.patternType.replace("_", " ")}
        </Badge>
        {hasAIEnhancement && (
          <Badge variant="default" className="bg-purple-100 text-purple-800">
            <Brain className="h-3 w-3 mr-1" />
            AI Enhanced
          </Badge>
        )}
      </div>
      <div className="text-sm text-muted-foreground">
        {new Date(pattern.detectionTime).toLocaleTimeString()}
      </div>
    </div>
  );
}

function ConfidenceScores({ pattern }: { pattern: AIEnhancedPattern }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm">Base Confidence</span>
        <span className={`text-sm font-medium ${getConfidenceColor(pattern.confidence)}`}>
          {pattern.confidence.toFixed(1)}%
        </span>
      </div>
      <Progress value={pattern.confidence} className="h-2" />

      {pattern.aiEnhancedConfidence && pattern.aiEnhancedConfidence !== pattern.confidence && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm">AI-Enhanced Confidence</span>
            <span
              className={`text-sm font-medium ${getConfidenceColor(pattern.aiEnhancedConfidence)}`}
            >
              {pattern.aiEnhancedConfidence.toFixed(1)}%
              <span className="text-xs text-green-600 ml-1">
                (+{(pattern.aiEnhancedConfidence - pattern.confidence).toFixed(1)})
              </span>
            </span>
          </div>
          <Progress value={pattern.aiEnhancedConfidence} className="h-2" />
        </>
      )}
    </div>
  );
}

function AdvanceDetection({
  pattern,
  showAdvanceDetection,
}: { pattern: AIEnhancedPattern; showAdvanceDetection: boolean }) {
  if (!showAdvanceDetection || !pattern.advanceHours) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Zap className="h-4 w-4 text-blue-500" />
      <span>
        <strong>{pattern.advanceHours.toFixed(1)}h</strong> advance detection
      </span>
      {pattern.advanceHours >= 3.5 && (
        <Badge variant="default" className="bg-blue-100 text-blue-800">
          Target Met
        </Badge>
      )}
    </div>
  );
}

function AIInsightsPreview({ pattern }: { pattern: AIEnhancedPattern }) {
  if (!pattern.aiInsights) return null;

  return (
    <div className="space-y-2 border-t pt-3">
      {pattern.aiInsights.perplexityInsights && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-3 w-3" />
            <span className="font-medium">Market Sentiment:</span>
            <Badge variant="outline" className="text-xs">
              {pattern.aiInsights.perplexityInsights.sentiment}
            </Badge>
          </div>
          {pattern.aiInsights.perplexityInsights.opportunities.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-xs text-muted-foreground cursor-help">
                  {pattern.aiInsights.perplexityInsights.opportunities[0]}
                  {pattern.aiInsights.perplexityInsights.opportunities.length > 1 && "..."}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="max-w-xs">
                  <p className="font-medium mb-1">Opportunities:</p>
                  <ul className="text-xs space-y-1">
                    {pattern.aiInsights.perplexityInsights.opportunities.map((opp, index) => (
                      <li key={`opportunity-${index}-${opp.slice(0, 10)}`}>• {opp}</li>
                    ))}
                  </ul>
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {pattern.aiInsights.recommendations && pattern.aiInsights.recommendations.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">AI Recommendation:</span>{" "}
          {pattern.aiInsights.recommendations[0]}
        </div>
      )}

      {pattern.aiInsights.cohereEmbedding && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Pattern Embedding:</span>{" "}
          {pattern.aiInsights.cohereEmbedding.length}D vector
        </div>
      )}
    </div>
  );
}

function ActivityData({ pattern }: { pattern: AIEnhancedPattern }) {
  if (!pattern.activityData) return null;

  return (
    <div className="grid grid-cols-2 gap-4 text-xs border-t pt-3">
      {pattern.activityData.volume24h && (
        <div>
          <span className="text-muted-foreground">24h Volume:</span>
          <div className="font-medium">${pattern.activityData.volume24h.toLocaleString()}</div>
        </div>
      )}
      {pattern.activityData.priceChange24h && (
        <div>
          <span className="text-muted-foreground">24h Change:</span>
          <div
            className={`font-medium ${
              pattern.activityData.priceChange24h >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {pattern.activityData.priceChange24h >= 0 ? "+" : ""}
            {pattern.activityData.priceChange24h.toFixed(2)}%
          </div>
        </div>
      )}
    </div>
  );
}

function PatternCard({
  pattern,
  showAdvanceDetection,
  onClick,
}: {
  pattern: AIEnhancedPattern;
  showAdvanceDetection: boolean;
  onClick?: () => void;
}) {
  const hasAIEnhancement = Boolean(
    pattern.aiInsights &&
      (pattern.aiInsights.cohereEmbedding || pattern.aiInsights.perplexityInsights)
  );

  return (
    <TooltipProvider>
      <div
        className={`border rounded-lg p-4 space-y-3 transition-colors ${
          onClick ? "cursor-pointer hover:bg-muted/50" : ""
        }`}
        onClick={onClick}
        onKeyDown={(e) => {
          if (onClick && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onClick();
          }
        }}
        tabIndex={onClick ? 0 : undefined}
        role={onClick ? "button" : undefined}
      >
        <PatternHeader pattern={pattern} hasAIEnhancement={hasAIEnhancement} />
        <ConfidenceScores pattern={pattern} />
        <AdvanceDetection pattern={pattern} showAdvanceDetection={showAdvanceDetection} />
        <AIInsightsPreview pattern={pattern} />
        <ActivityData pattern={pattern} />
      </div>
    </TooltipProvider>
  );
}

// ======================
// Skeleton Component
// ======================

function PatternDisplaySkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-5 w-16 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-4 w-64 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-5 w-16 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-muted rounded animate-pulse" />
                <div className="h-2 w-full bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
