# Error Handling Implementation Guide

## 🚀 Quick Start: Immediate Improvements

### 1. API Route Migration Template

**Before (Inconsistent):**
```typescript
export async function GET(request: NextRequest) {
  try {
    // Route logic
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Route failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

**After (Standardized):**
```typescript
import { asyncHandler, StandardErrors } from '@/src/lib/error-handler';
import { apiResponse } from '@/src/lib/api-response';
import { getErrorMessage } from '@/src/lib/error-type-utils';

export const GET = asyncHandler(async (request: NextRequest) => {
  // Route logic here - errors are automatically handled
  return apiResponse.success(result, { 
    message: "Operation completed successfully" 
  });
});
```

### 2. Service Layer Enhancement Template

**Before (Inconsistent):**
```typescript
async function fetchData() {
  try {
    const result = await externalApi.call();
    return result;
  } catch (error) {
    console.error("API call failed:", error);
    throw new Error("Failed to fetch data");
  }
}
```

**After (Standardized):**
```typescript
import { safeExecute } from '@/src/lib/error-handler';
import { ApiError } from '@/src/lib/errors';

async function fetchData(): Promise<ServiceResult<Data>> {
  return safeExecute(
    async () => {
      const result = await externalApi.call();
      return result;
    },
    "fetchData",
    {
      errorTransform: (error) => new ApiError(
        "External API failure", 
        "external-api", 
        error.status,
        error.response
      )
    }
  );
}
```

### 3. Component Error Handling Template

**Before (Basic):**
```typescript
function MyComponent() {
  const [error, setError] = useState<string | null>(null);
  
  const handleAction = async () => {
    try {
      await riskyOperation();
    } catch (error) {
      setError("Something went wrong");
    }
  };
  
  if (error) return <div>Error: {error}</div>;
  // Component JSX
}
```

**After (Enhanced):**
```typescript
import { ErrorBoundary } from '@/src/components/error-boundary';
import { useErrorHandling } from '@/src/hooks/use-error-handling';

function MyComponent() {
  const { handleAsyncError, clearError, error } = useErrorHandling();
  
  const handleAction = async () => {
    try {
      await riskyOperation();
    } catch (error) {
      handleAsyncError(error, "User action failed");
    }
  };
  
  return (
    <ErrorBoundary level="component">
      {/* Component JSX */}
    </ErrorBoundary>
  );
}
```

## 🔧 Advanced Error Handling Patterns

### 1. Error Classification System

```typescript
// src/lib/enhanced-error-classification.ts
export enum ErrorSeverity {
  LOW = 'low',           // Minor issues, log only
  MEDIUM = 'medium',     // User-facing errors, show message
  HIGH = 'high',         // Service degradation, alert team
  CRITICAL = 'critical'  // System failure, immediate action
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication', 
  AUTHORIZATION = 'authorization',
  EXTERNAL_API = 'external_api',
  DATABASE = 'database',
  NETWORK = 'network',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system'
}

export interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  userMessage: string;
  technicalMessage: string;
  suggestedActions: string[];
  retryable: boolean;
  retryAfter?: number;
}

export function classifyError(error: unknown): ErrorClassification {
  // Circuit breaker errors
  if (error instanceof Error && error.message.includes('Circuit breaker')) {
    return {
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.HIGH,
      recoverable: true,
      userMessage: "Service temporarily unavailable. Please try again in a few minutes.",
      technicalMessage: error.message,
      suggestedActions: ["Reset circuit breaker", "Check system health"],
      retryable: true,
      retryAfter: 60000 // 1 minute
    };
  }
  
  // MEXC API errors
  if (error instanceof ApiError && error.apiName === 'mexc') {
    return {
      category: ErrorCategory.EXTERNAL_API,
      severity: error.apiStatusCode === 429 ? ErrorSeverity.MEDIUM : ErrorSeverity.HIGH,
      recoverable: true,
      userMessage: error.getUserMessage(),
      technicalMessage: error.message,
      suggestedActions: ["Check API credentials", "Verify rate limits"],
      retryable: error.apiStatusCode !== 401,
      retryAfter: error.apiStatusCode === 429 ? 30000 : 5000
    };
  }
  
  // Add more classification rules...
  
  // Default classification
  return {
    category: ErrorCategory.SYSTEM,
    severity: ErrorSeverity.MEDIUM,
    recoverable: false,
    userMessage: "An unexpected error occurred. Please try again.",
    technicalMessage: getErrorMessage(error),
    suggestedActions: ["Retry operation", "Contact support if persists"],
    retryable: true,
    retryAfter: 1000
  };
}
```

### 2. Recovery Strategy Implementation

```typescript
// src/lib/error-recovery-strategies.ts
export interface RecoveryStrategy {
  canRecover(error: ErrorClassification): boolean;
  recover(error: unknown, context: ErrorContext): Promise<RecoveryResult>;
}

export class CircuitBreakerRecovery implements RecoveryStrategy {
  canRecover(error: ErrorClassification): boolean {
    return error.category === ErrorCategory.SYSTEM && 
           error.technicalMessage.includes('Circuit breaker');
  }
  
  async recover(error: unknown, context: ErrorContext): Promise<RecoveryResult> {
    try {
      // Reset circuit breaker
      const circuitBreaker = context.circuitBreaker;
      await circuitBreaker.reset();
      
      // Validate system health
      const health = await context.healthChecker.validate();
      
      if (health.score > 80) {
        return {
          success: true,
          message: "Circuit breaker reset successfully",
          canRetry: true
        };
      }
      
      return {
        success: false,
        message: "System health insufficient for recovery",
        canRetry: false
      };
    } catch (recoveryError) {
      return {
        success: false,
        message: `Recovery failed: ${getErrorMessage(recoveryError)}`,
        canRetry: false
      };
    }
  }
}

export class ExponentialBackoffRecovery implements RecoveryStrategy {
  canRecover(error: ErrorClassification): boolean {
    return error.retryable && error.category === ErrorCategory.EXTERNAL_API;
  }
  
  async recover(error: unknown, context: ErrorContext): Promise<RecoveryResult> {
    const attempt = context.attemptNumber || 1;
    const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return {
      success: true,
      message: `Retry attempt ${attempt} after ${delay}ms delay`,
      canRetry: attempt < 5,
      retryAfter: delay
    };
  }
}
```

### 3. Enhanced Error Logging

```typescript
// src/lib/enhanced-error-logging.ts
export interface ErrorLogEntry {
  id: string;
  timestamp: Date;
  level: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  technicalDetails: any;
  userContext: {
    userId?: string;
    sessionId?: string;
    userAgent?: string;
    ip?: string;
  };
  systemContext: {
    service: string;
    environment: string;
    version: string;
    nodeVersion: string;
    memoryUsage: NodeJS.MemoryUsage;
  };
  stackTrace?: string;
  breadcrumbs: BreadcrumbEntry[];
  tags: Record<string, string>;
}

export class EnhancedErrorLogger {
  private breadcrumbs: BreadcrumbEntry[] = [];
  
  addBreadcrumb(message: string, category: string, data?: any) {
    this.breadcrumbs.push({
      timestamp: new Date(),
      message,
      category,
      data,
      level: 'info'
    });
    
    // Keep only last 20 breadcrumbs
    if (this.breadcrumbs.length > 20) {
      this.breadcrumbs.shift();
    }
  }
  
  async logError(
    error: unknown, 
    classification: ErrorClassification,
    context: ErrorContext
  ): Promise<void> {
    const entry: ErrorLogEntry = {
      id: generateErrorId(),
      timestamp: new Date(),
      level: classification.severity,
      category: classification.category,
      message: classification.userMessage,
      technicalDetails: {
        originalError: sanitizeError(error),
        classification,
        context
      },
      userContext: {
        userId: context.userId,
        sessionId: context.sessionId,
        userAgent: context.userAgent,
        ip: context.ip
      },
      systemContext: {
        service: context.service || 'mexc-sniper-bot',
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage()
      },
      stackTrace: getErrorStack(error),
      breadcrumbs: [...this.breadcrumbs],
      tags: context.tags || {}
    };
    
    // Store in database
    await this.storeErrorLog(entry);
    
    // Send to monitoring service
    await this.sendToMonitoring(entry);
    
    // Alert if critical
    if (classification.severity === ErrorSeverity.CRITICAL) {
      await this.sendAlert(entry);
    }
  }
  
  private async storeErrorLog(entry: ErrorLogEntry): Promise<void> {
    try {
      // Store in database for debugging and analytics
      await db.insert(errorLogs).values(entry);
    } catch (dbError) {
      // Fallback to file logging if database fails
      console.error('Failed to store error log in database:', dbError);
      await this.fallbackFileLogging(entry);
    }
  }
  
  private async sendToMonitoring(entry: ErrorLogEntry): Promise<void> {
    // Send to external monitoring services (Sentry, DataDog, etc.)
    if (process.env.NODE_ENV === 'production') {
      // Implementation for production monitoring
    }
  }
}
```

### 4. Frontend Error Hook

```typescript
// src/hooks/use-error-handling.ts
import { useState, useCallback } from 'react';
import { useToast } from './use-toast';

export interface UseErrorHandlingOptions {
  showToast?: boolean;
  logToConsole?: boolean;
  reportToService?: boolean;
}

export function useErrorHandling(options: UseErrorHandlingOptions = {}) {
  const [error, setError] = useState<ErrorInfo | null>(null);
  const { toast } = useToast();
  
  const handleError = useCallback(async (
    error: unknown,
    context?: string,
    customOptions?: Partial<UseErrorHandlingOptions>
  ) => {
    const finalOptions = { ...options, ...customOptions };
    const classification = classifyError(error);
    
    const errorInfo: ErrorInfo = {
      classification,
      context,
      timestamp: new Date(),
      id: generateErrorId()
    };
    
    setError(errorInfo);
    
    // Show user-friendly toast
    if (finalOptions.showToast !== false) {
      toast({
        variant: classification.severity === ErrorSeverity.HIGH ? 'destructive' : 'default',
        title: 'Error',
        description: classification.userMessage,
        duration: classification.severity === ErrorSeverity.LOW ? 3000 : 5000
      });
    }
    
    // Log to console in development
    if (finalOptions.logToConsole !== false && process.env.NODE_ENV === 'development') {
      console.error('Error handled by useErrorHandling:', {
        error,
        classification,
        context
      });
    }
    
    // Report to error logging service
    if (finalOptions.reportToService !== false) {
      try {
        await fetch('/api/errors/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: sanitizeError(error),
            classification,
            context,
            userAgent: navigator.userAgent,
            url: window.location.href
          })
        });
      } catch (reportError) {
        console.error('Failed to report error:', reportError);
      }
    }
  }, [options, toast]);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  const retryWithError = useCallback(async (
    operation: () => Promise<void>,
    maxRetries: number = 3
  ) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await operation();
        clearError();
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          handleError(error, `Final retry attempt (${attempt}/${maxRetries})`);
        } else {
          const classification = classifyError(error);
          if (!classification.retryable) {
            handleError(error, `Non-retryable error on attempt ${attempt}`);
            return;
          }
          
          // Wait before retry
          if (classification.retryAfter) {
            await new Promise(resolve => setTimeout(resolve, classification.retryAfter));
          }
        }
      }
    }
  }, [handleError, clearError]);
  
  return {
    error,
    handleError,
    clearError,
    retryWithError,
    hasError: error !== null
  };
}
```

## 📋 Migration Checklist by File Type

### API Routes (93 files to migrate)

**High Priority Routes:**
```bash
# Core MEXC functionality
app/api/mexc/account/route.ts
app/api/mexc/trade/route.ts
app/api/mexc/connectivity/route.ts

# Auto-sniping system
app/api/auto-sniping/execution/route.ts
app/api/auto-sniping/control/route.ts
app/api/auto-sniping/safety-monitoring/route.ts

# Health and monitoring
app/api/health/route.ts
app/api/monitoring/system-overview/route.ts
app/api/monitoring/real-time/route.ts
```

**Migration Pattern:**
1. Replace manual try/catch with `asyncHandler`
2. Use `apiResponse.success()` and `apiResponse.error()`
3. Replace `error instanceof Error` with `getErrorMessage(error)`
4. Add proper error context and metadata

### Service Layer (40+ files to migrate)

**High Priority Services:**
```bash
# Core services
src/services/mexc-api-client.ts
src/services/unified-mexc-service.ts
src/services/comprehensive-safety-coordinator.ts

# Trading services
src/services/optimized-auto-sniping-execution-engine.ts
src/services/multi-phase-trading-service.ts
src/services/advanced-risk-engine.ts
```

**Migration Pattern:**
1. Extend `BaseService` class
2. Use `safeExecute()` wrapper for operations
3. Implement proper error classification
4. Add error recovery strategies

### React Components (24 files to migrate)

**High Priority Components:**
```bash
src/components/api-credentials-form.tsx
src/components/auto-sniping/simple-auto-sniping-control.tsx
src/components/monitoring/real-time-performance.tsx
```

**Migration Pattern:**
1. Wrap with `<ErrorBoundary>`
2. Use `useErrorHandling()` hook
3. Replace manual error states with standard patterns
4. Add graceful degradation

### React Hooks (15 files to migrate)

**High Priority Hooks:**
```bash
src/hooks/use-api-credentials.ts
src/hooks/use-mexc-data.ts
src/hooks/use-auto-sniping-execution.ts
```

**Migration Pattern:**
1. Use `useErrorHandling()` for error management
2. Implement proper error recovery in queries
3. Add retry logic for failed requests
4. Standardize error states

## 🎯 Quick Wins (Immediate Impact)

### 1. Replace All `instanceof Error` Checks

**Script to find all occurrences:**
```bash
find . -name "*.ts" -o -name "*.tsx" | xargs grep -l "instanceof Error"
```

**Global replacement:**
```typescript
// Find: error instanceof Error ? error.message : "Unknown error"
// Replace: getErrorMessage(error)

// Find: error instanceof Error ? error.message : String(error)
// Replace: getErrorMessage(error)
```

### 2. Standardize API Error Responses

**Create migration script:**
```typescript
// scripts/migrate-api-errors.ts
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const apiFiles = glob.sync('app/api/**/route.ts');

apiFiles.forEach(file => {
  let content = readFileSync(file, 'utf8');
  
  // Replace manual NextResponse.json with apiResponse
  content = content.replace(
    /NextResponse\.json\(\s*{\s*error:\s*([^}]+)\s*},\s*{\s*status:\s*(\d+)\s*}\s*\)/g,
    'apiResponse.error($1, $2)'
  );
  
  // Add required imports
  if (!content.includes("import { apiResponse }")) {
    content = `import { apiResponse } from '@/src/lib/api-response';\n${content}`;
  }
  
  writeFileSync(file, content);
});
```

### 3. Add Error Boundaries to Critical Components

**Template for critical routes:**
```typescript
// Add to app/layout.tsx
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html>
      <body>
        <ErrorBoundary level="page">
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}

// Add to dashboard pages
export default function DashboardPage() {
  return (
    <ErrorBoundary level="page">
      <DashboardLayout>
        <ErrorBoundary level="section">
          <CriticalDashboardComponent />
        </ErrorBoundary>
      </DashboardLayout>
    </ErrorBoundary>
  );
}
```

## 🧪 Testing Strategy

### 1. Error Scenario Tests

```typescript
// tests/error-handling/error-scenarios.test.ts
describe('Error Handling Scenarios', () => {
  test('API route handles MEXC API failures', async () => {
    // Mock MEXC API failure
    jest.mocked(mexcClient.getAccount).mockRejectedValue(
      new ApiError('Rate limit exceeded', 'mexc', 429)
    );
    
    const response = await GET(request);
    
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      success: false,
      error: "Too many requests. Please try again later.",
      code: "RATE_LIMIT_ERROR",
      retryAfter: expect.any(Number)
    });
  });
  
  test('Service handles database connection failure', async () => {
    // Mock database failure
    jest.mocked(db.select).mockRejectedValue(
      new Error('Connection timeout')
    );
    
    const result = await service.getData();
    
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(DatabaseError);
  });
});
```

### 2. Error Recovery Tests

```typescript
describe('Error Recovery', () => {
  test('Circuit breaker recovery strategy', async () => {
    const recovery = new CircuitBreakerRecovery();
    const mockError = new Error('Circuit breaker is OPEN');
    const classification = classifyError(mockError);
    
    expect(recovery.canRecover(classification)).toBe(true);
    
    const result = await recovery.recover(mockError, mockContext);
    expect(result.success).toBe(true);
  });
});
```

This implementation guide provides concrete patterns and templates for migrating your error handling system to a production-ready standard. The key is to start with high-impact areas (API routes and core services) and gradually migrate the entire codebase using these standardized patterns.