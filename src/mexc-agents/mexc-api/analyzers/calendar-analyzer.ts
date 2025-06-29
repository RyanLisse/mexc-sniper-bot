/**
 * Calendar Data Analyzer
 * 
 * Handles analysis of MEXC calendar data and launch schedules
 */

import type { AgentResponse } from "../../base-agent";
import type { MexcCalendarEntry } from "../types";

export class CalendarAnalyzer {
  /**
   * Analyze calendar data array
   */
  async analyzeCalendarData(
    calendarData: MexcCalendarEntry[],
    callOpenAI: (messages: Array<{ role: string; content: string }>) => Promise<AgentResponse>
  ): Promise<AgentResponse> {
    const dataJson = JSON.stringify(calendarData, null, 2);

    const userMessage = `
MEXC Calendar Data Analysis:

${dataJson}

Please analyze this MEXC calendar data and provide insights on:

1. **Launch Schedule Analysis**
   - Upcoming token launches and timing
   - Project quality and viability assessment
   - Market readiness indicators

2. **Trading Opportunities**
   - High-potential launch candidates
   - Optimal entry timing strategies
   - Risk assessment for each project

3. **Market Conditions**
   - Launch density and market saturation
   - Competition analysis
   - Timing conflicts and opportunities

4. **Risk Factors**
   - Project reliability indicators
   - Market volatility concerns
   - Regulatory or technical risks

5. **Recommendations**
   - Priority projects for monitoring
   - Preparation strategies
   - Alert scheduling recommendations

Focus on actionable insights for trading preparation and opportunity identification.
`;

    return await callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  /**
   * Find upcoming launches within specified timeframe
   */
  getUpcomingLaunches(calendarData: MexcCalendarEntry[], hoursAhead: number = 24): MexcCalendarEntry[] {
    const now = new Date();
    const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    return calendarData.filter(entry => {
      const launchTime = new Date(entry.launchTime);
      return launchTime > now && launchTime <= cutoff;
    });
  }

  /**
   * Calculate launch readiness score
   */
  calculateLaunchReadiness(entry: MexcCalendarEntry): number {
    let score = 0;
    const now = new Date();
    const launchTime = new Date(entry.launchTime);
    const timeUntilLaunch = launchTime.getTime() - now.getTime();
    const hoursUntilLaunch = timeUntilLaunch / (1000 * 60 * 60);

    // Score based on time until launch
    if (hoursUntilLaunch > 0 && hoursUntilLaunch <= 1) score += 40; // Very close
    else if (hoursUntilLaunch <= 4) score += 30; // Close
    else if (hoursUntilLaunch <= 24) score += 20; // Today
    else score += 10; // Future

    // Score based on data completeness
    if (entry.vcoinId) score += 20;
    if (entry.projectName) score += 20;
    if (entry.tradingPairs.length > 0) score += 20;

    return Math.min(score, 100);
  }

  /**
   * Prioritize calendar entries by trading potential
   */
  prioritizeEntries(calendarData: MexcCalendarEntry[]): MexcCalendarEntry[] {
    return [...calendarData].sort((a, b) => {
      const scoreA = this.calculateLaunchReadiness(a);
      const scoreB = this.calculateLaunchReadiness(b);
      return scoreB - scoreA;
    });
  }
}