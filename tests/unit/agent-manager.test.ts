/**
 * Agent Manager Tests
 * 
 * Comprehensive test suite for the AgentManager class that coordinates
 * all trading and safety agents with health monitoring and emergency protocols
 */

import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

// Mock health check functions
vi.mock('@/src/lib/health-checks', () => ({
  checkDatabaseHealth: vi.fn(),
  checkMexcApiHealth: vi.fn(),
  checkOpenAiHealth: vi.fn(),
}));

// Mock all agent dependencies
vi.mock('@/src/mexc-agents/calendar-agent', () => ({
  CalendarAgent: vi.fn(),
}));
vi.mock('@/src/mexc-agents/error-recovery-agent', () => ({
  ErrorRecoveryAgent: vi.fn(),
}));
vi.mock('@/src/mexc-agents/mexc-api-agent', () => ({
  MexcApiAgent: vi.fn(),
}));
vi.mock('@/src/mexc-agents/pattern-discovery-agent', () => ({
  PatternDiscoveryAgent: vi.fn(),
}));
vi.mock('@/src/mexc-agents/reconciliation-agent', () => ({
  ReconciliationAgent: vi.fn(),
}));
vi.mock('@/src/mexc-agents/risk-manager-agent', () => ({
  RiskManagerAgent: vi.fn(),
}));
vi.mock('@/src/mexc-agents/simulation-agent', () => ({
  SimulationAgent: vi.fn(),
}));
vi.mock('@/src/mexc-agents/strategy-agent', () => ({
  StrategyAgent: vi.fn(),
}));
vi.mock('@/src/mexc-agents/symbol-analysis-agent', () => ({
  SymbolAnalysisAgent: vi.fn(),
}));

import { 
  checkDatabaseHealth,
  checkMexcApiHealth,
  checkOpenAiHealth
} from '@/src/lib/health-checks';

import { AgentManager } from '@/src/mexc-agents/agent-manager';

describe('AgentManager', () => {
  let agentManager: AgentManager;
  
  // Mock agent instances
  const mockMexcApiAgent = {
    checkAgentHealth: vi.fn(),
  };
  
  const mockPatternDiscoveryAgent = {
    checkAgentHealth: vi.fn(),
  };
  
  const mockCalendarAgent = {
    checkAgentHealth: vi.fn(),
  };
  
  const mockSymbolAnalysisAgent = {
    checkAgentHealth: vi.fn(),
  };
  
  const mockStrategyAgent = {
    checkAgentHealth: vi.fn(),
  };
  
  const mockSimulationAgent = {
    checkAgentHealth: vi.fn().mockResolvedValue({ healthy: true }),
    performSafetyCheck: vi.fn(),
    toggleSimulation: vi.fn(),
  };
  
  const mockRiskManagerAgent = {
    checkAgentHealth: vi.fn().mockResolvedValue({ healthy: true }),
    performSafetyCheck: vi.fn(),
    updateSafetyConfig: vi.fn(),
    getSafetyConfig: vi.fn().mockReturnValue({
      riskManagement: {
        maxDailyLoss: 5000,
        maxPositionSize: 500,
      }
    }),
    activateEmergencyHalt: vi.fn(),
  };
  
  const mockReconciliationAgent = {
    checkAgentHealth: vi.fn().mockResolvedValue({ healthy: true }),
    performSafetyCheck: vi.fn(),
  };
  
  const mockErrorRecoveryAgent = {
    checkAgentHealth: vi.fn().mockResolvedValue({ healthy: true }),
    performSafetyCheck: vi.fn(),
    getSystemHealth: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Import and setup mocked constructors
    const { CalendarAgent } = await import('@/src/mexc-agents/calendar-agent');
    const { ErrorRecoveryAgent } = await import('@/src/mexc-agents/error-recovery-agent');
    const { MexcApiAgent } = await import('@/src/mexc-agents/mexc-api-agent');
    const { PatternDiscoveryAgent } = await import('@/src/mexc-agents/pattern-discovery-agent');
    const { ReconciliationAgent } = await import('@/src/mexc-agents/reconciliation-agent');
    const { RiskManagerAgent } = await import('@/src/mexc-agents/risk-manager-agent');
    const { SimulationAgent } = await import('@/src/mexc-agents/simulation-agent');
    const { StrategyAgent } = await import('@/src/mexc-agents/strategy-agent');
    const { SymbolAnalysisAgent } = await import('@/src/mexc-agents/symbol-analysis-agent');
    
    (CalendarAgent as any as Mock).mockImplementation(() => mockCalendarAgent);
    (ErrorRecoveryAgent as any as Mock).mockImplementation(() => mockErrorRecoveryAgent);
    (MexcApiAgent as any as Mock).mockImplementation(() => mockMexcApiAgent);
    (PatternDiscoveryAgent as any as Mock).mockImplementation(() => mockPatternDiscoveryAgent);
    (ReconciliationAgent as any as Mock).mockImplementation(() => mockReconciliationAgent);
    (RiskManagerAgent as any as Mock).mockImplementation(() => mockRiskManagerAgent);
    (SimulationAgent as any as Mock).mockImplementation(() => mockSimulationAgent);
    (StrategyAgent as any as Mock).mockImplementation(() => mockStrategyAgent);
    (SymbolAnalysisAgent as any as Mock).mockImplementation(() => mockSymbolAnalysisAgent);
    
    // Mock health check functions
    (checkDatabaseHealth as Mock).mockResolvedValue({ status: 'healthy' });
    (checkMexcApiHealth as Mock).mockResolvedValue({ status: 'healthy' });
    (checkOpenAiHealth as Mock).mockResolvedValue({ status: 'healthy' });
    
    agentManager = new AgentManager();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize all core trading agents', async () => {
      const { CalendarAgent } = await import('@/src/mexc-agents/calendar-agent');
      const { MexcApiAgent } = await import('@/src/mexc-agents/mexc-api-agent');
      const { PatternDiscoveryAgent } = await import('@/src/mexc-agents/pattern-discovery-agent');
      const { StrategyAgent } = await import('@/src/mexc-agents/strategy-agent');
      const { SymbolAnalysisAgent } = await import('@/src/mexc-agents/symbol-analysis-agent');
      
      expect(CalendarAgent).toHaveBeenCalledTimes(1);
      expect(MexcApiAgent).toHaveBeenCalledTimes(1);
      expect(PatternDiscoveryAgent).toHaveBeenCalledTimes(1);
      expect(StrategyAgent).toHaveBeenCalledTimes(1);
      expect(SymbolAnalysisAgent).toHaveBeenCalledTimes(1);
    });

    it('should initialize all safety agents', async () => {
      const { ErrorRecoveryAgent } = await import('@/src/mexc-agents/error-recovery-agent');
      const { ReconciliationAgent } = await import('@/src/mexc-agents/reconciliation-agent');
      const { RiskManagerAgent } = await import('@/src/mexc-agents/risk-manager-agent');
      const { SimulationAgent } = await import('@/src/mexc-agents/simulation-agent');
      
      expect(ErrorRecoveryAgent).toHaveBeenCalledTimes(1);
      expect(ReconciliationAgent).toHaveBeenCalledTimes(1);
      expect(RiskManagerAgent).toHaveBeenCalledTimes(1);
      expect(SimulationAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe('Agent Getters', () => {
    it('should return mexc api agent', () => {
      const agent = agentManager.getMexcApiAgent();
      expect(agent).toBe(mockMexcApiAgent);
    });

    it('should return pattern discovery agent', () => {
      const agent = agentManager.getPatternDiscoveryAgent();
      expect(agent).toBe(mockPatternDiscoveryAgent);
    });

    it('should return calendar agent', () => {
      const agent = agentManager.getCalendarAgent();
      expect(agent).toBe(mockCalendarAgent);
    });

    it('should return symbol analysis agent', () => {
      const agent = agentManager.getSymbolAnalysisAgent();
      expect(agent).toBe(mockSymbolAnalysisAgent);
    });

    it('should return strategy agent', () => {
      const agent = agentManager.getStrategyAgent();
      expect(agent).toBe(mockStrategyAgent);
    });

    it('should return simulation agent', () => {
      const agent = agentManager.getSimulationAgent();
      expect(agent).toBe(mockSimulationAgent);
    });

    it('should return risk manager agent', () => {
      const agent = agentManager.getRiskManagerAgent();
      expect(agent).toBe(mockRiskManagerAgent);
    });

    it('should return reconciliation agent', () => {
      const agent = agentManager.getReconciliationAgent();
      expect(agent).toBe(mockReconciliationAgent);
    });

    it('should return error recovery agent', () => {
      const agent = agentManager.getErrorRecoveryAgent();
      expect(agent).toBe(mockErrorRecoveryAgent);
    });
  });

  describe('Health Check System', () => {
    it('should perform comprehensive health check with all systems healthy', async () => {
      const result = await agentManager.checkAgentHealth();

      expect(result).toMatchObject({
        mexcApi: true,
        patternDiscovery: true,
        calendar: true,
        symbolAnalysis: true,
        strategy: true,
        simulation: true,
        riskManager: true,
        reconciliation: true,
        errorRecovery: true,
        cached: false,
      });

      expect(result.details).toEqual({
        mexcApiStatus: 'healthy',
        openAiStatus: 'healthy',
        databaseStatus: 'healthy',
      });

      expect(typeof result.responseTime).toBe('number');
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should handle unhealthy mexc api status', async () => {
      (checkMexcApiHealth as Mock).mockResolvedValue({ status: 'unhealthy' });

      const result = await agentManager.checkAgentHealth();

      expect(result.mexcApi).toBe(false);
      expect(result.calendar).toBe(false);
      expect(result.symbolAnalysis).toBe(false);
      expect(result.details.mexcApiStatus).toBe('unhealthy');
    });

    it('should handle unhealthy openai status', async () => {
      (checkOpenAiHealth as Mock).mockResolvedValue({ status: 'unhealthy' });

      const result = await agentManager.checkAgentHealth();

      expect(result.patternDiscovery).toBe(false);
      expect(result.symbolAnalysis).toBe(false);
      expect(result.strategy).toBe(false);
      expect(result.details.openAiStatus).toBe('unhealthy');
    });

    it('should use cached health status when cache is valid', async () => {
      // First call to populate cache
      const firstResult = await agentManager.checkAgentHealth();
      expect(firstResult.cached).toBe(false);

      // Second call should use cache
      const secondResult = await agentManager.checkAgentHealth();
      expect(secondResult.cached).toBe(true);

      // Health check functions should only be called once
      expect(checkMexcApiHealth).toHaveBeenCalledTimes(1);
      expect(checkOpenAiHealth).toHaveBeenCalledTimes(1);
      expect(checkDatabaseHealth).toHaveBeenCalledTimes(1);
    });

    it('should handle health check timeout', async () => {
      // Mock health checks to be slow but not hang the test
      (checkMexcApiHealth as Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ status: 'timeout' }), 2000))
      );

      const result = await agentManager.checkAgentHealth();

      expect(result.mexcApi).toBe(false);
      expect(result.details.mexcApiStatus).toBe('timeout');
    });

    it('should handle health check errors gracefully', async () => {
      (checkMexcApiHealth as Mock).mockRejectedValue(new Error('API Error'));
      (checkOpenAiHealth as Mock).mockRejectedValue(new Error('OpenAI Error'));
      (checkDatabaseHealth as Mock).mockRejectedValue(new Error('Database Error'));

      const result = await agentManager.checkAgentHealth();

      expect(result.mexcApi).toBe(false);
      expect(result.patternDiscovery).toBe(false);
      expect(result.details.mexcApiStatus).toBe('error');
      expect(result.details.openAiStatus).toBe('error');
      expect(result.details.databaseStatus).toBe('error');
    });

    it('should handle safety agent health check failures', async () => {
      mockSimulationAgent.checkAgentHealth.mockRejectedValue(new Error('Simulation error'));
      mockRiskManagerAgent.checkAgentHealth.mockRejectedValue(new Error('Risk error'));

      const result = await agentManager.checkAgentHealth();

      expect(result.simulation).toBe(false);
      expect(result.riskManager).toBe(false);
    });

    it('should handle safety agent health check timeouts', async () => {
      mockSimulationAgent.checkAgentHealth.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ healthy: false }), 1000))
      );

      const result = await agentManager.checkAgentHealth();

      expect(result.simulation).toBe(false);
    });
  });

  describe('Health Cache Management', () => {
    it('should clear health cache', () => {
      agentManager.clearHealthCache();
      
      const cacheStatus = agentManager.getHealthCacheStatus();
      expect(cacheStatus.isCached).toBe(false);
    });

    it('should report correct cache status', async () => {
      // Initially no cache
      let cacheStatus = agentManager.getHealthCacheStatus();
      expect(cacheStatus.isCached).toBe(false);

      // After health check, cache should exist
      await agentManager.checkAgentHealth();
      cacheStatus = agentManager.getHealthCacheStatus();
      expect(cacheStatus.isCached).toBe(true);
      expect(cacheStatus.cacheValid).toBe(true);
      expect(cacheStatus.cacheAge).toBeGreaterThanOrEqual(0);
    });

    it('should invalidate cache after TTL expires', async () => {
      // Mock Date.now to control cache timing
      const originalNow = Date.now;
      let currentTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

      await agentManager.checkAgentHealth();
      
      // Advance time beyond cache TTL (30 seconds)
      currentTime += 31000;
      
      const cacheStatus = agentManager.getHealthCacheStatus();
      expect(cacheStatus.cacheValid).toBe(false);

      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe('Agent Summary', () => {
    it('should return correct agent summary', () => {
      const summary = agentManager.getAgentSummary();

      expect(summary).toEqual({
        totalAgents: 9,
        coreAgents: 5,
        safetyAgents: 4,
        agentTypes: [
          'mexc-api',
          'pattern-discovery',
          'calendar',
          'symbol-analysis',
          'strategy',
          'simulation',
          'risk-manager',
          'reconciliation',
          'error-recovery',
        ],
        initialized: true,
      });
    });
  });

  describe('Comprehensive Safety Check', () => {
    beforeEach(() => {
      mockSimulationAgent.performSafetyCheck.mockResolvedValue({
        passed: true,
        issues: [],
        recommendations: [],
      });
      mockRiskManagerAgent.performSafetyCheck.mockResolvedValue({
        passed: true,
        issues: [],
        recommendations: [],
      });
      mockReconciliationAgent.performSafetyCheck.mockResolvedValue({
        passed: true,
        issues: [],
        recommendations: [],
      });
      mockErrorRecoveryAgent.performSafetyCheck.mockResolvedValue({
        passed: true,
        issues: [],
        recommendations: [],
      });
    });

    it('should perform comprehensive safety check with all systems passing', async () => {
      const result = await agentManager.performComprehensiveSafetyCheck();

      expect(result.overall).toBe('pass');
      expect(result.simulation.passed).toBe(true);
      expect(result.riskManager.passed).toBe(true);
      expect(result.reconciliation.passed).toBe(true);
      expect(result.errorRecovery.passed).toBe(true);
      expect(result.summary).toContain('All safety systems are operational');
    });

    it('should handle single safety system failure (warning)', async () => {
      mockRiskManagerAgent.performSafetyCheck.mockResolvedValue({
        passed: false,
        issues: ['Risk threshold exceeded'],
        recommendations: ['Reduce position size'],
      });

      const result = await agentManager.performComprehensiveSafetyCheck();

      expect(result.overall).toBe('warning');
      expect(result.riskManager.passed).toBe(false);
      expect(result.summary).toContain('1 safety system(s) require attention');
      expect(result.summary).toContain('Risk threshold exceeded');
    });

    it('should handle multiple safety system failures (critical)', async () => {
      mockRiskManagerAgent.performSafetyCheck.mockResolvedValue({
        passed: false,
        issues: ['Risk threshold exceeded'],
        recommendations: [],
      });
      mockSimulationAgent.performSafetyCheck.mockResolvedValue({
        passed: false,
        issues: ['Simulation failed'],
        recommendations: [],
      });
      mockReconciliationAgent.performSafetyCheck.mockResolvedValue({
        passed: false,
        issues: ['Data mismatch'],
        recommendations: [],
      });

      const result = await agentManager.performComprehensiveSafetyCheck();

      expect(result.overall).toBe('critical');
      expect(result.summary).toContain('3 safety system(s) require attention');
    });

    it('should handle safety check system error', async () => {
      mockSimulationAgent.performSafetyCheck.mockRejectedValue(new Error('System error'));

      const result = await agentManager.performComprehensiveSafetyCheck();

      expect(result.overall).toBe('critical');
      expect(result.simulation.passed).toBe(false);
      expect(result.summary[0]).toContain('Safety check system error');
    });
  });

  describe('Simulation Mode Management', () => {
    it('should toggle simulation mode and update risk configuration', async () => {
      await agentManager.toggleSimulationMode(true);

      expect(mockSimulationAgent.toggleSimulation).toHaveBeenCalledWith(true);
      expect(mockRiskManagerAgent.updateSafetyConfig).toHaveBeenCalledWith({
        riskManagement: {
          maxDailyLoss: 10000,
          maxPositionSize: 1000,
        },
      });
    });

    it('should disable simulation mode without changing risk config', async () => {
      await agentManager.toggleSimulationMode(false);

      expect(mockSimulationAgent.toggleSimulation).toHaveBeenCalledWith(false);
      expect(mockRiskManagerAgent.updateSafetyConfig).not.toHaveBeenCalled();
    });

    it('should clear health cache after simulation mode toggle', async () => {
      // Populate cache first
      await agentManager.checkAgentHealth();
      let cacheStatus = agentManager.getHealthCacheStatus();
      expect(cacheStatus.isCached).toBe(true);

      // Toggle simulation mode
      await agentManager.toggleSimulationMode(true);

      // Cache should be cleared
      cacheStatus = agentManager.getHealthCacheStatus();
      expect(cacheStatus.isCached).toBe(false);
    });
  });

  describe('Emergency Mode Activation', () => {
    it('should activate emergency mode across all safety systems', async () => {
      const reason = 'Critical system failure';
      mockErrorRecoveryAgent.getSystemHealth.mockReturnValue({
        status: 'critical',
        issues: ['Multiple system failures'],
      });

      await agentManager.activateEmergencyMode(reason);

      expect(mockRiskManagerAgent.activateEmergencyHalt).toHaveBeenCalledWith(reason);
      expect(mockSimulationAgent.toggleSimulation).toHaveBeenCalledWith(true);
      expect(mockErrorRecoveryAgent.getSystemHealth).toHaveBeenCalled();
    });

    it('should handle emergency mode activation errors', async () => {
      mockRiskManagerAgent.activateEmergencyHalt.mockRejectedValue(new Error('Emergency halt failed'));

      await expect(agentManager.activateEmergencyMode('Test reason')).rejects.toThrow('Emergency halt failed');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle concurrent health checks', async () => {
      const promises = [
        agentManager.checkAgentHealth(),
        agentManager.checkAgentHealth(),
        agentManager.checkAgentHealth(),
      ];

      const results = await Promise.all(promises);

      // First call should hit the API, others should use cache
      expect(results[0].cached).toBe(false);
      expect(results[1].cached).toBe(true);
      expect(results[2].cached).toBe(true);
    });

    it('should handle agent initialization failures gracefully', () => {
      const { SimulationAgent } = require('@/src/mexc-agents/simulation-agent');
      (SimulationAgent as any as Mock).mockImplementation(() => {
        throw new Error('Agent initialization failed');
      });

      expect(() => new AgentManager()).toThrow('Agent initialization failed');
    });

    it('should handle large number of concurrent safety checks', async () => {
      const promises = Array(20).fill(0).map(() => 
        agentManager.performComprehensiveSafetyCheck()
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(20);
      expect(results.every(r => r.overall === 'pass')).toBe(true);
    });

    it('should maintain performance under stress', async () => {
      const startTime = Date.now();
      
      const promises = Array(20).fill(0).map(async () => {
        await agentManager.checkAgentHealth();
        return agentManager.getAgentSummary();
      });

      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Integration with Health Checks', () => {
    it('should call all external health check functions', async () => {
      await agentManager.checkAgentHealth();

      expect(checkMexcApiHealth).toHaveBeenCalled();
      expect(checkOpenAiHealth).toHaveBeenCalled();
      expect(checkDatabaseHealth).toHaveBeenCalled();
    });

    it('should handle partial health check failures', async () => {
      (checkMexcApiHealth as Mock).mockResolvedValue({ status: 'healthy' });
      (checkOpenAiHealth as Mock).mockRejectedValue(new Error('OpenAI unavailable'));
      (checkDatabaseHealth as Mock).mockResolvedValue({ status: 'degraded' });

      const result = await agentManager.checkAgentHealth();

      expect(result.mexcApi).toBe(true);
      expect(result.patternDiscovery).toBe(false);
      expect(result.details.mexcApiStatus).toBe('healthy');
      expect(result.details.openAiStatus).toBe('error');
      expect(result.details.databaseStatus).toBe('degraded');
    });
  });
});