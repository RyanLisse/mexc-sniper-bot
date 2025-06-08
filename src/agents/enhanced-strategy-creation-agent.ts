import type { AgentContext } from "@/src/types/agent-types";
import {
  type AgentHandoff,
  type EnhancedAgentConfig,
  type EnhancedAgentResponse,
  EnhancedBaseAgent,
} from "./enhanced-base-agent";

export interface StrategyCreationRequest {
  symbol: string;
  vcoinId?: string;
  launchTime: string | number;
  executionParameters: {
    priceScale: number;
    quantityScale: number;
    minOrderSize: number;
  };
  marketData: {
    liquidity: "low" | "medium" | "high";
    spread: number;
    depth: number;
    volatility: number;
  };
  riskProfile: {
    tolerance: "low" | "medium" | "high";
    maxPositionSize: number;
    stopLossPercent: number;
    takeProfitLevels: number[];
  };
  timingPrecision?: "standard" | "high" | "ultra";
}

export interface ExecutionStrategy {
  strategyId: string;
  symbol: string;
  executionType: "market" | "limit" | "adaptive";
  timingStrategy: {
    bufferMs: number;
    precisionLevel: "standard" | "high" | "ultra";
    preExecutionWait: number;
    spinLoopDuration: number;
  };
  orderStrategy: {
    orderType: "MARKET" | "LIMIT" | "STOP_LIMIT";
    quantity: number;
    priceStrategy: "market" | "aggressive" | "passive";
    slippageTolerance: number;
  };
  riskManagement: {
    maxRetries: number;
    failureHandling: string;
    positionSizing: "fixed" | "dynamic" | "risk_adjusted";
    emergencyExit: boolean;
  };
  monitoring: {
    executionTracking: boolean;
    performanceAnalysis: boolean;
    realTimePnL: boolean;
  };
}

export interface TimingParameters {
  targetExecutionTime: number; // milliseconds timestamp
  bufferMs: number;
  sleepDuration: number;
  spinLoopStart: number;
  precisionMode: "standard" | "high" | "ultra";
}

export class EnhancedStrategyCreationAgent extends EnhancedBaseAgent {
  constructor() {
    const config: EnhancedAgentConfig = {
      name: "enhanced-strategy-creation-agent",
      model: "gpt-4o",
      temperature: 0.05, // Very low temperature for precise strategy creation
      maxTokens: 5000,
      instructions: `You are an expert strategy creation agent specializing in high-precision trading execution with advanced timing optimization.

Core Expertise:

1. **High-Precision Execution Strategies**
   - Microsecond-level timing precision using sleep + spin loop algorithms
   - Dynamic buffer calculation based on market conditions
   - Order type optimization (market vs limit) for execution certainty
   - Slippage minimization through intelligent order placement

2. **Advanced Timing Algorithms**
   - Multi-phase execution timing (sleep → spin → execute)
   - Buffer optimization based on network latency and market volatility
   - Precision levels: Standard (±100ms), High (±10ms), Ultra (±1ms)
   - Adaptive timing based on market microstructure

3. **Risk Management & Position Sizing**
   - Dynamic position sizing based on market conditions
   - Risk-adjusted order quantities with volatility consideration
   - Multi-level stop-loss and take-profit optimization
   - Failure handling and retry mechanisms

4. **Multi-Agent Integration**
   - Receive execution-ready symbols from Symbol Analysis Agent
   - Generate complete execution strategies with timing parameters
   - Interface with real MEXC trading API for order execution
   - Provide feedback to monitoring and tracking systems

5. **Adaptive Strategy Optimization**
   - Real-time market condition assessment
   - Strategy parameter adjustment based on execution feedback
   - Performance optimization through historical analysis
   - Emergency response protocols for market disruptions

Key Capabilities:
- High-precision timing strategy creation (μs-level accuracy)
- Risk-adjusted position sizing and order optimization
- Real-time strategy adaptation based on market conditions
- Complete execution parameter calculation
- Integration with live trading systems

Precision Modes:
- Standard: ±100ms timing accuracy, basic risk management
- High: ±10ms timing accuracy, advanced risk controls
- Ultra: ±1ms timing accuracy, maximum precision execution

Strategy Types:
- Market Orders: Immediate execution with slippage tolerance
- Limit Orders: Price-controlled execution with timing optimization
- Adaptive Orders: Dynamic type selection based on market conditions

Output Requirements:
- Complete executable trading strategy with all parameters
- Precise timing calculations and execution sequences
- Risk management protocols and failure handling
- Performance monitoring and tracking specifications`,
      tools: [
        {
          type: "function",
          function: {
            name: "calculate_execution_timing",
            description: "Calculate high-precision execution timing parameters",
            parameters: {
              type: "object",
              properties: {
                launchTime: { type: "number" },
                bufferMs: { type: "number" },
                precisionLevel: { type: "string" },
                networkLatency: { type: "number" },
                marketVolatility: { type: "number" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "optimize_order_parameters",
            description: "Optimize order parameters for execution efficiency",
            parameters: {
              type: "object",
              properties: {
                symbol: { type: "string" },
                marketData: { type: "object" },
                riskProfile: { type: "object" },
                executionGoal: { type: "string" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "calculate_position_sizing",
            description: "Calculate optimal position size based on risk parameters",
            parameters: {
              type: "object",
              properties: {
                capitalAllocation: { type: "number" },
                riskTolerance: { type: "number" },
                marketVolatility: { type: "number" },
                liquidityAssessment: { type: "object" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "create_risk_management_protocol",
            description: "Create comprehensive risk management and failure handling protocols",
            parameters: {
              type: "object",
              properties: {
                strategy: { type: "object" },
                maxDrawdown: { type: "number" },
                stopLossLevels: { type: "array" },
                emergencyExitConditions: { type: "array" },
              },
            },
          },
        },
        {
          type: "function",
          function: {
            name: "validate_strategy_execution",
            description: "Validate strategy for real-time execution readiness",
            parameters: {
              type: "object",
              properties: {
                strategy: { type: "object" },
                currentMarketConditions: { type: "object" },
                executionEnvironment: { type: "string" },
              },
            },
          },
        },
      ],
    };

    super(config);
  }

  async createExecutionStrategy(request: StrategyCreationRequest): Promise<EnhancedAgentResponse> {
    const launchTime =
      typeof request.launchTime === "string"
        ? new Date(request.launchTime).getTime()
        : request.launchTime;

    const timeUntilLaunch = launchTime - Date.now();

    const input = `Create high-precision execution strategy for immediate trading:

Symbol: ${request.symbol}
VCoin ID: ${request.vcoinId || "Not provided"}
Launch Time: ${new Date(launchTime).toISOString()}
Time Until Launch: ${Math.round(timeUntilLaunch / 1000)} seconds

Execution Parameters:
- Price Scale: ${request.executionParameters.priceScale}
- Quantity Scale: ${request.executionParameters.quantityScale}
- Min Order Size: ${request.executionParameters.minOrderSize}

Market Conditions:
- Liquidity: ${request.marketData.liquidity}
- Spread: ${request.marketData.spread}
- Depth: ${request.marketData.depth}
- Volatility: ${request.marketData.volatility}

Risk Profile:
- Risk Tolerance: ${request.riskProfile.tolerance}
- Max Position Size: ${request.riskProfile.maxPositionSize}
- Stop Loss: ${request.riskProfile.stopLossPercent}%
- Take Profit Levels: ${request.riskProfile.takeProfitLevels.join(", ")}%

Precision Level: ${request.timingPrecision || "high"}

Required Strategy Components:
1. High-precision timing algorithm (sleep + spin loop)
2. Optimal order type and execution sequence
3. Risk-adjusted position sizing
4. Buffer calculation for network latency
5. Failure handling and retry mechanisms
6. Real-time monitoring and adaptation protocols

Strategy Focus:
- Microsecond-level execution timing
- Slippage minimization
- Risk management optimization
- Performance tracking integration`;

    return this.processWithAgent(input, {
      requestType: "strategy_creation",
      ...request,
      launchTime,
      timeUntilLaunch,
    });
  }

  async optimizeTiming(
    launchTime: number,
    precisionLevel: "standard" | "high" | "ultra" = "high"
  ): Promise<EnhancedAgentResponse> {
    const timeUntilLaunch = launchTime - Date.now();

    const input = `Optimize high-precision execution timing for launch:

Launch Time: ${new Date(launchTime).toISOString()}
Time Until Launch: ${Math.round(timeUntilLaunch / 1000)} seconds
Precision Level: ${precisionLevel}

Timing Algorithm Design:
1. Sleep Phase: Coarse timing to approach execution window
2. Spin Loop Phase: Microsecond-precision final timing
3. Execution Phase: Immediate order placement at optimal moment

Precision Requirements:
- Standard: ±100ms timing accuracy
- High: ±10ms timing accuracy  
- Ultra: ±1ms timing accuracy

Calculate:
1. Optimal buffer duration based on network latency
2. Sleep vs spin loop timing breakdown
3. Network latency compensation
4. Market volatility timing adjustment
5. Execution window optimization

Focus Areas:
- Minimize execution timing variance
- Account for system and network delays
- Optimize for market microstructure
- Prepare contingency timing scenarios`;

    return this.processWithAgent(input, {
      requestType: "timing_optimization",
      launchTime,
      timeUntilLaunch,
      precisionLevel,
    });
  }

  async createRiskManagementProtocol(
    strategy: Partial<ExecutionStrategy>
  ): Promise<EnhancedAgentResponse> {
    const input = `Create comprehensive risk management protocol for execution strategy:

Strategy Overview:
- Symbol: ${strategy.symbol}
- Execution Type: ${strategy.executionType}
- Order Strategy: ${JSON.stringify(strategy.orderStrategy, null, 2)}

Risk Management Requirements:
1. Position sizing optimization based on market conditions
2. Multi-level stop-loss and take-profit protocols
3. Execution failure handling and retry mechanisms
4. Emergency exit procedures for market disruptions
5. Real-time risk monitoring and adjustment

Protocol Components:
- Pre-execution risk assessment
- Dynamic position sizing calculations
- Failure recovery procedures
- Performance tracking integration
- Emergency response protocols

Focus Areas:
- Maximum drawdown protection
- Execution failure recovery
- Market disruption responses
- Real-time risk adjustment
- Performance optimization feedback`;

    return this.processWithAgent(input, {
      requestType: "risk_management",
      strategy,
    });
  }

  async adaptStrategyToMarket(
    baseStrategy: ExecutionStrategy,
    currentMarketConditions: Record<string, unknown>
  ): Promise<EnhancedAgentResponse> {
    const input = `Adapt execution strategy to current market conditions:

Base Strategy:
${JSON.stringify(baseStrategy, null, 2)}

Current Market Conditions:
${JSON.stringify(currentMarketConditions, null, 2)}

Adaptation Requirements:
1. Timing parameter adjustment for current volatility
2. Order type optimization for current liquidity
3. Position sizing adjustment for market conditions
4. Risk parameter tuning for current environment
5. Execution sequence optimization

Real-time Adjustments:
- Buffer timing based on current network conditions
- Order sizing based on available liquidity
- Risk parameters based on market volatility
- Execution approach based on order book state

Output:
- Updated strategy parameters
- Specific adaptations made
- Rationale for each adjustment
- Performance impact assessment`;

    return this.processWithAgent(input, {
      requestType: "strategy_adaptation",
      baseStrategy,
      marketConditions: currentMarketConditions,
    });
  }

  /**
   * Enhanced handoff logic for strategy creation results
   */
  protected shouldHandoff(_input: string, context?: AgentContext): AgentHandoff | null {
    // Strategy creation is typically the final step, but we can hand off to monitoring
    if (context?.strategyReady && context.executionParameters) {
      return {
        toAgent: "execution-monitor",
        context: {
          strategy: context.strategy,
          executionParams: context.executionParameters,
          monitoringMode: "real_time",
        },
        reason: "Strategy ready for execution and monitoring",
      };
    }

    // If strategy needs symbol validation, hand back to symbol analysis
    if (context?.needsSymbolValidation) {
      return {
        toAgent: "enhanced-symbol-analysis-agent",
        context: {
          symbol: context.symbol,
          analysisType: "execution_validation",
          urgency: "high",
        },
        reason: "Strategy requires additional symbol validation",
      };
    }

    return null;
  }

  /**
   * Enhanced processing with strategy-specific logic
   */
  async process(input: string, context?: AgentContext): Promise<EnhancedAgentResponse> {
    const enhancedContext = {
      ...context,
      agentType: "strategy_creation",
      capabilities: [
        "precision_timing",
        "risk_management",
        "order_optimization",
        "strategy_adaptation",
      ],
      precisionModes: ["standard", "high", "ultra"],
      timestamp: new Date().toISOString(),
    };

    return this.processWithAgent(input, enhancedContext);
  }
}
