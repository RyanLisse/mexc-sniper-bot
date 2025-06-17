/**
 * Kinde Auth NextJS Client-side SDK Mock
 * 
 * This mock specifically targets the client-side imports from @kinde-oss/kinde-auth-nextjs/client
 * It provides React hooks and client-side authentication functions for testing.
 */

// Import the main mock utilities
const { 
  useKindeBrowserClient, 
  KindeProvider,
  getLoginUrl,
  getLogoutUrl,
  getRegisterUrl,
  __testUtils 
} = require('../kinde-auth-nextjs');

// Client-side hooks
export { useKindeBrowserClient } from '../kinde-auth-nextjs';

// Client-side provider
export { KindeProvider } from '../kinde-auth-nextjs';

// Client-side URL generators
export { getLoginUrl, getLogoutUrl, getRegisterUrl } from '../kinde-auth-nextjs';

// Additional client-specific hooks
export const useKindeAuth = jest.fn(() => {
  const client = useKindeBrowserClient();
  return {
    ...client,
    // Additional client-side utilities
    isFirstTime: jest.fn(() => false),
    hasPermission: jest.fn((permission) => {
      const perms = client.getPermissions();
      return perms.permissions.includes(permission);
    }),
    isMember: jest.fn((orgCode) => {
      const orgs = client.getUserOrganizations();
      return orgs.orgCodes.includes(orgCode);
    }),
  };
});

// Client-side permission hook
export const usePermission = jest.fn((permission) => {
  const client = useKindeBrowserClient();
  const permissionData = client.getPermission(permission);
  
  return {
    isGranted: permissionData.isGranted,
    isLoading: false,
    error: null,
  };
});

// Client-side organization hook
export const useOrganization = jest.fn(() => {
  const client = useKindeBrowserClient();
  const org = client.getOrganization();
  
  return {
    organization: org,
    isLoading: false,
    error: null,
  };
});

// Client-side user organizations hook
export const useUserOrganizations = jest.fn(() => {
  const client = useKindeBrowserClient();
  const orgs = client.getUserOrganizations();
  
  return {
    organizations: orgs.orgCodes.map(code => ({ orgCode: code })),
    isLoading: false,
    error: null,
  };
});

// Client-side authentication status hook
export const useAuthStatus = jest.fn(() => {
  const client = useKindeBrowserClient();
  
  return {
    isAuthenticated: client.isAuthenticated,
    isLoading: client.isLoading,
    user: client.user,
    error: client.error,
  };
});

// React Testing Library utilities
export const renderWithKindeProvider = jest.fn((component, options = {}) => {
  const { 
    user = __testUtils.getCurrentUser(),
    isAuthenticated = __testUtils.isAuthenticated(),
    ...renderOptions 
  } = options;
  
  // Set up test state
  if (isAuthenticated && user) {
    if (user === 'admin') {
      __testUtils.setAdmin();
    } else if (user === 'newUser') {
      __testUtils.setNewUser();
    } else {
      __testUtils.setAuthenticated();
    }
  } else {
    __testUtils.setUnauthenticated();
  }
  
  // Mock rendering (in actual implementation, would wrap with KindeProvider)
  return {
    ...component,
    rerender: jest.fn(),
    unmount: jest.fn(),
  };
});

// Export test utilities for client-side testing
export { __testUtils } from '../kinde-auth-nextjs';

// Default export
export default {
  useKindeBrowserClient,
  useKindeAuth,
  usePermission,
  useOrganization,
  useUserOrganizations,
  useAuthStatus,
  KindeProvider,
  getLoginUrl,
  getLogoutUrl,
  getRegisterUrl,
  renderWithKindeProvider,
  __testUtils,
};