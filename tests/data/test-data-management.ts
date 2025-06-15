/**
 * Test Data Management System
 * Synthetic data generation and test data versioning
 */

import { randomBytes, createHash } from 'crypto'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'

// ===================== TEST DATA TYPES =====================

export interface TestDataConfig {
  baseDirectory: string
  versioning: boolean
  encryption: boolean
  compression: boolean
  retention: {
    maxVersions: number
    maxAge: number // days
  }
  generators: TestDataGeneratorConfig[]
  seeds: Record<string, any>
}

export interface TestDataGeneratorConfig {
  id: string
  name: string
  type: 'market_data' | 'user_data' | 'trading_data' | 'agent_data' | 'api_response' | 'custom'
  schema: z.ZodSchema
  dependencies: string[]
  generationRules: GenerationRules
  constraints: DataConstraints
}

export interface GenerationRules {
  count: number | { min: number, max: number }
  distribution: 'uniform' | 'normal' | 'exponential' | 'realistic'
  correlations: Record<string, number> // -1 to 1
  temporalPatterns: TemporalPattern[]
  realistic: boolean
}

export interface TemporalPattern {
  type: 'trend' | 'seasonal' | 'cyclical' | 'random_walk' | 'mean_reversion'
  parameters: Record<string, number>
  duration: number // milliseconds
}

export interface DataConstraints {
  uniqueFields: string[]
  ranges: Record<string, { min: number, max: number }>
  relationships: DataRelationship[]
  businessRules: BusinessRule[]
}

export interface DataRelationship {
  type: 'one_to_one' | 'one_to_many' | 'many_to_many'
  sourceField: string
  targetGenerator: string
  targetField: string
  cascade: boolean
}

export interface BusinessRule {
  name: string
  condition: string // JavaScript expression
  action: 'modify' | 'reject' | 'warn'
  modification?: string // JavaScript expression
  priority: number
}

export interface TestDataSet {
  id: string
  version: string
  generatorId: string
  timestamp: number
  checksum: string
  metadata: TestDataMetadata
  data: any[]
  dependencies: Record<string, string> // dependency generator -> version
}

export interface TestDataMetadata {
  count: number
  schema: string
  generator: string
  seed: string
  constraints: string[]
  quality: DataQualityMetrics
}

export interface DataQualityMetrics {
  completeness: number // 0-1
  accuracy: number // 0-1
  consistency: number // 0-1
  validity: number // 0-1
  uniqueness: number // 0-1
  timeliness: number // 0-1
}

export interface TestDataVersion {
  version: string
  timestamp: number
  changes: string[]
  dataSetIds: string[]
  deprecated: boolean
  compatible: string[] // compatible versions
}

// ===================== TEST DATA MANAGER =====================

export class TestDataManager {
  private config: TestDataConfig
  private generators: Map<string, TestDataGenerator> = new Map()
  private versions: Map<string, TestDataVersion[]> = new Map()
  private cache: Map<string, TestDataSet> = new Map()

  constructor(config: Partial<TestDataConfig> = {}) {
    this.config = {
      baseDirectory: './test-data',
      versioning: true,
      encryption: false,
      compression: false,
      retention: {
        maxVersions: 10,
        maxAge: 30 // 30 days
      },
      generators: [],
      seeds: {},
      ...config
    }

    this.ensureDirectories()
    this.initializeGenerators()
  }

  // ===================== DATA GENERATION =====================

  async generateTestData(
    generatorId: string,
    options: {
      version?: string
      seed?: string
      count?: number
      dependencies?: Record<string, string>
    } = {}
  ): Promise<TestDataSet> {
    console.log(`🎲 Generating test data: ${generatorId}`)

    const generator = this.generators.get(generatorId)
    if (!generator) {
      throw new Error(`Generator not found: ${generatorId}`)
    }

    // Resolve dependencies
    const dependencyData = await this.resolveDependencies(generator, options.dependencies)

    // Generate data
    const data = await generator.generate({
      count: options.count,
      seed: options.seed,
      dependencies: dependencyData
    })

    // Create data set
    const version = options.version || this.generateVersion()
    const dataSet: TestDataSet = {
      id: this.generateId(),
      version,
      generatorId,
      timestamp: Date.now(),
      checksum: this.calculateChecksum(data),
      metadata: {
        count: data.length,
        schema: generator.getSchemaHash(),
        generator: generatorId,
        seed: options.seed || 'random',
        constraints: generator.getConstraintNames(),
        quality: this.assessDataQuality(data, generator)
      },
      data,
      dependencies: options.dependencies || {}
    }

    // Store data set
    await this.storeDataSet(dataSet)

    // Cache for quick access
    this.cache.set(dataSet.id, dataSet)

    console.log(`✅ Generated ${data.length} records for ${generatorId}`)
    return dataSet
  }

  async getTestData(
    generatorId: string,
    version?: string
  ): Promise<TestDataSet | null> {
    // Try cache first
    const cacheKey = `${generatorId}-${version || 'latest'}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    // Load from storage
    const dataSet = await this.loadDataSet(generatorId, version)
    if (dataSet) {
      this.cache.set(cacheKey, dataSet)
    }

    return dataSet
  }

  async regenerateTestData(
    generatorId: string,
    preserveSeed: boolean = true
  ): Promise<TestDataSet> {
    const existing = await this.getTestData(generatorId)
    const seed = preserveSeed && existing ? existing.metadata.seed : undefined

    return await this.generateTestData(generatorId, { seed })
  }

  // ===================== SYNTHETIC DATA GENERATORS =====================

  registerGenerator(config: TestDataGeneratorConfig): void {
    const generator = new TestDataGenerator(config, this.config.seeds[config.id])
    this.generators.set(config.id, generator)
    console.log(`📋 Registered test data generator: ${config.id}`)
  }

  private initializeGenerators(): void {
    // Register built-in generators
    this.registerBuiltInGenerators()

    // Register custom generators from config
    for (const generatorConfig of this.config.generators) {
      this.registerGenerator(generatorConfig)
    }
  }

  private registerBuiltInGenerators(): void {
    // Market Data Generator
    this.registerGenerator({
      id: 'market-data',
      name: 'Cryptocurrency Market Data',
      type: 'market_data',
      schema: z.object({
        symbol: z.string(),
        price: z.number().positive(),
        volume: z.number().positive(),
        timestamp: z.number(),
        sts: z.number().int().min(0).max(2),
        st: z.number().int().min(0).max(2),
        tt: z.number().int().min(0).max(4),
        marketCap: z.number().positive().optional(),
        change24h: z.number().optional()
      }),
      dependencies: [],
      generationRules: {
        count: { min: 100, max: 1000 },
        distribution: 'realistic',
        correlations: {
          'price-volume': -0.3,
          'price-marketCap': 0.9
        },
        temporalPatterns: [
          {
            type: 'random_walk',
            parameters: { volatility: 0.05, drift: 0.001 },
            duration: 24 * 60 * 60 * 1000 // 24 hours
          }
        ],
        realistic: true
      },
      constraints: {
        uniqueFields: ['symbol'],
        ranges: {
          price: { min: 0.0001, max: 100000 },
          volume: { min: 1000, max: 100000000 },
          sts: { min: 0, max: 2 },
          st: { min: 0, max: 2 },
          tt: { min: 0, max: 4 }
        },
        relationships: [],
        businessRules: [
          {
            name: 'ready-state-pattern',
            condition: 'data.sts === 2 && data.st === 2',
            action: 'modify',
            modification: 'data.tt = 4',
            priority: 1
          }
        ]
      }
    })

    // Trading Data Generator
    this.registerGenerator({
      id: 'trading-data',
      name: 'Trading Transactions',
      type: 'trading_data',
      schema: z.object({
        id: z.string(),
        symbol: z.string(),
        side: z.enum(['buy', 'sell']),
        amount: z.number().positive(),
        price: z.number().positive(),
        timestamp: z.number(),
        fee: z.number().nonnegative(),
        status: z.enum(['pending', 'completed', 'cancelled']),
        strategy: z.string().optional()
      }),
      dependencies: ['market-data'],
      generationRules: {
        count: { min: 50, max: 500 },
        distribution: 'realistic',
        correlations: {
          'amount-price': -0.2
        },
        temporalPatterns: [
          {
            type: 'cyclical',
            parameters: { period: 4 * 60 * 60 * 1000 }, // 4 hour cycles
            duration: 7 * 24 * 60 * 60 * 1000 // 7 days
          }
        ],
        realistic: true
      },
      constraints: {
        uniqueFields: ['id'],
        ranges: {
          amount: { min: 0.1, max: 10000 },
          price: { min: 0.0001, max: 100000 },
          fee: { min: 0, max: 100 }
        },
        relationships: [
          {
            type: 'many_to_many',
            sourceField: 'symbol',
            targetGenerator: 'market-data',
            targetField: 'symbol',
            cascade: false
          }
        ],
        businessRules: [
          {
            name: 'minimum-trade-amount',
            condition: 'data.amount * data.price < 10',
            action: 'reject',
            priority: 1
          }
        ]
      }
    })

    // Agent Performance Data Generator
    this.registerGenerator({
      id: 'agent-performance',
      name: 'AI Agent Performance Metrics',
      type: 'agent_data',
      schema: z.object({
        agentId: z.string(),
        agentType: z.enum(['pattern', 'calendar', 'risk', 'strategy', 'safety']),
        timestamp: z.number(),
        responseTime: z.number().positive(),
        confidence: z.number().min(0).max(100),
        accuracy: z.number().min(0).max(100),
        memoryUsage: z.number().positive(),
        cacheHitRate: z.number().min(0).max(1),
        errorCount: z.number().nonnegative(),
        status: z.enum(['active', 'idle', 'error', 'maintenance'])
      }),
      dependencies: [],
      generationRules: {
        count: { min: 200, max: 2000 },
        distribution: 'normal',
        correlations: {
          'responseTime-confidence': -0.4,
          'accuracy-confidence': 0.8
        },
        temporalPatterns: [
          {
            type: 'seasonal',
            parameters: { amplitude: 0.2, period: 24 * 60 * 60 * 1000 }, // Daily pattern
            duration: 7 * 24 * 60 * 60 * 1000 // 7 days
          }
        ],
        realistic: true
      },
      constraints: {
        uniqueFields: [],
        ranges: {
          responseTime: { min: 10, max: 5000 },
          confidence: { min: 60, max: 100 },
          accuracy: { min: 70, max: 100 },
          memoryUsage: { min: 50, max: 1000 },
          cacheHitRate: { min: 0, max: 1 },
          errorCount: { min: 0, max: 10 }
        },
        relationships: [],
        businessRules: [
          {
            name: 'high-error-low-accuracy',
            condition: 'data.errorCount > 5',
            action: 'modify',
            modification: 'data.accuracy = Math.min(data.accuracy, 75)',
            priority: 1
          }
        ]
      }
    })

    // User Data Generator
    this.registerGenerator({
      id: 'user-data',
      name: 'User Account Data',
      type: 'user_data',
      schema: z.object({
        userId: z.string(),
        email: z.string().email(),
        username: z.string(),
        accountType: z.enum(['free', 'premium', 'enterprise']),
        balance: z.number().nonnegative(),
        joinDate: z.number(),
        lastActive: z.number(),
        preferences: z.object({
          riskLevel: z.enum(['low', 'medium', 'high']),
          notifications: z.boolean(),
          theme: z.enum(['light', 'dark'])
        }),
        tradingExperience: z.enum(['beginner', 'intermediate', 'expert'])
      }),
      dependencies: [],
      generationRules: {
        count: { min: 20, max: 100 },
        distribution: 'realistic',
        correlations: {
          'balance-accountType': 0.6,
          'tradingExperience-balance': 0.4
        },
        temporalPatterns: [],
        realistic: true
      },
      constraints: {
        uniqueFields: ['userId', 'email', 'username'],
        ranges: {
          balance: { min: 0, max: 1000000 }
        },
        relationships: [],
        businessRules: [
          {
            name: 'premium-minimum-balance',
            condition: 'data.accountType === "premium"',
            action: 'modify',
            modification: 'data.balance = Math.max(data.balance, 1000)',
            priority: 1
          }
        ]
      }
    })
  }

  // ===================== DATA VERSIONING =====================

  private generateVersion(): string {
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5)
    return `v${timestamp}`
  }

  private async storeDataSet(dataSet: TestDataSet): Promise<void> {
    if (!this.config.versioning) return

    const dir = join(this.config.baseDirectory, dataSet.generatorId)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    const filePath = join(dir, `${dataSet.version}.json`)
    const content = JSON.stringify(dataSet, null, 2)

    if (this.config.encryption) {
      // In a real implementation, encrypt the content
    }

    if (this.config.compression) {
      // In a real implementation, compress the content
    }

    writeFileSync(filePath, content, 'utf-8')

    // Update version history
    await this.updateVersionHistory(dataSet)

    // Clean up old versions
    await this.cleanupOldVersions(dataSet.generatorId)
  }

  private async loadDataSet(
    generatorId: string,
    version?: string
  ): Promise<TestDataSet | null> {
    const dir = join(this.config.baseDirectory, generatorId)
    if (!existsSync(dir)) return null

    let fileName: string
    if (version) {
      fileName = `${version}.json`
    } else {
      // Load latest version
      const versions = this.getVersions(generatorId)
      if (versions.length === 0) return null
      fileName = `${versions[versions.length - 1].version}.json`
    }

    const filePath = join(dir, fileName)
    if (!existsSync(filePath)) return null

    try {
      const content = readFileSync(filePath, 'utf-8')
      return JSON.parse(content) as TestDataSet
    } catch (error) {
      console.error(`Failed to load test data: ${filePath}`, error)
      return null
    }
  }

  private async updateVersionHistory(dataSet: TestDataSet): Promise<void> {
    const generatorId = dataSet.generatorId
    let versions = this.versions.get(generatorId) || []

    const newVersion: TestDataVersion = {
      version: dataSet.version,
      timestamp: dataSet.timestamp,
      changes: [], // Could track changes if needed
      dataSetIds: [dataSet.id],
      deprecated: false,
      compatible: versions.map(v => v.version)
    }

    versions.push(newVersion)
    this.versions.set(generatorId, versions)
  }

  private getVersions(generatorId: string): TestDataVersion[] {
    return this.versions.get(generatorId) || []
  }

  private async cleanupOldVersions(generatorId: string): Promise<void> {
    const versions = this.getVersions(generatorId)
    const { maxVersions, maxAge } = this.config.retention

    // Remove versions exceeding count limit
    if (versions.length > maxVersions) {
      const toRemove = versions.slice(0, versions.length - maxVersions)
      for (const version of toRemove) {
        await this.removeVersion(generatorId, version.version)
      }
    }

    // Remove versions exceeding age limit
    const maxAgeMs = maxAge * 24 * 60 * 60 * 1000
    const cutoffTime = Date.now() - maxAgeMs

    const expiredVersions = versions.filter(v => v.timestamp < cutoffTime)
    for (const version of expiredVersions) {
      await this.removeVersion(generatorId, version.version)
    }
  }

  private async removeVersion(generatorId: string, version: string): Promise<void> {
    const filePath = join(this.config.baseDirectory, generatorId, `${version}.json`)
    if (existsSync(filePath)) {
      // In a real implementation, would actually delete the file
      console.log(`Would remove version: ${filePath}`)
    }

    // Update version history
    const versions = this.getVersions(generatorId).filter(v => v.version !== version)
    this.versions.set(generatorId, versions)
  }

  // ===================== DEPENDENCY RESOLUTION =====================

  private async resolveDependencies(
    generator: TestDataGenerator,
    explicitDependencies?: Record<string, string>
  ): Promise<Record<string, any[]>> {
    const dependencies: Record<string, any[]> = {}

    for (const depId of generator.getDependencies()) {
      const version = explicitDependencies?.[depId]
      const depDataSet = await this.getTestData(depId, version)
      
      if (!depDataSet) {
        // Generate dependency data if not found
        const depDataSet = await this.generateTestData(depId)
        dependencies[depId] = depDataSet.data
      } else {
        dependencies[depId] = depDataSet.data
      }
    }

    return dependencies
  }

  // ===================== DATA QUALITY ASSESSMENT =====================

  private assessDataQuality(data: any[], generator: TestDataGenerator): DataQualityMetrics {
    const schema = generator.getSchema()
    const constraints = generator.getConstraints()

    let completeness = 0
    let accuracy = 0
    let consistency = 0
    let validity = 0
    let uniqueness = 0

    // Assess each record
    for (const record of data) {
      // Validity: Does it match the schema?
      try {
        schema.parse(record)
        validity += 1
      } catch {
        // Invalid record
      }

      // Completeness: Are all required fields present?
      const requiredFields = this.getRequiredFields(schema)
      const presentFields = requiredFields.filter(field => record[field] !== undefined && record[field] !== null)
      completeness += presentFields.length / requiredFields.length

      // Accuracy: Are values within expected ranges?
      let accurateFields = 0
      let totalFields = 0
      for (const [field, range] of Object.entries(constraints.ranges)) {
        if (record[field] !== undefined) {
          totalFields++
          if (record[field] >= range.min && record[field] <= range.max) {
            accurateFields++
          }
        }
      }
      if (totalFields > 0) {
        accuracy += accurateFields / totalFields
      }
    }

    // Uniqueness: Check unique field constraints
    for (const uniqueField of constraints.uniqueFields) {
      const values = data.map(record => record[uniqueField]).filter(v => v !== undefined)
      const uniqueValues = new Set(values)
      uniqueness += uniqueValues.size / values.length
    }

    // Consistency: Check business rules
    let consistentRecords = 0
    for (const record of data) {
      let isConsistent = true
      for (const rule of constraints.businessRules) {
        try {
          const conditionFunc = new Function('data', `return ${rule.condition}`)
          if (conditionFunc(record)) {
            // Rule applies, check if action would be needed
            if (rule.action === 'reject') {
              isConsistent = false
              break
            }
          }
        } catch {
          // Rule evaluation failed
        }
      }
      if (isConsistent) consistentRecords++
    }

    const recordCount = data.length || 1

    return {
      completeness: completeness / recordCount,
      accuracy: accuracy / recordCount,
      consistency: consistentRecords / recordCount,
      validity: validity / recordCount,
      uniqueness: constraints.uniqueFields.length > 0 ? uniqueness / constraints.uniqueFields.length : 1,
      timeliness: 1 // Always current for generated data
    }
  }

  private getRequiredFields(schema: z.ZodSchema): string[] {
    // In a real implementation, would introspect the Zod schema
    // For now, return a mock list
    return ['id', 'timestamp'] // Common required fields
  }

  // ===================== UTILITY METHODS =====================

  private ensureDirectories(): void {
    if (!existsSync(this.config.baseDirectory)) {
      mkdirSync(this.config.baseDirectory, { recursive: true })
    }
  }

  private generateId(): string {
    return randomBytes(8).toString('hex')
  }

  private calculateChecksum(data: any[]): string {
    const content = JSON.stringify(data)
    return createHash('sha256').update(content).digest('hex')
  }

  // ===================== PUBLIC API =====================

  getGeneratorIds(): string[] {
    return Array.from(this.generators.keys())
  }

  getVersionHistory(generatorId: string): TestDataVersion[] {
    return this.getVersions(generatorId)
  }

  async exportTestData(generatorId: string, version?: string): Promise<string> {
    const dataSet = await this.getTestData(generatorId, version)
    if (!dataSet) {
      throw new Error(`Test data not found: ${generatorId}${version ? `:${version}` : ''}`)
    }

    return JSON.stringify(dataSet, null, 2)
  }

  async importTestData(jsonData: string): Promise<TestDataSet> {
    const dataSet = JSON.parse(jsonData) as TestDataSet
    await this.storeDataSet(dataSet)
    this.cache.set(dataSet.id, dataSet)
    return dataSet
  }

  clearCache(): void {
    this.cache.clear()
  }
}

// ===================== TEST DATA GENERATOR =====================

class TestDataGenerator {
  private config: TestDataGeneratorConfig
  private seed: string
  private random: () => number

  constructor(config: TestDataGeneratorConfig, seed?: string) {
    this.config = config
    this.seed = seed || this.generateSeed()
    this.random = this.createSeededRandom(this.seed)
  }

  async generate(options: {
    count?: number
    seed?: string
    dependencies?: Record<string, any[]>
  } = {}): Promise<any[]> {
    if (options.seed && options.seed !== this.seed) {
      this.seed = options.seed
      this.random = this.createSeededRandom(this.seed)
    }

    const count = options.count || this.getGenerationCount()
    const dependencies = options.dependencies || {}

    const data: any[] = []

    for (let i = 0; i < count; i++) {
      const record = await this.generateRecord(i, dependencies)
      
      // Apply business rules
      const processedRecord = this.applyBusinessRules(record)
      
      if (processedRecord) {
        data.push(processedRecord)
      }
    }

    return data
  }

  private async generateRecord(index: number, dependencies: Record<string, any[]>): Promise<any> {
    const record: any = {}

    // Generate based on schema type
    if (this.config.type === 'market_data') {
      record.symbol = this.generateSymbol()
      record.price = this.generatePrice()
      record.volume = this.generateVolume()
      record.timestamp = Date.now() + (index * 1000)
      record.sts = this.generateSTS()
      record.st = this.generateST()
      record.tt = this.generateTT()
      record.marketCap = record.price * 1000000 + this.random() * 50000000
      record.change24h = (this.random() - 0.5) * 20 // -10% to +10%
    } else if (this.config.type === 'trading_data') {
      record.id = this.generateId()
      record.symbol = this.selectFromDependency(dependencies, 'market-data', 'symbol')
      record.side = this.random() > 0.5 ? 'buy' : 'sell'
      record.amount = this.generateAmount()
      record.price = this.generatePrice()
      record.timestamp = Date.now() + (index * 1000)
      record.fee = record.amount * record.price * 0.001 // 0.1% fee
      record.status = this.generateStatus()
      record.strategy = this.generateStrategy()
    } else if (this.config.type === 'agent_data') {
      record.agentId = this.generateAgentId()
      record.agentType = this.generateAgentType()
      record.timestamp = Date.now() + (index * 1000)
      record.responseTime = this.generateResponseTime()
      record.confidence = this.generateConfidence()
      record.accuracy = this.generateAccuracy()
      record.memoryUsage = this.generateMemoryUsage()
      record.cacheHitRate = this.random()
      record.errorCount = Math.floor(this.random() * 5)
      record.status = this.generateAgentStatus()
    } else if (this.config.type === 'user_data') {
      record.userId = this.generateId()
      record.email = this.generateEmail()
      record.username = this.generateUsername()
      record.accountType = this.generateAccountType()
      record.balance = this.generateBalance()
      record.joinDate = Date.now() - Math.floor(this.random() * 365 * 24 * 60 * 60 * 1000)
      record.lastActive = Date.now() - Math.floor(this.random() * 30 * 24 * 60 * 60 * 1000)
      record.preferences = {
        riskLevel: this.generateRiskLevel(),
        notifications: this.random() > 0.3,
        theme: this.random() > 0.4 ? 'dark' : 'light'
      }
      record.tradingExperience = this.generateTradingExperience()
    }

    return record
  }

  // ===================== FIELD GENERATORS =====================

  private generateSymbol(): string {
    const bases = ['BTC', 'ETH', 'ADA', 'DOT', 'LINK', 'UNI', 'AAVE', 'COMP', 'MKR', 'SNX']
    const base = bases[Math.floor(this.random() * bases.length)]
    return `${base}USDT`
  }

  private generatePrice(): number {
    return 0.01 + this.random() * 1000
  }

  private generateVolume(): number {
    return 1000 + this.random() * 10000000
  }

  private generateSTS(): number {
    const weights = [0.3, 0.4, 0.3] // Probability distribution for sts values 0, 1, 2
    return this.weightedChoice([0, 1, 2], weights)
  }

  private generateST(): number {
    const weights = [0.3, 0.4, 0.3] // Probability distribution for st values 0, 1, 2
    return this.weightedChoice([0, 1, 2], weights)
  }

  private generateTT(): number {
    const weights = [0.2, 0.2, 0.2, 0.2, 0.2] // Equal probability for tt values 0-4
    return this.weightedChoice([0, 1, 2, 3, 4], weights)
  }

  private generateAmount(): number {
    return 0.1 + this.random() * 1000
  }

  private generateStatus(): string {
    const statuses = ['pending', 'completed', 'cancelled']
    const weights = [0.1, 0.85, 0.05]
    return this.weightedChoice(statuses, weights)
  }

  private generateStrategy(): string {
    const strategies = ['pattern_sniper', 'calendar_event', 'momentum', 'mean_reversion']
    return strategies[Math.floor(this.random() * strategies.length)]
  }

  private generateAgentId(): string {
    return `agent-${this.generateId()}`
  }

  private generateAgentType(): string {
    const types = ['pattern', 'calendar', 'risk', 'strategy', 'safety']
    return types[Math.floor(this.random() * types.length)]
  }

  private generateResponseTime(): number {
    // Log-normal distribution for response times
    const mean = Math.log(200)
    const stdDev = 0.5
    return Math.exp(mean + stdDev * this.normalRandom())
  }

  private generateConfidence(): number {
    // Normal distribution around 85 with std dev of 10
    return Math.max(60, Math.min(100, 85 + 10 * this.normalRandom()))
  }

  private generateAccuracy(): number {
    // Correlated with confidence
    const baseAccuracy = 80
    const confidenceBonus = (this.generateConfidence() - 80) * 0.5
    return Math.max(70, Math.min(100, baseAccuracy + confidenceBonus + 5 * this.normalRandom()))
  }

  private generateMemoryUsage(): number {
    return 50 + this.random() * 500
  }

  private generateAgentStatus(): string {
    const statuses = ['active', 'idle', 'error', 'maintenance']
    const weights = [0.7, 0.2, 0.05, 0.05]
    return this.weightedChoice(statuses, weights)
  }

  private generateEmail(): string {
    const domains = ['example.com', 'test.com', 'demo.org']
    const username = this.generateUsername()
    const domain = domains[Math.floor(this.random() * domains.length)]
    return `${username}@${domain}`
  }

  private generateUsername(): string {
    const prefixes = ['user', 'trader', 'crypto', 'investor', 'bot']
    const prefix = prefixes[Math.floor(this.random() * prefixes.length)]
    const number = Math.floor(this.random() * 10000)
    return `${prefix}${number}`
  }

  private generateAccountType(): string {
    const types = ['free', 'premium', 'enterprise']
    const weights = [0.7, 0.25, 0.05]
    return this.weightedChoice(types, weights)
  }

  private generateBalance(): number {
    return this.random() * 100000
  }

  private generateRiskLevel(): string {
    const levels = ['low', 'medium', 'high']
    const weights = [0.4, 0.5, 0.1]
    return this.weightedChoice(levels, weights)
  }

  private generateTradingExperience(): string {
    const levels = ['beginner', 'intermediate', 'expert']
    const weights = [0.5, 0.35, 0.15]
    return this.weightedChoice(levels, weights)
  }

  private generateId(): string {
    return randomBytes(4).toString('hex')
  }

  // ===================== UTILITY METHODS =====================

  private generateSeed(): string {
    return randomBytes(8).toString('hex')
  }

  private createSeededRandom(seed: string): () => number {
    let state = this.hashSeed(seed)
    return () => {
      state = (state * 16807) % 2147483647
      return (state - 1) / 2147483646
    }
  }

  private hashSeed(seed: string): number {
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash) || 1
  }

  private normalRandom(): number {
    // Box-Muller transform for normal distribution
    let u = 0, v = 0
    while (u === 0) u = this.random() // Converting [0,1) to (0,1)
    while (v === 0) v = this.random()
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  }

  private weightedChoice<T>(choices: T[], weights: number[]): T {
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    let random = this.random() * total
    
    for (let i = 0; i < choices.length; i++) {
      random -= weights[i]
      if (random <= 0) {
        return choices[i]
      }
    }
    
    return choices[choices.length - 1]
  }

  private selectFromDependency(
    dependencies: Record<string, any[]>,
    generatorId: string,
    field: string
  ): any {
    const depData = dependencies[generatorId]
    if (!depData || depData.length === 0) {
      return null
    }
    
    const record = depData[Math.floor(this.random() * depData.length)]
    return record[field]
  }

  private getGenerationCount(): number {
    const count = this.config.generationRules.count
    if (typeof count === 'number') {
      return count
    } else {
      return count.min + Math.floor(this.random() * (count.max - count.min + 1))
    }
  }

  private applyBusinessRules(record: any): any | null {
    for (const rule of this.config.constraints.businessRules) {
      try {
        const conditionFunc = new Function('data', `return ${rule.condition}`)
        if (conditionFunc(record)) {
          switch (rule.action) {
            case 'reject':
              return null
            case 'modify':
              if (rule.modification) {
                const modFunc = new Function('data', rule.modification)
                modFunc(record)
              }
              break
            case 'warn':
              console.warn(`Business rule warning: ${rule.name}`, record)
              break
          }
        }
      } catch (error) {
        console.warn(`Business rule evaluation failed: ${rule.name}`, error)
      }
    }

    return record
  }

  // ===================== PUBLIC API =====================

  getDependencies(): string[] {
    return this.config.dependencies
  }

  getSchema(): z.ZodSchema {
    return this.config.schema
  }

  getSchemaHash(): string {
    return createHash('md5').update(JSON.stringify(this.config.schema)).digest('hex')
  }

  getConstraints(): DataConstraints {
    return this.config.constraints
  }

  getConstraintNames(): string[] {
    return this.config.constraints.businessRules.map(rule => rule.name)
  }
}

// ===================== FACTORY FUNCTIONS =====================

export function createTestDataManager(config?: Partial<TestDataConfig>): TestDataManager {
  return new TestDataManager(config)
}

export function createMarketDataGenerator(): TestDataManager {
  const manager = new TestDataManager()
  // Market data generator is already registered by default
  return manager
}

export function createTradingDataGenerator(): TestDataManager {
  const manager = new TestDataManager()
  // Trading data generator is already registered by default
  return manager
}

// ===================== PREDEFINED DATA SETS =====================

export const PredefinedDataSets = {
  async generateBasicTestSuite(manager: TestDataManager): Promise<Record<string, TestDataSet>> {
    const dataSets: Record<string, TestDataSet> = {}

    // Generate market data first (dependency for trading data)
    dataSets.marketData = await manager.generateTestData('market-data', { count: 100 })

    // Generate trading data with market data dependency
    dataSets.tradingData = await manager.generateTestData('trading-data', {
      count: 200,
      dependencies: { 'market-data': dataSets.marketData.version }
    })

    // Generate agent performance data
    dataSets.agentPerformance = await manager.generateTestData('agent-performance', { count: 500 })

    // Generate user data
    dataSets.userData = await manager.generateTestData('user-data', { count: 50 })

    return dataSets
  },

  async generateStressTestData(manager: TestDataManager): Promise<Record<string, TestDataSet>> {
    const dataSets: Record<string, TestDataSet> = {}

    // Large market data set for stress testing
    dataSets.marketDataLarge = await manager.generateTestData('market-data', { count: 10000 })

    // Large trading data set
    dataSets.tradingDataLarge = await manager.generateTestData('trading-data', {
      count: 50000,
      dependencies: { 'market-data': dataSets.marketDataLarge.version }
    })

    // Large agent performance data
    dataSets.agentPerformanceLarge = await manager.generateTestData('agent-performance', { count: 100000 })

    return dataSets
  }
}