/**
 * BUILD-SAFE SERVICE LOADER
 *
 * PERFORMANCE OPTIMIZATION: Prevents redundant service initialization during build time
 * Addresses Agent 6's critical finding of multiple service initializations causing 45s+ build times
 */

// Build-time detection
const isBuildTime = () => {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-development-server" ||
    process.env.NEXT_PHASE === "phase-development-build" ||
    process.env.npm_lifecycle_event === "build" ||
    process.env.npm_lifecycle_script?.includes("next build") ||
    process.env.npm_command === "build" ||
    process.argv.includes("build") ||
    (typeof window === "undefined" &&
      process.env.NODE_ENV === "production" &&
      !process.env.VERCEL &&
      !process.env.RAILWAY_ENVIRONMENT)
  );
};

// Service initialization cache to prevent duplicates
const serviceCache = new Map<string, any>();
const initializationPromises = new Map<string, Promise<any>>();

/**
 * CRITICAL: Build-safe service loader that prevents redundant initialization
 *
 * @param serviceId Unique identifier for the service
 * @param initializerFn Function that initializes the service
 * @param buildTimeMock Mock implementation for build time
 * @returns Service instance or mock
 */
export function loadServiceSafely<T>(
  serviceId: string,
  initializerFn: () => T | Promise<T>,
  buildTimeMock?: () => T
): T | Promise<T> {
  // PERFORMANCE: Return mock during build time to prevent initialization
  if (isBuildTime()) {
    if (buildTimeMock) {
      return buildTimeMock();
    }

    // Default build-time mock
    return {
      initialized: false,
      buildTimeMock: true,
      // Common service methods
      start: () => Promise.resolve(),
      stop: () => Promise.resolve(),
      restart: () => Promise.resolve(),
      health: () => ({ status: "build-mock", healthy: true }),
      // Pattern detection mock methods
      detectPatterns: () => Promise.resolve([]),
      analyzePattern: () => Promise.resolve({ confidence: 0, mock: true }),
      // Trading service mock methods
      executeTrade: () =>
        Promise.resolve({ success: false, message: "Build-time mock" }),
      getPositions: () => Promise.resolve([]),
      // Calendar service mock methods
      getListings: () =>
        Promise.resolve({ success: true, data: [], cached: true }),
      getUpcomingListings: () =>
        Promise.resolve({ success: true, data: [], cached: true }),
      // Performance monitoring mock methods
      recordMetric: () => {},
      getMetrics: () => ({}),
      // Generic mock for any other calls
      [Symbol.toStringTag]: "BuildTimeMock",
    } as T;
  }

  // PERFORMANCE: Return cached service if already initialized
  if (serviceCache.has(serviceId)) {
    return serviceCache.get(serviceId);
  }

  // PERFORMANCE: If initialization is in progress, return the promise
  if (initializationPromises.has(serviceId)) {
    return initializationPromises.get(serviceId)!;
  }

  // Initialize the service
  try {
    const result = initializerFn();

    if (result instanceof Promise) {
      // Handle async initialization
      const promise = result
        .then((service) => {
          serviceCache.set(serviceId, service);
          initializationPromises.delete(serviceId);
          return service;
        })
        .catch((error) => {
          console.warn(
            `[BuildSafeLoader] Failed to initialize service ${serviceId}:`,
            error
          );
          initializationPromises.delete(serviceId);
          throw error;
        });

      initializationPromises.set(serviceId, promise);
      return promise;
    } else {
      // Handle sync initialization
      serviceCache.set(serviceId, result);
      return result;
    }
  } catch (error) {
    console.warn(
      `[BuildSafeLoader] Failed to initialize service ${serviceId}:`,
      error
    );
    throw error;
  }
}

/**
 * PERFORMANCE: Lazy service loader that only initializes when first accessed
 */
export function createLazyService<T>(
  serviceId: string,
  initializerFn: () => T | Promise<T>,
  buildTimeMock?: () => T
): () => T | Promise<T> {
  return () => loadServiceSafely(serviceId, initializerFn, buildTimeMock);
}

/**
 * PERFORMANCE: Service proxy that prevents method calls during build time
 */
export function createBuildSafeProxy<T extends object>(
  serviceId: string,
  initializerFn: () => T | Promise<T>,
  buildTimeMock?: () => T
): T {
  return new Proxy({} as T, {
    get(_target, prop: keyof T) {
      const service = loadServiceSafely(
        serviceId,
        initializerFn,
        buildTimeMock
      );

      if (service instanceof Promise) {
        // For async services, return a promise that resolves to the method call
        return (...args: any[]) => {
          return service.then((s) => {
            const method = s[prop];
            if (typeof method === "function") {
              return (method as Function).apply(s, args);
            }
            return method;
          });
        };
      } else {
        const value = service[prop];
        if (typeof value === "function") {
          return (value as Function).bind(service);
        }
        return value;
      }
    },
  });
}

/**
 * PERFORMANCE: Clear service cache (useful for tests and hot reloading)
 */
export function clearServiceCache(serviceId?: string): void {
  if (serviceId) {
    serviceCache.delete(serviceId);
    initializationPromises.delete(serviceId);
  } else {
    serviceCache.clear();
    initializationPromises.clear();
  }
}

/**
 * PERFORMANCE: Get cache statistics for monitoring
 */
export function getServiceCacheStats() {
  return {
    cachedServices: serviceCache.size,
    pendingInitializations: initializationPromises.size,
    isBuildTime: isBuildTime(),
    serviceIds: Array.from(serviceCache.keys()),
  };
}
