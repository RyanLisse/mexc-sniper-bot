import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  publicRoute,
  authenticatedRoute,
  userQueryRoute,
  userBodyRoute,
  adminRoute,
  secureRoute,
  tradingRoute,
  sensitiveDataRoute,
  validateRequiredFields,
  getPaginationParams,
  getFilterParams,
} from '../../src/lib/auth-decorators';

// Mock the auth utilities
vi.mock('../../src/lib/api-auth', () => ({
  withAuth: vi.fn((handler) => handler),
  withUserAuth: vi.fn((handler) => handler),
  withAdminAuth: vi.fn((handler) => handler),
  withAuthOptions: vi.fn((handler, options) => {
    // Return a function that calls the handler with a mock user
    return async (request: any, ...args: any[]) => {
      const mockUser = { id: 'user123', email: 'test@example.com' };
      // Only pass the user once - the decorators handle the user parameter
      return await handler(request, mockUser);
    };
  }),
  getUserIdFromQuery: vi.fn(() => 'user123'),
  getUserIdFromBody: vi.fn(() => Promise.resolve('user123')),
}));

// Mock API response utilities
vi.mock('../../src/lib/api-response', () => ({
  createErrorResponse: vi.fn((message, details) => ({ error: message, ...details })),
  apiResponse: vi.fn((data, status = 200) => new Response(JSON.stringify(data), { status })),
  HTTP_STATUS: {
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    INTERNAL_SERVER_ERROR: 500,
  },
}));

describe('Authentication Consolidation', () => {
  let mockRequest: NextRequest;
  let mockUser: any;

  beforeEach(() => {
    mockRequest = new NextRequest('http://localhost:3008/api/test');
    mockUser = { id: 'user123', email: 'test@example.com' };
    vi.clearAllMocks();
  });

  describe('Route Decorators', () => {
    it('should handle public routes without authentication', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('success'));
      const decoratedHandler = publicRoute(handler);

      const response = await decoratedHandler(mockRequest);
      
      expect(handler).toHaveBeenCalledWith(mockRequest);
      expect(response).toBeInstanceOf(Response);
    });

    it('should handle public route errors gracefully', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Test error'));
      const decoratedHandler = publicRoute(handler);

      // Suppress console.error during test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const response = await decoratedHandler(mockRequest);
      
      expect(response.status).toBe(500);
      expect(consoleSpy).toHaveBeenCalledWith('[Public Route] Error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });

    it('should apply authentication to authenticated routes', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('success'));
      const decoratedHandler = authenticatedRoute(handler);

      // The mock withAuth should call the handler directly
      const response = await decoratedHandler(mockRequest, mockUser);
      
      expect(handler).toHaveBeenCalledWith(mockRequest, mockUser);
    });

    it('should apply user-specific authentication to user query routes', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('success'));
      const decoratedHandler = userQueryRoute(handler);

      const response = await decoratedHandler(mockRequest, mockUser);
      
      expect(handler).toHaveBeenCalledWith(mockRequest, mockUser);
    });

    it('should apply admin authentication to admin routes', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('success'));
      const decoratedHandler = adminRoute(handler);

      const response = await decoratedHandler(mockRequest, mockUser);
      
      expect(handler).toHaveBeenCalledWith(mockRequest, mockUser);
    });

    it('should apply secure authentication to secure routes', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('success'));
      const decoratedHandler = secureRoute(handler);

      const response = await decoratedHandler(mockRequest, mockUser);
      
      expect(handler).toHaveBeenCalledWith(mockRequest, mockUser);
    });

    it('should apply trading authentication to trading routes', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('success'));
      const decoratedHandler = tradingRoute(handler);

      const response = await decoratedHandler(mockRequest, mockUser);
      
      expect(handler).toHaveBeenCalledWith(mockRequest, mockUser);
    });

    it('should apply sensitive data authentication to sensitive routes', async () => {
      const handler = vi.fn().mockResolvedValue(new Response('success'));
      const decoratedHandler = sensitiveDataRoute(handler);

      const response = await decoratedHandler(mockRequest, mockUser);
      
      expect(handler).toHaveBeenCalledWith(mockRequest, mockUser);
    });
  });

  describe('Utility Functions', () => {
    it('should validate required fields correctly', () => {
      const body = { field1: 'value1', field2: 'value2' };
      const requiredFields = ['field1', 'field2'];
      
      const result = validateRequiredFields(body, requiredFields);
      expect(result).toBeNull();
    });

    it('should return error for missing required fields', () => {
      const body = { field1: 'value1' };
      const requiredFields = ['field1', 'field2'];
      
      const result = validateRequiredFields(body, requiredFields);
      expect(result).toBe('field2 is required');
    });

    it('should extract pagination parameters correctly', () => {
      const request = new NextRequest('http://localhost:3000/api/test?page=2&limit=50');
      
      const { page, limit } = getPaginationParams(request);
      
      expect(page).toBe(2);
      expect(limit).toBe(50);
    });

    it('should use default pagination parameters', () => {
      const request = new NextRequest('http://localhost:3000/api/test');
      
      const { page, limit } = getPaginationParams(request);
      
      expect(page).toBe(1);
      expect(limit).toBe(20);
    });

    it('should enforce pagination limits', () => {
      const request = new NextRequest('http://localhost:3000/api/test?page=0&limit=200');
      
      const { page, limit } = getPaginationParams(request);
      
      expect(page).toBe(1); // Minimum 1
      expect(limit).toBe(100); // Maximum 100
    });

    it('should extract filter parameters correctly', () => {
      const request = new NextRequest('http://localhost:3000/api/test?status=active&type=user&invalid=ignored');
      const allowedFilters = ['status', 'type'];
      
      const filters = getFilterParams(request, allowedFilters);
      
      expect(filters).toEqual({
        status: 'active',
        type: 'user',
      });
      expect(filters.invalid).toBeUndefined();
    });

    it('should return empty object when no filters match', () => {
      const request = new NextRequest('http://localhost:3000/api/test?invalid=ignored');
      const allowedFilters = ['status', 'type'];
      
      const filters = getFilterParams(request, allowedFilters);
      
      expect(filters).toEqual({});
    });
  });

  describe('User Body Route Integration', () => {
    it('should handle user body route with valid data', async () => {
      // Mock request.json() to return user data
      const mockJson = vi.fn().mockResolvedValue({
        userId: 'user123',
        data: 'test'
      });

      const requestWithBody = {
        ...mockRequest,
        json: mockJson,
        headers: {
          get: vi.fn((name: string) => {
            if (name === 'content-type') return 'application/json';
            if (name === 'user-agent') return 'test-agent';
            return null;
          })
        },
        method: 'POST',
        bodyUsed: false,
        body: '{"userId":"user123","data":"test"}'
      } as any;

      const handler = vi.fn().mockResolvedValue(new Response('success'));
      const decoratedHandler = userBodyRoute(handler);

      const response = await decoratedHandler(requestWithBody);

      expect(mockJson).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledWith(
        requestWithBody,
        mockUser,
        { userId: 'user123', data: 'test' }
      );
      expect(response).toBeInstanceOf(Response);
    });
  });
});
