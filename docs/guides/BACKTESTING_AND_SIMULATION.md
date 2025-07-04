# Backtesting & Simulation Guide

This guide explains how to validate trading strategies in a safe environment using the built‑in backtesting and simulation tools.

## Backtesting

Backtesting evaluates a strategy against historical data. The `ParameterOptimizationEngine` and `StrategyManager` expose methods that run a simplified backtest and return performance metrics.

Example usage in code:

```typescript
import { ParameterOptimizationEngine } from '@/services/trading/parameter-optimization-engine';

const engine = new ParameterOptimizationEngine();
const optimizationId = await engine.startOptimization({
  parameterCategories: ['trading'],
  objectives: [
    { name: 'Sharpe Ratio', weight: 1, direction: 'maximize', metric: p => p.sharpeRatio }
  ],
  strategy: {
    algorithm: 'simple',
    maxIterations: 50,
    convergenceThreshold: 0.001,
    parallelEvaluations: 2,
    explorationRate: 0.2
  },
  safetyConstraints: {
    maxRiskLevel: 0.2,
    minSharpeRatio: 1.0,
    maxDrawdown: 0.1,
    requireHumanApproval: false
  },
  backtestingPeriod: {
    start: new Date(Date.now() - 30 * 864e5),
    end: new Date()
  }
});

const status = engine.getOptimizationStatus(optimizationId);
```

`status` includes fields like `totalReturn`, `winRate` and `sharpeRatio` which help assess strategy quality.

## Simulation Sessions

The `SimulationAgent` creates a virtual trading environment for paper trading.

```typescript
import { agentManager } from '@/mexc-agents/coordination';

const simulationAgent = agentManager.getSimulationAgent();
const session = await simulationAgent.startSimulationSession('user123', 1000);

// execute simulated trades here
await simulationAgent.simulateTrade('BTCUSDT', 'buy', 0.1, 65000, 'balanced');

const results = await simulationAgent.endSimulationSession();
```

Simulation mode can also be toggled via the `simulation/toggle` Inngest event or by calling `simulationAgent.toggleSimulation(true)`.

## Health Checks

Call `/api/tuning/system-health` to verify the `backtesting` and `simulation` services are online. The endpoint returns status information used by the dashboard.
