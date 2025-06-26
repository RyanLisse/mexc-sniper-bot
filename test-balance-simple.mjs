/**
 * Simple Balance API Test to debug AbortSignal issue
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

console.log('🔍 Debug: Balance API AbortSignal Issue');
console.log('Environment:', {
  hasApiKey: !!process.env.MEXC_API_KEY,
  hasSecretKey: !!process.env.MEXC_SECRET_KEY,
  nodeVersion: process.version
});

// Test AbortSignal compatibility
console.log('\n🔧 Testing AbortSignal...');
try {
  const controller = new AbortController();
  const signal = controller.signal;
  
  console.log('AbortSignal created:', {
    type: typeof signal,
    constructor: signal.constructor.name,
    isInstance: signal instanceof AbortSignal
  });

  // Test fetch with AbortSignal
  const testResponse = await fetch('https://httpbin.org/delay/1', {
    signal: signal,
    method: 'GET',
    headers: { 'User-Agent': 'test' }
  });
  
  console.log('✅ Fetch with AbortSignal works:', testResponse.status);
  
} catch (error) {
  console.error('❌ AbortSignal test failed:', error.message);
}

// Test simple MEXC API call
console.log('\n🔧 Testing MEXC API directly...');
try {
  const response = await fetch('https://api.mexc.com/api/v3/ping', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'mexc-sniper-bot/1.0'
    }
  });
  
  const data = await response.json();
  console.log('✅ Direct MEXC API works:', data);
  
} catch (error) {
  console.error('❌ Direct MEXC API failed:', error.message);
}