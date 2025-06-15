/**
 * Market Simulation Framework
 * Realistic market data simulation for comprehensive testing
 */

import { performance } from 'node:perf_hooks'
import { randomBytes } from 'crypto'

// ===================== SIMULATION TYPES =====================

export interface MarketSimulationConfig {
  duration: number // milliseconds
  symbols: string[]
  volatilityProfile: 'low' | 'medium' | 'high' | 'extreme' | 'mixed'
  volumeProfile: 'low' | 'medium' | 'high' | 'institutional'
  trendPattern: 'bullish' | 'bearish' | 'sideways' | 'volatile' | 'pump_dump'
  eventSimulation: boolean
  realTimeMode: boolean
  dataGranularity: 'second' | 'minute' | 'hour'
  includeAnomalies: boolean
  correlationMatrix?: Map<string, Map<string, number>>
}

export interface SimulatedMarketData {
  symbol: string
  timestamp: number
  price: number
  volume: number
  bid: number
  ask: number
  spread: number
  sts: number // Symbol Trading Status
  st: number  // Status
  tt: number  // Trading Time
  marketCap?: number
  liquidity?: number
  volatility: number
  momentum: number
  orderBookDepth: OrderBookLevel[]
  tradeHistory: TradeEvent[]
  metadata: MarketMetadata
}

export interface OrderBookLevel {
  price: number
  volume: number
  side: 'buy' | 'sell'
  count: number
}

export interface TradeEvent {
  timestamp: number
  price: number
  volume: number
  side: 'buy' | 'sell'
  tradeId: string
}

export interface MarketMetadata {
  listingTime?: number
  lastUpdate: number
  dataQuality: number // 0-100
  anomalyFlags: string[]
  correlationScore?: number
  patternStrength: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

export interface MarketEvent {
  type: 'listing' | 'delisting' | 'news' | 'whale_trade' | 'system_maintenance' | 'flash_crash'
  timestamp: number
  symbol?: string
  impact: 'minor' | 'moderate' | 'major' | 'extreme'
  duration: number
  metadata: Record<string, unknown>
}

export interface SimulationScenario {
  id: string
  name: string
  description: string
  config: MarketSimulationConfig
  expectedPatterns: ExpectedPattern[]
  successCriteria: SuccessCriteria
}

export interface ExpectedPattern {
  symbol: string
  pattern: 'ready_state' | 'pre_ready' | 'false_signal' | 'anomaly'
  expectedTime: number
  confidence: number
  advanceDetection: boolean
}

export interface SuccessCriteria {
  patternDetectionAccuracy: number // percentage
  falsePositiveRate: number // percentage
  advanceDetectionTime: number // milliseconds
  systemStability: number // percentage
  performanceThresholds: {
    maxLatency: number
    maxMemoryUsage: number
    minThroughput: number
  }
}

// ===================== MARKET SIMULATION ENGINE =====================

export class MarketSimulationEngine {
  private config: MarketSimulationConfig
  private activeSimulations: Map<string, SimulatedMarketData[]> = new Map()
  private eventQueue: MarketEvent[] = []
  private correlationMatrix: Map<string, Map<string, number>> = new Map()
  private performanceMetrics: Map<string, number> = new Map()
  private isRunning: boolean = false

  constructor(config: MarketSimulationConfig) {
    this.config = config
    this.initializeCorrelationMatrix()
  }

  // ===================== SIMULATION LIFECYCLE =====================

  async startSimulation(): Promise<void> {
    console.log('🎬 Starting market simulation...')
    this.isRunning = true

    // Initialize symbols
    for (const symbol of this.config.symbols) {
      this.activeSimulations.set(symbol, [])
    }

    // Generate initial market events
    this.generateMarketEvents()

    // Start data generation
    if (this.config.realTimeMode) {
      await this.runRealTimeSimulation()
    } else {
      await this.runBatchSimulation()
    }

    console.log('✅ Market simulation completed')
  }

  async stopSimulation(): Promise<void> {
    this.isRunning = false
    console.log('🛑 Market simulation stopped')
  }

  // ===================== REAL-TIME SIMULATION =====================

  private async runRealTimeSimulation(): Promise<void> {
    const interval = this.getUpdateInterval()
    let elapsed = 0

    while (this.isRunning && elapsed < this.config.duration) {
      const startTime = performance.now()

      // Process market events
      this.processScheduledEvents(Date.now())

      // Update all symbols
      for (const symbol of this.config.symbols) {
        const marketData = this.generateMarketDataPoint(symbol, Date.now())
        this.addMarketData(symbol, marketData)
      }

      // Process correlations
      this.updateCorrelations()

      elapsed += interval
      
      // Wait for next interval
      const processingTime = performance.now() - startTime
      const waitTime = Math.max(0, interval - processingTime)
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }

  private async runBatchSimulation(): Promise<void> {
    const interval = this.getUpdateInterval()
    const totalPoints = Math.floor(this.config.duration / interval)

    console.log(`📊 Generating ${totalPoints} data points for ${this.config.symbols.length} symbols...`)

    for (let i = 0; i < totalPoints; i++) {
      const timestamp = Date.now() + (i * interval)

      // Process events at this timestamp
      this.processScheduledEvents(timestamp)

      // Generate data for all symbols
      for (const symbol of this.config.symbols) {
        const marketData = this.generateMarketDataPoint(symbol, timestamp)
        this.addMarketData(symbol, marketData)
      }

      // Update correlations periodically
      if (i % 10 === 0) {
        this.updateCorrelations()
      }

      // Progress indicator
      if (i % Math.floor(totalPoints / 10) === 0) {
        const progress = (i / totalPoints * 100).toFixed(1)
        console.log(`  Progress: ${progress}%`)
      }
    }
  }

  // ===================== MARKET DATA GENERATION =====================

  private generateMarketDataPoint(symbol: string, timestamp: number): SimulatedMarketData {
    const previousData = this.getLatestMarketData(symbol)
    const basePrice = previousData?.price || this.generateBasePrice(symbol)
    
    // Calculate price movement
    const priceMovement = this.calculatePriceMovement(symbol, previousData, timestamp)
    const newPrice = Math.max(0.00001, basePrice + priceMovement)

    // Generate volume
    const volume = this.generateVolume(symbol, newPrice, previousData?.volume)

    // Calculate spread and book data
    const spread = this.calculateSpread(newPrice, volume)
    const bid = newPrice - (spread / 2)
    const ask = newPrice + (spread / 2)

    // Generate order book
    const orderBookDepth = this.generateOrderBook(newPrice, volume)

    // Generate recent trades
    const tradeHistory = this.generateTradeHistory(symbol, newPrice, volume, timestamp)

    // Calculate technical indicators
    const volatility = this.calculateVolatility(symbol, newPrice)
    const momentum = this.calculateMomentum(symbol, newPrice)

    // Generate pattern state progression
    const patternState = this.generatePatternState(symbol, timestamp, previousData)

    // Generate metadata
    const metadata = this.generateMarketMetadata(symbol, timestamp, newPrice, volume)

    return {
      symbol,
      timestamp,
      price: newPrice,
      volume,
      bid,
      ask,
      spread,
      sts: patternState.sts,
      st: patternState.st,
      tt: patternState.tt,
      marketCap: this.calculateMarketCap(symbol, newPrice),
      liquidity: this.calculateLiquidity(volume, orderBookDepth),
      volatility,
      momentum,
      orderBookDepth,
      tradeHistory,
      metadata
    }
  }

  // ===================== PATTERN STATE SIMULATION =====================

  private generatePatternState(
    symbol: string,
    timestamp: number,
    previousData?: SimulatedMarketData
  ): { sts: number, st: number, tt: number } {
    // Simulate realistic pattern progression for new listings
    const timeSinceListing = this.getTimeSinceListing(symbol, timestamp)
    
    if (!previousData) {
      // Initial state for new symbols
      return { sts: 0, st: 0, tt: 0 }
    }

    // Progressive state transitions based on time and market conditions
    let { sts, st, tt } = previousData

    // Simulate natural progression toward ready state
    const progressionProbability = this.calculateProgressionProbability(
      symbol, 
      timeSinceListing, 
      previousData
    )

    // Random progression with realistic timing
    if (Math.random() < progressionProbability) {
      if (sts === 0 && st === 0 && tt === 0) {
        sts = 1
        st = 1
        tt = 1
      } else if (sts === 1 && st === 1 && tt === 1) {
        tt = 2
      } else if (sts === 1 && st === 1 && tt === 2) {
        sts = 2
      } else if (sts === 2 && st === 1 && tt === 2) {
        tt = 3
      } else if (sts === 2 && st === 1 && tt === 3) {
        st = 2
        tt = 4
      }
    }

    // Add some randomness for false signals (if configured)
    if (this.config.includeAnomalies && Math.random() < 0.05) {
      // 5% chance of anomalous state
      sts = Math.floor(Math.random() * 3)
      st = Math.floor(Math.random() * 3)
      tt = Math.floor(Math.random() * 5)
    }

    return { sts, st, tt }
  }

  private calculateProgressionProbability(
    symbol: string,
    timeSinceListing: number,
    previousData: SimulatedMarketData
  ): number {
    let probability = 0.1 // Base 10% chance per update

    // Higher probability as we approach typical listing times
    const hoursUntilListing = (4 * 60 * 60 * 1000 - timeSinceListing) / (60 * 60 * 1000)
    if (hoursUntilListing <= 4 && hoursUntilListing > 2) {
      probability += 0.15 // Increase probability 2-4 hours before
    } else if (hoursUntilListing <= 2 && hoursUntilListing > 0.5) {
      probability += 0.25 // Higher probability 30min-2hours before
    } else if (hoursUntilListing <= 0.5) {
      probability += 0.4 // Very high probability in final 30 minutes
    }

    // Adjust based on current state
    if (previousData.sts === 2 && previousData.st === 1) {
      probability += 0.2 // Higher chance to progress from stage 2
    }

    // Market condition adjustments
    if (previousData.volume > 1000000) {
      probability += 0.1 // High volume increases progression likelihood
    }

    if (previousData.volatility < 0.05) {
      probability += 0.05 // Low volatility is good for progression
    }

    return Math.min(0.8, probability) // Cap at 80%
  }

  // ===================== MARKET EVENT SIMULATION =====================

  private generateMarketEvents(): void {
    const eventTypes: MarketEvent['type'][] = [
      'listing', 'news', 'whale_trade', 'system_maintenance'
    ]

    // Generate scheduled listing events
    for (const symbol of this.config.symbols) {
      const listingTime = Date.now() + Math.random() * this.config.duration
      this.eventQueue.push({
        type: 'listing',
        timestamp: listingTime,
        symbol,
        impact: 'major',
        duration: 60000, // 1 minute impact
        metadata: { 
          price_impact: 0.05,
          volume_multiplier: 3.0,
          pattern_trigger: true
        }
      })
    }

    // Generate random market events
    const eventCount = Math.floor(this.config.duration / (30 * 60 * 1000)) // Every 30 minutes on average
    for (let i = 0; i < eventCount; i++) {
      const eventTime = Date.now() + Math.random() * this.config.duration
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]
      
      this.eventQueue.push({
        type: eventType,
        timestamp: eventTime,
        symbol: this.config.symbols[Math.floor(Math.random() * this.config.symbols.length)],
        impact: this.randomImpactLevel(),
        duration: Math.random() * 300000, // Up to 5 minutes
        metadata: this.generateEventMetadata(eventType)
      })
    }

    // Sort events by timestamp
    this.eventQueue.sort((a, b) => a.timestamp - b.timestamp)
  }

  private processScheduledEvents(currentTime: number): void {
    while (this.eventQueue.length > 0 && this.eventQueue[0].timestamp <= currentTime) {
      const event = this.eventQueue.shift()!
      this.applyMarketEvent(event)
    }
  }

  private applyMarketEvent(event: MarketEvent): void {
    console.log(`📰 Market event: ${event.type} for ${event.symbol} (${event.impact} impact)`)

    // Apply event effects to relevant symbols
    if (event.symbol) {
      const currentData = this.getLatestMarketData(event.symbol)
      if (currentData) {
        this.applyEventImpact(currentData, event)
      }
    }

    // Market-wide events affect all symbols
    if (event.type === 'system_maintenance' || event.type === 'flash_crash') {
      for (const symbol of this.config.symbols) {
        const data = this.getLatestMarketData(symbol)
        if (data) {
          this.applyEventImpact(data, event)
        }
      }
    }
  }

  private applyEventImpact(data: SimulatedMarketData, event: MarketEvent): void {
    const impactMultipliers = {
      minor: 0.01,
      moderate: 0.03,
      major: 0.08,
      extreme: 0.15
    }

    const multiplier = impactMultipliers[event.impact]

    // Apply price impact
    if (event.metadata.price_impact) {
      data.price *= (1 + (event.metadata.price_impact as number))
    } else {
      const priceChange = (Math.random() - 0.5) * multiplier * 2
      data.price *= (1 + priceChange)
    }

    // Apply volume impact
    if (event.metadata.volume_multiplier) {
      data.volume *= (event.metadata.volume_multiplier as number)
    } else {
      data.volume *= (1 + multiplier)
    }

    // Apply volatility impact
    data.volatility += multiplier

    // Pattern state impact for listing events
    if (event.type === 'listing' && event.metadata.pattern_trigger) {
      data.sts = 2
      data.st = 2
      data.tt = 4
    }

    // Update metadata
    data.metadata.lastUpdate = Date.now()
    if (!data.metadata.anomalyFlags.includes(event.type)) {
      data.metadata.anomalyFlags.push(event.type)
    }
  }

  // ===================== CORRELATION SIMULATION =====================

  private initializeCorrelationMatrix(): void {
    if (this.config.correlationMatrix) {
      this.correlationMatrix = this.config.correlationMatrix
      return
    }

    // Generate realistic correlations
    for (const symbol1 of this.config.symbols) {
      const correlations = new Map<string, number>()
      
      for (const symbol2 of this.config.symbols) {
        if (symbol1 === symbol2) {
          correlations.set(symbol2, 1.0)
        } else {
          // Generate realistic correlation (-0.3 to 0.7)
          const correlation = (Math.random() - 0.3) * 1.0
          correlations.set(symbol2, correlation)
        }
      }
      
      this.correlationMatrix.set(symbol1, correlations)
    }
  }

  private updateCorrelations(): void {
    // Apply correlation effects between symbols
    for (const [symbol1, correlations] of this.correlationMatrix) {
      const data1 = this.getLatestMarketData(symbol1)
      if (!data1) continue

      for (const [symbol2, correlation] of correlations) {
        if (symbol1 === symbol2) continue

        const data2 = this.getLatestMarketData(symbol2)
        if (!data2) continue

        // Apply correlation to price movements
        const priceChange1 = this.getRecentPriceChange(symbol1)
        if (priceChange1 !== 0) {
          const correlatedChange = priceChange1 * correlation * 0.3 // Dampen correlation effect
          data2.price *= (1 + correlatedChange)
        }
      }
    }
  }

  // ===================== SCENARIO TESTING =====================

  async runScenario(scenario: SimulationScenario): Promise<{
    success: boolean
    results: Map<string, any>
    metrics: Map<string, number>
    detectedPatterns: ExpectedPattern[]
    performance: {
      accuracy: number
      falsePositiveRate: number
      averageDetectionTime: number
    }
  }> {
    console.log(`🎭 Running simulation scenario: ${scenario.name}`)

    // Configure simulation
    this.config = scenario.config
    this.initializeCorrelationMatrix()

    // Run simulation
    await this.startSimulation()

    // Analyze results
    const results = new Map<string, any>()
    const detectedPatterns: ExpectedPattern[] = []

    for (const symbol of this.config.symbols) {
      const symbolData = this.getSymbolData(symbol)
      const analysis = this.analyzeSymbolPatterns(symbol, symbolData, scenario.expectedPatterns)
      results.set(symbol, analysis)

      detectedPatterns.push(...analysis.detectedPatterns)
    }

    // Calculate performance metrics
    const performance = this.calculateScenarioPerformance(scenario, detectedPatterns)

    // Evaluate success
    const success = this.evaluateScenarioSuccess(scenario, performance)

    return {
      success,
      results,
      metrics: this.performanceMetrics,
      detectedPatterns,
      performance
    }
  }

  // ===================== HELPER METHODS =====================

  private getUpdateInterval(): number {
    switch (this.config.dataGranularity) {
      case 'second': return 1000
      case 'minute': return 60000
      case 'hour': return 3600000
      default: return 5000 // 5 seconds default
    }
  }

  private generateBasePrice(symbol: string): number {
    // Generate realistic base prices based on symbol
    const hash = this.hashSymbol(symbol)
    return 0.1 + (hash % 1000) / 100 // $0.10 to $10.09
  }

  private calculatePriceMovement(
    symbol: string,
    previousData: SimulatedMarketData | undefined,
    timestamp: number
  ): number {
    if (!previousData) return 0

    const volatilityMultiplier = this.getVolatilityMultiplier()
    const trendMultiplier = this.getTrendMultiplier(symbol, timestamp)
    
    // Random walk with drift
    const randomComponent = (Math.random() - 0.5) * volatilityMultiplier * previousData.price * 0.01
    const trendComponent = trendMultiplier * previousData.price * 0.001

    return randomComponent + trendComponent
  }

  private generateVolume(symbol: string, price: number, previousVolume?: number): number {
    const baseVolume = previousVolume || 100000
    const volatility = Math.random() * 0.5 + 0.75 // 0.75-1.25 multiplier
    const priceImpact = 1 + Math.abs(price - (previousVolume || price)) * 0.1
    
    return Math.floor(baseVolume * volatility * priceImpact)
  }

  private getVolatilityMultiplier(): number {
    switch (this.config.volatilityProfile) {
      case 'low': return 0.5
      case 'medium': return 1.0
      case 'high': return 2.0
      case 'extreme': return 4.0
      case 'mixed': return 0.5 + Math.random() * 3.5
      default: return 1.0
    }
  }

  private getTrendMultiplier(symbol: string, timestamp: number): number {
    switch (this.config.trendPattern) {
      case 'bullish': return 1.0
      case 'bearish': return -1.0
      case 'sideways': return (Math.random() - 0.5) * 0.2
      case 'volatile': return (Math.random() - 0.5) * 4.0
      case 'pump_dump': 
        const phase = (timestamp % (60 * 60 * 1000)) / (60 * 60 * 1000) // Hour cycle
        return phase < 0.5 ? 3.0 : -3.0 // Pump then dump
      default: return 0
    }
  }

  private calculateSpread(price: number, volume: number): number {
    // Realistic spread calculation
    const baseSpread = price * 0.001 // 0.1% base spread
    const volumeAdjustment = Math.max(0.5, 1000000 / volume) // Lower spread for higher volume
    return baseSpread * volumeAdjustment
  }

  private generateOrderBook(price: number, volume: number): OrderBookLevel[] {
    const levels: OrderBookLevel[] = []
    const spreadPercent = 0.001
    
    // Generate buy orders (bids)
    for (let i = 1; i <= 10; i++) {
      levels.push({
        price: price - (price * spreadPercent * i * 0.5),
        volume: volume * (0.1 + Math.random() * 0.1) / i,
        side: 'buy',
        count: Math.floor(Math.random() * 20) + 1
      })
    }

    // Generate sell orders (asks)
    for (let i = 1; i <= 10; i++) {
      levels.push({
        price: price + (price * spreadPercent * i * 0.5),
        volume: volume * (0.1 + Math.random() * 0.1) / i,
        side: 'sell',
        count: Math.floor(Math.random() * 20) + 1
      })
    }

    return levels
  }

  private generateTradeHistory(
    symbol: string,
    price: number,
    volume: number,
    timestamp: number
  ): TradeEvent[] {
    const trades: TradeEvent[] = []
    const tradeCount = Math.floor(Math.random() * 10) + 1

    for (let i = 0; i < tradeCount; i++) {
      trades.push({
        timestamp: timestamp - (Math.random() * 60000), // Within last minute
        price: price + (Math.random() - 0.5) * price * 0.001,
        volume: Math.random() * volume * 0.1,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        tradeId: this.generateTradeId()
      })
    }

    return trades.sort((a, b) => b.timestamp - a.timestamp) // Latest first
  }

  private generateMarketMetadata(
    symbol: string,
    timestamp: number,
    price: number,
    volume: number
  ): MarketMetadata {
    return {
      listingTime: this.getListingTime(symbol),
      lastUpdate: timestamp,
      dataQuality: 85 + Math.random() * 15, // 85-100%
      anomalyFlags: [],
      patternStrength: Math.random() * 100,
      riskLevel: this.calculateRiskLevel(price, volume)
    }
  }

  private addMarketData(symbol: string, data: SimulatedMarketData): void {
    if (!this.activeSimulations.has(symbol)) {
      this.activeSimulations.set(symbol, [])
    }
    
    const symbolData = this.activeSimulations.get(symbol)!
    symbolData.push(data)

    // Keep only recent data to manage memory
    const maxPoints = 10000
    if (symbolData.length > maxPoints) {
      symbolData.splice(0, symbolData.length - maxPoints)
    }
  }

  private getLatestMarketData(symbol: string): SimulatedMarketData | undefined {
    const symbolData = this.activeSimulations.get(symbol)
    return symbolData?.[symbolData.length - 1]
  }

  private getSymbolData(symbol: string): SimulatedMarketData[] {
    return this.activeSimulations.get(symbol) || []
  }

  private getRecentPriceChange(symbol: string): number {
    const symbolData = this.activeSimulations.get(symbol)
    if (!symbolData || symbolData.length < 2) return 0

    const latest = symbolData[symbolData.length - 1]
    const previous = symbolData[symbolData.length - 2]
    
    return (latest.price - previous.price) / previous.price
  }

  private analyzeSymbolPatterns(
    symbol: string,
    data: SimulatedMarketData[],
    expectedPatterns: ExpectedPattern[]
  ): { detectedPatterns: ExpectedPattern[], accuracy: number } {
    const detectedPatterns: ExpectedPattern[] = []
    
    // Analyze actual vs expected patterns
    const symbolExpected = expectedPatterns.filter(p => p.symbol === symbol)
    
    for (const expected of symbolExpected) {
      // Find data points matching the expected pattern timing
      const relevantData = data.filter(d => 
        Math.abs(d.timestamp - expected.expectedTime) < 300000 // Within 5 minutes
      )

      if (relevantData.length > 0) {
        const matchingData = relevantData.find(d => {
          if (expected.pattern === 'ready_state') {
            return d.sts === 2 && d.st === 2 && d.tt === 4
          }
          return false
        })

        if (matchingData) {
          detectedPatterns.push({
            ...expected,
            confidence: matchingData.metadata.patternStrength
          })
        }
      }
    }

    const accuracy = symbolExpected.length > 0 
      ? (detectedPatterns.length / symbolExpected.length) * 100 
      : 0

    return { detectedPatterns, accuracy }
  }

  private calculateScenarioPerformance(
    scenario: SimulationScenario,
    detectedPatterns: ExpectedPattern[]
  ): { accuracy: number, falsePositiveRate: number, averageDetectionTime: number } {
    const totalExpected = scenario.expectedPatterns.length
    const totalDetected = detectedPatterns.length
    
    const accuracy = totalExpected > 0 ? (totalDetected / totalExpected) * 100 : 0
    
    // Calculate false positives (simplified)
    const falsePositives = Math.max(0, totalDetected - totalExpected)
    const falsePositiveRate = totalDetected > 0 ? (falsePositives / totalDetected) * 100 : 0

    // Calculate average detection time
    const detectionTimes = detectedPatterns
      .filter(p => p.advanceDetection)
      .map(p => p.expectedTime - Date.now())
      .filter(t => t > 0)
    
    const averageDetectionTime = detectionTimes.length > 0
      ? detectionTimes.reduce((sum, time) => sum + time, 0) / detectionTimes.length
      : 0

    return { accuracy, falsePositiveRate, averageDetectionTime }
  }

  private evaluateScenarioSuccess(
    scenario: SimulationScenario,
    performance: { accuracy: number, falsePositiveRate: number, averageDetectionTime: number }
  ): boolean {
    const criteria = scenario.successCriteria
    
    return (
      performance.accuracy >= criteria.patternDetectionAccuracy &&
      performance.falsePositiveRate <= criteria.falsePositiveRate &&
      performance.averageDetectionTime >= criteria.advanceDetectionTime
    )
  }

  // ===================== UTILITY METHODS =====================

  private hashSymbol(symbol: string): number {
    let hash = 0
    for (let i = 0; i < symbol.length; i++) {
      const char = symbol.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }

  private getTimeSinceListing(symbol: string, timestamp: number): number {
    const listingTime = this.getListingTime(symbol)
    return listingTime ? Math.max(0, listingTime - timestamp) : 0
  }

  private getListingTime(symbol: string): number {
    // Generate deterministic listing time based on symbol
    const hash = this.hashSymbol(symbol)
    return Date.now() + (hash % (4 * 60 * 60 * 1000)) // Within next 4 hours
  }

  private calculateVolatility(symbol: string, currentPrice: number): number {
    const symbolData = this.activeSimulations.get(symbol)
    if (!symbolData || symbolData.length < 2) return 0.01

    const prices = symbolData.slice(-20).map(d => d.price) // Last 20 data points
    const returns = []
    
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1])
    }

    if (returns.length === 0) return 0.01

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
    
    return Math.sqrt(variance)
  }

  private calculateMomentum(symbol: string, currentPrice: number): number {
    const symbolData = this.activeSimulations.get(symbol)
    if (!symbolData || symbolData.length < 10) return 0

    const recent = symbolData.slice(-10)
    const older = symbolData.slice(-20, -10)

    if (older.length === 0) return 0

    const recentAvg = recent.reduce((sum, d) => sum + d.price, 0) / recent.length
    const olderAvg = older.reduce((sum, d) => sum + d.price, 0) / older.length

    return (recentAvg - olderAvg) / olderAvg
  }

  private calculateMarketCap(symbol: string, price: number): number {
    // Generate realistic market cap based on price and symbol
    const hash = this.hashSymbol(symbol)
    const supply = 1000000 + (hash % 100000000) // 1M to 100M tokens
    return price * supply
  }

  private calculateLiquidity(volume: number, orderBook: OrderBookLevel[]): number {
    const bookVolume = orderBook.reduce((sum, level) => sum + level.volume, 0)
    return (volume + bookVolume) / 2
  }

  private calculateRiskLevel(price: number, volume: number): 'low' | 'medium' | 'high' | 'critical' {
    if (volume < 10000) return 'critical'
    if (price < 0.001 || volume < 50000) return 'high'
    if (volume < 100000) return 'medium'
    return 'low'
  }

  private randomImpactLevel(): MarketEvent['impact'] {
    const rand = Math.random()
    if (rand < 0.4) return 'minor'
    if (rand < 0.7) return 'moderate'
    if (rand < 0.9) return 'major'
    return 'extreme'
  }

  private generateEventMetadata(eventType: string): Record<string, unknown> {
    switch (eventType) {
      case 'listing':
        return {
          price_impact: 0.05 + Math.random() * 0.1,
          volume_multiplier: 2.0 + Math.random() * 3.0,
          pattern_trigger: true
        }
      case 'news':
        return {
          sentiment: Math.random() > 0.5 ? 'positive' : 'negative',
          price_impact: (Math.random() - 0.5) * 0.1
        }
      case 'whale_trade':
        return {
          volume_multiplier: 5.0 + Math.random() * 10.0,
          price_impact: (Math.random() - 0.5) * 0.05
        }
      default:
        return {}
    }
  }

  private generateTradeId(): string {
    return randomBytes(8).toString('hex')
  }

  // ===================== PUBLIC API =====================

  getSimulationData(): Map<string, SimulatedMarketData[]> {
    return new Map(this.activeSimulations)
  }

  getPerformanceMetrics(): Map<string, number> {
    return new Map(this.performanceMetrics)
  }

  isSimulationRunning(): boolean {
    return this.isRunning
  }
}

// ===================== PREDEFINED SCENARIOS =====================

export const PredefinedScenarios: SimulationScenario[] = [
  {
    id: 'standard-listing',
    name: 'Standard New Listing Scenario',
    description: 'Simulates typical new coin listing with progressive pattern states',
    config: {
      duration: 8 * 60 * 60 * 1000, // 8 hours
      symbols: ['NEWUSDT', 'TESTUSDT', 'DEMOCUSDT'],
      volatilityProfile: 'medium',
      volumeProfile: 'medium',
      trendPattern: 'bullish',
      eventSimulation: true,
      realTimeMode: false,
      dataGranularity: 'minute',
      includeAnomalies: false
    },
    expectedPatterns: [
      {
        symbol: 'NEWUSDT',
        pattern: 'ready_state',
        expectedTime: Date.now() + 4 * 60 * 60 * 1000,
        confidence: 85,
        advanceDetection: true
      }
    ],
    successCriteria: {
      patternDetectionAccuracy: 90,
      falsePositiveRate: 10,
      advanceDetectionTime: 3.5 * 60 * 60 * 1000,
      systemStability: 95,
      performanceThresholds: {
        maxLatency: 500,
        maxMemoryUsage: 512,
        minThroughput: 100
      }
    }
  },
  {
    id: 'high-volatility-stress',
    name: 'High Volatility Stress Test',
    description: 'Tests system stability under extreme market volatility',
    config: {
      duration: 2 * 60 * 60 * 1000, // 2 hours
      symbols: ['VOLAUSDT', 'STRESSUSDT'],
      volatilityProfile: 'extreme',
      volumeProfile: 'high',
      trendPattern: 'volatile',
      eventSimulation: true,
      realTimeMode: false,
      dataGranularity: 'second',
      includeAnomalies: true
    },
    expectedPatterns: [],
    successCriteria: {
      patternDetectionAccuracy: 70,
      falsePositiveRate: 25,
      advanceDetectionTime: 2 * 60 * 60 * 1000,
      systemStability: 80,
      performanceThresholds: {
        maxLatency: 1000,
        maxMemoryUsage: 1024,
        minThroughput: 50
      }
    }
  }
]

// ===================== FACTORY FUNCTION =====================

export function createMarketSimulation(config: Partial<MarketSimulationConfig>): MarketSimulationEngine {
  const defaultConfig: MarketSimulationConfig = {
    duration: 60 * 60 * 1000, // 1 hour
    symbols: ['TESTUSDT'],
    volatilityProfile: 'medium',
    volumeProfile: 'medium',
    trendPattern: 'sideways',
    eventSimulation: false,
    realTimeMode: false,
    dataGranularity: 'minute',
    includeAnomalies: false
  }

  return new MarketSimulationEngine({ ...defaultConfig, ...config })
}