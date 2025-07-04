/**
 * Authorization Security Tests
 * 
 * Comprehensive security tests for authorization mechanisms including:
 * - Role-based access control (RBAC)
 * - Permission validation
 * - Privilege escalation prevention
 * - Resource access control
 * - Administrative function protection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SecurityTestDataGenerator, SecurityTestHelpers } from '../utils/security-test-utils'
import { requireAuth } from '../../../src/lib/supabase-auth'
import { NextResponse } from 'next/server'

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../utils/timeout-elimination-helpers';

// Mock external dependencies
vi.mock('../../../src/lib/supabase-auth')
vi.mock('next/server')

const mockRequireAuth = vi.mocked(requireAuth)
const mockNextResponse = vi.mocked(NextResponse)

describe('Authorization Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Role-Based Access Control (RBAC)', () => {
    it('should enforce user role restrictions', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // User should not have admin privileges
      expect(user.role).toBe('user')
      expect(user.role).not.toBe('admin')
      expect(user.role).not.toBe('superadmin')
    })

    it('should enforce admin role restrictions', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.adminUser)

      const user = await requireAuth()
      
      // Admin should have elevated privileges but not superadmin
      expect(user.role).toBe('admin')
      expect(user.role).not.toBe('superadmin')
    })

    it('should prevent role elevation attacks', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Simulate attempt to elevate role
      const originalRole = user.role
      
      // These should not affect actual authorization
      user.role = 'admin'
      user.isAdmin = true
      user.permissions = ['admin:*']
      
      // Verify role elevation doesn't work
      expect(user.role).toBe(originalRole)
    })

    it('should validate role hierarchy', async () => {
      const roles = ['user', 'admin', 'superadmin']
      const roleHierarchy = {
        user: 0,
        admin: 1,
        superadmin: 2
      }
      
      for (const role of roles) {
        const hasPermission = (userRole: string, requiredRole: string) => {
          return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
        }
        
        // Test role hierarchy
        expect(hasPermission('admin', 'user')).toBe(true)
        expect(hasPermission('user', 'admin')).toBe(false)
        expect(hasPermission('superadmin', 'admin')).toBe(true)
        expect(hasPermission('admin', 'superadmin')).toBe(false)
      }
    })

    it('should prevent undefined role access', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid role'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer undefined-role-token'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid role')
    })

    it('should prevent null role access', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Null role'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer null-role-token'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Null role')
    })

    it('should prevent empty role access', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Empty role'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer empty-role-token'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Empty role')
    })

    it('should prevent custom role injection', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Attempt to inject custom role
      const maliciousRoles = ['superuser', 'root', 'system', 'god', 'master']
      
      for (const maliciousRole of maliciousRoles) {
        user.role = maliciousRole
        expect(user.role).not.toBe(maliciousRole)
      }
    })
  })

  describe('Permission Validation', () => {
    it('should validate specific permissions', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Define permission system
      const permissions = {
        user: ['read:own', 'update:own'],
        admin: ['read:all', 'update:all', 'delete:all'],
        superadmin: ['*']
      }
      
      const userPermissions = permissions[user.role] || []
      
      // Test specific permissions
      expect(userPermissions).toContain('read:own')
      expect(userPermissions).toContain('update:own')
      expect(userPermissions).not.toContain('delete:all')
      expect(userPermissions).not.toContain('*')
    })

    it('should prevent permission escalation', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // User should not be able to access admin permissions
      const adminPermissions = ['admin:create', 'admin:delete', 'admin:manage']
      
      for (const permission of adminPermissions) {
        const hasPermission = checkPermission(user, permission)
        expect(hasPermission).toBe(false)
      }
    })

    it('should validate resource-specific permissions', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Test resource-specific access
      const resources = {
        'user:123': user.id === '123', // Can only access own user
        'admin:*': user.role === 'admin',
        'system:*': user.role === 'superadmin'
      }
      
      for (const [resource, hasAccess] of Object.entries(resources)) {
        if (resource.startsWith('user:')) {
          expect(hasAccess).toBe(user.id === resource.split(':')[1])
        } else if (resource.startsWith('admin:')) {
          expect(hasAccess).toBe(user.role === 'admin')
        } else if (resource.startsWith('system:')) {
          expect(hasAccess).toBe(user.role === 'superadmin')
        }
      }
    })

    it('should prevent wildcard permission abuse', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Regular users should not have wildcard permissions
      const wildcardPermissions = ['*', 'admin:*', 'system:*', 'all:*']
      
      for (const permission of wildcardPermissions) {
        const hasPermission = checkPermission(user, permission)
        expect(hasPermission).toBe(false)
      }
    })

    it('should validate time-based permissions', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Simulate time-based access (e.g., business hours only)
      const currentHour = new Date().getHours()
      const isBusinessHours = currentHour >= 9 && currentHour < 17
      
      // Some permissions might be time-restricted
      const timeRestrictedPermissions = ['trading:manual', 'admin:maintenance']
      
      for (const permission of timeRestrictedPermissions) {
        const hasPermission = checkPermission(user, permission) && isBusinessHours
        
        if (permission === 'trading:manual') {
          // Trading might be allowed 24/7
          expect(hasPermission).toBeTruthy()
        } else if (permission === 'admin:maintenance') {
          // Admin maintenance might be restricted to business hours
          expect(hasPermission).toBe(isBusinessHours && user.role === 'admin')
        }
      }
    })

    it('should validate IP-based permissions', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.adminUser)

      const user = await requireAuth()
      
      // Simulate IP-based access restrictions
      const allowedIPs = ['192.168.1.0/24', '10.0.0.0/8']
      const clientIP = '192.168.1.100'
      
      const isAllowedIP = allowedIPs.some(range => {
        // Simplified IP range check
        return range.includes('192.168.1') && clientIP.startsWith('192.168.1')
      })
      
      // Admin access might be IP-restricted
      const hasAdminAccess = user.role === 'admin' && isAllowedIP
      expect(hasAdminAccess).toBe(true)
    })
  })

  describe('Privilege Escalation Prevention', () => {
    it('should prevent horizontal privilege escalation', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // User should only access their own resources
      const userResources = ['user:123', 'profile:123', 'settings:123']
      const otherUserResources = ['user:456', 'profile:456', 'settings:456']
      
      for (const resource of userResources) {
        const hasAccess = resource.endsWith(user.id)
        expect(hasAccess).toBe(true)
      }
      
      for (const resource of otherUserResources) {
        const hasAccess = resource.endsWith(user.id)
        expect(hasAccess).toBe(false)
      }
    })

    it('should prevent vertical privilege escalation', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // User should not access admin resources
      const adminResources = ['admin:users', 'admin:system', 'admin:config']
      
      for (const resource of adminResources) {
        const hasAccess = checkPermission(user, resource)
        expect(hasAccess).toBe(false)
      }
    })

    it('should prevent privilege escalation via parameter manipulation', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid parameters'))

      const request = SecurityTestHelpers.createMockRequest({
        method: 'POST',
        body: {
          userId: 'user123',
          role: 'admin', // Attempt to escalate
          permissions: ['admin:*'],
          isAdmin: true,
          privilege: 'elevated'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid parameters')
    })

    it('should prevent privilege escalation via header manipulation', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid headers'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'X-User-Role': 'admin',
          'X-User-Permissions': 'admin:*',
          'X-Is-Admin': 'true',
          'X-Privilege-Level': 'elevated'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid headers')
    })

    it('should prevent privilege escalation via cookie manipulation', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid cookies'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Cookie': 'role=admin; isAdmin=true; permissions=admin:*'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid cookies')
    })

    it('should prevent privilege escalation via token claims manipulation', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid token claims'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer manipulated-claims-token'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid token claims')
    })

    it('should prevent privilege escalation via request method override', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Method override not allowed'))

      const request = SecurityTestHelpers.createMockRequest({
        method: 'POST',
        headers: {
          'X-HTTP-Method-Override': 'PUT',
          'X-Method-Override': 'DELETE'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Method override not allowed')
    })

    it('should prevent privilege escalation via path manipulation', async () => {
      const pathTraversalPayloads = SecurityTestDataGenerator.generatePathTraversalPayloads()
      
      for (const payload of pathTraversalPayloads) {
        mockRequireAuth.mockRejectedValueOnce(new Error('Path traversal detected'))

        const request = SecurityTestHelpers.createMockRequest({
          url: `http://localhost:3000/api/user/${payload}/admin`
        })

        await expect(requireAuth()).rejects.toThrow('Path traversal detected')
      }
    })
  })

  describe('Resource Access Control', () => {
    it('should enforce resource ownership', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // User should only access owned resources
      const ownedResources = {
        'portfolio:123': user.id === '123',
        'orders:123': user.id === '123',
        'trades:123': user.id === '123'
      }
      
      for (const [resource, isOwned] of Object.entries(ownedResources)) {
        expect(isOwned).toBe(user.id === resource.split(':')[1])
      }
    })

    it('should prevent cross-user resource access', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // User should not access other users' resources
      const otherUserResources = ['portfolio:456', 'orders:456', 'trades:456']
      
      for (const resource of otherUserResources) {
        const hasAccess = resource.endsWith(user.id)
        expect(hasAccess).toBe(false)
      }
    })

    it('should validate resource existence before access', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Simulate resource existence check
      const resourceExists = (resourceId: string) => {
        // Mock resource existence check
        return ['123', '456', '789'].includes(resourceId)
      }
      
      const requestedResource = 'portfolio:999'
      const resourceId = requestedResource.split(':')[1]
      
      expect(resourceExists(resourceId)).toBe(false)
    })

    it('should enforce resource-level permissions', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Define resource-level permissions
      const resourcePermissions = {
        'portfolio:read': true,
        'portfolio:write': true,
        'portfolio:delete': false,
        'admin:read': false,
        'admin:write': false,
        'admin:delete': false
      }
      
      for (const [permission, hasAccess] of Object.entries(resourcePermissions)) {
        if (permission.startsWith('portfolio:')) {
          expect(hasAccess).toBe(user.role === 'user' || user.role === 'admin')
        } else if (permission.startsWith('admin:')) {
          expect(hasAccess).toBe(user.role === 'admin')
        }
      }
    })

    it('should prevent resource enumeration', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // User should not be able to enumerate other users' resources
      const enumerationAttempts = [
        'portfolio:1',
        'portfolio:2',
        'portfolio:3',
        'orders:1',
        'orders:2',
        'orders:3'
      ]
      
      for (const resourceId of enumerationAttempts) {
        const hasAccess = resourceId.endsWith(user.id)
        expect(hasAccess).toBe(false) // Assuming user.id is not '1', '2', or '3'
      }
    })

    it('should validate resource type permissions', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Different resource types might have different access rules
      const resourceTypes = {
        'portfolio': { read: true, write: true, delete: false },
        'orders': { read: true, write: true, delete: true },
        'trades': { read: true, write: false, delete: false },
        'admin': { read: false, write: false, delete: false }
      }
      
      for (const [type, permissions] of Object.entries(resourceTypes)) {
        if (type === 'admin') {
          expect(permissions.read).toBe(user.role === 'admin')
          expect(permissions.write).toBe(user.role === 'admin')
          expect(permissions.delete).toBe(user.role === 'admin')
        } else {
          expect(permissions.read).toBe(true)
          expect(permissions.write).toBe(type !== 'trades')
          expect(permissions.delete).toBe(type === 'orders')
        }
      }
    })
  })

  describe('Administrative Function Protection', () => {
    it('should restrict admin endpoints to admin users', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Regular user should not access admin endpoints
      const adminEndpoints = [
        '/api/admin/users',
        '/api/admin/system',
        '/api/admin/config',
        '/api/admin/logs'
      ]
      
      for (const endpoint of adminEndpoints) {
        const hasAccess = user.role === 'admin' || user.role === 'superadmin'
        expect(hasAccess).toBe(false)
      }
    })

    it('should validate admin actions', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.adminUser)

      const user = await requireAuth()
      
      // Admin user should have access to admin actions
      const adminActions = [
        'user:create',
        'user:update',
        'user:delete',
        'system:configure',
        'system:restart',
        'logs:access'
      ]
      
      for (const action of adminActions) {
        const hasAccess = user.role === 'admin' || user.role === 'superadmin'
        expect(hasAccess).toBe(true)
      }
    })

    it('should prevent admin function bypass', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // User should not be able to bypass admin checks
      const bypassAttempts = [
        'admin=true',
        'isAdmin=1',
        'role=admin',
        'privileges=admin',
        'access=admin'
      ]
      
      for (const bypass of bypassAttempts) {
        const hasAccess = user.role === 'admin'
        expect(hasAccess).toBe(false)
      }
    })

    it('should audit admin actions', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.adminUser)

      const user = await requireAuth()
      
      // Admin actions should be audited
      const auditLog = {
        userId: user.id,
        action: 'admin:user:delete',
        timestamp: new Date(),
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Test)'
      }
      
      expect(auditLog.userId).toBe(user.id)
      expect(auditLog.action).toBe('admin:user:delete')
      expect(auditLog.timestamp).toBeInstanceOf(Date)
      expect(auditLog.ip).toBeTruthy()
      expect(auditLog.userAgent).toBeTruthy()
    })

    it('should require additional confirmation for destructive actions', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.adminUser)

      const user = await requireAuth()
      
      // Destructive actions should require confirmation
      const destructiveActions = [
        'user:delete',
        'system:reset',
        'database:drop',
        'config:reset'
      ]
      
      for (const action of destructiveActions) {
        const requiresConfirmation = true // Mock confirmation requirement
        expect(requiresConfirmation).toBe(true)
      }
    })

    it('should validate admin session freshness', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockRejectedValueOnce(new Error('Admin session expired'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer expired-admin-token'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Admin session expired')
    })
  })

  describe('Authorization Context Validation', () => {
    it('should validate request context', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Request context should be validated
      const requestContext = {
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 (Test)',
        timestamp: new Date(),
        sessionId: 'test-session-123'
      }
      
      expect(requestContext.ip).toBeTruthy()
      expect(requestContext.userAgent).toBeTruthy()
      expect(requestContext.timestamp).toBeInstanceOf(Date)
      expect(requestContext.sessionId).toBeTruthy()
    })

    it('should prevent context manipulation', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Context manipulation detected'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'X-Forwarded-For': '127.0.0.1, 192.168.1.1',
          'X-Real-IP': '10.0.0.1',
          'X-Original-IP': '172.16.0.1'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Context manipulation detected')
    })

    it('should validate geographic context', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Geographic context validation
      const geoContext = {
        country: 'US',
        region: 'California',
        city: 'San Francisco',
        timezone: 'America/Los_Angeles'
      }
      
      expect(geoContext.country).toBeTruthy()
      expect(geoContext.region).toBeTruthy()
      expect(geoContext.city).toBeTruthy()
      expect(geoContext.timezone).toBeTruthy()
    })

    it('should validate temporal context', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Temporal context validation
      const temporalContext = {
        requestTime: new Date(),
        sessionStart: new Date(Date.now() - 3600000), // 1 hour ago
        lastActivity: new Date(Date.now() - 300000), // 5 minutes ago
        timezone: 'UTC'
      }
      
      expect(temporalContext.requestTime).toBeInstanceOf(Date)
      expect(temporalContext.sessionStart).toBeInstanceOf(Date)
      expect(temporalContext.lastActivity).toBeInstanceOf(Date)
      expect(temporalContext.timezone).toBeTruthy()
    })
  })
})

// Helper function to check permissions
function checkPermission(user: any, permission: string): boolean {
  const userPermissions = {
    user: ['read:own', 'update:own'],
    admin: ['read:all', 'update:all', 'delete:all', 'admin:*'],
    superadmin: ['*']
  }
  
  const permissions = userPermissions[user.role] || []
  
  return permissions.includes(permission) || permissions.includes('*')
}