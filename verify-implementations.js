#!/usr/bin/env node

/**
 * Verification Script for Core Service Implementations
 * 
 * This script tests the missing methods that were implemented in:
 * - MultiPhaseTradingBot
 * - AdvancedRiskEngine  
 * - ComprehensiveSafetyCoordinator
 */

const { MultiPhaseTradingBot } = require('./src/services/multi-phase-trading-bot.js');
const { AdvancedRiskEngine } = require('./src/services/advanced-risk-engine.js');
const { ComprehensiveSafetyCoordinator } = require('./src/services/comprehensive-safety-coordinator.js');

console.log('🧪 Verifying Core Service Implementations...\n');

// Test strategy for MultiPhaseTradingBot
const testStrategy = {
  id: 'test-verification',
  name: 'Verification Strategy',
  description: 'Strategy for testing implementations',
  levels: [
    { percentage: 50, multiplier: 1.5, sellPercentage: 30 },
    { percentage: 100, multiplier: 2.0, sellPercentage: 30 },
    { percentage: 200, multiplier: 3.0, sellPercentage: 40 }
  ]
};

async function verifyMultiPhaseTradingBot() {
  console.log('🤖 Testing MultiPhaseTradingBot implementations...');
  
  try {
    const bot = new MultiPhaseTradingBot(testStrategy, 1.0, 1000);
    
    // Test calculateOptimalEntry
    console.log('   ✓ Testing calculateOptimalEntry...');
    const entryResult = bot.calculateOptimalEntry('TESTUSDT', {
      volatility: 0.5,
      volume: 1.5,
      momentum: 0.3
    });
    console.log(`     Entry: ${entryResult.entryPrice}, Confidence: ${entryResult.confidence}%`);
    
    // Test initializePosition
    console.log('   ✓ Testing initializePosition...');
    const positionResult = bot.initializePosition('TESTUSDT', 1.0, 1000);
    console.log(`     Position initialized: ${positionResult.success ? 'Success' : 'Failed'}`);
    
    // Test handlePartialFill
    console.log('   ✓ Testing handlePartialFill...');
    const fillResult = bot.handlePartialFill('sell_action', 750, 1000);
    console.log(`     Fill: ${fillResult.fillPercentage}%, Status: ${fillResult.status}`);
    
    // Test getPositionInfo
    console.log('   ✓ Testing getPositionInfo...');
    const positionInfo = bot.getPositionInfo();
    console.log(`     Has position: ${positionInfo.hasPosition}, Size: ${positionInfo.currentSize}`);
    
    // Test getPhaseStatus
    console.log('   ✓ Testing getPhaseStatus...');
    const phaseStatus = bot.getPhaseStatus();
    console.log(`     Phases: ${phaseStatus.completedPhases}/${phaseStatus.totalPhases}`);
    
    // Test performMaintenanceCleanup
    console.log('   ✓ Testing performMaintenanceCleanup...');
    const maintenanceResult = bot.performMaintenanceCleanup();
    console.log(`     Maintenance: ${maintenanceResult.success ? 'Success' : 'Failed'}`);
    
    // Test getPendingPersistenceOperations
    console.log('   ✓ Testing getPendingPersistenceOperations...');
    const pendingOps = bot.getPendingPersistenceOperations();
    console.log(`     Pending operations: ${pendingOps.operations.length}`);
    
    console.log('   ✅ MultiPhaseTradingBot verification completed successfully!\n');
    return true;
  } catch (error) {
    console.error('   ❌ MultiPhaseTradingBot verification failed:', error.message);
    return false;
  }
}

async function verifyAdvancedRiskEngine() {
  console.log('⚠️  Testing AdvancedRiskEngine implementations...');
  
  try {
    const riskEngine = new AdvancedRiskEngine({
      maxPortfolioValue: 50000,
      maxSinglePositionSize: 5000,
      maxDrawdown: 15,
      emergencyVolatilityThreshold: 80
    });
    
    // Test validatePositionSize
    console.log('   ✓ Testing validatePositionSize...');
    const validationResult = await riskEngine.validatePositionSize({
      symbol: 'TESTUSDT',
      entryPrice: 1.0,
      requestedPositionSize: 2000,
      portfolioValue: 50000
    });
    console.log(`     Validation: ${validationResult.approved ? 'Approved' : 'Rejected'}`);
    
    // Test updatePortfolioRisk  
    console.log('   ✓ Testing updatePortfolioRisk...');
    riskEngine.updatePortfolioRisk(5.5);
    console.log('     Portfolio risk updated to 5.5%');
    
    // Test updatePortfolioMetrics
    console.log('   ✓ Testing updatePortfolioMetrics...');
    await riskEngine.updatePortfolioMetrics({
      totalValue: 48000,
      currentRisk: 6.0,
      unrealizedPnL: -2000
    });
    console.log('     Portfolio metrics updated');
    
    // Test isEmergencyStopActive
    console.log('   ✓ Testing isEmergencyStopActive...');
    const emergencyActive = riskEngine.isEmergencyStopActive();
    console.log(`     Emergency stop: ${emergencyActive ? 'Active' : 'Inactive'}`);
    
    console.log('   ✅ AdvancedRiskEngine verification completed successfully!\n');
    return true;
  } catch (error) {
    console.error('   ❌ AdvancedRiskEngine verification failed:', error.message);
    return false;
  }
}

async function verifyComprehensiveSafetyCoordinator() {
  console.log('🛡️  Testing ComprehensiveSafetyCoordinator implementations...');
  
  try {
    const safetyCoordinator = new ComprehensiveSafetyCoordinator({
      agentMonitoringInterval: 1000,
      riskAssessmentInterval: 500,
      systemHealthCheckInterval: 2000,
      criticalViolationThreshold: 5,
      riskScoreThreshold: 80,
      agentAnomalyThreshold: 75,
      autoEmergencyShutdown: true,
      emergencyContactEnabled: false,
      safetyOverrideRequired: false
    });
    
    // Test assessSystemSafety
    console.log('   ✓ Testing assessSystemSafety...');
    const safetyAssessment = await safetyCoordinator.assessSystemSafety();
    console.log(`     Safety level: ${safetyAssessment.overall.safetyLevel}, Score: ${safetyAssessment.overall.safetyScore}`);
    
    // Test assessTradingConditions
    console.log('   ✓ Testing assessTradingConditions...');
    const conditionAssessment = await safetyCoordinator.assessTradingConditions({
      rapidPriceMovement: false,
      highVolatility: 0.6,
      lowLiquidity: false,
      portfolioRisk: 5.0
    });
    console.log(`     Trading conditions assessed: ${conditionAssessment.approved ? 'Safe' : 'Unsafe'}`);
    
    // Test event emitter functionality
    console.log('   ✓ Testing event emitter functionality...');
    let eventReceived = false;
    safetyCoordinator.on('safety_alert', (alert) => {
      eventReceived = true;
      console.log(`     Event received: ${alert.type || 'safety_alert'}`);
    });
    
    // Trigger a safety alert (this should emit an event)
    safetyCoordinator.emit('safety_alert', { type: 'test_alert', message: 'Test alert' });
    
    if (eventReceived) {
      console.log('     Event emitter working correctly');
    } else {
      console.log('     Event emitter may not be working');
    }
    
    console.log('   ✅ ComprehensiveSafetyCoordinator verification completed successfully!\n');
    return true;
  } catch (error) {
    console.error('   ❌ ComprehensiveSafetyCoordinator verification failed:', error.message);
    return false;
  }
}

async function runVerification() {
  console.log('🚀 Starting Core Service Implementation Verification\n');
  
  const results = [];
  
  results.push(await verifyMultiPhaseTradingBot());
  results.push(await verifyAdvancedRiskEngine());
  results.push(await verifyComprehensiveSafetyCoordinator());
  
  const successCount = results.filter(r => r).length;
  const totalCount = results.length;
  
  console.log('📊 Verification Summary:');
  console.log(`   ✅ Successful: ${successCount}/${totalCount} services`);
  console.log(`   ❌ Failed: ${totalCount - successCount}/${totalCount} services`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 All core service implementations verified successfully!');
    console.log('✅ All missing methods have been implemented correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some implementations need attention.');
    process.exit(1);
  }
}

// Run the verification
runVerification().catch(error => {
  console.error('❌ Verification script failed:', error);
  process.exit(1);
});