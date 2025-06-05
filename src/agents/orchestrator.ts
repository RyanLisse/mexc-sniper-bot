import { ResearchAgent, ResearchRequest } from "./research-agent";
import { FormattingAgent, FormattingRequest } from "./formatting-agent";
import { AnalysisAgent, AnalysisRequest } from "./analysis-agent";
import { StrategyAgent, StrategyRequest } from "./strategy-agent";
import { AgentResponse } from "./base-agent";

export interface NewsletterWorkflowRequest {
  topics: string[];
  slug: string;
  analysisDepth?: "quick" | "standard" | "comprehensive";
  includeStrategy?: boolean;
  targetAudience?: "traders" | "investors" | "general";
}

export interface WorkflowResult {
  success: boolean;
  data?: {
    research: AgentResponse;
    analysis: AgentResponse;
    strategy?: AgentResponse;
    formatted: AgentResponse;
  };
  error?: string;
}

export class AgentOrchestrator {
  private researchAgent: ResearchAgent;
  private formattingAgent: FormattingAgent;
  private analysisAgent: AnalysisAgent;
  private strategyAgent: StrategyAgent;

  constructor() {
    this.researchAgent = new ResearchAgent();
    this.formattingAgent = new FormattingAgent();
    this.analysisAgent = new AnalysisAgent();
    this.strategyAgent = new StrategyAgent();
  }

  async executeNewsletterWorkflow(request: NewsletterWorkflowRequest): Promise<WorkflowResult> {
    try {
      console.log(`[Orchestrator] Starting newsletter workflow for: ${request.topics.join(", ")}`);

      // Step 1: Research Phase
      console.log(`[Orchestrator] Step 1: Research phase`);
      const researchResult = await this.researchAgent.analyzeMarketTrends(request.topics);
      
      // Step 2: Analysis Phase
      console.log(`[Orchestrator] Step 2: Analysis phase`);
      const analysisResult = await this.analysisAgent.performTechnicalAnalysis(researchResult.content);
      
      // Step 3: Strategy Phase (optional)
      let strategyResult: AgentResponse | undefined;
      if (request.includeStrategy) {
        console.log(`[Orchestrator] Step 3: Strategy generation`);
        const combinedContent = `${researchResult.content}\n\n${analysisResult.content}`;
        strategyResult = await this.strategyAgent.createTradingStrategy(combinedContent);
      }

      // Step 4: Formatting Phase
      console.log(`[Orchestrator] Step 4: Content formatting`);
      const contentToFormat = [
        researchResult.content,
        analysisResult.content,
        strategyResult?.content || ""
      ].filter(Boolean).join("\n\n");

      const formattedResult = await this.formattingAgent.formatNewsletter(contentToFormat, request.topics);

      console.log(`[Orchestrator] Newsletter workflow completed successfully`);

      return {
        success: true,
        data: {
          research: researchResult,
          analysis: analysisResult,
          strategy: strategyResult,
          formatted: formattedResult,
        },
      };

    } catch (error) {
      console.error(`[Orchestrator] Workflow failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async executeResearchWorkflow(topics: string[], depth: "shallow" | "moderate" | "deep" = "moderate"): Promise<WorkflowResult> {
    try {
      console.log(`[Orchestrator] Starting research workflow for: ${topics.join(", ")}`);

      // Parallel research for multiple topics
      const researchPromises = topics.map(topic => 
        this.researchAgent.researchCryptocurrency(topic, depth)
      );

      const researchResults = await Promise.all(researchPromises);
      
      // Combine and analyze all research
      const combinedResearch = researchResults.map(r => r.content).join("\n\n");
      const analysisResult = await this.analysisAgent.identifyOpportunities(combinedResearch);

      const formattedResult = await this.formattingAgent.formatReport(
        `${combinedResearch}\n\n${analysisResult.content}`, 
        topics
      );

      return {
        success: true,
        data: {
          research: {
            content: combinedResearch,
            metadata: {
              agent: "research-batch",
              timestamp: new Date().toISOString(),
            },
          },
          analysis: analysisResult,
          formatted: formattedResult,
        },
      };

    } catch (error) {
      console.error(`[Orchestrator] Research workflow failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async executeAnalysisWorkflow(content: string, analysisTypes: Array<"sentiment" | "technical" | "risk" | "opportunity">): Promise<WorkflowResult> {
    try {
      console.log(`[Orchestrator] Starting analysis workflow`);

      // Execute multiple analysis types in parallel
      const analysisPromises = analysisTypes.map(type => {
        switch (type) {
          case "sentiment":
            return this.analysisAgent.analyzeSentiment(content);
          case "technical":
            return this.analysisAgent.performTechnicalAnalysis(content);
          case "risk":
            return this.analysisAgent.assessRisk(content);
          case "opportunity":
            return this.analysisAgent.identifyOpportunities(content);
          default:
            throw new Error(`Unknown analysis type: ${type}`);
        }
      });

      const analysisResults = await Promise.all(analysisPromises);
      
      // Combine all analysis results
      const combinedAnalysis = analysisResults.map((result, index) => 
        `## ${analysisTypes[index].toUpperCase()} ANALYSIS\n\n${result.content}`
      ).join("\n\n");

      const formattedResult = await this.formattingAgent.formatReport(combinedAnalysis, []);

      return {
        success: true,
        data: {
          research: {
            content: content,
            metadata: {
              agent: "input-content",
              timestamp: new Date().toISOString(),
            },
          },
          analysis: {
            content: combinedAnalysis,
            metadata: {
              agent: "analysis-batch",
              timestamp: new Date().toISOString(),
            },
          },
          formatted: formattedResult,
        },
      };

    } catch (error) {
      console.error(`[Orchestrator] Analysis workflow failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}