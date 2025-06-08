import { serve } from "inngest/next";
import { inngest } from "../../../src/inngest/client";
import { 
  pollMexcCalendar,
  watchMexcSymbol,
  analyzeMexcPatterns,
  createMexcTradingStrategy,
} from "../../../src/inngest/functions";
import {
  scheduledCalendarMonitoring,
  scheduledPatternAnalysis,
  scheduledHealthCheck,
  scheduledDailyReport,
  scheduledIntensiveAnalysis,
  emergencyResponseHandler,
} from "../../../src/inngest/scheduled-functions";

// Create the handler and configure it to serve our MEXC multi-agent functions
export const { GET, POST, PUT } = serve({
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
});