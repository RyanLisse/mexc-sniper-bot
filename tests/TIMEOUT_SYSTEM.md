# Test Timeout System Documentation

## Overview

The MEXC Sniper Bot test suite implements a comprehensive timeout system to prevent hanging tests and ensure CI/CD pipeline reliability. This system provides different timeout configurations for different types of tests and includes monitoring and error reporting capabilities.

## Timeout Configuration by Test Type

### Default Timeouts

| Test Type | Timeout | Use Case |
|-----------|---------|----------|
| Unit | 10s | Fast, simple operations |
| Integration | 45s | Multi-service coordination |
| Auto-sniping | 30s | Complex market simulations |
| Performance | 60s | Load testing scenarios |
| Safety | 45s | Comprehensive risk validation |
| Agents | 30s | AI/ML processing |
| E2E | 120s | End-to-end browser tests |

### Environment Variable Overrides

You can override default timeouts using environment variables:

```bash
export TEST_TIMEOUT_UNIT=15000          # 15s for unit tests
export TEST_TIMEOUT_INTEGRATION=60000   # 60s for integration tests
export TEST_TIMEOUT_AUTO_SNIPING=45000  # 45s for auto-sniping tests
export TEST_TIMEOUT_PERFORMANCE=90000   # 90s for performance tests
export TEST_TIMEOUT_SAFETY=60000        # 60s for safety tests
export TEST_TIMEOUT_AGENTS=45000        # 45s for agent tests
export TEST_TIMEOUT_E2E=180000          # 3 minutes for E2E tests
```

## Using Timeout Utilities

### Basic Test Setup

```typescript
import { setTestTimeout } from '../utils/timeout-utilities';

describe('My Test Suite', () => {
  // Set appropriate timeout for your test type
  const TEST_TIMEOUT = setTestTimeout('unit'); // or 'integration', 'auto-sniping', etc.
  
  it('should complete within timeout', async () => {
    // Your test implementation
  }, TEST_TIMEOUT);
});
```

### Timeout Wrappers

#### General Operations

```typescript
import { withTimeout } from '../utils/timeout-utilities';

it('should handle async operation with timeout', async () => {
  const result = await withTimeout(async () => {
    // Your async operation
    return await someAsyncFunction();
  }, { testType: 'integration' });
  
  expect(result.result).toBeDefined();
  expect(result.timedOut).toBe(false);
});
```

#### Database Operations

```typescript
import { withDatabaseTimeout } from '../utils/timeout-utilities';

it('should handle database query with timeout', async () => {
  const result = await withDatabaseTimeout(async () => {
    return await db.select().from(users).limit(10);
  });
  
  expect(result).toBeDefined();
});
```

#### API Operations

```typescript
import { withApiTimeout } from '../utils/timeout-utilities';

it('should handle API call with timeout', async () => {
  const result = await withApiTimeout(async () => {
    return await mexcService.getTicker('BTCUSDT');
  });
  
  expect(result.success).toBe(true);
});
```

#### WebSocket Operations

```typescript
import { withWebSocketTimeout } from '../utils/timeout-utilities';

it('should handle WebSocket connection with timeout', async () => {
  const result = await withWebSocketTimeout(async () => {
    return await webSocketClient.connect();
  });
  
  expect(result.connected).toBe(true);
});
```

### Retry with Timeout

For flaky operations that might need retries:

```typescript
import { withRetryTimeout } from '../utils/timeout-utilities';

it('should retry failed operations', async () => {
  const result = await withRetryTimeout(async () => {
    // Operation that might fail intermittently
    return await unstableApiCall();
  }, {
    maxRetries: 3,
    timeout: 5000,
    retryDelay: 1000,
    testType: 'integration'
  });
  
  expect(result).toBeDefined();
});
```

## E2E Test Timeouts (Playwright)

### Configuration

```typescript
import { 
  withStagehandTimeout,
  withAuthTimeout,
  withDashboardTimeout 
} from '../setup/playwright-timeout-config';

test('authentication flow', async ({ page }) => {
  await withAuthTimeout(async () => {
    await page.goto('/login');
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password');
    await page.click('#login-button');
    await page.waitForURL('/dashboard');
  });
});
```

### Stagehand AI Operations

```typescript
test('Stagehand AI interaction', async () => {
  await withStagehandTimeout(async () => {
    const result = await stagehand.act('Click the sign in button');
    expect(result).toBeDefined();
  });
});
```

## Timeout Monitoring

### Enable Monitoring

Set environment variables to enable timeout monitoring:

```bash
export ENABLE_TIMEOUT_MONITORING=true
export TIMEOUT_WARNING_THRESHOLD=0.8     # Warn at 80% of timeout
export TIMEOUT_ERROR_REPORTING=true      # Report timeout errors
```

### Monitor Active Timeouts

```typescript
import { globalTimeoutMonitor } from '../utils/timeout-utilities';

afterEach(() => {
  // Check for hanging timeouts
  const activeCount = globalTimeoutMonitor.getActiveCount();
  if (activeCount.timeouts > 0 || activeCount.intervals > 0) {
    console.warn(`Active timeouts: ${activeCount.timeouts}, intervals: ${activeCount.intervals}`);
  }
  
  // Cleanup
  globalTimeoutMonitor.cleanup();
});
```

## Error Handling

### Timeout Error Types

The system provides different error types for better debugging:

- `TestTimeoutError`: Test exceeded its timeout limit
- `OperationTimeoutError`: Specific operation timed out
- `TimeoutError`: General timeout error

### Error Messages

Timeout errors include helpful information:

```
Error: Auto-sniping pattern detection timed out after 30000ms (auto-sniping test)
  at withTimeout (/tests/utils/timeout-utilities.ts:45:15)
  
Troubleshooting:
- Check if external services are responding
- Verify mock configurations are correct
- Consider increasing timeout for complex operations
```

## Best Practices

### 1. Choose Appropriate Test Types

```typescript
// ❌ Don't use long timeouts for simple unit tests
describe('Unit Test', () => {
  const TEST_TIMEOUT = setTestTimeout('performance'); // Wrong!
});

// ✅ Use appropriate timeout for test complexity
describe('Unit Test', () => {
  const TEST_TIMEOUT = setTestTimeout('unit'); // Correct!
});
```

### 2. Use Specific Wrappers

```typescript
// ❌ Generic timeout for database operations
await withTimeout(dbOperation, { testType: 'unit' });

// ✅ Database-specific timeout wrapper
await withDatabaseTimeout(dbOperation);
```

### 3. Handle Cleanup Properly

```typescript
describe('Test Suite', () => {
  afterEach(() => {
    // Always cleanup timeout monitors
    globalTimeoutMonitor.cleanup();
  });
});
```

### 4. Use Retries for Flaky Operations

```typescript
// ❌ No retry for potentially flaky operation
await externalApiCall();

// ✅ Retry wrapper for reliability
await withRetryTimeout(externalApiCall, {
  maxRetries: 3,
  testType: 'integration'
});
```

## Debugging Timeouts

### 1. Enable Monitoring

```bash
export ENABLE_TIMEOUT_MONITORING=true
export TIMEOUT_ERROR_REPORTING=true
```

### 2. Check Console Output

Look for warnings like:
```
⚠️ Test approaching timeout (80% of 30000ms)
⚠️ Cleaned up 2 timeouts and 1 intervals after test
```

### 3. Use Performance Monitoring

```typescript
import { timeoutPromise } from '../utils/timeout-utilities';

const result = await timeoutPromise(
  longRunningOperation(),
  10000,
  'Long running operation'
);
```

### 4. Check Active Timeout Counts

```typescript
const activeCount = globalTimeoutMonitor.getActiveCount();
console.log(`Active timeouts: ${activeCount.timeouts}, intervals: ${activeCount.intervals}`);
```

## CI/CD Integration

### GitHub Actions

The timeout system is automatically enabled in CI environments:

```yaml
- name: Run tests with timeout monitoring
  run: npm test
  env:
    ENABLE_TIMEOUT_MONITORING: true
    TIMEOUT_ERROR_REPORTING: true
    TEST_TIMEOUT_INTEGRATION: 60000  # Increase for CI
```

### Test Reports

Timeout information is included in test reports:

```json
{
  "test": "should complete auto-sniping workflow",
  "duration": 25000,
  "timeout": 30000,
  "warnings": ["Test took 83% of timeout"],
  "status": "passed"
}
```

## Common Issues and Solutions

### 1. Tests Timing Out

**Symptoms**: Tests fail with timeout errors

**Solutions**:
- Check if external services are available
- Increase timeout for complex operations
- Use retry wrappers for flaky operations
- Mock slow external dependencies

### 2. Hanging Tests

**Symptoms**: Tests never complete or finish

**Solutions**:
- Enable timeout monitoring
- Check for unresolved promises
- Ensure proper cleanup in `afterEach`
- Use timeout wrappers for all async operations

### 3. Slow Test Performance

**Symptoms**: Tests pass but take too long

**Solutions**:
- Optimize test setup and teardown
- Use better mocking strategies
- Parallelize independent operations
- Profile slow operations

### 4. CI/CD Pipeline Issues

**Symptoms**: Tests pass locally but timeout in CI

**Solutions**:
- Increase timeouts for CI environment
- Ensure CI has sufficient resources
- Check for environment-specific issues
- Use retry mechanisms for flaky tests

## Timeout System Architecture

```
┌─────────────────────────────────────────┐
│            Vitest Configuration         │
│  - Global timeouts by test type        │
│  - Environment variable overrides      │
│  - Monitoring settings                 │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│          Timeout Utilities              │
│  - withTimeout wrappers                 │
│  - Specific operation timeouts          │
│  - Retry mechanisms                     │
│  - Performance monitoring              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         Global Timeout Monitor         │
│  - Track active timeouts/intervals     │
│  - Cleanup on test completion          │
│  - Memory leak prevention              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           Test Execution                │
│  - Automatic timeout enforcement       │
│  - Warning and error reporting         │
│  - Performance metrics collection      │
└─────────────────────────────────────────┘
```

This comprehensive timeout system ensures that no test can hang indefinitely, provides clear error messages when timeouts occur, and helps maintain a reliable CI/CD pipeline.