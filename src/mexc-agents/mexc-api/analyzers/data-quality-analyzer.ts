/**
 * Data Quality Analyzer
 *
 * Handles assessment of API response data quality and reliability
 */

import type { ServiceResponse } from "@/src/services/api/mexc-unified-exports";
import type { AgentResponse } from "../../base-agent";
import type { MexcApiResponseData } from "../types";

export class DataQualityAnalyzer {
  /**
   * Assess API response data quality
   */
  async assessDataQuality(
    apiResponse: MexcApiResponseData,
    callOpenAI: (
      messages: Array<{ role: string; content: string }>
    ) => Promise<AgentResponse>
  ): Promise<AgentResponse> {
    const responseJson = JSON.stringify(apiResponse, null, 2);

    const userMessage = `
MEXC API Data Quality Assessment:

API Response Data:
${responseJson}

Please assess the data quality and provide analysis on:

1. **Data Completeness**
   - Are all required fields present?
   - Missing or null values that could affect analysis
   - Data freshness and timestamp validity

2. **Pattern Indicators**
   - sts, st, tt values and their meanings
   - Ready state pattern detection (sts:2, st:2, tt:4)
   - Trading state progression and timing

3. **Market Conditions**
   - Symbol trading status and availability
   - Price and volume data reliability
   - Launch timing and scheduling accuracy

4. **Risk Assessment**
   - Data inconsistencies or anomalies
   - Reliability confidence score (0-100)
   - Recommended actions based on data quality

5. **Trading Signals**
   - Immediate trading opportunities
   - Monitoring recommendations
   - Alert conditions and thresholds

Provide a structured assessment with specific recommendations for trading decisions.
`;

    return await callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  /**
   * Assess service response quality
   */
  async assessServiceResponseQuality(
    serviceResponse: ServiceResponse<unknown>,
    callOpenAI: (
      messages: Array<{ role: string; content: string }>
    ) => Promise<AgentResponse>
  ): Promise<AgentResponse> {
    const responseJson = JSON.stringify(serviceResponse, null, 2);

    const userMessage = `
MEXC Service Response Quality Assessment:

Service Response:
${responseJson}

Please assess the service response quality and provide analysis on:

1. **Response Reliability**
   - Success/failure status interpretation
   - Error handling and recovery strategies
   - Service availability and stability

2. **Data Integrity**
   - Response data structure validation
   - Field completeness and accuracy
   - Timestamp and versioning consistency

3. **Performance Metrics**
   - Response time analysis
   - Cache efficiency indicators
   - Circuit breaker status implications

4. **Actionable Insights**
   - Data usability for trading decisions
   - Monitoring and alerting recommendations
   - Risk mitigation strategies

Provide specific recommendations for handling this response type.
`;

    return await callOpenAI([
      {
        role: "user",
        content: userMessage,
      },
    ]);
  }

  /**
   * Calculate data completeness score
   */
  calculateCompletenessScore(data: unknown): number {
    if (!data || typeof data !== "object") return 0;

    const obj = data as Record<string, unknown>;
    const totalFields = Object.keys(obj).length;
    const completedFields = Object.values(obj).filter(
      (value) => value !== null && value !== undefined && value !== ""
    ).length;

    return totalFields > 0
      ? Math.round((completedFields / totalFields) * 100)
      : 0;
  }

  /**
   * Validate response structure
   */
  isValidResponseStructure(response: unknown): response is MexcApiResponseData {
    return (
      typeof response === "object" &&
      response !== null &&
      "success" in response &&
      "data" in response &&
      typeof (response as MexcApiResponseData).success === "boolean"
    );
  }

  /**
   * Check for critical data fields
   */
  hasCriticalFields(data: unknown, requiredFields: string[]): boolean {
    if (!data || typeof data !== "object") return false;

    const obj = data as Record<string, unknown>;
    return requiredFields.every(
      (field) => field in obj && obj[field] !== null && obj[field] !== undefined
    );
  }

  /**
   * Assess data freshness
   */
  isDataFresh(timestamp: string, maxAgeMinutes: number = 5): boolean {
    try {
      const dataTime = new Date(timestamp);
      const now = new Date();
      const ageMinutes = (now.getTime() - dataTime.getTime()) / (1000 * 60);
      return ageMinutes <= maxAgeMinutes;
    } catch {
      return false;
    }
  }
}
