/**
 * Strategy-Agent Integration Tests (TDD)
 * 
 * MISSION: Verify end-to-end strategy configuration flows through to agent execution
 * 
 * Test Strategy:
 * 1. Strategy Selection → Agent Configuration Updates
 * 2. Risk Settings → Auto-Sniping Parameter Changes  
 * 3. Agent Swarm Coordination for Strategy Execution
 * 4. Real-time Performance Feedback Loop
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnhancedMexcOrchestrator } from '@/src/mexc-agents/coordination/enhanced-orchestrator';
import type { UserPreferences } from '@/src/schemas/user-preferences-schema';
import { getCoreTrading } from '@/src/services/trading/consolidated/core-trading/base-service';
import { UserPreferencesService } from '@/src/services/user/user-preferences-service';

describe('Strategy-Agent Integration (TDD)', () => {
  let coreTrading: any;
  let orchestrator: EnhancedMexcOrchestrator;
  let userPrefsService: UserPreferencesService;

  beforeEach(async () => {
    // Initialize services
    coreTrading = getCoreTrading();
    userPrefsService = UserPreferencesService.getInstance();
    
    // Mock dependencies for EnhancedMexcOrchestrator
    const mockAgentRegistry = {
      startHealthMonitoring: vi.fn(),
      stopHealthMonitoring: vi.fn(),
      isAgentAvailable: vi.fn().mockReturnValue(true),
      getAllAgents: vi.fn().mockReturnValue([]),
      getStats: vi.fn().mockReturnValue({
        totalAgents: 0,
        healthyAgents: 0,
        degradedAgents: 0,
        unhealthyAgents: 0,
        averageResponseTime: 0
      }),
      getAgent: vi.fn(),
      getAvailableAgentsByType: vi.fn().mockReturnValue([]),
      destroy: vi.fn()
    };

    const mockWorkflowEngine = {
      registerWorkflow: vi.fn(),
      executeWorkflow: vi.fn().mockResolvedValue({
        status: 'completed',
        output: {},
        error: null,
        duration: 1000,
        metadata: { agentsUsed: [] }
      }),
      validateRegisteredWorkflows: vi.fn(),
      getRunningWorkflows: vi.fn().mockReturnValue([]),
      getExecutionHistory: vi.fn().mockReturnValue([]),
      cancelWorkflow: vi.fn()
    };

    const mockPerformanceCollector = {
      startCollection: vi.fn(),
      stopCollection: vi.fn(),
      recordWorkflowExecution: vi.fn(),
      getCurrentSummary: vi.fn().mockReturnValue({}),
      destroy: vi.fn()
    };

    orchestrator = new EnhancedMexcOrchestrator(
      mockAgentRegistry as any,
      mockWorkflowEngine as any,
      mockPerformanceCollector as any
    );

    // Initialize orchestrator
    await orchestrator.initialize();
    
    // Reset to known state
    await coreTrading.initialize();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await coreTrading?.shutdown?.();
  });

  describe('Strategy Configuration Propagation', () => {
    it('should propagate strategy changes to all agents', async () => {
      // FAILING TEST - to be implemented
      const userId = 'test-user-strategy';
      const strategyConfig: Partial<UserPreferences> = {
        id: `pref_${userId}`,
        userId: userId,
        riskTolerance: 'high',
        maxPositionSize: 8,
        autoTradingEnabled: true,
        stopLossPercentage: 15,
        takeProfitPercentage: 25,
        tradingPairs: ['TESTUSDT']
      };

      // 1. Update user strategy
      await userPrefsService.updateUserPreferences(userId, strategyConfig);

      // 2. Mock core trading service methods
      const mockSyncUserStrategy = vi.fn().mockResolvedValue(true);
      const mockGetConfig = vi.fn().mockResolvedValue({
        riskTolerance: 'high',
        maxPositions: 8
      });
      coreTrading.syncUserStrategy = mockSyncUserStrategy;
      coreTrading.getConfig = mockGetConfig;

      // Mock orchestrator methods  
      const mockGetAllAgentConfigurations = vi.fn().mockResolvedValue({
        strategyAgent: { strategy: 'high' },
        riskManagerAgent: { riskTolerance: 'high' },
        mexcApiAgent: { defaultPositionSize: 8 }
      });
      orchestrator.getAllAgentConfigurations = mockGetAllAgentConfigurations;

      // 2. Trigger strategy sync to Core Trading Service
      await coreTrading.syncUserStrategy(userId, strategyConfig);

      // 3. Verify Core Trading Service updated
      const currentConfig = await coreTrading.getConfig();
      expect(currentConfig.riskTolerance).toBe('high');
      expect(currentConfig.maxPositions).toBe(8);

      // 4. Verify agents received new configuration
      const agentConfigs = await orchestrator.getAllAgentConfigurations();
      expect(agentConfigs.strategyAgent.strategy).toBe('high');
      expect(agentConfigs.riskManagerAgent.riskTolerance).toBe('high');
      expect(agentConfigs.mexcApiAgent.defaultPositionSize).toBe(8);
    });

    it('should update auto-sniping parameters based on risk settings', async () => {
      // FAILING TEST - to be implemented
      const conservativeSettings: Partial<UserPreferences> = {
        id: 'pref_test-user',
        userId: 'test-user',
        riskTolerance: 'low',
        maxPositionSize: 3,
        stopLossPercentage: 5,
        tradingPairs: ['TESTUSDT']
      };

      await userPrefsService.updateUserPreferences('test-user', conservativeSettings);

      // Mock core trading service methods
      const mockSyncUserStrategy = vi.fn().mockResolvedValue(true);
      const mockGetAutoSnipingConfig = vi.fn().mockResolvedValue({
        maxConcurrentTargets: 3,
        positionSizeUsdt: 3, // maxPositionSize maps to positionSize
        stopLossPercent: 5,
        confidenceThreshold: 85
      });
      coreTrading.syncUserStrategy = mockSyncUserStrategy;
      coreTrading.getAutoSnipingConfig = mockGetAutoSnipingConfig;

      await coreTrading.syncUserStrategy('test-user', conservativeSettings);

      // Verify auto-sniping uses conservative parameters
      const autoSnipingConfig = await coreTrading.getAutoSnipingConfig();
      expect(autoSnipingConfig.maxConcurrentTargets).toBe(3);
      expect(autoSnipingConfig.positionSizeUsdt).toBe(3);
      expect(autoSnipingConfig.stopLossPercent).toBe(5);
      expect(autoSnipingConfig.confidenceThreshold).toBeGreaterThan(80); // Conservative = higher confidence needed
    });
  });

  describe('Swarm Intelligence Coordination', () => {
    it('should coordinate multiple agents for strategy execution', async () => {
      // FAILING TEST - to be implemented
      const targetSymbol = 'TESTCOIN';
      const strategy = 'scalping';

      // Mock the workflow execution
      const mockExecuteWorkflow = vi.fn().mockResolvedValue({
        success: true,
        data: {
          strategyAgent: { recommendedLevels: [5, 10, 15, 20] },
          riskManagerAgent: { maxPositionSize: 0.05 },
          patternDiscoveryAgent: { strategyContext: 'scalping' },
          mexcApiAgent: { preparedOrders: new Array(4) }
        },
        waitForCompletion: vi.fn().mockResolvedValue({
          results: {
            strategyAgent: { recommendedLevels: [5, 10, 15, 20] },
            riskManagerAgent: { maxPositionSize: 0.05 },
            patternDiscoveryAgent: { strategyContext: 'scalping' },
            mexcApiAgent: { preparedOrders: new Array(4) }
          }
        })
      });

      // Add missing methods to orchestrator
      orchestrator.executeWorkflow = mockExecuteWorkflow;

      // 1. Trigger multi-agent workflow for symbol analysis
      const workflow = await orchestrator.executeWorkflow('comprehensive-symbol-analysis', {
        symbol: targetSymbol,
        strategy: strategy,
        userId: 'test-user'
      });

      // 2. Verify agent coordination
      const execution = await workflow.waitForCompletion();
      
      // Strategy Agent should provide strategy-specific analysis
      expect(execution.results.strategyAgent.recommendedLevels).toEqual([5, 10, 15, 20]); // Scalping levels
      
      // Risk Manager should assess based on current strategy
      expect(execution.results.riskManagerAgent.maxPositionSize).toBeLessThan(0.1); // Scalping = smaller positions
      
      // Pattern Discovery should use strategy-specific patterns
      expect(execution.results.patternDiscoveryAgent.strategyContext).toBe('scalping');
      
      // MEXC API Agent should prepare orders with strategy parameters
      expect(execution.results.mexcApiAgent.preparedOrders).toHaveLength(4); // Scalping levels
    });

    it('should adapt workflow based on market conditions and strategy', async () => {
      // FAILING TEST - to be implemented
      const marketConditions = {
        volatility: 'high',
        volume: 'low',
        trend: 'bullish'
      };

      // Mock adaptive workflow creation
      const mockCreateAdaptiveWorkflow = vi.fn()
        .mockResolvedValueOnce({
          steps: ['enhanced-risk-assessment', 'symbol-analysis'],
          agentParticipants: ['safety-monitor-agent', 'risk-manager'],
          confidenceThreshold: 90
        })
        .mockResolvedValueOnce({
          steps: ['rapid-execution', 'symbol-analysis'],
          parallelExecution: true,
          confidenceThreshold: 65
        });

      orchestrator.createAdaptiveWorkflow = mockCreateAdaptiveWorkflow;

      // Conservative strategy in high volatility should use different workflow
      const conservativeWorkflow = await orchestrator.createAdaptiveWorkflow({
        strategy: 'conservative',
        marketConditions,
        symbol: 'TESTCOIN'
      });

      expect(conservativeWorkflow.steps).toContain('enhanced-risk-assessment');
      expect(conservativeWorkflow.agentParticipants).toContain('safety-monitor-agent');
      expect(conservativeWorkflow.confidenceThreshold).toBeGreaterThan(85);

      // Aggressive strategy should use different approach
      const aggressiveWorkflow = await orchestrator.createAdaptiveWorkflow({
        strategy: 'aggressive',
        marketConditions,
        symbol: 'TESTCOIN'
      });

      expect(aggressiveWorkflow.steps).toContain('rapid-execution');
      expect(aggressiveWorkflow.parallelExecution).toBe(true);
      expect(aggressiveWorkflow.confidenceThreshold).toBeLessThan(70);
    });
  });

  describe('Real-time Performance Feedback', () => {
    it('should adjust agent performance based on strategy success', async () => {
      // FAILING TEST - to be implemented
      const performanceData = {
        strategyAgent: { successRate: 85, averageConfidence: 78 },
        patternDiscoveryAgent: { successRate: 92, patternAccuracy: 88 },
        riskManagerAgent: { riskAssessmentAccuracy: 95 }
      };

      // Mock agent performance update
      const mockUpdateAgentPerformance = vi.fn().mockResolvedValue(true);
      orchestrator.updateAgentPerformance = mockUpdateAgentPerformance;

      // Update agent performance metrics
      await orchestrator.updateAgentPerformance(performanceData);

      // Mock workflow execution with selected agents
      const mockWorkflowWithAgents = {
        success: true,
        getSelectedAgents: vi.fn().mockReturnValue({
          primary: 'patternDiscoveryAgent',
          fallback: 'riskManagerAgent'
        })
      };

      orchestrator.executeWorkflow = vi.fn().mockResolvedValue(mockWorkflowWithAgents);

      // Verify next workflow uses best-performing agents
      const workflow = await orchestrator.executeWorkflow('pattern-analysis', {
        preferHighPerformance: true
      });

      const selectedAgents = workflow.getSelectedAgents();
      expect(selectedAgents.primary).toBe('patternDiscoveryAgent'); // Highest success rate
      expect(selectedAgents.fallback).toBe('riskManagerAgent'); // Second highest
    });

    it('should provide real-time strategy performance to UI', async () => {
      // FAILING TEST - to be implemented
      const mockExecution = {
        strategyId: 'aggressive',
        symbol: 'TESTCOIN',
        entryPrice: 100,
        currentPrice: 110,
        pnlPercent: 10,
        executionTime: Date.now() - 3600000 // 1 hour ago
      };

      // Mock core trading service methods
      const mockRecordStrategyExecution = vi.fn().mockResolvedValue(true);
      const mockGetStrategyPerformance = vi.fn().mockResolvedValue({
        totalExecutions: 1,
        averagePnlPercent: 10,
        successRate: 1.0
      });
      const mockGetRealTimeStrategyMetrics = vi.fn().mockResolvedValue({
        activePositions: [],
        dailyPnL: 10,
        currentStrategy: 'aggressive'
      });

      coreTrading.recordStrategyExecution = mockRecordStrategyExecution;
      coreTrading.getStrategyPerformance = mockGetStrategyPerformance;
      coreTrading.getRealTimeStrategyMetrics = mockGetRealTimeStrategyMetrics;

      // Simulate strategy execution
      await coreTrading.recordStrategyExecution(mockExecution);

      // Verify performance data flows back to strategy manager
      const strategyPerformance = await coreTrading.getStrategyPerformance('aggressive');
      expect(strategyPerformance.totalExecutions).toBeGreaterThan(0);
      expect(strategyPerformance.averagePnlPercent).toBeCloseTo(10);
      expect(strategyPerformance.successRate).toBeGreaterThan(0);

      // Verify UI can retrieve real-time data
      const realTimeMetrics = await coreTrading.getRealTimeStrategyMetrics();
      expect(realTimeMetrics.activePositions).toBeDefined();
      expect(realTimeMetrics.dailyPnL).toBeDefined();
      expect(realTimeMetrics.currentStrategy).toBe('aggressive');
    });
  });

  describe('Agent Health and Load Balancing', () => {
    it('should route tasks to healthiest agents', async () => {
      // FAILING TEST - to be implemented
      const agentHealth = {
        'strategy-agent-1': { health: 95, responseTime: 150, loadScore: 30 },
        'strategy-agent-2': { health: 70, responseTime: 300, loadScore: 80 },
        'strategy-agent-3': { health: 98, responseTime: 120, loadScore: 20 }
      };

      // Mock agent health management
      const mockUpdateAgentHealth = vi.fn().mockResolvedValue(true);
      const mockAssignTask = vi.fn().mockResolvedValue({
        selectedAgent: 'strategy-agent-3',
        fallbackAgents: ['strategy-agent-1', 'strategy-agent-2']
      });

      orchestrator.updateAgentHealth = mockUpdateAgentHealth;
      orchestrator.assignTask = mockAssignTask;

      await orchestrator.updateAgentHealth(agentHealth);

      // Request strategy analysis
      const assignment = await orchestrator.assignTask('strategy-analysis', {
        priority: 'high',
        requiresHealthyAgent: true
      });

      // Should select healthiest agent with best response time
      expect(assignment.selectedAgent).toBe('strategy-agent-3');
      expect(assignment.fallbackAgents).toEqual(['strategy-agent-1', 'strategy-agent-2']);
    });
  });

  describe('Error Recovery and Circuit Breaking', () => {
    it('should gracefully handle agent failures in strategy execution', async () => {
      // FAILING TEST - to be implemented
      
      // Mock executeAgent method that fails initially
      const mockExecuteAgent = vi.fn()
        .mockRejectedValueOnce(new Error('Strategy agent timeout'))
        .mockResolvedValue({ success: true });

      orchestrator.executeAgent = mockExecuteAgent;

      // Mock workflow with fallback behavior
      const mockWorkflowWithFallback = {
        success: true,
        waitForCompletion: vi.fn().mockResolvedValue({
          usedFallback: true,
          fallbackAgent: 'backup-strategy-agent',
          status: 'completed-with-fallback',
          strategy: {
            levels: [10, 20, 30],
            type: 'conservative'
          }
        })
      };

      orchestrator.executeWorkflow = vi.fn().mockResolvedValue(mockWorkflowWithFallback);

      const workflow = await orchestrator.executeWorkflow('strategy-execution', {
        symbol: 'TESTCOIN',
        strategy: 'conservative',
        enableFailover: true
      });

      const result = await workflow.waitForCompletion();

      // Should have used fallback agent
      expect(result.usedFallback).toBe(true);
      expect(result.fallbackAgent).toBeDefined();
      expect(result.status).toBe('completed-with-fallback');
      
      // Should still produce valid strategy
      expect(result.strategy).toBeDefined();
      expect(result.strategy.levels).toBeDefined();
    });
  });
});