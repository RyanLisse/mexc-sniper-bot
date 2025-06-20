import type { SymbolV2Entry } from "../schemas/mexc-schemas";
import { type ServiceResponse, getRecommendedMexcService } from "../services/mexc-unified-exports";
import type { CalendarEntry, SymbolEntry } from "../services/unified-mexc-client";
import { type AgentConfig, type AgentResponse, BaseAgent } from "./base-agent";

export interface MexcApiParams {
  vcoin_id?: string;
  vcoinId?: string;
  symbol?: string;
  limit?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface MexcApiRequest {
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  params?: MexcApiParams;
  requireAuth?: boolean;
}

export interface MexcApiResponseData {
  success: boolean;
  data: unknown;
  timestamp: string;
  error?: string;
}

export interface MexcSymbolData {
  symbol: string;
  vcoinId: string;
  status: string;
  tradingStart?: string;
  tradingEnd?: string;
  price?: number;
  volume?: number;
  isTrading: boolean;
  hasCompleteData: boolean;
}

export interface MexcSymbolFilterData {
  cd: string;
  symbol?: string;
  sts?: number;
  st?: number;
  tt?: number;
  [key: string]: unknown;
}

export interface MexcCalendarEntry {
  vcoinId: string;
  symbolName: string;
  projectName: string;
  launchTime: string;
  status: string;
  tradingPairs: string[];
}

export class MexcApiAgent extends BaseAgent {
  private mexcService = getRecommendedMexcService();

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

  async analyzeSymbolData(symbolData: MexcSymbolData[]): Promise<AgentResponse> {
    const dataJson = JSON.stringify(symbolData, null, 2);

    return await this.process("Analyze MEXC symbol data", {
      endpoint: "/api/v3/etf/symbols",
      method: "GET",
      params: { symbolData: dataJson },
    });
  }

  async analyzeCalendarData(calendarData: MexcCalendarEntry[]): Promise<AgentResponse> {
    const dataJson = JSON.stringify(calendarData, null, 2);

    return await this.process("Analyze MEXC calendar data", {
      endpoint: "/api/v3/etf/calendar",
      method: "GET",
      params: { calendarData: dataJson },
    });
  }

  async assessDataQuality(apiResponse: MexcApiResponseData): Promise<AgentResponse> {
    const responseJson = JSON.stringify(apiResponse, null, 2);

    const userMessage = `
MEXC API Data Quality Assessment:

API Response Data:
${responseJson}

Please assess the data quality and provide analysis on:

1. **Data Completeness**
   - Are all required fields present?
   - Missing or null values that could affect analysis
   - Data freshness and timestamp validity

2. **Pattern Indicators**
   - sts, st, tt values and their meanings
   - Ready state pattern detection (sts:2, st:2, tt:4)
   - Trading state progression and timing

3. **Market Conditions**
   - Symbol trading status and availability
   - Price and volume data reliability
   - Launch timing and scheduling accuracy

4. **Risk Assessment**
   - Data inconsistencies or anomalies
   - Reliability confidence score (0-100)
   - Recommended actions based on data quality

5. **Trading Signals**
   - Immediate trading opportunities
   - Monitoring recommendations
   - Alert conditions and thresholds

Provide a structured assessment with specific recommendations for trading decisions.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async identifyTradingSignals(marketData: MexcSymbolData): Promise<AgentResponse> {
    const dataJson = JSON.stringify(marketData, null, 2);

    const userMessage = `
MEXC Trading Signal Analysis:

Market Data:
${dataJson}

Please analyze this MEXC market data and identify trading signals:

1. **Ready State Detection**
   - Check for sts:2, st:2, tt:4 pattern
   - Validate trading readiness indicators
   - Assess timing for optimal entry

2. **Market Momentum**
   - Volume trends and price movements
   - Trading activity patterns
   - Market depth and liquidity signals

3. **Entry Opportunities**
   - Optimal entry timing and price levels
   - Risk/reward assessment
   - Position sizing recommendations

4. **Risk Indicators**
   - Market volatility signals
   - Liquidity concerns
   - Technical warning signs

5. **Action Plan**
   - Immediate actions required
   - Monitoring schedule
   - Exit criteria and stop-loss levels

Focus on actionable trading signals with specific entry/exit criteria and risk management parameters.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  // Enhanced method to call unified MEXC service with built-in retry logic and monitoring
  async callMexcApi(endpoint: string, params?: MexcApiParams): Promise<unknown> {
    console.log(`[MexcApiAgent] Calling MEXC API via service layer: ${endpoint}`, { params });

    try {
      let serviceResponse: ServiceResponse<unknown>;

      // Route to appropriate service method based on endpoint
      switch (endpoint) {
        case "/api/v3/etf/calendar":
        case "/calendar":
          console.log(`[MexcApiAgent] Fetching calendar data via service layer`);
          serviceResponse = await this.mexcService.getCalendarListings();
          break;

        case "/api/v3/etf/symbols":
        case "/symbols": {
          console.log(`[MexcApiAgent] Fetching symbols data via service layer`);
          serviceResponse = await this.mexcService.getSymbolsData();
          break;
        }

        case "/market-overview":
          console.log(`[MexcApiAgent] Fetching market overview via service layer`);
          serviceResponse = await this.mexcService.getMarketOverview();
          break;

        case "/account/balances":
          console.log(`[MexcApiAgent] Fetching account balances via service layer`);
          serviceResponse = await this.mexcService.getAccountBalances();
          break;

        case "/health": {
          console.log(`[MexcApiAgent] Performing health check via service layer`);
          const healthResult = await this.mexcService.performHealthCheck();
          serviceResponse = {
            success: healthResult.healthy,
            data: healthResult,
            timestamp: healthResult.timestamp,
          };
          break;
        }

        default:
          console.warn(`[MexcApiAgent] Unknown endpoint: ${endpoint}, using fallback`);
          serviceResponse = {
            success: false,
            data: null,
            error: `Unsupported endpoint: ${endpoint}`,
            timestamp: new Date().toISOString(),
          };
          break;
      }

      // Add AI analysis to the response
      const enhancedResponse = await this.enhanceServiceResponseWithAI(serviceResponse, endpoint);

      console.log(
        `[MexcApiAgent] Service call successful: ${endpoint} - Success: ${serviceResponse.success}`
      );
      return enhancedResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[MexcApiAgent] Service call failed for endpoint: ${endpoint}:`, errorMessage);

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

  // Validate API response structure
  private isValidApiResponseStructure(response: unknown): response is MexcApiResponseData {
    return (
      typeof response === "object" &&
      response !== null &&
      "success" in response &&
      "data" in response &&
      typeof (response as MexcApiResponseData).success === "boolean"
    );
  }

  private isValidApiResponse(response: unknown): boolean {
    if (!response || typeof response !== "object") {
      return false;
    }

    // Check for expected structure
    return (
      response.hasOwnProperty("success") &&
      response.hasOwnProperty("data") &&
      response.hasOwnProperty("timestamp")
    );
  }

  // Enhance service response with AI analysis
  private async enhanceServiceResponseWithAI(
    serviceResponse: ServiceResponse<unknown>,
    endpoint: string
  ): Promise<unknown> {
    try {
      if (!serviceResponse.success || !serviceResponse.data) {
        return serviceResponse; // Return as-is if not successful
      }

      // Determine analysis type based on endpoint and data
      let aiAnalysis: AgentResponse;

      if (endpoint.includes("calendar")) {
        // Convert CalendarEntry to MexcCalendarEntry for legacy analysis
        const calendarData = (serviceResponse.data as CalendarEntry[]).map((entry) => ({
          vcoinId: entry.vcoinId,
          symbolName: entry.symbol,
          projectName: entry.projectName,
          launchTime: new Date(entry.firstOpenTime).toISOString(),
          status: "scheduled",
          tradingPairs: [`${entry.symbol}USDT`],
        }));
        aiAnalysis = await this.analyzeCalendarData(calendarData);
      } else if (endpoint.includes("symbols")) {
        // Convert SymbolEntry to MexcSymbolData for legacy analysis
        const symbolData = (serviceResponse.data as SymbolEntry[]).map((entry) => ({
          symbol: `${entry.cd}USDT`,
          vcoinId: entry.cd,
          status: entry.sts === 2 ? "ready" : "pending",
          isTrading: entry.sts === 2 && entry.st === 2 && entry.tt === 4,
          hasCompleteData: Boolean(
            entry.cd && entry.sts !== undefined && entry.st !== undefined && entry.tt !== undefined
          ),
        }));
        aiAnalysis = await this.analyzeSymbolData(symbolData);
      } else if (endpoint.includes("market-overview")) {
        aiAnalysis = await this.analyzeMarketOverview(serviceResponse.data);
      } else if (endpoint.includes("health")) {
        aiAnalysis = await this.analyzeHealthData(serviceResponse.data);
      } else {
        aiAnalysis = await this.assessServiceResponseQuality(serviceResponse);
      }

      // Enhance response with AI insights and performance metrics
      return {
        ...serviceResponse,
        aiAnalysis: {
          analysis: aiAnalysis.content,
          timestamp: new Date().toISOString(),
          endpoint,
          performanceMetrics: {
            executionTimeMs: serviceResponse.executionTimeMs,
            cached: serviceResponse.cached,
            circuitBreakerState: "unknown", // Circuit breaker state requires async call
          },
        },
      };
    } catch (error) {
      console.warn(`[MexcApiAgent] AI analysis failed, returning raw response:`, error);
      return serviceResponse; // Return original response if AI analysis fails
    }
  }

  // Legacy AI analysis method for backward compatibility
  private async enhanceResponseWithAI(apiResponse: unknown, endpoint: string): Promise<unknown> {
    try {
      // Type guard for response structure
      if (!this.isValidApiResponseStructure(apiResponse)) {
        return apiResponse; // Return as-is if not valid structure
      }

      if (!apiResponse.success || !apiResponse.data) {
        return apiResponse; // Return as-is if not successful
      }

      // Determine analysis type based on endpoint
      let aiAnalysis: AgentResponse;

      if (endpoint.includes("calendar")) {
        aiAnalysis = await this.analyzeCalendarData(apiResponse.data as MexcCalendarEntry[]);
      } else if (endpoint.includes("symbols")) {
        aiAnalysis = await this.analyzeSymbolData(apiResponse.data as MexcSymbolData[]);
      } else {
        aiAnalysis = await this.assessDataQuality(apiResponse as MexcApiResponseData);
      }

      // Enhance response with AI insights
      return {
        ...apiResponse,
        aiAnalysis: {
          analysis: aiAnalysis.content,
          timestamp: new Date().toISOString(),
          endpoint,
        },
      };
    } catch (error) {
      console.warn(`[MexcApiAgent] AI analysis failed, returning raw response:`, error);
      return apiResponse; // Return original response if AI analysis fails
    }
  }

  // New analysis methods for service layer responses
  private async analyzeMarketOverview(data: unknown): Promise<AgentResponse> {
    const dataJson = JSON.stringify(data, null, 2);

    const userMessage = `
MEXC Market Overview Analysis:

${dataJson}

Please analyze this comprehensive market overview data and provide insights on:

1. **Market Health Assessment**
   - Overall market activity and liquidity
   - Calendar listings vs available symbols ratio
   - Ready state pattern distribution

2. **Trading Opportunities**
   - Immediate trading potential based on ready state count
   - Market timing and entry opportunities
   - Risk assessment for current conditions

3. **System Performance**
   - Data freshness and server synchronization
   - Market data completeness and reliability

4. **Strategic Recommendations**
   - Priority actions based on current market state
   - Monitoring focus areas
   - Alert configurations for optimal timing

Focus on actionable market insights and strategic trading recommendations.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  private async analyzeHealthData(data: unknown): Promise<AgentResponse> {
    const dataJson = JSON.stringify(data, null, 2);

    const userMessage = `
MEXC Service Health Analysis:

${dataJson}

Please analyze this health check data and provide assessment of:

1. **System Health Status**
   - Overall service availability and reliability
   - Connectivity and authentication status
   - Performance metrics and latency

2. **Risk Assessment**
   - Potential service disruptions or issues
   - Circuit breaker status and implications
   - Data quality and consistency concerns

3. **Performance Insights**
   - Response time trends and optimization opportunities
   - Cache efficiency and resource utilization
   - Error patterns and recovery capabilities

4. **Operational Recommendations**
   - Immediate actions if issues detected
   - Monitoring and alerting suggestions
   - Performance optimization opportunities

Focus on actionable operational insights and proactive monitoring recommendations.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  private async assessServiceResponseQuality(
    serviceResponse: ServiceResponse<unknown>
  ): Promise<AgentResponse> {
    const responseJson = JSON.stringify(serviceResponse, null, 2);

    const userMessage = `
MEXC Service Response Quality Assessment:

${responseJson}

Please assess the service response quality and provide analysis on:

1. **Response Quality Metrics**
   - Data completeness and structure validation
   - Performance metrics and execution time
   - Cache efficiency and hit rates

2. **Reliability Indicators**
   - Success rate and error patterns
   - Circuit breaker status and implications
   - Service stability and consistency

3. **Performance Analysis**
   - Response time trends and optimization potential
   - Resource utilization and efficiency
   - Scalability and load handling

4. **Improvement Recommendations**
   - Performance optimization opportunities
   - Error handling and recovery improvements
   - Monitoring and alerting enhancements

Provide actionable insights for service quality improvement and reliability enhancement.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  // Enhanced pattern detection using service layer
  async detectReadyStatePatterns(vcoinIds?: string[]): Promise<AgentResponse> {
    try {
      console.log(`[MexcApiAgent] Detecting ready state patterns via service layer`);

      // Use service layer for pattern detection
      const patternResponse = await this.mexcService.detectReadyStatePatterns();

      if (!patternResponse.success) {
        throw new Error(`Pattern detection failed: ${patternResponse.error}`);
      }

      const patternData = patternResponse.data;
      const performanceMetrics = await this.mexcService.getMetrics();
      const circuitBreakerStatus = await this.mexcService.getCircuitBreakerStatus();

      // Generate AI analysis of patterns with enhanced context
      const aiResponse = await this.callOpenAI([
        {
          role: "user",
          content: `
MEXC Enhanced Pattern Detection Analysis:

**Pattern Detection Results:**
${JSON.stringify(patternData, null, 2)}

**Performance Metrics:**
${JSON.stringify(performanceMetrics, null, 2)}

**Circuit Breaker Status:**
${JSON.stringify(circuitBreakerStatus, null, 2)}

Ready State Pattern (sts:2, st:2, tt:4): ${patternData.readyStateCount} symbols detected
Total Symbols Analyzed: ${patternData.totalSymbols}
Execution Time: ${patternResponse.executionTimeMs}ms

Please analyze these enhanced pattern detection results and provide:

1. **Pattern Analysis Summary**
   - Ready state pattern significance and market implications
   - Symbol readiness distribution and trends
   - Data completeness and reliability assessment

2. **Trading Opportunities**
   - Immediate trading candidates from ready state symbols
   - Priority ranking based on pattern strength
   - Timing recommendations for optimal entry

3. **System Performance Assessment**
   - Service response time and efficiency analysis
   - Cache utilization and optimization insights
   - Circuit breaker status and system reliability

4. **Market Conditions & Strategy**
   - Overall market readiness and activity levels
   - Risk assessment based on pattern distribution
   - Strategic recommendations for position management

5. **Action Plan**
   - Immediate monitoring priorities
   - Alert configurations for pattern changes
   - Risk management and position sizing guidance

Focus on actionable trading signals with performance-aware recommendations.
          `,
        },
      ]);

      return {
        content: `${aiResponse.content}\n\n**Enhanced Pattern Analysis Data:**\n${JSON.stringify(
          {
            ...patternData,
            performanceMetrics: {
              executionTimeMs: patternResponse.executionTimeMs,
              cached: patternResponse.cached,
              circuitBreakerState: circuitBreakerStatus.data?.status || "unknown",
            },
          },
          null,
          2
        )}`,
        metadata: {
          ...aiResponse.metadata,
          performanceMetrics: patternResponse.executionTimeMs,
        },
      };
    } catch (error) {
      console.error(`[MexcApiAgent] Enhanced pattern detection failed:`, error);
      return {
        content: `Enhanced pattern detection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
          serviceLayer: true,
          error: true,
        },
      };
    }
  }

  // Analyze pattern distribution across all symbols
  private analyzePatternDistribution(symbols: SymbolV2Entry[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    symbols.forEach((symbol) => {
      const patternKey = `sts:${symbol.sts},st:${symbol.st},tt:${symbol.tt}`;
      distribution[patternKey] = (distribution[patternKey] || 0) + 1;
    });

    return distribution;
  }

  // Get specific symbols by their vcoinIds using service layer
  async getSymbolsByVcoinIds(vcoinIds: string[]): Promise<AgentResponse> {
    try {
      console.log(`[MexcApiAgent] Fetching symbols for vcoinIds via service layer:`, vcoinIds);

      const serviceResponse = await this.mexcService.getSymbolsForVcoins(vcoinIds);

      if (!serviceResponse.success) {
        throw new Error(`Failed to fetch symbols: ${serviceResponse.error}`);
      }

      const symbols = serviceResponse.data;
      // Convert SymbolEntry to MexcSymbolData for legacy analysis
      const symbolData = symbols.map((entry: any) => ({
        symbol: `${entry.cd}USDT`,
        vcoinId: entry.cd,
        status: entry.sts === 2 ? "ready" : "pending",
        isTrading: entry.sts === 2 && entry.st === 2 && entry.tt === 4,
        hasCompleteData: Boolean(
          entry.cd && entry.sts !== undefined && entry.st !== undefined && entry.tt !== undefined
        ),
      }));
      const analysis = await this.analyzeSymbolData(symbolData);

      return {
        content: `${analysis.content}\n\n**Requested VcoinIds:** ${vcoinIds.join(", ")}\n**Found Symbols:** ${symbols.length}\n**Service Performance:** ${serviceResponse.executionTimeMs}ms${serviceResponse.cached ? " (cached)" : ""}`,
        metadata: {
          ...analysis.metadata,
          serviceLayer: true,
          executionTimeMs: serviceResponse.executionTimeMs,
          cached: serviceResponse.cached,
        },
      };
    } catch (error) {
      console.error(`[MexcApiAgent] Error fetching symbols by vcoinIds:`, error);
      return {
        content: `Failed to fetch symbols: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
          serviceLayer: true,
          error: true,
        },
      };
    }
  }

  // Get comprehensive service status and metrics
  async getServiceStatus(): Promise<AgentResponse> {
    try {
      console.log(`[MexcApiAgent] Getting comprehensive service status`);

      const [healthCheck, metrics, cacheStats, circuitBreakerStatus] = await Promise.allSettled([
        this.mexcService.performHealthCheck(),
        this.mexcService.getMetrics(),
        this.mexcService.getCacheStats(),
        this.mexcService.getCircuitBreakerStatus(),
      ]);

      const serviceStatus = {
        health: healthCheck.status === "fulfilled" ? healthCheck.value : null,
        metrics: metrics.status === "fulfilled" ? metrics.value : {},
        cache: cacheStats.status === "fulfilled" ? cacheStats.value : null,
        circuitBreaker:
          circuitBreakerStatus.status === "fulfilled" ? circuitBreakerStatus.value : null,
        hasCredentials: !!(process.env.MEXC_API_KEY && process.env.MEXC_SECRET_KEY),
        timestamp: new Date().toISOString(),
      };

      const analysis = await this.callOpenAI([
        {
          role: "user",
          content: `
MEXC Service Comprehensive Status Analysis:

${JSON.stringify(serviceStatus, null, 2)}

Please analyze this comprehensive service status and provide:

1. **Overall Service Health**
   - System availability and reliability assessment
   - Critical issues requiring immediate attention
   - Performance trends and optimization opportunities

2. **Operational Metrics Analysis**
   - Request success rates and error patterns
   - Performance benchmarks and latency analysis
   - Cache efficiency and resource utilization

3. **Risk Assessment**
   - Circuit breaker status and implications
   - Authentication and connectivity reliability
   - Potential failure points and mitigation strategies

4. **Performance Optimization**
   - Cache hit rate improvements
   - Response time optimization recommendations
   - Resource allocation and scaling insights

5. **Monitoring Recommendations**
   - Key metrics to track continuously
   - Alert thresholds and escalation procedures
   - Proactive maintenance and optimization tasks

Focus on actionable operational insights and performance optimization recommendations.
          `,
        },
      ]);

      return {
        content: `${analysis.content}\n\n**Service Status Data:**\n${JSON.stringify(serviceStatus, null, 2)}`,
        metadata: {
          ...analysis.metadata,
          serviceLayer: true,
          operationalData: true,
        },
      };
    } catch (error) {
      console.error(`[MexcApiAgent] Service status analysis failed:`, error);
      return {
        content: `Service status analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
          serviceLayer: true,
          error: true,
        },
      };
    }
  }

  // Direct MEXC API call as fallback (no longer uses private properties)
  private async directMexcApiCall(endpoint: string, _params?: MexcApiParams): Promise<unknown> {
    try {
      // Note: This method is deprecated and should use the service layer instead
      console.warn(
        `[MexcApiAgent] Direct API call fallback used for: ${endpoint}. Consider using service layer.`
      );

      // Use public MEXC endpoints that don't require authentication
      let apiUrl: string;

      if (endpoint.includes("calendar") || endpoint === "/api/v3/etf/calendar") {
        // Use the real MEXC calendar endpoint provided by user
        apiUrl = "https://www.mexc.com/api/operation/new_coin_calendar";
        const timestamp = Date.now();
        const url = new URL(apiUrl);
        url.searchParams.append("timestamp", timestamp.toString());

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "MEXC-Sniper-Bot/1.0",
          },
        });

        if (!response.ok) {
          throw new Error(`MEXC API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      }

      // For other endpoints, fallback to service layer to avoid authentication issues
      throw new Error(
        `Direct API call not supported for endpoint: ${endpoint}. Use service layer instead.`
      );
    } catch (error) {
      console.error(`[MexcApiAgent] Direct API call failed:`, error);
      throw error;
    }
  }
}
