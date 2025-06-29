/**
 * MEXC API Agent
 * 
 * Main agent class that orchestrates MEXC API interactions and analysis
 */

import type { SymbolEntry } from "@/src/schemas/unified/mexc-api-schemas";
import type { CalendarEntry } from "@/src/services/api/mexc-client-types";
import {
  getRecommendedMexcService,
  type ServiceResponse,
} from "@/src/services/api/mexc-unified-exports";
import { type AgentConfig, type AgentResponse, BaseAgent } from "../base-agent";
import { SymbolAnalyzer } from "./analyzers/symbol-analyzer";
import { CalendarAnalyzer } from "./analyzers/calendar-analyzer";
import { DataQualityAnalyzer } from "./analyzers/data-quality-analyzer";
import { ResponseValidator } from "./validators/response-validator";
import { ResponseEnhancer } from "./enhancers/response-enhancer";
import type { 
  MexcApiParams, 
  MexcApiRequest, 
  MexcSymbolData, 
  MexcCalendarEntry, 
  MexcApiResponseData,
  EnhancedApiResponse
} from "./types";

// Simple logger for testing and development
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
};

export class MexcApiAgent extends BaseAgent {
  protected logger = {
    info: (message: string, context?: any) =>
      console.info("[mexc-api-agent]", message, context || ""),
    warn: (message: string, context?: any) =>
      console.warn("[mexc-api-agent]", message, context || ""),
    error: (message: string, context?: any) =>
      console.error("[mexc-api-agent]", message, context || ""),
    debug: (message: string, context?: any) =>
      console.debug("[mexc-api-agent]", message, context || ""),
  };

  private mexcService = getRecommendedMexcService();
  
  // Analyzers and utilities
  private symbolAnalyzer: SymbolAnalyzer;
  private calendarAnalyzer: CalendarAnalyzer;
  private dataQualityAnalyzer: DataQualityAnalyzer;
  private responseValidator: ResponseValidator;
  private responseEnhancer: ResponseEnhancer;

  constructor() {
    const config: AgentConfig = {
      name: "mexc-api-agent",
      model: "gpt-4o",
      temperature: 0.1,
      maxTokens: 2000,
      systemPrompt: `You are an expert MEXC exchange API agent specializing in cryptocurrency data analysis and API interactions.

Your responsibilities:
1. Analyze MEXC API responses and extract meaningful trading data
2. Interpret symbol status, trading states, and market conditions
3. Identify pattern indicators from API data (sts, st, tt values)
4. Assess data completeness and reliability
5. Provide structured analysis of trading opportunities

MEXC Pattern Analysis:
- Ready State Pattern: sts:2, st:2, tt:4 (indicates symbol ready for trading)
- Symbol States: 1=announced, 2=ready, 3=trading, 4=suspended
- Trading Time States: 1=scheduled, 2=active, 3=paused, 4=live
- Data Completeness: Check for required fields (price, volume, trading times)

Analysis Framework:
- Extract key trading indicators from raw API data
- Identify pattern matches and anomalies
- Assess risk levels based on data quality and market conditions
- Provide confidence scores for trading signals
- Flag incomplete or suspicious data

Performance Metrics:
- Service response times and success rates
- Cache efficiency and circuit breaker status
- API latency and reliability metrics

Output Format:
- Structured data analysis with key metrics
- Pattern recognition results with confidence levels
- Risk assessment and data quality scores
- Performance and reliability indicators
- Actionable recommendations based on findings`,
    };
    super(config);

    // Initialize modules
    this.symbolAnalyzer = new SymbolAnalyzer();
    this.calendarAnalyzer = new CalendarAnalyzer();
    this.dataQualityAnalyzer = new DataQualityAnalyzer();
    this.responseValidator = new ResponseValidator();
    this.responseEnhancer = new ResponseEnhancer();
  }

  async process(input: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    const request: MexcApiRequest = (context as unknown as MexcApiRequest) || { endpoint: input };

    const userMessage = `
MEXC API Analysis Request:
Endpoint: ${request.endpoint}
Method: ${request.method || "GET"}
Parameters: ${JSON.stringify(request.params || {}, null, 2)}

Please analyze this MEXC API request and provide insights on:
1. Expected data structure and key fields
2. Pattern indicators to look for (sts, st, tt values)
3. Data quality assessment criteria
4. Trading signal extraction methods
5. Risk factors and reliability measures

Focus on actionable analysis for cryptocurrency trading decisions.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  // ======================
  // Analysis Methods
  // ======================

  /**
   * Adapter function to convert our callOpenAI to the expected signature
   */
  private getCallOpenAIAdapter() {
    return async (messages: Array<{ role: string; content: string }>) => {
      return await this.callOpenAI(messages as any);
    };
  }

  async analyzeSymbolData(symbolData: MexcSymbolData[]): Promise<AgentResponse> {
    return await this.symbolAnalyzer.analyzeSymbolData(symbolData, this.getCallOpenAIAdapter());
  }

  async analyzeCalendarData(calendarData: MexcCalendarEntry[]): Promise<AgentResponse> {
    return await this.calendarAnalyzer.analyzeCalendarData(calendarData, this.getCallOpenAIAdapter());
  }

  async assessDataQuality(apiResponse: MexcApiResponseData): Promise<AgentResponse> {
    return await this.dataQualityAnalyzer.assessDataQuality(apiResponse, this.getCallOpenAIAdapter());
  }

  async identifyTradingSignals(marketData: MexcSymbolData): Promise<AgentResponse> {
    return await this.symbolAnalyzer.identifyTradingSignals(marketData, this.getCallOpenAIAdapter());
  }

  // ======================
  // MEXC Service Integration
  // ======================

  async callMexcApi(endpoint: string, params?: MexcApiParams): Promise<EnhancedApiResponse> {
    logger.info(`[MexcApiAgent] Calling MEXC API via service layer: ${endpoint}`, { params });

    try {
      let serviceResponse: ServiceResponse<unknown>;

      // Route to appropriate service method based on endpoint
      switch (endpoint) {
        case "/api/v3/etf/calendar":
        case "/calendar":
          logger.info(`[MexcApiAgent] Fetching calendar data via service layer`);
          serviceResponse = await this.mexcService.getCalendarListings() as ServiceResponse<unknown>;
          break;

        case "/api/v3/etf/symbols":
        case "/symbols":
          logger.info(`[MexcApiAgent] Fetching symbols data via service layer`);
          serviceResponse = await this.mexcService.getSymbolsData() as ServiceResponse<unknown>;
          break;

        case "/account/balances":
          logger.info(`[MexcApiAgent] Fetching account balances via service layer`);
          serviceResponse = await this.mexcService.getAccountBalances() as ServiceResponse<unknown>;
          break;

        case "/market-overview":
          logger.info(`[MexcApiAgent] Fetching market overview via service layer`);
          serviceResponse = {
            success: false,
            data: null,
            error: `getMarketOverview method not implemented`,
            timestamp: new Date().toISOString(),
          } as ServiceResponse<unknown>;
          break;

        case "/health":
          logger.info(`[MexcApiAgent] Performing health check via service layer`);
          const healthResult = {
            healthy: true,
            timestamp: new Date().toISOString(),
            status: "Service layer health check not implemented",
          };
          serviceResponse = {
            success: healthResult.healthy,
            data: healthResult,
            timestamp: healthResult.timestamp,
          } as ServiceResponse<unknown>;
          break;

        default:
          logger.warn(`[MexcApiAgent] Unknown endpoint: ${endpoint}, using fallback`);
          serviceResponse = {
            success: false,
            data: null,
            error: `Unsupported endpoint: ${endpoint}`,
            timestamp: new Date().toISOString(),
          };
          break;
      }

      // Add AI analysis to the response
      const enhancedResponse = await this.responseEnhancer.enhanceServiceResponseWithAI(
        serviceResponse, 
        endpoint, 
        this.getCallOpenAIAdapter()
      );

      logger.info(
        `[MexcApiAgent] Service call successful: ${endpoint} - Success: ${serviceResponse.success}`
      );
      return enhancedResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error(`[MexcApiAgent] Service call failed for endpoint: ${endpoint}:`, errorMessage);

      return {
        success: false,
        data: [],
        error: errorMessage,
        timestamp: new Date().toISOString(),
        endpoint,
        metadata: {
          operation: "service-error",
          errorType: error instanceof Error ? error.name : "UnknownError",
        },
      };
    }
  }

  // ======================
  // Utility Methods
  // ======================

  isValidApiResponseStructure(response: unknown): response is MexcApiResponseData {
    return this.responseValidator.isValidApiResponseStructure(response);
  }

  isValidApiResponse(response: unknown): boolean {
    return this.responseValidator.isValidApiResponse(response);
  }

  getUpcomingLaunches(calendarData: MexcCalendarEntry[], hoursAhead: number = 24): MexcCalendarEntry[] {
    return this.calendarAnalyzer.getUpcomingLaunches(calendarData, hoursAhead);
  }

  isSymbolReadyForTrading(symbolData: MexcSymbolData): boolean {
    return this.symbolAnalyzer.isSymbolReadyForTrading(symbolData);
  }

  calculateTradingConfidence(symbolData: MexcSymbolData): number {
    return this.symbolAnalyzer.calculateTradingConfidence(symbolData);
  }
}