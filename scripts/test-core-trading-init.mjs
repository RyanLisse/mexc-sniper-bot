#!/usr/bin/env node

/**
 * Test script to debug CoreTradingService initialization
 * This will help identify what's causing the 500 errors
 */

import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

console.log('🔍 Environment Check:');
console.log(`MEXC_API_KEY: ${process.env.MEXC_API_KEY ? 'Set (' + process.env.MEXC_API_KEY.length + ' chars)' : 'NOT SET'}`);
console.log(`MEXC_SECRET_KEY: ${process.env.MEXC_SECRET_KEY ? 'Set (' + process.env.MEXC_SECRET_KEY.length + ' chars)' : 'NOT SET'}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

try {
  console.log('\n🚀 Testing CoreTradingService initialization...');
  
  // Import the service
  const { getCoreTrading } = await import('../src/services/trading/consolidated/core-trading/base-service.ts');
  
  console.log('✅ Successfully imported CoreTradingService');
  
  // Create instance with explicit config
  const coreTrading = getCoreTrading({
    apiKey: process.env.MEXC_API_KEY,
    secretKey: process.env.MEXC_SECRET_KEY,
    enablePaperTrading: true, // Start with paper trading for testing
    autoSnipingEnabled: false, // Don't auto-start sniping
  });
  
  console.log('✅ Successfully created CoreTradingService instance');
  
  // Test initialization
  console.log('\n⚙️  Testing initialization...');
  const initResult = await coreTrading.initialize();
  
  if (initResult.success) {
    console.log('✅ CoreTradingService initialization successful!');
    
    // Test getting status
    console.log('\n📊 Testing getServiceStatus...');
    const status = await coreTrading.getServiceStatus();
    console.log('Status:', {
      isHealthy: status.isHealthy,
      isAuthenticated: status.isAuthenticated,
      paperTradingMode: status.paperTradingMode,
      autoSnipingEnabled: status.autoSnipingEnabled,
    });
    
    // Test getting performance metrics
    console.log('\n📈 Testing getPerformanceMetrics...');
    const metrics = await coreTrading.getPerformanceMetrics();
    console.log('Metrics:', {
      totalTrades: metrics.totalTrades,
      successRate: metrics.successRate,
      totalPnL: metrics.totalPnL,
    });
    
    console.log('\n🎉 All tests passed! CoreTradingService is working correctly.');
    
  } else {
    console.error('❌ CoreTradingService initialization failed:', initResult.error);
    process.exit(1);
  }
  
} catch (error) {
  console.error('💥 Error during testing:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}