/**
 * Build-safe Instrumentation
 * 
 * OpenTelemetry completely disabled to prevent webpack bundling issues
 * with gRPC and Node.js modules during Next.js build process
 */

export async function register() {
  // Completely disable telemetry to prevent webpack bundling issues
  // OpenTelemetry imports gRPC modules that can't be bundled for the browser
  
  // Future: Re-enable with proper Vercel-compatible setup
  if (process.env.NODE_ENV === 'development') {
    console.log('[Instrumentation] OpenTelemetry disabled for build compatibility');
  }
  
  return;
}