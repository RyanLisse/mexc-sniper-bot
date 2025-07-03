/**
 * Pattern Analysis Workflow Service
 * 
 * Orchestrates end-to-end pattern analysis workflows combining detection,
 * embedding generation, trend analysis, and historical performance evaluation.
 * 
 * This service bridges the gap between individual pattern detection components
 * and provides a comprehensive analysis pipeline for real-time trading decisions.
 */

import type { PatternAnalysisRequest, PatternAnalysisResult, PatternMatch } from '../../core/pattern-detection/interfaces';
import { PatternDetectionCore } from '../../core/pattern-detection/pattern-detection-core';
import { toSafeError } from '../../lib/error-type-utils';
import type { CalendarEntry, SymbolEntry } from '../api/mexc-unified-exports';
import { type HistoricalTimeRange, type PatternData, PatternEmbeddingService, type PatternTimeWindow } from '../data/pattern-embedding-service';

export interface WorkflowRequest {
  // Core detection parameters
  symbols?: SymbolEntry[];
  calendarEntries?: CalendarEntry[];
  analysisType: 'discovery' | 'monitoring' | 'validation' | 'correlation';
  
  // Advanced options
  includeHistoricalAnalysis?: boolean;
  includeTrendAnalysis?: boolean;
  includeEmbeddingAnalysis?: boolean;
  confidenceThreshold?: number;
  timeRange?: HistoricalTimeRange;
}

export interface WorkflowResult {
  // Core pattern detection results
  detectionResult: PatternAnalysisResult;
  
  // Enhanced analysis results
  embeddingAnalysis?: {
    similarPatterns: Array<{
      patternId: string;
      similarity: number;
      historicalSuccess: number;
    }>;
    clusteringResults: {
      clusters: number;
      patternGroups: string[][];
    };
  };
  
  trendAnalysis?: {
    trends: Array<{
      patternType: string;
      direction: 'increasing' | 'decreasing' | 'stable';
      strength: number;
      confidence: number;
    }>;
    insights: string[];
    alerts: string[];
  };
  
  historicalAnalysis?: {
    patternPerformance: Map<string, {
      successRate: number;
      avgProfit: number;
      recommendations: string[];
    }>;
    marketConditionAnalysis: {
      bestConditions: string[];
      worstConditions: string[];
      adaptationTips: string[];
    };
  };
  
  // Workflow metadata
  executionMetadata: {
    totalDuration: number;
    componentsExecuted: string[];
    cacheHitRatio: number;
    analysisQuality: 'high' | 'medium' | 'low';
  };
}

/**
 * Pattern Analysis Workflow Service
 * 
 * Main orchestrator for comprehensive pattern analysis workflows
 */
export class PatternAnalysisWorkflow {
  private static instance: PatternAnalysisWorkflow;
  
  private patternDetectionCore: PatternDetectionCore;
  private patternEmbeddingService: PatternEmbeddingService;
  
  private constructor() {
    this.patternDetectionCore = PatternDetectionCore.getInstance();
    this.patternEmbeddingService = new PatternEmbeddingService();
  }
  
  static getInstance(): PatternAnalysisWorkflow {
    if (!PatternAnalysisWorkflow.instance) {
      PatternAnalysisWorkflow.instance = new PatternAnalysisWorkflow();
    }
    return PatternAnalysisWorkflow.instance;
  }
  
  /**
   * Execute comprehensive pattern analysis workflow
   */
  async executeWorkflow(request: WorkflowRequest): Promise<WorkflowResult> {
    const startTime = Date.now();
    const componentsExecuted: string[] = [];
    
    try {
      console.info('Starting pattern analysis workflow', {
        analysisType: request.analysisType,
        symbolsCount: request.symbols?.length || 0,
        calendarEntriesCount: request.calendarEntries?.length || 0,
        includeHistorical: request.includeHistoricalAnalysis,
        includeTrends: request.includeTrendAnalysis,
        includeEmbeddings: request.includeEmbeddingAnalysis,
      });
      
      // Phase 1: Core Pattern Detection
      const detectionRequest: PatternAnalysisRequest = {
        symbols: request.symbols,
        calendarEntries: request.calendarEntries,
        analysisType: request.analysisType,
        confidenceThreshold: request.confidenceThreshold,
        includeHistorical: request.includeHistoricalAnalysis,
      };
      
      const detectionResult = await this.patternDetectionCore.analyzePatterns(detectionRequest);
      componentsExecuted.push('pattern-detection');
      
      // Initialize result object
      const result: WorkflowResult = {
        detectionResult,
        executionMetadata: {
          totalDuration: 0,
          componentsExecuted,
          cacheHitRatio: 0,
          analysisQuality: 'medium',
        },
      };
      
      // Phase 2: Embedding Analysis (if requested and patterns found)
      if (request.includeEmbeddingAnalysis && detectionResult.matches.length > 0) {
        try {
          result.embeddingAnalysis = await this.performEmbeddingAnalysis(detectionResult.matches);
          componentsExecuted.push('embedding-analysis');
        } catch (error) {
          console.warn('Embedding analysis failed, continuing without it', toSafeError(error));
        }
      }
      
      // Phase 3: Trend Analysis (if requested)
      if (request.includeTrendAnalysis && detectionResult.matches.length > 0) {
        try {
          result.trendAnalysis = await this.performTrendAnalysis(detectionResult.matches);
          componentsExecuted.push('trend-analysis');
        } catch (error) {
          console.warn('Trend analysis failed, continuing without it', toSafeError(error));
        }
      }
      
      // Phase 4: Historical Analysis (if requested)
      if (request.includeHistoricalAnalysis && detectionResult.matches.length > 0) {
        try {
          result.historicalAnalysis = await this.performHistoricalAnalysis(
            detectionResult.matches,
            request.timeRange
          );
          componentsExecuted.push('historical-analysis');
        } catch (error) {
          console.warn('Historical analysis failed, continuing without it', toSafeError(error));
        }
      }
      
      // Calculate final metadata
      const totalDuration = Date.now() - startTime;
      const cacheStats = this.patternDetectionCore.getMetrics();
      
      result.executionMetadata = {
        totalDuration,
        componentsExecuted,
        cacheHitRatio: cacheStats.cacheHitRatio,
        analysisQuality: this.assessAnalysisQuality(result, totalDuration),
      };
      
      console.info('Pattern analysis workflow completed', {
        duration: totalDuration,
        components: componentsExecuted,
        patternsFound: detectionResult.matches.length,
        quality: result.executionMetadata.analysisQuality,
      });
      
      return result;
      
    } catch (error) {
      const safeError = toSafeError(error);
      console.error('Pattern analysis workflow failed', {
        error: safeError.message,
        componentsExecuted,
        duration: Date.now() - startTime,
      });
      
      // Return minimal result on failure
      return {
        detectionResult: {
          matches: [],
          summary: {
            totalAnalyzed: 0,
            readyStateFound: 0,
            highConfidenceMatches: 0,
            advanceOpportunities: 0,
            averageConfidence: 0,
          },
          recommendations: { immediate: [], monitor: [], prepare: [] },
          correlations: [],
          analysisMetadata: {
            executionTime: Date.now() - startTime,
            algorithmsUsed: [],
            confidenceDistribution: {},
          },
        },
        executionMetadata: {
          totalDuration: Date.now() - startTime,
          componentsExecuted,
          cacheHitRatio: 0,
          analysisQuality: 'low',
        },
      };
    }
  }
  
  /**
   * Perform embedding-based similarity analysis
   */
  private async performEmbeddingAnalysis(matches: PatternMatch[]) {
    const similarPatterns: Array<{
      patternId: string;
      similarity: number;
      historicalSuccess: number;
    }> = [];
    
    // Generate embeddings for detected patterns
    const embeddings = await Promise.all(
      matches.map(async (match) => {
        const patternData: PatternData = {
          id: `${match.symbol}-${match.patternType}-${Date.now()}`,
          type: this.mapPatternTypeToEmbeddingType(match.patternType),
          timestamp: typeof match.detectedAt === 'number' ? match.detectedAt : match.detectedAt.getTime(),
          confidence: match.confidence / 100, // Convert to 0-1 range
          data: {
            symbol: match.symbol,
            confidence: match.confidence,
            advanceHours: match.advanceNoticeHours,
            riskLevel: match.riskLevel,
            ...match.indicators,
          },
        };
        
        const embedding = await this.patternEmbeddingService.generateEmbedding(patternData);
        return { pattern: match, embedding, patternData };
      })
    );
    
    // Find similar patterns for each detected pattern
    for (const { pattern, embedding, patternData } of embeddings) {
      try {
        const storedEmbedding = await this.patternEmbeddingService.storePattern(patternData);
        
        // For now, add self as similar pattern (in real implementation, this would query a database)
        similarPatterns.push({
          patternId: pattern.symbol,
          similarity: 1.0,
          historicalSuccess: pattern.historicalSuccess || 0.7,
        });
      } catch (error) {
        console.warn('Failed to process embedding for pattern', pattern.symbol, error);
      }
    }
    
    // Simple clustering based on pattern types
    const patternTypes = Array.from(new Set(matches.map(m => m.patternType)));
    const patternGroups = patternTypes.map(type => 
      matches.filter(m => m.patternType === type).map(m => m.symbol)
    );
    
    return {
      similarPatterns,
      clusteringResults: {
        clusters: patternGroups.length,
        patternGroups,
      },
    };
  }
  
  /**
   * Perform trend analysis on detected patterns
   */
  private async performTrendAnalysis(matches: PatternMatch[]) {
    const trends: Array<{
      patternType: string;
      direction: 'increasing' | 'decreasing' | 'stable';
      strength: number;
      confidence: number;
    }> = [];
    
    // Group patterns by type for trend analysis
    const patternsByType = new Map<string, PatternMatch[]>();
    for (const match of matches) {
      if (!patternsByType.has(match.patternType)) {
        patternsByType.set(match.patternType, []);
      }
      patternsByType.get(match.patternType)!.push(match);
    }
    
    // Analyze trends for each pattern type
    for (const [patternType, patterns] of patternsByType) {
      // Create time windows from pattern data
      const timeWindows: PatternTimeWindow[] = patterns.map(pattern => ({
        timestamp: typeof pattern.detectedAt === 'number' ? pattern.detectedAt : pattern.detectedAt.getTime(),
        volume: pattern.indicators.advanceHours || 0,
        confidence: pattern.confidence / 100,
        frequency: 1, // Each pattern represents one occurrence
      }));
      
      try {
        const trendResult = await this.patternEmbeddingService.detectPatternTrends(patternType, timeWindows);
        
        if (trendResult.trends.length > 0) {
          const avgTrend = trendResult.trends[trendResult.trends.length - 1]; // Most recent trend
          trends.push({
            patternType,
            direction: avgTrend.trend,
            strength: avgTrend.strength,
            confidence: avgTrend.confidence,
          });
        }
      } catch (error) {
        console.warn(`Trend analysis failed for pattern type ${patternType}`, error);
      }
    }
    
    // Generate insights
    const insights: string[] = [];
    const alerts: string[] = [];
    
    for (const trend of trends) {
      if (trend.strength > 0.7) {
        insights.push(`Strong ${trend.direction} trend detected for ${trend.patternType} patterns`);
      }
      
      if (trend.direction === 'decreasing' && trend.strength > 0.6) {
        alerts.push(`Declining trend alert: ${trend.patternType} pattern confidence decreasing`);
      }
    }
    
    return { trends, insights, alerts };
  }
  
  /**
   * Perform historical performance analysis
   */
  private async performHistoricalAnalysis(
    matches: PatternMatch[],
    timeRange?: HistoricalTimeRange
  ) {
    const patternPerformance = new Map<string, {
      successRate: number;
      avgProfit: number;
      recommendations: string[];
    }>();
    
    // Default time range to last 30 days if not provided
    const defaultTimeRange: HistoricalTimeRange = {
      startTimestamp: Date.now() - (30 * 24 * 60 * 60 * 1000),
      endTimestamp: Date.now(),
    };
    
    const analysisTimeRange = timeRange || defaultTimeRange;
    
    // Analyze each unique pattern type
    const uniquePatternTypes = Array.from(new Set(matches.map(m => m.patternType)));
    
    for (const patternType of uniquePatternTypes) {
      try {
        const analysis = await this.patternEmbeddingService.analyzeHistoricalPerformance(
          patternType,
          analysisTimeRange
        );
        
        patternPerformance.set(patternType, {
          successRate: analysis.summary.successRate,
          avgProfit: analysis.summary.avgProfit,
          recommendations: analysis.recommendations,
        });
      } catch (error) {
        console.warn(`Historical analysis failed for pattern ${patternType}`, error);
      }
    }
    
    // Market condition analysis
    const marketConditionAnalysis = {
      bestConditions: ['Normal market conditions', 'High confidence patterns'],
      worstConditions: ['High volatility periods', 'Low confidence patterns'],
      adaptationTips: [
        'Reduce position sizes during volatile market conditions',
        'Prioritize high-confidence patterns over 80%',
        'Monitor market sentiment before executing trades',
      ],
    };
    
    return {
      patternPerformance,
      marketConditionAnalysis,
    };
  }
  
  /**
   * Map pattern types to embedding types
   */
  private mapPatternTypeToEmbeddingType(patternType: string): 'price' | 'volume' | 'technical' | 'market' {
    switch (patternType) {
      case 'ready_state':
      case 'pre_ready':
        return 'technical';
      case 'launch_sequence':
        return 'market';
      case 'risk_warning':
        return 'market';
      default:
        return 'technical';
    }
  }
  
  /**
   * Assess the quality of the analysis based on results and performance
   */
  private assessAnalysisQuality(result: WorkflowResult, duration: number): 'high' | 'medium' | 'low' {
    let qualityScore = 0;
    
    // Pattern detection quality
    if (result.detectionResult.matches.length > 0) qualityScore += 3;
    if (result.detectionResult.summary.averageConfidence > 80) qualityScore += 2;
    if (result.detectionResult.correlations && result.detectionResult.correlations.length > 0) qualityScore += 1;
    
    // Additional analysis quality
    if (result.embeddingAnalysis) qualityScore += 2;
    if (result.trendAnalysis) qualityScore += 2;
    if (result.historicalAnalysis) qualityScore += 2;
    
    // Performance quality
    if (duration < 5000) qualityScore += 1; // Under 5 seconds
    if (result.executionMetadata.cacheHitRatio > 0.5) qualityScore += 1;
    
    // Quality assessment
    if (qualityScore >= 10) return 'high';
    if (qualityScore >= 6) return 'medium';
    return 'low';
  }
}

// Export singleton instance
export const patternAnalysisWorkflow = PatternAnalysisWorkflow.getInstance();