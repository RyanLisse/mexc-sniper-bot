#!/usr/bin/env node

/**
 * Test MEXC API connectivity directly
 * This will help identify if the issue is with credentials or API access
 */

import { config } from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

const API_KEY = process.env.MEXC_API_KEY;
const SECRET_KEY = process.env.MEXC_SECRET_KEY;
const BASE_URL = process.env.MEXC_BASE_URL || 'https://api.mexc.com';

console.log('🔍 MEXC API Connectivity Test');
console.log('=====================================');
console.log(`API Key: ${API_KEY ? API_KEY.slice(0, 6) + '...' : 'NOT SET'}`);
console.log(`Secret Key: ${SECRET_KEY ? SECRET_KEY.slice(0, 6) + '...' : 'NOT SET'}`);
console.log(`Base URL: ${BASE_URL}`);

function createSignature(queryString) {
  // MEXC uses simple HMAC-SHA256 of the query string
  return crypto.createHmac('sha256', SECRET_KEY).update(queryString).digest('hex');
}

async function testPublicEndpoint() {
  console.log('\n📡 Testing public endpoint (no authentication)...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/v3/ping`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Public endpoint accessible:', data);
      return true;
    } else {
      console.log('❌ Public endpoint failed:', response.status, data);
      return false;
    }
  } catch (error) {
    console.log('❌ Public endpoint error:', error.message);
    return false;
  }
}

async function testServerTime() {
  console.log('\n⏰ Testing server time endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/v3/time`);
    const data = await response.json();
    
    if (response.ok) {
      const serverTime = new Date(data.serverTime);
      const localTime = new Date();
      const timeDiff = Math.abs(serverTime.getTime() - localTime.getTime());
      
      console.log('✅ Server time retrieved:', serverTime.toISOString());
      console.log(`   Local time: ${localTime.toISOString()}`);
      console.log(`   Time difference: ${timeDiff}ms`);
      
      if (timeDiff > 5000) {
        console.log('⚠️  Warning: Time difference > 5 seconds may cause auth issues');
      }
      
      return { success: true, serverTime: data.serverTime };
    } else {
      console.log('❌ Server time failed:', response.status, data);
      return { success: false };
    }
  } catch (error) {
    console.log('❌ Server time error:', error.message);
    return { success: false };
  }
}

async function testAuthenticatedEndpoint() {
  console.log('\n🔐 Testing authenticated endpoint (account info)...');
  
  if (!API_KEY || !SECRET_KEY) {
    console.log('❌ API credentials not available for authentication test');
    return false;
  }
  
  try {
    const timestamp = Date.now();
    const endpoint = '/api/v3/account';
    const queryString = `timestamp=${timestamp}`;
    
    const signature = createSignature(queryString);
    
    const url = `${BASE_URL}${endpoint}?${queryString}&signature=${signature}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MEXC-APIKEY': API_KEY,
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Authentication successful!');
      console.log('   Account data:', {
        canTrade: data.canTrade,
        canWithdraw: data.canWithdraw,
        canDeposit: data.canDeposit,
        balances: data.balances?.length ? `${data.balances.length} balances` : 'No balances',
      });
      return true;
    } else {
      console.log('❌ Authentication failed:', response.status);
      console.log('   Error:', data);
      
      // Provide specific error guidance
      if (response.status === 401) {
        console.log('   💡 Suggestion: Check API key and secret are correct');
      } else if (response.status === 403) {
        console.log('   💡 Suggestion: Check API key permissions and IP whitelist');
      } else if (response.status === 429) {
        console.log('   💡 Suggestion: Rate limit exceeded, wait before retrying');
      }
      
      return false;
    }
  } catch (error) {
    console.log('❌ Authentication test error:', error.message);
    return false;
  }
}

async function testExchangeInfo() {
  console.log('\n💱 Testing exchange info endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/v3/exchangeInfo`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Exchange info retrieved:');
      console.log(`   Symbols available: ${data.symbols?.length || 0}`);
      console.log(`   Server timezone: ${data.timezone || 'Unknown'}`);
      console.log(`   Rate limits: ${data.rateLimits?.length || 0} rules`);
      return true;
    } else {
      console.log('❌ Exchange info failed:', response.status, data);
      return false;
    }
  } catch (error) {
    console.log('❌ Exchange info error:', error.message);
    return false;
  }
}

async function main() {
  console.log('Starting MEXC API connectivity tests...\n');
  
  const results = {
    publicEndpoint: false,
    serverTime: false,
    exchangeInfo: false,
    authentication: false,
  };
  
  // Test public endpoints first
  results.publicEndpoint = await testPublicEndpoint();
  
  const timeResult = await testServerTime();
  results.serverTime = timeResult.success;
  
  results.exchangeInfo = await testExchangeInfo();
  
  // Test authentication if public endpoints work
  if (results.publicEndpoint && results.serverTime) {
    results.authentication = await testAuthenticatedEndpoint();
  } else {
    console.log('\n⏭️  Skipping authentication test due to public endpoint failures');
  }
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`Public Endpoint: ${results.publicEndpoint ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Server Time: ${results.serverTime ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Exchange Info: ${results.exchangeInfo ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Authentication: ${results.authentication ? '✅ PASS' : '❌ FAIL'}`);
  
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`\nOverall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All MEXC API tests passed! The API is accessible and credentials are valid.');
    console.log('   The 500 error in the auto-sniping API might be due to a different issue.');
  } else if (results.publicEndpoint) {
    console.log('\n⚠️  MEXC API is accessible but there are issues with authentication.');
    console.log('   Check your API credentials and permissions.');
  } else {
    console.log('\n❌ MEXC API is not accessible from this network.');
    console.log('   Check your internet connection and firewall settings.');
  }
}

main().catch(console.error);