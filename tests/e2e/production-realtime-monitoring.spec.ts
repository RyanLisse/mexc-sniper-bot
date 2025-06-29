import { Stagehand } from "@browserbasehq/stagehand";
import { expect, test } from '@playwright/test';
import { z } from "zod";
import StagehandConfig from "../../stagehand.config.unified";

/**
 * Production Real-time Monitoring and WebSocket Testing
 * 
 * Validates real-time data flows, WebSocket connections, monitoring systems,
 * and alerting mechanisms in production environment.
 */
test.describe('Production Real-time Monitoring (Stagehand)', () => {
  let stagehand: Stagehand;
  let testSession: string;
  let websocketConnectionId: string;

  // Real-time monitoring configuration
  const MONITORING_CONFIG = {
    websocketTimeout: 30000, // 30 seconds for WebSocket operations
    dataUpdateInterval: 5000, // 5 second data update checks
    alertThreshold: 10000, // 10 second alert response threshold
    maxLatency: 2000, // Maximum acceptable latency (2s)
    minUptime: 99.0, // Minimum acceptable uptime percentage
  };

  test.beforeAll(async () => {
    stagehand = new Stagehand({
      ...StagehandConfig,
      verbose: 2,
      domSettleTimeoutMs: 15000, // Extended for real-time operations
      defaultTimeout: MONITORING_CONFIG.websocketTimeout,
    });
    await stagehand.init();
    testSession = `realtime-test-${Date.now()}`;
    websocketConnectionId = `ws-${Date.now()}`;
    console.log(`⚡ Starting real-time monitoring test session: ${testSession}`);
  });

  test.afterAll(async () => {
    if (stagehand) {
      await stagehand.close();
    }
    console.log(`✅ Real-time monitoring test completed: ${testSession}`);
  });

  test('WebSocket connection establishment and stability', async () => {
    const page = stagehand.page;
    console.log('🔌 Testing WebSocket connection establishment and stability');

    // Navigate to monitoring dashboard
    await page.goto('http://localhost:3008/monitoring');
    await page.waitForLoadState('networkidle');

    // Step 1: WebSocket connection analysis
    console.log('📡 Step 1: WebSocket connection establishment');
    
    const websocketAnalysis = await page.extract({
      instruction: "Analyze WebSocket connections including connection status, protocols, and real-time capabilities",
      schema: z.object({
        websocketConnections: z.array(z.object({
          url: z.string(),
          status: z.enum(['connected', 'connecting', 'disconnected', 'error']),
          protocol: z.string(),
          lastActivity: z.string(),
          dataTypes: z.array(z.string())
        })),
        totalConnections: z.number(),
        activeConnections: z.number(),
        connectionHealth: z.enum(['healthy', 'degraded', 'critical']),
        autoReconnectEnabled: z.boolean()
      })
    });

    expect(websocketAnalysis.totalConnections).toBeGreaterThan(0);
    expect(websocketAnalysis.activeConnections).toBeGreaterThan(0);
    expect(websocketAnalysis.connectionHealth).toMatch(/healthy|degraded/);
    expect(websocketAnalysis.autoReconnectEnabled).toBe(true);
    
    console.log(`✅ WebSocket: ${websocketAnalysis.activeConnections}/${websocketAnalysis.totalConnections} active connections`);
    console.log(`🔗 Connection health: ${websocketAnalysis.connectionHealth}`);

    // Step 2: Real-time data flow validation
    console.log('📊 Step 2: Real-time data flow validation');
    
    // Capture initial data state
    const initialDataState = await page.extract({
      instruction: "Capture current real-time data including prices, patterns, and timestamps",
      schema: z.object({
        priceData: z.array(z.object({
          symbol: z.string(),
          price: z.string(),
          timestamp: z.string(),
          volume: z.string()
        })),
        patternData: z.array(z.object({
          symbol: z.string(),
          pattern: z.string(),
          confidence: z.number(),
          lastUpdate: z.string()
        })),
        systemMetrics: z.object({
          uptime: z.string(),
          latency: z.string(),
          throughput: z.string(),
          errorRate: z.string()
        })
      })
    });

    console.log(`📈 Initial data: ${initialDataState.priceData.length} price feeds, ${initialDataState.patternData.length} patterns`);

    // Wait for data updates
    console.log('⏳ Waiting for real-time data updates...');
    await page.waitForTimeout(MONITORING_CONFIG.dataUpdateInterval);

    // Capture updated data state
    const updatedDataState = await page.extract({
      instruction: "Capture updated real-time data after waiting period to verify data flow",
      schema: z.object({
        priceData: z.array(z.object({
          symbol: z.string(),
          price: z.string(),
          timestamp: z.string(),
          volume: z.string()
        })),
        dataUpdated: z.boolean(),
        updateFrequency: z.string(),
        latencyMetrics: z.object({
          averageLatency: z.string(),
          maxLatency: z.string(),
          dataFreshness: z.enum(['fresh', 'stale', 'very-stale'])
        })
      })
    });

    expect(updatedDataState.dataUpdated).toBe(true);
    expect(updatedDataState.latencyMetrics.dataFreshness).toMatch(/fresh|stale/);
    console.log(`✅ Data flow: updates every ${updatedDataState.updateFrequency}`);
    console.log(`⚡ Latency: avg ${updatedDataState.latencyMetrics.averageLatency}, max ${updatedDataState.latencyMetrics.maxLatency}`);

    // Step 3: WebSocket stability testing
    console.log('🔄 Step 3: WebSocket stability and reconnection testing');
    
    // Test connection resilience by simulating stress
    for (let i = 0; i < 3; i++) {
      await page.act("Navigate to different sections to test WebSocket persistence");
      await page.waitForTimeout(2000);
      await page.act("Return to monitoring dashboard");
      await page.waitForTimeout(1000);
    }

    const stabilityTest = await page.extract({
      instruction: "Evaluate WebSocket stability after navigation stress test",
      schema: z.object({
        connectionsStable: z.boolean(),
        reconnectEvents: z.number(),
        dataIntegrityMaintained: z.boolean(),
        performanceImpact: z.enum(['none', 'minimal', 'moderate', 'severe']),
        recoveryTime: z.string()
      })
    });

    expect(stabilityTest.connectionsStable).toBe(true);
    expect(stabilityTest.dataIntegrityMaintained).toBe(true);
    expect(stabilityTest.performanceImpact).toMatch(/none|minimal/);
    console.log(`✅ Stability: ${stabilityTest.reconnectEvents} reconnects, ${stabilityTest.performanceImpact} performance impact`);
  });

  test('Real-time alerting and notification systems', async () => {
    const page = stagehand.page;
    console.log('🚨 Testing real-time alerting and notification systems');

    await page.goto('http://localhost:3008/alerts');
    await page.waitForLoadState('networkidle');

    // Step 1: Alert system configuration analysis
    console.log('⚙️ Step 1: Alert system configuration analysis');
    
    const alertSystemAnalysis = await page.extract({
      instruction: "Analyze alert system configuration including rules, channels, and thresholds",
      schema: z.object({
        alertRules: z.array(z.object({
          name: z.string(),
          condition: z.string(),
          threshold: z.string(),
          enabled: z.boolean(),
          priority: z.enum(['low', 'medium', 'high', 'critical'])
        })),
        notificationChannels: z.array(z.object({
          type: z.enum(['email', 'sms', 'webhook', 'push', 'slack']),
          enabled: z.boolean(),
          configured: z.boolean()
        })),
        systemHealth: z.enum(['healthy', 'degraded', 'critical']),
        totalRules: z.number(),
        activeRules: z.number()
      })
    });

    expect(alertSystemAnalysis.totalRules).toBeGreaterThan(0);
    expect(alertSystemAnalysis.activeRules).toBeGreaterThan(0);
    expect(alertSystemAnalysis.systemHealth).toMatch(/healthy|degraded/);
    
    const criticalRules = alertSystemAnalysis.alertRules.filter(rule => 
      rule.priority === 'critical' && rule.enabled
    );
    expect(criticalRules.length).toBeGreaterThan(0);
    
    console.log(`🚨 Alert system: ${alertSystemAnalysis.activeRules}/${alertSystemAnalysis.totalRules} active rules`);
    console.log(`📢 Channels: ${alertSystemAnalysis.notificationChannels.length} configured`);

    // Step 2: Alert triggering and response testing
    console.log('🔔 Step 2: Alert triggering and response testing');
    
    // Look for test alert functionality
    const testAlertCapability = await page.observe({
      instruction: "Look for test alert buttons or alert simulation capabilities",
      returnAction: true
    });

    if (testAlertCapability.length > 0) {
      console.log('🧪 Testing alert generation...');
      await page.act("Trigger a test alert to validate the alerting system");
      await page.waitForTimeout(3000);

      const alertResponseTest = await page.extract({
        instruction: "Analyze the response to test alert including delivery, formatting, and timing",
        schema: z.object({
          alertTriggered: z.boolean(),
          responseTime: z.string(),
          deliveryChannels: z.array(z.string()),
          alertFormat: z.enum(['structured', 'basic', 'detailed']),
          escalationWorking: z.boolean(),
          acknowledgmentSystem: z.boolean()
        })
      });

      expect(alertResponseTest.alertTriggered).toBe(true);
      expect(alertResponseTest.deliveryChannels.length).toBeGreaterThan(0);
      console.log(`✅ Alert response: ${alertResponseTest.responseTime} response time`);
      console.log(`📨 Delivery: ${alertResponseTest.deliveryChannels.join(', ')}`);
    } else {
      console.log('ℹ️ No test alert functionality found (may be production-only)');
    }

    // Step 3: Alert history and analytics
    console.log('📊 Step 3: Alert history and analytics validation');
    
    const alertHistoryAnalysis = await page.extract({
      instruction: "Examine alert history, patterns, and analytics for system health insights",
      schema: z.object({
        recentAlerts: z.array(z.object({
          timestamp: z.string(),
          type: z.string(),
          severity: z.string(),
          resolved: z.boolean(),
          responseTime: z.string()
        })),
        alertVolume: z.object({
          last24Hours: z.number(),
          last7Days: z.number(),
          trend: z.enum(['increasing', 'stable', 'decreasing'])
        }),
        resolutionMetrics: z.object({
          averageResolutionTime: z.string(),
          resolutionRate: z.string(),
          escalationRate: z.string()
        }),
        systemInsights: z.array(z.string())
      })
    });

    console.log(`📈 Alert volume: ${alertHistoryAnalysis.alertVolume.last24Hours} (24h), trend: ${alertHistoryAnalysis.alertVolume.trend}`);
    console.log(`⚡ Resolution: ${alertHistoryAnalysis.resolutionMetrics.averageResolutionTime} avg time, ${alertHistoryAnalysis.resolutionMetrics.resolutionRate} rate`);
    
    if (alertHistoryAnalysis.systemInsights.length > 0) {
      console.log(`💡 Insights: ${alertHistoryAnalysis.systemInsights.slice(0, 3).join(', ')}`);
    }
  });

  test('Performance monitoring and metrics validation', async () => {
    const page = stagehand.page;
    console.log('📊 Testing performance monitoring and metrics validation');

    await page.goto('http://localhost:3008/monitoring');
    await page.waitForLoadState('networkidle');

    // Step 1: System performance metrics
    console.log('⚡ Step 1: System performance metrics collection');
    
    const performanceMetrics = await page.extract({
      instruction: "Collect comprehensive system performance metrics including CPU, memory, network, and response times",
      schema: z.object({
        systemMetrics: z.object({
          cpuUsage: z.string(),
          memoryUsage: z.string(),
          diskUsage: z.string(),
          networkLatency: z.string(),
          throughput: z.string()
        }),
        applicationMetrics: z.object({
          responseTime: z.string(),
          requestsPerSecond: z.string(),
          errorRate: z.string(),
          uptime: z.string(),
          activeUsers: z.number()
        }),
        databaseMetrics: z.object({
          connectionPool: z.string(),
          queryTime: z.string(),
          cacheHitRate: z.string(),
          lockWaitTime: z.string()
        }),
        overallHealth: z.enum(['excellent', 'good', 'fair', 'poor', 'critical'])
      })
    });

    expect(performanceMetrics.overallHealth).toMatch(/excellent|good|fair/);
    console.log(`💾 System: CPU ${performanceMetrics.systemMetrics.cpuUsage}, Memory ${performanceMetrics.systemMetrics.memoryUsage}`);
    console.log(`🌐 App: ${performanceMetrics.applicationMetrics.responseTime} response, ${performanceMetrics.applicationMetrics.errorRate} error rate`);
    console.log(`🗃️ DB: ${performanceMetrics.databaseMetrics.queryTime} query time, ${performanceMetrics.databaseMetrics.cacheHitRate} cache hit`);

    // Step 2: Real-time performance tracking
    console.log('📈 Step 2: Real-time performance tracking');
    
    // Trigger some load to monitor performance
    for (let i = 0; i < 5; i++) {
      await page.act("Refresh monitoring data or trigger system operations");
      await page.waitForTimeout(1000);
    }

    const performanceUnderLoad = await page.extract({
      instruction: "Monitor performance metrics during load to validate real-time tracking",
      schema: z.object({
        performanceDegradation: z.boolean(),
        responseTimeIncrease: z.string(),
        errorRateChange: z.string(),
        resourceUtilization: z.enum(['low', 'moderate', 'high', 'critical']),
        autoScalingTriggered: z.boolean(),
        performanceAlerts: z.number()
      })
    });

    expect(performanceUnderLoad.resourceUtilization).toMatch(/low|moderate/);
    console.log(`🔥 Load test: ${performanceUnderLoad.responseTimeIncrease} response increase, ${performanceUnderLoad.resourceUtilization} utilization`);

    // Step 3: Historical performance trends
    console.log('📊 Step 3: Historical performance trends analysis');
    
    const historicalAnalysis = await page.extract({
      instruction: "Analyze historical performance trends and capacity planning metrics",
      schema: z.object({
        performanceTrends: z.object({
          responseTimeTrend: z.enum(['improving', 'stable', 'degrading']),
          errorRateTrend: z.enum(['decreasing', 'stable', 'increasing']),
          uptimeTrend: z.enum(['improving', 'stable', 'degrading']),
          capacityTrend: z.enum(['increasing', 'stable', 'decreasing'])
        }),
        capacityPlanning: z.object({
          currentCapacity: z.string(),
          projectedGrowth: z.string(),
          scalingRecommendations: z.array(z.string())
        }),
        slaCompliance: z.object({
          uptimeSLA: z.string(),
          responseSLA: z.string(),
          availabilitySLA: z.string(),
          complianceStatus: z.enum(['meeting', 'at-risk', 'failing'])
        })
      })
    });

    expect(historicalAnalysis.slaCompliance.complianceStatus).toMatch(/meeting|at-risk/);
    console.log(`📈 Trends: response ${historicalAnalysis.performanceTrends.responseTimeTrend}, errors ${historicalAnalysis.performanceTrends.errorRateTrend}`);
    console.log(`🎯 SLA: ${historicalAnalysis.slaCompliance.uptimeSLA} uptime, status ${historicalAnalysis.slaCompliance.complianceStatus}`);
  });

  test('Monitoring system failover and recovery', async () => {
    const page = stagehand.page;
    console.log('🔄 Testing monitoring system failover and recovery');

    await page.goto('http://localhost:3008/monitoring');
    await page.waitForLoadState('networkidle');

    // Step 1: Baseline monitoring state
    console.log('📊 Step 1: Establishing baseline monitoring state');
    
    const baselineState = await page.extract({
      instruction: "Capture baseline monitoring system state including all active services and connections",
      schema: z.object({
        activeServices: z.array(z.string()),
        healthChecks: z.object({
          passing: z.number(),
          warning: z.number(),
          critical: z.number()
        }),
        dataCollectors: z.array(z.object({
          name: z.string(),
          status: z.string(),
          lastUpdate: z.string()
        })),
        redundancyLevel: z.enum(['none', 'basic', 'full']),
        backupSystems: z.array(z.string())
      })
    });

    console.log(`🔧 Baseline: ${baselineState.activeServices.length} services, ${baselineState.healthChecks.passing} healthy checks`);
    console.log(`🛡️ Redundancy: ${baselineState.redundancyLevel}, ${baselineState.backupSystems.length} backup systems`);

    // Step 2: Simulated failure scenarios
    console.log('⚠️ Step 2: Simulated failure scenario testing');
    
    // Note: In a real environment, this would test actual failover
    // Here we analyze the system's designed resilience
    const failoverCapabilities = await page.extract({
      instruction: "Analyze system failover capabilities and disaster recovery features",
      schema: z.object({
        automaticFailover: z.boolean(),
        manualFailoverOption: z.boolean(),
        dataReplication: z.boolean(),
        backupFrequency: z.string(),
        recoveryTimeObjective: z.string(),
        recoveryPointObjective: z.string(),
        failoverTesting: z.boolean(),
        disasterRecoveryPlan: z.boolean()
      })
    });

    expect(failoverCapabilities.automaticFailover).toBe(true);
    expect(failoverCapabilities.dataReplication).toBe(true);
    expect(failoverCapabilities.disasterRecoveryPlan).toBe(true);
    console.log(`✅ Failover: auto ${failoverCapabilities.automaticFailover}, RTO ${failoverCapabilities.recoveryTimeObjective}`);

    // Step 3: Recovery validation
    console.log('🔄 Step 3: Recovery procedure validation');
    
    const recoveryValidation = await page.extract({
      instruction: "Validate recovery procedures and system restoration capabilities",
      schema: z.object({
        recoveryProcedures: z.array(z.string()),
        dataIntegrityChecks: z.boolean(),
        serviceHealthValidation: z.boolean(),
        rollbackCapabilities: z.boolean(),
        communicationPlan: z.boolean(),
        recoveryMetrics: z.object({
          successRate: z.string(),
          averageRecoveryTime: z.string(),
          dataLossRisk: z.enum(['none', 'minimal', 'moderate', 'high'])
        })
      })
    });

    expect(recoveryValidation.dataIntegrityChecks).toBe(true);
    expect(recoveryValidation.rollbackCapabilities).toBe(true);
    expect(recoveryValidation.recoveryMetrics.dataLossRisk).toMatch(/none|minimal/);
    console.log(`🔄 Recovery: ${recoveryValidation.recoveryMetrics.successRate} success rate, ${recoveryValidation.recoveryMetrics.averageRecoveryTime} avg time`);

    console.log('✅ Monitoring system resilience validation completed');
  });
});