/**
 * AI Research Service
 *
 * Handles Perplexity API integration for real-time market research
 * Extracted from ai-intelligence-service.ts for modularity
 */

import { context, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { TRADING_TELEMETRY_CONFIG } from "../../lib/opentelemetry-setup";

// ======================
// Perplexity Client Configuration
// ======================

interface PerplexityRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  search_domain_filter?: string[];
  return_images?: boolean;
  return_related_questions?: boolean;
  search_recency_filter?: "month" | "week" | "day" | "hour";
  top_k?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
}

interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  object: string;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: "assistant";
      content: string;
    };
    delta?: {
      role?: string;
      content?: string;
    };
  }>;
}

export interface PerplexityResearchResult {
  symbol: string;
  analysis: string;
  sentiment: "bullish" | "bearish" | "neutral";
  confidenceBoost: number;
  keyFindings: string[];
  risks: string[];
  opportunities: string[];
  marketContext: string;
  timestamp: number;
  sources?: string[];
}

// ======================
// Research Service
// ======================

export class ResearchService {
  private static instance: ResearchService;
  private perplexityApiKey: string;
  private readonly perplexityApiUrl = "https://api.perplexity.ai/chat/completions";
  private tracer = trace.getTracer("research-service");

  // Cache for research results optimization
  private researchCache = new Map<string, PerplexityResearchResult>();
  private cacheTimeout = 30 * 60 * 1000; // 30 minutes
  private _logger?: {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  };

  private constructor() {
    this.perplexityApiKey = process.env.PERPLEXITY_API_KEY || "";
  }

  static getInstance(): ResearchService {
    if (!ResearchService.instance) {
      ResearchService.instance = new ResearchService();
    }
    return ResearchService.instance;
  }

  /**
   * Lazy logger initialization to prevent webpack bundling issues
   */
  private get logger() {
    if (!this._logger) {
      this._logger = {
        info: (message: string, context?: any) =>
          console.info("[research-service]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[research-service]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error("[research-service]", message, context || "", error || ""),
        debug: (message: string, context?: any) =>
          console.debug("[research-service]", message, context || ""),
      };

      if (!this.perplexityApiKey) {
        this._logger.warn("Perplexity API key not found - research features disabled");
      }
    }
    return this._logger;
  }

  /**
   * Conduct market research using Perplexity API
   */
  async conductMarketResearch(
    symbol: string,
    focus: "technical" | "fundamental" | "news" | "comprehensive" = "comprehensive"
  ): Promise<PerplexityResearchResult> {
    return await this.tracer.startActiveSpan(
      "perplexity.conduct_research",
      {
        kind: SpanKind.CLIENT,
        attributes: {
          "ai.model.name": "llama-3.1-sonar-small-128k-online",
          "ai.operation.name": "research",
          "research.symbol": symbol,
          "research.focus": focus,
        },
      },
      async (span) => {
        try {
          // Check cache first
          const cacheKey = `${symbol}:${focus}:${Math.floor(Date.now() / (15 * 60 * 1000))}`; // 15-minute cache buckets
          const cached = this.researchCache.get(cacheKey);
          if (cached) {
            span.setAttributes({ "ai.cache.hit": true });
            span.setStatus({ code: SpanStatusCode.OK });
            return cached;
          }

          if (!this.perplexityApiKey) {
            throw new Error("Perplexity API key is required for market research");
          }

          const prompt = this.buildResearchPrompt(symbol, focus);

          const requestPayload: PerplexityRequest = {
            model: "llama-3.1-sonar-small-128k-online",
            messages: [
              {
                role: "system",
                content:
                  "You are a professional cryptocurrency market analyst with expertise in technical analysis, fundamental analysis, and market sentiment. Provide concise, actionable insights.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            max_tokens: 800,
            temperature: 0.2,
            top_p: 0.9,
            search_recency_filter: "day",
            return_related_questions: false,
            return_images: false,
          };

          this.logger.debug("Conducting Perplexity research", {
            symbol,
            focus,
            promptLength: prompt.length,
          });

          const response = await fetch(this.perplexityApiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.perplexityApiKey}`,
              "User-Agent": "MEXC-Sniper-Bot/1.0",
            },
            body: JSON.stringify(requestPayload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            this.logger.error("Perplexity API error", {
              status: response.status,
              statusText: response.statusText,
              error: errorText,
            });
            throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
          }

          const perplexityResponse: PerplexityResponse = await response.json();

          if (!perplexityResponse.choices?.[0]?.message?.content) {
            throw new Error("No research content returned from Perplexity API");
          }

          const analysis = perplexityResponse.choices[0].message.content;
          const researchResult = this.parseResearchResponse(symbol, analysis);

          // Cache the result
          this.researchCache.set(cacheKey, researchResult);
          setTimeout(() => {
            this.researchCache.delete(cacheKey);
          }, this.cacheTimeout);

          span.setAttributes({
            "ai.response.tokens_used": perplexityResponse.usage?.total_tokens || 0,
            "ai.response.sentiment": researchResult.sentiment,
            "ai.response.confidence_boost": researchResult.confidenceBoost,
            "ai.cache.hit": false,
          });

          span.setStatus({ code: SpanStatusCode.OK });

          this.logger.info("Market research completed successfully", {
            symbol,
            sentiment: researchResult.sentiment,
            confidenceBoost: researchResult.confidenceBoost,
            keyFindings: researchResult.keyFindings.length,
            tokensUsed: perplexityResponse.usage?.total_tokens || 0,
          });

          return researchResult;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });
          span.recordException(error instanceof Error ? error : new Error(String(error)));

          this.logger.error("Failed to conduct market research", { symbol, error: errorMessage });
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Build research prompt based on focus area
   */
  private buildResearchPrompt(symbol: string, focus: string): string {
    const basePrompt = `Analyze the cryptocurrency ${symbol} with focus on ${focus}. Provide:

1. Current market sentiment (bullish/bearish/neutral)
2. Key findings that could impact price
3. Potential risks and opportunities
4. Market context and timing considerations
5. Confidence level for trading decisions (0-20 point boost)

Format your response as structured analysis with clear sections.`;

    const focusSpecificPrompts = {
      technical: `${basePrompt}

Focus specifically on:
- Technical indicators and chart patterns
- Support and resistance levels
- Volume analysis and momentum
- Price action and trend analysis`,

      fundamental: `${basePrompt}

Focus specifically on:
- Project fundamentals and development
- Tokenomics and supply dynamics
- Partnerships and ecosystem growth
- Adoption metrics and utility`,

      news: `${basePrompt}

Focus specifically on:
- Recent news and announcements
- Market events and catalysts
- Regulatory developments
- Community sentiment and social media trends`,

      comprehensive: `${basePrompt}

Provide a comprehensive analysis covering technical, fundamental, and news aspects.`,
    };

    return focusSpecificPrompts[focus as keyof typeof focusSpecificPrompts] || basePrompt;
  }

  /**
   * Parse research response into structured format
   */
  private parseResearchResponse(symbol: string, analysis: string): PerplexityResearchResult {
    // Extract sentiment using keyword analysis
    const sentimentKeywords = {
      bullish: ["bullish", "positive", "upward", "growth", "strong", "buy", "optimistic", "rally"],
      bearish: [
        "bearish",
        "negative",
        "downward",
        "decline",
        "weak",
        "sell",
        "pessimistic",
        "crash",
      ],
      neutral: ["neutral", "sideways", "uncertain", "mixed", "stable", "consolidation"],
    };

    let sentiment: "bullish" | "bearish" | "neutral" = "neutral";
    let maxScore = 0;

    for (const [sent, keywords] of Object.entries(sentimentKeywords)) {
      const score = keywords.reduce((count, keyword) => {
        const regex = new RegExp(keyword, "gi");
        return count + (analysis.match(regex) || []).length;
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        sentiment = sent as "bullish" | "bearish" | "neutral";
      }
    }

    // Extract confidence boost (0-20 points)
    let confidenceBoost = 0;
    const confidenceMatches = analysis.match(/confidence[:\s]+(\d+)/gi);
    if (confidenceMatches) {
      const numbers = confidenceMatches.map((match) => {
        const num = match.match(/\d+/);
        return num ? parseInt(num[0]) : 0;
      });
      confidenceBoost = Math.min(Math.max(...numbers, 0), 20);
    } else {
      // Default confidence based on sentiment strength
      confidenceBoost = sentiment === "neutral" ? 5 : maxScore > 3 ? 15 : 10;
    }

    // Extract key findings, risks, and opportunities
    const sections = analysis.split(/\n\s*\n/);
    const keyFindings: string[] = [];
    const risks: string[] = [];
    const opportunities: string[] = [];

    sections.forEach((section) => {
      const lowerSection = section.toLowerCase();
      if (lowerSection.includes("finding") || lowerSection.includes("key")) {
        keyFindings.push(section.trim());
      } else if (lowerSection.includes("risk") || lowerSection.includes("concern")) {
        risks.push(section.trim());
      } else if (lowerSection.includes("opportunity") || lowerSection.includes("potential")) {
        opportunities.push(section.trim());
      }
    });

    // If no specific sections found, extract bullet points
    if (keyFindings.length === 0) {
      const bulletPoints = analysis.match(/^[-•*]\s+.+$/gm) || [];
      keyFindings.push(...bulletPoints.slice(0, 3).map((point) => point.replace(/^[-•*]\s+/, "")));
    }

    return {
      symbol,
      analysis,
      sentiment,
      confidenceBoost,
      keyFindings: keyFindings.slice(0, 5),
      risks: risks.slice(0, 3),
      opportunities: opportunities.slice(0, 3),
      marketContext: sections[0] || analysis.substring(0, 200) + "...",
      timestamp: Date.now(),
    };
  }

  /**
   * Clear research cache
   */
  clearCache(): void {
    this.researchCache.clear();
    this.logger.info("Research cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; timeout: number } {
    return {
      size: this.researchCache.size,
      timeout: this.cacheTimeout,
    };
  }
}

// Export singleton instance
export const researchService = ResearchService.getInstance();
