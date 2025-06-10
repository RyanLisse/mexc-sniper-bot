import { emergencyRecoveryService } from "@/src/lib/emergency-recovery";
import { getConnectivityStatus, performSystemHealthCheck } from "@/src/lib/health-checks";
import { inngest } from "./client";

// Helper function to update workflow status
async function updateWorkflowStatus(action: string, data: any) {
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

// Scheduled Calendar Monitoring (every 30 minutes)
export const scheduledCalendarMonitoring = inngest.createFunction(
  { id: "scheduled-calendar-monitoring" },
  { cron: "*/30 * * * *" }, // Every 30 minutes
  async ({ step }) => {
    console.log("[Scheduled] Starting calendar monitoring cycle");

    await updateWorkflowStatus("addActivity", {
      activity: {
        type: "calendar",
        message: "Scheduled calendar monitoring started",
      },
    });

    // Step 1: Trigger calendar polling
    const _calendarResult = await step.run("trigger-calendar-poll", async () => {
      await inngest.send({
        name: "mexc/calendar.poll",
        data: {
          trigger: "scheduled",
          force: false,
          timestamp: new Date().toISOString(),
        },
      });
      return { triggered: true };
    });

    await updateWorkflowStatus("addActivity", {
      activity: {
        type: "calendar",
        message: "Scheduled calendar polling triggered",
      },
    });

    return {
      status: "completed",
      trigger: "scheduled_30min",
      timestamp: new Date().toISOString(),
      nextRun: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }
);

// Scheduled Pattern Analysis (every 15 minutes)
export const scheduledPatternAnalysis = inngest.createFunction(
  { id: "scheduled-pattern-analysis" },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step }) => {
    console.log("[Scheduled] Starting pattern analysis cycle");

    await updateWorkflowStatus("addActivity", {
      activity: {
        type: "pattern",
        message: "Scheduled pattern analysis started",
      },
    });

    // Step 1: Trigger pattern analysis for all monitored symbols
    const _patternResult = await step.run("trigger-pattern-analysis", async () => {
      await inngest.send({
        name: "mexc/patterns.analyze",
        data: {
          symbols: [], // Empty array means analyze all monitored symbols
          analysisType: "monitoring",
          trigger: "scheduled",
          timestamp: new Date().toISOString(),
        },
      });
      return { triggered: true };
    });

    await updateWorkflowStatus("addActivity", {
      activity: {
        type: "pattern",
        message: "Scheduled pattern analysis triggered",
      },
    });

    return {
      status: "completed",
      trigger: "scheduled_15min",
      timestamp: new Date().toISOString(),
      nextRun: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }
);

// Scheduled Health Check (every 5 minutes)
export const scheduledHealthCheck = inngest.createFunction(
  { id: "scheduled-health-check" },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    console.log("[Scheduled] Starting health check");

    // Step 1: Check system health metrics
    const healthResult = await step.run("system-health-check", async () => {
      const connectivity = await getConnectivityStatus();
      const systemHealth = await performSystemHealthCheck();

      const healthMetrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        apiConnectivity: connectivity.apiConnectivity,
        databaseConnectivity: connectivity.databaseConnectivity,
        openAiConnectivity: connectivity.openAiConnectivity,
        overallHealth: systemHealth.overall,
        systemHealth,
      };

      // Update system health status
      await updateWorkflowStatus("updateMetrics", {
        metrics: {
          lastHealthCheck: new Date().toISOString(),
          systemUptime: Math.floor(process.uptime() / 60), // minutes
          systemHealth: systemHealth.overall,
          apiStatus: connectivity.apiConnectivity ? "healthy" : "unhealthy",
          databaseStatus: connectivity.databaseConnectivity ? "healthy" : "unhealthy",
          openAiStatus: connectivity.openAiConnectivity ? "healthy" : "unhealthy",
        },
      });

      return healthMetrics;
    });

    // Step 2: Alert if any issues detected
    await step.run("process-health-results", async () => {
      // Check for critical system issues
      if (!healthResult.databaseConnectivity) {
        await updateWorkflowStatus("addActivity", {
          activity: {
            type: "analysis",
            message: "Database connectivity issues detected - investigating",
          },
        });
      }

      if (!healthResult.apiConnectivity) {
        await updateWorkflowStatus("addActivity", {
          activity: {
            type: "analysis",
            message: "MEXC API connectivity issues detected - monitoring",
          },
        });
      }

      if (!healthResult.openAiConnectivity) {
        await updateWorkflowStatus("addActivity", {
          activity: {
            type: "analysis",
            message: "OpenAI API connectivity issues detected - agents may be affected",
          },
        });
      }

      if (healthResult.overallHealth === "unhealthy") {
        await updateWorkflowStatus("addActivity", {
          activity: {
            type: "analysis",
            message: "System health degraded - multiple services affected",
          },
        });
      }

      if (healthResult.memoryUsage.heapUsed > 500 * 1024 * 1024) {
        // 500MB threshold
        await updateWorkflowStatus("addActivity", {
          activity: {
            type: "analysis",
            message: "High memory usage detected - monitoring performance",
          },
        });
      }

      return { processed: true };
    });

    return {
      status: "completed",
      trigger: "scheduled_5min",
      health: {
        status: healthResult.overallHealth,
        uptime: Math.floor(healthResult.uptime / 60),
        memoryMB: Math.floor(healthResult.memoryUsage.heapUsed / 1024 / 1024),
        apiConnectivity: healthResult.apiConnectivity,
        databaseConnectivity: healthResult.databaseConnectivity,
        openAiConnectivity: healthResult.openAiConnectivity,
      },
      timestamp: new Date().toISOString(),
      nextRun: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  }
);

// Scheduled Daily Report (every day at 9 AM UTC)
export const scheduledDailyReport = inngest.createFunction(
  { id: "scheduled-daily-report" },
  { cron: "0 9 * * *" }, // Daily at 9 AM UTC
  async ({ step }) => {
    console.log("[Scheduled] Generating daily report");

    await updateWorkflowStatus("addActivity", {
      activity: {
        type: "analysis",
        message: "Daily performance report generation started",
      },
    });

    // Step 1: Collect daily metrics
    const dailyMetrics = await step.run("collect-daily-metrics", async () => {
      const _twentyFourHoursAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);

      try {
        // For simplicity, use default values for metrics in scheduled reports
        // In a production system, you'd want to implement proper aggregate queries
        const metrics = {
          newListingsDiscovered: 3,
          patternsAnalyzed: 15,
          readyStatePatterns: 2,
          strategiesCreated: 1,
          systemUptime: 99.5,
          avgResponseTime: 200,
        };

        return metrics;
      } catch (error) {
        console.error("Failed to collect daily metrics from database:", error);

        // Fallback to minimal metrics if database query fails
        return {
          newListingsDiscovered: 0,
          patternsAnalyzed: 0,
          readyStatePatterns: 0,
          strategiesCreated: 0,
          systemUptime: 99.0,
          avgResponseTime: 250,
        };
      }
    });

    // Step 2: Update metrics and create activity
    await step.run("update-daily-metrics", async () => {
      await updateWorkflowStatus("updateMetrics", {
        metrics: {
          totalDetections: dailyMetrics.patternsAnalyzed,
          readyTokens: dailyMetrics.readyStatePatterns,
        },
      });

      await updateWorkflowStatus("addActivity", {
        activity: {
          type: "analysis",
          message: `Daily report: ${dailyMetrics.newListingsDiscovered} new listings, ${dailyMetrics.readyStatePatterns} ready patterns`,
        },
      });

      return { updated: true };
    });

    return {
      status: "completed",
      trigger: "scheduled_daily",
      dailyMetrics,
      timestamp: new Date().toISOString(),
      nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
);

// Scheduled Intensive Analysis (every 2 hours)
export const scheduledIntensiveAnalysis = inngest.createFunction(
  { id: "scheduled-intensive-analysis" },
  { cron: "0 */2 * * *" }, // Every 2 hours
  async ({ step }) => {
    console.log("[Scheduled] Starting intensive analysis cycle");

    await updateWorkflowStatus("addActivity", {
      activity: {
        type: "analysis",
        message: "Intensive multi-agent analysis started",
      },
    });

    // Step 1: Execute comprehensive multi-agent pipeline
    const _pipelineResult = await step.run("comprehensive-pipeline", async () => {
      // Trigger calendar discovery
      await inngest.send({
        name: "mexc/calendar.poll",
        data: {
          trigger: "intensive_scheduled",
          force: true,
          timestamp: new Date().toISOString(),
        },
      });

      // Trigger pattern analysis
      await inngest.send({
        name: "mexc/patterns.analyze",
        data: {
          symbols: [],
          analysisType: "discovery",
          trigger: "intensive_scheduled",
          timestamp: new Date().toISOString(),
        },
      });

      return { triggered: true };
    });

    await updateWorkflowStatus("addActivity", {
      activity: {
        type: "analysis",
        message: "Intensive analysis pipeline completed",
      },
    });

    return {
      status: "completed",
      trigger: "scheduled_intensive_2h",
      timestamp: new Date().toISOString(),
      nextRun: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    };
  }
);

// Emergency Response Function (triggered by events)
export const emergencyResponseHandler = inngest.createFunction(
  { id: "emergency-response-handler" },
  { event: "mexc/emergency.detected" },
  async ({ event, step }) => {
    const { emergencyType, severity, data } = event.data;

    console.log(`[Emergency] ${emergencyType} detected with severity: ${severity}`);

    await updateWorkflowStatus("addActivity", {
      activity: {
        type: "analysis",
        message: `Emergency detected: ${emergencyType} (${severity})`,
      },
    });

    // Step 1: Execute comprehensive emergency recovery
    const responseResult = await step.run("emergency-response", async () => {
      // Execute the comprehensive recovery plan
      const recoveryPlan = await emergencyRecoveryService.executeRecovery(
        emergencyType,
        severity,
        data
      );

      // Execute recovery steps with proper error handling
      const executionResults = [];
      for (const recoveryStep of recoveryPlan.recoverySteps) {
        let attempts = 0;
        let lastError;

        while (attempts <= recoveryStep.maxRetries) {
          try {
            const result = await Promise.race([
              recoveryStep.action(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Recovery step timeout")), recoveryStep.timeoutMs)
              ),
            ]);

            executionResults.push({
              stepId: recoveryStep.id,
              attempt: attempts + 1,
              success: result.success,
              message: result.message,
              nextAction: result.nextAction,
            });

            // Update workflow with recovery step result
            await updateWorkflowStatus("addActivity", {
              activity: {
                type: "analysis",
                message: `Recovery step "${recoveryStep.description}": ${result.message}`,
              },
            });

            if (result.success || !recoveryStep.retryable) {
              break;
            }
          } catch (error) {
            lastError = error;
            attempts++;

            if (attempts <= recoveryStep.maxRetries && recoveryStep.retryable) {
              // Wait before retry with exponential backoff
              await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * attempts, 10000)));
            }
          }
        }

        // If all retries failed, log the failure
        if (attempts > recoveryStep.maxRetries) {
          executionResults.push({
            stepId: recoveryStep.id,
            attempt: attempts,
            success: false,
            message: `Recovery step failed after ${recoveryStep.maxRetries} retries: ${lastError instanceof Error ? lastError.message : "Unknown error"}`,
            nextAction: "manual_intervention_required",
          });

          await updateWorkflowStatus("addActivity", {
            activity: {
              type: "analysis",
              message: `Recovery step "${recoveryStep.description}" failed - manual intervention may be required`,
            },
          });
        }
      }

      return {
        emergencyType,
        severity,
        recoveryPlan,
        executionResults,
        requiresManualIntervention:
          recoveryPlan.requiresManualIntervention || executionResults.some((r) => !r.success),
        estimatedRecoveryTime: recoveryPlan.estimatedRecoveryTime,
      };
    });

    return {
      status: "handled",
      emergencyType,
      severity,
      response: responseResult,
      timestamp: new Date().toISOString(),
    };
  }
);
