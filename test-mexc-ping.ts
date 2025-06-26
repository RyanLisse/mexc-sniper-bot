#!/usr/bin/env node

/**
 * Test Direct MEXC API Access
 * Converted from JavaScript to TypeScript for type safety
 */

interface PingResponse {
  [key: string]: any;
}

interface TimeResponse {
  serverTime: number;
  [key: string]: any;
}

console.log('🔍 Testing Direct MEXC API Access...');

try {
  // Test basic ping endpoint
  console.log('📡 Testing ping endpoint...');
  const pingResponse = await fetch('https://api.mexc.com/api/v3/ping');
  console.log(`📊 Ping status: ${pingResponse.status}`);
  
  if (pingResponse.ok) {
    const pingData: PingResponse = await pingResponse.json();
    console.log('✅ Ping successful:', pingData);
  } else {
    console.log('❌ Ping failed');
  }

  // Test server time endpoint
  console.log('\n⏰ Testing server time endpoint...');
  const timeResponse = await fetch('https://api.mexc.com/api/v3/time');
  console.log(`📊 Time status: ${timeResponse.status}`);
  
  if (timeResponse.ok) {
    const timeData: TimeResponse = await timeResponse.json();
    console.log('✅ Server time successful:', timeData);
    console.log(`🕐 Server time: ${new Date(timeData.serverTime).toISOString()}`);
  } else {
    const errorText = await timeResponse.text();
    console.log('❌ Server time failed:', errorText);
  }

} catch (error) {
  const err = error as Error;
  console.error('💥 Direct API test failed:', err.message);
  console.error('Stack:', err.stack);
}