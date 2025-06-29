#!/usr/bin/env bun
/**
 * Agent Health Check Optimization Test
 * 
 * Tests the performance improvements for agent health checks
 */

import { AgentManager } from './src/mexc-agents/agent-manager';

interface PerformanceResult {
  run: number;
  responseTime: number;
  cached: boolean;
  success: boolean;
}

class AgentHealthOptimizationTester {
  private agentManager: AgentManager;
  private results: PerformanceResult[] = [];

  constructor() {
    this.agentManager = new AgentManager();
  }

  /**
   * Test agent health check performance
   */
  async testHealthCheckPerformance(runs: number = 10): Promise<void> {
    console.log('🚀 Testing Agent Health Check Optimization...\n');

    for (let i = 1; i <= runs; i++) {
      try {
        console.log(`⏱️  Run ${i}/${runs}`);
        
        const startTime = Date.now();
        const healthResult = await this.agentManager.checkAgentHealth();
        const responseTime = Date.now() - startTime;

        const result: PerformanceResult = {
          run: i,
          responseTime,
          cached: healthResult.cached || false,
          success: true
        };

        this.results.push(result);

        console.log(`   Response Time: ${responseTime}ms ${healthResult.cached ? '(cached)' : '(fresh)'}`);
        console.log(`   Cache Status: ${JSON.stringify(this.agentManager.getHealthCacheStatus())}`);

        // Add small delay between requests to test caching
        if (i < runs) {
          await new Promise(resolve => setTimeout(resolve, i % 3 === 0 ? 35000 : 5000)); // Every 3rd request waits for cache expiry
        }

      } catch (error) {
        console.error(`❌ Run ${i} failed:`, error);
        this.results.push({
          run: i,
          responseTime: 0,
          cached: false,
          success: false
        });
      }
    }

    this.analyzeResults();
  }

  /**
   * Analyze performance results
   */
  private analyzeResults(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 AGENT HEALTH CHECK OPTIMIZATION RESULTS');
    console.log('='.repeat(60));

    const successfulResults = this.results.filter(r => r.success);
    const cachedResults = successfulResults.filter(r => r.cached);
    const freshResults = successfulResults.filter(r => !r.cached);

    if (successfulResults.length === 0) {
      console.log('❌ No successful health checks');
      return;
    }

    // Overall statistics
    const avgResponseTime = successfulResults.reduce((sum, r) => sum + r.responseTime, 0) / successfulResults.length;
    const minResponseTime = Math.min(...successfulResults.map(r => r.responseTime));
    const maxResponseTime = Math.max(...successfulResults.map(r => r.responseTime));

    console.log(`Total Runs: ${this.results.length}`);
    console.log(`Successful: ${successfulResults.length} (${(successfulResults.length / this.results.length * 100).toFixed(1)}%)`);
    console.log(`Failed: ${this.results.length - successfulResults.length}`);
    console.log();

    // Performance metrics
    console.log('📈 PERFORMANCE METRICS:');
    console.log(`Average Response Time: ${avgResponseTime.toFixed(1)}ms`);
    console.log(`Min Response Time: ${minResponseTime}ms`);
    console.log(`Max Response Time: ${maxResponseTime}ms`);
    console.log();

    // Caching effectiveness
    if (cachedResults.length > 0) {
      const avgCachedTime = cachedResults.reduce((sum, r) => sum + r.responseTime, 0) / cachedResults.length;
      console.log('🚀 CACHING EFFECTIVENESS:');
      console.log(`Cached Requests: ${cachedResults.length} (${(cachedResults.length / successfulResults.length * 100).toFixed(1)}%)`);
      console.log(`Average Cached Response Time: ${avgCachedTime.toFixed(1)}ms`);
      
      if (freshResults.length > 0) {
        const avgFreshTime = freshResults.reduce((sum, r) => sum + r.responseTime, 0) / freshResults.length;
        console.log(`Average Fresh Response Time: ${avgFreshTime.toFixed(1)}ms`);
        console.log(`Cache Performance Improvement: ${((avgFreshTime - avgCachedTime) / avgFreshTime * 100).toFixed(1)}%`);
      }
    }

    // Optimization target check
    const targetResponseTime = 500; // Target: <500ms
    const belowTargetCount = successfulResults.filter(r => r.responseTime < targetResponseTime).length;
    const belowTargetPercentage = (belowTargetCount / successfulResults.length) * 100;

    console.log();
    console.log('🎯 OPTIMIZATION TARGET ANALYSIS:');
    console.log(`Target Response Time: <${targetResponseTime}ms`);
    console.log(`Requests Below Target: ${belowTargetCount}/${successfulResults.length} (${belowTargetPercentage.toFixed(1)}%)`);
    
    if (belowTargetPercentage >= 80) {
      console.log('✅ OPTIMIZATION TARGET ACHIEVED!');
    } else if (belowTargetPercentage >= 60) {
      console.log('🟡 OPTIMIZATION PARTIALLY ACHIEVED');
    } else {
      console.log('❌ OPTIMIZATION TARGET NOT MET');
    }

    // Detailed breakdown
    console.log('\n📋 DETAILED RESULTS:');
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      const cacheStatus = result.cached ? '(cached)' : '(fresh)';
      const targetMet = result.responseTime < targetResponseTime ? '🎯' : '';
      console.log(`${status} Run ${result.run}: ${result.responseTime}ms ${cacheStatus} ${targetMet}`);
    });

    console.log('\n' + '='.repeat(60));
  }

  /**
   * Test cache clearing functionality
   */
  async testCacheClearFunctionality(): Promise<void> {
    console.log('\n🧪 Testing Cache Clear Functionality...');
    
    // First request (should be fresh)
    console.log('Making first request (should be fresh)...');
    const result1 = await this.agentManager.checkAgentHealth();
    console.log(`Response time: ${result1.responseTime}ms, Cached: ${result1.cached}`);

    // Second request (should be cached)
    console.log('Making second request (should be cached)...');
    const result2 = await this.agentManager.checkAgentHealth();
    console.log(`Response time: ${result2.responseTime}ms, Cached: ${result2.cached}`);

    // Clear cache
    console.log('Clearing cache...');
    this.agentManager.clearHealthCache();

    // Third request (should be fresh again)
    console.log('Making third request (should be fresh again)...');
    const result3 = await this.agentManager.checkAgentHealth();
    console.log(`Response time: ${result3.responseTime}ms, Cached: ${result3.cached}`);

    const cacheWorking = !result1.cached && result2.cached && !result3.cached;
    console.log(cacheWorking ? '✅ Cache functionality working correctly!' : '❌ Cache functionality has issues');
  }
}

// Run the test
if (import.meta.main) {
  const tester = new AgentHealthOptimizationTester();
  
  console.log('🔧 Phase 1 Critical Optimization: Agent Health Check Performance Test\n');
  
  tester.testCacheClearFunctionality()
    .then(() => tester.testHealthCheckPerformance(10))
    .catch(console.error);
}