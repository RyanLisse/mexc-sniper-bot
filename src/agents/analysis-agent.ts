import { type AgentConfig, type AgentResponse, BaseAgent } from "./base-agent";

export interface AnalysisRequest {
  content: string;
  analysisType?: "sentiment" | "technical" | "fundamental" | "risk" | "opportunity";
  depth?: "quick" | "standard" | "comprehensive";
  focus?: string[];
}

export class AnalysisAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: "analysis-agent",
      model: "gpt-4o",
      temperature: 0.2,
      maxTokens: 3000,
      systemPrompt: `You are an expert financial analysis agent specializing in cryptocurrency market analysis, risk assessment, and opportunity identification.

Your responsibilities:
1. Perform detailed analysis of market data, trends, and content
2. Identify trading opportunities, risks, and market signals
3. Conduct sentiment analysis on market content and news
4. Provide technical and fundamental analysis insights
5. Generate actionable recommendations based on analysis
6. Assess risk levels and provide risk management guidance

Analysis Capabilities:
- Sentiment Analysis: Evaluate market sentiment, fear/greed indicators, social signals
- Technical Analysis: Chart patterns, indicators, support/resistance levels
- Fundamental Analysis: Project fundamentals, tokenomics, adoption metrics
- Risk Assessment: Volatility analysis, correlation risks, market risks
- Opportunity Identification: Entry points, trend reversals, breakout patterns

Analysis Framework:
- Data-driven insights with specific metrics when possible
- Clear risk/reward assessments
- Confidence levels for predictions and recommendations
- Time-based analysis (short-term vs long-term perspectives)
- Market context and broader implications
- Actionable recommendations with clear entry/exit criteria`,
    };
    super(config);
  }

  async process(input: string, context?: AnalysisRequest): Promise<AgentResponse> {
    const request: AnalysisRequest = context || {
      content: input,
      analysisType: "technical",
      depth: "standard",
    };

    const userMessage = `
Analysis Request:
Type: ${request.analysisType || "comprehensive"}
Depth: ${request.depth || "standard"}
${request.focus ? `Focus Areas: ${request.focus.join(", ")}` : ""}

Content to Analyze:
${request.content}

Please provide detailed ${request.analysisType || "comprehensive"} analysis with specific insights, recommendations, and risk assessments.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async analyzeSentiment(content: string): Promise<AgentResponse> {
    return await this.process(content, {
      content,
      analysisType: "sentiment",
      depth: "standard",
      focus: ["market sentiment", "fear/greed", "social signals", "news impact"],
    });
  }

  async performTechnicalAnalysis(content: string): Promise<AgentResponse> {
    return await this.process(content, {
      content,
      analysisType: "technical",
      depth: "comprehensive",
      focus: ["chart patterns", "indicators", "support/resistance", "volume analysis"],
    });
  }

  async assessRisk(content: string): Promise<AgentResponse> {
    return await this.process(content, {
      content,
      analysisType: "risk",
      depth: "comprehensive",
      focus: ["volatility", "correlation risks", "market risks", "liquidity risks"],
    });
  }

  async identifyOpportunities(content: string): Promise<AgentResponse> {
    return await this.process(content, {
      content,
      analysisType: "opportunity",
      depth: "comprehensive",
      focus: ["entry points", "trend reversals", "breakout patterns", "arbitrage"],
    });
  }
}
