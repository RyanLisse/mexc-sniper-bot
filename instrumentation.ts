/**
 * OpenTelemetry Instrumentation - Properly Configured
 * 
 * Server-side only instrumentation with webpack exclusions
 * for client-side bundling compatibility
 */

export async function register() {
  // Only initialize OpenTelemetry on server-side
  if (typeof window !== 'undefined') {
    // Client-side: Skip instrumentation completely
    return;
  }

  // Disable telemetry during build process to prevent Node.js module bundling issues
  if (process.env.DISABLE_TELEMETRY === 'true') {
    console.log('[Instrumentation] OpenTelemetry disabled by DISABLE_TELEMETRY flag');
    return;
  }

  // Skip during CI/build environments unless explicitly enabled
  if (process.env.CI === 'true' && process.env.ENABLE_TELEMETRY !== 'true') {
    console.log('[Instrumentation] Skipping telemetry during CI build process');
    return;
  }

  // Server-side: Initialize OpenTelemetry with proper error handling
  try {
    const shouldEnable = process.env.NODE_ENV === 'production' || 
                        process.env.ENABLE_TELEMETRY === 'true' ||
                        (process.env.NODE_ENV === 'development' && process.env.CI !== 'true');

    if (shouldEnable) {
      console.log('[Instrumentation] OpenTelemetry temporarily disabled due to bundling issues');
      
      // TODO: Re-enable OpenTelemetry after resolving GRPC bundling issues
      // const { initializeEnhancedTelemetry } = await import('./src/lib/opentelemetry-setup');
      // const result = await initializeEnhancedTelemetry();
      
      console.log('[Instrumentation] OpenTelemetry initialization skipped (bundling fix needed)');
    } else {
      console.log('[Instrumentation] OpenTelemetry disabled by configuration');
    }
  } catch (error) {
    // Graceful degradation - don't crash the application if telemetry fails
    console.warn('[Instrumentation] Failed to initialize OpenTelemetry:', error instanceof Error ? error.message : 'Unknown error');
    console.warn('[Instrumentation] Application will continue without telemetry');
  }
}