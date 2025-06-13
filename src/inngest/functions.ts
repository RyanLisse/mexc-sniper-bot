import { MexcOrchestrator } from "../mexc-agents/orchestrator";
import { inngest } from "./client";
// Import safety functions
import { safetyFunctions } from "./safety-functions";

// Inngest step interface
interface InngestStep {
  run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>;
}

// Agent response type definitions
interface CalendarDiscoveryData {
  newListings?: Array<{
    vcoinId: string;
    symbolName?: string;
    projectName?: string;
    launchTime?: string;
  }>;
  readyTargets?: unknown[];
}

interface SymbolAnalysisData {
  symbolReady?: boolean;
  hasCompleteData?: boolean;
  riskLevel?: "low" | "medium" | "high";
  symbolData?: Record<string, unknown>;
}

interface PatternAnalysisData {
  patterns?: unknown[];
  recommendations?: unknown[];
  confidenceScore?: number;
}

interface TradingStrategyData {
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  positionSize?: number;
  riskRewardRatio?: number;
}

interface AgentWorkflowResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    agentsUsed: string[];
    duration?: number;
    confidence?: number;
  };
}

// Type guards for agent results
function isAgentWorkflowResult(value: unknown): value is AgentWorkflowResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AgentWorkflowResult).success === "boolean"
  );
}

function isCalendarDiscoveryData(value: unknown): value is CalendarDiscoveryData {
  return typeof value === "object" && value !== null;
}

function isSymbolAnalysisData(value: unknown): value is SymbolAnalysisData {
  return typeof value === "object" && value !== null;
}

function isPatternAnalysisData(value: unknown): value is PatternAnalysisData {
  return typeof value === "object" && value !== null;
}

function isTradingStrategyData(value: unknown): value is TradingStrategyData {
  return typeof value === "object" && value !== null;
}

// Helper function to update workflow status
async function updateWorkflowStatus(action: string, data: unknown) {
  try {
    const response = await fetch("http://localhost:3000/api/workflow-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, data }),
    });

    if (!response.ok) {
      console.warn("Failed to update workflow status:", response.statusText);
    }
  } catch (error) {
    console.warn("Error updating workflow status:", error);
  }
}

// MEXC Calendar polling event data
interface MexcCalendarPollRequestedData {
  trigger?: string;
  force?: boolean;
}

// MEXC Symbol watching event data
interface MexcSymbolWatchRequestedData {
  vcoinId: string;
  symbolName?: string;
  projectName?: string;
  launchTime?: string;
  attempt?: number;
}

// MEXC Pattern analysis event data
interface MexcPatternAnalysisRequestedData {
  vcoinId?: string;
  symbols?: string[];
  analysisType?: "discovery" | "monitoring" | "execution";
}

// MEXC Trading strategy event data
interface MexcTradingStrategyRequestedData {
  vcoinId: string;
  symbolData: {
    symbol?: string;
    price?: number;
    volume?: number;
    [key: string]: unknown;
  };
  riskLevel?: "low" | "medium" | "high";
  capital?: number;
}

// MEXC Calendar Polling Function
export const pollMexcCalendar = inngest.createFunction(
  { id: "poll-mexc-calendar" },
  { event: "mexc/calendar.poll" },
  async ({
    event,
    step,
  }: { event: { data: MexcCalendarPollRequestedData }; step: InngestStep }) => {
    const { trigger = "manual", force = false } = event.data;

    // Update status: Started calendar discovery
    await updateWorkflowStatus("addActivity", {
      activity: {
        type: "calendar",
        message: "Calendar discovery started",
      },
    });

    // Step 1: Execute Multi-Agent Calendar Discovery
    const discoveryResult = await step.run("calendar-discovery-workflow", async () => {
      const orchestrator = new MexcOrchestrator();
      return await orchestrator.executeCalendarDiscoveryWorkflow({
        trigger,
        force,
      });
    });

    // Type guard for discovery result
    if (!isAgentWorkflowResult(discoveryResult)) {
      throw new Error("Invalid discovery result format");
    }

    if (!discoveryResult.success) {
      await updateWorkflowStatus("addActivity", {
        activity: {
          type: "calendar",
          message: `Calendar discovery failed: ${discoveryResult.error}`,
        },
      });
      throw new Error(`Calendar discovery failed: ${discoveryResult.error}`);
    }

    // Type guard for discovery data
    const discoveryData = isCalendarDiscoveryData(discoveryResult.data)
      ? discoveryResult.data
      : null;

    // Update metrics
    await updateWorkflowStatus("updateMetrics", {
      metrics: {
        readyTokens: discoveryData?.readyTargets?.length || 0,
      },
    });

    // Step 2: Process and send follow-up events for new listings
    const followUpEvents = await step.run("process-discovery-results", async () => {
      if (discoveryData?.newListings?.length) {
        // Send symbol watch events for new discoveries
        const events = discoveryData.newListings.map(
          (listing: {
            vcoinId: string;
            symbolName?: string;
            projectName?: string;
            launchTime?: string;
          }) => ({
            name: "mexc/symbol.watch",
            data: {
              vcoinId: listing.vcoinId,
              symbolName: listing.symbolName,
              projectName: listing.projectName,
              launchTime: listing.launchTime,
              attempt: 1,
            },
          })
        );

        // Send events
        for (const eventData of events) {
          await inngest.send(eventData);
        }

        await updateWorkflowStatus("addActivity", {
          activity: {
            type: "calendar",
            message: `Calendar scan completed - ${discoveryData.newListings.length} new listings found`,
          },
        });

        return events.length;
      }
      await updateWorkflowStatus("addActivity", {
        activity: {
          type: "calendar",
          message: "Calendar scan completed - no new listings",
        },
      });
      return 0;
    });

    return {
      status: "success",
      trigger,
      newListingsFound: discoveryData?.newListings?.length || 0,
      readyTargetsFound: discoveryData?.readyTargets?.length || 0,
      followUpEventsSent: followUpEvents,
      timestamp: new Date().toISOString(),
      metadata: {
        agentsUsed: ["calendar", "pattern-discovery", "api"],
        analysisComplete: true,
      },
    };
  }
);

// MEXC Symbol Watching Function
export const watchMexcSymbol = inngest.createFunction(
  { id: "watch-mexc-symbol" },
  { event: "mexc/symbol.watch" },
  async ({ event, step }: { event: { data: MexcSymbolWatchRequestedData }; step: InngestStep }) => {
    const { vcoinId, symbolName, projectName, launchTime, attempt = 1 } = event.data;

    if (!vcoinId) {
      throw new Error("Missing vcoinId in event data");
    }

    // Update status: Started symbol watching
    await updateWorkflowStatus("addActivity", {
      activity: {
        type: "analysis",
        message: `Watching symbol ${symbolName || vcoinId} (attempt ${attempt})`,
      },
    });

    // Step 1: Execute Multi-Agent Symbol Analysis
    const analysisResult = await step.run("symbol-analysis-workflow", async () => {
      const orchestrator = new MexcOrchestrator();
      return await orchestrator.executeSymbolAnalysisWorkflow({
        vcoinId,
        symbolName,
        projectName,
        launchTime,
        attempt,
      });
    });

    // Type guard for analysis result
    if (!isAgentWorkflowResult(analysisResult)) {
      throw new Error("Invalid analysis result format");
    }

    if (!analysisResult.success) {
      throw new Error(`Symbol analysis failed: ${analysisResult.error}`);
    }

    // Type guard for analysis data
    const analysisData = isSymbolAnalysisData(analysisResult.data) ? analysisResult.data : null;

    // Step 2: Handle results based on symbol status
    const actionResult = await step.run("process-symbol-results", async () => {
      const { symbolReady, hasCompleteData, riskLevel } = analysisData || {};

      if (symbolReady && hasCompleteData) {
        // Create trading strategy and target
        await inngest.send({
          name: "mexc/strategy.create",
          data: {
            vcoinId,
            symbolData: analysisData?.symbolData,
            riskLevel: riskLevel || "medium",
          },
        });

        await updateWorkflowStatus("addActivity", {
          activity: {
            type: "pattern",
            message: `Pattern detected for ${symbolName || vcoinId} - ready state confirmed`,
          },
        });

        return { action: "strategy_created", targetReady: true };
      }
      if (attempt < 10) {
        // Schedule recheck
        await inngest.send({
          name: "mexc/symbol.watch",
          data: {
            vcoinId,
            symbolName,
            projectName,
            launchTime,
            attempt: attempt + 1,
          },
        });

        return { action: "recheck_scheduled", nextAttempt: attempt + 1 };
      }
      return { action: "max_attempts_reached", abandoned: true };
    });

    return {
      status: "success",
      vcoinId,
      symbolName,
      attempt,
      symbolReady: analysisData?.symbolReady || false,
      action:
        typeof actionResult === "object" && actionResult !== null && "action" in actionResult
          ? (actionResult as { action: string }).action
          : "unknown",
      timestamp: new Date().toISOString(),
      metadata: {
        agentsUsed: ["symbol-analysis", "pattern-discovery", "api"],
        hasCompleteData: analysisData?.hasCompleteData || false,
      },
    };
  }
);

// MEXC Pattern Analysis Function
export const analyzeMexcPatterns = inngest.createFunction(
  { id: "analyze-mexc-patterns" },
  { event: "mexc/patterns.analyze" },
  async ({
    event,
    step,
  }: { event: { data: MexcPatternAnalysisRequestedData }; step: InngestStep }) => {
    const { vcoinId, symbols, analysisType = "discovery" } = event.data;

    // Update status: Started pattern analysis
    await updateWorkflowStatus("addActivity", {
      activity: {
        type: "pattern",
        message: `Pattern analysis started for ${symbols?.length || 0} symbols`,
      },
    });

    // Step 1: Execute Multi-Agent Pattern Analysis
    const patternResult = await step.run("pattern-analysis-workflow", async () => {
      const orchestrator = new MexcOrchestrator();
      return await orchestrator.executePatternAnalysisWorkflow({
        vcoinId,
        symbols,
        analysisType,
      });
    });

    // Type guard for pattern result
    if (!isAgentWorkflowResult(patternResult)) {
      throw new Error("Invalid pattern result format");
    }

    if (!patternResult.success) {
      throw new Error(`Pattern analysis failed: ${patternResult.error}`);
    }

    // Type guard for pattern data
    const patternData = isPatternAnalysisData(patternResult.data) ? patternResult.data : null;

    return {
      status: "success",
      analysisType,
      patternsFound: patternData?.patterns?.length || 0,
      recommendations: patternData?.recommendations || [],
      confidenceScore: patternData?.confidenceScore || 0,
      timestamp: new Date().toISOString(),
      metadata: {
        agentsUsed: ["pattern-analysis", "market-analysis", "strategy"],
        vcoinId,
        symbols: symbols?.length || 0,
      },
    };
  }
);

// MEXC Trading Strategy Function
export const createMexcTradingStrategy = inngest.createFunction(
  { id: "create-mexc-trading-strategy" },
  { event: "mexc/strategy.create" },
  async ({
    event,
    step,
  }: { event: { data: MexcTradingStrategyRequestedData }; step: InngestStep }) => {
    const { vcoinId, symbolData, riskLevel = "medium", capital } = event.data;

    if (!vcoinId || !symbolData) {
      throw new Error("Missing vcoinId or symbolData in event data");
    }

    // Update status: Started trading strategy creation
    await updateWorkflowStatus("addActivity", {
      activity: {
        type: "snipe",
        message: `Creating trading strategy for ${symbolData.symbol || vcoinId}`,
      },
    });

    // Step 1: Execute Multi-Agent Trading Strategy Creation
    const strategyResult = await step.run("trading-strategy-workflow", async () => {
      const orchestrator = new MexcOrchestrator();
      return await orchestrator.executeTradingStrategyWorkflow({
        vcoinId,
        symbolData,
        riskLevel,
        capital,
      });
    });

    // Type guard for strategy result
    if (!isAgentWorkflowResult(strategyResult)) {
      throw new Error("Invalid strategy result format");
    }

    if (!strategyResult.success) {
      await updateWorkflowStatus("addActivity", {
        activity: {
          type: "snipe",
          message: `Trading strategy failed for ${symbolData.symbol || vcoinId}`,
        },
      });
      throw new Error(`Trading strategy creation failed: ${strategyResult.error}`);
    }

    // Type guard for strategy data
    const strategyData = isTradingStrategyData(strategyResult.data) ? strategyResult.data : null;

    // Update metrics for successful strategy
    await updateWorkflowStatus("updateMetrics", {
      metrics: {
        successfulSnipes: 1, // This would be incremented in real implementation
      },
    });

    await updateWorkflowStatus("addActivity", {
      activity: {
        type: "snipe",
        message: `Trading strategy created for ${symbolData.symbol || vcoinId} - ready to execute`,
      },
    });

    return {
      status: "success",
      vcoinId,
      strategyCreated: true,
      entryPrice: strategyData?.entryPrice,
      stopLoss: strategyData?.stopLoss,
      takeProfit: strategyData?.takeProfit,
      positionSize: strategyData?.positionSize,
      riskRewardRatio: strategyData?.riskRewardRatio,
      timestamp: new Date().toISOString(),
      metadata: {
        agentsUsed: ["trading-strategy", "risk-management", "market-analysis"],
        riskLevel,
        capital,
      },
    };
  }
);

// Export all functions for Inngest registration
export const functions = [
  // Core trading workflows
  pollMexcCalendar,
  watchMexcSymbol,
  analyzeMexcPatterns,
  createMexcTradingStrategy,
  // Safety system workflows
  ...safetyFunctions,
];
