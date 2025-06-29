/**
 * Symbol Data Analyzer
 * 
 * Handles analysis of MEXC symbol data and trading signals
 */

import type { AgentResponse } from "../../base-agent";
import type { MexcSymbolData } from "../types";

export class SymbolAnalyzer {
  /**
   * Analyze symbol data array
   */
  async analyzeSymbolData(
    symbolData: MexcSymbolData[],
    callOpenAI: (messages: Array<{ role: string; content: string }>) => Promise<AgentResponse>
  ): Promise<AgentResponse> {
    const dataJson = JSON.stringify(symbolData, null, 2);

    return await callOpenAI([
      {
        role: "user",
        content: `Analyze MEXC symbol data: ${dataJson}`,
      },
    ]);
  }

  /**
   * Identify trading signals from market data
   */
  async identifyTradingSignals(
    marketData: MexcSymbolData,
    callOpenAI: (messages: Array<{ role: string; content: string }>) => Promise<AgentResponse>
  ): Promise<AgentResponse> {
    const dataJson = JSON.stringify(marketData, null, 2);

    const userMessage = `
MEXC Trading Signal Analysis:

Market Data:
${dataJson}

Please analyze this MEXC market data and identify trading signals:

1. **Ready State Detection**
   - Check for sts:2, st:2, tt:4 pattern
   - Validate trading readiness indicators
   - Assess timing for optimal entry

2. **Market Momentum**
   - Volume trends and price movements
   - Trading activity patterns
   - Market depth and liquidity signals

3. **Entry Opportunities**
   - Optimal entry timing and price levels
   - Risk/reward assessment
   - Position sizing recommendations

4. **Risk Indicators**
   - Market volatility signals
   - Liquidity concerns
   - Technical warning signs

5. **Action Plan**
   - Immediate actions required
   - Monitoring schedule
   - Exit criteria and stop-loss levels

Focus on actionable trading signals with specific entry/exit criteria and risk management parameters.
`;

    return await callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  /**
   * Check if symbol is ready for trading based on pattern
   */
  isSymbolReadyForTrading(symbolData: MexcSymbolData): boolean {
    // Check for ready state pattern: sts:2, st:2, tt:4
    return symbolData.isTrading && symbolData.hasCompleteData;
  }

  /**
   * Extract trading confidence score
   */
  calculateTradingConfidence(symbolData: MexcSymbolData): number {
    let confidence = 0;

    if (symbolData.hasCompleteData) confidence += 30;
    if (symbolData.isTrading) confidence += 40;
    if (symbolData.price && symbolData.price > 0) confidence += 15;
    if (symbolData.volume && symbolData.volume > 0) confidence += 15;

    return Math.min(confidence, 100);
  }
}