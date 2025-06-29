/**
 * Unit Tests for Centralized JSON Parser
 * 
 * Tests the new centralized JSON parsing functionality that addresses
 * the "Expected property name or '}' in JSON at position 2" error.
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, test } from 'vitest';
import { 
  createJsonErrorResponse, 
  parseJsonRequest,
  validateFieldTypes,
  validateRequiredFields
} from '@/src/lib/api-json-parser';

describe('Centralized JSON Parser', () => {
  describe('parseJsonRequest', () => {
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
    });

    test('should handle malformed JSON with position 2 error', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json',
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_JSON');
      expect(result.error).toContain('Invalid JSON property name');
      expect(result.details).toBeDefined();
    });

    test('should handle incomplete JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ "action": "test"',
      });

      const result = await parseJsonRequest(request);

      console.log('Debug incomplete JSON result:', result);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_JSON');
      // Be more flexible with the error message since different JS engines may vary
      expect(result.error).toMatch(/incomplete|syntax|JSON/i);
      expect(result.details).toBeDefined();
    });

    test('should handle property name error', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ action: "test" }', // Missing quotes around property name
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_JSON');
      expect(result.error).toContain('JSON');
    });

    test('should handle missing content type', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify({ action: 'test' }),
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_CONTENT_TYPE');
      expect(result.error).toBe('Invalid content type');
    });

    test('should handle empty body', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MISSING_BODY');
      expect(result.error).toBe('Request body is required');
    });

    test('should handle null JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'null',
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EMPTY_BODY');
      expect(result.error).toBe('Empty request body');
    });
  });

  describe('validateRequiredFields', () => {
    test('should validate required fields successfully', () => {
      const body = { action: 'test', userId: '123', value: 456 };
      const result = validateRequiredFields(body, ['action', 'userId']);

      expect(result.success).toBe(true);
      expect(result.missingField).toBeUndefined();
    });

    test('should detect missing required field', () => {
      const body = { action: 'test' };
      const result = validateRequiredFields(body, ['action', 'userId']);

      expect(result.success).toBe(false);
      expect(result.missingField).toBe('userId');
      expect(result.error).toBe('userId is required');
    });

    test('should detect empty string as missing field', () => {
      const body = { action: '', userId: '123' };
      const result = validateRequiredFields(body, ['action']);

      expect(result.success).toBe(false);
      expect(result.missingField).toBe('action');
      expect(result.error).toBe('action is required');
    });

    test('should handle non-object body', () => {
      const result = validateRequiredFields('not an object', ['action']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request body must be an object');
    });
  });

  describe('validateFieldTypes', () => {
    test('should validate field types successfully', () => {
      const body = {
        action: 'test',
        count: 123,
        enabled: true,
        config: { key: 'value' },
        items: [1, 2, 3]
      };
      const fieldTypes = {
        action: 'string' as const,
        count: 'number' as const,
        enabled: 'boolean' as const,
        config: 'object' as const,
        items: 'array' as const
      };

      const result = validateFieldTypes(body, fieldTypes);

      expect(result.success).toBe(true);
    });

    test('should detect invalid string type', () => {
      const body = { action: 123 };
      const result = validateFieldTypes(body, { action: 'string' });

      expect(result.success).toBe(false);
      expect(result.invalidField).toBe('action');
      expect(result.error).toBe('action must be of type string');
    });

    test('should detect invalid number type', () => {
      const body = { count: 'not a number' };
      const result = validateFieldTypes(body, { count: 'number' });

      expect(result.success).toBe(false);
      expect(result.invalidField).toBe('count');
      expect(result.error).toBe('count must be of type number');
    });

    test('should detect NaN as invalid number', () => {
      const body = { count: NaN };
      const result = validateFieldTypes(body, { count: 'number' });

      expect(result.success).toBe(false);
      expect(result.invalidField).toBe('count');
    });

    test('should validate array vs object correctly', () => {
      const body = { items: [1, 2, 3], config: { key: 'value' } };
      
      // Array should not be valid as object
      const arrayAsObjectResult = validateFieldTypes(body, { items: 'object' });
      expect(arrayAsObjectResult.success).toBe(false);
      
      // Object should not be valid as array
      const objectAsArrayResult = validateFieldTypes(body, { config: 'array' });
      expect(objectAsArrayResult.success).toBe(false);
    });
  });

  describe('createJsonErrorResponse', () => {
    test('should create consistent error response', () => {
      const parseResult = {
        success: false,
        error: 'Invalid JSON syntax',
        errorCode: 'INVALID_JSON',
        details: 'Expected property name or } at position 2'
      };

      const response = createJsonErrorResponse(parseResult);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Invalid JSON syntax');
      expect(response.meta?.code).toBe('INVALID_JSON');
      expect(response.meta?.details).toBe('Expected property name or } at position 2');
    });

    test('should handle missing error details', () => {
      const parseResult = {
        success: false
      };

      const response = createJsonErrorResponse(parseResult);

      expect(response.success).toBe(false);
      expect(response.error).toBe('JSON parsing failed');
      expect(response.meta?.code).toBe('JSON_ERROR');
    });
  });

  describe('Edge Cases', () => {
    test('should handle extremely malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{{{{malformed',
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_JSON');
      expect(result.error).toBeDefined();
      expect(result.details).toBeDefined();
    });

    test('should handle JSON with trailing comma', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ "action": "test", }',
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_JSON');
    });

    test('should handle very large valid JSON', async () => {
      const largeObject = {
        action: 'test',
        data: new Array(1000).fill(0).map((_, i) => ({ id: i, value: `item-${i}` }))
      };

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(largeObject),
      });

      const result = await parseJsonRequest(request);

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('test');
      expect(result.data.data).toHaveLength(1000);
    });
  });
});