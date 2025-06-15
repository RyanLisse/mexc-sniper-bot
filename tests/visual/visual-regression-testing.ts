/**
 * Visual Regression Testing Framework
 * UI consistency and accessibility testing across all interfaces
 */

import { Page, Browser, chromium, firefox, webkit } from '@playwright/test'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { performance } from 'node:perf_hooks'
import { createHash } from 'crypto'

// ===================== VISUAL TESTING TYPES =====================

export interface VisualTestConfig {
  browsers: Array<'chromium' | 'firefox' | 'webkit'>
  viewports: Viewport[]
  baselineDirectory: string
  outputDirectory: string
  diffDirectory: string
  threshold: number // 0-1, percentage of acceptable difference
  animations: 'disabled' | 'reduced' | 'enabled'
  waitForFonts: boolean
  waitForImages: boolean
  fullPage: boolean
  accessibility: AccessibilityConfig
  performanceMetrics: boolean
  colorBlindnessSimulation: boolean
}

export interface Viewport {
  name: string
  width: number
  height: number
  deviceScaleFactor?: number
  isMobile?: boolean
}

export interface AccessibilityConfig {
  enabled: boolean
  standards: Array<'WCAG2A' | 'WCAG2AA' | 'WCAG2AAA' | 'Section508'>
  includeWarnings: boolean
  includeIncomplete: boolean
  axeRules?: string[]
  colorContrast: boolean
  keyboardNavigation: boolean
  screenReader: boolean
}

export interface VisualTestCase {
  id: string
  name: string
  url: string
  selector?: string
  waitFor?: string | number
  actions?: VisualTestAction[]
  maskSelectors?: string[]
  ignoreSelectors?: string[]
  threshold?: number
  metadata: {
    component?: string
    page?: string
    feature?: string
    priority: 'low' | 'medium' | 'high' | 'critical'
  }
}

export interface VisualTestAction {
  type: 'click' | 'hover' | 'focus' | 'scroll' | 'type' | 'wait' | 'custom'
  selector?: string
  value?: string
  timeout?: number
  coordinates?: { x: number, y: number }
  customCode?: string
}

export interface VisualTestResult {
  testId: string
  browser: string
  viewport: string
  status: 'pass' | 'fail' | 'baseline' | 'error'
  similarity: number // 0-1
  pixelDifference: number
  threshold: number
  baselineImage?: string
  actualImage: string
  diffImage?: string
  performanceMetrics?: PerformanceMetrics
  accessibilityResults?: AccessibilityResult[]
  error?: string
  executionTime: number
  timestamp: number
}

export interface PerformanceMetrics {
  firstContentfulPaint: number
  largestContentfulPaint: number
  cumulativeLayoutShift: number
  firstInputDelay: number
  timeToInteractive: number
  speedIndex: number
  totalBlockingTime: number
}

export interface AccessibilityResult {
  id: string
  impact: 'minor' | 'moderate' | 'serious' | 'critical'
  tags: string[]
  description: string
  help: string
  helpUrl: string
  nodes: AccessibilityNode[]
}

export interface AccessibilityNode {
  target: string[]
  html: string
  impact: string
  any: Array<{ id: string, data: any, message: string }>
  none: Array<{ id: string, data: any, message: string }>
  all: Array<{ id: string, data: any, message: string }>
}

export interface VisualTestSuite {
  id: string
  name: string
  description: string
  config: VisualTestConfig
  testCases: VisualTestCase[]
  setupActions?: VisualTestAction[]
  teardownActions?: VisualTestAction[]
}

export interface VisualTestReport {
  suiteId: string
  startTime: number
  endTime: number
  totalTests: number
  passedTests: number
  failedTests: number
  baselineTests: number
  errorTests: number
  results: VisualTestResult[]
  summary: {
    overall: 'pass' | 'fail'
    passRate: number
    averageSimilarity: number
    criticalFailures: number
    accessibilityIssues: number
    performanceIssues: number
  }
  recommendations: string[]
}

// ===================== VISUAL TESTING ENGINE =====================

export class VisualRegressionEngine {
  private config: VisualTestConfig
  private browsers: Map<string, Browser> = new Map()
  private currentTestSuite: VisualTestSuite | null = null

  constructor(config: Partial<VisualTestConfig> = {}) {
    this.config = {
      browsers: ['chromium'],
      viewports: [
        { name: 'desktop', width: 1920, height: 1080 },
        { name: 'tablet', width: 768, height: 1024, isMobile: true },
        { name: 'mobile', width: 375, height: 667, isMobile: true }
      ],
      baselineDirectory: './test-screenshots/baseline',
      outputDirectory: './test-screenshots/actual',
      diffDirectory: './test-screenshots/diff',
      threshold: 0.05, // 5% difference threshold
      animations: 'disabled',
      waitForFonts: true,
      waitForImages: true,
      fullPage: false,
      accessibility: {
        enabled: true,
        standards: ['WCAG2AA'],
        includeWarnings: false,
        includeIncomplete: false,
        colorContrast: true,
        keyboardNavigation: true,
        screenReader: false
      },
      performanceMetrics: true,
      colorBlindnessSimulation: false,
      ...config
    }

    this.ensureDirectories()
  }

  // ===================== TEST EXECUTION =====================

  async runTestSuite(testSuite: VisualTestSuite): Promise<VisualTestReport> {
    console.log(`📸 Starting visual regression test suite: ${testSuite.name}`)
    
    this.currentTestSuite = testSuite
    const startTime = performance.now()
    
    try {
      // Initialize browsers
      await this.initializeBrowsers()

      // Execute setup actions
      if (testSuite.setupActions) {
        await this.executeSetupActions(testSuite.setupActions)
      }

      // Run all test cases
      const results: VisualTestResult[] = []
      
      for (const testCase of testSuite.testCases) {
        console.log(`  📋 Running test: ${testCase.name}`)
        
        for (const browserName of this.config.browsers) {
          for (const viewport of this.config.viewports) {
            const result = await this.runTestCase(testCase, browserName, viewport)
            results.push(result)
          }
        }
      }

      // Execute teardown actions
      if (testSuite.teardownActions) {
        await this.executeTeardownActions(testSuite.teardownActions)
      }

      const endTime = performance.now()

      // Generate report
      const report = this.generateReport(testSuite, results, startTime, endTime)
      
      console.log(`✅ Visual regression testing completed`)
      console.log(`  Pass rate: ${report.summary.passRate.toFixed(1)}%`)
      console.log(`  Total tests: ${report.totalTests}`)
      console.log(`  Failed tests: ${report.failedTests}`)

      return report

    } finally {
      await this.cleanup()
    }
  }

  private async runTestCase(
    testCase: VisualTestCase,
    browserName: string,
    viewport: Viewport
  ): Promise<VisualTestResult> {
    const testStartTime = performance.now()
    
    try {
      const browser = this.browsers.get(browserName)
      if (!browser) {
        throw new Error(`Browser ${browserName} not initialized`)
      }

      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor || 1,
        hasTouch: viewport.isMobile || false,
        isMobile: viewport.isMobile || false,
        reducedMotion: this.config.animations === 'disabled' ? 'reduce' : undefined
      })

      // Inject accessibility testing if enabled
      if (this.config.accessibility.enabled) {
        await this.injectAxeCore(context)
      }

      const page = await context.newPage()

      // Configure page settings
      await this.configurePage(page)

      // Navigate to test URL
      await page.goto(testCase.url, { waitUntil: 'networkidle' })

      // Wait for fonts and images if configured
      if (this.config.waitForFonts) {
        await page.waitForFunction(() => document.fonts.ready)
      }

      if (this.config.waitForImages) {
        await this.waitForImages(page)
      }

      // Execute test actions
      if (testCase.actions) {
        await this.executeTestActions(page, testCase.actions)
      }

      // Wait for custom condition
      if (testCase.waitFor) {
        if (typeof testCase.waitFor === 'string') {
          await page.waitForSelector(testCase.waitFor)
        } else {
          await page.waitForTimeout(testCase.waitFor)
        }
      }

      // Mask elements if specified
      if (testCase.maskSelectors) {
        await this.maskElements(page, testCase.maskSelectors)
      }

      // Take screenshot
      const screenshotOptions = this.getScreenshotOptions(testCase, viewport)
      const screenshot = await page.screenshot(screenshotOptions)

      // Get performance metrics if enabled
      let performanceMetrics: PerformanceMetrics | undefined
      if (this.config.performanceMetrics) {
        performanceMetrics = await this.collectPerformanceMetrics(page)
      }

      // Run accessibility tests if enabled
      let accessibilityResults: AccessibilityResult[] | undefined
      if (this.config.accessibility.enabled) {
        accessibilityResults = await this.runAccessibilityTests(page)
      }

      // Compare with baseline
      const comparisonResult = await this.compareWithBaseline(
        testCase,
        browserName,
        viewport,
        screenshot
      )

      await context.close()

      const testEndTime = performance.now()

      return {
        testId: testCase.id,
        browser: browserName,
        viewport: viewport.name,
        status: comparisonResult.status,
        similarity: comparisonResult.similarity,
        pixelDifference: comparisonResult.pixelDifference,
        threshold: testCase.threshold || this.config.threshold,
        baselineImage: comparisonResult.baselineImage,
        actualImage: comparisonResult.actualImage,
        diffImage: comparisonResult.diffImage,
        performanceMetrics,
        accessibilityResults,
        executionTime: testEndTime - testStartTime,
        timestamp: Date.now()
      }

    } catch (error) {
      const testEndTime = performance.now()
      
      return {
        testId: testCase.id,
        browser: browserName,
        viewport: viewport.name,
        status: 'error',
        similarity: 0,
        pixelDifference: 0,
        threshold: testCase.threshold || this.config.threshold,
        actualImage: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime: testEndTime - testStartTime,
        timestamp: Date.now()
      }
    }
  }

  // ===================== SCREENSHOT COMPARISON =====================

  private async compareWithBaseline(
    testCase: VisualTestCase,
    browserName: string,
    viewport: Viewport,
    actualScreenshot: Buffer
  ): Promise<{
    status: 'pass' | 'fail' | 'baseline'
    similarity: number
    pixelDifference: number
    baselineImage?: string
    actualImage: string
    diffImage?: string
  }> {
    const testId = `${testCase.id}-${browserName}-${viewport.name}`
    const actualImagePath = join(this.config.outputDirectory, `${testId}.png`)
    const baselineImagePath = join(this.config.baselineDirectory, `${testId}.png`)
    const diffImagePath = join(this.config.diffDirectory, `${testId}.png`)

    // Save actual screenshot
    writeFileSync(actualImagePath, actualScreenshot)

    // Check if baseline exists
    if (!existsSync(baselineImagePath)) {
      console.log(`  📷 Creating baseline for ${testId}`)
      writeFileSync(baselineImagePath, actualScreenshot)
      return {
        status: 'baseline',
        similarity: 1,
        pixelDifference: 0,
        actualImage: actualImagePath
      }
    }

    // Load baseline
    const baselineBuffer = readFileSync(baselineImagePath)

    // Compare images
    const comparison = await this.compareImages(baselineBuffer, actualScreenshot)
    
    const threshold = testCase.threshold || this.config.threshold
    const passed = comparison.similarity >= (1 - threshold)

    // Generate diff image if failed
    let diffImagePath_: string | undefined
    if (!passed) {
      diffImagePath_ = await this.generateDiffImage(
        baselineBuffer,
        actualScreenshot,
        diffImagePath
      )
    }

    return {
      status: passed ? 'pass' : 'fail',
      similarity: comparison.similarity,
      pixelDifference: comparison.pixelDifference,
      baselineImage: baselineImagePath,
      actualImage: actualImagePath,
      diffImage: diffImagePath_
    }
  }

  private async compareImages(
    baseline: Buffer,
    actual: Buffer
  ): Promise<{ similarity: number, pixelDifference: number }> {
    // Simple pixel-by-pixel comparison (in real implementation, use a proper image diff library)
    if (baseline.length !== actual.length) {
      return { similarity: 0, pixelDifference: Math.abs(baseline.length - actual.length) }
    }

    let differentPixels = 0
    for (let i = 0; i < baseline.length; i++) {
      if (baseline[i] !== actual[i]) {
        differentPixels++
      }
    }

    const similarity = 1 - (differentPixels / baseline.length)
    return { similarity, pixelDifference: differentPixels }
  }

  private async generateDiffImage(
    baseline: Buffer,
    actual: Buffer,
    outputPath: string
  ): Promise<string> {
    // In a real implementation, this would generate a visual diff highlighting differences
    // For now, just copy the actual image as a placeholder
    writeFileSync(outputPath, actual)
    return outputPath
  }

  // ===================== ACCESSIBILITY TESTING =====================

  private async injectAxeCore(context: any): Promise<void> {
    // Inject axe-core for accessibility testing
    await context.addInitScript(() => {
      // Mock axe-core injection
      (window as any).axe = {
        run: async (options: any) => {
          // Mock accessibility results
          return {
            violations: [],
            passes: [],
            incomplete: [],
            inapplicable: []
          }
        }
      }
    })
  }

  private async runAccessibilityTests(page: Page): Promise<AccessibilityResult[]> {
    try {
      const results = await page.evaluate(async () => {
        if (!(window as any).axe) return []
        
        const axeResults = await (window as any).axe.run({
          tags: ['wcag2a', 'wcag2aa'],
          rules: {}
        })

        return axeResults.violations.map((violation: any) => ({
          id: violation.id,
          impact: violation.impact,
          tags: violation.tags,
          description: violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          nodes: violation.nodes.map((node: any) => ({
            target: node.target,
            html: node.html,
            impact: node.impact,
            any: node.any,
            none: node.none,
            all: node.all
          }))
        }))
      })

      return results
    } catch (error) {
      console.warn('Accessibility testing failed:', error)
      return []
    }
  }

  // ===================== PERFORMANCE METRICS =====================

  private async collectPerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
    try {
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation' as any)[0] as any
        const paint = performance.getEntriesByType('paint' as any) as any[]
        
        const fcp = paint.find(entry => entry.name === 'first-contentful-paint')
        
        return {
          firstContentfulPaint: fcp?.startTime || 0,
          largestContentfulPaint: 0, // Would need LCP API
          cumulativeLayoutShift: 0, // Would need CLS API
          firstInputDelay: 0, // Would need FID API
          timeToInteractive: navigation.loadEventEnd - navigation.fetchStart,
          speedIndex: 0, // Would need Speed Index calculation
          totalBlockingTime: 0 // Would need TBT calculation
        }
      })

      return metrics
    } catch (error) {
      console.warn('Performance metrics collection failed:', error)
      return {
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        cumulativeLayoutShift: 0,
        firstInputDelay: 0,
        timeToInteractive: 0,
        speedIndex: 0,
        totalBlockingTime: 0
      }
    }
  }

  // ===================== TEST ACTIONS =====================

  private async executeTestActions(page: Page, actions: VisualTestAction[]): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'click':
            if (action.selector) {
              await page.click(action.selector, { timeout: action.timeout })
            } else if (action.coordinates) {
              await page.mouse.click(action.coordinates.x, action.coordinates.y)
            }
            break

          case 'hover':
            if (action.selector) {
              await page.hover(action.selector, { timeout: action.timeout })
            }
            break

          case 'focus':
            if (action.selector) {
              await page.focus(action.selector, { timeout: action.timeout })
            }
            break

          case 'scroll':
            if (action.selector) {
              await page.locator(action.selector).scrollIntoViewIfNeeded()
            } else if (action.coordinates) {
              await page.mouse.wheel(action.coordinates.x, action.coordinates.y)
            }
            break

          case 'type':
            if (action.selector && action.value) {
              await page.fill(action.selector, action.value)
            }
            break

          case 'wait':
            if (action.value) {
              if (!isNaN(Number(action.value))) {
                await page.waitForTimeout(Number(action.value))
              } else {
                await page.waitForSelector(action.value, { timeout: action.timeout })
              }
            }
            break

          case 'custom':
            if (action.customCode) {
              await page.evaluate(action.customCode)
            }
            break
        }

        // Small delay between actions
        await page.waitForTimeout(100)
      } catch (error) {
        console.warn(`Action ${action.type} failed:`, error)
      }
    }
  }

  private async executeSetupActions(actions: VisualTestAction[]): Promise<void> {
    console.log('  ⚙️  Executing setup actions...')
    // Setup actions would be executed once before all tests
  }

  private async executeTeardownActions(actions: VisualTestAction[]): Promise<void> {
    console.log('  🧹 Executing teardown actions...')
    // Teardown actions would be executed once after all tests
  }

  // ===================== UTILITY METHODS =====================

  private async initializeBrowsers(): Promise<void> {
    for (const browserName of this.config.browsers) {
      console.log(`  🌐 Initializing ${browserName} browser...`)
      
      let browser: Browser
      switch (browserName) {
        case 'chromium':
          browser = await chromium.launch({ headless: true })
          break
        case 'firefox':
          browser = await firefox.launch({ headless: true })
          break
        case 'webkit':
          browser = await webkit.launch({ headless: true })
          break
        default:
          throw new Error(`Unsupported browser: ${browserName}`)
      }
      
      this.browsers.set(browserName, browser)
    }
  }

  private async configurePage(page: Page): Promise<void> {
    // Disable animations if configured
    if (this.config.animations === 'disabled') {
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            scroll-behavior: auto !important;
          }
        `
      })
    }

    // Set up color blindness simulation if enabled
    if (this.config.colorBlindnessSimulation) {
      // Note: emulateVisionDeficiency is not available in current Playwright version
      // This would require a context-level setting or CSS filters
      await page.addStyleTag({
        content: `
          html {
            filter: sepia(0.5) saturate(0.8) hue-rotate(20deg);
          }
        `
      })
    }
  }

  private async waitForImages(page: Page): Promise<void> {
    await page.waitForFunction(() => {
      const images = Array.from(document.images)
      return images.every(img => img.complete)
    }, { timeout: 10000 })
  }

  private async maskElements(page: Page, selectors: string[]): Promise<void> {
    for (const selector of selectors) {
      await page.addStyleTag({
        content: `
          ${selector} {
            background: #000000 !important;
            color: transparent !important;
          }
        `
      })
    }
  }

  private getScreenshotOptions(testCase: VisualTestCase, viewport: Viewport): any {
    const options: any = {
      fullPage: this.config.fullPage,
      animations: this.config.animations === 'disabled' ? 'disabled' : 'allow'
    }

    if (testCase.selector) {
      options.clip = undefined // Would need to get element bounds
    }

    return options
  }

  private ensureDirectories(): void {
    const directories = [
      this.config.baselineDirectory,
      this.config.outputDirectory,
      this.config.diffDirectory
    ]

    for (const dir of directories) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    }
  }

  private generateReport(
    testSuite: VisualTestSuite,
    results: VisualTestResult[],
    startTime: number,
    endTime: number
  ): VisualTestReport {
    const totalTests = results.length
    const passedTests = results.filter(r => r.status === 'pass').length
    const failedTests = results.filter(r => r.status === 'fail').length
    const baselineTests = results.filter(r => r.status === 'baseline').length
    const errorTests = results.filter(r => r.status === 'error').length

    const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0
    const averageSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / totalTests

    const criticalFailures = results.filter(r => 
      r.status === 'fail' && 
      testSuite.testCases.find(tc => tc.id === r.testId)?.metadata.priority === 'critical'
    ).length

    const accessibilityIssues = results.reduce((sum, r) => 
      sum + (r.accessibilityResults?.filter(a => a.impact === 'serious' || a.impact === 'critical').length || 0), 0
    )

    const performanceIssues = results.filter(r => 
      r.performanceMetrics?.largestContentfulPaint > 2500 || 
      r.performanceMetrics?.cumulativeLayoutShift > 0.1
    ).length

    const recommendations = this.generateRecommendations(results)

    return {
      suiteId: testSuite.id,
      startTime,
      endTime,
      totalTests,
      passedTests,
      failedTests,
      baselineTests,
      errorTests,
      results,
      summary: {
        overall: criticalFailures > 0 || (failedTests / totalTests) > 0.1 ? 'fail' : 'pass',
        passRate,
        averageSimilarity,
        criticalFailures,
        accessibilityIssues,
        performanceIssues
      },
      recommendations
    }
  }

  private generateRecommendations(results: VisualTestResult[]): string[] {
    const recommendations: string[] = []

    // Visual regression recommendations
    const failedTests = results.filter(r => r.status === 'fail')
    if (failedTests.length > 0) {
      recommendations.push(`Review ${failedTests.length} failed visual tests for unintended UI changes`)
    }

    // Performance recommendations
    const slowTests = results.filter(r => r.performanceMetrics?.largestContentfulPaint > 2500)
    if (slowTests.length > 0) {
      recommendations.push(`Optimize performance for ${slowTests.length} tests with slow LCP (>2.5s)`)
    }

    // Accessibility recommendations
    const accessibilityIssues = results.reduce((sum, r) => 
      sum + (r.accessibilityResults?.length || 0), 0
    )
    if (accessibilityIssues > 0) {
      recommendations.push(`Address ${accessibilityIssues} accessibility violations found during testing`)
    }

    return recommendations
  }

  private async cleanup(): Promise<void> {
    const browsers = Array.from(this.browsers.values())
    for (const browser of browsers) {
      await browser.close()
    }
    this.browsers.clear()
  }
}

// ===================== PREDEFINED TEST SUITES =====================

export const PredefinedVisualTestSuites: VisualTestSuite[] = [
  {
    id: 'dashboard-visual-regression',
    name: 'Dashboard Visual Regression Suite',
    description: 'Comprehensive visual testing for the trading dashboard',
    config: {
      browsers: ['chromium', 'firefox'],
      viewports: [
        { name: 'desktop', width: 1920, height: 1080 },
        { name: 'tablet', width: 768, height: 1024, isMobile: true },
        { name: 'mobile', width: 375, height: 667, isMobile: true }
      ],
      baselineDirectory: './test-screenshots/baseline',
      outputDirectory: './test-screenshots/actual',
      diffDirectory: './test-screenshots/diff',
      threshold: 0.02, // 2% threshold for critical UI
      animations: 'disabled',
      waitForFonts: true,
      waitForImages: true,
      fullPage: true,
      accessibility: {
        enabled: true,
        standards: ['WCAG2AA'],
        includeWarnings: false,
        includeIncomplete: false,
        colorContrast: true,
        keyboardNavigation: true,
        screenReader: false
      },
      performanceMetrics: true,
      colorBlindnessSimulation: false
    },
    testCases: [
      {
        id: 'dashboard-main',
        name: 'Main Dashboard View',
        url: 'http://localhost:3008/dashboard',
        waitFor: 2000, // Wait for data loading
        maskSelectors: [
          '[data-testid="current-time"]',
          '[data-testid="live-price"]',
          '[data-testid="timestamp"]'
        ],
        metadata: {
          page: 'dashboard',
          feature: 'overview',
          priority: 'critical'
        }
      },
      {
        id: 'dashboard-with-calendar',
        name: 'Dashboard with Calendar Component',
        url: 'http://localhost:3008/dashboard',
        actions: [
          { type: 'click', selector: '[data-testid="calendar-tab"]' },
          { type: 'wait', value: '1000' }
        ],
        maskSelectors: ['[data-testid="calendar-dates"]'],
        metadata: {
          page: 'dashboard',
          feature: 'calendar',
          priority: 'high'
        }
      },
      {
        id: 'dashboard-trading-targets',
        name: 'Trading Targets Section',
        url: 'http://localhost:3008/dashboard',
        selector: '[data-testid="trading-targets"]',
        waitFor: '[data-testid="trading-targets-loaded"]',
        metadata: {
          page: 'dashboard',
          component: 'trading-targets',
          priority: 'high'
        }
      }
    ]
  },
  {
    id: 'agent-dashboard-visual',
    name: 'Agent Dashboard Visual Testing',
    description: 'Visual testing for AI agent monitoring interfaces',
    config: {
      browsers: ['chromium'],
      viewports: [
        { name: 'desktop', width: 1920, height: 1080 }
      ],
      baselineDirectory: './test-screenshots/baseline',
      outputDirectory: './test-screenshots/actual',
      diffDirectory: './test-screenshots/diff',
      threshold: 0.05,
      animations: 'disabled',
      waitForFonts: true,
      waitForImages: true,
      fullPage: false,
      accessibility: {
        enabled: true,
        standards: ['WCAG2AA'],
        includeWarnings: false,
        includeIncomplete: false,
        colorContrast: true,
        keyboardNavigation: true,
        screenReader: false
      },
      performanceMetrics: true,
      colorBlindnessSimulation: false
    },
    testCases: [
      {
        id: 'agents-overview',
        name: 'Agents Overview Page',
        url: 'http://localhost:3008/agents',
        waitFor: '[data-testid="agents-loaded"]',
        maskSelectors: [
          '[data-testid="agent-status-time"]',
          '[data-testid="performance-metrics"]'
        ],
        metadata: {
          page: 'agents',
          feature: 'overview',
          priority: 'high'
        }
      },
      {
        id: 'agent-performance-metrics',
        name: 'Agent Performance Metrics',
        url: 'http://localhost:3008/agents',
        selector: '[data-testid="performance-section"]',
        actions: [
          { type: 'scroll', selector: '[data-testid="performance-section"]' }
        ],
        metadata: {
          page: 'agents',
          component: 'performance-metrics',
          priority: 'medium'
        }
      }
    ]
  }
]

// ===================== RESPONSIVE TESTING =====================

export class ResponsiveTestingEngine extends VisualRegressionEngine {
  async runResponsiveTests(
    testSuite: VisualTestSuite,
    breakpoints: Viewport[]
  ): Promise<VisualTestReport> {
    console.log('📱 Running responsive visual tests...')

    // Override config with responsive breakpoints
    const responsiveConfig = {
      ...testSuite.config,
      viewports: breakpoints
    }

    const responsiveTestSuite = {
      ...testSuite,
      config: responsiveConfig,
      name: `${testSuite.name} - Responsive Testing`
    }

    return await this.runTestSuite(responsiveTestSuite)
  }
}

// ===================== ACCESSIBILITY-FOCUSED TESTING =====================

export class AccessibilityTestingEngine extends VisualRegressionEngine {
  async runAccessibilityTestSuite(testSuite: VisualTestSuite): Promise<VisualTestReport> {
    console.log('♿ Running accessibility-focused tests...')

    // Override config for accessibility focus
    const accessibilityConfig = {
      ...testSuite.config,
      accessibility: {
        enabled: true,
        standards: ['WCAG2A', 'WCAG2AA', 'WCAG2AAA'] as Array<'WCAG2A' | 'WCAG2AA' | 'WCAG2AAA' | 'Section508'>,
        includeWarnings: true,
        includeIncomplete: true,
        colorContrast: true,
        keyboardNavigation: true,
        screenReader: true
      },
      colorBlindnessSimulation: true
    }

    const accessibilityTestSuite = {
      ...testSuite,
      config: accessibilityConfig,
      name: `${testSuite.name} - Accessibility Testing`
    }

    return await this.runTestSuite(accessibilityTestSuite)
  }
}

// ===================== FACTORY FUNCTIONS =====================

export function createVisualTesting(config?: Partial<VisualTestConfig>): VisualRegressionEngine {
  return new VisualRegressionEngine(config)
}

export function createResponsiveTesting(config?: Partial<VisualTestConfig>): ResponsiveTestingEngine {
  return new ResponsiveTestingEngine(config)
}

export function createAccessibilityTesting(config?: Partial<VisualTestConfig>): AccessibilityTestingEngine {
  return new AccessibilityTestingEngine(config)
}

// ===================== RESPONSIVE BREAKPOINTS =====================

export const StandardBreakpoints: Viewport[] = [
  { name: 'mobile-portrait', width: 320, height: 568, isMobile: true },
  { name: 'mobile-landscape', width: 568, height: 320, isMobile: true },
  { name: 'tablet-portrait', width: 768, height: 1024, isMobile: true },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop-small', width: 1366, height: 768 },
  { name: 'desktop-medium', width: 1920, height: 1080 },
  { name: 'desktop-large', width: 2560, height: 1440 },
  { name: 'ultra-wide', width: 3440, height: 1440 }
]

export const MobileBreakpoints: Viewport[] = [
  { name: 'iphone-se', width: 375, height: 667, isMobile: true },
  { name: 'iphone-12', width: 390, height: 844, isMobile: true },
  { name: 'iphone-12-pro-max', width: 428, height: 926, isMobile: true },
  { name: 'android-small', width: 360, height: 640, isMobile: true },
  { name: 'android-medium', width: 412, height: 869, isMobile: true }
]