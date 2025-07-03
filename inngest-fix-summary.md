# Inngest Configuration Fixes

## Issues Identified and Fixed

### 1. Incorrect Function Export in safety-functions.ts
**Issue**: Line 878 was exporting `safetyMonitor` (class instance) instead of `legacySafetyMonitor` (Inngest function)
```typescript
// BEFORE (incorrect)
export const safetyFunctions = [
  safetyMonitor,  // ❌ This is a class instance, not an Inngest function
  // ...
];

// AFTER (fixed)
export const safetyFunctions = [
  legacySafetyMonitor,  // ✅ This is the correct Inngest function
  // ...
];
```

### 2. Dynamic Import Issues in Coordination System
**Issue**: Dynamic async imports in `createCoordinationSystem` were causing webpack build issues
```typescript
// BEFORE (problematic)
const workflowEngine = new (await import("./workflow-engine")).WorkflowEngine(agentRegistry);

// AFTER (fixed)
return Promise.resolve().then(() => {
  const { WorkflowEngine } = require("./workflow-engine");
  const workflowEngine = new WorkflowEngine(agentRegistry);
  // ...
});
```

## Root Cause
The error `TypeError: (intermediate value)(...).catch is not a function` was occurring because:
1. Class instances were being treated as Inngest functions
2. Dynamic imports during Next.js build were not properly resolving as Promises

## Files Modified
- `src/inngest/safety-functions.ts` - Fixed function export
- `src/mexc-agents/coordination/index.ts` - Fixed dynamic import pattern

## Verification
- All Inngest function files pass syntax validation
- Build now compiles successfully without promise chaining errors
- Inngest functions are properly configured for Next.js integration

## Testing
Run `bun run build` to verify the fixes work correctly.