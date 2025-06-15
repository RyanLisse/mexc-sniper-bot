/**
 * Advanced Pattern Detection Testing Suite
 * Comprehensive tests for the sts:2, st:2, tt:4 pattern detection system
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { createTestFramework, type TestFrameworkConfig } from '../framework/testing-framework'
import { performance } from 'node:perf_hooks'

// ===================== PATTERN DETECTION TYPES =====================

interface SymbolData {
  symbol: string
  sts: number // Symbol Trading Status
  st: number  // Status
  tt: number  // Trading Time
  price?: number
  volume?: number
  timestamp: number
  marketCap?: number
  liquidity?: number
}

interface PatternResult {
  detected: boolean
  confidence: number
  patternType: 'ready-state' | 'pre-ready' | 'invalid' | 'unknown'
  advanceTime?: number // milliseconds in advance
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  reliability: number
  metadata: {
    detectionTime: number
    analysisDepth: number
    falsePositiveRisk: number
    marketConditions: string
  }
}

interface MarketConditions {
  volatility: 'low' | 'medium' | 'high' | 'extreme'
  volume: 'low' | 'medium' | 'high'
  trend: 'bullish' | 'bearish' | 'sideways'
  sentiment: 'positive' | 'negative' | 'neutral'
}

// ===================== MOCK PATTERN DETECTION ENGINE =====================

class MockPatternDetectionEngine {
  private historicalData: Map<string, SymbolData[]> = new Map()
  private patternConfigs: Map<string, any> = new Map()
  private performanceMetrics: Map<string, number> = new Map()

  constructor() {
    this.initializePatternConfigs()
  }

  private initializePatternConfigs(): void {
    // Core ready state pattern: sts:2, st:2, tt:4
    this.patternConfigs.set('ready-state', {
      sts: 2,
      st: 2,
      tt: 4,
      minConfidence: 85,
      advanceDetectionThreshold: 3.5 * 60 * 60 * 1000, // 3.5 hours
      falsePositiveThreshold: 15
    })

    // Pre-ready patterns for early detection
    this.patternConfigs.set('pre-ready-stage-1', {
      sts: 1,
      st: 1,
      tt: [1, 2],
      minConfidence: 70,
      progressionLikelihood: 80
    })

    this.patternConfigs.set('pre-ready-stage-2', {
      sts: 2,
      st: 1,
      tt: [2, 3],
      minConfidence: 75,
      progressionLikelihood: 85
    })
  }

  async detectPattern(
    symbolData: SymbolData,
    marketConditions: MarketConditions,
    historicalContext: SymbolData[] = []
  ): Promise<PatternResult> {
    const startTime = performance.now()

    try {
      // Core ready state detection
      if (this.isReadyStatePattern(symbolData)) {
        const confidence = this.calculateConfidence(symbolData, marketConditions, historicalContext)
        const reliability = this.calculateReliability(symbolData, historicalContext)
        const riskLevel = this.assessRiskLevel(symbolData, marketConditions, confidence)

        return {
          detected: true,
          confidence,
          patternType: 'ready-state',
          riskLevel,
          reliability,
          metadata: {
            detectionTime: performance.now() - startTime,
            analysisDepth: historicalContext.length,
            falsePositiveRisk: this.calculateFalsePositiveRisk(confidence, marketConditions),
            marketConditions: `${marketConditions.volatility}-volatility, ${marketConditions.volume}-volume`
          }
        }
      }

      // Pre-ready pattern detection for advance warning
      const preReadyResult = this.detectPreReadyPattern(symbolData, marketConditions, historicalContext)
      if (preReadyResult.detected) {
        return preReadyResult
      }

      // No pattern detected
      return {
        detected: false,
        confidence: 0,
        patternType: 'unknown',
        riskLevel: 'low',
        reliability: 0,
        metadata: {
          detectionTime: performance.now() - startTime,
          analysisDepth: historicalContext.length,
          falsePositiveRisk: 0,
          marketConditions: 'no-pattern'
        }
      }

    } catch (error) {
      return {
        detected: false,
        confidence: 0,
        patternType: 'invalid',
        riskLevel: 'critical',
        reliability: 0,
        metadata: {
          detectionTime: performance.now() - startTime,
          analysisDepth: 0,
          falsePositiveRisk: 100,
          marketConditions: 'error'
        }
      }
    }
  }

  private isReadyStatePattern(data: SymbolData): boolean {
    const config = this.patternConfigs.get('ready-state')
    return data.sts === config.sts && data.st === config.st && data.tt === config.tt
  }

  private detectPreReadyPattern(
    data: SymbolData,
    marketConditions: MarketConditions,
    historicalContext: SymbolData[]
  ): PatternResult {
    // Stage 1: Early indicators
    if (data.sts === 1 && data.st === 1 && (data.tt === 1 || data.tt === 2)) {
      const confidence = this.calculatePreReadyConfidence(data, marketConditions, 'stage-1')
      return {
        detected: true,
        confidence,
        patternType: 'pre-ready',
        riskLevel: 'medium',
        reliability: confidence * 0.8, // Lower reliability for early detection
        advanceTime: this.estimateAdvanceTime(data, 'stage-1'),
        metadata: {
          detectionTime: Date.now(),
          analysisDepth: historicalContext.length,
          falsePositiveRisk: this.calculateFalsePositiveRisk(confidence, marketConditions),
          marketConditions: `pre-ready-stage-1`
        }
      }
    }

    // Stage 2: Closer to ready state
    if (data.sts === 2 && data.st === 1 && (data.tt === 2 || data.tt === 3)) {
      const confidence = this.calculatePreReadyConfidence(data, marketConditions, 'stage-2')
      return {
        detected: true,
        confidence,
        patternType: 'pre-ready',
        riskLevel: 'low',
        reliability: confidence * 0.9,
        advanceTime: this.estimateAdvanceTime(data, 'stage-2'),
        metadata: {
          detectionTime: Date.now(),
          analysisDepth: historicalContext.length,
          falsePositiveRisk: this.calculateFalsePositiveRisk(confidence, marketConditions),
          marketConditions: `pre-ready-stage-2`
        }
      }
    }

    return {
      detected: false,
      confidence: 0,
      patternType: 'unknown',
      riskLevel: 'low',
      reliability: 0,
      metadata: {
        detectionTime: Date.now(),
        analysisDepth: 0,
        falsePositiveRisk: 0,
        marketConditions: 'no-pre-ready-pattern'
      }
    }
  }

  private calculateConfidence(
    data: SymbolData,
    marketConditions: MarketConditions,
    historicalContext: SymbolData[]
  ): number {
    let confidence = 85 // Base confidence for ready state pattern

    // Adjust for market conditions
    if (marketConditions.volatility === 'low') confidence += 5
    if (marketConditions.volatility === 'extreme') confidence -= 10
    if (marketConditions.volume === 'high') confidence += 3
    if (marketConditions.sentiment === 'positive') confidence += 2

    // Adjust for historical consistency
    if (historicalContext.length > 5) {
      const consistencyScore = this.calculateConsistencyScore(historicalContext)
      confidence += (consistencyScore - 0.5) * 10 // -5 to +5 adjustment
    }

    // Adjust for data quality
    if (data.price && data.volume && data.marketCap) {
      confidence += 2 // Complete data
    }

    return Math.max(0, Math.min(100, confidence))
  }

  private calculatePreReadyConfidence(
    data: SymbolData,
    marketConditions: MarketConditions,
    stage: string
  ): number {
    const baseConfidence = stage === 'stage-1' ? 70 : 75
    let confidence = baseConfidence

    // Market condition adjustments
    if (marketConditions.trend === 'bullish') confidence += 5
    if (marketConditions.volatility === 'low') confidence += 3
    if (marketConditions.volume === 'medium' || marketConditions.volume === 'high') confidence += 2

    // Stage-specific adjustments
    if (stage === 'stage-2' && data.sts === 2) confidence += 5

    return Math.max(0, Math.min(100, confidence))
  }

  private calculateReliability(data: SymbolData, historicalContext: SymbolData[]): number {
    let reliability = 75 // Base reliability

    // Historical pattern consistency
    if (historicalContext.length >= 3) {
      const progressionScore = this.calculateProgressionScore(historicalContext)
      reliability += progressionScore * 20
    }

    // Data completeness
    const completeness = this.calculateDataCompleteness(data)
    reliability += completeness * 10

    return Math.max(0, Math.min(100, reliability))
  }

  private assessRiskLevel(
    data: SymbolData,
    marketConditions: MarketConditions,
    confidence: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (confidence < 60) return 'critical'
    if (marketConditions.volatility === 'extreme') return 'high'
    if (confidence < 75 || marketConditions.volatility === 'high') return 'medium'
    return 'low'
  }

  private calculateFalsePositiveRisk(confidence: number, marketConditions: MarketConditions): number {
    let risk = 100 - confidence

    // Adjust for market conditions
    if (marketConditions.volatility === 'extreme') risk += 15
    if (marketConditions.volume === 'low') risk += 10
    if (marketConditions.sentiment === 'negative') risk += 5

    return Math.max(0, Math.min(100, risk))
  }

  private estimateAdvanceTime(data: SymbolData, stage: string): number {
    // Estimate time until ready state based on progression stage
    if (stage === 'stage-1') {
      return 4 * 60 * 60 * 1000 // 4 hours estimate
    }
    if (stage === 'stage-2') {
      return 2 * 60 * 60 * 1000 // 2 hours estimate
    }
    return 0
  }

  private calculateConsistencyScore(historicalData: SymbolData[]): number {
    if (historicalData.length < 2) return 0.5

    let consistentTransitions = 0
    const totalTransitions = historicalData.length - 1

    for (let i = 1; i < historicalData.length; i++) {
      const prev = historicalData[i - 1]
      const curr = historicalData[i]

      // Check for logical progression
      if (this.isLogicalProgression(prev, curr)) {
        consistentTransitions++
      }
    }

    return consistentTransitions / totalTransitions
  }

  private calculateProgressionScore(historicalData: SymbolData[]): number {
    if (historicalData.length < 2) return 0

    let progressionScore = 0
    const weights = [0.1, 0.3, 0.6] // More weight on recent data

    for (let i = Math.max(0, historicalData.length - 3); i < historicalData.length - 1; i++) {
      const prev = historicalData[i]
      const curr = historicalData[i + 1]
      const weightIndex = i - Math.max(0, historicalData.length - 3)

      if (this.isProgressiveChange(prev, curr)) {
        progressionScore += weights[weightIndex] || 0.1
      }
    }

    return progressionScore
  }

  private calculateDataCompleteness(data: SymbolData): number {
    const requiredFields = ['symbol', 'sts', 'st', 'tt', 'timestamp']
    const optionalFields = ['price', 'volume', 'marketCap', 'liquidity']
    
    let completeness = 0
    
    // Required fields (80% weight)
    const requiredScore = requiredFields.every(field => data[field as keyof SymbolData] !== undefined) ? 0.8 : 0
    
    // Optional fields (20% weight)
    const optionalScore = optionalFields.filter(field => data[field as keyof SymbolData] !== undefined).length / optionalFields.length * 0.2
    
    return requiredScore + optionalScore
  }

  private isLogicalProgression(prev: SymbolData, curr: SymbolData): boolean {
    // Define logical state transitions
    const validTransitions = [
      { from: { sts: 1, st: 1, tt: 1 }, to: { sts: 1, st: 1, tt: 2 } },
      { from: { sts: 1, st: 1, tt: 2 }, to: { sts: 2, st: 1, tt: 2 } },
      { from: { sts: 2, st: 1, tt: 2 }, to: { sts: 2, st: 1, tt: 3 } },
      { from: { sts: 2, st: 1, tt: 3 }, to: { sts: 2, st: 2, tt: 4 } },
      { from: { sts: 2, st: 2, tt: 4 }, to: { sts: 2, st: 2, tt: 4 } } // Stable state
    ]

    return validTransitions.some(transition =>
      prev.sts === transition.from.sts &&
      prev.st === transition.from.st &&
      prev.tt === transition.from.tt &&
      curr.sts === transition.to.sts &&
      curr.st === transition.to.st &&
      curr.tt === transition.to.tt
    )
  }

  private isProgressiveChange(prev: SymbolData, curr: SymbolData): boolean {
    // Check if the change represents progress toward ready state
    const prevScore = this.calculateStateScore(prev)
    const currScore = this.calculateStateScore(curr)
    return currScore > prevScore
  }

  private calculateStateScore(data: SymbolData): number {
    // Score based on proximity to ready state (sts:2, st:2, tt:4)
    let score = 0
    score += data.sts * 0.3 // 30% weight
    score += data.st * 0.3  // 30% weight
    score += data.tt * 0.4  // 40% weight
    return score
  }

  getPerformanceMetrics(): Map<string, number> {
    return new Map(this.performanceMetrics)
  }

  addHistoricalData(symbol: string, data: SymbolData[]): void {
    this.historicalData.set(symbol, data)
  }
}

// ===================== TEST CONFIGURATION =====================

const testConfig: TestFrameworkConfig = {
  aiTestGeneration: true,
  marketSimulation: true,
  loadTesting: true,
  chaosEngineering: false,
  visualRegression: false,
  parallelExecution: true,
  testDataVersioning: true,
  mutationTesting: false,
  performanceThresholds: {
    apiResponseTime: 1000,
    agentProcessingTime: 3000,
    patternDetectionLatency: 500,
    websocketLatency: 100,
    databaseQueryTime: 200,
    memoryUsage: 512,
    cpuUsage: 80
  }
}

// ===================== TEST SUITE =====================

describe('Advanced Pattern Detection System', () => {
  let testFramework: any
  let patternEngine: MockPatternDetectionEngine
  let performanceMetrics: Map<string, number>

  beforeAll(async () => {
    testFramework = createTestFramework(testConfig)
    await testFramework.setupTestEnvironment()
    performanceMetrics = new Map()
    
    console.log('🎯 Pattern Detection test suite initialized')
  })

  afterAll(async () => {
    await testFramework.teardownTestEnvironment()
    console.log('🏁 Pattern Detection test suite completed')
  })

  beforeEach(() => {
    patternEngine = new MockPatternDetectionEngine()
  })

  // ===================== CORE PATTERN DETECTION TESTS =====================

  describe('Ready State Pattern Detection (sts:2, st:2, tt:4)', () => {
    it('should detect perfect ready state pattern with high confidence', async () => {
      const symbolData: SymbolData = {
        symbol: 'TESTUSDT',
        sts: 2,
        st: 2,
        tt: 4,
        price: 1.25,
        volume: 1000000,
        timestamp: Date.now(),
        marketCap: 50000000,
        liquidity: 75
      }

      const marketConditions: MarketConditions = {
        volatility: 'low',
        volume: 'high',
        trend: 'bullish',
        sentiment: 'positive'
      }

      const startTime = performance.now()
      const result = await patternEngine.detectPattern(symbolData, marketConditions)
      const endTime = performance.now()

      expect(result.detected).toBe(true)
      expect(result.patternType).toBe('ready-state')
      expect(result.confidence).toBeGreaterThan(85)
      expect(result.riskLevel).toBe('low')
      expect(result.reliability).toBeGreaterThan(75)
      expect(endTime - startTime).toBeLessThan(testConfig.performanceThresholds.patternDetectionLatency)

      performanceMetrics.set('ready-state-detection-time', endTime - startTime)
    })

    it('should reject non-ready state patterns', async () => {
      const invalidPatterns = [
        { sts: 1, st: 2, tt: 4 }, // Wrong sts
        { sts: 2, st: 1, tt: 4 }, // Wrong st
        { sts: 2, st: 2, tt: 3 }, // Wrong tt
        { sts: 1, st: 1, tt: 1 }, // All wrong
        { sts: 0, st: 0, tt: 0 }  // Invalid values
      ]

      for (const pattern of invalidPatterns) {
        const symbolData: SymbolData = {
          symbol: 'TESTUSDT',
          ...pattern,
          timestamp: Date.now()
        }

        const marketConditions: MarketConditions = {
          volatility: 'medium',
          volume: 'medium',
          trend: 'sideways',
          sentiment: 'neutral'
        }

        const result = await patternEngine.detectPattern(symbolData, marketConditions)
        
        if (result.patternType === 'ready-state') {
          expect(result.detected).toBe(false)
        }
      }
    })

    it('should adjust confidence based on market conditions', async () => {
      const baseSymbolData: SymbolData = {
        symbol: 'TESTUSDT',
        sts: 2,
        st: 2,
        tt: 4,
        timestamp: Date.now()
      }

      const marketScenarios: MarketConditions[] = [
        {
          volatility: 'low',
          volume: 'high',
          trend: 'bullish',
          sentiment: 'positive'
        },
        {
          volatility: 'extreme',
          volume: 'low',
          trend: 'bearish',
          sentiment: 'negative'
        }
      ]

      const results = []
      for (const marketConditions of marketScenarios) {
        const result = await patternEngine.detectPattern(baseSymbolData, marketConditions)
        results.push(result)
      }

      // Positive market conditions should yield higher confidence
      expect(results[0].confidence).toBeGreaterThan(results[1].confidence)
      expect(results[0].riskLevel).toBe('low')
      expect(results[1].riskLevel).toMatch(/medium|high|critical/)
    })
  })

  // ===================== ADVANCE DETECTION TESTS =====================

  describe('3.5+ Hour Advance Detection', () => {
    it('should detect pre-ready patterns for advance warning', async () => {
      const preReadyStages = [
        { sts: 1, st: 1, tt: 1, expectedAdvance: 4 * 60 * 60 * 1000 },
        { sts: 1, st: 1, tt: 2, expectedAdvance: 4 * 60 * 60 * 1000 },
        { sts: 2, st: 1, tt: 2, expectedAdvance: 2 * 60 * 60 * 1000 },
        { sts: 2, st: 1, tt: 3, expectedAdvance: 2 * 60 * 60 * 1000 }
      ]

      const marketConditions: MarketConditions = {
        volatility: 'medium',
        volume: 'medium',
        trend: 'bullish',
        sentiment: 'positive'
      }

      for (const stage of preReadyStages) {
        const symbolData: SymbolData = {
          symbol: 'TESTUSDT',
          ...stage,
          timestamp: Date.now()
        }

        const result = await patternEngine.detectPattern(symbolData, marketConditions)

        if (result.detected && result.patternType === 'pre-ready') {
          expect(result.advanceTime).toBeGreaterThan(3.5 * 60 * 60 * 1000) // 3.5 hours
          expect(result.confidence).toBeGreaterThan(60)
        }
      }
    })

    it('should provide accurate time estimates for pattern progression', async () => {
      const progressionSequence = [
        { sts: 1, st: 1, tt: 1, stage: 'stage-1' },
        { sts: 1, st: 1, tt: 2, stage: 'stage-1' },
        { sts: 2, st: 1, tt: 2, stage: 'stage-2' },
        { sts: 2, st: 1, tt: 3, stage: 'stage-2' }
      ]

      const marketConditions: MarketConditions = {
        volatility: 'low',
        volume: 'high',
        trend: 'bullish',
        sentiment: 'positive'
      }

      const timeEstimates = []

      for (const step of progressionSequence) {
        const symbolData: SymbolData = {
          symbol: 'PROGRESSUSDT',
          sts: step.sts,
          st: step.st,
          tt: step.tt,
          timestamp: Date.now()
        }

        const result = await patternEngine.detectPattern(symbolData, marketConditions)
        
        if (result.detected && result.advanceTime) {
          timeEstimates.push({
            stage: step.stage,
            advanceTime: result.advanceTime,
            confidence: result.confidence
          })
        }
      }

      // Later stages should have shorter advance times
      const stage1Times = timeEstimates.filter(e => e.stage === 'stage-1')
      const stage2Times = timeEstimates.filter(e => e.stage === 'stage-2')

      if (stage1Times.length > 0 && stage2Times.length > 0) {
        const avgStage1Time = stage1Times.reduce((sum, e) => sum + e.advanceTime, 0) / stage1Times.length
        const avgStage2Time = stage2Times.reduce((sum, e) => sum + e.advanceTime, 0) / stage2Times.length

        expect(avgStage1Time).toBeGreaterThan(avgStage2Time)
      }
    })
  })

  // ===================== HISTORICAL ANALYSIS TESTS =====================

  describe('Historical Pattern Analysis', () => {
    it('should improve confidence with consistent historical data', async () => {
      const symbol = 'HISTORYUSDT'
      
      // Create consistent progression history
      const historicalData: SymbolData[] = [
        { symbol, sts: 1, st: 1, tt: 1, timestamp: Date.now() - 4 * 60 * 60 * 1000 },
        { symbol, sts: 1, st: 1, tt: 2, timestamp: Date.now() - 3 * 60 * 60 * 1000 },
        { symbol, sts: 2, st: 1, tt: 2, timestamp: Date.now() - 2 * 60 * 60 * 1000 },
        { symbol, sts: 2, st: 1, tt: 3, timestamp: Date.now() - 1 * 60 * 60 * 1000 }
      ]

      const currentData: SymbolData = {
        symbol,
        sts: 2,
        st: 2,
        tt: 4,
        timestamp: Date.now()
      }

      const marketConditions: MarketConditions = {
        volatility: 'medium',
        volume: 'medium',
        trend: 'bullish',
        sentiment: 'neutral'
      }

      // Test without historical data
      const resultWithoutHistory = await patternEngine.detectPattern(currentData, marketConditions)

      // Test with historical data
      const resultWithHistory = await patternEngine.detectPattern(currentData, marketConditions, historicalData)

      expect(resultWithHistory.confidence).toBeGreaterThan(resultWithoutHistory.confidence)
      expect(resultWithHistory.reliability).toBeGreaterThan(resultWithoutHistory.reliability)
      expect(resultWithHistory.metadata.analysisDepth).toBe(historicalData.length)
    })

    it('should detect inconsistent patterns and adjust risk levels', async () => {
      const symbol = 'INCONSISTENTUSDT'
      
      // Create inconsistent history (random jumps)
      const inconsistentHistory: SymbolData[] = [
        { symbol, sts: 2, st: 2, tt: 4, timestamp: Date.now() - 4 * 60 * 60 * 1000 },
        { symbol, sts: 1, st: 1, tt: 1, timestamp: Date.now() - 3 * 60 * 60 * 1000 },
        { symbol, sts: 2, st: 1, tt: 3, timestamp: Date.now() - 2 * 60 * 60 * 1000 },
        { symbol, sts: 1, st: 2, tt: 2, timestamp: Date.now() - 1 * 60 * 60 * 1000 }
      ]

      const currentData: SymbolData = {
        symbol,
        sts: 2,
        st: 2,
        tt: 4,
        timestamp: Date.now()
      }

      const marketConditions: MarketConditions = {
        volatility: 'medium',
        volume: 'medium',
        trend: 'sideways',
        sentiment: 'neutral'
      }

      const result = await patternEngine.detectPattern(currentData, marketConditions, inconsistentHistory)

      expect(result.riskLevel).toMatch(/medium|high|critical/)
      expect(result.metadata.falsePositiveRisk).toBeGreaterThan(20)
    })
  })

  // ===================== PERFORMANCE TESTS =====================

  describe('Pattern Detection Performance', () => {
    it('should meet detection latency requirements', async () => {
      const testCases = Array.from({ length: 100 }, (_, i) => ({
        symbol: `PERF${i}USDT`,
        sts: 2,
        st: 2,
        tt: 4,
        timestamp: Date.now() + i * 1000
      }))

      const marketConditions: MarketConditions = {
        volatility: 'medium',
        volume: 'medium',
        trend: 'bullish',
        sentiment: 'neutral'
      }

      const detectionTimes: number[] = []

      for (const symbolData of testCases) {
        const startTime = performance.now()
        await patternEngine.detectPattern(symbolData, marketConditions)
        const endTime = performance.now()
        
        detectionTimes.push(endTime - startTime)
      }

      const averageTime = detectionTimes.reduce((sum, time) => sum + time, 0) / detectionTimes.length
      const maxTime = Math.max(...detectionTimes)

      expect(averageTime).toBeLessThan(testConfig.performanceThresholds.patternDetectionLatency)
      expect(maxTime).toBeLessThan(testConfig.performanceThresholds.patternDetectionLatency * 2)

      performanceMetrics.set('average-detection-time', averageTime)
      performanceMetrics.set('max-detection-time', maxTime)
    })

    it('should handle concurrent pattern detection efficiently', async () => {
      const concurrentRequests = Array.from({ length: 50 }, (_, i) => ({
        symbol: `CONCURRENT${i}USDT`,
        sts: Math.random() > 0.5 ? 2 : 1,
        st: Math.random() > 0.5 ? 2 : 1,
        tt: Math.floor(Math.random() * 4) + 1,
        timestamp: Date.now() + i * 100
      }))

      const marketConditions: MarketConditions = {
        volatility: 'medium',
        volume: 'medium',
        trend: 'sideways',
        sentiment: 'neutral'
      }

      const startTime = performance.now()
      
      const results = await Promise.all(
        concurrentRequests.map(symbolData => 
          patternEngine.detectPattern(symbolData, marketConditions)
        )
      )

      const endTime = performance.now()
      const totalTime = endTime - startTime

      expect(results).toHaveLength(50)
      expect(results.every(r => r.metadata.detectionTime < 1000)).toBe(true)
      expect(totalTime).toBeLessThan(5000) // Should complete within 5 seconds

      performanceMetrics.set('concurrent-detection-time', totalTime)
    })
  })

  // ===================== FALSE POSITIVE TESTS =====================

  describe('False Positive Prevention', () => {
    it('should identify high false positive risk scenarios', async () => {
      const riskScenarios = [
        {
          symbolData: { symbol: 'RISKY1USDT', sts: 2, st: 2, tt: 4, timestamp: Date.now() },
          marketConditions: { volatility: 'extreme', volume: 'low', trend: 'bearish', sentiment: 'negative' } as MarketConditions
        },
        {
          symbolData: { symbol: 'RISKY2USDT', sts: 2, st: 2, tt: 4, timestamp: Date.now() },
          marketConditions: { volatility: 'high', volume: 'low', trend: 'bearish', sentiment: 'negative' } as MarketConditions
        }
      ]

      for (const scenario of riskScenarios) {
        const result = await patternEngine.detectPattern(scenario.symbolData, scenario.marketConditions)

        if (result.detected) {
          expect(result.metadata.falsePositiveRisk).toBeGreaterThan(30)
          expect(result.riskLevel).toMatch(/high|critical/)
        }
      }
    })

    it('should maintain low false positive risk in optimal conditions', async () => {
      const optimalScenario = {
        symbolData: { 
          symbol: 'OPTIMALUSDT', 
          sts: 2, 
          st: 2, 
          tt: 4, 
          price: 1.0,
          volume: 2000000,
          marketCap: 100000000,
          timestamp: Date.now() 
        },
        marketConditions: { 
          volatility: 'low', 
          volume: 'high', 
          trend: 'bullish', 
          sentiment: 'positive' 
        } as MarketConditions
      }

      const consistentHistory: SymbolData[] = [
        { symbol: 'OPTIMALUSDT', sts: 1, st: 1, tt: 1, timestamp: Date.now() - 4 * 60 * 60 * 1000 },
        { symbol: 'OPTIMALUSDT', sts: 1, st: 1, tt: 2, timestamp: Date.now() - 3 * 60 * 60 * 1000 },
        { symbol: 'OPTIMALUSDT', sts: 2, st: 1, tt: 2, timestamp: Date.now() - 2 * 60 * 60 * 1000 },
        { symbol: 'OPTIMALUSDT', sts: 2, st: 1, tt: 3, timestamp: Date.now() - 1 * 60 * 60 * 1000 }
      ]

      const result = await patternEngine.detectPattern(
        optimalScenario.symbolData, 
        optimalScenario.marketConditions,
        consistentHistory
      )

      expect(result.detected).toBe(true)
      expect(result.confidence).toBeGreaterThan(90)
      expect(result.metadata.falsePositiveRisk).toBeLessThan(15)
      expect(result.riskLevel).toBe('low')
    })
  })

  // ===================== INTEGRATION WITH TESTING FRAMEWORK =====================

  describe('Testing Framework Integration', () => {
    it('should integrate with advanced testing framework for pattern detection', async () => {
      const testInput = {
        symbols: ['INTEGRATIONUSDT', 'FRAMEWORKUSDT'],
        expectedPatterns: {
          'INTEGRATIONUSDT': { sts: 2, st: 2, tt: 4, confidence: 85 },
          'FRAMEWORKUSDT': { sts: 2, st: 2, tt: 4, confidence: 87 }
        }
      }

      const result = await testFramework.testPatternDetection(
        testInput.symbols,
        testInput.expectedPatterns,
        3.5 * 60 * 60 * 1000 // 3.5 hours advance detection
      )

      expect(result.agentName).toBe('pattern-detection-system')
      expect(result.testType).toBe('pattern-detection')
      expect(result.metrics.success).toBe(true)
      expect(result.assertions.length).toBeGreaterThan(0)
    })
  })

  // ===================== PERFORMANCE REPORTING =====================

  describe('Pattern Detection Performance Metrics', () => {
    it('should collect and validate performance metrics', () => {
      expect(performanceMetrics.size).toBeGreaterThan(0)
      
      console.log('\n🎯 Pattern Detection Performance Metrics:')
      for (const [metric, value] of performanceMetrics) {
        console.log(`  ${metric}: ${value.toFixed(2)}ms`)
      }

      // Validate key performance metrics
      const readyStateTime = performanceMetrics.get('ready-state-detection-time')
      if (readyStateTime) {
        expect(readyStateTime).toBeLessThan(testConfig.performanceThresholds.patternDetectionLatency)
      }

      const averageTime = performanceMetrics.get('average-detection-time')
      if (averageTime) {
        expect(averageTime).toBeLessThan(testConfig.performanceThresholds.patternDetectionLatency)
      }

      const concurrentTime = performanceMetrics.get('concurrent-detection-time')
      if (concurrentTime) {
        expect(concurrentTime).toBeLessThan(5000) // 5 second threshold for 50 concurrent requests
      }
    })
  })
})