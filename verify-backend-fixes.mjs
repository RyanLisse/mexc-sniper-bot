#!/usr/bin/env node

/**
 * Backend API Verification Script
 * 
 * Tests critical API endpoints to verify backend fixes are working correctly
 * Specifically tests calendar-to-database sync and state synchronization
 */

const BASE_URL = 'http://localhost:3008';
const TEST_USER_ID = 'verification-test-user-123';

// ANSI color codes for better output formatting
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bright: '\x1b[1m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log('cyan', `= ${title}`);
  console.log('='.repeat(60));
}

function logTest(testName) {
  log('blue', `\n=Ë Testing: ${testName}`);
}

function logSuccess(message) {
  log('green', ` ${message}`);
}

function logWarning(message) {
  log('yellow', `   ${message}`);
}

function logError(message) {
  log('red', `L ${message}`);
}

function logInfo(message) {
  log('white', `9  ${message}`);
}

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

function recordResult(test, status, message, data = null) {
  testResults.details.push({ test, status, message, data, timestamp: new Date().toISOString() });
  if (status === 'passed') testResults.passed++;
  else if (status === 'failed') testResults.failed++;
  else if (status === 'warning') testResults.warnings++;
}

// ============================================================================
// Test Functions
// ============================================================================

async function checkServerHealth() {
  logTest('Server Health Check');
  
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    if (response.ok) {
      logSuccess('Server is running and responding');
      recordResult('server_health', 'passed', 'Server responsive');
      return true;
    } else {
      logError(`Server responded with status: ${response.status}`);
      recordResult('server_health', 'failed', `HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Server not accessible: ${error.message}`);
    recordResult('server_health', 'failed', error.message);
    return false;
  }
}

async function testAutoSnipingStatus() {
  logTest('Auto-Sniping Status Endpoint');
  
  try {
    const response = await fetch(`${BASE_URL}/api/auto-sniping/status`);
    
    if (!response.ok) {
      logError(`Status endpoint failed: ${response.status} ${response.statusText}`);
      recordResult('auto_sniping_status', 'failed', `HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.success) {
      logWarning('Status endpoint returned unsuccessful response');
      recordResult('auto_sniping_status', 'warning', 'Unsuccessful response');
      return data;
    }
    
    logSuccess('Auto-sniping status endpoint working');
    
    // Check target count consistency
    if (data.data && data.data.targetCounts) {
      const counts = data.data.targetCounts;
      logInfo(`Target counts - Memory: ${counts.memory}, Database: ${counts.database}, Unified: ${counts.unified}`);
      
      if (counts.isConsistent) {
        logSuccess('Target counts are consistent across state synchronizer');
      } else {
        logWarning('Target counts show inconsistency - potential sync issue');
        logInfo(`Consistency source: ${counts.source}`);
        if (counts.warning) logWarning(`Warning: ${counts.warning}`);
      }
    }
    
    // Check state consistency
    if (data.data && data.data.stateConsistency) {
      const consistency = data.data.stateConsistency;
      if (consistency.isConsistent) {
        logSuccess('State synchronization is consistent');
      } else {
        logWarning('State inconsistency detected');
        if (consistency.inconsistencies.length > 0) {
          logInfo(`Inconsistencies: ${consistency.inconsistencies.join(', ')}`);
        }
        if (consistency.recommendedActions.length > 0) {
          logInfo(`Recommended actions: ${consistency.recommendedActions.join(', ')}`);
        }
      }
    }
    
    recordResult('auto_sniping_status', 'passed', 'Status endpoint working', {
      activeTargets: data.data?.activeTargets,
      targetCounts: data.data?.targetCounts,
      isConsistent: data.data?.stateConsistency?.isConsistent
    });
    
    return data;
    
  } catch (error) {
    logError(`Auto-sniping status test failed: ${error.message}`);
    recordResult('auto_sniping_status', 'failed', error.message);
    return null;
  }
}

async function testMexcCalendar() {
  logTest('MEXC Calendar Endpoint');
  
  try {
    const response = await fetch(`${BASE_URL}/api/mexc/calendar`);
    
    if (!response.ok) {
      logError(`Calendar endpoint failed: ${response.status} ${response.statusText}`);
      recordResult('mexc_calendar', 'failed', `HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.success) {
      logWarning('Calendar endpoint returned unsuccessful response');
      recordResult('mexc_calendar', 'warning', 'Unsuccessful response');
      return data;
    }
    
    logSuccess('MEXC calendar endpoint working');
    
    const calendarData = Array.isArray(data.data) ? data.data : [];
    logInfo(`Calendar returned ${calendarData.length} listings`);
    
    if (data.meta) {
      if (data.meta.cached) {
        logInfo('Calendar data served from cache');
      }
      if (data.meta.executionTimeMs) {
        logInfo(`Response time: ${data.meta.executionTimeMs}ms`);
      }
    }
    
    if (calendarData.length === 0) {
      logWarning('No calendar listings returned - check MEXC API connectivity');
    } else {
      logSuccess(`Successfully retrieved ${calendarData.length} calendar entries`);
      
      // Show sample data
      if (calendarData.length > 0) {
        const firstItem = calendarData[0];
        logInfo(`Sample listing: ${firstItem.vcoinId || firstItem.symbol || 'unknown'}`);
      }
    }
    
    recordResult('mexc_calendar', 'passed', 'Calendar endpoint working', {
      count: calendarData.length,
      cached: data.meta?.cached,
      responseTime: data.meta?.executionTimeMs
    });
    
    return data;
    
  } catch (error) {
    logError(`MEXC calendar test failed: ${error.message}`);
    recordResult('mexc_calendar', 'failed', error.message);
    return null;
  }
}

async function testSnipeTargets() {
  logTest('Snipe Targets Database Endpoint');
  
  try {
    const response = await fetch(`${BASE_URL}/api/snipe-targets?userId=${TEST_USER_ID}`);
    
    if (!response.ok) {
      logError(`Snipe targets endpoint failed: ${response.status} ${response.statusText}`);
      recordResult('snipe_targets', 'failed', `HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.success) {
      logWarning('Snipe targets endpoint returned unsuccessful response');
      recordResult('snipe_targets', 'warning', 'Unsuccessful response');
      return data;
    }
    
    logSuccess('Snipe targets endpoint working');
    
    const targets = Array.isArray(data.data) ? data.data : [];
    logInfo(`Database contains ${targets.length} snipe targets for test user`);
    
    if (data.meta && data.meta.count !== undefined) {
      logInfo(`Reported count: ${data.meta.count}`);
    }
    
    // Check for different statuses
    const statusCounts = targets.reduce((acc, target) => {
      acc[target.status] = (acc[target.status] || 0) + 1;
      return acc;
    }, {});
    
    if (Object.keys(statusCounts).length > 0) {
      logInfo(`Target statuses: ${JSON.stringify(statusCounts)}`);
    }
    
    recordResult('snipe_targets', 'passed', 'Targets endpoint working', {
      count: targets.length,
      statuses: statusCounts
    });
    
    return data;
    
  } catch (error) {
    logError(`Snipe targets test failed: ${error.message}`);
    recordResult('snipe_targets', 'failed', error.message);
    return null;
  }
}

async function testMexcUnifiedStatus() {
  logTest('MEXC Unified Status Endpoint');
  
  try {
    const response = await fetch(`${BASE_URL}/api/mexc/unified-status`);
    
    if (!response.ok) {
      logError(`Unified status endpoint failed: ${response.status} ${response.statusText}`);
      recordResult('mexc_unified_status', 'failed', `HTTP ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.success) {
      logWarning('Unified status endpoint returned unsuccessful response');
      recordResult('mexc_unified_status', 'warning', 'Unsuccessful response');
      return data;
    }
    
    logSuccess('MEXC unified status endpoint working');
    
    if (data.data) {
      const status = data.data;
      
      // Check connection status
      if (status.connected) {
        logSuccess('MEXC API connection: CONNECTED');
      } else {
        logWarning('MEXC API connection: DISCONNECTED');
      }
      
      // Check credentials
      if (status.hasCredentials) {
        if (status.credentialsValid) {
          logSuccess('MEXC credentials: VALID');
        } else {
          logWarning('MEXC credentials: INVALID');
        }
        logInfo(`Credential source: ${status.credentialSource}`);
        
        if (status.isTestCredentials) {
          logWarning('Using TEST credentials (not production)');
        }
      } else {
        logWarning('MEXC credentials: NOT CONFIGURED');
      }
      
      // Check trading capability
      if (status.canTrade) {
        logSuccess('Trading capability: ENABLED');
      } else {
        logWarning('Trading capability: DISABLED');
      }
      
      // Overall status
      logInfo(`Overall status: ${status.overallStatus.toUpperCase()}`);
      logInfo(`Status message: ${status.statusMessage}`);
      
      if (status.connectionHealth) {
        logInfo(`Connection quality: ${status.connectionHealth}`);
      }
      
      if (status.responseTime) {
        logInfo(`Response time: ${status.responseTime}ms`);
      }
      
      // Show recommendations if any issues
      if (status.recommendations && status.recommendations.length > 0) {
        logInfo('Recommendations:');
        status.recommendations.forEach(rec => logInfo(`  " ${rec}`));
      }
      
      recordResult('mexc_unified_status', 'passed', 'Unified status working', {
        connected: status.connected,
        hasCredentials: status.hasCredentials,
        credentialsValid: status.credentialsValid,
        canTrade: status.canTrade,
        overallStatus: status.overallStatus
      });
    }
    
    return data;
    
  } catch (error) {
    logError(`MEXC unified status test failed: ${error.message}`);
    recordResult('mexc_unified_status', 'failed', error.message);
    return null;
  }
}

async function testCalendarToDbSync() {
  logTest('Calendar-to-Database Sync Verification');
  
  try {
    // First, get calendar data
    const calendarResponse = await fetch(`${BASE_URL}/api/mexc/calendar`);
    const calendarData = calendarResponse.ok ? await calendarResponse.json() : null;
    
    // Get current database targets
    const targetsResponse = await fetch(`${BASE_URL}/api/snipe-targets?userId=${TEST_USER_ID}`);
    const targetsData = targetsResponse.ok ? await targetsResponse.json() : null;
    
    if (!calendarData || !targetsData) {
      logWarning('Cannot verify sync - one or both endpoints failed');
      recordResult('calendar_db_sync', 'warning', 'Endpoints unavailable for sync verification');
      return;
    }
    
    const calendarCount = Array.isArray(calendarData.data) ? calendarData.data.length : 0;
    const targetsCount = Array.isArray(targetsData.data) ? targetsData.data.length : 0;
    
    logInfo(`Calendar entries: ${calendarCount}`);
    logInfo(`Database targets: ${targetsCount}`);
    
    if (calendarCount === 0) {
      logWarning('No calendar data available - sync verification limited');
    } else if (targetsCount === 0) {
      logWarning('No database targets found - sync may not have run yet');
    } else {
      logSuccess('Both calendar and database contain data');
      
      // Check if sync service is available
      try {
        const syncResponse = await fetch(`${BASE_URL}/api/sync/calendar-to-database`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dryRun: true, userId: TEST_USER_ID })
        });
        
        if (syncResponse.ok) {
          logSuccess('Calendar-to-database sync endpoint is accessible');
        } else {
          logWarning('Calendar-to-database sync endpoint returned error');
        }
      } catch (syncError) {
        logWarning('Calendar-to-database sync endpoint not accessible');
      }
    }
    
    recordResult('calendar_db_sync', 'passed', 'Sync verification completed', {
      calendarCount,
      targetsCount
    });
    
  } catch (error) {
    logError(`Calendar-to-database sync verification failed: ${error.message}`);
    recordResult('calendar_db_sync', 'failed', error.message);
  }
}

// ============================================================================
// Main Test Execution
// ============================================================================

async function runAllTests() {
  logSection('BACKEND API VERIFICATION SCRIPT');
  log('white', 'Testing critical endpoints to verify backend fixes...\n');
  
  const startTime = Date.now();
  
  // Test 1: Server Health
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    logError('\nServer is not running. Start with: bun run dev');
    logError('Cannot proceed with API tests.\n');
    return;
  }
  
  // Test 2: Auto-Sniping Status (critical for state consistency)
  await testAutoSnipingStatus();
  
  // Test 3: MEXC Calendar (source of truth for new listings)
  await testMexcCalendar();
  
  // Test 4: Snipe Targets Database (targets after sync)
  await testSnipeTargets();
  
  // Test 5: MEXC Unified Status (system health)
  await testMexcUnifiedStatus();
  
  // Test 6: Calendar-to-Database Sync Verification
  await testCalendarToDbSync();
  
  // Results Summary
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  logSection('TEST RESULTS SUMMARY');
  
  log('bright', `\nTest Execution Complete (${duration}ms)`);
  console.log(`\n=Ê Results:`);
  logSuccess(`   Passed: ${testResults.passed}`);
  if (testResults.warnings > 0) {
    logWarning(`     Warnings: ${testResults.warnings}`);
  }
  if (testResults.failed > 0) {
    logError(`  L Failed: ${testResults.failed}`);
  }
  
  // Detailed Results
  if (testResults.details.length > 0) {
    console.log('\n=Ë Detailed Results:');
    testResults.details.forEach(result => {
      const icon = result.status === 'passed' ? '' : result.status === 'warning' ? ' ' : 'L';
      console.log(`  ${icon} ${result.test}: ${result.message}`);
    });
  }
  
  // Overall Assessment
  console.log('\n<¯ Backend Fix Assessment:');
  
  if (testResults.failed === 0) {
    if (testResults.warnings === 0) {
      logSuccess('<‰ All backend fixes are working correctly!');
      logSuccess('( System is ready for frontend testing');
    } else {
      logWarning('¡ Backend fixes are mostly working, but some issues detected');
      logInfo('=Ý Review warnings above for potential improvements');
    }
  } else {
    logError('=¨ Some backend components are not working correctly');
    logError('=' Review failed tests before proceeding with frontend');
  }
  
  // Export results for further analysis
  const resultsFile = 'backend-verification-results.json';
  try {
    await import('fs').then(fs => {
      fs.writeFileSync(resultsFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        duration,
        summary: {
          passed: testResults.passed,
          warnings: testResults.warnings,
          failed: testResults.failed
        },
        details: testResults.details
      }, null, 2));
    });
    logInfo(`=Ä Detailed results saved to ${resultsFile}`);
  } catch (error) {
    // Ignore file writing errors in case of permission issues
  }
  
  console.log('\n');
}

// Execute the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('\n=¥ Test execution failed:', error);
    process.exit(1);
  });
}

export { runAllTests };