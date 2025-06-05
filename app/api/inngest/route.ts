import { serve } from "inngest/next";
import { inngest } from "../../../src/inngest/client";
import { 
  pollMexcCalendar,
  watchMexcSymbol,
  analyzeMexcPatterns,
  createMexcTradingStrategy,
} from "../../../src/inngest/functions";

// Create the handler and configure it to serve our MEXC multi-agent functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    pollMexcCalendar,         // Calendar discovery with multi-agent analysis
    watchMexcSymbol,          // Symbol monitoring and readiness analysis
    analyzeMexcPatterns,      // Pattern discovery and validation
    createMexcTradingStrategy, // Trading strategy creation and risk assessment
  ],
});