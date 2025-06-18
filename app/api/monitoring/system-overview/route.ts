import { NextRequest, NextResponse } from "next/server";
import { MexcOrchestrator } from "../../../../src/mexc-agents/orchestrator";
import { AgentManager } from "../../../../src/mexc-agents/agent-manager";
import { checkDatabaseHealth, checkMexcApiHealth, checkOpenAiHealth } from "../../../../src/lib/health-checks";

export async function GET(request: NextRequest) {
  try {
    const orchestrator = new MexcOrchestrator({ useEnhancedCoordination: true });
    const agentManager = new AgentManager();

    // Get comprehensive system overview
    const [
      agentHealth,
      orchestrationMetrics,
      agentSummary,
      coordinationHealth,
      systemHealth,
      comprensiveSafetyCheck
    ] = await Promise.all([
      agentManager.checkAgentHealth(),
      Promise.resolve(orchestrator.getOrchestrationMetrics()),
      Promise.resolve(orchestrator.getAgentSummary()),
      orchestrator.getCoordinationHealth(),
      Promise.all([
        checkDatabaseHealth(),
        checkMexcApiHealth(), 
        checkOpenAiHealth()
      ]),
      agentManager.performComprehensiveSafetyCheck()
    ]);

    const [dbHealth, mexcHealth, openAiHealth] = systemHealth;

    // Calculate overall system status
    const healthyAgents = Object.values(agentHealth).filter(healthy => healthy === true).length - 3; // Subtract details
    const totalAgents = Object.keys(agentHealth).length - 1; // Subtract details object
    const systemHealthScore = (healthyAgents / totalAgents) * 100;

    const response = {
      timestamp: new Date().toISOString(),
      systemStatus: {
        overall: systemHealthScore >= 80 ? 'healthy' : systemHealthScore >= 50 ? 'degraded' : 'critical',
        healthScore: systemHealthScore,
        uptime: process.uptime(),
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
      },
      agentArchitecture: {
        totalAgents: agentSummary.totalAgents,
        coreAgents: 5, // Core trading agents
        safetyAgents: 4, // Safety agents
        coordinationAgents: 2, // Orchestrator + Enhanced coordination
        agentTypes: [
          'mexc-api-agent',
          'pattern-discovery-agent', 
          'calendar-agent',
          'symbol-analysis-agent',
          'strategy-agent',
          'simulation-agent',
          'risk-manager-agent',
          'reconciliation-agent',
          'error-recovery-agent'
        ],
        agentHealth: {
          mexcApi: agentHealth.mexcApi,
          patternDiscovery: agentHealth.patternDiscovery,
          calendar: agentHealth.calendar,
          symbolAnalysis: agentHealth.symbolAnalysis,
          strategy: agentHealth.strategy,
          simulation: agentHealth.simulation,
          riskManager: agentHealth.riskManager,
          reconciliation: agentHealth.reconciliation,
          errorRecovery: agentHealth.errorRecovery
        },
        agentInteractions: [
          { from: 'calendar-agent', to: 'pattern-discovery-agent', type: 'workflow' },
          { from: 'pattern-discovery-agent', to: 'symbol-analysis-agent', type: 'workflow' },
          { from: 'symbol-analysis-agent', to: 'strategy-agent', type: 'workflow' },
          { from: 'strategy-agent', to: 'risk-manager-agent', type: 'validation' },
          { from: 'risk-manager-agent', to: 'simulation-agent', type: 'testing' },
          { from: 'all-agents', to: 'error-recovery-agent', type: 'monitoring' },
          { from: 'all-agents', to: 'reconciliation-agent', type: 'verification' }
        ]
      },
      orchestrationMetrics: {
        totalExecutions: orchestrationMetrics.totalExecutions,
        successRate: orchestrationMetrics.successRate,
        errorRate: orchestrationMetrics.errorRate,
        averageDuration: orchestrationMetrics.averageDuration,
        lastExecution: orchestrationMetrics.lastExecution,
        coordinationSystemEnabled: coordinationHealth.enabled || false,
        coordinationSystemHealthy: coordinationHealth.healthy || false
      },
      infrastructureHealth: {
        database: {
          status: dbHealth.status,
          responseTime: (dbHealth as any).responseTime || 0,
          details: dbHealth.details || {}
        },
        mexcApi: {
          status: mexcHealth.status,
          responseTime: (mexcHealth as any).responseTime || 0,
          details: mexcHealth.details || {}
        },
        openAi: {
          status: openAiHealth.status,
          responseTime: (openAiHealth as any).responseTime || 0,
          details: openAiHealth.details || {}
        }
      },
      safetyStatus: {
        overall: comprensiveSafetyCheck.overall,
        simulation: comprensiveSafetyCheck.simulation,
        riskManager: comprensiveSafetyCheck.riskManager,
        reconciliation: comprensiveSafetyCheck.reconciliation,
        errorRecovery: comprensiveSafetyCheck.errorRecovery,
        summary: comprensiveSafetyCheck.summary
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Monitoring API] System overview failed:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch system overview",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}