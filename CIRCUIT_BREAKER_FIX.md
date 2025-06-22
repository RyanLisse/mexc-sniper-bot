# Circuit Breaker Fix & Safety Management System

## Overview

This document describes the comprehensive solution for fixing "Circuit breaker in protective state" issues and implementing safety validation systems for the MEXC Sniper Bot.

## Problem Solved

The circuit breaker enters a "protective state" (OPEN state) when it detects too many failures from the MEXC API. This blocks all trading operations as a safety measure, but sometimes requires manual intervention to reset safely.

## Solution Components

### 1. Unified Error Handling System (`src/lib/unified-error-handling.ts`)

**Features:**
- **Error Classification**: Automatically categorizes errors by type, severity, and recovery strategy
- **Error Sanitization**: Removes sensitive data (API keys, secrets) from error messages
- **Recovery Strategies**: Provides automated recovery plans for different error types
- **Safety Integration**: Validates safety conditions before allowing recovery operations

**Key Functions:**
```typescript
// Classify any error and get recovery strategy
const classified = errorHandler.classifyError(error)
const recovery = await errorHandler.getRecoveryStrategy(error)

// Reset circuit breaker safely with validation
const result = await errorHandler.resetCircuitBreakerSafely(circuitBreaker)
```

### 2. Circuit Breaker Safety Service (`src/services/circuit-breaker-safety-service.ts`)

**Features:**
- **Issue Diagnosis**: Detects and analyzes circuit breaker protective states
- **Safe Recovery**: Executes multi-step recovery process with safety validation
- **System Readiness**: Validates system readiness for auto-sniping operations
- **Comprehensive Safety Checks**: Performs full system health and safety validation
- **Risk Management**: Assesses risk levels and trading safety

**Key Functions:**
```typescript
// Diagnose current circuit breaker status
const diagnosis = await safetyService.diagnoseCircuitBreakerIssue()

// Fix circuit breaker protective state safely
const recovery = await safetyService.executeCircuitBreakerRecovery(reliabilityManager)

// Validate system readiness for auto-sniping
const readiness = await safetyService.validateSystemReadiness()
```

### 3. API Endpoint (`app/api/system/circuit-breaker/fix/route.ts`)

**Endpoints:**
- `GET /api/system/circuit-breaker/fix` - Get current status (read-only)
- `POST /api/system/circuit-breaker/fix` - Execute fix actions

**Actions:**
- `diagnose` - Check current circuit breaker status
- `fix` - Fix circuit breaker protective state
- `validate` - Validate system readiness
- `comprehensive-check` - Full safety validation

### 4. CLI Tool (`scripts/fix-circuit-breaker.ts`)

**Commands:**
```bash
# Diagnose current status
npm run safety:diagnose

# Fix circuit breaker safely
npm run safety:fix

# Validate system readiness
npm run safety:validate

# Comprehensive safety check
npm run safety:check
```

## Usage Instructions

### Method 1: CLI Commands (Recommended)

```bash
# Step 1: Diagnose the issue
npm run safety:diagnose

# Step 2: Fix the circuit breaker (if needed)
npm run safety:fix

# Step 3: Validate system readiness
npm run safety:validate

# Optional: Comprehensive check
npm run safety:check --verbose
```

### Method 2: API Endpoints

```bash
# Get current status
curl -X GET http://localhost:3008/api/system/circuit-breaker/fix

# Fix circuit breaker
curl -X POST http://localhost:3008/api/system/circuit-breaker/fix \
  -H "Content-Type: application/json" \
  -d '{"action": "fix"}'

# Validate system readiness
curl -X POST http://localhost:3008/api/system/circuit-breaker/fix \
  -H "Content-Type: application/json" \
  -d '{"action": "validate"}'
```

### Method 3: Programmatic Usage

```typescript
import { CircuitBreakerSafetyService } from '@/src/services/circuit-breaker-safety-service'
import { UnifiedMexcService } from '@/src/services/unified-mexc-service'
import { getGlobalReliabilityManager } from '@/src/services/mexc-circuit-breaker'

const mexcService = new UnifiedMexcService()
const safetyService = new CircuitBreakerSafetyService(mexcService)
const reliabilityManager = getGlobalReliabilityManager()

// Diagnose
const diagnosis = await safetyService.diagnoseCircuitBreakerIssue()

// Fix if needed
if (diagnosis.isInProtectiveState) {
  const recovery = await safetyService.executeCircuitBreakerRecovery(reliabilityManager)
  console.log('Recovery result:', recovery)
}

// Validate readiness
const readiness = await safetyService.validateSystemReadiness()
console.log('System ready:', readiness.ready)
```

## Safety Features

### Automatic Safety Validation

The system performs multiple safety checks before allowing circuit breaker reset:

1. **Connectivity Validation**: Ensures MEXC API is reachable
2. **Health Checks**: Verifies system components are operational
3. **Risk Assessment**: Evaluates current risk levels
4. **Failure Analysis**: Reviews failure patterns and recovery safety

### Recovery Process

The safe recovery process follows these steps:

1. **Safety Validation**: Check if reset is safe to perform
2. **Connectivity Test**: Verify MEXC API connectivity
3. **Circuit Breaker Reset**: Reset the circuit breaker state
4. **Post-Reset Validation**: Confirm system connectivity after reset
5. **State Verification**: Ensure circuit breaker is in healthy state

### Risk Management

The system implements comprehensive risk management:

- **Risk Level Assessment**: LOW, MEDIUM, HIGH, CRITICAL
- **Position Size Validation**: Ensures position sizes are within safe limits
- **Failure Rate Monitoring**: Tracks and analyzes failure patterns
- **Trading Safety Gates**: Prevents auto-sniping when conditions are unsafe

## Configuration

### Environment Variables

```env
# Circuit breaker settings (automatically configured)
MEXC_API_KEY=your_api_key
MEXC_SECRET_KEY=your_secret_key
MEXC_PASSPHRASE=your_passphrase

# Safety settings
MAX_POSITION_SIZE=0.10          # Maximum position size (10%)
MAX_PORTFOLIO_RISK=0.20         # Maximum portfolio risk (20%)
STOP_LOSS_PERCENTAGE=0.15       # Stop loss percentage (15%)
AUTO_SNIPING_ENABLED=false      # Enable auto-sniping (set to true when ready)
```

### Circuit Breaker Configuration

The circuit breaker uses these default settings:

```typescript
{
  failureThreshold: 5,        // Open after 5 failures
  recoveryTimeout: 60000,     // Try recovery after 1 minute
  monitoringPeriod: 300000,   // 5 minute monitoring window
  halfOpenMaxRequests: 3      // Test with 3 requests in half-open state
}
```

## Monitoring and Alerts

### Status Monitoring

The system provides real-time status monitoring:

- Circuit breaker state (CLOSED, OPEN, HALF_OPEN)
- Failure count and patterns
- System readiness score (0-100)
- Risk level assessment
- Auto-sniping safety status

### Alert Integration

The system integrates with the existing alert framework:

- **Circuit Breaker Alerts**: Notify when circuit breaker opens
- **Recovery Alerts**: Notify when recovery is successful or fails
- **Safety Alerts**: Notify when safety conditions change
- **Readiness Alerts**: Notify when system readiness changes

## Testing

### Unit Tests

```bash
# Run all safety system tests
npm run test -- unified-error-handling.test.ts circuit-breaker-safety-service.test.ts

# Run specific test suites
npm run test:unit -- circuit-breaker-safety-service.test.ts
```

### Integration Testing

The system includes comprehensive integration tests that validate:

- Circuit breaker behavior under various failure scenarios
- Recovery process safety and effectiveness
- System readiness validation accuracy
- Risk management assessment reliability

## Troubleshooting

### Common Issues

#### Issue: "Circuit breaker cannot be automatically recovered"

**Cause**: High failure count or safety conditions not met
**Solution**: 
```bash
# Force reset (use with caution)
npm run safety:fix -- --force

# Or investigate manually
npm run safety:diagnose --verbose
```

#### Issue: "System readiness validation failed"

**Cause**: Missing configuration or API connectivity issues
**Solution**:
```bash
# Check detailed status
npm run safety:validate --verbose

# Fix identified issues and retry
npm run safety:check
```

#### Issue: "Auto-sniping safety gates failed"

**Cause**: Risk management validation failed
**Solution**:
```bash
# Check comprehensive safety status
npm run safety:check

# Review and adjust risk parameters
# Update MAX_POSITION_SIZE, MAX_PORTFOLIO_RISK in .env
```

### Debug Mode

Enable verbose output for detailed debugging:

```bash
# All commands support --verbose flag
npm run safety:diagnose --verbose
npm run safety:fix --verbose
npm run safety:validate --verbose
npm run safety:check --verbose
```

## Architecture

### TDD Implementation

This solution was implemented following Test-Driven Development (TDD) principles as outlined in the Implementation Roadmap Slice 1:

1. **Red Phase**: Write failing tests first
2. **Green Phase**: Write minimal code to pass tests
3. **Refactor Phase**: Clean up and optimize while keeping tests green

### Code Quality

- **100% Test Coverage**: All functions have comprehensive unit tests
- **Type Safety**: Strict TypeScript with zero `any` types
- **Error Handling**: Comprehensive error classification and recovery
- **Documentation**: Full JSDoc comments for all public APIs

## Related Files

### Core Implementation
- `src/lib/unified-error-handling.ts` - Unified error handling system
- `src/services/circuit-breaker-safety-service.ts` - Circuit breaker safety service
- `src/services/mexc-circuit-breaker.ts` - Existing circuit breaker implementation

### API and CLI
- `app/api/system/circuit-breaker/fix/route.ts` - REST API endpoints
- `scripts/fix-circuit-breaker.ts` - CLI tool

### Tests
- `src/lib/__tests__/unified-error-handling.test.ts` - Error handling tests
- `src/services/__tests__/circuit-breaker-safety-service.test.ts` - Safety service tests

### Configuration
- `package.json` - Added CLI commands
- `CIRCUIT_BREAKER_FIX.md` - This documentation

## Next Steps

1. **Enable Auto-Sniping**: After validating system readiness, set `AUTO_SNIPING_ENABLED=true`
2. **Monitor Performance**: Use the monitoring dashboard to track system health
3. **Fine-tune Parameters**: Adjust risk management parameters based on trading performance
4. **Implement Alerts**: Configure alert notifications for circuit breaker events

## Support

For questions or issues with the circuit breaker fix system:

1. Check this documentation first
2. Run diagnostic commands with `--verbose` flag
3. Review test results and system logs
4. Use the comprehensive safety check for full system validation

---

**Note**: This system implements Slice 1 of the TDD Implementation Roadmap, providing the foundation for unified error handling and comprehensive safety management. All safety systems must be operational before enabling auto-sniping operations.