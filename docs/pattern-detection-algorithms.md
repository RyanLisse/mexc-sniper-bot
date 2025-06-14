# MEXC Sniper Bot - Pattern Detection Algorithms

## Overview

The MEXC Sniper Bot employs sophisticated AI-powered pattern detection algorithms to identify optimal trading opportunities on the MEXC exchange. This document details the pattern detection methodologies, algorithms, and configuration parameters.

## Core Pattern Detection Framework

### Primary Ready State Pattern

The system's most critical pattern is the **Ready State Detection** for MEXC cryptocurrency listings:

```typescript
// Primary Ready State Pattern
READY_STATE_PATTERN = {
  sts: 2,  // Symbol Trading Status: Ready for trading
  st: 2,   // Status: Confirmed ready
  tt: 4    // Trading Time: Active trading enabled
}

// Pattern confidence scoring
CONFIDENCE_THRESHOLDS = {
  HIGH: 90,     // sts:2, st:2, tt:4 exact match
  MEDIUM: 70,   // Partial pattern with supporting indicators
  LOW: 50,      // Weak pattern signals
  REJECT: 30    // Below threshold - ignore
}
```

### Pattern Analysis Request Interface

```typescript
interface PatternAnalysisRequest {
  symbolData?: SymbolData[];
  calendarData?: CalendarEntry[];
  analysisType: "discovery" | "monitoring" | "execution";
  timeframe?: string;
  confidenceThreshold?: number;  // Default: 70
}

interface SymbolData {
  cd: string;      // Coin ID
  sts: number;     // Symbol Trading Status
  st: number;      // Status
  tt: number;      // Trading Time
  symbol?: string; // Trading symbol
  [key: string]: unknown;
}
```

## Pattern Detection Algorithms

### 1. Ready State Detection Algorithm

**Algorithm:** Multi-stage pattern validation with confidence scoring

```typescript
class ReadyStateDetector {
  detectReadyState(symbolData: SymbolData): PatternMatch {
    const indicators = {
      stsMatch: symbolData.sts === 2,
      stMatch: symbolData.st === 2, 
      ttMatch: symbolData.tt === 4,
      hasCompleteData: this.validateDataCompleteness(symbolData),
      timingOptimal: this.assessTimingOptimality(symbolData),
    };
    
    // Exact pattern match - highest confidence
    if (indicators.stsMatch && indicators.stMatch && indicators.ttMatch) {
      return {
        patternType: "READY_STATE_EXACT",
        confidence: 95,
        indicators,
        recommendation: "IMMEDIATE_EXECUTION",
        riskLevel: "low",
      };
    }
    
    // Partial pattern with progression indicators
    if (this.detectProgression(symbolData)) {
      return {
        patternType: "READY_STATE_APPROACHING", 
        confidence: 75,
        indicators,
        recommendation: "MONITOR_CLOSELY",
        riskLevel: "medium",
      };
    }
    
    return this.noPatternFound();
  }
  
  private detectProgression(data: SymbolData): boolean {
    // Check for status progression patterns
    return (data.sts >= 1 && data.st >= 1 && data.tt >= 2);
  }
}
```

### 2. Status Transition Detection

**Algorithm:** Time-series analysis of status changes

```typescript
class StatusTransitionDetector {
  private statusHistory: Map<string, SymbolData[]> = new Map();
  
  analyzeTransition(vcoinId: string, currentData: SymbolData): TransitionPattern {
    const history = this.statusHistory.get(vcoinId) || [];
    history.push(currentData);
    this.statusHistory.set(vcoinId, history.slice(-10)); // Keep last 10 states
    
    if (history.length < 2) {
      return { transition: "INSUFFICIENT_DATA", confidence: 0 };
    }
    
    const transitions = this.calculateTransitions(history);
    return this.analyzeTransitionPattern(transitions);
  }
  
  private calculateTransitions(history: SymbolData[]): Transition[] {
    const transitions: Transition[] = [];
    
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      
      transitions.push({
        stsChange: curr.sts - prev.sts,
        stChange: curr.st - prev.st,
        ttChange: curr.tt - prev.tt,
        timestamp: Date.now(),
        velocity: this.calculateChangeVelocity(prev, curr),
      });
    }
    
    return transitions;
  }
  
  private analyzeTransitionPattern(transitions: Transition[]): TransitionPattern {
    // Positive progression pattern (1→2→3→4)
    if (this.isPositiveProgression(transitions)) {
      return {
        transition: "POSITIVE_PROGRESSION",
        confidence: 85,
        estimatedReadyTime: this.estimateReadyTime(transitions),
        recommendation: "PREPARE_FOR_READY_STATE",
      };
    }
    
    // Stagnant pattern (no changes)
    if (this.isStagnant(transitions)) {
      return {
        transition: "STAGNANT",
        confidence: 60,
        recommendation: "CONTINUE_MONITORING",
      };
    }
    
    // Negative pattern (status regression)
    if (this.isNegativeProgression(transitions)) {
      return {
        transition: "NEGATIVE_PROGRESSION", 
        confidence: 90,
        recommendation: "ABORT_MONITORING",
      };
    }
    
    return { transition: "UNCLEAR", confidence: 30 };
  }
}
```

### 3. Launch Timing Optimization

**Algorithm:** Predictive timing analysis for optimal entry

```typescript
class LaunchTimingOptimizer {
  optimizeLaunchTiming(calendarEntry: CalendarEntry): TimingAnalysis {
    const now = Date.now();
    const launchTime = this.parseLaunchTime(calendarEntry.launchTime);
    const advanceHours = (launchTime - now) / (1000 * 60 * 60);
    
    // Optimal advance window: 3.5-6 hours
    const optimalAdvance = advanceHours >= 3.5 && advanceHours <= 6;
    
    return {
      advanceHours,
      isOptimal: optimalAdvance,
      urgencyLevel: this.calculateUrgencyLevel(advanceHours),
      recommendedAction: this.getTimingRecommendation(advanceHours),
      confidence: this.calculateTimingConfidence(advanceHours, calendarEntry),
    };
  }
  
  private calculateUrgencyLevel(advanceHours: number): string {
    if (advanceHours < 1) return "CRITICAL";
    if (advanceHours < 3) return "HIGH"; 
    if (advanceHours < 6) return "MEDIUM";
    if (advanceHours < 12) return "LOW";
    return "VERY_LOW";
  }
  
  private getTimingRecommendation(advanceHours: number): string {
    if (advanceHours < 0) return "LAUNCH_PASSED";
    if (advanceHours < 1) return "IMMEDIATE_MONITORING";
    if (advanceHours < 3.5) return "PREPARE_MONITORING";
    if (advanceHours <= 6) return "OPTIMAL_SETUP_WINDOW";
    if (advanceHours <= 12) return "EARLY_TRACKING";
    return "FUTURE_TRACKING";
  }
}
```

### 4. Pattern Confidence Scoring

**Algorithm:** Multi-factor confidence calculation

```typescript
class ConfidenceScorer {
  calculateConfidence(
    patternMatch: PatternMatch,
    dataQuality: DataQuality,
    historicalAccuracy: number
  ): number {
    const weights = {
      patternStrength: 0.4,    // 40% - How well pattern matches
      dataQuality: 0.3,        // 30% - Data completeness and accuracy
      historicalAccuracy: 0.2, // 20% - Past performance of this pattern
      marketConditions: 0.1,   // 10% - Current market volatility
    };
    
    const scores = {
      patternStrength: this.scorePatternStrength(patternMatch),
      dataQuality: this.scoreDataQuality(dataQuality),
      historicalAccuracy: historicalAccuracy,
      marketConditions: this.scoreMarketConditions(),
    };
    
    const weightedScore = Object.keys(weights).reduce((total, key) => {
      return total + (weights[key] * scores[key]);
    }, 0);
    
    // Apply confidence modifiers
    return this.applyConfidenceModifiers(weightedScore, patternMatch);
  }
  
  private scorePatternStrength(pattern: PatternMatch): number {
    switch (pattern.patternType) {
      case "READY_STATE_EXACT":
        return 95;
      case "READY_STATE_APPROACHING":
        return 75;
      case "POSITIVE_PROGRESSION":
        return 65;
      case "PARTIAL_PATTERN":
        return 45;
      default:
        return 20;
    }
  }
  
  private applyConfidenceModifiers(baseScore: number, pattern: PatternMatch): number {
    let modifiedScore = baseScore;
    
    // Boost for multiple confirming indicators
    const confirmingIndicators = Object.values(pattern.indicators)
      .filter(value => value === true).length;
    
    if (confirmingIndicators >= 4) modifiedScore += 5;
    if (confirmingIndicators >= 6) modifiedScore += 5;
    
    // Penalty for missing critical data
    if (!pattern.indicators.hasCompleteData) modifiedScore -= 10;
    if (!pattern.indicators.timingOptimal) modifiedScore -= 5;
    
    return Math.max(0, Math.min(100, modifiedScore));
  }
}
```

## Advanced Pattern Detection Features

### 5. Volume Pattern Analysis

**Algorithm:** Trading volume and liquidity pattern detection

```typescript
class VolumePatternAnalyzer {
  analyzeVolumePattern(symbolData: SymbolData, marketData: MarketData): VolumePattern {
    const volumeIndicators = {
      volumeSpike: marketData.volume > (marketData.avgVolume * 2),
      liquidityDepth: marketData.bidAskSpread < 0.02, // 2% spread threshold
      orderBookBalance: this.analyzeOrderBookBalance(marketData.orderBook),
      volumeTrend: this.calculateVolumeTrend(marketData.volumeHistory),
    };
    
    const volumeScore = this.calculateVolumeScore(volumeIndicators);
    
    return {
      pattern: this.classifyVolumePattern(volumeIndicators),
      score: volumeScore,
      indicators: volumeIndicators,
      recommendation: this.getVolumeRecommendation(volumeScore),
    };
  }
  
  private classifyVolumePattern(indicators: VolumeIndicators): string {
    if (indicators.volumeSpike && indicators.liquidityDepth) {
      return "HIGH_LIQUIDITY_SPIKE";
    }
    if (indicators.volumeTrend > 0.5 && indicators.orderBookBalance > 0.7) {
      return "BUILDING_MOMENTUM";
    }
    if (!indicators.liquidityDepth && indicators.volumeSpike) {
      return "ILLIQUID_PUMP";
    }
    return "NORMAL_VOLUME";
  }
}
```

### 6. Risk Pattern Detection

**Algorithm:** Risk assessment through pattern analysis

```typescript
class RiskPatternDetector {
  assessRiskPatterns(
    symbolData: SymbolData,
    marketData: MarketData,
    historicalData: HistoricalData
  ): RiskAssessment {
    const riskFactors = {
      volatilityRisk: this.analyzeVolatility(marketData.priceHistory),
      liquidityRisk: this.assessLiquidityRisk(marketData.orderBook),
      timingRisk: this.evaluateTimingRisk(symbolData),
      marketRisk: this.assessMarketConditions(),
      historicalRisk: this.analyzeHistoricalPerformance(historicalData),
    };
    
    const overallRisk = this.calculateOverallRisk(riskFactors);
    
    return {
      riskLevel: this.classifyRiskLevel(overallRisk),
      riskScore: overallRisk,
      riskFactors,
      mitigation: this.suggestMitigation(riskFactors),
      maxRecommendedPosition: this.calculateMaxPosition(overallRisk),
    };
  }
  
  private classifyRiskLevel(riskScore: number): "low" | "medium" | "high" {
    if (riskScore < 30) return "low";
    if (riskScore < 70) return "medium";
    return "high";
  }
  
  private calculateMaxPosition(riskScore: number): number {
    // Dynamic position sizing based on risk
    const basePosition = 1000; // $1000 base position
    const riskMultiplier = Math.max(0.1, 1 - (riskScore / 100));
    return basePosition * riskMultiplier;
  }
}
```

## Pattern Detection Configuration

### Detection Parameters

```typescript
interface PatternDetectionConfig {
  // Primary pattern thresholds
  readyStatePattern: {
    exactMatch: { sts: 2, st: 2, tt: 4 };
    confidence: 95;
  };
  
  // Confidence thresholds
  confidenceThresholds: {
    execute: 85;      // Execute trades
    monitor: 70;      // Close monitoring
    track: 50;        // Basic tracking
    ignore: 30;       // Ignore pattern
  };
  
  // Timing optimization
  timingConfig: {
    optimalAdvanceHours: { min: 3.5, max: 6 };
    maxMonitoringHours: 12;
    urgencyThresholds: {
      critical: 1;
      high: 3;
      medium: 6;
      low: 12;
    };
  };
  
  // Data quality requirements
  dataQuality: {
    requiredFields: ["sts", "st", "tt", "symbol"];
    freshnessThreshold: 300000; // 5 minutes
    completenessThreshold: 0.9;  // 90% complete
  };
  
  // Risk management
  riskLimits: {
    maxRiskScore: 80;
    maxVolatility: 0.15;  // 15%
    minLiquidity: 10000;   // $10k
  };
}
```

### Pattern Validation Rules

```typescript
class PatternValidator {
  validatePattern(pattern: PatternMatch, config: PatternDetectionConfig): ValidationResult {
    const validationResults = {
      confidenceCheck: pattern.confidence >= config.confidenceThresholds.track,
      dataQualityCheck: this.validateDataQuality(pattern, config.dataQuality),
      riskCheck: this.validateRiskLimits(pattern, config.riskLimits),
      timingCheck: this.validateTiming(pattern, config.timingConfig),
    };
    
    const allPassed = Object.values(validationResults).every(result => result);
    
    return {
      valid: allPassed,
      checks: validationResults,
      recommendation: this.getValidationRecommendation(validationResults),
      confidence: this.adjustConfidenceForValidation(pattern.confidence, validationResults),
    };
  }
}
```

## AI-Powered Pattern Enhancement

### OpenAI Integration for Pattern Analysis

```typescript
class AIPatternAnalyzer {
  async enhancePatternAnalysis(
    basePattern: PatternMatch,
    contextData: ContextData
  ): Promise<EnhancedPattern> {
    const prompt = this.constructAnalysisPrompt(basePattern, contextData);
    
    const aiResponse = await this.callOpenAI([
      {
        role: "user",
        content: prompt,
      },
    ]);
    
    const enhancedAnalysis = this.parseAIResponse(aiResponse.content);
    
    return {
      ...basePattern,
      aiInsights: enhancedAnalysis.insights,
      refinedConfidence: enhancedAnalysis.confidence,
      additionalIndicators: enhancedAnalysis.indicators,
      strategicRecommendations: enhancedAnalysis.recommendations,
    };
  }
  
  private constructAnalysisPrompt(pattern: PatternMatch, context: ContextData): string {
    return `
      Analyze this MEXC trading pattern:
      
      Pattern Type: ${pattern.patternType}
      Base Confidence: ${pattern.confidence}%
      Indicators: ${JSON.stringify(pattern.indicators)}
      
      Context Data:
      - Market Conditions: ${context.marketConditions}
      - Recent Performance: ${context.recentPerformance}
      - Similar Patterns: ${context.similarPatterns}
      
      Provide enhanced analysis including:
      1. Refined confidence score (0-100)
      2. Additional pattern indicators
      3. Risk assessment insights
      4. Strategic recommendations
      5. Potential failure modes
      
      Focus on the MEXC ready state pattern (sts:2, st:2, tt:4) and timing optimization.
    `;
  }
}
```

## Performance Optimization

### Caching Strategy

```typescript
class PatternDetectionCache {
  private patternCache = new Map<string, CachedPattern>();
  private readonly CACHE_TTL = 60000; // 1 minute
  
  getCachedPattern(key: string): CachedPattern | null {
    const cached = this.patternCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached;
    }
    return null;
  }
  
  cachePattern(key: string, pattern: PatternMatch): void {
    this.patternCache.set(key, {
      pattern,
      timestamp: Date.now(),
    });
  }
  
  generateCacheKey(symbolData: SymbolData): string {
    return `${symbolData.cd}_${symbolData.sts}_${symbolData.st}_${symbolData.tt}`;
  }
}
```

### Batch Processing

```typescript
class BatchPatternProcessor {
  async processBatch(symbols: SymbolData[]): Promise<PatternMatch[]> {
    const batches = this.chunkArray(symbols, 10); // Process in batches of 10
    const results: PatternMatch[] = [];
    
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(symbol => this.detectPattern(symbol))
      );
      results.push(...batchResults);
      
      // Rate limiting between batches
      await this.delay(100);
    }
    
    return results;
  }
  
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

## Monitoring and Analytics

### Pattern Performance Tracking

```typescript
interface PatternPerformanceMetrics {
  totalPatterns: number;
  successfulPredictions: number;
  falsePositives: number;
  missedOpportunities: number;
  averageConfidence: number;
  accuracyByType: Record<string, number>;
  responseTime: number;
}

class PatternPerformanceTracker {
  private metrics: PatternPerformanceMetrics = {
    totalPatterns: 0,
    successfulPredictions: 0,
    falsePositives: 0,
    missedOpportunities: 0,
    averageConfidence: 0,
    accuracyByType: {},
    responseTime: 0,
  };
  
  recordPatternOutcome(pattern: PatternMatch, outcome: "success" | "failure" | "missed"): void {
    this.metrics.totalPatterns++;
    
    switch (outcome) {
      case "success":
        this.metrics.successfulPredictions++;
        break;
      case "failure":
        this.metrics.falsePositives++;
        break;
      case "missed":
        this.metrics.missedOpportunities++;
        break;
    }
    
    // Update accuracy by pattern type
    const accuracy = this.metrics.successfulPredictions / this.metrics.totalPatterns;
    this.metrics.accuracyByType[pattern.patternType] = accuracy;
  }
  
  getPerformanceReport(): PatternPerformanceReport {
    const accuracy = this.metrics.successfulPredictions / this.metrics.totalPatterns;
    const precision = this.metrics.successfulPredictions / 
      (this.metrics.successfulPredictions + this.metrics.falsePositives);
    
    return {
      accuracy,
      precision,
      totalPatterns: this.metrics.totalPatterns,
      detailedMetrics: this.metrics,
      recommendations: this.generateRecommendations(accuracy, precision),
    };
  }
}
```

## Testing and Validation

### Pattern Detection Testing Framework

```typescript
class PatternDetectionTester {
  async testPatternDetection(testCases: TestCase[]): Promise<TestResults> {
    const results: TestResult[] = [];
    
    for (const testCase of testCases) {
      const startTime = Date.now();
      const detectedPattern = await this.patternDetector.detectPattern(testCase.input);
      const endTime = Date.now();
      
      const result = {
        testCase: testCase.name,
        expected: testCase.expected,
        actual: detectedPattern,
        passed: this.comparePatterns(testCase.expected, detectedPattern),
        executionTime: endTime - startTime,
      };
      
      results.push(result);
    }
    
    return this.compileTestResults(results);
  }
  
  private comparePatterns(expected: PatternMatch, actual: PatternMatch): boolean {
    return (
      expected.patternType === actual.patternType &&
      Math.abs(expected.confidence - actual.confidence) <= 10 &&
      expected.riskLevel === actual.riskLevel
    );
  }
}
```

This comprehensive pattern detection algorithm documentation provides complete coverage of the MEXC Sniper Bot's sophisticated pattern detection capabilities, enabling developers to understand, maintain, and enhance the core trading intelligence of the system.