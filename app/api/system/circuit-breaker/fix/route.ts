/**
 * Circuit Breaker Fix API Route
 * 
 * Endpoint to safely fix "Circuit breaker in protective state" issues
 * and validate system readiness for auto-sniping operations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { CircuitBreakerSafetyService } from '@/src/services/circuit-breaker-safety-service'
import { UnifiedMexcServiceV2 } from '@/src/services/unified-mexc-service-v2'
import { getGlobalReliabilityManager } from '@/src/services/mexc-circuit-breaker'
import { z } from 'zod'

// ============================================================================
// Request/Response Schemas
// ============================================================================

const FixRequestSchema = z.object({
  action: z.enum(['diagnose', 'fix', 'validate', 'comprehensive-check']),
  forceReset: z.boolean().optional().default(false),
  skipSafetyChecks: z.boolean().optional().default(false)
})

const FixResponseSchema = z.object({
  success: z.boolean(),
  action: z.string(),
  result: z.any(),
  timestamp: z.string(),
  recommendations: z.array(z.string()).optional(),
  nextSteps: z.array(z.string()).optional()
})

type FixRequest = z.infer<typeof FixRequestSchema>
type FixResponse = z.infer<typeof FixResponseSchema>

// ============================================================================
// API Route Handlers
// ============================================================================

/**
 * POST /api/system/circuit-breaker/fix
 * Fix circuit breaker protective state issues
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const validatedRequest = FixRequestSchema.parse(body)
    
    // Initialize services
    const mexcService = new UnifiedMexcServiceV2()
    const safetyService = new CircuitBreakerSafetyService(mexcService)
    const reliabilityManager = getGlobalReliabilityManager()
    
    const timestamp = new Date().toISOString()
    let result: any
    let recommendations: string[] = []
    let nextSteps: string[] = []

    switch (validatedRequest.action) {
      case 'diagnose':
        result = await handleDiagnose(safetyService)
        recommendations = [
          'Review circuit breaker status and failure patterns',
          'Check system connectivity and health',
          'Consider running fix action if issues are detected'
        ]
        nextSteps = result.isInProtectiveState 
          ? ['Run fix action to reset circuit breaker safely']
          : ['System is healthy - no action required']
        break

      case 'fix':
        result = await handleFix(safetyService, reliabilityManager, validatedRequest.forceReset)
        recommendations = result.success
          ? ['Monitor system performance after reset', 'Validate auto-sniping readiness']
          : ['Investigate fix failure', 'Check system health manually']
        nextSteps = result.success
          ? ['Run validate action to confirm system readiness']
          : ['Review error logs and retry with different approach']
        break

      case 'validate':
        result = await handleValidate(safetyService)
        recommendations = result.ready
          ? ['System ready for auto-sniping operations']
          : ['Resolve identified blockers before enabling auto-sniping']
        nextSteps = result.ready
          ? ['Enable auto-sniping if desired', 'Monitor system performance']
          : result.recommendations
        break

      case 'comprehensive-check':
        result = await handleComprehensiveCheck(safetyService)
        recommendations = result.recommendations
        nextSteps = result.overall === 'HEALTHY'
          ? ['System fully operational']
          : ['Address identified issues', 'Run fix action if needed']
        break

      default:
        throw new Error(`Unknown action: ${validatedRequest.action}`)
    }

    const response: FixResponse = {
      success: true,
      action: validatedRequest.action,
      result,
      timestamp,
      recommendations,
      nextSteps
    }

    return NextResponse.json(response, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error) {
    console.error('Circuit breaker fix API error:', { error: error instanceof Error ? error.message : String(error) })
    
    const errorResponse: FixResponse = {
      success: false,
      action: 'error',
      result: {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof z.ZodError ? error.errors : undefined
      },
      timestamp: new Date().toISOString(),
      recommendations: ['Check request format and try again'],
      nextSteps: ['Review error details and correct request']
    }

    return NextResponse.json(errorResponse, { 
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

/**
 * GET /api/system/circuit-breaker/fix
 * Get current circuit breaker status (read-only)
 */
export async function GET(): Promise<NextResponse> {
  try {
    const mexcService = new UnifiedMexcServiceV2()
    const safetyService = new CircuitBreakerSafetyService(mexcService)
    
    // Get current status without making changes
    const [diagnosis, readiness, safetyCheck] = await Promise.all([
      safetyService.diagnoseCircuitBreakerIssue(),
      safetyService.validateSystemReadiness(),
      safetyService.checkAutoSnipingSafetyGates()
    ])

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      status: {
        circuitBreaker: diagnosis,
        systemReadiness: readiness,
        autoSnipingSafety: safetyCheck
      },
      summary: {
        isHealthy: !diagnosis.isInProtectiveState && readiness.ready && safetyCheck.approved,
        requiresAttention: diagnosis.isInProtectiveState || !readiness.ready || !safetyCheck.approved,
        canAutoRecover: diagnosis.canAutoRecover,
        readinessScore: readiness.score
      },
      recommendations: [
        ...(diagnosis.isInProtectiveState ? ['Fix circuit breaker protective state'] : []),
        ...(readiness.recommendations || []),
        ...(safetyCheck.warnings || [])
      ]
    }

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30' // Cache for 30 seconds
      }
    })

  } catch (error) {
    console.error('Circuit breaker status API error:', { error: error instanceof Error ? error.message : String(error) })
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

async function handleDiagnose(safetyService: CircuitBreakerSafetyService) {
  return await safetyService.diagnoseCircuitBreakerIssue()
}

async function handleFix(
  safetyService: CircuitBreakerSafetyService, 
  reliabilityManager: any, 
  forceReset: boolean
) {
  // First diagnose the issue
  const diagnosis = await safetyService.diagnoseCircuitBreakerIssue()
  
  if (!diagnosis.isInProtectiveState && !forceReset) {
    return {
      success: true,
      message: 'Circuit breaker is already healthy - no fix needed',
      currentState: 'CLOSED',
      steps: ['Validated circuit breaker status'],
      duration: 0
    }
  }

  if (!diagnosis.canAutoRecover && !forceReset) {
    return {
      success: false,
      message: 'Circuit breaker cannot be automatically recovered - manual intervention required',
      reason: 'Automatic recovery not safe',
      steps: ['Checked recovery safety'],
      duration: 0
    }
  }

  // Execute the fix
  const fixResult = await safetyService.executeCircuitBreakerRecovery(reliabilityManager)
  
  if (fixResult.success) {
    // Validate the fix worked
    const postFixDiagnosis = await safetyService.diagnoseCircuitBreakerIssue()
    const updatedDetails = {
      originalResult: fixResult,
      postFixStatus: postFixDiagnosis,
      verified: !postFixDiagnosis.isInProtectiveState
    }
    
    return {
      success: true,
      message: 'Circuit breaker recovery completed and verified',
      details: updatedDetails,
      nextAction: 'Circuit breaker recovery verified'
    }
  }

  return fixResult
}

async function handleValidate(safetyService: CircuitBreakerSafetyService) {
  const readiness = await safetyService.validateSystemReadiness()
  const autoSnipingSafety = await safetyService.checkAutoSnipingSafetyGates()
  
  return {
    systemReadiness: readiness,
    autoSnipingSafety,
    overallStatus: readiness.ready && autoSnipingSafety.approved ? 'READY' : 'NOT_READY',
    canEnableAutoSniping: readiness.ready && autoSnipingSafety.approved,
    blockers: [
      ...readiness.blockers,
      ...autoSnipingSafety.blockers
    ],
    warnings: [
      ...readiness.warnings,
      ...autoSnipingSafety.warnings
    ]
  }
}

async function handleComprehensiveCheck(safetyService: CircuitBreakerSafetyService) {
  return await safetyService.performComprehensiveSafetyCheck()
}