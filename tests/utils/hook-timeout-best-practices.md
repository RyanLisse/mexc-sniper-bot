# Hook Timeout Best Practices

## MISSION: Eliminate ALL "Hook timed out in 10000ms" failures

This guide provides comprehensive patterns for preventing hook timeout failures in the test suite.

## Quick Reference: Hook Timeout Configuration

```typescript
import { 
  timeoutSafeBeforeEach, 
  timeoutSafeAfterEach,
  timeoutSafeBeforeAll,
  timeoutSafeAfterAll,
  withAsyncHookOperation,
  HOOK_TIMEOUT_CONFIG
} from '../setup/hook-timeout-configuration';
import { TIMEOUT_CONFIG } from '../utils/timeout-elimination-helpers';
```

## 1. Safe Hook Patterns

### ✅ Correct beforeEach Pattern
```typescript
// Use timeout-safe wrapper
timeoutSafeBeforeEach(async () => {
  // Async setup operations
  await withAsyncHookOperation(
    async () => {
      analyzer = PatternAnalyzer.getInstance();
      vi.clearAllMocks();
    },
    TIMEOUT_CONFIG.HOOK_SETUP,
    'test-setup'
  );
}, TIMEOUT_CONFIG.HOOK_BEFORE_EACH);

// OR with explicit timeout parameter
beforeEach(async () => {
  analyzer = PatternAnalyzer.getInstance();
  vi.clearAllMocks();
}, TIMEOUT_CONFIG.HOOK_BEFORE_EACH);
```

### ❌ Problematic beforeEach Pattern
```typescript
// Missing timeout parameter - will use 10000ms default
beforeEach(async () => {
  analyzer = PatternAnalyzer.getInstance();
  vi.clearAllMocks();
});

// No async protection for complex operations
beforeEach(async () => {
  await someSlowOperation(); // Could timeout
});
```

### ✅ Correct afterEach Pattern
```typescript
timeoutSafeAfterEach(async () => {
  await withAsyncHookOperation(
    async () => {
      vi.restoreAllMocks();
      if (global.gc) global.gc();
    },
    TIMEOUT_CONFIG.HOOK_CLEANUP,
    'test-cleanup'
  );
}, TIMEOUT_CONFIG.HOOK_AFTER_EACH);
```

## 2. Async Operations in Hooks

### ✅ Safe Async Operations
```typescript
beforeEach(async () => {
  // Wrap async operations with timeout protection
  await withAsyncHookOperation(
    async () => {
      const result = await someAsyncSetup();
      mockService.setup(result);
    },
    TIMEOUT_CONFIG.STANDARD,
    'async-setup'
  );
}, TIMEOUT_CONFIG.HOOK_BEFORE_EACH);
```

### ❌ Unsafe Async Operations
```typescript
beforeEach(async () => {
  // No timeout protection - could hang indefinitely
  await someAsyncSetup();
  await anotherAsyncOperation();
});
```

## 3. Mock Setup and Cleanup

### ✅ Timeout-Safe Mock Operations
```typescript
import { timeoutSafeMockSetup, timeoutSafeCleanup } from '../setup/hook-timeout-configuration';

beforeEach(async () => {
  await timeoutSafeMockSetup(() => {
    vi.clearAllMocks();
    mockService = createMockService();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
}, TIMEOUT_CONFIG.HOOK_BEFORE_EACH);

afterEach(async () => {
  await timeoutSafeCleanup(() => {
    vi.restoreAllMocks();
    mockService = null;
  });
}, TIMEOUT_CONFIG.HOOK_AFTER_EACH);
```

## 4. Complex Setup Operations

### ✅ Multi-Step Setup with Timeout Protection
```typescript
beforeEach(async () => {
  // Step 1: Basic setup
  await withAsyncHookOperation(
    () => { analyzer = PatternAnalyzer.getInstance(); },
    TIMEOUT_CONFIG.QUICK,
    'analyzer-setup'
  );
  
  // Step 2: Mock configuration
  await timeoutSafeMockSetup(() => {
    vi.clearAllMocks();
    setupMockResponses();
  });
  
  // Step 3: Data preparation
  await withAsyncHookOperation(
    async () => {
      mockData = await prepareMockData();
    },
    TIMEOUT_CONFIG.STANDARD,
    'data-preparation'
  );
}, TIMEOUT_CONFIG.HOOK_BEFORE_EACH);
```

## 5. Error Handling in Hooks

### ✅ Safe Error Handling
```typescript
afterEach(async () => {
  try {
    await timeoutSafeCleanup(() => {
      vi.restoreAllMocks();
    });
  } catch (error) {
    console.warn('Cleanup error (non-critical):', error);
    // Don't rethrow - allow test to complete
  }
}, TIMEOUT_CONFIG.HOOK_AFTER_EACH);
```

## 6. Hook Timeout Configuration Values

```typescript
export const HOOK_TIMEOUT_CONFIG = {
  BEFORE_EACH: 20000,   // 20s for beforeEach setup
  AFTER_EACH: 15000,    // 15s for afterEach cleanup
  BEFORE_ALL: 45000,    // 45s for beforeAll setup
  AFTER_ALL: 45000,     // 45s for afterAll cleanup
  ASYNC_OPERATION: 15000, // 15s for async operations
  MOCK_SETUP: 5000,     // 5s for mock setup
  CLEANUP: 5000,        // 5s for cleanup
} as const;
```

## 7. Integration Test Hooks

For integration tests that require longer setup times:

```typescript
beforeAll(async () => {
  await withAsyncHookOperation(
    async () => {
      await startTestServer();
      await initializeDatabase();
    },
    TIMEOUT_CONFIG.SERVER_STARTUP,
    'integration-setup'
  );
}, TIMEOUT_CONFIG.HOOK_BEFORE_ALL);

afterAll(async () => {
  await withAsyncHookOperation(
    async () => {
      await stopTestServer();
      await cleanupDatabase();
    },
    TIMEOUT_CONFIG.SERVER_STARTUP,
    'integration-cleanup'
  );
}, TIMEOUT_CONFIG.HOOK_AFTER_ALL);
```

## 8. Debugging Hook Timeouts

### Enable Hook Execution Diagnostics
```typescript
import { getHookExecutionDiagnostics } from '../setup/hook-timeout-configuration';

afterAll(() => {
  const diagnostics = getHookExecutionDiagnostics();
  console.log('Hook execution diagnostics:', diagnostics);
});
```

### Emergency Timeout Cleanup
```typescript
import { emergencyTimeoutCleanup } from '../setup/hook-timeout-configuration';

// In problematic test files
afterEach(() => {
  emergencyTimeoutCleanup(); // Clear any stuck timeouts
});
```

## 9. Common Timeout Scenarios

### Database Operations
```typescript
beforeEach(async () => {
  await withAsyncHookOperation(
    async () => {
      await setupTestDatabase();
    },
    TIMEOUT_CONFIG.DATABASE,
    'database-setup'
  );
}, TIMEOUT_CONFIG.HOOK_BEFORE_EACH);
```

### Network Operations
```typescript
beforeEach(async () => {
  await withAsyncHookOperation(
    async () => {
      await waitForApiAvailability();
    },
    TIMEOUT_CONFIG.NETWORK,
    'network-check'
  );
}, TIMEOUT_CONFIG.HOOK_BEFORE_EACH);
```

### Timer-Based Operations
```typescript
beforeEach(() => {
  vi.useFakeTimers();
}, TIMEOUT_CONFIG.QUICK);

afterEach(() => {
  vi.useRealTimers();
}, TIMEOUT_CONFIG.QUICK);
```

## 10. Migration Guidelines

### From Standard Hooks to Timeout-Safe Hooks

**Before:**
```typescript
beforeEach(async () => {
  vi.clearAllMocks();
  setupMocks();
});
```

**After:**
```typescript
timeoutSafeBeforeEach(async () => {
  await timeoutSafeMockSetup(() => {
    vi.clearAllMocks();
    setupMocks();
  });
});
```

## 11. Performance Considerations

- Use `TIMEOUT_CONFIG.QUICK` for simple sync operations
- Use `TIMEOUT_CONFIG.STANDARD` for typical async operations  
- Use `TIMEOUT_CONFIG.SLOW` for complex or network operations
- Always use the smallest appropriate timeout to catch real issues

## 12. Troubleshooting

### If hooks still timeout:
1. Check for infinite loops in hook code
2. Verify all async operations are properly awaited
3. Look for unresolved promises
4. Check for recursive function calls
5. Monitor memory usage for memory leaks

### Emergency fixes:
1. Use `emergencyTimeoutCleanup()` to clear stuck timeouts
2. Add explicit `setTimeout` protection around problematic code
3. Increase timeout values temporarily while investigating
4. Split complex hooks into multiple simpler hooks

This guide ensures all hooks in the test suite are protected against timeout failures while maintaining test reliability and performance.