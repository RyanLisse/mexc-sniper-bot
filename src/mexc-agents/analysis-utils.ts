export interface AnalysisResult {
  confidence: number;
  insights: string[];
  actionable: boolean;
  urgency?: string;
}

export interface CalendarEntry {
  vcoinId: string;
  symbol?: string;
  projectName?: string;
  launchTime?: string;
  status?: string;
  [key: string]: unknown;
}

export interface SymbolData {
  vcoinId: string;
  symbol: string;
  readiness?: number;
  liquidity?: number;
  marketCap?: number;
  pattern?: string;
  [key: string]: unknown;
}

// biome-ignore lint/complexity/noStaticOnlyClass: utility class for namespacing
export class AnalysisUtils {
  static calculateUrgencyLevel(data: CalendarEntry): string {
    const launchTime = data.launchTime ? new Date(data.launchTime) : null;

    if (!launchTime) return "unknown";

    const now = new Date();
    const diffHours = (launchTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 1) return "critical";
    if (diffHours < 4) return "high";
    if (diffHours < 24) return "medium";
    return "low";
  }

  static extractConfidencePercentage(text: string): number {
    const confidenceMatch = text.match(/confidence[:\s]*(\d+(?:\.\d+)?)[%\s]/i);

    if (confidenceMatch) {
      const confidence = Number.parseFloat(confidenceMatch[1]);
      return Math.min(Math.max(confidence, 0), 100);
    }

    const ratingMatch = text.match(/(?:score|rating|level)[:\s]*(\d+(?:\.\d+)?)/i);
    if (ratingMatch) {
      const rating = Number.parseFloat(ratingMatch[1]);
      return Math.min(rating * 10, 100);
    }

    return 75; // Default confidence
  }

  static extractLiquidityScore(text: string): number {
    const liquidityMatch = text.match(/liquidity[:\s]*(\d+(?:\.\d+)?)/i);

    if (liquidityMatch) {
      return Number.parseFloat(liquidityMatch[1]);
    }

    const volumeMatch = text.match(/volume[:\s]*(\d+(?:\.\d+)?)/i);
    if (volumeMatch) {
      const volume = Number.parseFloat(volumeMatch[1]);
      return Math.min(volume / 1000000, 100); // Normalize to 0-100 scale
    }

    return 50; // Default liquidity score
  }

  static extractReadinessIndicators(text: string): {
    ready: boolean;
    score: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let score = 0;

    // Check for ready state patterns
    const readyPatterns = [
      /ready\s+state/i,
      /sts:\s*2,\s*st:\s*2,\s*tt:\s*4/i,
      /fully\s+prepared/i,
      /launch\s+ready/i,
    ];

    let _readyIndicators = 0;
    for (const pattern of readyPatterns) {
      if (pattern.test(text)) {
        _readyIndicators++;
        score += 25;
        reasons.push("Ready state pattern detected");
      }
    }

    // Check for timing indicators
    if (/\b([1-4])\s*hours?\s+advance/i.test(text)) {
      score += 20;
      reasons.push("Optimal advance timing");
    }

    // Check for market conditions
    if (/high\s+interest/i.test(text)) {
      score += 15;
      reasons.push("High market interest");
    }

    if (/low\s+risk/i.test(text)) {
      score += 10;
      reasons.push("Low risk profile");
    }

    return {
      ready: score >= 50,
      score: Math.min(score, 100),
      reasons,
    };
  }

  static categorizeOpportunity(data: CalendarEntry, confidence: number): string {
    const urgency = AnalysisUtils.calculateUrgencyLevel(data);

    if (confidence >= 80 && urgency === "high") return "prime";
    if (confidence >= 70 && urgency === "medium") return "strong";
    if (confidence >= 60) return "moderate";
    if (confidence >= 40) return "weak";
    return "poor";
  }

  static generateRecommendation(data: CalendarEntry, confidence: number): string {
    const category = AnalysisUtils.categorizeOpportunity(data, confidence);
    const urgency = AnalysisUtils.calculateUrgencyLevel(data);

    switch (category) {
      case "prime":
        return `IMMEDIATE ACTION: High-confidence opportunity (${confidence}%) with ${urgency} urgency. Prepare for sniping.`;
      case "strong":
        return `PREPARE: Strong opportunity (${confidence}%) detected. Monitor closely and prepare entry strategy.`;
      case "moderate":
        return `MONITOR: Moderate opportunity (${confidence}%). Watch for improving conditions.`;
      case "weak":
        return `OBSERVE: Low-confidence signal (${confidence}%). Consider for future monitoring.`;
      default:
        return `SKIP: Poor opportunity profile (${confidence}%). Focus resources elsewhere.`;
    }
  }

  static combineConfidenceScores(scores: number[]): number {
    if (scores.length === 0) return 0;
    if (scores.length === 1) return scores[0];

    // Weighted average with diminishing returns for additional scores
    const weights = [0.5, 0.3, 0.2];
    let totalWeight = 0;
    let weightedSum = 0;

    for (let i = 0; i < Math.min(scores.length, weights.length); i++) {
      weightedSum += scores[i] * weights[i];
      totalWeight += weights[i];
    }

    return weightedSum / totalWeight;
  }

  static formatTimestamp(date?: string | Date): string {
    if (!date) return "Unknown";

    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString().replace("T", " ").substring(0, 19);
  }

  static extractNumberFromText(text: string, pattern: RegExp, defaultValue = 0): number {
    const match = text.match(pattern);
    return match ? Number.parseFloat(match[1]) || defaultValue : defaultValue;
  }

  static sanitizeSymbolName(symbol?: string): string {
    if (!symbol) return "UNKNOWN";
    return symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  static calculateRiskLevel(confidence: number, liquidity: number): "low" | "medium" | "high" {
    if (confidence >= 80 && liquidity >= 70) return "low";
    if (confidence >= 60 && liquidity >= 50) return "medium";
    return "high";
  }
}
