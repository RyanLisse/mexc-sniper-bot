# TDD Implementation Templates

> **Implementation Coordinator Agent**  
> Swarm ID: `swarm-development-centralized-1750590624054`  
> Code templates and examples for junior developers

## File Structure Templates

### Test File Structure
```typescript
// src/[domain]/__tests__/[module].test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { [ModuleUnderTest] } from '../[module]'
import { createMock[Type] } from '../../../test-utils/mock-factories'

describe('[ModuleUnderTest]', () => {
  let moduleInstance: [ModuleUnderTest]
  
  beforeEach(() => {
    moduleInstance = new [ModuleUnderTest]()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('[method/feature name]', () => {
    it('should [expected behavior] when [conditions]', async () => {
      // Arrange
      const input = createMock[Type]()
      const expected = expectedResult
      
      // Act
      const result = await moduleInstance.method(input)
      
      // Assert
      expect(result).toEqual(expected)
    })

    it('should throw [ErrorType] when [invalid conditions]', async () => {
      // Arrange
      const invalidInput = createInvalidMock[Type]()
      
      // Act & Assert
      await expect(moduleInstance.method(invalidInput))
        .rejects.toThrow('[ExpectedErrorMessage]')
    })

    it('should handle edge case: [specific edge case]', async () => {
      // Arrange
      const edgeCaseInput = createEdgeCaseMock[Type]()
      
      // Act
      const result = await moduleInstance.method(edgeCaseInput)
      
      // Assert
      expect(result).toSatisfy(customMatcher)
    })
  })
})
```

### Implementation File Structure
```typescript
// src/[domain]/[module].ts
import { z } from 'zod'
import type { [RequiredTypes] } from '../types'

// Zod schemas for validation
const [Module]ConfigSchema = z.object({
  // Define schema properties
})

const [Module]InputSchema = z.object({
  // Define input validation
})

const [Module]OutputSchema = z.object({
  // Define output validation
})

export interface [Module]Config {
  // Type-safe configuration
}

export interface [Module]Dependencies {
  // Dependencies for dependency injection
}

export class [ModuleName] {
  private readonly config: [Module]Config

  constructor(
    config: [Module]Config,
    private readonly dependencies: [Module]Dependencies
  ) {
    // Validate configuration with Zod
    this.config = [Module]ConfigSchema.parse(config)
  }

  public async [primaryMethod](input: [InputType]): Promise<[OutputType]> {
    // Validate input
    const validatedInput = [Module]InputSchema.parse(input)
    
    try {
      // Implementation logic
      const result = await this.processInput(validatedInput)
      
      // Validate output
      return [Module]OutputSchema.parse(result)
    } catch (error) {
      throw this.handleError(error)
    }
  }

  private async processInput(input: [ValidatedInputType]): Promise<[RawOutputType]> {
    // Core business logic
  }

  private handleError(error: unknown): Error {
    // Centralized error handling
  }
}
```

## Mock Factory Templates

### Mock Factory Structure
```typescript
// src/test-utils/mock-factories.ts
import type { 
  MarketData, 
  PatternAnalysisResult, 
  TradingSignal,
  MexcApiResponse 
} from '../types'

export function createMockMarketData(overrides: Partial<MarketData> = {}): MarketData {
  return {
    symbol: 'BTCUSDT',
    timestamp: new Date('2025-01-01T00:00:00Z'),
    prices: [50000, 51000, 50500, 52000],
    volumes: [100, 120, 90, 150],
    openInterest: 1000000,
    ...overrides
  }
}

export function createMockPatternAnalysisResult(
  overrides: Partial<PatternAnalysisResult> = {}
): PatternAnalysisResult {
  return {
    confidence: 0.85,
    patternType: PatternType.BREAKOUT,
    metadata: {
      direction: 'UP',
      strength: 'HIGH',
      timeframe: '1h'
    },
    timestamp: new Date(),
    ...overrides
  }
}

export function createMockTradingSignal(
  overrides: Partial<TradingSignal> = {}
): TradingSignal {
  return {
    symbol: 'BTCUSDT',
    action: 'BUY',
    confidence: 0.9,
    entryPrice: 50000,
    stopLoss: 48000,
    takeProfit: 55000,
    timestamp: new Date(),
    reasoning: 'Strong breakout pattern detected',
    ...overrides
  }
}

// Helper for creating sequences of mock data
export function createMockPriceSequence(
  basePrice: number,
  count: number,
  volatility: number = 0.02
): number[] {
  const prices: number[] = [basePrice]
  
  for (let i = 1; i < count; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility
    const newPrice = prices[i - 1] * (1 + change)
    prices.push(Math.round(newPrice * 100) / 100)
  }
  
  return prices
}

// Helper for creating realistic market data sequences
export function createMockMarketDataSequence(
  baseConfig: Partial<MarketData> = {},
  count: number = 10
): MarketData[] {
  const sequence: MarketData[] = []
  const basePrice = baseConfig.prices?.[0] || 50000
  const baseVolume = baseConfig.volumes?.[0] || 100
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(Date.now() - (count - i) * 60000) // 1 minute intervals
    const prices = createMockPriceSequence(basePrice + i * 100, 4)
    const volumes = Array(4).fill(0).map(() => 
      baseVolume * (0.8 + Math.random() * 0.4) // ±20% variation
    )
    
    sequence.push(createMockMarketData({
      ...baseConfig,
      timestamp,
      prices,
      volumes
    }))
  }
  
  return sequence
}
```

## Performance Testing Templates

### Memory Leak Testing
```typescript
// src/test-utils/performance-helpers.ts
import { vi } from 'vitest'

export interface MemoryUsage {
  heapUsed: number
  heapTotal: number
  external: number
}

export class MemoryLeakDetector {
  private initialMemory: MemoryUsage
  private samples: MemoryUsage[] = []

  constructor() {
    this.initialMemory = this.getMemoryUsage()
  }

  public recordSample(): void {
    if (global.gc) {
      global.gc() // Force garbage collection if available
    }
    this.samples.push(this.getMemoryUsage())
  }

  public detectLeaks(threshold: number = 1024 * 1024): boolean {
    if (this.samples.length < 2) return false

    const finalMemory = this.samples[this.samples.length - 1]
    const memoryIncrease = finalMemory.heapUsed - this.initialMemory.heapUsed

    return memoryIncrease > threshold
  }

  public getMemoryReport(): string {
    const final = this.samples[this.samples.length - 1] || this.initialMemory
    const increase = final.heapUsed - this.initialMemory.heapUsed

    return `
Memory Report:
- Initial: ${this.formatBytes(this.initialMemory.heapUsed)}
- Final: ${this.formatBytes(final.heapUsed)}
- Increase: ${this.formatBytes(increase)}
- Samples: ${this.samples.length}
    `.trim()
  }

  private getMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage()
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// Usage in tests
export function expectNoMemoryLeaks(
  testFn: () => void | Promise<void>,
  threshold: number = 1024 * 1024 // 1MB
) {
  return async () => {
    const detector = new MemoryLeakDetector()
    
    detector.recordSample() // Before test
    await testFn()
    detector.recordSample() // After test
    
    if (detector.detectLeaks(threshold)) {
      throw new Error(`Memory leak detected:\n${detector.getMemoryReport()}`)
    }
  }
}
```

### Performance Benchmarking
```typescript
// src/test-utils/benchmark-helpers.ts
export class PerformanceBenchmark {
  private measurements: number[] = []

  public async measure<T>(
    operation: () => Promise<T>,
    iterations: number = 100
  ): Promise<{ result: T; avgTime: number; minTime: number; maxTime: number }> {
    let lastResult: T

    for (let i = 0; i < iterations; i++) {
      const start = performance.now()
      lastResult = await operation()
      const end = performance.now()
      
      this.measurements.push(end - start)
    }

    return {
      result: lastResult!,
      avgTime: this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length,
      minTime: Math.min(...this.measurements),
      maxTime: Math.max(...this.measurements)
    }
  }

  public expectPerformance(
    avgTimeMs: number,
    maxTimeMs: number
  ): void {
    const stats = this.getStats()
    
    if (stats.avgTime > avgTimeMs) {
      throw new Error(`Average time ${stats.avgTime}ms exceeds limit ${avgTimeMs}ms`)
    }
    
    if (stats.maxTime > maxTimeMs) {
      throw new Error(`Max time ${stats.maxTime}ms exceeds limit ${maxTimeMs}ms`)
    }
  }

  private getStats() {
    return {
      avgTime: this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length,
      minTime: Math.min(...this.measurements),
      maxTime: Math.max(...this.measurements)
    }
  }
}

// Usage in tests
describe('Performance Tests', () => {
  it('should complete pattern analysis within performance limits', async () => {
    const benchmark = new PerformanceBenchmark()
    const analyzer = new PatternAnalyzer()
    const marketData = createMockMarketData()

    const results = await benchmark.measure(
      () => analyzer.analyze(marketData),
      50 // 50 iterations
    )

    // Expect average under 100ms, max under 200ms
    benchmark.expectPerformance(100, 200)
  })
})
```

## Integration Testing Templates

### API Route Testing
```typescript
// app/api/__tests__/integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from 'http'
import { parse } from 'url'
import request from 'supertest'
import { handler } from '../route'

describe('API Integration Tests', () => {
  let server: ReturnType<typeof createServer>

  beforeAll(() => {
    server = createServer(async (req, res) => {
      const url = parse(req.url!, true)
      await handler(
        new Request(`http://localhost${req.url}`, {
          method: req.method,
          headers: req.headers as any,
          body: req.method === 'POST' ? req : undefined
        })
      ).then(response => {
        res.statusCode = response.status
        response.headers.forEach((value, key) => {
          res.setHeader(key, value)
        })
        return response.text()
      }).then(body => {
        res.end(body)
      })
    })
  })

  afterAll(() => {
    server.close()
  })

  it('should handle valid requests correctly', async () => {
    const response = await request(server)
      .post('/api/test')
      .send({ data: 'valid' })
      .expect(200)

    expect(response.body).toMatchObject({
      success: true,
      data: expect.any(Object)
    })
  })

  it('should handle validation errors appropriately', async () => {
    const response = await request(server)
      .post('/api/test')
      .send({ invalid: 'data' })
      .expect(400)

    expect(response.body).toMatchObject({
      success: false,
      error: expect.stringContaining('validation')
    })
  })
})
```

## Commit Message Templates

### Conventional Commits

```bash
# Feature addition
git commit -m "feat: add pattern detection analyzer

- Implement breakout pattern detection algorithm
- Add confidence scoring system with configurable thresholds
- Include comprehensive test suite with edge cases
- Add Zod validation for all inputs and outputs

Closes #123"

# Bug fix
git commit -m "fix: resolve memory leak in useAutoSnipingExecution hook

- Fix interval cleanup in useEffect dependencies
- Add proper cleanup functions for all async operations
- Include memory leak regression tests
- Optimize state management for better performance

Fixes #456"

# Breaking change
git commit -m "refactor: consolidate error handling utilities

- Merge error-utils.ts and error-type-utils.ts
- Standardize error classification and retry logic
- Add comprehensive type safety with Zod validation
- Remove duplicate code (40% reduction)

BREAKING CHANGE: Error utility imports changed from 'error-utils' to 'unified-error-handling'"

# Performance improvement
git commit -m "perf: optimize pattern detection algorithms

- Reduce algorithmic complexity from O(n²) to O(n log n)
- Implement memoization for repeated calculations
- Add lazy loading for expensive operations
- Include performance regression tests

Improves pattern detection speed by 60%"

# Documentation
git commit -m "docs: add comprehensive API documentation

- Add JSDoc comments for all public methods
- Include usage examples and best practices
- Create integration guide for new developers
- Add troubleshooting section for common issues"

# Test addition
git commit -m "test: add comprehensive test suite for MEXC service

- Add unit tests for all service methods
- Include integration tests with mocked API responses
- Add performance benchmarks for critical paths
- Achieve 95% test coverage for service layer"
```

## Code Review Templates

### PR Description Template
```markdown
## Summary
Brief description of the changes and their purpose.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing functionality to change)
- [ ] Refactoring (code change that neither fixes a bug nor adds a feature)
- [ ] Documentation update
- [ ] Performance improvement

## Vertical Slice Implemented
- [ ] Slice 1: Core Utilities Consolidation
- [ ] Slice 2: Pattern Detection Engine Decomposition
- [ ] Slice 3: MEXC Service Decomposition
- [ ] Slice 4: React Hook Optimization
- [ ] Slice 5: API Route Standardization
- [ ] Slice 6: Type Safety Enhancement

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Performance tests added/updated
- [ ] All tests pass locally
- [ ] Test coverage ≥ 90% for new code

## Code Quality
- [ ] No files exceed 500 lines
- [ ] No use of 'any' types
- [ ] All functions have proper TypeScript types
- [ ] Zod validation implemented where appropriate
- [ ] Error handling follows unified pattern

## Performance Impact
- [ ] No performance regressions identified
- [ ] Memory usage remains stable
- [ ] Bundle size impact acceptable
- [ ] API response times maintained

## Documentation
- [ ] Code is self-documenting with clear variable/function names
- [ ] Complex logic has explanatory comments
- [ ] Public APIs have JSDoc documentation
- [ ] README updated if necessary

## Deployment
- [ ] Changes are backwards compatible
- [ ] Database migrations included (if applicable)
- [ ] Environment variables documented (if new)
- [ ] Feature flags implemented (if necessary)

## Checklist
- [ ] I have followed the TDD workflow (test-first)
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have made corresponding changes to documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing unit tests pass locally
```

### Review Feedback Templates

#### Requesting Changes
```markdown
**Changes Requested**

1. **Type Safety Issue** (Line 45)
   ```typescript
   // ❌ Current
   function processData(data: any): any
   
   // ✅ Suggested
   function processData(data: MarketData): ProcessedData
   ```
   Please replace `any` types with proper interfaces.

2. **File Size Violation** (pattern-analyzer.ts)
   Current file is 847 lines. Please split into smaller modules:
   - `BreakoutAnalyzer` (breakout-specific logic)
   - `ReversalAnalyzer` (reversal-specific logic)
   - `PatternOrchestrator` (coordination logic)

3. **Missing Tests** (confidence-calculator.ts)
   No tests found for edge cases:
   - Empty data arrays
   - Invalid confidence scores
   - Null/undefined inputs

4. **Performance Concern** (Line 123-145)
   Nested loops creating O(n²) complexity. Consider optimization or add performance test to prevent regression.
```

#### Approving Changes
```markdown
**Approved with Comments**

Excellent work on this refactoring! The code quality improvements are substantial:

✅ **Strengths:**
- Clear separation of concerns
- Comprehensive test coverage (94%)
- Proper TypeScript usage throughout
- Good error handling patterns
- Performance improvements documented

💡 **Minor Suggestions:**
- Consider extracting the validation logic into a separate utility
- The JSDoc comment on line 67 could be more specific
- Might be worth adding a performance benchmark for the new algorithm

**Ready to merge** once CI passes. Great job following the TDD workflow!
```

---

*These templates provide a comprehensive foundation for implementing the refactoring roadmap with consistency, quality, and junior developer accessibility.*