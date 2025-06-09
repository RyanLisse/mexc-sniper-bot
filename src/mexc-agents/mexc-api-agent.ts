import { type AgentConfig, type AgentResponse, BaseAgent } from "../agents/base-agent";
import {
  READY_STATE_PATTERN,
  type SymbolV2Entry,
  hasCompleteData,
  isValidForSnipe,
  matchesReadyPattern,
  validateSymbolV2Entry,
} from "../schemas/mexc-schemas";
import { getMexcClient } from "../services/mexc-api-client";

export interface MexcApiRequest {
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  params?: Record<string, any>;
  requireAuth?: boolean;
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

export interface MexcCalendarEntry {
  vcoinId: string;
  symbolName: string;
  projectName: string;
  launchTime: string;
  status: string;
  tradingPairs: string[];
}

export class MexcApiAgent extends BaseAgent {
  private baseUrl: string;
  private apiKey?: string;
  private secretKey?: string;

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

Output Format:
- Structured data analysis with key metrics
- Pattern recognition results with confidence levels
- Risk assessment and data quality scores
- Actionable recommendations based on findings`,
    };
    super(config);

    this.baseUrl = process.env.MEXC_BASE_URL || "https://api.mexc.com";
    this.apiKey = process.env.MEXC_API_KEY;
    this.secretKey = process.env.MEXC_SECRET_KEY;
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

  async assessDataQuality(apiResponse: any): Promise<AgentResponse> {
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

  async identifyTradingSignals(marketData: any): Promise<AgentResponse> {
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

  // Enhanced method to call TypeScript MEXC API client with retry logic and AI analysis
  async callMexcApi(endpoint: string, params?: Record<string, any>): Promise<any> {
    const maxRetries = 3;
    const retryDelay = 1000; // Start with 1 second delay

    console.log(`[MexcApiAgent] Calling MEXC API: ${endpoint}`, { params });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const mexcClient = getMexcClient();
        let apiResponse: any;

        // Route to appropriate API method based on endpoint
        switch (endpoint) {
          case "/api/v3/etf/calendar":
          case "/calendar":
            console.log(`[MexcApiAgent] Fetching calendar data (attempt ${attempt}/${maxRetries})`);
            apiResponse = await mexcClient.getCalendarListings();
            break;

          case "/api/v3/etf/symbols":
          case "/symbols": {
            console.log(`[MexcApiAgent] Fetching symbols data (attempt ${attempt}/${maxRetries})`);
            const vcoinId = params?.vcoin_id || params?.vcoinId;
            apiResponse = await mexcClient.getSymbolsV2(vcoinId);
            break;
          }

          default:
            console.warn(`[MexcApiAgent] Unknown endpoint: ${endpoint}, using direct API call`);
            apiResponse = await this.directMexcApiCall(endpoint, params);
            break;
        }

        // Validate API response structure
        if (!this.isValidApiResponse(apiResponse)) {
          throw new Error(`Invalid API response structure: ${JSON.stringify(apiResponse)}`);
        }

        // Add AI analysis to the response
        const enhancedResponse = await this.enhanceResponseWithAI(apiResponse, endpoint);

        console.log(`[MexcApiAgent] API call successful on attempt ${attempt}`);
        return enhancedResponse;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[MexcApiAgent] Attempt ${attempt}/${maxRetries} failed:`, errorMessage);

        // If this is the last attempt, return error response
        if (attempt === maxRetries) {
          console.error(`[MexcApiAgent] All retry attempts failed for endpoint: ${endpoint}`);
          return {
            success: false,
            data: [],
            error: errorMessage,
            timestamp: new Date().toISOString(),
            endpoint,
            retryAttempts: maxRetries,
          };
        }

        // Wait before retrying with exponential backoff
        const delay = retryDelay * 2 ** (attempt - 1);
        console.log(`[MexcApiAgent] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // Validate API response structure
  private isValidApiResponse(response: any): boolean {
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

  // Enhance API response with AI analysis
  private async enhanceResponseWithAI(apiResponse: any, endpoint: string): Promise<any> {
    try {
      if (!apiResponse.success || !apiResponse.data) {
        return apiResponse; // Return as-is if not successful
      }

      // Determine analysis type based on endpoint
      let aiAnalysis: AgentResponse;

      if (endpoint.includes("calendar")) {
        aiAnalysis = await this.analyzeCalendarData(apiResponse.data);
      } else if (endpoint.includes("symbols")) {
        aiAnalysis = await this.analyzeSymbolData(apiResponse.data);
      } else {
        aiAnalysis = await this.assessDataQuality(apiResponse);
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

  // Advanced pattern detection method with Zod validation
  async detectReadyStatePatterns(symbolData?: SymbolV2Entry[]): Promise<AgentResponse> {
    try {
      let symbols: SymbolV2Entry[];

      // If no data provided, fetch from API
      if (!symbolData) {
        console.log(`[MexcApiAgent] Fetching symbols for pattern detection`);
        const apiResponse = await this.callMexcApi("/symbols");

        if (!apiResponse.success) {
          throw new Error(`Failed to fetch symbol data: ${apiResponse.error}`);
        }

        symbols = apiResponse.data.symbols || [];
      } else {
        symbols = symbolData;
      }

      // Validate and filter symbols using Zod schemas
      const validatedSymbols = symbols
        .map((symbol) => {
          try {
            return validateSymbolV2Entry(symbol);
          } catch (_error) {
            console.warn(`[MexcApiAgent] Invalid symbol data:`, symbol);
            return null;
          }
        })
        .filter((symbol): symbol is SymbolV2Entry => symbol !== null);

      // Detect patterns
      const readySymbols = validatedSymbols.filter(matchesReadyPattern);
      const completeDataSymbols = validatedSymbols.filter(hasCompleteData);
      const snipeReadySymbols = validatedSymbols.filter(isValidForSnipe);

      const patternAnalysis = {
        totalSymbols: validatedSymbols.length,
        readyStatePattern: {
          count: readySymbols.length,
          symbols: readySymbols.map((s) => s.cd),
          pattern: READY_STATE_PATTERN,
        },
        completeData: {
          count: completeDataSymbols.length,
          symbols: completeDataSymbols.map((s) => s.cd),
        },
        snipeReady: {
          count: snipeReadySymbols.length,
          symbols: snipeReadySymbols.map((s) => s.cd),
        },
        patternBreakdown: this.analyzePatternDistribution(validatedSymbols),
      };

      // Generate AI analysis of patterns
      const aiResponse = await this.callOpenAI([
        {
          role: "user",
          content: `
MEXC Pattern Detection Analysis:

${JSON.stringify(patternAnalysis, null, 2)}

Ready State Pattern (sts:2, st:2, tt:4): ${readySymbols.length} symbols detected
Snipe-Ready Symbols: ${snipeReadySymbols.length} symbols with complete data

Please analyze these pattern detection results and provide:

1. **Pattern Analysis Summary**
   - Overall pattern distribution insights
   - Ready state pattern significance
   - Data completeness assessment

2. **Trading Opportunities**
   - Immediate snipe-ready symbols
   - Symbols approaching ready state
   - Priority recommendations

3. **Market Conditions**
   - Pattern frequency trends
   - Market readiness indicators
   - Risk assessment based on patterns

4. **Action Recommendations**
   - Which symbols to monitor immediately
   - Timing for pattern state changes
   - Alert configurations

Focus on actionable trading signals and specific symbol recommendations.
          `,
        },
      ]);

      return {
        content: `${aiResponse.content}\n\n**Pattern Analysis Data:**\n${JSON.stringify(patternAnalysis, null, 2)}`,
        metadata: {
          ...aiResponse.metadata,
        },
      };
    } catch (error) {
      console.error(`[MexcApiAgent] Pattern detection failed:`, error);
      return {
        content: `Pattern detection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
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

  // Get specific symbols by their vcoinIds with enhanced analysis
  async getSymbolsByVcoinIds(vcoinIds: string[]): Promise<AgentResponse> {
    try {
      console.log(`[MexcApiAgent] Fetching symbols for vcoinIds:`, vcoinIds);

      const apiResponse = await this.callMexcApi("/symbols");

      if (!apiResponse.success) {
        throw new Error(`Failed to fetch symbol data: ${apiResponse.error}`);
      }

      // Filter symbols by vcoinIds
      const allSymbols = apiResponse.data.symbols || [];
      const requestedSymbols = allSymbols.filter((symbol: any) => vcoinIds.includes(symbol.cd));

      const analysis = await this.analyzeSymbolData(requestedSymbols);

      return {
        content: `${analysis.content}\n\n**Requested VcoinIds:** ${vcoinIds.join(", ")}\n**Found Symbols:** ${requestedSymbols.length}`,
        metadata: {
          ...analysis.metadata,
        },
      };
    } catch (error) {
      console.error(`[MexcApiAgent] Error fetching symbols by vcoinIds:`, error);
      return {
        content: `Failed to fetch symbols: ${error instanceof Error ? error.message : "Unknown error"}`,
        metadata: {
          agent: this.config.name,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // Direct MEXC API call as fallback
  private async directMexcApiCall(endpoint: string, params?: Record<string, any>): Promise<any> {
    try {
      // Use correct MEXC endpoints based on config
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
      if (endpoint.includes("symbols") || endpoint === "/api/v3/etf/symbols") {
        // Use the configured symbols endpoint
        apiUrl = `${this.baseUrl}/api/platform/spot/market-v2/web/symbolsV2`;

        const url = new URL(apiUrl);
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              url.searchParams.append(key, String(value));
            }
          });
        }

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "MEXC-Sniper-Bot/1.0",
            ...(this.apiKey && { "X-MEXC-APIKEY": this.apiKey }),
          },
        });

        if (!response.ok) {
          throw new Error(`MEXC API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      }
      // Generic endpoint call
      const url = new URL(endpoint, this.baseUrl);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, String(value));
          }
        });
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey && { "X-MEXC-APIKEY": this.apiKey }),
        },
      });

      if (!response.ok) {
        throw new Error(`MEXC API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[MexcApiAgent] Direct API call failed:`, error);
      throw error;
    }
  }
}
