/**
 * BUILD PERFORMANCE ANALYZER
 *
 * PERFORMANCE OPTIMIZATION: Real-time build metrics and analysis
 * Addresses Agent 6's requirement for measuring 49s -> <15s build time improvements
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

interface BuildMetrics {
  buildId: string;
  startTime: number;
  endTime: number;
  duration: number;
  phases: {
    [phase: string]: {
      startTime: number;
      endTime: number;
      duration: number;
    };
  };
  memoryUsage: {
    initial: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
    final: NodeJS.MemoryUsage;
  };
  bundleStats: {
    totalSize: number;
    chunkCount: number;
    largestChunk: number;
    compression: number;
  };
  optimizations: {
    treeshakingEnabled: boolean;
    splitChunksEnabled: boolean;
    incrementalEnabled: boolean;
    cacheHits: number;
    cacheMisses: number;
  };
  warnings: number;
  errors: number;
  nodeVersion: string;
  nextVersion: string;
}

interface PerformanceTarget {
  maxBuildTime: number; // 15 seconds target
  maxBundleSize: number; // 5MB target
  maxMemoryUsage: number; // 512MB target
  minCompressionRatio: number; // 70% target
}

class BuildPerformanceAnalyzer {
  private currentBuild: Partial<BuildMetrics> | null = null;
  private performanceTargets: PerformanceTarget;
  private metricsHistory: BuildMetrics[] = [];
  private phaseTimers: Map<string, number> = new Map();
  private memoryPeak: NodeJS.MemoryUsage;

  constructor() {
    this.performanceTargets = {
      maxBuildTime: 15000, // 15 seconds (Agent 6's target)
      maxBundleSize: 5 * 1024 * 1024, // 5MB
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      minCompressionRatio: 70, // 70%
    };

    this.memoryPeak = process.memoryUsage();
    this.setupBuildTracking();
  }

  /**
   * CRITICAL: Start build performance tracking
   */
  startBuildTracking(): string {
    const buildId = `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    this.currentBuild = {
      buildId,
      startTime: performance.now(),
      phases: {},
      memoryUsage: {
        initial: process.memoryUsage(),
        peak: process.memoryUsage(),
        final: process.memoryUsage(),
      },
      bundleStats: {
        totalSize: 0,
        chunkCount: 0,
        largestChunk: 0,
        compression: 0,
      },
      optimizations: {
        treeshakingEnabled: false,
        splitChunksEnabled: false,
        incrementalEnabled: false,
        cacheHits: 0,
        cacheMisses: 0,
      },
      warnings: 0,
      errors: 0,
      nodeVersion: process.version,
      nextVersion: this.getNextVersion(),
    };

    console.log(`🚀 [BuildAnalyzer] Starting build tracking: ${buildId}`);
    console.log(
      `📊 [BuildAnalyzer] Target: <${this.performanceTargets.maxBuildTime / 1000}s build time`
    );

    return buildId;
  }

  /**
   * PERFORMANCE: Start phase tracking
   */
  startPhase(phaseName: string): void {
    if (!this.currentBuild) return;

    const startTime = performance.now();
    this.phaseTimers.set(phaseName, startTime);

    console.log(`⏱️  [BuildAnalyzer] Phase started: ${phaseName}`);
  }

  /**
   * PERFORMANCE: End phase tracking
   */
  endPhase(phaseName: string): void {
    if (!this.currentBuild || !this.phaseTimers.has(phaseName)) return;

    const endTime = performance.now();
    const startTime = this.phaseTimers.get(phaseName)!;
    const duration = endTime - startTime;

    this.currentBuild.phases![phaseName] = {
      startTime,
      endTime,
      duration,
    };

    this.phaseTimers.delete(phaseName);

    console.log(
      `✅ [BuildAnalyzer] Phase completed: ${phaseName} (${this.formatDuration(duration)})`
    );
  }

  /**
   * PERFORMANCE: Record bundle statistics
   */
  recordBundleStats(stats: {
    totalSize: number;
    chunkCount: number;
    largestChunk: number;
    compression: number;
  }): void {
    if (!this.currentBuild) return;

    this.currentBuild.bundleStats = stats;

    console.log(`📦 [BuildAnalyzer] Bundle stats recorded:`);
    console.log(`   Total size: ${this.formatBytes(stats.totalSize)}`);
    console.log(`   Chunks: ${stats.chunkCount}`);
    console.log(`   Largest chunk: ${this.formatBytes(stats.largestChunk)}`);
    console.log(`   Compression: ${stats.compression.toFixed(1)}%`);
  }

  /**
   * PERFORMANCE: Record optimization stats
   */
  recordOptimizations(
    optimizations: Partial<BuildMetrics["optimizations"]>
  ): void {
    if (!this.currentBuild) return;

    this.currentBuild.optimizations = {
      ...this.currentBuild.optimizations!,
      ...optimizations,
    };
  }

  /**
   * PERFORMANCE: Track memory usage
   */
  trackMemoryUsage(): void {
    if (!this.currentBuild) return;

    const currentMemory = process.memoryUsage();

    // Update peak memory usage
    if (currentMemory.heapUsed > this.memoryPeak.heapUsed) {
      this.memoryPeak = currentMemory;
      this.currentBuild.memoryUsage!.peak = currentMemory;
    }
  }

  /**
   * CRITICAL: End build tracking and analyze performance
   */
  endBuildTracking(): BuildMetrics | null {
    if (!this.currentBuild || !this.currentBuild.startTime) return null;

    const endTime = performance.now();
    const duration = endTime - this.currentBuild.startTime;

    const completedBuild: BuildMetrics = {
      ...this.currentBuild,
      endTime,
      duration,
      memoryUsage: {
        ...this.currentBuild.memoryUsage!,
        final: process.memoryUsage(),
      },
    } as BuildMetrics;

    // Analyze performance
    const analysis = this.analyzeBuildPerformance(completedBuild);

    // Store in history
    this.metricsHistory.push(completedBuild);
    this.saveMetricsToFile(completedBuild);

    // Print results
    this.printBuildSummary(completedBuild, analysis);

    this.currentBuild = null;
    return completedBuild;
  }

  /**
   * CRITICAL: Analyze build performance against targets
   */
  private analyzeBuildPerformance(build: BuildMetrics): {
    passed: boolean;
    issues: string[];
    achievements: string[];
    recommendations: string[];
    score: number;
  } {
    const issues: string[] = [];
    const achievements: string[] = [];
    const recommendations: string[] = [];

    // Check build time (CRITICAL: Agent 6's primary target)
    if (build.duration > this.performanceTargets.maxBuildTime) {
      issues.push(
        `Build time ${this.formatDuration(build.duration)} exceeds target ${this.formatDuration(this.performanceTargets.maxBuildTime)}`
      );
      recommendations.push(
        "Enable incremental compilation and optimize webpack configuration"
      );
    } else {
      achievements.push(
        `Build time ${this.formatDuration(build.duration)} meets target ✅`
      );
    }

    // Check bundle size
    if (build.bundleStats.totalSize > this.performanceTargets.maxBundleSize) {
      issues.push(
        `Bundle size ${this.formatBytes(build.bundleStats.totalSize)} exceeds target ${this.formatBytes(this.performanceTargets.maxBundleSize)}`
      );
      recommendations.push("Implement code splitting and tree-shaking");
    } else {
      achievements.push(
        `Bundle size ${this.formatBytes(build.bundleStats.totalSize)} meets target ✅`
      );
    }

    // Check memory usage
    const peakMemory = build.memoryUsage.peak.heapUsed;
    if (peakMemory > this.performanceTargets.maxMemoryUsage) {
      issues.push(
        `Memory usage ${this.formatBytes(peakMemory)} exceeds target ${this.formatBytes(this.performanceTargets.maxMemoryUsage)}`
      );
      recommendations.push("Optimize memory usage during build process");
    } else {
      achievements.push(
        `Memory usage ${this.formatBytes(peakMemory)} meets target ✅`
      );
    }

    // Check compression ratio
    if (
      build.bundleStats.compression <
      this.performanceTargets.minCompressionRatio
    ) {
      issues.push(
        `Compression ratio ${build.bundleStats.compression.toFixed(1)}% below target ${this.performanceTargets.minCompressionRatio}%`
      );
      recommendations.push("Enable better compression and minification");
    } else {
      achievements.push(
        `Compression ratio ${build.bundleStats.compression.toFixed(1)}% meets target ✅`
      );
    }

    // Calculate performance score
    const totalChecks = 4;
    const passedChecks = totalChecks - issues.length;
    const score = (passedChecks / totalChecks) * 100;

    return {
      passed: issues.length === 0,
      issues,
      achievements,
      recommendations,
      score,
    };
  }

  /**
   * PERFORMANCE: Print comprehensive build summary
   */
  private printBuildSummary(build: BuildMetrics, analysis: any): void {
    console.log("\n🎯 BUILD PERFORMANCE ANALYSIS");
    console.log("═".repeat(50));

    console.log(`📊 Build ID: ${build.buildId}`);
    console.log(`⏱️  Duration: ${this.formatDuration(build.duration)}`);
    console.log(
      `📦 Bundle Size: ${this.formatBytes(build.bundleStats.totalSize)}`
    );
    console.log(
      `🧠 Peak Memory: ${this.formatBytes(build.memoryUsage.peak.heapUsed)}`
    );
    console.log(`📈 Performance Score: ${analysis.score.toFixed(1)}%`);

    if (analysis.achievements.length > 0) {
      console.log("\n✅ ACHIEVEMENTS:");
      analysis.achievements.forEach((achievement: string) => {
        console.log(`   • ${achievement}`);
      });
    }

    if (analysis.issues.length > 0) {
      console.log("\n⚠️  PERFORMANCE ISSUES:");
      analysis.issues.forEach((issue: string) => {
        console.log(`   • ${issue}`);
      });
    }

    if (analysis.recommendations.length > 0) {
      console.log("\n💡 RECOMMENDATIONS:");
      analysis.recommendations.forEach((rec: string) => {
        console.log(`   • ${rec}`);
      });
    }

    // Agent 6's specific target tracking
    const targetMet = build.duration <= this.performanceTargets.maxBuildTime;
    const improvement = this.calculateImprovement(build.duration);

    console.log("\n🎯 AGENT 6 PERFORMANCE TARGET:");
    console.log(`   Target: <15s build time`);
    console.log(`   Current: ${this.formatDuration(build.duration)}`);
    console.log(`   Status: ${targetMet ? "✅ ACHIEVED" : "❌ NOT MET"}`);
    if (improvement) {
      console.log(`   Improvement: ${improvement}`);
    }

    console.log("═".repeat(50));
  }

  /**
   * PERFORMANCE: Calculate improvement from baseline
   */
  private calculateImprovement(currentDuration: number): string | null {
    const baseline = 45000; // 45 seconds baseline from initial measurement

    if (currentDuration < baseline) {
      const improvementMs = baseline - currentDuration;
      const improvementPercent = ((improvementMs / baseline) * 100).toFixed(1);
      return `${this.formatDuration(improvementMs)} faster (${improvementPercent}% improvement)`;
    }

    return null;
  }

  /**
   * PERFORMANCE: Save metrics to file for analysis
   */
  private saveMetricsToFile(build: BuildMetrics): void {
    try {
      const metricsPath = join(process.cwd(), ".next", "build-metrics.json");
      const existingMetrics = existsSync(metricsPath)
        ? JSON.parse(readFileSync(metricsPath, "utf8"))
        : [];

      existingMetrics.push(build);
      writeFileSync(metricsPath, JSON.stringify(existingMetrics, null, 2));
    } catch (error) {
      console.warn("[BuildAnalyzer] Failed to save metrics:", error);
    }
  }

  /**
   * PERFORMANCE: Setup automatic build tracking
   */
  private setupBuildTracking(): void {
    // Track memory usage periodically
    setInterval(() => {
      this.trackMemoryUsage();
    }, 1000);

    // Track process events
    process.on("beforeExit", () => {
      if (this.currentBuild) {
        this.endBuildTracking();
      }
    });
  }

  /**
   * UTILITY: Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(0)}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  }

  /**
   * UTILITY: Format bytes in human-readable format
   */
  private formatBytes(bytes: number): string {
    const sizes = ["B", "KB", "MB", "GB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * UTILITY: Get Next.js version
   */
  private getNextVersion(): string {
    try {
      const nextPackage = require("next/package.json");
      return nextPackage.version;
    } catch {
      return "unknown";
    }
  }

  /**
   * PUBLIC: Get current performance targets
   */
  getPerformanceTargets(): PerformanceTarget {
    return { ...this.performanceTargets };
  }

  /**
   * PUBLIC: Get metrics history
   */
  getMetricsHistory(): BuildMetrics[] {
    return [...this.metricsHistory];
  }
}

// Create singleton instance
export const buildPerformanceAnalyzer = new BuildPerformanceAnalyzer();

// Export utilities
export const startBuildTracking = () =>
  buildPerformanceAnalyzer.startBuildTracking();
export const endBuildTracking = () =>
  buildPerformanceAnalyzer.endBuildTracking();
export const startPhase = (phase: string) =>
  buildPerformanceAnalyzer.startPhase(phase);
export const endPhase = (phase: string) =>
  buildPerformanceAnalyzer.endPhase(phase);
export const recordBundleStats = (stats: any) =>
  buildPerformanceAnalyzer.recordBundleStats(stats);

// Auto-start tracking if in build mode
if (process.env.npm_lifecycle_event === "build") {
  buildPerformanceAnalyzer.startBuildTracking();
}
