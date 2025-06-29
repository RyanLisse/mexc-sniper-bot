/**
 * Response Enhancer
 * 
 * Enhances API responses with AI analysis and additional metadata
 */

import type { SymbolEntry } from "@/src/schemas/unified/mexc-api-schemas";
import type { CalendarEntry } from "@/src/services/api/mexc-client-types";
import type { ServiceResponse } from "@/src/services/api/mexc-unified-exports";
import type { AgentResponse } from "../../base-agent";
import { CalendarAnalyzer } from "../analyzers/calendar-analyzer";
import { DataQualityAnalyzer } from "../analyzers/data-quality-analyzer";
import { SymbolAnalyzer } from "../analyzers/symbol-analyzer";
import type { EnhancedApiResponse, MexcApiResponseData, MexcCalendarEntry, MexcSymbolData } from "../types";

export class ResponseEnhancer {
  private symbolAnalyzer: SymbolAnalyzer;
  private calendarAnalyzer: CalendarAnalyzer;
  private dataQualityAnalyzer: DataQualityAnalyzer;

  constructor() {
    this.symbolAnalyzer = new SymbolAnalyzer();
    this.calendarAnalyzer = new CalendarAnalyzer();
    this.dataQualityAnalyzer = new DataQualityAnalyzer();
  }

  /**
   * Enhance service response with AI analysis
   */
  async enhanceServiceResponseWithAI(
    serviceResponse: ServiceResponse<unknown>,
    endpoint: string,
    callOpenAI: (messages: Array<{ role: string; content: string }>) => Promise<AgentResponse>
  ): Promise<EnhancedApiResponse> {
    try {
      if (!serviceResponse.success || !serviceResponse.data) {
        return this.createEnhancedResponse(serviceResponse, endpoint);
      }

      // Determine analysis type based on endpoint and data
      let aiAnalysis: AgentResponse;

      if (endpoint.includes("calendar")) {
        const calendarData = this.convertToCalendarData(serviceResponse.data as CalendarEntry[]);
        aiAnalysis = await this.calendarAnalyzer.analyzeCalendarData(calendarData, callOpenAI);
      } else if (endpoint.includes("symbols")) {
        const symbolData = this.convertToSymbolData(serviceResponse.data as SymbolEntry[]);
        aiAnalysis = await this.symbolAnalyzer.analyzeSymbolData(symbolData, callOpenAI);
      } else if (endpoint.includes("market-overview")) {
        aiAnalysis = await this.analyzeMarketOverview(serviceResponse.data, callOpenAI);
      } else if (endpoint.includes("health")) {
        aiAnalysis = await this.analyzeHealthData(serviceResponse.data, callOpenAI);
      } else {
        aiAnalysis = await this.dataQualityAnalyzer.assessServiceResponseQuality(serviceResponse, callOpenAI);
      }

      return this.createEnhancedResponse(serviceResponse, endpoint, aiAnalysis);
    } catch (error) {
      console.warn(`[ResponseEnhancer] AI analysis failed, returning raw response:`, error);
      return this.createEnhancedResponse(serviceResponse, endpoint);
    }
  }

  /**
   * Legacy AI enhancement method for backward compatibility
   */
  async enhanceResponseWithAI(
    apiResponse: unknown,
    endpoint: string,
    callOpenAI: (messages: Array<{ role: string; content: string }>) => Promise<AgentResponse>
  ): Promise<EnhancedApiResponse> {
    try {
      if (!this.dataQualityAnalyzer.isValidResponseStructure(apiResponse)) {
        return apiResponse as EnhancedApiResponse;
      }

      if (!apiResponse.success || !apiResponse.data) {
        return apiResponse as EnhancedApiResponse;
      }

      let aiAnalysis: AgentResponse;

      if (endpoint.includes("calendar")) {
        aiAnalysis = await this.calendarAnalyzer.analyzeCalendarData(
          apiResponse.data as MexcCalendarEntry[], 
          callOpenAI
        );
      } else if (endpoint.includes("symbols")) {
        aiAnalysis = await this.symbolAnalyzer.analyzeSymbolData(
          apiResponse.data as MexcSymbolData[], 
          callOpenAI
        );
      } else {
        aiAnalysis = await this.dataQualityAnalyzer.assessDataQuality(
          apiResponse as MexcApiResponseData, 
          callOpenAI
        );
      }

      return {
        ...apiResponse,
        aiAnalysis: {
          analysis: aiAnalysis.content,
          timestamp: new Date().toISOString(),
          endpoint,
        },
      } as EnhancedApiResponse;
    } catch (error) {
      console.warn(`[ResponseEnhancer] AI analysis failed, returning raw response:`, error);
      return apiResponse as EnhancedApiResponse;
    }
  }

  /**
   * Convert CalendarEntry to MexcCalendarEntry
   */
  private convertToCalendarData(entries: CalendarEntry[]): MexcCalendarEntry[] {
    return entries.map((entry) => ({
      vcoinId: entry.vcoinId,
      symbolName: entry.symbol,
      projectName: entry.projectName,
      launchTime: new Date(entry.firstOpenTime).toISOString(),
      status: "scheduled",
      tradingPairs: [`${entry.symbol}USDT`],
    }));
  }

  /**
   * Convert SymbolEntry to MexcSymbolData
   */
  private convertToSymbolData(entries: SymbolEntry[]): MexcSymbolData[] {
    return entries.map((entry) => ({
      symbol: `${entry.cd}USDT`,
      vcoinId: entry.cd,
      status: entry.sts === 2 ? "ready" : "pending",
      isTrading: entry.sts === 2 && entry.st === 2 && entry.tt === 4,
      hasCompleteData: Boolean(
        entry.cd && entry.sts !== undefined && entry.st !== undefined && entry.tt !== undefined
      ),
    }));
  }

  /**
   * Create enhanced response object
   */
  private createEnhancedResponse(
    serviceResponse: ServiceResponse<unknown>,
    endpoint: string,
    aiAnalysis?: AgentResponse
  ): EnhancedApiResponse {
    const enhanced: EnhancedApiResponse = {
      success: serviceResponse.success,
      data: serviceResponse.data || null, // Ensure data is always present
      timestamp: serviceResponse.timestamp,
      endpoint,
      error: serviceResponse.error,
      metadata: serviceResponse.metadata ? {
        operation: String(serviceResponse.metadata),
        errorType: serviceResponse.error ? "ServiceError" : undefined,
      } : undefined,
    };

    if (aiAnalysis) {
      enhanced.aiAnalysis = {
        analysis: aiAnalysis.content,
        timestamp: new Date().toISOString(),
        endpoint,
        performanceMetrics: {
          executionTimeMs: serviceResponse.executionTimeMs,
          cached: serviceResponse.cached,
          circuitBreakerState: "unknown",
        },
      };
    }

    return enhanced;
  }

  /**
   * Analyze market overview data
   */
  private async analyzeMarketOverview(
    data: unknown,
    callOpenAI: (messages: Array<{ role: string; content: string }>) => Promise<AgentResponse>
  ): Promise<AgentResponse> {
    const dataJson = JSON.stringify(data, null, 2);

    const userMessage = `
MEXC Market Overview Analysis:

${dataJson}

Please analyze this comprehensive market overview data and provide insights on:

1. **Market Health Assessment**
   - Overall market activity and liquidity
   - Trading volume trends
   - Market sentiment indicators

2. **Opportunity Identification**
   - High-potential trading opportunities
   - Market inefficiencies to exploit
   - Risk-adjusted return prospects

3. **Risk Analysis**
   - Market volatility patterns
   - Systemic risks and concerns
   - Liquidity and execution risks

4. **Strategic Recommendations**
   - Portfolio allocation suggestions
   - Risk management strategies
   - Market timing considerations

Focus on actionable insights for trading decision-making.
`;

    return await callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  /**
   * Analyze health data
   */
  private async analyzeHealthData(
    data: unknown,
    callOpenAI: (messages: Array<{ role: string; content: string }>) => Promise<AgentResponse>
  ): Promise<AgentResponse> {
    const dataJson = JSON.stringify(data, null, 2);

    const userMessage = `
MEXC Health Data Analysis:

${dataJson}

Please analyze this health/status data and provide insights on:

1. **System Health Assessment**
   - Service availability and reliability
   - Performance metrics analysis
   - Error rates and patterns

2. **Operational Status**
   - Critical system components
   - Service dependencies
   - Recovery capabilities

3. **Risk Indicators**
   - Service degradation signals
   - Potential failure points
   - Impact assessment

4. **Recommendations**
   - Monitoring improvements
   - Preventive measures
   - Contingency planning

Focus on system reliability and trading service continuity.
`;

    return await callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }
}