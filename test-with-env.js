#!/usr/bin/env node

/**
 * Test runner with proper environment setup
 * Loads .env.test and runs vitest with correct environment variables
 */

import { config } from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load test environment variables
config({ path: path.join(__dirname, '.env.test') });

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

console.log('🔧 Loaded test environment variables');
console.log('📦 DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');

// Run the test command passed as arguments or default test command
const testCommand = process.argv.slice(2);
if (testCommand.length === 0) {
  testCommand.push('run', '--config=vitest.config.unified.js');
}

const vitestProcess = spawn('npx', ['vitest', ...testCommand], {
  stdio: 'inherit',
  env: { ...process.env }
});

vitestProcess.on('exit', (code) => {
  process.exit(code || 0);
});