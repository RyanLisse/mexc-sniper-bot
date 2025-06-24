// Build-safe dynamic imports to prevent SSR issues during Next.js build
import { serve } from "inngest/next";

// Use dynamic imports to prevent build-time evaluation issues
async function getInngestSetup() {
  try {
    // Dynamic imports to avoid build-time module evaluation
    const { inngest } = await import("../../../src/inngest/client");
    const { 
      pollMexcCalendar,
      watchMexcSymbol,
      analyzeMexcPatterns,
      createMexcTradingStrategy,
    } = await import("../../../src/inngest/functions");
    const {
      scheduledCalendarMonitoring,
      scheduledPatternAnalysis,
      scheduledHealthCheck,
      scheduledDailyReport,
      scheduledIntensiveAnalysis,
      emergencyResponseHandler,
    } = await import("../../../src/inngest/scheduled-functions");

    return {
      client: inngest,
      functions: [
        // Core workflow functions
        pollMexcCalendar,         // Calendar discovery with multi-agent analysis
        watchMexcSymbol,          // Symbol monitoring and readiness analysis
        analyzeMexcPatterns,      // Pattern discovery and validation
        createMexcTradingStrategy, // Trading strategy creation and risk assessment
        
        // Scheduled monitoring functions
        scheduledCalendarMonitoring,  // Every 30 minutes
        scheduledPatternAnalysis,     // Every 15 minutes
        scheduledHealthCheck,         // Every 5 minutes
        scheduledDailyReport,         // Daily at 9 AM UTC
        scheduledIntensiveAnalysis,   // Every 2 hours
        emergencyResponseHandler,     // Event-triggered emergency response
      ],
    };
  } catch (error) {
    // Fallback for build-time safety
    console.warn("Inngest setup failed during build:", error);
    return null;
  }
}

// Build-safe inngest handler
let inngestHandler: any = null;

// Only initialize during runtime, not build time
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  // This will be initialized on first request
  getInngestSetup().then(setup => {
    if (setup) {
      inngestHandler = serve(setup);
    }
  }).catch(error => {
    console.warn("Failed to initialize inngest handler:", error);
  });
}

// Export request handlers with build-time safety
export async function GET(request: Request) {
  if (!inngestHandler) {
    const setup = await getInngestSetup();
    if (!setup) {
      return new Response("Inngest not available", { status: 503 });
    }
    inngestHandler = serve(setup);
  }
  return inngestHandler.GET(request);
}

export async function POST(request: Request) {
  if (!inngestHandler) {
    const setup = await getInngestSetup();
    if (!setup) {
      return new Response("Inngest not available", { status: 503 });
    }
    inngestHandler = serve(setup);
  }
  return inngestHandler.POST(request);
}

export async function PUT(request: Request) {
  if (!inngestHandler) {
    const setup = await getInngestSetup();
    if (!setup) {
      return new Response("Inngest not available", { status: 503 });
    }
    inngestHandler = serve(setup);
  }
  return inngestHandler.PUT(request);
}