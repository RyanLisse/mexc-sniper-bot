/**
 * Simple Balance API Debug Test
 * 
 * Isolated test to debug the 500 error issue
 */

const { getMexcService } = require('./src/services/api/mexc-unified-exports.ts');

async function testBalanceAPI() {
  console.log('🔍 Testing Balance API...');
  
  try {
    console.log('Environment check:', {
      hasApiKey: !!process.env.MEXC_API_KEY,
      hasSecretKey: !!process.env.MEXC_SECRET_KEY,
      nodeEnv: process.env.NODE_ENV
    });

    console.log('Creating MEXC service...');
    const mexcClient = getMexcService();
    
    console.log('Calling getAccountBalances...');
    const response = await mexcClient.getAccountBalances();
    
    console.log('✅ Response:', JSON.stringify(response, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
  }
}

testBalanceAPI();