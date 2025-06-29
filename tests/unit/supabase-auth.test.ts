import { describe, test, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { createSupabaseServerClient, getSession, syncUserWithDatabase, getUserFromDatabase, requireAuth } from '@/src/lib/supabase-auth';
import type { SupabaseUser } from '@/src/lib/supabase-auth';

// Mock imports
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
    }
  }))
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  }))
}));

vi.mock('@/src/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnValue(Promise.resolve()),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  hasSupabaseConfig: vi.fn(() => true)
}));

describe('Supabase Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSupabaseServerClient', () => {
    test('should create server client with cookie handling', () => {
      const client = createSupabaseServerClient();
      expect(client).toBeDefined();
    });
  });

  describe('getSession', () => {
    test('should return authenticated session for valid user', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: {
          full_name: 'Test User',
          username: 'testuser',
          picture: 'https://example.com/avatar.jpg'
        },
        email_confirmed_at: '2024-01-01T00:00:00Z'
      };

      const mockSession = {
        user: mockUser,
        access_token: 'test-access-token'
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await getSession();

      expect(result).toEqual({
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          username: 'testuser',
          picture: 'https://example.com/avatar.jpg',
          emailVerified: true
        },
        isAuthenticated: true,
        accessToken: 'test-access-token'
      });
    });

    test('should return unauthenticated session for no user', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await getSession();

      expect(result).toEqual({
        user: null,
        isAuthenticated: false
      });
    });

    test('should handle session errors gracefully', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Session error')
      });

      const result = await getSession();

      expect(result).toEqual({
        user: null,
        isAuthenticated: false
      });
    });
  });

  describe('syncUserWithDatabase', () => {
    const mockUser: SupabaseUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      username: 'testuser',
      picture: 'https://example.com/avatar.jpg',
      emailVerified: true
    };

    test('should create new user if not exists', async () => {
      // Mock user not found
      mockDb.limit.mockReturnValueOnce([]);

      const result = await syncUserWithDatabase(mockUser);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
          username: 'testuser'
        })
      );
      expect(result).toBe(true);
    });

    test('should update existing user', async () => {
      // Mock user found
      mockDb.limit.mockReturnValueOnce([{ id: 'test-user-id', email: 'old@example.com' }]);

      const result = await syncUserWithDatabase(mockUser);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          name: 'Test User',
          username: 'testuser'
        })
      );
      expect(result).toBe(true);
    });

    test('should handle database errors gracefully', async () => {
      mockDb.limit.mockRejectedValueOnce(new Error('Database error'));

      const result = await syncUserWithDatabase(mockUser);

      expect(result).toBe(false);
    });
  });

  describe('getUserFromDatabase', () => {
    test('should return user if found', async () => {
      const mockDbUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      };

      mockDb.limit.mockReturnValueOnce([mockDbUser]);

      const result = await getUserFromDatabase('test-user-id');

      expect(result).toEqual(mockDbUser);
    });

    test('should return null if user not found', async () => {
      mockDb.limit.mockReturnValueOnce([]);

      const result = await getUserFromDatabase('test-user-id');

      expect(result).toBeNull();
    });

    test('should handle database errors', async () => {
      mockDb.limit.mockRejectedValueOnce(new Error('Database error'));

      const result = await getUserFromDatabase('test-user-id');

      expect(result).toBeNull();
    });
  });

  describe('requireAuth', () => {
    test('should return user for authenticated session', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User'
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { 
          session: { 
            user: {
              id: 'test-user-id',
              email: 'test@example.com',
              user_metadata: { full_name: 'Test User' },
              email_confirmed_at: '2024-01-01T00:00:00Z'
            },
            access_token: 'test-token'
          } 
        },
        error: null
      });

      // Mock successful sync
      mockDb.limit.mockReturnValueOnce([]);

      const result = await requireAuth();

      expect(result).toEqual(
        expect.objectContaining({
          id: 'test-user-id',
          email: 'test@example.com'
        })
      );
    });

    test('should throw error for unauthenticated session', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      await expect(requireAuth()).rejects.toThrow('Authentication required');
    });
  });
});