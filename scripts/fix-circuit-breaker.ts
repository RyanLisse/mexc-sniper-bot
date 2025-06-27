#!/usr/bin/env ts-node
/**
 * Circuit Breaker Fix CLI Script
 * 
 * Command-line tool to fix "Circuit breaker in protective state" issues
 * and validate system readiness for auto-sniping operations.
 * 
 * Usage:
 *   npm run fix-circuit-breaker [action] [options]
 *   
 * Actions:
 *   diagnose    - Check current circuit breaker status
 *   fix         - Fix circuit breaker protective state
 *   validate    - Validate system readiness for auto-sniping  
 *   check       - Comprehensive safety check
 *   
 * Options:
 *   --force     - Force reset even if auto-recovery is not recommended
 *   --verbose   - Show detailed output
 */

import { CircuitBreakerSafetyService } from '../src/services/risk/circuit-breaker-safety-service'
import { UnifiedMexcServiceV2 } from '../src/services/api/unified-mexc-service-v2'
import { circuitBreakerRegistry } from '../src/services/risk/circuit-breaker'
import { config } from 'dotenv'
import chalk from 'chalk'

// Load environment variables
config()

// ============================================================================
// CLI Configuration
// ============================================================================

interface CLIOptions {
  action: 'diagnose' | 'fix' | 'validate' | 'check'
  force: boolean
  verbose: boolean
}

const DEFAULT_OPTIONS: CLIOptions = {
  action: 'diagnose',
  force: false,
  verbose: false
}

// ============================================================================
// Main CLI Function
// ============================================================================

async function main() {
  const options = parseArguments()
  
  console.log(chalk.blue('🔧 MEXC Circuit Breaker Fix Tool'))
  console.log(chalk.gray(`Action: ${options.action}`))
  console.log(chalk.gray(`Time: ${new Date().toISOString()}`))
  console.log('')

  try {
    // Initialize services
    const mexcService = new UnifiedMexcServiceV2()
    const safetyService = new CircuitBreakerSafetyService(mexcService)
    // Use circuit breaker registry instead of global reliability manager

    // Execute the requested action
    switch (options.action) {
      case 'diagnose':
        await executeDiagnose(safetyService, options)
        break
      case 'fix':
        await executeFix(safetyService, circuitBreakerRegistry, options)
        break
      case 'validate':
        await executeValidate(safetyService, options)
        break
      case 'check':
        await executeComprehensiveCheck(safetyService, options)
        break
      default:
        console.error(chalk.red(`❌ Unknown action: ${options.action}`))
        showUsage()
        process.exit(1)
    }

  } catch (error) {
    console.error(chalk.red('❌ Error executing circuit breaker fix:'))
    console.error(chalk.red(error instanceof Error ? error.message : String(error)))
    
    if (options.verbose && error instanceof Error) {
      console.error(chalk.gray('\nStack trace:'))
      console.error(chalk.gray(error.stack))
    }
    
    process.exit(1)
  }
}

// ============================================================================
// Action Executors
// ============================================================================

async function executeDiagnose(safetyService: CircuitBreakerSafetyService, options: CLIOptions) {
  console.log(chalk.yellow('🔍 Diagnosing circuit breaker status...'))
  
  const diagnosis = await safetyService.diagnoseCircuitBreakerIssue()
  
  console.log('\n' + chalk.bold('Circuit Breaker Diagnosis:'))
  console.log(`Status: ${diagnosis.isInProtectiveState ? chalk.red('PROTECTIVE STATE') : chalk.green('HEALTHY')}`)
  console.log(`Issue: ${diagnosis.issue}`)
  console.log(`Failure Count: ${diagnosis.failureCount}`)
  console.log(`Severity: ${getSeverityColor(diagnosis.severity)(diagnosis.severity)}`)
  console.log(`Can Auto-Recover: ${diagnosis.canAutoRecover ? chalk.green('YES') : chalk.red('NO')}`)
  console.log(`Recommended Action: ${diagnosis.recommendedAction}`)
  
  if (diagnosis.timeSinceLastFailure !== undefined) {
    const timeMinutes = Math.round(diagnosis.timeSinceLastFailure / 60000)
    console.log(`Time Since Last Failure: ${timeMinutes} minutes`)
  }

  if (options.verbose) {
    console.log('\n' + chalk.gray('Raw diagnosis data:'))
    console.log(chalk.gray(JSON.stringify(diagnosis, null, 2)))
  }

  // Provide next steps
  console.log('\n' + chalk.bold('Next Steps:'))
  if (diagnosis.isInProtectiveState) {
    console.log(chalk.yellow('• Run "fix" action to reset circuit breaker safely'))
    console.log(chalk.yellow('• Use --force flag if automatic recovery is not recommended'))
    console.log(chalk.yellow('• Run "validate" action after fix to check system readiness'))
  } else {
    console.log(chalk.green('• Circuit breaker is healthy'))
    console.log(chalk.green('• Run "validate" action to check overall system readiness'))
  }
}

async function executeFix(
  safetyService: CircuitBreakerSafetyService, 
  reliabilityManager: any, 
  options: CLIOptions
) {
  console.log(chalk.yellow('🔧 Fixing circuit breaker protective state...'))
  
  // First diagnose to see if fix is needed
  const diagnosis = await safetyService.diagnoseCircuitBreakerIssue()
  
  if (!diagnosis.isInProtectiveState && !options.force) {
    console.log(chalk.green('✅ Circuit breaker is already healthy - no fix needed'))
    return
  }

  if (!diagnosis.canAutoRecover && !options.force) {
    console.log(chalk.red('⚠️  Circuit breaker cannot be automatically recovered'))
    console.log(chalk.yellow('Use --force flag to attempt reset anyway, or investigate manually'))
    return
  }

  console.log(chalk.blue('Executing safe recovery process...'))
  
  const startTime = Date.now()
  const fixResult = await safetyService.executeCircuitBreakerRecovery(reliabilityManager)
  const duration = Date.now() - startTime
  
  console.log('\n' + chalk.bold('Fix Result:'))
  console.log(`Success: ${fixResult.success ? chalk.green('YES') : chalk.red('NO')}`)
  console.log(`Duration: ${duration}ms`)
  
  if (fixResult.success) {
    console.log(`New State: ${chalk.green(fixResult.newState || 'CLOSED')}`)
    console.log('\n' + chalk.bold('Steps Executed:'))
    fixResult.steps.forEach((step: string, index: number) => {
      console.log(`${index + 1}. ${chalk.green('✓')} ${step}`)
    })
  } else {
    console.log(`Reason: ${chalk.red(fixResult.reason || 'Unknown error')}`)
    console.log('\n' + chalk.bold('Steps Attempted:'))
    fixResult.steps.forEach((step: string, index: number) => {
      console.log(`${index + 1}. ${chalk.yellow('•')} ${step}`)
    })
  }

  if (options.verbose) {
    console.log('\n' + chalk.gray('Full fix result:'))
    console.log(chalk.gray(JSON.stringify(fixResult, null, 2)))
  }

  // Post-fix validation
  if (fixResult.success) {
    console.log('\n' + chalk.blue('Validating fix...'))
    const postFixDiagnosis = await safetyService.diagnoseCircuitBreakerIssue()
    
    if (!postFixDiagnosis.isInProtectiveState) {
      console.log(chalk.green('✅ Fix verified - circuit breaker is now healthy'))
    } else {
      console.log(chalk.red('❌ Fix validation failed - circuit breaker still in protective state'))
    }
  }

  // Next steps
  console.log('\n' + chalk.bold('Next Steps:'))
  if (fixResult.success) {
    console.log(chalk.green('• Run "validate" action to check overall system readiness'))
    console.log(chalk.green('• Monitor system performance'))
  } else {
    console.log(chalk.yellow('• Check system logs for error details'))
    console.log(chalk.yellow('• Consider manual intervention'))
    console.log(chalk.yellow('• Retry with --force flag if appropriate'))
  }
}

async function executeValidate(safetyService: CircuitBreakerSafetyService, options: CLIOptions) {
  console.log(chalk.yellow('✅ Validating system readiness...'))
  
  const readiness = await safetyService.validateSystemReadiness()
  const autoSnipingSafety = await safetyService.checkAutoSnipingSafetyGates()
  
  console.log('\n' + chalk.bold('System Readiness Report:'))
  console.log(`Overall Status: ${readiness.ready ? chalk.green('READY') : chalk.red('NOT READY')}`)
  console.log(`Readiness Score: ${getScoreColor(readiness.score)(readiness.score)}/100`)
  console.log(`Auto-Sniping Approved: ${autoSnipingSafety.approved ? chalk.green('YES') : chalk.red('NO')}`)
  
  if (readiness.blockers.length > 0) {
    console.log('\n' + chalk.bold('Blockers:'))
    readiness.blockers.forEach((blocker: string) => {
      console.log(`• ${chalk.red(blocker)}`)
    })
  }

  if (readiness.warnings.length > 0) {
    console.log('\n' + chalk.bold('Warnings:'))
    readiness.warnings.forEach((warning: string) => {
      console.log(`• ${chalk.yellow(warning)}`)
    })
  }

  if (autoSnipingSafety.blockers.length > 0) {
    console.log('\n' + chalk.bold('Auto-Sniping Blockers:'))
    autoSnipingSafety.blockers.forEach((blocker: string) => {
      console.log(`• ${chalk.red(blocker)}`)
    })
  }

  console.log('\n' + chalk.bold('Recommendations:'))
  readiness.recommendations.forEach((rec: string) => {
    console.log(`• ${chalk.blue(rec)}`)
  })

  if (options.verbose) {
    console.log('\n' + chalk.gray('Full readiness data:'))
    console.log(chalk.gray(JSON.stringify(readiness, null, 2)))
    console.log('\n' + chalk.gray('Auto-sniping safety data:'))
    console.log(chalk.gray(JSON.stringify(autoSnipingSafety, null, 2)))
  }
}

async function executeComprehensiveCheck(safetyService: CircuitBreakerSafetyService, options: CLIOptions) {
  console.log(chalk.yellow('🔍 Running comprehensive safety check...'))
  
  const safetyCheck = await safetyService.performComprehensiveSafetyCheck()
  
  console.log('\n' + chalk.bold('Comprehensive Safety Report:'))
  console.log(`Overall Status: ${getOverallStatusColor(safetyCheck.overall)(safetyCheck.overall)}`)
  
  console.log('\n' + chalk.bold('Component Checks:'))
  Object.entries(safetyCheck.checks).forEach(([component, result]: [string, any]) => {
    const statusColor = result.status === 'PASS' ? chalk.green : result.status === 'WARN' ? chalk.yellow : chalk.red
    const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌'
    console.log(`${statusIcon} ${component}: ${statusColor(result.status)} - ${result.message}`)
  })

  if (safetyCheck.recommendations.length > 0) {
    console.log('\n' + chalk.bold('Recommendations:'))
    safetyCheck.recommendations.forEach((rec: string) => {
      console.log(`• ${chalk.blue(rec)}`)
    })
  }

  console.log(`\nNext Check: ${chalk.gray(safetyCheck.nextCheckTime)}`)

  if (options.verbose) {
    console.log('\n' + chalk.gray('Full safety check data:'))
    console.log(chalk.gray(JSON.stringify(safetyCheck, null, 2)))
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function parseArguments(): CLIOptions {
  const args = process.argv.slice(2)
  const options = { ...DEFAULT_OPTIONS }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--force') {
      options.force = true
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true
    } else if (arg === '--help' || arg === '-h') {
      showUsage()
      process.exit(0)
    } else if (['diagnose', 'fix', 'validate', 'check'].includes(arg)) {
      options.action = arg as CLIOptions['action']
    } else {
      console.error(chalk.red(`Unknown argument: ${arg}`))
      showUsage()
      process.exit(1)
    }
  }

  return options
}

function showUsage() {
  console.log('\n' + chalk.bold('Usage:'))
  console.log('  npm run fix-circuit-breaker [action] [options]')
  console.log('')
  console.log(chalk.bold('Actions:'))
  console.log('  diagnose    Check current circuit breaker status')
  console.log('  fix         Fix circuit breaker protective state')  
  console.log('  validate    Validate system readiness for auto-sniping')
  console.log('  check       Comprehensive safety check')
  console.log('')
  console.log(chalk.bold('Options:'))
  console.log('  --force     Force reset even if auto-recovery is not recommended')
  console.log('  --verbose   Show detailed output')
  console.log('  --help      Show this help message')
  console.log('')
  console.log(chalk.bold('Examples:'))
  console.log('  npm run fix-circuit-breaker diagnose')
  console.log('  npm run fix-circuit-breaker fix --verbose')
  console.log('  npm run fix-circuit-breaker validate')
  console.log('  npm run fix-circuit-breaker check --verbose')
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'LOW': return chalk.green
    case 'MEDIUM': return chalk.yellow
    case 'HIGH': return chalk.red
    case 'CRITICAL': return chalk.magenta
    default: return chalk.gray
  }
}

function getScoreColor(score: number) {
  if (score >= 90) return chalk.green
  if (score >= 70) return chalk.yellow
  if (score >= 50) return chalk.red
  return chalk.magenta
}

function getOverallStatusColor(status: string) {
  switch (status) {
    case 'HEALTHY': return chalk.green
    case 'NEEDS_ATTENTION': return chalk.yellow
    case 'CRITICAL': return chalk.red
    default: return chalk.gray
  }
}

// ============================================================================
// Execute Main Function
// ============================================================================

if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error)
    process.exit(1)
  })
}