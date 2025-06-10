#!/usr/bin/env bun

/**
 * Multi-Agent System Health Check
 * Verifies all 5 TypeScript agents are operational
 */

import { MexcApiAgent } from './mexc-api-agent.js';
import { PatternDiscoveryAgent } from './pattern-discovery-agent.js';
import { CalendarAgent } from './calendar-agent.js';
import { SymbolAnalysisAgent } from './symbol-analysis-agent.js';
import { MexcOrchestrator } from './orchestrator.js';

interface HealthCheckResult {
  agent: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  message: string;
  timestamp: string;
}

class AgentHealthChecker {
  private results: HealthCheckResult[] = [];

  private addResult(agent: string, status: 'healthy' | 'unhealthy' | 'warning', message: string) {
    this.results.push({
      agent,
      status,
      message,
      timestamp: new Date().toISOString()
    });
  }

  async checkMexcApiAgent(): Promise<void> {
    try {
      const agent = new MexcApiAgent();
      // Basic initialization check
      if (agent && typeof agent.processData === 'function') {
        this.addResult('MexcApiAgent', 'healthy', 'Agent initialized successfully');
      } else {
        this.addResult('MexcApiAgent', 'unhealthy', 'Agent failed to initialize properly');
      }
    } catch (error) {
      this.addResult('MexcApiAgent', 'unhealthy', `Initialization error: ${error}`);
    }
  }

  async checkPatternDiscoveryAgent(): Promise<void> {
    try {
      const agent = new PatternDiscoveryAgent();
      if (agent && typeof agent.processData === 'function') {
        this.addResult('PatternDiscoveryAgent', 'healthy', 'Agent initialized successfully');
      } else {
        this.addResult('PatternDiscoveryAgent', 'unhealthy', 'Agent failed to initialize properly');
      }
    } catch (error) {
      this.addResult('PatternDiscoveryAgent', 'unhealthy', `Initialization error: ${error}`);
    }
  }

  async checkCalendarAgent(): Promise<void> {
    try {
      const agent = new CalendarAgent();
      if (agent && typeof agent.processData === 'function') {
        this.addResult('CalendarAgent', 'healthy', 'Agent initialized successfully');
      } else {
        this.addResult('CalendarAgent', 'unhealthy', 'Agent failed to initialize properly');
      }
    } catch (error) {
      this.addResult('CalendarAgent', 'unhealthy', `Initialization error: ${error}`);
    }
  }

  async checkSymbolAnalysisAgent(): Promise<void> {
    try {
      const agent = new SymbolAnalysisAgent();
      if (agent && typeof agent.processData === 'function') {
        this.addResult('SymbolAnalysisAgent', 'healthy', 'Agent initialized successfully');
      } else {
        this.addResult('SymbolAnalysisAgent', 'unhealthy', 'Agent failed to initialize properly');
      }
    } catch (error) {
      this.addResult('SymbolAnalysisAgent', 'unhealthy', `Initialization error: ${error}`);
    }
  }

  async checkMexcOrchestrator(): Promise<void> {
    try {
      const orchestrator = new MexcOrchestrator();
      if (orchestrator && typeof orchestrator.coordinateAgents === 'function') {
        this.addResult('MexcOrchestrator', 'healthy', 'Orchestrator initialized successfully');
      } else {
        this.addResult('MexcOrchestrator', 'unhealthy', 'Orchestrator failed to initialize properly');
      }
    } catch (error) {
      this.addResult('MexcOrchestrator', 'unhealthy', `Initialization error: ${error}`);
    }
  }

  async checkEnvironmentVariables(): Promise<void> {
    const requiredEnvVars = ['OPENAI_API_KEY'];
    const optionalEnvVars = ['MEXC_API_KEY', 'MEXC_SECRET_KEY'];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        this.addResult('Environment', 'unhealthy', `Missing required environment variable: ${envVar}`);
      }
    }

    let missingOptional = 0;
    for (const envVar of optionalEnvVars) {
      if (!process.env[envVar]) {
        missingOptional++;
      }
    }

    if (missingOptional === 0) {
      this.addResult('Environment', 'healthy', 'All environment variables configured');
    } else if (missingOptional === optionalEnvVars.length) {
      this.addResult('Environment', 'warning', 'MEXC API credentials not configured (required for live trading)');
    } else {
      this.addResult('Environment', 'warning', `Some optional environment variables missing: ${missingOptional}/${optionalEnvVars.length}`);
    }
  }

  async runAllChecks(): Promise<HealthCheckResult[]> {
    console.log('🤖 Starting Multi-Agent System Health Check...\n');

    await this.checkEnvironmentVariables();
    await this.checkMexcApiAgent();
    await this.checkPatternDiscoveryAgent();
    await this.checkCalendarAgent();
    await this.checkSymbolAnalysisAgent();
    await this.checkMexcOrchestrator();

    return this.results;
  }

  printResults(): void {
    console.log('📊 Health Check Results:');
    console.log('========================\n');

    const healthyCount = this.results.filter(r => r.status === 'healthy').length;
    const warningCount = this.results.filter(r => r.status === 'warning').length;
    const unhealthyCount = this.results.filter(r => r.status === 'unhealthy').length;

    for (const result of this.results) {
      const statusIcon = result.status === 'healthy' ? '✅' : 
                        result.status === 'warning' ? '⚠️' : '❌';
      
      console.log(`${statusIcon} ${result.agent}: ${result.message}`);
    }

    console.log('\n========================');
    console.log(`Summary: ${healthyCount} healthy, ${warningCount} warnings, ${unhealthyCount} unhealthy`);
    
    if (unhealthyCount === 0) {
      console.log('🎉 All critical systems operational!');
    } else {
      console.log('🚨 Some systems require attention');
      process.exit(1);
    }
  }
}

// Run health check if this file is executed directly
if (import.meta.main) {
  const checker = new AgentHealthChecker();
  
  checker.runAllChecks()
    .then(() => {
      checker.printResults();
    })
    .catch((error) => {
      console.error('❌ Health check failed:', error);
      process.exit(1);
    });
}

export { AgentHealthChecker, type HealthCheckResult };