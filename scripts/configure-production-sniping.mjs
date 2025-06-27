#!/usr/bin/env node

/**
 * Production Auto-Sniping Configuration Script
 * 
 * Configures the auto-sniping system for production use with:
 * - Live trading enabled (paper trading disabled)
 * - Auto-sniping enabled
 * - Production-safe confidence threshold
 * - Appropriate risk management settings
 */

import { config } from 'dotenv';

// Load environment variables
config();

const PRODUCTION_CONFIG = {
  // Core auto-sniping settings
  autoSnipingEnabled: true,
  enablePaperTrading: false,  // LIVE TRADING ENABLED
  
  // Risk management
  confidenceThreshold: 80,    // Higher threshold for production safety
  maxConcurrentPositions: 3,  // Conservative position limit
  
  // Circuit breaker configuration
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 3,     // Stop after 3 failures
  circuitBreakerResetTime: 600000, // 10 minutes reset time
  
  // Performance settings
  snipeCheckInterval: 15000,  // Check every 15 seconds (more frequent)
  enableCaching: true,
  cacheTTL: 30000,           // 30 seconds cache
  
  // API settings
  timeout: 10000,            // 10 second timeout
  maxRetries: 2,             // Limited retries for production
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3008';

async function makeApiCall(endpoint, method = 'GET', data = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Add auth header if needed
      ...(process.env.API_AUTH_TOKEN && {
        'Authorization': `Bearer ${process.env.API_AUTH_TOKEN}`
      })
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    console.log(`🔄 ${method} ${url}`);
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ API call failed: ${error.message}`);
    throw error;
  }
}

async function getCurrentConfig() {
  console.log('\n📊 Getting current auto-sniping configuration...');
  try {
    const response = await makeApiCall('/api/auto-sniping/config');
    console.log('✅ Current configuration retrieved');
    return response;
  } catch (error) {
    console.log('⚠️  Could not retrieve current config, proceeding with update');
    return null;
  }
}

async function updateConfiguration() {
  console.log('\n⚙️  Updating auto-sniping configuration for production...');
  
  try {
    const response = await makeApiCall('/api/auto-sniping/config', 'POST', {
      action: 'update',
      config: PRODUCTION_CONFIG
    });
    
    console.log('✅ Production configuration applied successfully');
    return response;
  } catch (error) {
    console.error('❌ Configuration update failed:', error.message);
    throw error;
  }
}

async function startAutoSniping() {
  console.log('\n🚀 Starting auto-sniping with production settings...');
  
  try {
    const response = await makeApiCall('/api/auto-sniping/control', 'POST', {
      action: 'start'
    });
    
    console.log('✅ Auto-sniping started successfully');
    return response;
  } catch (error) {
    console.error('❌ Failed to start auto-sniping:', error.message);
    throw error;
  }
}

async function getSystemStatus() {
  console.log('\n📋 Getting system status...');
  
  try {
    const response = await makeApiCall('/api/auto-sniping/control', 'GET');
    console.log('✅ System status retrieved');
    return response;
  } catch (error) {
    console.error('❌ Failed to get system status:', error.message);
    throw error;
  }
}

async function verifyConfiguration() {
  console.log('\n🔍 Verifying production configuration...');
  
  const status = await getSystemStatus();
  const config = status.data?.status;
  
  if (!config) {
    throw new Error('Could not retrieve system configuration for verification');
  }
  
  console.log('\n📊 Production Configuration Status:');
  console.log(`   Auto-Sniping Enabled: ${config.autoSnipingEnabled ? '✅' : '❌'}`);
  console.log(`   Paper Trading Mode: ${config.paperTradingMode ? '❌ (should be false)' : '✅'}`);
  console.log(`   Trading Enabled: ${config.tradingEnabled ? '✅' : '❌'}`);
  console.log(`   Circuit Breaker: ${config.circuitBreakerOpen ? '❌ (active)' : '✅ (inactive)'}`);
  console.log(`   Active Positions: ${config.activePositions || 0}/${config.maxPositions || 'N/A'}`);
  console.log(`   Risk Level: ${config.currentRiskLevel || 'unknown'}`);
  
  // Validation checks
  const checks = [
    { name: 'Auto-sniping enabled', passed: config.autoSnipingEnabled },
    { name: 'Live trading mode', passed: !config.paperTradingMode },
    { name: 'Trading enabled', passed: config.tradingEnabled },
    { name: 'System healthy', passed: config.isHealthy },
  ];
  
  const passedChecks = checks.filter(check => check.passed).length;
  const totalChecks = checks.length;
  
  console.log(`\n🎯 Configuration Validation: ${passedChecks}/${totalChecks} checks passed`);
  
  checks.forEach(check => {
    console.log(`   ${check.passed ? '✅' : '❌'} ${check.name}`);
  });
  
  if (passedChecks === totalChecks) {
    console.log('\n🎉 Production configuration successfully validated!');
    return true;
  } else {
    console.log('\n⚠️  Some configuration checks failed. Please review.');
    return false;
  }
}

async function main() {
  console.log('🎯 Production Auto-Sniping Configuration Script');
  console.log('==========================================');
  
  try {
    // Step 1: Get current configuration
    console.log('\n1️⃣  Checking current configuration...');
    const currentConfig = await getCurrentConfig();
    
    if (currentConfig?.success && currentConfig?.data) {
      console.log('📊 Current settings:');
      const status = currentConfig.data;
      console.log(`   Paper Trading: ${status.paperTradingMode ? 'Enabled' : 'Disabled'}`);
      console.log(`   Auto-Sniping: ${status.autoSnipingEnabled ? 'Enabled' : 'Disabled'}`);
    }
    
    // Step 2: Apply production configuration
    console.log('\n2️⃣  Applying production configuration...');
    await updateConfiguration();
    
    // Step 3: Start auto-sniping
    console.log('\n3️⃣  Starting auto-sniping...');
    await startAutoSniping();
    
    // Step 4: Verify configuration
    console.log('\n4️⃣  Verifying configuration...');
    const isValid = await verifyConfiguration();
    
    if (isValid) {
      console.log('\n🎉 SUCCESS: Production auto-sniping is now configured and running!');
      console.log('\n⚠️  IMPORTANT REMINDERS:');
      console.log('   • Live trading is now ENABLED - real money will be used');
      console.log('   • Monitor the system closely for the first few operations');
      console.log('   • Check logs and alerts regularly');
      console.log('   • Have emergency stop procedures ready');
      console.log('\n💡 Next steps:');
      console.log('   • Monitor initial trades for proper execution');
      console.log('   • Verify target pipeline is creating ready targets');
      console.log('   • Test emergency stop functionality');
    } else {
      console.log('\n❌ Configuration validation failed. Please check the system manually.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n💥 Configuration script failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('   • Ensure the application is running (npm run dev)');
    console.log('   • Check API authentication if required');
    console.log('   • Verify environment variables are set');
    console.log('   • Check application logs for errors');
    process.exit(1);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { PRODUCTION_CONFIG, main as configureProductionSniping };