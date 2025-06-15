/**
 * Mutation Testing Framework
 * Code quality validation through systematic mutation testing
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { performance } from 'node:perf_hooks'
import { spawn } from 'child_process'
import { randomBytes } from 'crypto'

// ===================== MUTATION TESTING TYPES =====================

export interface MutationTestConfig {
  targetDirectories: string[]
  testCommand: string
  testTimeout: number // milliseconds
  mutationOperators: MutationOperator[]
  fileFilters: FileFilter[]
  excludePatterns: string[]
  coverageThreshold: number // 0-100 percentage
  mutationScoreThreshold: number // 0-100 percentage
  concurrency: number
  reportFormat: 'json' | 'html' | 'xml' | 'console'
  outputDirectory: string
}

export interface MutationOperator {
  id: string
  name: string
  description: string
  category: 'arithmetic' | 'relational' | 'logical' | 'assignment' | 'unary' | 'literal' | 'conditional' | 'method_call'
  mutations: MutationRule[]
  weight: number // Priority/frequency 0-1
  applicability: string[] // File extensions or patterns
}

export interface MutationRule {
  pattern: RegExp
  replacement: string | ((match: string) => string)
  condition?: (context: MutationContext) => boolean
  description: string
  risk: 'low' | 'medium' | 'high' // Risk of breaking compilation
}

export interface MutationContext {
  filePath: string
  fileContent: string
  lineNumber: number
  columnNumber: number
  surroundingCode: string
  functionName?: string
  className?: string
}

export interface FileFilter {
  include?: RegExp[]
  exclude?: RegExp[]
  minSize?: number
  maxSize?: number
  extensions: string[]
}

export interface MutationTest {
  id: string
  filePath: string
  lineNumber: number
  columnNumber: number
  originalCode: string
  mutatedCode: string
  operator: string
  operatorCategory: string
  description: string
  risk: string
}

export interface MutationTestResult {
  test: MutationTest
  status: 'killed' | 'survived' | 'timeout' | 'error' | 'skipped'
  executionTime: number
  testOutput?: string
  errorOutput?: string
  coverageImpact?: CoverageImpact
}

export interface CoverageImpact {
  linesCovered: number
  linesTotal: number
  branchesCovered: number
  branchesTotal: number
  coverageChange: number // percentage change
}

export interface MutationTestSession {
  id: string
  startTime: number
  endTime: number
  config: MutationTestConfig
  fileStats: FileStats
  mutationStats: MutationStats
  results: MutationTestResult[]
  summary: MutationSummary
}

export interface FileStats {
  totalFiles: number
  processedFiles: number
  skippedFiles: number
  totalLines: number
  processedLines: number
}

export interface MutationStats {
  totalMutations: number
  appliedMutations: number
  killedMutations: number
  survivedMutations: number
  timeoutMutations: number
  errorMutations: number
  skippedMutations: number
  mutationScore: number
}

export interface MutationSummary {
  mutationScore: number // percentage of killed mutations
  coverage: number // percentage of code covered
  testEffectiveness: number // how good tests are at catching mutations
  recommendations: string[]
  worstPerformingFiles: string[]
  operatorEffectiveness: Record<string, number>
}

// ===================== MUTATION TESTING ENGINE =====================

export class MutationTestingEngine {
  private config: MutationTestConfig
  private mutationOperators: Map<string, MutationOperator> = new Map()
  private currentSession: MutationTestSession | null = null

  constructor(config: Partial<MutationTestConfig> = {}) {
    this.config = {
      targetDirectories: ['src'],
      testCommand: 'npm test',
      testTimeout: 30000, // 30 seconds
      mutationOperators: [],
      fileFilters: [{
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        minSize: 100, // bytes
        maxSize: 50000 // 50KB
      }],
      excludePatterns: [
        'node_modules',
        'dist',
        'build',
        '.next',
        'coverage',
        '*.test.*',
        '*.spec.*'
      ],
      coverageThreshold: 80,
      mutationScoreThreshold: 75,
      concurrency: 4,
      reportFormat: 'json',
      outputDirectory: './mutation-test-results',
      ...config
    }

    this.initializeMutationOperators()
  }

  // ===================== MUTATION TEST EXECUTION =====================

  async runMutationTesting(): Promise<MutationTestSession> {
    console.log('🧬 Starting mutation testing...')
    
    const sessionId = this.generateSessionId()
    const startTime = performance.now()

    this.currentSession = {
      id: sessionId,
      startTime,
      endTime: 0,
      config: this.config,
      fileStats: { totalFiles: 0, processedFiles: 0, skippedFiles: 0, totalLines: 0, processedLines: 0 },
      mutationStats: { totalMutations: 0, appliedMutations: 0, killedMutations: 0, survivedMutations: 0, timeoutMutations: 0, errorMutations: 0, skippedMutations: 0 },
      results: [],
      summary: { mutationScore: 0, coverage: 0, testEffectiveness: 0, recommendations: [], worstPerformingFiles: [], operatorEffectiveness: {} }
    }

    try {
      // Verify test suite passes initially
      console.log('🧪 Verifying test suite...')
      const initialTestResult = await this.runTests()
      if (!initialTestResult.success) {
        throw new Error('Initial test suite failed. Fix tests before running mutation testing.')
      }

      // Discover target files
      console.log('📁 Discovering target files...')
      const targetFiles = await this.discoverTargetFiles()
      this.currentSession.fileStats.totalFiles = targetFiles.length

      // Generate mutations
      console.log('🔬 Generating mutations...')
      const mutations = await this.generateMutations(targetFiles)
      this.currentSession.mutationStats.totalMutations = mutations.length

      console.log(`📊 Found ${targetFiles.length} files, generated ${mutations.length} mutations`)

      // Execute mutations
      console.log('⚡ Executing mutation tests...')
      const results = await this.executeMutations(mutations)
      this.currentSession.results = results

      // Calculate statistics
      this.calculateStatistics()

      const endTime = performance.now()
      this.currentSession.endTime = endTime

      // Generate report
      await this.generateReport()

      console.log(`✅ Mutation testing completed in ${((endTime - startTime) / 1000).toFixed(2)}s`)
      console.log(`📈 Mutation Score: ${this.currentSession.summary.mutationScore.toFixed(2)}%`)

      return this.currentSession

    } catch (error) {
      console.error('❌ Mutation testing failed:', error)
      throw error
    }
  }

  // ===================== FILE DISCOVERY =====================

  private async discoverTargetFiles(): Promise<string[]> {
    const files: string[] = []

    for (const directory of this.config.targetDirectories) {
      const directoryFiles = await this.scanDirectory(directory)
      files.push(...directoryFiles)
    }

    // Apply file filters
    const filteredFiles = files.filter(file => this.shouldProcessFile(file))

    return filteredFiles
  }

  private async scanDirectory(directory: string): Promise<string[]> {
    // In a real implementation, this would recursively scan directories
    // For now, return mock file list
    return [
      'src/mexc-agents/base-agent.ts',
      'src/mexc-agents/pattern-discovery-agent.ts',
      'src/mexc-agents/calendar-agent.ts',
      'src/mexc-agents/risk-manager-agent.ts',
      'src/lib/api-client.ts',
      'src/services/mexc-api-client.ts'
    ].filter(file => file.startsWith(directory))
  }

  private shouldProcessFile(filePath: string): boolean {
    // Check exclude patterns
    for (const pattern of this.config.excludePatterns) {
      if (filePath.includes(pattern)) {
        return false
      }
    }

    // Check file filters
    for (const filter of this.config.fileFilters) {
      // Check extensions
      const hasValidExtension = filter.extensions.some(ext => filePath.endsWith(ext))
      if (!hasValidExtension) {
        continue
      }

      // Check size if file exists
      if (existsSync(filePath)) {
        try {
          const stats = require('fs').statSync(filePath)
          if (filter.minSize && stats.size < filter.minSize) {
            return false
          }
          if (filter.maxSize && stats.size > filter.maxSize) {
            return false
          }
        } catch {
          return false
        }
      }

      return true
    }

    return false
  }

  // ===================== MUTATION GENERATION =====================

  private async generateMutations(files: string[]): Promise<MutationTest[]> {
    const mutations: MutationTest[] = []

    for (const filePath of files) {
      try {
        const fileContent = readFileSync(filePath, 'utf-8')
        const fileMutations = await this.generateFileMutations(filePath, fileContent)
        mutations.push(...fileMutations)

        this.currentSession!.fileStats.processedFiles++
        this.currentSession!.fileStats.totalLines += fileContent.split('\n').length
      } catch (error) {
        console.warn(`Failed to process file ${filePath}:`, error)
        this.currentSession!.fileStats.skippedFiles++
      }
    }

    return mutations
  }

  private async generateFileMutations(filePath: string, content: string): Promise<MutationTest[]> {
    const mutations: MutationTest[] = []
    const lines = content.split('\n')

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]
      const lineNumber = lineIndex + 1

      for (const operator of this.mutationOperators.values()) {
        // Check if operator is applicable to this file
        if (!this.isOperatorApplicable(operator, filePath)) {
          continue
        }

        const lineMutations = this.generateLineMutations(
          filePath,
          line,
          lineNumber,
          operator,
          content
        )
        mutations.push(...lineMutations)
      }
    }

    return mutations
  }

  private generateLineMutations(
    filePath: string,
    line: string,
    lineNumber: number,
    operator: MutationOperator,
    fullContent: string
  ): MutationTest[] {
    const mutations: MutationTest[] = []

    for (const rule of operator.mutations) {
      const matches = Array.from(line.matchAll(new RegExp(rule.pattern, 'g')))

      for (const match of matches) {
        if (match.index === undefined) continue

        const context: MutationContext = {
          filePath,
          fileContent: fullContent,
          lineNumber,
          columnNumber: match.index,
          surroundingCode: this.getSurroundingCode(fullContent, lineNumber),
          functionName: this.extractFunctionName(fullContent, lineNumber),
          className: this.extractClassName(fullContent, lineNumber)
        }

        // Check rule condition if specified
        if (rule.condition && !rule.condition(context)) {
          continue
        }

        const originalCode = match[0]
        const mutatedCode = typeof rule.replacement === 'function'
          ? rule.replacement(originalCode)
          : rule.replacement

        // Skip if mutation doesn't change anything
        if (originalCode === mutatedCode) {
          continue
        }

        const mutation: MutationTest = {
          id: this.generateMutationId(),
          filePath,
          lineNumber,
          columnNumber: match.index,
          originalCode,
          mutatedCode,
          operator: operator.id,
          operatorCategory: operator.category,
          description: `${rule.description}: ${originalCode} → ${mutatedCode}`,
          risk: rule.risk
        }

        mutations.push(mutation)
      }
    }

    return mutations
  }

  // ===================== MUTATION EXECUTION =====================

  private async executeMutations(mutations: MutationTest[]): Promise<MutationTestResult[]> {
    const results: MutationTestResult[] = []
    const concurrency = this.config.concurrency

    console.log(`🔄 Executing ${mutations.length} mutations with concurrency ${concurrency}`)

    // Process mutations in batches
    for (let i = 0; i < mutations.length; i += concurrency) {
      const batch = mutations.slice(i, i + concurrency)
      const batchPromises = batch.map(mutation => this.executeSingleMutation(mutation))
      const batchResults = await Promise.allSettled(batchPromises)

      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j]
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          // Handle failed mutation execution
          const mutation = batch[j]
          results.push({
            test: mutation,
            status: 'error',
            executionTime: 0,
            errorOutput: result.reason instanceof Error ? result.reason.message : String(result.reason)
          })
        }
      }

      // Progress indicator
      const progress = Math.min(100, ((i + concurrency) / mutations.length) * 100)
      console.log(`  Progress: ${progress.toFixed(1)}%`)
    }

    return results
  }

  private async executeSingleMutation(mutation: MutationTest): Promise<MutationTestResult> {
    const startTime = performance.now()

    try {
      // Apply mutation
      const originalContent = readFileSync(mutation.filePath, 'utf-8')
      const mutatedContent = this.applyMutation(originalContent, mutation)

      // Write mutated file
      const backupPath = `${mutation.filePath}.mutation-backup`
      writeFileSync(backupPath, originalContent)
      writeFileSync(mutation.filePath, mutatedContent)

      // Run tests
      const testResult = await this.runTests()

      // Restore original file
      writeFileSync(mutation.filePath, originalContent)
      // Remove backup
      require('fs').unlinkSync(backupPath)

      const endTime = performance.now()
      const executionTime = endTime - startTime

      // Determine mutation result
      let status: MutationTestResult['status']
      if (testResult.timeout) {
        status = 'timeout'
      } else if (testResult.success) {
        status = 'survived' // Mutation didn't break tests (bad)
      } else {
        status = 'killed' // Mutation broke tests (good)
      }

      this.currentSession!.mutationStats.appliedMutations++
      if (status === 'killed') {
        this.currentSession!.mutationStats.killedMutations++
      } else if (status === 'survived') {
        this.currentSession!.mutationStats.survivedMutations++
      } else if (status === 'timeout') {
        this.currentSession!.mutationStats.timeoutMutations++
      }

      return {
        test: mutation,
        status,
        executionTime,
        testOutput: testResult.output,
        errorOutput: testResult.error
      }

    } catch (error) {
      // Restore original file in case of error
      try {
        const backupPath = `${mutation.filePath}.mutation-backup`
        if (existsSync(backupPath)) {
          const originalContent = readFileSync(backupPath, 'utf-8')
          writeFileSync(mutation.filePath, originalContent)
          require('fs').unlinkSync(backupPath)
        }
      } catch {
        // Best effort restoration
      }

      const endTime = performance.now()
      this.currentSession!.mutationStats.errorMutations++

      return {
        test: mutation,
        status: 'error',
        executionTime: endTime - startTime,
        errorOutput: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private applyMutation(content: string, mutation: MutationTest): string {
    const lines = content.split('\n')
    const line = lines[mutation.lineNumber - 1]

    if (!line) {
      throw new Error(`Line ${mutation.lineNumber} not found in file`)
    }

    // Replace the specific occurrence
    const before = line.substring(0, mutation.columnNumber)
    const after = line.substring(mutation.columnNumber + mutation.originalCode.length)
    const mutatedLine = before + mutation.mutatedCode + after

    lines[mutation.lineNumber - 1] = mutatedLine
    return lines.join('\n')
  }

  // ===================== TEST EXECUTION =====================

  private async runTests(): Promise<{
    success: boolean
    output: string
    error?: string
    timeout: boolean
  }> {
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', this.config.testCommand], {
        stdio: 'pipe'
      })

      let output = ''
      let error = ''
      let timedOut = false

      const timeout = setTimeout(() => {
        timedOut = true
        child.kill('SIGKILL')
      }, this.config.testTimeout)

      child.stdout?.on('data', (data) => {
        output += data.toString()
      })

      child.stderr?.on('data', (data) => {
        error += data.toString()
      })

      child.on('close', (code) => {
        clearTimeout(timeout)
        resolve({
          success: code === 0,
          output,
          error: error || undefined,
          timeout: timedOut
        })
      })

      child.on('error', (err) => {
        clearTimeout(timeout)
        resolve({
          success: false,
          output,
          error: err.message,
          timeout: timedOut
        })
      })
    })
  }

  // ===================== MUTATION OPERATORS =====================

  private initializeMutationOperators(): void {
    this.registerArithmeticOperators()
    this.registerRelationalOperators()
    this.registerLogicalOperators()
    this.registerLiteralOperators()
    this.registerConditionalOperators()
    this.registerMethodCallOperators()
  }

  private registerArithmeticOperators(): void {
    this.mutationOperators.set('arithmetic', {
      id: 'arithmetic',
      name: 'Arithmetic Operator Replacement',
      description: 'Replace arithmetic operators with different ones',
      category: 'arithmetic',
      weight: 0.8,
      applicability: ['.ts', '.tsx', '.js', '.jsx'],
      mutations: [
        {
          pattern: /\+(?!=)/g, // + but not +=
          replacement: '-',
          description: 'Addition to subtraction',
          risk: 'low'
        },
        {
          pattern: /-(?!=)/g, // - but not -=
          replacement: '+',
          description: 'Subtraction to addition',
          risk: 'low'
        },
        {
          pattern: /\*(?!=)/g, // * but not *=
          replacement: '/',
          description: 'Multiplication to division',
          risk: 'medium'
        },
        {
          pattern: /\/(?!=)/g, // / but not /=
          replacement: '*',
          description: 'Division to multiplication',
          risk: 'medium'
        },
        {
          pattern: /%(?!=)/g, // % but not %=
          replacement: '*',
          description: 'Modulo to multiplication',
          risk: 'low'
        }
      ]
    })
  }

  private registerRelationalOperators(): void {
    this.mutationOperators.set('relational', {
      id: 'relational',
      name: 'Relational Operator Replacement',
      description: 'Replace relational operators with different ones',
      category: 'relational',
      weight: 0.9,
      applicability: ['.ts', '.tsx', '.js', '.jsx'],
      mutations: [
        {
          pattern: /===/g,
          replacement: '!==',
          description: 'Strict equality to strict inequality',
          risk: 'low'
        },
        {
          pattern: /!==/g,
          replacement: '===',
          description: 'Strict inequality to strict equality',
          risk: 'low'
        },
        {
          pattern: /(?<!!)>(?!=)/g, // > but not >= or !=
          replacement: '<',
          description: 'Greater than to less than',
          risk: 'low'
        },
        {
          pattern: /(?<!!)<=(?!=)/g, // < but not <= or !=
          replacement: '>',
          description: 'Less than to greater than',
          risk: 'low'
        },
        {
          pattern: />=/g,
          replacement: '<',
          description: 'Greater than or equal to less than',
          risk: 'low'
        },
        {
          pattern: /<=/g,
          replacement: '>',
          description: 'Less than or equal to greater than',
          risk: 'low'
        }
      ]
    })
  }

  private registerLogicalOperators(): void {
    this.mutationOperators.set('logical', {
      id: 'logical',
      name: 'Logical Operator Replacement',
      description: 'Replace logical operators with different ones',
      category: 'logical',
      weight: 0.7,
      applicability: ['.ts', '.tsx', '.js', '.jsx'],
      mutations: [
        {
          pattern: /&&/g,
          replacement: '||',
          description: 'Logical AND to logical OR',
          risk: 'medium'
        },
        {
          pattern: /\|\|/g,
          replacement: '&&',
          description: 'Logical OR to logical AND',
          risk: 'medium'
        },
        {
          pattern: /!/g,
          replacement: '',
          description: 'Remove logical NOT',
          risk: 'medium',
          condition: (context) => {
            // Don't remove ! from !== or !=
            return !context.surroundingCode.includes('!==') && !context.surroundingCode.includes('!=')
          }
        }
      ]
    })
  }

  private registerLiteralOperators(): void {
    this.mutationOperators.set('literal', {
      id: 'literal',
      name: 'Literal Value Replacement',
      description: 'Replace literal values with different ones',
      category: 'literal',
      weight: 0.6,
      applicability: ['.ts', '.tsx', '.js', '.jsx'],
      mutations: [
        {
          pattern: /\btrue\b/g,
          replacement: 'false',
          description: 'True to false',
          risk: 'low'
        },
        {
          pattern: /\bfalse\b/g,
          replacement: 'true',
          description: 'False to true',
          risk: 'low'
        },
        {
          pattern: /\b0\b/g,
          replacement: '1',
          description: 'Zero to one',
          risk: 'low'
        },
        {
          pattern: /\b1\b/g,
          replacement: '0',
          description: 'One to zero',
          risk: 'low'
        },
        {
          pattern: /''/g,
          replacement: "'mutation'",
          description: 'Empty string to non-empty',
          risk: 'low'
        },
        {
          pattern: /""/g,
          replacement: '"mutation"',
          description: 'Empty string to non-empty',
          risk: 'low'
        }
      ]
    })
  }

  private registerConditionalOperators(): void {
    this.mutationOperators.set('conditional', {
      id: 'conditional',
      name: 'Conditional Statement Replacement',
      description: 'Modify conditional statements',
      category: 'conditional',
      weight: 0.5,
      applicability: ['.ts', '.tsx', '.js', '.jsx'],
      mutations: [
        {
          pattern: /\bif\s*\(/g,
          replacement: 'if (false || (',
          description: 'Make if condition always false',
          risk: 'high'
        },
        {
          pattern: /\bwhile\s*\(/g,
          replacement: 'while (false && (',
          description: 'Make while condition always false',
          risk: 'high'
        }
      ]
    })
  }

  private registerMethodCallOperators(): void {
    this.mutationOperators.set('method_call', {
      id: 'method_call',
      name: 'Method Call Replacement',
      description: 'Replace method calls with different ones',
      category: 'method_call',
      weight: 0.4,
      applicability: ['.ts', '.tsx', '.js', '.jsx'],
      mutations: [
        {
          pattern: /\.push\(/g,
          replacement: '.pop(',
          description: 'Array push to pop',
          risk: 'medium'
        },
        {
          pattern: /\.pop\(/g,
          replacement: '.push(',
          description: 'Array pop to push',
          risk: 'medium'
        },
        {
          pattern: /\.toUpperCase\(/g,
          replacement: '.toLowerCase(',
          description: 'toUpperCase to toLowerCase',
          risk: 'low'
        },
        {
          pattern: /\.toLowerCase\(/g,
          replacement: '.toUpperCase(',
          description: 'toLowerCase to toUpperCase',
          risk: 'low'
        }
      ]
    })
  }

  // ===================== ANALYSIS AND REPORTING =====================

  private calculateStatistics(): void {
    if (!this.currentSession) return

    const stats = this.currentSession.mutationStats
    const results = this.currentSession.results

    // Calculate mutation score
    const totalTestableMutations = stats.killedMutations + stats.survivedMutations
    stats.mutationScore = totalTestableMutations > 0 
      ? (stats.killedMutations / totalTestableMutations) * 100 
      : 0

    // Calculate operator effectiveness
    const operatorEffectiveness: Record<string, number> = {}
    for (const operator of this.mutationOperators.values()) {
      const operatorResults = results.filter(r => r.test.operator === operator.id)
      const killed = operatorResults.filter(r => r.status === 'killed').length
      const total = operatorResults.length
      operatorEffectiveness[operator.id] = total > 0 ? (killed / total) * 100 : 0
    }

    // Find worst performing files
    const filePerformance = new Map<string, { killed: number, total: number }>()
    for (const result of results) {
      const filePath = result.test.filePath
      const current = filePerformance.get(filePath) || { killed: 0, total: 0 }
      current.total++
      if (result.status === 'killed') {
        current.killed++
      }
      filePerformance.set(filePath, current)
    }

    const worstPerformingFiles = Array.from(filePerformance.entries())
      .map(([file, perf]) => ({
        file,
        score: perf.total > 0 ? (perf.killed / perf.total) * 100 : 0
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map(item => item.file)

    // Generate recommendations
    const recommendations = this.generateRecommendations(stats, operatorEffectiveness)

    this.currentSession.summary = {
      mutationScore: stats.mutationScore,
      coverage: 0, // Would need integration with coverage tools
      testEffectiveness: stats.mutationScore,
      recommendations,
      worstPerformingFiles,
      operatorEffectiveness
    }
  }

  private generateRecommendations(
    stats: MutationStats,
    operatorEffectiveness: Record<string, number>
  ): string[] {
    const recommendations: string[] = []

    // Mutation score recommendations
    if (stats.mutationScore < this.config.mutationScoreThreshold) {
      recommendations.push(
        `Mutation score ${stats.mutationScore.toFixed(2)}% is below threshold ${this.config.mutationScoreThreshold}%. ` +
        'Add more test cases to catch mutations.'
      )
    }

    // Survived mutations
    if (stats.survivedMutations > 0) {
      recommendations.push(
        `${stats.survivedMutations} mutations survived. ` +
        'These indicate gaps in test coverage or weak assertions.'
      )
    }

    // Timeout mutations
    if (stats.timeoutMutations > 0) {
      recommendations.push(
        `${stats.timeoutMutations} mutations caused timeouts. ` +
        'Consider optimizing test performance or increasing timeout.'
      )
    }

    // Operator effectiveness
    const ineffectiveOperators = Object.entries(operatorEffectiveness)
      .filter(([_, effectiveness]) => effectiveness < 50)
      .map(([operator]) => operator)

    if (ineffectiveOperators.length > 0) {
      recommendations.push(
        `Operators with low effectiveness: ${ineffectiveOperators.join(', ')}. ` +
        'Tests may not be sensitive to these types of mutations.'
      )
    }

    // High-risk mutations
    const highRiskResults = this.currentSession!.results
      .filter(r => r.test.risk === 'high' && r.status === 'survived')

    if (highRiskResults.length > 0) {
      recommendations.push(
        `${highRiskResults.length} high-risk mutations survived. ` +
        'These are critical gaps in test coverage.'
      )
    }

    return recommendations
  }

  private async generateReport(): Promise<void> {
    if (!this.currentSession) return

    const reportData = {
      session: this.currentSession,
      generatedAt: new Date().toISOString(),
      version: '1.0.0'
    }

    const reportPath = join(
      this.config.outputDirectory,
      `mutation-report-${this.currentSession.id}.${this.config.reportFormat}`
    )

    // Ensure output directory exists
    require('fs').mkdirSync(this.config.outputDirectory, { recursive: true })

    switch (this.config.reportFormat) {
      case 'json':
        writeFileSync(reportPath, JSON.stringify(reportData, null, 2))
        break
      case 'html':
        const htmlReport = this.generateHTMLReport(reportData)
        writeFileSync(reportPath, htmlReport)
        break
      case 'console':
        this.printConsoleReport(reportData)
        break
    }

    console.log(`📄 Report generated: ${reportPath}`)
  }

  private generateHTMLReport(reportData: any): string {
    const session = reportData.session
    const summary = session.summary

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Mutation Testing Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px 20px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #2196F3; }
        .metric-label { font-size: 0.9em; color: #666; }
        .section { margin: 30px 0; }
        .mutation-result { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
        .killed { border-left-color: #4CAF50; }
        .survived { border-left-color: #FF5722; }
        .timeout { border-left-color: #FF9800; }
        .error { border-left-color: #F44336; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Mutation Testing Report</h1>
    
    <div class="summary">
        <div class="metric">
            <div class="metric-value">${summary.mutationScore.toFixed(1)}%</div>
            <div class="metric-label">Mutation Score</div>
        </div>
        <div class="metric">
            <div class="metric-value">${session.mutationStats.killedMutations}</div>
            <div class="metric-label">Killed Mutations</div>
        </div>
        <div class="metric">
            <div class="metric-value">${session.mutationStats.survivedMutations}</div>
            <div class="metric-label">Survived Mutations</div>
        </div>
        <div class="metric">
            <div class="metric-value">${session.mutationStats.totalMutations}</div>
            <div class="metric-label">Total Mutations</div>
        </div>
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        <ul>
            ${summary.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
        </ul>
    </div>

    <div class="section">
        <h2>Operator Effectiveness</h2>
        <table>
            <tr><th>Operator</th><th>Effectiveness</th></tr>
            ${Object.entries(summary.operatorEffectiveness)
              .map(([op, eff]: [string, any]) => `<tr><td>${op}</td><td>${eff.toFixed(1)}%</td></tr>`)
              .join('')}
        </table>
    </div>

    <div class="section">
        <h2>Worst Performing Files</h2>
        <ul>
            ${summary.worstPerformingFiles.map((file: string) => `<li>${file}</li>`).join('')}
        </ul>
    </div>
</body>
</html>
    `
  }

  private printConsoleReport(reportData: any): void {
    const session = reportData.session
    const summary = session.summary

    console.log('\n🧬 MUTATION TESTING REPORT')
    console.log('=' .repeat(50))
    console.log(`📊 Mutation Score: ${summary.mutationScore.toFixed(2)}%`)
    console.log(`✅ Killed Mutations: ${session.mutationStats.killedMutations}`)
    console.log(`😰 Survived Mutations: ${session.mutationStats.survivedMutations}`)
    console.log(`⏰ Timeout Mutations: ${session.mutationStats.timeoutMutations}`)
    console.log(`❌ Error Mutations: ${session.mutationStats.errorMutations}`)
    console.log(`📝 Total Mutations: ${session.mutationStats.totalMutations}`)

    if (summary.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:')
      summary.recommendations.forEach((rec: string, i: number) => {
        console.log(`${i + 1}. ${rec}`)
      })
    }

    if (summary.worstPerformingFiles.length > 0) {
      console.log('\n🔍 WORST PERFORMING FILES:')
      summary.worstPerformingFiles.forEach((file: string) => {
        console.log(`   ${file}`)
      })
    }

    console.log('\n' + '='.repeat(50))
  }

  // ===================== UTILITY METHODS =====================

  private isOperatorApplicable(operator: MutationOperator, filePath: string): boolean {
    return operator.applicability.some(pattern => filePath.endsWith(pattern))
  }

  private getSurroundingCode(content: string, lineNumber: number): string {
    const lines = content.split('\n')
    const start = Math.max(0, lineNumber - 3)
    const end = Math.min(lines.length, lineNumber + 2)
    return lines.slice(start, end).join('\n')
  }

  private extractFunctionName(content: string, lineNumber: number): string | undefined {
    const lines = content.split('\n')
    
    // Look backwards for function declaration
    for (let i = lineNumber - 1; i >= 0; i--) {
      const line = lines[i]
      const functionMatch = line.match(/(?:function\s+(\w+)|(\w+)\s*(?:\([^)]*\))?\s*[=:]\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/);
      if (functionMatch) {
        return functionMatch[1] || functionMatch[2]
      }
    }
    
    return undefined
  }

  private extractClassName(content: string, lineNumber: number): string | undefined {
    const lines = content.split('\n')
    
    // Look backwards for class declaration
    for (let i = lineNumber - 1; i >= 0; i--) {
      const line = lines[i]
      const classMatch = line.match(/class\s+(\w+)/)
      if (classMatch) {
        return classMatch[1]
      }
    }
    
    return undefined
  }

  private generateSessionId(): string {
    return randomBytes(4).toString('hex')
  }

  private generateMutationId(): string {
    return randomBytes(6).toString('hex')
  }

  // ===================== PUBLIC API =====================

  getSessionResults(): MutationTestSession | null {
    return this.currentSession
  }

  isTestRunning(): boolean {
    return this.currentSession !== null && this.currentSession.endTime === 0
  }

  addCustomOperator(operator: MutationOperator): void {
    this.mutationOperators.set(operator.id, operator)
  }

  removeOperator(operatorId: string): void {
    this.mutationOperators.delete(operatorId)
  }
}

// ===================== FACTORY FUNCTIONS =====================

export function createMutationTesting(config?: Partial<MutationTestConfig>): MutationTestingEngine {
  return new MutationTestingEngine(config)
}

export function createQuickMutationTest(targetDir: string): MutationTestingEngine {
  return new MutationTestingEngine({
    targetDirectories: [targetDir],
    testCommand: 'npm test',
    concurrency: 2,
    mutationScoreThreshold: 70
  })
}

// ===================== PREDEFINED CONFIGURATIONS =====================

export const PredefinedMutationConfigs = {
  AgentTesting: {
    targetDirectories: ['src/mexc-agents'],
    testCommand: 'npm run test:unit',
    mutationScoreThreshold: 80,
    concurrency: 4,
    fileFilters: [{
      extensions: ['.ts'],
      exclude: [/\.test\.ts$/, /\.spec\.ts$/],
      minSize: 200
    }]
  },

  APITesting: {
    targetDirectories: ['src/lib', 'src/services'],
    testCommand: 'npm run test:integration',
    mutationScoreThreshold: 75,
    concurrency: 2,
    fileFilters: [{
      extensions: ['.ts'],
      exclude: [/\.test\.ts$/, /\.spec\.ts$/]
    }]
  },

  ComprehensiveTesting: {
    targetDirectories: ['src'],
    testCommand: 'npm run test:all',
    mutationScoreThreshold: 70,
    concurrency: 6,
    excludePatterns: [
      'node_modules',
      'dist',
      'build',
      '.next',
      'coverage',
      '*.test.*',
      '*.spec.*',
      '*.d.ts'
    ]
  }
}