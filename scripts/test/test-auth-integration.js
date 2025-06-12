#!/usr/bin/env node

/**
 * Authentication Integration Test Script
 * Tests the integration between authentication and existing features
 */

const BASE_URL = 'http://localhost:3000';

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message,
    };
  }
}

async function testAuthIntegration() {
  console.log('🔐 Starting Authentication Integration Tests...\n');

  // Test 1: Create a test user
  console.log('1️⃣  Testing User Registration...');
  const signUpData = {
    email: 'test@mexcsniper.com',
    password: 'TestPassword123!',
    name: 'Test User',
  };

  const signUpResult = await makeRequest(`${BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    body: JSON.stringify(signUpData),
  });

  console.log('   Sign-up result:', signUpResult.ok ? '✅ SUCCESS' : '❌ FAILED');
  if (!signUpResult.ok) {
    console.log('   Error:', signUpResult.data?.message || signUpResult.error);
  }

  // Test 2: Sign in
  console.log('\n2️⃣  Testing User Sign-in...');
  const signInResult = await makeRequest(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    body: JSON.stringify({
      email: signUpData.email,
      password: signUpData.password,
    }),
  });

  console.log('   Sign-in result:', signInResult.ok ? '✅ SUCCESS' : '❌ FAILED');
  if (!signInResult.ok) {
    console.log('   Error:', signInResult.data?.message || signInResult.error);
    return; // Can't continue without authentication
  }

  const userSession = signInResult.data;
  const userId = userSession.user?.id;
  console.log('   User ID:', userId);

  // Test 3: User Preferences Integration
  console.log('\n3️⃣  Testing User Preferences Integration...');
  
  // 3a. Get default preferences (should create if not exists)
  const prefsResult = await makeRequest(`${BASE_URL}/api/user-preferences?userId=${userId}`);
  console.log('   Get preferences:', prefsResult.ok ? '✅ SUCCESS' : '❌ FAILED');
  if (prefsResult.ok && prefsResult.data) {
    console.log('   Default buy amount:', prefsResult.data.defaultBuyAmountUsdt, 'USDT');
    console.log('   Take profit levels:', prefsResult.data.takeProfitLevels);
  }

  // 3b. Update preferences
  const updatePrefsData = {
    userId,
    defaultBuyAmountUsdt: 250.0,
    takeProfitLevels: {
      level1: 7.5,
      level2: 12.5,
      level3: 17.5,
      level4: 30.0,
      custom: 50.0,
    },
    defaultTakeProfitLevel: 3,
    riskTolerance: 'high',
  };

  const updatePrefsResult = await makeRequest(`${BASE_URL}/api/user-preferences`, {
    method: 'POST',
    body: JSON.stringify(updatePrefsData),
  });

  console.log('   Update preferences:', updatePrefsResult.ok ? '✅ SUCCESS' : '❌ FAILED');

  // 3c. Verify update
  const verifyPrefsResult = await makeRequest(`${BASE_URL}/api/user-preferences?userId=${userId}`);
  if (verifyPrefsResult.ok && verifyPrefsResult.data) {
    console.log('   Updated buy amount:', verifyPrefsResult.data.defaultBuyAmountUsdt, 'USDT');
    console.log('   Updated risk tolerance:', verifyPrefsResult.data.riskTolerance);
  }

  // Test 4: Account Balance Integration
  console.log('\n4️⃣  Testing Account Balance Integration...');
  const balanceResult = await makeRequest(`${BASE_URL}/api/account/balance`);
  console.log('   Account balance:', balanceResult.ok ? '✅ SUCCESS' : '❌ FAILED');
  if (balanceResult.ok) {
    console.log('   Total USDT value:', balanceResult.data?.data?.totalUsdtValue || 0);
    console.log('   Number of assets:', balanceResult.data?.data?.balances?.length || 0);
  } else {
    console.log('   Error:', balanceResult.data?.error || balanceResult.error);
  }

  // Test 5: Workflow Status Integration
  console.log('\n5️⃣  Testing Workflow Status Integration...');
  const workflowResult = await makeRequest(`${BASE_URL}/api/workflow-status`);
  console.log('   Workflow status:', workflowResult.ok ? '✅ SUCCESS' : '❌ FAILED');
  if (workflowResult.ok) {
    console.log('   System status:', workflowResult.data?.systemStatus);
    console.log('   Ready tokens:', workflowResult.data?.metrics?.readyTokens || 0);
  }

  // Test 6: MEXC Data Integration
  console.log('\n6️⃣  Testing MEXC Data Integration...');
  const mexcCalendarResult = await makeRequest(`${BASE_URL}/api/mexc/calendar`);
  console.log('   MEXC calendar:', mexcCalendarResult.ok ? '✅ SUCCESS' : '❌ FAILED');
  if (mexcCalendarResult.ok) {
    console.log('   Calendar entries:', mexcCalendarResult.data?.data?.length || 0);
  }

  // Test 7: Data Isolation
  console.log('\n7️⃣  Testing Data Isolation...');
  
  // Create another user
  const user2Data = {
    email: 'test2@mexcsniper.com',
    password: 'TestPassword123!',
    name: 'Test User 2',
  };

  const signUp2Result = await makeRequest(`${BASE_URL}/api/auth/sign-up/email`, {
    method: 'POST',
    body: JSON.stringify(user2Data),
  });

  if (signUp2Result.ok) {
    const signIn2Result = await makeRequest(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      body: JSON.stringify({
        email: user2Data.email,
        password: user2Data.password,
      }),
    });

    if (signIn2Result.ok) {
      const userId2 = signIn2Result.data.user?.id;
      
      // Check if user2 has different preferences
      const user2PrefsResult = await makeRequest(`${BASE_URL}/api/user-preferences?userId=${userId2}`);
      
      if (user2PrefsResult.ok) {
        const user1Prefs = verifyPrefsResult.data;
        const user2Prefs = user2PrefsResult.data;
        
        const isIsolated = !user2Prefs || user2Prefs.defaultBuyAmountUsdt !== user1Prefs.defaultBuyAmountUsdt;
        console.log('   Data isolation:', isIsolated ? '✅ SUCCESS' : '❌ FAILED');
        
        if (user2Prefs) {
          console.log('   User 1 buy amount:', user1Prefs.defaultBuyAmountUsdt);
          console.log('   User 2 buy amount:', user2Prefs.defaultBuyAmountUsdt);
        }
      }
    }
  }

  // Test 8: Anonymous Access
  console.log('\n8️⃣  Testing Anonymous Access...');
  
  // Test which endpoints should work for anonymous users
  const anonymousTests = [
    { name: 'MEXC Calendar', url: `${BASE_URL}/api/mexc/calendar` },
    { name: 'MEXC Connectivity', url: `${BASE_URL}/api/mexc/connectivity` },
    { name: 'Workflow Status', url: `${BASE_URL}/api/workflow-status` },
  ];

  for (const test of anonymousTests) {
    const result = await makeRequest(test.url);
    console.log(`   ${test.name}:`, result.ok ? '✅ ACCESSIBLE' : '❌ BLOCKED');
  }

  // Test 9: User-specific Endpoints
  console.log('\n9️⃣  Testing User-specific Endpoints...');
  
  const userSpecificTests = [
    { name: 'User Preferences', url: `${BASE_URL}/api/user-preferences?userId=anonymous` },
    { name: 'Account Balance', url: `${BASE_URL}/api/account/balance` },
  ];

  for (const test of userSpecificTests) {
    const result = await makeRequest(test.url);
    console.log(`   ${test.name}:`, result.ok ? '✅ WORKS' : '❌ FAILS');
    if (!result.ok) {
      console.log(`     Error: ${result.data?.error || result.error}`);
    }
  }

  console.log('\n🎉 Authentication Integration Tests Complete!\n');
}

// Run the tests
testAuthIntegration().catch(console.error);