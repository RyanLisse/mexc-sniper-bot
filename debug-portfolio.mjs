#!/usr/bin/env node

/**
 * Debug Portfolio Tracking
 * Simple test to isolate the portfolio tracking issue
 */

console.log('🔍 Starting Portfolio Tracking Debug...');

try {
  // Import the recommended MEXC service
  const { getRecommendedMexcService } = await import('./src/services/api/mexc-unified-exports.ts');
  
  console.log('✅ Successfully imported getRecommendedMexcService');

  // Get the service instance
  const mexcService = getRecommendedMexcService();
  console.log('✅ Successfully created mexcService instance');

  // Check if credentials are available
  const hasCredentials = mexcService.hasValidCredentials();
  console.log(`📋 Has Valid Credentials: ${hasCredentials}`);

  if (hasCredentials) {
    console.log('🔍 Testing portfolio retrieval...');
    
    const portfolio = await mexcService.getAccountBalances();
    
    console.log('📊 Portfolio result:', {
      success: portfolio.success,
      hasData: !!portfolio.data,
      error: portfolio.error,
      dataKeys: portfolio.data ? Object.keys(portfolio.data) : []
    });

    if (portfolio.success && portfolio.data) {
      console.log('✅ Portfolio tracking working!');
      console.log(`💰 Total Value: $${portfolio.data.totalUsdtValue.toFixed(2)}`);
      console.log(`📈 Active Holdings: ${portfolio.data.balances.length}`);
    } else {
      console.log('❌ Portfolio tracking failed:', portfolio.error);
    }
  } else {
    console.log('⚠️  No credentials configured - cannot test portfolio tracking');
  }

} catch (error) {
  console.error('💥 Debug failed:', error.message);
  console.error('Stack:', error.stack);
}