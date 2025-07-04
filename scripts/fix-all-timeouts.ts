#!/usr/bin/env bun

/**
 * Fix All Timeouts Script
 * 
 * MISSION: Eliminate ALL "Test timed out in 5000ms" failures
 * 
 * This script automatically applies timeout fixes to all test files:
 * - Updates import statements to include timeout helpers
 * - Wraps timeout-sensitive tests with proper timeout handling
 * - Adds promise flushing to async tests
 * - Standardizes timeout configurations
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const PROJECT_ROOT = process.cwd();
const TESTS_DIR = join(PROJECT_ROOT, 'tests');

// Timeout patterns to fix
const TIMEOUT_PATTERNS = [
  /}, \s*\d+000\s*\);?\s*\/\/.*?timeout/gi,
  /}, \s*\d+000\s*\);?\s*$/gm,
  /\.\s*timeout\s*\(\s*\d+000\s*\)/gi,
];

// Import statement to add
const TIMEOUT_IMPORT = `import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../../../utils/timeout-elimination-helpers';`;

const RELATIVE_IMPORT_PATTERNS = [
  '../../../utils/timeout-elimination-helpers',
  '../../utils/timeout-elimination-helpers',
  '../utils/timeout-elimination-helpers',
  './utils/timeout-elimination-helpers',
];

/**
 * Get all test files recursively
 */
function getAllTestFiles(dir: string): string[] {
  const files: string[] = [];
  
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other non-test directories
      if (!['node_modules', 'dist', '.next', 'coverage', 'build'].includes(item)) {
        files.push(...getAllTestFiles(fullPath));
      }
    } else if (stat.isFile() && (item.endsWith('.test.ts') || item.endsWith('.test.js'))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Get the correct relative import path for a test file
 */
function getRelativeImportPath(testFilePath: string): string {
  const relativePath = testFilePath.replace(TESTS_DIR, '');
  const depth = relativePath.split('/').length - 2; // -1 for file, -1 for base
  
  if (depth <= 1) return '../utils/timeout-elimination-helpers';
  if (depth === 2) return '../../utils/timeout-elimination-helpers';
  if (depth === 3) return '../../../utils/timeout-elimination-helpers';
  
  return '../'.repeat(depth) + 'utils/timeout-elimination-helpers';
}

/**
 * Check if file already has timeout helpers imported
 */
function hasTimeoutImports(content: string): boolean {
  return RELATIVE_IMPORT_PATTERNS.some(pattern => content.includes(pattern));
}

/**
 * Add timeout elimination imports to a test file
 */
function addTimeoutImports(content: string, testFilePath: string): string {
  if (hasTimeoutImports(content)) {
    return content; // Already has imports
  }
  
  const importPath = getRelativeImportPath(testFilePath);
  const timeoutImport = `import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '${importPath}';`;
  
  // Find the last import statement
  const lines = content.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('} from ')) {
      lastImportIndex = i;
    }
  }
  
  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, '', timeoutImport);
    return lines.join('\n');
  }
  
  // If no imports found, add at the top after any comments
  let insertIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('//') && !lines[i].trim().startsWith('/*') && !lines[i].trim().startsWith('*')) {
      insertIndex = i;
      break;
    }
  }
  
  lines.splice(insertIndex, 0, timeoutImport, '');
  return lines.join('\n');
}

/**
 * Fix timeout patterns in test content
 */
function fixTimeoutPatterns(content: string): string {
  let fixed = content;
  
  // Replace timeout patterns with withTimeout wrapper
  fixed = fixed.replace(
    /it\(\s*['"`]([^'"`]+)['"`]\s*,\s*async\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*,\s*\d+000\s*\);?/g,
    (match, testName, testBody) => {
      const cleanedBody = testBody.trim();
      return `it('${testName}', withTimeout(async () => {${cleanedBody}
      
      // TIMEOUT ELIMINATION: Ensure all promises are flushed
      await flushPromises();
    }, TIMEOUT_CONFIG.STANDARD));`;
    }
  );
  
  // Replace simple timeout patterns
  fixed = fixed.replace(
    /\}\s*,\s*(\d+)000\s*\);?\s*(?:\/\/.*?timeout.*?)?$/gm,
    '}, TIMEOUT_CONFIG.STANDARD));'
  );
  
  return fixed;
}

/**
 * Add timeout elimination setup to describe blocks
 */
function addTimeoutSetup(content: string): string {
  if (content.includes('setupTimeoutElimination') || content.includes('timeoutHelpers')) {
    return content; // Already has setup
  }
  
  // Find describe blocks and add timeout setup
  const describePattern = /describe\(\s*['"`]([^'"`]+)['"`]\s*,\s*\(\s*\)\s*=>\s*\{/g;
  
  return content.replace(describePattern, (match, testSuiteName) => {
    return `${match}
  // TIMEOUT ELIMINATION: Setup comprehensive timeout handling
  const timeoutHelpers = setupTimeoutElimination({
    enableAutoTimers: true,
    enableConsoleOptimization: false,
    defaultTimeout: TIMEOUT_CONFIG.STANDARD
  });`;
  });
}

/**
 * Fix async patterns in beforeEach and afterEach
 */
function fixHookPatterns(content: string): string {
  let fixed = content;
  
  // Fix afterEach to be async and include promise flushing
  fixed = fixed.replace(
    /afterEach\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\);/g,
    (match, hookBody) => {
      if (hookBody.includes('flushPromises')) return match; // Already fixed
      
      return `afterEach(async () => {
    // TIMEOUT ELIMINATION: Ensure all promises are flushed before cleanup
    await flushPromises();${hookBody}
  });`;
    }
  );
  
  return fixed;
}

/**
 * Process a single test file
 */
function processTestFile(filePath: string): boolean {
  try {
    console.log(`🔧 Processing: ${filePath}`);
    
    const originalContent = readFileSync(filePath, 'utf-8');
    let content = originalContent;
    
    // Apply all fixes
    content = addTimeoutImports(content, filePath);
    content = addTimeoutSetup(content);
    content = fixTimeoutPatterns(content);
    content = fixHookPatterns(content);
    
    // Check if any changes were made
    if (content !== originalContent) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    } else {
      console.log(`⏭️ No changes needed: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🎯 TIMEOUT ELIMINATION: Starting comprehensive timeout fixes...');
  console.log(`📁 Scanning: ${TESTS_DIR}`);
  
  const testFiles = getAllTestFiles(TESTS_DIR);
  console.log(`📄 Found ${testFiles.length} test files`);
  
  let fixedCount = 0;
  let errorCount = 0;
  
  for (const testFile of testFiles) {
    try {
      const wasFixed = processTestFile(testFile);
      if (wasFixed) fixedCount++;
    } catch (error) {
      console.error(`❌ Failed to process ${testFile}:`, error);
      errorCount++;
    }
  }
  
  console.log('\n📊 TIMEOUT ELIMINATION SUMMARY:');
  console.log(`✅ Files processed: ${testFiles.length}`);
  console.log(`🔧 Files fixed: ${fixedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`⏭️ No changes needed: ${testFiles.length - fixedCount - errorCount}`);
  
  if (fixedCount > 0) {
    console.log('\n🎉 Timeout fixes applied successfully!');
    console.log('💡 Run tests to verify all timeout issues are resolved.');
  } else {
    console.log('\n✨ All test files already have timeout fixes applied.');
  }
  
  if (errorCount > 0) {
    console.log('\n⚠️ Some files had errors. Please review and fix manually.');
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});