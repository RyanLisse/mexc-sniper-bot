# Error Handling Migration Guide

This guide explains how to migrate existing API routes and components to use the new standardized error handling system.

## Overview

The new error handling system provides:
- **Consistent error types** with proper status codes
- **Centralized error logging** with context
- **User-friendly error messages** separate from technical details
- **Error recovery strategies** for resilient operations
- **React error boundaries** for graceful UI failures

## API Route Migration

### Before (Old Pattern)

```typescript
export async function GET(request: NextRequest) {
  try {
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return apiResponse(
        createValidationErrorResponse('userId', 'userId parameter is required'),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // ... database operations ...
    
  } catch (error) {
    console.error('[API] Failed:', error);
    return apiResponse(
      handleApiError(error),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
```

### After (New Pattern)

```typescript
import { ValidationError, NotFoundError } from '@/src/lib/errors';
import { asyncHandler } from '@/src/lib/error-handler';

export const GET = asyncHandler(async (request: NextRequest) => {
  const userId = searchParams.get('userId');
  
  // Throw typed errors instead of returning responses
  if (!userId) {
    throw new ValidationError('userId parameter is required', 'userId');
  }

  const result = await db.select()...;
  
  if (result.length === 0) {
    throw new NotFoundError('User preferences', userId);
  }

  // Only return success responses
  return apiResponse(createSuccessResponse(result[0]));
});
```

## Error Types Reference

### ValidationError
```typescript
throw new ValidationError(
  'Email is invalid',      // message
  'email',                 // field name (optional)
  'not-an-email',         // value (optional)
  { source: 'signup' }    // context (optional)
);
```

### AuthenticationError
```typescript
throw new AuthenticationError('Invalid token');
// or with default message:
throw new AuthenticationError();
```

### AuthorizationError
```typescript
throw new AuthorizationError('Admin access required');
```

### NotFoundError
```typescript
throw new NotFoundError(
  'User',     // resource type
  '123'       // resource ID (optional)
);
```

### ApiError (External APIs)
```typescript
throw new ApiError(
  'MEXC API request failed',
  'MEXC',                    // API name
  429,                       // API status code
  { error: 'rate_limit' }    // API response
);
```

### DatabaseError
```typescript
throw new DatabaseError(
  'Failed to update user',
  'UPDATE users SET ...',    // query (optional)
  originalError              // original DB error
);
```

### BusinessLogicError
```typescript
throw new BusinessLogicError(
  'Insufficient balance for trade',
  'INSUFFICIENT_FUNDS'      // business rule code
);
```

### TradingError
```typescript
throw new TradingError(
  'Order size too small',
  'BTC/USDT',              // symbol
  'buy',                   // action
  0.001                    // amount
);
```

## React Component Migration

### Adding Error Boundaries

```typescript
// In your layout or page component
import { ErrorBoundary } from '@/src/components/error-boundary';

export default function DashboardLayout({ children }) {
  return (
    <ErrorBoundary 
      level="page"
      onError={(error, errorInfo) => {
        // Log to monitoring service
        console.error('Dashboard error:', error);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

### Component-Level Error Boundaries

```typescript
// Wrap individual components
<ErrorBoundary level="component" isolate>
  <TradingChart symbol="BTC/USDT" />
</ErrorBoundary>
```

### Using HOC Pattern

```typescript
import { withErrorBoundary } from '@/src/components/error-boundary';

const TradingChart = ({ symbol }) => {
  // Component logic
};

export default withErrorBoundary(TradingChart, {
  level: 'component',
  fallback: <div>Failed to load chart</div>
});
```

## Database Operations

### Safe Execution Pattern

```typescript
import { safeExecute } from '@/src/lib/error-handler';
import { DatabaseError } from '@/src/lib/errors';

const result = await safeExecute(
  async () => {
    return await db.transaction(async (tx) => {
      // Complex database operations
    });
  },
  'update_user_preferences',  // operation name
  { userId, action: 'update' } // context
);
```

### With Recovery

```typescript
import { executeWithRecovery } from '@/src/lib/error-handler';

const data = await executeWithRecovery(
  async () => {
    return await fetchFromAPI();
  },
  {
    shouldRecover: (error, attempt) => {
      return error instanceof NetworkError && attempt < 3;
    },
    recover: async (error) => {
      // Return cached data on network failure
      return getCachedData();
    }
  }
);
```

## Error Context Building

```typescript
import { ErrorContext } from '@/src/lib/error-handler';

// Build rich error context
const context = new ErrorContext()
  .addUser(userId)
  .addRequest(request)
  .addOperation('create_order')
  .add('symbol', 'BTC/USDT')
  .add('amount', 0.1)
  .build();

// Use in error handling
throw new TradingError('Insufficient balance', 'BTC/USDT', 'buy', 0.1, context);
```

## Migration Checklist

For each API route:

- [ ] Import new error types and asyncHandler
- [ ] Replace try/catch with asyncHandler wrapper
- [ ] Replace error response returns with thrown errors
- [ ] Use appropriate error types (ValidationError, NotFoundError, etc.)
- [ ] Add error context where helpful
- [ ] Remove console.error calls (handled centrally now)
- [ ] Test error scenarios

For React components:

- [ ] Add ErrorBoundary to layouts and pages
- [ ] Wrap risky components with error boundaries
- [ ] Provide user-friendly fallback UI
- [ ] Add error logging callbacks
- [ ] Test error scenarios

## Testing Error Handling

```typescript
// In your tests
import { ValidationError } from '@/src/lib/errors';

it('should throw ValidationError for missing userId', async () => {
  const response = await GET(mockRequest);
  
  expect(response.status).toBe(400);
  const body = await response.json();
  expect(body.success).toBe(false);
  expect(body.meta.code).toBe('VALIDATION_ERROR');
});
```

## Monitoring Integration

The error logging service can be integrated with monitoring services:

```typescript
// In your app initialization
import { errorLogger } from '@/src/services/error-logging-service';

// Configure external service
errorLogger.configureMonitoring({
  service: 'sentry',
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

## Best Practices

1. **Use specific error types** - Don't use generic Error class
2. **Add context** - Include relevant data for debugging
3. **Keep messages user-friendly** - Technical details go in context
4. **Log at appropriate level** - Errors vs warnings vs info
5. **Handle errors early** - Validate inputs at the beginning
6. **Use error boundaries** - Prevent whole app crashes
7. **Test error paths** - Include error scenarios in tests

## Common Patterns

### Input Validation
```typescript
// Validate all inputs first
if (!userId) throw new ValidationError('User ID required', 'userId');
if (!email) throw new ValidationError('Email required', 'email');
if (!isValidEmail(email)) throw new ValidationError('Invalid email format', 'email', email);
```

### Resource Access
```typescript
const resource = await db.query(...);
if (!resource) {
  throw new NotFoundError('Resource', resourceId);
}
if (resource.userId !== currentUserId) {
  throw new AuthorizationError('Not authorized to access this resource');
}
```

### External API Calls
```typescript
try {
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new ApiError(
      `API request failed`,
      'ExternalAPI',
      response.status,
      await response.text()
    );
  }
  return response.json();
} catch (error) {
  if (error instanceof ApiError) throw error;
  throw new NetworkError(`Failed to connect to API: ${error.message}`);
}
```

## Questions?

If you have questions about migrating specific patterns, check the example route at:
`/app/api/example-with-new-errors/route.ts`