/**
 * Test Suite for Extracted Pattern Detection Schemas
 * 
 * Following TDD approach: writing tests before extracting pattern detection-related
 * types and interfaces from pattern-detection-engine.ts
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CorrelationAnalysisSchema,
  PatternAnalysisRequestSchema,
  PatternAnalysisResultSchema,
  PatternMatchSchema,
  ReadyStatePatternSchema,
} from '@/src/schemas/pattern-detection-schemas-extracted';

describe('Pattern Detection Schemas - TDD Extraction Tests', () => {
  describe('ReadyStatePatternSchema', () => {
    it('should validate the core ready state pattern (sts:2, st:2, tt:4)', () => {
      const readyStatePattern = {
        sts: 2,
        st: 2,
        tt: 4
      };

      expect(() => {
        ReadyStatePatternSchema.parse(readyStatePattern);
      }).not.toThrow();
    });

    it('should reject invalid ready state pattern values', () => {
      const invalidPattern = {
        sts: 1, // invalid - should be 2
        st: 2,
        tt: 4
      };

      expect(() => {
        ReadyStatePatternSchema.parse(invalidPattern);
      }).toThrow();
    });

    it('should reject missing fields in ready state pattern', () => {
      const incompletePattern = {
        sts: 2,
        st: 2
        // missing tt field
      };

      expect(() => {
        ReadyStatePatternSchema.parse(incompletePattern);
      }).toThrow();
    });
  });

  describe('PatternMatchSchema', () => {
    it('should validate complete pattern match with all fields', () => {
      const validMatch = {
        patternType: 'ready_state' as const,
        confidence: 95.5,
        symbol: 'BTCUSDT',
        vcoinId: 'vcoin-12345',
        indicators: {
          sts: 2,
          st: 2,
          tt: 4,
          advanceHours: 3.75,
          marketConditions: {
            volume: 'high',
            volatility: 'normal'
          }
        },
        activityInfo: {
          activities: [
            { type: 'airdrop', priority: 'high', status: 'active' },
            { type: 'listing', priority: 'medium', status: 'upcoming' }
          ],
          activityBoost: 1.25,
          hasHighPriorityActivity: true,
          activityTypes: ['airdrop', 'listing']
        },
        detectedAt: new Date(),
        advanceNoticeHours: 3.75,
        riskLevel: 'low' as const,
        recommendation: 'immediate_action' as const,
        similarPatterns: [],
        historicalSuccess: 85.2
      };

      expect(() => {
        PatternMatchSchema.parse(validMatch);
      }).not.toThrow();
    });

    it('should validate minimal pattern match', () => {
      const minimalMatch = {
        patternType: 'pre_ready' as const,
        confidence: 45.0,
        symbol: 'ETHUSDT',
        indicators: {
          sts: 1,
          st: 1,
          tt: 2
        },
        detectedAt: new Date(),
        advanceNoticeHours: 1.5,
        riskLevel: 'medium' as const,
        recommendation: 'monitor_closely' as const
      };

      expect(() => {
        PatternMatchSchema.parse(minimalMatch);
      }).not.toThrow();
    });

    it('should validate high-risk pattern match', () => {
      const riskMatch = {
        patternType: 'risk_warning' as const,
        confidence: 88.7,
        symbol: 'DOGEUSDT',
        indicators: {
          sts: 0,
          st: 0,
          tt: 1,
          marketConditions: {
            sentiment: 'bearish',
            liquidation_risk: 'high'
          }
        },
        detectedAt: new Date(),
        advanceNoticeHours: 0.5,
        riskLevel: 'high' as const,
        recommendation: 'avoid' as const,
        historicalSuccess: 15.8
      };

      expect(() => {
        PatternMatchSchema.parse(riskMatch);
      }).not.toThrow();
    });

    it('should reject invalid pattern match with wrong types', () => {
      const invalidMatch = {
        patternType: 'unknown_pattern', // invalid enum
        confidence: 150, // invalid > 100
        symbol: '', // invalid empty string
        indicators: {
          sts: -1, // invalid negative
          st: 2,
          tt: 4
        },
        detectedAt: 'not-a-date', // invalid type
        advanceNoticeHours: -1, // invalid negative
        riskLevel: 'extreme', // invalid enum
        recommendation: 'panic' // invalid enum
      };

      expect(() => {
        PatternMatchSchema.parse(invalidMatch);
      }).toThrow();
    });
  });

  describe('PatternAnalysisRequestSchema', () => {
    it('should validate complete pattern analysis request', () => {
      const validRequest = {
        symbols: [
          { cd: 'BTCUSDT', sts: 2, st: 2, tt: 4 },
          { cd: 'ETHUSDT', sts: 1, st: 1, tt: 2 }
        ],
        calendarEntries: [
          {
            vcoinId: 'vcoin-123',
            symbol: 'BTCUSDT',
            projectName: 'Bitcoin Project',
            firstOpenTime: Date.now()
          }
        ],
        analysisType: 'discovery' as const,
        timeframe: '24h',
        confidenceThreshold: 75,
        includeHistorical: true
      };

      expect(() => {
        PatternAnalysisRequestSchema.parse(validRequest);
      }).not.toThrow();
    });

    it('should validate minimal pattern analysis request', () => {
      const minimalRequest = {
        analysisType: 'monitoring' as const
      };

      expect(() => {
        PatternAnalysisRequestSchema.parse(minimalRequest);
      }).not.toThrow();
    });

    it('should validate correlation analysis request', () => {
      const correlationRequest = {
        symbols: [
          { cd: 'BTCUSDT', sts: 2, st: 2, tt: 4 },
          { cd: 'ETHUSDT', sts: 2, st: 2, tt: 4 }
        ],
        analysisType: 'correlation' as const,
        timeframe: '1h',
        confidenceThreshold: 85,
        includeHistorical: false
      };

      expect(() => {
        PatternAnalysisRequestSchema.parse(correlationRequest);
      }).not.toThrow();
    });

    it('should reject invalid pattern analysis request', () => {
      const invalidRequest = {
        symbols: 'not-an-array', // should be array
        analysisType: 'unknown', // invalid enum
        timeframe: 123, // should be string
        confidenceThreshold: 150, // invalid > 100
        includeHistorical: 'yes' // should be boolean
      };

      expect(() => {
        PatternAnalysisRequestSchema.parse(invalidRequest);
      }).toThrow();
    });
  });

  describe('PatternAnalysisResultSchema', () => {
    it('should validate complete pattern analysis result', () => {
      const validResult = {
        matches: [
          {
            patternType: 'ready_state' as const,
            confidence: 95.5,
            symbol: 'BTCUSDT',
            indicators: { sts: 2, st: 2, tt: 4 },
            detectedAt: new Date(),
            advanceNoticeHours: 3.75,
            riskLevel: 'low' as const,
            recommendation: 'immediate_action' as const
          },
          {
            patternType: 'pre_ready' as const,
            confidence: 78.2,
            symbol: 'ETHUSDT',
            indicators: { sts: 1, st: 1, tt: 2 },
            detectedAt: new Date(),
            advanceNoticeHours: 2.25,
            riskLevel: 'medium' as const,
            recommendation: 'prepare_entry' as const
          }
        ],
        summary: {
          totalAnalyzed: 150,
          readyStateFound: 2,
          highConfidenceMatches: 1,
          advanceOpportunities: 2,
          averageConfidence: 86.85
        },
        recommendations: {
          immediate: [
            {
              patternType: 'ready_state' as const,
              confidence: 95.5,
              symbol: 'BTCUSDT',
              indicators: { sts: 2, st: 2, tt: 4 },
              detectedAt: new Date(),
              advanceNoticeHours: 3.75,
              riskLevel: 'low' as const,
              recommendation: 'immediate_action' as const
            }
          ],
          monitor: [],
          prepare: [
            {
              patternType: 'pre_ready' as const,
              confidence: 78.2,
              symbol: 'ETHUSDT',
              indicators: { sts: 1, st: 1, tt: 2 },
              detectedAt: new Date(),
              advanceNoticeHours: 2.25,
              riskLevel: 'medium' as const,
              recommendation: 'prepare_entry' as const
            }
          ]
        },
        correlations: [
          {
            symbols: ['BTCUSDT', 'ETHUSDT'],
            correlationType: 'launch_timing' as const,
            strength: 0.85,
            insights: ['Strong correlation in launch timing'],
            recommendations: ['Monitor both symbols simultaneously']
          }
        ],
        analysisMetadata: {
          executionTime: 1250.5,
          algorithmsUsed: ['ready_state_detector', 'correlation_analyzer'],
          confidenceDistribution: {
            'high': 1,
            'medium': 1,
            'low': 0
          }
        }
      };

      expect(() => {
        PatternAnalysisResultSchema.parse(validResult);
      }).not.toThrow();
    });

    it('should validate result with no matches', () => {
      const emptyResult = {
        matches: [],
        summary: {
          totalAnalyzed: 50,
          readyStateFound: 0,
          highConfidenceMatches: 0,
          advanceOpportunities: 0,
          averageConfidence: 0
        },
        recommendations: {
          immediate: [],
          monitor: [],
          prepare: []
        },
        analysisMetadata: {
          executionTime: 125.8,
          algorithmsUsed: ['ready_state_detector'],
          confidenceDistribution: {}
        }
      };

      expect(() => {
        PatternAnalysisResultSchema.parse(emptyResult);
      }).not.toThrow();
    });

    it('should reject invalid pattern analysis result', () => {
      const invalidResult = {
        matches: 'no-matches', // should be array
        summary: {
          totalAnalyzed: -50, // invalid negative
          readyStateFound: 'none', // should be number
          highConfidenceMatches: 0,
          advanceOpportunities: 0,
          averageConfidence: 150 // invalid > 100
        },
        recommendations: {
          immediate: [],
          monitor: [],
          prepare: []
        },
        analysisMetadata: {
          executionTime: -125.8, // invalid negative
          algorithmsUsed: 'detector', // should be array
          confidenceDistribution: 'empty' // should be object
        }
      };

      expect(() => {
        PatternAnalysisResultSchema.parse(invalidResult);
      }).toThrow();
    });
  });

  describe('CorrelationAnalysisSchema', () => {
    it('should validate launch timing correlation analysis', () => {
      const launchCorrelation = {
        symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
        correlationType: 'launch_timing' as const,
        strength: 0.92,
        insights: [
          'Strong correlation in launch timing patterns',
          'Similar market sectors showing coordinated activity',
          'Historical data supports timing correlation'
        ],
        recommendations: [
          'Monitor all three symbols simultaneously',
          'Consider portfolio diversification risk',
          'Apply correlation-adjusted position sizing'
        ]
      };

      expect(() => {
        CorrelationAnalysisSchema.parse(launchCorrelation);
      }).not.toThrow();
    });

    it('should validate market sector correlation analysis', () => {
      const sectorCorrelation = {
        symbols: ['LINKUSDT', 'DOTUSDT'],
        correlationType: 'market_sector' as const,
        strength: 0.78,
        insights: [
          'Both tokens in DeFi/infrastructure sector',
          'Similar price movement patterns detected'
        ],
        recommendations: [
          'Consider sector-wide market conditions',
          'Monitor competitor token launches'
        ]
      };

      expect(() => {
        CorrelationAnalysisSchema.parse(sectorCorrelation);
      }).not.toThrow();
    });

    it('should validate pattern similarity correlation', () => {
      const patternCorrelation = {
        symbols: ['SOLUSDT', 'AVAXUSDT'],
        correlationType: 'pattern_similarity' as const,
        strength: 0.65,
        insights: [
          'Similar ready state progression patterns',
          'Comparable advance notice timeframes'
        ],
        recommendations: [
          'Apply similar trading strategies',
          'Use pattern confidence scoring'
        ]
      };

      expect(() => {
        CorrelationAnalysisSchema.parse(patternCorrelation);
      }).not.toThrow();
    });

    it('should reject invalid correlation analysis', () => {
      const invalidCorrelation = {
        symbols: 'BTCUSDT', // should be array
        correlationType: 'unknown_type', // invalid enum
        strength: 1.5, // invalid > 1
        insights: 'no insights', // should be array
        recommendations: 123 // should be array
      };

      expect(() => {
        CorrelationAnalysisSchema.parse(invalidCorrelation);
      }).toThrow();
    });
  });

  describe('Schema Integration Tests', () => {
    it('should validate complete pattern detection workflow', () => {
      const workflowData = {
        request: {
          symbols: [
            { cd: 'BTCUSDT', sts: 2, st: 2, tt: 4 },
            { cd: 'ETHUSDT', sts: 1, st: 2, tt: 3 }
          ],
          analysisType: 'discovery' as const,
          confidenceThreshold: 80,
          includeHistorical: true
        },
        readyState: {
          sts: 2,
          st: 2,
          tt: 4
        },
        match: {
          patternType: 'ready_state' as const,
          confidence: 95.5,
          symbol: 'BTCUSDT',
          indicators: { sts: 2, st: 2, tt: 4, advanceHours: 4.0 },
          detectedAt: new Date(),
          advanceNoticeHours: 4.0,
          riskLevel: 'low' as const,
          recommendation: 'immediate_action' as const
        },
        correlation: {
          symbols: ['BTCUSDT', 'ETHUSDT'],
          correlationType: 'pattern_similarity' as const,
          strength: 0.85,
          insights: ['Similar progression patterns'],
          recommendations: ['Apply similar strategies']
        }
      };

      expect(() => {
        PatternAnalysisRequestSchema.parse(workflowData.request);
        ReadyStatePatternSchema.parse(workflowData.readyState);
        PatternMatchSchema.parse(workflowData.match);
        CorrelationAnalysisSchema.parse(workflowData.correlation);
      }).not.toThrow();
    });

    it('should validate edge case scenarios', () => {
      const edgeCaseData = {
        lowConfidenceMatch: {
          patternType: 'pre_ready' as const,
          confidence: 5.0, // very low confidence
          symbol: 'NEWUSDT',
          indicators: { sts: 0, st: 0, tt: 1 },
          detectedAt: new Date(),
          advanceNoticeHours: 0.1, // very short notice
          riskLevel: 'high' as const,
          recommendation: 'wait' as const
        },
        perfectConfidenceMatch: {
          patternType: 'ready_state' as const,
          confidence: 100.0, // perfect confidence
          symbol: 'BTCUSDT',
          indicators: { sts: 2, st: 2, tt: 4, advanceHours: 5.0 },
          detectedAt: new Date(),
          advanceNoticeHours: 5.0,
          riskLevel: 'low' as const,
          recommendation: 'immediate_action' as const
        },
        zeroStrengthCorrelation: {
          symbols: ['BTCUSDT', 'RANDOMUSDT'],
          correlationType: 'pattern_similarity' as const,
          strength: 0.0, // no correlation
          insights: ['No correlation detected'],
          recommendations: ['Treat as independent signals']
        }
      };

      expect(() => {
        PatternMatchSchema.parse(edgeCaseData.lowConfidenceMatch);
        PatternMatchSchema.parse(edgeCaseData.perfectConfidenceMatch);
        CorrelationAnalysisSchema.parse(edgeCaseData.zeroStrengthCorrelation);
      }).not.toThrow();
    });
  });
});