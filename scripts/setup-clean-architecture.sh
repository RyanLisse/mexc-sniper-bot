#!/bin/bash
# MEXC Sniper Bot - Clean Architecture Setup Script

echo "🏗️  Setting up Clean Architecture directories..."

# Create domain layer directories
echo "📁 Creating domain layer..."
mkdir -p src/domain/entities
mkdir -p src/domain/value-objects  
mkdir -p src/domain/interfaces
mkdir -p src/domain/errors
mkdir -p src/domain/events
mkdir -p src/domain/specifications
mkdir -p src/domain/base

# Create application layer directories
echo "📁 Creating application layer..."
mkdir -p src/application/use-cases/portfolio
mkdir -p src/application/use-cases/trading
mkdir -p src/application/use-cases/safety
mkdir -p src/application/use-cases/pattern-detection
mkdir -p src/application/services
mkdir -p src/application/interfaces/repositories
mkdir -p src/application/interfaces/services
mkdir -p src/application/dtos
mkdir -p src/application/mappers

# Create infrastructure layer directories
echo "📁 Creating infrastructure layer..."
mkdir -p src/infrastructure/adapters/services
mkdir -p src/infrastructure/adapters/auth
mkdir -p src/infrastructure/adapters/cache
mkdir -p src/infrastructure/adapters/messaging
mkdir -p src/infrastructure/repositories
mkdir -p src/infrastructure/services
mkdir -p src/infrastructure/persistence

# Create interface adapters layer
echo "📁 Creating interface adapters..."
mkdir -p src/interfaces/controllers
mkdir -p src/interfaces/presenters
mkdir -p src/interfaces/gateways

# Create feature flags
echo "📁 Creating feature flags..."
mkdir -p src/lib/feature-flags

# Create test directories for clean architecture
echo "📁 Creating test directories..."
mkdir -p tests/unit/domain
mkdir -p tests/unit/application
mkdir -p tests/unit/infrastructure
mkdir -p tests/integration/clean-architecture/portfolio
mkdir -p tests/integration/clean-architecture/trading
mkdir -p tests/integration/clean-architecture/safety

echo "✅ Clean Architecture directories created!"

# Create initial feature flags file
echo "📝 Creating feature flags configuration..."
cat > src/lib/feature-flags/index.ts << 'EOF'
/**
 * Feature Flags for Clean Architecture Migration
 * 
 * These flags control the gradual rollout of clean architecture components
 * Set environment variables to enable features in different environments
 */

export const featureFlags = {
  // Portfolio domain migration
  CLEAN_ARCHITECTURE_PORTFOLIO: process.env.NEXT_PUBLIC_FEATURE_CA_PORTFOLIO === 'true',
  
  // Trading domain migration  
  CLEAN_ARCHITECTURE_TRADING: process.env.NEXT_PUBLIC_FEATURE_CA_TRADING === 'true',
  
  // Safety domain migration
  CLEAN_ARCHITECTURE_SAFETY: process.env.NEXT_PUBLIC_FEATURE_CA_SAFETY === 'true',
  
  // Pattern detection migration
  CLEAN_ARCHITECTURE_PATTERNS: process.env.NEXT_PUBLIC_FEATURE_CA_PATTERNS === 'true',
  
  // Use clean architecture for new features
  USE_CLEAN_ARCHITECTURE_FOR_NEW: process.env.NEXT_PUBLIC_USE_CA_FOR_NEW === 'true',
  
  // Rollout percentage (for gradual deployment)
  CA_ROLLOUT_PERCENTAGE: parseInt(process.env.NEXT_PUBLIC_CA_ROLLOUT_PERCENTAGE || '0'),
} as const;

export type FeatureFlag = keyof typeof featureFlags;

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag] === true;
}

/**
 * Check if user is in rollout percentage
 */
export function isInRollout(userId: string): boolean {
  const percentage = featureFlags.CA_ROLLOUT_PERCENTAGE;
  if (percentage === 0) return false;
  if (percentage >= 100) return true;
  
  // Deterministic rollout based on user ID
  const hash = userId.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  return (Math.abs(hash) % 100) < percentage;
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): FeatureFlag[] {
  return (Object.keys(featureFlags) as FeatureFlag[])
    .filter(flag => featureFlags[flag] === true);
}
EOF

echo "✅ Feature flags created!"

# Create base entity class
echo "📝 Creating base entity class..."
cat > src/domain/base/entity.ts << 'EOF'
/**
 * Base Entity class for Domain-Driven Design
 * All domain entities should extend this class
 */
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
    if (!(entity instanceof Entity)) return false;
    return this._id === entity._id;
  }
  
  /**
   * Get a copy of the entity's properties
   */
  getProps(): Readonly<T> {
    return Object.freeze({ ...this.props });
  }
}
EOF

# Create base value object class
echo "📝 Creating base value object class..."
cat > src/domain/base/value-object.ts << 'EOF'
/**
 * Base Value Object class for Domain-Driven Design
 * Value objects are immutable and compared by value
 */
export abstract class ValueObject<T> {
  protected readonly props: T;
  
  constructor(props: T) {
    this.props = Object.freeze(props);
  }
  
  equals(vo?: ValueObject<T>): boolean {
    if (!vo || !(vo instanceof ValueObject)) {
      return false;
    }
    return JSON.stringify(this.props) === JSON.stringify(vo.props);
  }
  
  /**
   * Get a copy of the value object's properties
   */
  getProps(): Readonly<T> {
    return this.props;
  }
}
EOF

# Create domain event base
echo "📝 Creating domain event base..."
cat > src/domain/base/domain-event.ts << 'EOF'
/**
 * Base Domain Event interface
 * All domain events should implement this interface
 */
export interface DomainEvent {
  aggregateId: string;
  type: string;
  payload: any;
  occurredAt: Date;
  version?: number;
}

/**
 * Base class for domain entities that emit events
 */
export abstract class AggregateRoot<T> extends Entity<T> {
  private _domainEvents: DomainEvent[] = [];
  
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }
  
  getDomainEvents(): DomainEvent[] {
    return this._domainEvents;
  }
  
  clearDomainEvents(): void {
    this._domainEvents = [];
  }
}
EOF

# Create use case interface
echo "📝 Creating use case interface..."
cat > src/application/base/use-case.ts << 'EOF'
/**
 * Base Use Case interface
 * All use cases should implement this interface
 */
export interface UseCase<IRequest, IResponse> {
  execute(request: IRequest): Promise<IResponse>;
}

/**
 * Base Use Case abstract class with error handling
 */
export abstract class BaseUseCase<IRequest, IResponse> implements UseCase<IRequest, IResponse> {
  abstract execute(request: IRequest): Promise<IResponse>;
  
  /**
   * Wrapper method with error handling and logging
   */
  async executeWithLogging(request: IRequest): Promise<IResponse> {
    const startTime = Date.now();
    const useCaseName = this.constructor.name;
    
    try {
      console.log(`[UseCase] ${useCaseName} - Starting execution`, { request });
      const response = await this.execute(request);
      console.log(`[UseCase] ${useCaseName} - Completed in ${Date.now() - startTime}ms`);
      return response;
    } catch (error) {
      console.error(`[UseCase] ${useCaseName} - Failed after ${Date.now() - startTime}ms`, error);
      throw error;
    }
  }
}
EOF

# Create repository interface
echo "📝 Creating repository interface..."
cat > src/application/base/repository.ts << 'EOF'
/**
 * Base Repository interface
 * All repositories should implement this interface
 */
export interface Repository<T> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * Extended repository with common query methods
 */
export interface QueryRepository<T> extends Repository<T> {
  findAll(): Promise<T[]>;
  findByIds(ids: string[]): Promise<T[]>;
  count(): Promise<number>;
  exists(id: string): Promise<boolean>;
}
EOF

# Create README for clean architecture
echo "📝 Creating Clean Architecture README..."
cat > src/CLEAN_ARCHITECTURE_README.md << 'EOF'
# Clean Architecture Implementation

This directory structure follows Clean Architecture principles with clear separation of concerns.

## Structure

### Domain Layer (`/domain`)
- **Entities**: Core business objects with identity
- **Value Objects**: Immutable domain concepts without identity
- **Interfaces**: Domain service contracts
- **Errors**: Domain-specific error types
- **Events**: Domain events for communication
- **Specifications**: Business rules and validations

### Application Layer (`/application`)
- **Use Cases**: Application business rules (one use case per file)
- **Services**: Application services for orchestration
- **Interfaces**: Port definitions (repositories, external services)
- **DTOs**: Data Transfer Objects for API communication
- **Mappers**: Convert between domain entities and DTOs

### Infrastructure Layer (`/infrastructure`)
- **Adapters**: External service integrations
- **Repositories**: Data persistence implementations
- **Services**: Infrastructure services (caching, messaging)
- **Persistence**: Database-specific code

### Interface Adapters (`/interfaces`)
- **Controllers**: HTTP request handlers
- **Presenters**: Response formatting
- **Gateways**: External API clients

## Principles

1. **Dependency Rule**: Dependencies point inward. Domain has no external dependencies.
2. **Abstraction**: Use interfaces at boundaries between layers.
3. **Isolation**: Business logic is isolated from external concerns.
4. **Testability**: Each layer can be tested independently.

## Migration Guide

1. Start with domain entities and value objects
2. Define use cases for business operations
3. Create repository interfaces in application layer
4. Implement repositories in infrastructure layer
5. Wire everything together with dependency injection

## Example Flow

1. API Route → Controller
2. Controller → Use Case
3. Use Case → Repository (interface)
4. Repository Implementation → Database
5. Response → Presenter → API Response
EOF

# Create environment template
echo "📝 Creating environment template..."
cat > .env.clean-architecture << 'EOF'
# Clean Architecture Feature Flags
NEXT_PUBLIC_FEATURE_CA_PORTFOLIO=false
NEXT_PUBLIC_FEATURE_CA_TRADING=false
NEXT_PUBLIC_FEATURE_CA_SAFETY=false
NEXT_PUBLIC_FEATURE_CA_PATTERNS=false
NEXT_PUBLIC_USE_CA_FOR_NEW=false
NEXT_PUBLIC_CA_ROLLOUT_PERCENTAGE=0

# Add these to your existing .env files
EOF

# Create TypeScript paths for clean imports
echo "📝 Updating TypeScript config for clean imports..."
cat > tsconfig.paths.json << 'EOF'
{
  "compilerOptions": {
    "paths": {
      "@/domain/*": ["src/domain/*"],
      "@/application/*": ["src/application/*"],
      "@/infrastructure/*": ["src/infrastructure/*"],
      "@/interfaces/*": ["src/interfaces/*"]
    }
  }
}
EOF

echo "
✅ Clean Architecture setup complete!

📋 Next Steps:
1. Fix TypeScript errors: bun run type-check
2. Review IMPLEMENTATION_GUIDE_FINAL.md
3. Start with Portfolio vertical slice
4. Enable feature flags in .env.local

🚀 Quick Commands:
- Type check: bun run type-check
- Run tests: bun test
- Start dev: bun dev

📁 Created Structure:
src/
├── domain/           # Business logic
├── application/      # Use cases
├── infrastructure/   # External services
└── interfaces/       # API adapters

Happy coding! 🎉
"