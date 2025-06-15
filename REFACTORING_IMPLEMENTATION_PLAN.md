# MEXC Sniper Bot - Refactoring Implementation Plan

## 📋 Executive Summary

### Current State Assessment
- **System Architecture**: Sophisticated 11-agent AI trading system with 98.2% test pass rate
- **Technology Stack**: Next.js 15, React 19, TypeScript, TursoDB, Inngest workflows
- **Core Functionality**: Pattern discovery system with 3.5+ hour advance detection capability
- **Key Metrics**: 1,075-line schema, 20+ API routes, 115 dependencies, 171 tests

### Optimization Goals
- **Maintainability**: Modularize monolithic components and eliminate technical debt
- **Performance**: Reduce bundle size by 30%, improve query performance by 50%
- **Code Quality**: Remove dead code, standardize patterns, consolidate redundant systems
- **Scalability**: Enhance agent coordination and real-time capabilities

### Success Criteria
- ✅ Maintain 100% test pass rate throughout refactoring
- ✅ Preserve pattern discovery system's 3.5+ hour advance detection
- ✅ Zero downtime during implementation phases
- ✅ Improve developer experience and system maintainability

---

## 🎯 Prioritized Implementation Roadmap

### 🚨 **CRITICAL PRIORITY** (Weeks 1-2) - Foundation Phase
**Estimated Effort**: 40 hours | **Risk Level**: Low | **Impact**: High

#### Week 1: Database & Code Cleanup
- [ ] **Task 1.1**: Database schema modularization (16h)
- [ ] **Task 1.2**: Dead code cleanup and file organization (8h)
- [ ] **Task 1.3**: Dependency audit and optimization (8h)

#### Week 2: API Standardization
- [ ] **Task 2.1**: API route middleware implementation (12h)
- [ ] **Task 2.2**: Response format standardization (4h)

### 🔥 **HIGH PRIORITY** (Weeks 3-6) - Core Systems Phase
**Estimated Effort**: 80 hours | **Risk Level**: Medium | **Impact**: High

#### Weeks 3-4: Agent System Optimization
- [ ] **Task 3.1**: Agent coordination centralization (20h)
- [ ] **Task 3.2**: Agent health monitoring implementation (12h)
- [ ] **Task 3.3**: MEXC API client unification (16h)

#### Weeks 5-6: Testing & Pattern Systems
- [ ] **Task 4.1**: Testing framework consolidation (16h)
- [ ] **Task 4.2**: Pattern discovery centralization (16h)

### 🎯 **MEDIUM PRIORITY** (Weeks 7-12) - Enhancement Phase
**Estimated Effort**: 120 hours | **Risk Level**: Medium | **Impact**: Medium

#### Weeks 7-9: Performance Optimization
- [ ] **Task 5.1**: Bundle size optimization (24h)
- [ ] **Task 5.2**: Database query optimization (16h)
- [ ] **Task 5.3**: Caching strategy implementation (16h)

#### Weeks 10-12: Real-time Integration
- [ ] **Task 6.1**: WebSocket implementation (32h)
- [ ] **Task 6.2**: Safety system integration (32h)

### 📚 **LOW PRIORITY** (Weeks 13-24) - Advanced Features Phase
**Estimated Effort**: 160 hours | **Risk Level**: Low | **Impact**: Medium

#### Weeks 13-18: Monitoring & Observability
- [ ] **Task 7.1**: Advanced monitoring dashboard (40h)
- [ ] **Task 7.2**: Automated alerting system (24h)

#### Weeks 19-24: Automation & Optimization
- [ ] **Task 8.1**: Self-tuning parameters (48h)
- [ ] **Task 8.2**: Advanced testing infrastructure (48h)

---

## 📝 Detailed Action Items

### **Task 1.1: Database Schema Modularization** (16h)

#### Prerequisites
- [ ] Backup current database schema
- [ ] Create feature branch: `refactor/schema-modularization`
- [ ] Ensure all tests pass before starting

#### Implementation Steps

**Step 1: Create modular schema structure (4h)**
```bash
mkdir -p src/db/schemas
touch src/db/schemas/{auth,trading,safety,patterns,workflows}.ts
touch src/db/schemas/index.ts
```

**Step 2: Extract auth-related tables (3h)**
```typescript
// src/db/schemas/auth.ts
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // ... move user, session, account, verification tables
});
```

**Step 3: Extract trading tables (3h)**
```typescript
// src/db/schemas/trading.ts
export const snipeTargets = sqliteTable("snipe_targets", {
  // ... move snipeTargets, executionHistory, transactions tables
});
```

**Step 4: Extract safety and pattern tables (3h)**
```typescript
// src/db/schemas/safety.ts
// src/db/schemas/patterns.ts
// src/db/schemas/workflows.ts
```

**Step 5: Create barrel exports and update imports (3h)**
```typescript
// src/db/schemas/index.ts
export * from './auth';
export * from './trading';
export * from './safety';
export * from './patterns';
export * from './workflows';
```

#### Validation Steps
- [ ] Run `make test` - all tests must pass
- [ ] Verify database migrations work correctly
- [ ] Check TypeScript compilation with `make type-check`
- [ ] Validate all imports resolve correctly

#### Success Criteria
- ✅ Schema split into 5 logical modules
- ✅ All existing functionality preserved
- ✅ 100% test pass rate maintained
- ✅ TypeScript compilation successful

---

### **Task 1.2: Dead Code Cleanup** (8h)

#### Implementation Steps

**Step 1: Remove test database files (1h)**
```bash
# Clean up test databases
find data/ -name "test_test_*.db" -delete
find data/ -name "*.db-shm" -delete
find data/ -name "*.db-wal" -delete
```

**Step 2: Remove deprecated functions (2h)**
```typescript
// Remove from src/lib/api-response.ts (lines 54-64)
// Delete deprecated handleApiError function
```

**Step 3: Clean up orphaned files (1h)**
```bash
rm -f *.png *.log tsconfig.tsbuildinfo
rm -f auth-user-dashboard-issue.png config-security-issue.png
rm -f dashboard-security-issue.png debug-*.png homepage-verification.png
```

**Step 4: Consolidate redundant test files (4h)**
```bash
# Remove redundant E2E tests
rm tests/e2e/auth-integration-simple.spec.ts
rm tests/e2e/simplified-auth-flow.spec.ts
rm tests/e2e/dashboard.spec.ts
rm tests/e2e/new-dashboard-test.spec.ts
# Keep: auth-protection-flow.spec.ts, dashboard-with-calendar.spec.ts
```

#### Success Criteria
- ✅ 40+ test database files removed
- ✅ Deprecated code eliminated
- ✅ Redundant test files consolidated
- ✅ All remaining tests pass

---

### **Task 1.3: Dependency Audit** (8h)

#### Implementation Steps

**Step 1: Analyze current dependencies (2h)**
```bash
npm ls --depth=0
npm audit
npx depcheck
```

**Step 2: Remove unused dependencies (3h)**
```bash
# Example removals (to be confirmed by analysis)
npm uninstall @types/unused-package
npm uninstall legacy-better-auth-packages
```

**Step 3: Consolidate similar packages (2h)**
```bash
# Consolidate date libraries, UI components, etc.
# Update imports throughout codebase
```

**Step 4: Update package.json and verify (1h)**
```bash
npm dedupe
npm audit fix
make test
```

#### Success Criteria
- ✅ Dependencies reduced from 115 to <90
- ✅ No unused packages remain
- ✅ All functionality preserved
- ✅ Security vulnerabilities addressed

---

## 🔧 Technical Specifications

### Database Schema Modularization Structure

```
src/db/
├── schemas/
│   ├── auth.ts              # User, session, account, verification
│   ├── trading.ts           # snipeTargets, executionHistory, transactions
│   ├── safety.ts            # simulationSessions, riskEvents, positionSnapshots
│   ├── patterns.ts          # patternEmbeddings, patternSimilarityCache
│   ├── workflows.ts         # workflowSystemStatus, workflowActivity
│   └── index.ts             # Barrel exports
├── migrations/              # Database migration files
├── index.ts                 # Main database connection
└── types.ts                 # Shared database types
```

### API Route Standardization Pattern

```typescript
// src/lib/api-middleware.ts
export const withMexcAuth = (handler: ApiHandler) => {
  return async (req: NextRequest) => {
    try {
      // 1. Authentication validation
      // 2. Rate limiting
      // 3. Input sanitization
      // 4. Error handling wrapper
      // 5. Response formatting
      const result = await handler(req);
      return apiResponse(createSuccessResponse(result));
    } catch (error) {
      return apiResponse(createErrorResponse(error.message), 500);
    }
  };
};
```

### Agent System Optimization Approach

```typescript
// src/mexc-agents/orchestrator-enhanced.ts
export class EnhancedMexcOrchestrator {
  private agentHealthMonitor: AgentHealthMonitor;
  private performanceMetrics: PerformanceCollector;
  private coordinationHub: AgentCoordinationHub;

  async executeWorkflow(workflowType: WorkflowType): Promise<WorkflowResult> {
    // 1. Health check all required agents
    // 2. Coordinate agent execution
    // 3. Monitor performance metrics
    // 4. Handle failures and retries
    // 5. Aggregate results
  }
}
```

---

## ⚠️ Risk Assessment & Mitigation

### **High Risk Areas**

#### 1. Database Schema Changes
**Risk**: Breaking existing queries and relationships
**Mitigation**:
- Comprehensive backup before changes
- Incremental migration with rollback plan
- Extensive testing at each step

#### 2. Agent System Modifications
**Risk**: Disrupting pattern discovery functionality
**Mitigation**:
- Feature flags for new coordination logic
- Parallel testing with existing system
- Gradual rollout with monitoring

#### 3. API Route Changes
**Risk**: Breaking frontend integrations
**Mitigation**:
- Backward compatibility maintenance
- API versioning strategy
- Comprehensive integration testing

### **Medium Risk Areas**

#### 1. Dependency Updates
**Risk**: Version conflicts and breaking changes
**Mitigation**:
- Staged dependency updates
- Comprehensive testing after each update
- Lock file management

#### 2. Testing Framework Changes
**Risk**: Loss of test coverage
**Mitigation**:
- Maintain parallel testing during transition
- Coverage monitoring and validation
- Gradual migration approach

---

## 📊 Progress Tracking

### **Phase 1: Foundation (Weeks 1-2)**
- [ ] Database schema modularization complete
- [ ] Dead code cleanup finished
- [ ] Dependency optimization done
- [ ] API standardization implemented
- [ ] **Milestone**: All tests passing, no functionality lost

### **Phase 2: Core Systems (Weeks 3-6)**
- [ ] Agent system optimization complete
- [ ] Testing consolidation finished
- [ ] MEXC API unification done
- [ ] Pattern discovery centralized
- [ ] **Milestone**: Enhanced system performance and maintainability

### **Phase 3: Enhancement (Weeks 7-12)**
- [ ] Performance optimization complete
- [ ] Real-time integration implemented
- [ ] Safety system integrated
- [ ] **Milestone**: 30% performance improvement achieved

### **Phase 4: Advanced Features (Weeks 13-24)**
- [ ] Advanced monitoring deployed
- [ ] Automation features implemented
- [ ] **Milestone**: Full system optimization complete

---

## 💼 Resource Requirements

### **Development Resources**
- **Senior Developer**: 200 hours (Phases 1-2)
- **Mid-level Developer**: 160 hours (Phases 3-4)
- **DevOps Engineer**: 40 hours (Monitoring setup)

### **Infrastructure Requirements**
- **Development Environment**: Enhanced with monitoring tools
- **Testing Environment**: Parallel testing infrastructure
- **Staging Environment**: Full production replica for validation

### **Timeline Summary**
- **Total Duration**: 24 weeks
- **Critical Path**: 6 weeks (Phases 1-2)
- **Parallel Work**: Testing and documentation
- **Buffer Time**: 20% added for unexpected issues

---

## ✅ Final Validation Checklist

### **Pre-Implementation**
- [ ] All stakeholders aligned on plan
- [ ] Development environment prepared
- [ ] Backup and rollback procedures tested
- [ ] Feature branch strategy established

### **During Implementation**
- [ ] Daily progress tracking
- [ ] Continuous testing validation
- [ ] Performance monitoring
- [ ] Documentation updates

### **Post-Implementation**
- [ ] Full system testing completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Team training completed
- [ ] Monitoring and alerting operational

---

## 🔧 Advanced Technical Specifications

### **Task 2.1: API Route Middleware Implementation** (12h)

#### Implementation Details

**Step 1: Create base middleware framework (4h)**
```typescript
// src/lib/middleware/base.ts
export interface MiddlewareContext {
  req: NextRequest;
  userId?: string;
  credentials?: ApiCredentials;
  startTime: number;
}

export type MiddlewareHandler = (
  context: MiddlewareContext,
  next: () => Promise<Response>
) => Promise<Response>;

export const createMiddlewareChain = (middlewares: MiddlewareHandler[]) => {
  return (handler: ApiHandler) => {
    return async (req: NextRequest) => {
      const context: MiddlewareContext = {
        req,
        startTime: Date.now(),
      };

      const executeChain = async (index: number): Promise<Response> => {
        if (index >= middlewares.length) {
          return handler(context);
        }

        return middlewares[index](context, () => executeChain(index + 1));
      };

      return executeChain(0);
    };
  };
};
```

**Step 2: Implement authentication middleware (3h)**
```typescript
// src/lib/middleware/auth.ts
export const withAuth: MiddlewareHandler = async (context, next) => {
  const { searchParams } = new URL(context.req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return apiResponse(
      createErrorResponse("User ID required"),
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  context.userId = userId;
  return next();
};

export const withMexcCredentials: MiddlewareHandler = async (context, next) => {
  if (!context.userId) {
    throw new Error("User ID required for MEXC credentials");
  }

  const credentials = await getMexcCredentials(context.userId);
  if (!credentials) {
    return apiResponse(
      createErrorResponse("No active MEXC API credentials found"),
      HTTP_STATUS.BAD_REQUEST
    );
  }

  context.credentials = credentials;
  return next();
};
```

**Step 3: Implement rate limiting middleware (3h)**
```typescript
// src/lib/middleware/rate-limit.ts
export const withRateLimit = (
  requests: number = 10,
  windowMs: number = 60000
): MiddlewareHandler => {
  return async (context, next) => {
    const clientId = context.userId || getClientIP(context.req);

    const isAllowed = await rateLimiter.checkLimit(clientId, requests, windowMs);
    if (!isAllowed) {
      return apiResponse(
        createErrorResponse("Rate limit exceeded"),
        HTTP_STATUS.TOO_MANY_REQUESTS
      );
    }

    return next();
  };
};
```

**Step 4: Implement error handling middleware (2h)**
```typescript
// src/lib/middleware/error-handling.ts
export const withErrorHandling: MiddlewareHandler = async (context, next) => {
  try {
    return await next();
  } catch (error) {
    console.error(`API Error in ${context.req.url}:`, error);

    // Log error for monitoring
    await ErrorLoggingService.logError({
      error,
      context: {
        url: context.req.url,
        userId: context.userId,
        timestamp: new Date().toISOString(),
      },
    });

    if (error instanceof ValidationError) {
      return apiResponse(
        createErrorResponse(error.message),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (error instanceof AuthenticationError) {
      return apiResponse(
        createErrorResponse("Authentication failed"),
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    return apiResponse(
      createErrorResponse("Internal server error"),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};
```

#### Migration Strategy for Existing Routes
```typescript
// Before (app/api/mexc/account/route.ts)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    // ... manual auth and error handling
  } catch (error) {
    // ... manual error handling
  }
}

// After
export const GET = createMiddlewareChain([
  withErrorHandling,
  withAuth,
  withMexcCredentials,
  withRateLimit(5, 60000),
])(async (context) => {
  // Clean handler logic without boilerplate
  const accountData = await mexcApi.getAccountInfo(context.credentials);
  return createSuccessResponse(accountData);
});
```

### **Task 3.1: Agent Coordination Centralization** (20h)

#### Enhanced Orchestrator Architecture

**Step 1: Agent registry and health monitoring (6h)**
```typescript
// src/mexc-agents/coordination/agent-registry.ts
export interface AgentHealth {
  agentId: string;
  status: 'healthy' | 'degraded' | 'critical' | 'offline';
  lastHeartbeat: Date;
  responseTime: number;
  errorRate: number;
  memoryUsage: number;
}

export class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();
  private healthMetrics: Map<string, AgentHealth> = new Map();

  async registerAgent(agent: BaseAgent): Promise<void> {
    this.agents.set(agent.config.name, agent);
    await this.initializeHealthMonitoring(agent);
  }

  async getHealthyAgents(requiredAgents: string[]): Promise<BaseAgent[]> {
    const healthyAgents: BaseAgent[] = [];

    for (const agentName of requiredAgents) {
      const agent = this.agents.get(agentName);
      const health = this.healthMetrics.get(agentName);

      if (agent && health?.status === 'healthy') {
        healthyAgents.push(agent);
      } else {
        throw new Error(`Agent ${agentName} is not available`);
      }
    }

    return healthyAgents;
  }

  private async initializeHealthMonitoring(agent: BaseAgent): Promise<void> {
    // Implement health check logic
    setInterval(async () => {
      const health = await this.checkAgentHealth(agent);
      this.healthMetrics.set(agent.config.name, health);
    }, 30000); // Check every 30 seconds
  }
}
```

**Step 2: Workflow coordination engine (8h)**
```typescript
// src/mexc-agents/coordination/workflow-engine.ts
export interface WorkflowStep {
  agentName: string;
  method: string;
  params: any;
  timeout: number;
  retries: number;
  dependencies?: string[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
  parallelExecution?: boolean;
  failureStrategy: 'abort' | 'continue' | 'retry';
}

export class WorkflowEngine {
  constructor(
    private agentRegistry: AgentRegistry,
    private performanceCollector: PerformanceCollector
  ) {}

  async executeWorkflow(
    definition: WorkflowDefinition,
    context: WorkflowContext
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const results: Map<string, any> = new Map();

    try {
      if (definition.parallelExecution) {
        await this.executeParallel(definition.steps, context, results);
      } else {
        await this.executeSequential(definition.steps, context, results);
      }

      return {
        success: true,
        results: Object.fromEntries(results),
        executionTime: Date.now() - startTime,
        workflowId: definition.id,
      };
    } catch (error) {
      return this.handleWorkflowFailure(error, definition, results, startTime);
    }
  }

  private async executeSequential(
    steps: WorkflowStep[],
    context: WorkflowContext,
    results: Map<string, any>
  ): Promise<void> {
    for (const step of steps) {
      await this.executeStep(step, context, results);
    }
  }

  private async executeParallel(
    steps: WorkflowStep[],
    context: WorkflowContext,
    results: Map<string, any>
  ): Promise<void> {
    const promises = steps.map(step => this.executeStep(step, context, results));
    await Promise.all(promises);
  }
}
```

**Step 3: Performance metrics collection (6h)**
```typescript
// src/mexc-agents/coordination/performance-collector.ts
export interface AgentPerformanceMetrics {
  agentName: string;
  operationName: string;
  executionTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  errorCount: number;
  successCount: number;
  timestamp: Date;
}

export class PerformanceCollector {
  private metrics: AgentPerformanceMetrics[] = [];
  private readonly maxMetrics = 10000;

  async recordMetric(metric: AgentPerformanceMetrics): Promise<void> {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Store in database for long-term analysis
    await this.persistMetric(metric);
  }

  getPerformanceReport(agentName?: string, timeRange?: TimeRange): PerformanceReport {
    let filteredMetrics = this.metrics;

    if (agentName) {
      filteredMetrics = filteredMetrics.filter(m => m.agentName === agentName);
    }

    if (timeRange) {
      filteredMetrics = filteredMetrics.filter(m =>
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    return this.calculateReport(filteredMetrics);
  }
}
```

### **Task 4.1: Testing Framework Consolidation** (16h)

#### Consolidation Strategy

**Step 1: Analyze current test coverage (4h)**
```bash
# Generate coverage reports for each framework
npm run test:coverage          # Vitest coverage
npm run test:e2e              # Playwright coverage
npm run test:stagehand        # Stagehand coverage

# Analyze overlap and gaps
npx nyc report --reporter=html
```

**Step 2: Migrate Playwright tests to Stagehand (8h)**
```typescript
// Before (Playwright): tests/e2e/dashboard.spec.ts
test('should load dashboard page successfully', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveTitle(/MEXC Sniper Bot/);
  await expect(page.locator('h1')).toContainText('Dashboard');
});

// After (Stagehand): tests/e2e/dashboard-stagehand.spec.ts
test('should load dashboard with AI verification', async ({ page }) => {
  const stagehand = new Stagehand({ page, modelName: "gpt-4o-mini" });

  await stagehand.page.goto('/dashboard');

  // AI-powered verification
  const dashboardLoaded = await stagehand.observe({
    instruction: "Verify the dashboard has loaded successfully with the main heading and navigation elements visible"
  });

  expect(dashboardLoaded).toBe(true);

  // Verify specific trading functionality
  const tradingElementsVisible = await stagehand.observe({
    instruction: "Check if trading dashboard shows coin listings, account balance, and trading controls"
  });

  expect(tradingElementsVisible).toBe(true);
});
```

**Step 3: Create unified test configuration (2h)**
```typescript
// tests/config/unified-test-config.ts
export const testConfig = {
  vitest: {
    // Unit and integration test settings
    environment: 'node',
    globals: true,
    coverage: {
      threshold: {
        global: {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95
        }
      }
    }
  },
  stagehand: {
    // AI-powered E2E test settings
    modelName: "gpt-4o-mini",
    headless: process.env.CI === 'true',
    timeout: 60000,
    retries: 2
  }
};
```

**Step 4: Update test scripts and CI/CD (2h)**
```json
// package.json updates
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run tests/unit/",
    "test:integration": "vitest run tests/integration/",
    "test:e2e": "playwright test tests/e2e/ --config=stagehand.config.ts",
    "test:all": "npm run test && npm run test:e2e",
    "test:coverage": "vitest run --coverage && npm run test:e2e"
  }
}
```

### **Task 5.1: Bundle Size Optimization** (24h)

#### Optimization Strategy

**Step 1: Analyze current bundle composition (4h)**
```bash
# Install bundle analyzer
npm install --save-dev @next/bundle-analyzer

# Analyze bundle
ANALYZE=true npm run build
```

**Step 2: Implement dynamic imports for agents (8h)**
```typescript
// Before: Static imports
import { CalendarAgent } from './calendar-agent';
import { PatternDiscoveryAgent } from './pattern-discovery-agent';
import { SymbolAnalysisAgent } from './symbol-analysis-agent';

// After: Dynamic imports
const loadAgent = async (agentType: string) => {
  switch (agentType) {
    case 'calendar':
      const { CalendarAgent } = await import('./calendar-agent');
      return CalendarAgent;
    case 'pattern':
      const { PatternDiscoveryAgent } = await import('./pattern-discovery-agent');
      return PatternDiscoveryAgent;
    case 'symbol':
      const { SymbolAnalysisAgent } = await import('./symbol-analysis-agent');
      return SymbolAnalysisAgent;
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
};
```

**Step 3: Optimize component imports (6h)**
```typescript
// Before: Full library imports
import * as RadixUI from '@radix-ui/react-dialog';
import { format, parseISO, addDays } from 'date-fns';

// After: Specific imports
import { Dialog, DialogContent, DialogHeader } from '@radix-ui/react-dialog';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { addDays } from 'date-fns/addDays';
```

**Step 4: Implement code splitting (6h)**
```typescript
// next.config.ts updates
const nextConfig = {
  experimental: {
    optimizePackageImports: [
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      'date-fns',
      'lucide-react'
    ]
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          agents: {
            test: /[\\/]src[\\/]mexc-agents[\\/]/,
            name: 'agents',
            chunks: 'all',
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }
    return config;
  },
};
```

---

## 📈 Monitoring & Validation Framework

### **Continuous Validation During Refactoring**

#### Automated Testing Pipeline
```yaml
# .github/workflows/refactoring-validation.yml
name: Refactoring Validation
on:
  push:
    branches: [refactor/*]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type checking
        run: npm run type-check

      - name: Linting
        run: npm run lint:check

      - name: Unit tests
        run: npm run test:unit

      - name: Integration tests
        run: npm run test:integration

      - name: E2E tests
        run: npm run test:e2e

      - name: Bundle size check
        run: |
          npm run build
          npx bundlesize

      - name: Performance benchmarks
        run: npm run test:performance
```

#### Performance Monitoring
```typescript
// src/lib/monitoring/performance-monitor.ts
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!this.instance) {
      this.instance = new PerformanceMonitor();
    }
    return this.instance;
  }

  async measureOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    try {
      const result = await operation();

      const endTime = performance.now();
      const endMemory = process.memoryUsage();

      this.recordMetric({
        operationName,
        duration: endTime - startTime,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        timestamp: new Date(),
        success: true,
      });

      return result;
    } catch (error) {
      this.recordMetric({
        operationName,
        duration: performance.now() - startTime,
        memoryDelta: 0,
        timestamp: new Date(),
        success: false,
        error: error.message,
      });
      throw error;
    }
  }

  getPerformanceReport(operationName?: string): PerformanceReport {
    // Generate comprehensive performance report
    return this.generateReport(operationName);
  }
}
```

---

*This comprehensive implementation plan provides detailed technical specifications and actionable steps for systematic refactoring while preserving the sophisticated pattern discovery capabilities and maintaining the 100% test pass rate requirement.*
