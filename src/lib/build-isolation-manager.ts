/**
 * BUILD ISOLATION MANAGER
 *
 * CRITICAL PERFORMANCE FIX: Complete isolation of services during entire build process
 * Addresses 61s build time by preventing ALL database/service calls during build AND static generation
 */

// Global build state management
let isBuildProcess = false;
let buildPhase: "compilation" | "static-generation" | "runtime" = "runtime";

/**
 * CRITICAL: Comprehensive build process detection
 */
export function detectBuildProcess(): boolean {
  // Check multiple build indicators
  const buildIndicators = [
    // Next.js phases
    process.env.NEXT_PHASE === "phase-production-build",
    process.env.NEXT_PHASE === "phase-development-server",
    process.env.NEXT_PHASE === "phase-development-build",

    // Build scripts
    process.env.npm_lifecycle_event === "build",
    process.env.npm_lifecycle_script?.includes("next build"),
    process.env.npm_command === "build",
    process.argv.includes("build"),

    // Static generation indicators
    process.env.__NEXT_PRIVATE_PREBUNDLED_REACT,
    process.env.__NEXT_PRIVATE_STAND_ALONE,
    process.env.NEXT_BUILD_ID,
    process.env.BUILD_ID,

    // Environment indicators
    typeof window === "undefined" &&
      process.env.NODE_ENV === "production" &&
      !process.env.VERCEL &&
      !process.env.RAILWAY_ENVIRONMENT,

    // Process arguments
    process.argv.some((arg) => arg.includes("next") && arg.includes("build")),
  ];

  return buildIndicators.some(Boolean);
}

/**
 * CRITICAL: Check if we're in static generation phase
 */
export function isStaticGeneration(): boolean {
  return (
    typeof window === "undefined" &&
    process.env.NODE_ENV === "production" &&
    (process.env.__NEXT_PRIVATE_PREBUNDLED_REACT ||
      process.env.NEXT_BUILD_ID ||
      // Check if we're in getStaticProps/getServerSideProps context
      process.env.__NEXT_PRIVATE_STATIC_GENERATION ||
      // Stack trace analysis for static generation
      new Error().stack?.includes("getStaticProps") ||
      new Error().stack?.includes("getServerSideProps") ||
      new Error().stack?.includes("generateStaticParams"))
  );
}

/**
 * PERFORMANCE: Initialize build isolation
 */
export function initializeBuildIsolation(): void {
  isBuildProcess = detectBuildProcess();

  if (isBuildProcess) {
    buildPhase = isStaticGeneration() ? "static-generation" : "compilation";

    console.log(`🛡️  [BuildIsolation] Build process detected: ${buildPhase}`);

    // Override global APIs that might cause issues
    overrideGlobalAPIs();

    // Set environment flag for other modules
    process.env.__BUILD_ISOLATION_ACTIVE = "true";
    process.env.__BUILD_PHASE = buildPhase;
  }
}

/**
 * CRITICAL: Override problematic global APIs during build
 */
function overrideGlobalAPIs(): void {
  if (typeof globalThis !== "undefined") {
    // Override database-related globals
    const originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (callback: any, delay?: number, ...args: any[]) => {
      // During build, reduce timeouts to prevent hanging
      // FIXED: Prevent NaN timeout values by ensuring delay is a valid number
      const safeDelay =
        typeof delay === "number" &&
        !Number.isNaN(delay) &&
        Number.isFinite(delay) &&
        delay >= 0
          ? delay
          : 0;
      const buildDelay = Math.min(safeDelay, 1000); // Max 1 second timeouts during build

      // DEBUG: Log if we detected a NaN value
      if (typeof delay === "number" && Number.isNaN(delay)) {
        console.warn(
          `[BuildIsolation] Detected NaN timeout value, using 0ms instead`
        );
      }

      return originalSetTimeout(callback, buildDelay, ...args);
    };

    // Override network APIs
    if (typeof globalThis.fetch !== "undefined") {
      const _originalFetch = globalThis.fetch;
      globalThis.fetch = (...args: any[]) => {
        console.warn("[BuildIsolation] Blocking fetch during build:", args[0]);
        return Promise.resolve(
          new Response('{"blocked":"build-time"}', {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        );
      };
    }
  }
}

/**
 * CRITICAL: Create build-safe mock for any service
 */
export function createBuildSafeMock<T>(
  serviceName: string,
  mockImplementation?: Partial<T>
): T {
  const defaultMock = {
    // Common service methods
    initialize: () => Promise.resolve(),
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
    restart: () => Promise.resolve(),
    health: () => ({
      status: "build-mock",
      healthy: true,
      service: serviceName,
    }),

    // Database operations
    execute: () => Promise.resolve([]),
    query: () => Promise.resolve([]),
    insert: () => Promise.resolve({ id: "mock-id" }),
    update: () => Promise.resolve({ affected: 0 }),
    delete: () => Promise.resolve({ affected: 0 }),
    transaction: (fn: any) =>
      Promise.resolve(fn({ execute: () => Promise.resolve([]) })),

    // API operations
    get: () =>
      Promise.resolve({ success: true, data: [], message: "build-mock" }),
    post: () =>
      Promise.resolve({ success: true, data: {}, message: "build-mock" }),
    put: () =>
      Promise.resolve({ success: true, data: {}, message: "build-mock" }),

    // Trading operations
    executeTrade: () =>
      Promise.resolve({ success: false, message: "Build-time mock" }),
    getPositions: () => Promise.resolve([]),
    getBalance: () => Promise.resolve({ total: 0, available: 0 }),

    // Pattern detection
    detectPatterns: () => Promise.resolve([]),
    analyzePattern: () => Promise.resolve({ confidence: 0, mock: true }),

    // Calendar operations
    getListings: () =>
      Promise.resolve({ success: true, data: [], cached: true }),
    getUpcomingListings: () =>
      Promise.resolve({ success: true, data: [], cached: true }),

    // Performance monitoring
    recordMetric: () => {},
    getMetrics: () => ({}),
    startMonitoring: () => {},
    stopMonitoring: () => {},

    // Generic catch-all
    [Symbol.toStringTag]: `BuildMock_${serviceName}`,
    __isBuildMock: true,
    __serviceName: serviceName,

    // Make any method call return safe mock data
    __call: () => Promise.resolve({ mock: true, service: serviceName }),
  };

  return new Proxy(defaultMock as any, {
    get(target, prop: any) {
      // Return specific mock implementation if provided
      if (mockImplementation && prop in mockImplementation) {
        const value =
          mockImplementation[prop as keyof typeof mockImplementation];
        if (typeof value === "function") {
          return (value as Function).bind(mockImplementation);
        }
        return value;
      }

      // Return default mock implementation
      if (prop in target) {
        const value = target[prop as keyof typeof target];
        if (typeof value === "function") {
          return (value as Function).bind(target);
        }
        return value;
      }

      // For unknown methods, return a safe mock function
      return () =>
        Promise.resolve({ mock: true, method: prop, service: serviceName });
    },
  });
}

/**
 * CRITICAL: Service loader that respects build isolation
 */
export function loadServiceWithIsolation<T>(
  serviceName: string,
  loader: () => T | Promise<T>,
  mockImplementation?: Partial<T>
): T | Promise<T> {
  // Check if we're in any build phase
  if (isBuildProcess || detectBuildProcess() || isStaticGeneration()) {
    console.log(`🛡️  [BuildIsolation] Blocking service load: ${serviceName}`);
    return createBuildSafeMock<T>(serviceName, mockImplementation);
  }

  // Normal runtime loading
  try {
    return loader();
  } catch (error) {
    console.warn(
      `[BuildIsolation] Service load failed, using mock: ${serviceName}`,
      error
    );
    return createBuildSafeMock<T>(serviceName, mockImplementation);
  }
}

/**
 * CRITICAL: Database connection wrapper with build isolation
 */
export function createBuildSafeDatabase() {
  if (isBuildProcess || detectBuildProcess() || isStaticGeneration()) {
    return createBuildSafeMock("database", {
      // Database-specific mocks
      execute: (sql: any) => {
        console.log(
          `🛡️  [BuildIsolation] Blocked SQL: ${sql?.toString()?.substring(0, 50)}...`
        );
        return Promise.resolve([]);
      },
      select: () => Promise.resolve([]),
      insert: () => ({
        values: () => ({
          returning: () => Promise.resolve([{ id: "mock-id" }]),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve([]),
        }),
      }),
      delete: () => ({
        where: () => Promise.resolve([]),
      }),
    });
  }

  // Return null to indicate normal database should be used
  return null;
}

/**
 * CRITICAL: API route wrapper with build isolation
 */
export function withBuildIsolation(handler: any) {
  return async (req: any, res: any) => {
    if (isBuildProcess || detectBuildProcess() || isStaticGeneration()) {
      console.log(
        `🛡️  [BuildIsolation] Blocked API route: ${req?.url || "unknown"}`
      );

      if (res?.json) {
        return res.json({
          success: true,
          data: [],
          message: "Build-time mock response",
          __isBuildMock: true,
        });
      }

      return {
        success: true,
        data: [],
        message: "Build-time mock response",
        __isBuildMock: true,
      };
    }

    return handler(req, res);
  };
}

/**
 * PERFORMANCE: Get build isolation status
 */
export function getBuildIsolationStatus() {
  return {
    isBuildProcess,
    buildPhase,
    isStaticGeneration: isStaticGeneration(),
    buildProcessDetected: detectBuildProcess(),
    environmentFlags: {
      NEXT_PHASE: process.env.NEXT_PHASE,
      npm_lifecycle_event: process.env.npm_lifecycle_event,
      NODE_ENV: process.env.NODE_ENV,
      BUILD_ISOLATION_ACTIVE: process.env.__BUILD_ISOLATION_ACTIVE,
    },
  };
}

/**
 * CRITICAL: Clean up build isolation
 */
export function cleanupBuildIsolation(): void {
  isBuildProcess = false;
  buildPhase = "runtime";
  delete process.env.__BUILD_ISOLATION_ACTIVE;
  delete process.env.__BUILD_PHASE;
}

// Auto-initialize on module load
initializeBuildIsolation();

// Export status check functions
export { detectBuildProcess as isBuildTime };

// Process cleanup
process.on("exit", cleanupBuildIsolation);
process.on("SIGINT", cleanupBuildIsolation);
process.on("SIGTERM", cleanupBuildIsolation);
