import { NextRequest, NextResponse } from "next/server";
import { MultiAgentOrchestrator } from "../../../../src/mexc-agents/multi-agent-orchestrator";
import { 
  createSuccessResponse, 
  createErrorResponse, 
  handleApiError, 
  apiResponse, 
  HTTP_STATUS,
  createValidationErrorResponse
} from "@/src/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      workflowType = "calendar_discovery", 
      input = "Test the enhanced multi-agent system",
      context = {},
      maxHandoffs = 5 
    } = body;

    console.log(`[MultiAgent API] Starting ${workflowType} workflow`);
    
    // Initialize the multi-agent orchestrator
    const orchestrator = new MultiAgentOrchestrator();
    
    // Execute the workflow
    const result = await orchestrator.executeWorkflow({
      type: workflowType,
      input,
      context,
      maxHandoffs
    });

    console.log(`[MultiAgent API] Workflow completed in ${result.totalExecutionTime}ms`);
    console.log(`[MultiAgent API] Execution path: ${result.executionPath.join(' -> ')}`);

    return apiResponse(
      createSuccessResponse({
        workflow: {
          type: workflowType,
          executionPath: result.executionPath,
          totalExecutionTime: result.totalExecutionTime,
          handoffCount: result.executionPath.length - 1,
          finalResult: result.finalResult?.content,
          agentResults: Object.fromEntries(
            Array.from(result.agentResults.entries()).map(([agent, response]) => [
              agent,
              {
                content: response.content.substring(0, 500) + (response.content.length > 500 ? '...' : ''),
                executionTime: (response.metadata as any).executionTime,
                model: response.metadata.model
              }
            ])
          )
        },
        error: result.error
      }, {
        message: `Workflow '${workflowType}' completed successfully`
      })
    );

  } catch (error) {
    console.error('[MultiAgent API] Test failed:', error);
    return apiResponse(
      handleApiError(error),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function GET() {
  try {
    // Return available workflow types and agent information
    const orchestrator = new MultiAgentOrchestrator();
    const metrics = orchestrator.getAgentMetrics();
    const history = orchestrator.getExecutionHistory(5);

    return apiResponse(
      createSuccessResponse({
        availableWorkflows: [
          "calendar_discovery",
          "pattern_analysis", 
          "full_pipeline"
        ],
        agentMetrics: Object.fromEntries(metrics),
        recentExecutions: history.length,
        status: "Multi-agent system operational"
      })
    );

  } catch (error) {
    console.error('[MultiAgent API] Status check failed:', error);
    return apiResponse(
      createErrorResponse("Error retrieving multi-agent system status"),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}