#!/usr/bin/env bun

/**
 * Test script for Active Targets System
 * 
 * This script tests the complete active targets flow:
 * 1. Creates sample targets
 * 2. Fetches targets via API
 * 3. Tests target execution
 * 4. Validates target management
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TEST_USER_ID = 'test-user-active-targets';

interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function logResult(test: string, status: 'pass' | 'fail' | 'skip', message: string, data?: any) {
  results.push({ test, status, message, data });
  const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⏭️';
  console.log(`${icon} ${test}: ${message}`);
  if (data && process.env.DEBUG) {
    console.log('   Data:', JSON.stringify(data, null, 2));
  }
}

async function makeRequest(url: string, options: RequestInit = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const data = await response.json();
    return { response, data };
  } catch (error) {
    throw new Error(`Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function testCreateSampleTargets() {
  try {
    console.log('\n🎯 Testing: Create Sample Targets');
    
    const { response, data } = await makeRequest(
      `${BASE_URL}/api/snipe-targets/test?userId=${TEST_USER_ID}`,
      { method: 'POST' }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || response.statusText}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to create sample targets');
    }

    logResult(
      'Create Sample Targets',
      'pass',
      `Created ${data.data?.length || 0} sample targets`,
      data.data
    );
    
    return data.data;
  } catch (error) {
    logResult(
      'Create Sample Targets',
      'fail',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

async function testFetchTargets() {
  try {
    console.log('\n📋 Testing: Fetch Targets');
    
    const { response, data } = await makeRequest(
      `${BASE_URL}/api/snipe-targets?userId=${TEST_USER_ID}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || response.statusText}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch targets');
    }

    logResult(
      'Fetch Targets',
      'pass',
      `Retrieved ${data.count || 0} targets`,
      data.data
    );
    
    return data.data;
  } catch (error) {
    logResult(
      'Fetch Targets',
      'fail',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

async function testAutoSnipingStatus() {
  try {
    console.log('\n📊 Testing: Auto-Sniping Status');
    
    const { response, data } = await makeRequest(
      `${BASE_URL}/api/auto-sniping/status`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || response.statusText}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch auto-sniping status');
    }

    logResult(
      'Auto-Sniping Status',
      'pass',
      `Status: ${data.data?.status}, Active: ${data.data?.activeTargets}`,
      data.data
    );
    
    return data.data;
  } catch (error) {
    logResult(
      'Auto-Sniping Status',
      'fail',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

async function testAutoSnipingConfig() {
  try {
    console.log('\n⚙️ Testing: Auto-Sniping Configuration');
    
    const { response, data } = await makeRequest(
      `${BASE_URL}/api/auto-sniping/config`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || response.statusText}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch auto-sniping config');
    }

    logResult(
      'Auto-Sniping Config',
      'pass',
      `Config loaded with ${Object.keys(data.data || {}).length} settings`,
      data.data
    );
    
    return data.data;
  } catch (error) {
    logResult(
      'Auto-Sniping Config',
      'fail',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

async function testTargetExecution(targetId: number) {
  try {
    console.log('\n🚀 Testing: Target Execution');
    
    const { response, data } = await makeRequest(
      `${BASE_URL}/api/auto-sniping/execution`,
      {
        method: 'POST',
        body: JSON.stringify({
          action: 'execute_single_target',
          targetId,
          symbol: 'BTCUSDT',
          positionSizeUsdt: 100,
          strategy: 'test',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || response.statusText}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to execute target');
    }

    logResult(
      'Target Execution',
      'pass',
      `Execution ${data.data?.success ? 'successful' : 'failed'}`,
      data.data
    );
    
    return data.data;
  } catch (error) {
    logResult(
      'Target Execution',
      'fail',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

async function testUpdateTarget(targetId: number) {
  try {
    console.log('\n📝 Testing: Update Target');
    
    const { response, data } = await makeRequest(
      `${BASE_URL}/api/snipe-targets/${targetId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'ready',
          priority: 2,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || response.statusText}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to update target');
    }

    logResult(
      'Update Target',
      'pass',
      `Target ${targetId} updated successfully`,
      data.data
    );
    
    return data.data;
  } catch (error) {
    logResult(
      'Update Target',
      'fail',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

async function testDeleteTarget(targetId: number) {
  try {
    console.log('\n🗑️ Testing: Delete Target');
    
    const { response, data } = await makeRequest(
      `${BASE_URL}/api/snipe-targets/${targetId}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || response.statusText}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Failed to delete target');
    }

    logResult(
      'Delete Target',
      'pass',
      `Target ${targetId} deleted successfully`,
      data
    );
    
    return true;
  } catch (error) {
    logResult(
      'Delete Target',
      'fail',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return false;
  }
}

async function cleanup() {
  try {
    console.log('\n🧹 Cleaning up test data...');
    
    const { response, data } = await makeRequest(
      `${BASE_URL}/api/snipe-targets/test?userId=${TEST_USER_ID}`,
      { method: 'DELETE' }
    );

    if (response.ok && data.success) {
      logResult('Cleanup', 'pass', 'Test data cleaned up successfully');
    } else {
      logResult('Cleanup', 'skip', 'Cleanup attempted but may have failed');
    }
  } catch (error) {
    logResult('Cleanup', 'skip', 'Cleanup failed - manual cleanup may be needed');
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('🎯 ACTIVE TARGETS SYSTEM TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const skipped = results.filter(r => r.status === 'skip').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(`📊 Total: ${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results
      .filter(r => r.status === 'fail')
      .forEach(r => console.log(`   • ${r.test}: ${r.message}`));
  }
  
  const overallStatus = failed === 0 ? 'PASS' : 'FAIL';
  console.log(`\n🏆 OVERALL STATUS: ${overallStatus}`);
  console.log('='.repeat(60));
}

async function main() {
  console.log('🎯 Starting Active Targets System Test');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`👤 Test User: ${TEST_USER_ID}`);
  
  try {
    // Test 1: Create sample targets
    const sampleTargets = await testCreateSampleTargets();
    
    // Test 2: Fetch targets
    const targets = await testFetchTargets();
    
    // Test 3: Auto-sniping status
    await testAutoSnipingStatus();
    
    // Test 4: Auto-sniping config
    await testAutoSnipingConfig();
    
    // Test 5: Target management (if we have targets)
    if (targets && targets.length > 0) {
      const firstTarget = targets[0];
      
      // Test update
      await testUpdateTarget(firstTarget.id);
      
      // Test execution (simulated)
      await testTargetExecution(firstTarget.id);
      
      // Test delete (only for one target to keep some data)
      if (targets.length > 1) {
        await testDeleteTarget(targets[1].id);
      }
    } else {
      logResult('Target Management Tests', 'skip', 'No targets available for management tests');
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  } finally {
    // Cleanup
    await cleanup();
    
    // Print summary
    await printSummary();
  }
}

// Run the test suite
if (import.meta.main) {
  main().catch(console.error);
}

export { main as testActiveTargetsSystem };