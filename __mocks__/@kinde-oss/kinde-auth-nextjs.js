/**
 * Comprehensive Kinde Auth NextJS SDK Mock
 * 
 * This mock provides complete coverage of the Kinde Auth SDK for testing purposes.
 * It supports different user states and scenarios for comprehensive test coverage.
 */

// Mock user data for different test scenarios
const mockUsers = {
  authenticated: {
    id: 'test-user-123',
    email: 'test@mexcsniper.com',
    given_name: 'Test',
    family_name: 'User',
    picture: 'https://example.com/avatar.jpg',
    username: 'testuser',
  },
  admin: {
    id: 'admin-user-456',
    email: 'admin@mexcsniper.com',
    given_name: 'Admin',
    family_name: 'User',
    picture: 'https://example.com/admin-avatar.jpg',
    username: 'adminuser',
  },
  newUser: {
    id: 'new-user-789',
    email: 'newuser@mexcsniper.com',
    given_name: 'New',
    family_name: 'User',
    picture: null,
    username: null,
  },
};

// Mock permissions for different user types
const mockPermissions = {
  'test-user-123': {
    permissions: ['read:metrics', 'read:dashboard'],
    orgCode: 'mexc-test-org',
  },
  'admin-user-456': {
    permissions: ['read:metrics', 'read:dashboard', 'write:admin', 'manage:users'],
    orgCode: 'mexc-admin-org',
  },
  'new-user-789': {
    permissions: ['read:dashboard'],
    orgCode: 'mexc-basic-org',
  },
};

// Test state management
let currentTestUser = null;
let isCurrentlyAuthenticated = false;

// Test utilities for setting up different scenarios
const testUtils = {
  setAuthenticated: (userType = 'authenticated') => {
    currentTestUser = mockUsers[userType];
    isCurrentlyAuthenticated = true;
  },
  setUnauthenticated: () => {
    currentTestUser = null;
    isCurrentlyAuthenticated = false;
  },
  setAdmin: () => {
    currentTestUser = mockUsers.admin;
    isCurrentlyAuthenticated = true;
  },
  setNewUser: () => {
    currentTestUser = mockUsers.newUser;
    isCurrentlyAuthenticated = true;
  },
  getCurrentUser: () => currentTestUser,
  isAuthenticated: () => isCurrentlyAuthenticated,
};

// Mock the main server session function
export const getKindeServerSession = jest.fn(() => ({
  getUser: jest.fn(async () => {
    if (!isCurrentlyAuthenticated || !currentTestUser) {
      return null;
    }
    return currentTestUser;
  }),
  
  isAuthenticated: jest.fn(async () => isCurrentlyAuthenticated),
  
  getPermissions: jest.fn(async () => {
    if (!isCurrentlyAuthenticated || !currentTestUser) {
      return { permissions: [] };
    }
    return mockPermissions[currentTestUser.id] || { permissions: [] };
  }),
  
  getPermission: jest.fn(async (permission) => {
    if (!isCurrentlyAuthenticated || !currentTestUser) {
      return { isGranted: false };
    }
    const userPermissions = mockPermissions[currentTestUser.id]?.permissions || [];
    return { isGranted: userPermissions.includes(permission) };
  }),
  
  getOrganization: jest.fn(async () => {
    if (!isCurrentlyAuthenticated || !currentTestUser) {
      return null;
    }
    return { orgCode: mockPermissions[currentTestUser.id]?.orgCode || null };
  }),
  
  getUserOrganizations: jest.fn(async () => {
    if (!isCurrentlyAuthenticated || !currentTestUser) {
      return { orgCodes: [] };
    }
    return { 
      orgCodes: [mockPermissions[currentTestUser.id]?.orgCode || 'default-org'] 
    };
  }),
  
  getClaim: jest.fn(async (claim) => {
    if (!isCurrentlyAuthenticated || !currentTestUser) {
      return { name: claim, value: null };
    }
    // Mock some common claims
    const claims = {
      email: currentTestUser.email,
      given_name: currentTestUser.given_name,
      family_name: currentTestUser.family_name,
      picture: currentTestUser.picture,
    };
    return { name: claim, value: claims[claim] || null };
  }),
  
  getAccessToken: jest.fn(async () => {
    if (!isCurrentlyAuthenticated) {
      return null;
    }
    return 'mock-access-token-jwt-string';
  }),
  
  refreshTokens: jest.fn(async () => {
    if (!isCurrentlyAuthenticated) {
      throw new Error('Not authenticated');
    }
    return { access_token: 'new-mock-access-token' };
  }),
}));

// Mock client-side hooks
export const useKindeBrowserClient = jest.fn(() => ({
  user: currentTestUser,
  isAuthenticated: isCurrentlyAuthenticated,
  isLoading: false,
  error: null,
  login: jest.fn(),
  logout: jest.fn(),
  register: jest.fn(),
  getUser: jest.fn(() => currentTestUser),
  getPermissions: jest.fn(() => {
    if (!currentTestUser) return { permissions: [] };
    return mockPermissions[currentTestUser.id] || { permissions: [] };
  }),
  getPermission: jest.fn((permission) => {
    if (!currentTestUser) return { isGranted: false };
    const userPermissions = mockPermissions[currentTestUser.id]?.permissions || [];
    return { isGranted: userPermissions.includes(permission) };
  }),
  getClaim: jest.fn((claim) => {
    if (!currentTestUser) return { name: claim, value: null };
    const claims = {
      email: currentTestUser.email,
      given_name: currentTestUser.given_name,
      family_name: currentTestUser.family_name,
      picture: currentTestUser.picture,
    };
    return { name: claim, value: claims[claim] || null };
  }),
  getOrganization: jest.fn(() => {
    if (!currentTestUser) return null;
    return { orgCode: mockPermissions[currentTestUser.id]?.orgCode || null };
  }),
  getUserOrganizations: jest.fn(() => {
    if (!currentTestUser) return { orgCodes: [] };
    return { 
      orgCodes: [mockPermissions[currentTestUser.id]?.orgCode || 'default-org'] 
    };
  }),
}));

// Mock authentication flow handlers
export const handleAuth = jest.fn(async (request, options) => {
  // Mock the auth handlers for login, logout, callback, etc.
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  if (pathname.includes('/login')) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/dashboard' }
    });
  }
  
  if (pathname.includes('/logout')) {
    testUtils.setUnauthenticated();
    return new Response(null, {
      status: 302,
      headers: { Location: '/' }
    });
  }
  
  if (pathname.includes('/callback')) {
    testUtils.setAuthenticated();
    return new Response(null, {
      status: 302,
      headers: { Location: '/dashboard' }
    });
  }
  
  return new Response('Not Found', { status: 404 });
});

// Mock route protection middleware
export const withAuth = jest.fn((handler, options = {}) => {
  return async (request, context) => {
    // In test mode, check if authentication is required
    if (options.isRequired !== false && !isCurrentlyAuthenticated) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Call the original handler with mock context
    return handler(request, {
      ...context,
      user: currentTestUser,
      isAuthenticated: isCurrentlyAuthenticated,
    });
  };
});

// Mock the KindeProvider for React components
export const KindeProvider = jest.fn(({ children }) => children);

// Mock auth URL generators
export const getLoginUrl = jest.fn(() => 'http://localhost:3008/api/auth/login');
export const getLogoutUrl = jest.fn(() => 'http://localhost:3008/api/auth/logout');
export const getRegisterUrl = jest.fn(() => 'http://localhost:3008/api/auth/register');

// Mock token management
export const getIdToken = jest.fn(async () => {
  if (!isCurrentlyAuthenticated) return null;
  return 'mock-id-token-jwt-string';
});

// Edge runtime compatibility mocks
export const getKindeServerSessionEdge = jest.fn(() => getKindeServerSession());

// Mock management API (for advanced features)
export const createKindeManagementAPIClient = jest.fn(() => ({
  usersApi: {
    getUser: jest.fn(async (userId) => mockUsers.authenticated),
    updateUser: jest.fn(async (userId, data) => ({ ...mockUsers.authenticated, ...data })),
  },
  organizationsApi: {
    getOrganization: jest.fn(async (orgCode) => ({ orgCode, name: 'Test Organization' })),
  },
}));

// Error simulation helpers for testing error conditions
const errorUtils = {
  simulateNetworkError: () => {
    getKindeServerSession.mockImplementation(() => {
      throw new Error('Network error: Unable to connect to Kinde');
    });
  },
  simulateTokenExpired: () => {
    getKindeServerSession.mockImplementation(() => ({
      getUser: jest.fn(async () => {
        throw new Error('Token expired');
      }),
      isAuthenticated: jest.fn(async () => false),
    }));
  },
  simulatePermissionDenied: () => {
    currentTestUser = { ...mockUsers.authenticated };
    mockPermissions[currentTestUser.id] = { permissions: [] };
  },
  resetErrors: () => {
    // Reset all mocks to default behavior
    jest.clearAllMocks();
  },
};

// Export test utilities for use in test files
export const __testUtils = {
  ...testUtils,
  errorUtils,
  mockUsers,
  mockPermissions,
};

// Default export for compatibility
export default {
  getKindeServerSession,
  useKindeBrowserClient,
  handleAuth,
  withAuth,
  KindeProvider,
  getLoginUrl,
  getLogoutUrl,
  getRegisterUrl,
  getIdToken,
  getKindeServerSessionEdge,
  createKindeManagementAPIClient,
  __testUtils,
};