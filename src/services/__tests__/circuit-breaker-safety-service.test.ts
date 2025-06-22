/**
 * TDD Test for Circuit Breaker Safety Service
 * Tests the fix for "Circuit breaker in protective state" issue
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CircuitBreakerSafetyService } from '../circuit-breaker-safety-service'
import { UnifiedErrorHandler } from '../../lib/unified-error-handling'

describe('Circuit Breaker Safety Service', () => {
  let safetyService: CircuitBreakerSafetyService
  let mockMexcService: any
  let mockCircuitBreaker: any

  beforeEach(() => {
    mockCircuitBreaker = {
      isOpen: vi.fn().mockReturnValue(true),
      isClosed: vi.fn().mockReturnValue(false),
      isHalfOpen: vi.fn().mockReturnValue(false),
      reset: vi.fn(),
      forceClosed: vi.fn(),
      getStats: vi.fn().mockReturnValue({
        state: 'OPEN',
        failures: 5,
        lastFailureTime: Date.now() - 30000,
        totalRequests: 10
      }),
      getConfig: vi.fn().mockReturnValue({
        failureThreshold: 5,
        recoveryTimeout: 60000
      })
    }

    mockMexcService = {
      getCircuitBreakerStatus: vi.fn().mockResolvedValue({
        success: true,
        data: {
          state: 'OPEN',
          failures: 5,
          lastFailureTime: new Date().toISOString()
        }
      }),
      testConnectivity: vi.fn().mockResolvedValue(true),
      testConnectivityWithResponse: vi.fn().mockResolvedValue({
        success: true,
        data: { connected: true, latency: 100 }
      })
    }

    safetyService = new CircuitBreakerSafetyService(mockMexcService)
  })

  describe('Circuit Breaker Status Detection', () => {
    it('should detect when circuit breaker is in protective state', async () => {
      const status = await safetyService.diagnoseCircuitBreakerIssue()
      
      expect(status.isInProtectiveState).toBe(true)
      expect(status.issue).toBe('Circuit breaker is OPEN')
      expect(status.canAutoRecover).toBe(true)
    })

    it('should detect healthy circuit breaker state', async () => {
      mockMexcService.getCircuitBreakerStatus.mockResolvedValue({
        success: true,
        data: { state: 'CLOSED', failures: 0 }
      })

      const status = await safetyService.diagnoseCircuitBreakerIssue()
      
      expect(status.isInProtectiveState).toBe(false)
      expect(status.issue).toBe('Circuit breaker is healthy')
      expect(status.canAutoRecover).toBe(false)
    })
  })

  describe('Safe Recovery Process', () => {
    it('should execute safe circuit breaker reset process', async () => {
      const mockReliabilityManager = {
        getCircuitBreaker: vi.fn().mockReturnValue(mockCircuitBreaker),
        reset: vi.fn()
      }

      const result = await safetyService.executeCircuitBreakerRecovery(mockReliabilityManager)
      
      expect(result.success).toBe(true)
      expect(result.steps).toContain('Validated safety conditions')
      expect(result.steps).toContain('Reset circuit breaker')
      expect(result.steps).toContain('Verified system connectivity')
    })

    it('should prevent unsafe recovery when conditions are not met', async () => {
      mockMexcService.testConnectivity.mockResolvedValue(false)

      const mockReliabilityManager = {
        getCircuitBreaker: vi.fn().mockReturnValue(mockCircuitBreaker)
      }

      const result = await safetyService.executeCircuitBreakerRecovery(mockReliabilityManager)
      
      expect(result.success).toBe(false)
      expect(result.reason).toContain('connectivity')
    })
  })

  describe('System Readiness Validation', () => {
    it('should validate system readiness before enabling auto-sniping', async () => {
      const readiness = await safetyService.validateSystemReadiness()
      
      expect(readiness.ready).toBe(false) // Should be false due to open circuit breaker
      expect(readiness.blockers).toContain('Circuit breaker is in protective state')
      expect(readiness.recommendations).toContain('Reset circuit breaker safely')
    })

    it('should detect system ready state when all conditions are met', async () => {
      mockMexcService.getCircuitBreakerStatus.mockResolvedValue({
        success: true,
        data: { state: 'CLOSED', failures: 0 }
      })

      const readiness = await safetyService.validateSystemReadiness()
      
      expect(readiness.ready).toBe(true)
      expect(readiness.blockers).toHaveLength(0)
      expect(readiness.score).toBeGreaterThan(80)
    })
  })

  describe('Comprehensive Safety Checks', () => {
    it('should perform comprehensive safety validation', async () => {
      const validation = await safetyService.performComprehensiveSafetyCheck()
      
      expect(validation.overall).toBe('NEEDS_ATTENTION')
      expect(validation.checks).toHaveProperty('circuitBreaker')
      expect(validation.checks).toHaveProperty('connectivity')
      expect(validation.checks).toHaveProperty('systemHealth')
      expect(validation.recommendations).toContain('Fix circuit breaker protective state')
    })

    it('should validate risk management systems', async () => {
      const riskValidation = await safetyService.validateRiskManagementSystems()
      
      expect(riskValidation.riskLevel).toBe('HIGH') // Due to circuit breaker being open
      expect(riskValidation.safeToTrade).toBe(false)
      expect(riskValidation.requiredActions).toContain('Reset circuit breaker')
    })
  })

  describe('Auto-Sniping Safety Gates', () => {
    it('should prevent auto-sniping when safety conditions are not met', async () => {
      const gateCheck = await safetyService.checkAutoSnipingSafetyGates()
      
      expect(gateCheck.approved).toBe(false)
      expect(gateCheck.blockers).toContain('Circuit breaker protective state')
      expect(gateCheck.severity).toBe('HIGH')
    })

    it('should approve auto-sniping when all safety conditions are met', async () => {
      mockMexcService.getCircuitBreakerStatus.mockResolvedValue({
        success: true,
        data: { state: 'CLOSED', failures: 0 }
      })

      const gateCheck = await safetyService.checkAutoSnipingSafetyGates()
      
      expect(gateCheck.approved).toBe(true)
      expect(gateCheck.blockers).toHaveLength(0)
      expect(gateCheck.severity).toBe('LOW')
    })
  })
})