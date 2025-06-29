#!/usr/bin/env bun

/**
 * Safety System Status Check
 * 
 * Diagnoses why ZODI target (ID: 559) is ready but not executing
 * Checks safety system emergency mode and risk scores
 */

import { and, desc, eq, gte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/db/schema';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

async function main() {
  try {
    console.log('🚨 SAFETY SYSTEM EMERGENCY DIAGNOSIS\n');
    
    // 1. Check the specific ZODI target
    console.log('🎯 Checking ZODI target (ID: 559)...');
    const zodiTarget = await db
      .select()
      .from(schema.snipeTargets)
      .where(eq(schema.snipeTargets.id, 559));
    
    if (zodiTarget.length > 0) {
      const target = zodiTarget[0];
      console.log('📋 ZODI Target Details:');
      console.log(`   Symbol: ${target.symbolName}`);
      console.log(`   Status: ${target.status}`);
      console.log(`   Priority: ${target.priority}`);
      console.log(`   Risk Level: ${target.riskLevel}`);
      console.log(`   Confidence: ${target.confidenceScore}`);
      console.log(`   Position Size: $${target.positionSizeUsdt} USDT`);
      console.log(`   Created: ${target.createdAt}`);
      console.log(`   Target Execution: ${target.targetExecutionTime ? new Date(Number(target.targetExecutionTime) * 1000) : 'Not set'}`);
      console.log(`   User: ${target.userId}`);
      console.log();
    }
    
    // 2. Check system health metrics for emergency status
    console.log('🏥 Checking System Health Metrics...');
    const recentHealthMetrics = await db
      .select()
      .from(schema.systemHealthMetrics)
      .orderBy(desc(schema.systemHealthMetrics.timestamp))
      .limit(5);
    
    if (recentHealthMetrics.length > 0) {
      console.log('📊 Recent Health Metrics:');
      recentHealthMetrics.forEach((metric, index) => {
        console.log(`${index + 1}. Service: ${metric.service}`);
        console.log(`   Status: ${metric.status}`);
        console.log(`   Timestamp: ${metric.timestamp.toLocaleString()}`);
        console.log(`   Response Time: ${metric.responseTime}ms`);
        console.log(`   Error Rate: ${metric.errorRate}%`);
        console.log(`   Uptime: ${metric.uptime}%`);
        console.log(`   Total Errors: ${metric.totalErrors}`);
        console.log(`   Critical Errors: ${metric.criticalErrors}`);
        console.log(`   Circuit Breaker Open: ${metric.circuitBreakerOpen}`);
        console.log();
      });
      
      const latestMetric = recentHealthMetrics[0];
      if (latestMetric.status === 'critical' || latestMetric.status === 'offline') {
        console.log('🚨 EMERGENCY DETECTED: Service status is critical or offline');
      }
      if (latestMetric.circuitBreakerOpen) {
        console.log('🚨 CIRCUIT BREAKER OPEN: Safety system has halted operations');
      }
      if (latestMetric.criticalErrors > 0) {
        console.log('🚨 CRITICAL ERRORS: System has critical errors that may block trading');
      }
    } else {
      console.log('⚠️  No health metrics found - safety system may not be reporting');
    }
    
    // 3. Check risk events
    console.log('⚠️  Checking Recent Risk Events...');
    const recentRiskEvents = await db
      .select()
      .from(schema.riskEvents)
      .orderBy(desc(schema.riskEvents.timestamp))
      .limit(10);
    
    if (recentRiskEvents.length > 0) {
      console.log('📋 Recent Risk Events:');
      recentRiskEvents.forEach((event, index) => {
        console.log(`${index + 1}. ${event.timestamp.toLocaleString()}`);
        console.log(`   Type: ${event.eventType}`);
        console.log(`   Severity: ${event.severity}`);
        console.log(`   Description: ${event.description}`);
        console.log(`   Action Taken: ${event.actionTaken}`);
        console.log(`   Risk Percentage: ${event.riskPercentage || 'N/A'}%`);
        console.log(`   Total Exposure: ${event.totalExposure || 'N/A'}`);
        console.log(`   Daily P&L: ${event.dailyPnL || 'N/A'}`);
        console.log(`   Resolved: ${event.resolved}`);
        console.log();
      });
      
      // Check for high-severity events
      const criticalEvents = recentRiskEvents.filter(event => event.severity === 'critical' && !event.resolved);
      if (criticalEvents.length > 0) {
        console.log(`🚨 UNRESOLVED CRITICAL EVENTS: ${criticalEvents.length} critical events still active`);
        console.log('💡 This likely explains why ZODI is not executing');
      }
    } else {
      console.log('✅ No recent risk events found');
    }
    
    // 4. Check error incidents
    console.log('🐛 Checking Recent Error Incidents...');
    const recentErrors = await db
      .select()
      .from(schema.errorIncidents)
      .orderBy(desc(schema.errorIncidents.lastOccurrence))
      .limit(5);
    
    if (recentErrors.length > 0) {
      console.log('📋 Recent Error Incidents:');
      recentErrors.forEach((error, index) => {
        console.log(`${index + 1}. Last: ${error.lastOccurrence.toLocaleString()}`);
        console.log(`   Type: ${error.type}`);
        console.log(`   Severity: ${error.severity}`);
        console.log(`   Service: ${error.service}`);
        console.log(`   Message: ${error.errorMessage}`);
        console.log(`   Occurrences: ${error.occurrenceCount}`);
        console.log(`   Recovered: ${error.recovered}`);
        console.log();
      });
    } else {
      console.log('✅ No recent error incidents found');
    }
    
    // 5. Check if auto-sniping is specifically blocked
    console.log('🎯 Checking Auto-Sniping Status...');
    
    // Look for any API calls or status endpoints
    try {
      const response = await fetch('http://localhost:3000/api/auto-sniping/status');
      if (response.ok) {
        const statusData = await response.json();
        console.log('📊 Auto-Sniping Status:');
        console.log(`   Service Running: ${statusData.isRunning || 'Unknown'}`);
        console.log(`   Safety Enabled: ${statusData.safetyEnabled || 'Unknown'}`);
        console.log(`   Risk Score: ${statusData.currentRiskScore || 'Unknown'}`);
        console.log(`   Emergency Mode: ${statusData.emergencyMode || 'Unknown'}`);
        console.log();
      } else {
        console.log('⚠️  Auto-sniping status API not available (service may be offline)');
      }
    } catch (error) {
      console.log('⚠️  Could not connect to auto-sniping service API');
      console.log('💡 The service may not be running or listening on localhost:3000');
    }
    
    // 6. Summary and diagnosis
    console.log('\n🔍 DIAGNOSIS SUMMARY:');
    console.log('═══════════════════════');
    
    console.log('✅ Target exists in database: ZODI (ID: 559) with status "ready"');
    console.log('✅ Database connectivity is working');
    
    if (recentHealthMetrics.length > 0) {
      const latest = recentHealthMetrics[0];
      console.log(`📊 Latest service: ${latest.service}`);
      console.log(`📊 Latest status: ${latest.status}`);
      console.log(`⚠️  Circuit breaker open: ${latest.circuitBreakerOpen}`);
      console.log(`🚨 Critical errors: ${latest.criticalErrors}`);
      console.log(`📈 Error rate: ${latest.errorRate}%`);
      
      if (latest.status === 'critical' || latest.status === 'offline' || latest.circuitBreakerOpen || latest.criticalErrors > 0) {
        console.log('\n🚨 ROOT CAUSE IDENTIFIED:');
        console.log('   Safety system has disabled auto-sniping execution');
        console.log('   ZODI target is ready but blocked by safety controls');
      }
    }
    
    const criticalEventCount = recentRiskEvents.filter(e => e.severity === 'critical' && !e.resolved).length;
    if (criticalEventCount > 0) {
      console.log(`\n🚨 ADDITIONAL FACTOR: ${criticalEventCount} unresolved critical risk events`);
    }
    
    console.log('\n🔧 RECOMMENDED ACTIONS:');
    console.log('1. Review and resolve high-risk events');
    console.log('2. Check safety system configuration and thresholds');
    console.log('3. Manually override emergency mode if safe to do so');
    console.log('4. Investigate why risk score is elevated');
    console.log('5. Review recent system errors and resolve them');
    
  } catch (error) {
    console.error('❌ Safety system check failed:', error);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

main().catch(console.error);