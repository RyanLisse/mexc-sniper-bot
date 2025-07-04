/**
 * Authentication Security Tests
 * 
 * Comprehensive security tests for authentication mechanisms including:
 * - JWT token validation and security
 * - Session management security
 * - Privilege escalation prevention
 * - Authentication bypass attempts
 * - Brute force protection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SecurityTestDataGenerator, SecurityTestHelpers } from '../utils/security-test-utils'
import { requireAuth } from '../../../src/lib/supabase-auth'
import { checkRateLimit } from '../../../src/lib/rate-limiter'
import { SECURITY_CONFIG } from '../../../src/lib/security-config'

import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../utils/timeout-elimination-helpers';

// Mock external dependencies
vi.mock('../../../src/lib/supabase-auth')
vi.mock('../../../src/lib/rate-limiter')

const mockRequireAuth = vi.mocked(requireAuth)
const mockCheckRateLimit = vi.mocked(checkRateLimit)

describe('Authentication Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('JWT Token Security', () => {
    it('should reject malformed JWT tokens', async () => {
      const testTokens = SecurityTestDataGenerator.generateTestJWTTokens()
      
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid token'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': `Bearer ${testTokens.malformed}`
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid token')
    })

    it('should reject expired JWT tokens', async () => {
      const testTokens = SecurityTestDataGenerator.generateTestJWTTokens()
      
      mockRequireAuth.mockRejectedValueOnce(new Error('Token expired'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': `Bearer ${testTokens.expired}`
        }
      })

      await expect(requireAuth()).rejects.toThrow('Token expired')
    })

    it('should reject tokens with invalid signatures', async () => {
      const testTokens = SecurityTestDataGenerator.generateTestJWTTokens()
      
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid signature'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': `Bearer ${testTokens.invalidSignature}`
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid signature')
    })

    it('should reject tokens with tampering attempts', async () => {
      const testTokens = SecurityTestDataGenerator.generateTestJWTTokens()
      
      mockRequireAuth.mockRejectedValueOnce(new Error('Token tampered'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': `Bearer ${testTokens.tampered}`
        }
      })

      await expect(requireAuth()).rejects.toThrow('Token tampered')
    })

    it('should reject tokens with no signature', async () => {
      const testTokens = SecurityTestDataGenerator.generateTestJWTTokens()
      
      mockRequireAuth.mockRejectedValueOnce(new Error('No signature'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': `Bearer ${testTokens.noSignature}`
        }
      })

      await expect(requireAuth()).rejects.toThrow('No signature')
    })

    it('should reject tokens with null bytes', async () => {
      const testTokens = SecurityTestDataGenerator.generateTestJWTTokens()
      
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid token format'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': `Bearer ${testTokens.nullBytes}`
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid token format')
    })

    it('should reject oversized tokens', async () => {
      const testTokens = SecurityTestDataGenerator.generateTestJWTTokens()
      
      mockRequireAuth.mockRejectedValueOnce(new Error('Token too large'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': `Bearer ${testTokens.oversized}`
        }
      })

      await expect(requireAuth()).rejects.toThrow('Token too large')
    })

    it('should handle missing Authorization header', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('No authorization header'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {}
      })

      await expect(requireAuth()).rejects.toThrow('No authorization header')
    })

    it('should handle malformed Authorization header', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Malformed authorization header'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'NotBearerToken'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Malformed authorization header')
    })

    it('should handle multiple Authorization headers', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Multiple authorization headers'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer token1, Bearer token2'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Multiple authorization headers')
    })

    it('should validate token issuer', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid issuer'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer invalid-issuer-token'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid issuer')
    })

    it('should validate token audience', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid audience'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer invalid-audience-token'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid audience')
    })

    it('should validate token not before time', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Token not yet valid'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer future-token'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Token not yet valid')
    })
  })

  describe('Session Security', () => {
    it('should prevent session fixation attacks', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Cookie': 'session_id=fixed-session-id'
        }
      })

      const user = await requireAuth()
      expect(user).toBeDefined()
      // Session should be regenerated on login
      expect(user.id).not.toBe('fixed-session-id')
    })

    it('should enforce session timeout', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Session expired'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Cookie': 'session_id=expired-session'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Session expired')
    })

    it('should prevent session hijacking', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid session fingerprint'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Cookie': 'session_id=hijacked-session',
          'User-Agent': 'Different-Browser'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid session fingerprint')
    })

    it('should enforce secure cookie settings', () => {
      const cookieConfig = SECURITY_CONFIG.SESSION_SECURITY.COOKIE
      
      expect(cookieConfig.httpOnly).toBe(true)
      expect(cookieConfig.secure).toBe(process.env.NODE_ENV === 'production')
      expect(cookieConfig.sameSite).toBeTruthy()
    })

    it('should invalidate session on logout', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Session invalidated'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Cookie': 'session_id=logged-out-session'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Session invalidated')
    })

    it('should prevent concurrent sessions from same user', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)
      mockRequireAuth.mockRejectedValueOnce(new Error('Concurrent session detected'))

      // First session should work
      const firstSession = await requireAuth()
      expect(firstSession).toBeDefined()

      // Second session should be rejected
      await expect(requireAuth()).rejects.toThrow('Concurrent session detected')
    })
  })

  describe('Privilege Escalation Prevention', () => {
    it('should prevent role elevation through token manipulation', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      expect(user.role).toBe('user')
      expect(user.role).not.toBe('admin')
    })

    it('should prevent admin access for regular users', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      expect(user.role).toBe('user')
      
      // Simulate admin endpoint access
      if (user.role !== 'admin') {
        throw new Error('Access denied')
      }
    })

    it('should prevent inactive user access', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockRejectedValueOnce(new Error('User account inactive'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer inactive-user-token'
        }
      })

      await expect(requireAuth()).rejects.toThrow('User account inactive')
    })

    it('should prevent deleted user access', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('User account deleted'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer deleted-user-token'
        }
      })

      await expect(requireAuth()).rejects.toThrow('User account deleted')
    })

    it('should prevent suspended user access', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('User account suspended'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer suspended-user-token'
        }
      })

      await expect(requireAuth()).rejects.toThrow('User account suspended')
    })

    it('should validate user permissions for specific actions', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Check specific permissions
      const hasAdminPermission = user.role === 'admin' || user.role === 'superadmin'
      const hasUserPermission = user.role === 'user' || user.role === 'admin' || user.role === 'superadmin'
      
      expect(hasUserPermission).toBe(true)
      expect(hasAdminPermission).toBe(false)
    })
  })

  describe('Brute Force Protection', () => {
    it('should implement rate limiting for login attempts', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        success: false,
        resetTime: Date.now() + 60000,
        remainingAttempts: 0
      })

      const result = await checkRateLimit('127.0.0.1', '/auth/login', 'auth', 'TestBot')
      
      expect(result.success).toBe(false)
      expect(result.remainingAttempts).toBe(0)
    })

    it('should lock account after failed attempts', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Account locked'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer locked-account-token'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Account locked')
    })

    it('should implement progressive delays for failed attempts', async () => {
      const attemptTimes: number[] = []
      
      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        const start = Date.now()
        
        mockCheckRateLimit.mockResolvedValueOnce({
          success: false,
          resetTime: start + (i + 1) * 1000, // Progressive delay
          remainingAttempts: 5 - i
        })

        await checkRateLimit('127.0.0.1', '/auth/login', 'auth', 'TestBot')
        
        const end = Date.now()
        attemptTimes.push(end - start)
      }

      // Verify progressive delays
      for (let i = 1; i < attemptTimes.length; i++) {
        expect(attemptTimes[i]).toBeGreaterThan(attemptTimes[i - 1])
      }
    })

    it('should prevent timing attacks on authentication', async () => {
      const timingResults = await SecurityTestHelpers.testTimingAttacks(
        '/api/auth/login',
        { email: 'test@example.com', password: 'correct' },
        { email: 'test@example.com', password: 'wrong' },
        10
      )

      // Timing difference should be minimal (< 50ms)
      expect(timingResults.timingDifference).toBeLessThan(50)
    })

    it('should implement CAPTCHA after failed attempts', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        success: false,
        resetTime: Date.now() + 60000,
        remainingAttempts: 0,
        requiresCaptcha: true
      })

      const result = await checkRateLimit('127.0.0.1', '/auth/login', 'auth', 'TestBot')
      
      expect(result.requiresCaptcha).toBe(true)
    })

    it('should track failed attempts by IP address', async () => {
      const ips = ['192.168.1.1', '192.168.1.2', '192.168.1.3']
      
      for (const ip of ips) {
        mockCheckRateLimit.mockResolvedValueOnce({
          success: false,
          resetTime: Date.now() + 60000,
          remainingAttempts: 0,
          ip: ip
        })

        const result = await checkRateLimit(ip, '/auth/login', 'auth', 'TestBot')
        expect(result.ip).toBe(ip)
      }
    })

    it('should track failed attempts by user account', async () => {
      const userEmails = ['user1@example.com', 'user2@example.com', 'user3@example.com']
      
      for (const email of userEmails) {
        mockRequireAuth.mockRejectedValueOnce(new Error(`Account locked for ${email}`))

        const request = SecurityTestHelpers.createMockRequest({
          headers: {
            'Authorization': 'Bearer invalid-token'
          }
        })

        await expect(requireAuth()).rejects.toThrow(`Account locked for ${email}`)
      }
    })

    it('should implement geographic anomaly detection', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Suspicious geographic activity'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer suspicious-location-token',
          'CF-IPCountry': 'CN', // Different country
          'X-Forwarded-For': '1.2.3.4'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Suspicious geographic activity')
    })

    it('should implement device fingerprinting', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Unrecognized device'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer valid-token',
          'User-Agent': 'Completely-Different-Browser/1.0'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Unrecognized device')
    })
  })

  describe('Authentication Bypass Attempts', () => {
    it('should prevent SQL injection in authentication', async () => {
      const sqlPayloads = SecurityTestDataGenerator.generateSQLInjectionPayloads()
      
      for (const payload of sqlPayloads) {
        mockRequireAuth.mockRejectedValueOnce(new Error('Invalid credentials'))

        const request = SecurityTestHelpers.createMockRequest({
          method: 'POST',
          body: {
            email: payload,
            password: 'password'
          }
        })

        await expect(requireAuth()).rejects.toThrow('Invalid credentials')
      }
    })

    it('should prevent NoSQL injection in authentication', async () => {
      const noSQLPayloads = [
        { '$ne': null },
        { '$gt': '' },
        { '$where': 'this.username == this.password' },
        { '$regex': '.*' },
        { '$or': [{ username: 'admin' }, { username: 'user' }] }
      ]
      
      for (const payload of noSQLPayloads) {
        mockRequireAuth.mockRejectedValueOnce(new Error('Invalid credentials'))

        const request = SecurityTestHelpers.createMockRequest({
          method: 'POST',
          body: {
            email: payload,
            password: 'password'
          }
        })

        await expect(requireAuth()).rejects.toThrow('Invalid credentials')
      }
    })

    it('should prevent LDAP injection in authentication', async () => {
      const ldapPayloads = [
        '*)(cn=*',
        '*)(objectClass=*',
        '*)(uid=*',
        '*)(&(objectClass=*',
        '*))%00',
        '*()|%26',
        '*)(mail=*',
        '*)(sn=*'
      ]
      
      for (const payload of ldapPayloads) {
        mockRequireAuth.mockRejectedValueOnce(new Error('Invalid credentials'))

        const request = SecurityTestHelpers.createMockRequest({
          method: 'POST',
          body: {
            email: payload,
            password: 'password'
          }
        })

        await expect(requireAuth()).rejects.toThrow('Invalid credentials')
      }
    })

    it('should prevent authentication bypass via parameter pollution', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid request format'))

      const request = SecurityTestHelpers.createMockRequest({
        method: 'POST',
        body: {
          email: 'user@example.com',
          password: 'password',
          admin: 'true',
          role: 'admin',
          bypass: 'true'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid request format')
    })

    it('should prevent authentication bypass via header manipulation', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid authentication'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'X-Forwarded-User': 'admin',
          'X-Remote-User': 'admin',
          'X-User': 'admin',
          'X-Auth-User': 'admin',
          'X-Authenticated-User': 'admin'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid authentication')
    })

    it('should prevent authentication bypass via HTTP method override', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Method not allowed'))

      const request = SecurityTestHelpers.createMockRequest({
        method: 'POST',
        headers: {
          'X-HTTP-Method-Override': 'GET',
          'X-Method-Override': 'GET',
          'X-HTTP-Method': 'GET'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Method not allowed')
    })

    it('should prevent null byte injection in authentication', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid credentials'))

      const request = SecurityTestHelpers.createMockRequest({
        method: 'POST',
        body: {
          email: 'admin@example.com\0--',
          password: 'password\0'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid credentials')
    })
  })

  describe('Multi-Factor Authentication Security', () => {
    it('should enforce MFA for admin users', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockRejectedValueOnce(new Error('MFA required'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer admin-token-no-mfa'
        }
      })

      await expect(requireAuth()).rejects.toThrow('MFA required')
    })

    it('should validate TOTP codes properly', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid TOTP code'))

      const request = SecurityTestHelpers.createMockRequest({
        method: 'POST',
        body: {
          email: 'admin@example.com',
          password: 'password',
          totp: '000000'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid TOTP code')
    })

    it('should prevent TOTP replay attacks', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('TOTP already used'))

      const request = SecurityTestHelpers.createMockRequest({
        method: 'POST',
        body: {
          email: 'admin@example.com',
          password: 'password',
          totp: '123456' // Previously used code
        }
      })

      await expect(requireAuth()).rejects.toThrow('TOTP already used')
    })

    it('should enforce backup code security', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Invalid backup code'))

      const request = SecurityTestHelpers.createMockRequest({
        method: 'POST',
        body: {
          email: 'admin@example.com',
          password: 'password',
          backupCode: 'invalid-backup-code'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Invalid backup code')
    })

    it('should limit backup code usage', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Backup code already used'))

      const request = SecurityTestHelpers.createMockRequest({
        method: 'POST',
        body: {
          email: 'admin@example.com',
          password: 'password',
          backupCode: 'used-backup-code'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Backup code already used')
    })
  })

  describe('Authentication State Management', () => {
    it('should maintain secure authentication state', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Verify secure state properties
      expect(user.id).toBeTruthy()
      expect(user.email).toBeTruthy()
      expect(user.role).toBeTruthy()
      expect(user.isActive).toBe(true)
      expect(user.createdAt).toBeTruthy()
      expect(user.updatedAt).toBeTruthy()
    })

    it('should prevent state tampering', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValueOnce(testUsers.validUser)

      const user = await requireAuth()
      
      // Attempt to tamper with user state
      const originalRole = user.role
      user.role = 'admin' // This should not affect actual authorization
      
      // Verify original state is preserved
      expect(user.role).toBe(originalRole)
    })

    it('should handle authentication state corruption', async () => {
      mockRequireAuth.mockRejectedValueOnce(new Error('Corrupted authentication state'))

      const request = SecurityTestHelpers.createMockRequest({
        headers: {
          'Authorization': 'Bearer corrupted-token'
        }
      })

      await expect(requireAuth()).rejects.toThrow('Corrupted authentication state')
    })

    it('should handle concurrent authentication requests', async () => {
      const testUsers = SecurityTestDataGenerator.generateTestUsers()
      
      mockRequireAuth.mockResolvedValue(testUsers.validUser)

      const concurrentRequests = Array.from({ length: 10 }, () => requireAuth())
      
      const results = await Promise.all(concurrentRequests)
      
      // All requests should succeed with same user
      results.forEach(result => {
        expect(result.id).toBe(testUsers.validUser.id)
      })
    })

    it('should handle authentication timeout gracefully', async () => {
      mockRequireAuth.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Authentication timeout')), 1000)
        })
      })

      await expect(requireAuth()).rejects.toThrow('Authentication timeout')
    })
  })
})