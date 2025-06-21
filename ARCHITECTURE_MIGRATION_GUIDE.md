# Architecture Migration Guide

## Overview

This guide provides step-by-step instructions for migrating the existing tightly-coupled service architecture to the new **Service Layer Architecture** with proper **Dependency Injection** and **Unified Configuration Management**.

## 🎯 Migration Goals

### **Current Issues (BEFORE)**
- ❌ **24 files** importing services directly (`../services/`)
- ❌ **Tight coupling** between services
- ❌ **Mixed configuration patterns** across 151+ files
- ❌ **Difficult unit testing** due to hard dependencies
- ❌ **Circular dependency risks**
- ❌ **No centralized service lifecycle management**

### **Target Architecture (AFTER)**
- ✅ **Domain-specific service boundaries**
- ✅ **Dependency injection** through service container
- ✅ **Unified configuration management**
- ✅ **Interface-based service contracts**
- ✅ **Easy mocking for testing**
- ✅ **Centralized service lifecycle**

## 🏗️ New Architecture Components

### 1. Service Layer Architecture (`src/lib/service-layer-architecture.ts`)
- **Domain Services**: Trading, Infrastructure, Safety
- **Service Interfaces**: Standardized contracts
- **Service Registry**: Lifecycle management

### 2. Unified Configuration (`src/lib/unified-configuration-management.ts`)
- **Type-safe configuration**: Zod schema validation
- **Environment-specific overrides**: Development/Production
- **Hot reloading**: Configuration change notifications

### 3. Dependency Injection (`src/lib/dependency-injection-container.ts`)
- **Service lifetimes**: Singleton, Transient, Scoped
- **Automatic dependency resolution**: No manual wiring
- **Circular dependency detection**: Prevents architectural issues

## 📋 Migration Steps

### Phase 1: Infrastructure Setup

#### Step 1.1: Install New Architecture
```typescript
// src/app.ts or main initialization file
import { getContainer, createContainer } from './lib/dependency-injection-container';
import { getConfig, ConfigurationManager } from './lib/unified-configuration-management';

// Initialize configuration
const config = getConfig();

// Initialize dependency container
const container = getContainer();
await container.initializeAll();
```

#### Step 1.2: Update Environment Variables
```bash
# Add to .env file - replaces scattered config patterns
MEXC_API_KEY=your_api_key
MEXC_SECRET_KEY=your_secret_key
AUTO_SNIPING_ENABLED=true
PAPER_TRADING_MODE=true
MAX_POSITION_SIZE=10
CONFIDENCE_THRESHOLD=80
```

### Phase 2: Service Migration

#### Step 2.1: Migrate MEXC Services

**BEFORE (Old Pattern):**
```typescript
// auto-sniping-orchestrator.ts
import { UnifiedMexcService } from "./unified-mexc-service";
import { ComprehensiveSafetyCoordinator } from "./comprehensive-safety-coordinator";

export class AutoSnipingOrchestrator {
  private mexcService: UnifiedMexcService;
  private safetyCoordinator: ComprehensiveSafetyCoordinator;

  constructor() {
    // Hard-coded instantiation - tight coupling
    this.mexcService = new UnifiedMexcService({
      apiKey: process.env.MEXC_API_KEY,
      secretKey: process.env.MEXC_SECRET_KEY,
    });
    this.safetyCoordinator = new ComprehensiveSafetyCoordinator();
  }
}
```

**AFTER (New Pattern):**
```typescript
// auto-sniping-orchestrator.ts
import { Service, Inject } from '../lib/dependency-injection-container';
import { BaseService, ServiceDependencies } from '../lib/service-layer-architecture';
import type { MexcIntegrationService, SafetyCoordinatorService } from '../lib/service-layer-architecture';

@Service({
  name: 'AutoSnipingOrchestrator',
  lifetime: 'singleton',
  dependencies: ['MexcIntegrationService', 'SafetyCoordinatorService'],
  interfaces: ['OrchestrationService']
})
export class AutoSnipingOrchestrator implements BaseService {
  @Inject('MexcIntegrationService')
  private mexcService!: MexcIntegrationService;

  @Inject('SafetyCoordinatorService')
  private safetyCoordinator!: SafetyCoordinatorService;

  async initialize(dependencies: ServiceDependencies): Promise<void> {
    this.mexcService = dependencies.MexcIntegrationService;
    this.safetyCoordinator = dependencies.SafetyCoordinatorService;
    console.log('AutoSnipingOrchestrator initialized with DI');
  }

  async isHealthy(): Promise<boolean> {
    return this.mexcService && this.safetyCoordinator;
  }

  getStatus() {
    return {
      name: 'AutoSnipingOrchestrator',
      status: 'healthy' as const,
      lastChecked: new Date(),
      dependencies: ['MexcIntegrationService', 'SafetyCoordinatorService'],
    };
  }

  async cleanup(): Promise<void> {
    // Cleanup logic
  }
}
```

#### Step 2.2: Migrate Configuration Usage

**BEFORE (Old Pattern):**
```typescript
// Multiple config patterns scattered throughout
export interface AutoSnipingConfig {
  enabled: boolean;
  maxConcurrentPositions: number;
  // ... duplicate config definitions
}

export class SomeService {
  constructor() {
    // Direct env access
    this.maxPositions = parseInt(process.env.MAX_POSITIONS || '5');
    this.apiKey = process.env.MEXC_API_KEY;
  }
}
```

**AFTER (New Pattern):**
```typescript
// Unified configuration usage
import { getConfigSection, getConfigValue } from '../lib/unified-configuration-management';

@Service({
  name: 'TradingService',
  lifetime: 'singleton'
})
export class TradingService implements BaseService {
  private tradingConfig = getConfigSection('trading');
  private mexcConfig = getConfigSection('mexc');

  async initialize(): Promise<void> {
    // Type-safe configuration access
    const maxPositions = this.tradingConfig.autoSniping.maxConcurrentPositions;
    const confidenceThreshold = this.tradingConfig.autoSniping.confidenceThreshold;
    const apiKey = this.mexcConfig.apiKey;
    
    console.log(`Trading service initialized with max positions: ${maxPositions}`);
  }
}
```

### Phase 3: Component Migration

#### Step 3.1: Migrate React Hooks

**BEFORE (Old Pattern):**
```typescript
// use-auto-sniping-execution.ts
import { AutoSnipingExecutionService } from '../services/auto-sniping-execution-service';

export function useAutoSnipingExecution() {
  const [service] = useState(() => AutoSnipingExecutionService.getInstance());
  // Hard dependency - difficult to test
}
```

**AFTER (New Pattern):**
```typescript
// use-auto-sniping-execution.ts
import { getContainer } from '../lib/dependency-injection-container';
import type { AutoSnipingExecutionService } from '../lib/service-layer-architecture';

export function useAutoSnipingExecution() {
  const [service] = useState(() => {
    const container = getContainer();
    return container.resolve<AutoSnipingExecutionService>('AutoSnipingExecutionService');
  });
  // Proper DI - easy to mock for testing
}
```

#### Step 3.2: Migrate API Routes

**BEFORE (Old Pattern):**
```typescript
// app/api/auto-sniping/control/route.ts
import { AutoSnipingOrchestrator } from '@/src/services/auto-sniping-orchestrator';

export async function POST(request: NextRequest) {
  const orchestrator = AutoSnipingOrchestrator.getInstance();
  // Direct service instantiation
}
```

**AFTER (New Pattern):**
```typescript
// app/api/auto-sniping/control/route.ts
import { getContainer } from '@/src/lib/dependency-injection-container';
import type { AutoSnipingOrchestrator } from '@/src/lib/service-layer-architecture';

export async function POST(request: NextRequest) {
  const container = getContainer();
  const orchestrator = container.resolve<AutoSnipingOrchestrator>('AutoSnipingOrchestrator');
  // Proper DI - services are properly initialized
}
```

## 🧪 Testing Improvements

### Before: Difficult Testing
```typescript
// Hard to test due to hard dependencies
test('should orchestrate auto-sniping', () => {
  const orchestrator = new AutoSnipingOrchestrator();
  // Cannot mock dependencies easily
});
```

### After: Easy Testing with DI
```typescript
// Easy to test with dependency injection
test('should orchestrate auto-sniping', async () => {
  const container = createContainer();
  
  // Register mock services
  container.registerInstance('MexcIntegrationService', mockMexcService);
  container.registerInstance('SafetyCoordinatorService', mockSafetyService);
  
  const orchestrator = container.resolve<AutoSnipingOrchestrator>('AutoSnipingOrchestrator');
  await orchestrator.initialize({});
  
  // Test with mocked dependencies
  expect(await orchestrator.isHealthy()).toBe(true);
});
```

## 📊 Migration Tracking

### Files to Migrate (Priority Order)

#### **High Priority (Core Services)**
1. `src/services/auto-sniping-orchestrator.ts` ⭐
2. `src/services/unified-mexc-service.ts` ⭐
3. `src/services/comprehensive-safety-coordinator.ts` ⭐
4. `src/services/pattern-detection-engine.ts` ⭐

#### **Medium Priority (Infrastructure)**
5. `src/services/mexc-config-validator.ts`
6. `src/services/real-time-safety-monitoring-service.ts`
7. `src/services/pattern-monitoring-service.ts`
8. `src/services/websocket-server.ts`

#### **Low Priority (Supporting Services)**
9. `src/services/notification-providers/*`
10. `src/services/alert-correlation-engine.ts`
11. Remaining service files

### Configuration Files to Consolidate
- All `interface *Config` patterns (151+ files)
- Environment variable access scattered throughout
- Hard-coded configuration values

## 🚀 Deployment Considerations

### Development Environment
```bash
# Update package.json scripts
"scripts": {
  "dev": "NODE_ENV=development next dev",
  "test": "NODE_ENV=test vitest",
  "build": "NODE_ENV=production next build"
}
```

### Production Environment
```bash
# Environment variables for production
AUTO_SNIPING_ENABLED=true
PAPER_TRADING_MODE=false
MEXC_API_KEY=prod_api_key
MEXC_SECRET_KEY=prod_secret_key
LOG_LEVEL=info
METRICS_ENABLED=true
ALERTS_ENABLED=true
```

## 📈 Expected Benefits

### **Performance Improvements**
- ⚡ **Faster startup**: Lazy loading of transient services
- 🧠 **Lower memory usage**: Proper service lifecycle management
- 🔄 **Better caching**: Centralized cache configuration

### **Development Experience**
- 🧪 **Easier testing**: Dependency injection enables easy mocking
- 🔧 **Better debugging**: Service health monitoring and dependency graphs
- 📝 **Type safety**: Full TypeScript support with interfaces

### **Maintenance Benefits**
- 🏗️ **Cleaner architecture**: Clear separation of concerns
- 🔗 **Loose coupling**: Services depend on interfaces, not implementations
- 🎯 **Single responsibility**: Each service has a focused purpose

## 🔄 Rollback Plan

If issues arise during migration:

1. **Keep old services temporarily**: Don't delete until migration is complete
2. **Feature flags**: Use configuration to switch between old/new implementations
3. **Gradual migration**: Migrate one service at a time
4. **Monitoring**: Watch for performance regressions or errors

## 📚 Additional Resources

- [Service Layer Architecture Documentation](./src/lib/service-layer-architecture.ts)
- [Configuration Management Guide](./src/lib/unified-configuration-management.ts)  
- [Dependency Injection Examples](./src/lib/dependency-injection-container.ts)
- [Testing Best Practices](#testing-improvements)

## ✅ Migration Checklist

### Pre-Migration
- [ ] Review current service dependencies
- [ ] Identify configuration scattered throughout codebase
- [ ] Plan service migration order (start with leaf dependencies)
- [ ] Set up new architecture files

### During Migration
- [ ] Migrate one service at a time
- [ ] Update all imports and usage
- [ ] Add proper TypeScript interfaces
- [ ] Write/update tests for each migrated service
- [ ] Update configuration to use unified system

### Post-Migration
- [ ] Remove old service files
- [ ] Clean up scattered configuration
- [ ] Update documentation
- [ ] Monitor performance and error rates
- [ ] Gather team feedback

### Validation
- [ ] All tests pass
- [ ] No circular dependencies detected
- [ ] Configuration validation passes
- [ ] Service health checks all green
- [ ] Performance metrics stable or improved

---

This migration will significantly improve the codebase maintainability, testability, and performance while establishing a solid foundation for future development.