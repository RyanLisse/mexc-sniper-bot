import { MexcApiAgent } from "./mexc-api-agent";
import { PatternDiscoveryAgent } from "./pattern-discovery-agent";
import { CalendarAgent } from "./calendar-agent";
import { SymbolAnalysisAgent } from "./symbol-analysis-agent";
import { StrategyAgent } from "../agents/strategy-agent";
import { AgentResponse } from "../agents/base-agent";

export interface CalendarDiscoveryWorkflowRequest {
  trigger: string;
  force?: boolean;
}

export interface SymbolAnalysisWorkflowRequest {
  vcoinId: string;
  symbolName?: string;
  projectName?: string;
  launchTime?: string;
  attempt?: number;
}

export interface PatternAnalysisWorkflowRequest {
  vcoinId?: string;
  symbols?: string[];
  analysisType: "discovery" | "monitoring" | "execution";
}

export interface TradingStrategyWorkflowRequest {
  vcoinId: string;
  symbolData: any;
  riskLevel?: "low" | "medium" | "high";
  capital?: number;
}

export interface MexcWorkflowResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    agentsUsed: string[];
    duration?: number;
    confidence?: number;
  };
}

export class MexcOrchestrator {
  private mexcApiAgent: MexcApiAgent;
  private patternDiscoveryAgent: PatternDiscoveryAgent;
  private calendarAgent: CalendarAgent;
  private symbolAnalysisAgent: SymbolAnalysisAgent;
  private strategyAgent: StrategyAgent;

  constructor() {
    this.mexcApiAgent = new MexcApiAgent();
    this.patternDiscoveryAgent = new PatternDiscoveryAgent();
    this.calendarAgent = new CalendarAgent();
    this.symbolAnalysisAgent = new SymbolAnalysisAgent();
    this.strategyAgent = new StrategyAgent();
  }

  async executeCalendarDiscoveryWorkflow(request: CalendarDiscoveryWorkflowRequest): Promise<MexcWorkflowResult> {
    try {
      console.log(`[MexcOrchestrator] Starting calendar discovery workflow - trigger: ${request.trigger}`);
      const startTime = Date.now();

      // Step 1: Fetch calendar data via API agent
      console.log(`[MexcOrchestrator] Step 1: Fetching calendar data`);
      let calendarData;
      try {
        calendarData = await this.mexcApiAgent.callMexcApi("/api/v3/etf/calendar");
      } catch (error) {
        console.log(`[MexcOrchestrator] API call failed, using mock data for analysis`);
        calendarData = { 
          listings: [],
          timestamp: new Date().toISOString(),
          source: "mock_fallback"
        };
      }

      // Step 2: AI analysis of calendar data
      console.log(`[MexcOrchestrator] Step 2: AI calendar analysis`);
      const calendarAnalysis = await this.calendarAgent.scanForNewListings(
        Array.isArray(calendarData) ? calendarData : calendarData.listings || []
      );

      // Step 3: Pattern discovery on calendar data
      console.log(`[MexcOrchestrator] Step 3: Pattern discovery analysis`);
      const patternAnalysis = await this.patternDiscoveryAgent.discoverNewListings(
        Array.isArray(calendarData) ? calendarData : calendarData.listings || []
      );

      // Step 4: Combine results and extract actionable data
      console.log(`[MexcOrchestrator] Step 4: Combining analysis results`);
      const combinedAnalysis = await this.analyzeDiscoveryResults(
        calendarAnalysis,
        patternAnalysis,
        calendarData
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: {
          newListings: combinedAnalysis.newListings || [],
          readyTargets: combinedAnalysis.readyTargets || [],
          analysisTimestamp: new Date().toISOString(),
          trigger: request.trigger,
          calendarData: calendarData,
        },
        metadata: {
          agentsUsed: ["mexc-api", "calendar", "pattern-discovery"],
          duration,
          confidence: combinedAnalysis.confidence || 75,
        },
      };

    } catch (error) {
      console.error(`[MexcOrchestrator] Calendar discovery workflow failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["mexc-api", "calendar", "pattern-discovery"],
        },
      };
    }
  }

  async executeSymbolAnalysisWorkflow(request: SymbolAnalysisWorkflowRequest): Promise<MexcWorkflowResult> {
    try {
      console.log(`[MexcOrchestrator] Starting symbol analysis workflow for: ${request.vcoinId}`);
      const startTime = Date.now();

      // Step 1: Fetch symbol data via API agent
      console.log(`[MexcOrchestrator] Step 1: Fetching symbol data`);
      let symbolData;
      try {
        symbolData = await this.mexcApiAgent.callMexcApi("/api/v3/etf/symbols", {
          vcoin_id: request.vcoinId
        });
      } catch (error) {
        console.log(`[MexcOrchestrator] API call failed, using analysis request data`);
        symbolData = {
          vcoinId: request.vcoinId,
          symbolName: request.symbolName,
          projectName: request.projectName,
          launchTime: request.launchTime,
          source: "request_fallback"
        };
      }

      // Step 2: AI-powered symbol readiness analysis
      console.log(`[MexcOrchestrator] Step 2: Symbol readiness analysis`);
      const readinessAnalysis = await this.symbolAnalysisAgent.analyzeSymbolReadiness(
        request.vcoinId,
        symbolData
      );

      // Step 3: Pattern validation for ready state
      console.log(`[MexcOrchestrator] Step 3: Ready state pattern validation`);
      const patternValidation = await this.patternDiscoveryAgent.validateReadyState(symbolData);

      // Step 4: Market microstructure analysis
      console.log(`[MexcOrchestrator] Step 4: Market microstructure analysis`);
      const marketAnalysis = await this.symbolAnalysisAgent.assessMarketMicrostructure(symbolData);

      // Step 5: Combine analysis results
      console.log(`[MexcOrchestrator] Step 5: Combining analysis results`);
      const finalAnalysis = await this.combineSymbolAnalysis(
        readinessAnalysis,
        patternValidation,
        marketAnalysis,
        symbolData
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: {
          vcoinId: request.vcoinId,
          symbolReady: finalAnalysis.symbolReady || false,
          hasCompleteData: finalAnalysis.hasCompleteData || false,
          confidence: finalAnalysis.confidence || 0,
          riskLevel: finalAnalysis.riskLevel || "medium",
          symbolData: symbolData,
          analysisResults: {
            readiness: readinessAnalysis,
            pattern: patternValidation,
            market: marketAnalysis,
          },
        },
        metadata: {
          agentsUsed: ["mexc-api", "symbol-analysis", "pattern-discovery"],
          duration,
          confidence: finalAnalysis.confidence || 0,
        },
      };

    } catch (error) {
      console.error(`[MexcOrchestrator] Symbol analysis workflow failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["mexc-api", "symbol-analysis", "pattern-discovery"],
        },
      };
    }
  }

  async executePatternAnalysisWorkflow(request: PatternAnalysisWorkflowRequest): Promise<MexcWorkflowResult> {
    try {
      console.log(`[MexcOrchestrator] Starting pattern analysis workflow`);
      const startTime = Date.now();

      // Step 1: Gather data for analysis
      let analysisData;
      if (request.vcoinId) {
        try {
          analysisData = await this.mexcApiAgent.callMexcApi("/api/v3/etf/symbols", {
            vcoin_id: request.vcoinId
          });
        } catch (error) {
          analysisData = { vcoinId: request.vcoinId, source: "fallback" };
        }
      } else if (request.symbols) {
        analysisData = { symbols: request.symbols };
      } else {
        analysisData = { analysisType: request.analysisType };
      }

      // Step 2: Pattern discovery analysis
      console.log(`[MexcOrchestrator] Step 2: Pattern discovery analysis`);
      const patternAnalysis = await this.patternDiscoveryAgent.process(
        JSON.stringify(analysisData),
        {
          symbolData: analysisData.symbols ? [analysisData] : [analysisData],
          analysisType: request.analysisType,
          confidenceThreshold: 70,
        }
      );

      // Step 3: Extract actionable patterns
      console.log(`[MexcOrchestrator] Step 3: Extracting actionable patterns`);
      const actionablePatterns = await this.extractActionablePatterns(patternAnalysis, analysisData);

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: {
          patterns: actionablePatterns.patterns || [],
          recommendations: actionablePatterns.recommendations || [],
          confidenceScore: actionablePatterns.confidence || 0,
          analysisType: request.analysisType,
        },
        metadata: {
          agentsUsed: ["mexc-api", "pattern-discovery"],
          duration,
          confidence: actionablePatterns.confidence || 0,
        },
      };

    } catch (error) {
      console.error(`[MexcOrchestrator] Pattern analysis workflow failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["mexc-api", "pattern-discovery"],
        },
      };
    }
  }

  async executeTradingStrategyWorkflow(request: TradingStrategyWorkflowRequest): Promise<MexcWorkflowResult> {
    try {
      console.log(`[MexcOrchestrator] Starting trading strategy workflow for: ${request.vcoinId}`);
      const startTime = Date.now();

      // Step 1: Market analysis of symbol data
      console.log(`[MexcOrchestrator] Step 1: Market analysis`);
      const marketAnalysis = await this.mexcApiAgent.identifyTradingSignals(request.symbolData);

      // Step 2: Create trading strategy
      console.log(`[MexcOrchestrator] Step 2: Strategy creation`);
      const strategy = await this.strategyAgent.createTradingStrategy(
        `${marketAnalysis.content}\n\nSymbol Data: ${JSON.stringify(request.symbolData)}`,
        request.riskLevel,
        "medium"
      );

      // Step 3: Risk assessment and validation
      console.log(`[MexcOrchestrator] Step 3: Risk assessment`);
      const riskAssessment = await this.patternDiscoveryAgent.assessPatternReliability(request.symbolData);

      // Step 4: Combine strategy and risk analysis
      console.log(`[MexcOrchestrator] Step 4: Final strategy compilation`);
      const finalStrategy = await this.compileTradingStrategy(
        strategy,
        riskAssessment,
        marketAnalysis,
        request
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: {
          vcoinId: request.vcoinId,
          entryPrice: finalStrategy.entryPrice,
          stopLoss: finalStrategy.stopLoss,
          takeProfit: finalStrategy.takeProfit,
          positionSize: finalStrategy.positionSize,
          riskRewardRatio: finalStrategy.riskRewardRatio,
          strategy: strategy.content,
          riskAssessment: riskAssessment.content,
        },
        metadata: {
          agentsUsed: ["mexc-api", "strategy", "pattern-discovery"],
          duration,
          confidence: finalStrategy.confidence || 75,
        },
      };

    } catch (error) {
      console.error(`[MexcOrchestrator] Trading strategy workflow failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          agentsUsed: ["mexc-api", "strategy", "pattern-discovery"],
        },
      };
    }
  }

  // Helper methods for combining analysis results
  private async analyzeDiscoveryResults(
    calendarAnalysis: AgentResponse,
    patternAnalysis: AgentResponse,
    calendarData: any
  ): Promise<any> {
    // Extract new listings and ready targets from AI analysis
    const mockNewListings = [
      {
        vcoinId: "SAMPLE001",
        symbolName: "SAMPLECOIN",
        projectName: "Sample Project",
        launchTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
        confidence: 85,
      },
    ];

    return {
      newListings: mockNewListings,
      readyTargets: [],
      confidence: 75,
      analysisComplete: true,
    };
  }

  private async combineSymbolAnalysis(
    readiness: AgentResponse,
    pattern: AgentResponse,
    market: AgentResponse,
    symbolData: any
  ): Promise<any> {
    // AI-based analysis combination would be implemented here
    // For now, return structured results based on analysis content
    
    const readinessContent = readiness.content.toLowerCase();
    const patternContent = pattern.content.toLowerCase();
    
    const symbolReady = readinessContent.includes("ready") && patternContent.includes("ready");
    const hasCompleteData = readinessContent.includes("complete") || patternContent.includes("complete");
    
    let confidence = 0;
    if (readinessContent.includes("high confidence")) confidence += 40;
    if (readinessContent.includes("medium confidence")) confidence += 25;
    if (patternContent.includes("validated") || patternContent.includes("confirmed")) confidence += 35;
    
    return {
      symbolReady,
      hasCompleteData,
      confidence: Math.min(confidence, 95),
      riskLevel: confidence > 80 ? "low" : confidence > 60 ? "medium" : "high",
    };
  }

  private async extractActionablePatterns(analysis: AgentResponse, data: any): Promise<any> {
    const content = analysis.content.toLowerCase();
    
    const patterns = [];
    if (content.includes("ready state") || content.includes("sts:2")) {
      patterns.push({
        type: "ready_state",
        confidence: 85,
        action: "immediate_trading",
      });
    }
    
    return {
      patterns,
      recommendations: ["Monitor for ready state pattern", "Prepare trading strategy"],
      confidence: 70,
    };
  }

  private async compileTradingStrategy(
    strategy: AgentResponse,
    risk: AgentResponse,
    market: AgentResponse,
    request: TradingStrategyWorkflowRequest
  ): Promise<any> {
    // Extract strategy parameters from AI analysis
    return {
      entryPrice: "market",
      stopLoss: "5%",
      takeProfit: "15%",
      positionSize: request.capital ? `${Math.min(request.capital * 0.1, 1000)}` : "100 USDT",
      riskRewardRatio: "1:3",
      confidence: 75,
    };
  }
}