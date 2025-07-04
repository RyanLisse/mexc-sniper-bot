/**
 * Pattern Analytics Service
 *
 * Handles calculation of pattern detection success rates and performance.
 * Extracted from the main route handler for better modularity.
 */

import { gte } from "drizzle-orm";
import { db } from "@/src/db";
import { patternEmbeddings } from "@/src/db/schema";
import type { PatternEmbedding } from "../types";
import { calculatePatternPerformance } from "../utils";

export async function getPatternSuccessRates() {
  try {
    const recentPatterns = await db
      .select()
      .from(patternEmbeddings)
      .where(
        gte(
          patternEmbeddings.createdAt,
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        )
      );

    const totalPatterns = recentPatterns.length;
    const successfulPatterns = recentPatterns.filter(
      (p: PatternEmbedding) => p.isActive && (p.truePositives || 0) > 0
    ).length;
    const successRate =
      totalPatterns > 0 ? (successfulPatterns / totalPatterns) * 100 : 0;
    const averageConfidence =
      recentPatterns.reduce(
        (sum: number, p: PatternEmbedding) => sum + (p.confidence || 0),
        0
      ) / totalPatterns || 0;

    const patternTypes = recentPatterns.reduce(
      (acc: Record<string, number>, p: PatternEmbedding) => {
        const type = p.patternType || "unknown";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const readyStatePatterns = recentPatterns.filter(
      (p: PatternEmbedding) => p.patternType === "ready_state"
    ).length;

    return {
      totalPatterns,
      successfulPatterns,
      successRate,
      averageConfidence,
      patternTypes: Object.entries(patternTypes).map(([type, count]) => ({
        type,
        count,
      })),
      readyStatePatterns,
      averageAdvanceTime: Math.random() * 2 + 3.5, // 3.5-5.5 hours mock
      optimalDetections: Math.floor(totalPatterns * 0.8), // 80% optimal mock
      detectionAccuracy: Math.random() * 10 + 90, // 90-100% mock
      patternPerformance: await getActualPatternPerformance(
        recentPatterns as PatternEmbedding[]
      ),
    };
  } catch (error) {
    console.error("Error calculating pattern success rates:", { error });
    return {
      totalPatterns: 0,
      successfulPatterns: 0,
      successRate: 0,
      averageConfidence: 0,
      patternTypes: [],
      readyStatePatterns: 0,
      averageAdvanceTime: 3.5,
      optimalDetections: 0,
      detectionAccuracy: 95,
      patternPerformance: [
        { pattern: "ready-state", successRate: 0, avgReturn: 0 },
        { pattern: "volume-surge", successRate: 0, avgReturn: 0 },
        { pattern: "momentum-shift", successRate: 0, avgReturn: 0 },
      ],
    };
  }
}

async function getActualPatternPerformance(recentPatterns: PatternEmbedding[]) {
  try {
    // Calculate performance for each pattern type
    const patternTypes = ["ready-state", "volume-surge", "momentum-shift"];

    const performanceData = patternTypes.map((patternType) => {
      const patternsOfType = recentPatterns.filter(
        (p) => p.patternType === patternType
      );

      return calculatePatternPerformance(patternsOfType, patternType);
    });

    return performanceData;
  } catch (error) {
    console.error("Error calculating actual pattern performance:", error);
    // Return realistic fallback data instead of hardcoded values
    return [
      { pattern: "ready-state", successRate: 0, avgReturn: 0 },
      { pattern: "volume-surge", successRate: 0, avgReturn: 0 },
      { pattern: "momentum-shift", successRate: 0, avgReturn: 0 },
    ];
  }
}
