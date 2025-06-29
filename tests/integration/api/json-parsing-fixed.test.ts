/**
 * Fixed JSON Parsing API Integration Tests
 * 
 * Tests JSON parsing consistency across API routes without complex authentication mocking.
 * This test focuses specifically on the JSON parsing error handling that was failing.
 */

import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createJsonErrorResponse, parseJsonRequest } from '@/src/lib/api-json-parser';

describe('Fixed JSON Parsing API Integration Tests', () => {
  
  beforeAll(() => {
    console.log('🧪 Starting fixed JSON parsing tests...');
  });

  afterAll(() => {
    console.log('✅ Fixed JSON parsing tests completed');
  });

  describe('JSON Parsing Error Cases', () => {
    test('should handle "Expected property name or }" error consistently', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json}',
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_JSON');
      expect(result.error).toMatch(/JSON|syntax|invalid/i);
      expect(result.details).toBeDefined();
      
      console.log('✅ Successfully handled malformed JSON with position error');
    });

    test('should handle incomplete JSON consistently', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ "action": "test"',
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_JSON');
      expect(result.error).toBeDefined();
      expect(result.details).toBeDefined();
      
      console.log('✅ Successfully handled incomplete JSON');
    });

    test('should handle empty request body consistently', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_BODY');
      expect(result.error).toBe('Request body is required');
      
      console.log('✅ Successfully handled missing body');
    });

    test('should handle invalid content type consistently', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'plain text',
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_CONTENT_TYPE');
      expect(result.error).toBe('Invalid content type');
      expect(result.details).toContain('text/plain');
      
      console.log('✅ Successfully handled invalid content type');
    });

    test('should create consistent error responses', () => {
      const parseResult = {
        success: false as const,
        error: 'Invalid JSON in request body',
        errorCode: 'INVALID_JSON',
        details: 'Expected property name or \'}\'}'
      };

      const response = createJsonErrorResponse(parseResult);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid JSON in request body');
      expect(response.meta?.code).toBe('INVALID_JSON');
      expect(response.meta?.details).toContain('Expected property name');
      expect(response.meta?.timestamp).toBeDefined();
      
      console.log('✅ Successfully created consistent error response');
    });
  });

  describe('Successful JSON Parsing Cases', () => {
    test('should parse valid JSON successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', value: 123 }),
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ action: 'test', value: 123 });
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
      
      console.log('✅ Successfully parsed valid JSON');
    });

    test('should handle complex valid JSON', async () => {
      const complexData = {
        action: 'update_configuration',
        configuration: {
          enabled: true,
          monitoringIntervalMs: 30000,
          thresholds: {
            maxDrawdownPercentage: 5.0,
            maxDailyLossPercentage: 10.0
          }
        },
        metadata: {
          userId: 'test-user-123',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complexData),
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(complexData);
      expect(result.error).toBeUndefined();
      
      console.log('✅ Successfully parsed complex JSON');
    });
  });

  describe('Edge Cases and Security', () => {
    test('should handle null JSON value', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'null',
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EMPTY_BODY');
      expect(result.error).toBe('Empty request body');
      
      console.log('✅ Successfully handled null JSON');
    });

    test('should handle undefined JSON value', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'undefined',
      });

      const result = await parseJsonRequest(request);

      // undefined is not valid JSON, so this should fail at JSON parsing stage
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_JSON');
      
      console.log('✅ Successfully handled undefined JSON');
    });

    test('should handle very nested JSON', async () => {
      const nestedData = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: 'deep nested value',
                  array: [1, 2, { nested: true }]
                }
              }
            }
          }
        }
      };

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nestedData),
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(nestedData);
      
      console.log('✅ Successfully parsed deeply nested JSON');
    });

    test('should handle JSON with special characters', async () => {
      const specialData = {
        message: 'Hello "world" with \\n newlines and \t tabs',
        unicode: '🚀 Unicode emoji test 测试',
        escaped: 'Line 1\nLine 2\r\nLine 3',
        quotes: 'Single \' and double " quotes'
      };

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(specialData),
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(specialData);
      
      console.log('✅ Successfully parsed JSON with special characters');
    });
  });

  describe('Real-World Error Scenarios', () => {
    test('should handle common malformed JSON patterns', async () => {
      const malformedPatterns = [
        '{ invalid json',          // Missing closing brace
        '{ "key": value }',        // Unquoted value
        '{ "key": "value", }',     // Trailing comma
        '{ key: "value" }',        // Unquoted key
        '{ "key": "value" "key2": "value2" }',  // Missing comma
      ];

      for (const pattern of malformedPatterns) {
        const request = new NextRequest('http://localhost:3000/api/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: pattern,
        });

        const result = await parseJsonRequest(request);

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('INVALID_JSON');
        expect(result.error).toBeDefined();
        expect(result.details).toBeDefined();
      }
      
      console.log('✅ Successfully handled all common malformed JSON patterns');
    });

    test('should provide helpful error messages for debugging', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ "action": "test"', // Incomplete JSON
      });

      const result = await parseJsonRequest(request);
      const errorResponse = createJsonErrorResponse(result);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.details).toBeDefined();
      
      // Error response should be helpful for API consumers
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBeDefined();
      expect(errorResponse.meta?.code).toBeDefined();
      expect(errorResponse.meta?.timestamp).toBeDefined();
      
      console.log('✅ Error response provides helpful debugging information');
      console.log('Error details:', {
        error: errorResponse.error,
        code: errorResponse.meta?.code,
        details: errorResponse.meta?.details
      });
    });
  });
});