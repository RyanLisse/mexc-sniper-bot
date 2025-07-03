/**
 * Central API Error Handler
 * Minimal implementation for build optimization
 */

import { NextResponse } from 'next/server';

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  if (error instanceof Error) {
    return NextResponse.json(
      { 
        error: error.message,
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { 
      error: 'Unknown error occurred',
      code: 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    },
    { status: 500 }
  );
}

export function createApiError(
  message: string,
  code: string = 'API_ERROR',
  status: number = 400,
  details?: any
): ApiError {
  return {
    message,
    code,
    status,
    details
  };
}

export function isApiError(error: any): error is ApiError {
  return error && typeof error.message === 'string';
}

// Add missing export aliases for compatibility
export class ValidationError extends Error {
  constructor(message: string, public code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
  }
}

// Missing functions for compatibility
export function withApiErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R | NextResponse> {
  return async (...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

export function validateUserId(userId: string | null | undefined): string {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new ValidationError('Valid userId is required', 'INVALID_USER_ID');
  }
  return userId.trim();
}

export function withDatabaseErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R | NextResponse> {
  return async (...args: T): Promise<R | NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('timeout') ||
        error.message.includes('connection')
      )) {
        return NextResponse.json(
          { 
            error: 'Database temporarily unavailable',
            code: 'DATABASE_ERROR',
            timestamp: new Date().toISOString()
          },
          { status: 503 }
        );
      }
      return handleApiError(error);
    }
  };
}