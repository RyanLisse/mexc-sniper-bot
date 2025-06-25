/**
 * AI Embeddings Service
 *
 * Handles Cohere Embed v4.0 integration for advanced pattern embeddings
 * Extracted from ai-intelligence-service.ts for modularity
 */

import { context, SpanKind, SpanStatusCode, trace } from "@opentelemetry/api";
import { TRADING_TELEMETRY_CONFIG } from "../../lib/opentelemetry-setup";
import type { PatternData } from "../pattern-embedding-service";

// ======================
// Cohere Client Configuration
// ======================

interface CohereEmbedRequest {
  texts: string[];
  model: string;
  input_type?: "search_document" | "search_query" | "classification" | "clustering";
  embedding_types?: ("float" | "int8" | "uint8" | "binary" | "ubinary")[];
  truncate?: "NONE" | "START" | "END";
}

interface CohereEmbedResponse {
  id: string;
  texts: string[];
  embeddings: {
    float?: number[][];
    int8?: number[][];
    uint8?: number[][];
    binary?: number[][];
    ubinary?: number[][];
  };
  meta: {
    api_version: {
      version: string;
    };
    billed_units: {
      input_tokens: number;
    };
  };
}

// ======================
// Embedding Service
// ======================

export class EmbeddingsService {
  private static instance: EmbeddingsService;
  private cohereApiKey: string;
  private readonly cohereModel = "embed-english-v3.0";
  private readonly cohereApiUrl = "https://api.cohere.ai/v1/embed";
  private tracer = trace.getTracer("embeddings-service");

  // Cache for embeddings optimization
  private embeddingCache = new Map<string, number[]>();
  private cacheTimeout = 30 * 60 * 1000; // 30 minutes
  private _logger?: {
    info: (message: string, context?: any) => void;
    warn: (message: string, context?: any) => void;
    error: (message: string, context?: any, error?: Error) => void;
    debug: (message: string, context?: any) => void;
  };

  private constructor() {
    this.cohereApiKey = process.env.COHERE_API_KEY || "";
  }

  static getInstance(): EmbeddingsService {
    if (!EmbeddingsService.instance) {
      EmbeddingsService.instance = new EmbeddingsService();
    }
    return EmbeddingsService.instance;
  }

  /**
   * Lazy logger initialization to prevent webpack bundling issues
   */
  private get logger() {
    if (!this._logger) {
      this._logger = {
        info: (message: string, context?: any) =>
          console.info("[embeddings-service]", message, context || ""),
        warn: (message: string, context?: any) =>
          console.warn("[embeddings-service]", message, context || ""),
        error: (message: string, context?: any, error?: Error) =>
          console.error("[embeddings-service]", message, context || "", error || ""),
        debug: (message: string, context?: any) =>
          console.debug("[embeddings-service]", message, context || ""),
      };

      if (!this.cohereApiKey) {
        this._logger.warn("Cohere API key not found - embedding features disabled");
      }
    }
    return this._logger;
  }

  /**
   * Generate embedding using Cohere Embed v4.0
   */
  async generateCohereEmbedding(
    texts: string[],
    inputType:
      | "search_document"
      | "search_query"
      | "classification"
      | "clustering" = "search_document"
  ): Promise<number[][]> {
    return await this.tracer.startActiveSpan(
      "cohere.generate_embedding",
      {
        kind: SpanKind.CLIENT,
        attributes: {
          "ai.model.name": this.cohereModel,
          "ai.operation.name": "embed",
          "ai.input.count": texts.length,
          "ai.input.type": inputType,
        },
      },
      async (span) => {
        try {
          // Check cache first
          const cacheKey = `${inputType}:${texts.join("|")}`;
          const cached = this.embeddingCache.get(cacheKey);
          if (cached) {
            span.setAttributes({
              "ai.cache.hit": true,
            });
            span.setStatus({ code: SpanStatusCode.OK });
            return [cached];
          }

          if (!this.cohereApiKey) {
            throw new Error("Cohere API key is required for embedding generation");
          }

          const requestPayload: CohereEmbedRequest = {
            texts: texts,
            model: this.cohereModel,
            input_type: inputType,
            embedding_types: ["float"],
            truncate: "END",
          };

          this.logger.debug("Generating Cohere embedding", {
            model: this.cohereModel,
            textCount: texts.length,
            inputType,
          });

          const response = await fetch(this.cohereApiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.cohereApiKey}`,
              "User-Agent": "MEXC-Sniper-Bot/1.0",
            },
            body: JSON.stringify(requestPayload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            this.logger.error("Cohere API error", {
              status: response.status,
              statusText: response.statusText,
              error: errorText,
            });
            throw new Error(`Cohere API error: ${response.status} ${response.statusText}`);
          }

          const cohereResponse: CohereEmbedResponse = await response.json();

          if (!cohereResponse.embeddings?.float || cohereResponse.embeddings.float.length === 0) {
            throw new Error("No embeddings returned from Cohere API");
          }

          // Cache the first embedding
          if (cohereResponse.embeddings.float[0]) {
            this.embeddingCache.set(cacheKey, cohereResponse.embeddings.float[0]);

            // Clean up cache after timeout
            setTimeout(() => {
              this.embeddingCache.delete(cacheKey);
            }, this.cacheTimeout);
          }

          span.setAttributes({
            "ai.response.embeddings_count": cohereResponse.embeddings.float.length,
            "ai.response.tokens_used": cohereResponse.meta?.billed_units?.input_tokens || 0,
            "ai.cache.hit": false,
          });

          span.setStatus({ code: SpanStatusCode.OK });

          this.logger.info("Cohere embedding generated successfully", {
            textCount: texts.length,
            embeddingDimensions: cohereResponse.embeddings.float[0]?.length || 0,
            tokensUsed: cohereResponse.meta?.billed_units?.input_tokens || 0,
          });

          return cohereResponse.embeddings.float;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });
          span.recordException(error instanceof Error ? error : new Error(String(error)));

          this.logger.error("Failed to generate Cohere embedding", { error: errorMessage });
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Generate pattern-specific embedding
   */
  async generatePatternEmbedding(pattern: PatternData): Promise<number[]> {
    const enhancedText = this.patternToEnhancedText(pattern);
    const embeddings = await this.generateCohereEmbedding([enhancedText], "classification");
    return embeddings[0] || [];
  }

  /**
   * Convert pattern data to enhanced text representation
   */
  private patternToEnhancedText(pattern: PatternData): string {
    const {
      symbol,
      confidence,
      riskLevel,
      patternType,
      timeframe,
      priceChange,
      volumeChange,
      marketCap,
      description,
    } = pattern;

    // Create rich text representation for better embeddings
    const confidenceLevel = confidence >= 80 ? "high" : confidence >= 60 ? "medium" : "low";
    const changeDirection = (priceChange || 0) >= 0 ? "increasing" : "decreasing";
    const volumeDirection = (volumeChange || 0) >= 0 ? "rising" : "falling";

    return [
      `Cryptocurrency pattern analysis for ${symbol}`,
      `Pattern type: ${patternType || "ready_state"}`,
      `Confidence level: ${confidenceLevel} (${confidence}%)`,
      `Risk assessment: ${riskLevel || "medium"}`,
      `Market timeframe: ${timeframe || "short_term"}`,
      `Price trend: ${changeDirection} by ${Math.abs(priceChange || 0).toFixed(2)}%`,
      `Volume activity: ${volumeDirection} by ${Math.abs(volumeChange || 0).toFixed(2)}%`,
      marketCap ? `Market capitalization: $${marketCap.toLocaleString()}` : "",
      description ? `Additional context: ${description}` : "",
      `Trading signal strength: ${confidence >= 70 ? "strong" : "moderate"}`,
      `Investment timing: ${confidence >= 80 ? "optimal" : "requires_caution"}`,
    ]
      .filter(Boolean)
      .join(". ");
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
    this.logger.info("Embedding cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; timeout: number } {
    return {
      size: this.embeddingCache.size,
      timeout: this.cacheTimeout,
    };
  }
}

// Export singleton instance
export const embeddingsService = EmbeddingsService.getInstance();
