/**
 * Kinde Auth NextJS Server-side SDK Mock
 * 
 * This mock specifically targets the server-side imports from @kinde-oss/kinde-auth-nextjs/server
 * It provides server-specific authentication functions for testing.
 */

// Import the main mock utilities
const { 
  getKindeServerSession, 
  withAuth, 
  handleAuth,
  getIdToken,
  createKindeManagementAPIClient,
  __testUtils 
} = require('../kinde-auth-nextjs');

// Server-specific session management
export { getKindeServerSession } from '../kinde-auth-nextjs';

// Server-specific route protection
export { withAuth } from '../kinde-auth-nextjs';

// Server-specific auth handlers
export { handleAuth } from '../kinde-auth-nextjs';

// Server-specific token management
export { getIdToken } from '../kinde-auth-nextjs';

// Server-specific management API
export { createKindeManagementAPIClient } from '../kinde-auth-nextjs';

// Edge runtime specific functions
export const getKindeServerSessionEdge = jest.fn(() => getKindeServerSession());

// Server-specific middleware helpers
export const requireAuth = jest.fn(async (request, context) => {
  const session = getKindeServerSession();
  const user = await session.getUser();
  const isAuthenticated = await session.isAuthenticated();
  
  if (!isAuthenticated || !user) {
    throw new Error('Authentication required');
  }
  
  return { user, session };
});

// Server-specific permission checking
export const requirePermission = jest.fn(async (permission, request, context) => {
  const { session } = await requireAuth(request, context);
  const permissionCheck = await session.getPermission(permission);
  
  if (!permissionCheck.isGranted) {
    throw new Error(`Permission '${permission}' required`);
  }
  
  return permissionCheck;
});

// Server-specific organization checking
export const requireOrganization = jest.fn(async (orgCode, request, context) => {
  const { session } = await requireAuth(request, context);
  const organizations = await session.getUserOrganizations();
  
  if (!organizations.orgCodes.includes(orgCode)) {
    throw new Error(`Organization access '${orgCode}' required`);
  }
  
  return organizations;
});

// Export test utilities for server-side testing
export { __testUtils } from '../kinde-auth-nextjs';

// Default export
export default {
  getKindeServerSession,
  getKindeServerSessionEdge,
  withAuth,
  handleAuth,
  getIdToken,
  createKindeManagementAPIClient,
  requireAuth,
  requirePermission,
  requireOrganization,
  __testUtils,
};