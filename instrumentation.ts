/**
 * Vercel-compatible OpenTelemetry Instrumentation
 * 
 * Temporarily disabled for build compatibility
 * TODO: Re-enable with Vercel-compatible configuration
 */

export async function register() {
  // Telemetry disabled during build process due to gRPC/Node.js module bundling issues
  console.log('[OpenTelemetry] Instrumentation temporarily disabled for Vercel compatibility');
  return;
}