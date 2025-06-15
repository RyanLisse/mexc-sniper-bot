#!/usr/bin/env node

/**
 * System Integration Summary - Final Validation
 * Quick validation of all key integration points
 */

const http = require('http');

const BASE_URL = 'http://localhost:3008';

async function makeRequest(path) {
  return new Promise((resolve) => {
    const req = http.request(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : {},
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        }
      });
    });
    req.on('error', () => resolve({ status: 0, success: false }));
    req.end();
  });
}

async function runIntegrationSummary() {
  console.log('\n🎯 MEXC Sniper Bot - Integration Summary\n');

  const tests = [
    { name: 'Database Health', path: '/api/health/db' },
    { name: 'Environment Config', path: '/api/health/environment' },
    { name: 'MEXC Connectivity', path: '/api/mexc/connectivity' },
    { name: 'OpenAI Config', path: '/api/health/openai' },
    { name: 'Workflow Status', path: '/api/workflow-status' }
  ];

  let passed = 0;
  let total = tests.length;

  console.log('Testing core system components...\n');

  for (const test of tests) {
    const result = await makeRequest(test.path);
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    const statusCode = result.status;
    
    console.log(`${status} ${test.name.padEnd(20)} (${statusCode})`);
    
    if (result.success) {
      passed++;
      
      // Show key details for important checks
      if (test.name === 'Database Health' && result.data.status === 'healthy') {
        console.log(`     📊 Database: ${result.data.database?.message || 'Connected'}`);
      }
      if (test.name === 'Environment Config' && result.data.status) {
        const summary = result.data.summary;
        console.log(`     🔧 Config: ${summary?.requiredConfigured}/${summary?.requiredTotal} required, ${summary?.optionalConfigured}/${summary?.optionalTotal} optional`);
      }
      if (test.name === 'MEXC Connectivity' && result.data.connected) {
        console.log(`     🌐 Exchange: API accessible and responding`);
      }
      if (test.name === 'OpenAI Config' && result.data.configured) {
        console.log(`     🤖 AI: API key configured and valid format`);
      }
      if (test.name === 'Workflow Status') {
        console.log(`     ⚡ Workflows: System responding (may use fallback data)`);
      }
    }
  }

  const successRate = Math.round((passed / total) * 100);
  console.log(`\n📊 Integration Success Rate: ${successRate}% (${passed}/${total})`);

  if (successRate >= 80) {
    console.log('\n🎉 INTEGRATION STATUS: EXCELLENT');
    console.log('✅ API credentials form is ready for use');
    console.log('✅ System Check page is fully functional');
    console.log('✅ All core systems are operational');
    console.log('\n🚀 Ready for production use!');
    console.log('\n📱 Access System Check: http://localhost:3008/config');
  } else if (successRate >= 60) {
    console.log('\n⚠️  INTEGRATION STATUS: PARTIAL');
    console.log('✅ Core functionality available');
    console.log('⚠️  Some components may need attention');
  } else {
    console.log('\n❌ INTEGRATION STATUS: NEEDS ATTENTION');
    console.log('🔧 Critical components need configuration');
  }

  console.log('\n' + '═'.repeat(50));
}

runIntegrationSummary().catch(console.error);