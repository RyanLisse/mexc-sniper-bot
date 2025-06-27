# 🚀 MEXC Sniper Bot - Clean Architecture Migration Guide V2
## Optimized Implementation Based on Current Assessment

### 📊 Current State Analysis (2025-06-27)

Based on Desktop Commander assessment, the project has:

**✅ Existing Strengths:**
- Sophisticated service-oriented architecture with 50+ microservices
- Robust dependency injection container already implemented
- 784 passing tests with comprehensive coverage
- Multi-agent orchestration system in place
- WebSocket, Redis caching, and circuit breaker patterns
- Production deployment on Vercel
- Bun runtime and Biome.js already configured

**❌ Clean Architecture Gaps:**
- No explicit domain/application/infrastructure layer separation
- Missing use case pattern implementation
- No repository pattern abstraction
- Absence of CQRS and Event Sourcing patterns
- No Saga pattern for distributed transactions
- TypeScript errors present (though build passes)

### 🎯 Optimized Migration Strategy

Given the existing architecture, we'll adopt an **Incremental Wrapper Pattern** approach:

1. **Wrap existing services** with Clean Architecture layers
2. **Reuse dependency injection** container for use case wiring
3. **Leverage existing test infrastructure** for TDD
4. **Maintain current functionality** while migrating

## 📦 Phase 1: Foundation Layer (Week 1)

### 1.1 Directory Structure Setup

```bash
# Create Clean Architecture directories alongside existing structure
mkdir -p src/{domain,application,infrastructure/adapters}
mkdir -p src/domain/{entities,value-objects,events,errors,services}
mkdir -p src/application/{use-cases,repositories,services,dtos}
mkdir -p src/infrastructure/adapters/{repositories,external-apis,messaging}
```

### 1.2 Base Interfaces and Types

```typescript
// src/domain/base/entity.ts
export abstract class Entity<T> {
  protected readonly _id: string;
  protected props: T;

  constructor(props: T, id?: string) {
    this._id = id ?? crypto.randomUUID();
    this.props = props;
  }

  get id(): string {
    return this._id;
  }

  equals(entity?: Entity<T>): boolean {
    if (!entity) return false;
    if (this === entity) return true;
    return this._id === entity._id;
  }
}

// src/domain/base/value-object.ts
export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props);
  }

  equals(vo?: ValueObject<T>): boolean {
    if (!vo) return false;
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
}

// src/application/base/use-case.ts
export interface UseCase<IRequest, IResponse> {
  execute(request: IRequest): Promise<IResponse>;
}

// src/application/base/repository.ts
export interface Repository<T> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### 1.3 Integration with Existing DI Container

```typescript
// src/infrastructure/di/clean-architecture-module.ts
import { DependencyContainer } from '@/lib/dependency-injection-container';

export function registerCleanArchitectureModule(container: DependencyContainer) {
  // Register repositories
  container.register('ITradeRepository', DrizzleTradeRepository, {
    lifetime: 'singleton',
    dependencies: ['DatabaseConnection']
  });

  // Register use cases
  container.register('StartSnipingUseCase', StartSnipingUseCase, {
    lifetime: 'transient',
    dependencies: ['ITradeRepository', 'UnifiedMEXCService', 'EventBus']
  });

  // Register domain services
  container.register('TradingDomainService', TradingDomainService, {
    lifetime: 'singleton',
    dependencies: []
  });
}
```

## 📦 Phase 2: Auto-Sniping Vertical Slice (Week 2-3)

### 2.1 Domain Layer

```typescript
// src/domain/entities/trade.entity.ts
import { Entity } from '../base/entity';
import { TradingPair } from '../value-objects/trading-pair';
import { OrderType } from '../value-objects/order-type';
import { z } from 'zod';

export const TradePropsSchema = z.object({
  symbol: z.string(),
  side: z.enum(['buy', 'sell']),
  price: z.number().positive(),
  quantity: z.number().positive(),
  executedAt: z.date(),
  latency: z.number(),
  status: z.enum(['pending', 'executed', 'failed', 'cancelled']),
  profitTargets: z.array(z.object({
    percentage: z.number(),
    quantity: z.number(),
    hit: z.boolean()
  }))
});

export type TradeProps = z.infer<typeof TradePropsSchema>;

export class Trade extends Entity<TradeProps> {
  get symbol(): string { return this.props.symbol; }
  get status(): string { return this.props.status; }
  
  static create(props: TradeProps, id?: string): Trade {
    const validatedProps = TradePropsSchema.parse(props);
    return new Trade(validatedProps, id);
  }

  execute(price: number, executedAt: Date): void {
    if (this.props.status !== 'pending') {
      throw new Error('Only pending trades can be executed');
    }
    this.props.status = 'executed';
    this.props.price = price;
    this.props.executedAt = executedAt;
  }

  calculatePnL(currentPrice: number): number {
    if (this.props.status !== 'executed') return 0;
    return (currentPrice - this.props.price) * this.props.quantity;
  }
}
```

### 2.2 Application Layer

```typescript
// src/application/use-cases/auto-sniping/start-sniping.use-case.ts
import { UseCase } from '../../base/use-case';
import { inject, injectable } from '@/lib/dependency-injection';
import { ITradeRepository } from '../../repositories/trade.repository.interface';
import { UnifiedMEXCService } from '@/services/trading/unified-mexc-service';
import { EventBus } from '@/lib/event-bus';
import { Trade } from '@/domain/entities/trade.entity';
import { SnipingStartedEvent } from '@/domain/events/sniping-started.event';

export interface StartSnipingRequest {
  symbol: string;
  amount: number;
  profitTargets: Array<{ percentage: number; quantity: number }>;
}

export interface StartSnipingResponse {
  success: boolean;
  tradeId?: string;
  message?: string;
}

@injectable()
export class StartSnipingUseCase implements UseCase<StartSnipingRequest, StartSnipingResponse> {
  constructor(
    @inject('ITradeRepository') private tradeRepo: ITradeRepository,
    @inject('UnifiedMEXCService') private mexcService: UnifiedMEXCService,
    @inject('EventBus') private eventBus: EventBus
  ) {}

  async execute(request: StartSnipingRequest): Promise<StartSnipingResponse> {
    try {
      // Validate exchange connectivity
      const isConnected = await this.mexcService.checkConnection();
      if (!isConnected) {
        return { success: false, message: 'Exchange connection failed' };
      }

      // Get current market price for estimation
      const ticker = await this.mexcService.getSymbolTicker(request.symbol);
      const estimatedPrice = ticker.price;

      // Create domain entity
      const trade = Trade.create({
        symbol: request.symbol,
        side: 'buy',
        price: 0, // Will be set on execution
        quantity: request.amount / estimatedPrice,
        executedAt: new Date(),
        latency: 0,
        status: 'pending',
        profitTargets: request.profitTargets
      });

      // Persist through repository
      await this.tradeRepo.save(trade);

      // Publish domain event
      await this.eventBus.publish(new SnipingStartedEvent({
        tradeId: trade.id,
        symbol: request.symbol,
        timestamp: new Date()
      }));

      return { success: true, tradeId: trade.id };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}
```

### 2.3 Infrastructure Layer

```typescript
// src/infrastructure/adapters/repositories/drizzle-trade.repository.ts
import { ITradeRepository } from '@/application/repositories/trade.repository.interface';
import { Trade } from '@/domain/entities/trade.entity';
import { drizzle } from 'drizzle-orm/postgres-js';
import { trades } from '@/db/schema';
import { eq } from 'drizzle-orm';

export class DrizzleTradeRepository implements ITradeRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async findById(id: string): Promise<Trade | null> {
    const [row] = await this.db
      .select()
      .from(trades)
      .where(eq(trades.id, id))
      .limit(1);

    if (!row) return null;

    return Trade.create({
      symbol: row.symbol,
      side: row.side as 'buy' | 'sell',
      price: Number(row.price),
      quantity: Number(row.quantity),
      executedAt: row.executedAt,
      latency: row.latency || 0,
      status: row.status as any,
      profitTargets: row.profitTargets as any || []
    }, row.id);
  }

  async save(entity: Trade): Promise<void> {
    const data = {
      id: entity.id,
      symbol: entity.symbol,
      side: entity.props.side,
      price: entity.props.price.toString(),
      quantity: entity.props.quantity.toString(),
      executedAt: entity.props.executedAt,
      latency: entity.props.latency,
      status: entity.status,
      profitTargets: entity.props.profitTargets,
      updatedAt: new Date()
    };

    await this.db
      .insert(trades)
      .values(data)
      .onConflictDoUpdate({
        target: trades.id,
        set: data
      });
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(trades)
      .where(eq(trades.id, id));
  }
}
```

### 2.4 API Route Integration

```typescript
// app/api/auto-sniping/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/dependency-injection-container';
import { StartSnipingUseCase } from '@/application/use-cases/auto-sniping/start-sniping.use-case';
import { z } from 'zod';

const RequestSchema = z.object({
  symbol: z.string().regex(/^[A-Z]+USDT$/),
  amount: z.number().min(10).max(10000),
  profitTargets: z.array(z.object({
    percentage: z.number().min(1).max(1000),
    quantity: z.number().min(0).max(100)
  })).min(1).max(5)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = RequestSchema.parse(body);
    
    const useCase = container.resolve<StartSnipingUseCase>('StartSnipingUseCase');
    const result = await useCase.execute(validatedData);
    
    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        message: 'Validation failed',
        errors: error.errors
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
```

## 🧪 Testing Strategy

### Unit Test Example

```typescript
// tests/unit/use-cases/start-sniping.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StartSnipingUseCase } from '@/application/use-cases/auto-sniping/start-sniping.use-case';
import { MockTradeRepository } from '../../mocks/repositories/mock-trade.repository';
import { EventBus } from '@/lib/event-bus';

describe('StartSnipingUseCase', () => {
  let useCase: StartSnipingUseCase;
  let tradeRepo: MockTradeRepository;
  let mexcService: any;
  let eventBus: EventBus;

  beforeEach(() => {
    tradeRepo = new MockTradeRepository();
    mexcService = {
      checkConnection: vi.fn().mockResolvedValue(true),
      getSymbolTicker: vi.fn().mockResolvedValue({ price: 100 })
    };
    eventBus = new EventBus();
    vi.spyOn(eventBus, 'publish');

    useCase = new StartSnipingUseCase(tradeRepo, mexcService, eventBus);
  });

  it('should create a pending trade and emit event', async () => {
    // Arrange
    const request = {
      symbol: 'BTCUSDT',
      amount: 1000,
      profitTargets: [
        { percentage: 50, quantity: 50 },
        { percentage: 100, quantity: 50 }
      ]
    };

    // Act
    const result = await useCase.execute(request);

    // Assert
    expect(result.success).toBe(true);
    expect(result.tradeId).toBeDefined();
    expect(tradeRepo.entities.size).toBe(1);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SnipingStartedEvent'
      })
    );
  });

  it('should handle connection failure', async () => {
    // Arrange
    mexcService.checkConnection.mockResolvedValue(false);

    // Act
    const result = await useCase.execute({
      symbol: 'BTCUSDT',
      amount: 1000,
      profitTargets: []
    });

    // Assert
    expect(result.success).toBe(false);
    expect(result.message).toBe('Exchange connection failed');
    expect(tradeRepo.entities.size).toBe(0);
  });
});
```

## 🔄 Migration Checklist

### Phase 1: Foundation (Week 1)
- [ ] Create Clean Architecture directory structure
- [ ] Implement base classes (Entity, ValueObject, UseCase)
- [ ] Set up repository interfaces
- [ ] Configure DI container integration
- [ ] Create domain event system wrapper

### Phase 2: Auto-Sniping (Week 2-3)
- [ ] Implement Trade entity and value objects
- [ ] Create StartSnipingUseCase
- [ ] Implement DrizzleTradeRepository
- [ ] Update API routes to use use cases
- [ ] Write comprehensive tests
- [ ] Integrate with existing agent system

### Phase 3: Pattern Detection (Week 4-5)
- [ ] Migrate pattern detection to domain entities
- [ ] Create pattern detection use cases
- [ ] Implement pattern repository
- [ ] Maintain compatibility with ML services

### Phase 4: Safety & Risk (Week 6-7)
- [ ] Create risk assessment domain models
- [ ] Implement safety monitoring use cases
- [ ] Integrate with existing circuit breakers
- [ ] Maintain real-time monitoring

### Phase 5: Event Sourcing & CQRS (Week 8-9)
- [ ] Implement event store
- [ ] Create command/query separation
- [ ] Add projection system
- [ ] Migrate critical flows to event sourcing

### Phase 6: Integration & Optimization (Week 10)
- [ ] Complete integration tests
- [ ] Performance optimization
- [ ] Documentation update
- [ ] Production deployment

## 🚀 Key Optimizations

1. **Leverage Existing Infrastructure**
   - Use current DI container
   - Wrap existing services gradually
   - Maintain current test infrastructure

2. **Incremental Migration**
   - Start with new features in Clean Architecture
   - Gradually refactor existing services
   - Maintain backward compatibility

3. **Focus on High-Value Areas**
   - Auto-sniping (core business logic)
   - Pattern detection (complex domain)
   - Risk management (critical safety)

4. **Minimal Disruption**
   - Keep existing API contracts
   - Use adapter pattern for integration
   - Gradual rollout with feature flags

## 📊 Success Metrics

- **Code Quality**: Reduce TypeScript errors to 0
- **Test Coverage**: Maintain 80%+ coverage
- **Performance**: < 100ms use case execution
- **Maintainability**: Clear separation of concerns
- **Developer Velocity**: 30% faster feature development

This optimized guide leverages your existing architecture while gradually introducing Clean Architecture patterns, ensuring a smooth migration with minimal disruption to your production system.