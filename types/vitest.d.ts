/// <reference types="vitest" />
/// <reference types="@vitest/ui" />

import type { TestContext } from 'vitest';

declare global {
  namespace vi {
    export * from 'vitest';
  }
}

// Extend TestContext to fix call signature issues
declare module 'vitest' {
  interface TestContext {
    // Add any missing methods if needed
  }
}

export {};