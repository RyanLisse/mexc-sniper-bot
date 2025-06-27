# 🏗️ MEXC Sniper Bot - Updated Implementation Guide

## 🔍 Current State Assessment

### ✅ What's Already in Place
1. **Service Layer Architecture** (`src/lib/service-layer-architecture.ts`)
   - Well-defined service interfaces for all domains
   - Service Registry pattern for dependency injection
   - Clear separation between Trading, Infrastructure, and Safety domains
   - Base service interfaces with health checks and status monitoring

2. **Existing Service Structure**
   - 14 service directories under `src/services/`
   - AI services, API services, data services, risk management, trading services
   - Notification, rate limiting, and coordination services

3. **Next.js App Router Structure**
   - Modern app directory with API routes
   - Dashboard, monitoring, safety, settings, and workflows pages
   - 60+ API endpoints mentioned in architecture analysis

### 🚨 Identified Gaps & Blockers

#### 1. **TypeScript Build Errors**
   - Build command includes `DISABLE_TELEMETRY=true` which may be causing issues
   - Type checking is slow/hanging (needs investigation)
   - Missing implementations for service interfaces

#### 2. **Missing Clean Architecture Components**
   - No `/domain` directory for entities
   - No `/application` directory for use cases
   - No `/infrastructure` directory for adapters
   - No interface adapters connecting existing services to clean architecture

#### 3. **No Feature Flag System**
   - Feature flags mentioned in plan but not implemented
   - No environment variable configuration for gradual rollout

#### 4. **Missing Test Infrastructure**
   - Tests directory exists but minimal test coverage
   - No integration tests for clean architecture components

## 📋 Optimized Implementation Plan

### Phase 1: Foundation Setup (Days 1-3)

#### Day 1: Fix Build & TypeScript Configuration
```bash
# 1. Update package.json build script
# Remove DISABLE_TELEMETRY=true as it may cause issues
"build": "next build"

# 2. Create tsconfig.strict.json for gradual migration
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  },
  "include": [
    "src/domain/**/*",
    "src/application/**/*",
    "src/infrastructure/**/*"
  ]
}
```

#### Day 2: Create Clean Architecture Directories
```bash
# Create clean architecture structure
mkdir -p src/domain/{entities,value-objects,interfaces}
mkdir -p src/application/{use-cases,services,interfaces}
mkdir -p src/infrastructure/{adapters,repositories,services}
mkdir -p src/interfaces/{controllers,presenters,gateways}
```

#### Day 3: Implement Feature Flag System
```typescript
// src/lib/feature-flags/index.ts
export const featureFlags = {
  CLEAN_ARCHITECTURE_PORTFOLIO: process.env.NEXT_PUBLIC_FEATURE_CA_PORTFOLIO === 'true',
  CLEAN_ARCHITECTURE_TRADING: process.env.NEXT_PUBLIC_FEATURE_CA_TRADING === 'true',
  CLEAN_ARCHITECTURE_SAFETY: process.env.NEXT_PUBLIC_FEATURE_CA_SAFETY === 'true',
} as const;

// src/lib/feature-flags/provider.tsx
import { createContext, useContext } from 'react';

const FeatureFlagContext = createContext(featureFlags);

export const useFeatureFlag = (flag: keyof typeof featureFlags) => {
  const flags = useContext(FeatureFlagContext);
  return flags[flag];
};
```

### Phase 2: Portfolio Vertical Slice (Days 4-7)

#### Day 4: Domain Layer Implementation
```typescript
// src/domain/entities/portfolio.entity.ts
export interface PortfolioProps {
  id: string;
  userId: string;
  positions: Position[];
  lastUpdated: Date;
  totalValue?: number;
}

export class Portfolio {
  private constructor(private readonly props: PortfolioProps) {}

  static create(props: PortfolioProps): Portfolio {
    return new Portfolio(props);
  }

  calculateTotalValue(prices: Map<string, number>): number {
    return this.positions.reduce((total, position) => {
      const price = prices.get(position.symbol) || 0;
      return total + (position.quantity * price);
    }, 0);
  }

  get id() { return this.props.id; }
  get userId() { return this.props.userId; }
  get positions() { return this.props.positions; }
  get lastUpdated() { return this.props.lastUpdated; }
}

// src/domain/value-objects/position.value-object.ts
export class Position {
  constructor(
    public readonly symbol: string,
    public readonly quantity: number,
    public readonly averagePrice: number,
    public readonly currentPrice?: number
  ) {}

  get pnl(): number {
    if (!this.currentPrice) return 0;
    return (this.currentPrice - this.averagePrice) * this.quantity;
  }

  get pnlPercentage(): number {
    if (this.averagePrice === 0) return 0;
    return ((this.currentPrice || 0) - this.averagePrice) / this.averagePrice * 100;
  }
}
```

#### Day 5: Application Layer Implementation
```typescript
// src/application/interfaces/repositories/portfolio.repository.interface.ts
import { Portfolio } from '@/domain/entities/portfolio.entity';

export interface IPortfolioRepository {
  findByUserId(userId: string): Promise<Portfolio | null>;
  save(portfolio: Portfolio): Promise<void>;
  update(portfolio: Portfolio): Promise<void>;
}

// src/application/interfaces/services/price.service.interface.ts
export interface IPriceService {
  getCurrentPrices(symbols: string[]): Promise<Map<string, number>>;
  subscribeToPrice(symbol: string, callback: (price: number) => void): void;
}

// src/application/use-cases/portfolio/get-portfolio-overview.use-case.ts
import { inject, injectable } from '@/lib/dependency-injection';
import { IPortfolioRepository } from '@/application/interfaces/repositories/portfolio.repository.interface';
import { IPriceService } from '@/application/interfaces/services/price.service.interface';

export interface GetPortfolioOverviewRequest {
  userId: string;
}

export interface GetPortfolioOverviewResponse {
  totalValue: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercentage: number;
  }>;
  lastUpdated: Date;
}

@injectable()
export class GetPortfolioOverviewUseCase {
  constructor(
    @inject('IPortfolioRepository') private portfolioRepo: IPortfolioRepository,
    @inject('IPriceService') private priceService: IPriceService
  ) {}

  async execute(request: GetPortfolioOverviewRequest): Promise<GetPortfolioOverviewResponse> {
    const portfolio = await this.portfolioRepo.findByUserId(request.userId);
    
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const symbols = portfolio.positions.map(p => p.symbol);
    const prices = await this.priceService.getCurrentPrices(symbols);
    
    const totalValue = portfolio.calculateTotalValue(prices);
    
    const positionsWithPrices = portfolio.positions.map(position => ({
      symbol: position.symbol,
      quantity: position.quantity,
      averagePrice: position.averagePrice,
      currentPrice: prices.get(position.symbol) || 0,
      pnl: position.pnl,
      pnlPercentage: position.pnlPercentage
    }));

    return {
      totalValue,
      positions: positionsWithPrices,
      lastUpdated: portfolio.lastUpdated
    };
  }
}
```

#### Day 6: Infrastructure Adapters
```typescript
// src/infrastructure/adapters/services/mexc-price-service.adapter.ts
import { injectable, inject } from '@/lib/dependency-injection';
import { IPriceService } from '@/application/interfaces/services/price.service.interface';
import { UnifiedMEXCService } from '@/services/trading/unified-mexc-service';

@injectable()
export class MEXCPriceServiceAdapter implements IPriceService {
  constructor(
    @inject('UnifiedMEXCService') private mexcService: UnifiedMEXCService
  ) {}

  async getCurrentPrices(symbols: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    
    // Use existing MEXC service to get prices
    const tickerData = await this.mexcService.getTickers(symbols);
    
    tickerData.forEach(ticker => {
      prices.set(ticker.symbol, parseFloat(ticker.price));
    });
    
    return prices;
  }

  subscribeToPrice(symbol: string, callback: (price: number) => void): void {
    // Implement WebSocket subscription using existing service
    this.mexcService.subscribeToTicker(symbol, (ticker) => {
      callback(parseFloat(ticker.price));
    });
  }
}

// src/infrastructure/repositories/drizzle-portfolio.repository.ts
import { injectable, inject } from '@/lib/dependency-injection';
import { IPortfolioRepository } from '@/application/interfaces/repositories/portfolio.repository.interface';
import { Portfolio } from '@/domain/entities/portfolio.entity';
import { db } from '@/db';
import { portfolios, positions } from '@/db/schema';
import { eq } from 'drizzle-orm';

@injectable()
export class DrizzlePortfolioRepository implements IPortfolioRepository {
  async findByUserId(userId: string): Promise<Portfolio | null> {
    const portfolioData = await db.query.portfolios.findFirst({
      where: eq(portfolios.userId, userId),
      with: {
        positions: true
      }
    });

    if (!portfolioData) {
      return null;
    }

    return Portfolio.create({
      id: portfolioData.id,
      userId: portfolioData.userId,
      positions: portfolioData.positions.map(p => ({
        symbol: p.symbol,
        quantity: p.quantity,
        averagePrice: p.averagePrice
      })),
      lastUpdated: portfolioData.updatedAt
    });
  }

  async save(portfolio: Portfolio): Promise<void> {
    // Implementation for saving
  }

  async update(portfolio: Portfolio): Promise<void> {
    // Implementation for updating
  }
}
```

#### Day 7: API Route with Feature Flag
```typescript
// app/api/portfolio/overview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { featureFlags } from '@/lib/feature-flags';
import { getPortfolioOverviewLegacy } from '@/services/api/portfolio';
import { container } from '@/lib/dependency-injection';
import { GetPortfolioOverviewUseCase } from '@/application/use-cases/portfolio/get-portfolio-overview.use-case';
import { withAuth } from '@/lib/auth';

export const GET = withAuth(async (request: NextRequest, { userId }: { userId: string }) => {
  try {
    if (featureFlags.CLEAN_ARCHITECTURE_PORTFOLIO) {
      // Clean Architecture implementation
      const useCase = container.resolve<GetPortfolioOverviewUseCase>(
        'GetPortfolioOverviewUseCase'
      );
      
      const result = await useCase.execute({ userId });
      
      return NextResponse.json(result);
    } else {
      // Legacy implementation
      const portfolio = await getPortfolioOverviewLegacy(userId);
      return NextResponse.json(portfolio);
    }
  } catch (error) {
    console.error('Portfolio overview error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio' },
      { status: 500 }
    );
  }
});
```

### Phase 3: Testing & Monitoring (Days 8-10)

#### Day 8: Unit Tests
```typescript
// src/application/use-cases/portfolio/__tests__/get-portfolio-overview.use-case.test.ts
import { describe, it, expect, vi } from 'vitest';
import { GetPortfolioOverviewUseCase } from '../get-portfolio-overview.use-case';
import { Portfolio } from '@/domain/entities/portfolio.entity';

describe('GetPortfolioOverviewUseCase', () => {
  it('should return portfolio overview with current prices', async () => {
    // Mock repositories
    const mockPortfolioRepo = {
      findByUserId: vi.fn().mockResolvedValue(
        Portfolio.create({
          id: '1',
          userId: 'user1',
          positions: [
            { symbol: 'BTC/USDT', quantity: 0.5, averagePrice: 40000 }
          ],
          lastUpdated: new Date()
        })
      )
    };

    const mockPriceService = {
      getCurrentPrices: vi.fn().mockResolvedValue(
        new Map([['BTC/USDT', 45000]])
      )
    };

    const useCase = new GetPortfolioOverviewUseCase(
      mockPortfolioRepo as any,
      mockPriceService as any
    );

    const result = await useCase.execute({ userId: 'user1' });

    expect(result.totalValue).toBe(22500); // 0.5 * 45000
    expect(result.positions[0].pnl).toBe(2500); // (45000 - 40000) * 0.5
  });
});
```

#### Day 9: Integration Tests
```typescript
// tests/integration/clean-architecture/portfolio.integration.test.ts
import { describe, it, expect } from 'vitest';
import { testClient } from '@/test-utils/test-client';

describe('Portfolio Clean Architecture Integration', () => {
  it('should return portfolio overview via clean architecture', async () => {
    process.env.NEXT_PUBLIC_FEATURE_CA_PORTFOLIO = 'true';
    
    const response = await testClient.get('/api/portfolio/overview');
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('totalValue');
    expect(response.data).toHaveProperty('positions');
    expect(response.data).toHaveProperty('lastUpdated');
  });

  it('should fall back to legacy when feature flag is off', async () => {
    process.env.NEXT_PUBLIC_FEATURE_CA_PORTFOLIO = 'false';
    
    const response = await testClient.get('/api/portfolio/overview');
    
    expect(response.status).toBe(200);
    // Verify legacy response structure
  });
});
```

#### Day 10: Monitoring Setup
```typescript
// src/lib/monitoring/use-case-metrics.ts
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('clean-architecture');

export const useCaseMetrics = {
  latency: meter.createHistogram('use_case_latency_ms', {
    description: 'Use case execution latency in milliseconds',
    unit: 'ms'
  }),
  
  errors: meter.createCounter('use_case_errors_total', {
    description: 'Total number of use case errors'
  }),
  
  calls: meter.createCounter('use_case_calls_total', {
    description: 'Total number of use case calls'
  })
};

// Wrapper for use cases
export function withMetrics<T extends (...args: any[]) => Promise<any>>(
  useCase: T,
  useCaseName: string
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const startTime = Date.now();
    
    try {
      useCaseMetrics.calls.add(1, { use_case: useCaseName });
      const result = await useCase(...args);
      
      useCaseMetrics.latency.record(Date.now() - startTime, {
        use_case: useCaseName,
        status: 'success'
      });
      
      return result;
    } catch (error) {
      useCaseMetrics.errors.add(1, { use_case: useCaseName });
      useCaseMetrics.latency.record(Date.now() - startTime, {
        use_case: useCaseName,
        status: 'error'
      });
      throw error;
    }
  }) as T;
}
```

## 🔧 Dependency Injection Configuration

```typescript
// src/lib/dependency-injection/clean-architecture.config.ts
import { Container } from 'inversify';
import { IPortfolioRepository } from '@/application/interfaces/repositories/portfolio.repository.interface';
import { IPriceService } from '@/application/interfaces/services/price.service.interface';
import { DrizzlePortfolioRepository } from '@/infrastructure/repositories/drizzle-portfolio.repository';
import { MEXCPriceServiceAdapter } from '@/infrastructure/adapters/services/mexc-price-service.adapter';
import { GetPortfolioOverviewUseCase } from '@/application/use-cases/portfolio/get-portfolio-overview.use-case';

export function configureCleanArchitecture(container: Container) {
  // Repositories
  container.bind<IPortfolioRepository>('IPortfolioRepository')
    .to(DrizzlePortfolioRepository)
    .inSingletonScope();

  // Services
  container.bind<IPriceService>('IPriceService')
    .to(MEXCPriceServiceAdapter)
    .inSingletonScope();

  // Use Cases
  container.bind<GetPortfolioOverviewUseCase>('GetPortfolioOverviewUseCase')
    .to(GetPortfolioOverviewUseCase)
    .inTransientScope();
}
```

## 📊 Migration Progress Tracking

```typescript
// src/lib/migration-tracker/index.ts
export const migrationTracker = {
  portfolio: {
    status: 'in-progress',
    completedUseCases: [],
    totalUseCases: 5,
    featureFlag: 'CLEAN_ARCHITECTURE_PORTFOLIO'
  },
  trading: {
    status: 'not-started',
    completedUseCases: [],
    totalUseCases: 8,
    featureFlag: 'CLEAN_ARCHITECTURE_TRADING'
  },
  safety: {
    status: 'not-started',
    completedUseCases: [],
    totalUseCases: 4,
    featureFlag: 'CLEAN_ARCHITECTURE_SAFETY'
  }
};

// Migration dashboard component
// src/components/migration/migration-dashboard.tsx
export function MigrationDashboard() {
  const progress = Object.entries(migrationTracker).map(([domain, info]) => ({
    domain,
    ...info,
    percentage: (info.completedUseCases.length / info.totalUseCases) * 100
  }));

  return (
    <div className="migration-dashboard">
      {progress.map(item => (
        <div key={item.domain}>
          <h3>{item.domain}</h3>
          <ProgressBar value={item.percentage} />
          <p>Status: {item.status}</p>
        </div>
      ))}
    </div>
  );
}
```

## 🎯 Success Criteria

1. **Week 1 Completion**
   - ✅ All TypeScript errors resolved
   - ✅ Clean architecture directories created
   - ✅ Feature flag system implemented
   - ✅ Service adapters documented

2. **Week 2 Completion**
   - ✅ Portfolio vertical slice complete
   - ✅ 100% test coverage on new code
   - ✅ Feature flags working in production
   - ✅ Monitoring showing <10ms overhead

## 🚀 Next Steps After Initial Implementation

1. **Expand to Trading Domain** (Week 3-4)
   - Order execution use cases
   - Trading strategy patterns
   - Risk assessment integration

2. **Safety Domain Migration** (Week 5-6)
   - Emergency stop use cases
   - Safety monitoring patterns
   - Compliance checking

3. **Full Migration** (Week 7-12)
   - Complete remaining domains
   - Remove legacy code
   - Performance optimization

## 📝 Key Decisions & Rationale

1. **Start with Portfolio**: Read-heavy, lower risk than trading
2. **Use Existing DI Container**: Already well-implemented
3. **Adapter Pattern**: Reuse existing services, minimize disruption
4. **Feature Flags**: Safe rollout and easy rollback
5. **Incremental Migration**: One vertical slice at a time

This guide provides a clear, actionable path to implementing Clean Architecture while leveraging your existing infrastructure and minimizing risk.