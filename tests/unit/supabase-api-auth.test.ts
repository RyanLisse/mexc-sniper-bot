import { describe, test, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock the auth modules
vi.mock('@/src/lib/supabase-auth');
vi.mock('@/src/lib/kinde-auth');
vi.mock('next/headers');

// Import the mocked modules
import { getSession as getSupabaseSession } from '@/src/lib/supabase-auth';
import { getSession as getKindeSession } from '@/src/lib/kinde-auth';

// Mock implementations
const mockGetSupabaseSession = getSupabaseSession as any;
const mockGetKindeSession = getKindeSession as any;

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  }))
}));

describe('Authentication API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Supabase Session API', () => {
    test('should return user data for authenticated session', async () => {
      // Mock authenticated Supabase session
      mockGetSupabaseSession.mockResolvedValue({
        user: {
          id: 'supabase-user-id',
          email: 'test@example.com',
          name: 'Test User',
          username: 'testuser',
          picture: 'https://example.com/avatar.jpg',
          emailVerified: true
        },
        isAuthenticated: true,
        accessToken: 'supabase-access-token'
      });

      // Import and test the API route
      const { GET } = await import('@/app/api/auth/supabase-session/route');
      
      const request = new NextRequest('http://localhost:3000/api/auth/supabase-session');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toEqual({
        user: {
          id: 'supabase-user-id',
          email: 'test@example.com',
          name: 'Test User',
          username: 'testuser',
          image: 'https://example.com/avatar.jpg',
          emailVerified: true
        },
        session: {
          id: 'supabase-user-id',
          userId: 'supabase-user-id',
          accessToken: 'supabase-access-token'
        }
      });
    });

    test('should return 401 for unauthenticated session', async () => {
      // Mock unauthenticated session
      mockGetSupabaseSession.mockResolvedValue({
        user: null,
        isAuthenticated: false
      });

      const { GET } = await import('@/app/api/auth/supabase-session/route');
      
      const request = new NextRequest('http://localhost:3000/api/auth/supabase-session');
      const response = await GET(request);
      
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data).toEqual({ user: null });
    });

    test('should handle session errors gracefully', async () => {
      // Mock session error
      mockGetSupabaseSession.mockRejectedValue(new Error('Session error'));

      const { GET } = await import('@/app/api/auth/supabase-session/route');
      
      const request = new NextRequest('http://localhost:3000/api/auth/supabase-session');
      const response = await GET(request);
      
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data).toEqual({ user: null });
    });
  });

  describe('Kinde Session API (Legacy)', () => {
    test('should return user data for authenticated Kinde session', async () => {
      // Mock authenticated Kinde session
      mockGetKindeSession.mockResolvedValue({
        user: {
          id: 'kinde-user-id',
          email: 'test@example.com',
          given_name: 'Test',
          family_name: 'User',
          picture: 'https://example.com/avatar.jpg',
          username: 'testuser'
        },
        isAuthenticated: true
      });

      const { GET } = await import('@/app/api/auth/session/route');
      
      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.user).toEqual({
        id: 'kinde-user-id',
        email: 'test@example.com',
        name: 'Test User',
        username: 'testuser',
        image: 'https://example.com/avatar.jpg'
      });
    });

    test('should return 401 for unauthenticated Kinde session', async () => {
      // Mock unauthenticated session
      mockGetKindeSession.mockResolvedValue({
        user: null,
        isAuthenticated: false
      });

      const { GET } = await import('@/app/api/auth/session/route');
      
      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data).toEqual({ user: null });
    });
  });

  describe('Authentication Comparison', () => {
    test('should handle different user ID formats', () => {
      const kindeUserId = 'kp_1234567890abcdef';
      const supabaseUserId = '123e4567-e89b-12d3-a456-426614174000';
      
      // Kinde IDs start with 'kp_'
      expect(kindeUserId).toMatch(/^kp_/);
      
      // Supabase IDs are UUIDs
      expect(supabaseUserId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    test('should handle different session structures', () => {
      const kindeSession = {
        user: {
          id: 'kp_1234567890abcdef',
          email: 'test@example.com',
          given_name: 'Test',
          family_name: 'User'
        },
        isAuthenticated: true
      };

      const supabaseSession = {
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          email: 'test@example.com',
          name: 'Test User',
          emailVerified: true
        },
        isAuthenticated: true,
        accessToken: 'access-token'
      };

      expect(kindeSession.user.id).toMatch(/^kp_/);
      expect(supabaseSession.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(supabaseSession.accessToken).toBeDefined();
      expect(kindeSession).not.toHaveProperty('accessToken');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed requests', async () => {
      // Mock session throwing an error
      mockGetSupabaseSession.mockRejectedValue(new Error('Invalid request'));

      const { GET } = await import('@/app/api/auth/supabase-session/route');
      
      const request = new NextRequest('http://localhost:3000/api/auth/supabase-session');
      const response = await GET(request);
      
      expect(response.status).toBe(401);
    });

    test('should handle network errors gracefully', async () => {
      // Mock network error
      mockGetKindeSession.mockRejectedValue(new Error('Network error'));

      const { GET } = await import('@/app/api/auth/session/route');
      
      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      
      expect(response.status).toBe(401);
    });
  });

  describe('Response Format Validation', () => {
    test('should return consistent response format for Supabase', async () => {
      mockGetSupabaseSession.mockResolvedValue({
        user: {
          id: 'test-id',
          email: 'test@example.com',
          name: 'Test User'
        },
        isAuthenticated: true,
        accessToken: 'token'
      });

      const { GET } = await import('@/app/api/auth/supabase-session/route');
      
      const request = new NextRequest('http://localhost:3000/api/auth/supabase-session');
      const response = await GET(request);
      
      const data = await response.json();
      
      // Validate response structure
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('session');
      expect(data.user).toHaveProperty('id');
      expect(data.user).toHaveProperty('email');
      expect(data.session).toHaveProperty('userId');
      expect(data.session).toHaveProperty('accessToken');
    });

    test('should return consistent response format for Kinde', async () => {
      mockGetKindeSession.mockResolvedValue({
        user: {
          id: 'test-id',
          email: 'test@example.com',
          given_name: 'Test',
          family_name: 'User'
        },
        isAuthenticated: true
      });

      const { GET } = await import('@/app/api/auth/session/route');
      
      const request = new NextRequest('http://localhost:3000/api/auth/session');
      const response = await GET(request);
      
      const data = await response.json();
      
      // Validate response structure
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('session');
      expect(data.user).toHaveProperty('id');
      expect(data.user).toHaveProperty('email');
      expect(data.user).toHaveProperty('name');
      expect(data.session).toHaveProperty('userId');
    });
  });
});