/**
 * TDD Test for Unified Error Handling System
 * This implements Slice 1 from the implementation roadmap
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UnifiedErrorHandler, ErrorType, ErrorSeverity, RecoveryStrategy } from '../unified-error-handling'

describe('Unified Error Handling System', () => {
  let errorHandler: UnifiedErrorHandler
  
  beforeEach(() => {
    errorHandler = new UnifiedErrorHandler()
  })

  describe('Error Classification', () => {
    it('should classify circuit breaker errors correctly', () => {
      const error = new Error('Circuit breaker is OPEN')
      const classified = errorHandler.classifyError(error)
      
      expect(classified.type).toBe(ErrorType.CIRCUIT_BREAKER)
      expect(classified.severity).toBe(ErrorSeverity.HIGH)
      expect(classified.recovery).toBe(RecoveryStrategy.RESET_CIRCUIT_BREAKER)
    })

    it('should classify validation errors correctly', () => {
      const error = new Error('Validation failed: Invalid parameters')
      const classified = errorHandler.classifyError(error)
      
      expect(classified.type).toBe(ErrorType.VALIDATION_ERROR)
      expect(classified.severity).toBe(ErrorSeverity.MEDIUM)
      expect(classified.recovery).toBe(RecoveryStrategy.RETRY_WITH_VALIDATION)
    })

    it('should classify API errors correctly', () => {
      const error = new Error('API request failed with status 429')
      const classified = errorHandler.classifyError(error)
      
      expect(classified.type).toBe(ErrorType.API_ERROR)
      expect(classified.severity).toBe(ErrorSeverity.MEDIUM)
      expect(classified.recovery).toBe(RecoveryStrategy.EXPONENTIAL_BACKOFF)
    })

    it('should classify system errors correctly', () => {
      const error = new Error('Database connection failed')
      const classified = errorHandler.classifyError(error)
      
      expect(classified.type).toBe(ErrorType.SYSTEM_ERROR)
      expect(classified.severity).toBe(ErrorSeverity.CRITICAL)
      expect(classified.recovery).toBe(RecoveryStrategy.FULL_SYSTEM_RESET)
    })
  })

  describe('Error Sanitization', () => {
    it('should sanitize sensitive data from error messages', () => {
      const error = new Error('API key abc123def456 is invalid')
      const sanitized = errorHandler.sanitizeError(error)
      
      expect(sanitized.message).not.toContain('abc123def456')
      expect(sanitized.message).toContain('[REDACTED]')
    })

    it('should preserve non-sensitive error information', () => {
      const error = new Error('Symbol BTCUSDT not found')
      const sanitized = errorHandler.sanitizeError(error)
      
      expect(sanitized.message).toBe('Symbol BTCUSDT not found')
    })
  })

  describe('Recovery Strategies', () => {
    it('should provide circuit breaker reset strategy', async () => {
      const error = new Error('Circuit breaker is OPEN')
      const recovery = await errorHandler.getRecoveryStrategy(error)
      
      expect(recovery.strategy).toBe(RecoveryStrategy.RESET_CIRCUIT_BREAKER)
      expect(recovery.actions).toContain('Reset circuit breaker state')
      expect(recovery.actions).toContain('Validate system health')
      expect(recovery.waitTime).toBeGreaterThan(0)
    })

    it('should provide retry with exponential backoff for API errors', async () => {
      const error = new Error('Rate limit exceeded')
      const recovery = await errorHandler.getRecoveryStrategy(error)
      
      expect(recovery.strategy).toBe(RecoveryStrategy.EXPONENTIAL_BACKOFF)
      expect(recovery.waitTime).toBeGreaterThan(0)
      expect(recovery.maxRetries).toBeGreaterThan(0)
    })
  })

  describe('Safety Integration', () => {
    it('should integrate with circuit breaker safety systems', async () => {
      const mockCircuitBreaker = {
        isOpen: vi.fn().mockReturnValue(true),
        reset: vi.fn(),
        getStats: vi.fn().mockReturnValue({
          state: 'OPEN',
          failures: 5,
          lastFailureTime: Date.now()
        })
      }

      const safetyResult = await errorHandler.validateSafetyBeforeRecovery(mockCircuitBreaker)
      
      expect(safetyResult.canProceed).toBe(false)
      expect(safetyResult.reason).toContain('Circuit breaker is open')
    })

    it('should validate system readiness before enabling operations', async () => {
      const mockSafetyCoordinator = {
        getCurrentStatus: vi.fn().mockReturnValue({
          overall: { systemStatus: 'operational' },
          circuitBreaker: { state: 'CLOSED' },
          riskManagement: { level: 'LOW' }
        })
      }

      const readiness = await errorHandler.validateSystemReadiness(mockSafetyCoordinator)
      
      expect(readiness.ready).toBe(true)
      expect(readiness.score).toBeGreaterThan(80)
    })
  })
})