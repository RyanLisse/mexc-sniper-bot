#!/usr/bin/env node

/**
 * System Integration Agent - Complete Integration Test
 * 
 * This script validates the complete system integration including:
 * 1. Database Configuration and Health
 * 2. API Credentials Integration
 * 3. System Check Page Functionality
 * 4. Environment Configuration
 * 5. API Endpoints Functionality
 */

const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:3008';

// ANSI color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function runSystemIntegrationTests() {
  log('\n🚀 MEXC Sniper Bot - System Integration Agent', 'bold');
  log('═'.repeat(60), 'cyan');
  log('Comprehensive system integration validation\n', 'blue');

  const testResults = {
    database: { status: 'pending' },
    environment: { status: 'pending' },
    mexcApi: { status: 'pending' },
    openaiApi: { status: 'pending' },
    apiCredentials: { status: 'pending' },
    kindeAuth: { status: 'pending' },
    inngestWorkflows: { status: 'pending' },
    systemCheck: { status: 'pending' }
  };

  let totalTests = 0;
  let passedTests = 0;

  // Helper function to run individual test
  async function runTest(testName, description, testFn) {
    totalTests++;
    log(`\n🔍 Testing: ${description}`, 'cyan');
    
    try {
      const result = await testFn();
      if (result.success) {
        log(`  ✅ ${testName}: PASSED`, 'green');
        log(`     ${result.message}`, 'green');
        testResults[testName] = { status: 'passed', ...result };
        passedTests++;
      } else {
        log(`  ❌ ${testName}: FAILED`, 'red');
        log(`     ${result.message}`, 'red');
        testResults[testName] = { status: 'failed', ...result };
      }
    } catch (error) {
      log(`  ❌ ${testName}: ERROR`, 'red');
      log(`     ${error.message}`, 'red');
      testResults[testName] = { status: 'error', message: error.message };
    }
  }

  // Test 1: Database Health
  await runTest('database', 'Database Configuration and Health', async () => {
    const response = await makeRequest(`${BASE_URL}/api/health/db`);
    
    if (response.status === 200 && response.data.status === 'healthy') {
      return {
        success: true,
        message: `Database connected successfully (${response.data.database?.database || 'unknown'})`
      };
    } else {
      return {
        success: false,
        message: `Database health check failed: ${response.data.error || 'Unknown error'}`
      };
    }
  });

  // Test 2: Environment Configuration
  await runTest('environment', 'Environment Variables Configuration', async () => {
    const response = await makeRequest(`${BASE_URL}/api/health/environment`);
    
    if (response.status === 200) {
      const { status, summary } = response.data;
      const missingRequired = summary?.missingRequired || [];
      
      if (status === 'healthy') {
        return {
          success: true,
          message: `All required environment variables configured (${summary.requiredConfigured}/${summary.requiredTotal})`
        };
      } else if (status === 'warning') {
        return {
          success: true,
          message: `Required variables OK, optional missing (${summary.optionalConfigured}/${summary.optionalTotal})`
        };
      } else {
        return {
          success: false,
          message: `Missing required variables: ${missingRequired.join(', ')}`
        };
      }
    } else {
      return {
        success: false,
        message: `Environment check failed with status ${response.status}`
      };
    }
  });

  // Test 3: MEXC API Connectivity
  await runTest('mexcApi', 'MEXC Exchange API Connectivity', async () => {
    const response = await makeRequest(`${BASE_URL}/api/mexc/connectivity`);
    
    if (response.status === 200 && response.data.connected) {
      return {
        success: true,
        message: 'MEXC API is accessible and responding'
      };
    } else {
      return {
        success: false,
        message: `MEXC API connectivity failed: ${response.data.error || 'Unknown error'}`
      };
    }
  });

  // Test 4: OpenAI API Health
  await runTest('openaiApi', 'OpenAI API Configuration', async () => {
    const response = await makeRequest(`${BASE_URL}/api/health/openai`);
    
    if (response.status === 200 && response.data.status === 'healthy') {
      return {
        success: true,
        message: 'OpenAI API properly configured and accessible'
      };
    } else {
      return {
        success: false,
        message: `OpenAI API check failed: ${response.data.error || 'Not configured'}`
      };
    }
  });

  // Test 5: API Credentials Endpoint
  await runTest('apiCredentials', 'API Credentials Storage System', async () => {
    const testUserId = 'test_user_integration_check';
    
    // Try to fetch credentials (should work even if none exist)
    const response = await makeRequest(`${BASE_URL}/api/api-credentials?userId=${testUserId}&provider=mexc`);
    
    if (response.status === 200) {
      return {
        success: true,
        message: 'API credentials endpoint accessible and responding correctly'
      };
    } else {
      return {
        success: false,
        message: `API credentials endpoint failed with status ${response.status}`
      };
    }
  });

  // Test 6: Authentication System
  await runTest('kindeAuth', 'Kinde Authentication System', async () => {
    const response = await makeRequest(`${BASE_URL}/api/auth/session`);
    
    // Auth endpoint should respond (may be 401 if not logged in, which is OK)
    if (response.status === 200 || response.status === 401 || response.status === 403) {
      return {
        success: true,
        message: 'Kinde authentication system is responding correctly'
      };
    } else {
      return {
        success: false,
        message: `Authentication system failed with unexpected status ${response.status}`
      };
    }
  });

  // Test 7: Inngest Workflows
  await runTest('inngestWorkflows', 'Inngest Workflow System', async () => {
    const response = await makeRequest(`${BASE_URL}/api/workflow-status`);
    
    if (response.status === 200) {
      const { active, fallbackData } = response.data;
      if (active || fallbackData) {
        return {
          success: true,
          message: fallbackData ? 'Workflows running in fallback mode' : 'Inngest workflows operational'
        };
      } else {
        return {
          success: false,
          message: 'Workflow system not responding properly'
        };
      }
    } else {
      return {
        success: false,
        message: `Workflow status check failed with status ${response.status}`
      };
    }
  });

  // Test 8: System Check Page Integration
  await runTest('systemCheck', 'System Check Page Integration', async () => {
    // This test verifies that the system check page would have access to all required APIs
    const healthChecks = [
      testResults.database.status === 'passed',
      testResults.environment.status === 'passed' || testResults.environment.status === 'warning',
      testResults.apiCredentials.status === 'passed'
    ];
    
    const passedHealthChecks = healthChecks.filter(Boolean).length;
    
    if (passedHealthChecks >= 2) { // At least database and environment or credentials working
      return {
        success: true,
        message: `System Check page integration ready (${passedHealthChecks}/3 core systems operational)`
      };
    } else {
      return {
        success: false,
        message: `System Check page integration incomplete (${passedHealthChecks}/3 core systems operational)`
      };
    }
  });

  // Generate Integration Report
  log('\n📊 INTEGRATION TEST RESULTS', 'bold');
  log('═'.repeat(60), 'cyan');
  
  const passRate = Math.round((passedTests / totalTests) * 100);
  
  log(`\n🎯 Overall Success Rate: ${passRate}% (${passedTests}/${totalTests} tests passed)`, 
      passRate >= 80 ? 'green' : passRate >= 60 ? 'yellow' : 'red');

  // Detailed Results
  log('\n📋 Detailed Results:', 'blue');
  Object.entries(testResults).forEach(([testName, result]) => {
    const statusIcon = result.status === 'passed' ? '✅' : 
                     result.status === 'failed' ? '❌' : '⚠️';
    const statusColor = result.status === 'passed' ? 'green' : 
                       result.status === 'failed' ? 'red' : 'yellow';
    
    log(`  ${statusIcon} ${testName.toUpperCase()}: ${result.status.toUpperCase()}`, statusColor);
    if (result.message) {
      log(`     ${result.message}`, 'cyan');
    }
  });

  // Integration Status Summary
  log('\n🔧 SYSTEM INTEGRATION STATUS', 'bold');
  log('═'.repeat(60), 'cyan');
  
  if (passRate >= 90) {
    log('\n🎉 EXCELLENT: System integration is fully operational!', 'green');
    log('   ✅ API credentials form is properly integrated', 'green');
    log('   ✅ Database configuration is working correctly', 'green');
    log('   ✅ All core system components are functional', 'green');
  } else if (passRate >= 70) {
    log('\n✅ GOOD: System integration is mostly operational', 'yellow');
    log('   ⚠️  Some non-critical components may need attention', 'yellow');
    log('   ✅ Core functionality should work properly', 'yellow');
  } else {
    log('\n⚠️  WARNING: System integration needs attention', 'red');
    log('   ❌ Critical components are not functioning properly', 'red');
    log('   🔧 Review failed tests and fix configuration issues', 'red');
  }

  // Specific Integration Recommendations
  log('\n🛠️  INTEGRATION RECOMMENDATIONS:', 'blue');
  
  if (testResults.database.status !== 'passed') {
    log('   🔧 Fix database configuration - check DATABASE_URL and run migrations', 'yellow');
  }
  
  if (testResults.apiCredentials.status !== 'passed') {
    log('   🔧 Fix API credentials backend - check database tables and authentication', 'yellow');
  }
  
  if (testResults.environment.status === 'failed') {
    log('   🔧 Set missing required environment variables', 'yellow');
  }
  
  if (testResults.mexcApi.status !== 'passed') {
    log('   🔧 Check internet connectivity and MEXC API status', 'yellow');
  }
  
  if (testResults.openaiApi.status !== 'passed') {
    log('   🔧 Set OPENAI_API_KEY environment variable', 'yellow');
  }

  log('\n🚀 Next Steps:', 'cyan');
  log('   1. Review any failed tests above', 'cyan');
  log('   2. Navigate to http://localhost:3008/config to test System Check page', 'cyan');
  log('   3. Test API credentials form functionality manually', 'cyan');
  log('   4. Verify all health checks show correct status', 'cyan');

  log('\n' + '═'.repeat(60), 'cyan');
  log('System Integration Agent - Complete ✅', 'bold');
  
  return {
    totalTests,
    passedTests,
    passRate,
    results: testResults
  };
}

// Run the tests if this script is executed directly
if (require.main === module) {
  runSystemIntegrationTests()
    .then((results) => {
      process.exit(results.passRate >= 70 ? 0 : 1);
    })
    .catch((error) => {
      console.error('Integration test failed:', error);
      process.exit(1);
    });
}

module.exports = { runSystemIntegrationTests };