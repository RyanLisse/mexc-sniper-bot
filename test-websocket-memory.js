#!/usr/bin/env node

/**
 * WebSocket Memory Test Runner
 * Run with: node test-websocket-memory.js
 * Or with garbage collection: node --expose-gc test-websocket-memory.js
 */

// Register TypeScript
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true
  }
});

// Run the test
const { WebSocketMemoryTest } = require('./src/services/websocket-memory-test.ts');

console.log('🚀 Starting WebSocket Memory Test...');
console.log('Running with garbage collection:', typeof global.gc !== 'undefined' ? 'ENABLED' : 'DISABLED');
console.log('For better results, run with: node --expose-gc test-websocket-memory.js\n');

const test = new WebSocketMemoryTest();
test.runAllTests().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});