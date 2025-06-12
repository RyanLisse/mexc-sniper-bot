/**
 * Example API Route with New Error Handling
 * 
 * This file demonstrates how to use the new standardized error handling system.
 * Copy these patterns to update other API routes.
 */

import { NextRequest } from 'next/server';
import { db, userPreferences } from '@/src/db';
import { eq } from 'drizzle-orm';
import { 
  createSuccessResponse, 
  apiResponse,
  HTTP_STATUS 
} from '@/src/lib/api-response';
import {
  ValidationError,
  NotFoundError,
  DatabaseError,
  BusinessLogicError,
  AuthenticationError,
} from '@/src/lib/errors';
import { 
  asyncHandler, 
  ErrorContext,
  safeExecute,
  executeWithRecovery,
  StandardErrors
} from '@/src/lib/error-handler';

/**
 * Example GET endpoint with new error handling
 */
export const GET = asyncHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  
  // Example 1: Validation Error
  if (!userId) {
    throw new ValidationError('userId parameter is required', 'userId');
  }

  // Example 2: Safe database execution with error context
  const result = await safeExecute(
    async () => {
      return await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);
    },
    'fetch_user_preferences',
    { userId }
  );

  // Example 3: Not Found Error
  if (result.length === 0) {
    throw new NotFoundError('User preferences', userId);
  }

  // Example 4: Business Logic Error
  const prefs = result[0];
  if (prefs.defaultBuyAmountUsdt < 10) {
    throw new BusinessLogicError(
      'Buy amount must be at least 10 USDT',
      'MINIMUM_BUY_AMOUNT'
    );
  }

  // Success response
  return apiResponse(
    createSuccessResponse({
      userId: prefs.userId,
      defaultBuyAmountUsdt: prefs.defaultBuyAmountUsdt,
      // ... other fields
    })
  );
});

/**
 * Example POST endpoint with validation and recovery
 */
export const POST = asyncHandler(async (request: NextRequest) => {
  // Example 5: Authentication check
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    throw new AuthenticationError('Bearer token required');
  }

  const body = await request.json();
  const { userId, amount } = body;

  // Example 6: Multiple validation errors
  if (!userId) {
    throw new ValidationError('userId is required', 'userId');
  }

  if (amount !== undefined) {
    if (typeof amount !== 'number') {
      throw new ValidationError('Amount must be a number', 'amount', amount);
    }
    if (amount < 0) {
      throw new ValidationError('Amount cannot be negative', 'amount', amount);
    }
  }

  // Example 7: Database operation with error recovery
  const updateResult = await executeWithRecovery(
    async () => {
      const result = await db
        .update(userPreferences)
        .set({ defaultBuyAmountUsdt: amount })
        .where(eq(userPreferences.userId, userId))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError('User preferences', userId);
      }

      return result[0];
    },
    {
      shouldRecover: (error, attempt) => {
        // Retry on database connection errors
        return error instanceof DatabaseError && attempt < 3;
      },
      recover: async (error) => {
        // Could implement fallback logic here
        throw error; // For now, just rethrow
      }
    }
  );

  return apiResponse(
    createSuccessResponse(updateResult, {
      message: 'Preferences updated successfully'
    })
  );
});

/**
 * Example with standard error responses
 */
export const DELETE = asyncHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  // Using standard error responses
  if (!userId) {
    return StandardErrors.badRequest('userId parameter is required');
  }

  // Check authorization (example)
  const hasPermission = false; // Would check actual permissions
  if (!hasPermission) {
    return StandardErrors.forbidden();
  }

  // Resource not found
  const exists = false; // Would check if resource exists
  if (!exists) {
    return StandardErrors.notFound('User preferences');
  }

  // Success
  return apiResponse(
    createSuccessResponse(null, {
      message: 'Deleted successfully'
    })
  );
});

/**
 * Example showing all error types
 */
export const PATCH = asyncHandler(async (request: NextRequest) => {
  // Build error context for logging
  const context = new ErrorContext()
    .addRequest(request)
    .addOperation('update_preferences')
    .build();

  try {
    const body = await request.json();
    
    // Various error examples...
    throw new ValidationError('Example validation error', 'field');
    // throw new AuthenticationError();
    // throw new AuthorizationError();
    // throw new NotFoundError('Resource', '123');
    // throw new ConflictError('Resource already exists', 'DUPLICATE_KEY');
    // throw new BusinessLogicError('Insufficient balance', 'INSUFFICIENT_FUNDS');
    // throw new DatabaseError('Connection failed');
    // throw new TimeoutError('API call', 5000);
    // throw new NetworkError('Failed to connect to service');
    // throw new ApiError('External API failed', 'MEXC', 500);
    // throw new RateLimitError(60, 100);
    // throw new ConfigurationError('API_KEY');
    // throw new TradingError('Insufficient balance', 'BTC/USDT', 'buy', 100);
    
  } catch (error) {
    // Error will be handled by asyncHandler
    throw error;
  }
});