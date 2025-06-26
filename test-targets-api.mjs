#!/usr/bin/env node

/**
 * Active Targets API Testing Script
 * 
 * Simple test to verify API endpoints are working correctly
 */

const BASE_URL = 'http://localhost:3008';
const TEST_USER_ID = 'test-user-123';

console.log('🧪 Testing Active Targets API...\n');

async function testAPI() {
  console.log('📡 Testing API endpoints...\n');
  
  try {
    // Test 1: GET all targets (should return empty array initially)
    console.log('1️⃣ Testing GET /api/snipe-targets...');
    const getResponse = await fetch(`${BASE_URL}/api/snipe-targets?userId=${TEST_USER_ID}`);
    
    if (getResponse.ok) {
      const getData = await getResponse.json();
      console.log('✅ GET endpoint working');
      console.log('   Response:', JSON.stringify(getData, null, 2));
    } else {
      console.log('❌ GET endpoint failed:', getResponse.status, getResponse.statusText);
      const errorText = await getResponse.text();
      console.log('   Error:', errorText);
    }
    
    console.log();
    
    // Test 2: POST create new target
    console.log('2️⃣ Testing POST /api/snipe-targets...');
    const testTarget = {
      userId: TEST_USER_ID,
      vcoinId: 'test-vcoin-001',
      symbolName: 'TESTUSDT',
      entryStrategy: 'market',
      positionSizeUsdt: 100,
      takeProfitLevel: 2,
      stopLossPercent: 5.0,
      confidenceScore: 85.5,
      riskLevel: 'medium',
      priority: 1
    };
    
    const postResponse = await fetch(`${BASE_URL}/api/snipe-targets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testTarget)
    });
    
    let createdTargetId = null;
    
    if (postResponse.ok) {
      const postData = await postResponse.json();
      console.log('✅ POST endpoint working');
      console.log('   Response:', JSON.stringify(postData, null, 2));
      
      if (postData.data && postData.data.id) {
        createdTargetId = postData.data.id;
        console.log('   Created target ID:', createdTargetId);
      }
    } else {
      console.log('❌ POST endpoint failed:', postResponse.status, postResponse.statusText);
      const errorText = await postResponse.text();
      console.log('   Error:', errorText);
    }
    
    console.log();
    
    // Test 3: GET specific target (if we created one)
    if (createdTargetId) {
      console.log(`3️⃣ Testing GET /api/snipe-targets/${createdTargetId}...`);
      const getOneResponse = await fetch(`${BASE_URL}/api/snipe-targets/${createdTargetId}`);
      
      if (getOneResponse.ok) {
        const getOneData = await getOneResponse.json();
        console.log('✅ GET individual endpoint working');
        console.log('   Response:', JSON.stringify(getOneData, null, 2));
      } else {
        console.log('❌ GET individual endpoint failed:', getOneResponse.status, getOneResponse.statusText);
      }
      
      console.log();
      
      // Test 4: PATCH update target
      console.log(`4️⃣ Testing PATCH /api/snipe-targets/${createdTargetId}...`);
      const updateData = {
        status: 'ready',
        executionPrice: 1.234,
        currentRetries: 1
      };
      
      const patchResponse = await fetch(`${BASE_URL}/api/snipe-targets/${createdTargetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });
      
      if (patchResponse.ok) {
        const patchData = await patchResponse.json();
        console.log('✅ PATCH endpoint working');
        console.log('   Response:', JSON.stringify(patchData, null, 2));
      } else {
        console.log('❌ PATCH endpoint failed:', patchResponse.status, patchResponse.statusText);
      }
      
      console.log();
      
      // Test 5: DELETE target
      console.log(`5️⃣ Testing DELETE /api/snipe-targets/${createdTargetId}...`);
      const deleteResponse = await fetch(`${BASE_URL}/api/snipe-targets/${createdTargetId}`, {
        method: 'DELETE'
      });
      
      if (deleteResponse.ok) {
        const deleteData = await deleteResponse.json();
        console.log('✅ DELETE endpoint working');
        console.log('   Response:', JSON.stringify(deleteData, null, 2));
      } else {
        console.log('❌ DELETE endpoint failed:', deleteResponse.status, deleteResponse.statusText);
      }
    } else {
      console.log('⏩ Skipping individual tests (no target was created)');
    }
    
    console.log('\n🎉 API testing completed!');
    
  } catch (error) {
    console.error('💥 API test failed:', error.message);
    
    if (error.cause && error.cause.code === 'ECONNREFUSED') {
      console.log('\n💡 Server not running. To test the API:');
      console.log('   1. Start the development server: bun run dev');
      console.log('   2. Run this test again: node test-targets-api.mjs');
    }
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    if (response.ok) {
      console.log('✅ Server is running');
      return true;
    }
  } catch (error) {
    console.log('❌ Server is not running or not accessible');
    console.log('💡 To start the server, run: bun run dev');
    return false;
  }
  return false;
}

// Main execution
async function main() {
  console.log('🎯 Active Targets API Test Suite\n');
  
  const serverRunning = await checkServer();
  
  if (serverRunning) {
    await testAPI();
  } else {
    console.log('\n📋 Manual Testing Instructions:');
    console.log('1. Start the development server: bun run dev');
    console.log('2. Run this test script: node test-targets-api.mjs');
    console.log('3. Or test manually with curl commands:');
    console.log('');
    console.log('   # Get all targets');
    console.log(`   curl "${BASE_URL}/api/snipe-targets?userId=${TEST_USER_ID}"`);
    console.log('');
    console.log('   # Create target');
    console.log(`   curl -X POST "${BASE_URL}/api/snipe-targets" \\`);
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"userId":"test-user","vcoinId":"test-001","symbolName":"TESTUSDT","positionSizeUsdt":100}\'');
  }
}

main().catch(console.error);