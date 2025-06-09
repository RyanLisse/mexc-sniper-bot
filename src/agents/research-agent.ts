import { type AgentConfig, type AgentResponse, BaseAgent } from "./base-agent";

export interface ResearchRequest {
  topics: string[];
  focusAreas?: string[];
  depth?: "shallow" | "moderate" | "deep";
  timeframe?: string;
}

export class ResearchAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      name: "research-agent",
      model: "gpt-4o",
      temperature: 0.3,
      maxTokens: 3000,
      systemPrompt: `You are an expert research agent specializing in cryptocurrency market analysis and trading insights.

Your responsibilities:
1. Conduct thorough research on cryptocurrency topics, market trends, and trading opportunities
2. Analyze market data, news, and sentiment for specified cryptocurrencies or topics
3. Provide comprehensive, fact-based research reports with actionable insights
4. Focus on recent developments, technical analysis, and market dynamics
5. Include relevant metrics, price movements, and market indicators when available

Research Guidelines:
- Always provide current, accurate information based on your knowledge
- Structure findings in a clear, organized manner
- Include both opportunities and risks in your analysis
- Focus on actionable insights for traders and investors
- Cite specific examples and data points when possible
- Maintain objectivity and avoid speculation without proper context

Output Format:
- Executive Summary (2-3 sentences)
- Key Findings (3-5 bullet points)
- Detailed Analysis (comprehensive research content)
- Market Implications (potential impact and opportunities)
- Risk Assessment (potential challenges or concerns)`,
    };
    super(config);
  }

  async process(input: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    const request: ResearchRequest = (context as unknown as ResearchRequest) || { topics: [input] };

    const userMessage = `
Research Request:
Topics: ${request.topics.join(", ")}
${request.focusAreas ? `Focus Areas: ${request.focusAreas.join(", ")}` : ""}
${request.depth ? `Research Depth: ${request.depth}` : ""}
${request.timeframe ? `Timeframe: ${request.timeframe}` : ""}

Please provide comprehensive research on these topics with focus on cryptocurrency trading opportunities, market trends, and actionable insights.
`;

    return await this.callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  async researchCryptocurrency(
    symbol: string,
    depth: "shallow" | "moderate" | "deep" = "moderate"
  ): Promise<AgentResponse> {
    return await this.process(`Research ${symbol} cryptocurrency`, {
      topics: [symbol],
      focusAreas: [
        "price analysis",
        "market trends",
        "trading opportunities",
        "technical indicators",
      ],
      depth,
      timeframe: "recent",
    });
  }

  async analyzeMarketTrends(topics: string[]): Promise<AgentResponse> {
    return await this.process("Market trend analysis", {
      topics,
      focusAreas: [
        "market sentiment",
        "price movements",
        "volume analysis",
        "emerging opportunities",
      ],
      depth: "deep",
      timeframe: "last 30 days",
    });
  }
}
