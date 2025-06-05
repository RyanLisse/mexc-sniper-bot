import { BaseAgent, AgentConfig, AgentResponse } from "../agents/base-agent";

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

  async process(input: string, context?: MexcApiRequest): Promise<AgentResponse> {
    const request: MexcApiRequest = context || { endpoint: input };
    
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

  // Helper method to make actual MEXC API calls
  async callMexcApi(endpoint: string, params?: Record<string, any>): Promise<any> {
    try {
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
      console.error(`[MexcApiAgent] API call failed:`, error);
      throw error;
    }
  }
}