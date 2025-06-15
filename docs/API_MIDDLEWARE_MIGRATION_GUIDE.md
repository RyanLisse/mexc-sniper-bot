# API Middleware Migration Guide

This guide explains how to migrate existing API routes to use the new standardized middleware system.

## Overview

The new middleware system provides:

- **Standardized Authentication** - Consistent auth handling across all routes
- **Automatic Validation** - Schema-based request validation with detailed error messages
- **Enhanced Security** - Built-in rate limiting, IP blocking, and security logging
- **Consistent Responses** - Standardized JSON response format with proper HTTP status codes
- **Better Error Handling** - Centralized error handling with detailed logging
- **CORS Support** - Configurable CORS handling for frontend integration
- **Request Logging** - Optional request/response logging for debugging

## Migration Steps

### 1. Import the New Middleware

Replace manual auth and response handling imports:

```typescript
// OLD - Manual imports
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/src/lib/api-auth';
import { createSuccessResponse, createErrorResponse, apiResponse } from '@/src/lib/api-response';

// NEW - Middleware system
import { NextRequest } from 'next/server';
import { userHandler, ApiContext } from '@/src/lib/api-middleware';
import { UserPreferencesQuerySchema } from '@/src/lib/api-schemas';
```

### 2. Choose the Right Handler Type

Select the appropriate handler based on your route's security requirements:

#### Public Routes (No Authentication)
```typescript
export const GET = publicHandler({
  rateLimit: 'general',
  cors: true,
})(async (request: NextRequest, context: ApiContext) => {
  // Handler logic
});
```

#### Authenticated Routes
```typescript
export const GET = authenticatedHandler({
  rateLimit: 'auth',
  logging: true,
})(async (request: NextRequest, context: ApiContext) => {
  // Handler logic - context.user is available
});
```

#### User-Specific Routes
```typescript
export const GET = userHandler('query', {
  validation: UserPreferencesQuerySchema,
  rateLimit: 'auth',
})(async (request: NextRequest, context: ApiContext) => {
  // Handler logic - user access automatically validated
});
```

#### Sensitive Data Routes
```typescript
export const POST = sensitiveDataHandler({
  parseBody: true,
  validation: ApiCredentialsCreateSchema,
  userAccess: 'body',
})(async (request: NextRequest, context: ApiContext) => {
  // Handler logic - enhanced security and logging
});
```

#### Trading Routes
```typescript
export const POST = tradingHandler({
  validation: CompleteTradingOrderSchema,
})(async (request: NextRequest, context: ApiContext) => {
  // Handler logic - optimized for trading operations
});
```

### 3. Update Handler Function Signature

Change from Next.js response handling to context-based responses:

```typescript
// OLD
export async function GET(request: NextRequest) {
  try {
    const user = await requireApiAuth(request);
    const data = await fetchData();
    return apiResponse(createSuccessResponse(data));
  } catch (error) {
    return apiResponse(createErrorResponse(error.message), 500);
  }
}

// NEW
export const GET = authenticatedHandler()(async (request: NextRequest, context: ApiContext) => {
  const data = await fetchData();
  return context.success(data);
});
```

### 4. Use Context Helpers for Responses

Replace manual response creation with context helpers:

```typescript
// OLD
return apiResponse(
  createSuccessResponse(data, { message: 'Success' }),
  HTTP_STATUS.CREATED
);

// NEW
return context.success(data, { message: 'Success' });

// OLD
return apiResponse(
  createErrorResponse('Invalid input'),
  HTTP_STATUS.BAD_REQUEST
);

// NEW
return context.error('Invalid input');

// OLD
return apiResponse(
  createValidationErrorResponse('userId', 'User ID is required'),
  HTTP_STATUS.BAD_REQUEST
);

// NEW
return context.validationError('userId', 'User ID is required');
```

### 5. Remove Manual Validation

Replace manual validation with schema-based validation:

```typescript
// OLD
export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.userId) {
    return apiResponse(
      createValidationErrorResponse('userId', 'userId is required'),
      HTTP_STATUS.BAD_REQUEST
    );
  }
  if (typeof body.amount !== 'number' || body.amount <= 0) {
    return apiResponse(
      createValidationErrorResponse('amount', 'Amount must be a positive number'),
      HTTP_STATUS.BAD_REQUEST
    );
  }
  // Handler logic...
}

// NEW
export const POST = userHandler('body', {
  parseBody: true,
  validation: {
    userId: 'required',
    amount: (value) => {
      const num = Number(value);
      if (isNaN(num) || num <= 0) {
        throw new Error('Amount must be a positive number');
      }
      return num;
    },
  },
})(async (request: NextRequest, context: ApiContext) => {
  // context.body is already validated
  const { userId, amount } = context.body;
  // Handler logic...
});
```

### 6. Remove Manual Auth Checks

The middleware handles authentication automatically:

```typescript
// OLD
export async function GET(request: NextRequest) {
  try {
    const user = await requireApiAuth(request);
    const userId = searchParams.get('userId');
    if (user.id !== userId) {
      return apiResponse(
        createErrorResponse('Access denied'),
        HTTP_STATUS.FORBIDDEN
      );
    }
    // Handler logic...
  } catch (error) {
    return apiResponse(
      createErrorResponse('Authentication required'),
      HTTP_STATUS.UNAUTHORIZED
    );
  }
}

// NEW
export const GET = userHandler('query')(async (request: NextRequest, context: ApiContext) => {
  // Authentication and user access validation handled automatically
  // context.user is available and verified
  // Handler logic...
});
```

## Complete Migration Examples

### Before: Manual Implementation

```typescript
// app/api/user-preferences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/src/lib/api-auth';
import { createSuccessResponse, createErrorResponse, apiResponse, HTTP_STATUS } from '@/src/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiAuth(request);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return apiResponse(
        createErrorResponse('userId parameter is required'),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (user.id !== userId) {
      return apiResponse(
        createErrorResponse('Access denied'),
        HTTP_STATUS.FORBIDDEN
      );
    }

    const data = await fetchUserPreferences(userId);
    return apiResponse(createSuccessResponse(data));
  } catch (error) {
    console.error('Error:', error);
    return apiResponse(
      createErrorResponse(error.message),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
```

### After: Middleware Implementation

```typescript
// app/api/user-preferences/route.ts
import { NextRequest } from 'next/server';
import { userHandler, ApiContext } from '@/src/lib/api-middleware';
import { UserPreferencesQuerySchema } from '@/src/lib/api-schemas';

export const GET = userHandler('query', {
  validation: UserPreferencesQuerySchema,
  rateLimit: 'auth',
  logging: true,
})(async (request: NextRequest, context: ApiContext) => {
  const userId = context.searchParams.get('userId')!;
  const data = await fetchUserPreferences(userId);
  return context.success(data);
});
```

## Configuration Options

### Authentication Options
- `'none'` - No authentication required
- `'optional'` - Authentication optional (context.user may be null)
- `'required'` - Authentication required
- `'admin'` - Admin authentication required
- `'user-access'` - User authentication with access validation

### Rate Limiting Options
- `'none'` - No rate limiting
- `'general'` - General rate limiting (100 requests/minute)
- `'auth'` - Auth rate limiting (5 attempts/15 minutes)
- `'authStrict'` - Strict auth rate limiting (10 attempts/hour)

### Validation Options
- Schema object with field validation rules
- Custom validation function
- Validation functions from `@/src/lib/api-schemas`

### User Access Options
- `'query'` - Validate userId from query parameters
- `'body'` - Validate userId from request body
- `'none'` - No user access validation

### Logging Options
- `true` - Enable basic request/response logging
- `false` - Disable logging
- `LoggingConfig` object for detailed configuration

### CORS Options
- `true` - Enable CORS with default settings
- `false` - Disable CORS
- `CorsConfig` object for detailed configuration

## Testing the Migration

1. **Functionality Test**: Ensure all endpoints work the same as before
2. **Authentication Test**: Verify auth requirements are enforced
3. **Validation Test**: Test invalid inputs return proper error messages
4. **Rate Limiting Test**: Verify rate limiting works as expected
5. **Error Handling Test**: Ensure errors are handled gracefully

## Migration Checklist

- [ ] Import new middleware functions
- [ ] Choose appropriate handler type
- [ ] Update function signature to use ApiContext
- [ ] Replace manual auth checks with middleware config
- [ ] Replace manual validation with schema validation
- [ ] Update response handling to use context helpers
- [ ] Remove try-catch blocks (handled by middleware)
- [ ] Test all endpoints thoroughly
- [ ] Update API documentation
- [ ] Monitor logs for any issues

## Common Migration Issues

1. **Type Errors**: Ensure ApiContext is imported and used correctly
2. **Validation Errors**: Check schema definitions match expected data types
3. **Auth Issues**: Verify the correct auth type is configured
4. **Response Format**: Ensure context.success/error are used instead of manual responses
5. **Missing Body Parsing**: Set `parseBody: true` when handling POST/PUT requests

## Benefits After Migration

- **Reduced Code**: 50-70% less boilerplate code per route
- **Consistent Security**: Standardized auth and rate limiting
- **Better Error Messages**: Detailed validation error responses
- **Improved Logging**: Centralized request/response logging
- **Type Safety**: Better TypeScript support with ApiContext
- **Easier Testing**: Standardized patterns make testing simpler