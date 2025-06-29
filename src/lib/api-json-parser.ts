/**
 * Centralized JSON Parsing Error Handler
 * 
 * Provides consistent JSON parsing and error handling across all API routes.
 * Addresses the "Expected property name or '}' in JSON at position 2" error
 * and standardizes error response formats.
 */

import type { NextRequest } from 'next/server';
import { createErrorResponse } from './api-response';

export interface JsonParseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  details?: string;
}

/**
 * Enhanced JSON parsing with comprehensive error handling
 * Handles malformed JSON, empty bodies, and edge cases consistently
 */
export async function parseJsonRequest<T = any>(request: NextRequest): Promise<JsonParseResult<T>> {
  try {
    // Check if body exists
    if (!request.body) {
      return {
        success: false,
        error: 'Request body is required',
        errorCode: 'MISSING_BODY',
        details: 'No request body provided'
      };
    }

    // Check content type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {
        success: false,
        error: 'Invalid content type',
        errorCode: 'INVALID_CONTENT_TYPE',
        details: `Expected application/json, received: ${contentType || 'none'}`
      };
    }

    // Check if body has already been consumed
    if (request.bodyUsed) {
      return {
        success: false,
        error: 'Request body already consumed',
        errorCode: 'BODY_CONSUMED',
        details: 'Request body has already been read'
      };
    }

    let body: T;
    try {
      body = await request.json();
    } catch (jsonError) {
      // Handle specific JSON parsing errors
      let errorMessage = 'Invalid JSON in request body';
      let details = 'JSON parsing failed';
      
      if (jsonError instanceof SyntaxError) {
        const syntaxMessage = jsonError.message;
        
        // Handle common JSON syntax errors
        if (syntaxMessage.includes('Unexpected end of JSON input') || syntaxMessage.includes('Unterminated string')) {
          errorMessage = 'Incomplete JSON';
          details = 'JSON input is incomplete or truncated';
        } else if (syntaxMessage.includes('Expected property name')) {
          errorMessage = 'Invalid JSON property name';
          details = `JSON property error: ${syntaxMessage}`;
        } else if (syntaxMessage.includes('Unexpected token')) {
          errorMessage = 'Invalid JSON syntax';
          details = `Malformed JSON: ${syntaxMessage}`;
        } else {
          errorMessage = 'JSON syntax error';
          details = syntaxMessage;
        }
      } else if (jsonError instanceof Error) {
        details = jsonError.message;
      }

      return {
        success: false,
        error: errorMessage,
        errorCode: 'INVALID_JSON',
        details
      };
    }

    // Additional validation for parsed body
    if (body === null || body === undefined) {
      return {
        success: false,
        error: 'Empty request body',
        errorCode: 'EMPTY_BODY',
        details: 'Request body cannot be null or undefined'
      };
    }

    return {
      success: true,
      data: body
    };

  } catch (error) {
    return {
      success: false,
      error: 'Request processing failed',
      errorCode: 'PROCESSING_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Validate required fields in parsed JSON body
 */
export function validateRequiredFields(
  body: any,
  requiredFields: string[]
): { success: boolean; missingField?: string; error?: string } {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      error: 'Request body must be an object'
    };
  }

  for (const field of requiredFields) {
    if (!(field in body) || body[field] === null || body[field] === undefined || body[field] === '') {
      return {
        success: false,
        missingField: field,
        error: `${field} is required`
      };
    }
  }

  return { success: true };
}

/**
 * Validate field types in parsed JSON body
 */
export function validateFieldTypes(
  body: any,
  fieldTypes: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>
): { success: boolean; invalidField?: string; error?: string } {
  if (!body || typeof body !== 'object') {
    return {
      success: false,
      error: 'Request body must be an object'
    };
  }

  for (const [field, expectedType] of Object.entries(fieldTypes)) {
    if (field in body) {
      const value = body[field];
      let isValid = false;

      switch (expectedType) {
        case 'string':
          isValid = typeof value === 'string';
          break;
        case 'number':
          isValid = typeof value === 'number' && !isNaN(value);
          break;
        case 'boolean':
          isValid = typeof value === 'boolean';
          break;
        case 'object':
          isValid = value !== null && typeof value === 'object' && !Array.isArray(value);
          break;
        case 'array':
          isValid = Array.isArray(value);
          break;
      }

      if (!isValid) {
        return {
          success: false,
          invalidField: field,
          error: `${field} must be of type ${expectedType}`
        };
      }
    }
  }

  return { success: true };
}

/**
 * Create consistent error response for JSON parsing failures
 */
export function createJsonErrorResponse(parseResult: JsonParseResult) {
  return createErrorResponse(parseResult.error || 'JSON parsing failed', {
    message: parseResult.error || 'Invalid request body',
    code: parseResult.errorCode || 'JSON_ERROR',
    details: parseResult.details
  });
}

/**
 * Wrapper for API routes that need JSON parsing with consistent error handling
 */
export function withJsonParsing<T = any>(
  handler: (request: NextRequest, body: T, ...args: any[]) => Promise<Response>
) {
  return async (request: NextRequest, ...args: any[]): Promise<Response> => {
    const parseResult = await parseJsonRequest<T>(request);
    
    if (!parseResult.success) {
      return new Response(
        JSON.stringify(createJsonErrorResponse(parseResult)),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return handler(request, parseResult.data!, ...args);
  };
}