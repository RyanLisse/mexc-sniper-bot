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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCoreTrading } from '@/src/services/trading/consolidated/core-trading/base-service';
import { EnhancedOrchestrator } from '@/src/mexc-agents/coordination/enhanced-orchestrator';
import { UserPreferencesService } from '@/src/services/user/user-preferences-service';
import type { UserPreferences } from '@/src/schemas/user-preferences-schema';

describe('Strategy-Agent Integration (TDD)', () => {
  let coreTrading: any;
  let orchestrator: EnhancedOrchestrator;
  let userPrefsService: UserPreferencesService;

  beforeEach(async () => {
    // Initialize services
    coreTrading = getCoreTrading();
    orchestrator = EnhancedOrchestrator.getInstance();
    userPrefsService = new UserPreferencesService();
    
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
      const strategyConfig: UserPreferences = {
        tradingStrategy: 'aggressive',
        riskTolerance: 'high',
        autoSnipe: true,
        autoSell: true,
        maxPositions: 8,
        defaultBuyAmountUsdt: 200,
        stopLossPercent: 15,
        takeProfitStrategy: 'aggressive'
      };

      // 1. Update user strategy
      await userPrefsService.updatePreferences(userId, strategyConfig);

      // 2. Trigger strategy sync to Core Trading Service
      await coreTrading.syncUserStrategy(userId, strategyConfig);

      // 3. Verify Core Trading Service updated
      const currentConfig = await coreTrading.getConfig();
      expect(currentConfig.tradingStrategy).toBe('aggressive');
      expect(currentConfig.maxPositions).toBe(8);

      // 4. Verify agents received new configuration
      const agentConfigs = await orchestrator.getAllAgentConfigurations();
      expect(agentConfigs.strategyAgent.strategy).toBe('aggressive');
      expect(agentConfigs.riskManagerAgent.riskTolerance).toBe('high');
      expect(agentConfigs.mexcApiAgent.defaultPositionSize).toBe(200);
    });

    it('should update auto-sniping parameters based on risk settings', async () => {
      // FAILING TEST - to be implemented
      const conservativeSettings: UserPreferences = {
        tradingStrategy: 'conservative',
        riskTolerance: 'low',
        maxPositions: 3,
        stopLossPercent: 5,
        defaultBuyAmountUsdt: 50
      };

      await userPrefsService.updatePreferences('test-user', conservativeSettings);
      await coreTrading.syncUserStrategy('test-user', conservativeSettings);

      // Verify auto-sniping uses conservative parameters
      const autoSnipingConfig = await coreTrading.getAutoSnipingConfig();
      expect(autoSnipingConfig.maxConcurrentTargets).toBe(3);
      expect(autoSnipingConfig.positionSizeUsdt).toBe(50);
      expect(autoSnipingConfig.stopLossPercent).toBe(5);
      expect(autoSnipingConfig.confidenceThreshold).toBeGreaterThan(80); // Conservative = higher confidence needed
    });
  });

  describe('Swarm Intelligence Coordination', () => {
    it('should coordinate multiple agents for strategy execution', async () => {
      // FAILING TEST - to be implemented
      const targetSymbol = 'TESTCOIN';
      const strategy = 'scalping';

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

      // Conservative strategy in high volatility should use different workflow
      const conservativeWorkflow = await orchestrator.createAdaptiveWorkflow({
        strategy: 'conservative',
        marketConditions,
        symbol: 'TESTCOIN'
      });

      expect(conservativeWorkflow.steps).toInclude('enhanced-risk-assessment');
      expect(conservativeWorkflow.agentParticipants).toInclude('safety-monitor-agent');
      expect(conservativeWorkflow.confidenceThreshold).toBeGreaterThan(85);

      // Aggressive strategy should use different approach
      const aggressiveWorkflow = await orchestrator.createAdaptiveWorkflow({
        strategy: 'aggressive',
        marketConditions,
        symbol: 'TESTCOIN'
      });

      expect(aggressiveWorkflow.steps).toInclude('rapid-execution');
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

      // Update agent performance metrics
      await orchestrator.updateAgentPerformance(performanceData);

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
      // Simulate strategy agent failure
      vi.spyOn(orchestrator, 'executeAgent')
        .mockImplementationOnce(() => Promise.reject(new Error('Strategy agent timeout')));

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